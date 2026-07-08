-- Retorna o @ do Instagram do cliente pelo token de aprovação (pra mostrar no portal público).
-- Função nova e isolada — não altera get_external_client_by_token.
create or replace function public.get_external_handle_by_token(_token text)
returns text
language sql
security definer
set search_path = public
as $$
  select ec.instagram_handle
  from approval_tokens at
  join external_clients ec on ec.id = at.external_client_id
  where at.token = _token
    and at.active = true
    and (at.expires_at is null or at.expires_at > now())
  limit 1;
$$;

grant execute on function public.get_external_handle_by_token(text) to anon, authenticated;
