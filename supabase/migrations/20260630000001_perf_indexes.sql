-- Índices de performance nas tabelas quentes (filtradas por user_id/manager_id).
-- Cada criação é tolerante a falha: se a coluna/tabela não existir, pula sem quebrar.
do $$
declare
  stmt text;
  stmts text[] := array[
    'create index if not exists idx_posts_user_created on public.posts(user_id, created_at desc)',
    'create index if not exists idx_ideas_user_created on public.ideas(user_id, created_at desc)',
    'create index if not exists idx_tasks_user_created on public.tasks(user_id, created_at desc)',
    'create index if not exists idx_habits_user on public.habits(user_id)',
    'create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc)',
    'create index if not exists idx_crm_clients_manager on public.crm_clients(manager_id, created_at desc)',
    'create index if not exists idx_crm_leads_manager on public.crm_leads(manager_id, created_at desc)',
    'create index if not exists idx_crm_contracts_manager on public.crm_contracts(manager_id, created_at desc)',
    'create index if not exists idx_fin_records_manager on public.fin_records(manager_id, created_at desc)',
    'create index if not exists idx_fin_recurring_manager on public.fin_recurring(manager_id)',
    'create index if not exists idx_bio_leads_user on public.bio_leads(user_id, created_at desc)'
  ];
begin
  foreach stmt in array stmts loop
    begin
      execute stmt;
    exception when others then
      raise notice 'skip index: % (%)', stmt, sqlerrm;
    end;
  end loop;
end $$;
