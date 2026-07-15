-- Cria Prompter — roteiros do teleprompter (por usuário).
-- O roteiro pode nascer aqui (manual) ou chegar pronto de outros módulos
-- (Criando / Cria Stories / Cria IA) via campo source.

create table if not exists public.prompter_scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Sem título',
  script text not null default '',
  source text not null default 'manual' check (source in ('manual','criando','stories','ia')),
  source_id uuid,                      -- id do post/slot de origem, opcional
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_prompter_scripts_user_upd on public.prompter_scripts (user_id, updated_at desc);

alter table public.prompter_scripts enable row level security;
drop policy if exists "prompter_scripts_select" on public.prompter_scripts;
create policy "prompter_scripts_select" on public.prompter_scripts
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "prompter_scripts_insert" on public.prompter_scripts;
create policy "prompter_scripts_insert" on public.prompter_scripts
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "prompter_scripts_update" on public.prompter_scripts;
create policy "prompter_scripts_update" on public.prompter_scripts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "prompter_scripts_delete" on public.prompter_scripts;
create policy "prompter_scripts_delete" on public.prompter_scripts
  for delete to authenticated using (user_id = auth.uid());
