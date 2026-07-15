
-- 1. vendors: boost_score + pinning
ALTER TABLE public.vendors 
  ADD COLUMN IF NOT EXISTS boost_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pinned_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_vendors_pinned_until ON public.vendors(pinned_until) WHERE pinned_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_boost_score ON public.vendors(boost_score DESC);

-- 2. vendor_storefronts
CREATE TABLE public.vendor_storefronts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL UNIQUE REFERENCES public.vendors(id) ON DELETE CASCADE,
  banner_url text,
  description text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  policies text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vendor_storefronts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_storefronts TO authenticated;
GRANT ALL ON public.vendor_storefronts TO service_role;
ALTER TABLE public.vendor_storefronts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read storefronts" ON public.vendor_storefronts FOR SELECT USING (true);
CREATE POLICY "Vendor members manage own storefront" ON public.vendor_storefronts FOR ALL
  USING (public.is_vendor_member(vendor_id, auth.uid()) OR public.is_staff(auth.uid()))
  WITH CHECK (public.is_vendor_member(vendor_id, auth.uid()) OR public.is_staff(auth.uid()));
CREATE TRIGGER trg_vendor_storefronts_updated BEFORE UPDATE ON public.vendor_storefronts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. commission_rules
CREATE TYPE public.commission_scope AS ENUM ('global', 'vendor', 'category', 'product');
CREATE TYPE public.commission_kind AS ENUM ('percentage', 'fixed_amount');

CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope commission_scope NOT NULL,
  scope_id uuid,
  commission_type commission_kind NOT NULL,
  commission_value numeric NOT NULL CHECK (commission_value >= 0),
  priority int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'global' AND scope_id IS NULL) OR (scope <> 'global' AND scope_id IS NOT NULL))
);
GRANT SELECT ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage commissions" ON public.commission_rules FOR ALL
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Authenticated read commissions" ON public.commission_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE INDEX idx_commission_rules_scope ON public.commission_rules(scope, scope_id) WHERE is_active;
CREATE TRIGGER trg_commission_rules_updated BEFORE UPDATE ON public.commission_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.commission_rules (scope, scope_id, commission_type, commission_value, priority, is_active)
VALUES ('global', NULL, 'percentage', 10, 0, true);

-- 4. order_items: commission snapshot
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS commission_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_rate_applied numeric;

