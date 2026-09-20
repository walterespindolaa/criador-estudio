-- ============================================================
-- A COR DA AGENCIA, ESCOLHIDA PELO PARCEIRO (Walter, 20/09/2026)
--
-- "Deixar o designer escolher a cor MINHA": o parceiro atende varias social
-- midias e quer bater o olho no card e saber de quem e. Ele escolhe uma cor
-- por agencia, e ela pinta as falas dela na conversa e o cabecalho do card.
-- Fica no perfil DELE (profiles.cores_agencias = {agencia_id: hex}), porque
-- e escolha pessoal: a mesma agencia pode ser roxa pra um designer e verde
-- pra outro.
--
-- O card passa a devolver agencia_id, senao nao tem como casar a cor.
-- Corpo da funcao copiado de 20260920000002 (a versao no banco), com a linha
-- 'agencia_id' a mais. Idempotente.
-- ============================================================

alter table public.profiles
  add column if not exists cores_agencias jsonb not null default '{}'::jsonb;

comment on column public.profiles.cores_agencias is
  'Parceiro: cor escolhida por agencia que o acoplou ({agencia_id: "#hex"}). Escolha pessoal, so ele ve.';

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
  -- Quem pode abrir: o parceiro dono do card, OU a agencia dona do post
  -- (e quem age por ela). A social midia passa a ver a MESMA janela que o
  -- designer ve, em vez de cair no editor do cliente.
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
    'agencia_id', _p.user_id,
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
