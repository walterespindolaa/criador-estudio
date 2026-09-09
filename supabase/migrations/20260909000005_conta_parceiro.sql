-- ═══════════════════════════════════════════════════════════════════════════
-- A CONTA DE PARCEIRO COMO TIPO PRÓPRIO (09/09/2026)
--
-- Hoje o parceiro só existe COMO CONSEQUÊNCIA de um convite: a agência chama,
-- a edge cria o usuário, marca `account_type = 'manager'` e grava o papel em
-- manager_members. Quem descobre o CRIA sozinho, ou é criado pelo admin, não
-- tem por onde entrar como designer/editor/copy/tráfego: o cadastro só oferece
-- criador e social mídia (Walter, 09/09/2026).
--
-- Duas decisões:
--
-- 1. `profiles.account_type` ganha o valor 'parceiro'. A coluna é texto livre
--    sem check, então é só passar a escrever. A detecção no app deixa de
--    depender exclusivamente do vínculo com agência.
-- 2. NÃO mexo no `handle_new_user`. A função no banco pode ter divergido das
--    migrations, e reescrevê-la às cegas é o jeito mais rápido de quebrar TODO
--    cadastro. Em vez disso, um gatilho novo em `profiles` corrige a linha
--    logo depois que ela nasce, lendo a intenção do metadado do auth.
--
-- O papel (designer, editor de vídeo, copy, tráfego) vira coluna própria:
-- ele define o vocabulário do quadro dele (Referências/Rascunho/Arte final vs
-- Decupagem/Corte/Finalização) mesmo antes de qualquer agência acoplar.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists parceiro_role text;

comment on column public.profiles.parceiro_role is
  'designer | editor_video | copy | trafego. Só faz sentido quando account_type = parceiro. Define as etapas padrão do quadro dele.';

-- ── O gatilho que lê a intenção do cadastro ───────────────────────────────
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

  -- Papel válido ou designer como padrão: a lista é a mesma do convite.
  _papel := coalesce(nullif(btrim(_meta->>'parceiro_role'), ''), 'designer');
  if _papel not in ('designer', 'editor_video', 'copy', 'trafego') then
    _papel := 'designer';
  end if;

  -- Sem trial de criador: o parceiro não usa o app do criador, e o trial
  -- pendurado nele só gerava paywall no lugar errado (mesma regra que o
  -- manager-member-invite já aplica para quem entra por convite).
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

drop trigger if exists trg_profiles_intencao_parceiro on public.profiles;
create trigger trg_profiles_intencao_parceiro
  after insert on public.profiles
  for each row execute function public.aplicar_intencao_parceiro();

-- ── Marcar uma conta que JÁ existe como parceiro (admin e correções) ──────
-- account_type é coluna travada pro cliente (ver 20260810000001), então quem
-- escreve é função security definer ou service_role.
create or replace function public.admin_definir_parceiro(_user_id uuid, _papel text default 'designer')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _papel_ok text;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'só admin';
  end if;
  _papel_ok := case when _papel in ('designer','editor_video','copy','trafego') then _papel else 'designer' end;
  update public.profiles
  set account_type = 'parceiro', parceiro_role = _papel_ok,
      plan = 'free', trial_started_at = null, trial_ends_at = null
  where id = _user_id;
end;
$$;

revoke all on function public.admin_definir_parceiro(uuid, text) from public, anon;
grant execute on function public.admin_definir_parceiro(uuid, text) to authenticated;

-- Conferência:
-- select id, name, account_type, parceiro_role from public.profiles where account_type = 'parceiro';
