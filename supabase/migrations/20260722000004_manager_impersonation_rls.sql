-- ============================================================
-- Acesso do GESTOR à conta do cliente que ele gerencia (account switcher).
--
-- Quando o cliente conecta a conta Cria dele com a social mídia, cria-se um
-- vínculo em public.account_members (owner_id = cliente, member_id = gestor,
-- status = 'active'). Ao "gerenciar a conta", o front consulta as tabelas do
-- cliente pelo user_id dele, MAS o RLS só deixava o dono ler as próprias linhas.
-- Resultado: board vazio, nada carregava. Aqui damos ao membro ativo acesso de
-- leitura E escrita nas tabelas de conteúdo do criador (ele opera a conta).
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================

-- Helper: auth.uid() é membro (gestor) ATIVO da conta _owner?
create or replace function public.is_account_member(_owner uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.account_members am
    where am.owner_id = _owner
      and am.member_id = auth.uid()
      and am.status = 'active'
  );
$$;
grant execute on function public.is_account_member(uuid) to authenticated;

-- Uma policy FOR ALL (using + with check) por tabela de conteúdo do criador,
-- todas chaveadas por user_id. Aditiva: NÃO mexe nas policies do dono.
do $$
declare
  t text;
  tbls text[] := array[
    'posts','pillars','tasks','ideas','personas','bio_links','brand_items',
    'structured_goals','milestones','moodboard_entries','files',
    'user_prompts','user_hooks','user_formats','external_media_refs'
  ];
begin
  foreach t in array tbls loop
    execute format('drop policy if exists %I on public.%I', 'member_all_' || t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated ' ||
      'using (public.is_account_member(user_id)) ' ||
      'with check (public.is_account_member(user_id))',
      'member_all_' || t, t
    );
  end loop;
end $$;

-- Perfil do cliente (nome, avatar, cor/tema) legível pelo gestor que o gerencia,
-- pra interface pintar a cor certa e mostrar os dados dele. Só leitura.
drop policy if exists member_read_profile on public.profiles;
create policy member_read_profile on public.profiles
  for select to authenticated
  using (public.is_account_member(id));
