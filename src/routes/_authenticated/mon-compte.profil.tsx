import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/mon-compte/profil")({
  head: () => ({ meta: [{ title: "Profil — Winstorr" }, { name: "robots", content: "noindex" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setEmail(user?.email ?? "");
  }, [profile, user?.email]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null, phone: phone.trim() || null })
        .eq("id", user!.id);
      if (error) throw error;
      if (email && email !== user!.email) {
        const { error: eErr } = await supabase.auth.updateUser({ email });
        if (eErr) throw eErr;
        toast.info("Vérifiez votre nouvelle adresse email pour confirmer le changement.");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["account-stats"] });
      toast.success("Profil mis à jour.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const changePw = useMutation({
    mutationFn: async () => {
      if (newPw.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.");
      if (newPw !== confirmPw) throw new Error("La confirmation ne correspond pas.");
      // Re-authenticate by signing in again with current password
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPw,
      });
      if (signErr) throw new Error("Mot de passe actuel incorrect.");
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
    },
    onSuccess: () => {
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      toast.success("Mot de passe mis à jour.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-sm border border-border bg-card p-4">
        <h2 className="font-semibold mb-3">Informations personnelles</h2>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); saveProfile.mutate(); }}
        >
          <div>
            <Label>Nom complet</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={30} />
          </div>
          <div className="sm:col-span-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              Un email de confirmation vous sera envoyé si vous modifiez cette adresse.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saveProfile.isPending}>
              {saveProfile.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-sm border border-border bg-card p-4">
        <h2 className="font-semibold mb-3">Mot de passe</h2>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); changePw.mutate(); }}
        >
          <div className="sm:col-span-2">
            <Label>Mot de passe actuel</Label>
            <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required autoComplete="current-password" />
          </div>
          <div>
            <Label>Nouveau mot de passe</Label>
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>
          <div>
            <Label>Confirmer</Label>
            <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" variant="secondary" disabled={changePw.isPending}>
              {changePw.isPending ? "Mise à jour…" : "Changer le mot de passe"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-sm border border-border bg-card p-4">
        <h2 className="font-semibold mb-1">Suppression du compte</h2>
        <p className="text-sm text-muted-foreground">
          Pour demander la suppression de votre compte, contactez notre support. Cette fonctionnalité en libre-service arrivera prochainement.
        </p>
      </section>
    </div>
  );
}
