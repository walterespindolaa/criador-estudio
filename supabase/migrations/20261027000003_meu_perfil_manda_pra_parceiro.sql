-- Meu perfil manda pra parceiro (Walter, 27/10/2026: "coloquei posts no Kollab
-- mas não consigo mandar pra design, porque não tenho a ficha do cliente").
-- O gatilho posts_guard_parceiro exige que a agência "atenda" a conta dona do
-- post, e isso só olhava a carteira (crm_clients). O Meu perfil não entra na
-- carteira de propósito (não conta no limite de clientes), então era recusado.
-- Agora a conta que é o Meu perfil da agência (profiles.perfil_de) também conta.
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
       and c.deleted_at is null)
  or exists (
    select 1 from public.profiles p
     where p.id = _conta
       and p.perfil_de = _agencia);
$function$;
