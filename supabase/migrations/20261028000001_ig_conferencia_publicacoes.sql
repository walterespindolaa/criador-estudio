-- ═══════════════════════════════════════════════════════════════════════════
-- PUBLICAÇÕES DO CRIA POST: CONFERÊNCIA FINAL (28/10/2026)
--
-- Walter, 28/10: "Precisa só ter uma confirmação final do social media pra
-- verificar se o cliente está 100% correto" e "sem utilizar a aprovação, se
-- ela quiser só abrir e postar algo fica certinho".
--
-- 1. Post de cliente aprovado e com data aparece sozinho em Publicações como
--    "Falta conferir" (derivado na tela: aprovado + data + sem publish_status).
--    Só entra na fila de publicar depois da conferência (ig_conferir_publicacao).
-- 2. Publicar sem aprovação do cliente: mesma conferência, com motivo
--    obrigatório; fica gravado quem liberou e quando. Substitui a regra de
--    28/09 ("Cria Post só depois de aprovado") para quem conferir com motivo.
-- 3. O cliente pediu alteração depois da conferência: o post sai da fila
--    (exceto quando foi liberado sem aprovação de propósito).
-- 4. Opções do Instagram por post (collab, marcação, texto alternativo, Reels
--    de teste, mostrar no feed, música pelo celular) em ig_opcoes.
-- 5. Aviso da Meta depois de publicar (config_issue: legenda ou marcação que
--    não entrou) em publish_aviso.
-- 6. Lembrete: falta 2 h e ninguém conferiu = aviso no sino (robô a cada 15 min).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.posts
  add column if not exists publish_conferido_por uuid,
  add column if not exists publish_conferido_em timestamptz,
  add column if not exists publish_sem_aprovacao_motivo text,
  add column if not exists publish_aviso text,
  add column if not exists publish_lembrete_em timestamptz,
  add column if not exists ig_opcoes jsonb not null default '{}'::jsonb;

