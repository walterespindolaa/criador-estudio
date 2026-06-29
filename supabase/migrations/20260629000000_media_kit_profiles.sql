-- Configuração editável do Media Kit automático (audiência, gênero, cidades, serviços/valores, contato, cor).
create table if not exists public.media_kit_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  headline text,
  bio text,
  niche text,
  contact text,
  cities text,
  gender jsonb default '{"women":60,"men":40}'::jsonb,
  audience jsonb default '[]'::jsonb,
  services jsonb default '[]'::jsonb,
  accent text default '#0F6E56',
  updated_at timestamptz default now()
);

alter table public.media_kit_profiles enable row level security;

drop policy if exists "media_kit_own" on public.media_kit_profiles;
create policy "media_kit_own" on public.media_kit_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
