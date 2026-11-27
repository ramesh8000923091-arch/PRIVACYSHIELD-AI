-- PrivacyShield AI — Safe Metadata Schema & Row Level Security
-- Migration: 0001_init_privacyshield_metadata.sql
--
-- PRIVACY INVARIANT:
-- This schema intentionally contains ZERO columns for raw documents,
-- pasted text, filenames, detected PII values, or pseudonymization mappings.

-- 1. User Preferences (strictly authenticated users, opt-in)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  default_redaction_mode TEXT NOT NULL DEFAULT 'FULL_MASK'
    CHECK (default_redaction_mode IN ('FULL_MASK', 'PARTIAL_MASK', 'PSEUDONYMIZE')),
  telemetry_consent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id
  ON public.user_preferences(user_id);

-- Automatic updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. Consented Aggregate Sanitization Statistics (strictly non-negative integer counts)
CREATE TABLE IF NOT EXISTS public.sanitization_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  email_count INTEGER NOT NULL DEFAULT 0 CHECK (email_count >= 0),
  phone_count INTEGER NOT NULL DEFAULT 0 CHECK (phone_count >= 0),
  ip_count INTEGER NOT NULL DEFAULT 0 CHECK (ip_count >= 0),
  pan_count INTEGER NOT NULL DEFAULT 0 CHECK (pan_count >= 0),
  aadhaar_count INTEGER NOT NULL DEFAULT 0 CHECK (aadhaar_count >= 0),
  credit_card_count INTEGER NOT NULL DEFAULT 0 CHECK (credit_card_count >= 0),
  total_entities INTEGER NOT NULL DEFAULT 0 CHECK (
    total_entities >= 0 AND
    total_entities = email_count + phone_count + ip_count + pan_count + aadhaar_count + credit_card_count
  ),
  redaction_mode TEXT NOT NULL CHECK (redaction_mode IN ('FULL_MASK', 'PARTIAL_MASK', 'PSEUDONYMIZE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sanitization_statistics_user_id
  ON public.sanitization_statistics(user_id);

CREATE INDEX IF NOT EXISTS idx_sanitization_statistics_created_at
  ON public.sanitization_statistics(created_at DESC);

-- 3. Row Level Security (Least-Privilege Access)
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sanitization_statistics ENABLE ROW LEVEL SECURITY;

-- user_preferences policies
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own preferences" ON public.user_preferences;
CREATE POLICY "Users can delete own preferences"
  ON public.user_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- sanitization_statistics policies
DROP POLICY IF EXISTS "Users can read own statistics" ON public.sanitization_statistics;
CREATE POLICY "Users can read own statistics"
  ON public.sanitization_statistics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert own statistics" ON public.sanitization_statistics;
CREATE POLICY "Authenticated users can insert own statistics"
  ON public.sanitization_statistics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Consented anonymous aggregate inserts" ON public.sanitization_statistics;
CREATE POLICY "Consented anonymous aggregate inserts"
  ON public.sanitization_statistics FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);
