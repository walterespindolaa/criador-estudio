-- Upload de imagem no Link na bio quebrado (29/10/2026).
-- Causa (logs do storage): o envio usa upsert, que o storage faz como
-- INSERT ... ON CONFLICT DO UPDATE ... RETURNING. O RETURNING exige uma policy
-- de SELECT, e o bucket bio-media só tinha INSERT/UPDATE/DELETE pra pasta do
-- próprio usuário. Resultado: "new row violates row-level security policy"
-- (42501) pra quem não é membro de equipe. O bucket "media", com SELECT da
-- própria pasta, sobe normal com o mesmo upsert.
-- O bucket é público (as imagens já abrem pelo link); isto só deixa o dono
-- ler as linhas da PRÓPRIA pasta.
create policy "Users read own bio media"
  on storage.objects for select to authenticated
  using (bucket_id = 'bio-media' and (auth.uid())::text = (storage.foldername(name))[1]);
