CREATE OR REPLACE FUNCTION public.get_external_client_by_token(_token text)
 RETURNS TABLE(client_name text, client_logo text, manager_name text, brand_color text, instagram_handle text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    ec.name,
    coalesce(ec.logo_url, cc.logo),
    p.name,
    coalesce(ec.brand_color, cc.color),
    ec.instagram_handle
  from approval_tokens t
  join external_clients ec on ec.id = t.external_client_id
  left join crm_clients cc on cc.id = ec.crm_client_id
  left join profiles p on p.id = t.manager_id
  where t.token = _token and t.active = true
    and (t.expires_at is null or t.expires_at > now())
  limit 1;
$function$;