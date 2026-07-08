-- Lixeira de 30 dias: soft-delete (deleted_at) em clientes e posts, com expurgo automático.
alter table public.crm_clients add column if not exists deleted_at timestamptz;
alter table public.posts add column if not exists deleted_at timestamptz;

create index if not exists idx_crm_clients_deleted on public.crm_clients(deleted_at) where deleted_at is not null;
create index if not exists idx_posts_deleted on public.posts(deleted_at) where deleted_at is not null;
