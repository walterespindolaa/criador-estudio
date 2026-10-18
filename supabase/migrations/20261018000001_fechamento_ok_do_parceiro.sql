-- OK DO PARCEIRO NO FECHAMENTO (Walter, 18/10/2026: "dar um check que ja paguei
-- esses quadros ... e ela dar um OK la tbm").
--
-- Fonte de verdade continua sendo fin_records: pago/pendente e pago_em. O
-- parceiro só registra que recebeu (ou que não recebeu) o que o dono marcou
-- como pago. Agrupado por (agência, pago_em): um "pagamento" = tudo que foi
-- pago no mesmo dia pra essa pessoa.
--
-- JÁ APLICADO NO BANCO em 18/10/2026. Este arquivo é o registro.

alter table public.fin_records add column if not exists recebido_em timestamptz;
alter table public.fin_records add column if not exists recebido_contestado_em timestamptz;

-- Guarda: pagamento desfeito ou refeito zera o OK (senão um pagamento novo
-- nasceria "já confirmado").
do $$
declare _def text;
begin
  _def := pg_get_functiondef('public.fin_terceiro_guarda'::regproc);
  if position('recebido_em' in _def) = 0 then
    _def := replace(_def,
      E'      new.pago_em := coalesce(new.pago_em, (now() at time zone ''America/Sao_Paulo'')::date);\n',
      E'      new.pago_em := coalesce(new.pago_em, (now() at time zone ''America/Sao_Paulo'')::date);\n      new.recebido_em := null;\n      new.recebido_contestado_em := null;\n');
    _def := replace(_def,
      E'    new.pago_em := null;\n',
      E'    new.pago_em := null;\n    new.recebido_em := null;\n    new.recebido_contestado_em := null;\n');
    execute _def;
  end if;
end $$;

-- Pagamentos que a agência marcou pra mim, agrupados por dia de pagamento.
create or replace function public.parceiro_meus_pagamentos()
returns table(manager_id uuid, agencia text, pago_em date, total numeric, qtd integer,
              de date, ate date, recebido_em timestamptz, contestado_em timestamptz)
language sql stable security definer set search_path to 'public'
as $$
  select f.manager_id,
         coalesce(nullif(pr.name, ''), 'Agência') as agencia,
         f.pago_em,
         sum(f.amount) as total,
         count(*)::int as qtd,
         min(f.date) as de,
         max(f.date) as ate,
         case when bool_and(f.recebido_em is not null) then max(f.recebido_em) end as recebido_em,
         max(f.recebido_contestado_em) as contestado_em
  from public.fin_records f
  join public.profiles pr on pr.id = f.manager_id
  where f.assignee_id = auth.uid() and f.status = 'pago' and f.pago_em is not null
  group by f.manager_id, pr.name, f.pago_em
  order by f.pago_em desc
  limit 24;
$$;

-- Parceiro confirma (ou contesta) um pagamento. Só mexe no que é dele e já está pago.
create or replace function public.parceiro_confirmar_pagamento(_manager uuid, _pago_em date, _recebi boolean)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare _n int; _nome text; _total numeric;
begin
  if auth.uid() is null then raise exception 'Sem sessão'; end if;
  if _recebi then
    update public.fin_records
       set recebido_em = now(), recebido_contestado_em = null
     where assignee_id = auth.uid() and manager_id = _manager
       and status = 'pago' and pago_em = _pago_em;
  else
    update public.fin_records
       set recebido_em = null, recebido_contestado_em = now()
     where assignee_id = auth.uid() and manager_id = _manager
       and status = 'pago' and pago_em = _pago_em;
  end if;
  get diagnostics _n = row_count;
  if _n > 0 then
    select coalesce(nullif(name, ''), 'Seu parceiro') into _nome from public.profiles where id = auth.uid();
    select sum(amount) into _total from public.fin_records
     where assignee_id = auth.uid() and manager_id = _manager and status = 'pago' and pago_em = _pago_em;
    insert into public.notifications (user_id, type, title, description, link)
    values (_manager, 'parceiro',
            case when _recebi then _nome || ' confirmou o recebimento' else _nome || ' diz que não recebeu' end,
            'Pagamento de ' || to_char(_pago_em, 'DD/MM') || ': R$ ' || replace(to_char(_total, 'FM999G999G990D00'), ',', '.'),
            '/socialmidia/equipe/producao');
  end if;
  return _n;
end $$;

revoke all on function public.parceiro_confirmar_pagamento(uuid, date, boolean) from public, anon;
grant execute on function public.parceiro_confirmar_pagamento(uuid, date, boolean) to authenticated;
revoke all on function public.parceiro_meus_pagamentos() from public, anon;
grant execute on function public.parceiro_meus_pagamentos() to authenticated;
