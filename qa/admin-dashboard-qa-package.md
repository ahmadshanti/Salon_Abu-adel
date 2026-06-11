# QA Package — Salon Abu Adel Admin Dashboard

**Scope:** Admin flows of the Expo React Native app (expo-router + Supabase).
**Reviewed against code:** `app/(admin)/*`, `app/_layout.tsx`, `app/(auth)/login.tsx`, `app/(user)/booking.tsx`, `lib/hooks/useAuth.ts`, `lib/utils/{time,notifications}.ts`, `supabase_schema.sql`, `supabase/migrations/20260611120000_prevent_double_booking.sql`.
**Date:** 2026-06-11

---

## 1. Feature Summary

| Area | Implementation |
|---|---|
| Auth & routing | Email/password login via Supabase Auth (`(auth)/login.tsx`). Root layout (`app/_layout.tsx`) holds a splash overlay, listens to `onAuthStateChange`, fetches `users