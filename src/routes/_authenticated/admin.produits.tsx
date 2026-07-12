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

export const Route = createFileRoute("/_authenticated/admin/produits")({
  component: AdminProducts,
});

type Vendor = { id: string; name: string; type: "internal" | "external" };
type Category = { id: string; name: string; product_type: ProductType; parent_id: string | null; status: "active" | "archived" };

type Row = {
  id: string; slug: string; name: string; type: ProductType; status: string;
  price: number | null; price_type: "fixed" | "starting_at" | "quote_only";
  stock_quantity: number | null; featured: boolean;
  quality_verified: boolean; vendor_id: string; category_id: string | null;
  rating_average: number; rating_count: number;
};

function AdminProducts() {
  const qc = useQueryClient();
  const { data: vendors = [] } = useQuery({
    queryKey: ["admin-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id, name, type").order("name");
      if (error) throw error;
      return data as Vendor[];
    },
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name, product_type, parent_id, status").order("product_type").order("display_order").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, type, status, price, price_type, stock_quantity, featured, quality_verified, vendor_id, category_id, rating_average, rating_count")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const vendorName = (id: string) => vendors.find((v) => v.id === id)?.name ?? "—";

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["admin-products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-4 flex justify-between">
        <div className="text-sm text-muted-foreground">{rows.length} produit(s)</div>
        <Button onClick={() => setEditing("new")}><Plus className="mr-1 h-4 w-4" /> Nouveau</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Nom</th><th className="p-3">Type</th><th className="p-3">Vendeur</th>
              <th className="p-3">Prix</th><th className="p-3">Note</th><th className="p-3">Statut</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Chargement...</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 font-medium">
                  {r.name}
                  {r.featured && <span className="ml-2 text-xs text-accent">★</span>}
                  {r.quality_verified && <ShieldCheck className="ml-2 inline h-3.5 w-3.5 text-success" />}
                </td>
                <td className="p-3"><TypeBadge type={r.type} /></td>
                <td className="p-3 text-xs">{vendorName(r.vendor_id)}</td>
                <td className="p-3">{displayPrice(r)}</td>
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
          </tbody>
        </table>
      </div>
      {editing && (
        <ProductDialog
          row={editing === "new" ? null : editing}
          vendors={vendors}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["admin-products"] }); }}
        />
      )}
    </div>
  );
}

type FormState = {
  name: string; slug: string; type: ProductType; status: "draft" | "active" | "archived";
  vendor_id: string;
  short_description: string; description: string;
  price: string; price_type: "fixed" | "starting_at" | "quote_only";
  stock_quantity: string; featured: boolean;
  images: string;
  quality_verified: boolean;
  warranty_duration: string;
  source_type: string;
  delivery_type: string; service_area: string; estimated_duration: string; delivery_mode: string;
};

function ProductDialog({ row, vendors, onClose, onSaved }: { row: Row | null; vendors: Vendor[]; onClose: () => void; onSaved: () => void }) {
  const isNew = !row;
  const defaultVendor = vendors.find((v) => v.type === "internal")?.id ?? vendors[0]?.id ?? "";
  const [f, setF] = useState<FormState>({
    name: row?.name ?? "", slug: row?.slug ?? "",
    type: row?.type ?? "physical", status: (row?.status as "draft" | "active" | "archived") ?? "draft",
    vendor_id: row?.vendor_id ?? defaultVendor,
    short_description: "", description: "",
    price: row?.price?.toString() ?? "", price_type: row?.price_type ?? "fixed",
    stock_quantity: row?.stock_quantity?.toString() ?? "", featured: row?.featured ?? false,
    images: "",
    quality_verified: row?.quality_verified ?? false,
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
      if (!f.vendor_id) throw new Error("Vendeur requis");
      const payload = {
        vendor_id: f.vendor_id,
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
        quality_verified: f.quality_verified,
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Vendeur *</Label>
              <Select value={f.vendor_id} onValueChange={(v) => setF({ ...f, vendor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name} {v.type === "internal" && "• Officiel"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <input id="qv" type="checkbox" checked={f.quality_verified} onChange={(e) => setF({ ...f, quality_verified: e.target.checked })} />
              <Label htmlFor="qv" className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Qualité vérifiée</Label>
            </div>
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
