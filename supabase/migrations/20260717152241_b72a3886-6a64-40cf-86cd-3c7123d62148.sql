
-- Enums
CREATE TYPE public.shipment_status AS ENUM (
  'pending_acceptance','accepted','refused',
  'pending_pickup','ready_for_pickup','shipped','delivered','completed','cancelled'
);
CREATE TYPE public.shipment_acceptance_status AS ENUM ('pending_acceptance','accepted','refused');
CREATE TYPE public.shipment_refusal_reason AS ENUM (
  'rupture_stock','produit_endommage','prix_incorrect','autre','delai_depasse'
);

-- Table
CREATE TABLE public.order_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  shipment_number text UNIQUE,
  status public.shipment_status NOT NULL DEFAULT 'pending_acceptance',
  acceptance_status public.shipment_acceptance_status NOT NULL DEFAULT 'pending_acceptance',
  acceptance_deadline timestamptz,
  accepted_at timestamptz,
  refused_at timestamptz,
  refusal_reason public.shipment_refusal_reason,
  refusal_notes text,
  delivery_mode text,
  pickup_point_id uuid REFERENCES public.pickup_points(id),
  subtotal numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XOF',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shipments_vendor ON public.order_shipments(vendor_id, acceptance_status);
CREATE INDEX idx_shipments_order ON public.order_shipments(order_id);
CREATE INDEX idx_shipments_pending_deadline ON public.order_shipments(acceptance_deadline)
  WHERE acceptance_status='pending_acceptance';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_shipments TO authenticated;
GRANT ALL ON public.order_shipments TO service_role;

ALTER TABLE public.order_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY shipments_staff_all ON public.order_shipments FOR ALL
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY shipments_vendor_read ON public.order_shipments FOR SELECT
  USING (public.is_vendor_member(vendor_id, auth.uid()));
CREATE POLICY shipments_customer_read ON public.order_shipments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid()));

CREATE TRIGGER trg_shipments_updated_at BEFORE UPDATE ON public.order_shipments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link order_items to a shipment
ALTER TABLE public.order_items
  ADD COLUMN shipment_id uuid REFERENCES public.order_shipments(id) ON DELETE SET NULL;
CREATE INDEX idx_order_items_shipment ON public.order_items(shipment_id);

-- Shipment number generator
CREATE SEQUENCE IF NOT EXISTS public.shipment_number_seq;
CREATE OR REPLACE FUNCTION public.generate_shipment_number()
RETURNS text LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n bigint;
BEGIN
  n := nextval('public.shipment_number_seq');
  RETURN 'WST-SHP-' || to_char(now(),'YYYY') || '-' || lpad(n::text,5,'0');
END $$;

-- Create shipments for an order (idempotent — skips items already linked)
CREATE OR REPLACE FUNCTION public.generate_shipments_for_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; sid uuid; o public.orders;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id=_order_id;
  IF NOT FOUND THEN RETURN; END IF;

  FOR r IN
    SELECT vendor_id, SUM(subtotal)::numeric AS subtotal
    FROM public.order_items
    WHERE order_id=_order_id AND vendor_id IS NOT NULL AND shipment_id IS NULL
    GROUP BY vendor_id
  LOOP
    INSERT INTO public.order_shipments
      (order_id, vendor_id, shipment_number, acceptance_deadline,
       delivery_mode, pickup_point_id, subtotal, currency,
       status, acceptance_status)
    VALUES
      (_order_id, r.vendor_id, public.generate_shipment_number(), now() + interval '24 hours',
       o.delivery_mode, o.pickup_point_id, r.subtotal, o.currency,
       'pending_acceptance', 'pending_acceptance')
    RETURNING id INTO sid;

    UPDATE public.order_items
      SET shipment_id = sid
      WHERE order_id = _order_id AND vendor_id = r.vendor_id AND shipment_id IS NULL;

    INSERT INTO public.admin_notifications(type, message, related_order_id)
    VALUES ('other',
      'Nouvelle expédition à confirmer sous 24h — commande ' || o.order_number,
      _order_id);
  END LOOP;
END $$;

