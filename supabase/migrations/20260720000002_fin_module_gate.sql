-- Cria Caixa: acesso de colaborador GATED por permissão de módulo (cria_caixa).
-- Antes: fin_records/fin_recurring eram só do dono; fin_monthly liberava pra QUALQUER
-- colaborador ativo (acts_for). Agora os três seguem a mesma regra: dono sempre,
-- colaborador só se o gestor tiver liberado o módulo 'cria_caixa' pra ele.
-- Idempotente. Aditiva: as policies de dono continuam, então o gestor não quebra.

-- Helper: é dono do tenant OU colaborador ativo COM o módulo liberado.
create or replace function public.has_member_module(target uuid, code text)
returns boolean
language sql stable security definer set search_path = public as $$
  select target = auth.uid()
      or exists (
        select 1
        from public.manager_members m
        join public.manager_member_permissions perm on perm.member_row_id = m.id
        where m.manager_id = target
          and m.member_id = auth.uid()
          and m.status = 'ativo'
          and perm.module_code = code
      );
$$;
grant execute on function public.has_member_module(uuid, text) to authenticated;

-- fin_records: dono + colaborador com cria_caixa
drop policy if exists "fin_records_team" on public.fin_records;
create policy "fin_records_team" on public.fin_records for all to authenticated
  using (public.has_member_module(manager_id, 'cria_caixa'))
  with check (public.has_member_module(manager_id, 'cria_caixa'));

-- fin_recurring: idem
drop policy if exists "fin_recurring_team" on public.fin_recurring;
create policy "fin_recurring_team" on public.fin_recurring for all to authenticated
  using (public.has_member_module(manager_id, 'cria_caixa'))
  with check (public.has_member_module(manager_id, 'cria_caixa'));

-- fin_monthly: troca o gate amplo (acts_for) pelo gate de modulo
drop policy if exists "fin_monthly_team" on public.fin_monthly;
create policy "fin_monthly_team" on public.fin_monthly for all to authenticated
  using (public.has_member_module(manager_id, 'cria_caixa'))
  with check (public.has_member_module(manager_id, 'cria_caixa'));