-- 5. resolve_commission function (product > category > vendor > global)
CREATE OR REPLACE FUNCTION public.resolve_commission(_product_id uuid, _line_amount numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_vendor_id uuid; v_category_id uuid;
  rule public.commission_rules%ROWTYPE;
  amt numeric;
BEGIN
  SELECT vendor_id, category_id INTO v_vendor_id, v_category_id FROM public.products WHERE id = _product_id;

  SELECT * INTO rule FROM public.commission_rules
    WHERE is_active AND scope='product' AND scope_id = _product_id
    ORDER BY priority DESC LIMIT 1;
  IF NOT FOUND AND v_category_id IS NOT NULL THEN
    SELECT * INTO rule FROM public.commission_rules
      WHERE is_active AND scope='category' AND scope_id = v_category_id
      ORDER BY priority DESC LIMIT 1;
  END IF;
  IF NOT FOUND AND v_vendor_id IS NOT NULL THEN
    SELECT * INTO rule FROM public.commission_rules
      WHERE is_active AND scope='vendor' AND scope_id = v_vendor_id
      ORDER BY priority DESC LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    SELECT * INTO rule FROM public.commission_rules
      WHERE is_active AND scope='global'
      ORDER BY priority DESC LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('amount', 0, 'rate', 0, 'type', NULL, 'rule_id', NULL);
  END IF;
  IF rule.commission_type = 'percentage' THEN
    amt := round(_line_amount * rule.commission_value / 100);
  ELSE
    amt := rule.commission_value;
  END IF;
  IF amt > _line_amount THEN amt := _line_amount; END IF;
  RETURN jsonb_build_object('amount', amt, 'rate', rule.commission_value, 'type', rule.commission_type, 'rule_id', rule.id);
END $$;

CREATE OR REPLACE FUNCTION public.snapshot_order_commissions(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE it record; res jsonb;
BEGIN
  FOR it IN SELECT id, product_id, subtotal FROM public.order_items WHERE order_id = _order_id LOOP
    res := public.resolve_commission(it.product_id, it.subtotal);
    UPDATE public.order_items
      SET commission_amount = (res->>'amount')::numeric,
          commission_rate_applied = (res->>'rate')::numeric
      WHERE id = it.id;
  END LOOP;
END $$;

-- 6. vendor_withdrawal_requests
CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'approved', 'paid', 'rejected');

CREATE TABLE public.vendor_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  amount_requested numeric NOT NULL CHECK (amount_requested > 0),
  available_balance_at_request numeric NOT NULL,
  status withdrawal_status NOT NULL DEFAULT 'pending',
  payout_method text NOT NULL,
  payout_details text NOT NULL,
  staff_notes text,
  processed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT SELECT, INSERT ON public.vendor_withdrawal_requests TO authenticated;
GRANT UPDATE ON public.vendor_withdrawal_requests TO authenticated;
GRANT ALL ON public.vendor_withdrawal_requests TO service_role;
ALTER TABLE public.vendor_withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vendor members read their withdrawals" ON public.vendor_withdrawal_requests FOR SELECT
  USING (public.is_vendor_member(vendor_id, auth.uid()) OR public.is_staff(auth.uid()));
CREATE POLICY "Vendor members create withdrawals" ON public.vendor_withdrawal_requests FOR INSERT
  WITH CHECK (public.is_vendor_member(vendor_id, auth.uid()));
CREATE POLICY "Staff update withdrawals" ON public.vendor_withdrawal_requests FOR UPDATE
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_withdrawals_vendor ON public.vendor_withdrawal_requests(vendor_id, created_at DESC);
CREATE INDEX idx_withdrawals_status ON public.vendor_withdrawal_requests(status);

-- 7. coupons: vendor_id
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_coupons_vendor ON public.coupons(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE POLICY "Vendor members manage own coupons" ON public.coupons FOR ALL
  USING (vendor_id IS NOT NULL AND public.is_vendor_member(vendor_id, auth.uid()))
  WITH CHECK (vendor_id IS NOT NULL AND public.is_vendor_member(vendor_id, auth.uid()));

INSERT INTO public.app_settings (key, value) VALUES ('max_vendor_discount_percentage', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 8. product_questions
CREATE TYPE public.question_status AS ENUM ('pending', 'answered', 'hidden');

CREATE TABLE public.product_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name text,
  guest_contact text,
  question text NOT NULL,
  answer text,
  answered_by uuid REFERENCES public.profiles(id),
  status question_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  CHECK (customer_id IS NOT NULL OR (guest_name IS NOT NULL AND guest_contact IS NOT NULL))
);
GRANT SELECT ON public.product_questions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.product_questions TO authenticated;
GRANT INSERT ON public.product_questions TO anon;
GRANT ALL ON public.product_questions TO service_role;
ALTER TABLE public.product_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read visible questions" ON public.product_questions FOR SELECT
  USING (status IN ('pending','answered'));
CREATE POLICY "Staff read all questions" ON public.product_questions FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Vendors read their questions" ON public.product_questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.is_vendor_member(p.vendor_id, auth.uid())));
CREATE POLICY "Anyone can ask (guest or self)" ON public.product_questions FOR INSERT
  WITH CHECK (customer_id IS NULL OR customer_id = auth.uid());
CREATE POLICY "Vendor or staff answer" ON public.product_questions FOR UPDATE
  USING (public.is_staff(auth.uid())
         OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.is_vendor_member(p.vendor_id, auth.uid())))
  WITH CHECK (public.is_staff(auth.uid())
         OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.is_vendor_member(p.vendor_id, auth.uid())));
CREATE INDEX idx_questions_product ON public.product_questions(product_id, created_at DESC);
CREATE INDEX idx_questions_status ON public.product_questions(status);

-- 9. store_follows
CREATE TABLE public.store_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, vendor_id)
);
GRANT SELECT ON public.store_follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.store_follows TO authenticated;
GRANT ALL ON public.store_follows TO service_role;
ALTER TABLE public.store_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read follows" ON public.store_follows FOR SELECT USING (true);
CREATE POLICY "Customer manages own follows" ON public.store_follows FOR ALL
  USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE INDEX idx_follows_vendor ON public.store_follows(vendor_id);
