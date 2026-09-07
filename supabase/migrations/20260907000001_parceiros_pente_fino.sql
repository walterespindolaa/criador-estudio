-- Pente fino do Cria Parceiros (auditoria 07/09/2026).
-- O cachê combinado (posts.cache_parceiro) só existia do lado da social mídia:
-- o parceiro descobria o valor no fim do mês. Aqui a fila e o card aberto
-- passam a devolver o valor. Rodar DEPOIS de 20260904000004_parceiros_fase3.

-- ── 1) Fila com cachê. Mudar a lista de colunas de uma função "returns table"
--       exige drop antes do create. ─────────────────────────────────────────
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
  cache numeric
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
    p.cache_parceiro
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

-- ── 2) Card aberto com cachê (jsonb: create or replace basta). ────────────
create or replace function public.parceiro_abrir_card(_post_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  _p public.posts;
  _cc public.crm_clients;
  _ec record;
  _coments jsonb;
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

-- ── 3) Entregues com o eixo de aprovação do cliente e o cachê. O histórico
--       era cego: o parceiro não sabia se a peça foi aprovada ou voltou. ────
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
  cache numeric
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.title, p.format, p.updated_at, p.scheduled_date,
    p.user_id, coalesce(prof.name, 'Agência'),
    coalesce(cc.name, ec.name, 'Cliente'),
    cc.color, cc.logo,
    p.approval_status, p.cache_parceiro
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
