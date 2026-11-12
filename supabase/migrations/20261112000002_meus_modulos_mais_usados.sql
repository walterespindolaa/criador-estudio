-- Linha "Você mais usa" do menu do celular (12/11/2026).
-- Devolve os módulos que a própria pessoa mais abriu nos últimos 30 dias.
create or replace function public.meus_modulos_mais_usados()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(modulo order by total desc), '{}')
  from (
    select modulo, sum(aberturas) as total
    from public.uso_telas
    where user_id = auth.uid() and dia >= current_date - 30
    group by modulo
    order by total desc
    limit 12
  ) t;
$$;
revoke all on function public.meus_modulos_mais_usados() from public, anon;
grant execute on function public.meus_modulos_mais_usados() to authenticated;
