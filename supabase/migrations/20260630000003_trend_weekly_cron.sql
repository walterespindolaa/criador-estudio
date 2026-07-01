-- Refresh automático do banco de tendências: todo domingo à noite (21h BRT = seg 00h UTC).
-- Precisa preencher SERVICE_ROLE_KEY e INTERNAL_PUSH_SECRET (ver instruções no chat).
do $$ begin perform cron.unschedule('trend-bank-weekly'); exception when others then null; end $$;

select cron.schedule('trend-bank-weekly', '0 0 * * 1', $cron$
  select net.http_post(
    url := 'https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/ai-context-builder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer __SERVICE_ROLE_KEY__',
      'x-internal-secret', '__INTERNAL_PUSH_SECRET__'
    ),
    body := jsonb_build_object('operation', 'trend-bank-refresh')
  );
$cron$);
