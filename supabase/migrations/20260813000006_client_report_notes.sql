-- ── Recado da social mídia no relatório do cliente ───────────────────────────
--
-- O relatório white-label que a social mídia manda pro cliente (ClientReportDialog)
-- ganhou um campo de texto livre "recado da social mídia", que abre o relatório
-- com a leitura humana do mês (resumo, próximos passos). Este recado precisa
-- FICAR salvo por cliente e por período: quando a gestora reabre o relatório de
-- julho daquele cliente, o recado que ela escreveu tem que estar lá.
--
-- Modelo: UMA linha por (agência, cliente, período). Chave estável do período é o
-- intervalo de datas em si ("2026-07-01_2026-07-31"), montado no front, e NÃO o
-- rótulo relativo ("este mês"), que apontaria pra outro mês no mês seguinte.
--
-- Escopo por cliente do CRM (crm_client_id): é assim que o relatório já é chaveado.
-- Cliente sem cadastro central vinculado não persiste (o front trata: o recado sai
-- só naquele PDF). Por isso crm_client_id é NOT NULL aqui.
--
-- Idempotente: "create table if not exists" + "drop policy if exists". Seguro de
-- rodar de novo. Leitura defensiva no front: se esta migration ainda não rodou, a
-- query de leitura falha em silêncio e o recado fica só na sessão.
create table if not exists public.client_report_notes (
  manager_id    uuid not null references auth.users(id) on delete cascade,
  crm_client_id uuid not null references public.crm_clients(id) on delete cascade,
  -- Intervalo do período: "<YYYY-MM-DD>_<YYYY-MM-DD>" (desde_ate, ambos incluídos).
  period_key    text not null,
  body          text not null default '',
  updated_at    timestamptz not null default now(),
  primary key (manager_id, crm_client_id, period_key)
);

grant select, insert, update, delete on public.client_report_notes to authenticated;
grant all on public.client_report_notes to service_role;

alter table public.client_report_notes enable row level security;

-- RLS de time, EXATAMENTE o padrão das outras tabelas do tenant (crm_clients,
-- crm_client_notes, client_materials): dono do tenant OU colaborador ativo dele.
drop policy if exists "client_report_notes_team" on public.client_report_notes;
create policy "client_report_notes_team" on public.client_report_notes
  for all to authenticated
  using (public.acts_for(manager_id))
  with check (public.acts_for(manager_id));

comment on table public.client_report_notes is
  'Recado da social mídia no relatório do cliente (ClientReportDialog), uma linha por agência+cliente+período. period_key é o intervalo de datas do relatório.';
