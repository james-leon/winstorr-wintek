DROP POLICY IF EXISTS "orders_vendor_read" ON public.orders;

CREATE POLICY "orders_vendor_read"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_order_vendor(id, auth.uid()));

REVOKE EXECUTE ON FUNCTION public.is_order_vendor(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_order_vendor(uuid, uuid) TO authenticated, service_role;