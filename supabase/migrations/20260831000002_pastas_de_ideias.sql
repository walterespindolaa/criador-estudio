-- ═══════════════════════════════════════════════════════════════════════════
-- PASTAS DE IDEIAS (31/08) · pedido do Walter: "organizar as IDEIAS em
-- pastas, igual na parte de salvos do Instagram".
--
-- Modelo mínimo: uma tabela de pastas do usuário + um ponteiro opcional na
-- ideia. A pasta é organização, não hierarquia: sem subpastas, sem
-- compartilhamento. RLS espelha a da tabela ideas (auth.uid() = user_id),
-- que é a mais restrita do app; se um dia ideias ganharem acesso de time,
-- as pastas acompanham na mesma migration.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.idea_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  color text not null default '#EA4918',
  created_at timestamptz not null default now()
);

alter table public.idea_folders enable row level security;

drop policy if exists "idea_folders_select" on public.idea_folders;
create policy "idea_folders_select" on public.idea_folders
  for select using (auth.uid() = user_id);

drop policy if exists "idea_folders_insert" on public.idea_folders;
create policy "idea_folders_insert" on public.idea_folders
  for insert with check (auth.uid() = user_id);

drop policy if exists "idea_folders_update" on public.idea_folders;
create policy "idea_folders_update" on public.idea_folders
  for update using (auth.uid() = user_id);

drop policy if exists "idea_folders_delete" on public.idea_folders;
create policy "idea_folders_delete" on public.idea_folders
  for delete using (auth.uid() = user_id);

create index if not exists idx_idea_folders_user on public.idea_folders(user_id);

-- Ponteiro na ideia. on delete set null: excluir a pasta NÃO exclui as
-- ideias, elas só voltam pra "Todas" (mesma regra das linhas editoriais).
alter table public.ideas
  add column if not exists folder_id uuid references public.idea_folders(id) on delete set null;

create index if not exists idx_ideas_folder on public.ideas(folder_id);
