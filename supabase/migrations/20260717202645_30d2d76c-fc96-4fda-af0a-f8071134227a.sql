
-- ============ product_variants ============
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  price numeric,
  compare_at_price numeric,
  stock_quantity integer NOT NULL DEFAULT 0,
  image_url text,
  min_order_quantity integer,
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_variants_product_id_idx ON public.product_variants(product_id);
CREATE UNIQUE INDEX product_variants_sku_unique ON public.product_variants(sku) WHERE sku IS NOT NULL AND length(trim(sku)) > 0;
CREATE UNIQUE INDEX product_variants_attributes_unique ON public.product_variants(product_id, attributes);

GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active variants of visible products"
  ON public.product_variants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id AND p.status = 'active'
    )
    OR public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.vendor_members vm ON vm.vendor_id = p.vendor_id
      WHERE p.id = product_variants.product_id AND vm.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff and vendor members manage variants"
  ON public.product_variants FOR ALL
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.vendor_members vm ON vm.vendor_id = p.vendor_id
      WHERE p.id = product_variants.product_id AND vm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.vendor_members vm ON vm.vendor_id = p.vendor_id
      WHERE p.id = product_variants.product_id AND vm.user_id = auth.uid()
    )
  );

CREATE TRIGGER product_variants_set_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ products.has_variants ============
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS has_variants boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.sync_product_has_variants()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pid uuid;
BEGIN
  pid := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE public.products SET has_variants =
    EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = pid AND status = 'active')
  WHERE id = pid;
  RETURN NULL;
END $$;

CREATE TRIGGER product_variants_sync_flag
  AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_has_variants();

-- ============ product_price_tiers.variant_id ============
ALTER TABLE public.product_price_tiers ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS product_price_tiers_variant_id_idx ON public.product_price_tiers(variant_id);

-- ============ order_items.variant_id + snapshot ============
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_attributes jsonb;

-- ============ Updated get_tier_unit_price (variant-aware) ============
CREATE OR REPLACE FUNCTION public.get_tier_unit_price(_product_id uuid, _quantity integer, _variant_id uuid DEFAULT NULL)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(
    -- Variant-scoped tier (if variant given)
    (SELECT unit_price FROM public.product_price_tiers
      WHERE product_id = _product_id AND variant_id = _variant_id AND _variant_id IS NOT NULL
        AND min_quantity <= _quantity
      ORDER BY min_quantity DESC LIMIT 1),
    -- Variant's own flat price if a variant was requested
    (SELECT price FROM public.product_variants
      WHERE _variant_id IS NOT NULL AND id = _variant_id AND price IS NOT NULL),
    -- Product-level tier (only for non-variant products)
    (SELECT unit_price FROM public.product_price_tiers
      WHERE product_id = _product_id AND variant_id IS NULL
        AND _variant_id IS NULL
        AND min_quantity <= _quantity
      ORDER BY min_quantity DESC LIMIT 1),
    -- Product base price fallback
    (SELECT price FROM public.products WHERE id = _product_id)
  );
$$;

-- ============ Updated confirm_order_payment (variant stock aware) ============
CREATE OR REPLACE FUNCTION public.confirm_order_payment(_order_id uuid, _txn_id text, _method payment_method)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  it record; insufficient boolean := false; missing_name text;
BEGIN
  FOR it IN
    SELECT oi.product_id, oi.variant_id, oi.quantity, oi.product_name,
           COALESCE(v.stock_quantity, p.stock_quantity) AS avail_stock,
           p.type
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    LEFT JOIN public.product_variants v ON v.id = oi.variant_id
    WHERE oi.order_id = _order_id AND oi.product_type = 'physical'
  LOOP
    IF it.avail_stock IS NULL OR it.avail_stock < it.quantity THEN
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

  -- Decrement variant stock for lines with variant_id
  UPDATE public.product_variants v
    SET stock_quantity = stock_quantity - oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = _order_id AND oi.product_type='physical'
      AND oi.variant_id IS NOT NULL AND v.id = oi.variant_id;

  -- Decrement product stock for lines WITHOUT a variant
  UPDATE public.products p
    SET stock_quantity = stock_quantity - oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = _order_id AND oi.product_type='physical'
      AND oi.variant_id IS NULL AND p.id = oi.product_id;

  UPDATE public.orders SET status='paid', payment_status='paid',
    cinetpay_transaction_id=_txn_id, payment_method=_method
    WHERE id = _order_id;

  RETURN jsonb_build_object('ok', true);
END $$;

-- Same update for confirm_cash_payment (variant-aware stock decrement)
CREATE OR REPLACE FUNCTION public.confirm_cash_payment(_order_id uuid, _notes text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o public.orders; uid uuid := auth.uid();
BEGIN
  IF NOT public.is_staff(uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF o.payment_status = 'paid' THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_paid'); END IF;
  IF o.payment_method IS DISTINCT FROM 'cash_on_pickup' THEN RAISE EXCEPTION 'not_a_cash_order'; END IF;

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

  UPDATE public.orders SET payment_status = 'paid', status = 'paid' WHERE id = _order_id;

  INSERT INTO public.payment_confirmations (order_id, confirmed_by, method, amount, notes)
    VALUES (_order_id, uid, 'cash_on_pickup', o.total, _notes);

  RETURN jsonb_build_object('ok', true);
END $$;
