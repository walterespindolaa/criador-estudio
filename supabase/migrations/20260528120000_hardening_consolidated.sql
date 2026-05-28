-- =====================================================================
-- Consolidação do hardening (funções/tabelas criadas via dashboard)
-- Idempotente: seguro rodar mesmo que já existam no banco.
-- =====================================================================

-- has_access(): gate de trial/subscription server-side
CREATE OR REPLACE FUNCTION public.has_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (role = 'admin' OR subscription_status = 'active'
           OR (trial_ends_at IS NOT NULL AND trial_ends_at > now()))
  );
$$;
REVOKE EXECUTE ON FUNCTION public.has_access() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_access() TO authenticated;

-- billing_events: idempotência de webhooks de pagamento (Stripe/Asaas)
CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway TEXT NOT NULL,
  event_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(gateway, event_id)
);
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages billing_events" ON public.billing_events;
CREATE POLICY "Service role manages billing_events" ON public.billing_events
  FOR ALL USING (auth.role() = 'service_role');

-- account_deletion_log: audit de exclusão de conta (LGPD)
CREATE TABLE IF NOT EXISTS public.account_deletion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_hash TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  request_metadata JSONB
);
ALTER TABLE public.account_deletion_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages deletion log" ON public.account_deletion_log;
CREATE POLICY "Service role manages deletion log" ON public.account_deletion_log
  FOR ALL USING (auth.role() = 'service_role');
CREATE INDEX IF NOT EXISTS idx_deletion_log_email_hash ON public.account_deletion_log(email_hash);
CREATE INDEX IF NOT EXISTS idx_deletion_log_deleted_at ON public.account_deletion_log(deleted_at DESC);

-- last_seen_at + touch_last_seen(): tracking de atividade
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen_at DESC);

CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _last TIMESTAMPTZ;
BEGIN
  SELECT last_seen_at INTO _last FROM public.profiles WHERE id = auth.uid();
  IF _last IS NULL OR _last < now() - INTERVAL '5 minutes' THEN
    UPDATE public.profiles SET last_seen_at = now() WHERE id = auth.uid();
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.touch_last_seen() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

-- get_admin_stats(): métricas do painel admin
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS TABLE (total_users bigint, active_users_7d bigint, admins bigint,
  onboarded bigint, plan_free bigint, plan_pro bigint, plan_premium bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::bigint,
    count(*) FILTER (WHERE last_seen_at > now() - INTERVAL '7 days')::bigint,
    count(*) FILTER (WHERE role = 'admin')::bigint,
    count(*) FILTER (WHERE onboarding_completed = true)::bigint,
    count(*) FILTER (WHERE coalesce(plan,'free') = 'free')::bigint,
    count(*) FILTER (WHERE plan = 'pro')::bigint,
    count(*) FILTER (WHERE plan = 'premium')::bigint
  FROM public.profiles WHERE public.is_admin();
$$;
REVOKE EXECUTE ON FUNCTION public.get_admin_stats() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;

-- bump_ai_rate_limit(): rate limit atômico
CREATE OR REPLACE FUNCTION public.bump_ai_rate_limit(_user uuid, _window timestamptz, _max int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new_count int;
BEGIN
  INSERT INTO public.ai_rate_limit (user_id, window_start, call_count)
  VALUES (_user, _window, 1)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET call_count = ai_rate_limit.call_count + 1
  RETURNING call_count INTO _new_count;
  IF _new_count > _max THEN RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001'; END IF;
  RETURN _new_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.bump_ai_rate_limit FROM anon, authenticated, PUBLIC;

-- has_access policies admin (idempotente)
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
