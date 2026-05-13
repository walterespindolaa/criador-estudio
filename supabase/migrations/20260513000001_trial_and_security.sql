-- 1. Campos de trial e plano na tabela profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 2. Preencher trial automaticamente para novos usuários via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET
    trial_started_at = now(),
    trial_ends_at = now() + INTERVAL '7 days',
    plan = 'trial'
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_set_trial ON public.profiles;
CREATE TRIGGER on_profile_created_set_trial
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_trial();

-- 3. Tabela de controle de rate limiting para IA
CREATE TABLE IF NOT EXISTS public.ai_rate_limit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  call_count INT NOT NULL DEFAULT 1,
  UNIQUE(user_id, window_start)
);
ALTER TABLE public.ai_rate_limit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own rate limit" ON public.ai_rate_limit
  FOR SELECT USING (auth.uid() = user_id);

-- 4. Tabela de pagamentos/transações
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL DEFAULT 'stripe',
  gateway_customer_id TEXT,
  gateway_subscription_id TEXT,
  gateway_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  plan TEXT NOT NULL DEFAULT 'pro',
  amount_cents INT,
  currency TEXT DEFAULT 'BRL',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages subscriptions" ON public.subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- 5. Auditar RLS nas tabelas novas de bio
ALTER TABLE public.bio_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users manage own bio links" ON public.bio_links
  FOR ALL USING (auth.uid() = user_id);

-- 6. Índices de performance
CREATE INDEX IF NOT EXISTS idx_profiles_trial_ends ON public.profiles(trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
