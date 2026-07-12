import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const validateSchema = z.object({
  code: z.string().trim().min(1).max(60),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(50) })).min(1),
  customerEmail: z.string().trim().email().max(200).optional().nullable(),
});

export type CouponValidation =
  | {
      ok: true;
      couponId: string;
      code: string;
      discountType: "percentage" | "fixed_amount";
      discountValue: number;
      discountAmount: number;
      eligibleSubtotal: number;
    }
  | { ok: false; reason: string; message: string };

export const validateCouponFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => validateSchema.parse(data))
  .handler(async ({ data }): Promise<CouponValidation> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Get customer id from bearer if signed in
    let customerId: string | null = null;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const auth = getRequest().headers.get("authorization") || "";
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
      if (token) {
        const { data: u } = await supabaseAdmin.auth.getUser(token);
        if (u.user) customerId = u.user.id;
      }
    } catch { /* guest */ }

    // Compute canonical subtotal from products (with tier pricing)
    const ids = data.items.map((i) => i.productId);
    const { data: products, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id, price, price_type, status, type")
      .in("id", ids);
    if (pErr) throw new Error(pErr.message);
    const { data: tierRows } = await supabaseAdmin
      .from("product_price_tiers")
      .select("product_id, min_quantity, unit_price")
      .in("product_id", ids);
    const tiersByProduct = new Map<string, { min_quantity: number; unit_price: number }[]>();
    for (const r of tierRows ?? []) {
      const list = tiersByProduct.get(r.product_id) ?? [];
      list.push({ min_quantity: r.min_quantity, unit_price: Number(r.unit_price) });
      tiersByProduct.set(r.product_id, list);
    }
    const byId = new Map((products ?? []).map((p) => [p.id, p]));
    let subtotal = 0;
    const productIds: string[] = [];
    for (const it of data.items) {
      const p = byId.get(it.productId);
      if (!p || p.status !== "active" || p.price == null || p.price_type === "quote_only") continue;
      let unit = Number(p.price);
      if (p.type === "physical") {
        const list = (tiersByProduct.get(p.id) ?? []).slice().sort((a, b) => a.min_quantity - b.min_quantity);
        let match: { min_quantity: number; unit_price: number } | null = null;
        for (const t of list) { if (it.quantity >= t.min_quantity) match = t; else break; }
        if (match) unit = Number(match.unit_price);
      }
      subtotal += unit * it.quantity;
      productIds.push(p.id);
    }


    const { data: res, error } = await supabaseAdmin.rpc("validate_coupon", {
      _code: data.code,
      _subtotal: subtotal,
      _product_ids: productIds,
      _customer_id: customerId as unknown as string,
      _customer_email: (data.customerEmail ?? null) as unknown as string,
    });

    if (error) throw new Error(error.message);

    const r = res as Record<string, unknown>;
    if (r.ok) {
      return {
        ok: true,
        couponId: String(r.coupon_id),
        code: String(r.code),
        discountType: r.discount_type as "percentage" | "fixed_amount",
        discountValue: Number(r.discount_value),
        discountAmount: Number(r.discount_amount),
        eligibleSubtotal: Number(r.eligible_subtotal),
      };
    }
    return { ok: false, reason: String(r.reason ?? "invalid"), message: String(r.message ?? "Code invalide.") };
  });
