-- ═══════════════════════════════════════════════════════════════════════════
-- A CAPA DA PEÇA NO QUADRO DO PARCEIRO (09/09/2026)
--
-- Walter comparou com o Trello da Gabriela: lá, cada cliente é uma coluna e a
-- ARTE PRONTA aparece como capa do cartão. Bate o olho e ela sabe o que já
-- existe, sem abrir nada. No Cria o cartão do parceiro era só texto, porque
-- nenhuma RPC do lado dele lia `external_media_refs` de volta: o arquivo que
-- ele mesmo sobe em `parceiro_anexar_entrega` entrava no banco e sumia da
-- vista.
--
-- Aqui a fila e os entregues passam a devolver `capa`: a primeira mídia da
-- peça (miniatura quando existe, senão o link de visualização). Nada de novo é
-- exposto, é a mídia do card que ele já tem permissão de abrir.
--
-- Rodar DEPOIS de 20260907000001_parceiros_pente_fino.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) A fila, com capa ───────────────────────────────────────────────────
drop function if exists public.parceiro_minha_fila();
create function public.parceiro_minha_fila()
returns table (
  post_id uuid,
  titulo text,
  formato text,
  plataforma text,
  producao_status text,
  prazo_producao date,
  publica_em date,
  assigned_at timestamptz,
  agencia_id uuid,
  agencia_nome text,
  cliente_nome text,
  cliente_handle text,
  cliente_cor text,
  cliente_logo text,
  etiquetas uuid[],
  prazo_status text,
  prazo_sugerido date,
  cache numeric,
  external_client_id uuid,
  capa text
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.title, p.format, p.platform,
    coalesce(p.producao_status, 'aguardando'),
    p.prazo_producao, p.scheduled_date, p.assigned_at,
    p.user_id, coalesce(prof.name, 'Agência'),
    coalesce(cc.name, ec.name, 'Cliente'),
    ec.instagram_handle,
    cc.color, cc.logo,
    p.internal_tags,
    p.prazo_status, p.prazo_sugerido,
    p.cache_parceiro,
    p.external_client_id,
    -- A primeira mídia da peça. `position` nasceu depois da tabela, então o
    -- desempate por created_at evita ordem aleatória em post antigo.
    (select coalesce(nullif(btrim(m.thumbnail_url), ''), nullif(btrim(m.view_url), ''))
       from public.external_media_refs m
      where m.post_id = p.id
      order by m.position asc nulls last, m.created_at asc
      limit 1)
  from public.posts p
  join public.manager_members m
    on m.manager_id = p.user_id
   and m.member_id = auth.uid()
   and m.status = 'ativo'
  left join public.profiles prof on prof.id = p.user_id
  left join public.external_clients ec on ec.id = p.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  where p.assignee_id = auth.uid()
    and p.deleted_at is null
    and coalesce(p.producao_status, 'aguardando') <> 'entregue'
  order by p.prazo_producao asc nulls last, p.assigned_at asc;
$$;
revoke all on function public.parceiro_minha_fila() from public, anon;
grant execute on function public.parceiro_minha_fila() to authenticated;

-- ── 2) Os entregues, com capa ─────────────────────────────────────────────
-- É aqui que a capa mais importa: a peça PRONTA é o que dá orgulho de olhar,
-- e é o que o quadro por cliente mostra no fim de cada coluna.
drop function if exists public.parceiro_entregues();
create function public.parceiro_entregues()
returns table (
  post_id uuid,
  titulo text,
  formato text,
  entregue_em timestamptz,
  publica_em date,
  agencia_id uuid,
  agencia_nome text,
  cliente_nome text,
  cliente_cor text,
  cliente_logo text,
  aprovacao text,
  cache numeric,
  external_client_id uuid,
  capa text
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.title, p.format, p.updated_at, p.scheduled_date,
    p.user_id, coalesce(prof.name, 'Agência'),
    coalesce(cc.name, ec.name, 'Cliente'),
    cc.color, cc.logo,
    p.approval_status, p.cache_parceiro,
    p.external_client_id,
    (select coalesce(nullif(btrim(m.thumbnail_url), ''), nullif(btrim(m.view_url), ''))
       from public.external_media_refs m
      where m.post_id = p.id
      order by m.position asc nulls last, m.created_at asc
      limit 1)
  from public.posts p
  join public.manager_members m
    on m.manager_id = p.user_id
   and m.member_id = auth.uid()
   and m.status = 'ativo'
  left join public.profiles prof on prof.id = p.user_id
  left join public.external_clients ec on ec.id = p.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  where p.assignee_id = auth.uid()
    and p.deleted_at is null
    and p.producao_status = 'entregue'
  order by p.updated_at desc
  limit 200;
$$;
revoke all on function public.parceiro_entregues() from public, anon;
grant execute on function public.parceiro_entregues() to authenticated;

-- ── 3) O card aberto passa a devolver as mídias da peça ───────────────────
-- Ele sobe o arquivo por `parceiro_anexar_entrega` e nunca mais o via: o card
-- não lia a tabela de volta. Agora o que está anexado aparece no briefing, que
-- é como ele confere se mandou a versão certa. Retorna jsonb, então replace
-- basta. Corpo idêntico ao de 20260907000001, mais a chave `midias`.
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

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'texto', c.content, 'papel', c.author_role, 'em', c.created_at
         ) order by c.created_at), '[]'::jsonb)
    into _coments
    from public.post_approval_comments c where c.post_id = _post_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'url', coalesce(nullif(btrim(m.view_url), ''), m.thumbnail_url),
           'thumb', coalesce(nullif(btrim(m.thumbnail_url), ''), m.view_url),
           'nome', m.file_name,
           'tipo', m.file_type
         ) order by m.position asc nulls last, m.created_at asc), '[]'::jsonb)
    into _midias
    from public.external_media_refs m where m.post_id = _post_id;

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
    -- Elo com a ficha da marca: é o que deixa o card mostrar os LINKS do
    -- cliente (Drive, refs, site) em vez de um botão genérico.
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

-- Conferência (logado como parceiro):
-- select post_id, titulo, cliente_nome, capa from public.parceiro_minha_fila();
-- select post_id, titulo, cliente_nome, capa from public.parceiro_entregues();
-- select public.parceiro_abrir_card('<post_id>') -> 'midias';
