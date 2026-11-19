-- WhatsApp do Cria (Gabi, 19/11/2026): um lembrete só pra quem não respondeu a
-- boas-vindas em 24 h. A fila passa a chamar o robô também quando tem lembrete.
alter table public.wa_conversas add column if not exists lembrete_em timestamptz;

select cron.unschedule('cria-wa-fila');
select cron.schedule('cria-wa-fila', '* * * * *', $cron$
  select net.http_post(
    url := 'https://ecbzfjzoqidowrsfsfih.supabase.co/functions/v1/wa-robo',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_push_secret' limit 1)),
    body := '{"acao": "fila"}'::jsonb,
    timeout_milliseconds := 60000)
  where exists (select 1 from public.wa_config where id = 1 and robo_ligado)
    and extract(hour from now() at time zone 'America/Sao_Paulo') between 8 and 20
    and (exists (select 1 from public.wa_conversas where estado = 'agendada' and enviar_em <= now())
      or exists (select 1 from public.wa_conversas where estado = 'enviada' and ultima_entrada_em is null
                   and lembrete_em is null and enviada_em <= now() - interval '24 hours'));
$cron$);
