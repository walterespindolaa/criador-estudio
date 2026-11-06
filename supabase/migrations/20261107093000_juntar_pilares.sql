-- ============================================================
-- JUNTAR PILARES REPETIDOS (Histórico, 07/11/2026)
--
-- O criador acaba com "Empresario" e "Empresário" (ou "IA / Sistemas" e
-- "IA e Sistemas") e os números do Histórico se dividem no meio. Esta RPC
-- move tudo pro pilar que fica e apaga os repetidos.
--
--  - Só posts.pillar_id e ideas.pillar_id apontam pra pillars (as duas FKs
--    são ON DELETE SET NULL). Conferido em 07/11/2026.
--  - Quem pode: o dono, quem gerencia a conta e membro do time (mesmas
--    regras das policies de pillars).
--  - Chamada com _ficar nulo não faz nada e devolve 0: o app usa isso pra
--    saber se a função existe.
--  - Idempotente (create or replace).
-- ============================================================
create or replace function public.juntar_pilares(_ficar uuid, _sair uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _dono uuid;
  _n integer;
  _movidos integer := 0;
begin
  if _ficar is null or _sair is null or cardinality(_sair) = 0 then
    return 0;
  end if;

  select user_id into _dono from public.pillars where id = _ficar;
  if _dono is null then
    raise exception 'pilar_nao_encontrado';
  end if;

  if not (_dono = auth.uid() or public.is_account_manager(_dono) or public.is_account_member(_dono)) then
    raise exception 'sem_permissao';
  end if;

  _sair := array_remove(_sair, _ficar);
  if cardinality(_sair) = 0 then
    return 0;
  end if;

  if exists (select 1 from public.pillars where id = any(_sair) and user_id <> _dono) then
    raise exception 'pilar_de_outra_conta';
  end if;

  update public.posts set pillar_id = _ficar where pillar_id = any(_sair);
  get diagnostics _n = row_count;
  _movidos := _movidos + _n;

  update public.ideas set pillar_id = _ficar where pillar_id = any(_sair);
  get diagnostics _n = row_count;
  _movidos := _movidos + _n;

  delete from public.pillars where id = any(_sair) and user_id = _dono;

  return _movidos;
end;
$$;

revoke all on function public.juntar_pilares(uuid, uuid[]) from public;
revoke all on function public.juntar_pilares(uuid, uuid[]) from anon;
grant execute on function public.juntar_pilares(uuid, uuid[]) to authenticated;
