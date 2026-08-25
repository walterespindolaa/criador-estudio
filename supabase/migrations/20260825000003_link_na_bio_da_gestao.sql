-- ============================================================
-- LINK NA BIO PARA OS CLIENTES DA SOCIAL MÍDIA
--
-- Até aqui o Link na bio era uma coisa só do criador: o endereço mora em
-- profiles.bio_slug, o visual em profiles.bio_settings e os botões em bio_links
-- chaveados por profiles.id. Ou seja, UMA página por conta.
--
-- A social mídia precisa de N páginas, uma por cliente, e a maioria dos
-- clientes dela NÃO tem conta no Cria (não tem linha em profiles). Por isso
-- entra bio_pages: a página pendurada na FICHA do CRM, do mesmo jeito que o
-- link de cadastro e o portal de aprovação já fazem.
--
-- DECISÃO IMPORTANTE: cliente que TEM conta Cria continua com a página dele,
-- em profiles. A gestora edita aquela mesma página (é o que o cliente vê
-- quando entra), em vez de manter duas bios do mesmo negócio. Por isso a
-- função manager_save_client_bio no fim deste arquivo.
--
-- Botões e leads NÃO ganharam tabela nova. Eles continuam em bio_links e
-- bio_leads, agora com page_id preenchido e user_id apontando pra GESTORA.
-- Assim as policies que já existem ("é meu porque auth.uid() = user_id")
-- continuam valendo sem precisar afrouxar nada, e o tipo no front continua o
-- mesmo. O preço disso é uma linha a mais nas leituras públicas do criador:
-- elas agora exigem page_id is null, senão a página do criador mostraria os
-- botões que a gestora criou pros clientes dela.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1) A página
-- ────────────────────────────────────────────────────────────
create table if not exists public.bio_pages (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null,
  crm_client_id uuid not null references public.crm_clients(id) on delete cascade,
  -- Endereço público. Fica nulo até a gestora escolher o nome, e uma página
  -- sem endereço simplesmente não é acessível.
  slug text,
  settings jsonb not null default '{}'::jsonb,
  views bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma página por cliente. Se a gestora clicar duas vezes, a segunda cai aqui.
create unique index if not exists idx_bio_pages_cliente on public.bio_pages(crm_client_id);
create index if not exists idx_bio_pages_manager on public.bio_pages(manager_id);

alter table public.bio_pages enable row level security;
drop policy if exists "bio_pages tenant" on public.bio_pages;
-- Duas checagens, não uma. `acts_for(manager_id)` sozinho confia num campo que
-- o próprio chamador escreve: bastava mandar o crm_client_id de um cliente de
-- OUTRA agência pra publicar (e travar) a página dele, já que a leitura pública
-- devolve nome, logo e @ da ficha. É o mesmo buraco que o consent de
-- cria_owner_id fechou em 20260810000002. Por isso a ficha também é validada.
create policy "bio_pages tenant" on public.bio_pages
  for all to authenticated
  using (
    public.acts_for(manager_id)
    and exists (select 1 from public.crm_clients c
                 where c.id = crm_client_id and public.acts_for(c.manager_id)))
  with check (
    public.acts_for(manager_id)
    and exists (select 1 from public.crm_clients c
                 where c.id = crm_client_id and public.acts_for(c.manager_id)));

-- ────────────────────────────────────────────────────────────
-- 2) Botões e leads apontam pra página
-- ────────────────────────────────────────────────────────────
alter table public.bio_links
  add column if not exists page_id uuid references public.bio_pages(id) on delete cascade;
create index if not exists idx_bio_links_page on public.bio_links(page_id, "position");

alter table public.bio_leads
  add column if not exists page_id uuid references public.bio_pages(id) on delete cascade;
create index if not exists idx_bio_leads_page on public.bio_leads(page_id, created_at desc);

-- Colaborador da agência também mexe (a policy de dono cobre só a gestora).
drop policy if exists "bio_links da pagina do cliente" on public.bio_links;
create policy "bio_links da pagina do cliente" on public.bio_links
  for all to authenticated
  using (page_id is not null and exists (
    select 1 from public.bio_pages bp where bp.id = bio_links.page_id and public.acts_for(bp.manager_id)))
  with check (page_id is not null and exists (
    select 1 from public.bio_pages bp where bp.id = bio_links.page_id and public.acts_for(bp.manager_id)));

