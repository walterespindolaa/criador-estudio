-- ============================================================
-- O MODO SITE: PÁGINAS INTERNAS E BLOG
--
-- O estilo Clássico é a página de bio: coluna estreita, um toque e sai. O modo
-- Site é outra coisa, uma página de apresentação onde a pessoa rola, lê e
-- conhece o negócio.
--
-- O QUE FAZ VIRAR SITE DE VERDADE são as páginas internas. Cada serviço e cada
-- post do blog ganha endereço próprio, e isso resolve duas coisas práticas:
--   · o cliente manda o link de UM serviço no WhatsApp, não a página inteira;
--   · o Google consegue indexar cada assunto separadamente.
--
-- Um bloco não serve pra isso: bloco é pedaço de página, não página. Por isso
-- entra bio_items, com endereço, capa, preço e texto longo por item.
--
-- POR QUE UMA TABELA PRA PRODUTO E POST JUNTOS
-- Os dois são a mesma coisa do ponto de vista da página: título, capa, texto
-- longo e um endereço. O que muda é `tipo` e se tem preço. Separar em duas
-- tabelas seria duplicar RLS, RPC pública e editor pra ganhar nada.
-- ============================================================

create table if not exists public.bio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  page_id uuid references public.bio_pages(id) on delete cascade,
  tipo text not null check (tipo in ('produto', 'post')),
  -- Pedaço final do endereço: /bio/annaspanholi/p/engenharia-de-cardapio
  slug text not null,
  titulo text not null default '',
  resumo text,
  capa text,
  -- Texto livre em reais. Nulo = "sob consulta", que é decisão do cliente e
  -- não erro de preenchimento.
  preco numeric,
  preco_texto text,
  conteudo text,
  galeria jsonb not null default '[]'::jsonb,
  cta_texto text,
  cta_url text,
  publicado boolean not null default true,
  "position" integer not null default 0,
  publicado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Endereço único DENTRO da mesma página. Dois clientes diferentes podem ter
-- cada um o seu "consultoria", e isso é o certo.
create unique index if not exists idx_bio_items_endereco
  on public.bio_items (coalesce(page_id::text, user_id::text), tipo, lower(slug));
create index if not exists idx_bio_items_dono
  on public.bio_items (user_id, tipo, "position") where page_id is null;
create index if not exists idx_bio_items_pagina
  on public.bio_items (page_id, tipo, "position") where page_id is not null;

alter table public.bio_items enable row level security;

drop policy if exists "bio_items do dono" on public.bio_items;
create policy "bio_items do dono" on public.bio_items
  for all to authenticated
  using (page_id is null and auth.uid() = user_id)
  with check (page_id is null and auth.uid() = user_id);

drop policy if exists "bio_items da conta gerida" on public.bio_items;
create policy "bio_items da conta gerida" on public.bio_items
  for all to authenticated
  using (page_id is null and exists (
    select 1 from public.account_members am
     where am.owner_id = bio_items.user_id and am.status = 'active' and public.acts_for(am.member_id)))
  with check (page_id is null and exists (
    select 1 from public.account_members am
     where am.owner_id = bio_items.user_id and am.status = 'active' and public.acts_for(am.member_id)));

drop policy if exists "bio_items da pagina do cliente" on public.bio_items;
create policy "bio_items da pagina do cliente" on public.bio_items
  for all to authenticated
  using (page_id is not null and exists (
    select 1 from public.bio_pages bp where bp.id = bio_items.page_id and public.acts_for(bp.manager_id)))
  with check (page_id is not null and exists (
    select 1 from public.bio_pages bp where bp.id = bio_items.page_id and public.acts_for(bp.manager_id)));

-- ────────────────────────────────────────────────────────────
-- Leitura pública
-- ────────────────────────────────────────────────────────────

-- A lista que a home do site mostra (grade de produtos, lista do blog).
create or replace function public.get_public_bio_items(_slug text, _tipo text)
returns table (
  id uuid, tipo text, slug text, titulo text, resumo text, capa text,
  preco numeric, preco_texto text, publicado_em timestamptz, "position" integer
)
language sql stable security definer set search_path = public
as $$
  with alvo as (
    select p.id as user_id, null::uuid as page_id
    from public.profiles p where lower(p.bio_slug) = lower(btrim(_slug))
    union all
    select bp.manager_id, bp.id
    from public.bio_pages bp
    join public.crm_clients c on c.id = bp.crm_client_id and c.deleted_at is null
    where lower(bp.slug) = lower(btrim(_slug))
  )
  select i.id, i.tipo, i.slug, i.titulo, i.resumo, i.capa,
         i.preco, i.preco_texto, i.publicado_em, i."position"
  from public.bio_items i
  join alvo a
    on (a.page_id is null and i.page_id is null and i.user_id = a.user_id)
    or (a.page_id is not null and i.page_id = a.page_id)
  where i.publicado = true and i.tipo = _tipo
  -- Produto segue a ordem que a pessoa arrastou; post do blog é cronológico,
  -- do mais novo pro mais velho, que é o que qualquer leitor espera.
  order by case when _tipo = 'post' then 0 else i."position" end asc,
           case when _tipo = 'post' then i.publicado_em end desc;
$$;
grant execute on function public.get_public_bio_items(text, text) to anon, authenticated;

-- A página interna de um item.
create or replace function public.get_public_bio_item(_slug text, _tipo text, _item text)
returns table (
  id uuid, tipo text, slug text, titulo text, resumo text, capa text,
  preco numeric, preco_texto text, conteudo text, galeria jsonb,
  cta_texto text, cta_url text, publicado_em timestamptz
)
language sql stable security definer set search_path = public
as $$
  with alvo as (
    select p.id as user_id, null::uuid as page_id
    from public.profiles p where lower(p.bio_slug) = lower(btrim(_slug))
    union all
    select bp.manager_id, bp.id
    from public.bio_pages bp
    join public.crm_clients c on c.id = bp.crm_client_id and c.deleted_at is null
    where lower(bp.slug) = lower(btrim(_slug))
  )
  select i.id, i.tipo, i.slug, i.titulo, i.resumo, i.capa,
         i.preco, i.preco_texto, i.conteudo, i.galeria,
         i.cta_texto, i.cta_url, i.publicado_em
  from public.bio_items i
  join alvo a
    on (a.page_id is null and i.page_id is null and i.user_id = a.user_id)
    or (a.page_id is not null and i.page_id = a.page_id)
  where i.publicado = true and i.tipo = _tipo and lower(i.slug) = lower(btrim(_item))
  limit 1;
$$;
grant execute on function public.get_public_bio_item(text, text, text) to anon, authenticated;
