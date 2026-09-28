-- ═══════════════════════════════════════════════════════════════════════════
-- RELIGAR OS ROBÔS (28/09/2026) · achado do ciclo 1 do plano de publicar
--
-- cron_runs mostrou que instagram-refresh, daily-notifications,
-- story-notifications e trash-purge rodaram pela última vez em 10/08/2026, e
-- cron.job não tem mais esses agendamentos (sumiram em algum momento; foram
-- criados à mão e nunca estiveram num arquivo). Efeito: token do Instagram
-- vencendo sem renovar (@walterespindola_ venceu em 21/09, @gabrielakwk em
-- 27/09), resumo diário, lembrete de stories e limpeza da lixeira parados.
--
-- Este arquivo agenda TODOS de uma vez. O segredo NÃO precisa ser colado: ele
-- é lido do gatilho de push (notify_push_on_insert), que já está no banco com
-- o valor certo (é o que faz o push chegar no celular). Assim ninguém copia,
-- cola ou vê o segredo. Se o gatilho não tiver o segredo, o script para com
-- aviso e aí sim dá pra colar à mão em _segredo_manual.
-- Rodar de novo não duplica (desagenda e agenda de novo).
-- Horários em UTC (Brasília = UTC-3).
-- Fica de fora: trend-bank-weekly, que usa OUTRO segredo (TREND_CRON_SECRET)
-- e está em 20260630000003_trend_weekly_cron.sql.
-- ═══════════════════════════════════════════════════════════════════════════
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  _segredo_manual text := '';   -- só usar se o script pedir
  _segredo text;
  _base text := 'https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/';
  _j record;
begin
  select substring(pg_get_functiondef(p.oid) from $r$'x-internal-secret'\s*,\s*'([^']+)'$r$)
    into _segredo
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'notify_push_on_insert'
   limit 1;
  if nullif(_segredo_manual, '') is not null then _segredo := _segredo_manual; end if;
  if _segredo is null or _segredo like '\_\_%' then
    raise exception 'Não achei o segredo no gatilho de push. Cole o INTERNAL_PUSH_SECRET em _segredo_manual e rode de novo.';
  end if;

  for _j in
    select * from (values
      -- nome do robô,               quando,          função,                corpo
      ('cria-ig-refresh',            '30 6 * * *',    'instagram-refresh',   '{}'),                                   -- 03:30 BR: renova tokens do Instagram
      ('cria-daily-notif',           '0 12 * * *',    'daily-notifications', '{}'),                                   -- 09:00 BR: resumo do dia
      ('story-notifications-15min',  '*/15 * * * *',  'story-notifications', '{}'),                                   -- lembrete de stories
      ('trash-purge-daily',          '17 3 * * *',    'trash-purge',         '{}'),                                   -- 00:17 BR: lixeira de 30 dias
      ('cria-lifecycle-emails',      '0 13 * * *',    'lifecycle-emails',    '{}'),                                   -- 10:00 BR: e-mails de boas-vindas/trial
      ('cria-daily-health',          '0 11 * * *',    'daily-health-report', '{}')                                    -- 08:00 BR: relatório de saúde
    ) as v(nome, quando, funcao, corpo)
  loop
    begin
      perform cron.unschedule(_j.nome);
    exception when others then null;
    end;
    perform cron.schedule(_j.nome, _j.quando, format(
      $f$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','x-internal-secret',%L), body := %L::jsonb);$f$,
      _base || _j.funcao, _segredo, _j.corpo));
    raise notice 'agendado: % (%)', _j.nome, _j.quando;
  end loop;
end $$;
