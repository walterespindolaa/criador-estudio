
CREATE TABLE public.moodboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  question_key TEXT NOT NULL,
  answer TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, section, question_key)
);

ALTER TABLE public.moodboard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own moodboard" ON public.moodboard_entries FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
