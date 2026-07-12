
CREATE TABLE public.product_price_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  min_quantity integer NOT NULL CHECK (min_quantity >= 1),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, min_quantity)
);

CREATE INDEX product_price_tiers_product_idx ON public.product_price_tiers(product_id, min_quantity DESC);

GRANT SELECT ON public.product_price_tiers TO anon, authenticated;
GRANT ALL ON public.product_price_tiers TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.product_price_tiers TO authenticated;

ALTER TABLE public.product_price_tiers ENABLE ROW LEVEL SECURITY;

-- Public can read tiers for active products
CREATE POLICY "Public read tiers" ON public.product_price_tiers
  FOR SELECT USING (true);

-- Staff can manage all tiers
CREATE POLICY "Staff manage tiers" ON public.product_price_tiers
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Vendor members can manage tiers for their own products
CREATE POLICY "Vendor manage own tiers" ON public.product_price_tiers
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_price_tiers.product_id
      AND public.is_vendor_member(p.vendor_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_price_tiers.product_id
      AND public.is_vendor_member(p.vendor_id, auth.uid())
  ));

CREATE TRIGGER product_price_tiers_updated_at
  BEFORE UPDATE ON public.product_price_tiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: resolve unit price for a product at a given quantity, falling back to products.price
CREATE OR REPLACE FUNCTION public.get_tier_unit_price(_product_id uuid, _quantity integer)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT unit_price FROM public.product_price_tiers
      WHERE product_id = _product_id AND min_quantity <= _quantity
      ORDER BY min_quantity DESC LIMIT 1),
    (SELECT price FROM public.products WHERE id = _product_id)
  );
$$;
