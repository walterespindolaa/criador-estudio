-- FILA DO PARCEIRO: POST DE CLIENTE COM CONTA CRIA NÃO APARECIA (Walter/Gabriela, 19/10/2026)
--
-- Causa (provada rodando a função como a parceira): parceiro_minha_fila ligava o
-- post à agência por p.user_id. Post da conta Cria do cliente tem user_id = conta
-- do cliente e a agência em p.agencia_id. Como a parceira é membro da agência e
-- não da conta do cliente, o post ficava fora da fila. Agora usa
-- coalesce(agencia_id, user_id), como as outras funções do parceiro, e o nome do
-- cliente vem da ficha do CRM ligada à conta Cria quando não há external_client.

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
    coalesce(cc.name, ec.name, cco.name, 'Cliente'),
    coalesce(ec.instagram_handle, cco.instagram),
    coalesce(cc.color, cco.color), coalesce(cc.logo, cco.logo),
    p.internal_tags,
    p.prazo_status, p.prazo_sugerido,
    p.cache_parceiro,
    p.external_client_id,
    (select coalesce(nullif(btrim(m2.thumbnail_url), ''), nullif(btrim(m2.view_url), ''))
       from public.external_media_refs m2
      where m2.post_id = p.id and not m2.substituida
      order by m2.position asc nulls last, m2.created_at asc
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
    select x.name, x.logo, x.color, x.instagram from public.crm_clients x
     where p.agencia_id is not null and x.manager_id = p.agencia_id
       and x.cria_owner_id = p.user_id and x.deleted_at is null
     order by x.created_at limit 1) cco on true
  where p.assignee_id = auth.uid()
    and p.deleted_at is null
    and coalesce(p.producao_status, 'aguardando') <> 'entregue'
  order by coalesce(p.urgente, false) desc, p.prazo_producao asc nulls last, p.assigned_at asc;
$function$;
