
-- 1. Fix profiles: drop the dangerous OR policies that allowed bypass
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
-- Keep the strict ones already in place: "Users can update own profile" (with WITH CHECK),
-- "Admins update any profile" (is_admin only), "Users can view own profile", "Admins view all profiles".

-- 2. Lock down ai_rate_limit writes to service_role only.
REVOKE INSERT, UPDATE, DELETE ON public.ai_rate_limit FROM anon, authenticated;

-- Add explicit restrictive deny policies so scanner & defense-in-depth are clear.
CREATE POLICY "Block client inserts on rate limit"
ON public.ai_rate_limit AS RESTRICTIVE
FOR INSERT TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "Block client updates on rate limit"
ON public.ai_rate_limit AS RESTRICTIVE
FOR UPDATE TO authenticated, anon
USING (false) WITH CHECK (false);

CREATE POLICY "Block client deletes on rate limit"
ON public.ai_rate_limit AS RESTRICTIVE
FOR DELETE TO authenticated, anon
USING (false);
