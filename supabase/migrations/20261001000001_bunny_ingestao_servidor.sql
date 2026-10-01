-- ═══════════════════════════════════════════════════════════════════════════
-- VÍDEO DO DRIVE VAI PRO BUNNY PELO SERVIDOR (01/10/2026)
--
-- A passagem Drive -> Bunny saiu do navegador de quem anexou e foi pra edge
-- bunny-ingerir-drive (o Bunny baixa direto do Drive). Estas colunas guardam
-- o andamento de cada vídeo, e o robô de 5 em 5 minutos promove a mídia pro
-- Bunny quando o encoding termina.
--   ingest_status: null (nunca tentou) | buscando | pronto | erro
-- Não mexe em RLS nenhuma: a edge escreve com service role.
-- Rodar de novo não quebra nem duplica.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.external_media_refs
  add column if not exists ingest_bunny_guid text,
  add column if not exists ingest_status text,
  add column if not exists ingest_tentado_em timestamptz,
  add column if not exists ingest_erro text;

do $$ begin
  alter table public.external_media_refs
    add constraint external_media_refs_ingest_status_chk
    check (ingest_status is null or ingest_status in ('buscando','pronto','erro'));
exception when duplicate_object then null; end $$;

create index if not exists external_media_refs_ingest_buscando_idx
  on public.external_media_refs (ingest_status) where ingest_status = 'buscando';

-- Robô: confere as buscas em andamento a cada 5 minutos. O segredo é
-- procurado no cofre, depois num robô já agendado, depois no gatilho de push
-- (01/10/2026: o gatilho não tinha mais o segredo). Nunca é exibido.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
declare
  _segredo text;
  _origem text;
begin
  begin
    select decrypted_secret into _segredo
      from vault.decrypted_secrets where name = 'internal_push_secret' limit 1;
    if _segredo is not null then _origem := 'cofre'; end if;
  exception when others then null;
  end;
  if _segredo is null then
    select substring(command from $r$'x-internal-secret'\s*,\s*'([^']+)'$r$) into _segredo
      from cron.job
     where command like '%x-internal-secret%'
       and command not like '%decrypted_secret%'
       and jobname <> 'cria-bunny-ingerir'
     order by jobid desc limit 1;
    if _segredo is not null then _origem := 'robô existente'; end if;
  end if;
  if _segredo is null then
    select substring(pg_get_functiondef(p.oid) from $r$'x-internal-secret'\s*,\s*'([^']+)'$r$) into _segredo
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'notify_push_on_insert' limit 1;
    if _segredo is not null then _origem := 'gatilho de push'; end if;
  end if;
  if _segredo is null or _segredo like '\_\_%' then
    raise exception 'Segredo não encontrado em nenhum lugar.';
  end if;
  begin perform cron.unschedule('cria-bunny-ingerir'); exception when others then null; end;
  perform cron.schedule('cria-bunny-ingerir', '*/5 * * * *', format(
    $f$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','x-internal-secret',%L), body := '{}'::jsonb);$f$,
    'https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/bunny-ingerir-drive', _segredo));
  raise notice 'agendado: cria-bunny-ingerir (segredo veio de: %)', _origem;
end $$;
