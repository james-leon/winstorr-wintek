
-- Enums
CREATE TYPE public.vendor_type AS ENUM ('internal','external');
CREATE TYPE public.vendor_status AS ENUM ('active','suspended','pending_approval');
CREATE TYPE public.source_type AS ENUM ('direct_import','authorized_wholesaler','other');
CREATE TYPE public.review_status AS ENUM ('published','pending','hidden');

-- Vendors
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  type public.vendor_type NOT NULL DEFAULT 'internal',
  logo_url text,
  description text,
  status public.vendor_status NOT NULL DEFAULT 'active',
  commission_rate numeric,
  contact_email text,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vendors TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active vendors" ON public.vendors
  FOR SELECT USING (status = 'active');
CREATE POLICY "Admins manage vendors" ON public.vendors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_vendors_updated BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed Wintek
INSERT INTO public.vendors (name, slug, type, status, description)
VALUES ('Wintek', 'wintek', 'internal', 'active', 'Winner Technology — vendeur officiel Winstorr');

-- Alter products: add vendor + quality + rating fields
ALTER TABLE public.products
  ADD COLUMN vendor_id uuid,
  ADD COLUMN rating_average numeric NOT NULL DEFAULT 0,
  ADD COLUMN rating_count integer NOT NULL DEFAULT 0,
  ADD COLUMN quality_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN warranty_duration text,
  ADD COLUMN source_type public.source_type;

-- Backfill vendor_id to Wintek
UPDATE public.products SET vendor_id = (SELECT id FROM public.vendors WHERE slug='wintek');

ALTER TABLE public.products
  ALTER COLUMN vendor_id SET NOT NULL,
  ADD CONSTRAINT products_vendor_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE RESTRICT;

CREATE INDEX idx_products_vendor ON public.products(vendor_id);

-- Product reviews
CREATE TABLE public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  comment text,
  verified_purchase boolean NOT NULL DEFAULT false,
  status public.review_status NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, customer_id)
);

GRANT SELECT ON public.product_reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published reviews" ON public.product_reviews
  FOR SELECT USING (status = 'published' OR customer_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "Users create own reviews" ON public.product_reviews
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid() AND rating BETWEEN 1 AND 5);

CREATE POLICY "Users update own reviews" ON public.product_reviews
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid() AND rating BETWEEN 1 AND 5);

CREATE POLICY "Users delete own reviews" ON public.product_reviews
  FOR DELETE TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Staff manage reviews" ON public.product_reviews
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX idx_reviews_product ON public.product_reviews(product_id) WHERE status='published';

CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Rating recompute
CREATE OR REPLACE FUNCTION public.recompute_product_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE pid uuid;
BEGIN
  pid := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE public.products p SET
    rating_average = COALESCE((SELECT ROUND(AVG(rating)::numeric,2) FROM public.product_reviews WHERE product_id = pid AND status='published'),0),
    rating_count = (SELECT COUNT(*) FROM public.product_reviews WHERE product_id = pid AND status='published')
  WHERE p.id = pid;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_reviews_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_product_rating();

-- add service_requests.vendor_id (denormalized for future vendor filtering)
ALTER TABLE public.service_requests ADD COLUMN vendor_id uuid REFERENCES public.vendors(id);
UPDATE public.service_requests sr SET vendor_id = p.vendor_id FROM public.products p WHERE sr.product_id = p.id;
