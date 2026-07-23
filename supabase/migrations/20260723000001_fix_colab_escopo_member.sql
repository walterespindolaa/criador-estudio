-- Conta gerenciada (account switcher) nao carregava os POSTS do cliente.
--
-- Causa: a tabela public.posts tem uma policy RESTRICTIVE chamada colab_escopo
-- (escopo de colaborador via can_client_ext). Policy restritiva age em E logico
-- com as permissivas: mesmo o member_all_posts liberando o gestor membro, o
-- colab_escopo exigia can_client_ext(user_id, external_client_id), que da false
-- pra quem nao e dono nem colaborador daquele cliente. Resultado: board vazia.
--
-- Correcao: manter o escopo de colaborador E tambem liberar quem e membro ativo
-- da conta (is_account_member), igual ja fizemos nas policies permissivas.
-- As demais tabelas do criador (pilares, ideias, bio, etc.) nao tem policy
-- restritiva, entao ja funcionavam. As restritivas das tabelas da AGENCIA
-- (crm_clients, crm_tasks, fin_records, agenda, external_clients...) sao de outro
-- modelo (manager_id) e nao sao tocadas aqui de proposito.

drop policy if exists colab_escopo on public.posts;
create policy colab_escopo on public.posts
  as restrictive for all to authenticated
  using (public.can_client_ext(user_id, external_client_id) or public.is_account_member(user_id))
  with check (public.can_client_ext(user_id, external_client_id) or public.is_account_member(user_id));
