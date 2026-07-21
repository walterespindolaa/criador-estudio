-- Cor de destaque do cliente (borda do card na lista).
alter table public.crm_clients
  add column if not exists color text;
