-- Adiciona tag semanal relativa em posts (sprints livres: 1, 2, 3...)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS week_number INTEGER;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_week_number_positive
  CHECK (week_number IS NULL OR week_number > 0);

CREATE INDEX IF NOT EXISTS idx_posts_user_week
  ON public.posts(user_id, week_number)
  WHERE week_number IS NOT NULL;

COMMENT ON COLUMN public.posts.week_number IS
  'Tag relativa de sprint semanal (1, 2, 3...). Nullable. Definida manualmente pelo criador.';
