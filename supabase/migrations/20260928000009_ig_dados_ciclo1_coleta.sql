-- ═══════════════════════════════════════════════════════════════════════════
-- DADOS DO INSTAGRAM · CICLO 1 · COLETA CONFIÁVEL (28/09/2026)
--
-- 1. social_connections.ultimo_sync_em: quando foi a última coleta. O robô
--    usa pra atualizar primeiro quem está mais velho; a tela usa pra mostrar
--    "atualizado há X".
-- 2. Conserta o histórico dos totais de conta. Até hoje o total de 30 dias
--    (visitas ao perfil, contas engajadas, interações) era gravado na linha de
--    CADA dia; quem somava os dias (Media Kit) multiplicava o número. O valor
--    antigo vai pro metrics como *_30d (que é o que ele era de verdade) e a
--    coluna do dia fica vazia. Daqui pra frente a coleta grava o valor do dia.
-- 3. Robôs: coleta completa a cada 20 min (3 contas por vez, as mais velhas
--    primeiro: cada conta fica com no máximo ~1 dia de atraso) e stories a
--    cada 3 h (somem em 24 h). Segredo lido do cofre.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.social_connections
  add column if not exists ultimo_sync_em timestamptz,
  -- Quando o robô TENTOU (carimbado antes de começar): conta que falha ou
  -- estoura o tempo vai pro fim da fila em vez de travar as outras.
  add column if not exists ultima_tentativa_em timestamptz,
  add column if not exists stories_tentativa_em timestamptz;
grant select (ultimo_sync_em) on public.social_connections to authenticated;

-- Só as linhas gravadas antes desta mudança (hoje em diante já vêm certas).
-- Roda uma vez: a marca metrics->>'totais_corrigidos' evita mexer duas vezes.
update public.social_metrics_daily
   set metrics = coalesce(metrics, '{}'::jsonb)
         || jsonb_strip_nulls(jsonb_build_object(
              'profile_views_30d', profile_views,
              'accounts_engaged_30d', accounts_engaged,
              'total_interactions_30d', total_interactions))
         || '{"totais_corrigidos": true}'::jsonb,
       profile_views = null, accounts_engaged = null, total_interactions = null
 where date <= date '2026-09-28'
   and coalesce(metrics->>'totais_corrigidos', '') = ''
   and (profile_views is not null or accounts_engaged is not null or total_interactions is not null);

do $$
begin
  perform cron.unschedule('cria-ig-sync');
exception when others then null;
end $$;
select cron.schedule('cria-ig-sync', '*/20 * * * *', $c$
  select net.http_post(
    url := 'https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/instagram-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'internal_push_secret' limit 1)),
    body := '{"modo": "completo"}'::jsonb);
$c$);

do $$
begin
  perform cron.unschedule('cria-ig-stories');
exception when others then null;
end $$;
select cron.schedule('cria-ig-stories', '10 */3 * * *', $c$
  select net.http_post(
    url := 'https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/instagram-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'internal_push_secret' limit 1)),
    body := '{"modo": "stories"}'::jsonb);
$c$);

notify pgrst, 'reload schema';
