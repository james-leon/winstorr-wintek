import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Star, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CITIES, type CityValue, cityLabel } from "@/lib/address";

export type Address = {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  city: CityValue;
  quartier: string;
  landmark_description: string | null;
  is_default: boolean;
};

export const Route = createFileRoute("/_authenticated/mon-compte/adresses")({
  head: () => ({ meta: [{ title: "Mes adresses — Winstorr" }, { name: "robots", content: "noindex" }] }),
  component: AddressesPage,
});

function AddressesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Address | null>(null);
  const [open, setOpen] = useState(false);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("customer_id", user!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Address[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customer_addresses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Adresse supprimée.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customer_addresses")
        .update({ is_default: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Adresse par défaut mise à jour.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (a: Address) => { setEditing(a); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Adresses enregistrées</h2>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      {!isLoading && addresses.length === 0 && (
        <div className="rounded-sm border border-dashed border-border p-8 text-center">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Vous n'avez pas encore d'adresse enregistrée.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {addresses.map((a) => (
          <div key={a.id} className="rounded-sm border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">{a.label}</p>
                <p className="text-sm">{a.full_name}</p>
              </div>
              {a.is_default && (
                <span className="rounded-sm bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-semibold">Par défaut</span>
              )}
            </div>
            <div className="mt-2 text-sm text-muted-foreground space-y-0.5">
              <p>{cityLabel(a.city)} — {a.quartier}</p>
              {a.landmark_description && <p className="text-xs">{a.landmark_description}</p>}
              <p className="text-xs">{a.phone}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!a.is_default && (
                <Button size="sm" variant="outline" onClick={() => setDefault.mutate(a.id)}>
                  <Star className="h-3.5 w-3.5 mr-1" />Par défaut
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                <Pencil className="h-3.5 w-3.5 mr-1" />Modifier
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => { if (confirm("Supprimer cette adresse ?")) del.mutate(a.id); }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />Supprimer
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AddressDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function AddressDialog({
  open, onOpenChange, editing,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing: Address | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [label, setLabel] = useState(editing?.label ?? "Domicile");
  const [fullName, setFullName] = useState(editing?.full_name ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [city, setCity] = useState<CityValue>(editing?.city ?? "douala");
  const [quartier, setQuartier] = useState(editing?.quartier ?? "");
  const [landmark, setLandmark] = useState(editing?.landmark_description ?? "");
  const [isDefault, setIsDefault] = useState(editing?.is_default ?? false);

  // Reset on editing change
  useState(() => {
    setLabel(editing?.label ?? "Domicile");
    setFullName(editing?.full_name ?? "");
    setPhone(editing?.phone ?? "");
    setCity(editing?.city ?? "douala");
    setQuartier(editing?.quartier ?? "");
    setLandmark(editing?.landmark_description ?? "");
    setIsDefault(editing?.is_default ?? false);
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!label.trim() || !fullName.trim() || !phone.trim() || !quartier.trim()) {
        throw new Error("Tous les champs marqués sont requis.");
      }
      const payload = {
        label: label.trim(),
        full_name: fullName.trim(),
        phone: phone.trim(),
        city,
        quartier: quartier.trim(),
        landmark_description: landmark.trim() || null,
        is_default: isDefault,
      };
      if (editing) {
        const { error } = await supabase
          .from("customer_addresses").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("customer_addresses").insert({ ...payload, customer_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      qc.invalidateQueries({ queryKey: ["addresses-for-checkout"] });
      toast.success(editing ? "Adresse mise à jour." : "Adresse ajoutée.");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier l'adresse" : "Nouvelle adresse"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Libellé *</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex : Domicile, Bureau" />
          </div>
          <div>
            <Label>Nom du destinataire *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>Téléphone *</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </div>
          <div>
            <Label>Ville *</Label>
            <select
              className="mt-1 h-9 w-full rounded-sm border border-input bg-background px-3 text-sm"
              value={city}
              onChange={(e) => setCity(e.target.value as CityValue)}
            >
              {CITIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Quartier *</Label>
            <Input value={quartier} onChange={(e) => setQuartier(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Point de repère</Label>
            <Textarea value={landmark} onChange={(e) => setLandmark(e.target.value)} rows={2} placeholder="Ex : en face de la pharmacie du carrefour" />
          </div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Définir comme adresse par défaut
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
