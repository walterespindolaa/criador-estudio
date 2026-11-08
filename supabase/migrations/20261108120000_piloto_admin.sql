-- ═══════════════════════════════════════════════════════════════════════════
-- PILOTO DO ADMIN, ETAPA 1 (08/11/2026): os dados que faltavam pro painel.
-- Idempotente: pode rodar de novo sem quebrar. Tudo só-admin (is_admin()).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Custo da IA por chamada. Quem grava é o iaFetch das edges (service role).
create table if not exists public.ia_chamadas (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  user_id uuid,
  conta_id uuid,
  funcao text not null default 'desconhecida',
  modelo text,
  tokens_entrada int,
  tokens_saida int,
  custo_usd numeric(10,6),
  ok boolean not null default true,
  ms int
);
create index if not exists ia_chamadas_criado_em_idx on public.ia_chamadas (criado_em desc);
create index if not exists ia_chamadas_user_idx on public.ia_chamadas (user_id, criado_em desc);
create index if not exists ia_chamadas_funcao_idx on public.ia_chamadas (funcao, criado_em desc);
alter table public.ia_chamadas enable row level security;
drop policy if exists "admin le ia_chamadas" on public.ia_chamadas;
create policy "admin le ia_chamadas" on public.ia_chamadas for select using (public.is_admin());
-- sem policy de insert: só a service role (edges) grava.

-- 2) Status de cada erro agrupado (a assinatura vem de erro_assinatura()).
create table if not exists public.erros_status (
  assinatura text primary key,
  status text not null default 'novo' check (status in ('novo','olhando','resolvido')),
  nota text,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table public.erros_status enable row level security;
drop policy if exists "admin gerencia erros_status" on public.erros_status;
create policy "admin gerencia erros_status" on public.erros_status for all using (public.is_admin()) with check (public.is_admin());

-- Mesma mensagem com id ou número diferente cai no mesmo grupo.
create or replace function public.erro_assinatura(_msg text)
returns text language sql immutable as $$
  select md5(regexp_replace(lower(coalesce(_msg, '')), '[0-9a-f]{8}-[0-9a-f-]{27}|\d+', '#', 'g'))
$$;

-- 3) Notas internas por conta e visões salvas (filtros favoritos) de cada admin.
create table if not exists public.admin_notas (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null,
  autor uuid default auth.uid(),
  texto text not null check (length(texto) <= 4000),
  criado_em timestamptz not null default now()
);
create index if not exists admin_notas_conta_idx on public.admin_notas (conta_id, criado_em desc);
alter table public.admin_notas enable row level security;
drop policy if exists "admin gerencia admin_notas" on public.admin_notas;
create policy "admin gerencia admin_notas" on public.admin_notas for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.admin_visoes (
  id uuid primary key default gen_random_uuid(),
  autor uuid default auth.uid(),
  nome text not null check (length(nome) <= 80),
  filtros jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
alter table public.admin_visoes enable row level security;
drop policy if exists "admin gerencia admin_visoes" on public.admin_visoes;
create policy "admin gerencia admin_visoes" on public.admin_visoes for all using (public.is_admin()) with check (public.is_admin());

-- 4) Regras de alerta (o robô de hora em hora da etapa 4 lê daqui).
create table if not exists public.alerta_regras (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  nome text not null,
  ativo boolean not null default true,
  limite numeric,
  canal text[] not null default '{push}',
  ultimo_disparo timestamptz
);
alter table public.alerta_regras enable row level security;
drop policy if exists "admin gerencia alerta_regras" on public.alerta_regras;
create policy "admin gerencia alerta_regras" on public.alerta_regras for all using (public.is_admin()) with check (public.is_admin());
insert into public.alerta_regras (chave, nome, limite) values
  ('nenhum_cadastro_ate_15h', 'Nenhum cadastro até as 15h', 15),
  ('erro_novo', 'Erro novo apareceu', null),
  ('custo_ia_dia', 'Custo da Cria IA do dia acima de R$', 20),
  ('clique_teste_baixo', 'Clique no teste grátis abaixo de %', 5),
  ('teste_acabando_sem_uso', 'Teste acabando em até N dias sem uso', 3)
on conflict (chave) do nothing;

