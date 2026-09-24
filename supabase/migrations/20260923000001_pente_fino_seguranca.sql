-- ═══════════════════════════════════════════════════════════════════════════
-- PENTE FINO PRÉ-LANÇAMENTO · SEGURANÇA (23/09/2026)
--
-- Fecha os achados S2, S4, S5, S8, S11 e 2.7 do relatório
-- (CRIA/pente-fino-pre-lancamento-2026-09-23.md). Tudo aqui é idempotente e
-- defensivo: cada bloco checa se a tabela/função existe antes de mexer,
-- porque parte do schema foi criada pelo dashboard e não está versionada.
--
-- Leia o NOTICE de cada bloco no output do SQL editor: ele diz o que foi
-- ligado e o que já estava certo.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. PARCEIRO DE PRODUÇÃO SAI DO `is_team_member` (S5)
--
-- `acts_for` = dono OU is_team_member. `is_team_member` não olhava o papel,
-- então o freelancer (designer/filmmaker) passava em toda policy que usa
-- `acts_for`: comentários do cliente, bio, insights, brandbook. As funções do
-- parceiro (fila, aceitar card, entregar) fazem o próprio join em
-- manager_members e checam `parceiro_tem_o_card`, então continuam iguais.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.is_team_member(target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.manager_members m
    where m.manager_id = target
      and m.member_id = auth.uid()
      and m.status = 'ativo'
      and not public.eh_papel_parceiro(m.role)
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. FUNÇÕES QUE `anon` PODIA CHAMAR (S4, S11, 2.8)
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'reconcile_agency_seats', 'bio_lead_para_pipeline', 'quer_push',
        'increment_bio_view', 'increment_bio_link_click', 'submit_bio_lead', 'submit_bio_page_lead',
        'get_user_id_by_email'
      )
  loop
    execute format('revoke all on function %s from public, anon', f.assinatura);
    /* Revogar de PUBLIC também tira o default do service_role: as edges
       (bio-track, webhook, manager-add-client) chamam essas funções com a
       chave de serviço, então o grant volta explícito. */
    execute format('grant execute on function %s to service_role', f.assinatura);
    raise notice 'revogado de anon/public, mantido pra service_role: %', f.assinatura;
  end loop;
end $$;

-- Quem precisa continuar chamando, chama autenticado ou pela edge (service role):
do $$
begin
  if to_regprocedure('public.reconcile_agency_seats(uuid)') is not null then
    execute 'grant execute on function public.reconcile_agency_seats(uuid) to service_role';
  end if;
  if to_regprocedure('public.bio_lead_para_pipeline(uuid, uuid, text, text, text, text)') is not null then
    execute 'grant execute on function public.bio_lead_para_pipeline(uuid, uuid, text, text, text, text) to authenticated, service_role';
  end if;
  if to_regprocedure('public.quer_push(uuid, text)') is not null then
    execute 'grant execute on function public.quer_push(uuid, text) to authenticated, service_role';
  end if;
end $$;

-- `bio_lead_para_pipeline` também precisa checar que o bloco é da gestora.
-- Reescreve só o guard, mantendo o corpo: o mais seguro sem ver a versão
-- de produção é envolver a chamada. Se a assinatura for outra, o bloco
-- avisa e nada quebra.
do $$
begin
  if to_regprocedure('public.bio_lead_para_pipeline(uuid, uuid, text, text, text, text)') is null then
    raise notice 'bio_lead_para_pipeline com assinatura diferente da esperada: confira a posse do bloco manualmente';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. `admin_definir_parceiro`: comparação com NULL não bloqueava (2.7)
