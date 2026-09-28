-- ═══════════════════════════════════════════════════════════════════════════
-- CONVITE PRA CLIENTE CONECTAR O INSTAGRAM (28/09/2026)
--
-- Antes: pra conectar o Instagram da cliente, a social mídia precisava estar
-- logada NA CONTA DA CLIENTE (senha dela, ou as duas no mesmo aparelho).
-- Agora: a social mídia gera um link (vale 7 dias, uso único), manda no
-- WhatsApp, a cliente abre no celular dela, aceita no Instagram dela, e a
-- conexão cai na ficha certa. Ninguém passa senha.
--
-- Peças:
--   ig_convites                tabela (só o servidor lê direto)
--   ig_criar_convite           social mídia/equipe gera o link
--   ig_convites_do_cliente     lista o convite pendente e o último usado
--   ig_cancelar_convite        cancela um pendente
--   ig_convite_publico         a página pública lê só o necessário (anon)
--   oauth_states.convite_id    o login do Instagram sabe que veio de convite
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.ig_convites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  crm_client_id uuid not null references public.crm_clients(id) on delete cascade,
  criado_por uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  usado_em timestamptz,
  cancelado_em timestamptz,
  username_conectado text
);
create index if not exists idx_ig_convites_cliente on public.ig_convites (crm_client_id, criado_em desc);
alter table public.ig_convites enable row level security;
revoke all on public.ig_convites from anon, authenticated;

alter table public.oauth_states add column if not exists convite_id uuid references public.ig_convites(id) on delete set null;

-- Quem pode mexer nos convites de um cliente: dono da agência ou equipe ativa.
create or replace function public.ig_pode_convidar(_crm_client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crm_clients cc
                  where cc.id = _crm_client_id and public.acts_for(cc.manager_id))
$$;
revoke all on function public.ig_pode_convidar(uuid) from public, anon;

-- ── Gerar ──────────────────────────────────────────────────────────────────
-- Cancela o pendente anterior do mesmo cliente: só existe UM link válido por
-- vez (link velho encaminhado não serve mais).
create or replace function public.ig_criar_convite(_crm_client_id uuid)
returns table (id uuid, token text, expira_em timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if auth.uid() is null or not public.ig_pode_convidar(_crm_client_id) then
    raise exception 'sem permissão';
  end if;
  update public.ig_convites c set cancelado_em = now()
   where c.crm_client_id = _crm_client_id and c.usado_em is null and c.cancelado_em is null;
  return query
    insert into public.ig_convites (crm_client_id, criado_por)
    values (_crm_client_id, auth.uid())
    returning ig_convites.id, ig_convites.token, ig_convites.expira_em;
end $$;
revoke all on function public.ig_criar_convite(uuid) from public, anon;
grant execute on function public.ig_criar_convite(uuid) to authenticated;

-- ── Listar (pendente + último usado) ───────────────────────────────────────
create or replace function public.ig_convites_do_cliente(_crm_client_id uuid)
returns table (id uuid, token text, criado_em timestamptz, expira_em timestamptz,
               usado_em timestamptz, username_conectado text, situacao text)
language sql stable security definer set search_path = public as $$
  select c.id, c.token, c.criado_em, c.expira_em, c.usado_em, c.username_conectado,
         case when c.usado_em is not null then 'usado'
              when c.cancelado_em is not null then 'cancelado'
              when c.expira_em < now() then 'vencido'
              else 'pendente' end
    from public.ig_convites c
   where c.crm_client_id = _crm_client_id and public.ig_pode_convidar(_crm_client_id)
   order by c.criado_em desc
   limit 5
$$;
revoke all on function public.ig_convites_do_cliente(uuid) from public, anon;
grant execute on function public.ig_convites_do_cliente(uuid) to authenticated;

-- ── Cancelar ───────────────────────────────────────────────────────────────
create or replace function public.ig_cancelar_convite(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _cli uuid;
begin
  select crm_client_id into _cli from public.ig_convites where id = _id;
  if _cli is null or not public.ig_pode_convidar(_cli) then raise exception 'sem permissão'; end if;
  update public.ig_convites set cancelado_em = now() where id = _id and usado_em is null;
end $$;
revoke all on function public.ig_cancelar_convite(uuid) from public, anon;
grant execute on function public.ig_cancelar_convite(uuid) to authenticated;

-- ── Página pública (sem login) ─────────────────────────────────────────────
-- Devolve SÓ o que a cliente precisa ver: nome dela (como a agência cadastrou),
-- nome de quem convidou e se o link ainda vale. Nada de id, e-mail ou dado da
-- agência além do nome.
create or replace function public.ig_convite_publico(_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object(
      'situacao', case when c.usado_em is not null then 'usado'
                       when c.cancelado_em is not null then 'cancelado'
                       when c.expira_em < now() then 'vencido'
                       else 'pendente' end,
      'cliente', cc.name,
      'quem_convidou', coalesce(nullif(btrim(p.name), ''), 'sua social mídia'),
      'username_conectado', c.username_conectado)
      from public.ig_convites c
      join public.crm_clients cc on cc.id = c.crm_client_id
      left join public.profiles p on p.id = c.criado_por
     where c.token = _token
  ), jsonb_build_object('situacao', 'invalido'))
$$;
revoke all on function public.ig_convite_publico(text) from public;
grant execute on function public.ig_convite_publico(text) to anon, authenticated;

notify pgrst, 'reload schema';