-- Trigger on payment_status = paid
CREATE OR REPLACE FUNCTION public.on_order_paid_create_shipments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.payment_status='paid'
     AND (TG_OP='INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
    PERFORM public.generate_shipments_for_order(NEW.id);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_orders_paid_shipments
  AFTER UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_paid_create_shipments();

CREATE TRIGGER trg_orders_insert_shipments
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_paid_create_shipments();

-- Vendor accept
CREATE OR REPLACE FUNCTION public.vendor_accept_shipment(_shipment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.order_shipments;
BEGIN
  SELECT * INTO s FROM public.order_shipments WHERE id=_shipment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT (public.is_staff(auth.uid()) OR public.is_vendor_member(s.vendor_id, auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF s.acceptance_status <> 'pending_acceptance' THEN
    RETURN jsonb_build_object('ok', false, 'reason','not_pending');
  END IF;
  UPDATE public.order_shipments
    SET acceptance_status='accepted', accepted_at=now(), status='pending_pickup'
    WHERE id=_shipment_id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- Core refuse (with system flag)
CREATE OR REPLACE FUNCTION public.refuse_shipment(
  _shipment_id uuid,
  _reason public.shipment_refusal_reason,
  _notes text,
  _system boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  s public.order_shipments;
  o public.orders;
  rid uuid;
  item_id uuid;
  mapped_reason public.return_reason;
BEGIN
  SELECT * INTO s FROM public.order_shipments WHERE id=_shipment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  IF NOT _system
     AND NOT (public.is_staff(auth.uid()) OR public.is_vendor_member(s.vendor_id, auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF s.acceptance_status <> 'pending_acceptance' THEN
    RETURN jsonb_build_object('ok', false, 'reason','not_pending');
  END IF;

  UPDATE public.order_shipments
    SET acceptance_status='refused',
        refused_at=now(),
        refusal_reason=_reason,
        refusal_notes=_notes,
        status='cancelled'
    WHERE id=_shipment_id;

  SELECT * INTO o FROM public.orders WHERE id=s.order_id;

  -- Restock physical items in this shipment
  UPDATE public.products p
    SET stock_quantity = stock_quantity + oi.quantity
    FROM public.order_items oi
    WHERE oi.shipment_id=_shipment_id
      AND oi.product_type='physical'
      AND p.id=oi.product_id;

  SELECT id INTO item_id FROM public.order_items WHERE shipment_id=_shipment_id LIMIT 1;

  mapped_reason := CASE _reason
    WHEN 'rupture_stock'    THEN 'wrong_item'::public.return_reason
    WHEN 'produit_endommage' THEN 'defective'::public.return_reason
    WHEN 'prix_incorrect'   THEN 'not_as_described'::public.return_reason
    ELSE 'other'::public.return_reason
  END;

  INSERT INTO public.return_requests(
    order_id, order_item_id, customer_id,
    reason, description, status, refund_amount, resolution_notes
  ) VALUES (
    s.order_id, item_id, o.customer_id,
    mapped_reason,
    'Annulation pré-fulfillment (expédition ' || s.shipment_number ||
      ') — motif: ' || _reason::text ||
      COALESCE(' — ' || _notes, ''),
    'approved'::public.return_status,
    s.subtotal,
    'Remboursement à traiter manuellement (' ||
      CASE WHEN _system THEN 'auto-refus après 24h sans réponse vendeur'
           ELSE 'refus explicite du vendeur' END || ').'
  ) RETURNING id INTO rid;

  INSERT INTO public.admin_notifications(type, message, related_order_id, related_return_id)
  VALUES ('return_requested',
    'Remboursement à traiter — expédition ' || s.shipment_number ||
      ' refusée (' || _reason::text || ')',
    s.order_id, rid);

  RETURN jsonb_build_object('ok', true, 'return_id', rid);
END $$;

-- Vendor-callable wrapper
CREATE OR REPLACE FUNCTION public.vendor_refuse_shipment(
  _shipment_id uuid,
  _reason public.shipment_refusal_reason,
  _notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF _reason = 'delai_depasse' THEN
    RAISE EXCEPTION 'reason_reserved_for_system';
  END IF;
  RETURN public.refuse_shipment(_shipment_id, _reason, _notes, false);
END $$;

-- Auto-refuse expired
CREATE OR REPLACE FUNCTION public.auto_refuse_expired_shipments()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; c integer := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.order_shipments
    WHERE acceptance_status='pending_acceptance'
      AND acceptance_deadline < now()
  LOOP
    PERFORM public.refuse_shipment(r.id, 'delai_depasse'::public.shipment_refusal_reason, NULL, true);
    c := c + 1;
  END LOOP;
  RETURN c;
END $$;

-- Permissions on sensitive functions
REVOKE ALL ON FUNCTION public.refuse_shipment(uuid, public.shipment_refusal_reason, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_refuse_expired_shipments() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_shipments_for_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_accept_shipment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_refuse_shipment(uuid, public.shipment_refusal_reason, text) TO authenticated;

-- Backfill: create shipments for already-paid orders that don't yet have them
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT o.id
    FROM public.orders o
    WHERE o.payment_status='paid'
      AND NOT EXISTS (SELECT 1 FROM public.order_shipments s WHERE s.order_id=o.id)
  LOOP
    PERFORM public.generate_shipments_for_order(r.id);
  END LOOP;
END $$;

-- Auto-accept backfilled shipments so historical paid orders don't get auto-refused
UPDATE public.order_shipments
  SET acceptance_status='accepted', accepted_at=now(), status='pending_pickup'
  WHERE acceptance_status='pending_acceptance'
    AND created_at < now() - interval '1 minute';

-- Schedule hourly auto-refuse (pg_cron)
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='auto-refuse-expired-shipments') THEN
    PERFORM cron.unschedule('auto-refuse-expired-shipments');
  END IF;
  PERFORM cron.schedule(
    'auto-refuse-expired-shipments',
    '0 * * * *',
    $cron$ SELECT public.auto_refuse_expired_shipments(); $cron$
  );
END $$;
