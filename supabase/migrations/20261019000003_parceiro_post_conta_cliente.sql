-- PARCEIRO EM POST DE CLIENTE QUE USA O CRIA (Walter, 19/10/2026)
--
-- Até aqui o parceiro (designer, editor...) só via post cujo DONO era a
-- agência (posts.user_id = manager_members.manager_id). Cliente que tem conta
-- Cria guarda os posts na conta DELE, então a social mídia não tinha como
-- mandar esses posts pra designer.
--
-- Agora o post do cliente carrega `agencia_id`: a agência que delegou.
-- Toda função de parceiro passa a resolver a agência como
-- coalesce(agencia_id, user_id). Post da própria agência segue igual
-- (agencia_id fica nulo).
--
-- Quem pode gravar agencia_id (posts_guard_parceiro):
--   · o post precisa ser de um cliente da carteira dessa agência
--     (crm_clients.manager_id = agencia e cria_owner_id = dono do post);
--   · quem grava precisa gerir parceiros dessa agência (pode_gerir_parceiros);
--   · o parceiro precisa ser parceiro ativo dessa agência.
-- Tirar o parceiro (assignee nulo) limpa agencia_id.
--
-- Junto: aviso pro parceiro quando a agência marca o cachê como pago (antes
-- ele só descobria abrindo "Meus cachês").

alter table public.posts add column if not exists agencia_id uuid references public.profiles(id) on delete set null;
create index if not exists posts_agencia_id_idx on public.posts (agencia_id) where agencia_id is not null;
comment on column public.posts.agencia_id is
  'Agência que delegou este post (de um cliente com conta Cria) a um parceiro. Nulo = o dono do post é a própria agência.';

-- ── Guarda ───────────────────────────────────────────────────────────────
-- A guarda roda com a permissão de quem grava; colaboradora sem o Cria
-- Gestão não lê crm_clients. Este helper só devolve sim/não.
create or replace function public.agencia_atende_conta(_agencia uuid, _conta uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.crm_clients c
     where c.manager_id = _agencia
       and c.cria_owner_id = _conta
       and c.deleted_at is null);
$function$;

create or replace function public.posts_guard_parceiro()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  _mudou_parceiro boolean;
  _mudou_cache boolean;
  _mudou_agencia boolean;
  _ag uuid;
begin
  -- Normalização vale pra todo mundo (inclusive funções do sistema).
  if new.assignee_id is null or new.agencia_id = new.user_id then
    new.agencia_id := null;
  end if;

  if current_user not in ('authenticated', 'anon') then return new; end if;

  if tg_op = 'INSERT' then
    _mudou_parceiro := new.assignee_id is not null;
    _mudou_cache := new.cache_parceiro is not null;
    _mudou_agencia := new.agencia_id is not null;
    _ag := coalesce(new.agencia_id, new.user_id);
  else
    _mudou_parceiro := new.assignee_id is distinct from old.assignee_id;
    _mudou_cache := new.cache_parceiro is distinct from old.cache_parceiro;
    _mudou_agencia := new.agencia_id is distinct from old.agencia_id;
    -- Tirar o parceiro de um post de cliente: quem decide é a agência que
    -- tinha delegado (old.agencia_id), não o dono do post.
    _ag := coalesce(new.agencia_id, old.agencia_id, new.user_id);
  end if;
  if not (_mudou_parceiro or _mudou_cache or _mudou_agencia) then return new; end if;

  if not public.pode_gerir_parceiros(_ag) then
    raise exception 'Só a dona da conta, ou quem ela liberou em Equipe > Pessoas, envia peça pra parceiro ou muda o cachê.';
  end if;

  if new.agencia_id is not null and not public.agencia_atende_conta(new.agencia_id, new.user_id) then
    raise exception 'Este post não é de um cliente da carteira desta agência.';
  end if;

  if _mudou_parceiro and new.assignee_id is not null and not exists (
       select 1 from public.manager_members m
        where m.manager_id = coalesce(new.agencia_id, new.user_id)
          and m.member_id = new.assignee_id
          and m.status = 'ativo'
          and public.eh_papel_parceiro(m.role)) then
    raise exception 'Essa pessoa não é parceira desta conta. A dona vincula em Equipe > Pessoas.';
  end if;

  return new;
