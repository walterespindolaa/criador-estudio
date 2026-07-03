-- Tickets de uso único para o OAuth (nonce). Substitui o JWT do usuário que antes
-- viajava no parâmetro ?state= da URL do OAuth do Instagram (vazava em histórico/logs).
-- O frontend cria um ticket via get-instagram-config; o callback instagram-oauth
-- troca o ticket pelo user_id e apaga (uso único).

create table if not exists public.oauth_states (
  state text primary key,
  user_id uuid not null,
  crm_client_id uuid,
  provider text not null default 'instagram',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes'
);

-- Acesso só via service_role (edge functions). Nem anon nem authenticated leem/escrevem.
alter table public.oauth_states enable row level security;
revoke all on table public.oauth_states from anon, authenticated;
