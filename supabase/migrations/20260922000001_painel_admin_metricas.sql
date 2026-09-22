-- ============================================================
-- OS NUMEROS DO PAINEL DE ADMIN (Walter, 22/09/2026)
--
-- "Poderia fazer uma reestruturacao desse painel de admin, trazer dados mais
-- bem tratados, mais divididos, mais informacoes."
--
-- O painel hoje sabe responder "quantas contas existem" e "quantas sao pro".
-- Nao sabe responder as perguntas que um dono faz de manha: quem entrou e nao
-- voltou, quem esta prestes a perder o trial, quem bateu no teto e nao consegue
-- crescer, quem esta gastando IA fora da curva. Sao estas tres funcoes.
--
-- TRES DECISOES DE PROJETO, pra ninguem se surpreender depois:
--
-- 1. MRR NAO ENTRA AQUI. Ele continua vindo da edge admin-billing, que le o
--    Stripe direto. A tabela public.subscriptions existe mas esta orfa no
--    admin, e calcular dinheiro a partir de uma tabela que talvez nao esteja
--    populada seria inventar numero. Dinheiro se le na fonte.
--
-- 2. CADA LISTA VEM CURTA (10 itens) E JA ORDENADA pela urgencia. O painel e
--    pra decidir em quem tocar hoje, nao pra virar relatorio. Quem quiser o
--    resto tem a aba de Contas com busca e filtro.
--
-- 3. LEITURA DEFENSIVA DE TABELA. Varias tabelas deste projeto nasceram pelo
--    dashboard e nao estao nas migrations (partners, referrals, modules...).
--    Entao tudo que nao e core passa por to_regclass antes: se a tabela nao
--    existir naquele ambiente, o numero vem zero em vez de derrubar o painel.
-- ============================================================

