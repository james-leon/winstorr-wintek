import { createFileRoute } from "@tanstack/react-router";

// CinetPay POSTs a form-encoded notification with cpm_trans_id / cpm_site_id / cpm_trans_status.
// Never trust this body — always re-verify with the Check API before mutating the order.
export const Route = createFileRoute("/api/public/cinetpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") || "";
          let orderNumber = "";
          if (contentType.includes("application/json")) {
            const body = await request.json().catch(() => ({}));
            orderNumber = (body?.cpm_trans_id || body?.transaction_id || "") as string;
          } else {
            const form = await request.formData();
            orderNumber = String(form.get("cpm_trans_id") || form.get("transaction_id") || "");
          }
          if (!orderNumber) return new Response("missing transaction_id", { status: 400 });

          const { verifyCinetpayTransaction } = await import("@/lib/cinetpay.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const verify = await verifyCinetpayTransaction(orderNumber);

          const { data: order } = await supabaseAdmin
            .from("orders")
            .select("id, payment_status")
            .eq("order_number", orderNumber)
            .maybeSingle();
          if (!order) return new Response("order not found", { status: 404 });
          if (order.payment_status === "paid") return new Response("already paid", { status: 200 });

          if (verify.status === "paid") {
            const { error } = await supabaseAdmin.rpc("confirm_order_payment", {
              _order_id: order.id,
              _txn_id: verify.transactionId,
              _method: verify.method ?? "card",
            });
            if (error) return new Response("confirm failed: " + error.message, { status: 500 });
            const { notifyOrderEvent, notifyVendorsOfNewShipments } = await import("@/lib/notifications.server");
            await notifyOrderEvent(order.id, "payment_confirmed").catch((e) => console.error("[notify]", e));
            notifyVendorsOfNewShipments(order.id).catch((e) => console.error("[notify:vendors]", e));
            const { redeemOrderCouponIfAny } = await import("@/lib/coupons.server");
            await redeemOrderCouponIfAny(order.id).catch((e) => console.error("[redeem]", e));
            return new Response("ok", { status: 200 });

          }
          if (verify.status === "failed") {
            await supabaseAdmin
              .from("orders")
              .update({
                payment_status: "failed",
                status: "payment_failed",
                cinetpay_transaction_id: verify.transactionId,
              })
              .eq("id", order.id);
            const { notifyOrderEvent } = await import("@/lib/notifications.server");
            await notifyOrderEvent(order.id, "payment_failed").catch((e) => console.error("[notify]", e));
            return new Response("failed", { status: 200 });
          }
          return new Response("pending", { status: 200 });
        } catch (e) {
          console.error("[cinetpay-webhook]", e);
          return new Response("error", { status: 500 });
        }
      },
      GET: async () => new Response("cinetpay-webhook up", { status: 200 }),
    },
  },
});
