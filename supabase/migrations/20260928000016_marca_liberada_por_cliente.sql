-- ============================================================
-- O QUE O PARCEIRO VÊ, ESCOLHIDO POR CLIENTE (Walter, 28/09/2026)
--
-- "Tem como configurar quais informações vão ficar liberadas pro designer
-- por cliente, e sempre que for um post daquele cliente já liberar essas
-- informações? E no card do post ele ter isso de fácil acesso?"
--
-- Até aqui a regra era uma só pra todo cliente: o parceiro via o brandbook
-- inteiro. Tem cliente em que a social mídia não quer mostrar a oferta ou o
-- público; tem outro em que ela quer mostrar tudo. Agora é uma chave por
-- grupo de informação, guardada no cliente (crm_clients.compartilhar_parceiros)
-- e aplicada NO BANCO, em toda peça daquele cliente:
--
--   visual       paleta, fontes, expressão visual
--   tom          tom de voz, personalidade, estilo, arquétipo
--   publico      público e segmento
--   mensagem     ideia central, promessa, oferta, temas
--   evitar       o que evitar
--   hashtags
--   referencias  referências visuais da ficha
--   links        links úteis
--   pasta        pasta geral do cliente
--
-- Chave ausente = liberado (é o comportamento de antes, ninguém perde nada).
-- Nome, logo, cor e o recado fixo sempre vão: sem eles o parceiro não sabe de
-- quem é a peça, e o recado já é escrito pra ele.
--
-- PASTA GERAL AUTOMÁTICA: se a social mídia não preencheu a pasta geral, vale
-- o primeiro link de Drive/Dropbox dos Links úteis (o do cadastro do cliente).
--
-- O card passa a trazer `marca_liberada`, pra mostrar a marca DENTRO do card,
-- sem abrir outra tela.
--
-- Não mexe na RLS de posts. Idempotente.
-- ============================================================

alter table public.crm_clients
  add column if not exists compartilhar_parceiros jsonb not null default '{}'::jsonb;

comment on column public.crm_clients.compartilhar_parceiros is
  'O que os parceiros de produção veem deste cliente: {"visual":true,"mensagem":false,...}. Chave ausente = liberado.';

-- ── Helpers ───────────────────────────────────────────────────────────────
create or replace function public.parceiro_ve(_conf jsonb, _chave text)
returns boolean language sql immutable as $$
  select coalesce((coalesce(_conf, '{}'::jsonb) ->> _chave)::boolean, true)
$$;

/* A pasta que vale pra toda peça: a escolhida no Canal da marca, ou o primeiro
   link de Drive/Dropbox dos Links úteis. Só http(s). */
create or replace function public.pasta_geral_do_cliente(_cc public.crm_clients)
returns text language sql stable set search_path = public as $$
  select coalesce(
    case when nullif(btrim(_cc.pasta_parceiros), '') ~* '^https?://' then btrim(_cc.pasta_parceiros) end,
    (select btrim(l ->> 'url')
       from jsonb_array_elements(case when jsonb_typeof(_cc.useful_links) = 'array' then _cc.useful_links else '[]'::jsonb end) l
      where coalesce(l ->> 'url', '') ~* '^https?://'
        and (l ->> 'url') ~* '(drive\.google|dropbox|onedrive|sharepoint)'
      limit 1)
  )
$$;

/* Links que o parceiro recebe: os úteis liberados (só http) e, se a pasta
   estiver liberada e ainda não estiver na lista, a pasta geral em primeiro. */
create or replace function public.links_para_parceiro(_cc public.crm_clients)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  _conf jsonb := coalesce(_cc.compartilhar_parceiros, '{}'::jsonb);
  _links jsonb := '[]'::jsonb;
  _pasta text;
