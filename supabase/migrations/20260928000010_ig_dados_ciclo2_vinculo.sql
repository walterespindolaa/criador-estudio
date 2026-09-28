-- ═══════════════════════════════════════════════════════════════════════════
-- DADOS DO INSTAGRAM · CICLO 2 · LIGAR POST PLANEJADO ↔ POST PUBLICADO (28/09/2026)
--
-- Por que: a análise por pilar, gancho e linha editorial só existe pros posts
-- que estão ligados à publicação do Instagram. Até hoje isso era 100% manual,
-- um por um, e quase ninguém fazia. Resultado: análise vazia.
--
-- O que muda:
--   1. Nota de "parece o mesmo post" (data, formato e legenda) numa função só.
--   2. Liga SOZINHO quando é certeza: publicado pelo Cria (ig_media_id) ou a
--      legenda é praticamente a mesma (e a data bate).
--   3. O resto vira SUGESTÃO na tela, com confirmar em um toque.
--   4. Ligou (de qualquer jeito): os números do Instagram entram no próprio
--      post (result_*) e se atualizam a cada coleta.
--   5. Passa a régua no histórico que já existe.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pg_trgm with schema extensions;

-- Sugestão recusada ("não é esse") não volta a aparecer.
create table if not exists public.ig_vinculo_recusado (
  insight_id uuid not null references public.social_insights(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (insight_id, post_id)
);
alter table public.ig_vinculo_recusado enable row level security;
revoke all on public.ig_vinculo_recusado from anon, authenticated;

-- ── Formato do Cria ↔ tipo do Instagram ───────────────────────────────────
create or replace function public.ig_formato_compativel(_formato text, _media_type text)
returns int language sql immutable as $$
  -- 1 = combina, 0 = não dá pra saber, -1 = não combina
  select case
    when _formato is null or _media_type is null then 0
    when lower(_formato) in ('reels', 'video', 'shorts') then case when _media_type in ('REELS', 'VIDEO') then 1 else -1 end
    when lower(_formato) = 'carrossel' then case when _media_type = 'CAROUSEL_ALBUM' then 1 else -1 end
    when lower(_formato) = 'foto' then case when _media_type = 'IMAGE' then 1 else -1 end
    else 0
  end
$$;

-- Legenda "limpa" pra comparar: minúscula, sem hashtags/menções, só o começo.
create or replace function public.ig_legenda_base(_t text)
returns text language sql immutable as $$
  select left(btrim(regexp_replace(regexp_replace(lower(coalesce(_t, '')), '[#@][^\s]+', ' ', 'g'), '\s+', ' ', 'g')), 400)
$$;

-- ── Nota de semelhança (0 a 115) ──────────────────────────────────────────
create or replace function public.ig_nota_vinculo(
  _p_data date, _p_formato text, _p_legenda text,
  _i_postado timestamptz, _i_tipo text, _i_legenda text
) returns table (nota numeric, sim_legenda numeric, dias int)
language plpgsql stable set search_path = public, extensions as $$
declare
  _d int := null;
  _f int := public.ig_formato_compativel(_p_formato, _i_tipo);
  _a text := public.ig_legenda_base(_p_legenda);
  _b text := public.ig_legenda_base(_i_legenda);
  _s numeric := 0;
begin
  if _p_data is not null and _i_postado is not null then
    _d := abs(_p_data - (_i_postado at time zone 'America/Sao_Paulo')::date);
  end if;
  if length(_a) >= 20 and length(_b) >= 20 then
    -- Sem schema na frente: o pg_trgm pode estar em public ou em extensions.
    _s := similarity(_a, _b);
  end if;
  return query select
    (case when _d is null then 0 when _d = 0 then 40 when _d = 1 then 25 when _d = 2 then 10 else -20 end)
    + (case _f when 1 then 25 when -1 then -40 else 0 end)
    + round(_s * 50, 1),
    round(_s, 2), _d;
end $$;

-- Busca pelo id da mídia publicada pelo Cria sem varrer a tabela de posts.
create index if not exists idx_posts_ig_media_id on public.posts (ig_media_id) where ig_media_id is not null;

-- ── Posts do Cria que podem ser "este" post do Instagram ──────────────────
-- Três jeitos de a conta estar ligada (os mesmos do publicar):
--   conta própria: posts do dono sem cliente;
--   Instagram do cliente conectado pela agência (crm_client_id): posts do
--     Cria Post daquele cliente;
--   cliente com Cria próprio: posts do Cria Post dos clientes da agência que
--     apontam pra essa conta (cria_owner_id).
-- _perto: data da publicação; só entram posts com data até 3 dias de
-- distância (ou sem data). Sem essa janela, cada mídia comparava a legenda com
-- TODOS os posts da conta (lento e com sugestão sem sentido).
create or replace function public.ig_posts_candidatos(_conta uuid, _crm uuid, _perto timestamptz default null)
returns setof public.posts language sql stable security definer set search_path = public as $$
  with base as (
    select p.* from public.posts p
     where _crm is null and p.user_id = _conta and p.external_client_id is null
    union all
    select p.* from public.posts p
     where _crm is not null and p.external_client_id in (
             select ec.id from public.external_clients ec where ec.crm_client_id = _crm)
    union all
    select p.* from public.posts p
     where _crm is null and p.external_client_id in (
             select ec.id from public.external_clients ec
               join public.crm_clients cc on cc.id = ec.crm_client_id
              where cc.cria_owner_id = _conta)
  )
  select b.* from base b
   where b.deleted_at is null
     and (_perto is null or b.scheduled_date is null
          or b.scheduled_date between (_perto at time zone 'America/Sao_Paulo')::date - 3
                                  and (_perto at time zone 'America/Sao_Paulo')::date + 3)
     and not exists (select 1 from public.social_insights s where s.post_id = b.id)
$$;
revoke all on function public.ig_posts_candidatos(uuid, uuid, timestamptz) from public, anon, authenticated;

-- ── 2. Liga sozinho quando é certeza ──────────────────────────────────────
create or replace function public.ig_ligar_insight_ao_post()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare _alvo uuid;
begin
  -- Alguém DESLIGOU de propósito (tirou o vínculo): respeita e anota como
  -- recusado, senão a próxima coleta ligaria de novo sozinha.
  if tg_op = 'UPDATE' and old.post_id is not null then
    if new.post_id is null then
      insert into public.ig_vinculo_recusado (insight_id, post_id) values (new.id, old.post_id) on conflict do nothing;
    end if;
    return new;
  end if;
  if new.post_id is not null or new.object_type <> 'media' or new.object_id is null then
    return new;
  end if;
  -- Coleta regravando uma mídia que já existe (upsert): quem decide é o
  -- UPDATE que vem em seguida; aqui não gasta busca à toa.
  if tg_op = 'INSERT' and exists (
    select 1 from public.social_insights x
     where x.user_id = new.user_id and x.provider = new.provider and x.object_type = new.object_type
       and x.object_id = new.object_id and x.crm_client_id is not distinct from new.crm_client_id) then
    return new;
  end if;

  -- a) Publicado pelo Cria: o id da mídia está no post.
  select p.id into _alvo from public.posts p
   where p.ig_media_id = new.object_id and p.deleted_at is null
     and not exists (select 1 from public.ig_vinculo_recusado r where r.insight_id = new.id and r.post_id = p.id)
   limit 1;

  -- b) Legenda praticamente igual e data perto: é o mesmo post.
  if _alvo is null then
    select c.id into _alvo
      from public.ig_posts_candidatos(new.user_id, new.crm_client_id, new.posted_at) c
      cross join lateral public.ig_nota_vinculo(c.scheduled_date, c.format, c.caption, new.posted_at, new.media_type, new.caption) n
     where n.sim_legenda >= 0.6
       and public.ig_formato_compativel(c.format, new.media_type) >= 0
       and not exists (select 1 from public.ig_vinculo_recusado r where r.insight_id = new.id and r.post_id = c.id)
     order by n.nota desc
     limit 1;
  end if;
  if _alvo is not null then new.post_id := _alvo; end if;
  return new;
