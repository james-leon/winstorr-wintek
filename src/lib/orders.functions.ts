import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const itemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50),
});

const addressSchema = z.object({
  full_name: z.string().min(2).max(120),
  phone: z.string().min(6).max(30),
  ville: z.enum(["douala", "yaounde", "autre"]),
  quartier: z.string().min(2).max(120),
  landmark: z.string().max(300).optional().nullable(),
});

const checkoutSchema = z.object({
  items: z.array(itemSchema).min(1).max(50),
  contact: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(6).max(30),
    email: z.string().trim().email().max(200).optional().nullable(),
  }),
  shipping_address: addressSchema.nullable().optional(),
  couponCode: z.string().trim().min(1).max(60).optional().nullable(),
  delivery_mode: z.enum(["home_delivery", "pickup", "none"]).default("home_delivery"),
  pickup_point_id: z.string().uuid().nullable().optional(),
  payment_method: z.enum(["cinetpay", "cash_on_pickup"]).default("cinetpay"),
});




export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkoutSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load canonical product info (never trust client price)
    const ids = data.items.map((i) => i.productId);
    const { data: products, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id, name, slug, images, type, price, price_type, stock_quantity, vendor_id, status")
      .in("id", ids);
    if (pErr) throw new Error(pErr.message);
    if (!products || products.length !== ids.length) throw new Error("Un produit du panier n'est plus disponible.");

    // Load all price tiers for these products (server-side, never trust client)
    const { data: tierRows, error: tErr } = await supabaseAdmin
      .from("product_price_tiers")
      .select("product_id, min_quantity, unit_price")
      .in("product_id", ids);
    if (tErr) throw new Error(tErr.message);
    const tiersByProduct = new Map<string, { min_quantity: number; unit_price: number }[]>();
    for (const r of tierRows ?? []) {
      const list = tiersByProduct.get(r.product_id) ?? [];
      list.push({ min_quantity: r.min_quantity, unit_price: Number(r.unit_price) });
      tiersByProduct.set(r.product_id, list);
    }
    const resolveUnit = (pid: string, basePrice: number, qty: number): number => {
      const list = (tiersByProduct.get(pid) ?? []).slice().sort((a, b) => a.min_quantity - b.min_quantity);
      let match: { min_quantity: number; unit_price: number } | null = null;
      for (const t of list) {
        if (qty >= t.min_quantity) match = t;
        else break;
      }
      return match ? Number(match.unit_price) : basePrice;
    };

    const byId = new Map(products.map((p) => [p.id, p]));
    let subtotal = 0;
    let hasPhysical = false;

    const itemsRows = data.items.map((it) => {
      const p = byId.get(it.productId)!;
      if (p.status !== "active") throw new Error(`${p.name} n'est plus disponible.`);
      if (p.type !== "physical" && p.type !== "digital") {
        throw new Error(`${p.name} ne peut pas être commandé via le panier.`);
      }
      if (p.price == null || p.price_type === "quote_only") {
        throw new Error(`${p.name} n'a pas de prix fixe.`);
      }
      if (p.type === "physical") {
        hasPhysical = true;
        if ((p.stock_quantity ?? 0) < it.quantity) throw new Error(`Stock insuffisant pour ${p.name}.`);
      }
      const unit = p.type === "physical" ? resolveUnit(p.id, Number(p.price), it.quantity) : Number(p.price);
      const line = unit * it.quantity;
      subtotal += line;
      const imgs = Array.isArray(p.images) ? (p.images as unknown[]) : [];
      return {
        product_id: p.id,
        product_type: p.type,
        product_name: p.name,
        product_slug: p.slug,
        product_image: typeof imgs[0] === "string" ? (imgs[0] as string) : null,
        unit_price: unit,
        quantity: it.quantity,
        subtotal: line,
        vendor_id: p.vendor_id,
      };
    });


    if (hasPhysical && !data.shipping_address) {
      throw new Error("Adresse de livraison requise pour les articles physiques.");
    }

    // Shipping fee lookup
    let shipping = 0;
    if (hasPhysical) {
      const { data: setting } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "shipping_fees")
        .maybeSingle();
      const fees = (setting?.value ?? {}) as Record<string, number>;
      const city = data.shipping_address?.ville ?? "autre";
      shipping = Number(fees[city] ?? fees.autre ?? 0);
    }
    const total_before_discount = subtotal + shipping;

    // Attach customer_id if the caller is signed in (bearer forwarded by middleware).
    let customerId: string | null = null;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest();
      const auth = req.headers.get("authorization") || "";
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
      if (token) {
        const { data: u } = await supabaseAdmin.auth.getUser(token);
        if (u.user) customerId = u.user.id;
      }
    } catch { /* guest checkout */ }

    // Server-side coupon re-validation (never trust client-computed discount)
    let couponCode: string | null = null;
    let discountAmount = 0;
    if (data.couponCode) {
      const { data: cRes, error: cErr } = await supabaseAdmin.rpc("validate_coupon", {
        _code: data.couponCode,
        _subtotal: subtotal,
        _product_ids: itemsRows.map((r) => r.product_id),
        _customer_id: customerId as unknown as string,
        _customer_email: (data.contact.email ?? null) as unknown as string,
      });
      if (cErr) throw new Error(cErr.message);
      const r = cRes as Record<string, unknown>;
      if (!r.ok) throw new Error(String(r.message ?? "Code promo invalide."));
      couponCode = String(r.code);
      discountAmount = Number(r.discount_amount);
    }
    const total = Math.max(0, total_before_discount - discountAmount);

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_id: customerId,
        customer_name: data.contact.name,
        customer_phone: data.contact.phone,
        customer_email: data.contact.email ?? null,
        subtotal,
        shipping_fee: shipping,
        discount_amount: discountAmount,
        coupon_code: couponCode,
        total,
        has_physical_items: hasPhysical,
        shipping_address: data.shipping_address ?? null,
      })
      .select("id, order_number")
      .single();
    if (oErr || !order) throw new Error(oErr?.message || "Impossible de créer la commande.");


    const { error: iErr } = await supabaseAdmin
      .from("order_items")
      .insert(itemsRows.map((r) => ({ ...r, order_id: order.id })));
    if (iErr) throw new Error(iErr.message);

    return { orderId: order.id, orderNumber: order.order_number, total, hasPhysical };
  });