end; $function$;

-- ── Acesso do parceiro ao card ──────────────────────────────────────────
create or replace function public.parceiro_tem_o_card(_post_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.posts p
    join public.manager_members m
      on m.manager_id = coalesce(p.agencia_id, p.user_id)
     and m.member_id = auth.uid()
     and m.status = 'ativo'
    where p.id = _post_id
      and p.assignee_id = auth.uid()
  );
$function$;

-- ── Fila do parceiro ────────────────────────────────────────────────────
create or replace function public.parceiro_minha_fila()
 returns table(post_id uuid, titulo text, formato text, plataforma text, producao_status text, prazo_producao date, publica_em date, assigned_at timestamp with time zone, agencia_id uuid, agencia_nome text, cliente_nome text, cliente_handle text, cliente_cor text, cliente_logo text, etiquetas uuid[], prazo_status text, prazo_sugerido date, cache numeric, external_client_id uuid, capa text, revisoes integer, urgente boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    p.id, p.title, p.format, p.platform,
    coalesce(p.producao_status, 'aguardando'),
    p.prazo_producao, p.scheduled_date, p.assigned_at,
    coalesce(p.agencia_id, p.user_id), coalesce(prof.name, 'Agência'),
    coalesce(cc.name, cco.name, ec.name, 'Cliente'),
    coalesce(ec.instagram_handle, cco.instagram),
    coalesce(cc.color, cco.color), coalesce(cc.logo, cco.logo),
    p.internal_tags,
    p.prazo_status, p.prazo_sugerido,
    p.cache_parceiro,
    p.external_client_id,
    (select coalesce(nullif(btrim(m.thumbnail_url), ''), nullif(btrim(m.view_url), ''))
       from public.external_media_refs m
      where m.post_id = p.id and not m.substituida
      order by m.position asc nulls last, m.created_at asc
      limit 1),
    coalesce(p.revisoes, 0),
    coalesce(p.urgente, false)
  from public.posts p
  join public.manager_members m
    on m.manager_id = coalesce(p.agencia_id, p.user_id)
   and m.member_id = auth.uid()
   and m.status = 'ativo'
  left join public.profiles prof on prof.id = coalesce(p.agencia_id, p.user_id)
  left join public.external_clients ec on ec.id = p.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  left join lateral (
    select x.name, x.instagram, x.color, x.logo from public.crm_clients x
     where p.agencia_id is not null and x.manager_id = p.agencia_id
       and x.cria_owner_id = p.user_id and x.deleted_at is null
     order by x.created_at limit 1) cco on true
  where p.assignee_id = auth.uid()
    and p.deleted_at is null
    and coalesce(p.producao_status, 'aguardando') <> 'entregue'
  order by coalesce(p.urgente, false) desc, p.prazo_producao asc nulls last, p.assigned_at asc;
$function$;

create or replace function public.parceiro_entregues()
 returns table(post_id uuid, titulo text, formato text, entregue_em timestamp with time zone, publica_em date, agencia_id uuid, agencia_nome text, cliente_nome text, cliente_cor text, cliente_logo text, aprovacao text, cache numeric, external_client_id uuid, capa text, revisoes integer)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    p.id, p.title, p.format,
    coalesce(p.entregue_em, p.updated_at),
    p.scheduled_date,
    coalesce(p.agencia_id, p.user_id), coalesce(prof.name, 'Agência'),
    coalesce(cc.name, cco.name, ec.name, 'Cliente'),
    coalesce(cc.color, cco.color), coalesce(cc.logo, cco.logo),
    p.approval_status, p.cache_parceiro,
    p.external_client_id,
    (select coalesce(nullif(btrim(m.thumbnail_url), ''), nullif(btrim(m.view_url), ''))
       from public.external_media_refs m
      where m.post_id = p.id and not m.substituida
      order by m.position asc nulls last, m.created_at asc
      limit 1),
    coalesce(p.revisoes, 0)
  from public.posts p
  join public.manager_members m
    on m.manager_id = coalesce(p.agencia_id, p.user_id)
   and m.member_id = auth.uid()
   and m.status = 'ativo'
  left join public.profiles prof on prof.id = coalesce(p.agencia_id, p.user_id)
  left join public.external_clients ec on ec.id = p.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  left join lateral (
    select x.name, x.color, x.logo from public.crm_clients x
     where p.agencia_id is not null and x.manager_id = p.agencia_id
       and x.cria_owner_id = p.user_id and x.deleted_at is null
     order by x.created_at limit 1) cco on true
  where p.assignee_id = auth.uid()
    and p.deleted_at is null
    and p.producao_status = 'entregue'
  order by coalesce(p.entregue_em, p.updated_at) desc
  limit 200;
$function$;

create or replace function public.parceiro_titulos_das_pecas(_ids uuid[])
 returns table(post_id uuid, titulo text, cliente_nome text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p.id,
         coalesce(nullif(p.title, ''), 'Peça sem título'),
         coalesce(nullif(ec.name, ''), cco.name, '')
    from public.posts p
    join public.manager_members m
      on m.manager_id = coalesce(p.agencia_id, p.user_id)
     and m.member_id = auth.uid()
     and m.status = 'ativo'
    left join public.external_clients ec on ec.id = p.external_client_id
    left join lateral (
      select x.name from public.crm_clients x
       where p.agencia_id is not null and x.manager_id = p.agencia_id
         and x.cria_owner_id = p.user_id and x.deleted_at is null
       order by x.created_at limit 1) cco on true
   where p.id = any(coalesce(_ids, '{}'::uuid[]))
     and p.assignee_id = auth.uid()
     and p.deleted_at is null;
$function$;

create or replace function public.parceiro_minhas_agencias()
 returns table(agencia_id uuid, agencia_nome text, meu_papel text, vinculo_status text, abertos integer, entregues_30d integer)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    m.manager_id,
    coalesce(prof.name, m.email, 'Agência'),
    m.role,
    m.status,
    (select count(*)::int from public.posts p
      where coalesce(p.agencia_id, p.user_id) = m.manager_id
        and p.assignee_id = auth.uid()
        and p.deleted_at is null
        and coalesce(p.producao_status, 'aguardando') <> 'entregue'),
    (select count(*)::int from public.posts p
      where coalesce(p.agencia_id, p.user_id) = m.manager_id
        and p.assignee_id = auth.uid()
        and p.deleted_at is null
        and p.producao_status = 'entregue'
        and coalesce(p.entregue_em, p.updated_at) >= now() - interval '30 days')
  from public.manager_members m
  left join public.profiles prof on prof.id = m.manager_id
  where m.member_id = auth.uid()
    and m.status = 'ativo'
    and public.eh_papel_parceiro(m.role)
  order by 5 desc, 2;
$function$;

create or replace function public.parceiro_extrato(_de date, _ate date)
 returns table(tipo text, quando date, agencia_id uuid, agencia_nome text, cliente_nome text, cliente_cor text, referencia_id uuid, titulo text, formato text, revisoes integer, aprovacao text, cache numeric, pago boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    'peca'::text,
    (coalesce(p.entregue_em, p.updated_at) at time zone 'America/Sao_Paulo')::date,
    coalesce(p.agencia_id, p.user_id),
    coalesce(prof.name, 'Agência')::text,
    coalesce(nullif(btrim(cc.name), ''), nullif(btrim(cco.name), ''), nullif(btrim(ec.name), ''), 'Cliente')::text,
    coalesce(cc.color, cco.color, ec.brand_color)::text,
    p.id,
    coalesce(nullif(btrim(p.title), ''), 'Peça sem título')::text,
    p.format::text,
    coalesce(p.revisoes, 0)::int,
    p.approval_status::text,
    p.cache_parceiro::numeric,
    exists (
      select 1 from public.fin_records f
       where f.post_id = p.id
         and f.assignee_id = auth.uid()
         and coalesce(f.status, 'pendente') = 'pago'
    )
  from public.posts p
  join public.manager_members m
    on m.manager_id = coalesce(p.agencia_id, p.user_id)
   and m.member_id = auth.uid()
   and m.status = 'ativo'
  left join public.profiles prof on prof.id = coalesce(p.agencia_id, p.user_id)
  left join public.external_clients ec on ec.id = p.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  left join lateral (
    select x.name, x.color from public.crm_clients x
     where p.agencia_id is not null and x.manager_id = p.agencia_id
       and x.cria_owner_id = p.user_id and x.deleted_at is null
     order by x.created_at limit 1) cco on true
  where p.assignee_id = auth.uid()
    and p.deleted_at is null
    and p.producao_status = 'entregue'
    and (coalesce(p.entregue_em, p.updated_at) at time zone 'America/Sao_Paulo')::date
        between _de and _ate

  union all

  select
    i.tipo::text,
    coalesce((i.feito_em at time zone 'America/Sao_Paulo')::date, i.data),
    i.agencia_id,
    coalesce(prof2.name, 'Sem agência')::text,
    coalesce(nullif(btrim(cc2.name), ''), nullif(btrim(cco2.name), ''), nullif(btrim(ec2.name), ''), '')::text,
    coalesce(cc2.color, cco2.color, ec2.brand_color)::text,
    i.id,
    i.titulo::text,
    null::text, null::int, null::text, null::numeric, null::boolean
  from public.parceiro_agenda_itens i
  left join public.profiles prof2 on prof2.id = i.agencia_id
  left join public.posts p2
    on p2.id = i.post_id
   and p2.assignee_id = auth.uid()
   and exists (
     select 1 from public.manager_members m2
      where m2.manager_id = coalesce(p2.agencia_id, p2.user_id)
        and m2.member_id = auth.uid()
        and m2.status = 'ativo'
   )
  left join public.external_clients ec2 on ec2.id = p2.external_client_id
  left join public.crm_clients cc2 on cc2.id = ec2.crm_client_id
  left join lateral (
    select x.name, x.color from public.crm_clients x
     where p2.agencia_id is not null and x.manager_id = p2.agencia_id
       and x.cria_owner_id = p2.user_id and x.deleted_at is null
     order by x.created_at limit 1) cco2 on true
  where i.parceiro_id = auth.uid()
    and i.feito
    and coalesce((i.feito_em at time zone 'America/Sao_Paulo')::date, i.data)
        between _de and _ate

  order by 2 desc, 4, 5;
$function$;

create or replace function public.parceiro_meus_caches_detalhe()
 returns table(id uuid, valor numeric, status text, data date, descricao text, post_id uuid, post_titulo text, cliente_nome text, cliente_logo text, cliente_cor text, agencia_id uuid, agencia_nome text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with vinculo as (
    select m.manager_id
    from public.manager_members m
    where m.member_id = auth.uid() and m.status = 'ativo'
  )
  select
    f.id,
    f.amount,
    coalesce(f.status, 'pendente'),
    f.date,
    case when v.manager_id is null then null else f.description end,
    case when v.manager_id is null then null else f.post_id end,
    case when v.manager_id is null then 'Entrega' else coalesce(p.title, mat.title) end,
    case when v.manager_id is null then 'Cliente'
         else coalesce(nullif(btrim(cc.name), ''), ec.name, nullif(btrim(cco.name), ''), nullif(btrim(cc2.name), ''), ec2.name) end,
    case when v.manager_id is null then null else coalesce(cc.logo, ec.logo_url, cco.logo, cc2.logo, ec2.logo_url) end,
    case when v.manager_id is null then null else coalesce(cc.color, ec.brand_color, cco.color, cc2.color, ec2.brand_color) end,
    f.manager_id,
    coalesce(prof.name, 'Agência')
  from public.fin_records f
  left join vinculo v on v.manager_id = f.manager_id
  left join public.posts p on p.id = f.post_id
  left join public.external_clients ec on ec.id = p.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  left join lateral (
    select x.name, x.logo, x.color from public.crm_clients x
     where p.agencia_id is not null and x.manager_id = p.agencia_id
       and x.cria_owner_id = p.user_id and x.deleted_at is null
     order by x.created_at limit 1) cco on true
  left join public.client_materials mat on mat.id = f.material_id
  left join public.crm_clients cc2 on cc2.id = mat.crm_client_id
  left join public.external_clients ec2 on ec2.id = mat.external_client_id
  left join public.profiles prof on prof.id = f.manager_id
  where f.assignee_id = auth.uid()
  order by f.date desc
  limit 300;
$function$;

-- ── Card aberto (parceiro e agência) ────────────────────────────────────
create or replace function public.parceiro_abrir_card(_post_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
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
    or exists (select 1 from public.posts p where p.id = _post_id
               and (public.acts_for(p.user_id)
                    or (p.agencia_id is not null and public.acts_for(p.agencia_id))))
  ) then
    raise exception 'sem acesso a este card';
  end if;

  select * into _p from public.posts where id = _post_id;
  select name into _agencia from public.profiles where id = coalesce(_p.agencia_id, _p.user_id);
  select ec.name, ec.instagram_handle, ec.crm_client_id into _ec
    from public.external_clients ec where ec.id = _p.external_client_id;
  if _ec.crm_client_id is not null then
    select * into _cc from public.crm_clients where id = _ec.crm_client_id;
  elsif _p.agencia_id is not null then
    -- Post da conta Cria do cliente: a ficha é a da carteira da agência.
    select * into _cc from public.crm_clients x
     where x.manager_id = _p.agencia_id and x.cria_owner_id = _p.user_id and x.deleted_at is null
     order by x.created_at limit 1;
  end if;
  _conf := coalesce(_cc.compartilhar_parceiros, '{}'::jsonb);

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
       c.canal = 'parceiro'
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
    'agencia_id', coalesce(_p.agencia_id, _p.user_id),
    'midias', _midias,
    'revisoes', coalesce(_p.revisoes, 0),
    'versoes_antigas', _versoes,
    'external_client_id', _p.external_client_id,
    'crm_client_id', coalesce(_ec.crm_client_id, _cc.id),
    'canal_recado', nullif(btrim(_cc.recado_parceiros), ''),
    'canal_pasta', case when _cc.id is not null and public.parceiro_ve(_conf, 'pasta') then public.pasta_geral_do_cliente(_cc) end,
    'canal_links', _links_uteis,
    'marca_liberada', case when _cc.id is not null then public.marca_para_parceiro(_cc) else '{}'::jsonb end,
    'marca', jsonb_build_object(
      'nome', coalesce(_cc.name, _ec.name),
      'handle', coalesce(_ec.instagram_handle, _cc.instagram),
      'cor', _cc.color,
      'logo', _cc.logo,
      'hashtags', case when public.parceiro_ve(_conf, 'hashtags') then _cc.hashtags end
    ),
    'comentarios', _coments, 'urgente', coalesce(_p.urgente, false));
end; $function$;

-- ── Conversas (lado da agência) ─────────────────────────────────────────
create or replace function public.conversas_com_parceiros()
 returns table(post_id uuid, titulo text, formato text, external_client_id uuid, assignee_id uuid, producao_status text, ultima_texto text, ultima_papel text, ultima_em timestamp with time zone, total integer, nao_lidas integer)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p.id,
         p.title,
         p.format,
         p.external_client_id,
         p.assignee_id,
         coalesce(p.producao_status, 'aguardando'),
         u.content,
         u.author_role,
         u.created_at,
         (select count(*)::int from public.post_approval_comments c
           where c.post_id = p.id and c.canal = 'parceiro'),
         (select count(*)::int from public.post_approval_comments c
           where c.post_id = p.id and c.author_role = 'parceiro' and c.canal = 'parceiro'
             and c.created_at > greatest(
               coalesce(l.lido_em, '-infinity'::timestamptz),
               coalesce((select max(s.created_at) from public.post_approval_comments s
                          where s.post_id = p.id and s.author_role = 'social_media' and s.canal = 'parceiro'), '-infinity'::timestamptz)))
    from public.posts p
    join lateral (
      select c.content, c.author_role, c.created_at
        from public.post_approval_comments c
       where c.post_id = p.id and c.canal = 'parceiro'
       order by c.created_at desc
       limit 1
    ) u on true
    left join public.conversa_lida l on l.user_id = auth.uid() and l.post_id = p.id
   where coalesce(p.agencia_id, p.user_id) = auth.uid()
     and p.assignee_id is not null
     and p.deleted_at is null
   order by u.created_at desc
   limit 200
$function$;

create or replace function public.conversas_com_parceiros_da_conta(_manager uuid)
 returns table(post_id uuid, titulo text, formato text, external_client_id uuid, assignee_id uuid, producao_status text, ultima_texto text, ultima_papel text, ultima_em timestamp with time zone, total integer, nao_lidas integer)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p.id, p.title, p.format, p.external_client_id, p.assignee_id,
         coalesce(p.producao_status, 'aguardando'),
         u.content, u.author_role, u.created_at,
         (select count(*)::int from public.post_approval_comments c
           where c.post_id = p.id and c.canal = 'parceiro'),
         (select count(*)::int from public.post_approval_comments c
           where c.post_id = p.id and c.author_role = 'parceiro' and c.canal = 'parceiro'
             and c.created_at > greatest(
               coalesce(l.lido_em, '-infinity'::timestamptz),
               coalesce((select max(s.created_at) from public.post_approval_comments s
                          where s.post_id = p.id and s.author_role = 'social_media' and s.canal = 'parceiro'), '-infinity'::timestamptz)))
    from public.posts p
    join lateral (
      select c.content, c.author_role, c.created_at
        from public.post_approval_comments c
       where c.post_id = p.id and c.canal = 'parceiro'
       order by c.created_at desc
       limit 1
    ) u on true
    left join public.conversa_lida l on l.user_id = auth.uid() and l.post_id = p.id
   where coalesce(p.agencia_id, p.user_id) = _manager
     and public.pode_gerir_parceiros(_manager)
     and p.assignee_id is not null
     and p.deleted_at is null
   order by u.created_at desc
   limit 200
$function$;

-- ── Avisos do fluxo ─────────────────────────────────────────────────────
create or replace function public.notify_parceiro_fluxo()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  _agencia text; _parceiro text; _titulo text; _prazo text; _motivo text;
  _ator uuid := auth.uid();
  _ag uuid := coalesce(new.agencia_id, old.agencia_id, new.user_id);
begin
  if new.assignee_id is null and old.assignee_id is null then return new; end if;
  _titulo := coalesce(new.title, 'post');
  _prazo := case when new.prazo_producao is not null then to_char(new.prazo_producao, 'DD/MM') else null end;

  -- a) Nova demanda (ou trocou de parceiro) -> parceiro
  if new.assignee_id is not null and new.assignee_id is distinct from old.assignee_id then
    select coalesce(nullif(pr.name, ''), 'Uma agência') into _agencia
    from public.profiles pr where pr.id = _ag;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.assignee_id, 'demanda_nova',
            '🎬 Nova demanda: ' || _titulo,
            _agencia || (case when _prazo is not null then ' pediu pra ' || _prazo else ' ainda vai combinar o prazo' end)
              || (case when new.cache_parceiro is not null then ' · R$ ' || replace(to_char(new.cache_parceiro, 'FM999999990.00'), '.', ',') else '' end) || '.',
            public.link_da_peca(new.id, new.external_client_id, true));
  end if;

  -- b) Ajuste pedido -> parceiro
  if new.producao_status = 'ajuste' and old.producao_status is distinct from 'ajuste' and new.assignee_id is not null then
    select c.content into _motivo from public.post_approval_comments c
    where c.post_id = new.id and c.author_role = 'social_media' and c.canal = 'parceiro' order by c.created_at desc limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (new.assignee_id, 'demanda_ajuste', '🔁 Ajuste pedido: ' || _titulo,
            coalesce('"' || left(regexp_replace(_motivo, '^Ajuste:\s*', ''), 180) || '"', 'Abra o card pra ver o que mudar.'),
            public.link_da_peca(new.id, new.external_client_id, true));
  end if;

  -- c) Prazo confirmado pela social mídia -> parceiro
  if new.prazo_status = 'aceito' and old.prazo_status is distinct from 'aceito'
     and new.assignee_id is not null and (_ator is null or _ator <> new.assignee_id) then
    insert into public.notifications (user_id, type, title, description, link)
    values (new.assignee_id, 'demanda_prazo', '📅 Prazo confirmado: ' || _titulo,
            coalesce('Entrega combinada pra ' || _prazo || '.', 'Prazo fechado.'),
            public.link_da_peca(new.id, new.external_client_id, true));
  end if;

  -- d) Parceiro entregou -> agência (dona do post ou quem delegou)
  if new.producao_status = 'entregue' and old.producao_status is distinct from 'entregue' then
    select coalesce(nullif(m.name, ''), 'Parceiro') into _parceiro
    from public.manager_members m where m.member_id = new.assignee_id and m.manager_id = _ag limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (_ag, 'demanda_entregue', '✅ ' || coalesce(_parceiro, 'Parceiro') || ' entregou: ' || _titulo,
            'Revise e aprove, ou peça ajuste.',
            public.link_da_peca(new.id, new.external_client_id, false));
  end if;

  -- e) Parceiro sugeriu outro prazo -> agência
  if new.prazo_status = 'negociando' and old.prazo_status is distinct from 'negociando' then
    select coalesce(nullif(m.name, ''), 'Parceiro') into _parceiro
    from public.manager_members m where m.member_id = new.assignee_id and m.manager_id = _ag limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (_ag, 'demanda_prazo', '📅 ' || coalesce(_parceiro, 'Parceiro') || ' sugeriu outro prazo: ' || _titulo,
            coalesce('Propôs ' || to_char(new.prazo_sugerido, 'DD/MM') || '. Aceite ou responda.', 'Veja a proposta na Produção da Equipe.'),
            '/socialmidia/equipe/producao?post=' || new.id::text);
  end if;
  return new;
