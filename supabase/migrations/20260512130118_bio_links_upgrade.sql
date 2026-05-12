-- Richer customization for the Link in Bio page.
-- bio_settings holds the new appearance state (bg type/color/gradient/image,
-- button style + colors, social handles). The older bio_theme column stays
-- in place but is no longer read by the app.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio_settings JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.bio_links
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

ALTER TABLE public.bio_links
  ADD COLUMN IF NOT EXISTS link_type TEXT DEFAULT 'link';

-- Defer the CHECK so existing rows (link_type NULL) don't trip it.
UPDATE public.bio_links SET link_type = 'link' WHERE link_type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bio_links_link_type_check'
  ) THEN
    ALTER TABLE public.bio_links
      ADD CONSTRAINT bio_links_link_type_check
      CHECK (link_type IN ('link', 'header', 'social'));
  END IF;
END $$;

-- Public bucket for link thumbnails and background images.
INSERT INTO storage.buckets (id, name, public)
VALUES ('bio-media', 'bio-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view bio media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bio-media');

CREATE POLICY "Users upload own bio media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bio-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own bio media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'bio-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own bio media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'bio-media' AND auth.uid()::text = (storage.foldername(name))[1]);
