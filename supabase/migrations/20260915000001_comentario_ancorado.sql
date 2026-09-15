-- ═══════════════════════════════════════════════════════════════════════════
-- CIRCUITO 6: COMENTÁRIO ANCORADO (15/09/2026)
--
-- Hoje o cliente escreve "o logo ficou estranho" e o designer abre a arte
-- tentando adivinhar se é o tamanho, a cor, a posição ou o logo errado. Num
-- carrossel de seis slides ele ainda tem que descobrir de QUAL slide ela está
-- falando. Cada rodada dessas custa uma revisão inteira, e revisão de graça é
-- exatamente o que come a margem de quem produz.
--
-- Apontar resolve o que descrever não resolve. É o que Frame.io e Ziflow
-- cobram a partir de US$ 199/mês pra fazer, e é a coisa mais simples do mundo
-- de guardar: três números presos ao comentário.
--
--   midia_indice  qual peça do carrossel (0 = a primeira)
--   ancora_x/y    onde, em fração da largura e da altura (0 a 1)
--   ancora_seg    em que segundo, quando é vídeo
--
-- Fração, e não pixel, porque a mesma arte é vista no celular do cliente e no
-- monitor do designer: pixel de um não é pixel do outro. Comentário sem
-- alfinete continua existindo e é o padrão: nem todo recado é sobre um ponto.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) As colunas ─────────────────────────────────────────────────────────
alter table public.post_approval_comments add column if not exists midia_indice integer;
alter table public.post_approval_comments add column if not exists ancora_x numeric(5,4);
alter table public.post_approval_comments add column if not exists ancora_y numeric(5,4);
alter table public.post_approval_comments add column if not exists ancora_seg numeric(9,2);

comment on column public.post_approval_comments.midia_indice is
  'Índice da mídia no carrossel (0 = primeira). Nulo = comentário da peça inteira.';
comment on column public.post_approval_comments.ancora_x is
  'Posição horizontal do alfinete, de 0 a 1 (fração da largura, não pixel).';

/* Sanidade dos limites no banco, não só na tela: alfinete fora do quadro é
   alfinete invisível, e cliente anônimo chama RPC. `not valid` pra não
   reprovar linha antiga (todas têm os campos nulos, mas o custo é zero). */
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_ancora_no_quadro') then
    alter table public.post_approval_comments
      add constraint chk_ancora_no_quadro check (
        (ancora_x is null or (ancora_x >= 0 and ancora_x <= 1)) and
        (ancora_y is null or (ancora_y >= 0 and ancora_y <= 1)) and
        (ancora_seg is null or ancora_seg >= 0) and
        (midia_indice is null or midia_indice >= 0)
      ) not valid;
  end if;
end $$;

-- ── 2) O cliente aponta ao pedir ajuste ───────────────────────────────────
/* drop antes de criar: acrescentar parâmetro com default a uma função que já
   existe cria uma SEGUNDA função, e aí a chamada com 3 argumentos fica
   ambígua (erro 42725). Dropando, a chamada antiga de 3 argumentos passa a
   cair nesta aqui, com os alfinetes nulos. */
drop function if exists public.request_adjustment_by_token(text, uuid, text);
create function public.request_adjustment_by_token(
  _token text, _post_id uuid, _comment text,
  _midia_indice integer default null,
  _ancora_x numeric default null,
  _ancora_y numeric default null,
  _ancora_seg numeric default null
) returns void
language plpgsql security definer set search_path to 'public'
as $function$
declare v_manager uuid; v_client uuid;
begin
  if not public.token_allows_post(_token, _post_id) then raise exception 'fora do periodo'; end if;
  if coalesce(trim(_comment),'') = '' then raise exception 'comment_required'; end if;
  select t.manager_id, t.external_client_id into v_manager, v_client
  from public.approval_tokens t
  where t.token = _token and t.active = true
    and (t.expires_at is null or t.expires_at > now())
    and public.has_module('aprovapost_externo', t.manager_id);
  if v_manager is null then raise exception 'invalid_token'; end if;
  update public.posts
     set approval_status = 'ajuste_solicitado', approval_updated_at = now()
   where id = _post_id and external_client_id = v_client and user_id = v_manager;
  if not found then raise exception 'post_not_found'; end if;
  insert into public.post_approval_comments(
    post_id, author_id, author_role, content, midia_indice, ancora_x, ancora_y, ancora_seg)
  values (
    _post_id, null, 'cliente_externo', left(_comment, 2000),
    _midia_indice,
    -- Clamp aqui também: a constraint recusaria a linha e o cliente levaria
    -- um erro técnico por causa de um arredondamento de pixel.
    case when _ancora_x is null then null else least(1, greatest(0, _ancora_x)) end,
    case when _ancora_y is null then null else least(1, greatest(0, _ancora_y)) end,
    case when _ancora_seg is null then null else greatest(0, _ancora_seg) end);
