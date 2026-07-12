
-- Enums
CREATE TYPE public.order_status AS ENUM ('pending_payment','paid','processing','shipped','delivered','completed','cancelled','payment_failed');
CREATE TYPE public.payment_status AS ENUM ('pending','paid','failed','refunded');
CREATE TYPE public.payment_method AS ENUM ('mtn_momo','orange_money','card');

-- Order number sequence
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n bigint;
BEGIN
  n := nextval('public.order_number_seq');
  RETURN 'WST-' || to_char(now(),'YYYY') || '-' || lpad(n::text, 5, '0');
END; $$;

-- orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT public.generate_order_number(),
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  status order_status NOT NULL DEFAULT 'pending_payment',
  subtotal numeric NOT NULL DEFAULT 0,
  shipping_fee numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XAF',
  payment_method payment_method,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  cinetpay_transaction_id text,
  shipping_address jsonb,
  has_physical_items boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_own_select ON public.orders FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY orders_staff_update ON public.orders FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- order_items
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_type text NOT NULL,
  product_name text NOT NULL,
  product_slug text,
  product_image text,
  unit_price numeric NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  subtotal numeric NOT NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_items_own_select ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.customer_id = auth.uid() OR public.is_staff(auth.uid()))));

-- app_settings
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_settings_public_read ON public.app_settings FOR SELECT USING (true);
CREATE POLICY app_settings_staff_write ON public.app_settings FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

INSERT INTO public.app_settings(key,value) VALUES
  ('shipping_fees', '{"douala":2000,"yaounde":2500,"autre":3500}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Guest lookup by order_number: allow anon read of minimal fields via SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.get_order_by_number(_order_number text)
RETURNS TABLE(
  id uuid, order_number text, status order_status, payment_status payment_status,
  total numeric, currency text, customer_name text, customer_email text,
  created_at timestamptz, has_physical_items boolean, shipping_address jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id, order_number, status, payment_status, total, currency,
         customer_name, customer_email, created_at, has_physical_items, shipping_address
  FROM public.orders WHERE order_number = _order_number;
$$;
GRANT EXECUTE ON FUNCTION public.get_order_by_number(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_order_items_by_number(_order_number text)
RETURNS TABLE(
  id uuid, product_id uuid, product_type text, product_name text,
  product_slug text, product_image text, unit_price numeric, quantity integer, subtotal numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT oi.id, oi.product_id, oi.product_type, oi.product_name,
         oi.product_slug, oi.product_image, oi.unit_price, oi.quantity, oi.subtotal
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.order_number = _order_number;
$$;
GRANT EXECUTE ON FUNCTION public.get_order_items_by_number(text) TO anon, authenticated;

-- Decrement stock atomically upon payment confirmation
CREATE OR REPLACE FUNCTION public.confirm_order_payment(_order_id uuid, _txn_id text, _method payment_method)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  it record; insufficient boolean := false; missing_name text;
BEGIN
  -- Check stock for physical items
  FOR it IN
    SELECT oi.product_id, oi.quantity, oi.product_name, p.stock_quantity, p.type
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = _order_id AND oi.product_type = 'physical'
  LOOP
    IF it.stock_quantity IS NULL OR it.stock_quantity < it.quantity THEN
      insufficient := true; missing_name := it.product_name; EXIT;
    END IF;
  END LOOP;

  IF insufficient THEN
    UPDATE public.orders SET status='payment_failed', payment_status='failed',
      cinetpay_transaction_id=_txn_id, payment_method=_method,
      notes = COALESCE(notes,'') || E'\nStock insuffisant: ' || missing_name
      WHERE id = _order_id;
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_stock', 'product', missing_name);
  END IF;

  -- Decrement stock
  UPDATE public.products p SET stock_quantity = stock_quantity - oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = _order_id AND oi.product_type='physical' AND p.id = oi.product_id;

  UPDATE public.orders SET status='paid', payment_status='paid',
    cinetpay_transaction_id=_txn_id, payment_method=_method
    WHERE id = _order_id;

  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE ALL ON FUNCTION public.confirm_order_payment(uuid, text, payment_method) FROM PUBLIC, anon, authenticated;