CREATE INDEX idx_follows_customer ON public.store_follows(customer_id);

-- 10. vendor_announcements
CREATE TABLE public.vendor_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vendor_announcements TO authenticated;
GRANT ALL ON public.vendor_announcements TO service_role;
ALTER TABLE public.vendor_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage announcements" ON public.vendor_announcements FOR ALL
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Vendors read applicable announcements" ON public.vendor_announcements FOR SELECT
  USING (vendor_id IS NULL OR public.is_vendor_member(vendor_id, auth.uid()) OR public.is_staff(auth.uid()));
CREATE INDEX idx_announcements_vendor ON public.vendor_announcements(vendor_id, created_at DESC);

-- 11. Balance function + withdrawal request
CREATE OR REPLACE FUNCTION public.vendor_available_balance(_vendor_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((
    SELECT SUM(oi.subtotal - COALESCE(oi.commission_amount, 0))
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.vendor_id = _vendor_id
      AND o.payment_status = 'paid'
      AND o.status IN ('paid','shipped','delivered','completed')
  ), 0) - COALESCE((
    SELECT SUM(amount_requested)
    FROM public.vendor_withdrawal_requests
    WHERE vendor_id = _vendor_id AND status IN ('pending','approved','paid')
  ), 0);
$$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _vendor_id uuid, _amount numeric, _payout_method text, _payout_details text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE bal numeric; new_id uuid;
BEGIN
  IF NOT public.is_vendor_member(_vendor_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _amount <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount'); END IF;
  bal := public.vendor_available_balance(_vendor_id);
  IF _amount > bal THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_balance', 'available', bal);
  END IF;
  INSERT INTO public.vendor_withdrawal_requests(vendor_id, amount_requested, available_balance_at_request, payout_method, payout_details)
    VALUES (_vendor_id, _amount, bal, _payout_method, _payout_details)
    RETURNING id INTO new_id;
  RETURN jsonb_build_object('ok', true, 'id', new_id);
END $$;

-- 12. Boost score recomputation
CREATE OR REPLACE FUNCTION public.recompute_vendor_boost_scores()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  WITH sales AS (
    SELECT oi.vendor_id, SUM(oi.subtotal) AS revenue_30d
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.payment_status='paid' AND o.created_at >= now() - interval '30 days'
    GROUP BY oi.vendor_id
  ),
  ratings AS (
    SELECT p.vendor_id,
      CASE WHEN SUM(p.rating_count) > 0 THEN
        (SUM(p.rating_count * p.rating_average) + 5 * 3.5) / (SUM(p.rating_count) + 5)
      ELSE 3.5 END AS w_rating
    FROM public.products p WHERE p.status='active'
    GROUP BY p.vendor_id
  ),
  max_rev AS (SELECT COALESCE(MAX(revenue_30d), 0) AS m FROM sales),
  calc AS (
    SELECT v.id,
      COALESCE(50 * (s.revenue_30d / NULLIF((SELECT m FROM max_rev), 0)), 0)
      + COALESCE(6 * r.w_rating, 0)
      + GREATEST(0::numeric, 25 * (1 - EXTRACT(EPOCH FROM (now() - v.created_at)) / (21 * 86400))) AS score
    FROM public.vendors v
    LEFT JOIN sales s ON s.vendor_id = v.id
    LEFT JOIN ratings r ON r.vendor_id = v.id
  )
  UPDATE public.vendors v SET boost_score = calc.score
  FROM calc WHERE calc.id = v.id;
END $$;

-- 13. Schedule daily recomputation via pg_cron (safe if pg_cron already enabled)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='recompute-vendor-boost-scores') THEN
      PERFORM cron.unschedule('recompute-vendor-boost-scores');
    END IF;
    PERFORM cron.schedule('recompute-vendor-boost-scores','0 3 * * *', 'SELECT public.recompute_vendor_boost_scores();');
  END IF;
END $$;

-- 14. Do an initial score computation so the directory has data on day 1
SELECT public.recompute_vendor_boost_scores();
