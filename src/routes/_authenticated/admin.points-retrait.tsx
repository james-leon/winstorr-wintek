import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { SkeletonTableRows } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/admin/points-retrait")({
  component: PickupPointsAdmin,
});

type PP = {
  id: string;
  name: string;
  address: string;
  city: string;
  contact_phone: string | null;
  opening_hours: string | null;
  is_active: boolean;
  sort_order: number;
};

function PickupPointsAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<PP> | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-pickup-points"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickup_points")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data as PP[];
    },
  });

  const flagsQ = useQuery({
    queryKey: ["settings", "payment_methods"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "payment_methods").maybeSingle();
      return (data?.value ?? { cinetpay: false, cash_on_pickup: true }) as { cinetpay: boolean; cash_on_pickup: boolean };
    },
  });

  // Le numéro WhatsApp support se gère désormais dans Admin → Paramètres généraux.

  const savePM = useMutation({
    mutationFn: async (next: { cinetpay: boolean; cash_on_pickup: boolean }) => {
      const { error } = await supabase.from("app_settings").upsert({ key: "payment_methods", value: next });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Modes de paiement mis à jour."); qc.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async (p: Partial<PP>) => {
      const payload = {
        name: p.name!,
        address: p.address!,
        city: p.city!,
        contact_phone: p.contact_phone || null,
        opening_hours: p.opening_hours || null,
        is_active: p.is_active ?? true,
        sort_order: p.sort_order ?? 0,
      };
      if (p.id) {
        const { error } = await supabase.from("pickup_points").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pickup_points").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Enregistré.");
      qc.invalidateQueries({ queryKey: ["admin-pickup-points"] });
      qc.invalidateQueries({ queryKey: ["pickup-points"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pickup_points").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supprimé."); qc.invalidateQueries({ queryKey: ["admin-pickup-points"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <section className="rounded-sm border border-border bg-card p-4">
        <h2 className="font-semibold mb-3">Modes de paiement actifs</h2>
        {flagsQ.data && (
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Paiement à la réception (espèces)</div>
                <div className="text-xs text-muted-foreground">Le client paye au livreur ou au point de retrait.</div>
              </div>
              <Switch
                checked={flagsQ.data.cash_on_pickup}
                onCheckedChange={(v) => savePM.mutate({ ...flagsQ.data!, cash_on_pickup: v })}
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Paiement en ligne (CinetPay)</div>
                <div className="text-xs text-muted-foreground">MTN MoMo, Orange Money, carte bancaire.</div>
              </div>
              <Switch
                checked={flagsQ.data.cinetpay}
                onCheckedChange={(v) => savePM.mutate({ ...flagsQ.data!, cinetpay: v })}
              />
            </label>
          </div>
        )}
        <p className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
          Le numéro WhatsApp support se gère dans <Link to="/admin/parametres" className="text-primary underline">Paramètres généraux</Link>.
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Points de retrait</h2>
          <Button size="sm" onClick={() => setEditing({ is_active: true, sort_order: (data.length + 1) * 10 })}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </div>

        <div className="rounded-sm border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2">Nom</th>
                <th className="p-2">Adresse</th>
                <th className="p-2">Ville</th>
                <th className="p-2">Horaires</th>
                <th className="p-2">Actif</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <SkeletonTableRows rows={6} cols={6} />}
              {!isLoading && data.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucun point de retrait.</td></tr>
              )}
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-muted/50">
                  <td className="p-2 font-medium">{p.name}</td>
                  <td className="p-2 text-muted-foreground">{p.address}</td>
                  <td className="p-2">{p.city}</td>
                  <td className="p-2 text-xs text-muted-foreground">{p.opening_hours}</td>
                  <td className="p-2">
                    <span className={p.is_active ? "text-success" : "text-muted-foreground"}>
                      {p.is_active ? "Oui" : "Non"}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { if (confirm("Supprimer ?")) del.mutate(p.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Modifier le point" : "Nouveau point de retrait"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nom *</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Adresse *</Label>
                <Textarea rows={2} value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ville *</Label>
                  <Input value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <Input value={editing.contact_phone ?? ""} onChange={(e) => setEditing({ ...editing, contact_phone: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Horaires d'ouverture</Label>
                <Input value={editing.opening_hours ?? ""} onChange={(e) => setEditing({ ...editing, opening_hours: e.target.value })} placeholder="Lun-Sam, 9h-18h" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ordre d'affichage</Label>
                  <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                    Actif
                  </label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button
              onClick={() => save.mutate(editing!)}
              disabled={save.isPending || !editing?.name || !editing?.address || !editing?.city}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
