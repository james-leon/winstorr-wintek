import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Winstorr" },
      { name: "description", content: "Connectez-vous ou créez un compte Winstorr." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) void nav({ to: "/" });
  }, [user, loading, nav]);

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl text-primary">Winstorr</h1>
        <p className="mt-1 text-sm text-muted-foreground">Accédez à votre espace</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Connexion</TabsTrigger>
            <TabsTrigger value="signup">Créer un compte</TabsTrigger>
          </TabsList>
          <TabsContent value="signin"><SignIn /></TabsContent>
          <TabsContent value="signup"><SignUp /></TabsContent>
        </Tabs>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link to="/" className="underline underline-offset-2">← Retour à l'accueil</Link>
      </p>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setBusy(false);
        if (error) toast.error(error.message);
        else toast.success("Connecté");
      }}
      className="mt-4 space-y-3"
    >
      <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><Label>Mot de passe</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "..." : "Se connecter"}</Button>
    </form>
  );
}

function SignUp() {
  const [full_name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name, phone }, emailRedirectTo: `${window.location.origin}/` },
        });
        setBusy(false);
        if (error) toast.error(error.message);
        else toast.success("Compte créé. Vérifiez votre email si nécessaire.");
      }}
      className="mt-4 space-y-3"
    >
      <div><Label>Nom complet</Label><Input required value={full_name} onChange={(e) => setName(e.target.value)} /></div>
      <div><Label>Téléphone</Label><Input required value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><Label>Mot de passe</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "..." : "Créer un compte"}</Button>
      <p className="text-xs text-muted-foreground">Le premier compte créé devient automatiquement administrateur.</p>
    </form>
  );
}
