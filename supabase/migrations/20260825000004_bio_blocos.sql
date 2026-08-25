-- ============================================================
-- O MOTOR DE BLOCOS DO LINK NA BIO
--
-- Até aqui a página era uma lista de botões: bio_links guardava título, URL e
-- ícone, e era só isso que dava pra colocar no ar. Quem usa Linktree, Beacons
-- ou Stan Store em 2026 espera bem mais: vídeo tocando na página, galeria,
-- perguntas frequentes, contagem regressiva, mapa da loja.
--
-- Em vez de criar uma tabela por tipo (o caminho curto que vira dez tabelas em
-- seis meses), existe UMA tabela de blocos. O que muda de um tipo pro outro
-- vive em `data`, um jsonb livre. Adicionar um tipo novo passa a ser código no
-- front, não migration.
--
-- QUEM É O DONO, de novo as três situações:
--   · criador na própria conta      → user_id = ele,      page_id nulo
--   · cliente com conta Cria        → user_id = o cliente, page_id nulo
--   · cliente só da ficha do CRM    → user_id = a gestora, page_id preenchido
--
-- ESTILO: cada bloco pertence a um estilo ('classico' ou 'site'). Trocar de
-- estilo não apaga a montagem do outro, que é a promessa que a tela faz.
--
-- JANELA DE DATAS: starts_at/ends_at é o "link agendado". A promoção entra
-- sozinha no dia e sai sozinha no fim, sem ninguém lembrar de tirar do ar.
-- A conta de quem está no ar é feita no servidor, porque relógio de visitante
-- não é confiável.
-- ============================================================

create table if not exists public.bio_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  page_id uuid references public.bio_pages(id) on delete cascade,
  estilo text not null default 'classico' check (estilo in ('classico', 'site')),
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  "position" integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  clicks integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bio_blocks_dono on public.bio_blocks(user_id, estilo, "position") where page_id is null;
create index if not exists idx_bio_blocks_pagina on public.bio_blocks(page_id, estilo, "position") where page_id is not null;

alter table public.bio_blocks enable row level security;

-- Dono da conta.
drop policy if exists "bio_blocks do dono" on public.bio_blocks;
create policy "bio_blocks do dono" on public.bio_blocks
  for all to authenticated
  using (page_id is null and auth.uid() = user_id)
  with check (page_id is null and auth.uid() = user_id);

-- Gestora (e a equipe dela) na conta de um cliente que usa o Cria.
drop policy if exists "bio_blocks da conta gerida" on public.bio_blocks;
create policy "bio_blocks da conta gerida" on public.bio_blocks
  for all to authenticated
  using (page_id is null and exists (
    select 1 from public.account_members am
     where am.owner_id = bio_blocks.user_id and am.status = 'active' and public.acts_for(am.member_id)))
  with check (page_id is null and exists (
    select 1 from public.account_members am
     where am.owner_id = bio_blocks.user_id and am.status = 'active' and public.acts_for(am.member_id)));

-- Página montada pela agência pra um cliente do CRM.
drop policy if exists "bio_blocks da pagina do cliente" on public.bio_blocks;
create policy "bio_blocks da pagina do cliente" on public.bio_blocks
  for all to authenticated
  using (page_id is not null and exists (
    select 1 from public.bio_pages bp where bp.id = bio_blocks.page_id and public.acts_for(bp.manager_id)))
  with check (page_id is not null and exists (
    select 1 from public.bio_pages bp where bp.id = bio_blocks.page_id and public.acts_for(bp.manager_id)));

-- ────────────────────────────────────────────────────────────
-- Trazer o que já está no ar
--
-- Ninguém pode perder a página que montou. Cada bio_links vira um bloco de
-- tipo 'link' (ou 'titulo', que era o link_type = 'header'). Rodar duas vezes
-- não duplica: a origem fica marcada em data->>'de_bio_link'.
-- bio_links continua existindo e intocada, como rede de segurança.
-- ────────────────────────────────────────────────────────────
insert into public.bio_blocks (user_id, page_id, estilo, kind, data, "position", is_active, clicks, created_at)
select
  bl.user_id,
  bl.page_id,
  'classico',
  case when bl.link_type = 'header' then 'titulo' else 'link' end,
  jsonb_strip_nulls(jsonb_build_object(
    'titulo', bl.title,
    'url', case when bl.link_type = 'header' then null else bl.url end,
    'icone', bl.icon,
    'capa', bl.thumbnail_url,
    'de_bio_link', bl.id::text
  )),
  coalesce(bl."position", 0),
  coalesce(bl.is_active, true),
  coalesce(bl.clicks, 0),
  coalesce(bl.created_at, now())
