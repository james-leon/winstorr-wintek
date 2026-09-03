CREATE TYPE public.payment_environment AS ENUM ('test', 'production');

CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  display_name_en text,
  is_enabled boolean NOT NULL DEFAULT true,
  supports_environment boolean NOT NULL DEFAULT false,
  environment public.payment_environment NOT NULL DEFAULT 'test',
  applies_to_product_types jsonb NOT NULL DEFAULT '["physical","digital","service","training"]'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  config_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_methods TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payment methods are viewable by everyone"
  ON public.payment_methods FOR SELECT
  USING (true);

CREATE POLICY "Staff manage payment methods"
  ON public.payment_methods FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER payment_methods_set_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.payment_methods
  (provider_key, display_name, display_name_en, is_enabled, supports_environment, environment, applies_to_product_types, display_order, config_note)
VALUES
  ('campay', 'Mobile Money & Carte (Campay)', 'Mobile Money & Card (Campay)', true, true, 'test', '["physical","digital","service","training"]'::jsonb, 1, 'Clés dans les secrets serveur (CAMPAY_*)'),
  ('cash_on_delivery', 'Paiement à la livraison', 'Pay on delivery', true, false, 'test', '["physical"]'::jsonb, 2, NULL),
  ('pickup_payment', 'Paiement au point de retrait', 'Pay at pickup point', true, false, 'test', '["physical"]'::jsonb, 3, NULL);