end; $function$;
grant execute on function public.request_adjustment_by_token(text, uuid, text, integer, numeric, numeric, numeric) to anon, authenticated;

/* MAIS DE UM ALFINETE POR RODADA. Pedir ajuste muda o status da peça e é uma
   rodada só (por decisão de produto: revisão sem feedback consolidado vira
   pingado de áudio). Mas apontar TRÊS pontos da mesma arte é uma coisa só, não
   três rodadas. Esta RPC anexa um alfinete sem mexer no status: a tela junta
   os pontos e depois fecha a rodada com o request_adjustment. */
drop function if exists public.pin_comment_by_token(text, uuid, text, integer, numeric, numeric, numeric);
create function public.pin_comment_by_token(
  _token text, _post_id uuid, _comment text,
  _midia_indice integer default null,
  _ancora_x numeric default null,
  _ancora_y numeric default null,
  _ancora_seg numeric default null
) returns uuid
language plpgsql security definer set search_path to 'public'
as $function$
declare v_manager uuid; v_client uuid; v_id uuid; v_quantos int;
begin
  if not public.token_allows_post(_token, _post_id) then raise exception 'fora do periodo'; end if;
  if coalesce(trim(_comment),'') = '' then raise exception 'comment_required'; end if;
  select t.manager_id, t.external_client_id into v_manager, v_client
  from public.approval_tokens t
  where t.token = _token and t.active = true
    and (t.expires_at is null or t.expires_at > now())
    and public.has_module('aprovapost_externo', t.manager_id);
  if v_manager is null then raise exception 'invalid_token'; end if;
  -- O post tem que ser mesmo deste cliente e desta agência.
  if not exists (select 1 from public.posts p
                  where p.id = _post_id and p.external_client_id = v_client and p.user_id = v_manager)
  then raise exception 'post_not_found'; end if;

  /* Teto por peça: a RPC é pública e anônima. Sem limite, um robô enche a
     thread de um cliente com milhares de linhas. Vinte alfinetes numa arte já
     é muito mais do que qualquer revisão real precisa. */
  select count(*) into v_quantos
    from public.post_approval_comments c
   where c.post_id = _post_id and c.author_role = 'cliente_externo' and c.ancora_x is not null;
  if v_quantos >= 20 then raise exception 'muitos_alfinetes'; end if;

  insert into public.post_approval_comments(
    post_id, author_id, author_role, content, midia_indice, ancora_x, ancora_y, ancora_seg)
  values (
    _post_id, null, 'cliente_externo', left(_comment, 2000),
    _midia_indice,
    case when _ancora_x is null then null else least(1, greatest(0, _ancora_x)) end,
    case when _ancora_y is null then null else least(1, greatest(0, _ancora_y)) end,
    case when _ancora_seg is null then null else greatest(0, _ancora_seg) end)
  returning id into v_id;
  return v_id;
end; $function$;
grant execute on function public.pin_comment_by_token(text, uuid, text, integer, numeric, numeric, numeric) to anon, authenticated;

/* Tirar o próprio alfinete antes de mandar. Só apaga comentário de CLIENTE
   que tenha alfinete e que ainda esteja na peça deste token: recado da equipe
   e comentário de texto não somem por aqui. */
drop function if exists public.remove_pin_by_token(text, uuid);
create function public.remove_pin_by_token(_token text, _comment_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $function$
declare v_manager uuid; v_client uuid;
begin
  select t.manager_id, t.external_client_id into v_manager, v_client
  from public.approval_tokens t
  where t.token = _token and t.active = true
    and (t.expires_at is null or t.expires_at > now())
    and public.has_module('aprovapost_externo', t.manager_id);
  if v_manager is null then raise exception 'invalid_token'; end if;

  delete from public.post_approval_comments c
   using public.posts p
   where c.id = _comment_id
     and p.id = c.post_id
     and p.external_client_id = v_client
     and p.user_id = v_manager
     and c.author_role = 'cliente_externo'
     and c.ancora_x is not null;
end; $function$;
grant execute on function public.remove_pin_by_token(text, uuid) to anon, authenticated;

-- ── 3) O cliente vê os alfinetes (dele e da equipe) ───────────────────────
drop function if exists public.list_post_comments_by_token(text);
create function public.list_post_comments_by_token(_token text)
returns table(
  post_id uuid, author_kind text, content text, created_at timestamptz,
  comment_id uuid, midia_indice integer, ancora_x numeric, ancora_y numeric, ancora_seg numeric)
