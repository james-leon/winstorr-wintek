import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RETURN_WINDOW_DAYS = 7;

const createSchema = z.object({
  orderNumber: z.string().min(4),
  orderItemId: z.string().uuid().nullable().optional(),
  reason: z.enum(["defective", "wrong_item", "not_as_described", "changed_mind", "other"]),
  description: z.string().trim().min(10).max(2000),
  photoUrls: z.array(z.string().url()).max(5).optional(),
});

export const createReturnRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, status, payment_status, has_physical_items, created_at, customer_id")
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (error || !order) throw new Error("Commande introuvable.");
    if (order.customer_id !== userId) throw new Error("Vous n'êtes pas propriétaire de cette commande.");

    const eligible =
      (order.has_physical_items && order.status === "delivered") ||
      (!order.has_physical_items && order.payment_status === "paid");
    if (!eligible) throw new Error("Cette commande n'est pas éligible à un retour.");

    if (order.has_physical_items) {
      const ageDays = (Date.now() - new Date(order.created_at).getTime()) / 86400000;
      if (ageDays > RETURN_WINDOW_DAYS) {
        throw new Error(`Délai de retour dépassé (${RETURN_WINDOW_DAYS} jours après livraison).`);
      }
    }

    const { data: inserted, error: iErr } = await supabase
      .from("return_requests")
      .insert({
        order_id: order.id,
        order_item_id: data.orderItemId ?? null,
        customer_id: userId,
        reason: data.reason,
        description: data.description,
        photo_urls: data.photoUrls ?? [],
      })
      .select("id")
      .single();
    if (iErr) throw new Error(iErr.message);
    return { ok: true, id: inserted.id };
  });

const updateSchema = z.object({
  returnId: z.string().uuid(),
  status: z.enum(["under_review", "approved", "rejected", "refunded", "exchanged"]),
  resolutionNotes: z.string().max(2000).optional().nullable(),
  refundAmount: z.number().nonnegative().optional().nullable(),
});

export const updateReturnRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Réservé au personnel.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { status: data.status };
    if (data.resolutionNotes !== undefined) patch.resolution_notes = data.resolutionNotes;
    if (data.refundAmount !== undefined) patch.refund_amount = data.refundAmount;

    const { error } = await supabaseAdmin.from("return_requests").update(patch).eq("id", data.returnId);
    if (error) throw new Error(error.message);

    if (data.status === "approved" || data.status === "rejected" || data.status === "refunded") {
      const { notifyReturnDecision } = await import("./notifications.server");
      await notifyReturnDecision(data.returnId, data.status);
    }
    return { ok: true };
  });
