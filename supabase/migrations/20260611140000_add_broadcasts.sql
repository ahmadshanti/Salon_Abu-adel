-- ============================================================
-- Broadcast announcements sent by the admin to all users.
-- Run in the Supabase SQL editor (or `supabase db push`).
--
-- The admin broadcast screen (app/(admin)/broadcast.tsx) inserts a
-- row per broadcast for history, then pushes the message to every
-- user's expo_push_token via the Expo push API.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  sent_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_count  INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "broadcasts_select" ON public.broadcasts;
CREATE POLICY "broadcasts_select" ON public.broadcasts
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "broadcasts_insert" ON public.broadcasts;
CREATE POLICY "broadcasts_insert" ON public.broadcasts
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "broadcasts_delete" ON public.broadcasts;
CREATE POLICY "broadcasts_delete" ON public.broadcasts
  FOR DELETE USING (public.is_admin());
