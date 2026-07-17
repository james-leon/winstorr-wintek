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
import { Pagination, usePagination } from "@/components/pagination";
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

  const vendorsPg = usePagination(vendors, 25);
  const invitationsPg = usePagination(filteredInvitations, 25);

  const suspend = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "suspended" }) => {
      const { error } = await supabase.from("vendors").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Vendeur mis à jour"); qc.invalidateQueries({ queryKey: ["admin-vendors-full"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidateInv = () => qc.invalidateQueries({ queryKey: ["admin-vendor-invitations"] });

  const revokeFn = useServerFn(revokeVendorInvitation);
  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => { toast.success("Invitation révoquée"); invalidateInv(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resendFn = useServerFn(resendVendorInvitation);
  const resend = useMutation({
    mutationFn: (id: string) => resendFn({ data: { id } }),
    onSuccess: (res: { email_status?: string; email_error?: string }) => {
      if (res.email_status === "sent") toast.success("Invitation renvoyée — email livré au fournisseur");
      else if (res.email_status === "mocked") toast.success("Invitation régénérée — email non configuré, utilisez « Copier le lien »");
      else toast.error(`Échec de l'envoi de l'email : ${res.email_error ?? "erreur inconnue"}. Le lien est régénéré, utilisez « Copier le lien ».`);
      invalidateInv();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFn = useServerFn(deleteVendorInvitation);
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Invitation supprimée"); invalidateInv(); },
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
              {vendorsPg.paged.map((v) => (
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
        <Pagination page={vendorsPg.page} pageCount={vendorsPg.pageCount} total={vendorsPg.total} rangeStart={vendorsPg.rangeStart} rangeEnd={vendorsPg.rangeEnd} onPageChange={vendorsPg.setPage} label="vendeurs" />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Invitations</h2>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Filtrer :</span>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="accepted">Acceptées</SelectItem>
                <SelectItem value="revoked">Révoquées</SelectItem>
                <SelectItem value="expired">Expirées</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="rounded-sm border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Vendeur</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Email</th>
                <th className="p-3">Créée</th>
                <th className="p-3">Expire</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invitationsPg.paged.map((i) => {
                const link = typeof window !== "undefined" ? `${window.location.origin}/vendeur/invitation/${i.token}` : `/vendeur/invitation/${i.token}`;
                const expiredByDate = new Date(i.expires_at) < new Date();
                const effectiveStatus = i.status === "pending" && expiredByDate ? "expired" : i.status;
                const isPending = i.status === "pending" && !expiredByDate;
                const isAccepted = i.status === "accepted";
                const canDelete = (i.status === "revoked" || i.status === "expired" || (i.status === "pending" && expiredByDate));
                const referenceDate = i.status === "revoked"
                  ? (i.revoked_at ?? i.created_at)
                  : i.expires_at;
                const eligibleForDelete = canDelete && Date.now() - new Date(referenceDate).getTime() >= 7 * 24 * 60 * 60 * 1000;
                const vendorLabel = i.vendor_id
                  ? (vendorNameById.get(i.vendor_id) ?? "existant")
                  : (i.proposed_vendor_name ?? "—");
                return (
                  <tr key={i.id} className="align-top">
                    <td className="p-3">
                      <div className="font-medium">{i.email}</div>
                    </td>
                    <td className="p-3 text-xs">
                      {isAccepted && i.vendor_id ? (
                        <Link to="/admin/vendeurs" className="text-primary underline-offset-2 hover:underline">
                          {vendorLabel}
                        </Link>
                      ) : vendorLabel}
                    </td>
                    <td className="p-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        effectiveStatus === "pending" ? "bg-accent/10 text-accent"
                        : effectiveStatus === "accepted" ? "bg-success/15 text-success"
                        : effectiveStatus === "revoked" ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground"
                      }`}>
                        {effectiveStatus}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      {i.last_email_status === "sent" && (
                        <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> envoyé</span>
                      )}
                      {i.last_email_status === "mocked" && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /> non configuré</span>
                      )}
                      {i.last_email_status === "failed" && (
                        <span className="inline-flex items-center gap-1 text-destructive" title={i.last_email_error ?? undefined}>
                          <AlertCircle className="h-3 w-3" /> échec
                        </span>
                      )}
                      {!i.last_email_status && <span className="text-muted-foreground">—</span>}
                      {i.last_email_sent_at && (
                        <div className="text-[10px] text-muted-foreground">{new Date(i.last_email_sent_at).toLocaleString("fr-FR")}</div>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(i.created_at).toLocaleDateString("fr-FR")}</td>
                    <td className="p-3 text-xs">{new Date(i.expires_at).toLocaleDateString("fr-FR")}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {isPending && (
                          <>
                            <Button size="sm" variant="ghost" title="Copier le lien"
                              onClick={() => { navigator.clipboard.writeText(link); toast.success("Lien copié"); }}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" disabled={resend.isPending}
                              onClick={() => resend.mutate(i.id)}>
                              <RotateCw className="mr-1 h-3.5 w-3.5" /> Renvoyer
                            </Button>
                            <ConfirmDialog
                              trigger={<Button size="sm" variant="outline"><XCircle className="mr-1 h-3.5 w-3.5" /> Révoquer</Button>}
                              title="Révoquer cette invitation ?"
                              description={`Le lien envoyé à ${i.email} deviendra invalide. L'invitation restera visible pour l'audit.`}
                              confirmLabel="Révoquer"
                              onConfirm={() => revoke.mutate(i.id)}
                            />
                          </>
                        )}
                        {i.status === "expired" && (
                          <Button size="sm" variant="outline" disabled={resend.isPending}
                            onClick={() => resend.mutate(i.id)}>
                            <RotateCw className="mr-1 h-3.5 w-3.5" /> Réactiver
                          </Button>
                        )}
                        {isAccepted && (
                          <span className="text-xs text-muted-foreground">Lecture seule</span>
                        )}
                        {canDelete && (
                          <ConfirmDialog
                            trigger={
                              <Button size="sm" variant="outline" disabled={!eligibleForDelete}
                                title={eligibleForDelete ? "Supprimer définitivement" : "Disponible 7 jours après révocation/expiration"}>
                                <Trash2 className="mr-1 h-3.5 w-3.5" /> Supprimer
                              </Button>
                            }
                            title="Supprimer définitivement ?"
                            description={`L'invitation pour ${i.email} sera supprimée sans possibilité de restauration.`}
                            confirmLabel="Supprimer"
                            onConfirm={() => del.mutate(i.id)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredInvitations.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucune invitation.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination page={invitationsPg.page} pageCount={invitationsPg.pageCount} total={invitationsPg.total} rangeStart={invitationsPg.rangeStart} rangeEnd={invitationsPg.rangeEnd} onPageChange={invitationsPg.setPage} label="invitations" />
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
