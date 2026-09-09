-- ═══════════════════════════════════════════════════════════════════════════
-- A FICHA DA MARCA DO PARCEIRO (09/09/2026)
--
-- Hoje a identidade do cliente (cor, hashtags, logo) é repetida DENTRO de cada
-- card de peça. O Walter apontou o certo olhando o Trello da Gabriela: lá existe
-- um card fixo "Infos Clientes" por cliente, com material da marca, referências
-- visuais, redes, site e as regras permanentes ("não usar o Frederico nas fotos
-- individuais"). Isso não é informação de PEÇA, é informação de CLIENTE. Repetir
-- em todo card é ruído; o lugar disso é uma ficha por marca.
--
-- Esta função é o que alimenta essa ficha. Duas decisões de escopo:
--
-- 1. O parceiro vê a marca de um cliente SOMENTE se já recebeu (ou recebe) uma
--    peça dele. Vínculo com a agência não basta: seria abrir a carteira inteira
--    do gestor pra quem foi contratado pra três posts.
-- 2. Devolve só o que serve pra PRODUZIR (identidade, material, tom, o que
--    evitar). Nada de financeiro do cliente, contrato, contatos ou persona
--    comercial: isso é da agência, não de quem executa a peça.
-- ═══════════════════════════════════════════════════════════════════════════

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
  -- Números que dizem o tamanho da relação com aquela marca.
  abertos integer,
  entregues_30d integer,
  -- Identidade e direção, tudo do Brandbook que a agência já preenche.
  paleta text,
  fontes text,
  tom_de_voz text,
  temas text,
  evitar text,
  observacoes text,
  segmento text,
  -- Referências visuais que a agência subiu na ficha do cliente.
  referencias jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with minhas as (
    -- Os clientes de quem eu já peguei peça, com o gestor dono.
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
      where p2.external_client_id = ec.id
        and p2.assignee_id = auth.uid()
        and p2.deleted_at is null
        and coalesce(p2.producao_status, 'aguardando') <> 'entregue'),
    (select count(*)::int from public.posts p3
      where p3.external_client_id = ec.id
        and p3.assignee_id = auth.uid()
        and p3.deleted_at is null
        and p3.producao_status = 'entregue'
        and p3.updated_at >= now() - interval '30 days'),
    nullif(btrim(cc.brand_core->>'colorPalette'), ''),
    nullif(btrim(cc.brand_core->>'typography'), ''),
    nullif(btrim(cc.brand_core->>'toneOfVoice'), ''),
    nullif(btrim(cc.brand_core->>'contentThemes'), ''),
    nullif(btrim(cc.brand_core->>'avoid'), ''),
    nullif(btrim(cc.notes), ''),
    nullif(btrim(cc.segment), ''),
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

-- Conferência (rodar logado como parceiro):
-- select * from public.parceiro_minhas_marcas();
