import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TypeBadge } from "@/components/type-badge";
import { displayPrice, slugify, PRODUCT_TYPE_LABELS, type ProductType } from "@/lib/format";
import { ImageGalleryManager } from "@/components/image-gallery-manager";
import { useMyVendors } from "@/lib/vendor";

export const Route = createFileRoute("/_authenticated/vendeur/produits")({
  component: VendorProducts,
});

type Row = {
  id: string; slug: string; name: string; type: ProductType; status: string;
  price: number | null; price_type: "fixed" | "starting_at" | "quote_only";
  stock_quantity: number | null; featured: boolean;
  quality_verified: boolean; vendor_id: string;
  rating_average: number; rating_count: number;
};

function VendorProducts() {
  const qc = useQueryClient();
  const { data: memberships } = useMyVendors();
  const vendorId = memberships?.[0]?.vendor_id;
  const vendorName = memberships?.[0]?.vendor.name ?? "";

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["vendor-products", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, type, status, price, price_type, stock_quantity, featured, quality_verified, vendor_id, rating_average, rating_count")
        .eq("vendor_id", vendorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  const [editing, setEditing] = useState<Row | "new" | null>(null);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["vendor-products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!vendorId) return null;

  return (
    <div>
      <div className="mb-4 flex justify-between">
        <div className="text-sm text-muted-foreground">{rows.length} produit(s) · {vendorName}</div>
        <Button onClick={() => setEditing("new")}><Plus className="mr-1 h-4 w-4" /> Nouveau</Button>
      </div>
      <div className="overflow-x-auto rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Nom</th><th className="p-3">Type</th>
              <th className="p-3">Prix</th><th className="p-3">Stock</th><th className="p-3">Note</th><th className="p-3">Statut</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Chargement...</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 font-medium">
                  {r.name}
                  {r.quality_verified && <ShieldCheck className="ml-2 inline h-3.5 w-3.5 text-success" />}
                </td>
                <td className="p-3"><TypeBadge type={r.type} /></td>
                <td className="p-3">{displayPrice(r)}</td>
                <td className="p-3 text-xs">{r.stock_quantity ?? "—"}</td>
                <td className="p-3 text-xs">{r.rating_count > 0 ? `${Number(r.rating_average).toFixed(1)} (${r.rating_count})` : "—"}</td>
                <td className="p-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${r.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {r.status}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => confirm(`Supprimer ${r.name} ?`) && del.mutate(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucun produit. Créez le premier.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <VendorProductDialog
          row={editing === "new" ? null : editing}
          vendorId={vendorId}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["vendor-products"] }); }}
        />
      )}
    </div>
  );
}

type FormState = {
  name: string; slug: string; type: ProductType; status: "draft" | "active" | "archived";
  short_description: string; description: string;
  price: string; price_type: "fixed" | "starting_at" | "quote_only";
  stock_quantity: string; featured: boolean;
  images: string[];
  warranty_duration: string;
  source_type: string;
  delivery_type: string; service_area: string; estimated_duration: string; delivery_mode: string;
};