end $$;

drop trigger if exists trg_ig_ligar_insight on public.social_insights;
create trigger trg_ig_ligar_insight
  before insert or update on public.social_insights
  for each row execute function public.ig_ligar_insight_ao_post();

-- ── 4. Números do Instagram entram no post ligado ─────────────────────────
-- Métrica que não veio nesta coleta (limite da Meta) mantém o valor que o
-- post já tinha. E só grava quando algum número mudou, pra não mexer no post
-- a cada coleta à toa.
create or replace function public.ig_copiar_resultado_pro_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.metrics, '{}'::jsonb);
  _reach int := nullif(m->>'reach', '')::numeric::int;
  _views int := coalesce(nullif(m->>'views', '')::numeric, nullif(m->>'plays', '')::numeric)::int;
  _com int := nullif(m->>'comments', '')::numeric::int;
  _saves int := coalesce(nullif(m->>'saved', '')::numeric, nullif(m->>'saves', '')::numeric)::int;
  _shares int := nullif(m->>'shares', '')::numeric::int;
begin
  if new.post_id is null or new.object_type <> 'media' then return new; end if;
  update public.posts p set
    result_reach = coalesce(_reach, p.result_reach),
    result_views = coalesce(_views, p.result_views),
    result_comments = coalesce(_com, p.result_comments),
    result_saves = coalesce(_saves, p.result_saves),
    result_shares = coalesce(_shares, p.result_shares)
   where p.id = new.post_id
     and (p.result_reach, p.result_views, p.result_comments, p.result_saves, p.result_shares)
         is distinct from
         (coalesce(_reach, p.result_reach), coalesce(_views, p.result_views), coalesce(_com, p.result_comments),
          coalesce(_saves, p.result_saves), coalesce(_shares, p.result_shares));
  return new;
