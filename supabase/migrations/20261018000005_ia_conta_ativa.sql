-- JÁ APLICADA no projeto ecbzfjzoqidowrsfsfih em 18/10/2026 (registro).
-- IA da conta ativa: a edge ai-context-builder recebe accountId, confere
-- acesso com conta_acessivel e cobra plano/cota/brandbook da conta aberta.

-- Quem pode agir por uma conta (uso das edges, com service role: sem auth.uid()).
create or replace function public.conta_acessivel(_actor uuid, _owner uuid)
returns boolean language sql stable security definer set search_path to 'public' as $f$
  select _actor is not null and _owner is not null and (
    _actor = _owner
    or exists (select 1 from public.account_members am
               where am.owner_id = _owner and am.member_id = _actor and am.status = 'active')
    or exists (select 1 from public.profiles p where p.id = _owner and p.perfil_de = _actor)
    or exists (select 1 from public.manager_members m
               where m.manager_id = _owner and m.member_id = _actor and m.status = 'ativo'
                 and not public.eh_papel_parceiro(m.role))
  );
$f$;
revoke all on function public.conta_acessivel(uuid, uuid) from public, anon, authenticated;

-- Cota mensal de IA de uma conta. Espelha bump_ai_quota (mesmas faixas):
-- se mudar uma, mudar a outra.
create or replace function public.ai_quota_de(_user uuid)
returns integer language plpgsql stable security definer set search_path to 'public' as $f$
declare _tier text; _quota int; _modulos int;
begin
  select case
    when role = 'admin' then 'studio'
    when subscription_status in ('active','trialing','past_due','unpaid') and plan = 'studio' then 'studio'
    when subscription_status in ('active','trialing','past_due','unpaid') and plan = 'pro' then 'pro'
    when subscription_status in ('active','trialing','past_due','unpaid') and plan = 'essencial' then 'essencial'
    when trial_ends_at is not null and trial_ends_at > now() then 'studio'
    else 'none' end
  into _tier from public.profiles where id = _user;
  _quota := case _tier when 'studio' then 500 when 'pro' then 150 when 'essencial' then 10 else 0 end;
  if _quota = 0 then
    select count(*) into _modulos from public.module_entitlements
     where manager_id = _user and status = 'active' and module_code <> 'hub_extra';
    if _modulos > 0 then _quota := least(150 * _modulos, 500); end if;
  end if;
  return coalesce(_quota, 0);
end;
$f$;
revoke all on function public.ai_quota_de(uuid) from public, anon, authenticated;

-- Uso de IA do mês da CONTA ABERTA (badge do front).
create or replace function public.ai_usage_da_conta(_owner uuid)
returns table(used integer, quota integer) language plpgsql stable security definer set search_path to 'public' as $f$
declare _used int;
begin
  if not public.conta_acessivel(auth.uid(), _owner) then
    raise exception 'sem acesso a esta conta' using errcode = '42501';
  end if;
  select coalesce(call_count, 0) into _used from public.ai_rate_limit
   where user_id = _owner and window_start = date_trunc('month', now());
  return query select coalesce(_used, 0), public.ai_quota_de(_owner);
end;
$f$;
revoke all on function public.ai_usage_da_conta(uuid) from public, anon;
grant execute on function public.ai_usage_da_conta(uuid) to authenticated;
