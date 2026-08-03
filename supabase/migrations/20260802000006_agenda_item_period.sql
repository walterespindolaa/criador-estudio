-- PERÍODO (manhã / tarde / noite) dos itens da Agenda de criação.
--
-- Por que uma tabela lateral, e não uma coluna em cada tabela de item: os cards da
-- grade vêm de CINCO tabelas de features diferentes (crm_tasks, external_posts,
-- client_materials, agenda_captures, agenda_creations). Uma coluna em cada uma
-- significaria cinco migrations e cinco hooks de outras telas mexidos, só pra
-- guardar uma preferência de leitura da agenda. Aqui usamos a MESMA chave
-- "<kind>:<id>" que a ordem manual do dia (agenda_day_order) já usa, então o
-- período segue o item inclusive quando ele é arrastado pra outro dia.
--
-- O período é CAMPO PRÓPRIO, independente do horário: dá pra dizer "essa tarefa é
-- de tarde" sem ter que inventar um horário. Item sem período gravado cai no
-- período derivado do horário (regra em src/lib/periodos-agenda.ts) e, se não
-- tiver horário nenhum, fica no topo do dia como "sem período".
--
-- RLS espelha o das demais tabelas da agenda: o dono acessa as próprias linhas.
-- Idempotente.
create table if not exists public.agenda_item_period (
  manager_id uuid not null references auth.users(id) on delete cascade,
  -- Chave do item na grade: "<kind>:<id>" (ex.: "task:uuid", "post:uuid", "mat:uuid").
  item_key text not null,
  -- Só os três períodos. Qualquer outro valor é lixo e o frontend ignoraria mesmo.
  period text not null check (period in ('manha', 'tarde', 'noite')),
  updated_at timestamptz not null default now(),
  primary key (manager_id, item_key)
);

alter table public.agenda_item_period enable row level security;

drop policy if exists "agenda_item_period owner" on public.agenda_item_period;
create policy "agenda_item_period owner" on public.agenda_item_period
  for all using (auth.uid() = manager_id) with check (auth.uid() = manager_id);
