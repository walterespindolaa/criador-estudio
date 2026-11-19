-- MÍDIA INVISÍVEL PRA EQUIPE (Gabi, 19/11/2026).
-- Quem é da equipe do gestor (manager_members) enxerga e edita os posts dele
-- (policy posts_team_external), e consegue ANEXAR mídia (criapost_add_media usa
-- acts_for). Mas a leitura de external_media_refs só liberava o dono e o
-- account_members. Resultado: a Gabi anexava, o editor mostrava 0/20, ela anexava
-- de novo (6 vezes no post #1 do Uni) e parecia que nada salvava.
-- Regra nova: quem consegue ver o post, consegue ver a mídia dele. A subconsulta
-- em posts roda com o RLS de posts de quem está logado, então não abre nada além
-- do que a pessoa já vê. Só leitura: gravar continua pelas funções de sempre.
drop policy if exists midia_visivel_pra_quem_ve_o_post on public.external_media_refs;
create policy midia_visivel_pra_quem_ve_o_post on public.external_media_refs
  for select to authenticated
  using (
    post_id is not null
    and exists (select 1 from public.posts p where p.id = external_media_refs.post_id)
  );
