-- ═══════════════════════════════════════════════════════════════════════════
-- SEGREDO INTERNO NO COFRE (28/09/2026) · passo 0 do ciclo 2
--
-- Por que existe: religar os robôs (000004) funcionou, mas todas as chamadas
-- voltaram 401 "unauthorized". O segredo que estava escrito dentro do gatilho
-- de push NÃO bate mais com o INTERNAL_PUSH_SECRET das funções (foi trocado lá
-- e nunca aqui). Efeito colateral: o push no celular também estava falhando.
--
-- O que muda: o segredo passa a morar em UM lugar só no banco, o cofre
-- (Vault), criptografado. Gatilho de push e robôs leem de lá na hora de cada
-- chamada. Trocar o segredo no futuro = trocar no cofre + no painel das
-- funções, sem reescrever função nenhuma.
--
-- O valor é gerado aqui dentro (aleatório, 64 caracteres). Ninguém digita,
-- ninguém manda por mensagem. Depois de rodar, o passo 2 da conversa mostra o
-- valor UMA vez pra ser colado direto no segredo INTERNAL_PUSH_SECRET.
--
-- Rodar de novo GERA OUTRO valor (aí precisa colar de novo no painel).
-- ═══════════════════════════════════════════════════════════════════════════
create extension if not exists supabase_vault;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── 1. Segredo novo no cofre ──────────────────────────────────────────────
do $$
declare
  _id uuid;
  _novo text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select id into _id from vault.secrets where name = 'internal_push_secret';
  if _id is null then
    perform vault.create_secret(_novo, 'internal_push_secret',
      'x-internal-secret dos robôs e do push. Tem que ser igual ao INTERNAL_PUSH_SECRET das Edge Functions.');
  else
    perform vault.update_secret(_id, _novo);
  end if;
end $$;

-- ── 2. Gatilho de push lê do cofre ────────────────────────────────────────
-- Mesmo corpo de 20260904000002 (preferência de push por categoria), só que
-- o segredo vem do cofre em vez de escrito no código.
create or replace function public.notify_push_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Preferência da pessoa: categoria desligada não vira push (o sino segue).
  if not public.quer_push(new.user_id, new.type) then
    return new;
  end if;
  perform net.http_post(
    url := 'https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'internal_push_secret' limit 1)),
    body := jsonb_build_object(
      'user_id', new.user_id,
      'title', coalesce(new.title, 'Cria'),
      'message', coalesce(new.description, new.title, ''),
      'url', coalesce(new.link, '/app')));
  return new;
exception when others then
  -- Push nunca pode impedir a notificação de entrar no sino.
  return new;
end $$;

-- ── 3. Robôs leem do cofre a cada disparo ─────────────────────────────────
-- O comando agendado não carrega mais o valor: busca no cofre na hora.
do $$
declare
  _base text := 'https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/';
  _j record;
begin
  for _j in
    select * from (values
      -- nome do robô,               quando (UTC),    função
      ('cria-ig-refresh',            '30 6 * * *',    'instagram-refresh'),    -- 03:30 BR: renova tokens do Instagram
      ('cria-daily-notif',           '0 12 * * *',    'daily-notifications'),  -- 09:00 BR: resumo do dia
      ('story-notifications-15min',  '*/15 * * * *',  'story-notifications'),  -- lembrete de stories
      ('trash-purge-daily',          '17 3 * * *',    'trash-purge'),          -- 00:17 BR: lixeira de 30 dias
      ('cria-lifecycle-emails',      '0 13 * * *',    'lifecycle-emails'),     -- 10:00 BR: e-mails de boas-vindas/trial
      ('cria-daily-health',          '0 11 * * *',    'daily-health-report')   -- 08:00 BR: relatório de saúde
    ) as v(nome, quando, funcao)
  loop
    begin
      perform cron.unschedule(_j.nome);
    exception when others then null;
    end;
    perform cron.schedule(_j.nome, _j.quando, format(
      $f$select net.http_post(
           url := %L,
           headers := jsonb_build_object(
             'Content-Type', 'application/json',
             'x-internal-secret',
             (select decrypted_secret from vault.decrypted_secrets where name = 'internal_push_secret' limit 1)),
           body := '{}'::jsonb);$f$,
      _base || _j.funcao));
  end loop;
end $$;
