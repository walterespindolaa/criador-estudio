-- ═══════════════════════════════════════════════════════════════════════════
-- PENTE FINO 23/09/2026 · Semana 1 · Parceiro de produção
--
-- 1. Papel "filmmaker" (captação) entra na lista de papéis de parceiro.
--    A lista vivia repetida em quatro funções; agora todas perguntam pra
--    `eh_papel_parceiro`, que é a única fonte.
-- 2. Código "me adicione no Cria": o parceiro que se cadastrou sozinho não
--    tinha como chamar a agência (caía no MinhasDemandas vazio, sem botão).
--    Ele copia um código curto, manda no WhatsApp, a social mídia cola em
--    Equipe e o vínculo nasce sem convite por e-mail.
-- 3. Correção do trigger de colunas de controle (20260923000001): ele
--    barrava o próprio usuário de baixar `must_change_password` depois de
--    trocar a senha, o que travava a tela /app/trocar-senha em loop. Baixar
--    a flag (true -> false) é liberado; subir continua só pelo servidor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Papel filmmaker
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.eh_papel_parceiro(_role text)
returns boolean language sql immutable as $$
  select coalesce(_role, 'social_media') in ('designer', 'editor_video', 'copy', 'trafego', 'filmmaker');
$$;

-- my_team_accounts (20260830000001) tinha a lista copiada.
create or replace function public.my_team_accounts()
returns table (owner_id uuid, name text, avatar_url text, niche text, instagram_handle text)
language sql stable security definer set search_path = public as $$
  select p.id as owner_id,
         coalesce(p.name, 'Agência') as name,
         p.avatar_url,
         null::text as niche,
         null::text as instagram_handle
  from public.manager_members m
  join public.profiles p on p.id = m.manager_id
  where m.member_id = auth.uid() and m.status = 'ativo'
    and not public.eh_papel_parceiro(m.role);
$$;

-- Gatilho do cadastro com intenção de parceiro (20260909000005): mesma
-- lista copiada. Corpo igual, só a validação do papel muda.
create or replace function public.aplicar_intencao_parceiro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _meta jsonb;
  _papel text;
begin
  select raw_user_meta_data into _meta from auth.users where id = new.id;
  if coalesce(_meta->>'account_intent', '') <> 'parceiro' then
    return new;
  end if;

  _papel := coalesce(nullif(btrim(_meta->>'parceiro_role'), ''), 'designer');
  if not public.eh_papel_parceiro(_papel) then
    _papel := 'designer';
  end if;

  update public.profiles
  set account_type = 'parceiro',
      parceiro_role = _papel,
      plan = 'free',
      trial_started_at = null,
      trial_ends_at = null
  where id = new.id;

  return new;
end;
$$;

-- admin_definir_parceiro: valida o papel pela mesma fonte.
-- O nome do parâmetro tem que ser o original (_papel): o Postgres não deixa
-- renomear parâmetro com create or replace (erro 42P13).
create or replace function public.admin_definir_parceiro(_user_id uuid, _papel text default 'designer')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'apenas admin';
  end if;
  update public.profiles
     set account_type = 'parceiro',
         parceiro_role = case when public.eh_papel_parceiro(_papel) then _papel else 'designer' end,
         plan = 'free', trial_started_at = null, trial_ends_at = null
   where id = _user_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Código "me adicione no Cria"
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists codigo_parceiro text;
create unique index if not exists profiles_codigo_parceiro_uidx
  on public.profiles (codigo_parceiro) where codigo_parceiro is not null;
comment on column public.profiles.codigo_parceiro is
  'Código curto que o parceiro de produção manda pra agência colar em Equipe. Gerado por parceiro_meu_codigo().';

-- Sem 0/O/1/I pra não confundir no WhatsApp. 6 caracteres = 1 bilhão de
-- combinações; colisão cai no unique e tenta de novo.
create or replace function public.parceiro_meu_codigo()
returns text language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _atual text;
  _novo text;
  _alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _i int;
  _tentativa int := 0;
begin
  if _uid is null then raise exception 'sem sessão'; end if;
  select codigo_parceiro into _atual from public.profiles where id = _uid;
  if _atual is not null then return _atual; end if;
  loop
    _tentativa := _tentativa + 1;
    _novo := '';
    for _i in 1..6 loop
      _novo := _novo || substr(_alfabeto, 1 + floor(random() * length(_alfabeto))::int, 1);
    end loop;
    begin
      update public.profiles set codigo_parceiro = _novo where id = _uid;
      return _novo;
    exception when unique_violation then
      if _tentativa > 10 then raise; end if;
    end;
  end loop;
