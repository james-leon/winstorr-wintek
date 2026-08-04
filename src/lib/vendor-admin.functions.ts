import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ vendor_id: z.string().uuid() });

async function requireAdmin(context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { data: isAdmin, error } = await context.supabase
    .rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Forbidden");
}

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Admin = Awaited<ReturnType<typeof loadAdmin>>;

async function countRows(admin: Admin, table: string, column: string, value: string) {
  const { count, error } = await admin
    .from(table as never)
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function gatherImpact(admin: Admin, vendorId: string) {
  const [products, followers, withdrawals, commissionRules, members, invitations, orderItems] = await Promise.all([
    countRows(admin, "products", "vendor_id", vendorId),
    countRows(admin, "store_follows", "vendor_id", vendorId),
    countRows(admin, "vendor_withdrawal_requests", "vendor_id", vendorId),
    countRows(admin, "commission_rules", "scope_id", vendorId),
    countRows(admin, "vendor_members", "vendor_id", vendorId),
    countRows(admin, "vendor_invitations", "vendor_id", vendorId),
    countRows(admin, "order_items", "vendor_id", vendorId),
  ]);
  return { products, followers, withdrawals, commissionRules, members, invitations, orderItems };
}

export const getVendorDeletionImpact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const admin = await loadAdmin();
    const { data: vendor, error } = await admin
      .from("vendors")
      .select("id, name, type")
      .eq("id", data.vendor_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!vendor) throw new Error("Vendeur introuvable");
    const impact = await gatherImpact(admin, data.vendor_id);
    return { vendor, ...impact, blocked: impact.orderItems > 0 || vendor.type === "internal" };
  });

export const deleteVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const admin = await loadAdmin();
    const vendorId = data.vendor_id;

    const { data: vendor, error: vErr } = await admin
      .from("vendors")
      .select("id, name, slug, type")
      .eq("id", vendorId)
      .maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!vendor) throw new Error("Vendeur introuvable");
    if (vendor.type === "internal") {
      throw new Error("Le vendeur officiel Winstorr ne peut pas être supprimé.");
    }

    const impact = await gatherImpact(admin, vendorId);
    if (impact.orderItems > 0) {
      throw new Error(
        "Ce vendeur a un historique de commandes, il ne peut pas être supprimé définitivement. Vous pouvez le suspendre à la place.",
      );
    }

    const { data: prods, error: pErr } = await admin.from("products").select("id").eq("vendor_id", vendorId);
    if (pErr) throw new Error(pErr.message);
    const productIds = (prods ?? []).map((p) => p.id);

    const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

    if (productIds.length) {
      fail((await admin.from("product_questions").delete().in("product_id", productIds)).error);
      fail((await admin.from("product_reviews").delete().in("product_id", productIds)).error);
      fail((await admin.from("product_price_tiers").delete().in("product_id", productIds)).error);
      fail((await admin.from("product_variants").delete().in("product_id", productIds)).error);
      fail((await admin.from("wishlist_items").delete().in("product_id", productIds)).error);
      fail((await admin.from("financing_requests").delete().in("product_id", productIds)).error);
      fail((await admin.from("products").delete().in("id", productIds)).error);
    }

    fail((await admin.from("store_follows").delete().eq("vendor_id", vendorId)).error);
    fail((await admin.from("vendor_withdrawal_requests").delete().eq("vendor_id", vendorId)).error);
    fail((await admin.from("vendor_announcements").delete().eq("vendor_id", vendorId)).error);
    fail((await admin.from("coupons").delete().eq("vendor_id", vendorId)).error);
    fail((await admin.from("commission_rules").delete().eq("scope", "vendor").eq("scope_id", vendorId)).error);
    fail((await admin.from("vendor_storefronts").delete().eq("vendor_id", vendorId)).error);
    fail((await admin.from("vendor_members").delete().eq("vendor_id", vendorId)).error);
    fail((await admin.from("vendor_invitations").delete().eq("vendor_id", vendorId)).error);
    fail((await admin.from("vendors").delete().eq("id", vendorId)).error);

    await admin.from("admin_audit_log").insert({
      action: "vendor.deleted",
      entity_type: "vendor",
      entity_id: vendorId,
      actor_id: context.userId,
      metadata: { name: vendor.name, slug: vendor.slug, ...impact } as never,
    });

    return { ok: true, deleted: impact };
  });
