
-- Drop overly permissive policies
DROP POLICY IF EXISTS "product-images authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "product-images authenticated delete" ON storage.objects;

-- Helper: does the current user own (via vendor_members) a product whose images array
-- contains the public URL of this storage object? Staff always allowed.
CREATE OR REPLACE FUNCTION public.can_manage_product_image(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.products p
      JOIN public.vendor_members vm
        ON vm.vendor_id = p.vendor_id
       AND vm.user_id = auth.uid()
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(to_jsonb(p.images)) = 'array' THEN to_jsonb(p.images)
            ELSE '[]'::jsonb
          END
        ) AS url
        WHERE url LIKE '%/product-images/' || _name
      )
    );
$$;

CREATE POLICY "product-images vendor or staff update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.can_manage_product_image(name))
  WITH CHECK (bucket_id = 'product-images' AND public.can_manage_product_image(name));

CREATE POLICY "product-images vendor or staff delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.can_manage_product_image(name));
