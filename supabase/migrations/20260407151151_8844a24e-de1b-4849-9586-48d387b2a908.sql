
CREATE TABLE IF NOT EXISTS public.personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Meu público principal',
  age_range TEXT,
  gender TEXT,
  location TEXT,
  interests TEXT[],
  pain_points TEXT[],
  desires TEXT[],
  platforms TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own personas" ON public.personas FOR ALL USING (auth.uid() = user_id);
