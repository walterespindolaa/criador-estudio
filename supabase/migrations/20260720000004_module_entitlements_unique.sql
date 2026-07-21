-- Fix: criar conta de social mídia com módulos extras não gravava nenhum módulo.
-- Causa: admin-create-manager faz upsert em module_entitlements com
-- onConflict (manager_id, module_code), mas essa constraint única não existia,
-- então o upsert falhava (42P10) e o erro era engolido. Aqui garantimos a
-- constraint. É idempotente e remove duplicatas antes, se houver.

-- 1) Remove duplicatas mantendo uma linha por (manager_id, module_code).
delete from public.module_entitlements a
using public.module_entitlements b
where a.manager_id = b.manager_id
  and a.module_code = b.module_code
  and a.ctid < b.ctid;

-- 2) Cria a constraint única esperada pelo upsert (se ainda não existir).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'module_entitlements_manager_module_key'
  ) then
    alter table public.module_entitlements
      add constraint module_entitlements_manager_module_key
      unique (manager_id, module_code);
  end if;
end $$;