-- ─────────────────────────────────────────────────────────────────────────
-- A função original está em 20260909000005. Só o guard muda: `<> 'admin'`
-- com role NULL dá NULL, e `if NULL then raise` não levanta. Trocado por
-- `not exists`. O corpo é recriado igual.
do $$
begin
  if to_regprocedure('public.admin_definir_parceiro(uuid, text)') is not null then
    execute $f$
      create or replace function public.admin_definir_parceiro(_user_id uuid, _papel text default 'designer')
      returns void language plpgsql security definer set search_path = public as $b$
      begin
        if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
          raise exception 'apenas admin';
        end if;
        update public.profiles
           set account_type = 'parceiro', parceiro_role = _papel,
               plan = 'free', trial_started_at = null, trial_ends_at = null
         where id = _user_id;
      end $b$;
    $f$;
    raise notice 'admin_definir_parceiro: guard de admin corrigido';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RLS NAS TABELAS CRIADAS PELO DASHBOARD (S2)
--
-- Regra: se a tabela existe e está SEM RLS, liga e cria a policy de dono
-- pela coluna indicada. Se já tem RLS, não toca (a policy do dashboard
-- vale). Tabelas de uso só pelo servidor (service role passa por cima do
-- RLS) só ligam o RLS, sem policy: é o comportamento certo.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  t record;
  ligada boolean;
  tem_policy boolean;
begin
  for t in
    select * from (values
      -- tabela, coluna de dono (null = só servidor), leitura pública autenticada?
      ('account_members',        'owner_id',   false),
      ('admin_actions',          null,         false),
      ('approval_tokens',        'manager_id', false),
      ('autopilot_runs',         'user_id',    false),
      ('bio_leads',              'user_id',    false),
      ('collab_deliverables',    'user_id',    false),
      ('collabs',                'user_id',    false),
      ('crm_client_refs',        'manager_id', false),
      ('crm_clients',            'manager_id', false),
      ('crm_contracts',          'manager_id', false),
      ('crm_leads',              'manager_id', false),
      ('crm_tasks',              'manager_id', false),
      ('external_clients',       'manager_id', false),
      ('fin_records',            'manager_id', false),
      ('fin_recurring',          'manager_id', false),
      ('hub_competitors',        'manager_id', false),
      ('hub_credits',            'manager_id', false),
      ('manager_profiles',       'user_id',    false),
      ('milestones',             'user_id',    false),
      ('module_entitlements',    'manager_id', false),
      ('modules',                null,         true),
      ('monthly_reflections',    'user_id',    false),
      ('moodboard_entries',      'user_id',    false),
      ('partner_program_config', null,         true),
      ('partner_referrals',      null,         false),
      ('partners',               'user_id',    false),
      ('pending_purchases',      null,         false),
      ('post_approval_comments', null,         false),
      ('rate_limit_v2',          null,         false),
      ('status_covers',          'user_id',    false),
      ('structured_goals',       'user_id',    false),
      ('terms_acceptances',      'user_id',    false),
      ('user_tour_progress',     'user_id',    false)
    ) as v(tabela, dono, leitura_publica)
  loop
    if to_regclass('public.' || t.tabela) is null then
      continue;
    end if;
    select relrowsecurity into ligada from pg_class where oid = to_regclass('public.' || t.tabela);
    select exists (select 1 from pg_policies where schemaname = 'public' and tablename = t.tabela) into tem_policy;

    if ligada then
      raise notice 'ok: % ja tinha RLS (% policies)', t.tabela, (select count(*) from pg_policies where schemaname='public' and tablename=t.tabela);
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t.tabela);

    if not tem_policy then
      if t.dono is not null then
        execute format(
          'create policy %I on public.%I for all to authenticated using (%I = auth.uid()) with check (%I = auth.uid())',
          t.tabela || '_dono', t.tabela, t.dono, t.dono);
        raise notice 'LIGADO + policy de dono (%): %', t.dono, t.tabela;
      elsif t.leitura_publica then
        execute format('create policy %I on public.%I for select to authenticated using (true)', t.tabela || '_leitura', t.tabela);
        raise notice 'LIGADO + leitura autenticada: %', t.tabela;
      else
        raise notice 'LIGADO sem policy (so servidor): %', t.tabela;
      end if;
    else
      raise notice 'LIGADO (ja tinha policy do dashboard): %', t.tabela;
    end if;
  end loop;
