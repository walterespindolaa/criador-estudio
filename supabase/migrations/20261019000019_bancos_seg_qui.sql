-- BANCOS DE TENDÊNCIAS E STORIES: SEGUNDA E QUINTA (Walter, 19/10/2026)
--
-- Achado: cron.job não tinha nenhum agendamento dos bancos. O trend-bank-weekly
-- (20260630000003) apontava pro projeto antigo e sumiu. Por isso o admin mostrava
-- "atualizado em 28/08" até a atualização manual de hoje.
--
-- Agora: segunda e quinta às 06:07 de Brasília (09:07 UTC) o pg_cron chama a
-- função bancos-cron, que dispara os dois refresh no ai-context-builder.
-- Segredo lido do Vault na hora (mesmo padrão dos outros robôs), ninguém vê.
-- Rodar de novo não duplica.
do $$ begin perform cron.unschedule('trend-bank-weekly'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('cria-bancos-seg-qui'); exception when others then null; end $$;

select cron.schedule('cria-bancos-seg-qui', '7 9 * * 1,4', $cron$
  select net.http_post(
    url := 'https://ecbzfjzoqidowrsfsfih.supabase.co/functions/v1/bancos-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'internal_push_secret' limit 1)),
    body := '{}'::jsonb);
$cron$);
