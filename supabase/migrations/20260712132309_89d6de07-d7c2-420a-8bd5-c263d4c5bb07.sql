
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_vendor_id ON public.order_items(vendor_id);

CREATE OR REPLACE FUNCTION public.admin_analytics(
  _from timestamptz,
  _to timestamptz,
  _vendor_id uuid DEFAULT NULL,
  _low_stock_threshold int DEFAULT 5
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result jsonb;
  v_bucket text;
  v_days int;
  v_revenue numeric := 0;
  v_paid_orders int := 0;
  v_total_orders int := 0;
  v_avg numeric := 0;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_days := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (_to - _from)) / 86400)::int);
  v_bucket := CASE WHEN v_days > 92 THEN 'week' ELSE 'day' END;

  -- Summary numbers
  IF _vendor_id IS NULL THEN
    SELECT
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total ELSE 0 END), 0),
      COUNT(*) FILTER (WHERE o.payment_status = 'paid'),
      COUNT(*)
    INTO v_revenue, v_paid_orders, v_total_orders
    FROM public.orders o
    WHERE o.created_at >= _from AND o.created_at < _to;
  ELSE
    SELECT
      COALESCE(SUM(oi.subtotal) FILTER (WHERE o.payment_status = 'paid'), 0),
      COUNT(DISTINCT o.id) FILTER (WHERE o.payment_status = 'paid'),
      COUNT(DISTINCT o.id)
    INTO v_revenue, v_paid_orders, v_total_orders
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.created_at >= _from AND o.created_at < _to
      AND oi.vendor_id = _vendor_id;
  END IF;

  v_avg := CASE WHEN v_paid_orders > 0 THEN v_revenue / v_paid_orders ELSE 0 END;

  result := jsonb_build_object(
    'range', jsonb_build_object('from', _from, 'to', _to, 'bucket', v_bucket),
    'summary', jsonb_build_object(
      'revenue', v_revenue,
      'paid_orders', v_paid_orders,
      'total_orders', v_total_orders,
      'avg_order_value', v_avg,
      'paid_rate', CASE WHEN v_total_orders > 0 THEN v_paid_orders::numeric / v_total_orders ELSE 0 END
    )
  );

  -- Revenue time series
  result := result || jsonb_build_object('series', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket', b, 'revenue', rev, 'orders', ord) ORDER BY b), '[]'::jsonb)
    FROM (
      SELECT
        date_trunc(v_bucket, o.created_at) AS b,
        COALESCE(SUM(CASE WHEN _vendor_id IS NULL THEN
          CASE WHEN o.payment_status='paid' THEN o.total ELSE 0 END
        ELSE
          CASE WHEN o.payment_status='paid' THEN oi.subtotal ELSE 0 END
        END), 0) AS rev,
        COUNT(DISTINCT CASE WHEN o.payment_status='paid' THEN o.id END) AS ord
      FROM public.orders o
      LEFT JOIN public.order_items oi ON oi.order_id = o.id AND (_vendor_id IS NULL OR oi.vendor_id = _vendor_id)
      WHERE o.created_at >= _from AND o.created_at < _to
        AND (_vendor_id IS NULL OR oi.vendor_id = _vendor_id)
      GROUP BY 1
    ) s
  ));

  -- Top products
  result := result || jsonb_build_object('top_products', (
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.revenue DESC), '[]'::jsonb) FROM (
      SELECT
        oi.product_id,
        oi.product_name AS name,
        oi.product_slug AS slug,
        COALESCE(p.type::text, oi.product_type::text) AS type,
        COALESCE(p.rating_average, 0) AS rating_average,
        COALESCE(p.rating_count, 0) AS rating_count,
        SUM(oi.quantity)::int AS units,
        SUM(oi.subtotal) AS revenue
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      LEFT JOIN public.products p ON p.id = oi.product_id
      WHERE o.created_at >= _from AND o.created_at < _to
        AND o.payment_status = 'paid'
        AND (_vendor_id IS NULL OR oi.vendor_id = _vendor_id)
      GROUP BY oi.product_id, oi.product_name, oi.product_slug, p.type, oi.product_type, p.rating_average, p.rating_count
      ORDER BY revenue DESC
      LIMIT 15
    ) t
  ));

  -- By type
  result := result || jsonb_build_object('by_type', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('type', ptype, 'revenue', rev, 'units', units) ORDER BY rev DESC), '[]'::jsonb) FROM (
      SELECT COALESCE(p.type::text, oi.product_type::text) AS ptype,
             SUM(oi.subtotal) AS rev,
             SUM(oi.quantity)::int AS units
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      LEFT JOIN public.products p ON p.id = oi.product_id
      WHERE o.created_at >= _from AND o.created_at < _to
        AND o.payment_status = 'paid'
        AND (_vendor_id IS NULL OR oi.vendor_id = _vendor_id)
      GROUP BY 1
    ) t
  ));

  -- By category
  result := result || jsonb_build_object('by_category', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('category', name, 'revenue', rev, 'units', units) ORDER BY rev DESC), '[]'::jsonb) FROM (
      SELECT COALESCE(c.name, 'Sans catégorie') AS name,
             SUM(oi.subtotal) AS rev,
             SUM(oi.quantity)::int AS units
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      LEFT JOIN public.products p ON p.id = oi.product_id
      LEFT JOIN public.categories c ON c.id = p.category_id
      WHERE o.created_at >= _from AND o.created_at < _to
        AND o.payment_status = 'paid'
        AND (_vendor_id IS NULL OR oi.vendor_id = _vendor_id)
      GROUP BY 1
      ORDER BY rev DESC
      LIMIT 10
    ) t
  ));

  -- Order status breakdown
  result := result || jsonb_build_object('by_status', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('status', s, 'count', c) ORDER BY c DESC), '[]'::jsonb) FROM (
      SELECT o.status::text AS s, COUNT(DISTINCT o.id)::int AS c
      FROM public.orders o
      LEFT JOIN public.order_items oi ON oi.order_id = o.id
      WHERE o.created_at >= _from AND o.created_at < _to
        AND (_vendor_id IS NULL OR oi.vendor_id = _vendor_id)
      GROUP BY 1
    ) t
  ));

  -- Low stock
  result := result || jsonb_build_object('low_stock', (
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.stock_quantity ASC), '[]'::jsonb) FROM (
      SELECT p.id, p.name, p.slug, p.stock_quantity, p.vendor_id
      FROM public.products p
      WHERE p.type = 'physical'
        AND p.status = 'active'
        AND p.stock_quantity <= _low_stock_threshold
        AND (_vendor_id IS NULL OR p.vendor_id = _vendor_id)
      ORDER BY p.stock_quantity ASC
      LIMIT 30
    ) t
  ));

  -- Coupon performance
  result := result || jsonb_build_object('coupons', (
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.redemptions DESC), '[]'::jsonb) FROM (
      SELECT c.code,
             c.discount_type::text,
             c.discount_value,
             COUNT(r.id)::int AS redemptions,
             COALESCE(SUM(r.discount_applied), 0) AS total_discount,
             COALESCE(SUM(o.total), 0) AS resulting_revenue
      FROM public.coupon_redemptions r
      JOIN public.coupons c ON c.id = r.coupon_id
      JOIN public.orders o ON o.id = r.order_id
      WHERE r.created_at >= _from AND r.created_at < _to
      GROUP BY c.code, c.discount_type, c.discount_value
    ) t
  ));

  -- Reviews snapshot
  result := result || jsonb_build_object('reviews', jsonb_build_object(
    'avg_rating', COALESCE((SELECT ROUND(AVG(rating_average)::numeric, 2) FROM public.products WHERE rating_count > 0
                            AND (_vendor_id IS NULL OR vendor_id = _vendor_id)), 0),
    'total_reviews', COALESCE((SELECT SUM(rating_count) FROM public.products
                               WHERE (_vendor_id IS NULL OR vendor_id = _vendor_id)), 0),
    'recent', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb) FROM (
        SELECT r.id, r.rating, r.title, r.comment, r.created_at,
               p.name AS product_name, p.slug AS product_slug
        FROM public.product_reviews r
        JOIN public.products p ON p.id = r.product_id
        WHERE r.status = 'published'
          AND (_vendor_id IS NULL OR p.vendor_id = _vendor_id)
        ORDER BY r.created_at DESC
        LIMIT 8
      ) t
    )
  ));

  RETURN result;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_analytics(timestamptz, timestamptz, uuid, int) TO authenticated;
