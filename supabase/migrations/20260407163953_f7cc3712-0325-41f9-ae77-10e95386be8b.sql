
-- Structured goals
CREATE TABLE public.structured_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  period TEXT DEFAULT 'mensal',
  current_value NUMERIC DEFAULT 0,
  target_value NUMERIC DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  observation TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.structured_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own goals" ON public.structured_goals FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Milestones (baby steps)
CREATE TABLE public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.structured_goals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own milestones" ON public.milestones FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Monthly reflections (structured)
CREATE TABLE public.monthly_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  biz_worked TEXT,
  biz_blocked TEXT,
  biz_revenue TEXT,
  biz_clarity TEXT,
  biz_procrastination TEXT,
  content_best TEXT,
  content_connection TEXT,
  content_rhythm TEXT,
  focus_execution TEXT,
  focus_distractions TEXT,
  focus_lessons TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE public.monthly_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reflections" ON public.monthly_reflections FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
