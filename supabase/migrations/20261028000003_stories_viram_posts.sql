-- ═══════════════════════════════════════════════════════════════════════════
-- CRIA STORIES LIGADO AO CRIANDO, PROMPTER E PUBLICAR (28/10/2026, mockup aprovado)
--
-- Antes: o plano de stories (story_slots) vivia sozinho. Nenhum dos 92 slots
-- foi marcado como feito; o plano não chegava no Criando, no Prompter nem na
-- publicação. Agora (Walter: "todo story do plano vira post de formato Story"):
--   1. cada story do plano ganha um post de formato Story (story_slots.post_id);
--      story falado já nasce em Produzindo, então aparece no Prompter em
--      "Pra gravar"; os outros nascem em Planejamento;
--   2. título, roteiro, dia e hora andam juntos nos dois sentidos;
--   3. story com figurinha (enquete, caixinha, quiz, contagem, link, DM) é
--      marcado "pelo celular": a API do Instagram não publica figurinha. O
--      lembrete do horário já vem ligado;
--   4. publicou (pelo Cria ou marcou "Já postei"): o story fica feito;
--   5. apagou o story do plano (ou gerou o plano de novo): o post vai pra
--      lixeira, a não ser que já tenha sido publicado.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.story_slots
  add column if not exists post_id uuid references public.posts(id) on delete set null;
create index if not exists story_slots_post_id_idx on public.story_slots(post_id);

-- Tipo do story pelo formato que a IA (ou a pessoa) escreveu.
create or replace function public.story_tem_figurinha(_formato text)
returns boolean language sql immutable as $$
  select coalesce(lower(_formato), '') ~ '(enquete|caixinha|quiz|contagem|sticker|figurinha|link|dm|pergunta|teste|votac)';
$$;

create or replace function public.story_falado(_formato text)
returns boolean language sql immutable as $$
  select not public.story_tem_figurinha(_formato)
     and coalesce(lower(_formato), '') ~ '(talking|bastidor|tutorial|pov|video|sequencia|depoimento|vlog|rotina)';
$$;

-- ── 1. Story novo no plano → post de formato Story ────────────────────────
create or replace function public.story_slot_cria_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _post uuid;
  _fig boolean := public.story_tem_figurinha(new.format);
begin
  if new.post_id is not null then return new; end if;
  insert into public.posts (user_id, title, format, platform, script, scheduled_date, scheduled_time, status, ig_opcoes)
  values (
    new.user_id,
    coalesce(nullif(btrim(new.title), ''), 'Story'),
    'story', 'instagram', new.script, new.slot_date,
    case when new.slot_time is not null then to_char(new.slot_time, 'HH24:MI') end,
    case when public.story_falado(new.format) then 'gravando' else 'roteiro' end,
    case when _fig then jsonb_build_object('pelo_celular', true) else '{}'::jsonb end
  ) returning id into _post;
  update public.story_slots
     set post_id = _post,
         -- Figurinha sai pelo celular: o lembrete do horário já vem ligado.
         notify_title = case when _fig and notify_title is null then left('Hora do story: ' || coalesce(new.title, ''), 160) else notify_title end,
         notify_body = case when _fig and notify_body is null
                            then 'Este story tem figurinha: poste pelo app do Instagram. A mídia e o texto estão no Cria Stories.'
                            else notify_body end
   where id = new.id;
  return new;
end $$;

create or replace trigger trg_story_slot_cria_post
  after insert on public.story_slots
  for each row execute function public.story_slot_cria_post();

-- ── 2a. Mudou no plano → muda no post ────────────────────────────────────
create or replace function public.story_slot_sincroniza_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or new.post_id is null then return new; end if;
  if new.title is distinct from old.title or new.script is distinct from old.script
     or new.slot_date is distinct from old.slot_date or new.slot_time is distinct from old.slot_time then
    update public.posts
       set title = coalesce(nullif(btrim(new.title), ''), title),
           script = new.script,
           scheduled_date = new.slot_date,
           scheduled_time = case when new.slot_time is not null then to_char(new.slot_time, 'HH24:MI') else scheduled_time end
     where id = new.post_id;
  end if;
  if new.format is distinct from old.format then
    update public.posts
       set ig_opcoes = case when public.story_tem_figurinha(new.format)
                            then coalesce(ig_opcoes, '{}'::jsonb) || jsonb_build_object('pelo_celular', true)
                            else coalesce(ig_opcoes, '{}'::jsonb) - 'pelo_celular' end
     where id = new.post_id;
  end if;
  return new;
