-- ============================================================
-- Salon Abu Adel — Full Database Schema
-- Run this entire file in Supabase Dashboard → SQL Editor
-- ============================================================


-- ============================================================
-- 1. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.users (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name        TEXT,
  whatsapp_number  TEXT,
  role             TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  expo_push_token  TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.services (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  price_ils          INTEGER NOT NULL,
  duration_minutes   INTEGER NOT NULL,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.working_hours (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week  INTEGER NOT NULL UNIQUE CHECK (day_of_week BETWEEN 0 AND 6),
  open_time    TIME NOT NULL DEFAULT '09:00',
  close_time   TIME NOT NULL DEFAULT '18:00',
  is_closed    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.blocked_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  service_id  UUID NOT NULL REFERENCES public.services(id),
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ NOT NULL,
  status      TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.groom_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  preferred_time_text  TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  confirmed_time       TIMESTAMPTZ,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.perfumes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  price_ils       INTEGER NOT NULL,
  stock_quantity  INTEGER NOT NULL DEFAULT 0,
  image_url       TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.perfume_orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  perfume_id  UUID NOT NULL REFERENCES public.perfumes(id),
  quantity    INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 2. SEED WORKING HOURS (all 7 days)
-- ============================================================

INSERT INTO public.working_hours (day_of_week, open_time, close_time, is_closed) VALUES
  (0, '09:00', '18:00', TRUE),   -- Sunday   → closed
  (1, '09:00', '18:00', FALSE),  -- Monday
  (2, '09:00', '18:00', FALSE),  -- Tuesday
  (3, '09:00', '18:00', FALSE),  -- Wednesday
  (4, '09:00', '18:00', FALSE),  -- Thursday
  (5, '09:00', '14:00', FALSE),  -- Friday   → half day
  (6, '09:00', '18:00', FALSE)   -- Saturday
ON CONFLICT (day_of_week) DO NOTHING;


-- ============================================================
-- 3. AUTO-CREATE USER PROFILE ON SIGNUP (trigger)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, whatsapp_number, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'whatsapp_number',
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 4. BACKFILL any existing auth users who have no profile yet
-- ============================================================

INSERT INTO public.users (id, full_name, whatsapp_number, role)
SELECT
  au.id,
  au.raw_user_meta_data ->> 'full_name',
  au.raw_user_meta_data ->> 'whatsapp_number',
  'customer'
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 5. HELPER — is_admin() bypasses RLS to avoid recursion
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;


-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.working_hours   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_slots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groom_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfumes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfume_orders  ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to allow re-runs
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── users ──────────────────────────────────────────────────
-- Everyone reads their own row; admin reads all
CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

-- Users update their own row (push token); admin updates any
CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- ── services ───────────────────────────────────────────────
CREATE POLICY "services_select" ON public.services
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "services_insert" ON public.services
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "services_update" ON public.services
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "services_delete" ON public.services
  FOR DELETE USING (public.is_admin());

-- ── working_hours ──────────────────────────────────────────
CREATE POLICY "working_hours_select" ON public.working_hours
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "working_hours_update" ON public.working_hours
  FOR UPDATE USING (public.is_admin());

-- ── blocked_slots ──────────────────────────────────────────
CREATE POLICY "blocked_slots_select" ON public.blocked_slots
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "blocked_slots_insert" ON public.blocked_slots
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "blocked_slots_delete" ON public.blocked_slots
  FOR DELETE USING (public.is_admin());

-- ── bookings ───────────────────────────────────────────────
CREATE POLICY "bookings_select" ON public.bookings
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "bookings_insert" ON public.bookings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "bookings_update" ON public.bookings
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());

-- ── groom_requests ─────────────────────────────────────────
CREATE POLICY "groom_requests_select" ON public.groom_requests
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "groom_requests_insert" ON public.groom_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "groom_requests_update" ON public.groom_requests
  FOR UPDATE USING (public.is_admin());

-- ── perfumes ───────────────────────────────────────────────
CREATE POLICY "perfumes_select" ON public.perfumes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "perfumes_insert" ON public.perfumes
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "perfumes_update" ON public.perfumes
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "perfumes_delete" ON public.perfumes
  FOR DELETE USING (public.is_admin());

-- ── perfume_orders ─────────────────────────────────────────
CREATE POLICY "perfume_orders_select" ON public.perfume_orders
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "perfume_orders_insert" ON public.perfume_orders
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "perfume_orders_update" ON public.perfume_orders
  FOR UPDATE USING (public.is_admin());


-- ============================================================
-- 7. OPTIONAL — Make yourself admin
--    Replace the UUID with your own user ID from the error URL
-- ============================================================

-- UPDATE public.users SET role = 'admin'
-- WHERE id = '4a4a5d56-c4c4-4ff3-b515-76fc355f4b2f';


-- ============================================================
-- Done. All tables, triggers, and RLS policies are set up.
-- ============================================================
