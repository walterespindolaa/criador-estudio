-- ═══════════════════════════════════════════════════════════════════════════
-- 24/09/2026 · "Sou designer, editor ou filmmaker" no onboarding de criador
--
-- O link existia mas levava pra /socialmidia/demandas, e a conta ainda era de
-- criador: o layout da agência mandava de volta pro /app, que mandava de volta
-- pro /onboarding. Parecia um link morto. account_type e parceiro_role são
-- colunas travadas pro usuário (policy + trigger de colunas de controle), então
-- a troca precisa desta RPC, no mesmo molde da tornar_conta_manager.
--
-- Só vale pra quem ainda é criador SEM assinatura ativa: parceiro não paga, e
-- não pode virar a porta de fuga de quem assinou (ou de quem é agência).
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.tornar_conta_parceiro(_papel text default 'designer')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _p record;
begin
  if auth.uid() is null then
    raise exception 'sem sessão';
  end if;
  select account_type, subscription_status, seat_limit into _p from public.profiles where id = auth.uid();
  if coalesce(_p.account_type, '') = 'parceiro' then
    return; -- já é
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
$$;
revoke all on function public.tornar_conta_parceiro(text) from public, anon;
grant execute on function public.tornar_conta_parceiro(text) to authenticated;

notify pgrst, 'reload schema';
