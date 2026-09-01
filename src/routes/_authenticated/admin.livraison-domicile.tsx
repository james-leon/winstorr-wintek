import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { SkeletonTableRows } from "@/components/skeletons";
import { formatFcfa } from "@/lib/format";
import {
  useDeliveryZones,
  useHomeDeliverySettings,
  HOME_DELIVERY_SETTINGS_KEY,
  DEFAULT_HOME_DELIVERY,
  type DeliveryZone,
  type HomeDeliverySettings,
} from "@/lib/delivery";

export const Route = createFileRoute("/_authenticated/admin/livraison-domicile")({
  component: HomeDeliveryAdmin,
});

type ZoneDraft = Partial<DeliveryZone> & { quartiersText?: string };

function HomeDeliveryAdmin() {
  const qc = useQueryClient();
  const { data: settings } = useHomeDeliverySettings();
  const { data: zones = [], isLoading } = useDeliveryZones(true);
  const [editing, setEditing] = useState<ZoneDraft | null>(null);
  const [threshold, setThreshold] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["delivery-zones"] });
    qc.invalidateQueries({ queryKey: ["settings", HOME_DELIVERY_SETTINGS_KEY] });
  };

  const saveSettings = useMutation({
    mutationFn: async (next: HomeDeliverySettings) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: HOME_DELIVERY_SETTINGS_KEY, value: next });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Réglages enregistrés."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveZone = useMutation({
    mutationFn: async (z: ZoneDraft) => {
      const payload = {
        name: (z.name ?? "").trim(),
        city: (z.city ?? "Douala").trim(),
        fee: Number(z.fee ?? 0),
        quartiers: (z.quartiersText ?? "")
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        sort_order: Number(z.sort_order ?? 0),
        is_active: z.is_active ?? true,
      };
      if (z.id) {
        const { error } = await supabase.from("delivery_zones").update(payload).eq("id", z.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("delivery_zones").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Zone enregistrée."); invalidate(); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delZone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Zone supprimée."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const s = settings ?? DEFAULT_HOME_DELIVERY;

  return (
    <div className="space-y-6">
      <section className="rounded-sm border border-border bg-card p-4">
        <h2 className="font-semibold mb-3">Livraison à domicile</h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium">Activer la livraison à domicile</div>
              <div className="text-xs text-muted-foreground">
                Proposée au client à côté du retrait en point relais.
              </div>
            </div>
            <Switch checked={s.enabled} onCheckedChange={(v) => saveSettings.mutate({ ...s, enabled: v })} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <Label>Coursier partenaire</Label>
              <Input
                defaultValue={s.courier_name}
                onBlur={(e) => e.target.value !== s.courier_name && saveSettings.mutate({ ...s, courier_name: e.target.value })}
              />
            </div>
            <div className="min-w-0">
              <Label>Délai annoncé</Label>
              <Input
                defaultValue={s.delay_text}
                onBlur={(e) => e.target.value !== s.delay_text && saveSettings.mutate({ ...s, delay_text: e.target.value })}
              />
            </div>
            <div className="min-w-0">
              <Label>Livraison offerte à partir de (FCFA)</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Aucun seuil"
                  value={threshold ?? (s.free_shipping_threshold ?? "")}
                  onChange={(e) => setThreshold(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const v = threshold === null ? s.free_shipping_threshold : threshold.trim() === "" ? null : Number(threshold);
                    saveSettings.mutate({ ...s, free_shipping_threshold: v });
                    setThreshold(null);
                  }}
                >
                  OK
                </Button>
              </div>
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-sm bg-muted/50 p-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {s.note}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Zones & tarifs</h2>
          <Button size="sm" onClick={() => setEditing({ is_active: true, city: "Douala", sort_order: zones.length + 1, quartiersText: "" })}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter une zone
          </Button>
        </div>

        <div className="rounded-sm border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2">Zone</th>
                <th className="p-2">Ville</th>
                <th className="p-2">Tarif client</th>
                <th className="p-2">Quartiers</th>
                <th className="p-2">Active</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <SkeletonTableRows rows={4} cols={6} />}
              {!isLoading && zones.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucune zone.</td></tr>
              )}
              {zones.map((z) => (
                <tr key={z.id} className="hover:bg-muted/50 align-top">
                  <td className="p-2 font-medium whitespace-nowrap">{z.name}</td>
                  <td className="p-2">{z.city}</td>
                  <td className="p-2 whitespace-nowrap">{formatFcfa(z.fee)}</td>
                  <td className="p-2 text-xs text-muted-foreground max-w-md">{z.quartiers.join(", ")}</td>
                  <td className="p-2">
                    <span className={z.is_active ? "text-success" : "text-muted-foreground"}>{z.is_active ? "Oui" : "Non"}</span>
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEditing({ ...z, quartiersText: z.quartiers.join(", ") })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { if (confirm("Supprimer cette zone ?")) delZone.mutate(z.id); }}>
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
        <DialogContent className="w-[calc(100vw-1rem)] max-w-lg overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Modifier la zone" : "Nouvelle zone"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <Label>Nom *</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div className="min-w-0">
                  <Label>Ville *</Label>
                  <Input value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
                </div>
                <div className="min-w-0">
                  <Label>Tarif client (FCFA) *</Label>
                  <Input type="number" inputMode="numeric" value={editing.fee ?? 0} onChange={(e) => setEditing({ ...editing, fee: Number(e.target.value) })} />
                </div>
                <div className="min-w-0">
                  <Label>Ordre d'affichage</Label>
                  <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Quartiers (séparés par une virgule)</Label>
                <Textarea
                  rows={4}
                  value={editing.quartiersText ?? ""}
                  onChange={(e) => setEditing({ ...editing, quartiersText: e.target.value })}
                  placeholder="Yassa, Ndokoti, Japoma…"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                Zone active
              </label>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditing(null)}>Annuler</Button>
            <Button className="w-full sm:w-auto" onClick={() => saveZone.mutate(editing!)} disabled={saveZone.isPending || !editing?.name}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
