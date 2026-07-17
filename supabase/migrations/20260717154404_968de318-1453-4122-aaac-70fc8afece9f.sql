
-- 1. Columns
ALTER TABLE public.order_shipments
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS customer_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_shipments_pending_confirm
  ON public.order_shipments (confirmation_deadline)
  WHERE status = 'delivered' AND customer_confirmed_at IS NULL;

-- 2. Trigger: on status → delivered
CREATE OR REPLACE FUNCTION public.on_shipment_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ord public.orders;
BEGIN
  IF NEW.status = 'delivered'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'delivered') THEN
    IF NEW.delivered_at IS NULL THEN
      NEW.delivered_at := now();
    END IF;
    IF NEW.confirmation_deadline IS NULL THEN
      NEW.confirmation_deadline := NEW.delivered_at + interval '5 days';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shipment_delivered ON public.order_shipments;
CREATE TRIGGER trg_shipment_delivered
  BEFORE INSERT OR UPDATE ON public.order_shipments
  FOR EACH ROW EXECUTE FUNCTION public.on_shipment_delivered();

CREATE OR REPLACE FUNCTION public.notify_shipment_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ord public.orders;
BEGIN
  IF NEW.status = 'delivered'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'delivered') THEN
    SELECT * INTO ord FROM public.orders WHERE id = NEW.order_id;
    INSERT INTO public.admin_notifications(type, message, related_order_id)
    VALUES ('other',
      'Expédition ' || NEW.shipment_number || ' livrée — en attente de confirmation client (commande ' || COALESCE(ord.order_number,'') || ')',
      NEW.order_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shipment_delivered_notify ON public.order_shipments;
CREATE TRIGGER trg_shipment_delivered_notify
  AFTER INSERT OR UPDATE ON public.order_shipments
  FOR EACH ROW EXECUTE FUNCTION public.notify_shipment_delivered();

-- 3. Customer confirm RPC
CREATE OR REPLACE FUNCTION public.customer_confirm_shipment(_shipment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE s public.order_shipments; o public.orders;
BEGIN
  SELECT * INTO s FROM public.order_shipments WHERE id = _shipment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  SELECT * INTO o FROM public.orders WHERE id = s.order_id;

  IF NOT (public.is_staff(auth.uid()) OR o.customer_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF s.status <> 'delivered' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_delivered');
  END IF;

  IF s.customer_confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_confirmed');
  END IF;

  UPDATE public.order_shipments
    SET customer_confirmed_at = now(),
        auto_confirmed = false,
        status = 'completed'
    WHERE id = _shipment_id;

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.customer_confirm_shipment(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.customer_confirm_shipment(uuid) FROM anon, public;

-- 4. Auto-confirm job
CREATE OR REPLACE FUNCTION public.auto_confirm_delivered_shipments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c integer;
BEGIN
  WITH upd AS (
    UPDATE public.order_shipments
      SET customer_confirmed_at = now(),
          auto_confirmed = true,
          status = 'completed'
      WHERE status = 'delivered'
        AND customer_confirmed_at IS NULL
        AND confirmation_deadline IS NOT NULL
        AND confirmation_deadline < now()
      RETURNING 1
  )
  SELECT count(*) INTO c FROM upd;
  RETURN c;
END $$;

-- 5. Reminder job (one-shot, ~24h before deadline)
CREATE OR REPLACE FUNCTION public.send_delivery_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; c integer := 0;
BEGIN
  FOR r IN
    SELECT s.id, s.shipment_number, s.order_id, o.order_number
    FROM public.order_shipments s
    JOIN public.orders o ON o.id = s.order_id
    WHERE s.status = 'delivered'
      AND s.customer_confirmed_at IS NULL
      AND s.reminder_sent_at IS NULL
      AND s.confirmation_deadline IS NOT NULL
      AND s.confirmation_deadline < now() + interval '24 hours'
      AND s.confirmation_deadline > now()
  LOOP
    INSERT INTO public.admin_notifications(type, message, related_order_id)
    VALUES ('other',
      'Rappel — 24h restantes pour confirmer la réception de la commande ' || r.order_number || ' (expédition ' || r.shipment_number || ')',
      r.order_id);
    UPDATE public.order_shipments SET reminder_sent_at = now() WHERE id = r.id;
    c := c + 1;
  END LOOP;
  RETURN c;
END $$;

-- 6. Update vendor balance to require customer confirmation
CREATE OR REPLACE FUNCTION public.vendor_available_balance(_vendor_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT SUM(oi.subtotal - COALESCE(oi.commission_amount, 0))
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    LEFT JOIN public.order_shipments s ON s.id = oi.shipment_id
    WHERE oi.vendor_id = _vendor_id
      AND o.payment_status = 'paid'
      AND o.status IN ('paid','shipped','delivered','completed')
      AND (
        -- Physical items require customer confirmation on the shipment
        (oi.shipment_id IS NOT NULL AND s.customer_confirmed_at IS NOT NULL)
        -- Non-shipment items (digital/services/training) unlock on payment
        OR oi.shipment_id IS NULL
      )
  ), 0) - COALESCE((
    SELECT SUM(amount_requested)
    FROM public.vendor_withdrawal_requests
    WHERE vendor_id = _vendor_id AND status IN ('pending','approved','paid')
  ), 0);
$$;

-- 7. Pending-confirmation amount for vendor visibility
CREATE OR REPLACE FUNCTION public.vendor_pending_confirmation_amount(_vendor_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(oi.subtotal - COALESCE(oi.commission_amount, 0)), 0)
  FROM public.order_items oi
  JOIN public.order_shipments s ON s.id = oi.shipment_id
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.vendor_id = _vendor_id
    AND o.payment_status = 'paid'
    AND s.status = 'delivered'
    AND s.customer_confirmed_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_pending_confirmation_amount(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.vendor_pending_confirmation_amount(uuid) FROM anon, public;
