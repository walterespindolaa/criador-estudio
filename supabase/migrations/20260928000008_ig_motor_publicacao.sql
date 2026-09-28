-- ═══════════════════════════════════════════════════════════════════════════
-- PUBLICAR NO INSTAGRAM · CICLOS 4 A 6 · MOTOR, TELA E AGENDAMENTO (28/09/2026)
-- Plano: CRIA/publicar-instagram-plano.md
--
-- 1. Trava contra publicar duas vezes (ig_travar_publicacao): só UM robô ou
--    clique pega o post; os outros recebem "já está publicando".
-- 2. Ligar/desligar a publicação automática (ig_agendar_publicacao), com as
--    regras: conta com permissão, data definida e no futuro, e Cria Post só
--    depois de aprovado pelo cliente (decisão do ciclo 0).
-- 3. Mudou data/hora de um post na fila: o horário de publicar acompanha.
-- 4. Publicou pelo Cria: os números do Instagram se ligam ao post sozinhos.
-- 5. Robô a cada minuto que publica o que venceu (segredo lido do cofre).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.posts
  add column if not exists publish_started_at timestamptz;

-- ── 1. Trava (só o servidor chama) ────────────────────────────────────────
-- Devolve 'ok' quando conseguiu a trava. Post parado em "publicando" há mais
-- de 15 min é tratado como travado por queda e pode ser retomado.
create or replace function public.ig_travar_publicacao(_post_id uuid, _actor uuid)
returns text language plpgsql security definer set search_path = public as $$
declare _st text;
begin
  update public.posts
     set publish_status = 'publicando',
         publish_started_at = now(),
         publish_attempts = coalesce(publish_attempts, 0) + 1,
         publish_by = coalesce(_actor, publish_by),
         publish_error = null
   where id = _post_id and deleted_at is null
     and (publish_status is null or publish_status in ('na_fila', 'erro')
          or (publish_status = 'publicando' and publish_started_at < now() - interval '15 minutes'));
  if found then return 'ok'; end if;
  select coalesce(publish_status, 'sumiu') into _st from public.posts where id = _post_id;
  return coalesce(_st, 'sumiu');
end $$;
revoke all on function public.ig_travar_publicacao(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ig_travar_publicacao(uuid, uuid) to service_role;

-- ── 2. Ligar/desligar a publicação automática ─────────────────────────────
create or replace function public.ig_agendar_publicacao(_post_id uuid, _ligar boolean)
returns table (publish_status text, publicar_em timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  _p record;
  _c record;
  _quando timestamptz;
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;

  -- Mesma regra de quem pode publicar (dono ou equipe ativa, sem parceiro).
  -- ig_conexao_do_post levanta "sem permissão para este post" pra estranho.
  select * into _c from public.ig_conexao_do_post(_post_id) limit 1;

  select id, external_client_id, approval_status, scheduled_date, scheduled_time,
         posts.publish_status as st
    into _p from public.posts where id = _post_id and deleted_at is null;

  if not _ligar then
    update public.posts set auto_publish = false,
           publish_status = case when posts.publish_status = 'na_fila' then null else posts.publish_status end
     where id = _post_id;
    return query select p.publish_status, p.publicar_em from public.posts p where p.id = _post_id;
    return;
  end if;

  if _p.st in ('publicando', 'publicado') then
    raise exception 'Este post já foi (ou está sendo) publicado.';
  end if;
  if not coalesce(_c.pode_publicar, false) then
    raise exception '%', coalesce(_c.motivo, 'O Instagram deste perfil não pode publicar pelo Cria.');
  end if;
  if _p.external_client_id is not null and coalesce(_p.approval_status, '') <> 'aprovado' then
    raise exception 'O cliente ainda não aprovou este post. A publicação automática libera depois da aprovação.';
  end if;
  if _p.scheduled_date is null then
    raise exception 'Defina a data do post antes de ligar a publicação automática.';
  end if;
  _quando := public.instante_brasilia(_p.scheduled_date, _p.scheduled_time);
  if _quando < now() - interval '2 minutes' then
    raise exception 'A data e hora deste post já passaram. Ajuste a data ou use Publicar agora.';
  end if;

  update public.posts
     set auto_publish = true, publish_status = 'na_fila', publicar_em = _quando,
         publish_error = null, publish_attempts = 0, publish_by = auth.uid()
   where id = _post_id;
  return query select 'na_fila'::text, _quando;
end $$;
revoke all on function public.ig_agendar_publicacao(uuid, boolean) from public, anon;
grant execute on function public.ig_agendar_publicacao(uuid, boolean) to authenticated;

-- ── 3. Data/hora mudou com o post na fila: o horário acompanha ────────────
create or replace function public.ig_recalcular_publicar_em()
returns trigger language plpgsql as $$
begin
  if new.auto_publish and new.publish_status = 'na_fila' then
    if new.scheduled_date is null or new.deleted_at is not null then
      -- Tirou a data ou mandou pra lixeira: sai da fila (não publica no escuro).
      new.auto_publish := false;
      new.publish_status := null;
    else
      new.publicar_em := public.instante_brasilia(new.scheduled_date, new.scheduled_time);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_ig_recalcular_publicar_em on public.posts;
create trigger trg_ig_recalcular_publicar_em
  before update of scheduled_date, scheduled_time, deleted_at on public.posts
  for each row execute function public.ig_recalcular_publicar_em();

-- ── 4. Números do Instagram ligam ao post publicado pelo Cria ─────────────
create or replace function public.ig_ligar_insight_ao_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.post_id is null and new.object_type = 'media' and new.object_id is not null then
    select p.id into new.post_id from public.posts p
     where p.ig_media_id = new.object_id and p.deleted_at is null limit 1;
  end if;
  return new;
end $$;

drop trigger if exists trg_ig_ligar_insight on public.social_insights;
create trigger trg_ig_ligar_insight
  before insert or update on public.social_insights
  for each row execute function public.ig_ligar_insight_ao_post();

-- ── 5. Robô da fila (a cada minuto) ───────────────────────────────────────
do $$
begin
  perform cron.unschedule('cria-ig-publicar-fila');
exception when others then null;
end $$;
select cron.schedule('cria-ig-publicar-fila', '* * * * *', $c$
  select net.http_post(
    url := 'https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/instagram-publish',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'internal_push_secret' limit 1)),
    body := '{"fila": true}'::jsonb)
  -- Só chama a função quando tem post vencido: sem isso seriam 1.440
  -- chamadas por dia à toa.
  where exists (
    select 1 from public.posts
     where auto_publish and publish_status = 'na_fila'
       and publicar_em <= now() and deleted_at is null);
$c$);

notify pgrst, 'reload schema';