end $$;

drop trigger if exists trg_ig_copiar_resultado on public.social_insights;
create trigger trg_ig_copiar_resultado
  after insert or update of post_id, metrics on public.social_insights
  for each row execute function public.ig_copiar_resultado_pro_post();

-- ── 3. Sugestões pra tela (confirmar com um toque) ────────────────────────
-- _conta: dono dos dados (user_id das mídias); _crm: cliente (conexão feita
-- pela agência). Devolve no máximo uma sugestão por mídia e por post, as
-- melhores primeiro.
create or replace function public.ig_sugestoes_vinculo(_conta uuid, _crm uuid default null)
returns table (
  insight_id uuid, media_type text, caption text, thumbnail_url text, posted_at timestamptz,
  post_id uuid, post_title text, post_format text, post_date date, nota numeric, motivo text
) language plpgsql stable security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  _usados_post uuid[] := '{}';
  _usados_ins uuid[] := '{}';
  r record;
begin
  if not (public.acts_for(_conta) or public.manager_owns_cria_client(_conta)
          or (_crm is not null and exists (select 1 from public.crm_clients cc where cc.id = _crm and public.acts_for(cc.manager_id)))) then
    raise exception 'sem permissão';
  end if;

  for r in
    select i.id as iid, i.media_type as itipo, i.caption as ileg, i.thumbnail_url as ithumb, i.posted_at as ipost,
           c.id as pid, c.title as ptit, c.format as pfmt, c.scheduled_date as pdata,
           n.nota as pnota, n.sim_legenda as psim, n.dias as pdias
      from public.social_insights i
      cross join lateral public.ig_posts_candidatos(_conta, _crm, i.posted_at) c
      cross join lateral public.ig_nota_vinculo(c.scheduled_date, c.format, c.caption, i.posted_at, i.media_type, i.caption) n
     where i.user_id = _conta and i.provider = 'instagram' and i.object_type = 'media'
       and i.post_id is null
       and (_crm is null and i.crm_client_id is null or i.crm_client_id = _crm)
       and i.posted_at > now() - interval '180 days'
       and n.nota >= 50
       and not exists (select 1 from public.ig_vinculo_recusado x where x.insight_id = i.id and x.post_id = c.id)
     order by n.nota desc
  loop
    continue when r.iid = any(_usados_ins) or r.pid = any(_usados_post);
    _usados_ins := _usados_ins || r.iid;
    _usados_post := _usados_post || r.pid;
    insight_id := r.iid; media_type := r.itipo; caption := r.ileg; thumbnail_url := r.ithumb; posted_at := r.ipost;
    post_id := r.pid; post_title := r.ptit; post_format := r.pfmt; post_date := r.pdata; nota := r.pnota;
    motivo := concat_ws(' · ',
      case when r.pdias = 0 then 'mesmo dia' when r.pdias is not null and r.pdias <= 2 then r.pdias || ' dia(s) de diferença' end,
      case when public.ig_formato_compativel(r.pfmt, r.itipo) = 1 then 'mesmo formato' end,
      case when r.psim >= 0.3 then 'legenda parecida' end);
    return next;
    exit when array_length(_usados_ins, 1) >= 30;
  end loop;
