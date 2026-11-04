-- JORNADA DO USUÁRIO NO ADMIN (Walter, 04/11/2026, mockup aprovado).
-- "Onde a pessoa parou": cadastro, e-mail, onboarding, planos, pagamento,
-- teste e primeira cobrança. Três coisas que o Cria não gravava passam a ser
-- gravadas em jornada_usuario: quando terminou o onboarding, quando viu os
-- planos e quando abriu o pagamento (com o plano e quantas vezes).
-- Tudo que o admin lê sai de funções que exigem is_admin().

create table if not exists public.jornada_usuario (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding_em timestamptz,
  planos_em timestamptz,
  checkout_em timestamptz,
  checkout_plano text,
  checkout_vezes int not null default 0,
  aparelho text,
  atualizado_em timestamptz not null default now()
);
alter table public.jornada_usuario enable row level security;
revoke all on public.jornada_usuario from anon, authenticated;

-- O app marca "viu os planos" (e o aparelho). Só a primeira vez conta.
create or replace function public.jornada_marcar(_passo text, _aparelho text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or _passo not in ('planos') then return; end if;
  insert into public.jornada_usuario as j (user_id, planos_em, aparelho)
  values (auth.uid(), now(), case when _aparelho in ('celular', 'computador', 'tablet') then _aparelho end)
  on conflict (user_id) do update set
    planos_em = coalesce(j.planos_em, excluded.planos_em),
    aparelho = coalesce(j.aparelho, excluded.aparelho),
    atualizado_em = now();
end $$;
revoke all on function public.jornada_marcar(text, text) from public, anon;
grant execute on function public.jornada_marcar(text, text) to authenticated;

-- O create-checkout (servidor) marca "abriu o pagamento".
create or replace function public.jornada_checkout(_user uuid, _plano text)
returns void language sql security definer set search_path = public as $$
  insert into public.jornada_usuario as j (user_id, checkout_em, checkout_plano, checkout_vezes)
  values (_user, now(), _plano, 1)
  on conflict (user_id) do update set
    checkout_em = now(), checkout_plano = excluded.checkout_plano,
    checkout_vezes = j.checkout_vezes + 1, atualizado_em = now();
$$;
revoke all on function public.jornada_checkout(uuid, text) from public, anon, authenticated;

-- Onboarding concluído: grava a hora em que virou true.
create or replace function public.jornada_onboarding()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.onboarding_completed, false) and not coalesce(old.onboarding_completed, false) then
    insert into public.jornada_usuario as j (user_id, onboarding_em) values (new.id, now())
    on conflict (user_id) do update set onboarding_em = coalesce(j.onboarding_em, now()), atualizado_em = now();
  end if;
  return new;
end $$;
drop trigger if exists trg_jornada_onboarding on public.profiles;
create trigger trg_jornada_onboarding after update of onboarding_completed on public.profiles
  for each row execute function public.jornada_onboarding();

-- O retrato de cada conta (só leitura interna; o admin chega por funções).
create or replace function public.jornada_base(_desde timestamptz default null, _ids uuid[] default null)
returns table (
  id uuid, nome text, criado_em timestamptz, tipo text, origem text, plano_lp text,
  email_ok boolean, email_em timestamptz, onboarding_ok boolean, onboarding_em timestamptz,
  planos_em timestamptz, checkout_em timestamptz, checkout_plano text, checkout_vezes int,
  teste_inicio timestamptz, teste_ate timestamptz, primeira_cobranca_em timestamptz,
  assinante boolean, plano text, ultimo_acesso timestamptz, aparelho text, n_clientes int,
  passo int, onde text, tom text)
