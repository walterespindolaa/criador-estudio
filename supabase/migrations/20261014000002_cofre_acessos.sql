-- ═══════════════════════════════════════════════════════════════════════════
-- COFRE DE ACESSOS DO CLIENTE (Walter, 14/10/2026)
--
-- Logins e senhas das contas do cliente (Instagram, Meta, Google, site...)
-- guardados dentro da ficha, no Cria Gestão (módulo 'crm').
--
-- Regras:
--   * A senha e o recado são gravados CIFRADOS (pgp_sym_encrypt). A chave é
--     gerada aqui mesmo e fica no Vault do Supabase: ninguém digita nem vê.
--   * As tabelas não têm policy nenhuma: a API não lê nada direto. Tudo passa
--     pelas RPCs abaixo, que conferem quem é a pessoa.
--   * Quem vê: a dona da conta sempre; colaboradora só com a chave
--     'cofre_acessos' ligada no cartão dela (Equipe), e respeitando os clientes
--     liberados. Parceiro (designer, editor...) nunca.
--   * A listagem nunca traz senha. Ver ou copiar a senha passa por
--     cofre_revelar, que registra no histórico quem viu e quando.
--   * O cliente manda os acessos por um link com token (7 dias), igual ao
--     cadastro público, com limite de tentativas por minuto.
-- Idempotente: pode rodar de novo sem quebrar nada.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Chave no Vault (gerada aleatória, uma vez só) ---------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cofre_acessos_chave') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'cofre_acessos_chave',
      'Chave do cofre de acessos dos clientes (Cria Gestão). Não apagar: sem ela as senhas guardadas não abrem.'
    );
  end if;
end $$;

create or replace function public.cofre_chave()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'cofre_acessos_chave' limit 1;
$$;
revoke all on function public.cofre_chave() from public, anon, authenticated;

