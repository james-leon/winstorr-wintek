
-- Enums
CREATE TYPE public.return_reason AS ENUM ('defective','wrong_item','not_as_described','changed_mind','other');
CREATE TYPE public.return_status AS ENUM ('requested','under_review','approved','rejected','refunded','exchanged');
CREATE TYPE public.admin_notification_type AS ENUM ('new_order','payment_failed','return_requested','other');

-- admin_notifications
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type admin_notification_type NOT NULL,
  message text NOT NULL,
  related_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  related_return_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read notifications" ON public.admin_notifications FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff mark read" ON public.admin_notifications FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX admin_notifications_unread_idx ON public.admin_notifications (read, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;

-- return_requests
CREATE TABLE public.return_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason return_reason NOT NULL,
  description text NOT NULL,
  photo_urls jsonb DEFAULT '[]'::jsonb,
  status return_status NOT NULL DEFAULT 'requested',
  resolution_notes text,
  refund_amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.return_requests TO authenticated;
GRANT ALL ON public.return_requests TO service_role;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer read own returns" ON public.return_requests FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "customer create own returns" ON public.return_requests FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.customer_id = auth.uid()
        AND (o.status = 'delivered' OR o.payment_status = 'paid')
    )
  );
CREATE POLICY "staff update returns" ON public.return_requests FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER return_requests_updated_at BEFORE UPDATE ON public.return_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: notify staff on new paid order & payment_failed
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP='UPDATE' AND NEW.payment_status='paid' AND OLD.payment_status IS DISTINCT FROM 'paid') THEN
    INSERT INTO public.admin_notifications(type, message, related_order_id)
    VALUES ('new_order', 'Nouvelle commande payée: ' || NEW.order_number || ' — ' || NEW.total::text || ' ' || NEW.currency, NEW.id);
  END IF;
  IF (TG_OP='UPDATE' AND NEW.payment_status='failed' AND OLD.payment_status IS DISTINCT FROM 'failed') THEN
    INSERT INTO public.admin_notifications(type, message, related_order_id)
    VALUES ('payment_failed', 'Paiement échoué: ' || NEW.order_number, NEW.id);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_order_status
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();

-- Notify on new return request
CREATE OR REPLACE FUNCTION public.notify_new_return()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oname text;
BEGIN
  SELECT order_number INTO oname FROM public.orders WHERE id = NEW.order_id;
  INSERT INTO public.admin_notifications(type, message, related_order_id, related_return_id)
  VALUES ('return_requested', 'Nouvelle demande de retour pour ' || COALESCE(oname,'commande'), NEW.order_id, NEW.id);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_new_return
  AFTER INSERT ON public.return_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_return();

-- Helper RPC: get returns for an order (customer or staff)
CREATE OR REPLACE FUNCTION public.get_order_returns(_order_number text)
RETURNS SETOF public.return_requests
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.* FROM public.return_requests r
  JOIN public.orders o ON o.id = r.order_id
  WHERE o.order_number = _order_number
    AND (o.customer_id = auth.uid() OR public.is_staff(auth.uid()));
$$;
GRANT EXECUTE ON FUNCTION public.get_order_returns(text) TO authenticated;