function VendorProductDialog({ row, vendorId, onClose, onSaved }: { row: Row | null; vendorId: string; onClose: () => void; onSaved: () => void }) {
  const isNew = !row;
  const [f, setF] = useState<FormState>({
    name: row?.name ?? "", slug: row?.slug ?? "",
    type: row?.type ?? "physical", status: (row?.status as "draft" | "active" | "archived") ?? "draft",
    short_description: "", description: "",
    price: row?.price?.toString() ?? "", price_type: row?.price_type ?? "fixed",
    stock_quantity: row?.stock_quantity?.toString() ?? "", featured: row?.featured ?? false,
    images: "",
    warranty_duration: "",
    source_type: "",
    delivery_type: "", service_area: "", estimated_duration: "", delivery_mode: "",
  });

  useEffect(() => {
    if (!row) return;
    supabase.from("products").select("*").eq("id", row.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setF((prev) => ({
        ...prev,
        short_description: data.short_description ?? "",
        description: data.description ?? "",
        images: Array.isArray(data.images) ? (data.images as string[]).join("\n") : "",
        warranty_duration: data.warranty_duration ?? "",
        source_type: data.source_type ?? "",
        delivery_type: data.delivery_type ?? "",
        service_area: data.service_area ?? "",
        estimated_duration: data.estimated_duration ?? "",
        delivery_mode: data.delivery_mode ?? "",
      }));
    });
  }, [row]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        vendor_id: vendorId, // locked
        name: f.name.trim(),
        slug: (f.slug || slugify(f.name)).trim(),
        type: f.type,
        status: f.status,
        short_description: f.short_description.trim() || null,
        description: f.description.trim() || null,
        price: f.price_type === "quote_only" ? null : (f.price ? Number(f.price) : null),
        price_type: f.price_type,
        stock_quantity: f.type === "physical" && f.stock_quantity ? Number(f.stock_quantity) : null,
        featured: f.featured,
        images: f.images.split("\n").map((s) => s.trim()).filter(Boolean),
        warranty_duration: f.type === "physical" && f.warranty_duration ? f.warranty_duration : null,
        source_type: f.type === "physical" && f.source_type ? (f.source_type as "direct_import" | "authorized_wholesaler" | "other") : null,
        delivery_type: f.type === "digital" && f.delivery_type ? (f.delivery_type as "file_download" | "license_key" | "access_link") : null,
        service_area: f.type === "service" && f.service_area ? (f.service_area as "on_site" | "in_shop" | "remote" | "both") : null,
        estimated_duration: f.type === "service" && f.estimated_duration ? f.estimated_duration : null,
        delivery_mode: f.type === "training" && f.delivery_mode ? (f.delivery_mode as "in_person" | "online" | "hybrid") : null,
      };
      if (isNew) {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").update(payload).eq("id", row!.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(isNew ? "Produit créé" : "Produit mis à jour"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isNew ? "Nouveau produit" : `Modifier : ${row?.name}`}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Nom *</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: isNew && !f.slug ? slugify(e.target.value) : f.slug })} /></div>
            <div><Label>Slug *</Label><Input required value={f.slug} onChange={(e) => setF({ ...f, slug: slugify(e.target.value) })} /></div>
          </div>

          <div className="rounded-sm border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Le badge « Qualité vérifiée » est attribué par l'équipe Wintek — non modifiable depuis l'espace vendeur.
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Type *</Label>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as ProductType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRODUCT_TYPE_LABELS) as ProductType[]).map((t) => (
                    <SelectItem key={t} value={t}>{PRODUCT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as "draft" | "active" | "archived" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="archived">Archivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <input id="feat" type="checkbox" checked={f.featured} onChange={(e) => setF({ ...f, featured: e.target.checked })} />
              <Label htmlFor="feat">Mis en avant</Label>
            </div>
          </div>

          <div><Label>Description courte</Label><Input value={f.short_description} onChange={(e) => setF({ ...f, short_description: e.target.value })} /></div>
          <div><Label>Description complète</Label><Textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div><Label>Images (une URL par ligne)</Label><Textarea rows={3} value={f.images} onChange={(e) => setF({ ...f, images: e.target.value })} placeholder="https://..." /></div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Type de prix</Label>
              <Select value={f.price_type} onValueChange={(v) => setF({ ...f, price_type: v as "fixed" | "starting_at" | "quote_only" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixe</SelectItem>
                  <SelectItem value="starting_at">À partir de</SelectItem>
                  <SelectItem value="quote_only">Sur devis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Prix (FCFA)</Label><Input type="number" min="0" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} disabled={f.price_type === "quote_only"} /></div>
            {f.type === "physical" && (
              <div><Label>Stock</Label><Input type="number" min="0" value={f.stock_quantity} onChange={(e) => setF({ ...f, stock_quantity: e.target.value })} /></div>
            )}
          </div>

          {f.type === "physical" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Garantie</Label><Input value={f.warranty_duration} onChange={(e) => setF({ ...f, warranty_duration: e.target.value })} placeholder="ex : 12 mois" /></div>
              <div>
                <Label>Origine</Label>
                <Select value={f.source_type || "none"} onValueChange={(v) => setF({ ...f, source_type: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Non spécifié" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non spécifié</SelectItem>
                    <SelectItem value="direct_import">Import direct</SelectItem>
                    <SelectItem value="authorized_wholesaler">Grossiste agréé</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {f.type === "digital" && (
            <div>
              <Label>Mode de livraison</Label>
              <Select value={f.delivery_type} onValueChange={(v) => setF({ ...f, delivery_type: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="file_download">Téléchargement</SelectItem>
                  <SelectItem value="license_key">Clé de licence</SelectItem>
                  <SelectItem value="access_link">Lien d'accès</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {f.type === "service" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Zone de service</Label>
                <Select value={f.service_area} onValueChange={(v) => setF({ ...f, service_area: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_site">À domicile</SelectItem>
                    <SelectItem value="in_shop">En atelier</SelectItem>
                    <SelectItem value="remote">À distance</SelectItem>
                    <SelectItem value="both">À domicile ou en atelier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Durée estimée</Label><Input value={f.estimated_duration} onChange={(e) => setF({ ...f, estimated_duration: e.target.value })} placeholder="ex : 1-2h" /></div>
            </div>
          )}
          {f.type === "training" && (
            <div>
              <Label>Mode de formation</Label>
              <Select value={f.delivery_mode} onValueChange={(v) => setF({ ...f, delivery_mode: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_person">Présentiel</SelectItem>
                  <SelectItem value="online">En ligne</SelectItem>
                  <SelectItem value="hybrid">Hybride</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "..." : "Enregistrer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