end; $function$;

create or replace function public.notify_parceiro_comentario()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _dono uuid; _assignee uuid; _titulo text; _parceiro text; _ec uuid;
begin
  if new.author_role not in ('parceiro', 'social_media') or coalesce(new.canal, 'cliente') <> 'parceiro' then return new; end if;
  if new.content like 'Entrega%' or new.content like 'Ajuste:%' or new.content like 'Prazo%' then return new; end if;
  select coalesce(p.agencia_id, p.user_id), p.assignee_id, p.title, p.external_client_id
    into _dono, _assignee, _titulo, _ec
  from public.posts p where p.id = new.post_id;
  if _assignee is null then return new; end if;
  if new.author_role = 'parceiro' then
    select coalesce(nullif(m.name, ''), 'Parceiro') into _parceiro
    from public.manager_members m where m.member_id = _assignee and m.manager_id = _dono limit 1;
    insert into public.notifications (user_id, type, title, description, link)
    values (_dono, 'demanda_comentario', '💬 ' || coalesce(_parceiro, 'Parceiro') || ' comentou: ' || coalesce(_titulo, 'post'),
            '"' || left(new.content, 180) || '"', '/socialmidia/equipe/conversas?post=' || new.post_id::text);
  else
    insert into public.notifications (user_id, type, title, description, link)
    values (_assignee, 'demanda_comentario', '💬 Comentário no card: ' || coalesce(_titulo, 'post'),
            '"' || left(new.content, 180) || '"', public.link_da_peca(new.post_id, _ec, true));
  end if;
  return new;
