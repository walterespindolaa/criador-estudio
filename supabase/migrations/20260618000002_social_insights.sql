-- Integração de redes (read-only / insights). Escopo inicial: Instagram.
-- Sem publicação/agendamento pela plataforma — só conectar a conta e coletar métricas.

-- 1) Conexão OAuth por usuário/rede (token long-lived guardado p/ refresh server-side)
create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'instagram',        -- 'instagram' (futuro: 'tiktok', 'youtube')
  external_account_id text not null,                  -- IG Business/Creator account id
  username text,                                      -- @handle
  account_type text,                                  -- business | creator
  access_token text not null,                         -- token long-lived (sensível; lido só pelo dono via RLS + service_role)
  token_expires_at timestamptz,                       -- p/ refresh automático antes de expirar
  scopes text,
  connected_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, provider)                          -- uma conexão por rede por usuário
);
alter table public.social_connections enable row level security;
drop policy if exists "Users manage own social connections" on public.social_connections;
create policy "Users manage own social connections" on public.social_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Insights cacheados (snapshot por conta e por mídia; refresh ~6h via edge function)
create table if not exists public.social_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'instagram',
  object_type text not null,                          -- 'account' | 'media'
  object_id text,                                     -- media id (null no nível de conta)
  media_type text,                                    -- IMAGE | VIDEO | CAROUSEL_ALBUM | REELS
  caption text,
  permalink text,
  thumbnail_url text,
  posted_at timestamptz,                              -- data do post (p/ correlação por horário)
  metrics jsonb not null default '{}'::jsonb,         -- { reach, impressions, likes, comments, saves, followers, ... }
  captured_at timestamptz default now(),
  unique (user_id, provider, object_type, object_id)  -- upsert do snapshot mais recente
);
alter table public.social_insights enable row level security;
drop policy if exists "Users manage own social insights" on public.social_insights;
create policy "Users manage own social insights" on public.social_insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_social_insights_user_provider
  on public.social_insights (user_id, provider, object_type, posted_at desc);
