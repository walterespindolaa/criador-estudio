
ALTER TABLE public.monthly_goals ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.user_library_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  is_user_item BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, item_type, item_id)
);
ALTER TABLE public.user_library_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own usage" ON public.user_library_usage FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