language sql stable security definer set search_path = public, auth as $$
  with b as (
    select p.id, p.name, u.created_at,
      case when p.account_type = 'manager' then 'social' when p.parceiro_role is not null or u.raw_user_meta_data->>'account_intent' = 'parceiro' then 'parceiro' else 'criador' end as tipo,
      case
        when u.raw_user_meta_data->>'utm_campaign' ~ '^[0-9]+$' then 'anúncio'
        when u.raw_user_meta_data->>'utm_campaign' ilike 'bio%' then 'link da bio'
        when u.raw_user_meta_data ? 'utm_campaign' then 'anúncio'
        when u.raw_user_meta_data ? 'veio_de_anuncio' then 'anúncio'
        else 'direto' end as origem,
      u.raw_user_meta_data->>'utm_campaign' as campanha,
      u.raw_user_meta_data->>'plano_escolhido' as plano_lp,
      u.email_confirmed_at, p.onboarding_completed, p.subscription_status, p.stripe_subscription_id,
      p.stripe_customer_id, p.plan, p.trial_ends_at, p.assinatura_teste_ate, p.teste_cartao_inicio,
      p.boas_vindas_assinatura_em, p.last_seen_at, j.onboarding_em, j.checkout_em, j.checkout_plano,
      coalesce(j.checkout_vezes, 0) as checkout_vezes, j.aparelho,
      coalesce(j.planos_em, (select (min(t.dia)::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo' from public.uso_telas t where t.user_id = p.id and t.modulo = 'assinar')) as planos_em,
      (select count(*)::int from public.crm_clients c where c.manager_id = p.id and c.deleted_at is null) as n_clientes
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.jornada_usuario j on j.user_id = p.id
    where p.perfil_de is null and coalesce(p.role, '') <> 'admin'
      and (_desde is null or u.created_at >= _desde)
      and (_ids is null or p.id = any(_ids))
  ), c as (
    select b.*,
      (b.stripe_subscription_id is not null and b.subscription_status in ('active', 'past_due')
        and (b.assinatura_teste_ate is null or b.assinatura_teste_ate <= now())) as assinante
    from b
  )
  select c.id, c.name, c.created_at, c.tipo, c.origem, c.plano_lp,
    c.email_confirmed_at is not null, c.email_confirmed_at, coalesce(c.onboarding_completed, false), c.onboarding_em,
    c.planos_em, c.checkout_em, c.checkout_plano, c.checkout_vezes,
    c.teste_cartao_inicio, coalesce(c.assinatura_teste_ate, c.trial_ends_at), c.boas_vindas_assinatura_em,
    c.assinante, c.plan, c.last_seen_at, c.aparelho, c.n_clientes,
    -- passo alcançado (1 cadastrou ... 7 primeira cobrança/assinante)
    case
      when c.assinante or c.boas_vindas_assinatura_em is not null then 7
      when c.assinatura_teste_ate > now() or c.teste_cartao_inicio is not null then 6
      when c.checkout_em is not null or (c.stripe_customer_id is not null and c.tipo = 'criador') then 5
      when c.planos_em is not null then 4
      when coalesce(c.onboarding_completed, false) then 3
      when c.email_confirmed_at is not null then 2
      else 1 end,
    case
      when c.tipo = 'parceiro' then 'Parceiro'
      when c.subscription_status = 'canceled' then 'Cancelou'
      when c.assinante and c.subscription_status = 'past_due' then 'Pagamento recusado'
      when c.assinante then 'Assinante ' || initcap(coalesce(c.plan, ''))
      when c.assinatura_teste_ate > now() then 'Em teste · faltam ' || greatest(1, ceil(extract(epoch from c.assinatura_teste_ate - now()) / 86400))::int || ' dias'
      when c.tipo = 'criador' and c.trial_ends_at > now() then 'Em teste sem cartão · faltam ' || greatest(1, ceil(extract(epoch from c.trial_ends_at - now()) / 86400))::int || ' dias'
      when c.email_confirmed_at is null then 'Não confirmou o e-mail'
      when not coalesce(c.onboarding_completed, false) then 'Não fez o onboarding'
      when c.tipo = 'social' and c.n_clientes = 0 then 'Social mídia sem cliente'
      when c.tipo = 'social' then 'Conta grátis ativa · ' || c.n_clientes || case when c.n_clientes = 1 then ' cliente' else ' clientes' end
      when c.checkout_em is not null or c.stripe_customer_id is not null then 'Parou no pagamento' || coalesce(' · ' || initcap(c.checkout_plano), '')
      when c.trial_ends_at is not null then 'Teste acabou sem assinar'
      when c.planos_em is not null then 'Viu os planos, não clicou'
      else 'Não chegou aos planos' end,
    case
      when c.tipo = 'parceiro' then 'cinza'
      when c.subscription_status = 'canceled' then 'vermelho'
      when c.assinante and c.subscription_status = 'past_due' then 'vermelho'
      when c.assinante then 'verde'
      when c.assinatura_teste_ate > now() or (c.tipo = 'criador' and c.trial_ends_at > now()) then 'ambar'
      when c.tipo = 'social' and c.n_clientes > 0 and coalesce(c.onboarding_completed, false) then 'verde'
      when c.tipo = 'criador' and coalesce(c.onboarding_completed, false) and (c.checkout_em is not null or c.stripe_customer_id is not null) then 'ambar'
      when c.trial_ends_at is not null and c.tipo = 'criador' and coalesce(c.onboarding_completed, false) then 'vermelho'
      else 'cinza' end
  from c;
$$;
revoke all on function public.jornada_base(timestamptz, uuid[]) from public, anon, authenticated;

-- Lista de usuários: o "onde parou" de cada conta da página.
create or replace function public.admin_onde_parou(_ids uuid[])
returns table (id uuid, onde text, tom text, origem text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  return query select b.id, b.onde, b.tom, b.origem from public.jornada_base(null, _ids) b;
end $$;
revoke all on function public.admin_onde_parou(uuid[]) from public, anon;
grant execute on function public.admin_onde_parou(uuid[]) to authenticated;

-- Ficha da pessoa: os passos com hora e o que abriu em cada dia (14 dias).
create or replace function public.admin_jornada(_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  select to_jsonb(b) || jsonb_build_object('dias', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia, 'telas', d.telas) order by d.dia desc)
        from (select t.dia, jsonb_agg(jsonb_build_object('modulo', t.modulo, 'n', t.aberturas) order by t.aberturas desc) telas
                from public.uso_telas t
               where t.user_id = _id and t.dia > (now() at time zone 'America/Sao_Paulo')::date - 14
               group by t.dia) d), '[]'::jsonb))
    into r
    from public.jornada_base(null, array[_id]) b;
  return r;
end $$;
revoke all on function public.admin_jornada(uuid) from public, anon;
grant execute on function public.admin_jornada(uuid) to authenticated;

-- Visão geral: todo mundo que entrou no período, com o passo e o "onde parou".
create or replace function public.admin_funil_novos(_dias int default 14)
returns table (id uuid, nome text, criado_em timestamptz, tipo text, origem text, plano_lp text,
  passo int, onde text, tom text, checkout_plano text, checkout_vezes int, ultimo_acesso timestamptz, aparelho text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  return query
    select b.id, b.nome, b.criado_em, b.tipo, b.origem, b.plano_lp, b.passo, b.onde, b.tom,
           b.checkout_plano, b.checkout_vezes, b.ultimo_acesso, b.aparelho
      from public.jornada_base(now() - make_interval(days => greatest(1, least(_dias, 365))), null) b
     order by b.criado_em desc;
end $$;
revoke all on function public.admin_funil_novos(int) from public, anon;
grant execute on function public.admin_funil_novos(int) to authenticated;

notify pgrst, 'reload schema';
