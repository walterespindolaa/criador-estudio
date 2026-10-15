# Cria Caixa — plano (o que absorver do Atlas)

Data: 2026-07-12

---

## 1. O que o Cria já tem (e você não sabia)

Boa notícia: o banco **já suporta** metade do que você pediu.

- `fin_records` — lançamentos com `type` (entrada/despesa), **`status` (pago / pendente / atrasado)**, `date`, `amount`, `category`, `crm_client_id`, `recurring_id`, `context` (pj/pf).
- `fin_recurring` — modelos de recorrência.
- `crm_clients.payment_day` — **dia de vencimento** (criei no bloco do CRM).

Ou seja: **o status pendente/pago/atrasado já existe no dado — só não está exposto na tela.** É correção de UI, não de banco.

---

## 2. O que o Atlas resolve melhor (e vale copiar)

O Atlas usa um modelo de **template + instância mensal** que é exatamente o que falta no Cria:

| Atlas | O que faz |
|---|---|
| `business_recurring_templates` | o contrato: título, valor, **`due_day` (1–28)**, cliente, categoria, ativo, mês de fim |
| `business_recurring_instances` | **uma linha por mês**: `month_ref`, `due_date`, `amount`, **`status: pending / confirmed / skipped`**, `transaction_id` |
| `despesas_skip` | pular um mês específico com motivo |

**Por que isso importa:** hoje o Cria "materializa" a mensalidade direto como lançamento pago. Não existe o estado intermediário. Por isso você **marcou recebido errado e não conseguiu desfazer** — não havia o que desfazer, o registro já tinha virado outra coisa.

Com instância mensal, cada mensalidade tem vida própria: nasce `pendente`, você **confirma** (vira lançamento), **desfaz** (volta a pendente e apaga o lançamento) ou **pula** (status `skipped`, com motivo, sem sumir do histórico).

---

## 3. Plano de execução

### Fase 1 — Correções imediatas (sem SQL novo)
- [ ] **Status pendente / pago / atrasado** editável em cada lançamento (o dado já existe)
- [ ] **Card "Previsão do mês"** em destaque: recebido + a receber = **bruto**; menos despesas = **líquido**
- [ ] Categoria **"Projetos avulsos"** na lista de categorias

### Fase 2 — Mensalidades com instância mensal (SQL)
- [ ] Tabela `fin_monthly` (instância mensal, espelhando o modelo do Atlas)
- [ ] **Confirmar recebimento** → cria o `fin_record` e guarda o vínculo
- [ ] **Desfazer** → apaga o `fin_record` e volta a pendente ← *resolve o seu problema*
- [ ] **Pular mês** (com motivo) → status `pulado`, não conta na previsão
- [ ] Geração automática das instâncias do mês a partir de `crm_clients.payment_day`

### Fase 3 — Calendário e relatório
- [ ] **Calendário de recebimentos/pagamentos**: cada cliente cai no seu `payment_day` (recebo dia 15 do Fulano, dia 10 do Ciclano)
- [ ] **Relatório por período** (mês / ano / intervalo): evolução mês a mês, todos os recebimentos e gastos, exportável — espelhando o `FluxoCaixa` do Atlas

---

## 4. SQL da Fase 2

```sql
-- Mensalidade como INSTÂNCIA do mês (modelo do Atlas).
-- Resolve: desfazer o "marcar recebido" e pular mensalidade sem perder histórico.
create table if not exists public.fin_monthly (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  crm_client_id uuid references public.crm_clients(id) on delete cascade,
  month_ref date not null,                 -- 1º dia do mês (2026-07-01)
  due_date date not null,                  -- vencimento real (payment_day do cliente)
  amount numeric not null default 0,
  status text not null default 'pendente', -- pendente | pago | pulado
  skip_reason text,
  fin_record_id uuid references public.fin_records(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (crm_client_id, month_ref)
);

alter table public.fin_monthly
  drop constraint if exists fin_monthly_status_check;
alter table public.fin_monthly
  add constraint fin_monthly_status_check check (status in ('pendente','pago','pulado'));

alter table public.fin_monthly enable row level security;

drop policy if exists "fin_monthly_owner" on public.fin_monthly;
create policy "fin_monthly_owner" on public.fin_monthly
  for all to authenticated using (manager_id = auth.uid()) with check (manager_id = auth.uid());

drop policy if exists "fin_monthly_team" on public.fin_monthly;
create policy "fin_monthly_team" on public.fin_monthly
  for all to authenticated using (public.acts_for(manager_id)) with check (public.acts_for(manager_id));

create index if not exists idx_fin_monthly_mgr_month on public.fin_monthly(manager_id, month_ref);
```

---

## 5. O que eu NÃO vou copiar do Atlas (e por quê)

O Atlas é um app de **finanças pessoais + negócios** com muita coisa que não faz sentido aqui: Atlas Score, simulador de financiamento, aposentadoria, investimentos, dependentes, household. Copiar isso ia inchar o Cria sem servir a social mídia.

O que importa e eu absorvo é **o modelo de recorrência com instância mensal** e o **relatório de fluxo por período**. O resto do Atlas fica de fora.
