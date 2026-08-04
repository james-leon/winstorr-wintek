import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { createVendorInvitation } from "@/lib/vendor-invitations.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { UserPlus, Phone, Mail, MapPin, Link as LinkIcon, Check, X, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/candidatures-vendeurs")({
  component: VendorApplicationsPage,
});

type AppStatus = "new" | "contacted" | "approved" | "rejected";
type Application = {
  id: string;
  business_name: string;
  contact_name: string;
  phone: string;
  email: string | null;
  city: string;
  product_types: unknown;
  description: string;
  social_link: string | null;
  status: AppStatus;
  admin_notes: string | null;
  invitation_id: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<AppStatus, string> = {
  new: "Nouvelle",
  contacted: "Contactée",
  approved: "Approuvée",
  rejected: "Rejetée",
};
const STATUS_TINT: Record<AppStatus, string> = {
  new: "bg-primary/10 text-primary",
  contacted: "bg-accent/10 text-accent",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

function VendorApplicationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<AppStatus | "all">("all");
  const [selected, setSelected] = useState<Application | null>(null);
  const [rejectFor, setRejectFor] = useState<Application | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["admin-vendor-applications", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("vendor_applications")
        .select("id, business_name, contact_name, phone, email, city, product_types, description, social_link, status, admin_notes, invitation_id, created_at")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Application[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (input: { id: string; status: AppStatus; note?: string | null }) => {
      const patch: { status: AppStatus; reviewed_by: string | null; admin_notes?: string | null } = {
        status: input.status,
        reviewed_by: user?.id ?? null,
      };
      if (input.note !== undefined) patch.admin_notes = input.note;
      const { error } = await supabase.from("vendor_applications").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Candidature mise à jour.");
      qc.invalidateQueries({ queryKey: ["admin-vendor-applications"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
      setSelected(null);
      setRejectFor(null);
      setRejectNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createInvitationFn = useServerFn(createVendorInvitation);
  const invitationMut = useMutation({
    mutationFn: async (app: Application) => {
      if (!app.email) throw new Error("Cette candidature n'a pas d'email — collectez-le avant de créer une invitation.");
      const res = await createInvitationFn({
        data: { email: app.email, proposed_vendor_name: app.business_name, vendor_id: null },
      });
      const { error } = await supabase
        .from("vendor_applications")
        .update({ status: "approved", invitation_id: res.id, reviewed_by: user?.id ?? null })
        .eq("id", app.id);
      if (error) throw error;
      return res;
    },
    onSuccess: () => {
      toast.success("Invitation créée — copiez le lien depuis la page Vendeurs pour le partager.");

      qc.invalidateQueries({ queryKey: ["admin-vendor-applications"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts: Record<AppStatus | "all", number> = { all: apps.length, new: 0, contacted: 0, approved: 0, rejected: 0 };
  for (const a of apps) counts[a.status]++;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl text-foreground">Candidatures vendeur</h1>
        <p className="text-sm text-muted-foreground">Prospects issus de la page publique « Devenir vendeur ».</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "new", "contacted", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {s === "all" ? "Toutes" : STATUS_LABEL[s]}
            {statusFilter !== s && counts[s] > 0 && <span className="ml-1 text-muted-foreground">({counts[s]})</span>}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Commerce</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium">Ville</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                <th className="px-3 py-2 font-medium">Reçue le</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Chargement…</td></tr>
              )}
              {!isLoading && apps.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucune candidature.</td></tr>
              )}
              {apps.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium text-foreground">{a.business_name}</td>
                  <td className="px-3 py-2">
                    <div>{a.contact_name}</div>
                    <div className="text-xs text-muted-foreground">{a.phone}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{a.city}</td>
                  <td className="px-3 py-2">
                    <Badge className={STATUS_TINT[a.status]} variant="secondary">{STATUS_LABEL[a.status]}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setSelected(a)} className="text-xs font-medium text-primary hover:underline">
                      Ouvrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">{selected.business_name}</DialogTitle>
                <DialogDescription>
                  Reçue le {new Date(selected.created_at).toLocaleString("fr-FR")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Téléphone" value={selected.phone} />
                  <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={selected.email ?? "—"} />
                  <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Ville" value={selected.city} />
                  <InfoRow icon={<UserPlus className="h-3.5 w-3.5" />} label="Contact" value={selected.contact_name} />
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Types de produits</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Array.isArray(selected.product_types) &&
                      (selected.product_types as string[]).map((t) => (
                        <Badge key={t} variant="secondary">{t}</Badge>
                      ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Description</div>
                  <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-sm">
                    {selected.description}
                  </p>
                </div>
                {selected.social_link && (
                  <InfoRow icon={<LinkIcon className="h-3.5 w-3.5" />} label="Réseaux sociaux" value={
                    <a href={selected.social_link} target="_blank" rel="noreferrer" className="text-primary underline break-all">
                      {selected.social_link}
                    </a>
                  } />
                )}
                {selected.admin_notes && (
                  <div className="rounded-md border border-border bg-muted/40 p-3">
                    <div className="text-xs font-medium text-muted-foreground">Notes internes</div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{selected.admin_notes}</p>
                  </div>
                )}
                {selected.invitation_id && (
                  <div className="rounded-md border border-success/40 bg-success/5 p-3 text-xs">
                    ✓ Invitation vendeur créée. Voir sur la page <em>Tous les vendeurs</em>.
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                {selected.status !== "rejected" && (
                  <Button
                    variant="outline"
                    onClick={() => { setRejectFor(selected); setRejectNote(selected.admin_notes ?? ""); }}
                  >
                    <X className="mr-1 h-4 w-4" /> Rejeter
                  </Button>
                )}
                {selected.status === "new" && (
                  <Button
                    variant="outline"
                    onClick={() => updateStatus.mutate({ id: selected.id, status: "contacted" })}
                    disabled={updateStatus.isPending}
                  >
                    <MessageSquare className="mr-1 h-4 w-4" /> Marquer contacté
                  </Button>
                )}
                {!selected.invitation_id && selected.status !== "rejected" && (
                  <Button
                    onClick={() => invitationMut.mutate(selected)}
                    disabled={invitationMut.isPending || !selected.email}
                    title={!selected.email ? "Email requis pour créer une invitation" : undefined}
                  >
                    <Check className="mr-1 h-4 w-4" />
                    {invitationMut.isPending ? "Création…" : "Créer une invitation"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectFor} onOpenChange={(o) => { if (!o) { setRejectFor(null); setRejectNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter la candidature</DialogTitle>
            <DialogDescription>Motif interne (non envoyé au candidat).</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Raison du rejet…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectFor(null); setRejectNote(""); }}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => rejectFor && updateStatus.mutate({ id: rejectFor.id, status: "rejected", note: rejectNote || null })}
              disabled={updateStatus.isPending}
            >
              Rejeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-0.5 text-sm text-foreground">{value}</div>
    </div>
  );
}