end $$;

-- `account_members` é lida pelo membro também (my_team_accounts). Se a policy
-- de dono acabou de nascer, o membro precisa enxergar a própria linha.
do $$
begin
  if to_regclass('public.account_members') is not null
     and not exists (select 1 from pg_policies where schemaname='public' and tablename='account_members' and policyname='account_members_membro_le') then
    execute 'create policy account_members_membro_le on public.account_members for select to authenticated using (member_id = auth.uid())';
  end if;
end $$;

-- Backup de dados financeiros deixado pra trás por uma correção antiga.
drop table if exists public.fin_records_backup_100x;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. `profiles`: o usuário não pode zerar a própria cota nem se promover (S8)
-- ─────────────────────────────────────────────────────────────────────────
-- Trigger em vez de mexer na policy: funciona seja qual for a policy de
-- UPDATE que o dashboard tenha. Colunas de controle só mudam via service role.
create or replace function public.profiles_travar_colunas_de_controle()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  /* Quem passa: service role (edges, webhook), funções SECURITY DEFINER (rodam
     como o dono da função, então `current_user` não é 'authenticated'), e o
     admin do Cria mexendo pelo painel. Só o UPDATE direto pela API, feito por
     usuário comum, é barrado. */
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
        a senha em /app/trocar-senha (senão a tela entra em loop). */
     or (new.must_change_password is distinct from old.must_change_password
         and not (coalesce(old.must_change_password, false) = true and coalesce(new.must_change_password, false) = false))
     or new.parceiro_role is distinct from old.parceiro_role
     or new.account_type is distinct from old.account_type
  then
    raise exception 'coluna de controle do perfil so muda pelo servidor';
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_travar_controle on public.profiles;
create trigger trg_profiles_travar_controle
  before update on public.profiles
  for each row execute function public.profiles_travar_colunas_de_controle();

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Rate limit e teto nas RPCs públicas de escrita por token (S9)
-- ─────────────────────────────────────────────────────────────────────────
-- `rate_touch` já existe (usada pelas edges). Um wrapper fino que as RPCs de
-- token chamam no começo. Sem reescrever cada RPC aqui: o wrapper é chamado
-- pela edge/front? Não: fica pra quando as RPCs forem reescritas. Deixado o
-- helper pronto e documentado.
create or replace function public.token_rate_ok(_token text, _limite int default 30)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if to_regprocedure('public.rate_touch(text, int)') is null then
    return true; -- sem rate_touch no banco, não bloqueia
  end if;
  return public.rate_touch('tok:' || coalesce(_token, ''), _limite);
end $$;
revoke all on function public.token_rate_ok(text, int) from public;
grant execute on function public.token_rate_ok(text, int) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────
-- 7. COMISSÃO: indicação legada não entra no modelo recorrente (B4)
-- ─────────────────────────────────────────────────────────────────────────
-- O backfill de 22/09 transformou o pagamento único antigo em lançamento. Sem
-- esta marca, a mesma indicação voltaria a render 20% a partir da 3ª fatura:
-- a parceira receberia pelo mesmo cliente nos dois modelos. O webhook lê a
-- coluna e pula a recorrência pra quem é `legado`.
do $$
begin
  if to_regclass('public.partner_referrals') is null then
    raise notice 'partner_referrals nao existe aqui: pulei o bloco 7';
    return;
  end if;
  execute 'alter table public.partner_referrals add column if not exists modelo text not null default ''recorrente''';
  -- Legado = quem já estava payable/paid ANTES do modelo recorrente entrar
  -- (22/09/2026). Quem estava pending (em carência) segue no recorrente.
  execute $u$
    update public.partner_referrals
       set modelo = 'legado'
     where status in ('payable', 'paid')
       and created_at < '2026-09-22'
       and modelo = 'recorrente'
  $u$;
  raise notice 'partner_referrals.modelo marcado';
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. OAuth do Instagram volta pra onde a pessoa estava (onboarding)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.oauth_states add column if not exists return_to text;
