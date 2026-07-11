
DROP POLICY "requests_public_insert" ON public.service_requests;
CREATE POLICY "requests_public_insert" ON public.service_requests FOR INSERT
  WITH CHECK (
    length(customer_name) BETWEEN 2 AND 120
    AND length(customer_phone) BETWEEN 6 AND 30
    AND length(description) BETWEEN 5 AND 4000
    AND (customer_email IS NULL OR length(customer_email) <= 254)
    AND status = 'received'
    AND quoted_price IS NULL
    AND internal_notes IS NULL
  );

DROP POLICY "enrollments_public_insert" ON public.training_enrollments;
CREATE POLICY "enrollments_public_insert" ON public.training_enrollments FOR INSERT
  WITH CHECK (
    length(name) BETWEEN 2 AND 120
    AND length(phone) BETWEEN 6 AND 30
    AND (email IS NULL OR length(email) <= 254)
    AND status = 'pending'
  );
