-- ============================================================
-- OS NÚMEROS DO LINK NA BIO
--
-- Hoje a página tem três totais que nunca mudam de assunto: visitas, cliques e
-- conversão desde sempre. Com isso a social mídia não consegue dizer nada útil
-- na reunião do cliente. O que ela precisa é: "o cardápio puxou 203 cliques,
-- vamos subir ele pro topo e aposentar o FAQ".
--
-- POR QUE AGREGADO E NÃO UMA LINHA POR EVENTO
-- Guardar cada clique vira uma tabela que cresce pra sempre, e a primeira
-- página que estourar traz junto o custo de banco e a lentidão da consulta.
-- Aqui a granularidade é DIA + BLOCO + ORIGEM, que é exatamente o que a tela
-- mostra. Uma página com 10 blocos e 5 origens gera no máximo ~50 linhas por
-- dia, e a consulta do mês lê 1.500 linhas em vez de 50 mil.
--
-- ORIGEM é um conjunto pequeno e fechado de propósito: guardar o referrer cru
-- seria guardar endereço de terceiro sem precisar, e ninguém filtra por isso.
-- ============================================================

create table if not exists public.bio_stats_daily (
  id uuid primary key default gen_random_uuid(),
  -- Chave de agrupamento em texto porque o dono pode ser uma conta ('u:<id>')
  -- ou uma página da agência ('p:<id>'), e índice único com coluna nula é
  -- fonte garantida de linha duplicada.
  escopo text not null,
  -- Quem tem direito de LER. Conta própria: o dono. Página da agência: a gestora.
  user_id uuid not null,
  page_id uuid references public.bio_pages(id) on delete cascade,
  block_id uuid references public.bio_blocks(id) on delete cascade,
  dia date not null,
  origem text not null default 'direto',
  views integer not null default 0,
  clicks integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_bio_stats_chave
  on public.bio_stats_daily (escopo, coalesce(block_id::text, ''), dia, origem);
create index if not exists idx_bio_stats_leitura
  on public.bio_stats_daily (user_id, dia desc);
create index if not exists idx_bio_stats_pagina
  on public.bio_stats_daily (page_id, dia desc) where page_id is not null;

alter table public.bio_stats_daily enable row level security;

-- Só leitura pelo front. Quem escreve é a edge, com service_role.
drop policy if exists "bio_stats do dono" on public.bio_stats_daily;
create policy "bio_stats do dono" on public.bio_stats_daily
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (select 1 from public.bio_pages bp where bp.id = bio_stats_daily.page_id and public.acts_for(bp.manager_id))
    or exists (select 1 from public.account_members am
                where am.owner_id = bio_stats_daily.user_id and am.status = 'active' and public.acts_for(am.member_id))
  );

-- ────────────────────────────────────────────────────────────
-- Registrar um evento
--
-- Resolve o endereço pro dono certo e soma no dia de hoje no fuso de São
-- Paulo. Fuso importa: com UTC, tudo que acontece depois das 21h no Brasil
-- cairia no dia seguinte e o gráfico ficaria torto.
-- ────────────────────────────────────────────────────────────
create or replace function public.bio_registrar_evento(
  _slug text, _tipo text, _block_id uuid default null, _origem text default 'direto')
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _user uuid; _page uuid; _escopo text; _dia date; _org text;
begin
  if _tipo not in ('view', 'click') then return; end if;

  -- Conta de criador (ou de cliente que usa o Cria).
  select p.id into _user from public.profiles p where lower(p.bio_slug) = lower(btrim(_slug));
  if _user is not null then
    _escopo := 'u:' || _user::text;
  else
    -- Página montada pela agência.
    select bp.manager_id, bp.id into _user, _page
      from public.bio_pages bp where lower(bp.slug) = lower(btrim(_slug));
    if _user is null then return; end if;
    _escopo := 'p:' || _page::text;
  end if;

  _dia := (now() at time zone 'America/Sao_Paulo')::date;
  _org := lower(coalesce(nullif(btrim(_origem), ''), 'direto'));
  if _org not in ('instagram', 'whatsapp', 'qr', 'facebook', 'google', 'tiktok', 'direto') then
    _org := 'outro';
  end if;

  -- Visita é da PÁGINA (block_id nulo); clique é sempre de um bloco.
  if _tipo = 'view' then _block_id := null; end if;
  if _tipo = 'click' and _block_id is null then return; end if;

  -- O id do clique tem que ser um bloco DESTA página. Duas razões:
  --   · no formato antigo o que chega é um id de bio_links, e gravar isso
  --     violaria a chave estrangeira (o erro voltaria calado e o evento
  --     sumiria sem ninguém saber);
  --   · sem essa conferência, um POST com o endereço de A e o id de um bloco
  --     de B guardaria, no histórico de A, uma linha presa ao bloco de outro
  --     inquilino, e apagar aquele bloco levaria junto o histórico de A.
  if _tipo = 'click' and not exists (
    select 1 from public.bio_blocks b
    where b.id = _block_id
      and ((_page is null and b.page_id is null and b.user_id = _user)
        or (_page is not null and b.page_id = _page))
  ) then
    return;
  end if;

  insert into public.bio_stats_daily (escopo, user_id, page_id, block_id, dia, origem, views, clicks)
  values (_escopo, _user, _page, _block_id, _dia, _org,
          case when _tipo = 'view' then 1 else 0 end,
          case when _tipo = 'click' then 1 else 0 end)
  on conflict (escopo, coalesce(block_id::text, ''), dia, origem) do update
    set views = public.bio_stats_daily.views + excluded.views,
        clicks = public.bio_stats_daily.clicks + excluded.clicks;
end; $$;
revoke all on function public.bio_registrar_evento(text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.bio_registrar_evento(text, text, uuid, text) to service_role;
