-- ============================================================
-- Perfume orders: final price snapshot at approval time
--
-- Physical perfume prices can differ from the listed price, and
-- editing a perfume's price must not rewrite past sales. The admin
-- confirms the final per-unit price when approving an order, and it
-- is stored on the order itself. Cost stays on the perfume (constant).
-- NULL on old/pending orders → app falls back to the perfume's price.
-- ============================================================

ALTER TABLE public.perfume_orders
  ADD COLUMN IF NOT EXISTS final_price_ils INTEGER CHECK (final_price_ils > 0);

-- final_cost_ils was added in an earlier draft; cost stays on the perfume.
ALTER TABLE public.perfume_orders
  DROP COLUMN IF EXISTS final_cost_ils;