from public.bio_links bl
where not exists (
  select 1 from public.bio_blocks b where b.data->>'de_bio_link' = bl.id::text
);

-- ────────────────────────────────────────────────────────────
-- Leitura pública
--
-- Devolve só o que está no ar AGORA: ativo e dentro da janela de datas.
-- A conta é feita aqui porque o relógio do visitante pode estar errado (ou ser
-- mexido de propósito pra ver a promoção antes da hora).
-- ────────────────────────────────────────────────────────────
create or replace function public.get_public_bio_blocks(_slug text, _estilo text default 'classico')
returns table (
  id uuid, kind text, data jsonb, "position" integer
)
language sql stable security definer set search_path = public
as $$
  with alvo as (
    -- conta de criador (ou de cliente que usa o Cria)
    select p.id as user_id, null::uuid as page_id
    from public.profiles p
    where lower(p.bio_slug) = lower(btrim(_slug))
    union all
    -- página montada pela agência
    select bp.manager_id, bp.id
    from public.bio_pages bp
    join public.crm_clients c on c.id = bp.crm_client_id and c.deleted_at is null
    where lower(bp.slug) = lower(btrim(_slug))
  )
  select b.id, b.kind, b.data, b."position"
  from public.bio_blocks b
  join alvo a
    on (a.page_id is null and b.page_id is null and b.user_id = a.user_id)
    or (a.page_id is not null and b.page_id = a.page_id)
  where b.is_active = true
    and b.estilo = coalesce(nullif(btrim(_estilo), ''), 'classico')
    and (b.starts_at is null or b.starts_at <= now())
    and (b.ends_at is null or b.ends_at > now())
  order by b."position" asc;
$$;
grant execute on function public.get_public_bio_blocks(text, text) to anon, authenticated;

-- Contador de clique. Só service_role: a porta é a edge bio-track, que tem
-- rate-limit por IP. Sem isso, um script infla o número do relatório do cliente.
create or replace function public.increment_bio_block_click(_id uuid)
returns void
language sql security definer set search_path = public
as $$
  update public.bio_blocks set clicks = clicks + 1 where id = _id;
$$;
revoke all on function public.increment_bio_block_click(uuid) from public, anon, authenticated;
grant execute on function public.increment_bio_block_click(uuid) to service_role;

-- ────────────────────────────────────────────────────────────
-- O estilo escolhido na página da agência
-- (no criador isso já vive em profiles.bio_settings->>'layout')
-- ────────────────────────────────────────────────────────────
alter table public.bio_pages
  add column if not exists estilo text not null default 'classico'
  check (estilo in ('classico', 'site'));

-- ============================================================
-- O CONTATO CAPTURADO VIRANDO OPORTUNIDADE NO CRM
--
-- É a peça que nenhum concorrente tem, porque nenhum deles tem o CRM do outro
-- lado: no Linktree o lead vira uma linha numa planilha que alguém precisa
-- lembrar de baixar.
--
-- Vai por CHAVE, não sempre: dentro do bloco de captura existe um interruptor
-- "mandar pro pipeline". Ligado no formulário de orçamento, desligado no
-- material gratuito, senão uma página movimentada entope o quadro de gente que
-- só queria baixar um PDF.
--
-- As funções de envio ganham o id do bloco. Quem não mandar (bio antiga, ou
-- página ainda no formato de links) continua funcionando igual.
-- ============================================================

create or replace function public.bio_lead_para_pipeline(
  _manager uuid, _block_id uuid, _nome text, _email text, _telefone text, _de text)
