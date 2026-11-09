/* ═══════════════════════════════════════════════════════════════════════════
   CUPONS E PARCEIROS NUM PAINEL SÓ  (Walter, 09/11/2026, mockup aprovado)

   Antes: cupom de parceira morava em `partners` (um por pessoa, regra de
   comissão da pessoa), cupom de campanha em `cupons_campanha` (sem dono), e
   código criado direto na Stripe não aparecia em lugar nenhum. A tela de
   parceiras do admin chamava `admin_parceiras_resumo`, que lê `p.name`, uma
   coluna que não existe em `partners` (a coluna é `full_name`): a tela dava
   erro pra qualquer um.

   Agora:
   1. Todo cupom novo nasce em `cupons_campanha`, com ou sem dono. O dono é uma
      linha de `partners` (pode não ter conta no Cria: agência, assessor).
   2. A regra de comissão é do CUPOM: % da mensalidade, valor fixo ou nada, da
      mensalidade X até a Y. Desconto e comissão são independentes.
   3. Mensalidade conta só fatura PAGA (valor > 0). A fatura de R$ 0 do teste
      não é a "1ª mensalidade". Não muda nada do que já existe: até hoje não há
      nenhuma indicação nem lançamento no banco.
   4. `cupom_usos` guarda todo cliente que entrou por cupom (de parceira ou de
      campanha): em teste, pagante ou cancelado, quantas mensalidades pagou e
      quanto. É daí que saem usos, pagantes, receita e previsão.
   ═══════════════════════════════════════════════════════════════════════════ */

-- 1. Dono do cupom: pode não ter conta no Cria, e tem um tipo.
alter table public.partners alter column user_id drop not null;
alter table public.partners add column if not exists tipo_dono text not null default 'parceira';
alter table public.partners drop constraint if exists partners_tipo_dono_check;
alter table public.partners add constraint partners_tipo_dono_check
  check (tipo_dono in ('parceira', 'assessor', 'agencia'));
-- Regra "valor fixo por mensalidade" também pro cupom antigo de parceira.
alter table public.partners add column if not exists commission_fixed_cents integer;
alter table public.partners drop constraint if exists partners_commission_fixed_check;
alter table public.partners add constraint partners_commission_fixed_check
  check (commission_fixed_cents is null or commission_fixed_cents >= 0);

-- 2. Cupom com dono e regra de comissão própria.
alter table public.cupons_campanha
  add column if not exists partner_id uuid references public.partners(id) on delete restrict,
  add column if not exists comissao_tipo text not null default 'nenhuma',
  add column if not exists comissao_pct numeric,
  add column if not exists comissao_fixo_cents integer,
  add column if not exists comissao_de integer not null default 1,
  add column if not exists comissao_ate integer,
  add column if not exists criado_por uuid;
alter table public.cupons_campanha drop constraint if exists cupons_comissao_coerente;
alter table public.cupons_campanha add constraint cupons_comissao_coerente check (
  comissao_tipo in ('nenhuma', 'pct', 'fixo')
  and comissao_de between 1 and 36
  and (comissao_tipo = 'nenhuma' or (
        partner_id is not null
    and comissao_ate is not null and comissao_ate between comissao_de and 60
    and ((comissao_tipo = 'pct'  and comissao_pct > 0 and comissao_pct <= 100)
      or (comissao_tipo = 'fixo' and comissao_fixo_cents > 0)))));
create index if not exists cupons_campanha_partner on public.cupons_campanha (partner_id);

-- 3. De qual cupom veio cada indicação e cada lançamento.
alter table public.partner_referrals add column if not exists cupom_codigo text;
alter table public.partner_commission_entries add column if not exists cupom_codigo text;

