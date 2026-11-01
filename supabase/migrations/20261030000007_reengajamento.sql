-- ═══════════════════════════════════════════════════════════════════════════
-- E-MAILS PRA QUEM PAROU (30/10/2026, mockup aprovado pelo Walter)
--
--  1. Cupom VOLTA50 (50% no 1º mês), que aceita quem já assinou antes.
--  2. reengajamento_base(): uma linha por conta com o que o robô precisa pra
--     saber em que grupo ela está (só service role).
--  3. email_links: links de um clique dos e-mails ("por que saiu", "não quero
--     mais receber" e "confirmar meu e-mail"). O token vai no link; o edge
--     email-link chama email_link_usar e redireciona pra página /email/pronto.
--  4. motivos_saida: o que a pessoa clicou.
--  5. email_respostas: caixa de respostas (o edge email-entrada grava, a IA
--     classifica, o admin lê e responde).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Cupom de volta
alter table public.cupons_campanha
  add column if not exists aceita_quem_ja_assinou boolean not null default false;

insert into public.cupons_campanha (codigo, dias_gratis, desconto_pct, desconto_meses, ativo, aceita_quem_ja_assinou)
select 'VOLTA50', 0, 50, 1, true, true
where not exists (select 1 from public.cupons_campanha where upper(codigo) = 'VOLTA50');

-- 2. Base do robô
create or replace function public.reengajamento_base()
returns table (
  id uuid, name text, account_type text, parceiro_role text,
  created_at timestamptz, last_seen_at timestamptz, onboarding_completed boolean,
  subscription_status text, trial_ends_at timestamptz,
  plan text, access_expires_at timestamptz,
  email text, email_confirmado boolean,
  n_ideias int, n_posts int, n_clientes int,
  quer_receber boolean
)
language sql stable security definer set search_path to 'public', 'auth'
as $$
  select p.id, p.name, p.account_type, p.parceiro_role,
         p.created_at, p.last_seen_at, coalesce(p.onboarding_completed, false),
         p.subscription_status, p.trial_ends_at,
         p.plan, p.access_expires_at,
         u.email::text, u.email_confirmed_at is not null,
         (select count(*)::int from public.ideas i where i.user_id = p.id),
         (select count(*)::int from public.posts po where po.user_id = p.id and po.deleted_at is null),
         (select count(*)::int from public.crm_clients c where c.manager_id = p.id and c.deleted_at is null),
         (p.notification_prefs ->> 'reengajamento') is distinct from 'false'
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.perfil_de is null              -- Meu perfil: a dona já é cliente
     and p.agency_owner_id is null        -- conta de cliente de agência
     and coalesce(p.role, '') <> 'admin'
     and coalesce(p.subscription_status, '') <> 'active';
$$;
revoke execute on function public.reengajamento_base() from public, anon, authenticated;
grant execute on function public.reengajamento_base() to service_role;

-- 3. Links de um clique
create table if not exists public.email_links (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('motivo_saida', 'sair_da_lista', 'confirmar')),
  criado_em timestamptz not null default now(),
  usado_em timestamptz,
  valor text
);
alter table public.email_links enable row level security; -- sem policy: só service role e o RPC abaixo

-- 4. Motivos de saída
create table if not exists public.motivos_saida (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  motivo text not null check (motivo in ('caro', 'sem_tempo', 'faltou_funcao', 'outra_ferramenta', 'outro')),
  criado_em timestamptz not null default now()
);
alter table public.motivos_saida enable row level security;
drop policy if exists "admin lê motivos" on public.motivos_saida;
create policy "admin lê motivos" on public.motivos_saida for select to authenticated using (public.is_admin());

