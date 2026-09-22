-- ============================================================
-- COMISSÃO DE PARCEIRA: DE PAGAMENTO ÚNICO PRA RECORRENTE
-- (Walter, 22/09/2026)
--
-- O QUE ESTAVA ERRADO
-- Quatro telas prometiam "comissao recorrente, todo mes, enquanto a pessoa
-- seguir assinante". O webhook gravava o valor UMA vez, na primeira fatura, e
-- na renovacao so incrementava um contador. Uma assinatura de 24 meses pagava
-- o mesmo que uma de 2. Recrutar influenciadora em cima dessa promessa e o
-- jeito mais rapido de virar print no story alheio.
--
-- A DECISAO (regra padrao, ajustavel)
--   20% da receita, por ate 12 meses, comecando a contar na 3a fatura.
-- A trava da 3a fatura veio da ideia do Walter e e o melhor pedaco do desenho:
-- sem cliente firme, sem comissao. Acaba com o incentivo de trazer cadastro
-- ruim so pra bater meta.
--
-- A MUDANCA ESTRUTURAL
-- Antes: UMA linha por assinatura (partner_referrals), com o valor dentro.
-- Agora: a linha da assinatura continua sendo o VINCULO (quem indicou quem), e
-- cada fatura que gera comissao vira um LANCAMENTO proprio.
--
-- Isso resolve tres coisas de uma vez:
--   1. recorrencia deixa de ser gambiarra: sao N lancamentos, nao um valor
--      que alguem precisa lembrar de somar;
--   2. idempotencia de verdade. O unique em stripe_invoice_id fecha o bug
--      classificado como CRITICO na auditoria (entregas concorrentes de
--      invoice.paid adiantando comissao). Agora o banco recusa a duplicata,
--      nao o codigo;
--   3. fechamento mensal fica trivial: agrupa lancamento por competencia.
--
-- Nada e apagado. partner_referrals continua existindo com o historico, e o
-- backfill transforma o que ja foi pago em lancamento, pra conta nao mudar
-- debaixo de ninguem.
-- ============================================================

-- ── 1. A REGRA, CONFIGURÁVEL ────────────────────────────────────────────────
-- Global em partner_program_config; cada parceira pode ter o seu override.
-- Null no override = usa o global. É o que permite dar condição melhor pra uma
-- parceira grande sem criar um segundo programa.
alter table public.partner_program_config
  add column if not exists commission_pct    numeric(5,2) not null default 20.00,
  add column if not exists commission_months int          not null default 12,
  add column if not exists start_invoice     int          not null default 3;

comment on column public.partner_program_config.commission_pct is
  'Percentual da receita que vai pra parceira. Padrao 20.';
comment on column public.partner_program_config.commission_months is
  'Teto de meses de comissao por cliente indicado. Padrao 12.';
comment on column public.partner_program_config.start_invoice is
  'A partir de qual fatura a comissao comeca. 3 = so paga se o cliente passar de 2 meses.';

insert into public.partner_program_config (id, deduction_pct, grace_invoices, commission_pct, commission_months, start_invoice)
values (true, 10, 2, 20.00, 12, 3)
on conflict (id) do update set
  commission_pct    = coalesce(public.partner_program_config.commission_pct, 20.00),
  commission_months = coalesce(public.partner_program_config.commission_months, 12),
  start_invoice     = coalesce(public.partner_program_config.start_invoice, 3);

alter table public.partners
  add column if not exists commission_pct    numeric(5,2),
  add column if not exists commission_months int,
  add column if not exists start_invoice     int,
  add column if not exists cache_cents       int not null default 0,
  add column if not exists cache_note        text;

comment on column public.partners.commission_pct is
  'Override do percentual desta parceira. Null = usa o global.';
comment on column public.partners.cache_cents is
  'Cache fixo combinado com esta parceira (so registro: o pagamento e por fora).';

-- Regra efetiva de uma parceira: o override dela, senao o global.
create or replace function public.partner_regra(_partner_id uuid)
returns table (pct numeric, meses int, fatura_inicial int)
language sql stable security definer set search_path = public as $$
  select
    coalesce(p.commission_pct,    c.commission_pct,    20.00),
    coalesce(p.commission_months, c.commission_months, 12),
    coalesce(p.start_invoice,     c.start_invoice,     3)
  from public.partners p
  left join public.partner_program_config c on c.id = true
  where p.id = _partner_id;
$$;
revoke execute on function public.partner_regra(uuid) from anon;
grant execute on function public.partner_regra(uuid) to authenticated, service_role;


