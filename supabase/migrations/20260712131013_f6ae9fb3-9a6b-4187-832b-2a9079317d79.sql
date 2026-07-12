
-- Enums
CREATE TYPE public.coupon_discount_type AS ENUM ('percentage', 'fixed_amount');
CREATE TYPE public.coupon_applies_to AS ENUM ('all_products', 'specific_products', 'specific_category', 'specific_vendor');
CREATE TYPE public.coupon_status AS ENUM ('active', 'paused', 'expired');

-- Coupons table
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type public.coupon_discount_type NOT NULL,
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  applies_to public.coupon_applies_to NOT NULL DEFAULT 'all_products',
  applies_to_ids uuid[],
  min_order_amount numeric,
  max_discount_amount numeric,
  usage_limit_total integer,
  usage_limit_per_customer integer DEFAULT 1,
  current_usage_count integer NOT NULL DEFAULT 0,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  status public.coupon_status NOT NULL DEFAULT 'active',
  excludes_sale_items boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uppercase code enforcement
CREATE OR REPLACE FUNCTION public.uppercase_coupon_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.code := upper(NEW.code); RETURN NEW; END; $$;

CREATE TRIGGER coupons_uppercase_code
BEFORE INSERT OR UPDATE OF code ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.uppercase_coupon_code();

CREATE TRIGGER coupons_set_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Only staff can manage coupons
CREATE POLICY "Staff manage coupons" ON public.coupons FOR ALL
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Redemptions
CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_email text,
  discount_applied numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coupon_redemptions_coupon_idx ON public.coupon_redemptions(coupon_id);
CREATE INDEX coupon_redemptions_customer_idx ON public.coupon_redemptions(customer_id);
CREATE INDEX coupon_redemptions_email_idx ON public.coupon_redemptions(customer_email);

GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view redemptions" ON public.coupon_redemptions FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Customer view own redemptions" ON public.coupon_redemptions FOR SELECT
  USING (customer_id = auth.uid());

-- Orders additions
ALTER TABLE public.orders
  ADD COLUMN coupon_code text,
  ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0;

-- Server-side coupon validation
CREATE OR REPLACE FUNCTION public.validate_coupon(
  _code text,
  _subtotal numeric,
  _product_ids uuid[],
  _customer_id uuid,
  _customer_email text
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.coupons;
  eligible_subtotal numeric := 0;
  discount numeric := 0;
  redemptions_by_customer int := 0;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty', 'message', 'Code requis.');
  END IF;

  SELECT * INTO c FROM public.coupons WHERE code = upper(trim(_code));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'Code invalide.');
  END IF;

  IF c.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'inactive', 'message', 'Ce code n''est pas actif.');
  END IF;
  IF c.valid_from > now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_yet_valid', 'message', 'Ce code n''est pas encore actif.');
  END IF;
  IF c.valid_until IS NOT NULL AND c.valid_until < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired', 'message', 'Ce code a expiré.');
  END IF;
  IF c.usage_limit_total IS NOT NULL AND c.current_usage_count >= c.usage_limit_total THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'usage_limit_reached', 'message', 'Ce code n''est plus disponible.');
  END IF;

  IF c.usage_limit_per_customer IS NOT NULL THEN
    SELECT count(*) INTO redemptions_by_customer FROM public.coupon_redemptions r
      WHERE r.coupon_id = c.id
        AND (
          (_customer_id IS NOT NULL AND r.customer_id = _customer_id)
          OR (_customer_email IS NOT NULL AND r.customer_email IS NOT NULL AND lower(r.customer_email) = lower(_customer_email))
        );
    IF redemptions_by_customer >= c.usage_limit_per_customer THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'already_used', 'message', 'Vous avez déjà utilisé ce code.');
    END IF;
  END IF;

  IF c.min_order_amount IS NOT NULL AND _subtotal < c.min_order_amount THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'min_not_met', 'message',
      'Montant minimum non atteint : ' || c.min_order_amount::text || ' FCFA.',
      'min_order_amount', c.min_order_amount);
  END IF;

  -- Determine eligible subtotal
  IF c.applies_to = 'all_products' THEN
    eligible_subtotal := _subtotal;
  ELSIF c.applies_to = 'specific_products' THEN
    SELECT COALESCE(sum(unit_price * quantity), 0) INTO eligible_subtotal
      FROM unnest(_product_ids) WITH ORDINALITY AS t(pid, ord)
      JOIN LATERAL (
        SELECT p.id, p.price AS unit_price, 1 AS quantity
        FROM public.products p WHERE p.id = t.pid
      ) p ON true
      WHERE p.id = ANY(COALESCE(c.applies_to_ids, ARRAY[]::uuid[]));
    -- Fallback via simpler calc: use products table joined via ids
    SELECT COALESCE(sum(p.price), 0) INTO eligible_subtotal
      FROM public.products p
      WHERE p.id = ANY(_product_ids)
        AND p.id = ANY(COALESCE(c.applies_to_ids, ARRAY[]::uuid[]));
  ELSIF c.applies_to = 'specific_category' THEN
    SELECT COALESCE(sum(p.price), 0) INTO eligible_subtotal
      FROM public.products p
      WHERE p.id = ANY(_product_ids)
        AND p.category_id = ANY(COALESCE(c.applies_to_ids, ARRAY[]::uuid[]));
  ELSIF c.applies_to = 'specific_vendor' THEN
    SELECT COALESCE(sum(p.price), 0) INTO eligible_subtotal
      FROM public.products p
      WHERE p.id = ANY(_product_ids)
        AND p.vendor_id = ANY(COALESCE(c.applies_to_ids, ARRAY[]::uuid[]));
  END IF;

  IF eligible_subtotal <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_eligible_items',
      'message', 'Ce code ne s''applique à aucun article de votre panier.');
  END IF;

  IF c.discount_type = 'percentage' THEN
    discount := round(eligible_subtotal * c.discount_value / 100);
    IF c.max_discount_amount IS NOT NULL AND discount > c.max_discount_amount THEN
      discount := c.max_discount_amount;
    END IF;
  ELSE
    discount := c.discount_value;
  END IF;

  IF discount > _subtotal THEN discount := _subtotal; END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'coupon_id', c.id,
    'code', c.code,
    'discount_type', c.discount_type,
    'discount_value', c.discount_value,
    'discount_amount', discount,
    'eligible_subtotal', eligible_subtotal
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text, numeric, uuid[], uuid, text) TO anon, authenticated;

-- Redeem coupon (called from server-side after payment confirmed)
CREATE OR REPLACE FUNCTION public.redeem_coupon(
  _coupon_id uuid,
  _order_id uuid,
  _customer_id uuid,
  _customer_email text,
  _discount numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.coupon_redemptions (coupon_id, order_id, customer_id, customer_email, discount_applied)
  VALUES (_coupon_id, _order_id, _customer_id, _customer_email, _discount);
  UPDATE public.coupons SET current_usage_count = current_usage_count + 1 WHERE id = _coupon_id;
END; $$;