begin
  if public.parceiro_ve(_conf, 'links') and jsonb_typeof(_cc.useful_links) = 'array' then
    select coalesce(jsonb_agg(l), '[]'::jsonb) into _links
      from jsonb_array_elements(_cc.useful_links) l
     where coalesce(l ->> 'url', '') ~* '^https?://';
  end if;
  if public.parceiro_ve(_conf, 'pasta') then
    _pasta := public.pasta_geral_do_cliente(_cc);
    if _pasta is not null
       and not exists (select 1 from jsonb_array_elements(_links) l where btrim(l ->> 'url') = _pasta) then
      _links := jsonb_build_array(jsonb_build_object('label', 'Pasta geral do cliente', 'url', _pasta)) || _links;
    end if;
  end if;
  return _links;
end; $$;

/* A marca como o parceiro pode ver, já filtrada pela escolha da social mídia. */
create or replace function public.marca_para_parceiro(_cc public.crm_clients)
returns jsonb language sql stable set search_path = public as $$
  with k as (select coalesce(_cc.compartilhar_parceiros, '{}'::jsonb) as c)
  select jsonb_strip_nulls(jsonb_build_object(
    'paleta',             case when public.parceiro_ve(k.c, 'visual') then nullif(btrim(_cc.brand_core ->> 'colorPalette'), '') end,
    'fontes',             case when public.parceiro_ve(k.c, 'visual') then nullif(btrim(_cc.brand_core ->> 'typography'), '') end,
    'expressao_visual',   case when public.parceiro_ve(k.c, 'visual') then nullif(btrim(_cc.brand_core ->> 'visualExpression'), '') end,
    'tom_de_voz',         case when public.parceiro_ve(k.c, 'tom') then nullif(btrim(_cc.brand_core ->> 'toneOfVoice'), '') end,
    'personalidade',      case when public.parceiro_ve(k.c, 'tom') then nullif(btrim(_cc.brand_core ->> 'personality'), '') end,
    'estilo_comunicacao', case when public.parceiro_ve(k.c, 'tom') then nullif(btrim(_cc.brand_core ->> 'communicationStyle'), '') end,
    'arquetipo',          case when public.parceiro_ve(k.c, 'tom') then nullif(btrim(_cc.brand_core ->> 'archetype'), '') end,
    'publico',            case when public.parceiro_ve(k.c, 'publico') then nullif(btrim(_cc.brand_core ->> 'audience'), '') end,
    'segmento',           case when public.parceiro_ve(k.c, 'publico') then nullif(btrim(_cc.segment), '') end,
    'ideia_central',      case when public.parceiro_ve(k.c, 'mensagem') then nullif(btrim(_cc.brand_core ->> 'coreMessage'), '') end,
    'promessa',           case when public.parceiro_ve(k.c, 'mensagem') then nullif(btrim(_cc.brand_core ->> 'promise'), '') end,
    'oferta',             case when public.parceiro_ve(k.c, 'mensagem') then coalesce(nullif(btrim(_cc.brand_core ->> 'offer'), ''), nullif(btrim(_cc.brand_core ->> 'products'), '')) end,
    'temas',              case when public.parceiro_ve(k.c, 'mensagem') then nullif(btrim(_cc.brand_core ->> 'contentThemes'), '') end,
    'evitar',             case when public.parceiro_ve(k.c, 'evitar') then nullif(btrim(_cc.brand_core ->> 'avoid'), '') end,
    'hashtags',           case when public.parceiro_ve(k.c, 'hashtags') and coalesce(array_length(_cc.hashtags, 1), 0) > 0 then to_jsonb(_cc.hashtags) end,
    'referencias',        case when public.parceiro_ve(k.c, 'referencias') then (
                            select jsonb_agg(jsonb_build_object('url', r.image_url, 'nota', r.note) order by r.sort_order)
                              from public.crm_client_refs r where r.crm_client_id = _cc.id) end
  ))
  from k
$$;

revoke all on function public.pasta_geral_do_cliente(public.crm_clients) from public, anon;
revoke all on function public.links_para_parceiro(public.crm_clients) from public, anon;
revoke all on function public.marca_para_parceiro(public.crm_clients) from public, anon;

