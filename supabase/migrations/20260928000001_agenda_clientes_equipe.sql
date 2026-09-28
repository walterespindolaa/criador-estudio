-- Agenda da colaboradora sem o modulo Gestao (28/09/2026).
-- crm_clients so abre pra colaboradora com cria_gestao (F22). Quem tem so a
-- Agenda via as captacoes como "Cliente". Esta RPC devolve SO o que a agenda
-- usa (nome, cor, aniversario, situacao), sem valores nem contatos, pra quem
-- tem o modulo agenda (e respeita o escopo por cliente).
create or replace function public.agenda_clientes_equipe(_manager uuid)
returns setof jsonb
language sql stable security definer set search_path = public as $$
  select (
    select jsonb_object_agg(e.key, e.value)
    from jsonb_each(to_jsonb(c)) e
    where e.key = any (array[
      'id','manager_id','name','display_name','color','birthday',
      'contract_end_date','status','active','cria_owner_id','logo','created_at'
    ])
  )
  from public.crm_clients c
  where c.manager_id = _manager
    and c.deleted_at is null
    and public.member_can_client(_manager, c.id, 'agenda')
  order by c.created_at desc
  limit 500;
$$;

revoke all on function public.agenda_clientes_equipe(uuid) from public, anon;
grant execute on function public.agenda_clientes_equipe(uuid) to authenticated;
