-- ============================================================
-- M8: esconder o access_token de public.social_connections do cliente.
--
-- Contexto: a policy RLS "Users manage own social connections" e
-- `for all using (auth.uid() = user_id)`. RLS filtra LINHA, nao COLUNA, entao
-- o DONO da conexao consegue rodar `select access_token from social_connections`
-- pelo PostgREST direto do navegador (o token long-lived do Instagram vaza pra
-- qualquer um que abra o devtools na conta dele).
--
-- Quem REALMENTE precisa do access_token e so o backend: as edge functions
-- (instagram-oauth, instagram-sync, instagram-refresh) leem/gravam o token via
-- SERVICE ROLE, que ignora grants e RLS. O FRONT nunca seleciona access_token:
-- os hooks em src/hooks/useSocialInsights.ts pedem listas explicitas de colunas
-- SEM o token (useSocialConnection, useClientSocialConnection), fazem DELETE na
-- desconexao e NUNCA INSERT/UPDATE (o OAuth escreve pelo service role).
--
-- Correcao: como RLS nao filtra coluna no SELECT, usamos privilegio por COLUNA.
-- Revogamos o SELECT de TABELA do authenticated/anon e concedemos SELECT so nas
-- colunas seguras (todas MENOS access_token). Nao mexemos em INSERT/UPDATE/DELETE
-- nem nas policies RLS: o dono continua podendo desconectar (DELETE) e o filtro
-- de dono por RLS segue valendo. So o access_token deixa de ser legivel no browser.
--
-- Colunas REAIS da tabela (ver 20260618000002_social_insights.sql + colunas
-- adicionadas depois: crm_client_id em 20260624000008_ig_per_client.sql e
-- profile_picture_url em 20260629000001_social_profile_picture.sql):
--   id, user_id, provider, external_account_id, username, account_type,
--   access_token (SENSIVEL), token_expires_at, scopes, connected_at,
--   updated_at, profile_picture_url, crm_client_id
-- Nao existe refresh_token nesta tabela.
-- ============================================================

-- 1) Tira o SELECT amplo (nivel de tabela) do cliente autenticado e do anonimo.
revoke select on public.social_connections from authenticated;
revoke select on public.social_connections from anon;

-- 2) Devolve o SELECT so nas colunas NAO sensiveis (todas menos access_token)
--    para o cliente autenticado. anon nao recebe nada (nao ha caso de uso e o
--    RLS ja barraria por falta de sessao).
grant select (
  id,
  user_id,
  provider,
  external_account_id,
  username,
  account_type,
  profile_picture_url,
  token_expires_at,
  scopes,
  connected_at,
  updated_at,
  crm_client_id
) on public.social_connections to authenticated;

-- INSERT/UPDATE/DELETE permanecem como estao (nivel de tabela + RLS). O front so
-- faz DELETE (desconectar), que usa user_id/provider/crm_client_id no WHERE —
-- todas colunas concedidas acima — e sem RETURNING (supabase-js delete sem
-- .select() manda Prefer: return=minimal), entao nao toca access_token.