create or replace function public.email_link_usar(_token uuid, _valor text default null)
returns text
language plpgsql security definer set search_path to 'public'
as $$
declare _l public.email_links;
begin
  select * into _l from public.email_links where token = _token;
  if not found or _l.criado_em < now() - interval '120 days' then return 'invalido'; end if;

  if _l.tipo = 'confirmar' then
    return 'confirmar:' || _l.user_id::text;  -- o edge gera o link de entrada na hora
  end if;

  if _l.tipo = 'sair_da_lista' then
    update public.profiles
       set notification_prefs = coalesce(notification_prefs, '{}'::jsonb) || jsonb_build_object('reengajamento', false)
     where id = _l.user_id;
    update public.email_links set usado_em = coalesce(usado_em, now()), valor = 'saiu' where token = _token;
    return 'saiu';
  end if;

  -- motivo_saida: vale o primeiro clique; clicar de novo não duplica.
  if _valor is null or _valor not in ('caro', 'sem_tempo', 'faltou_funcao', 'outra_ferramenta', 'outro') then return 'invalido'; end if;
  if _l.usado_em is null then
    insert into public.motivos_saida (user_id, motivo) values (_l.user_id, _valor);
    update public.email_links set usado_em = now(), valor = _valor where token = _token;
  end if;
  return 'obrigado';
end;
$$;
revoke execute on function public.email_link_usar(uuid, text) from public, anon, authenticated;
grant execute on function public.email_link_usar(uuid, text) to service_role;

-- 5. Caixa de respostas
create table if not exists public.email_respostas (
  id uuid primary key default gen_random_uuid(),
  resend_id text unique,
  recebido_em timestamptz not null default now(),
  de_email text not null,
  de_nome text,
  user_id uuid references auth.users(id) on delete set null,
  assunto text,
  texto text,
  categoria text,          -- motivo_saida, duvida, problema, pedido_funcao, elogio, quer_voltar, outro
  resumo text,
  sugestao text,           -- resposta sugerida pela IA (rascunho, nunca sai sozinha)
  status text not null default 'nova' check (status in ('nova', 'respondida', 'arquivada')),
  resposta text,
  respondido_em timestamptz,
  respondido_por uuid references auth.users(id) on delete set null
);
create index if not exists email_respostas_status_idx on public.email_respostas (status, recebido_em desc);
alter table public.email_respostas enable row level security;
drop policy if exists "admin lê respostas" on public.email_respostas;
create policy "admin lê respostas" on public.email_respostas for select to authenticated using (public.is_admin());
drop policy if exists "admin arquiva respostas" on public.email_respostas;
create policy "admin arquiva respostas" on public.email_respostas for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 6. Liga uma resposta à conta pelo e-mail (só service role, usado no email-entrada).
create or replace function public.conta_por_email(_email text)
returns table (id uuid, name text, account_type text, subscription_status text, n_posts int, n_ideias int)
language sql stable security definer set search_path to 'public', 'auth'
as $$
  select p.id, p.name, p.account_type, p.subscription_status,
         (select count(*)::int from public.posts po where po.user_id = p.id and po.deleted_at is null),
         (select count(*)::int from public.ideas i where i.user_id = p.id)
    from auth.users u join public.profiles p on p.id = u.id
   where lower(u.email) = lower(btrim(_email))
   limit 1;
$$;
revoke execute on function public.conta_por_email(text) from public, anon, authenticated;
grant execute on function public.conta_por_email(text) to service_role;

-- 7. Resumo pra faixa "Por que as pessoas saem" da caixa de respostas (só admin).
create or replace function public.admin_reengajamento_resumo()
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'motivos', coalesce((select jsonb_object_agg(motivo, n) from (
        select motivo, count(*) n from public.motivos_saida where criado_em > now() - interval '90 days' group by motivo) m), '{}'::jsonb),
    'categorias', coalesce((select jsonb_object_agg(categoria, n) from (
        select coalesce(categoria, 'outro') categoria, count(*) n from public.email_respostas where recebido_em > now() - interval '90 days' group by 1) c), '{}'::jsonb),
    'enviados_30d', (select count(*) from public.emails_ciclo where tipo like 're\_%' and sent_at > now() - interval '30 days'),
    'responderam_30d', (select count(distinct de_email) from public.email_respostas where recebido_em > now() - interval '30 days'),
    'voltaram_30d', (select count(distinct e.user_id) from public.emails_ciclo e
                       join public.profiles p on p.id = e.user_id
                      where e.tipo like 're\_%' and e.sent_at > now() - interval '30 days' and p.subscription_status = 'active')
  );
end;
$$;
revoke execute on function public.admin_reengajamento_resumo() from public, anon;
grant execute on function public.admin_reengajamento_resumo() to authenticated;
