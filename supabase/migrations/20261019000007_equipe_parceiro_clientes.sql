-- PARCEIRO POR CLIENTE (Gabriela/Walter, 19/10/2026; mockup aprovado)
--
-- "Liberar acesso para o parceiro para os respectivos clientes, e não deixar
-- no geral." A dona marca em Equipe > Pessoas > Editar quais clientes cada
-- parceiro atende. Nada marcado (null ou vazio) = atende todos, como hoje.
--
-- Guarda ids de crm_clients (o mesmo id que o escopo do colaborador usa).
-- Um post chega no cliente assim:
--   post da agência          -> external_clients.crm_client_id
--   post da conta do cliente -> crm_clients.cria_owner_id = posts.user_id
-- Post sem cliente (nenhum dos dois) não é barrado.
--
-- Quem grava a coluna: as policies que já existem em manager_members (dona e
-- quem tem "Pode gerenciar a equipe"). O parceiro só lê a própria linha.

alter table public.manager_members
  add column if not exists clientes_atendidos uuid[];

comment on column public.manager_members.clientes_atendidos is
  'Parceiro: ids de crm_clients que ele atende. Null ou vazio = todos.';

-- O cliente (crm_clients.id) de um post, pela agência que delega.
create or replace function public.crm_cliente_do_post(_agencia uuid, _user_id uuid, _external_client_id uuid)
 returns uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(
    (select e.crm_client_id from public.external_clients e
      where e.id = _external_client_id and e.manager_id = _agencia),
    (select c.id from public.crm_clients c
      where _user_id <> _agencia and c.manager_id = _agencia
        and c.cria_owner_id = _user_id and c.deleted_at is null
      order by c.created_at limit 1)
  );
$function$;

-- O parceiro atende este cliente? Sem escopo ou sem cliente: sim.
create or replace function public.parceiro_atende_cliente(_agencia uuid, _parceiro uuid, _crm_client uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select _crm_client is null or coalesce((
    select coalesce(cardinality(m.clientes_atendidos), 0) = 0
           or _crm_client = any(m.clientes_atendidos)
      from public.manager_members m
     where m.manager_id = _agencia and m.member_id = _parceiro
     limit 1), true);
$function$;

-- Pro "Enviar para": quais parceiros desta conta atendem o cliente do post.
create or replace function public.parceiros_aptos_post(_post uuid)
 returns setof uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with p as (
    select coalesce(po.agencia_id, po.user_id) as ag, po.user_id, po.external_client_id
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
grant execute on function public.parceiros_aptos_post(uuid) to authenticated;

-- Agência sem post ainda (rascunho que o front ainda não salvou) usa esta:
-- parceiros aptos pra um cliente do CRM.
create or replace function public.parceiros_aptos_cliente(_manager uuid, _crm_client uuid)
 returns setof uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select m.member_id
    from public.manager_members m
   where m.manager_id = _manager
     and public.pode_gerir_parceiros(_manager)
     and m.status = 'ativo'
     and public.eh_papel_parceiro(m.role)
     and (_crm_client is null
          or coalesce(cardinality(m.clientes_atendidos), 0) = 0
          or _crm_client = any(m.clientes_atendidos));
$function$;
grant execute on function public.parceiros_aptos_cliente(uuid, uuid) to authenticated;

-- A trava também no banco: mandar peça de um cliente pra parceiro que não
-- atende esse cliente. Só olha quando o parceiro do post MUDA, então card
-- antigo não quebra. Mesmo gatilho de antes, um bloco a mais no fim.
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

  if _mudou_parceiro and new.assignee_id is not null and not public.parceiro_atende_cliente(
       coalesce(new.agencia_id, new.user_id), new.assignee_id,
       public.crm_cliente_do_post(coalesce(new.agencia_id, new.user_id), new.user_id, new.external_client_id)) then
    raise exception 'Essa pessoa não atende este cliente. Libere o cliente pra ela em Equipe > Pessoas > Editar.';
  end if;

  return new;
end; $function$;
