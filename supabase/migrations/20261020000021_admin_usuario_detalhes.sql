-- ADMIN: DETALHES DO USUÁRIO MAIS COMPLETOS (Walter, 20/10/2026)
-- 1. Cidade no perfil (telefone já existia). O onboarding passa a perguntar os dois, opcionais.
-- 2. uso_telas: uma linha por pessoa, por módulo, por dia, com quantas vezes abriu.
--    Leve: no máximo ~15 linhas por pessoa por dia. Ninguém lê direto (RLS sem
--    política); grava pela função registrar_tela, lê pelo get_user_details (admin).
-- 3. get_user_details devolve contato, acesso, uso e telas mais abertas.
-- 4. admin_estender_teste: +N dias no teste a partir de hoje ou do fim atual.

alter table public.profiles add column if not exists cidade text;

create table if not exists public.uso_telas (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  modulo text not null,
  aberturas integer not null default 1,
  primary key (user_id, dia, modulo)
);
alter table public.uso_telas enable row level security;

create or replace function public.registrar_tela(_modulo text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare _m text := left(lower(btrim(coalesce(_modulo, ''))), 40);
begin
  if auth.uid() is null or _m = '' then return; end if;
  insert into public.uso_telas (user_id, dia, modulo)
  values (auth.uid(), (now() at time zone 'America/Sao_Paulo')::date, _m)
  on conflict (user_id, dia, modulo) do update set aberturas = public.uso_telas.aberturas + 1;
end $$;
revoke all on function public.registrar_tela(text) from public, anon;
grant execute on function public.registrar_tela(text) to authenticated;

create or replace function public.admin_estender_teste(_user_id uuid, _dias integer)
returns timestamptz language plpgsql security definer set search_path to 'public' as $$
declare _fim timestamptz;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'not_authorized';
  end if;
  if _dias is null or _dias < 1 or _dias > 365 then raise exception 'dias_invalidos'; end if;
  update public.profiles
     set trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + make_interval(days => _dias),
         trial_started_at = coalesce(trial_started_at, now())
   where id = _user_id
  returning trial_ends_at into _fim;
  return _fim;
end $$;
revoke all on function public.admin_estender_teste(uuid, integer) from public, anon;
grant execute on function public.admin_estender_teste(uuid, integer) to authenticated;

create or replace function public.get_user_details(_user_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare result jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'not_authorized';
  end if;
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'plan', p.plan, 'role', p.role,
    'subscription_status', p.subscription_status,
    'access_expires_at', p.access_expires_at,
    'trial_started_at', p.trial_started_at,
    'trial_ends_at', p.trial_ends_at,
    'niche', p.niche, 'created_at', p.created_at,
    'email', u.email,
    'phone', p.phone, 'cidade', p.cidade,
    'instagram_handle', p.instagram_handle,
    'avatar_url', p.avatar_url,
    'last_seen_at', p.last_seen_at,
    'last_sign_in_at', u.last_sign_in_at,
    'onboarding_completed', p.onboarding_completed,
    'terms_accepted_at', p.terms_accepted_at, 'terms_version', p.terms_version,
    'stripe_subscription_id', p.stripe_subscription_id,
    'storage_used_bytes', p.storage_used_bytes, 'storage_quota_bytes', p.storage_quota_bytes,
    'ai_ideas_used_month', p.ai_ideas_used_month,
    'uso', jsonb_build_object(
      'posts', (select count(*) from public.posts x where x.user_id = p.id and x.deleted_at is null),
      'clientes', (select count(*) from public.crm_clients x where x.manager_id = p.id and x.deleted_at is null),
      'captacoes', (select count(*) from public.agenda_captures x where x.manager_id = p.id),
      'roteiros', (select count(*) from public.capture_scripts x where x.manager_id = p.id)
    ),
    'dias_ativos_14', (select count(distinct dia) from public.uso_telas t
                        where t.user_id = p.id and t.dia > (now() at time zone 'America/Sao_Paulo')::date - 14),
    'telas_30', coalesce((select jsonb_agg(jsonb_build_object('modulo', modulo, 'n', n) order by n desc)
                  from (select modulo, sum(aberturas)::int n from public.uso_telas t
                         where t.user_id = p.id and t.dia > (now() at time zone 'America/Sao_Paulo')::date - 30
                         group by modulo order by 2 desc limit 8) z), '[]'::jsonb)
  ) into result
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = _user_id;
  return result;
end $function$;
