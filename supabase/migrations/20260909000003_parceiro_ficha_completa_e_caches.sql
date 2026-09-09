-- ═══════════════════════════════════════════════════════════════════════════
-- FICHA DA MARCA COMPLETA + CACHÊ PEÇA A PEÇA (09/09/2026)
--
-- Duas correções do mesmo dia, depois do Walter ver a primeira versão:
--
-- 1. A ficha da marca trazia pouco. O Brandbook que a agência preenche tem
--    muito mais do que cor e fontes: oferta, público, arquétipo, personalidade,
--    expressão visual, ideia central, promessa. E, principalmente, tem
--    `useful_links`, que é o equivalente exato do "Material da Marca / Refs
--    Visuais / Site / Fotos Estúdio" que a Gabriela mantém no Trello. Quem
--    monta a arte precisa dos LINKS mais do que de qualquer texto.
--
-- 2. "Meus cachês" mostrava só o total por agência. O parceiro via "R$ 340 a
--    receber" e não sabia de quais entregas. O detalhe existe (fin_records com
--    assignee_id), mas ele não pode ler o Caixa da agência: vai por função.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) A ficha, agora completa ────────────────────────────────────────────
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
  -- Visual
  paleta text,
  fontes text,
  expressao_visual text,
  -- Voz
  tom_de_voz text,
  personalidade text,
  estilo_comunicacao text,
  arquetipo text,
  -- Conteúdo
  temas text,
  ideia_central text,
  promessa text,
  publico text,
  oferta text,
  -- Regras
  evitar text,
  observacoes text,
  segmento text,
  -- Material: os links que a agência guarda na ficha (Drive, Pinterest, site).
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
    where p.assignee_id = auth.uid()
      and p.external_client_id is not null
      and p.deleted_at is null
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
    nullif(btrim(cc.notes), ''),
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

-- ── 2) O cachê peça a peça ────────────────────────────────────────────────
-- Só as linhas do Caixa da agência que têm ESTE parceiro como responsável.
-- Nada mais do financeiro dela entra aqui.
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
  select
    f.id,
    f.amount,
    coalesce(f.status, 'pendente'),
    f.date,
    f.description,
    f.post_id,
    p.title,
    coalesce(nullif(btrim(cc.name), ''), ec.name),
    coalesce(cc.logo, ec.logo_url),
    coalesce(cc.color, ec.brand_color),
    f.manager_id,
    coalesce(prof.name, 'Agência')
  from public.fin_records f
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

-- Conferência (logado como parceiro):
-- select * from public.parceiro_minhas_marcas();
-- select * from public.parceiro_meus_caches_detalhe();
