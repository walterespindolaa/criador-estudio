-- B6 (varredura pré-lançamento): índices nas colunas quentes de filtro/FK que
-- ainda faltavam. RLS e queries do app filtram exatamente por essas colunas, então
-- sem índice cada leitura vira seq scan e degrada conforme a conta acumula histórico.
--
-- Só entram aqui os índices que AINDA NÃO existem. Já estavam versionados e NÃO são
-- duplicados: posts(user_id, scheduled_date) [idx_posts_user_scheduled],
-- post_approval_comments(post_id, created_at desc) [idx_post_comments_post_created],
-- fin_records(manager_id, created_at desc), crm_clients/crm_leads/crm_contracts
-- (manager_id, created_at desc) [migração 20260630000001_perf_indexes].
-- external_client_id sozinho já é coberto pelo composto (external_client_id,
-- approval_status) abaixo (prefixo à esquerda), por isso não recebe índice próprio.
--
-- Padrão tolerante (do-block com exception) igual a 20260630000001_perf_indexes.sql:
-- algumas tabelas/colunas foram criadas pelo dashboard (fora das migrations); se
-- alguma não existir no banco, o índice é pulado sem quebrar o resto.
do $$
declare
  stmt text;
  stmts text[] := array[
    -- posts: kanban do criador filtra por status de aprovação dentro do usuário.
    'create index if not exists idx_posts_user_approval on public.posts(user_id, approval_status)',
    -- posts: board/portal do cliente externo filtra por cliente + status de aprovação.
    'create index if not exists idx_posts_extclient_approval on public.posts(external_client_id, approval_status)',
    -- posts: consultas por data (agenda/cron cross-usuário) que não fixam user_id.
    'create index if not exists idx_posts_scheduled on public.posts(scheduled_date)',
    -- external_media_refs: FK usada pra puxar as mídias de um post.
    'create index if not exists idx_external_media_refs_post on public.external_media_refs(post_id)',
    -- crm_tasks: única tabela crm_* que ainda não tinha índice por dono (manager_id).
    'create index if not exists idx_crm_tasks_manager on public.crm_tasks(manager_id, created_at desc)',
    -- fallback caso crm_tasks não tenha created_at (índice só por manager_id).
    'create index if not exists idx_crm_tasks_manager_only on public.crm_tasks(manager_id)'
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
