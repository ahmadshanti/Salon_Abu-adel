-- ============================================================
-- Add the avatar_url column the app already reads and writes.
-- Run in the Supabase SQL editor (or `supabase db push`).
--
-- The customer profile screen uploads an avatar and writes it
-- (app/(user)/profile.tsx), and both the customer layout and the
-- admin customers screen read users.avatar_url. Without this column
-- those SELECTs error and the admin customers list silently shows
-- the empty state instead of the real customers.
-- ============================================================

alter table public.users
  add column if not exists avatar_url text;
