-- ============================================================
-- Gestora/colaboradora nao enxergava o Instagram do criador que ela gerencia.
--
-- Cenario: o criador (dono) conectou o Instagram dele (social_connections com
-- crm_client_id null). A social midia dele e membro ativo da conta via
-- public.account_members (mesmo vinculo do account switcher / cockpit). Ao abrir
-- Insights na conta dele, o front (agora corrigido) consulta pelo user_id do DONO
-- da conta ativa, mas o RLS so deixava o proprio dono ler:
--   social_connections   -> "Users manage own social connections" (so dono)
--   social_insights      -> "Users manage own social insights"    (so dono)
--   social_metrics_daily -> "Users manage own daily metrics"      (so dono)
-- Resultado: pra ela a query voltava vazia e a tela pedia pra CONECTAR de novo.
--
-- social_audience e social_stories JA tem policy de membro ("Members read ...",
-- ver 20260723000003_ig_data_expansion.sql). Aqui completamos o conjunto com o
-- MESMO padrao (is_account_member), que e o helper das tabelas de conteudo do
-- criador chaveadas por user_id (20260722000004_manager_impersonation_rls.sql).
--
-- SEGURANCA DO TOKEN: social_connections guarda o access_token da Meta. O membro
-- pode saber QUE a conexao existe (username, tipo, validade), mas NUNCA ler o
-- token. Isso ja esta garantido por privilegio de COLUNA (migration
-- 20260724000005_hide_social_access_token.sql): o SELECT de tabela foi revogado
-- do authenticated e devolvido coluna a coluna SEM access_token. Privilegio de
-- coluna e checado ANTES do RLS e vale pra qualquer linha, entao a policy nova
-- de membro nao tem como expor o token (nem pro proprio dono ele e legivel).
-- Por isso nao precisamos de view nem de RPC: policy de SELECT + grant de coluna
-- ja e o desenho mais simples e seguro.
--
-- Policies ADITIVAS (permissivas, em OU logico com as do dono): nada do que o
-- dono faz muda. Membro ganha leitura; escrita continua so do dono/service role,
-- com UMA excecao: UPDATE em social_insights, pra gestora poder vincular a midia
-- do IG ao post do CRIA (post_id), operacao dela no dia a dia. Sem isso o botao
-- "Vincular" salvaria 0 linha em silencio. A tabela e cache de metricas, sem
-- segredo, e o with check impede mover a linha pra fora da conta gerenciada.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================

-- 1) Conexao: membro ativo VE que a conta esta conectada (sem token, ver acima).
drop policy if exists "Members read social connections" on public.social_connections;
create policy "Members read social connections" on public.social_connections
  for select to authenticated
  using (public.is_account_member(user_id));

-- 2) Insights por midia: membro ativo le.
drop policy if exists "Members read social insights" on public.social_insights;
create policy "Members read social insights" on public.social_insights
  for select to authenticated
  using (public.is_account_member(user_id));

-- 3) Serie diaria: membro ativo le.
drop policy if exists "Members read daily metrics" on public.social_metrics_daily;
create policy "Members read daily metrics" on public.social_metrics_daily
  for select to authenticated
  using (public.is_account_member(user_id));

-- 4) Vinculo midia -> post do CRIA: a gestora opera o conteudo da conta (ja tem
--    member_all_posts com escrita em posts), entao pode atualizar o vinculo aqui.
drop policy if exists "Members link social insights" on public.social_insights;
create policy "Members link social insights" on public.social_insights
  for update to authenticated
  using (public.is_account_member(user_id))
  with check (public.is_account_member(user_id));