returns void
language plpgsql security definer set search_path = public
as $$
declare _b public.bio_blocks;
begin
  if _block_id is null then return; end if;
  select * into _b from public.bio_blocks where id = _block_id;
  if not found then return; end if;
  -- Só quando a chave está ligada NAQUELE bloco.
  if coalesce(_b.data->>'paraPipeline', 'false') <> 'true' then return; end if;

  -- Não duplica quando a mesma pessoa envia duas vezes: se já existe um lead
  -- aberto com esse contato, deixa quieto. Dois cards do mesmo interessado é
  -- pior que um.
  if exists (
    select 1 from public.crm_leads l
    where l.manager_id = _manager
      and l.stage not in ('fechado', 'perdido')
      and (
        (coalesce(nullif(btrim(_email), ''), '@nada') = coalesce(l.email, '@vazio'))
        or (coalesce(nullif(regexp_replace(coalesce(_telefone, ''), '[^0-9]', '', 'g'), ''), '@nada')
            = coalesce(nullif(regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g'), ''), '@vazio'))
      )
  ) then return; end if;

  insert into public.crm_leads (manager_id, name, email, phone, stage, lead_origin, notes)
  values (
    _manager,
    coalesce(nullif(btrim(_nome), ''), nullif(btrim(_email), ''), nullif(btrim(_telefone), ''), 'Contato do link na bio'),
    nullif(btrim(_email), ''), nullif(btrim(_telefone), ''),
    'lead', 'link na bio',
    'Chegou pelo ' || coalesce(nullif(btrim(_de), ''), 'link na bio') || ' em ' ||
      to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY às HH24:MI') || '.');
end; $$;

-- IMPORTANTE: derrubar a versão de 4 argumentos ANTES de criar a de 5.
-- Postgres não substitui uma função quando a lista de argumentos muda, ele
-- cria uma SEGUNDA. E como o argumento novo tem valor padrão, uma chamada com
-- 4 argumentos passaria a servir pras duas: o banco recusa por ambiguidade e o
-- formulário para de enviar.
drop function if exists public.submit_bio_page_lead(text, text, text, text);
drop function if exists public.submit_bio_lead(text, text, text, text);

-- ── Página da agência ──
create or replace function public.submit_bio_page_lead(
  _slug text, _name text default null, _email text default null, _phone text default null,
  _block_id uuid default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare _bp public.bio_pages; _cliente text;
begin
  select * into _bp from public.bio_pages where lower(slug) = lower(btrim(_slug));
  if not found then raise exception 'página não encontrada'; end if;
  if coalesce(btrim(_email),'') = '' and coalesce(btrim(_phone),'') = '' then
    raise exception 'informe e-mail ou telefone';
  end if;
  if public.rate_touch('bio_lead:' || _bp.id::text, 20) = false then
    raise exception 'muitas tentativas, tente em instantes';
  end if;

  insert into public.bio_leads (user_id, page_id, name, email, phone, source)
  values (_bp.manager_id, _bp.id, nullif(btrim(_name),''),
          nullif(btrim(_email),''), nullif(btrim(_phone),''), 'bio');

  select c.name into _cliente from public.crm_clients c where c.id = _bp.crm_client_id;
  perform public.bio_lead_para_pipeline(
    _bp.manager_id, _block_id, _name, _email, _phone,
    'link na bio de ' || coalesce(_cliente, 'um cliente'));
end; $$;
grant execute on function public.submit_bio_page_lead(text, text, text, text, uuid) to anon, authenticated;

-- ── Conta de criador (a bio dele mesmo) ──
-- A versão antiga continua existindo pra quem já tem a página no ar; esta aqui
-- é a que a página nova chama, com o bloco junto.
create or replace function public.submit_bio_lead(
  _slug text, _name text default null, _email text default null, _phone text default null,
  _block_id uuid default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare _dono uuid;
begin
  select p.id into _dono from public.profiles p where lower(p.bio_slug) = lower(btrim(_slug));
  if _dono is null then raise exception 'página não encontrada'; end if;
  if coalesce(btrim(_email),'') = '' and coalesce(btrim(_phone),'') = '' then
    raise exception 'informe e-mail ou telefone';
  end if;
  if public.rate_touch('bio_lead:' || _dono::text, 20) = false then
    raise exception 'muitas tentativas, tente em instantes';
  end if;

  insert into public.bio_leads (user_id, name, email, phone, source)
  values (_dono, nullif(btrim(_name),''), nullif(btrim(_email),''), nullif(btrim(_phone),''), 'bio');

  -- Criador que também é gestora: o lead dele pode ir pro pipeline dele mesmo.
  perform public.bio_lead_para_pipeline(_dono, _block_id, _name, _email, _phone, 'meu link na bio');
end; $$;
grant execute on function public.submit_bio_lead(text, text, text, text, uuid) to anon, authenticated;
