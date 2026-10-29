-- PARCEIRO NÃO APARECIA NO "MEU PERFIL" (29/10/2026).
-- No "Meu perfil" da agência (profiles.perfil_de = agência) o post é do perfil,
-- que não tem equipe. A função caía no próprio perfil como "agência" e a lista
-- do "Enviar pra produção" vinha vazia, mesmo com designer ativo na equipe.
-- Agora, antes de cair no dono do post, procura a agência dona do perfil.
-- O envio em si já funcionava (agencia_atende_conta aceita perfil_de).
create or replace function public.parceiros_aptos_post(_post uuid)
returns setof uuid
language sql stable security definer
set search_path to 'public'
as $function$
  with p as (
    select coalesce(
             po.agencia_id,
             case when public.pode_gerir_parceiros(po.user_id) then po.user_id end,
             (select c.manager_id from public.crm_clients c
               where c.cria_owner_id = po.user_id and c.deleted_at is null
                 and public.pode_gerir_parceiros(c.manager_id)
               order by c.created_at limit 1),
             (select pr.perfil_de from public.profiles pr
               where pr.id = po.user_id and pr.perfil_de is not null
                 and public.pode_gerir_parceiros(pr.perfil_de)),
             po.user_id) as ag,
           po.user_id, po.external_client_id
      from public.posts po where po.id = _post
  ), alvo as (
    select p.ag, public.crm_cliente_do_post(p.ag, p.user_id, p.external_client_id) as cli
      from p
  )
  select m.member_id
    from alvo
    join public.manager_members m on m.manager_id = alvo.ag
   where public.pode_gerir_parceiros(alvo.ag)
     and m.status = 'ativo'
     and public.eh_papel_parceiro(m.role)
     and (alvo.cli is null
          or coalesce(cardinality(m.clientes_atendidos), 0) = 0
          or alvo.cli = any(m.clientes_atendidos));
$function$;
