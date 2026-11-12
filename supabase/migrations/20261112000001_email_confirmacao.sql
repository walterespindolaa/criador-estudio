-- Confirmação de e-mail depois de entrar (12/11/2026). Ver supabase/functions/confirmar-email.

-- 1) Tabela: só o service role escreve e lê (RLS ligado, sem política).
create table if not exists public.email_confirmacao (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  token uuid not null default gen_random_uuid(),
  enviado_em timestamptz not null default now(),
  envios int not null default 1,
  confirmado_em timestamptz
);
create unique index if not exists email_confirmacao_token_idx on public.email_confirmacao(token);
alter table public.email_confirmacao enable row level security;

-- 2) Estado pra o app: pendente? trava? (trava do 4º dia em diante)
create or replace function public.email_confirmacao_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  u record;
  _confirmado_em timestamptz;
  _tem_linha boolean;
  _confirmado boolean;
  _pendente boolean;
  _dias int;
begin
  select id, email, created_at, confirmation_sent_at, email_confirmed_at, raw_user_meta_data
    into u from auth.users where id = auth.uid();
  if u.id is null then
    return jsonb_build_object('pendente', false, 'bloqueia', false);
  end if;

  select confirmado_em into _confirmado_em from public.email_confirmacao where user_id = u.id;
  _tem_linha := found;

  -- Confirmado pelo nosso e-mail, ou pelo e-mail antigo do Supabase.
  _confirmado := (_tem_linha and _confirmado_em is not null)
              or (u.confirmation_sent_at is not null and u.email_confirmed_at is not null);

  -- Só é cobrada a conta que nasceu pelo cadastro novo (marca) ou que já tem pedido aberto.
  _pendente := not _confirmado
           and (_tem_linha or coalesce(u.raw_user_meta_data->>'confirmar_email', '') = '1');

  _dias := floor(extract(epoch from (now() - u.created_at)) / 86400);

  return jsonb_build_object(
    'pendente', _pendente,
    'bloqueia', _pendente and _dias >= 3,
    'email', u.email,
    'dias', _dias
  );
end;
$$;
revoke all on function public.email_confirmacao_status() from public, anon;
grant execute on function public.email_confirmacao_status() to authenticated;

-- 3) Cota da IA: teste de 7 dias com limite próprio (antes usava o do Studio, 500).
--    50 no teste; 15 enquanto o e-mail não foi confirmado.
create or replace function public.bump_ai_quota(_user uuid)
returns table(used integer, quota integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _month_start timestamptz := date_trunc('month', now());
  _quota int;
  _used int;
  _tier text;
  _modulos int;
begin
  select case
    when role = 'admin' then 'studio'
    when subscription_status in ('active','trialing','past_due','unpaid') and plan = 'studio' then 'studio'
    when subscription_status in ('active','trialing','past_due','unpaid') and plan = 'pro' then 'pro'
    when subscription_status in ('active','trialing','past_due','unpaid') and plan = 'essencial' then 'essencial'
    when trial_ends_at is not null and trial_ends_at > now() then 'teste'
    else 'none'
  end
  into _tier
  from public.profiles
  where id = _user;

  _quota := case _tier
    when 'studio' then 500
    when 'pro' then 150
    when 'essencial' then 10   -- degustação: prova o gosto, não sustenta o uso
    when 'teste' then 50       -- teste de 7 dias
    else 0
  end;

  -- Teste com e-mail ainda não confirmado: limite menor até confirmar.
  if _tier = 'teste' and exists (
    select 1 from public.email_confirmacao where user_id = _user and confirmado_em is null
  ) then
    _quota := 15;
  end if;

  -- Sem plano? Pode ser uma GESTORA. Ela paga por módulo, e cada módulo ativo
  -- traz cota junto. (hub_extra é pacote de crédito do Radar, não é módulo.)
  if _quota = 0 then
    select count(*)
      into _modulos
      from public.module_entitlements
     where manager_id = _user
       and status = 'active'
       and module_code <> 'hub_extra';

    if _modulos > 0 then
      _quota := least(150 * _modulos, 500);
    end if;
  end if;

  if _quota = 0 then
    raise exception 'no_access' using errcode = 'P0001';
  end if;

  insert into public.ai_rate_limit (user_id, window_start, call_count)
  values (_user, _month_start, 1)
  on conflict (user_id, window_start)
  do update set call_count = ai_rate_limit.call_count + 1
  returning call_count into _used;

  if _used > _quota then
    raise exception 'quota_exceeded' using errcode = 'P0001';
  end if;

  return query select _used, _quota;
end;
$function$;
