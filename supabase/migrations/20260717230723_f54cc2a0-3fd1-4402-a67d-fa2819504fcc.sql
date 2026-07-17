CREATE TYPE public.vendor_application_status AS ENUM ('new','contacted','approved','rejected');

CREATE TABLE public.vendor_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name text NOT NULL,
  contact_name text NOT NULL,
  phone text NOT NULL,
  email text,
  city text NOT NULL,
  product_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text NOT NULL,
  social_link text,
  status public.vendor_application_status NOT NULL DEFAULT 'new',
  admin_notes text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invitation_id uuid REFERENCES public.vendor_invitations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.vendor_applications TO anon;
GRANT SELECT, INSERT, UPDATE ON public.vendor_applications TO authenticated;
GRANT ALL ON public.vendor_applications TO service_role;

ALTER TABLE public.vendor_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can apply as vendor"
  ON public.vendor_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can view applications"
  ON public.vendor_applications
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update applications"
  ON public.vendor_applications
  FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER update_vendor_applications_updated_at
  BEFORE UPDATE ON public.vendor_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX vendor_applications_status_idx ON public.vendor_applications(status, created_at DESC);
