-- "Salvos": referências do Instagram/TikTok que o criador guarda (estilo Salvos do IG, mas direcionado).
create table if not exists public.saved_refs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  platform text default 'instagram',   -- instagram | tiktok | outro
  author text,                          -- @ do autor
  caption text,
  thumbnail_url text,
  media_type text,                      -- video | image | carousel
  folder text,                          -- pasta/categoria
  note text,
  status text default 'novo',           -- novo | usado
  used_post_id uuid,
  created_at timestamptz default now()
);

alter table public.saved_refs enable row level security;

drop policy if exists "saved_refs owner" on public.saved_refs;
create policy "saved_refs owner" on public.saved_refs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_saved_refs_user on public.saved_refs(user_id, created_at desc);
create index if not exists idx_saved_refs_folder on public.saved_refs(user_id, folder);
