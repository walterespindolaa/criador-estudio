
-- 1. Block role/plan/billing self-escalation on profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  AND plan IS NOT DISTINCT FROM (SELECT plan FROM public.profiles WHERE id = auth.uid())
  AND subscription_status IS NOT DISTINCT FROM (SELECT subscription_status FROM public.profiles WHERE id = auth.uid())
  AND stripe_customer_id IS NOT DISTINCT FROM (SELECT stripe_customer_id FROM public.profiles WHERE id = auth.uid())
  AND stripe_subscription_id IS NOT DISTINCT FROM (SELECT stripe_subscription_id FROM public.profiles WHERE id = auth.uid())
  AND trial_started_at IS NOT DISTINCT FROM (SELECT trial_started_at FROM public.profiles WHERE id = auth.uid())
  AND trial_ends_at IS NOT DISTINCT FROM (SELECT trial_ends_at FROM public.profiles WHERE id = auth.uid())
);

-- 2. Drop broad public SELECT and add safe RPC for public profile
DROP POLICY IF EXISTS "Public can view profile by slug" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_public_profile_by_slug(_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  bio text,
  avatar_url text,
  niche text,
  instagram_handle text,
  bio_settings jsonb,
  bio_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.bio, p.avatar_url, p.niche, p.instagram_handle, p.bio_settings, p.bio_slug
  FROM public.profiles p
  WHERE p.bio_slug = _slug
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_slug(text) TO anon, authenticated;

-- 3. Restrict bio_links public listing
DROP POLICY IF EXISTS "Public can view active bio links" ON public.bio_links;

CREATE OR REPLACE FUNCTION public.get_public_bio_links_by_slug(_slug text)
RETURNS TABLE (
  id uuid,
  title text,
  url text,
  icon text,
  "position" integer,
  link_type text,
  thumbnail_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bl.id, bl.title, bl.url, bl.icon, bl."position", bl.link_type, bl.thumbnail_url
  FROM public.bio_links bl
  JOIN public.profiles p ON p.id = bl.user_id
  WHERE p.bio_slug = _slug AND bl.is_active = true
  ORDER BY bl."position" ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_bio_links_by_slug(text) TO anon, authenticated;

-- 4. Remove client-side insert on course_purchases
DROP POLICY IF EXISTS "Users can insert own purchases" ON public.course_purchases;

-- 5. Bio-media storage: enforce path ownership
DROP POLICY IF EXISTS "Users upload bio media" ON storage.objects;
DROP POLICY IF EXISTS "Users update bio media" ON storage.objects;

CREATE POLICY "Users upload own bio media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bio-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users update own bio media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'bio-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own bio media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'bio-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 6. Make files bucket private and remove broad public SELECT
UPDATE storage.buckets SET public = false WHERE id = 'files';

DROP POLICY IF EXISTS "Public can view files" ON storage.objects;
DROP POLICY IF EXISTS "Public read files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view files" ON storage.objects;

DROP POLICY IF EXISTS "Users can view own files in storage" ON storage.objects;
CREATE POLICY "Users can view own files in storage"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'files'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can upload own files in storage" ON storage.objects;
CREATE POLICY "Users can upload own files in storage"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'files'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own files in storage" ON storage.objects;
CREATE POLICY "Users can delete own files in storage"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'files'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 7. Drop legacy broad public SELECT policies on other buckets (public URL still works for public buckets)
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view media" ON storage.objects;
DROP POLICY IF EXISTS "Public read bio-media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view bio media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view bio media" ON storage.objects;

-- 8. Fix search_path on SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.increment_bio_link_click(link_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.bio_links SET clicks = clicks + 1 WHERE id = link_id;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET trial_started_at = now(),
      trial_ends_at = now() + INTERVAL '7 days',
      plan = 'trial'
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_storage_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.source = 'upload' THEN
    UPDATE public.profiles 
    SET storage_used_bytes = storage_used_bytes + COALESCE(NEW.size_bytes, 0)
    WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' AND OLD.source = 'upload' THEN
    UPDATE public.profiles 
    SET storage_used_bytes = GREATEST(0, storage_used_bytes - COALESCE(OLD.size_bytes, 0))
    WHERE id = OLD.user_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 9. Revoke EXECUTE on is_admin (only used internally by RLS)
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, authenticated, PUBLIC;