-- 5) Registro de tudo que o admin faz numa conta (estender teste, plano, cupom...).
create table if not exists public.admin_acoes_log (
  id uuid primary key default gen_random_uuid(),
  autor uuid default auth.uid(),
  conta_id uuid,
  acao text not null,
  detalhe jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists admin_acoes_log_conta_idx on public.admin_acoes_log (conta_id, criado_em desc);
alter table public.admin_acoes_log enable row level security;
drop policy if exists "admin le admin_acoes_log" on public.admin_acoes_log;
create policy "admin le admin_acoes_log" on public.admin_acoes_log for select using (public.is_admin());
drop policy if exists "admin grava admin_acoes_log" on public.admin_acoes_log;
create policy "admin grava admin_acoes_log" on public.admin_acoes_log for insert with check (public.is_admin());

-- 6) Resumo do Piloto num período. Origem da visita (1ª visualização da sessão):
--    anúncio = utm_medium paid ou fbclid; bio = utm_medium bio ou veio do
--    criaclub.bio; direto = sem referrer; orgânico = o resto. Prévias abertas
--    do disco (/Users/...) ficam de fora. "Usou 1ª função" = abriu alguma tela
--    fora Início, Planos, Configurações e Tutoriais (uso_telas, via registrar_tela).
create or replace function public.piloto_resumo(_desde timestamptz, _ate timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  with v as (
    select distinct on (sessao) sessao, criado_em,
      case when utm_medium = 'paid' or tem_fbclid then 'anuncio'
           when utm_medium = 'bio' or referrer_host ilike '%criaclub.bio%' then 'bio'
           when coalesce(referrer_host, '') = '' then 'direto'
           else 'organico' end as origem
    from public.site_visitas
    where evento = 'view' and criado_em >= _desde and criado_em < _ate
      and coalesce(pagina, '') not like '/Users/%'
    order by sessao, criado_em
  ),
  cad as (
    select u.id, pr.name, u.created_at, u.email_confirmed_at, u.raw_user_meta_data m,
      pr.onboarding_completed, pr.plan, pr.subscription_status, pr.trial_ends_at, pr.account_type
    from auth.users u join public.profiles pr on pr.id = u.id
    where u.created_at >= _desde and u.created_at < _ate
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('desde', _desde, 'ate', _ate),
    'visitas_por_hora', (
      select coalesce(jsonb_agg(x order by x.hora), '[]'::jsonb) from (
        select to_char(date_trunc('hour', criado_em at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD"T"HH24:00') hora,
          count(*) filter (where origem = 'anuncio') anuncio,
          count(*) filter (where origem = 'bio') bio,
          count(*) filter (where origem = 'direto') direto,
          count(*) filter (where origem = 'organico') organico
        from v group by 1) x),
    'funil', (
      select jsonb_build_object(
        'visitas', (select count(*) from v),
        'clicou_teste', (select count(distinct sessao) from public.site_visitas
           where evento in ('clique', 'cta') and criado_em >= _desde and criado_em < _ate
             and (alvo ilike '%grátis%' or alvo ilike '%gratis%' or alvo ilike '%teste%')),
        'cadastros', count(*),
        'confirmou', count(*) filter (where email_confirmed_at is not null),
        'onboarding', count(*) filter (where onboarding_completed),
        'usou_funcao', count(*) filter (where exists (select 1 from public.uso_telas t
           where t.user_id = cad.id and t.modulo not in ('dashboard', 'assinar', 'configuracoes', 'tutoriais'))),
        'assinou', count(*) filter (where subscription_status = 'active'))
      from cad),
    'cadastros', (
      select coalesce(jsonb_agg(x order by x.criado_em desc), '[]'::jsonb) from (
        select id, name, created_at criado_em,
          case when m->>'utm_medium' = 'paid' or m ? 'veio_de_anuncio' then 'anuncio'
               when m->>'utm_medium' = 'bio' then 'bio'
               when m ? 'utm_source' then 'outro' else 'sem_origem' end origem,
          m->>'utm_content' anuncio_id,
          email_confirmed_at is not null confirmou, onboarding_completed onboarding,
          plan, subscription_status, trial_ends_at, account_type,
          (select max(t.dia) from public.uso_telas t where t.user_id = cad.id) ultimo_uso
        from cad limit 200) x),
    'anuncios', (
      select coalesce(jsonb_agg(x order by x.gasto desc nulls last), '[]'::jsonb) from (
        select d.ad_id, max(d.ad_nome) ad_nome, max(d.campanha_nome) campanha, sum(d.gasto) gasto,
          sum(d.cliques_link) cliques, sum(d.visitas_lp) visitas_lp,
          (select count(*) from cad where cad.m->>'utm_content' = d.ad_id) cadastros
        from public.trafego_meta_diario d
        where d.dia between (_desde at time zone 'America/Sao_Paulo')::date and (_ate at time zone 'America/Sao_Paulo')::date
        group by d.ad_id) x),
    'ia', jsonb_build_object(
      'total', (select jsonb_build_object('chamadas', count(*), 'custo_usd', coalesce(sum(custo_usd), 0),
          'tokens', coalesce(sum(coalesce(tokens_entrada, 0) + coalesce(tokens_saida, 0)), 0))
        from public.ia_chamadas where criado_em >= _desde and criado_em < _ate),
      'por_funcao', (select coalesce(jsonb_agg(x order by x.custo_usd desc nulls last), '[]'::jsonb) from (
        select funcao, count(*) chamadas, sum(custo_usd) custo_usd, count(*) filter (where not ok) falhas
        from public.ia_chamadas where criado_em >= _desde and criado_em < _ate group by funcao) x),
      'por_conta', (select coalesce(jsonb_agg(x order by x.custo_usd desc nulls last), '[]'::jsonb) from (
        select coalesce(conta_id, user_id) conta, count(*) chamadas, sum(custo_usd) custo_usd
        from public.ia_chamadas where criado_em >= _desde and criado_em < _ate
        group by 1 order by 3 desc nulls last limit 20) x)),
    'erros', (
      select coalesce(jsonb_agg(x order by x.ultima desc), '[]'::jsonb) from (
        select public.erro_assinatura(l.message) assinatura, min(l.message) exemplo, count(*) vezes,
          count(distinct l.user_id) contas, min(l.created_at) primeira, max(l.created_at) ultima,
          coalesce(max(s.status), 'novo') status
        from public.app_logs l
        left join public.erros_status s on s.assinatura = public.erro_assinatura(l.message)
        where l.level = 'error' and l.created_at >= _desde and l.created_at < _ate
        group by 1 limit 100) x)
  ) into r
  from (select 1) _;
  return r;
end $$;

revoke all on function public.piloto_resumo(timestamptz, timestamptz) from public, anon;
grant execute on function public.piloto_resumo(timestamptz, timestamptz) to authenticated;
