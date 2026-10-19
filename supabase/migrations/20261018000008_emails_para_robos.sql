-- JÁ APLICADA no projeto ecbzfjzoqidowrsfsfih em 18/10/2026 (registro).
-- E-mail de cada conta pros robôs de e-mail (lifecycle-emails, daily-health-report).
-- profiles NÃO tem coluna email: os robôs pediam profiles.email, a consulta
-- falhava calada e nenhum e-mail saía (emails_ciclo vazio; o robô de saúde
-- dizia "sem admin p/ notificar"). O e-mail mora em auth.users.
-- Meu perfil (perfil_de) não tem e-mail de verdade: vai pro e-mail da dona.
create or replace function public.emails_para(_ids uuid[])
returns table(id uuid, email text, eh_meu_perfil boolean)
language sql stable security definer set search_path to 'public', 'auth' as $f$
  select p.id,
         coalesce(ud.email, u.email)::text,
         p.perfil_de is not null
  from public.profiles p
  join auth.users u on u.id = p.id
  left join auth.users ud on ud.id = p.perfil_de
  where p.id = any(_ids);
$f$;
revoke all on function public.emails_para(uuid[]) from public, anon, authenticated;
grant execute on function public.emails_para(uuid[]) to service_role;
