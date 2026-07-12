
-- 1) vendor_members
CREATE TYPE public.vendor_member_role AS ENUM ('owner', 'staff');

CREATE TABLE public.vendor_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.vendor_member_role NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, user_id)
);
CREATE INDEX idx_vendor_members_user ON public.vendor_members(user_id);
CREATE INDEX idx_vendor_members_vendor ON public.vendor_members(vendor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_members TO authenticated;
GRANT ALL ON public.vendor_members TO service_role;

ALTER TABLE public.vendor_members ENABLE ROW LEVEL SECURITY;

-- helper (create BEFORE policies that use it)
CREATE OR REPLACE FUNCTION public.is_vendor_member(_vendor_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.vendor_members WHERE vendor_id = _vendor_id AND user_id = _user_id);
$$;
GRANT EXECUTE ON FUNCTION public.is_vendor_member(uuid, uuid) TO authenticated;

CREATE POLICY "vendor_members_self_read" ON public.vendor_members
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "vendor_members_admin_manage" ON public.vendor_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed: link the first admin as owner of Wintek
INSERT INTO public.vendor_members (vendor_id, user_id, role)
SELECT v.id, ur.user_id, 'owner'
FROM public.vendors v
CROSS JOIN LATERAL (
  SELECT user_id FROM public.user_roles WHERE role = 'admin' ORDER BY user_id LIMIT 1
) ur
WHERE v.slug = 'wintek'
ON CONFLICT DO NOTHING;

-- 2) vendor_invitations
CREATE TYPE public.vendor_invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

CREATE TABLE public.vendor_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  proposed_vendor_name text,
  token text NOT NULL UNIQUE,
  status public.vendor_invitation_status NOT NULL DEFAULT 'pending',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vendor_invitations_token ON public.vendor_invitations(token);
CREATE INDEX idx_vendor_invitations_email ON public.vendor_invitations(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_invitations TO authenticated;
GRANT ALL ON public.vendor_invitations TO service_role;

ALTER TABLE public.vendor_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_invitations_admin_all" ON public.vendor_invitations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Vendor-scoped policies on products / training_sessions / service_requests
CREATE POLICY "products_vendor_read" ON public.products
  FOR SELECT TO authenticated
  USING (public.is_vendor_member(vendor_id, auth.uid()));
CREATE POLICY "products_vendor_write" ON public.products
  FOR ALL TO authenticated
  USING (public.is_vendor_member(vendor_id, auth.uid()))
  WITH CHECK (public.is_vendor_member(vendor_id, auth.uid()));

CREATE POLICY "training_sessions_vendor_read" ON public.training_sessions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = training_sessions.product_id AND public.is_vendor_member(p.vendor_id, auth.uid())));
CREATE POLICY "training_sessions_vendor_write" ON public.training_sessions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = training_sessions.product_id AND public.is_vendor_member(p.vendor_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = training_sessions.product_id AND public.is_vendor_member(p.vendor_id, auth.uid())));

CREATE POLICY "service_requests_vendor_read" ON public.service_requests
  FOR SELECT TO authenticated
  USING (public.is_vendor_member(vendor_id, auth.uid()));

-- 4) Vendor read-only access to orders + order_items containing their products
CREATE POLICY "orders_vendor_read" ON public.orders
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = orders.id AND public.is_vendor_member(oi.vendor_id, auth.uid())
  ));

CREATE POLICY "order_items_vendor_read" ON public.order_items
  FOR SELECT TO authenticated
  USING (public.is_vendor_member(vendor_id, auth.uid()));

-- 5) Hide products of suspended vendors from public catalog
DROP POLICY IF EXISTS "products_public_active" ON public.products;
CREATE POLICY "products_public_active" ON public.products
  FOR SELECT
  USING (
    status = 'active'::product_status
    AND EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = products.vendor_id AND v.status = 'active')
  );

-- 6) Accept invitation function
CREATE OR REPLACE FUNCTION public.accept_vendor_invitation(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv public.vendor_invitations;
  v_id uuid;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;

  SELECT * INTO inv FROM public.vendor_invitations WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF inv.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_pending', 'status', inv.status); END IF;
  IF inv.expires_at < now() THEN
    UPDATE public.vendor_invitations SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  IF inv.vendor_id IS NULL THEN
    INSERT INTO public.vendors (name, slug, type, status, contact_email)
    VALUES (
      COALESCE(inv.proposed_vendor_name, split_part(inv.email, '@', 1)),
      lower(regexp_replace(COALESCE(inv.proposed_vendor_name, split_part(inv.email, '@', 1)) || '-' || substr(gen_random_uuid()::text, 1, 6), '[^a-z0-9]+', '-', 'g')),
      'external',
      'active',
      inv.email
    )
    RETURNING id INTO v_id;
  ELSE
    v_id := inv.vendor_id;
  END IF;

  INSERT INTO public.vendor_members (vendor_id, user_id, role)
  VALUES (v_id, uid, 'owner')
  ON CONFLICT DO NOTHING;

  UPDATE public.vendor_invitations
    SET status = 'accepted', accepted_at = now(), vendor_id = v_id
    WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true, 'vendor_id', v_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.accept_vendor_invitation(text) TO authenticated;

-- Public function to look up an invitation by token (safe fields only)
CREATE OR REPLACE FUNCTION public.get_vendor_invitation(_token text)
RETURNS TABLE (email text, proposed_vendor_name text, vendor_name text, status public.vendor_invitation_status, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.email, i.proposed_vendor_name, v.name, i.status, i.expires_at
  FROM public.vendor_invitations i
  LEFT JOIN public.vendors v ON v.id = i.vendor_id
  WHERE i.token = _token;
$$;
GRANT EXECUTE ON FUNCTION public.get_vendor_invitation(text) TO anon, authenticated;
