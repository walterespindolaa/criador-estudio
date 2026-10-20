-- CANAL DA MARCA PRO CLIENTE QUE USA O CRIA (Walter, 20/10/2026: "ajuste o canal da marca").
-- Desde 19/10 o post de um cliente com conta no Cria pode ir pro designer
-- (posts.agencia_id = agência, posts.user_id = conta do cliente, sem external_client_id).
-- A fila e o card já resolviam a ficha por crm_clients.cria_owner_id, mas a lista
-- "Minhas marcas" só olhava external_client_id: a marca não aparecia em Marcas,
-- nem na coluna do quadro, nem no botão da ficha dentro do card.
-- Agora entra também por esse caminho. A chave dessas marcas é o id da ficha do CRM
-- (não existe external_client), e o front casa por ela (card.crm_client_id) ou pelo nome.
create or replace function public.parceiro_minhas_marcas()
 returns table(external_client_id uuid, nome text, handle text, logo text, cor text, hashtags text[], agencia_id uuid, agencia_nome text, abertos integer, entregues_30d integer, paleta text, fontes text, expressao_visual text, tom_de_voz text, personalidade text, estilo_comunicacao text, arquetipo text, temas text, ideia_central text, promessa text, publico text, oferta text, evitar text, observacoes text, segmento text, links jsonb, referencias jsonb)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with base as (
    select p.external_client_id, p.user_id as conta, coalesce(p.agencia_id, p.user_id) as manager_id
    from public.posts p
    join public.manager_members m
      on m.manager_id = coalesce(p.agencia_id, p.user_id)
     and m.member_id = auth.uid()
     and m.status = 'ativo'
    where p.assignee_id = auth.uid()
      and p.deleted_at is null
      and (p.external_client_id is not null or p.agencia_id is not null)
      and (
        coalesce(p.producao_status, 'aguardando') <> 'entregue'
        or coalesce(p.assigned_at, p.created_at) >= now() - interval '180 days'
      )
  ),
  minhas as (
    -- cliente da carteira (external_client)
    select distinct b.external_client_id as chave, b.manager_id, ec.id as ec_id, ec.crm_client_id as cc_id, null::uuid as conta
      from base b join public.external_clients ec on ec.id = b.external_client_id
    union
    -- cliente com conta no Cria: a ficha do CRM da agência que aponta pra conta
    (select distinct on (b.conta, b.manager_id) x.id, b.manager_id, null::uuid, x.id, b.conta
       from base b
       join public.crm_clients x
         on x.manager_id = b.manager_id and x.cria_owner_id = b.conta and x.deleted_at is null
      where b.external_client_id is null
      order by b.conta, b.manager_id, x.created_at)
  )
  select
    m.chave,
    coalesce(nullif(btrim(cc.name), ''), ec.name, 'Cliente'),
    coalesce(ec.instagram_handle, cc.instagram),
    coalesce(cc.logo, ec.logo_url),
    coalesce(cc.color, ec.brand_color),
    case when public.parceiro_ve(k.c, 'hashtags') then cc.hashtags end,
    m.manager_id,
    coalesce(prof.name, 'Agência'),
    (select count(*)::int from public.posts p2
      where p2.assignee_id = auth.uid() and p2.deleted_at is null
        and coalesce(p2.producao_status, 'aguardando') <> 'entregue'
        and (case when m.ec_id is not null then p2.external_client_id = m.ec_id
                  else p2.external_client_id is null and p2.user_id = m.conta and p2.agencia_id = m.manager_id end)),
    (select count(*)::int from public.posts p3
      where p3.assignee_id = auth.uid() and p3.deleted_at is null
        and p3.producao_status = 'entregue'
        and p3.updated_at >= now() - interval '30 days'
        and (case when m.ec_id is not null then p3.external_client_id = m.ec_id
                  else p3.external_client_id is null and p3.user_id = m.conta and p3.agencia_id = m.manager_id end)),
    ml ->> 'paleta',
    ml ->> 'fontes',
    ml ->> 'expressao_visual',
    ml ->> 'tom_de_voz',
    ml ->> 'personalidade',
    ml ->> 'estilo_comunicacao',
    ml ->> 'arquetipo',
    ml ->> 'temas',
    ml ->> 'ideia_central',
    ml ->> 'promessa',
    ml ->> 'publico',
    ml ->> 'oferta',
    ml ->> 'evitar',
    -- O recado escrito PRO parceiro sempre vai. `cc.notes` continua fora.
    nullif(btrim(cc.recado_parceiros), ''),
    ml ->> 'segmento',
    case when cc.id is null then '[]'::jsonb else public.links_para_parceiro(cc) end,
    coalesce(ml -> 'referencias', '[]'::jsonb)
  from minhas m
  left join public.external_clients ec on ec.id = m.ec_id
  left join public.crm_clients cc on cc.id = m.cc_id
  left join public.profiles prof on prof.id = m.manager_id
  cross join lateral (select coalesce(cc.compartilhar_parceiros, '{}'::jsonb) as c) k
  cross join lateral (select case when cc.id is null then '{}'::jsonb else public.marca_para_parceiro(cc) end as ml) mm
  order by 9 desc, 2;
$function$;
