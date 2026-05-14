ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS editorial_line JSONB DEFAULT '{}';
