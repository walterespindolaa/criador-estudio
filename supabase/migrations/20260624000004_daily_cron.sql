-- Agenda o robô diário (re-engajamento + acesso vencendo).
-- IMPORTANTE: rodar DEPOIS de fazer deploy da edge function daily-notifications.
-- Roda todo dia às 12:00 UTC (~09:00 BRT).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior (se existir) pra poder rodar este SQL de novo sem erro.
do $$
begin
  perform cron.unschedule('cria-daily-notif');
exception when others then
  null;
end $$;

select cron.schedule(
  'cria-daily-notif',
  '0 12 * * *',
  $cron$
    select net.http_post(
      url := 'https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/daily-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', '57892381207d35096c8b2eca38a0bca7f286040322401a2c'
      ),
      body := '{}'::jsonb
    );
  $cron$
);
