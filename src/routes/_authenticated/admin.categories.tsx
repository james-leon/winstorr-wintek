import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, ChevronUp, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { slugify, PRODUCT_TYPE_LABELS, type ProductType } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: AdminCategories,
});

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  product_type: ProductType;
  parent_id: string | null;
  icon: string | null;
  display_order: number;
  status: "active" | "archived";
};

type WithCount = CategoryRow & { product_count: number };

const TYPES: ProductType[] = ["physical", "digital", "service", "training"];

function AdminCategories() {
  const qc = useQueryClient();
  const [filterType, setFilterType] = useState<ProductType | "all">("all");
  const [editing, setEditing] = useState<CategoryRow | "new" | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const [{ data: cats, error: e1 }, { data: prods, error: e2 }] = await Promise.all([
        supabase.from("categories").select("id, name, slug, product_type, parent_id, icon, display_order, status").order("product_type").order("display_order").order("name"),
        supabase.from("products").select("category_id").not("category_id", "is", null),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const counts = new Map<string, number>();
      (prods ?? []).forEach((p) => {
        const id = (p as { category_id: string | null }).category_id;
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
      });
      return (cats as CategoryRow[]).map((c) => ({ ...c, product_count: counts.get(c.id) ?? 0 }));
    },
  });

  const grouped = useMemo(() => {
    const byType = new Map<ProductType, WithCount[]>();
    for (const t of TYPES) byType.set(t, []);
    for (const r of rows) {
      if (filterType !== "all" && r.product_type !== filterType) continue;
      byType.get(r.product_type)?.push(r);
    }
    // build nested (parents first, then children)
    const nested: { row: WithCount; depth: number }[] = [];
    for (const t of TYPES) {
      const list = byType.get(t) ?? [];
      const parents = list.filter((r) => !r.parent_id).sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
      for (const p of parents) {
        nested.push({ row: p, depth: 0 });
        const children = list.filter((r) => r.parent_id === p.id).sort((a, b) => a.display_order - b.display_order);
        children.forEach((c) => nested.push({ row: c, depth: 1 }));
      }
      // orphans (parent filtered out or missing)
      const parentIds = new Set(parents.map((p) => p.id));
      const orphans = list.filter((r) => r.parent_id && !parentIds.has(r.parent_id));
      orphans.forEach((o) => nested.push({ row: o, depth: 1 }));
    }
    return nested;
  }, [rows, filterType]);

  const nameById = useMemo(() => new Map(rows.map((r) => [r.id, r.name])), [rows]);

  const del = useMutation({
    mutationFn: async (row: WithCount) => {
      if (row.product_count > 0) {
        throw new Error(`Cette catégorie contient ${row.product_count} produit(s), réassignez-les ou archivez-la avant de la supprimer.`);
      }
      const { count } = await supabase.from("categories").select("id", { count: "exact", head: true }).eq("parent_id", row.id);
      if ((count ?? 0) > 0) throw new Error(`Cette catégorie contient ${count} sous-catégorie(s), supprimez-les d'abord.`);
      const { error } = await supabase.from("categories").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supprimée"); qc.invalidateQueries({ queryKey: ["admin-categories"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "archived" }) => {
      const { error } = await supabase.from("categories").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => { toast.success(v.status === "archived" ? "Archivée" : "Réactivée"); qc.invalidateQueries({ queryKey: ["admin-categories"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const swapOrder = useMutation({
    mutationFn: async ({ a, b }: { a: WithCount; b: WithCount }) => {
      // swap display_order values
      const { error: e1 } = await supabase.from("categories").update({ display_order: b.display_order }).eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("categories").update({ display_order: a.display_order }).eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const move = (row: WithCount, dir: -1 | 1) => {
    const siblings = rows
      .filter((r) => r.product_type === row.product_type && r.parent_id === row.parent_id)
      .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
    const idx = siblings.findIndex((r) => r.id === row.id);
    const target = siblings[idx + dir];
    if (!target) return;
    swapOrder.mutate({ a: row, b: target });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Type :</Label>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as ProductType | "all")}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {TYPES.map((t) => <SelectItem key={t} value={t}>{PRODUCT_TYPE_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="ml-2 text-xs text-muted-foreground">{rows.length} catégorie(s)</span>
        </div>
        <Button onClick={() => setEditing("new")}><Plus className="mr-1 h-4 w-4" /> Nouvelle catégorie</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Nom</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Type</th>
              <th className="p-3">Parent</th>
              <th className="p-3">Ordre</th>
              <th className="p-3">Produits</th>
              <th className="p-3">Statut</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Chargement...</td></tr>}
            {!isLoading && grouped.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Aucune catégorie.</td></tr>}
            {grouped.map(({ row, depth }) => (
              <tr key={row.id} className="border-t border-border">
                <td className="p-3 font-medium">
                  <span style={{ paddingLeft: depth * 20 }} className="inline-flex items-center gap-2">
                    {depth > 0 && <span className="text-muted-foreground">└</span>}
                    {row.icon && <span className="text-xs text-muted-foreground">{row.icon}</span>}
                    {row.name}
                  </span>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{row.slug}</td>
                <td className="p-3 text-xs">{PRODUCT_TYPE_LABELS[row.product_type]}</td>
                <td className="p-3 text-xs text-muted-foreground">{row.parent_id ? nameById.get(row.parent_id) ?? "—" : "—"}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <span className="w-6 text-xs">{row.display_order}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(row, -1)}><ChevronUp className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(row, 1)}><ChevronDown className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
                <td className="p-3 text-xs">{row.product_count}</td>
                <td className="p-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${row.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {row.status === "active" ? "actif" : "archivé"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(row)}><Pencil className="h-4 w-4" /></Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={row.status === "active" ? "Archiver" : "Réactiver"}
                      onClick={() => setStatus.mutate({ id: row.id, status: row.status === "active" ? "archived" : "active" })}
                    >
                      {row.status === "active" ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => confirm(`Supprimer ${row.name} ?`) && del.mutate(row)}>
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
        <CategoryDialog
          row={editing === "new" ? null : editing}
          all={rows}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["admin-categories"] }); }}
        />
      )}
    </div>
  );
}

type FormState = {
  name: string; slug: string; product_type: ProductType;
  parent_id: string; icon: string;
  display_order: string; status: "active" | "archived";
};

function CategoryDialog({ row, all, onClose, onSaved }: { row: CategoryRow | null; all: WithCount[]; onClose: () => void; onSaved: () => void }) {
  const isNew = !row;
  const [f, setF] = useState<FormState>({
    name: row?.name ?? "",
    slug: row?.slug ?? "",
    product_type: row?.product_type ?? "physical",
    parent_id: row?.parent_id ?? "none",
    icon: row?.icon ?? "",
    display_order: (row?.display_order ?? 0).toString(),
    status: row?.status ?? "active",
  });

  const parentOptions = all.filter((c) => c.product_type === f.product_type && !c.parent_id && c.id !== row?.id);

  const save = useMutation({
    mutationFn: async () => {
      const slug = (f.slug || slugify(f.name)).trim();
      if (!f.name.trim()) throw new Error("Nom requis");
      if (!slug) throw new Error("Slug requis");

      // Check slug uniqueness
      const { data: existing } = await supabase.from("categories").select("id").eq("slug", slug).maybeSingle();
      if (existing && existing.id !== row?.id) {
        throw new Error(`Le slug "${slug}" est déjà utilisé.`);
      }

      const payload = {
        name: f.name.trim(),
        slug,
        product_type: f.product_type,
        parent_id: f.parent_id === "none" ? null : f.parent_id,
        icon: f.icon.trim() || null,
        display_order: Number(f.display_order) || 0,
        status: f.status,
      };
      if (isNew) {
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").update(payload).eq("id", row!.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(isNew ? "Catégorie créée" : "Catégorie mise à jour"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isNew ? "Nouvelle catégorie" : `Modifier : ${row?.name}`}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Nom *</Label>
              <Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: isNew && !row ? slugify(e.target.value) : f.slug })} />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input required value={f.slug} onChange={(e) => setF({ ...f, slug: slugify(e.target.value) })} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Type de produit *</Label>
              <Select value={f.product_type} onValueChange={(v) => setF({ ...f, product_type: v as ProductType, parent_id: "none" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{PRODUCT_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Catégorie parente</Label>
              <Select value={f.parent_id} onValueChange={(v) => setF({ ...f, parent_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune (catégorie racine)</SelectItem>
                  {parentOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Icône</Label>
              <Input value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} placeholder="ex : 📱 ou smartphone" />
            </div>
            <div>
              <Label>Ordre d'affichage</Label>
              <Input type="number" value={f.display_order} onChange={(e) => setF({ ...f, display_order: e.target.value })} />
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as "active" | "archived" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="archived">Archivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "..." : "Enregistrer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