drop policy if exists "bio_leads da pagina do cliente" on public.bio_leads;
create policy "bio_leads da pagina do cliente" on public.bio_leads
  for all to authenticated
  using (page_id is not null and exists (
    select 1 from public.bio_pages bp where bp.id = bio_leads.page_id and public.acts_for(bp.manager_id)))
  with check (page_id is not null and exists (
    select 1 from public.bio_pages bp where bp.id = bio_leads.page_id and public.acts_for(bp.manager_id)));

-- Cliente COM conta Cria: quem cuida da conta também mexe nos botões e vê os
-- leads. A policy antiga (member_all_bio_links) usa is_account_member, que só
-- reconhece a própria gestora; a colaboradora dela via a lista vazia e levava
-- erro ao criar botão, enquanto a aparência salvava. Aqui os dois casos passam
-- pelo mesmo acts_for.
drop policy if exists "bio_links da conta gerida" on public.bio_links;
create policy "bio_links da conta gerida" on public.bio_links
  for all to authenticated
  using (page_id is null and exists (
    select 1 from public.account_members am
     where am.owner_id = bio_links.user_id and am.status = 'active' and public.acts_for(am.member_id)))
  with check (page_id is null and exists (
    select 1 from public.account_members am
     where am.owner_id = bio_links.user_id and am.status = 'active' and public.acts_for(am.member_id)));

drop policy if exists "bio_leads da conta gerida" on public.bio_leads;
create policy "bio_leads da conta gerida" on public.bio_leads
  for all to authenticated
  using (page_id is null and exists (
    select 1 from public.account_members am
     where am.owner_id = bio_leads.user_id and am.status = 'active' and public.acts_for(am.member_id)))
  with check (page_id is null and exists (
    select 1 from public.account_members am
     where am.owner_id = bio_leads.user_id and am.status = 'active' and public.acts_for(am.member_id)));

-- ────────────────────────────────────────────────────────────
-- 3) O endereço é único no Cria inteiro
--    Sem isso, /bio/clinicalorem poderia existir duas vezes e a página que
--    abre viraria loteria.
-- ────────────────────────────────────────────────────────────
create unique index if not exists idx_bio_pages_slug_unique
  on public.bio_pages (lower(slug)) where slug is not null and slug <> '';

create or replace function public.bio_slug_available(_slug text, _exclude uuid default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(btrim(_slug), '') <> '' and not exists (
    select 1 from public.profiles p
    where lower(p.bio_slug) = lower(btrim(_slug))
      and coalesce(p.bio_slug, '') <> ''
      and (_exclude is null or p.id <> _exclude)
  ) and not exists (
    select 1 from public.bio_pages bp
    where lower(bp.slug) = lower(btrim(_slug))
      and coalesce(bp.slug, '') <> ''
      and (_exclude is null or bp.id <> _exclude)
  );
$$;
grant execute on function public.bio_slug_available(text, uuid) to anon, authenticated;

-- A checagem acima é a que a tela usa pra avisar "esse nome já é de outra
-- pessoa". Sozinha ela não protege nada: some com dois saves ao mesmo tempo, e
-- não impede alguém de gravar direto na API o endereço de uma página alheia
-- (que passaria a abrir o conteúdo de quem sequestrou, porque a resolução tenta
-- profiles primeiro). Os índices únicos só olham a própria tabela, então a
-- trava cruzada tem que ser trigger.
create or replace function public.guard_bio_slug_unico()
returns trigger language plpgsql security definer set search_path = public as $$
declare _s text; _id uuid; _livre boolean;
begin
  if tg_table_name = 'profiles' then _s := new.bio_slug; _id := new.id;
  else _s := new.slug; _id := new.id; end if;

  if coalesce(btrim(_s), '') = '' then return new; end if;

  -- Só valida quando o endereço MUDOU: update de outra coluna não pode ser
  -- barrado por um slug que já era dele.
  if tg_op = 'UPDATE' then
    if tg_table_name = 'profiles' then
      if new.bio_slug is not distinct from old.bio_slug then return new; end if;
    else
      if new.slug is not distinct from old.slug then return new; end if;
    end if;
  end if;

  select public.bio_slug_available(_s, _id) into _livre;
  if not _livre then
    raise exception 'endereco_em_uso: %', _s using errcode = 'unique_violation';
  end if;
  return new;
end; $$;

drop trigger if exists trg_profiles_bio_slug_unico on public.profiles;
create trigger trg_profiles_bio_slug_unico
  before insert or update of bio_slug on public.profiles
  for each row execute function public.guard_bio_slug_unico();

drop trigger if exists trg_bio_pages_slug_unico on public.bio_pages;
create trigger trg_bio_pages_slug_unico
  before insert or update of slug on public.bio_pages
  for each row execute function public.guard_bio_slug_unico();

-- ────────────────────────────────────────────────────────────
-- 4) Leitura pública (anônimo, só pelo endereço)
--    Devolve nos MESMOS nomes de coluna do perfil, pra página pública tratar
--    os dois casos com o mesmo código.
-- ────────────────────────────────────────────────────────────
create or replace function public.get_public_bio_page_by_slug(_slug text)
returns table (
  id uuid, name text, bio text, avatar_url text, niche text,
  instagram_handle text, bio_settings jsonb, bio_slug text
)
language sql stable security definer set search_path = public
as $$
  select bp.id, c.name::text, null::text, c.logo::text, c.segment::text,
         c.instagram::text, bp.settings, bp.slug::text
  from public.bio_pages bp
  join public.crm_clients c on c.id = bp.crm_client_id
  where lower(bp.slug) = lower(btrim(_slug))
    and c.deleted_at is null
  limit 1;
