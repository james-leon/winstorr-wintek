-- Backfill: create missing shipments for pending cash-on-pickup orders (non-cancelled)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT o.id FROM public.orders o
    WHERE o.payment_method = 'cash_on_pickup'
      AND o.status <> 'cancelled'
      AND EXISTS (SELECT 1 FROM public.order_items i WHERE i.order_id = o.id AND i.vendor_id IS NOT NULL AND i.shipment_id IS NULL)
  LOOP
    PERFORM public.generate_shipments_for_order(r.id);
  END LOOP;
END $$;