-- ── 2. O LANÇAMENTO, UM POR FATURA ──────────────────────────────────────────
create table if not exists public.partner_commission_entries (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.partner_referrals(id) on delete cascade,
  partner_id  uuid not null references public.partners(id) on delete cascade,
  -- ESTA é a trava de idempotência. Stripe reentrega webhook; o banco recusa.
  stripe_invoice_id text not null unique,
  stripe_subscription_id text,
  -- Qual fatura da assinatura é esta (1 = primeira). Define se entra na regra.
  invoice_seq int not null,
  gross_cents int not null,
  commission_pct numeric(5,2) not null,
  amount_cents int not null,
  currency text not null default 'brl',
  -- Competência pro fechamento mensal (fuso de Brasília, que é o do caixa).
  competencia date not null,
  status text not null default 'payable'
    check (status in ('payable','paid','canceled')),
  payout_id uuid,
  canceled_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pce_partner    on public.partner_commission_entries(partner_id, competencia);
create index if not exists idx_pce_referral   on public.partner_commission_entries(referral_id);
create index if not exists idx_pce_status     on public.partner_commission_entries(status) where status = 'payable';

alter table public.partner_commission_entries enable row level security;

-- A parceira lê os lançamentos dela; admin lê tudo.
drop policy if exists pce_select on public.partner_commission_entries;
create policy pce_select on public.partner_commission_entries
  for select to authenticated using (
    exists (select 1 from public.partners p where p.id = partner_id and p.user_id = auth.uid())
    or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin')
  );

comment on table public.partner_commission_entries is
  'Um lancamento por fatura paga que gera comissao. Unique no invoice_id garante idempotencia.';


-- ── 3. O FECHAMENTO MENSAL ──────────────────────────────────────────────────
create table if not exists public.partner_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  competencia date not null,
  total_cents int not null,
  entries_count int not null default 0,
  status text not null default 'aberto' check (status in ('aberto','pago','cancelado')),
  paid_at timestamptz,
  paid_by uuid references auth.users(id),
  proof_url text,
  note text,
  created_at timestamptz not null default now(),
  unique (partner_id, competencia)
);

create index if not exists idx_payout_comp on public.partner_payouts(competencia, status);
alter table public.partner_payouts enable row level security;

drop policy if exists payout_select on public.partner_payouts;
create policy payout_select on public.partner_payouts
  for select to authenticated using (
    exists (select 1 from public.partners p where p.id = partner_id and p.user_id = auth.uid())
    or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin')
  );

comment on table public.partner_payouts is
  'Fechamento de um mes pra uma parceira. Agrupa lancamentos e registra o PIX pago.';


-- ── 4. BACKFILL: O QUE JÁ EXISTE VIRA LANÇAMENTO ────────────────────────────
-- Indicação que já estava payable ou paid tinha valor guardado na própria
-- linha. Vira um lançamento da competência em que nasceu, com o mesmo valor,
-- pra ninguém ver o saldo mudar do nada. Fica fora quem está pending (ainda em
-- carência) e quem foi cancelado.
insert into public.partner_commission_entries
  (referral_id, partner_id, stripe_invoice_id, stripe_subscription_id, invoice_seq,
   gross_cents, commission_pct, amount_cents, currency, competencia, status, created_at)
select
  r.id, r.partner_id,
  coalesce(r.first_invoice_id, 'legado-' || r.id::text),
  r.stripe_subscription_id,
  1,
  coalesce(r.gross_amount_cents, 0),
  coalesce(r.deduction_pct, 10),
  coalesce(r.net_amount_cents, 0),
  coalesce(r.currency, 'brl'),
  date_trunc('month', coalesce(r.unlocked_at, r.created_at) at time zone 'America/Sao_Paulo')::date,
  case when r.status = 'paid' then 'paid' else 'payable' end,
  coalesce(r.unlocked_at, r.created_at)
from public.partner_referrals r
where r.status in ('payable', 'paid')
on conflict (stripe_invoice_id) do nothing;


-- ── 5. O EXTRATO DA PARCEIRA ────────────────────────────────────────────────
create or replace function public.parceira_meu_extrato()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  _pid uuid; _r record; _out jsonb;
begin
  select id into _pid from public.partners
   where user_id = auth.uid() and status = 'approved' limit 1;
  if _pid is null then return null; end if;

  select * into _r from public.partner_regra(_pid);

  select jsonb_build_object(
    'regra', jsonb_build_object(
      'pct', _r.pct, 'meses', _r.meses, 'fatura_inicial', _r.fatura_inicial,
      'cupom', (select coupon_code from public.partners where id = _pid),
      'cache_cents', (select cache_cents from public.partners where id = _pid)
    ),
    'totais', (
      select jsonb_build_object(
        'a_receber', coalesce(sum(amount_cents) filter (where status = 'payable'), 0),
        'recebido',  coalesce(sum(amount_cents) filter (where status = 'paid'), 0),
        'lancamentos', count(*)
      ) from public.partner_commission_entries where partner_id = _pid
    ),
    -- Clientes indicados: o que a parceira quer ver primeiro. Em carencia e
    -- quem ainda nao chegou na fatura de inicio, e por isso nao rendeu nada.
    'clientes', (
      select coalesce(jsonb_agg(x order by (x->>'desde') desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'nome', coalesce(pr.name, 'Cliente'),
          'desde', r.created_at,
          'faturas', coalesce(r.paid_invoices_count, 0),
          'em_carencia', coalesce(r.paid_invoices_count, 0) < _r.fatura_inicial,
          'ativo', r.status <> 'canceled',
          'ja_rendeu', coalesce((
            select sum(e.amount_cents) from public.partner_commission_entries e
             where e.referral_id = r.id and e.status <> 'canceled'), 0)
        ) as x
        from public.partner_referrals r
        left join public.profiles pr on pr.id = r.referred_user_id
        where r.partner_id = _pid
        limit 100
      ) s
    ),
    'fechamentos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'competencia', competencia, 'total_cents', total_cents,
        'status', status, 'pago_em', paid_at
      ) order by competencia desc), '[]'::jsonb)
      from public.partner_payouts where partner_id = _pid limit 24
    )
  ) into _out;
  return _out;