end; $function$;

-- ── Cachê vai pro Caixa da agência ──────────────────────────────────────
create or replace function public.lancar_cache_parceiro()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  _papel text; _nome text; _crm uuid; _cat text; _fin record;
  _atrasado boolean := false;
  _ag uuid := coalesce(new.agencia_id, new.user_id);
begin
  if new.cache_parceiro is distinct from old.cache_parceiro then
    select f.* into _fin from public.fin_records f where f.post_id = new.id limit 1;
    if found then
      if coalesce(_fin.status, 'pendente') <> 'pago' then
        if new.cache_parceiro is null or new.cache_parceiro <= 0 then
          delete from public.fin_records where id = _fin.id;
        else
          update public.fin_records set amount = new.cache_parceiro where id = _fin.id;
        end if;
      end if;
      return new;
    end if;
    _atrasado := coalesce(new.producao_status, '') = 'entregue'
                 and new.assignee_id is not null
                 and coalesce(new.cache_parceiro, 0) > 0;
  end if;

  if not _atrasado then
    if coalesce(new.producao_status, '') <> 'entregue'
       or coalesce(old.producao_status, '') = 'entregue' then
      return new;
    end if;
    if new.assignee_id is null then return new; end if;

    if new.cache_parceiro is null or new.cache_parceiro <= 0 then
      select coalesce(nullif(m.name, ''), 'O parceiro') into _nome
      from public.manager_members m
      where m.member_id = new.assignee_id and m.manager_id = _ag limit 1;
      insert into public.notifications (user_id, type, title, description, link)
      values (_ag, 'cache_aviso',
              '💸 Entrega sem cachê combinado: ' || coalesce(new.title, 'post'),
              coalesce(_nome, 'O parceiro') || ' entregou, mas esta peça não tem valor definido. '
                || 'Sem isso ela não entra no Caixa nem no "a receber" dele.',
              public.link_da_peca(new.id, new.external_client_id, false));
      return new;
    end if;
  end if;

  if exists (select 1 from public.fin_records f where f.post_id = new.id) then return new; end if;

  select m.role, coalesce(nullif(m.name, ''), 'Parceiro') into _papel, _nome
  from public.manager_members m where m.member_id = new.assignee_id and m.manager_id = _ag limit 1;
  select ec.crm_client_id into _crm from public.external_clients ec where ec.id = new.external_client_id;
  if _crm is null and new.agencia_id is not null then
    -- Post da conta do cliente: a despesa cai na ficha dele na carteira,
    -- e entra na margem do cliente igual às outras.
    select x.id into _crm from public.crm_clients x
     where x.manager_id = new.agencia_id and x.cria_owner_id = new.user_id and x.deleted_at is null
     order by x.created_at limit 1;
  end if;
  _cat := case _papel
    when 'designer' then 'Design'
    when 'editor_video' then 'Edição de vídeo'
    when 'copy' then 'Copy'
    when 'trafego' then 'Tráfego pago'
    else 'Freelancer' end;
  insert into public.fin_records (manager_id, crm_client_id, context, type, category, description, amount, date, status, post_id, assignee_id)
  values (_ag, _crm, 'pj', 'despesa', _cat,
          'Cachê ' || coalesce(_nome, 'Parceiro') || ': ' || coalesce(new.title, 'post'),
          new.cache_parceiro, current_date, 'pendente', new.id, new.assignee_id);
  return new;

