ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sales_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.order_counts_as_sale(_payment_status public.payment_status, _status public.order_status)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _payment_status = 'paid'::public.payment_status
     AND _status NOT IN ('cancelled'::public.order_status, 'payment_failed'::public.order_status)
$$;

CREATE OR REPLACE FUNCTION public.sync_vendor_sales_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  was_sale boolean := false;
  is_sale boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    was_sale := public.order_counts_as_sale(OLD.payment_status, OLD.status);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    is_sale := public.order_counts_as_sale(NEW.payment_status, NEW.status);
  ELSE
    was_sale := public.order_counts_as_sale(OLD.payment_status, OLD.status);
  END IF;

  IF was_sale = is_sale THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF is_sale THEN
    UPDATE public.vendors v
       SET sales_count = v.sales_count + agg.n
      FROM (SELECT vendor_id, count(*)::int AS n FROM public.order_items WHERE order_id = NEW.id AND vendor_id IS NOT NULL GROUP BY vendor_id) agg
     WHERE v.id = agg.vendor_id;
  ELSE
    UPDATE public.vendors v
       SET sales_count = GREATEST(0, v.sales_count - agg.n)
      FROM (SELECT vendor_id, count(*)::int AS n FROM public.order_items WHERE order_id = COALESCE(OLD.id, NEW.id) AND vendor_id IS NOT NULL GROUP BY vendor_id) agg
     WHERE v.id = agg.vendor_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_vendor_sales_count ON public.orders;
CREATE TRIGGER trg_sync_vendor_sales_count
AFTER INSERT OR UPDATE OF payment_status, status OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_vendor_sales_count();

-- Backfill existing sales
UPDATE public.vendors v
   SET sales_count = COALESCE(agg.n, 0)
  FROM (
    SELECT oi.vendor_id, count(*)::int AS n
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
     WHERE oi.vendor_id IS NOT NULL
       AND public.order_counts_as_sale(o.payment_status, o.status)
     GROUP BY oi.vendor_id
  ) agg
 WHERE v.id = agg.vendor_id;

-- Internal Winstorr vendors are verified by definition
UPDATE public.vendors SET verified = true WHERE type = 'internal';