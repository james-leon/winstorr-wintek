
CREATE TABLE public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  city text NOT NULL,
  quartier text NOT NULL,
  landmark_description text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers manage own addresses" ON public.customer_addresses
  FOR ALL TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Staff read all addresses" ON public.customer_addresses
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE UNIQUE INDEX customer_addresses_one_default
  ON public.customer_addresses (customer_id)
  WHERE is_default;
CREATE INDEX customer_addresses_customer_idx
  ON public.customer_addresses (customer_id, created_at DESC);

CREATE TRIGGER customer_addresses_set_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.customer_addresses_unset_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.customer_addresses
      SET is_default = false
      WHERE customer_id = NEW.customer_id
        AND id <> NEW.id
        AND is_default = true;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER customer_addresses_default_trg
  AFTER INSERT OR UPDATE OF is_default ON public.customer_addresses
  FOR EACH ROW WHEN (NEW.is_default)
  EXECUTE FUNCTION public.customer_addresses_unset_default();

CREATE TABLE public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO authenticated;
GRANT ALL ON public.wishlist_items TO service_role;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers manage own wishlist" ON public.wishlist_items
  FOR ALL TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Staff read all wishlists" ON public.wishlist_items
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX wishlist_items_customer_idx
  ON public.wishlist_items (customer_id, created_at DESC);
