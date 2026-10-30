/* COLABORADOR FASE 2: ESCOPO POR CLIENTE NO BANCO (Walter, 30/10/2026).
   A trava por cliente (Equipe > permissões: "todos os clientes" ou só alguns)
   já valia no banco em 16 tabelas pela policy restritiva `colab_escopo`
   (can_client / can_client_ext). Teste de 30/10 com uma colaboradora limitada
   a 1 cliente achou 5 tabelas fora dela, que ainda mostravam os outros
   clientes: link de aprovação, roteiros de captação, ficha de entrada do
   cliente, datas do cliente na agenda e ajustes de post. Esta migração fecha
   as cinco com a mesma regra. Dono da conta continua vendo tudo; quem tem
   "todos os clientes" também. */

-- Link de aprovação do cliente (dá acesso ao portal dele).
drop policy if exists colab_escopo on public.approval_tokens;
create policy colab_escopo on public.approval_tokens as restrictive for all to authenticated
  using (public.can_client_ext(manager_id, external_client_id))
  with check (public.can_client_ext(manager_id, external_client_id));

-- Roteiros de captação. Roteiro sem cliente (biblioteca) segue o módulo.
drop policy if exists colab_escopo on public.capture_scripts;
create policy colab_escopo on public.capture_scripts as restrictive for all to authenticated
  using (case when crm_client_id is null then public.member_can(manager_id, 'cria_captacao')
              else public.can_client(manager_id, crm_client_id, 'cria_captacao') end)
  with check (case when crm_client_id is null then public.member_can(manager_id, 'cria_captacao')
              else public.can_client(manager_id, crm_client_id, 'cria_captacao') end);

-- Ficha de entrada (briefing) do cliente.
drop policy if exists colab_escopo on public.client_intakes;
create policy colab_escopo on public.client_intakes as restrictive for all to authenticated
  using (case when crm_client_id is null then public.acts_for_equipe(manager_id)
              else public.can_client(manager_id, crm_client_id, null) end)
  with check (case when crm_client_id is null then public.acts_for_equipe(manager_id)
              else public.can_client(manager_id, crm_client_id, null) end);

-- Datas comemorativas ligadas a um cliente, na agenda.
drop policy if exists colab_escopo on public.agenda_data_clientes;
create policy colab_escopo on public.agenda_data_clientes as restrictive for all to authenticated
  using (exists (select 1 from public.agenda_datas d where d.id = agenda_data_id
                 and public.can_client(d.manager_id, crm_client_id, 'agenda')))
  with check (exists (select 1 from public.agenda_datas d where d.id = agenda_data_id
                 and public.can_client(d.manager_id, crm_client_id, 'agenda')));

-- Ajustes pedidos num post (a conta do cliente com Cria continua lendo os dela).
drop policy if exists colab_escopo on public.post_ajustes;
create policy colab_escopo on public.post_ajustes as restrictive for all to authenticated
  using (owner_id = auth.uid() or public.can_client_ext(owner_id, external_client_id) or public.is_account_member(owner_id))
  with check (owner_id = auth.uid() or public.can_client_ext(owner_id, external_client_id) or public.is_account_member(owner_id));
