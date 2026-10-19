-- "PODE GERENCIAR A EQUIPE" (Walter, 19/10/2026; mockup aprovado)
--
-- A Gabi criou a Kollab com um e-mail próprio da Kollab e trabalha nela pela
-- conta dela, como colaboradora. Só o login da Kollab via Equipe > Pessoas.
-- Agora a dona liga uma chave de confiança no cartão da pessoa
-- (module_code 'gerenciar_equipe') e ela passa a ver e mexer na equipe desta
-- conta: convidar, pausar, remover e mudar acessos. Limites:
--   · não mexe no próprio vínculo nem nas próprias permissões;
--   · não compra assento (cobrança é da dona);
--   · parceiro de produção nunca ganha essa chave.

create or replace function public.pode_gerir_equipe(_manager uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select _manager = auth.uid()
      or exists (
        select 1
          from public.manager_members m
          join public.manager_member_permissions perm on perm.member_row_id = m.id
         where m.manager_id = _manager
           and m.member_id = auth.uid()
           and m.status = 'ativo'
           and not public.eh_papel_parceiro(m.role)
           and perm.module_code = 'gerenciar_equipe'
      );
$function$;
grant execute on function public.pode_gerir_equipe(uuid) to authenticated;

-- Quem gerencia vê e muda os OUTROS membros desta conta (nunca o próprio).
create policy "manager_members gerente da equipe"
  on public.manager_members for all to authenticated
  using (member_id <> auth.uid() and public.pode_gerir_equipe(manager_id))
  with check (member_id <> auth.uid() and public.pode_gerir_equipe(manager_id));

create policy "member_perms gerente da equipe"
  on public.manager_member_permissions for all to authenticated
  using (exists (select 1 from public.manager_members m
                  where m.id = manager_member_permissions.member_row_id
                    and m.member_id <> auth.uid()
                    and public.pode_gerir_equipe(m.manager_id)))
  with check (exists (select 1 from public.manager_members m
                  where m.id = manager_member_permissions.member_row_id
                    and m.member_id <> auth.uid()
                    and not public.eh_papel_parceiro(m.role)
                    and public.pode_gerir_equipe(m.manager_id)));

-- Assentos da conta pra quem gerencia (o profile da dona não abre pra ela).
create or replace function public.equipe_assentos(_manager uuid)
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when public.pode_gerir_equipe(_manager)
              then greatest(0, coalesce((select p.paid_collab_seats from public.profiles p where p.id = _manager), 0))
         end;
$function$;
grant execute on function public.equipe_assentos(uuid) to authenticated;
