-- ============================================================
-- BIBLIOTECA EM FICHÁRIO (07/11/2026, mockup aprovado pelo Walter)
--
-- 1. user_library_favorites: favoritar QUALQUER item da Biblioteca
--    (hook, formato, prompt e template; curado ou seu). item_id é texto
--    porque template é "howto-1", não uuid.
-- 2. user_library_usage.vezes: "Usar no post" e "Copiar" somam uso, pra
--    ficha mostrar "usado 3x" e o filtro "Nunca usei" funcionar.
-- 3. Exemplo de uso nos hooks curados (a coluna existia e estava vazia).
-- 4. Desliga um hook curado repetido (mesmo texto e mesmo tipo).
--
-- Idempotente.
-- ============================================================

create table if not exists public.user_library_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('hook','format','prompt','template')),
  item_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

alter table public.user_library_favorites enable row level security;

drop policy if exists "Users manage own library favorites" on public.user_library_favorites;
create policy "Users manage own library favorites" on public.user_library_favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Managers access library favorites" on public.user_library_favorites;
create policy "Managers access library favorites" on public.user_library_favorites
  for all using (public.is_account_manager(user_id)) with check (public.is_account_manager(user_id));

grant select, insert, update, delete on public.user_library_favorites to authenticated;

alter table public.user_library_usage add column if not exists vezes integer not null default 1;

update public.reference_hooks set is_active = false where id = 'bd4c1f34-5659-4c32-b997-9fc94eb61bbc';