-- ── 1. O RESUMO ─────────────────────────────────────────────────────────────
create or replace function public.painel_admin_resumo()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  _r jsonb;
begin
  -- Mesma trava do get_admin_usage: sem admin, sem numero.
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return null;
  end if;

  select jsonb_build_object(
    -- QUEM SAO. account_type separa social midia de criadora; parceiro_role
    -- marca designer/filmmaker. Conta sem tipo e criadora (o caso antigo).
    'contas', jsonb_build_object(
      'total',        (select count(*) from public.profiles),
      'social_midia', (select count(*) from public.profiles where account_type = 'manager'),
      'criadoras',    (select count(*) from public.profiles where coalesce(account_type, 'creator') = 'creator'),
      'parceiros',    (select count(*) from public.profiles where parceiro_role is not null),
      'clientes_de_agencia', (select count(*) from public.profiles where agency_owner_id is not null)
    ),

    -- ENTRADA. O mes corrente contra o mes passado no MESMO dia do mes: sem
    -- isso, todo dia 2 parece que o negocio desabou.
    'novos', jsonb_build_object(
      'd7',  (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
      'd30', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
      'mes_atual', (select count(*) from public.profiles
                     where created_at >= date_trunc('month', now())),
      'mes_passado_ate_hoje', (select count(*) from public.profiles
                     where created_at >= date_trunc('month', now() - interval '1 month')
                       and created_at <  date_trunc('month', now() - interval '1 month')
                                         + (now() - date_trunc('month', now())))
    ),

    -- USO. last_seen_at e atualizado pelo touch_last_seen (janela de 5 min).
    'ativos', jsonb_build_object(
      'd1',  (select count(*) from public.profiles where last_seen_at >= now() - interval '1 day'),
      'd7',  (select count(*) from public.profiles where last_seen_at >= now() - interval '7 days'),
      'd30', (select count(*) from public.profiles where last_seen_at >= now() - interval '30 days')
    ),

    -- ATIVACAO: dos que entraram nos ultimos 30 dias, quantos passaram de cada
    -- degrau. E o funil que diz se o problema e atrair ou acolher.
    'ativacao', (
      select jsonb_build_object(
        'entraram',  count(*),
        'onboarding', count(*) filter (where p.onboarding_completed = true),
        'voltaram',  count(*) filter (where p.last_seen_at >= p.created_at + interval '1 day'),
        'produziram', count(*) filter (where exists (
                        select 1 from public.posts po where po.user_id = p.id))
      )
      from public.profiles p
      where p.created_at >= now() - interval '30 days'
    ),

    'planos', jsonb_build_object(
      'free',   (select count(*) from public.profiles where coalesce(plan, 'free') = 'free'),
      'pro',    (select count(*) from public.profiles where plan = 'pro'),
      'studio', (select count(*) from public.profiles where plan = 'studio'),
      'agency', (select count(*) from public.profiles where plan = 'agency')
    ),

    'trial', jsonb_build_object(
      'em_trial',  (select count(*) from public.profiles
                     where trial_ends_at is not null and trial_ends_at > now()),
      'vence_7d',  (select count(*) from public.profiles
                     where trial_ends_at is not null
                       and trial_ends_at between now() and now() + interval '7 days')
    ),

    -- Assinatura pelo espelho local (o valor em dinheiro vem do Stripe).
    'assinatura', jsonb_build_object(
      'ativas',     (select count(*) from public.profiles where subscription_status = 'active'),
      'suspensas',  (select count(*) from public.profiles where subscription_status = 'suspended')
    ),

    -- O QUE FOI FEITO NA CASA. Serve pra sentir o peso da operacao.
    'producao', jsonb_build_object(
      'posts_30d',      (select count(*) from public.posts where created_at >= now() - interval '30 days'),
      'publicados_30d', (select count(*) from public.posts
                          where status = 'publicado' and created_at >= now() - interval '30 days'),
      'clientes_crm',   (select count(*) from public.crm_clients where deleted_at is null)
    )
  ) into _r;

  return _r;
end; $$;

revoke execute on function public.painel_admin_resumo() from anon, public;
grant execute on function public.painel_admin_resumo() to authenticated;

comment on function public.painel_admin_resumo is
  'Painel de admin: contagens de conta, entrada, uso, ativacao, planos e producao. Dinheiro NAO sai daqui (ver edge admin-billing).';


-- ── 2. QUEM PRECISA DE VOCE HOJE ────────────────────────────────────────────
create or replace function public.painel_admin_atencao()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  _r jsonb;
  _erros jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return null;
  end if;

  -- app_logs e core (tem migration), mas a checagem custa nada e protege
  -- ambiente novo que ainda nao rodou tudo.
  if to_regclass('public.app_logs') is not null then
    select coalesce(jsonb_agg(x order by (x->>'erros')::int desc), '[]'::jsonb)
      into _erros
    from (
      select jsonb_build_object(
               'id', p.id, 'nome', p.name, 'plano', p.plan,
               'erros', count(l.id),
               'ultimo', max(l.created_at)
             ) as x
      from public.app_logs l
      join public.profiles p on p.id = l.user_id
      where l.created_at >= now() - interval '7 days'
        and lower(coalesce(l.level, 'error')) = 'error'
      group by p.id, p.name, p.plan
      having count(l.id) >= 3
      limit 10
    ) s;
  end if;

  select jsonb_build_object(
    -- TRAVADOS: entrou ha mais de 3 dias e nunca terminou o onboarding. E o
    -- grupo mais barato de recuperar, porque a intencao ja existiu.
    'travados', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', id, 'nome', name, 'plano', plan, 'tipo', account_type,
               'dias', floor(extract(epoch from now() - created_at) / 86400)::int
             ) order by created_at), '[]'::jsonb)
      from (
        select id, name, plan, account_type, created_at
        from public.profiles
        where coalesce(onboarding_completed, false) = false
          and created_at <= now() - interval '3 days'
          and created_at >= now() - interval '60 days'
        order by created_at desc
        limit 10
      ) t
    ),

    -- SUMIDOS: usava e parou. Entre 14 e 90 dias sem aparecer, porque antes
    -- disso e ferias e depois disso ja e outro assunto (reativacao fria).
    'sumidos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', id, 'nome', name, 'plano', plan,
               'dias', floor(extract(epoch from now() - last_seen_at) / 86400)::int
             ) order by last_seen_at desc), '[]'::jsonb)
      from (
        select id, name, plan, last_seen_at
        from public.profiles
        where last_seen_at is not null
          and last_seen_at between now() - interval '90 days' and now() - interval '14 days'
          and coalesce(plan, 'free') <> 'free'
        order by last_seen_at desc
        limit 10
      ) t
    ),

    -- TRIAL VENCENDO: o que vence primeiro aparece primeiro.
    'trial_vencendo', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', id, 'nome', name, 'plano', plan,
               'dias', greatest(0, ceil(extract(epoch from trial_ends_at - now()) / 86400))::int
             ) order by trial_ends_at), '[]'::jsonb)
      from (
        select id, name, plan, trial_ends_at
        from public.profiles
        where trial_ends_at between now() and now() + interval '7 days'
        order by trial_ends_at
        limit 10
      ) t
    ),

    -- NO TETO DA CARTEIRA: social midia que nao consegue cadastrar mais
    -- cliente. Cada uma aqui e dinheiro parado na porta, dos dois lados.
    'no_teto', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', id, 'nome', name,
               'usados', usados, 'teto', teto
             ) order by usados desc), '[]'::jsonb)
      from (
        select p.id, p.name,
               (select count(*) from public.crm_clients c
                 where c.manager_id = p.id and c.deleted_at is null) as usados,
               3 + ((coalesce(p.client_packs, 0) + coalesce(p.paid_client_packs, 0)) * 10) as teto
        from public.profiles p
        where p.account_type = 'manager'
      ) s
      where usados >= teto
      limit 10
    ),

    'com_erro', _erros
  ) into _r;

  return _r;
