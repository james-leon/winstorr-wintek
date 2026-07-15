import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Plus, RotateCw, Trash2, XCircle, CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  createVendorInvitation,
  revokeVendorInvitation,
  resendVendorInvitation,
  deleteVendorInvitation,
} from "@/lib/vendor-invitations.functions";

export const Route = createFileRoute("/_authenticated/admin/vendeurs")({
  component: AdminVendors,
});

function AdminVendors() {
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: vendors = [] } = useQuery({
    queryKey: ["admin-vendors-full"],
    queryFn: async () => {
      const [{ data: vs, error: e1 }, { data: mems, error: e2 }] = await Promise.all([
        supabase.from("vendors").select("id, name, slug, status, type, contact_email, created_at").order("name"),
        supabase.from("vendor_members").select("vendor_id"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const counts = new Map<string, number>();
      for (const m of mems ?? []) counts.set(m.vendor_id, (counts.get(m.vendor_id) ?? 0) + 1);
      return (vs ?? []).map((v) => ({ ...v, members: counts.get(v.id) ?? 0 }));
    },
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["admin-vendor-invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_invitations")
        .select("id, email, proposed_vendor_name, vendor_id, token, status, expires_at, created_at, revoked_at, last_email_status, last_email_sent_at, last_email_error")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const vendorNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of vendors) m.set(v.id, v.name);
    return m;
  }, [vendors]);

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accepted" | "revoked" | "expired">("all");
  const filteredInvitations = useMemo(() => {
    if (statusFilter === "all") return invitations;
    return invitations.filter((i) => i.status === statusFilter);
  }, [invitations, statusFilter]);
    },
    onSuccess: () => { toast.success("Vendeur mis à jour"); qc.invalidateQueries({ queryKey: ["admin-vendors-full"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeFn = useServerFn(revokeVendorInvitation);
  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => { toast.success("Invitation révoquée"); qc.invalidateQueries({ queryKey: ["admin-vendor-invitations"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Vendeurs</h2>
          <Button onClick={() => setInviteOpen(true)}><Plus className="mr-1 h-4 w-4" /> Inviter un vendeur</Button>
        </div>
        <div className="rounded-sm border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Nom</th><th className="p-3">Type</th>
                <th className="p-3">Membres</th><th className="p-3">Statut</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td className="p-3 font-medium">{v.name}<div className="text-xs text-muted-foreground">{v.slug}{v.contact_email && ` · ${v.contact_email}`}</div></td>
                  <td className="p-3 text-xs">{v.type === "internal" ? "Officiel" : "Externe"}</td>
                  <td className="p-3 text-xs">{v.members}</td>
                  <td className="p-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${v.status === "active" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {v.type !== "internal" && (
                      <Button size="sm" variant="outline"
                        onClick={() => suspend.mutate({ id: v.id, status: v.status === "active" ? "suspended" : "active" })}>
                        {v.status === "active" ? "Suspendre" : "Réactiver"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {vendors.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Aucun vendeur.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Invitations</h2>
        <div className="rounded-sm border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Email</th><th className="p-3">Vendeur</th>
                <th className="p-3">Statut</th><th className="p-3">Expire</th><th className="p-3">Lien</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invitations.map((i) => {
                const link = typeof window !== "undefined" ? `${window.location.origin}/vendeur/invitation/${i.token}` : `/vendeur/invitation/${i.token}`;
                return (
                  <tr key={i.id}>
                    <td className="p-3">{i.email}</td>
                    <td className="p-3 text-xs">{i.proposed_vendor_name ?? (i.vendor_id ? "existant" : "—")}</td>
                    <td className="p-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${i.status === "pending" ? "bg-accent/10 text-accent" : i.status === "accepted" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                        {i.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{new Date(i.expires_at).toLocaleDateString("fr-FR")}</td>
                    <td className="p-3">
                      <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(link); toast.success("Lien copié"); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                    <td className="p-3 text-right">
                      {i.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => revoke.mutate(i.id)}>Révoquer</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {invitations.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucune invitation.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {inviteOpen && (
        <InviteDialog
          existingVendors={vendors.filter((v) => v.type === "external")}
          onClose={() => setInviteOpen(false)}
          onSaved={() => { setInviteOpen(false); qc.invalidateQueries({ queryKey: ["admin-vendor-invitations"] }); }}
        />
      )}
    </div>
  );
}

function InviteDialog({ existingVendors, onClose, onSaved }: {
  existingVendors: { id: string; name: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [name, setName] = useState("");
  const [vendorId, setVendorId] = useState("");

  const createFn = useServerFn(createVendorInvitation);
  const mut = useMutation({
    mutationFn: () => createFn({ data: {
      email,
      proposed_vendor_name: mode === "new" ? name : null,
      vendor_id: mode === "existing" ? vendorId : null,
    } }),
    onSuccess: () => { toast.success("Invitation envoyée"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Inviter un vendeur</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
          <div><Label>Email *</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div>
            <Label>Type</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "new" | "existing")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Créer un nouveau vendeur</SelectItem>
                <SelectItem value="existing" disabled={existingVendors.length === 0}>Rattacher à un vendeur existant</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "new" ? (
            <div><Label>Nom du vendeur proposé *</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : Techno Cameroun" /></div>
          ) : (
            <div>
              <Label>Vendeur existant *</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {existingVendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? "..." : "Envoyer l'invitation"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
