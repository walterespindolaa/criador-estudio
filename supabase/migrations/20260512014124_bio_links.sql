-- bio_links table for the public Link in Bio page
CREATE TABLE IF NOT EXISTS public.bio_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT,
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  clicks INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bio_links_user_position_idx
  ON public.bio_links (user_id, position);

ALTER TABLE public.bio_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bio links" ON public.bio_links
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can view active bio links" ON public.bio_links
  FOR SELECT USING (is_active = true);

-- Public-facing slug for /bio/:slug + appearance settings as JSON
-- ({ bgColor, buttonColor, buttonStyle, useProfile }).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio_slug TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio_theme JSONB;

CREATE POLICY "Public can view profile by slug" ON public.profiles
  FOR SELECT USING (bio_slug IS NOT NULL);

-- Allow anonymous visitors to bump the click counter without
-- granting blanket UPDATE access on bio_links.
CREATE OR REPLACE FUNCTION public.increment_bio_link_click(link_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.bio_links
     SET clicks = clicks + 1
   WHERE id = link_id AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.increment_bio_link_click(UUID) TO anon, authenticated;
