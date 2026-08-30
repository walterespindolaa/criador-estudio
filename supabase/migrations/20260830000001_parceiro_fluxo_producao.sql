-- ============================================================
-- CRIA PARCEIROS · o fluxo de produção de verdade
--
-- Vem da pesquisa com freelancers de agência (designers, editores, copy).
-- As dores que apareceram em toda fonte:
--   1. Entrega sem link = caos de versão ("qual arquivo é o final?").
--      A rodada vira caça ao anexo. Aqui, marcar entregue aceita o link da
--      versão final e ele entra na conversa do card, com carimbo.
--   2. Depois de entregar, o parceiro fica cego: não sabe se o cliente
--      aprovou, pediu ajuste ou se a peça já foi postada. O card aberto passa
--      a devolver o eixo de aprovação (só leitura, o parceiro não mexe nele).
-- ============================================================

-- ── 0. Parceiro NÃO é colaborador de agência ────────────────
-- my_team_accounts alimenta o seletor "atuar na conta do gestor". Parceiro
-- (designer, editor, copy, tráfego) estava entrando nessa lista, e o
-- AccountContext AUTO-ATIVAVA a conta da agência no login dele: foi isso que
-- prendeu o PeJota na barra "gerenciando a conta de carregando..." com o
-- "Voltar pra minha conta" que não voltava (o efeito reativava na hora).
-- O acesso do parceiro é 100% pelas RPCs parceiro_*; ele nunca atua POR
-- DENTRO da conta da social mídia.
create or replace function public.my_team_accounts()
returns table (owner_id uuid, name text, avatar_url text, niche text, instagram_handle text)
language sql stable security definer set search_path = public as $$
  select p.id as owner_id,
         coalesce(p.name, 'Agência') as name,
         p.avatar_url,
         null::text as niche,
         null::text as instagram_handle
  from public.manager_members m
  join public.profiles p on p.id = m.manager_id
  where m.member_id = auth.uid() and m.status = 'ativo'
    and coalesce(m.role, 'social_media') not in ('designer', 'editor_video', 'copy', 'trafego');
$$;
grant execute on function public.my_team_accounts() to authenticated;

-- ── 1. Marcar com link de entrega ───────────────────────────
-- Assinatura nova (3 args com default) substitui a antiga de 2.
drop function if exists public.parceiro_marcar(uuid, text);

create or replace function public.parceiro_marcar(_post_id uuid, _status text, _link text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare _limpo text;
begin
  if not public.parceiro_tem_o_card(_post_id) then
    raise exception 'sem acesso a este card';
  end if;
  if _status not in ('em_producao', 'entregue') then
    raise exception 'status de produção inválido: %', _status;
  end if;
  update public.posts set producao_status = _status where id = _post_id;

  -- O link da versão final vira comentário carimbado: fica na conversa do
  -- card, a social mídia recebe, e três meses depois ainda dá pra achar.
  _limpo := btrim(coalesce(_link, ''));
  if _status = 'entregue' and _limpo <> '' then
    if _limpo !~* '^https?://' then
      raise exception 'link de entrega inválido';
    end if;
    insert into public.post_approval_comments (post_id, content, author_role)
    values (_post_id, left('Entrega: ' || _limpo, 4000), 'parceiro');
  end if;
end; $$;
revoke all on function public.parceiro_marcar(uuid, text, text) from public, anon;
grant execute on function public.parceiro_marcar(uuid, text, text) to authenticated;

-- ── 2. O card aberto devolve o eixo de aprovação ────────────
-- Mesmo corpo de antes + 'aprovacao'. O parceiro passa a ver onde a peça
-- está DEPOIS que saiu da mão dele (com a social mídia, aguardando o
-- cliente, aprovada, postada), sem poder encostar nesse eixo.
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
    'publica_em', _p.scheduled_date,
    'aprovacao', _p.approval_status,
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
