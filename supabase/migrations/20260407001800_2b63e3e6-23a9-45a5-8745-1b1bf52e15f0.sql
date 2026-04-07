
-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  niche TEXT,
  platforms TEXT[],
  weekly_goal INT DEFAULT 3,
  plan TEXT DEFAULT 'free',
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'Criador'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Pillars
CREATE TABLE public.pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.pillars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own pillars" ON public.pillars FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pillars" ON public.pillars FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pillars" ON public.pillars FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pillars" ON public.pillars FOR DELETE USING (auth.uid() = user_id);

-- Ideas
CREATE TABLE public.ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  pillar_id UUID REFERENCES public.pillars(id) ON DELETE SET NULL,
  platform TEXT,
  notes TEXT,
  promoted_to_post_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ideas" ON public.ideas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ideas" ON public.ideas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ideas" ON public.ideas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ideas" ON public.ideas FOR DELETE USING (auth.uid() = user_id);

-- Posts
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  platform TEXT NOT NULL,
  format TEXT NOT NULL,
  pillar_id UUID REFERENCES public.pillars(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'ideia',
  hook TEXT,
  script TEXT,
  caption TEXT,
  cta TEXT,
  scheduled_date DATE,
  published_at TIMESTAMPTZ,
  result_views INT,
  result_saves INT,
  result_comments INT,
  archive_summary TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own posts" ON public.posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add FK from ideas to posts
ALTER TABLE public.ideas ADD CONSTRAINT ideas_promoted_to_post_fk
  FOREIGN KEY (promoted_to_post_id) REFERENCES public.posts(id) ON DELETE SET NULL;

-- Media items
CREATE TABLE public.media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  category TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own media" ON public.media_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own media" ON public.media_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own media" ON public.media_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own media" ON public.media_items FOR DELETE USING (auth.uid() = user_id);

-- Brand items
CREATE TABLE public.brand_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.brand_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own brand items" ON public.brand_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own brand items" ON public.brand_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own brand items" ON public.brand_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own brand items" ON public.brand_items FOR DELETE USING (auth.uid() = user_id);

-- Habits
CREATE TABLE public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own habits" ON public.habits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own habits" ON public.habits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own habits" ON public.habits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own habits" ON public.habits FOR DELETE USING (auth.uid() = user_id);

-- Habit logs
CREATE TABLE public.habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  done BOOLEAN DEFAULT false,
  UNIQUE(user_id, habit_id, date)
);
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own habit logs" ON public.habit_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own habit logs" ON public.habit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own habit logs" ON public.habit_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own habit logs" ON public.habit_logs FOR DELETE USING (auth.uid() = user_id);

-- Monthly goals
CREATE TABLE public.monthly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  goals TEXT[],
  focus TEXT,
  reflection TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month)
);
ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own monthly goals" ON public.monthly_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own monthly goals" ON public.monthly_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monthly goals" ON public.monthly_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own monthly goals" ON public.monthly_goals FOR DELETE USING (auth.uid() = user_id);

-- Reference hooks (admin-curated, read-only for users)
CREATE TABLE public.reference_hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  platforms TEXT[],
  formats TEXT[],
  hook_text TEXT NOT NULL,
  example TEXT,
  is_active BOOLEAN DEFAULT true
);
ALTER TABLE public.reference_hooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view active hooks" ON public.reference_hooks FOR SELECT TO authenticated USING (is_active = true);

-- Reference formats
CREATE TABLE public.reference_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  format_type TEXT NOT NULL,
  structure TEXT NOT NULL,
  tips TEXT,
  is_active BOOLEAN DEFAULT true
);
ALTER TABLE public.reference_formats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view active formats" ON public.reference_formats FOR SELECT TO authenticated USING (is_active = true);

-- Reference prompts
CREATE TABLE public.reference_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  platforms TEXT[],
  tip TEXT,
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);
ALTER TABLE public.reference_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view active prompts" ON public.reference_prompts FOR SELECT TO authenticated USING (is_active = true);

-- Courses
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  content_url TEXT,
  is_included_pro BOOLEAN DEFAULT true,
  price_cents INT,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view courses" ON public.courses FOR SELECT TO authenticated USING (true);

-- Course purchases
CREATE TABLE public.course_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, course_id)
);
ALTER TABLE public.course_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own purchases" ON public.course_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own purchases" ON public.course_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
