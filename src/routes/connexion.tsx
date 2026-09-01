import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Store, ArrowRight } from "lucide-react";
import { readPendingInvitation, safeNextPath } from "@/lib/pending-invitation";

export const Route = createFileRoute("/connexion")({
  validateSearch: (search: Record<string, unknown>) => ({ next: safeNextPath(search["next"]) }),
  head: () => ({
    meta: [
      { title: "Se connecter ou créer un compte — Winstorr" },
      { name: "description", content: "Accédez à votre compte Winstorr en une étape simple, ou continuez en tant qu'invité." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConnexionStep1,
});

const IDENTIFIER_KEY = "winstorr:auth:identifier";

function ConnexionStep1() {
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const { user, loading } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // An invitation link opened before signing in keeps priority over /mon-compte.
  const destination = next ?? readPendingInvitation()?.path;

  useEffect(() => {
    if (loading || !user) return;
    if (destination) void nav({ to: destination });
    else void nav({ to: "/mon-compte" });
  }, [user, loading, nav, destination]);

  const looksLikeEmail = (v: string) => /.+@.+\..+/.test(v.trim());
  const looksLikePhone = (v: string) => /^\+?[\d\s().-]{6,}$/.test(v.trim());

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const value = identifier.trim();
    if (!value) return;
    if (!looksLikeEmail(value) && !looksLikePhone(value)) {
      const msg = "Entrez un email valide ou un numéro de téléphone.";
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("identifier_has_account", { _identifier: value });
      if (error) throw error;
      const exists = !!data;
      sessionStorage.setItem(
        IDENTIFIER_KEY,
        JSON.stringify({ identifier: value, exists, isEmail: looksLikeEmail(value), ts: Date.now() }),
      );
      await nav({ to: "/connexion/mot-de-passe", search: destination ? { next: destination } : {} });
    } catch (err) {
      console.error("[connexion] identifier check failed", err);
      const msg = err instanceof Error ? err.message : "Une erreur est survenue. Veuillez réessayer.";
      setErrorMsg(msg);
      toast.error(msg);
      setBusy(false);
    }
  }


  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link to="/" className="flex items-center gap-2 no-link-color">
            <img src="/favicon.png" alt="Winstorr" className="h-9 w-9" />
            <span className="font-display text-2xl tracking-wide text-primary">Winstorr</span>
          </Link>
        </div>

        <div className="rounded-md border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
          <h1 className="font-display text-xl text-foreground">Se connecter ou créer un compte</h1>
          <p className="mt-1 text-sm text-muted-foreground">Une seule étape pour commencer.</p>

          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="identifier" className="text-sm font-medium">Numéro de téléphone ou email</Label>
              <Input
                id="identifier"
                autoFocus
                inputMode="email"
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="h-11 rounded-sm border-input focus-visible:ring-secondary"
                placeholder="vous@exemple.com ou +237…"
              />
            </div>
            {errorMsg && (
              <div role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMsg}
              </div>
            )}
            <Button
              type="submit"
              disabled={busy || !identifier.trim()}
              className="h-11 w-full rounded-sm bg-gradient-to-b from-secondary to-[color-mix(in_oklab,var(--secondary)_85%,black)] text-secondary-foreground shadow-sm hover:brightness-105"
            >
              {busy ? "Vérification…" : "Continuer"}
              {!busy && <ArrowRight className="ml-1 h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            En continuant, vous acceptez les{" "}
            <Link to="/" className="text-primary underline underline-offset-2">Conditions d'utilisation</Link>{" "}
            et la{" "}
            <Link to="/" className="text-primary underline underline-offset-2">Politique de confidentialité</Link>{" "}
            de Winstorr.
          </p>
        </div>

        <div className="mt-4 rounded-md border border-border/70 bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-primary/10 text-primary">
              <Store className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Vous avez une boutique ?</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Rejoignez notre marketplace et vendez vos produits à des milliers de clients.
              </p>
              <Link
                to="/devenir-vendeur"
                className="mt-1.5 inline-block text-sm font-medium text-secondary underline underline-offset-2"
              >
                Devenir vendeur sur Winstorr →
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-5 text-center text-sm">
          <Link to="/commande" className="text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Continuer en tant qu'invité
          </Link>
        </div>
      </div>
    </div>
  );
}
