-- SEM CACHÊ COMBINADO (Gabriela, 24/11/2026: "foi eu e ela que combinamos que
-- não tem cobrança"; "vai existir situação que o editor ganha um valor fixo").
-- O aviso "Entregas sem cachê combinado" aparecia pra sempre. Esta tabela
-- guarda o "estou ciente":
--   peca_id preenchido  -> só aquela peça (post ou material) sai do aviso;
--   peca_id nulo        -> todo o parceiro (member_id) sai do aviso (valor fixo).
-- Não mexe em cachê, Caixa nem a receber: só esconde o lembrete.
create table if not exists public.cache_dispensado (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references auth.users(id) on delete cascade,
  peca_id uuid,
  member_id uuid,
  criado_por uuid not null default auth.uid(),
  criado_em timestamptz not null default now(),
  constraint cache_dispensado_alvo check (peca_id is not null or member_id is not null)
);

create unique index if not exists cache_dispensado_peca_uk
  on public.cache_dispensado (agencia_id, peca_id) where peca_id is not null;
create unique index if not exists cache_dispensado_parceiro_uk
  on public.cache_dispensado (agencia_id, member_id) where peca_id is null;

alter table public.cache_dispensado enable row level security;

-- Dona da agência e equipe (is_team_member já deixa parceiro de fora).
drop policy if exists cache_dispensado_agencia on public.cache_dispensado;
create policy cache_dispensado_agencia on public.cache_dispensado
  for all to authenticated
  using (agencia_id = auth.uid() or public.is_team_member(agencia_id))
  with check (agencia_id = auth.uid() or public.is_team_member(agencia_id));
