// Server-only helper: redeem a coupon after a successful payment.
// Idempotent: skips if a redemption already exists for this order.
export async function redeemOrderCouponIfAny(orderId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, coupon_code, discount_amount, customer_id, customer_email")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || !order.coupon_code || Number(order.discount_amount ?? 0) <= 0) return;

  const { count } = await supabaseAdmin
    .from("coupon_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);
  if ((count ?? 0) > 0) return;

  const { data: coupon } = await supabaseAdmin
    .from("coupons")
    .select("id")
    .eq("code", order.coupon_code)
    .maybeSingle();
  if (!coupon) return;

  const { error } = await supabaseAdmin.rpc("redeem_coupon", {
    _coupon_id: coupon.id,
    _order_id: order.id,
    _customer_id: order.customer_id,
    _customer_email: order.customer_email,
    _discount: Number(order.discount_amount),
  });
  if (error) console.error("[redeem_coupon]", error.message);
}