end; $$;
revoke execute on function public.parceira_meu_extrato() from anon;
grant execute on function public.parceira_meu_extrato() to authenticated;


-- ── 6. O PAINEL DO ADMIN ────────────────────────────────────────────────────
create or replace function public.admin_parceiras_resumo()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare _out jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return null;
  end if;

  select jsonb_build_object(
    'totais', (
      select jsonb_build_object(
        'a_pagar',   coalesce(sum(amount_cents) filter (where status = 'payable'), 0),
        'pago_total',coalesce(sum(amount_cents) filter (where status = 'paid'), 0),
        'mes_atual', coalesce(sum(amount_cents) filter (
                       where status = 'payable'
                         and competencia = date_trunc('month', now() at time zone 'America/Sao_Paulo')::date), 0)
      ) from public.partner_commission_entries
    ),
    'parceiras', (
      select coalesce(jsonb_agg(x order by (x->>'a_pagar')::bigint desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'id', p.id, 'nome', p.name, 'cupom', p.coupon_code,
          'pix', p.pix_key, 'status', p.status,
          'clientes', (select count(*) from public.partner_referrals r where r.partner_id = p.id),
          'clientes_ativos', (select count(*) from public.partner_referrals r
                               where r.partner_id = p.id and r.status <> 'canceled'),
          'receita_gerada', coalesce((select sum(e.gross_cents) from public.partner_commission_entries e
                                       where e.partner_id = p.id and e.status <> 'canceled'), 0),
          'a_pagar', coalesce((select sum(e.amount_cents) from public.partner_commission_entries e
                                where e.partner_id = p.id and e.status = 'payable'), 0),
          'ja_pago', coalesce((select sum(e.amount_cents) from public.partner_commission_entries e
                                where e.partner_id = p.id and e.status = 'paid'), 0)
        ) as x
        from public.partners p
        where p.status = 'approved'
      ) s
    ),
    -- O fechamento do mês, pronto pra pagar em lote. Só quem tem valor.
    'fechamento', (
      select coalesce(jsonb_agg(x order by (x->>'total')::bigint desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'partner_id', e.partner_id,
          'nome', p.name, 'pix', p.pix_key,
          'competencia', e.competencia,
          'lancamentos', count(*),
          'total', sum(e.amount_cents),
          'pago', exists (select 1 from public.partner_payouts po
                           where po.partner_id = e.partner_id
                             and po.competencia = e.competencia and po.status = 'pago')
        ) as x
        from public.partner_commission_entries e
        join public.partners p on p.id = e.partner_id
        where e.status = 'payable'
        group by e.partner_id, p.name, p.pix_key, e.competencia
      ) s
    )
  ) into _out;
  return _out;
end; $$;
revoke execute on function public.admin_parceiras_resumo() from anon;
grant execute on function public.admin_parceiras_resumo() to authenticated;


-- ── 7. FECHAR E PAGAR UMA COMPETÊNCIA ───────────────────────────────────────
-- Marca todos os lançamentos payable daquela parceira naquele mês como pagos e
-- guarda o comprovante. Em transação: ou fecha tudo, ou nada.
create or replace function public.admin_pagar_competencia(
  _partner_id uuid, _competencia date, _proof_url text default null, _note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare _total int; _qtd int; _payout uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'apenas admin';
  end if;

  select coalesce(sum(amount_cents), 0), count(*) into _total, _qtd
    from public.partner_commission_entries
   where partner_id = _partner_id and competencia = _competencia and status = 'payable';

  if _qtd = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'nada a pagar nesta competencia');
  end if;

  insert into public.partner_payouts
    (partner_id, competencia, total_cents, entries_count, status, paid_at, paid_by, proof_url, note)
  values
    (_partner_id, _competencia, _total, _qtd, 'pago', now(), auth.uid(), _proof_url, _note)
  on conflict (partner_id, competencia) do update set
    total_cents = excluded.total_cents, entries_count = excluded.entries_count,
    status = 'pago', paid_at = now(), paid_by = auth.uid(),
    proof_url = coalesce(excluded.proof_url, public.partner_payouts.proof_url),
    note = coalesce(excluded.note, public.partner_payouts.note)
  returning id into _payout;

  update public.partner_commission_entries
     set status = 'paid', payout_id = _payout
   where partner_id = _partner_id and competencia = _competencia and status = 'payable';

  return jsonb_build_object('ok', true, 'total_cents', _total, 'lancamentos', _qtd, 'payout_id', _payout);
end; $$;
revoke execute on function public.admin_pagar_competencia(uuid, date, text, text) from anon;
grant execute on function public.admin_pagar_competencia(uuid, date, text, text) to authenticated;
