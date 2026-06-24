-- Passo 1+2 da sincronização de clientes entre módulos.
-- crm_clients é o cadastro central (o Cria Caixa já aponta pra ele via crm_client_id).
-- Aqui ligamos o Cria Post (external_clients) ao mesmo hub.
alter table public.external_clients
  add column if not exists crm_client_id uuid references public.crm_clients(id) on delete set null;

create index if not exists idx_external_clients_crm_client
  on public.external_clients (crm_client_id);
