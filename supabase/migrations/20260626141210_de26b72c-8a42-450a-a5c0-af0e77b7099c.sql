
DROP POLICY IF EXISTS crm_storage_read ON storage.objects;
DROP POLICY IF EXISTS crm_storage_insert ON storage.objects;

CREATE POLICY crm_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'crm' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY crm_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crm' AND (storage.foldername(name))[1] = auth.uid()::text);
