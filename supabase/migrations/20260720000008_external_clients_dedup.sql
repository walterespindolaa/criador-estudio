-- Fix "2 Anna": external_clients não tinha unicidade por cliente, então "Ativar
-- Cria Post" criava linha nova toda vez e o conteúdo antigo sumia (o .find pegava
-- a linha nova). Aqui: (1) funde os duplicados no mais antigo, movendo
-- posts/cronogramas/approval_tokens; (2) trava com UNIQUE(manager_id, crm_client_id).

-- 1) Desduplica: por (manager_id, crm_client_id), mantém o mais antigo (keep_id),
--    move os filhos dos duplicados pra ele e apaga os duplicados.
do $$
declare r record;
begin
  for r in
    select manager_id, crm_client_id,
           (array_agg(id order by created_at asc))[1] as keep_id,
           array_agg(id order by created_at asc) as all_ids
    from public.external_clients
    where crm_client_id is not null
    group by manager_id, crm_client_id
    having count(*) > 1
  loop
    update public.posts set external_client_id = r.keep_id
      where external_client_id = any(r.all_ids) and external_client_id <> r.keep_id;
    update public.cronogramas set external_client_id = r.keep_id
      where external_client_id = any(r.all_ids) and external_client_id <> r.keep_id;
    update public.approval_tokens set external_client_id = r.keep_id
      where external_client_id = any(r.all_ids) and external_client_id <> r.keep_id;
    delete from public.external_clients
      where id = any(r.all_ids) and id <> r.keep_id;
  end loop;
end $$;

-- 2) Trava: um vínculo Cria Post por cliente por gestor.
--    (crm_client_id NULL não conflita: Postgres trata nulls como distintos.)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'external_clients_manager_crm_key') then
    alter table public.external_clients
      add constraint external_clients_manager_crm_key unique (manager_id, crm_client_id);
  end if;
end $$;