language sql stable security definer set search_path to 'public'
as $$
  with tok as (
    select t.manager_id, t.external_client_id
    from public.approval_tokens t
    where t.token = _token
      and t.active = true
      and (t.expires_at is null or t.expires_at > now())
      and public.has_module('aprovapost_externo', t.manager_id)
  )
  select
    p.id,
    case when c.author_role in ('cliente_externo', 'cliente', 'cliente_externo_aprovacao')
         then 'cliente' else 'equipe' end,
    c.content,
    c.created_at,
    -- id do comentário: é o que permite ao cliente tirar o alfinete que ele
    -- mesmo pôs, antes de fechar a rodada.
    c.id,
    c.midia_indice, c.ancora_x, c.ancora_y, c.ancora_seg
  from tok
  join public.posts p
    on p.external_client_id = tok.external_client_id
   and p.user_id = tok.manager_id
  join public.post_approval_comments c on c.post_id = p.id
  where p.approval_status in ('pendente', 'ajuste_solicitado', 'aprovado')
  order by p.id, c.created_at asc;
$$;
grant execute on function public.list_post_comments_by_token(text) to anon, authenticated;

-- ── 4) O parceiro vê o alfinete e também aponta ───────────────────────────
drop function if exists public.parceiro_comentar(uuid, text);
create function public.parceiro_comentar(
  _post_id uuid, _texto text,
  _midia_indice integer default null,
  _ancora_x numeric default null,
  _ancora_y numeric default null,
  _ancora_seg numeric default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare _id uuid; _limpo text;
begin
  if not public.parceiro_tem_o_card(_post_id) then
    raise exception 'sem acesso a este card';
  end if;
  _limpo := btrim(coalesce(_texto, ''));
  if _limpo = '' then raise exception 'comentário vazio'; end if;

  insert into public.post_approval_comments (
    post_id, content, author_role, midia_indice, ancora_x, ancora_y, ancora_seg)
  values (
    _post_id, left(_limpo, 4000), 'parceiro',
    _midia_indice,
    case when _ancora_x is null then null else least(1, greatest(0, _ancora_x)) end,
    case when _ancora_y is null then null else least(1, greatest(0, _ancora_y)) end,
    case when _ancora_seg is null then null else greatest(0, _ancora_seg) end)
  returning id into _id;
  return _id;
end; $$;
revoke all on function public.parceiro_comentar(uuid, text, integer, numeric, numeric, numeric) from public, anon;
grant execute on function public.parceiro_comentar(uuid, text, integer, numeric, numeric, numeric) to authenticated;

/* O card do parceiro devolve o alfinete junto do comentário. Mesmo corpo do
   circuito 5, só a lista de comentários muda. */
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
begin
  if not public.parceiro_tem_o_card(_post_id) then
    raise exception 'sem acesso a este card';
  end if;

  select * into _p from public.posts where id = _post_id;
  select name into _agencia from public.profiles where id = _p.user_id;
  select ec.name, ec.instagram_handle, ec.crm_client_id into _ec
    from public.external_clients ec where ec.id = _p.external_client_id;
  if _ec.crm_client_id is not null then
    select * into _cc from public.crm_clients where id = _ec.crm_client_id;
  end if;

  /* O CLIENTE ENTRA NA THREAD DO PARCEIRO, mas só quando aponta.
     Até aqui o card filtrava `author_role in ('parceiro','social_media')` de
     propósito: o que o cliente escreve no portal é da agência, e o parceiro não
     precisa (nem deve) ler a conversa comercial. O alfinete é a exceção óbvia:
     é instrução de produção desenhada em cima da arte DELE. Então entra o
     comentário do cliente QUE TEM alfinete, e só ele. */
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
    'midias', _midias,
    'revisoes', coalesce(_p.revisoes, 0),
    'versoes_antigas', _versoes,
    'external_client_id', _p.external_client_id,
    'marca', jsonb_build_object(
      'nome', coalesce(_cc.name, _ec.name),
      'handle', _ec.instagram_handle,
      'cor', _cc.color,
      'logo', _cc.logo,
      'hashtags', _cc.hashtags
    ),
    'comentarios', _coments);
end; $$;
revoke all on function public.parceiro_abrir_card(uuid) from public, anon;
grant execute on function public.parceiro_abrir_card(uuid) to authenticated;

-- Conferência:
-- select id, author_role, midia_indice, ancora_x, ancora_y, ancora_seg
--   from public.post_approval_comments where ancora_x is not null limit 10;
