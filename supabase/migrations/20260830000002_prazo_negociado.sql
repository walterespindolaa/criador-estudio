-- ============================================================
-- CRIA PARCEIROS · prazo combinado, não imposto
--
-- Regra da Gabriela mantida: o parceiro NÃO recusa card. Mas prazo se
-- combina. O fluxo: a social mídia delega com um prazo PROPOSTO; o parceiro
-- topa (vira combinado) ou sugere outra data com motivo; a social mídia
-- aceita a sugestão ou propõe de novo. Cada passo entra na conversa do
-- card, então a negociação tem memória. Enquanto negocia, o card pode ser
-- produzido: negociar data não trava trabalho.
--
-- prazo_status: null (sem prazo ainda) | 'proposto' (aguardando o aceite do
-- parceiro) | 'negociando' (parceiro sugeriu outra data, aguardando a
-- social mídia) | 'aceito' (combinado fechado).
-- ============================================================

alter table public.posts
  add column if not exists prazo_status text,
  add column if not exists prazo_sugerido date;

do $$ begin
  alter table public.posts
    add constraint posts_prazo_status_check
    check (prazo_status is null or prazo_status in ('proposto', 'negociando', 'aceito'));
exception when duplicate_object then null; end $$;

-- ── O parceiro responde ao prazo ────────────────────────────
create or replace function public.parceiro_responder_prazo(
  _post_id uuid,
  _aceita boolean,
  _sugestao date default null,
  _motivo text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare _prazo date; _txt text;
begin
  if not public.parceiro_tem_o_card(_post_id) then
    raise exception 'sem acesso a este card';
  end if;
  select prazo_producao into _prazo from public.posts where id = _post_id;

  if _aceita then
    update public.posts
       set prazo_status = 'aceito', prazo_sugerido = null
     where id = _post_id;
    insert into public.post_approval_comments (post_id, content, author_role)
    values (_post_id,
            'Prazo combinado: ' || coalesce(to_char(_prazo, 'DD/MM/YYYY'), 'a definir'),
            'parceiro');
  else
    if _sugestao is null then
      raise exception 'sugira uma data';
    end if;
    if _sugestao < current_date then
      raise exception 'a data sugerida já passou';
    end if;
    update public.posts
       set prazo_status = 'negociando', prazo_sugerido = _sugestao
     where id = _post_id;
    _txt := 'Prazo: sugeriu ' || to_char(_sugestao, 'DD/MM/YYYY');
    if btrim(coalesce(_motivo, '')) <> '' then
      _txt := _txt || ' (' || left(btrim(_motivo), 300) || ')';
    end if;
    insert into public.post_approval_comments (post_id, content, author_role)
    values (_post_id, _txt, 'parceiro');
  end if;
end; $$;
revoke all on function public.parceiro_responder_prazo(uuid, boolean, date, text) from public, anon;
grant execute on function public.parceiro_responder_prazo(uuid, boolean, date, text) to authenticated;

-- ── A fila passa a carregar o estado do prazo ───────────────
-- (drop porque o tipo de retorno muda; recriada idêntica + 2 colunas)
drop function if exists public.parceiro_minha_fila();

create or replace function public.parceiro_minha_fila()
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
  prazo_sugerido date
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
    p.prazo_status, p.prazo_sugerido
  from public.posts p
  join public.manager_members m
    on m.manager_id = p.user_id
   and m.member_id = auth.uid()
   and m.status = 'ativo'
  left join public.profiles prof on prof.id = p.user_id
  left join public.external_clients ec on ec.id = p.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  where p.assignee_id = auth.uid()
    and coalesce(p.producao_status, 'aguardando') <> 'entregue'
  order by p.prazo_producao asc nulls last, p.assigned_at asc;
$$;
revoke all on function public.parceiro_minha_fila() from public, anon;
grant execute on function public.parceiro_minha_fila() to authenticated;

-- ── O card aberto idem (corpo completo, com aprovacao e prazo) ──
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
