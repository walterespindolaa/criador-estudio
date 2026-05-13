-- 1. Campos de storage no profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT DEFAULT 524288000, -- 500MB
  ADD COLUMN IF NOT EXISTS storage_retention_days INT DEFAULT 30;

-- 2. Campos de origem e expiração na tabela files
--    (reusa a coluna existente size_bytes para o cálculo de uso)
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- source: 'upload' = subiu do PC/celular (expira), 'drive' = Google Drive (não expira)

-- 3. Índice para a Edge Function de limpeza encontrar arquivos expirados rápido
CREATE INDEX IF NOT EXISTS idx_files_expires_at
  ON public.files(expires_at)
  WHERE expires_at IS NOT NULL;

-- 4. Índice para buscar arquivos por usuário + source
CREATE INDEX IF NOT EXISTS idx_files_user_source
  ON public.files(user_id, source);

-- 5. Função para atualizar storage_used_bytes automaticamente via trigger
CREATE OR REPLACE FUNCTION public.update_storage_used()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.source = 'upload' THEN
    UPDATE public.profiles
    SET storage_used_bytes = storage_used_bytes + COALESCE(NEW.size_bytes, 0)
    WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' AND OLD.source = 'upload' THEN
    UPDATE public.profiles
    SET storage_used_bytes = GREATEST(0, storage_used_bytes - COALESCE(OLD.size_bytes, 0))
    WHERE id = OLD.user_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_storage ON public.files;
CREATE TRIGGER trigger_update_storage
  AFTER INSERT OR DELETE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.update_storage_used();

-- 6. Backfill: sincronizar storage_used_bytes com o estado atual dos arquivos
--    Sobrescreve o valor por inteiro (idempotente — pode rodar de novo sem somar duas vezes)
UPDATE public.profiles p SET storage_used_bytes = COALESCE((
  SELECT SUM(COALESCE(size_bytes, 0))::BIGINT
  FROM public.files
  WHERE user_id = p.id AND COALESCE(source, 'upload') = 'upload'
), 0);
