-- Admin troca o tipo de conta (criador <-> social mídia) pela janela do usuário
-- (Walter, 20/10/2026: a EMILI se cadastrou como criadora por engano).
-- account_type é campo travado pra UPDATE direto; só o admin, por aqui.
create or replace function public.admin_definir_tipo_conta(_user_id uuid, _tipo text)
returns text language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'not_authorized';
  end if;
  if _tipo not in ('manager', 'creator') then raise exception 'tipo_invalido'; end if;
  update public.profiles set account_type = _tipo where id = _user_id;
  return _tipo;
end $$;
revoke all on function public.admin_definir_tipo_conta(uuid, text) from public, anon;
grant execute on function public.admin_definir_tipo_conta(uuid, text) to authenticated;
