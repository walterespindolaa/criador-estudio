-- Criakut pausado até o relançamento (Walter, 04/11/2026): some pra todo mundo,
-- inclusive convidados. Só o admin continua vendo, pra preparar o relançamento.
-- Já aplicado no banco pelo conector em 04/11/2026.
insert into public.criakut_config (chave, valor) values ('pausado', 'true'::jsonb)
on conflict (chave) do update set valor = excluded.valor;
update public.criakut_config set valor = 'false'::jsonb where chave = 'aberto';

create or replace function public.criakut_tem_acesso()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null and (
    public.is_admin()
    or (
      not coalesce((select valor = 'true'::jsonb from criakut_config where chave = 'pausado'), false)
      and (
        exists (select 1 from criakut_convidados where user_id = auth.uid())
        or coalesce((select valor = 'true'::jsonb from criakut_config where chave = 'aberto'), false)
      )
    )
  );
$function$;
