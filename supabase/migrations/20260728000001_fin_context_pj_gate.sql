-- SEGURANÇA (pré-lançamento): colaborador com o módulo cria_caixa NÃO pode ver
-- o financeiro PESSOAL (PF) do dono. As policies _team liberavam TODAS as linhas
-- do manager_id (sem filtrar context), então a separação Empresa/Pessoal existia
-- só na UI — um colaborador lia o PF pelo console (select em fin_records context='pf').
--
-- Correção: o colaborador (que só tem acesso via _team) passa a enxergar apenas
-- context='pj'. O DONO continua vendo tudo pela policy própria "owner_all_*"
-- (manager_id = auth.uid()), que NÃO é tocada aqui — RLS é OR entre policies.
-- coalesce(context,'pj'): linhas antigas sem context são PJ por padrão (mesma
-- regra do app, r.context ?? 'pj'), então nada some pro colaborador legítimo.
-- fin_monthly NÃO tem coluna context (mensalidade é sempre PJ) → não muda.
-- Idempotente.

-- fin_records: colaborador só Empresa (PJ)
drop policy if exists "fin_records_team" on public.fin_records;
create policy "fin_records_team" on public.fin_records for all to authenticated
  using (public.has_member_module(manager_id, 'cria_caixa') and coalesce(context, 'pj') = 'pj')
  with check (public.has_member_module(manager_id, 'cria_caixa') and coalesce(context, 'pj') = 'pj');

-- fin_recurring: idem
drop policy if exists "fin_recurring_team" on public.fin_recurring;
create policy "fin_recurring_team" on public.fin_recurring for all to authenticated
  using (public.has_member_module(manager_id, 'cria_caixa') and coalesce(context, 'pj') = 'pj')
  with check (public.has_member_module(manager_id, 'cria_caixa') and coalesce(context, 'pj') = 'pj');
