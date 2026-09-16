-- ═══════════════════════════════════════════════════════════════════════════
-- CIRCUITO 12: O EXTRATO DO PARCEIRO (16/09/2026) · pedido do Walter
--
-- A social mídia tem o Relatório de produtividade num botão da Agenda: quanto a
-- operação produziu no período, comparado com o anterior. O parceiro não tinha
-- equivalente nenhum. No fim do mês ele abre "Entregues", conta peça por peça
-- na tela, soma de cabeça e manda um WhatsApp com um número que ele torce pra
-- estar certo. Quem paga confere do mesmo jeito: no olho.
--
-- O extrato é UM documento que responde três perguntas de uma vez:
--   o que eu fiz neste mês, PRA QUEM (cliente), e POR CONTA DE QUEM (a agência
--   que me contratou).
--
-- DUAS DECISÕES DE DATA:
--
-- 1. O FUSO. `entregue_em` e `feito_em` são timestamptz. Uma entrega às 21h do
--    dia 30/09 em Brasília é 00h do dia 01/10 em UTC: sem converter, ela cairia
--    no mês seguinte e o extrato mostraria um número diferente do que a pessoa
--    viveu. Num documento de cobrança isso não é detalhe, é erro. Por isso todo
--    recorte de período passa por `at time zone 'America/Sao_Paulo'`.
--
-- 2. O QUE CONTA COMO "FEITO". Peça entra pela data de ENTREGA, não pela de
--    criação nem pela de publicação: o trabalho dele acabou quando ele entregou.
--    Tarefa e compromisso entram pela data em que ele MARCOU como feito, que é
--    carimbada pelo banco (circuito 11) justamente pra isto.
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.parceiro_extrato(date, date);
create function public.parceiro_extrato(_de date, _ate date)
returns table (
  tipo text,            -- peca | tarefa | compromisso
  quando date,
  agencia_id uuid,
  agencia_nome text,
  cliente_nome text,
  cliente_cor text,
  referencia_id uuid,
  titulo text,
  formato text,
  revisoes integer,
  aprovacao text,
  cache numeric,
  pago boolean
)
language sql stable security definer set search_path = public as $$
  -- ── AS PEÇAS ENTREGUES ─────────────────────────────────────────────────
  select
    'peca'::text,
    (coalesce(p.entregue_em, p.updated_at) at time zone 'America/Sao_Paulo')::date,
    p.user_id,
    coalesce(prof.name, 'Agência')::text,
    coalesce(nullif(btrim(cc.name), ''), nullif(btrim(ec.name), ''), 'Cliente')::text,
    coalesce(cc.color, ec.brand_color)::text,
    p.id,
    coalesce(nullif(btrim(p.title), ''), 'Peça sem título')::text,
    p.format::text,
    coalesce(p.revisoes, 0)::int,
    p.approval_status::text,
    p.cache_parceiro::numeric,
    -- Pago é o que o Caixa da agência diz, não o que a peça diz: o lançamento
    -- é a única fonte que sabe se o dinheiro saiu.
    exists (
      select 1 from public.fin_records f
       where f.post_id = p.id
         and f.assignee_id = auth.uid()
         and coalesce(f.status, 'pendente') = 'pago'
    )
  from public.posts p
  -- O vínculo ATIVO é a mesma regra do circuito 1: desligado para de ver nome
  -- de cliente, inclusive olhando pra trás.
  join public.manager_members m
    on m.manager_id = p.user_id
   and m.member_id = auth.uid()
   and m.status = 'ativo'
  left join public.profiles prof on prof.id = p.user_id
  left join public.external_clients ec on ec.id = p.external_client_id
  left join public.crm_clients cc on cc.id = ec.crm_client_id
  where p.assignee_id = auth.uid()
    and p.deleted_at is null
    and p.producao_status = 'entregue'
    and (coalesce(p.entregue_em, p.updated_at) at time zone 'America/Sao_Paulo')::date
        between _de and _ate

  union all

  -- ── O QUE ELE FECHOU NA PRÓPRIA AGENDA ─────────────────────────────────
  -- Entra no extrato porque trabalho que não virou peça também é trabalho:
  -- "fui à gravação", "refiz a exportação", "reunião de briefing". Sem isso o
  -- extrato conta só o que tem arquivo no fim, que é menos do que ele fez.
  select
    i.tipo::text,
    coalesce((i.feito_em at time zone 'America/Sao_Paulo')::date, i.data),
    i.agencia_id,
    coalesce(prof2.name, 'Sem agência')::text,
    coalesce(nullif(btrim(cc2.name), ''), nullif(btrim(ec2.name), ''), '')::text,
    coalesce(cc2.color, ec2.brand_color)::text,
    i.id,
    i.titulo::text,
    null::text,
    null::int,
    null::text,
    null::numeric,
    null::boolean
  from public.parceiro_agenda_itens i
  left join public.profiles prof2 on prof2.id = i.agencia_id
  -- A peça amarrada só é lida quando continua sendo dele: o gatilho do circuito
  -- 11 garante isso na escrita, mas o vínculo pode ter sido pausado depois.
  left join public.posts p2
    on p2.id = i.post_id
   and p2.assignee_id = auth.uid()
   and exists (
     select 1 from public.manager_members m2
      where m2.manager_id = p2.user_id
        and m2.member_id = auth.uid()
        and m2.status = 'ativo'
   )
  left join public.external_clients ec2 on ec2.id = p2.external_client_id
  left join public.crm_clients cc2 on cc2.id = ec2.crm_client_id
  where i.parceiro_id = auth.uid()
    and i.feito
    and coalesce((i.feito_em at time zone 'America/Sao_Paulo')::date, i.data)
        between _de and _ate

  order by 2 desc, 4, 5;
$$;

revoke all on function public.parceiro_extrato(date, date) from public, anon;
grant execute on function public.parceiro_extrato(date, date) to authenticated;

-- Conferência (logado como parceiro):
-- select * from public.parceiro_extrato('2026-09-01', '2026-09-30');
