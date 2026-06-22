-- Vincula o cronograma a um cliente do Cria Post (external_clients) -> histórico por cliente.
alter table public.cronogramas
  add column if not exists external_client_id uuid references public.external_clients(id) on delete cascade;
create index if not exists idx_cronogramas_extclient on public.cronogramas (external_client_id);