-- ── Conferir (e liberar) a publicação ──────────────────────────────────────
-- _motivo: só quando o cliente ainda não aprovou ("publicar sem aprovação").
-- _agora:  publicar já (o robô pega no próximo minuto) em vez de no horário.
create or replace function public.ig_conferir_publicacao(_post_id uuid, _motivo text default null, _agora boolean default false)
returns table (publish_status text, publicar_em timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  _p record;
  _c record;
  _quando timestamptz;
  _aprovado boolean;
  _mot text := nullif(btrim(coalesce(_motivo, '')), '');
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;

  -- Mesma regra de quem pode publicar (dono, equipe ou agência; parceiro não).
  select * into _c from public.ig_conexao_do_post(_post_id) limit 1;

  select id, external_client_id, approval_status, scheduled_date, scheduled_time,
         posts.publish_status as st
    into _p from public.posts where id = _post_id and deleted_at is null;
  if _p.id is null then raise exception 'post não encontrado'; end if;

  if _p.st in ('publicando', 'publicado') then
    raise exception 'Este post já foi (ou está sendo) publicado.';
  end if;
  if coalesce(_p.approval_status, '') = 'postado' then
    raise exception 'Este post já foi marcado como postado.';
  end if;
  if not coalesce(_c.pode_publicar, false) then
    raise exception '%', coalesce(_c.motivo, 'O Instagram deste perfil não pode publicar pelo Cria.');
  end if;

  _aprovado := _p.external_client_id is null or coalesce(_p.approval_status, '') = 'aprovado';
  if not _aprovado and _mot is null then
    raise exception 'O cliente ainda não aprovou este post. Pra publicar mesmo assim, diga o motivo.';
  end if;

  if _agora then
    _quando := now();
  else
    if _p.scheduled_date is null then
      raise exception 'Defina a data do post antes de agendar.';
    end if;
    _quando := public.instante_brasilia(_p.scheduled_date, _p.scheduled_time);
    if _quando < now() - interval '2 minutes' then
      raise exception 'A data e hora deste post já passaram. Ajuste a data ou publique agora.';
    end if;
  end if;

  update public.posts
     set auto_publish = true, publish_status = 'na_fila', publicar_em = _quando,
         publish_error = null, publish_aviso = null, publish_attempts = 0, publish_by = auth.uid(),
         publish_conferido_por = auth.uid(), publish_conferido_em = now(),
         publish_sem_aprovacao_motivo = case when _aprovado then null else left(_mot, 200) end,
         status = case when posts.external_client_id is null then 'agendado' else posts.status end
   where id = _post_id;
  return query select 'na_fila'::text, _quando;
end $$;
revoke all on function public.ig_conferir_publicacao(uuid, text, boolean) from public, anon;
grant execute on function public.ig_conferir_publicacao(uuid, text, boolean) to authenticated;

-- ── Desfazer a conferência (tira da fila, volta pra "Falta conferir") ──────
create or replace function public.ig_desfazer_conferencia(_post_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  perform 1 from public.ig_conexao_do_post(_post_id);  -- levanta pra estranho
  update public.posts
     set auto_publish = false,
         publish_status = case when posts.publish_status in ('na_fila', 'erro') then null else posts.publish_status end,
         publish_conferido_por = null, publish_conferido_em = null, publish_sem_aprovacao_motivo = null,
         status = case when posts.external_client_id is null and posts.status = 'agendado' then 'editando' else posts.status end
   where id = _post_id and coalesce(posts.publish_status, '') not in ('publicando', 'publicado');
end $$;
revoke all on function public.ig_desfazer_conferencia(uuid) from public, anon;
grant execute on function public.ig_desfazer_conferencia(uuid) to authenticated;

-- ── Opções do Instagram do post (collab, marcação, alt, teste...) ──────────
-- Grava só as chaves conhecidas; o resto é descartado.
create or replace function public.ig_salvar_opcoes(_post_id uuid, _opcoes jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _o jsonb := coalesce(_opcoes, '{}'::jsonb);
  _limpo jsonb := '{}'::jsonb;
  _collab jsonb;
  _tags jsonb;
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  perform 1 from public.ig_conexao_do_post(_post_id);

  select coalesce(jsonb_agg(v), '[]'::jsonb) into _collab from (
    select distinct lower(regexp_replace(btrim(x), '^@', '')) v
      from jsonb_array_elements_text(case when jsonb_typeof(_o->'collaborators') = 'array' then _o->'collaborators' else '[]'::jsonb end) x
     where regexp_replace(btrim(x), '^@', '') ~ '^[A-Za-z0-9._]{1,30}$'
  ) s;
  if jsonb_array_length(_collab) > 3 then raise exception 'Collab aceita até 3 perfis.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'username', lower(regexp_replace(btrim(t->>'username'), '^@', '')),
           'x', least(1, greatest(0, coalesce((t->>'x')::numeric, 0.5))),
           'y', least(1, greatest(0, coalesce((t->>'y')::numeric, 0.5))))), '[]'::jsonb)
    into _tags
    from jsonb_array_elements(case when jsonb_typeof(_o->'user_tags') = 'array' then _o->'user_tags' else '[]'::jsonb end) t
   where regexp_replace(btrim(coalesce(t->>'username', '')), '^@', '') ~ '^[A-Za-z0-9._]{1,30}$';
  if jsonb_array_length(_tags) > 20 then raise exception 'Dá pra marcar até 20 pessoas.'; end if;

  _limpo := jsonb_build_object('collaborators', _collab, 'user_tags', _tags);
  if nullif(btrim(coalesce(_o->>'alt_text', '')), '') is not null then
    _limpo := _limpo || jsonb_build_object('alt_text', left(btrim(_o->>'alt_text'), 1000));
  end if;
  if _o->>'trial' in ('MANUAL', 'SS_PERFORMANCE') then
    _limpo := _limpo || jsonb_build_object('trial', _o->>'trial');
  end if;
  if jsonb_typeof(_o->'share_to_feed') = 'boolean' then
    _limpo := _limpo || jsonb_build_object('share_to_feed', (_o->>'share_to_feed')::boolean);
  end if;
  if jsonb_typeof(_o->'musica_celular') = 'boolean' then
    _limpo := _limpo || jsonb_build_object('musica_celular', (_o->>'musica_celular')::boolean);
  end if;

  update public.posts set ig_opcoes = _limpo where id = _post_id;
  return _limpo;
