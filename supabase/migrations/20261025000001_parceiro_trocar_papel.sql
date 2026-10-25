-- ═══════════════════════════════════════════════════════════════════════════
-- ONBOARDING DO PRESTADOR (25/10/2026)
--
-- A tela 1 do onboarding do prestador deixa a pessoa confirmar ou TROCAR a
-- função (design, edição, captação, copy, tráfego). Quem se cadastrou como
-- parceiro já nasce parceiro (trigger aplicar_intencao_parceiro), e a função
-- antiga devolvia sem fazer nada pra quem já era parceiro: a troca se perdia.
-- parceiro_role é coluna de controle (só o servidor muda), então a troca vem
-- por aqui. O resto da função fica igual.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.tornar_conta_parceiro(_papel text default 'designer')
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _p record;
begin
  if auth.uid() is null then
    raise exception 'sem sessão';
  end if;
  select account_type, subscription_status, seat_limit into _p from public.profiles where id = auth.uid();
  if coalesce(_p.account_type, '') = 'parceiro' then
    -- Já é parceiro: só troca a função, se for uma função válida.
    if public.eh_papel_parceiro(_papel) then
      update public.profiles set parceiro_role = _papel where id = auth.uid();
    end if;
    return;
  end if;
  if coalesce(_p.account_type, '') = 'manager'
     or coalesce(_p.subscription_status, '') = 'active'
     or coalesce(_p.seat_limit, 0) > 0 then
    raise exception 'conta não pode virar parceiro por aqui';
  end if;
  update public.profiles
     set account_type = 'parceiro',
         parceiro_role = case when public.eh_papel_parceiro(_papel) then _papel else 'designer' end,
         plan = 'free',
         trial_started_at = null,
         trial_ends_at = null
   where id = auth.uid();
end;
$function$;
