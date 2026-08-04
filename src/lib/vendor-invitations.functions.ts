import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  email: z.string().trim().email().max(255),
  proposed_vendor_name: z.string().trim().min(2).max(120).optional().nullable(),
  vendor_id: z.string().uuid().optional().nullable(),
});

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Invitations are shared manually by the admin (copy link / WhatsApp).
// No automatic email is sent — see admin.vendeurs.tsx.


async function requireAdmin(context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { data: isAdmin, error } = await context.supabase
    .rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Forbidden");
}

async function logAudit(
  admin: Awaited<ReturnType<typeof loadAdmin>>,
  action: string,
  entityId: string,
  actorId: string,
  metadata: Record<string, unknown>,
) {
  await admin.from("admin_audit_log").insert({
    action,
    entity_type: "vendor_invitation",
    entity_id: entityId,
    actor_id: actorId,
    metadata: metadata as never,
  });
}

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const createVendorInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const admin = await loadAdmin();
    const token = randomToken();
    const { data: inv, error } = await admin
      .from("vendor_invitations")
      .insert({
        email: data.email.toLowerCase(),
        proposed_vendor_name: data.proposed_vendor_name || null,
        vendor_id: data.vendor_id || null,
        token,
        invited_by: context.userId,
      })
      .select("id, token, email, expires_at")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(admin, "vendor_invitation.created", inv.id, context.userId, { email: inv.email });

    return { id: inv.id, token: inv.token, email: inv.email, expires_at: inv.expires_at };

  });

export const revokeVendorInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const admin = await loadAdmin();
    const { data: updated, error } = await admin
      .from("vendor_invitations")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "pending")
      .select("id, email")
      .single();
    if (error) throw new Error(error.message);
    await logAudit(admin, "vendor_invitation.revoked", data.id, context.userId, { email: updated?.email });
    return { ok: true };
  });

export const resendVendorInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const admin = await loadAdmin();

    const { data: existing, error: readErr } = await admin
      .from("vendor_invitations")
      .select("id, email, status, expires_at")
      .eq("id", data.id)
      .single();
    if (readErr) throw new Error(readErr.message);
    if (!existing) throw new Error("Invitation introuvable");
    if (existing.status !== "pending" && existing.status !== "expired") {
      throw new Error("Seules les invitations en attente ou expirées peuvent être renvoyées.");
    }

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { error: updErr } = await admin
      .from("vendor_invitations")
      .update({ token, expires_at: expiresAt, status: "pending" })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    await logAudit(admin, "vendor_invitation.resent", data.id, context.userId, { email: existing.email });

    return { ok: true, token, email: existing.email, expires_at: expiresAt };

  });

export const deleteVendorInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const admin = await loadAdmin();

    const { data: existing, error: readErr } = await admin
      .from("vendor_invitations")
      .select("id, email, status, expires_at, revoked_at, created_at")
      .eq("id", data.id)
      .single();
    if (readErr) throw new Error(readErr.message);
    if (!existing) throw new Error("Invitation introuvable");

    const expiredByDate = new Date(existing.expires_at).getTime() < Date.now();
    const deletable =
      existing.status === "revoked" ||
      existing.status === "expired" ||
      (existing.status === "pending" && expiredByDate);
    if (!deletable) {
      throw new Error("Seules les invitations révoquées ou expirées peuvent être supprimées.");
    }


    const { error } = await admin.from("vendor_invitations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await logAudit(admin, "vendor_invitation.deleted", data.id, context.userId, {
      email: existing.email, prior_status: existing.status,
    });

    return { ok: true };
  });
