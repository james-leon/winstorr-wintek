
-- 1) Internal vendors (Wintek) are exempt from commission
CREATE OR REPLACE FUNCTION public.resolve_commission(_product_id uuid, _line_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vendor_id uuid; v_category_id uuid; v_vendor_type public.vendor_type;
  rule public.commission_rules%ROWTYPE;
  amt numeric;
BEGIN
  SELECT vendor_id, category_id INTO v_vendor_id, v_category_id FROM public.products WHERE id = _product_id;

  IF v_vendor_id IS NOT NULL THEN
    SELECT type INTO v_vendor_type FROM public.vendors WHERE id = v_vendor_id;
    IF v_vendor_type = 'internal' THEN
      RETURN jsonb_build_object('amount', 0, 'rate', 0, 'type', NULL, 'rule_id', NULL);
    END IF;
  END IF;

  SELECT * INTO rule FROM public.commission_rules
    WHERE is_active AND scope='product' AND scope_id = _product_id
    ORDER BY priority DESC LIMIT 1;
  IF NOT FOUND AND v_category_id IS NOT NULL THEN
    SELECT * INTO rule FROM public.commission_rules
      WHERE is_active AND scope='category' AND scope_id = v_category_id
      ORDER BY priority DESC LIMIT 1;
  END IF;
  IF NOT FOUND AND v_vendor_id IS NOT NULL THEN
    SELECT * INTO rule FROM public.commission_rules
      WHERE is_active AND scope='vendor' AND scope_id = v_vendor_id
      ORDER BY priority DESC LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    SELECT * INTO rule FROM public.commission_rules
      WHERE is_active AND scope='global'
      ORDER BY priority DESC LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('amount', 0, 'rate', 0, 'type', NULL, 'rule_id', NULL);
  END IF;
  IF rule.commission_type = 'percentage' THEN
    amt := round(_line_amount * rule.commission_value / 100);
  ELSE
    amt := rule.commission_value;
  END IF;
  IF amt > _line_amount THEN amt := _line_amount; END IF;
  RETURN jsonb_build_object('amount', amt, 'rate', rule.commission_value, 'type', rule.commission_type, 'rule_id', rule.id);
END $function$;

-- 2) Auto-snapshot commission on each order line
CREATE OR REPLACE FUNCTION public.set_order_item_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE res jsonb;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  res := public.resolve_commission(NEW.product_id, NEW.subtotal);
  NEW.commission_amount := COALESCE((res->>'amount')::numeric, 0);
  NEW.commission_rate_applied := (res->>'rate')::numeric;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_set_order_item_commission ON public.order_items;
CREATE TRIGGER trg_set_order_item_commission
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_order_item_commission();

-- 3) Available balance can never be negative
CREATE OR REPLACE FUNCTION public.vendor_available_balance(_vendor_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT GREATEST(0::numeric, COALESCE((
    SELECT SUM(oi.subtotal - COALESCE(oi.commission_amount, 0))
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    LEFT JOIN public.order_shipments s ON s.id = oi.shipment_id
    WHERE oi.vendor_id = _vendor_id
      AND o.payment_status = 'paid'
      AND o.status IN ('paid','shipped','delivered','completed')
      AND (
        (oi.shipment_id IS NOT NULL AND s.customer_confirmed_at IS NOT NULL)
        OR oi.shipment_id IS NULL
      )
  ), 0) - COALESCE((
    SELECT SUM(amount_requested)
    FROM public.vendor_withdrawal_requests
    WHERE vendor_id = _vendor_id AND status IN ('pending','approved','paid')
  ), 0));
$function$;

-- 4) Backfill commissions on existing non-cancelled order items
UPDATE public.order_items oi
SET commission_amount = COALESCE((public.resolve_commission(oi.product_id, oi.subtotal)->>'amount')::numeric, 0),
    commission_rate_applied = (public.resolve_commission(oi.product_id, oi.subtotal)->>'rate')::numeric
FROM public.orders o
WHERE o.id = oi.order_id AND o.status <> 'cancelled' AND oi.product_id IS NOT NULL;
