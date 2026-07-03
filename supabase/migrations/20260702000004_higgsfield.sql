-- Cria Estúdio — geração de imagens/carrosséis via Higgsfield (admin-only).
create table if not exists public.higgsfield_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  format text not null default 'carrossel',  -- estatico | carrossel
  aspect_ratio text not null default '4:5',
  resolution text not null default '1080p',
  status text not null default 'running',     -- running | done | partial | error
  pages jsonb not null default '[]'::jsonb,    -- [{role, screen_text, prompt, request_id, image_url, status}]
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists idx_higgsfield_jobs_user on public.higgsfield_jobs (user_id, created_at desc);

alter table public.higgsfield_jobs enable row level security;
drop policy if exists "hf_select" on public.higgsfield_jobs;
create policy "hf_select" on public.higgsfield_jobs
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "hf_delete" on public.higgsfield_jobs;
create policy "hf_delete" on public.higgsfield_jobs
  for delete to authenticated using (user_id = auth.uid());
-- insert/update via service_role (edge).