end $$;
revoke all on function public.ig_sugestoes_vinculo(uuid, uuid) from public, anon;
grant execute on function public.ig_sugestoes_vinculo(uuid, uuid) to authenticated;

-- Confirmar (ligar) ou recusar uma sugestão.
create or replace function public.ig_decidir_vinculo(_insight_id uuid, _post_id uuid, _aceitar boolean)
returns void language plpgsql security definer set search_path = public as $$
declare _i record; _p record;
begin
  select id, user_id, crm_client_id, post_id into _i from public.social_insights where id = _insight_id;
  select id, user_id into _p from public.posts where id = _post_id and deleted_at is null;
  if _i.id is null or _p.id is null then raise exception 'não encontrado'; end if;
  -- Pode quem opera o post E enxerga a publicação: dono/equipe da conta, a
  -- agência do cliente (mesmo quando foi um membro que conectou o Instagram)
  -- ou a agência de um cliente com Cria próprio.
  if not (public.acts_for(_p.user_id) and (
       public.acts_for(_i.user_id)
       or public.manager_owns_cria_client(_i.user_id)
       or (_i.crm_client_id is not null and exists (
             select 1 from public.crm_clients cc where cc.id = _i.crm_client_id and public.acts_for(cc.manager_id))))) then
    raise exception 'sem permissão';
  end if;
  if _aceitar then
    -- Um post liga a uma publicação só: solta o vínculo antigo, se houver.
    update public.social_insights set post_id = null where post_id = _post_id and id <> _insight_id;
    update public.social_insights set post_id = _post_id where id = _insight_id;
  else
    insert into public.ig_vinculo_recusado (insight_id, post_id) values (_insight_id, _post_id) on conflict do nothing;
  end if;
end $$;
revoke all on function public.ig_decidir_vinculo(uuid, uuid, boolean) from public, anon;
grant execute on function public.ig_decidir_vinculo(uuid, uuid, boolean) to authenticated;

-- ── 5. Régua no histórico ─────────────────────────────────────────────────
-- Passa o gatilho de ligar em quem ainda está solto (últimos 180 dias) e
-- copia os números pros posts que já estavam ligados.
-- 90 dias: é o que a análise usa, e mantém a migração rápida.
update public.social_insights set post_id = null
 where object_type = 'media' and post_id is null and posted_at > now() - interval '90 days';
update public.social_insights set metrics = metrics
 where object_type = 'media' and post_id is not null;

notify pgrst, 'reload schema';

-- Conferência: quantos posts estão ligados agora.
select count(*) filter (where post_id is not null) as ligados, count(*) as publicacoes
  from public.social_insights where object_type = 'media' and posted_at > now() - interval '180 days';
