-- Instagram por cliente (multi-conta): hoje é 1 conexão por usuário.
-- Adiciona vínculo opcional ao cadastro central (crm_clients):
--   crm_client_id NULL  = conta do próprio usuário (criador)
--   crm_client_id setado = conta de um cliente gerenciado pela social mídia.

alter table public.social_connections
  add column if not exists crm_client_id uuid references public.crm_clients(id) on delete cascade;

-- Substitui o unique (user_id, provider) por índices parciais:
-- uma conexão "própria" + uma conexão por cliente.
alter table public.social_connections
  drop constraint if exists social_connections_user_id_provider_key;

create unique index if not exists uq_social_conn_self
  on public.social_connections (user_id, provider)
  where crm_client_id is null;

create unique index if not exists uq_social_conn_client
  on public.social_connections (user_id, provider, crm_client_id)
  where crm_client_id is not null;
