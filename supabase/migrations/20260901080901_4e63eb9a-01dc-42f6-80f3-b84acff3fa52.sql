
CREATE TABLE public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL DEFAULT 'Douala',
  fee numeric NOT NULL DEFAULT 0,
  quartiers text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.delivery_zones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_zones TO authenticated;
GRANT ALL ON public.delivery_zones TO service_role;

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_zones_public_read" ON public.delivery_zones
  FOR SELECT USING (is_active = true OR public.is_staff(auth.uid()));

CREATE POLICY "delivery_zones_staff_manage" ON public.delivery_zones
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER delivery_zones_set_updated_at
  BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.delivery_zones (name, fee, sort_order, quartiers) VALUES
  ('Zone 1', 1000, 1, ARRAY['Yassa','Ndokoti','Japoma','Bessengue','Ndogpassi','Dakar','Brazzaville','Terminus St Michel','Aéroport','Nyalla','Logbaba','Dibamba']),
  ('Zone 2', 1500, 2, ARRAY['Bépanda','Makepe','Ndogbong','Missoke','Deido','Akwa','Bonamoussadi','Mboppi','Cité SIC','Bali','Bonanjo','Logpom','Kotto','Youpwe','Bonapriso']),
  ('Zone 3', 2000, 3, ARRAY['Bonabérie','Lendi','Logbessou','Palmiers','Bangapongo','Bloc 9-11','Pk 12-14']),
  ('Zone 4', 2500, 4, ARRAY['Ndobo','Bekoko','Bomono','Bojongo','Bowadibo','Pk 15-21']);

INSERT INTO public.app_settings (key, value) VALUES (
  'home_delivery',
  jsonb_build_object(
    'enabled', true,
    'courier_name', 'Intello Express',
    'delay_text', 'sous 24-48h',
    'free_shipping_threshold', null,
    'note', 'Tarifs valables si le lieu est en bordure d''une route principale/secondaire.'
  )
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier text,
  ADD COLUMN IF NOT EXISTS delivery_zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS courier_collected_amount numeric,
  ADD COLUMN IF NOT EXISTS courier_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS courier_remitted_at timestamptz;

CREATE OR REPLACE FUNCTION public.confirm_courier_delivery(_order_id uuid, _notes text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE o public.orders; uid uuid := auth.uid();
BEGIN
  IF NOT public.is_staff(uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF o.delivery_mode IS DISTINCT FROM 'home_delivery' THEN RAISE EXCEPTION 'not_a_home_delivery_order'; END IF;

  IF o.payment_status <> 'paid' THEN
    UPDATE public.product_variants v
      SET stock_quantity = GREATEST(stock_quantity - oi.quantity, 0)
      FROM public.order_items oi
      WHERE oi.order_id = _order_id AND oi.product_type = 'physical'
        AND oi.variant_id IS NOT NULL AND v.id = oi.variant_id;

    UPDATE public.products p
      SET stock_quantity = GREATEST(stock_quantity - oi.quantity, 0)
      FROM public.order_items oi
      WHERE oi.order_id = _order_id AND oi.product_type = 'physical'
        AND oi.variant_id IS NULL AND p.id = oi.product_id;

    INSERT INTO public.payment_confirmations (order_id, confirmed_by, method, amount, notes)
      VALUES (_order_id, uid, 'courier_cod', o.total, _notes);
  END IF;

  UPDATE public.orders
    SET payment_status = 'paid',
        status = 'delivered',
        courier_collected_amount = COALESCE(courier_collected_amount, o.total),
        courier_collected_at = COALESCE(courier_collected_at, now())
    WHERE id = _order_id;

  -- Delivery confirmed by the courier == reception confirmed: release escrow.
  UPDATE public.order_shipments
    SET status = 'completed',
        delivered_at = COALESCE(delivered_at, now()),
        customer_confirmed_at = COALESCE(customer_confirmed_at, now()),
        auto_confirmed = false
    WHERE order_id = _order_id
      AND acceptance_status <> 'refused'
      AND status <> 'cancelled';

  RETURN jsonb_build_object('ok', true);
END $function$;

CREATE OR REPLACE FUNCTION public.mark_courier_remitted(_order_id uuid, _remitted boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF NOT public.is_staff(uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.orders
    SET courier_remitted_at = CASE WHEN _remitted THEN now() ELSE NULL END
    WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  RETURN jsonb_build_object('ok', true);
END $function$;
