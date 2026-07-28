-- Agenda a renovação diária dos tokens long-lived do Instagram.
-- IMPORTANTE: rodar DEPOIS de fazer deploy da edge function instagram-refresh.
-- Roda todo dia às 06:30 UTC (~03:30 BRT, horário de baixo tráfego).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior (se existir) pra poder rodar este SQL de novo sem erro.
do $$
begin
  perform cron.unschedule('cria-ig-refresh');
exception when others then
  null;
end $$;

select cron.schedule(
  'cria-ig-refresh',
  '30 6 * * *',
  $cron$
    select net.http_post(
      url := 'https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/instagram-refresh',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', '__INTERNAL_PUSH_SECRET__'  -- SEGREDO ROTACIONADO: preencher antes de rodar (Vault / SQL manual). NAO commitar valor real.
      ),
      body := '{}'::jsonb
    );
  $cron$
);
