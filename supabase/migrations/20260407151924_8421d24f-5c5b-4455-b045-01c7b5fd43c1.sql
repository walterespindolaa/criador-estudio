
CREATE TABLE IF NOT EXISTS public.google_drive_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  google_account_id TEXT NOT NULL,
  google_email TEXT NOT NULL,
  google_name TEXT,
  connected_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.google_drive_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own drive connection" ON public.google_drive_connections FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.external_media_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'google_drive',
  external_file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  thumbnail_url TEXT,
  view_url TEXT,
  download_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.external_media_refs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own media refs" ON public.external_media_refs FOR ALL USING (auth.uid() = user_id);
