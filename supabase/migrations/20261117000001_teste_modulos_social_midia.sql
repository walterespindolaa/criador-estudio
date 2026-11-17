-- TESTE COMPLETO DA SOCIAL MÍDIA (Walter, 17/11/2026)
-- Nos 7 dias de teste da conta de social mídia (profiles.trial_ends_at, que o
-- gatilho handle_new_user_trial já preenche no cadastro), todos os módulos
-- ficam liberados, menos o Cria Radar (hub_cria e hub_extra, custo do Apify).
-- No 8º dia volta tudo ao normal: cada módulo pede a contratação. Nada é apagado.

-- 1) has_module passa a aceitar o teste. É ela que libera o Cria Post no
--    banco, inclusive os links de aprovação que a cliente abre.
create or replace function public.has_module(_code text, _user uuid default auth.uid())
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.module_entitlements
    where manager_id = _user and module_code = _code and status = 'active'
      and (current_period_end is null or current_period_end > now())
  )
  or (
    _code not in ('hub_cria', 'hub_extra')
    and exists (
      select 1 from public.profiles p
      where p.id = _user and p.account_type = 'manager'
        and p.trial_ends_at is not null and p.trial_ends_at > now()
    )
  );
$function$;

-- 2) Até quando vai o teste dos módulos (pra tela). Só a dona da conta ou
--    alguém do time dela recebe a data; pra qualquer outra pessoa volta vazio.
create or replace function public.modulos_teste_ate(_manager uuid)
returns timestamptz
language sql
stable security definer
set search_path to 'public'
as $function$
  select p.trial_ends_at
  from public.profiles p
  where p.id = _manager
    and p.account_type = 'manager'
    and p.trial_ends_at is not null and p.trial_ends_at > now()
    and (
      _manager = auth.uid()
      or exists (
        select 1 from public.account_members m
        where m.owner_id = _manager and m.member_id = auth.uid() and m.status = 'active'
      )
    );
$function$;

revoke all on function public.modulos_teste_ate(uuid) from public, anon;
grant execute on function public.modulos_teste_ate(uuid) to authenticated;