end $$;
revoke all on function public.ig_salvar_opcoes(uuid, jsonb) from public, anon;
grant execute on function public.ig_salvar_opcoes(uuid, jsonb) to authenticated;

-- ── Cliente pediu alteração depois da conferência: sai da fila ─────────────
create or replace function public.ig_aprovacao_mudou()
returns trigger language plpgsql as $$
begin
  if new.external_client_id is not null
     and new.approval_status is distinct from old.approval_status
     and coalesce(new.approval_status, '') not in ('aprovado', 'postado')
     and new.publish_status = 'na_fila'
     and new.publish_sem_aprovacao_motivo is null then
    new.auto_publish := false;
    new.publish_status := null;
    new.publish_conferido_por := null;
    new.publish_conferido_em := null;
  end if;
  return new;
end $$;

create or replace trigger trg_ig_aprovacao_mudou
  before update of approval_status on public.posts
  for each row execute function public.ig_aprovacao_mudou();

-- ── Lembrete: falta 2 h e ninguém conferiu ─────────────────────────────────
create or replace function public.ig_lembrar_conferencia()
returns integer language plpgsql security definer set search_path = public as $$
declare
  _r record;
  _n integer := 0;
begin
  for _r in
    select p.id, p.user_id, p.agencia_id, p.title
      from public.posts p
     where p.deleted_at is null
       and p.external_client_id is not null
       and p.approval_status = 'aprovado'
       and p.publish_status is null
       and p.scheduled_date is not null
       and p.publish_lembrete_em is null
       and public.instante_brasilia(p.scheduled_date, p.scheduled_time) between now() and now() + interval '2 hours'
  loop
    -- Só lembra quando dá pra publicar pelo Cria (Instagram conectado com a
    -- permissão de publicar). Os outros saem pelo celular, como sempre.
    if not coalesce((select c.pode_publicar from public.ig_conexao_do_post(_r.id, _r.user_id) c limit 1), false) then
      continue;
    end if;
    -- Avisa quem opera (a agência, quando o post mora no Cria do cliente;
    -- senão o dono do post). O cliente não recebe esse aviso.
    insert into public.notifications (user_id, type, title, description, link, read)
    values (coalesce(_r.agencia_id, _r.user_id), 'publicacao_instagram', 'Falta conferir um post',
           '"' || left(coalesce(_r.title, 'Post'), 60) || '" sai em menos de 2 horas e ninguém conferiu. Sem conferência, não publica.',
           '/socialmidia/criapost/publicacoes', false);
    update public.posts set publish_lembrete_em = now() where id = _r.id;
    _n := _n + 1;
  end loop;
  return _n;
end $$;
revoke all on function public.ig_lembrar_conferencia() from public, anon, authenticated;

select cron.schedule('cria-ig-lembrar-conferencia', '*/15 * * * *', $c$ select public.ig_lembrar_conferencia(); $c$);

-- Mudou a data: o lembrete pode avisar de novo.
create or replace function public.ig_zerar_lembrete()
returns trigger language plpgsql as $$
begin
  if new.scheduled_date is distinct from old.scheduled_date or new.scheduled_time is distinct from old.scheduled_time then
    new.publish_lembrete_em := null;
  end if;
  return new;
end $$;

create or replace trigger trg_ig_zerar_lembrete
  before update of scheduled_date, scheduled_time on public.posts
  for each row execute function public.ig_zerar_lembrete();
