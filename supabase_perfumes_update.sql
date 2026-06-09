-- ============================================================
-- Perfumes Update: cost_price + image storage
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add cost price column (admin-only, never exposed to customers)
ALTER TABLE public.perfumes
  ADD COLUMN IF NOT EXISTS cost_price_ils INTEGER;

-- 2. Create storage bucket for perfume images (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'perfume-images',
  'perfume-images',
  true,
  5242880,  -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS policies
CREATE POLICY "perfume_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'perfume-images');

CREATE POLICY "perfume_images_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'perfume-images' AND public.is_admin());

CREATE POLICY "perfume_images_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'perfume-images' AND public.is_admin());

CREATE POLICY "perfume_images_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'perfume-images' AND public.is_admin());
