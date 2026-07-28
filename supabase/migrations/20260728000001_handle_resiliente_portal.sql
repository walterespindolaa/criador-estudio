-- ============================================================
-- @ do Instagram no portal de aprovação: buscar de forma resiliente.
--
-- Problema: o portal só lia external_clients.instagram_handle. Se o social mídia
-- cadastrou o @ em outro lugar (no cliente do CRM, ou na conta Cria vinculada),
-- o portal mostrava "perfil" mesmo com @ cadastrado.
--
-- Agora as duas RPCs do portal caem em cascata:
--   1) external_clients.instagram_handle  (o @ do próprio link de aprovação)
--   2) crm_clients.instagram              (o @ do cadastro do cliente no CRM)
--   3) conta Cria vinculada               (social_connections.username da conta
--                                          Cria do cliente, quando houver)
-- Sempre normalizando: string vazia vira null e tira o "@" da frente.
-- Idempotente: pode rodar de novo sem efeito colateral.
-- ============================================================

-- Helper: primeiro valor não-vazio, sem "@" na frente.
create or replace function public.first_handle(variadic _vals text[])
returns text
language sql immutable set search_path = public as $$
  select ltrim(v, '@')
  from unnest(_vals) as v
  where v is not null and btrim(v) <> ''
  limit 1;
$$;

-- 1) get_external_handle_by_token — usado pelo portal pra montar o @ do card.
create or replace function public.get_external_handle_by_token(_token text)
returns text
language sql
security definer
set search_path = public
as $$
  select public.first_handle(
    ec.instagram_handle,
    cc.instagram,
    sc.username
  )
  from approval_tokens at
  join external_clients ec on ec.id = at.external_client_id
  left join crm_clients cc on cc.id = ec.crm_client_id
  left join social_connections sc
    on sc.user_id = cc.cria_owner_id
   and sc.provider = 'instagram'
   and sc.crm_client_id is null
  where at.token = _token
    and at.active = true
    and (at.expires_at is null or at.expires_at > now())
  limit 1;
$$;

grant execute on function public.get_external_handle_by_token(text) to anon, authenticated;

-- 2) get_external_client_by_token — mesma cascata no campo instagram_handle do header.
create or replace function public.get_external_client_by_token(_token text)
returns table(client_name text, client_logo text, manager_name text, brand_color text, instagram_handle text)
language sql
security definer
set search_path = public
as $$
  select
    ec.name,
    coalesce(ec.logo_url, cc.logo),
    p.name,
    coalesce(ec.brand_color, cc.color),
    public.first_handle(ec.instagram_handle, cc.instagram, sc.username)
  from approval_tokens t
  join external_clients ec on ec.id = t.external_client_id
  left join crm_clients cc on cc.id = ec.crm_client_id
  left join social_connections sc
    on sc.user_id = cc.cria_owner_id
   and sc.provider = 'instagram'
   and sc.crm_client_id is null
  left join profiles p on p.id = t.manager_id
  where t.token = _token and t.active = true
    and (t.expires_at is null or t.expires_at > now())
  limit 1;
$$;

grant execute on function public.get_external_client_by_token(text) to anon, authenticated;