end $$;
revoke all on function public.parceiro_meu_codigo() from public, anon;
grant execute on function public.parceiro_meu_codigo() to authenticated;

-- A agência cola o código: nasce o vínculo em manager_members com o papel
-- que o parceiro declarou no cadastro. Parceiro não consome assento nem
-- recebe módulo (mesma regra do manager-member-invite). Rate limit por
-- usuário pra ninguém varrer códigos.
create or replace function public.agencia_vincular_parceiro(_codigo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _cod text := upper(regexp_replace(coalesce(_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  _p record;
  _papel text;
begin
  if _uid is null then raise exception 'sem sessão'; end if;
  if to_regprocedure('public.rate_touch(text, int)') is not null then
    if not public.rate_touch('vincular-parceiro:' || _uid::text, 20) then
      return jsonb_build_object('ok', false, 'erro', 'muitas_tentativas');
    end if;
  end if;
  if length(_cod) <> 6 then
    return jsonb_build_object('ok', false, 'erro', 'codigo_invalido');
  end if;
  select id, name, email, parceiro_role into _p from public.profiles where codigo_parceiro = _cod;
  if _p.id is null then
    return jsonb_build_object('ok', false, 'erro', 'nao_encontrado');
  end if;
  if _p.id = _uid then
    return jsonb_build_object('ok', false, 'erro', 'proprio_codigo');
  end if;
  _papel := case when public.eh_papel_parceiro(_p.parceiro_role) then _p.parceiro_role else 'designer' end;
  insert into public.manager_members (manager_id, member_id, name, email, status, role)
  values (_uid, _p.id, _p.name, _p.email, 'ativo', _papel)
  on conflict (manager_id, member_id) do update
    set status = 'ativo',
        role = case when public.eh_papel_parceiro(public.manager_members.role) then public.manager_members.role else excluded.role end;
  return jsonb_build_object('ok', true, 'nome', coalesce(_p.name, 'Parceiro'), 'papel', _papel, 'member_id', _p.id);
end $$;
revoke all on function public.agencia_vincular_parceiro(text) from public, anon;
grant execute on function public.agencia_vincular_parceiro(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Trigger de colunas de controle: baixar must_change_password é do usuário
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.profiles_travar_colunas_de_controle()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return new;
  end if;
  if new.storage_used_bytes is distinct from old.storage_used_bytes
     or new.storage_quota_bytes is distinct from old.storage_quota_bytes
     or new.role is distinct from old.role
     or new.plan is distinct from old.plan
     or new.subscription_status is distinct from old.subscription_status
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     /* Só o servidor LIGA a flag; o próprio usuário DESLIGA depois de trocar
        a senha em /app/trocar-senha. Sem isso a tela entrava em loop. */
     or (new.must_change_password is distinct from old.must_change_password
         and not (coalesce(old.must_change_password, false) = true and coalesce(new.must_change_password, false) = false))
     or new.parceiro_role is distinct from old.parceiro_role
     or new.account_type is distinct from old.account_type
     or new.codigo_parceiro is distinct from old.codigo_parceiro
  then
    raise exception 'coluna de controle do perfil so muda pelo servidor';
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Totais da bio somados no banco (performance)
-- ─────────────────────────────────────────────────────────────────────────
-- useBioTotais puxava TODAS as linhas de bio_stats_daily (dia x bloco x
-- origem) só pra somar dois números no navegador. Uma bio com 1 ano de vida
-- e 20 blocos são milhares de linhas por abertura da tela. A RPC soma e
-- devolve dois inteiros; a policy de leitura continua a mesma (security
-- invoker), então quem não pode ler a tabela também não soma.
create or replace function public.bio_totais(_page_id uuid default null, _user_id uuid default null)
returns table (visitas bigint, cliques bigint)
language sql stable security invoker set search_path = public as $$
  select coalesce(sum(views), 0)::bigint, coalesce(sum(clicks), 0)::bigint
  from public.bio_stats_daily s
  where (_page_id is not null and s.page_id = _page_id)
     or (_page_id is null and _user_id is not null and s.user_id = _user_id and s.page_id is null);
$$;
revoke all on function public.bio_totais(uuid, uuid) from public, anon;
grant execute on function public.bio_totais(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Mensalidades: sincronizar valor/vencimento num UPDATE só (performance)
-- ─────────────────────────────────────────────────────────────────────────
-- useEnsureMonthly fazia um UPDATE por cliente, em série, TODA vez que o
-- Caixa abria (50 clientes = 51 idas ao banco). Agora manda a lista inteira
-- e o banco resolve em uma instrução. Security invoker: a RLS de fin_monthly
-- continua valendo, ninguém mexe em mensalidade de outra agência.
create or replace function public.fin_monthly_sincronizar(_rows jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare _n integer;
begin
  update public.fin_monthly f
     set due_date = r.due_date,
         amount = r.amount
    from jsonb_to_recordset(coalesce(_rows, '[]'::jsonb))
         as r(crm_client_id uuid, month_ref date, due_date date, amount numeric)
   where f.crm_client_id = r.crm_client_id
     and f.month_ref = r.month_ref
     and f.status = 'pendente'
     and (f.due_date is distinct from r.due_date or f.amount is distinct from r.amount);
  get diagnostics _n = row_count;
  return _n;
end $$;
revoke all on function public.fin_monthly_sincronizar(jsonb) from public, anon;
grant execute on function public.fin_monthly_sincronizar(jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. apify-scrape: claim atômico do poll + órfãos
-- ─────────────────────────────────────────────────────────────────────────
-- O poll vira o job de 'running' pra 'processing' antes de gastar crédito
-- (transcrição, IA). `claimed_at` diz há quanto tempo; se a edge morreu no
-- meio (timeout), depois de 4 min o próximo poll pode reclamar. Jobs em
-- 'running' há mais de 2 h sem ninguém olhando viram erro, pra não ficar
-- "analisando..." eterno na tela (o crédito já foi devolvido ou gasto).
alter table public.competitor_scrapes add column if not exists claimed_at timestamptz;

create or replace function public.apify_scrapes_orfaos()
returns integer language plpgsql security definer set search_path = public as $$
declare _n integer;
begin
  update public.competitor_scrapes
     set status = 'error',
         error = 'A análise ficou parada por muito tempo e foi encerrada. Tente de novo.',
         finished_at = now()
   where status in ('running', 'processing')
     and created_at < now() - interval '2 hours';
  get diagnostics _n = row_count;
  return _n;
end $$;
revoke all on function public.apify_scrapes_orfaos() from public, anon, authenticated;
grant execute on function public.apify_scrapes_orfaos() to service_role;

-- Cron de hora em hora, se o pg_cron estiver ligado (Lovable Cloud tem).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('apify-scrapes-orfaos') where exists (select 1 from cron.job where jobname = 'apify-scrapes-orfaos');
    perform cron.schedule('apify-scrapes-orfaos', '17 * * * *', 'select public.apify_scrapes_orfaos()');
    raise notice 'cron apify-scrapes-orfaos agendado';
  else
    raise notice 'pg_cron ausente: apify_scrapes_orfaos() fica pra chamada manual';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Trilha do admin (quem fez o quê com a conta de quem)
-- ─────────────────────────────────────────────────────────────────────────
-- Suspender, trocar plano, apagar dados, reenviar acesso: tudo passava sem
-- registro. Se a tabela já existia pelo dashboard, o `if not exists` deixa
-- como está; o RLS liga em todo caso (só admin lê; só o servidor escreve).
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  target_user_id uuid,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_actions_target_idx on public.admin_actions (target_user_id, created_at desc);
alter table public.admin_actions enable row level security;
drop policy if exists "admin_actions só admin lê" on public.admin_actions;
create policy "admin_actions só admin lê" on public.admin_actions
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ─────────────────────────────────────────────────────────────────────────
-- 8. E-mails do ciclo de vida (boas-vindas, trial D-2/D0, aprovação parada)
-- ─────────────────────────────────────────────────────────────────────────
-- A edge lifecycle-emails roda 1x por dia e grava aqui cada envio; o UNIQUE
-- é o que impede mandar duas vezes. Só o servidor lê e escreve.
create table if not exists public.emails_ciclo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tipo text not null,
  ref text,
  sent_at timestamptz not null default now()
);
create unique index if not exists emails_ciclo_uidx on public.emails_ciclo (user_id, tipo, coalesce(ref, ''));
alter table public.emails_ciclo enable row level security;

-- Cron às 13:00 UTC (10:00 BRT), depois do daily-notifications. O segredo é
-- o mesmo placeholder dos outros crons: preencher antes de rodar.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('cria-lifecycle-emails');
    exception when others then null;
    end;
    perform cron.schedule(
      'cria-lifecycle-emails',
      '0 13 * * *',
      $cron$
        select net.http_post(
          url := 'https://exuxlwdnkgmhtnwoyvwo.supabase.co/functions/v1/lifecycle-emails',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-internal-secret', '__INTERNAL_PUSH_SECRET__'
          ),
          body := '{}'::jsonb
        );
      $cron$
    );
    raise notice 'cron cria-lifecycle-emails agendado (trocar __INTERNAL_PUSH_SECRET__ pelo valor real)';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Push: categorias completas, horário de silêncio e teto diário
-- ─────────────────────────────────────────────────────────────────────────
-- (a) Tipos criados depois da tabela de categorias caíam em 'avisos' e não
--     respeitavam a preferência da pessoa. (b) Push às 3 da manhã. (c) Dia
--     de cron cheio mandava 15 pushes pra mesma pessoa. O gatilho continua
--     chamando quer_push(); só a regra dentro dela muda.
create or replace function public.notif_categoria(_tipo text)
returns text language sql immutable as $$
  select case _tipo
    when 'lead' then 'leads'
    when 'cria_post' then 'clientes'
    when 'comentario_cliente' then 'clientes'
    when 'cronograma' then 'clientes'
    when 'roteiro' then 'clientes'
    when 'material' then 'clientes'
    when 'cliente_atrasado' then 'clientes'
    when 'renovacao_cliente' then 'clientes'
    when 'aprovacao_pendente' then 'clientes'
    when 'resumo_dia' then 'lembretes'
    when 'lembrete_postar' then 'lembretes'
    when 'posts_pendentes' then 'lembretes'
    when 'story' then 'lembretes'
    when 'captacao_amanha' then 'lembretes'
    when 'aniversario_cliente' then 'lembretes'
    when 'prazo_amanha' then 'lembretes'
    when 'demanda_prazo_amanha' then 'lembretes'
    when 'demanda_atrasada' then 'lembretes'
    when 'demanda_nova' then 'clientes'
    when 'demanda_ajuste' then 'clientes'
    when 'demanda_entregue' then 'clientes'
    when 'resumo_semana_ig' then 'conquistas'
    when 'meta_batida' then 'conquistas'
    when 'dica_dia' then 'conquistas'
    when 'habito_semana' then 'conquistas'
    when 'post_publicado' then 'conquistas'
    when 'ideia_criada' then 'conquistas'
    when 'volte' then 'avisos'
    when 'acesso_vencendo' then 'avisos'
    else 'avisos' end
$$;

create or replace function public.quer_push(_user uuid, _tipo text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  _pref boolean;
  _hora int;
  _hoje int;
begin
  -- Preferência por categoria (ausente = ligado).
  select (p.notification_prefs ->> public.notif_categoria(_tipo))::boolean into _pref
    from public.profiles p where p.id = _user;
  if coalesce(_pref, true) = false then return false; end if;

  -- Silêncio das 22h às 7h (Brasília). Lead e comentário de cliente passam:
  -- são a pessoa do outro lado esperando resposta; o resto espera amanhecer
  -- (o sino continua recebendo tudo, só o push é segurado).
  _hora := extract(hour from (now() at time zone 'America/Sao_Paulo'))::int;
  if (_hora >= 22 or _hora < 7) and _tipo not in ('lead', 'comentario_cliente', 'cria_post') then
    return false;
  end if;

  -- Teto: 8 pushes por dia por pessoa. Conta as notificações do dia que
  -- passariam pelo filtro de categoria; a partir da 9ª só o sino recebe.
  select count(*) into _hoje
    from public.notifications n
   where n.user_id = _user
     and n.created_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  if _hoje > 8 then return false; end if;

  return true;
end $$;
revoke all on function public.quer_push(uuid, text) from public, anon;
grant execute on function public.quer_push(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