$$;
grant execute on function public.get_public_bio_page_by_slug(text) to anon, authenticated;

create or replace function public.get_public_bio_page_links_by_slug(_slug text)
returns table (
  id uuid, title text, url text, icon text,
  "position" integer, link_type text, thumbnail_url text
)
language sql stable security definer set search_path = public
as $$
  select bl.id, bl.title, bl.url, bl.icon, bl."position", bl.link_type, bl.thumbnail_url
  from public.bio_links bl
  join public.bio_pages bp on bp.id = bl.page_id
  join public.crm_clients c on c.id = bp.crm_client_id and c.deleted_at is null
  where lower(bp.slug) = lower(btrim(_slug)) and bl.is_active = true
  order by bl."position" asc;
$$;
grant execute on function public.get_public_bio_page_links_by_slug(text) to anon, authenticated;

-- A página do CRIADOR não pode listar os botões das páginas de cliente que a
-- gestora criou (eles compartilham user_id). Daí o page_id is null.
create or replace function public.get_public_bio_links_by_slug(_slug text)
returns table (
  id uuid, title text, url text, icon text,
  "position" integer, link_type text, thumbnail_url text
)
language sql stable security definer set search_path = public
as $$
  select bl.id, bl.title, bl.url, bl.icon, bl."position", bl.link_type, bl.thumbnail_url
  from public.bio_links bl
  join public.profiles p on p.id = bl.user_id
  where p.bio_slug = _slug and bl.is_active = true and bl.page_id is null
  order by bl."position" asc;
$$;
grant execute on function public.get_public_bio_links_by_slug(text) to anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 5) Lead capturado na página do cliente
--    user_id = a GESTORA: é ela quem vê o lead e quem responde por ele.
-- ────────────────────────────────────────────────────────────
create or replace function public.submit_bio_page_lead(
  _slug text, _name text default null, _email text default null, _phone text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare _bp public.bio_pages;
begin
  select * into _bp from public.bio_pages where lower(slug) = lower(btrim(_slug));
  if not found then raise exception 'página não encontrada'; end if;
  if coalesce(btrim(_email),'') = '' and coalesce(btrim(_phone),'') = '' then
    raise exception 'informe e-mail ou telefone';
  end if;

  -- Cada lead vira notificação (e push) pra gestora. Sem freio, um script
  -- entope a caixa dela em segundos. 20 por página por minuto é folgado pra uso
  -- real e barra a enxurrada.
  if public.rate_touch('bio_lead:' || _bp.id::text, 20) = false then
    raise exception 'muitas tentativas, tente em instantes';
  end if;

  insert into public.bio_leads (user_id, page_id, name, email, phone, source)
  values (_bp.manager_id, _bp.id, nullif(btrim(_name),''),
          nullif(btrim(_email),''), nullif(btrim(_phone),''), 'bio');
end; $$;
grant execute on function public.submit_bio_page_lead(text, text, text, text) to anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 6) Contador de visita (só service_role, igual ao do criador: a porta é a
--    edge bio-track, que tem rate-limit por IP)
-- ────────────────────────────────────────────────────────────
create or replace function public.increment_bio_page_view(_slug text)
returns void
language sql security definer set search_path = public
as $$
  update public.bio_pages set views = views + 1 where lower(slug) = lower(btrim(_slug));
