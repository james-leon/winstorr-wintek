import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ShieldCheck, ArrowUpDown, ImageOff, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TypeBadge } from "@/components/type-badge";
import { displayPrice, slugify, PRODUCT_TYPE_LABELS, type ProductType } from "@/lib/format";
import { ImageGalleryManager } from "@/components/image-gallery-manager";
import { cn } from "@/lib/utils";

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
  images: string[] | null; sku: string | null;
  created_at: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:          { label: "Brouillon",  cls: "bg-secondary/15 text-secondary" },
  pending_review: { label: "En attente", cls: "bg-accent/15 text-accent" },
  active:         { label: "Actif",      cls: "bg-success/15 text-success" },
  rejected:       { label: "Rejeté",     cls: "bg-destructive/15 text-destructive" },
  archived:       { label: "Archivé",    cls: "bg-muted text-muted-foreground" },
};

type SortKey = "name" | "price" | "stock_quantity" | "status" | "created_at";
type StockFilter = "all" | "out" | "low" | "in";

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
        .select("id, slug, name, type, status, price, price_type, stock_quantity, featured, quality_verified, vendor_id, category_id, rating_average, rating_count, images, sku, created_at, rejection_reason, reviewed_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState<string>("all");
  const [statusF, setStatusF] = useState<string>("all");
  const [categoryF, setCategoryF] = useState<string>("all");
  const [stockF, setStockF] = useState<StockFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const vendorName = (id: string) => vendors.find((v) => v.id === id)?.name ?? "—";
  const categoryName = (id: string | null) => id ? categories.find((c) => c.id === id)?.name ?? "—" : "—";

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let r = rows.filter((x) => {
      if (s && !x.name.toLowerCase().includes(s) && !(x.sku ?? "").toLowerCase().includes(s)) return false;
      if (typeF !== "all" && x.type !== typeF) return false;
      if (statusF !== "all" && x.status !== statusF) return false;
      if (categoryF !== "all" && x.category_id !== categoryF) return false;
      if (stockF !== "all" && x.type === "physical") {
        const q = x.stock_quantity ?? 0;
        if (stockF === "out" && q > 0) return false;
        if (stockF === "low" && (q === 0 || q > 5)) return false;
        if (stockF === "in" && q <= 5) return false;
      }
      return true;
    });
    r = [...r].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return r;
  }, [rows, search, typeF, statusF, categoryF, stockF, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  const [rejectFor, setRejectFor] = useState<Row | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const bulkUpdate = useMutation({
    mutationFn: async ({ action, reason }: { action: "active" | "archived" | "delete" | "approve" | "reject"; reason?: string }) => {
      const ids = Array.from(selected);
      if (ids.length === 0) return;
      if (action === "delete") {
        const { error } = await supabase.from("products").delete().in("id", ids);
        if (error) throw error;
      } else if (action === "approve") {
        const { error } = await supabase.from("products").update({ status: "active", rejection_reason: null }).in("id", ids);
        if (error) throw error;
      } else if (action === "reject") {
        const { error } = await supabase.from("products").update({ status: "rejected", rejection_reason: reason ?? null }).in("id", ids);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").update({ status: action }).in("id", ids);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Action appliquée.");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewOne = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: "active" | "rejected"; reason?: string | null }) => {
      const patch = { status, rejection_reason: status === "rejected" ? (reason ?? null) : null };
      const { error } = await supabase.from("products").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Action appliquée.");
      setRejectFor(null); setRejectReason("");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quickSave = useMutation({
    mutationFn: async (data: { id: string; price: string; stock_quantity: string; status: string }) => {
      const patch = {
        status: data.status as "draft" | "active" | "archived",
        price: data.price ? Number(data.price) : null,
        ...(data.stock_quantity !== "" ? { stock_quantity: Number(data.stock_quantity) } : {}),
      };
      const { error } = await supabase.from("products").update(patch).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Enregistré.");
      setQuickEditId(null);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["admin-products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl text-foreground">Produits</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} sur {rows.length} produit(s)</p>
        </div>
        <Button onClick={() => setEditing("new")}><Plus className="mr-1 h-4 w-4" /> Nouveau</Button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2">
        <Input
          placeholder="Rechercher (nom, SKU)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs"
        />
        <Select value={typeF} onValueChange={setTypeF}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {(Object.keys(PRODUCT_TYPE_LABELS) as ProductType[]).map((t) => (
              <SelectItem key={t} value={t}>{PRODUCT_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="pending_review">En attente</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="rejected">Rejeté</SelectItem>
            <SelectItem value="archived">Archivé</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryF} onValueChange={setCategoryF}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {categories.filter((c) => c.status === "active").map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stockF} onValueChange={(v) => setStockF(v as StockFilter)}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous stocks</SelectItem>
            <SelectItem value="out">Rupture</SelectItem>
            <SelectItem value="low">Stock faible</SelectItem>
            <SelectItem value="in">En stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} sélectionné(s)</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => bulkUpdate.mutate("active")}>Activer</Button>
            <Button size="sm" variant="outline" onClick={() => bulkUpdate.mutate("archived")}>Archiver</Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => confirm(`Supprimer ${selected.size} produit(s) ?`) && bulkUpdate.mutate("delete")}>
              Supprimer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Annuler</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-10 p-2"><Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} /></th>
              <th className="w-12 p-2"></th>
              <th className="p-2">
                <button onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 font-medium">
                  Nom <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="p-2">Type</th>
              <th className="p-2">Catégorie</th>
              <th className="p-2">Vendeur</th>
              <th className="p-2">
                <button onClick={() => toggleSort("price")} className="inline-flex items-center gap-1 font-medium">
                  Prix <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="p-2">
                <button onClick={() => toggleSort("stock_quantity")} className="inline-flex items-center gap-1 font-medium">
                  Stock <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="p-2">
                <button onClick={() => toggleSort("status")} className="inline-flex items-center gap-1 font-medium">
                  Statut <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Chargement...</td></tr>}
            {filtered.map((r) => {
              const isQE = quickEditId === r.id;
              const cover = r.images?.[0];
              return (
                <>
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="p-2"><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} /></td>
                    <td className="p-2">
                      {cover ? (
                        <img src={cover} alt="" className="h-10 w-10 rounded object-cover border border-border" />
                      ) : (
                        <div className="grid h-10 w-10 place-items-center rounded border border-border bg-muted text-muted-foreground">
                          <ImageOff className="h-4 w-4" />
                        </div>
                      )}
                    </td>
                    <td className="p-2 font-medium">
                      {r.name}
                      {r.featured && <span className="ml-2 text-xs text-accent">★</span>}
                      {r.quality_verified && <ShieldCheck className="ml-2 inline h-3.5 w-3.5 text-success" />}
                      {r.sku && <div className="text-[11px] text-muted-foreground">SKU: {r.sku}</div>}
                    </td>
                    <td className="p-2"><TypeBadge type={r.type} /></td>
                    <td className="p-2 text-xs">{categoryName(r.category_id)}</td>
                    <td className="p-2 text-xs">{vendorName(r.vendor_id)}</td>
                    <td className="p-2">{displayPrice(r)}</td>
                    <td className="p-2">
                      {r.type === "physical" ? (
                        <span className={cn(
                          "text-sm",
                          (r.stock_quantity ?? 0) === 0 ? "text-destructive font-medium" :
                          (r.stock_quantity ?? 0) <= 5 ? "text-accent font-medium" : "text-foreground"
                        )}>
                          {r.stock_quantity ?? 0}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="p-2">
                      <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs",
                        r.status === "active" ? "bg-success/15 text-success" :
                        r.status === "draft" ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground")}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setQuickEditId(isQE ? null : r.id)}
                          className="text-xs text-primary hover:underline"
                        >
                          {isQE ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <Button variant="ghost" size="icon" onClick={() => setEditing(r)} aria-label="Modifier"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => confirm(`Supprimer ${r.name} ?`) && del.mutate(r.id)} aria-label="Supprimer">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {isQE && (
                    <QuickEditRow
                      key={`qe-${r.id}`}
                      row={r}
                      onCancel={() => setQuickEditId(null)}
                      onSave={(data) => quickSave.mutate(data)}
                      pending={quickSave.isPending}
                    />
                  )}
                </>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Aucun produit trouvé.</td></tr>
            )}
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

function QuickEditRow({ row, onCancel, onSave, pending }: {
  row: Row;
  onCancel: () => void;
  onSave: (d: { id: string; price: string; stock_quantity: string; status: string }) => void;
  pending: boolean;
}) {
  const [price, setPrice] = useState(row.price?.toString() ?? "");
  const [stock, setStock] = useState(row.stock_quantity?.toString() ?? "");
  const [status, setStatus] = useState(row.status);
  return (
    <tr className="bg-primary/5">
      <td colSpan={10} className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Prix</Label>
            <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="h-8 w-32" />
          </div>
          {row.type === "physical" && (
            <div>
              <Label className="text-xs">Stock</Label>
              <Input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className="h-8 w-24" />
            </div>
          )}
          <div>
            <Label className="text-xs">Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="archived">Archivé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={onCancel}>Annuler</Button>
            <Button size="sm" onClick={() => onSave({ id: row.id, price, stock_quantity: stock, status })} disabled={pending}>
              Enregistrer
            </Button>
          </div>
        </div>
      </td>
    </tr>
  );
}

type TierRow = { min_quantity: string; unit_price: string };

type FormState = {
  name: string; slug: string; type: ProductType; status: "draft" | "active" | "archived";
  vendor_id: string; category_id: string;
  short_description: string; description: string;
  price: string; price_type: "fixed" | "starting_at" | "quote_only";
  stock_quantity: string; sku: string; featured: boolean;
  images: string[];
  quality_verified: boolean;
  warranty_duration: string;
  source_type: string;
  delivery_type: string; service_area: string; estimated_duration: string; delivery_mode: string;
  tiers: TierRow[];
};

function ProductDialog({ row, vendors, categories, onClose, onSaved }: { row: Row | null; vendors: Vendor[]; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const isNew = !row;
  const defaultVendor = vendors.find((v) => v.type === "internal")?.id ?? vendors[0]?.id ?? "";
  const [f, setF] = useState<FormState>({
    name: row?.name ?? "", slug: row?.slug ?? "",
    type: row?.type ?? "physical", status: (row?.status as "draft" | "active" | "archived") ?? "draft",
    vendor_id: row?.vendor_id ?? defaultVendor,
    category_id: row?.category_id ?? "none",
    short_description: "", description: "",
    price: row?.price?.toString() ?? "", price_type: row?.price_type ?? "fixed",
    stock_quantity: row?.stock_quantity?.toString() ?? "", sku: row?.sku ?? "",
    featured: row?.featured ?? false,
    images: row?.images ?? [],
    quality_verified: row?.quality_verified ?? false,
    warranty_duration: "",
    source_type: "",
    delivery_type: "", service_area: "", estimated_duration: "", delivery_mode: "",
    tiers: [],
  });

  useEffect(() => {
    if (!row) return;
    supabase.from("products").select("*").eq("id", row.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setF((prev) => ({
        ...prev,
        short_description: data.short_description ?? "",
        description: data.description ?? "",
        images: Array.isArray(data.images) ? (data.images as string[]) : [],
        sku: data.sku ?? "",
        warranty_duration: data.warranty_duration ?? "",
        source_type: data.source_type ?? "",
        delivery_type: data.delivery_type ?? "",
        service_area: data.service_area ?? "",
        estimated_duration: data.estimated_duration ?? "",
        delivery_mode: data.delivery_mode ?? "",
      }));
    });
    supabase.from("product_price_tiers")
      .select("min_quantity, unit_price")
      .eq("product_id", row.id)
      .order("min_quantity", { ascending: true })
      .then(({ data }) => {
        if (!data) return;
        setF((prev) => ({
          ...prev,
          tiers: data.map((t) => ({ min_quantity: String(t.min_quantity), unit_price: String(t.unit_price) })),
        }));
      });
  }, [row]);

  const save = useMutation({
    mutationFn: async () => {
      if (!f.vendor_id) throw new Error("Vendeur requis");
      const payload = {
        vendor_id: f.vendor_id,
        category_id: f.category_id === "none" ? null : f.category_id,
        name: f.name.trim(),
        slug: (f.slug || slugify(f.name)).trim(),
        type: f.type,
        status: f.status,
        short_description: f.short_description.trim() || null,
        description: f.description.trim() || null,
        price: f.price_type === "quote_only" ? null : (f.price ? Number(f.price) : null),
        price_type: f.price_type,
        stock_quantity: f.type === "physical" && f.stock_quantity ? Number(f.stock_quantity) : null,
        sku: f.sku.trim() || null,
        featured: f.featured,
        images: f.images.map((s) => s.trim()).filter(Boolean),
        quality_verified: f.quality_verified,
        warranty_duration: f.type === "physical" && f.warranty_duration ? f.warranty_duration : null,
        source_type: f.type === "physical" && f.source_type ? (f.source_type as "direct_import" | "authorized_wholesaler" | "other") : null,
        delivery_type: f.type === "digital" && f.delivery_type ? (f.delivery_type as "file_download" | "license_key" | "access_link") : null,
        service_area: f.type === "service" && f.service_area ? (f.service_area as "on_site" | "in_shop" | "remote" | "both") : null,
        estimated_duration: f.type === "service" && f.estimated_duration ? f.estimated_duration : null,
        delivery_mode: f.type === "training" && f.delivery_mode ? (f.delivery_mode as "in_person" | "online" | "hybrid") : null,
      };
      const parsedTiers = f.type === "physical"
        ? f.tiers
            .map((t) => ({ min_quantity: parseInt(t.min_quantity, 10), unit_price: Number(t.unit_price) }))
            .filter((t) => Number.isFinite(t.min_quantity) && t.min_quantity >= 1 && Number.isFinite(t.unit_price) && t.unit_price >= 0)
            .sort((a, b) => a.min_quantity - b.min_quantity)
        : [];
      if (f.type === "physical") {
        const seen = new Set<number>();
        let prevPrice = Infinity;
        for (const t of parsedTiers) {
          if (seen.has(t.min_quantity)) throw new Error(`Quantité minimum dupliquée : ${t.min_quantity}`);
          seen.add(t.min_quantity);
          if (t.unit_price > prevPrice) throw new Error("Les prix doivent décroître quand la quantité augmente.");
          prevPrice = t.unit_price;
        }
      }

      let productId = row?.id;
      if (isNew) {
        const { data: inserted, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        productId = inserted.id;
      } else {
        const { error } = await supabase.from("products").update(payload).eq("id", row!.id);
        if (error) throw error;
      }

      if (productId) {
        await supabase.from("product_price_tiers").delete().eq("product_id", productId);
        if (parsedTiers.length > 0) {
          const { error: tErr } = await supabase.from("product_price_tiers").insert(
            parsedTiers.map((t) => ({ product_id: productId, min_quantity: t.min_quantity, unit_price: t.unit_price })),
          );
          if (tErr) throw tErr;
        }
      }
    },
    onSuccess: () => { toast.success(isNew ? "Produit créé" : "Produit mis à jour"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasTypeSpecific = f.type !== "physical";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isNew ? "Nouveau produit" : `Modifier : ${row?.name}`}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="mb-4 flex w-full flex-wrap justify-start gap-1 bg-muted p-1">
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="inventory">Inventaire</TabsTrigger>
              <TabsTrigger value="images">Images</TabsTrigger>
              {f.type === "physical" && <TabsTrigger value="tiers">Prix par palier</TabsTrigger>}
              <TabsTrigger value="quality">Qualité & Garantie</TabsTrigger>
              {hasTypeSpecific && <TabsTrigger value="type">Type-spécifique</TabsTrigger>}
            </TabsList>

            <TabsContent value="general" className="space-y-3 mt-0">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Nom *</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: isNew && !f.slug ? slugify(e.target.value) : f.slug })} /></div>
                <div><Label>Slug *</Label><Input required value={f.slug} onChange={(e) => setF({ ...f, slug: slugify(e.target.value) })} /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Vendeur *</Label>
                  <Select value={f.vendor_id} onValueChange={(v) => setF({ ...f, vendor_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name} {v.type === "internal" && "• Officiel"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Catégorie</Label>
                  <Select value={f.category_id} onValueChange={(v) => setF({ ...f, category_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {categories.filter((c) => c.product_type === f.type && c.status === "active").map((c) => {
                        const parent = c.parent_id ? categories.find((p) => p.id === c.parent_id) : null;
                        return <SelectItem key={c.id} value={c.id}>{parent ? `${parent.name} › ${c.name}` : c.name}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
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
              <div><Label>Description complète</Label><Textarea rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
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
              </div>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-3 mt-0">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>SKU</Label><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></div>
                {f.type === "physical" && (
                  <div><Label>Stock</Label><Input type="number" min="0" value={f.stock_quantity} onChange={(e) => setF({ ...f, stock_quantity: e.target.value })} /></div>
                )}
              </div>

              {f.type === "physical" && (
                <p className="text-xs text-muted-foreground">
                  Statut stock : {(Number(f.stock_quantity) || 0) === 0 ? <span className="text-destructive">Rupture</span> : (Number(f.stock_quantity) || 0) <= 5 ? <span className="text-accent">Stock faible</span> : <span className="text-success">En stock</span>}
                </p>
              )}
            </TabsContent>

            <TabsContent value="images" className="mt-0">
              <ImageGalleryManager value={f.images} onChange={(next) => setF({ ...f, images: next })} />
            </TabsContent>

            {f.type === "physical" && (
              <TabsContent value="tiers" className="mt-0">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-semibold">Prix par palier (tarif dégressif)</Label>
                      <p className="text-xs text-muted-foreground">Optionnel. Le prix de base s'applique en dessous du 1er palier.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setF({ ...f, tiers: [...f.tiers, { min_quantity: "", unit_price: "" }] })}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Ajouter
                    </Button>
                  </div>
                  {f.tiers.length === 0 && <p className="text-xs text-muted-foreground">Aucun palier défini.</p>}
                  <div className="space-y-2">
                    {f.tiers.map((t, i) => (
                      <div key={i} className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label className="text-xs">Quantité min.</Label>
                          <Input type="number" min="1" value={t.min_quantity} onChange={(e) => {
                            const next = [...f.tiers]; next[i] = { ...next[i], min_quantity: e.target.value }; setF({ ...f, tiers: next });
                          }} />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs">Prix unitaire (FCFA)</Label>
                          <Input type="number" min="0" value={t.unit_price} onChange={(e) => {
                            const next = [...f.tiers]; next[i] = { ...next[i], unit_price: e.target.value }; setF({ ...f, tiers: next });
                          }} />
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setF({ ...f, tiers: f.tiers.filter((_, j) => j !== i) })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            )}

            <TabsContent value="quality" className="space-y-3 mt-0">
              <div className="flex items-center gap-2">
                <input id="qv" type="checkbox" checked={f.quality_verified} onChange={(e) => setF({ ...f, quality_verified: e.target.checked })} />
                <Label htmlFor="qv" className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Qualité vérifiée</Label>
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
            </TabsContent>

            {hasTypeSpecific && (
              <TabsContent value="type" className="space-y-3 mt-0">
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
              </TabsContent>
            )}
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "..." : "Enregistrer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
