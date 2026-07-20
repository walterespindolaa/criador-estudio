-- Bucket 'relatorios' (achado A4): fechar acesso público.
-- Estava public=true + policy de SELECT aberta a anon, então qualquer um
-- conseguia listar/baixar o relatório (PDF com métricas/PII de cliente) de
-- QUALQUER gestor. O frontend (ClientReportDialog) já gera signedUrl de 30 dias,
-- então os links compartilhados continuam funcionando. Idempotente.

-- 1) Bucket privado.
update storage.buckets set public = false where id = 'relatorios';

-- 2) Remove a leitura pública.
drop policy if exists "relatorios_public_read" on storage.objects;

-- 3) Dono lê só a própria pasta (necessário pro createSignedUrl funcionar).
drop policy if exists "relatorios_owner_read" on storage.objects;
create policy "relatorios_owner_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'relatorios' and (storage.foldername(name))[1] = auth.uid()::text);

-- 4) Dono pode apagar os próprios relatórios (limpeza/regeração).
drop policy if exists "relatorios_owner_delete" on storage.objects;
create policy "relatorios_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'relatorios' and (storage.foldername(name))[1] = auth.uid()::text);