exception when others then
  begin
    insert into public.notifications (user_id, type, title, description, link)
    values (_ag, 'cache_aviso',
            '💸 Não consegui lançar o cachê: ' || coalesce(new.title, 'post'),
            'O valor foi salvo na peça, mas a despesa não entrou no Caixa. Lance na mão pra não perder o combinado.',
            '/socialmidia/criacaixa/empresa');
  exception when others then
    raise warning 'lancar_cache_parceiro falhou e nem notificou: %', sqlerrm;
  end;
  return new;
end; $function$;

-- ── Aviso de pagamento pro parceiro ─────────────────────────────────────
-- Statement-level: "pagar em lote" é um UPDATE só, então sai UM aviso por
-- parceiro e dia de pagamento, com o total, em vez de um por peça.
create or replace function public.notify_parceiro_pagamento()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _r record;
begin
  for _r in
    select n.assignee_id, n.manager_id, n.pago_em, sum(n.amount) as total, count(*) as qtd
      from novos n
      left join velhos v on v.id = n.id
     where n.assignee_id is not null
       and n.status = 'pago'
       and coalesce(v.status, '') <> 'pago'
     group by n.assignee_id, n.manager_id, n.pago_em
  loop
    insert into public.notifications (user_id, type, title, description, link)
    select _r.assignee_id, 'cache_pago',
           coalesce(nullif(pr.name, ''), 'A agência') || ' marcou seu cachê como pago',
           'R$ ' || replace(to_char(_r.total, 'FM999999990.00'), '.', ',')
             || ' · ' || _r.qtd || (case when _r.qtd = 1 then ' item' else ' itens' end)
             || '. Confira e dê o OK em Meus cachês.',
           '/socialmidia/caches'
      from public.profiles pr where pr.id = _r.manager_id;
  end loop;
  return null;
exception when others then
  raise warning 'notify_parceiro_pagamento falhou: %', sqlerrm;
  return null;
end; $function$;

create or replace trigger trg_notify_parceiro_pagamento
  after update on public.fin_records
  referencing old table as velhos new table as novos
  for each statement execute function public.notify_parceiro_pagamento();
