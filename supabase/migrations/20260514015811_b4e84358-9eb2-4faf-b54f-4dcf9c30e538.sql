-- Apply pending migrations from 2026-05-14
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS editorial_line JSONB DEFAULT '{}';
ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS icon TEXT;