-- ENVIAR PARA: PARCEIRO SUMIA EM POST DE CLIENTE COM CONTA CRIA (Walter, 19/10/2026)
--
-- Causa: post feito na conta Cria do cliente nasce com agencia_id nulo. A
-- função tratava o próprio cliente como agência, não achava parceiro nenhum e
-- o "Enviar para" ficava vazio (ex.: Cria Social Club com a Ágatha marcada).
-- Agora, sem agencia_id, a agência é: o dono do post se ele gerencia parceiros;
-- senão a agência que tem esse cliente na carteira (crm_clients.cria_owner_id)
-- e onde quem chama pode gerir parceiros.

create or replace function public.parceiros_aptos_post(_post uuid)
 returns setof uuid
 language sql
 stable security definer
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
