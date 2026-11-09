-- Walter (04/11/2026): pausado vale pra todo mundo, inclusive admin.
-- Já aplicado no banco pelo conector em 04/11/2026.
create or replace function public.criakut_tem_acesso()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null
    and not coalesce((select valor = 'true'::jsonb from criakut_config where chave = 'pausado'), false)
    and (
      public.is_admin()
      or exists (select 1 from criakut_convidados where user_id = auth.uid())
      or coalesce((select valor = 'true'::jsonb from criakut_config where chave = 'aberto'), false)
    );
$function$;
