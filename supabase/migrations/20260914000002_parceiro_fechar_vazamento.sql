-- ═══════════════════════════════════════════════════════════════════════════
-- CIRCUITO 1: FECHAR O VAZAMENTO DE DADOS DO CLIENTE (14/09/2026)
--
-- A auditoria de hoje encontrou três portas abertas, todas com a mesma raiz: o
-- parceiro de produção (designer, filmmaker, editor, copy, tráfego) foi tratado
-- como "time" em lugares onde time significa "quem opera a agência".
--
--   1. A ficha da marca olhava TODO o histórico de peças, sem janela de tempo e
--      sem checar se o vínculo ainda existe. Uma peça de teste em março dava
--      acesso ao brandbook daquele cliente em dezembro, já desligado.
--   2. O card aberto devolvia TODOS os comentários do post, inclusive o que o
--      CLIENTE escreveu no portal de aprovação. Se ele reclamou do preço ou do
--      trabalho da agência, o freelancer lia.
--   3. As tabelas criadas depois da F22 voltaram a usar `acts_for`, que não
--      olha o papel: qualquer vínculo ativo conta como time pleno.
--
-- A CORREÇÃO DO ITEM 3, e por que não é gate de módulo: trocar `acts_for` por
-- `member_can` resolveria, mas mudaria a regra para TODO colaborador, e quem
-- estivesse com um módulo desligado perderia acesso que tem hoje. O problema
-- não é módulo, é PAPEL. Então nasce um helper que diz exatamente isso: dono ou
-- colaborador de operação, nunca parceiro de produção. Risco zero para quem já
-- usa, porta fechada para quem não deveria entrar.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) O helper de papel ──────────────────────────────────────────────────
-- `eh_papel_parceiro` existe desde a fase 1 mas nasceu sem revoke/grant.
revoke all on function public.eh_papel_parceiro(text) from public, anon;
grant execute on function public.eh_papel_parceiro(text) to authenticated;

/* Dono do tenant OU colaborador ativo que NÃO é parceiro de produção.
   É o `acts_for` com uma pergunta a mais: "essa pessoa opera a agência ou só
   produz peça?". Quem só produz não enxerga tabela da agência. */
create or replace function public.acts_for_equipe(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target = auth.uid()
      or exists (
        select 1
        from public.manager_members m
        where m.manager_id = target
          and m.member_id = auth.uid()
          and m.status = 'ativo'
          and not public.eh_papel_parceiro(m.role)
      );
$$;

revoke all on function public.acts_for_equipe(uuid) from public, anon;
grant execute on function public.acts_for_equipe(uuid) to authenticated;

comment on function public.acts_for_equipe(uuid) is
  'Dono ou colaborador de OPERAÇÃO. Exclui designer/editor/copy/tráfego, que só enxergam o próprio card pelas RPCs parceiro_*.';

-- ── 2) As sete tabelas que voltaram a usar acts_for ───────────────────────

-- Recado da social mídia no relatório do cliente.
drop policy if exists "client_report_notes_team" on public.client_report_notes;
create policy "client_report_notes_team" on public.client_report_notes
  for all to authenticated
  using (public.acts_for_equipe(manager_id))
  with check (public.acts_for_equipe(manager_id));

-- Biblioteca de roteiros e clientes avulsos do Cria Captação.
drop policy if exists "capture_scripts tenant" on public.capture_scripts;
create policy "capture_scripts tenant" on public.capture_scripts
  for all to authenticated
  using (public.acts_for_equipe(manager_id))
  with check (public.acts_for_equipe(manager_id));

drop policy if exists "capture_extra_clients tenant" on public.capture_extra_clients;
create policy "capture_extra_clients tenant" on public.capture_extra_clients
  for all to authenticated
  using (public.acts_for_equipe(manager_id))
  with check (public.acts_for_equipe(manager_id));

-- Envio de roteiros pro cliente revisar.
drop policy if exists "script_approvals tenant" on public.script_approvals;
create policy "script_approvals tenant" on public.script_approvals
  for all to authenticated
  using (public.acts_for_equipe(manager_id))
  with check (public.acts_for_equipe(manager_id));

drop policy if exists "script_approval_items tenant" on public.script_approval_items;
create policy "script_approval_items tenant" on public.script_approval_items
  for all to authenticated
  using (exists (select 1 from public.script_approvals a
                 where a.id = approval_id and public.acts_for_equipe(a.manager_id)))
  with check (exists (select 1 from public.script_approvals a
                      where a.id = approval_id and public.acts_for_equipe(a.manager_id)));

-- Link de cadastro do cliente (formulário de briefing).
drop policy if exists "client_intakes tenant" on public.client_intakes;
create policy "client_intakes tenant" on public.client_intakes
  for all to authenticated
  using (public.acts_for_equipe(manager_id))
  with check (public.acts_for_equipe(manager_id));

-- Datas comemorativas da agenda.
drop policy if exists "agenda_datas do time" on public.agenda_datas;
create policy "agenda_datas do time" on public.agenda_datas
  for all to authenticated
  using (public.acts_for_equipe(manager_id))
  with check (public.acts_for_equipe(manager_id));

drop policy if exists "agenda_data_clientes do time" on public.agenda_data_clientes;
create policy "agenda_data_clientes do time" on public.agenda_data_clientes
  for all to authenticated
  using (exists (
    select 1 from public.agenda_datas d
    where d.id = agenda_data_id and public.acts_for_equipe(d.manager_id)
  ))
  with check (exists (
    select 1 from public.agenda_datas d
    where d.id = agenda_data_id and public.acts_for_equipe(d.manager_id)
  ));