-- ── 1) A ficha da marca do parceiro respeita a escolha ────────────────────
-- Mesma assinatura de 20260928000014 (create or replace basta).
create or replace function public.parceiro_minhas_marcas()
returns table (
  external_client_id uuid,
  nome text,
  handle text,
  logo text,
  cor text,
  hashtags text[],
  agencia_id uuid,
  agencia_nome text,
  abertos integer,
  entregues_30d integer,
  paleta text,
  fontes text,
  expressao_visual text,
  tom_de_voz text,
  personalidade text,
  estilo_comunicacao text,
  arquetipo text,
  temas text,
  ideia_central text,
  promessa text,
  publico text,
  oferta text,
  evitar text,
  observacoes text,
  segmento text,
  links jsonb,
  referencias jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with minhas as (
    select distinct p.external_client_id, p.user_id as manager_id
    from public.posts p
    join public.manager_members m
      on m.manager_id = p.user_id
     and m.member_id = auth.uid()
     and m.status = 'ativo'
    where p.assignee_id = auth.uid()
      and p.external_client_id is not null
      and p.deleted_at is null
      and (
        coalesce(p.producao_status, 'aguardando') <> 'entregue'
        or coalesce(p.assigned_at, p.created_at) >= now() - interval '180 days'
      )
  )
  select
    ec.id,
    coalesce(nullif(btrim(cc.name), ''), ec.name, 'Cliente'),
    coalesce(ec.instagram_handle, cc.instagram),
    coalesce(cc.logo, ec.logo_url),
    coalesce(cc.color, ec.brand_color),
    case when public.parceiro_ve(k.c, 'hashtags') then cc.hashtags end,
    m.manager_id,
    coalesce(prof.name, 'Agência'),
    (select count(*)::int from public.posts p2
      where p2.external_client_id = ec.id and p2.assignee_id = auth.uid()
        and p2.deleted_at is null
        and coalesce(p2.producao_status, 'aguardando') <> 'entregue'),
    (select count(*)::int from public.posts p3
      where p3.external_client_id = ec.id and p3.assignee_id = auth.uid()
        and p3.deleted_at is null and p3.producao_status = 'entregue'
        and p3.updated_at >= now() - interval '30 days'),
    ml ->> 'paleta',
    ml ->> 'fontes',
    ml ->> 'expressao_visual',
    ml ->> 'tom_de_voz',
    ml ->> 'personalidade',
    ml ->> 'estilo_comunicacao',
    ml ->> 'arquetipo',
    ml ->> 'temas',
    ml ->> 'ideia_central',
    ml ->> 'promessa',
    ml ->> 'publico',
    ml ->> 'oferta',
    ml ->> 'evitar',
    -- O recado escrito PRO parceiro sempre vai. `cc.notes` continua fora.
    nullif(btrim(cc.recado_parceiros), ''),
    ml ->> 'segmento',
    case when cc.id is null then '[]'::jsonb else public.links_para_parceiro(cc) end,
    coalesce(ml -> 'referencias', '[]'::jsonb)
  from minhas m
  join public.external_clients ec on ec.id = m.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  left join public.profiles prof on prof.id = m.manager_id
  cross join lateral (select coalesce(cc.compartilhar_parceiros, '{}'::jsonb) as c) k
  cross join lateral (select case when cc.id is null then '{}'::jsonb else public.marca_para_parceiro(cc) end as ml) mm
  order by 9 desc, 2;
$$;

revoke all on function public.parceiro_minhas_marcas() from public, anon;
grant execute on function public.parceiro_minhas_marcas() to authenticated;

-- ── 2) O card: marca liberada dentro dele + canal filtrado ────────────────
-- Corpo de 20260928000014, trocando as chaves do canal e somando marca_liberada.
create or replace function public.parceiro_abrir_card(_post_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  _p public.posts;
  _cc public.crm_clients;
  _ec record;
  _coments jsonb;
  _midias jsonb;
  _agencia text;
  _versoes int;
  _conf jsonb;
  _links_uteis jsonb := '[]'::jsonb;
begin
  if not (
    public.parceiro_tem_o_card(_post_id)
    or exists (select 1 from public.posts p where p.id = _post_id and public.acts_for(p.user_id))
  ) then
    raise exception 'sem acesso a este card';
  end if;

  select * into _p from public.posts where id = _post_id;
  select name into _agencia from public.profiles where id = _p.user_id;
  select ec.name, ec.instagram_handle, ec.crm_client_id into _ec
    from public.external_clients ec where ec.id = _p.external_client_id;
  if _ec.crm_client_id is not null then
    select * into _cc from public.crm_clients where id = _ec.crm_client_id;
  end if;
  _conf := coalesce(_cc.compartilhar_parceiros, '{}'::jsonb);

  -- Links úteis liberados, só http(s). A pasta geral vai à parte (canal_pasta).
  if _cc.id is not null and public.parceiro_ve(_conf, 'links') and jsonb_typeof(_cc.useful_links) = 'array' then
    select coalesce(jsonb_agg(l), '[]'::jsonb) into _links_uteis
      from jsonb_array_elements(_cc.useful_links) l
     where coalesce(l ->> 'url', '') ~* '^https?://';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'texto', c.content, 'papel', c.author_role, 'em', c.created_at,
           'midia_indice', c.midia_indice, 'ancora_x', c.ancora_x,
           'ancora_y', c.ancora_y, 'ancora_seg', c.ancora_seg
         ) order by c.created_at), '[]'::jsonb)
    into _coments
    from public.post_approval_comments c
   where c.post_id = _post_id
     and (
       coalesce(c.author_role, '') in ('parceiro', 'social_media')
       or (c.ancora_x is not null
           and coalesce(c.author_role, '') in ('cliente_externo', 'cliente'))
     );

  select coalesce(jsonb_agg(jsonb_build_object(
           'url', coalesce(nullif(btrim(m.view_url), ''), m.thumbnail_url),
           'thumb', coalesce(nullif(btrim(m.thumbnail_url), ''), m.view_url),
           'nome', m.file_name,
           'tipo', m.file_type
         ) order by m.position asc nulls last, m.created_at asc), '[]'::jsonb)
    into _midias
    from public.external_media_refs m
   where m.post_id = _post_id and not m.substituida;

  select count(*)::int into _versoes
    from public.external_media_refs m where m.post_id = _post_id and m.entrega and m.substituida;

  return jsonb_build_object(
    'id', _p.id,
    'titulo', _p.title,
    'formato', _p.format,
    'plataforma', _p.platform,
    'gancho', _p.hook,
    'roteiro', _p.script,
    'legenda', _p.caption,
    'arte', _p.art,
    'blocos', _p.content_blocks,
    'notas', _p.notes,
    'pasta_drive', _p.drive_folder_url,
    'referencia', _p.reference_url,
    'etiquetas', _p.internal_tags,
    'producao_status', coalesce(_p.producao_status, 'aguardando'),
    'prazo_producao', _p.prazo_producao,
    'prazo_status', _p.prazo_status,
    'prazo_sugerido', _p.prazo_sugerido,
    'publica_em', _p.scheduled_date,
    'aprovacao', _p.approval_status,
    'cache', _p.cache_parceiro,
    'agencia', coalesce(_agencia, 'Agência'),
    'agencia_id', _p.user_id,
    'midias', _midias,
    'revisoes', coalesce(_p.revisoes, 0),
    'versoes_antigas', _versoes,
    'external_client_id', _p.external_client_id,
    'crm_client_id', _ec.crm_client_id,
    'canal_recado', nullif(btrim(_cc.recado_parceiros), ''),
    'canal_pasta', case when _cc.id is not null and public.parceiro_ve(_conf, 'pasta') then public.pasta_geral_do_cliente(_cc) end,
    'canal_links', _links_uteis,
    'marca_liberada', case when _cc.id is not null then public.marca_para_parceiro(_cc) else '{}'::jsonb end,
    'marca', jsonb_build_object(
      'nome', coalesce(_cc.name, _ec.name),
      'handle', _ec.instagram_handle,
      'cor', _cc.color,
      'logo', _cc.logo,
      'hashtags', case when public.parceiro_ve(_conf, 'hashtags') then _cc.hashtags end
    ),
    'comentarios', _coments);
end; $$;
revoke all on function public.parceiro_abrir_card(uuid) from public, anon;
grant execute on function public.parceiro_abrir_card(uuid) to authenticated;
