-- Walter, 26/11/2026: separar as ideias que a IA cria no onboarding das que a
-- pessoa escreveu. Sem isso o e-mail "re_nao_usou" quase nunca saía pro
-- criador (o critério era "mais de 1 ideia" e o onboarding já cria até 5).

-- 1) Marca as ideias antigas da IA do onboarding. Elas entram num insert só
--    (mesmo created_at), em lote de 2 a 5, no primeiro dia da conta.
with lotes as (
  select i.user_id, i.created_at
    from public.ideas i
    join public.profiles p on p.id = i.user_id
   where i.origin is null
     and i.created_at < p.created_at + interval '1 day'
   group by i.user_id, i.created_at
  having count(*) >= 2
)
update public.ideas i
   set origin = 'onboarding_ia'
  from lotes l
 where i.user_id = l.user_id and i.created_at = l.created_at and i.origin is null;

-- 2) A base do reengajamento ganha n_ideias_proprias (sem as do onboarding).
--    n_ideias continua igual, pro texto "tudo ficou guardado". Mudar o tipo
--    de retorno exige drop + create (42P13).
drop function if exists public.reengajamento_base();
create function public.reengajamento_base()
returns table (
  id uuid, name text, account_type text, parceiro_role text,
  created_at timestamptz, last_seen_at timestamptz, onboarding_completed boolean,
  subscription_status text, trial_ends_at timestamptz, plan text, access_expires_at timestamptz,
  email text, email_confirmado boolean, n_ideias int, n_posts int, n_clientes int, quer_receber boolean,
  n_ideias_proprias int
)
language sql stable security definer
set search_path to 'public', 'auth'
as $$
  select p.id, p.name, p.account_type, p.parceiro_role,
         p.created_at, p.last_seen_at, coalesce(p.onboarding_completed, false),
         p.subscription_status, p.trial_ends_at,
         p.plan, p.access_expires_at,
         u.email::text, u.email_confirmed_at is not null,
         (select count(*)::int from public.ideas i where i.user_id = p.id),
         (select count(*)::int from public.posts po where po.user_id = p.id and po.deleted_at is null),
         (select count(*)::int from public.crm_clients c where c.manager_id = p.id and c.deleted_at is null),
         (p.notification_prefs ->> 'reengajamento') is distinct from 'false',
         (select count(*)::int from public.ideas i where i.user_id = p.id
             and coalesce(i.origin, '') not in ('onboarding_ia', 'onboarding'))
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.perfil_de is null
     and p.agency_owner_id is null
     and coalesce(p.role, '') <> 'admin'
     and coalesce(p.subscription_status, '') <> 'active';
$$;

revoke all on function public.reengajamento_base() from public, anon, authenticated;
grant execute on function public.reengajamento_base() to service_role;
