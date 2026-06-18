-- Enriquecimento da integração de insights:
-- (1) vincular a mídia do Instagram ao post interno do CRIA (roteiro/legenda/hook/formato/pilar)
-- (2) série temporal diária da conta (gráficos de evolução: seguidores, alcance, etc.)

-- (1) Liga social_insights (mídia) -> posts (conteúdo criado no CRIA)
alter table public.social_insights
  add column if not exists post_id uuid references public.posts(id) on delete set null;
create index if not exists idx_social_insights_post on public.social_insights (post_id);

-- (2) Métricas diárias da conta (1 linha por dia/rede) — alimenta gráficos de evolução
create table if not exists public.social_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'instagram',
  date date not null,
  followers integer,
  reach integer,
  impressions integer,
  profile_views integer,
  website_clicks integer,
  accounts_engaged integer,
  total_interactions integer,
  metrics jsonb not null default '{}'::jsonb,   -- métricas extras conforme a API evolui
  captured_at timestamptz default now(),
  unique (user_id, provider, date)
);
alter table public.social_metrics_daily enable row level security;
drop policy if exists "Users manage own daily metrics" on public.social_metrics_daily;
create policy "Users manage own daily metrics" on public.social_metrics_daily
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_social_metrics_daily_user
  on public.social_metrics_daily (user_id, provider, date desc);