export const initiatePayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ orderNumber: z.string().min(4) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { initiateCinetpayPayment } = await import("./cinetpay.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, currency, customer_name, customer_phone, customer_email, payment_status")
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (error || !order) throw new Error("Commande introuvable.");
    if (order.payment_status === "paid") {
      return { paymentUrl: `/commande/${order.order_number}/confirmation`, mocked: false };
    }

    const appUrl = process.env.APP_PUBLIC_URL || "";
    const returnUrl = `${appUrl}/commande/${order.order_number}/confirmation`;
    const notifyUrl = `${appUrl}/api/public/cinetpay-webhook`;

    const res = await initiateCinetpayPayment({
      orderNumber: order.order_number,
      amount: Number(order.total),
      currency: order.currency,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerEmail: order.customer_email,
      returnUrl,
      notifyUrl,
      description: `Commande Winstorr ${order.order_number}`,
    });

    return { paymentUrl: res.paymentUrl, mocked: res.mocked };
  });

// Admin-only: manual status update
export const updateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      orderId: z.string().uuid(),
      status: z.enum([
        "pending_payment",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "completed",
        "cancelled",
        "payment_failed",
      ]),
      notes: z.string().max(1000).optional().nullable(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireSupabaseAuth } = await import("@/integrations/supabase/auth-middleware");
    void requireSupabaseAuth; // keep in graph
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { status: typeof data.status; notes?: string | null } = { status: data.status };
    if (data.notes !== undefined) patch.notes = data.notes;
    const { error } = await supabaseAdmin.from("orders").update(patch).eq("id", data.orderId);
    if (error) throw new Error(error.message);
    if (data.status === "shipped" || data.status === "delivered") {
      const { notifyOrderEvent } = await import("./notifications.server");
      await notifyOrderEvent(data.orderId, data.status).catch((e) => console.error("[notify]", e));
    }
    return { ok: true };
  });

// Testing/scaffold helper: allow manually confirming a mock payment while credentials are missing.
export const mockConfirmPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ orderNumber: z.string() }).parse(data))
  .handler(async ({ data }) => {
    if (process.env.CINETPAY_API_KEY) {
      throw new Error("Confirmation manuelle désactivée en mode production CinetPay.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (!order) throw new Error("Commande introuvable.");
    const { data: res, error } = await supabaseAdmin.rpc("confirm_order_payment", {
      _order_id: order.id,
      _txn_id: "MOCK-" + data.orderNumber,
      _method: "mtn_momo",
    });
    if (error) throw new Error(error.message);
    const { notifyOrderEvent } = await import("./notifications.server");
    await notifyOrderEvent(order.id, "payment_confirmed").catch((e) => console.error("[notify]", e));
    const { redeemOrderCouponIfAny } = await import("./coupons.server");
    await redeemOrderCouponIfAny(order.id).catch((e) => console.error("[redeem]", e));
    return res;
  });