$$;
-- `revoke ... from anon, authenticated` NÃO fecha nada: toda função nasce com
-- EXECUTE pra PUBLIC, e anon é membro de PUBLIC. Sem tirar de public a RPC
-- continuaria chamável com a chave anônima, pulando o rate-limit da edge.
revoke all on function public.increment_bio_page_view(text) from public, anon, authenticated;
grant execute on function public.increment_bio_page_view(text) to service_role;

-- ────────────────────────────────────────────────────────────
-- 6b) Pra listagem: o endereço e as visitas das bios que moram na conta do
--     cliente. Sem isso a tela do Cria Gestão só saberia das páginas da ficha
--     e mostraria "sem página" pra quem tem uma página no ar.
-- ────────────────────────────────────────────────────────────
create or replace function public.manager_clients_bio()
returns table (cria_owner_id uuid, bio_slug text, bio_views bigint)
language sql stable security definer set search_path = public
as $$
  select p.id, p.bio_slug, p.bio_views
  from public.account_members am
  join public.profiles p on p.id = am.owner_id
  where am.status = 'active' and public.acts_for(am.member_id);
$$;
grant execute on function public.manager_clients_bio() to authenticated;

-- ────────────────────────────────────────────────────────────
-- 7) O BUG DO SALVAMENTO SILENCIOSO
--
-- Quando a gestora edita a bio de um cliente que TEM conta Cria, o front fazia
-- update direto em profiles. Não existe policy de UPDATE pra gestora ali (só
-- auth.uid() = id), então o update casava ZERO linhas e a tela mostrava
-- "Aparência salva!" mesmo assim. Aqui vira uma função com a permissão certa:
-- só passa quem tem vínculo consentido (account_members ativo).
-- ────────────────────────────────────────────────────────────
create or replace function public.manager_save_client_bio(
  _owner uuid, _slug text, _settings jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare _s text;
begin
  if not public.acts_for_cria_owner(_owner) then
    raise exception 'sem vínculo com essa conta';
  end if;

  _s := nullif(btrim(coalesce(_slug, '')), '');
  if _s is null then raise exception 'escolha um endereço para a página'; end if;
  if not public.bio_slug_available(_s, _owner) then
    raise exception 'endereço já está em uso';
  end if;

  update public.profiles
     set bio_slug = _s,
         bio_settings = coalesce(_settings, bio_settings)
   where id = _owner;
end; $$;
grant execute on function public.manager_save_client_bio(uuid, text, jsonb) to authenticated;

-- ────────────────────────────────────────────────────────────
-- 8) A notificação de lead novo precisa levar ao lead
--
-- O gatilho antigo sempre dizia "no SEU link in bio" e apontava pra
-- /app/linkinbio. Pra lead de página de cliente isso leva a gestora pro editor
-- da bio DELA, onde o lead não está.
-- ────────────────────────────────────────────────────────────
create or replace function public.notify_new_bio_lead()
returns trigger language plpgsql security definer set search_path = public as $$
declare _cliente uuid; _nome text;
begin
  if new.page_id is not null then
    select bp.crm_client_id, c.name into _cliente, _nome
      from public.bio_pages bp
      join public.crm_clients c on c.id = bp.crm_client_id
     where bp.id = new.page_id;
  end if;

  insert into public.notifications (user_id, type, title, description, link)
  values (
    new.user_id, 'lead',
    case when _cliente is null then 'Novo lead no seu link in bio'
         else 'Novo lead no link na bio de ' || coalesce(_nome, 'um cliente') end,
    coalesce(nullif(btrim(new.name), ''), new.email, new.phone, 'Alguém') || ' deixou contato.',
    case when _cliente is null then '/app/linkinbio'
         else '/socialmidia/clientes/' || _cliente::text || '/link-bio' end);
  return new;
end; $$;
