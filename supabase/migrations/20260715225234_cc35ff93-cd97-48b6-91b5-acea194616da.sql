ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS products_pending_review_idx
  ON public.products (created_at DESC) WHERE status = 'pending_review';

CREATE OR REPLACE FUNCTION public.enforce_product_moderation()
RETURNS TRIGGER
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
    ELSIF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
      NEW.reviewed_by := auth.uid();
      NEW.reviewed_at := now();
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('active','rejected') THEN
      NEW.status := 'pending_review';
    END IF;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.rejection_reason := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
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
END $$;

DROP TRIGGER IF EXISTS products_moderation ON public.products;
CREATE TRIGGER products_moderation
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.enforce_product_moderation();

CREATE OR REPLACE FUNCTION public.notify_product_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending_review'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending_review') THEN
    INSERT INTO public.admin_notifications(type, message)
    VALUES ('other', 'Produit en attente de validation : ' || NEW.name);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS products_notify_pending ON public.products;
CREATE TRIGGER products_notify_pending
AFTER INSERT OR UPDATE OF status ON public.products
FOR EACH ROW EXECUTE FUNCTION public.notify_product_pending();