end $$;

create or replace trigger trg_story_slot_sincroniza_post
  after update on public.story_slots
  for each row execute function public.story_slot_sincroniza_post();

-- ── 2b. Mudou no post (Criando, editor) → muda no plano; publicou → feito ──
create or replace function public.post_sincroniza_story_slot()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _publicado boolean := new.status = 'publicado' or new.publish_status = 'publicado';
begin
  if pg_trigger_depth() > 1 or coalesce(new.format, '') not in ('story', 'stories') then return new; end if;
  update public.story_slots s
     set title = new.title,
         script = new.script,
         slot_date = coalesce(new.scheduled_date, s.slot_date),
         slot_time = case when new.scheduled_time ~ '^\d{1,2}:\d{2}' then new.scheduled_time::time else s.slot_time end,
         status = case when _publicado then 'feito' else s.status end,
         updated_at = now()
   where s.post_id = new.id
     and (s.title is distinct from new.title or s.script is distinct from new.script
          or s.slot_date is distinct from coalesce(new.scheduled_date, s.slot_date)
          or (new.scheduled_time ~ '^\d{1,2}:\d{2}' and s.slot_time is distinct from new.scheduled_time::time)
          or (_publicado and s.status <> 'feito'));
  return new;
end $$;

create or replace trigger trg_post_sincroniza_story_slot
  after update of title, script, scheduled_date, scheduled_time, status, publish_status on public.posts
  for each row execute function public.post_sincroniza_story_slot();

-- ── 5. Apagou do plano → post vai pra lixeira (se ainda não saiu) ─────────
create or replace function public.story_slot_apaga_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.post_id is not null then
    update public.posts
       set deleted_at = now()
     where id = old.post_id and deleted_at is null
       and coalesce(status, '') <> 'publicado' and coalesce(publish_status, '') not in ('publicado', 'publicando');
  end if;
  return old;
end $$;

create or replace trigger trg_story_slot_apaga_post
  after delete on public.story_slots
  for each row execute function public.story_slot_apaga_post();

-- ── Backfill: stories de hoje em diante ganham o post ─────────────────────
do $$
declare _s record;
begin
  for _s in select * from public.story_slots where post_id is null and slot_date >= (now() at time zone 'America/Sao_Paulo')::date loop
    -- o trigger de insert não roda em linha antiga: repete a lógica aqui
    declare _post uuid; _fig boolean := public.story_tem_figurinha(_s.format);
    begin
      insert into public.posts (user_id, title, format, platform, script, scheduled_date, scheduled_time, status, ig_opcoes)
      values (_s.user_id, coalesce(nullif(btrim(_s.title), ''), 'Story'), 'story', 'instagram', _s.script, _s.slot_date,
              case when _s.slot_time is not null then to_char(_s.slot_time, 'HH24:MI') end,
              case when public.story_falado(_s.format) then 'gravando' else 'roteiro' end,
              case when _fig then jsonb_build_object('pelo_celular', true) else '{}'::jsonb end)
      returning id into _post;
      update public.story_slots
         set post_id = _post,
             notify_title = case when _fig and notify_title is null then left('Hora do story: ' || coalesce(_s.title, ''), 160) else notify_title end,
             notify_body = case when _fig and notify_body is null
                                then 'Este story tem figurinha: poste pelo app do Instagram. A mídia e o texto estão no Cria Stories.'
                                else notify_body end
       where id = _s.id;
    end;
  end loop;
end $$;

-- ── Opções do Instagram: chave nova "pelo_celular" (figurinha) ────────────
do $$
declare _def text;
begin
  _def := pg_get_functiondef('public.ig_salvar_opcoes(uuid, jsonb)'::regprocedure);
  if position('pelo_celular' in _def) = 0 then
    _def := replace(_def,
      $a$  update public.posts set ig_opcoes = _limpo where id = _post_id;$a$,
      $b$  if jsonb_typeof(_o->'pelo_celular') = 'boolean' then
    _limpo := _limpo || jsonb_build_object('pelo_celular', (_o->>'pelo_celular')::boolean);
  end if;
  update public.posts set ig_opcoes = _limpo where id = _post_id;$b$);
    execute _def;
  end if;
end $$;
