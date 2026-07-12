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

export const createVendorInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    // caller must be admin
    const { data: isAdmin, error: roleErr } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const token = randomToken();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin
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

    // Best-effort email
    try {
      const key = process.env.RESEND_API_KEY;
      const appUrl = process.env.APP_PUBLIC_URL || "";
      const link = `${appUrl}/vendeur/invitation/${inv.token}`;
      const subject = "Invitation à rejoindre Winstorr en tant que vendeur";
      const text = `Bonjour,\n\nVous êtes invité·e à rejoindre la marketplace Winstorr.\nAcceptez votre invitation ici : ${link}\n\nCe lien expire le ${new Date(inv.expires_at).toLocaleDateString("fr-FR")}.\n\n— L'équipe Winstorr`;
      if (key) {
        const from = process.env.RESEND_FROM || "Winstorr <onboarding@resend.dev>";
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: inv.email, subject, text }),
        });
      } else {
        console.log(`[vendor-invitation:mock] to=${inv.email} link=${link}`);
      }
    } catch (e) {
      console.error("[vendor-invitation] email failed", e);
    }

    return { id: inv.id, token: inv.token };
  });

export const revokeVendorInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("vendor_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
