-- HUB CRIA — análise de concorrentes (Apify) + ideias acionáveis, por cliente.

-- Módulo pro gating (admin libera por conta em module_entitlements).
insert into public.modules (code, name, description, price_cents, active, coming_soon, sort_order)
values ('hub_cria', 'HUB CRIA', 'Análise de concorrentes no Instagram + ideias de conteúdo por cliente', 0, true, false, 100)
on conflict (code) do nothing;

-- 1) Scrapes de concorrentes (o job + o resultado resumido).
create table if not exists public.competitor_scrapes (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  crm_client_id uuid references public.crm_clients(id) on delete cascade,
  scrape_type text not null,             -- posts | reels | profile | hashtag | comments
  input_handle text not null,            -- @ do concorrente ou #hashtag
  results_limit int not null default 10,
  status text not null default 'queued', -- queued | running | done | error
  apify_run_id text,
  result_summary jsonb,                  -- métricas + top posts resumidos
  cost_usd numeric,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists idx_competitor_scrapes_client on public.competitor_scrapes (manager_id, crm_client_id, created_at desc);

alter table public.competitor_scrapes enable row level security;
drop policy if exists "cs_select" on public.competitor_scrapes;
create policy "cs_select" on public.competitor_scrapes
  for select to authenticated using (manager_id = auth.uid());
-- insert/update só via service_role (edge apify-scrape) — sem policy = negado p/ usuários.

-- 2) Ideias criativas (itens acionáveis com ciclo de vida).
create table if not exists public.creative_ideas (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  crm_client_id uuid references public.crm_clients(id) on delete cascade,
  scrape_id uuid references public.competitor_scrapes(id) on delete set null,
  source text not null default 'scrape', -- scrape | tendencia | plano
  title text not null,
  format text,
  rationale text,                        -- por que essa ideia (baseada no que engajou)
  status text not null default 'novo' check (status in ('novo','usar','usada','descartada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_creative_ideas_client on public.creative_ideas (manager_id, crm_client_id, status, created_at desc);

alter table public.creative_ideas enable row level security;
drop policy if exists "ci_select" on public.creative_ideas;
create policy "ci_select" on public.creative_ideas
  for select to authenticated using (manager_id = auth.uid());
drop policy if exists "ci_update" on public.creative_ideas;
create policy "ci_update" on public.creative_ideas
  for update to authenticated using (manager_id = auth.uid()) with check (manager_id = auth.uid());
drop policy if exists "ci_delete" on public.creative_ideas;
create policy "ci_delete" on public.creative_ideas
  for delete to authenticated using (manager_id = auth.uid());
-- insert via service_role (a edge gera as ideias).
