-- Próximos passos do relatório (opcional): perspectiva pro próximo mês que a
-- social mídia escreve e sai como página no final do relatório, salvo junto da
-- nota do período.
alter table public.client_report_notes
  add column if not exists next_steps text;
