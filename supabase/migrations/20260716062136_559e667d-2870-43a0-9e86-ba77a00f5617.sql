
-- Fix infinite recursion between orders and order_items policies.
-- Root cause: orders_vendor_read queries order_items, and order_items_own_select
-- queries orders. Each policy triggers the other during planning, causing
-- Postgres to reject the query with 42P17. This has been hiding ALL orders
-- from every authenticated user.

CREATE OR REPLACE FUNCTION public.is_order_vendor(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.vendor_members vm
      ON vm.vendor_id = oi.vendor_id
    WHERE oi.order_id = _order_id
      AND vm.user_id = _user_id
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_order_vendor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_order_vendor(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS orders_vendor_read ON public.orders;
CREATE POLICY orders_vendor_read ON public.orders
  FOR SELECT
  USING (public.is_order_vendor(id, auth.uid()));
