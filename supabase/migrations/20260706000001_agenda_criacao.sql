-- Agenda de criação (produção semanal) + Captações (gravações) da social mídia.
create table if not exists public.agenda_creations (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  crm_client_id uuid references public.crm_clients(id) on delete cascade,
  client_name text,
  team text,
  note text,
  created_at timestamptz default now()
);

create table if not exists public.agenda_captures (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  capture_date date not null,
  capture_time text,
  location text,
  crm_client_id uuid references public.crm_clients(id) on delete set null,
  client_name text,
  team text,
  status text default 'agendada',   -- agendada | concluida | cancelada
  note text,
  created_at timestamptz default now()
);

alter table public.agenda_creations enable row level security;
alter table public.agenda_captures enable row level security;

drop policy if exists "agenda_creations owner" on public.agenda_creations;
create policy "agenda_creations owner" on public.agenda_creations
  for all using (auth.uid() = manager_id) with check (auth.uid() = manager_id);

drop policy if exists "agenda_captures owner" on public.agenda_captures;
create policy "agenda_captures owner" on public.agenda_captures
  for all using (auth.uid() = manager_id) with check (auth.uid() = manager_id);

create index if not exists idx_agenda_creations on public.agenda_creations(manager_id, day);
create index if not exists idx_agenda_captures on public.agenda_captures(manager_id, capture_date);