-- 2) Tabelas ------------------------------------------------------------------
create table if not exists public.cofre_acessos (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null,
  crm_client_id uuid not null references public.crm_clients(id) on delete cascade,
  plataforma text not null,
  login text,
  url text,
  senha_cifrada bytea,
  codigo_via text,
  observacao_cifrada bytea,
  senha_alterada_em timestamptz,
  enviado_pelo_cliente boolean not null default false,
  criado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cofre_acessos_cliente_idx on public.cofre_acessos (crm_client_id);

create table if not exists public.cofre_acessos_log (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null,
  crm_client_id uuid not null references public.crm_clients(id) on delete cascade,
  acesso_id uuid references public.cofre_acessos(id) on delete set null,
  acao text not null,
  plataforma text,
  autor_id uuid,
  autor_nome text,
  created_at timestamptz not null default now()
);
create index if not exists cofre_acessos_log_cliente_idx on public.cofre_acessos_log (crm_client_id, created_at desc);

create table if not exists public.cofre_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  manager_id uuid not null,
  crm_client_id uuid not null references public.crm_clients(id) on delete cascade,
  criado_por uuid,
  expires_at timestamptz not null default (now() + interval '7 days'),
  revogado_em timestamptz,
  usos integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists cofre_links_cliente_idx on public.cofre_links (crm_client_id);

alter table public.cofre_acessos enable row level security;
alter table public.cofre_acessos_log enable row level security;
alter table public.cofre_links enable row level security;
revoke all on public.cofre_acessos, public.cofre_acessos_log, public.cofre_links from anon, authenticated;

-- 3) Quem pode mexer no cofre deste cliente ----------------------------------
-- Devolve o manager_id (dono da carteira) se a pessoa logada pode; senão null.
create or replace function public.cofre_dono_se_pode(_crm_client_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.manager_id
  from public.crm_clients c
  where c.id = _crm_client_id
    and c.deleted_at is null
    and public.has_module('crm', c.manager_id)
    and (
      c.manager_id = auth.uid()
      or exists (
        select 1
        from public.manager_members m
        join public.manager_member_permissions p on p.member_row_id = m.id
        where m.manager_id = c.manager_id
          and m.member_id = auth.uid()
          and m.status = 'ativo'
          and not public.eh_papel_parceiro(m.role)
          and p.module_code = 'cofre_acessos'
          and (p.all_clients or c.id = any(p.client_ids))
      )
    );
$$;
revoke all on function public.cofre_dono_se_pode(uuid) from public, anon, authenticated;

create or replace function public.cofre_nome_autor(_manager_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() = _manager_id then coalesce((select nullif(trim(name), '') from public.profiles where id = auth.uid()), 'Dona da conta')
    else coalesce((select nullif(trim(m.name), '') from public.manager_members m where m.manager_id = _manager_id and m.member_id = auth.uid() limit 1), 'Colaboradora')
  end;
$$;
revoke all on function public.cofre_nome_autor(uuid) from public, anon, authenticated;

-- 4) RPCs da ficha (pessoa logada) -------------------------------------------

-- Diz pra tela se a pessoa pode usar o cofre deste cliente (sem erro).
create or replace function public.cofre_status(_crm_client_id uuid)
returns table (pode boolean, sou_dono boolean, tem_modulo boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    public.cofre_dono_se_pode(_crm_client_id) is not null,
    exists (select 1 from public.crm_clients c where c.id = _crm_client_id and c.manager_id = auth.uid()),
    exists (select 1 from public.crm_clients c where c.id = _crm_client_id and public.has_module('crm', c.manager_id));
$$;

-- Lista SEM senha.
create or replace function public.cofre_listar(_crm_client_id uuid)
returns table (
  id uuid, plataforma text, login text, url text, codigo_via text,
  tem_senha boolean, tem_observacao boolean, senha_alterada_em timestamptz,
  enviado_pelo_cliente boolean, updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.cofre_dono_se_pode(_crm_client_id) is null then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  return query
    select a.id, a.plataforma, a.login, a.url, a.codigo_via,
           a.senha_cifrada is not null, a.observacao_cifrada is not null,
           a.senha_alterada_em, a.enviado_pelo_cliente, a.updated_at
    from public.cofre_acessos a
    where a.crm_client_id = _crm_client_id
    order by lower(a.plataforma), a.created_at;
end $$;

-- Abre a senha (e o recado) de UM acesso e registra no histórico.
-- _acao: 'revelou' (olho) ou 'copiou_senha' (botão copiar).
create or replace function public.cofre_revelar(_acesso_id uuid, _acao text default 'revelou')
returns table (senha text, observacao text)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  _a public.cofre_acessos;
  _dono uuid;
  _k text := public.cofre_chave();
begin
  select * into _a from public.cofre_acessos where cofre_acessos.id = _acesso_id;
  if not found then raise exception 'nao_encontrado' using errcode = 'P0002'; end if;
  _dono := public.cofre_dono_se_pode(_a.crm_client_id);
  if _dono is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if _acao not in ('revelou', 'copiou_senha') then _acao := 'revelou'; end if;

  insert into public.cofre_acessos_log (manager_id, crm_client_id, acesso_id, acao, plataforma, autor_id, autor_nome)
  values (_dono, _a.crm_client_id, _a.id, _acao, _a.plataforma, auth.uid(), public.cofre_nome_autor(_dono));

  return query select
    case when _a.senha_cifrada is null then null else extensions.pgp_sym_decrypt(_a.senha_cifrada, _k) end,
    case when _a.observacao_cifrada is null then null else extensions.pgp_sym_decrypt(_a.observacao_cifrada, _k) end;
end $$;

-- Cria (id nulo) ou edita. _senha/_observacao nulos = manter o que está;
-- string vazia = apagar.
create or replace function public.cofre_salvar(
  _id uuid, _crm_client_id uuid, _plataforma text, _login text, _url text,
  _senha text, _codigo_via text, _observacao text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  _dono uuid;
  _k text := public.cofre_chave();
  _novo uuid;
  _cliente uuid := _crm_client_id;
begin
  if _id is not null then
    select crm_client_id into _cliente from public.cofre_acessos where id = _id;
    if _cliente is null then raise exception 'nao_encontrado' using errcode = 'P0002'; end if;
  end if;
  _dono := public.cofre_dono_se_pode(_cliente);
  if _dono is null then raise exception 'sem_permissao' using errcode = '42501'; end if;

  _plataforma := left(trim(coalesce(_plataforma, '')), 60);
  if _plataforma = '' then raise exception 'plataforma_obrigatoria' using errcode = '22023'; end if;
  if length(coalesce(_senha, '')) > 500 or length(coalesce(_observacao, '')) > 1000
     or length(coalesce(_login, '')) > 200 or length(coalesce(_url, '')) > 500 then
    raise exception 'texto_grande_demais' using errcode = '22001';
  end if;

  if _id is null then
    insert into public.cofre_acessos (manager_id, crm_client_id, plataforma, login, url, codigo_via,
      senha_cifrada, observacao_cifrada, senha_alterada_em, criado_por)
    values (_dono, _cliente, _plataforma, nullif(trim(_login), ''), nullif(trim(_url), ''), nullif(trim(_codigo_via), ''),
      case when coalesce(_senha, '') = '' then null else extensions.pgp_sym_encrypt(_senha, _k) end,
      case when coalesce(_observacao, '') = '' then null else extensions.pgp_sym_encrypt(_observacao, _k) end,
      case when coalesce(_senha, '') = '' then null else now() end,
      auth.uid())
    returning id into _novo;
    insert into public.cofre_acessos_log (manager_id, crm_client_id, acesso_id, acao, plataforma, autor_id, autor_nome)
    values (_dono, _cliente, _novo, 'criou', _plataforma, auth.uid(), public.cofre_nome_autor(_dono));
    return _novo;
  end if;

  update public.cofre_acessos set
    plataforma = _plataforma,
    login = nullif(trim(_login), ''),
    url = nullif(trim(_url), ''),
    codigo_via = nullif(trim(_codigo_via), ''),
    senha_cifrada = case when _senha is null then senha_cifrada
                         when _senha = '' then null
                         else extensions.pgp_sym_encrypt(_senha, _k) end,
    senha_alterada_em = case when _senha is null then senha_alterada_em
                             when _senha = '' then null
                             else now() end,
    observacao_cifrada = case when _observacao is null then observacao_cifrada
                              when _observacao = '' then null
                              else extensions.pgp_sym_encrypt(_observacao, _k) end,
    updated_at = now()
  where id = _id;
  insert into public.cofre_acessos_log (manager_id, crm_client_id, acesso_id, acao, plataforma, autor_id, autor_nome)
  values (_dono, _cliente, _id, 'editou', _plataforma, auth.uid(), public.cofre_nome_autor(_dono));
  return _id;
end $$;

create or replace function public.cofre_apagar(_acesso_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare _a public.cofre_acessos; _dono uuid;
begin
  select * into _a from public.cofre_acessos where id = _acesso_id;
  if not found then return false; end if;
  _dono := public.cofre_dono_se_pode(_a.crm_client_id);
  if _dono is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  insert into public.cofre_acessos_log (manager_id, crm_client_id, acesso_id, acao, plataforma, autor_id, autor_nome)
  values (_dono, _a.crm_client_id, null, 'apagou', _a.plataforma, auth.uid(), public.cofre_nome_autor(_dono));
  delete from public.cofre_acessos where id = _acesso_id;
  return true;
end $$;

create or replace function public.cofre_historico(_crm_client_id uuid)
returns table (acao text, plataforma text, autor_nome text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.cofre_dono_se_pode(_crm_client_id) is null then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  return query
    select l.acao, l.plataforma, l.autor_nome, l.created_at
    from public.cofre_acessos_log l
    where l.crm_client_id = _crm_client_id
    order by l.created_at desc
    limit 30;
end $$;

-- Quem vê as senhas deste cliente (pro painel lateral). Só nomes e papel.
create or replace function public.cofre_quem_ve(_crm_client_id uuid)
returns table (nome text, papel text, pode boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare _dono uuid;
begin
  _dono := public.cofre_dono_se_pode(_crm_client_id);
  if _dono is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  return query
    select coalesce(nullif(trim(p.name), ''), 'Dona da conta'), 'dona'::text, true
    from public.profiles p where p.id = _dono
    union all
    select coalesce(nullif(trim(m.name), ''), m.email, 'Colaboradora'),
           case when public.eh_papel_parceiro(m.role) then 'parceiro' else 'colaboradora' end,
           (not public.eh_papel_parceiro(m.role)) and exists (
             select 1 from public.manager_member_permissions pp
             where pp.member_row_id = m.id and pp.module_code = 'cofre_acessos'
               and (pp.all_clients or _crm_client_id = any(pp.client_ids)))
    from public.manager_members m
    where m.manager_id = _dono and m.status = 'ativo';
end $$;

-- Gera o link pro cliente mandar os acessos (vale 7 dias).
create or replace function public.cofre_criar_link(_crm_client_id uuid)
returns table (token text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare _dono uuid; _l public.cofre_links;
begin
  _dono := public.cofre_dono_se_pode(_crm_client_id);
  if _dono is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  insert into public.cofre_links (manager_id, crm_client_id, criado_por)
  values (_dono, _crm_client_id, auth.uid())
  returning * into _l;
  insert into public.cofre_acessos_log (manager_id, crm_client_id, acao, autor_id, autor_nome)
  values (_dono, _crm_client_id, 'link_criado', auth.uid(), public.cofre_nome_autor(_dono));
  return query select _l.token, _l.expires_at;
end $$;

-- 5) RPCs públicas do link do cliente (anon) ---------------------------------
create or replace function public.cofre_link_info(_token text)
returns table (cliente_nome text, agencia_nome text, agencia_logo text, cor text, expira_em timestamptz)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.token_rate_ok('cofre:' || coalesce(_token, ''), 30) then
    raise exception 'muitas_tentativas' using errcode = '54000';
  end if;
  return query
    select coalesce(nullif(trim(c.display_name), ''), c.name), p.name, p.brand_logo_url, p.theme_accent, l.expires_at
    from public.cofre_links l
    join public.crm_clients c on c.id = l.crm_client_id and c.deleted_at is null
    left join public.profiles p on p.id = l.manager_id
    where l.token = _token and l.revogado_em is null and l.expires_at > now()
      and public.has_module('crm', l.manager_id);
end $$;

create or replace function public.cofre_enviar_por_link(
  _token text, _plataforma text, _login text, _senha text, _codigo_via text, _observacao text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare _l public.cofre_links; _k text := public.cofre_chave(); _novo uuid;
begin
  if not public.token_rate_ok('cofre:' || coalesce(_token, ''), 20) then
    raise exception 'muitas_tentativas' using errcode = '54000';
  end if;
  select * into _l from public.cofre_links
  where token = _token and revogado_em is null and expires_at > now();
  if not found or not public.has_module('crm', _l.manager_id) then
    raise exception 'link_invalido' using errcode = '42501';
  end if;
  if _l.usos >= 40 then raise exception 'limite_do_link' using errcode = '54000'; end if;

  _plataforma := left(trim(coalesce(_plataforma, '')), 60);
  if _plataforma = '' then raise exception 'plataforma_obrigatoria' using errcode = '22023'; end if;
  if length(coalesce(_senha, '')) > 500 or length(coalesce(_observacao, '')) > 1000
     or length(coalesce(_login, '')) > 200 then
    raise exception 'texto_grande_demais' using errcode = '22001';
  end if;

  insert into public.cofre_acessos (manager_id, crm_client_id, plataforma, login, codigo_via,
    senha_cifrada, observacao_cifrada, senha_alterada_em, enviado_pelo_cliente)
  values (_l.manager_id, _l.crm_client_id, _plataforma, nullif(trim(_login), ''), nullif(trim(_codigo_via), ''),
    case when coalesce(_senha, '') = '' then null else extensions.pgp_sym_encrypt(_senha, _k) end,
    case when coalesce(_observacao, '') = '' then null else extensions.pgp_sym_encrypt(_observacao, _k) end,
    case when coalesce(_senha, '') = '' then null else now() end,
    true)
  returning id into _novo;

  update public.cofre_links set usos = usos + 1 where id = _l.id;
  insert into public.cofre_acessos_log (manager_id, crm_client_id, acesso_id, acao, plataforma, autor_nome)
  values (_l.manager_id, _l.crm_client_id, _novo, 'cliente_enviou', _plataforma, 'Cliente, pelo link');
  return true;
end $$;

-- 6) Grants -------------------------------------------------------------------
revoke all on function public.cofre_status(uuid) from public, anon;
revoke all on function public.cofre_listar(uuid) from public, anon;
revoke all on function public.cofre_revelar(uuid, text) from public, anon;
revoke all on function public.cofre_salvar(uuid, uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.cofre_apagar(uuid) from public, anon;
revoke all on function public.cofre_historico(uuid) from public, anon;
revoke all on function public.cofre_quem_ve(uuid) from public, anon;
revoke all on function public.cofre_criar_link(uuid) from public, anon;
grant execute on function public.cofre_status(uuid) to authenticated;
grant execute on function public.cofre_listar(uuid) to authenticated;
grant execute on function public.cofre_revelar(uuid, text) to authenticated;
grant execute on function public.cofre_salvar(uuid, uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.cofre_apagar(uuid) to authenticated;
grant execute on function public.cofre_historico(uuid) to authenticated;
grant execute on function public.cofre_quem_ve(uuid) to authenticated;
grant execute on function public.cofre_criar_link(uuid) to authenticated;

revoke all on function public.cofre_link_info(text) from public;
revoke all on function public.cofre_enviar_por_link(text, text, text, text, text, text) from public;
grant execute on function public.cofre_link_info(text) to anon, authenticated;
grant execute on function public.cofre_enviar_por_link(text, text, text, text, text, text) to anon, authenticated;
