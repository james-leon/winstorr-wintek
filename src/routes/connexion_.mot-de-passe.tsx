import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Pencil } from "lucide-react";
import { readPendingInvitation, safeNextPath } from "@/lib/pending-invitation";

export const Route = createFileRoute("/connexion_/mot-de-passe")({
  validateSearch: (search: Record<string, unknown>) => ({ next: safeNextPath(search["next"]) }),
  head: () => ({
    meta: [
      { title: "Mot de passe — Winstorr" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConnexionStep2,
});

const IDENTIFIER_KEY = "winstorr:auth:identifier";

type StoredIdentifier = { identifier: string; exists: boolean; isEmail: boolean; ts: number };

function ConnexionStep2() {
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const { user, loading } = useAuth();
  const [stored, setStored] = useState<StoredIdentifier | null>(null);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  // Survives sign-up: the invitation path is resolved from the URL or storage,
  // never from state that the auth redirect would wipe.
  const destination = next ?? readPendingInvitation()?.path;

  useEffect(() => {
    if (loading || !user) return;
    if (destination) void nav({ to: destination });
    else void nav({ to: "/mon-compte" });
  }, [user, loading, nav, destination]);


  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(IDENTIFIER_KEY);
    if (!raw) {
      void nav({ to: "/connexion" });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as StoredIdentifier;
      if (!parsed.identifier || Date.now() - parsed.ts > 15 * 60_000) {
        sessionStorage.removeItem(IDENTIFIER_KEY);
        void nav({ to: "/connexion" });
        return;
      }
      setStored(parsed);
    } catch {
      void nav({ to: "/connexion" });
    }
  }, [nav]);

  if (!stored) return null;

  const isSignup = !stored.exists;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stored) return;
    setBusy(true);
    try {
      if (isSignup) {
        if (!stored.isEmail) {
          toast.error("La création de compte par téléphone n'est pas encore prise en charge. Utilisez un email.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: stored.identifier,
          password,
          options: {
            data: { full_name: fullName, phone: "" },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        sessionStorage.removeItem(IDENTIFIER_KEY);
        toast.success("Compte créé. Vérifiez votre email si nécessaire.");
      } else {
        if (!stored.isEmail) {
          toast.error("Connexion par téléphone à venir. Utilisez votre email.");
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: stored.identifier,
          password,
        });
        if (error) throw error;
        sessionStorage.removeItem(IDENTIFIER_KEY);
        toast.success("Connecté");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur — réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function onResetPassword() {
    if (!stored?.isEmail) {
      toast.error("La réinitialisation nécessite un email.");
      return;
    }
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(stored.identifier, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      toast.success("Email de réinitialisation envoyé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur — réessayez.");
    } finally {
      setSendingReset(false);
    }
  }

  function goBack() {
    void nav({ to: "/connexion", search: destination ? { next: destination } : {} });
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
          <h1 className="font-display text-xl text-foreground">
            {isSignup ? "Créer votre compte" : "Bienvenue"}
          </h1>

          <div className="mt-3 flex items-center justify-between rounded-sm border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="min-w-0 truncate text-foreground">{stored.identifier}</span>
            <button
              type="button"
              onClick={goBack}
              className="ml-2 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-secondary hover:underline"
            >
              <Pencil className="h-3 w-3" /> Modifier
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            {isSignup && (
              <div className="space-y-1.5">
                <Label htmlFor="full_name" className="text-sm font-medium">Nom complet</Label>
                <Input
                  id="full_name"
                  autoFocus
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 rounded-sm"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                {isSignup ? "Choisissez un mot de passe" : "Mot de passe"}
              </Label>
              <Input
                id="password"
                type="password"
                autoFocus={!isSignup}
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-sm focus-visible:ring-secondary"
              />
            </div>
            <Button
              type="submit"
              disabled={busy || !password}
              className="h-11 w-full rounded-sm bg-gradient-to-b from-secondary to-[color-mix(in_oklab,var(--secondary)_85%,black)] text-secondary-foreground shadow-sm hover:brightness-105"
            >
              {busy ? "…" : isSignup ? "Créer mon compte" : "Se connecter"}
              {!busy && <ArrowRight className="ml-1 h-4 w-4" />}
            </Button>
          </form>

          {!isSignup && (
            <button
              type="button"
              onClick={onResetPassword}
              disabled={sendingReset}
              className="mt-3 text-sm text-secondary hover:underline disabled:opacity-60"
            >
              {sendingReset ? "Envoi…" : "Mot de passe oublié ?"}
            </button>
          )}

          {isSignup && (
            <p className="mt-3 text-xs text-muted-foreground">
              Le premier compte créé devient automatiquement administrateur.
            </p>
          )}
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
