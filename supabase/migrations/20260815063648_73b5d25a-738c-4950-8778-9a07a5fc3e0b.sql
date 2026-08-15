ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS verification_note text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Products: only staff may change quality_verified
CREATE OR REPLACE FUNCTION public.enforce_product_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_is_staff boolean := public.is_staff(auth.uid());
BEGIN
  IF actor_is_staff THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
        NEW.reviewed_by := auth.uid();
        NEW.reviewed_at := now();
        NEW.rejection_reason := NULL;
      ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
        NEW.reviewed_by := auth.uid();
        NEW.reviewed_at := now();
      END IF;
      IF NEW.quality_verified IS DISTINCT FROM OLD.quality_verified THEN
        INSERT INTO public.admin_audit_log (action, entity_type, entity_id, actor_id, metadata)
        VALUES (
          CASE WHEN NEW.quality_verified THEN 'quality_verified_granted' ELSE 'quality_verified_removed' END,
          'product', NEW.id, auth.uid(), jsonb_build_object('product_name', NEW.name)
        );
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.quality_verified := false;
    IF NEW.status IN ('active','rejected') THEN
      NEW.status := 'pending_review';
    END IF;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.rejection_reason := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.quality_verified := OLD.quality_verified;
    IF NEW.status = 'rejected' THEN
      NEW.status := OLD.status;
    END IF;
    IF NEW.status = 'active'
       OR (OLD.status = 'active' AND NEW.status NOT IN ('draft','archived')) THEN
      NEW.status := 'pending_review';
    END IF;
    IF NEW.status = 'pending_review' AND OLD.status IS DISTINCT FROM 'pending_review' THEN
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
      NEW.rejection_reason := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Vendors: only staff may change verified / verification_note
CREATE OR REPLACE FUNCTION public.enforce_vendor_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_is_staff boolean := public.is_staff(auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT actor_is_staff THEN
      NEW.verified := false;
      NEW.verification_note := NULL;
      NEW.verified_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT actor_is_staff THEN
    NEW.verified := OLD.verified;
    NEW.verification_note := OLD.verification_note;
    NEW.verified_at := OLD.verified_at;
    RETURN NEW;
  END IF;

  IF NEW.verified IS DISTINCT FROM OLD.verified THEN
    NEW.verified_at := CASE WHEN NEW.verified THEN now() ELSE NULL END;
    INSERT INTO public.admin_audit_log (action, entity_type, entity_id, actor_id, metadata)
    VALUES (
      CASE WHEN NEW.verified THEN 'vendor_verified_granted' ELSE 'vendor_verified_removed' END,
      'vendor', NEW.id, auth.uid(),
      jsonb_build_object('vendor_name', NEW.name, 'note', NEW.verification_note)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendors_verification_guard ON public.vendors;
CREATE TRIGGER vendors_verification_guard
BEFORE INSERT OR UPDATE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_verification();

REVOKE EXECUTE ON FUNCTION public.enforce_vendor_verification() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_product_moderation() FROM anon, authenticated;

UPDATE public.vendors SET verified_at = COALESCE(verified_at, updated_at) WHERE verified;