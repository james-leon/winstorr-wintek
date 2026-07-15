
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_audit_log_admin_read" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON public.admin_audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON public.admin_audit_log(created_at DESC);

ALTER TABLE public.vendor_invitations
  ADD COLUMN IF NOT EXISTS last_email_status text,
  ADD COLUMN IF NOT EXISTS last_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_email_error text,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
