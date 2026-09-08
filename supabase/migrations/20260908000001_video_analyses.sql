-- Análise profunda de vídeo (TwelveLabs / Pegasus) no Cria Radar.
-- Fase 1 (08/09/2026): só admin roda, sem cobrança. Serve pra gente ver o que o
-- modelo devolve de verdade antes de desenhar layout, créditos e pacotes.
-- Uma linha por (gestor, url do post): rodar de novo sobrescreve, não duplica.

create table if not exists public.video_analyses (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  crm_client_id uuid references public.crm_clients(id) on delete set null,
  scrape_id uuid references public.competitor_scrapes(id) on delete set null,
  post_url text not null,
  video_url text,
  thumbnail text,
  status text not null default 'queued' check (status in ('queued','running','done','error')),
  -- 'radar' (Cria Radar, social mídia) ou 'studio' (criador, engenharia reversa)
  origem text not null default 'radar',
  result jsonb,
  usage jsonb,
  error text,
  duration_s numeric,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (manager_id, post_url)
);

create index if not exists idx_video_analyses_manager on public.video_analyses(manager_id, created_at desc);

alter table public.video_analyses enable row level security;

-- Leitura: dono do tenant e time (acts_for). Escrita só pela edge (service role).
drop policy if exists va_select on public.video_analyses;
create policy va_select on public.video_analyses
  for select to authenticated using (public.acts_for(manager_id));
