-- ============================================================
-- CRIA PARCEIROS · quem me acoplou e o que já entreguei
--
-- A tela do parceiro estava crua: fila e mais nada. Faltava o contexto que o
-- mockup prometeu: QUEM são as agências que me acoplaram, quanto está na minha
-- mão em cada uma, e quanto eu já entreguei. Essa última contagem é a semente
-- da monetização (o "quanto cada agência me deve" da fase 3), então ela nasce
-- aqui mesmo, antes de virar relatório.
--
-- Mesma regra da fase 1: o parceiro não enxerga tabela nenhuma, só RPCs
-- security definer que conferem o vínculo na unha.
-- ============================================================

create or replace function public.parceiro_minhas_agencias()
returns table (
  agencia_id uuid,
  agencia_nome text,
  meu_papel text,
  vinculo_status text,
  -- cards na minha mão agora (não entregues)
  abertos integer,
  -- entregues nos últimos 30 dias: o número que vira conversa de cobrança
  entregues_30d integer
)
language sql stable security definer set search_path = public as $$
  select
    m.manager_id,
    coalesce(prof.name, m.email, 'Agência'),
    m.role,
    m.status,
    (select count(*)::int from public.posts p
      where p.user_id = m.manager_id
        and p.assignee_id = auth.uid()
        and coalesce(p.producao_status, 'aguardando') <> 'entregue'),
    (select count(*)::int from public.posts p
      where p.user_id = m.manager_id
        and p.assignee_id = auth.uid()
        and p.producao_status = 'entregue'
        and p.updated_at >= now() - interval '30 days')
  from public.manager_members m
  left join public.profiles prof on prof.id = m.manager_id
  where m.member_id = auth.uid()
    and m.status = 'ativo'
    and public.eh_papel_parceiro(m.role)
  order by 5 desc, 2;
$$;
revoke all on function public.parceiro_minhas_agencias() from public, anon;
grant execute on function public.parceiro_minhas_agencias() to authenticated;

-- ============================================================
-- Conferência (só leitura)
-- ============================================================
-- select * from public.parceiro_minhas_agencias();
