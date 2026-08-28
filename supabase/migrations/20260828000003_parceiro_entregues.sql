-- ============================================================
-- CRIA PARCEIROS · o histórico de entregas
--
-- A área do parceiro tem uma tela "Entregues": é o portfólio do trabalho e a
-- base da cobrança ("entreguei 34 peças pra você este mês"). A fila
-- (parceiro_minha_fila) esconde o entregue de propósito; esta função é o
-- espelho dela, só com o que já saiu da mão.
-- ============================================================

create or replace function public.parceiro_entregues()
returns table (
  post_id uuid,
  titulo text,
  formato text,
  entregue_em timestamptz,
  publica_em date,
  agencia_id uuid,
  agencia_nome text,
  cliente_nome text,
  cliente_cor text,
  cliente_logo text
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.title, p.format, p.updated_at, p.scheduled_date,
    p.user_id, coalesce(prof.name, 'Agência'),
    coalesce(cc.name, ec.name, 'Cliente'),
    cc.color, cc.logo
  from public.posts p
  join public.manager_members m
    on m.manager_id = p.user_id
   and m.member_id = auth.uid()
   and m.status = 'ativo'
  left join public.profiles prof on prof.id = p.user_id
  left join public.external_clients ec on ec.id = p.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  where p.assignee_id = auth.uid()
    and p.producao_status = 'entregue'
  order by p.updated_at desc
  limit 200;
$$;
revoke all on function public.parceiro_entregues() from public, anon;
grant execute on function public.parceiro_entregues() to authenticated;
