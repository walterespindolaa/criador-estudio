-- ═══════════════════════════════════════════════════════════════════════════
-- "MEU PERFIL" · PASSO 1: a dona acessa as ferramentas do próprio perfil
-- (Walter, 18/10/2026, opção A: o perfil de criadora da social mídia é uma
-- conta ligada a ela, aberta como o Cria de uma cliente). JÁ APLICADA (registro).
--
-- profiles.perfil_de = id de quem é dona desse perfil (null em todo o resto).
-- Só o servidor grava (entra na trava de colunas de controle).
--
-- is_perfil_proprio(dono) = a conta "dono" é o perfil de quem está logado.
-- Policies NOVAS e aditivas em 7 ferramentas que só aceitavam o dono logado
-- (Collabs, entregas da collab, Mídia Kit, Prompter, Cria Stories, capas de
-- destaque, referências salvas). Vale SÓ pro perfil próprio: a social mídia
-- NÃO ganha acesso a essas telas das clientes. Nenhuma policy antiga muda.
-- Ficaram de fora de propósito, porque são da pessoa e não do perfil:
-- conversas com a Cria IA, tutoriais, tour e conexão do Google Drive.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.profiles add column if not exists perfil_de uuid references public.profiles(id) on delete set null;
create unique index if not exists profiles_um_perfil_por_dona on public.profiles (perfil_de) where perfil_de is not null;

do $d$ declare _def text; begin
  _def := pg_get_functiondef('public.profiles_travar_colunas_de_controle'::regproc);
  if position('perfil_de' in _def) = 0 then
    execute replace(_def, $x$or new.codigo_parceiro is distinct from old.codigo_parceiro$x$,
      $x$or new.codigo_parceiro is distinct from old.codigo_parceiro
     or new.perfil_de is distinct from old.perfil_de$x$);
  end if;
end $d$;

create or replace function public.is_perfil_proprio(_dono uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles where id = _dono and perfil_de = auth.uid()
  );
$$;
revoke all on function public.is_perfil_proprio(uuid) from public, anon;
grant execute on function public.is_perfil_proprio(uuid) to authenticated;

do $d$ declare _t text; begin
  foreach _t in array array['collabs','collab_deliverables','media_kit_profiles','prompter_scripts','story_slots','status_covers','saved_refs'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=_t and policyname='perfil_proprio_tudo') then
      execute format('create policy perfil_proprio_tudo on public.%I for all to authenticated using (public.is_perfil_proprio(user_id)) with check (public.is_perfil_proprio(user_id))', _t);
    end if;
  end loop;
end $d$;

-- TRAVA DE VERDADE PRAS COLUNAS DE CONTROLE (achado no teste de 18/10/2026).
-- O gatilho profiles_travar_colunas_de_controle é security definer: dentro
-- dele current_user é o dono da função, nunca 'authenticated', então ele
-- nunca barrava nada. Quem protege de fato é o with check da policy
-- "Users can update own profile" (plan, role, assinatura etc.). Quatro colunas
-- só estavam no gatilho e um usuário conseguia mudar pela API: perfil_de
-- (nova), storage_used_bytes (zerar o próprio uso e furar a cota),
-- parceiro_role e codigo_parceiro. Entram no with check. Funções do servidor
-- (security definer, como o contador de armazenamento) não passam por RLS e
-- seguem funcionando.
do $d$ declare _wc text; _add text := ''; _c text; begin
  select with_check into _wc from pg_policies where tablename='profiles' and policyname='Users can update own profile';
  foreach _c in array array['perfil_de','storage_used_bytes','parceiro_role','codigo_parceiro'] loop
    if position(_c || ' IS DISTINCT' in _wc) = 0 then
      _add := _add || format(' AND (NOT (%1$I IS DISTINCT FROM (SELECT profiles_1.%1$I FROM public.profiles profiles_1 WHERE profiles_1.id = auth.uid())))', _c);
    end if;
  end loop;
  if _add <> '' then
    execute format('alter policy %I on public.profiles with check (%s%s)', 'Users can update own profile', _wc, _add);
  end if;
end $d$;
