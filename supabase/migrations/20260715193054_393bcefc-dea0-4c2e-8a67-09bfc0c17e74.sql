
-- 1. pickup_points
CREATE TABLE public.pickup_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  contact_phone text,
  opening_hours text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pickup_points TO anon, authenticated;
GRANT ALL ON public.pickup_points TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.pickup_points TO authenticated;
ALTER TABLE public.pickup_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pickup_public_read_active" ON public.pickup_points FOR SELECT USING (is_active = true OR public.is_staff(auth.uid()));
CREATE POLICY "pickup_staff_write" ON public.pickup_points FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER pickup_points_updated_at BEFORE UPDATE ON public.pickup_points FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. payment_method enum extension
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'cash_on_pickup';

-- 3. orders columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_point_id uuid REFERENCES public.pickup_points(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'home_delivery' CHECK (delivery_mode IN ('home_delivery', 'pickup', 'none'));

-- 4. payment_confirmations audit
CREATE TABLE public.payment_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  method text NOT NULL,
  amount numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payment_confirmations TO authenticated;
GRANT ALL ON public.payment_confirmations TO service_role;
ALTER TABLE public.payment_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payconf_staff_all" ON public.payment_confirmations FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- 5. Seed payment_methods setting
INSERT INTO public.app_settings (key, value)
VALUES ('payment_methods', '{"cinetpay": false, "cash_on_pickup": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 6. confirm_cash_payment RPC
CREATE OR REPLACE FUNCTION public.confirm_cash_payment(_order_id uuid, _notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders;
  uid uuid := auth.uid();
BEGIN
  IF NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF o.payment_status = 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_paid');
  END IF;
  IF o.payment_method IS DISTINCT FROM 'cash_on_pickup' THEN
    RAISE EXCEPTION 'not_a_cash_order';
  END IF;

  -- Decrement stock for physical items
  UPDATE public.products p SET stock_quantity = GREATEST(stock_quantity - oi.quantity, 0)
    FROM public.order_items oi
    WHERE oi.order_id = _order_id AND oi.product_type = 'physical' AND p.id = oi.product_id;

  UPDATE public.orders
    SET payment_status = 'paid', status = 'paid'
    WHERE id = _order_id;

  INSERT INTO public.payment_confirmations (order_id, confirmed_by, method, amount, notes)
    VALUES (_order_id, uid, 'cash_on_pickup', o.total, _notes);

  RETURN jsonb_build_object('ok', true);
END $$;

-- 7. Extend get_order_by_number
DROP FUNCTION IF EXISTS public.get_order_by_number(text);
CREATE OR REPLACE FUNCTION public.get_order_by_number(_order_number text)
 RETURNS TABLE(id uuid, order_number text, status order_status, payment_status payment_status,
   subtotal numeric, shipping_fee numeric, discount_amount numeric, coupon_code text,
   total numeric, currency text, customer_name text, customer_email text,
   created_at timestamptz, has_physical_items boolean, shipping_address jsonb,
   payment_method payment_method, delivery_mode text,
   pickup_point_id uuid, pickup_point_name text, pickup_point_address text,
   pickup_point_city text, pickup_point_phone text, pickup_point_hours text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT o.id, o.order_number, o.status, o.payment_status, o.subtotal, o.shipping_fee,
         o.discount_amount, o.coupon_code, o.total, o.currency,
         o.customer_name, o.customer_email, o.created_at, o.has_physical_items, o.shipping_address,
         o.payment_method, o.delivery_mode,
         o.pickup_point_id, pp.name, pp.address, pp.city, pp.contact_phone, pp.opening_hours
  FROM public.orders o
  LEFT JOIN public.pickup_points pp ON pp.id = o.pickup_point_id
  WHERE o.order_number = _order_number;
$$;

-- 8. Seed one demo pickup point
INSERT INTO public.pickup_points (name, address, city, contact_phone, opening_hours, sort_order)
VALUES ('Wintek Akwa', 'Rue Joss, en face de la pharmacie du carrefour', 'Douala', '+237 6XX XX XX XX', 'Lun-Sam, 9h-18h', 1)
ON CONFLICT DO NOTHING;
