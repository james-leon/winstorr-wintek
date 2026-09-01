import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { rememberPendingInvitation, clearPendingInvitation } from "@/lib/pending-invitation";


export const Route = createFileRoute("/partenaire/invitation/$token")({
  component: PartnerInvitationPage,
  head: () => ({
    meta: [
      { title: "Invitation partenaire financier — Winstorr" },
      { name: "description", content: "Acceptez votre invitation à rejoindre Winstorr en tant que partenaire financier." },
      { property: "og:title", content: "Invitation partenaire financier — Winstorr" },
      { property: "og:description", content: "Rejoignez Winstorr comme partenaire de paiement échelonné." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PartnerInvitationPage() {
  const { token } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();

  const { data: inv, isLoading } = useQuery({
    queryKey: ["financing-partner-invitation", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_financing_partner_invitation", { _token: token });
      if (error) throw error;
      return (data && data[0]) ?? null;
    },
  });

  const accept = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("accept_financing_partner_invitation", { _token: token });
      if (error) throw error;
      const result = data as { ok: boolean; reason?: string };
      if (!result.ok) throw new Error(result.reason ?? "Erreur");
      return result;
    },
    onSuccess: () => {
      toast.success("Invitation acceptée");
      void nav({ to: "/partenaire/tableau-de-bord" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || authLoading) {
    return <div className="mx-auto max-w-lg p-8 text-center text-muted-foreground">Chargement…</div>;
  }

  if (!inv) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="mb-2 font-display text-2xl">Invitation introuvable</h1>
        <p className="text-sm text-muted-foreground">Ce lien est invalide ou a été supprimé.</p>
      </div>
    );
  }

  const label = inv.partner_name ?? inv.proposed_partner_name ?? "partenaire financier";

  return (
    <div className="mx-auto max-w-lg p-8 text-center">
      <h1 className="mb-2 font-display text-2xl text-foreground">Invitation partenaire financier</h1>
      <p className="text-sm text-muted-foreground">
        Vous êtes invité·e à rejoindre Winstorr en tant que <span className="font-medium text-foreground">{label}</span>{" "}
        ({inv.email}). Vous recevrez les demandes de paiement échelonné des clients directement dans votre espace.
      </p>

      {inv.status !== "pending" ? (
        <p className="mt-6 text-sm text-destructive">Cette invitation n'est plus valide ({inv.status}).</p>
      ) : !user ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">Connectez-vous ou créez un compte avec {inv.email} pour accepter.</p>
          <Link to="/connexion" className="no-link-color">
            <Button className="w-full">Se connecter</Button>
          </Link>
        </div>
      ) : (
        <Button className="mt-6 w-full" disabled={accept.isPending} onClick={() => accept.mutate()}>
          {accept.isPending ? "Validation…" : "Accepter l'invitation"}
        </Button>
      )}
    </div>
  );
}