end; $$;

revoke execute on function public.painel_admin_atencao() from anon, public;
grant execute on function public.painel_admin_atencao() to authenticated;

comment on function public.painel_admin_atencao is
  'Painel de admin: listas curtas de quem precisa de atencao hoje (travados, sumidos, trial vencendo, no teto, com erro).';


-- ── 3. CUSTO DE IA ──────────────────────────────────────────────────────────
-- O unico custo com valor REAL em dolar e o do Radar (competitor_scrapes.
-- cost_usd, que vem da Apify). Os outros sao contagem de uso: ninguem devolve
-- centavo por chamada. Entao a funcao devolve as duas coisas separadas e nao
-- finge que sabe converter uma na outra.
create or replace function public.painel_admin_custo_ia(_dias int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  _r jsonb;
  _desde timestamptz;
  _radar jsonb := jsonb_build_object('scrapes', 0, 'custo_usd', 0);
  _top jsonb := '[]'::jsonb;
  _estudio int := 0;
  _chamadas bigint := 0;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return null;
  end if;

  _desde := now() - make_interval(days => greatest(1, least(365, coalesce(_dias, 30))));

  if to_regclass('public.competitor_scrapes') is not null then
    select jsonb_build_object(
             'scrapes', count(*),
             'custo_usd', round(coalesce(sum(cost_usd), 0)::numeric, 2)
           )
      into _radar
    from public.competitor_scrapes
    where created_at >= _desde;

    select coalesce(jsonb_agg(x order by (x->>'custo_usd')::numeric desc), '[]'::jsonb)
      into _top
    from (
      select jsonb_build_object(
               'id', p.id, 'nome', p.name, 'plano', p.plan,
               'scrapes', count(cs.id),
               'custo_usd', round(coalesce(sum(cs.cost_usd), 0)::numeric, 2)
             ) as x
      from public.competitor_scrapes cs
      join public.profiles p on p.id = cs.manager_id
      where cs.created_at >= _desde
      group by p.id, p.name, p.plan
      order by sum(cs.cost_usd) desc nulls last
      limit 10
    ) s;
  end if;

  if to_regclass('public.higgsfield_jobs') is not null then
    select count(*)::int into _estudio
    from public.higgsfield_jobs where created_at >= _desde;
  end if;

  if to_regclass('public.ai_rate_limit') is not null then
    select coalesce(sum(call_count), 0)::bigint into _chamadas
    from public.ai_rate_limit where window_start >= _desde;
  end if;

  _r := jsonb_build_object(
    'dias', greatest(1, least(365, coalesce(_dias, 30))),
    'radar', _radar,
    'imagens_estudio', _estudio,
    'chamadas_ia', _chamadas,
    'top_contas', _top
  );
  return _r;
end; $$;

revoke execute on function public.painel_admin_custo_ia(int) from anon, public;
grant execute on function public.painel_admin_custo_ia(int) to authenticated;

comment on function public.painel_admin_custo_ia is
  'Painel de admin: uso e custo de IA no periodo. Custo em dolar so existe pro Radar (Apify); o resto e contagem de uso.';