-- 4. Todo cliente que entrou por cupom.
create table if not exists public.cupom_usos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  partner_id uuid references public.partners(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  stripe_subscription_id text not null unique,
  plano text,
  mensalidades_pagas integer not null default 0,
  ultima_mensalidade_cents integer not null default 0,
  receita_total_cents integer not null default 0,
  ultima_fatura_id text,
  status text not null default 'teste' check (status in ('teste', 'pagante', 'cancelado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists cupom_usos_codigo on public.cupom_usos (upper(codigo));
alter table public.cupom_usos enable row level security;
drop policy if exists cupom_usos_admin on public.cupom_usos;
create policy cupom_usos_admin on public.cupom_usos for select using (public.is_admin());

-- Webhook: registra a fatura paga do cliente que veio por cupom. Idempotente
-- pela fatura (reentrega do Stripe não soma duas vezes).
create or replace function public.cupom_uso_fatura(
  _sub text, _codigo text, _partner_id uuid, _user_id uuid, _plano text, _invoice text, _valor integer)
returns integer
language plpgsql security definer set search_path = public as $$
declare _n integer;
begin
  insert into public.cupom_usos (codigo, partner_id, user_id, stripe_subscription_id, plano)
  values (upper(btrim(_codigo)), _partner_id, _user_id, _sub, _plano)
  on conflict (stripe_subscription_id) do nothing;
  if coalesce(_valor, 0) > 0 then
    update public.cupom_usos
       set mensalidades_pagas = mensalidades_pagas + 1,
           ultima_mensalidade_cents = _valor,
           receita_total_cents = receita_total_cents + _valor,
           ultima_fatura_id = _invoice,
           status = 'pagante',
           plano = coalesce(_plano, plano),
           atualizado_em = now()
     where stripe_subscription_id = _sub
       and ultima_fatura_id is distinct from _invoice;
  end if;
  select mensalidades_pagas into _n from public.cupom_usos where stripe_subscription_id = _sub;
  return coalesce(_n, 0);
end $$;
revoke execute on function public.cupom_uso_fatura(text, text, uuid, uuid, text, text, integer) from public, anon, authenticated;

-- Regra de comissão de um cupom. Cupom novo: a regra dele. Cupom antigo de
-- parceira (em `partners`): a regra da parceira, que já existia.
create or replace function public.cupom_regra(_codigo text, _partner_id uuid)
returns table(tipo text, pct numeric, fixo_cents integer, de integer, ate integer)
language sql stable security definer set search_path = public as $$
  with novo as (
    select c.comissao_tipo, c.comissao_pct, c.comissao_fixo_cents, c.comissao_de, c.comissao_ate
      from public.cupons_campanha c
     where _codigo is not null and c.partner_id = _partner_id
       and upper(c.codigo) = upper(btrim(_codigo))
     limit 1
  )
  select * from novo
  union all
  select case when coalesce(p.commission_fixed_cents, 0) > 0 then 'fixo' else 'pct' end,
         r.pct, p.commission_fixed_cents, r.fatura_inicial, r.fatura_inicial + r.meses - 1
    from public.partners p
    cross join lateral public.partner_regra(p.id) r
   where p.id = _partner_id and not exists (select 1 from novo);
$$;
revoke execute on function public.cupom_regra(text, uuid) from public, anon, authenticated;

-- 5. Painel do admin.
create or replace function public.admin_cupons_painel()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  _mes date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  _out jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return null;
  end if;

  with cup as (
    select c.codigo, 'campanha'::text as origem, c.partner_id,
           c.dias_gratis, c.desconto_pct, c.desconto_meses, c.planos, c.limite_usos,
           c.usos, c.valido_ate,
           case when not c.ativo then 'pausado'
                when c.valido_ate is not null and c.valido_ate < now() then 'vencido'
                when c.limite_usos is not null and c.usos >= c.limite_usos then 'esgotado'
                else 'ativo' end as status,
           c.comissao_tipo, c.comissao_pct, c.comissao_fixo_cents, c.comissao_de, c.comissao_ate,
           c.criado_em
      from public.cupons_campanha c
    union all
    select p.coupon_code, 'parceira', p.id,
           0, coalesce(p.coupon_discount_pct, 0),
           case when p.coupon_type = 'client_discount' then coalesce(p.coupon_duration_months, 1) else 0 end,
           null, null,
           (select count(*) from public.partner_referrals r where r.partner_id = p.id)::int,
           null,
           case p.status when 'approved' then 'ativo' else 'pausado' end,
           rg.tipo, rg.pct, rg.fixo_cents, rg.de, rg.ate,
           coalesce(p.approved_at, p.created_at)
      from public.partners p
      cross join lateral public.cupom_regra(null, p.id) rg
     where p.coupon_code is not null and p.status in ('approved', 'suspended')
  ),
  linhas as (
    select cup.*, d.full_name as dono_nome, d.tipo_dono, d.pix_key as dono_pix,
      (select count(*) from public.cupom_usos u where upper(u.codigo) = upper(cup.codigo))::int as clientes,
      (select count(*) from public.cupom_usos u where upper(u.codigo) = upper(cup.codigo) and u.status = 'pagante')::int as pagantes,
      (select count(*) from public.cupom_usos u where upper(u.codigo) = upper(cup.codigo) and u.status = 'teste')::int as em_teste,
      (select coalesce(sum(u.ultima_mensalidade_cents), 0) from public.cupom_usos u
        where upper(u.codigo) = upper(cup.codigo) and u.status = 'pagante')::bigint as receita_mes,
      (select coalesce(sum(e.amount_cents), 0) from public.partner_commission_entries e
        where e.status = 'payable' and e.partner_id = cup.partner_id
          and (upper(e.cupom_codigo) = upper(cup.codigo) or (e.cupom_codigo is null and cup.origem = 'parceira')))::bigint as a_pagar,
      (select coalesce(sum(e.amount_cents), 0) from public.partner_commission_entries e
        where e.status = 'paid' and e.partner_id = cup.partner_id
          and (upper(e.cupom_codigo) = upper(cup.codigo) or (e.cupom_codigo is null and cup.origem = 'parceira')))::bigint as pago
      from cup
      left join public.partners d on d.id = cup.partner_id
  ),
  prev as (
    select gs.i,
           sum(case when rg.tipo = 'fixo' then rg.fixo_cents
                    else round(coalesce(nullif(u.ultima_mensalidade_cents, 0),
                                        (select e.gross_cents from public.partner_commission_entries e
                                          where e.referral_id = pr.id order by e.invoice_seq desc limit 1), 0)
                               * rg.pct / 100) end)::bigint as total
      from public.partner_referrals pr
      cross join lateral public.cupom_regra(pr.cupom_codigo, pr.partner_id) rg
      left join public.cupom_usos u on u.stripe_subscription_id = pr.stripe_subscription_id
      cross join generate_series(1, 4) gs(i)
     where pr.status <> 'canceled' and pr.modelo is distinct from 'legado'
       and coalesce(u.status, 'pagante') <> 'cancelado'
       and coalesce(pr.paid_invoices_count, 0) + gs.i between rg.de and rg.ate
     group by gs.i
  )
  select jsonb_build_object(
    'mes', _mes,
    'cupons', coalesce((select jsonb_agg(to_jsonb(l) order by (l.status = 'ativo') desc, l.a_pagar desc, l.criado_em desc) from linhas l), '[]'::jsonb),
    'kpis', jsonb_build_object(
      'a_pagar_fechado', (select coalesce(sum(amount_cents), 0) from public.partner_commission_entries
                           where status = 'payable' and competencia < _mes),
      'a_pagar_total',   (select coalesce(sum(amount_cents), 0) from public.partner_commission_entries where status = 'payable'),
      'pessoas_a_pagar', (select count(distinct partner_id) from public.partner_commission_entries
                           where status = 'payable' and competencia < _mes),
      'cupons_ativos',   (select count(*) from linhas where status = 'ativo'),
      'cupons_com_dono', (select count(*) from linhas where status = 'ativo' and partner_id is not null),
      'clientes',        (select count(*) from public.cupom_usos),
      'pagantes',        (select count(*) from public.cupom_usos where status = 'pagante'),
      'em_teste',        (select count(*) from public.cupom_usos where status = 'teste'),
      'receita_mes',     (select coalesce(sum(ultima_mensalidade_cents), 0) from public.cupom_usos where status = 'pagante'),
      'previsto_3m',     (select coalesce(sum(total), 0) from prev where i <= 3)
    ),
    'previsao', coalesce((select jsonb_agg(jsonb_build_object(
                   'competencia', (_mes + make_interval(months => gs.i - 1))::date,
                   'total', coalesce(p.total, 0)) order by gs.i)
                 from generate_series(1, 4) gs(i) left join prev p on p.i = gs.i), '[]'::jsonb),
    'a_pagar', coalesce((select jsonb_agg(x order by x->>'competencia', (x->>'total')::bigint desc) from (
        select jsonb_build_object(
          'partner_id', e.partner_id, 'nome', p.full_name, 'tipo', p.tipo_dono, 'pix', p.pix_key,
          'competencia', e.competencia, 'fechado', e.competencia < _mes,
          'mensalidades', count(*), 'total', sum(e.amount_cents)) as x
          from public.partner_commission_entries e
          join public.partners p on p.id = e.partner_id
         where e.status = 'payable'
         group by e.partner_id, p.full_name, p.tipo_dono, p.pix_key, e.competencia) s), '[]'::jsonb),
    'donos', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.full_name, 'tipo', p.tipo_dono,
                        'pix', p.pix_key, 'tem_conta', p.user_id is not null) order by p.full_name)
                        from public.partners p where p.status in ('approved', 'suspended')), '[]'::jsonb)
  ) into _out;
  return _out;
