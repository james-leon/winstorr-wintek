
-- 1. product_variants: restrict staff/vendor management to authenticated
DROP POLICY IF EXISTS "Staff and vendor members manage variants" ON public.product_variants;
CREATE POLICY "Staff and vendor members manage variants"
  ON public.product_variants AS PERMISSIVE FOR ALL
  TO authenticated
  USING (
    is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.products p
               JOIN public.vendor_members vm ON vm.vendor_id = p.vendor_id
               WHERE p.id = product_variants.product_id AND vm.user_id = auth.uid())
  )
  WITH CHECK (
    is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.products p
               JOIN public.vendor_members vm ON vm.vendor_id = p.vendor_id
               WHERE p.id = product_variants.product_id AND vm.user_id = auth.uid())
  );

-- 2. product_reviews: split public read from staff read
DROP POLICY IF EXISTS "Public can view published reviews" ON public.product_reviews;
CREATE POLICY "Public read published reviews"
  ON public.product_reviews AS PERMISSIVE FOR SELECT
  TO anon, authenticated
  USING (status = 'published'::review_status);
CREATE POLICY "Users read own reviews"
  ON public.product_reviews AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid() OR is_staff(auth.uid()));

-- 3. pickup_points: split
DROP POLICY IF EXISTS "pickup_public_read_active" ON public.pickup_points;
CREATE POLICY "pickup_public_read_active"
  ON public.pickup_points AS PERMISSIVE FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
CREATE POLICY "pickup_staff_read_all"
  ON public.pickup_points AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

-- 4. commission_rules: staff-only, restrict to authenticated
DROP POLICY IF EXISTS "Staff manage commissions" ON public.commission_rules;
CREATE POLICY "Staff manage commissions"
  ON public.commission_rules AS PERMISSIVE FOR ALL
  TO authenticated
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- 5. coupon_redemptions
DROP POLICY IF EXISTS "Staff view redemptions" ON public.coupon_redemptions;
CREATE POLICY "Staff view redemptions"
  ON public.coupon_redemptions AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

-- 6. coupons
DROP POLICY IF EXISTS "Staff manage coupons" ON public.coupons;
CREATE POLICY "Staff manage coupons"
  ON public.coupons AS PERMISSIVE FOR ALL
  TO authenticated
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- 7. order_shipments
DROP POLICY IF EXISTS "shipments_staff_all" ON public.order_shipments;
CREATE POLICY "shipments_staff_all"
  ON public.order_shipments AS PERMISSIVE FOR ALL
  TO authenticated
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- 8. product_questions
DROP POLICY IF EXISTS "Staff read all questions" ON public.product_questions;
CREATE POLICY "Staff read all questions"
  ON public.product_questions AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Vendor or staff answer" ON public.product_questions;
CREATE POLICY "Vendor or staff answer"
  ON public.product_questions AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (
    is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.products p
               WHERE p.id = product_questions.product_id
                 AND is_vendor_member(p.vendor_id, auth.uid()))
  )
  WITH CHECK (
    is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.products p
               WHERE p.id = product_questions.product_id
                 AND is_vendor_member(p.vendor_id, auth.uid()))
  );

-- 9. vendor_announcements
DROP POLICY IF EXISTS "Staff manage announcements" ON public.vendor_announcements;
CREATE POLICY "Staff manage announcements"
  ON public.vendor_announcements AS PERMISSIVE FOR ALL
  TO authenticated
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Vendors read applicable announcements" ON public.vendor_announcements;
CREATE POLICY "Vendors read applicable announcements"
  ON public.vendor_announcements AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (
    vendor_id IS NULL
    OR is_vendor_member(vendor_id, auth.uid())
    OR is_staff(auth.uid())
  );

-- 10. vendor_storefronts
DROP POLICY IF EXISTS "Vendor members manage own storefront" ON public.vendor_storefronts;
CREATE POLICY "Vendor members manage own storefront"
  ON public.vendor_storefronts AS PERMISSIVE FOR ALL
  TO authenticated
  USING (is_vendor_member(vendor_id, auth.uid()) OR is_staff(auth.uid()))
  WITH CHECK (is_vendor_member(vendor_id, auth.uid()) OR is_staff(auth.uid()));

-- 11. vendor_withdrawal_requests
DROP POLICY IF EXISTS "Vendor members read their withdrawals" ON public.vendor_withdrawal_requests;
CREATE POLICY "Vendor members read their withdrawals"
  ON public.vendor_withdrawal_requests AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (is_vendor_member(vendor_id, auth.uid()) OR is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update withdrawals" ON public.vendor_withdrawal_requests;
CREATE POLICY "Staff update withdrawals"
  ON public.vendor_withdrawal_requests AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
