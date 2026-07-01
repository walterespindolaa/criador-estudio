-- Refresh automático do banco de tendências: todo domingo à noite (21h BRT = seg 00h UTC).
-- Precisa preencher __TREND_CRON_SECRET__ com o mesmo valor do secret TREND_CRON_SECRET.
do $$ begin perform cron.unschedule('trend-bank-weekly'); exception when others then null; end $$;

select cron.schedule('trend-bank-weekly', '0 0 * * 1', $cron$
  select net.http_post(
    url := 'https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/ai-context-builder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', '__TREND_CRON_SECRET__'
    ),
    body := jsonb_build_object('operation', 'trend-bank-refresh')
  );
$cron$);
