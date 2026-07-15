
CREATE TYPE public.homepage_banner_type AS ENUM ('hero_slide', 'promo_tile', 'category_tile');

CREATE TABLE public.homepage_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.homepage_banner_type NOT NULL,
  title text NOT NULL,
  subtitle text,
  image_url text,
  cta_label text,
  link_url text,
  background_color text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_homepage_banners_type_order ON public.homepage_banners (type, display_order) WHERE is_active;

GRANT SELECT ON public.homepage_banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.homepage_banners TO authenticated;
GRANT ALL ON public.homepage_banners TO service_role;

ALTER TABLE public.homepage_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active banners in window" ON public.homepage_banners
  FOR SELECT USING (
    is_active
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

CREATE POLICY "Staff can read all banners" ON public.homepage_banners
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert banners" ON public.homepage_banners
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update banners" ON public.homepage_banners
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete banners" ON public.homepage_banners
  FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_homepage_banners_updated_at
  BEFORE UPDATE ON public.homepage_banners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