end $$;
revoke execute on function public.admin_cupons_painel() from public, anon;
grant execute on function public.admin_cupons_painel() to authenticated;

-- 6. Ficha do dono: cada cliente, mensalidade por mensalidade.
create or replace function public.admin_cupom_ficha(_partner_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare _out jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return null;
  end if;
  select jsonb_build_object(
    'dono', jsonb_build_object('id', p.id, 'nome', p.full_name, 'tipo', p.tipo_dono, 'pix', p.pix_key,
              'desde', coalesce(p.approved_at, p.created_at), 'tem_conta', p.user_id is not null,
              'cupons', (select coalesce(jsonb_agg(c), '[]'::jsonb) from (
                           select p.coupon_code as c where p.coupon_code is not null
                           union all select codigo from public.cupons_campanha where partner_id = p.id) s)),
    'totais', jsonb_build_object(
      'a_pagar', (select coalesce(sum(amount_cents), 0) from public.partner_commission_entries where partner_id = p.id and status = 'payable'),
      'pago',    (select coalesce(sum(amount_cents), 0) from public.partner_commission_entries where partner_id = p.id and status = 'paid')),
    'clientes', coalesce((select jsonb_agg(jsonb_build_object(
        'nome', coalesce(pf.name, 'Cliente'),
        'plano', coalesce(u.plano, pf.plan),
        'cupom', coalesce(pr.cupom_codigo, p.coupon_code),
        'pagas', coalesce(pr.paid_invoices_count, 0),
        'status', case when pr.status = 'canceled' or u.status = 'cancelado' then 'cancelado'
                       when coalesce(pr.paid_invoices_count, 0) = 0 then 'teste' else 'ativo' end,
        'regra', (select to_jsonb(rg) from public.cupom_regra(pr.cupom_codigo, pr.partner_id) rg limit 1),
        'ultima', coalesce(nullif(u.ultima_mensalidade_cents, 0),
                           (select e.gross_cents from public.partner_commission_entries e
                             where e.referral_id = pr.id order by e.invoice_seq desc limit 1), 0),
        'lancamentos', (select coalesce(jsonb_agg(jsonb_build_object('seq', e.invoice_seq, 'valor', e.amount_cents,
                           'status', e.status) order by e.invoice_seq), '[]'::jsonb)
                          from public.partner_commission_entries e where e.referral_id = pr.id))
        order by pr.created_at desc)
      from public.partner_referrals pr
      left join public.profiles pf on pf.id = pr.referred_user_id
      left join public.cupom_usos u on u.stripe_subscription_id = pr.stripe_subscription_id
      where pr.partner_id = p.id), '[]'::jsonb),
    'pagamentos', coalesce((select jsonb_agg(jsonb_build_object('competencia', po.competencia, 'total', po.total_cents,
                    'mensalidades', po.entries_count, 'pago_em', po.paid_at, 'comprovante', po.proof_url, 'nota', po.note)
                    order by po.competencia desc)
                    from public.partner_payouts po where po.partner_id = p.id and po.status = 'pago'), '[]'::jsonb)
  ) into _out
  from public.partners p where p.id = _partner_id;
  return _out;
end $$;
revoke execute on function public.admin_cupom_ficha(uuid) from public, anon;
grant execute on function public.admin_cupom_ficha(uuid) to authenticated;

-- 7. A tela antiga de parceiras lia p.name (não existe). Conserta pra quem
--    ainda abrir por link antigo.
create or replace function public.admin_parceiras_resumo()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare _out jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return null;
  end if;
  select jsonb_build_object(
    'totais', (select jsonb_build_object(
        'a_pagar',    coalesce(sum(amount_cents) filter (where status = 'payable'), 0),
        'pago_total', coalesce(sum(amount_cents) filter (where status = 'paid'), 0),
        'mes_atual',  coalesce(sum(amount_cents) filter (
                        where status = 'payable'
                          and competencia = date_trunc('month', now() at time zone 'America/Sao_Paulo')::date), 0))
      from public.partner_commission_entries),
    'parceiras', (select coalesce(jsonb_agg(x order by (x->>'a_pagar')::bigint desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'id', p.id, 'nome', p.full_name, 'cupom', p.coupon_code, 'pix', p.pix_key, 'status', p.status,
          'clientes', (select count(*) from public.partner_referrals r where r.partner_id = p.id),
          'clientes_ativos', (select count(*) from public.partner_referrals r where r.partner_id = p.id and r.status <> 'canceled'),
          'receita_gerada', coalesce((select sum(e.gross_cents) from public.partner_commission_entries e
                                       where e.partner_id = p.id and e.status <> 'canceled'), 0),
          'a_pagar', coalesce((select sum(e.amount_cents) from public.partner_commission_entries e
                                where e.partner_id = p.id and e.status = 'payable'), 0),
          'ja_pago', coalesce((select sum(e.amount_cents) from public.partner_commission_entries e
                                where e.partner_id = p.id and e.status = 'paid'), 0)) as x
          from public.partners p where p.status = 'approved') s),
    'fechamento', (select coalesce(jsonb_agg(x order by (x->>'total')::bigint desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'partner_id', e.partner_id, 'nome', p.full_name, 'pix', p.pix_key, 'competencia', e.competencia,
          'lancamentos', count(*), 'total', sum(e.amount_cents),
          'pago', exists (select 1 from public.partner_payouts po where po.partner_id = e.partner_id
                           and po.competencia = e.competencia and po.status = 'pago')) as x
          from public.partner_commission_entries e
          join public.partners p on p.id = e.partner_id
         where e.status = 'payable'
         group by e.partner_id, p.full_name, p.pix_key, e.competencia) s)
  ) into _out;
  return _out;
end $$;

notify pgrst, 'reload schema';
