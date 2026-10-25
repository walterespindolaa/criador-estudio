-- ═══════════════════════════════════════════════════════════════════════════
-- CARTÃO DO PARCEIRO NA EQUIPE (25/10/2026)
--
-- O onboarding do prestador pede foto, WhatsApp, portfólio e cidade. A
-- agência só via nome e e-mail (manager_members). Esta função devolve o
-- contato dos parceiros DA PRÓPRIA agência (dona = auth.uid()), ativos ou
-- pausados. profiles não é legível por outra conta, por isso security definer
-- com o filtro no vínculo.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.parceiros_contato()
returns table(member_id uuid, avatar_url text, phone text, cidade text, instagram_handle text, portfolio_url text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id, p.avatar_url, p.phone, p.cidade, p.instagram_handle, p.media_kit_url
    from public.manager_members m
    join public.profiles p on p.id = m.member_id
   where m.manager_id = auth.uid()
     and m.status in ('ativo', 'pausado')
     and public.eh_papel_parceiro(m.role);
$$;

revoke all on function public.parceiros_contato() from public, anon;
grant execute on function public.parceiros_contato() to authenticated;
