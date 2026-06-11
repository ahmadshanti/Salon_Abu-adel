-- ============================================================
-- Prevent double bookings at the database level.
-- Run in the Supabase SQL editor (or `supabase db push`).
--
-- The app re-checks availability before inserting, but only this
-- constraint makes two simultaneous confirms on the same slot
-- impossible: the second insert fails with error code 23P01
-- (exclusion_violation), which the app translates to
-- "تم حجز هذا الوقت للتو، اختر وقتاً آخر".
-- ============================================================

-- STEP 0 — Find existing overlapping confirmed bookings.
-- The ALTER TABLE below will FAIL if any exist, so resolve them first
-- (cancel one of each pair):
--
--   select a.id as booking_a, b.id as booking_b,
--          a.start_time, a.end_time, b.start_time, b.end_time
--   from public.bookings a
--   join public.bookings b
--     on a.id < b.id
--    and a.status = 'confirmed'
--    and b.status = 'confirmed'
--    and tstzrange(a.start_time, a.end_time, '[)') && tstzrange(b.start_time, b.end_time, '[)');
--
--   update public.bookings set status = 'cancelled' where id = '<one of the pair>';

-- GiST support for the exclusion constraint.
create extension if not exists btree_gist;

-- Sanity: a booking must end after it starts (tstzrange requires it).
alter table public.bookings
  add constraint bookings_valid_time_range
  check (end_time > start_time);

-- No two CONFIRMED bookings may overlap in time (salon capacity = 1).
-- Cancelled bookings are ignored, so cancelling frees the slot.
alter table public.bookings
  add constraint bookings_no_overlapping_confirmed
  exclude using gist (
    tstzrange(start_time, end_time, '[)') with &&
  )
  where (status = 'confirmed');

-- NOTE (RLS): the customer app computes availability by reading
-- start_time/end_time of ALL confirmed bookings. Make sure a policy
-- allows authenticated users to SELECT those columns for confirmed
-- bookings; otherwise the slot grid cannot exclude other people's
-- appointments.
