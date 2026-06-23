-- Recados (broadcast): admin envia um aviso que aparece pra todos os usuários no app.

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text,
  message text not null,
  level text not null default 'info',   -- info | aviso | novidade
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.broadcasts enable row level security;

-- Qualquer usuário logado lê os recados ATIVOS (admin lê todos).
drop policy if exists "Read active broadcasts" on public.broadcasts;
create policy "Read active broadcasts" on public.broadcasts
  for select using (
    active = true
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Só admin cria/edita/exclui.
drop policy if exists "Admins manage broadcasts" on public.broadcasts;
create policy "Admins manage broadcasts" on public.broadcasts
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create index if not exists idx_broadcasts_active on public.broadcasts (active, created_at desc);
