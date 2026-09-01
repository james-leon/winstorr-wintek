import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { readPendingInvitation, clearPendingInvitation } from "@/lib/pending-invitation";

/**
 * Consumes a stored invitation token as soon as a session exists, wherever the
 * user lands after sign-up / sign-in (including the email-confirmation return
 * to "/"). Does nothing when no invitation is pending, so existing vendors and
 * ordinary customers are untouched.
 */
export function PendingInvitationApplier() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (loading || !user || done.current) return;
    const pending = readPendingInvitation();
    if (!pending) return;
    done.current = true;

    void (async () => {
      const rpc =
        pending.kind === "vendor" ? "accept_vendor_invitation" : "accept_financing_partner_invitation";
      const { data, error } = await supabase.rpc(rpc, { _token: pending.token });
      const result = (data ?? null) as { ok: boolean; reason?: string } | null;

      if (error) {
        console.error("[invitation] auto-accept failed", error);
        return; // keep the token; the invitation page can retry
      }

      const target =
        pending.kind === "vendor" ? "/vendeur/tableau-de-bord" : "/partenaire/tableau-de-bord";

      if (result?.ok) {
        clearPendingInvitation();
        toast.success(pending.kind === "vendor" ? "Votre boutique est activée" : "Invitation acceptée");
        void nav({ to: target });
        return;
      }

      // Already consumed by this same account → just send them to their space.
      if (result?.reason === "not_pending") {
        clearPendingInvitation();
        void nav({ to: target });
        return;
      }

      clearPendingInvitation();
      toast.error(
        result?.reason === "expired"
          ? "Cette invitation a expiré. Contactez Wintek pour en recevoir une nouvelle."
          : "Invitation invalide.",
      );
    })();
  }, [user, loading, nav]);

  return null;
}
