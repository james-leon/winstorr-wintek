-- ENUMS
CREATE TYPE public.financing_request_status AS ENUM ('new','contacted','approved','rejected','completed');
CREATE TYPE public.financing_partner_member_role AS ENUM ('owner','staff');
CREATE TYPE public.financing_invitation_status AS ENUM ('pending','accepted','expired','revoked');

-- PARTNERS
CREATE TABLE public.financing_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  description text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  contact_email text,
  min_product_price numeric NOT NULL DEFAULT 100000,
  default_terms_description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.financing_partners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financing_partners TO authenticated;
GRANT ALL ON public.financing_partners TO service_role;
ALTER TABLE public.financing_partners ENABLE ROW LEVEL SECURITY;

-- MEMBERS
CREATE TABLE public.financing_partner_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financing_partner_id uuid NOT NULL REFERENCES public.financing_partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.financing_partner_member_role NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (financing_partner_id, user_id)
);
GRANT SELECT ON public.financing_partner_members TO authenticated;
GRANT ALL ON public.financing_partner_members TO service_role;
ALTER TABLE public.financing_partner_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_partner_member(_partner_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.financing_partner_members
    WHERE financing_partner_id = _partner_id AND user_id = _user_id
  )
$$;
REVOKE ALL ON FUNCTION public.is_partner_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_partner_member(uuid, uuid) TO authenticated, service_role;

-- REQUESTS
CREATE TABLE public.financing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  financing_partner_id uuid NOT NULL REFERENCES public.financing_partners(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  product_price numeric NOT NULL DEFAULT 0,
  customer_message text,
  status public.financing_request_status NOT NULL DEFAULT 'new',
  partner_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.financing_requests TO anon;
GRANT SELECT, INSERT, UPDATE ON public.financing_requests TO authenticated;
GRANT ALL ON public.financing_requests TO service_role;
ALTER TABLE public.financing_requests ENABLE ROW LEVEL SECURITY;

-- INVITATIONS
CREATE TABLE public.financing_partner_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  financing_partner_id uuid REFERENCES public.financing_partners(id) ON DELETE CASCADE,
  proposed_partner_name text,
  token text NOT NULL UNIQUE,
  status public.financing_invitation_status NOT NULL DEFAULT 'pending',
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.financing_partner_invitations TO authenticated;
GRANT ALL ON public.financing_partner_invitations TO service_role;
ALTER TABLE public.financing_partner_invitations ENABLE ROW LEVEL SECURITY;

-- VENDOR OPT-IN
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS allow_financing boolean NOT NULL DEFAULT false;

-- POLICIES: partners (public read split, no SECURITY DEFINER call for anon)
CREATE POLICY "Active partners are publicly readable"
  ON public.financing_partners FOR SELECT TO anon, authenticated
  USING (is_active = true);
CREATE POLICY "Staff and members read all partners"
  ON public.financing_partners FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_partner_member(id, auth.uid()));
CREATE POLICY "Staff manage partners"
  ON public.financing_partners FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Members update their partner"
  ON public.financing_partners FOR UPDATE TO authenticated
  USING (public.is_partner_member(id, auth.uid()))
  WITH CHECK (public.is_partner_member(id, auth.uid()));

-- POLICIES: members
CREATE POLICY "Read own partner memberships"
  ON public.financing_partner_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Staff manage partner memberships"
  ON public.financing_partner_members FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- POLICIES: requests
CREATE POLICY "Anyone can submit a financing request"
  ON public.financing_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "Staff and partner members read requests"
  ON public.financing_requests FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_partner_member(financing_partner_id, auth.uid()));
CREATE POLICY "Staff and partner members update requests"
  ON public.financing_requests FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_partner_member(financing_partner_id, auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()) OR public.is_partner_member(financing_partner_id, auth.uid()));

-- POLICIES: invitations
CREATE POLICY "Staff manage partner invitations"
  ON public.financing_partner_invitations FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- TRIGGERS
CREATE TRIGGER set_financing_partners_updated_at BEFORE UPDATE ON public.financing_partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_financing_requests_updated_at BEFORE UPDATE ON public.financing_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- INVITATION RPCs (mirrors vendor invitation mechanic)
CREATE OR REPLACE FUNCTION public.get_financing_partner_invitation(_token text)
RETURNS TABLE(email text, proposed_partner_name text, partner_name text, status public.financing_invitation_status, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.email, i.proposed_partner_name, p.name, i.status, i.expires_at
  FROM public.financing_partner_invitations i
  LEFT JOIN public.financing_partners p ON p.id = i.financing_partner_id
  WHERE i.token = _token
$$;
REVOKE ALL ON FUNCTION public.get_financing_partner_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financing_partner_invitation(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accept_financing_partner_invitation(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv public.financing_partner_invitations%ROWTYPE;
  pid uuid;
  uid uuid := auth.uid();
  base_slug text;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  SELECT * INTO inv FROM public.financing_partner_invitations WHERE token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF inv.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_pending'); END IF;
  IF inv.expires_at < now() THEN
    UPDATE public.financing_partner_invitations SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  pid := inv.financing_partner_id;
  IF pid IS NULL THEN
    base_slug := regexp_replace(lower(coalesce(inv.proposed_partner_name, 'partenaire')), '[^a-z0-9]+', '-', 'g');
    base_slug := trim(both '-' from base_slug) || '-' || substr(md5(random()::text), 1, 5);
    INSERT INTO public.financing_partners (name, slug, contact_email)
    VALUES (coalesce(inv.proposed_partner_name, 'Partenaire financier'), base_slug, inv.email)
    RETURNING id INTO pid;
    UPDATE public.financing_partner_invitations SET financing_partner_id = pid WHERE id = inv.id;
  END IF;

  INSERT INTO public.financing_partner_members (financing_partner_id, user_id, role)
  VALUES (pid, uid, 'owner')
  ON CONFLICT (financing_partner_id, user_id) DO NOTHING;

  UPDATE public.financing_partner_invitations
  SET status = 'accepted', accepted_at = now() WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true, 'partner_id', pid);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_financing_partner_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_financing_partner_invitation(text) TO authenticated, service_role;

-- SEED
INSERT INTO public.financing_partners (name, slug, description, contact_phone, min_product_price, default_terms_description)
VALUES ('MC Leasing', 'mc-leasing', 'Payez en plusieurs mensualités avec MC Leasing.', '237699000000', 100000,
        'Acompte requis + mensualités sur 3 à 6 mois, selon dossier.')
ON CONFLICT (slug) DO NOTHING;