-- Ordem MANUAL por dia da grade da Agenda de criação (reordenar cards dentro do dia).
-- Guarda um array de chaves "<kind>:<id>" (ex.: "cap:uuid", "post:uuid") que sobrepõe a
-- ordem por horário. Chaveado por (manager_id, day). Espelha o RLS das demais tabelas da
-- agenda (dono acessa as próprias linhas). Idempotente.
create table if not exists public.agenda_day_order (
  manager_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  item_order jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (manager_id, day)
);

alter table public.agenda_day_order enable row level security;

drop policy if exists "agenda_day_order owner" on public.agenda_day_order;
create policy "agenda_day_order owner" on public.agenda_day_order
  for all using (auth.uid() = manager_id) with check (auth.uid() = manager_id);
