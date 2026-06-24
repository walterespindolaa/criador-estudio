-- Cor por cliente externo (pra diferenciar no calendário multi-contas).
alter table public.external_clients
  add column if not exists color text;
