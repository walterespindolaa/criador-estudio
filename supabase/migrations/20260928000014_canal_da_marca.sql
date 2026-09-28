-- ============================================================
-- CANAL DA MARCA · CICLO 2 (Walter, 28/09/2026)
--
-- "Um canal direto entre as informações que a social media quer deixar
-- sempre disponível pro designer: links úteis, link do drive, informações de
-- dentro do cliente. Hoje deve ter, mas procurei um monte e não achei."
--
-- Existia metade: os Links úteis do cliente (crm_clients.useful_links) já
-- chegavam no card, escondidos numa coluna do meio. Faltavam duas coisas que
-- a social mídia repete peça por peça no WhatsApp:
--   * a PASTA GERAL do cliente (fotos, logos, vídeos brutos), que vale pra
--     toda peça, diferente da "pasta desta peça" do post;
--   * um RECADO FIXO pro parceiro ("logo branca em fundo escuro", "nunca usar
--     vermelho", "fotos novas na pasta Junho").
--
-- Os dois moram no cliente (crm_clients), são editados na Equipe > Canal da
-- marca e chegam em TODO card daquele cliente e na ficha da marca.
--
-- Por que colunas novas e não `notes`: notes é a anotação interna da agência
-- sobre o cliente e foi tirada do parceiro de propósito em 14/09 (vazamento).
-- O recado é escrito JÁ sabendo que o parceiro vai ler.
--
-- Não mexe na RLS de posts. Idempotente.
-- ============================================================

alter table public.crm_clients
  add column if not exists pasta_parceiros text,
  add column if not exists recado_parceiros text;

-- Só link http(s): o parceiro abre isso com um clique (revisão 28/09).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'crm_clients_pasta_parceiros_http') then
    alter table public.crm_clients add constraint crm_clients_pasta_parceiros_http
      check (pasta_parceiros is null or pasta_parceiros ~* '^https?://');
  end if;
end $$;

comment on column public.crm_clients.pasta_parceiros is
  'Pasta geral do cliente pros parceiros (Drive/Dropbox). Aparece em todo card do cliente.';
comment on column public.crm_clients.recado_parceiros is
  'Recado fixo da social mídia pros parceiros deste cliente. Escrito pra ser lido por terceiros.';

-- ── 1) A ficha da marca do parceiro passa a trazer pasta e recado ────────
/* Mesma assinatura de 20260914000002, então create or replace basta.
   `observacoes` estava sempre nula desde o fechamento do vazamento: volta a
   ter conteúdo, agora com o RECADO (escrito pro parceiro), nunca com notes.
   A pasta geral entra como o primeiro link da lista, com rótulo fixo. */
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
    -- O recado escrito PRO parceiro. `cc.notes` continua fora (é interno).
    nullif(btrim(cc.recado_parceiros), ''),
    nullif(btrim(cc.segment), ''),
    (case when nullif(btrim(cc.pasta_parceiros), '') is not null
          then jsonb_build_array(jsonb_build_object('label', 'Pasta geral do cliente', 'url', btrim(cc.pasta_parceiros)))
          else '[]'::jsonb end)
      || coalesce(cc.useful_links, '[]'::jsonb),
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

-- ── 2) O card traz o canal da marca, nos dois lados ───────────────────────
/* Corpo copiado de 20260920000003 (a versão no banco). Entram três chaves:
   canal_recado, canal_pasta e canal_links. Com elas o card mostra o mesmo
   material pro parceiro e pra social mídia, sem cada lado buscar de um jeito
   (antes a agência lia do CRM e o parceiro da ficha, e um podia ver o que o
   outro não via). */
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
    'canal_pasta', nullif(btrim(_cc.pasta_parceiros), ''),
    'canal_links', coalesce(_cc.useful_links, '[]'::jsonb),
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
