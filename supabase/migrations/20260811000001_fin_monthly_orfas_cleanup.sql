-- Limpeza das mensalidades ÓRFÃS do Cria Caixa.
--
-- Contexto do bug: quando um cliente do CRM é EXCLUÍDO (soft delete, ou seja,
-- crm_clients.deleted_at preenchido), a instância PENDENTE da mensalidade dele
-- em fin_monthly ficava órfã. Como o soft-delete NÃO dispara o "on delete cascade"
-- da FK fin_monthly.crm_client_id, a linha continuava viva apontando pra um cliente
-- que sumiu da carteira. No Caixa isso aparecia na lista "Mensalidades do mês" como
-- "Cliente" (sem nome, porque o join com a carteira viva dá null), com valor, marcada
-- como atrasada, e sem como remover (só "Pular").
--
-- Esta limpeza remove SÓ a cobrança NÃO realizada (status <> 'pago') cujo cliente
-- foi excluído (deleted_at not null) OU não existe mais (id solto). NUNCA toca em
-- instância 'pago': essa já virou receita real em fin_records e é histórico
-- financeiro de verdade. Instância sem cliente vinculado (crm_client_id null) também
-- não é tocada (não é órfã de exclusão de cliente).
--
-- Idempotente: rodar de novo não remove mais nada (as órfãs já se foram e as pagas
-- nunca entram no filtro).

delete from public.fin_monthly m
where m.status <> 'pago'
  and (
    -- cliente ainda existe na tabela, porém foi excluído (soft delete)
    exists (
      select 1 from public.crm_clients c
      where c.id = m.crm_client_id
        and c.deleted_at is not null
    )
    -- ou o cliente não existe mais (hard delete / id sem dono)
    or (
      m.crm_client_id is not null
      and not exists (
        select 1 from public.crm_clients c
        where c.id = m.crm_client_id
      )
    )
  );
