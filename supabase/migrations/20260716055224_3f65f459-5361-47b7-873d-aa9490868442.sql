
-- 1) Restrict store_follows: remove public exposure of customer_id
DROP POLICY IF EXISTS "Public read follows" ON public.store_follows;

-- Aggregated follower counts (no PII) exposed via SECURITY DEFINER RPCs
CREATE OR REPLACE FUNCTION public.get_follower_count(_vendor_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.store_follows WHERE vendor_id = _vendor_id;
$$;

CREATE OR REPLACE FUNCTION public.get_follower_counts()
RETURNS TABLE(vendor_id uuid, count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT vendor_id, COUNT(*)::int AS count FROM public.store_follows GROUP BY vendor_id;
$$;

REVOKE ALL ON FUNCTION public.get_follower_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_follower_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_follower_count(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_follower_counts() TO anon, authenticated;

-- 2) Storage: remove overly-broad SELECT policy that permits listing on product-images.
-- Public bucket still serves objects via the CDN /storage/v1/object/public/... path.
DROP POLICY IF EXISTS "product-images public read" ON storage.objects;

-- 3) Revoke EXECUTE from anon/authenticated on SECURITY DEFINER functions that
-- should never be called directly by clients (trigger functions & internal helpers).
REVOKE ALL ON FUNCTION public.enforce_product_moderation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_return() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_product_pending() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_product_rating() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_vendor_boost_scores() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_commission(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snapshot_order_commissions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_coupon(uuid, uuid, uuid, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_order_payment(uuid, text, payment_method) FROM PUBLIC, anon, authenticated;