-- Análise de vídeo do Radar (leitura).
drop policy if exists va_select on public.video_analyses;
create policy va_select on public.video_analyses
  for select to authenticated using (public.acts_for_equipe(manager_id));

-- NOTA sobre `module_entitlements`: fica como está, de propósito. Ela diz quais
-- MÓDULOS a conta tem, não guarda dado de cliente, e é lida pela casca do app
-- pra montar menu e cadeado. Apertar ali quebraria a navegação sem ganho de
-- confidencialidade.

-- ── 3) A ficha da marca com prazo de validade ─────────────────────────────
-- Antes: `select distinct external_client_id from posts where assignee_id = me`,
-- sem janela e sem vínculo. Agora: só marca de cliente com peça NA MÃO ou com
-- peça delegada nos últimos 180 dias, E com o vínculo ainda ativo.
drop function if exists public.parceiro_minhas_marcas();
create function public.parceiro_minhas_marcas()
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
        -- ainda está com ele
        coalesce(p.producao_status, 'aguardando') <> 'entregue'
        -- ou passou pela mão dele há pouco tempo
        or coalesce(p.assigned_at, p.created_at) >= now() - interval '180 days'
      )
  )
  select
    ec.id,
    coalesce(nullif(btrim(cc.name), ''), ec.name, 'Cliente'),
    coalesce(ec.instagram_handle, cc.instagram),
    coalesce(cc.logo, ec.logo_url),
    coalesce(cc.color, ec.brand_color),
    cc.hashtags,
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
    nullif(btrim(cc.brand_core->>'colorPalette'), ''),
    nullif(btrim(cc.brand_core->>'typography'), ''),
    nullif(btrim(cc.brand_core->>'visualExpression'), ''),
    nullif(btrim(cc.brand_core->>'toneOfVoice'), ''),
    nullif(btrim(cc.brand_core->>'personality'), ''),
    nullif(btrim(cc.brand_core->>'communicationStyle'), ''),
    nullif(btrim(cc.brand_core->>'archetype'), ''),
    nullif(btrim(cc.brand_core->>'contentThemes'), ''),
    nullif(btrim(cc.brand_core->>'coreMessage'), ''),
    nullif(btrim(cc.brand_core->>'promise'), ''),
    nullif(btrim(cc.brand_core->>'audience'), ''),
    coalesce(nullif(btrim(cc.brand_core->>'offer'), ''), nullif(btrim(cc.brand_core->>'products'), '')),
    nullif(btrim(cc.brand_core->>'avoid'), ''),
    -- `cc.notes` SAIU (14/09/2026): é o campo livre de anotação interna da
    -- agência sobre o cliente. Nunca foi escrito pensando em terceiro lendo.
    null::text,
    nullif(btrim(cc.segment), ''),
    coalesce(cc.useful_links, '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('url', r.image_url, 'nota', r.note) order by r.sort_order)
      from public.crm_client_refs r where r.crm_client_id = cc.id
    ), '[]'::jsonb)
  from minhas m
  join public.external_clients ec on ec.id = m.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  left join public.profiles prof on prof.id = m.manager_id
  order by 9 desc, 2;
$$;

revoke all on function public.parceiro_minhas_marcas() from public, anon;
grant execute on function public.parceiro_minhas_marcas() to authenticated;

-- ── 4) O card aberto para de entregar a conversa do cliente ───────────────
-- O portal de aprovação é um canal entre a agência e o cliente dela. O que o
-- cliente escreve lá pode ser sobre preço, prazo ou sobre o próprio trabalho da
-- agência. O parceiro passa a ver só o que é dele: a conversa de produção.
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
    from public.post_approval_comments c
   where c.post_id = _post_id
     and coalesce(c.author_role, '') in ('parceiro', 'social_media');

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

-- ── 5) Cachê de quem foi desligado: o valor fica, o resto some ────────────
-- O dinheiro é dele e continua visível, sempre. Mas título de peça e nome de
-- cliente são dado da agência: com o vínculo pausado, viram rótulo genérico.
drop function if exists public.parceiro_meus_caches_detalhe();
create function public.parceiro_meus_caches_detalhe()
returns table (
  id uuid,
  valor numeric,
  status text,
  data date,
  descricao text,
  post_id uuid,
  post_titulo text,
  cliente_nome text,
  cliente_logo text,
  cliente_cor text,
  agencia_id uuid,
  agencia_nome text
)
language sql
stable
security definer
set search_path = public
as $$
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
    case when v.manager_id is null then 'Entrega' else p.title end,
    case when v.manager_id is null then 'Cliente'
         else coalesce(nullif(btrim(cc.name), ''), ec.name) end,
    case when v.manager_id is null then null else coalesce(cc.logo, ec.logo_url) end,
    case when v.manager_id is null then null else coalesce(cc.color, ec.brand_color) end,
    f.manager_id,
    coalesce(prof.name, 'Agência')
  from public.fin_records f
  left join vinculo v on v.manager_id = f.manager_id
  left join public.posts p on p.id = f.post_id
  left join public.external_clients ec on ec.id = p.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  left join public.profiles prof on prof.id = f.manager_id
  where f.assignee_id = auth.uid()
  order by f.date desc
  limit 300;
$$;

revoke all on function public.parceiro_meus_caches_detalhe() from public, anon;
grant execute on function public.parceiro_meus_caches_detalhe() to authenticated;

-- Conferência:
-- select public.acts_for_equipe('<manager_id>');   -- false logado como parceiro
-- select count(*) from public.capture_scripts;     -- 0 logado como parceiro
-- select * from public.parceiro_minhas_marcas();   -- só cliente recente e com vínculo
-- select public.parceiro_abrir_card('<post_id>') -> 'comentarios';  -- sem papel de cliente
