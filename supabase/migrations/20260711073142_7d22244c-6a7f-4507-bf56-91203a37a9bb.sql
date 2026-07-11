
CREATE TYPE public.product_type AS ENUM ('physical','digital','service','training');
CREATE TYPE public.product_status AS ENUM ('draft','active','archived');
CREATE TYPE public.price_type AS ENUM ('fixed','starting_at','quote_only');
CREATE TYPE public.delivery_type AS ENUM ('file_download','license_key','access_link');
CREATE TYPE public.service_area AS ENUM ('on_site','in_shop','remote','both');
CREATE TYPE public.training_mode AS ENUM ('in_person','online','hybrid');
CREATE TYPE public.training_session_status AS ENUM ('scheduled','full','cancelled','completed');
CREATE TYPE public.service_request_status AS ENUM ('received','diagnosing','quoted','accepted','in_progress','completed','cancelled');
CREATE TYPE public.training_enrollment_status AS ENUM ('pending','confirmed','cancelled');
CREATE TYPE public.app_role AS ENUM ('customer','staff','admin');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('staff','admin'));
$$;

CREATE POLICY "own_profile_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own_profile_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "own_profile_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "admin_profiles_select" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "own_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin_roles_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE has_any_admin BOOLEAN;
BEGIN
  INSERT INTO public.profiles(id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin') INTO has_any_admin;
  IF has_any_admin THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id,'customer');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id,'admin');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  product_type public.product_type NOT NULL,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  icon TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories_staff_write" ON public.categories FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.product_type NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT,
  description TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  status public.product_status NOT NULL DEFAULT 'draft',
  featured BOOLEAN NOT NULL DEFAULT false,
  price NUMERIC,
  price_type public.price_type NOT NULL DEFAULT 'fixed',
  compare_at_price NUMERIC,
  stock_quantity INT,
  sku TEXT,
  weight_kg NUMERIC,
  requires_shipping BOOLEAN DEFAULT true,
  delivery_type public.delivery_type,
  delivery_instructions TEXT,
  service_area public.service_area,
  estimated_duration TEXT,
  requires_diagnostic BOOLEAN DEFAULT false,
  delivery_mode public.training_mode,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_type_status ON public.products(type, status);
CREATE INDEX idx_products_category ON public.products(category_id);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_public_active" ON public.products FOR SELECT USING (status = 'active');
CREATE POLICY "products_staff_read_all" ON public.products FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "products_staff_write" ON public.products FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  capacity INT NOT NULL DEFAULT 0,
  seats_taken INT NOT NULL DEFAULT 0,
  price_override NUMERIC,
  status public.training_session_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_product ON public.training_sessions(product_id);
GRANT SELECT ON public.training_sessions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.training_sessions TO authenticated;
GRANT ALL ON public.training_sessions TO service_role;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_public_read" ON public.training_sessions FOR SELECT
  USING (status IN ('scheduled','full'));
CREATE POLICY "sessions_staff_read_all" ON public.training_sessions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "sessions_staff_write" ON public.training_sessions FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_sessions_updated BEFORE UPDATE ON public.training_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  description TEXT NOT NULL,
  photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_date DATE,
  status public.service_request_status NOT NULL DEFAULT 'received',
  quoted_price NUMERIC,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.service_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.service_requests TO authenticated;
GRANT ALL ON public.service_requests TO service_role;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requests_public_insert" ON public.service_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "requests_staff_read" ON public.service_requests FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "requests_staff_update" ON public.service_requests FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON public.service_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.training_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  status public.training_enrollment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.training_enrollments TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.training_enrollments TO authenticated;
GRANT ALL ON public.training_enrollments TO service_role;
ALTER TABLE public.training_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrollments_public_insert" ON public.training_enrollments FOR INSERT WITH CHECK (true);
CREATE POLICY "enrollments_staff_read" ON public.training_enrollments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "enrollments_staff_update" ON public.training_enrollments FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
