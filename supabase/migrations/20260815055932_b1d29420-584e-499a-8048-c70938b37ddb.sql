DROP POLICY IF EXISTS "shipments_vendor_read" ON public.order_shipments;
CREATE POLICY "shipments_vendor_read"
ON public.order_shipments
FOR SELECT
TO authenticated
USING (public.is_vendor_member(vendor_id, auth.uid()));

DROP POLICY IF EXISTS "Vendor members manage own coupons" ON public.coupons;
CREATE POLICY "Vendor members manage own coupons"
ON public.coupons
FOR ALL
TO authenticated
USING (vendor_id IS NOT NULL AND public.is_vendor_member(vendor_id, auth.uid()))
WITH CHECK (vendor_id IS NOT NULL AND public.is_vendor_member(vendor_id, auth.uid()));

DROP POLICY IF EXISTS "Vendors read their questions" ON public.product_questions;
CREATE POLICY "Vendors read their questions"
ON public.product_questions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_questions.product_id
    AND public.is_vendor_member(p.vendor_id, auth.uid())
));

REVOKE EXECUTE ON FUNCTION public.is_vendor_member(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_vendor_member(uuid, uuid) TO authenticated, service_role;