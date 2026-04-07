
-- Add theme columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#C4622D',
ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'light',
ADD COLUMN IF NOT EXISTS theme_font TEXT DEFAULT 'fraunces';

-- User hooks
CREATE TABLE IF NOT EXISTS public.user_hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  hook_text TEXT NOT NULL,
  platforms TEXT[],
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_hooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own hooks" ON public.user_hooks FOR ALL USING (auth.uid() = user_id);

-- User formats
CREATE TABLE IF NOT EXISTS public.user_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  structure TEXT NOT NULL,
  tips TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_formats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own formats" ON public.user_formats FOR ALL USING (auth.uid() = user_id);

-- User prompts
CREATE TABLE IF NOT EXISTS public.user_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  tip TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prompts" ON public.user_prompts FOR ALL USING (auth.uid() = user_id);
