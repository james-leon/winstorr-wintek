DROP POLICY IF EXISTS "delivery_zones_public_read" ON public.delivery_zones;
CREATE POLICY "delivery_zones_public_read" ON public.delivery_zones
  FOR SELECT USING (is_active = true);