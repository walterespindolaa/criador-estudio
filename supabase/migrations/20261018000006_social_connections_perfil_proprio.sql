-- JÁ APLICADA no projeto ecbzfjzoqidowrsfsfih em 18/10/2026 (registro).
-- Meu perfil: a dona do perfil próprio (perfil_de = sessão) gerencia a
-- conexão de Instagram dele (desconectar pelo app). Conectar passa pela edge
-- get-instagram-config com account_id, que confere perfil_de no servidor.
create policy "perfil proprio gerencia conexoes" on public.social_connections
  for all to authenticated
  using (public.is_perfil_proprio(user_id))
  with check (public.is_perfil_proprio(user_id));
