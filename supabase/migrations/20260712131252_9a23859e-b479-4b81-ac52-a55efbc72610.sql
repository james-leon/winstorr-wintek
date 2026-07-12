
DROP FUNCTION public.get_order_by_number(text);
CREATE FUNCTION public.get_order_by_number(_order_number text)
 RETURNS TABLE(id uuid, order_number text, status order_status, payment_status payment_status, subtotal numeric, shipping_fee numeric, discount_amount numeric, coupon_code text, total numeric, currency text, customer_name text, customer_email text, created_at timestamp with time zone, has_physical_items boolean, shipping_address jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, order_number, status, payment_status, subtotal, shipping_fee, discount_amount, coupon_code, total, currency,
         customer_name, customer_email, created_at, has_physical_items, shipping_address
  FROM public.orders WHERE order_number = _order_number;
$$;
GRANT EXECUTE ON FUNCTION public.get_order_by_number(text) TO anon, authenticated;
