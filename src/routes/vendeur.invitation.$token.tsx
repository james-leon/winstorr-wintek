import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/vendeur/invitation/$token")({
  component: InvitationPage,
  head: () => ({ meta: [{ title: "Invitation vendeur — Winstorr" }] }),
});

function InvitationPage() {
  const { token } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();

  const { data: inv, isLoading } = useQuery({
    queryKey: ["vendor-invitation", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vendor_invitation", { _token: token });
      if (error) throw error;
      return (data && data[0]) ?? null;
    },
  });

  const accept = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("accept_vendor_invitation", { _token: token });
      if (error) throw error;
      const result = data as { ok: boolean; reason?: string };
      if (!result.ok) throw new Error(result.reason ?? "Erreur");
      return result;
    },
    onSuccess: () => {
      toast.success("Invitation acceptée");
      void nav({ to: "/vendeur/tableau-de-bord" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || authLoading) {
    return <div className="mx-auto max-w-lg p-8 text-center text-muted-foreground">Chargement...</div>;
  }

  if (!inv) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="mb-2 font-display text-2xl">Invitation introuvable</h1>
        <p className="text-sm text-muted-foreground">Ce lien est invalide ou a été supprimé.</p>
      </div>
    );
  }

  const expired = new Date(inv.expires_at) < new Date();
  const isPending = inv.status === "pending" && !expired;

  return (
    <div className="mx-auto max-w-lg p-8">
      <div className="rounded-sm border border-border bg-card p-6">
        <h1 className="mb-2 font-display text-2xl">Rejoindre Winstorr</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Invitation envoyée à <strong>{inv.email}</strong>.
        </p>
        <div className="mb-6 rounded-sm bg-muted/40 p-3 text-sm">
          <div><strong>Vendeur :</strong> {inv.vendor_name ?? inv.proposed_vendor_name ?? "—"}</div>
          <div><strong>Statut :</strong> {inv.status}</div>
          <div><strong>Expire le :</strong> {new Date(inv.expires_at).toLocaleDateString("fr-FR")}</div>
        </div>

        {!isPending && (
          <p className="text-sm text-destructive">
            {inv.status === "accepted"
              ? "Cette invitation a déjà été acceptée."
              : inv.status === "revoked"
              ? "Cette invitation a été révoquée."
              : "Cette invitation a expiré."}
          </p>
        )}

        {isPending && !user && (
          <div className="space-y-3">
            <p className="text-sm">Connectez-vous ou créez un compte avec l'adresse <strong>{inv.email}</strong> pour accepter.</p>
            <Button asChild className="w-full">
              <Link to="/auth" search={{ next: `/vendeur/invitation/${token}` } as never}>Se connecter / S'inscrire</Link>
            </Button>
          </div>
        )}

        {isPending && user && (
          <div className="space-y-3">
            {user.email?.toLowerCase() !== inv.email.toLowerCase() && (
              <p className="rounded-sm bg-warning/10 p-2 text-xs text-warning">
                Vous êtes connecté·e en tant que {user.email}. L'invitation cible {inv.email} — vous pouvez tout de même accepter avec ce compte.
              </p>
            )}
            <Button className="w-full" onClick={() => accept.mutate()} disabled={accept.isPending}>
              {accept.isPending ? "..." : "Accepter l'invitation"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
