-- A análise do período (IA ou escrita à mão) passa a ser salva JUNTO da nota do
-- relatório, no mesmo registro por cliente+período. Assim a social mídia reabre
-- depois "a nota do relatório do período X" com recado E análise, sem precisar
-- gerar o relatório de novo.
alter table public.client_report_notes
  add column if not exists analysis_html text;
