import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Star, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatFcfa } from "@/lib/format";
import { uploadProductImage } from "@/lib/image-upload";
import { SkeletonListRows } from "@/components/skeletons";

type VariantRow = {
  id: string;
  product_id: string;
  sku: string | null;
  attributes: Record<string, string>;
  price: number | null;
  compare_at_price: number | null;
  stock_quantity: number;
  image_url: string | null;
  min_order_quantity: number | null;
  is_default: boolean;
  status: "active" | "archived";
};

type Draft = {
  id?: string;
  sku: string;
  attributes: { key: string; value: string }[];
  price: string;
  compare_at_price: string;
  stock_quantity: string;
  image_url: string;
  min_order_quantity: string;
  is_default: boolean;
  status: "active" | "archived";
};

const emptyDraft = (): Draft => ({
  sku: "",
  attributes: [{ key: "", value: "" }],
  price: "",
  compare_at_price: "",
  stock_quantity: "0",
  image_url: "",
  min_order_quantity: "",
  is_default: false,
  status: "active",
});

const toDraft = (r: VariantRow): Draft => ({
  id: r.id,
  sku: r.sku ?? "",
  attributes: Object.keys(r.attributes ?? {}).length > 0
    ? Object.entries(r.attributes).map(([k, v]) => ({ key: k, value: String(v) }))
    : [{ key: "", value: "" }],
  price: r.price != null ? String(r.price) : "",
  compare_at_price: r.compare_at_price != null ? String(r.compare_at_price) : "",
  stock_quantity: String(r.stock_quantity ?? 0),
  image_url: r.image_url ?? "",
  min_order_quantity: r.min_order_quantity != null ? String(r.min_order_quantity) : "",
  is_default: r.is_default,
  status: r.status,
});

export function VariantsManager({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["variants", productId],
    queryFn: async (): Promise<VariantRow[]> => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, product_id, sku, attributes, price, compare_at_price, stock_quantity, image_url, min_order_quantity, is_default, status")
        .eq("product_id", productId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        attributes: (r.attributes ?? {}) as Record<string, string>,
      })) as VariantRow[];
    },
  });

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [openId, setOpenId] = useState<string | "new" | null>(null);

  const startEdit = (r: VariantRow) => {
    setDrafts([toDraft(r)]);
    setOpenId(r.id);
  };
  const startNew = () => {
    setDrafts([emptyDraft()]);
    setOpenId("new");
  };
  const cancel = () => { setDrafts([]); setOpenId(null); };

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const attrs: Record<string, string> = {};
      for (const a of d.attributes) {
        const k = a.key.trim();
        const v = a.value.trim();
        if (k && v) attrs[k] = v;
      }
      if (Object.keys(attrs).length === 0) throw new Error("Ajoutez au moins un attribut (ex : Contenance / 1L).");

      const payload = {
        product_id: productId,
        sku: d.sku.trim() || null,
        attributes: attrs,
        price: d.price === "" ? null : Number(d.price),
        compare_at_price: d.compare_at_price === "" ? null : Number(d.compare_at_price),
        stock_quantity: Math.max(0, parseInt(d.stock_quantity || "0", 10) || 0),
        image_url: d.image_url.trim() || null,
        min_order_quantity: d.min_order_quantity === "" ? null : Math.max(1, parseInt(d.min_order_quantity, 10) || 1),
        is_default: d.is_default,
        status: d.status,
      };

      if (d.is_default && d.id) {
        // Unset other defaults first
        await supabase.from("product_variants").update({ is_default: false }).eq("product_id", productId).neq("id", d.id);
      } else if (d.is_default && !d.id) {
        await supabase.from("product_variants").update({ is_default: false }).eq("product_id", productId);
      }

      if (d.id) {
        const { error } = await supabase.from("product_variants").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_variants").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Variante enregistrée");
      setDrafts([]);
      setOpenId(null);
      qc.invalidateQueries({ queryKey: ["variants", productId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_variants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Variante supprimée");
      qc.invalidateQueries({ queryKey: ["variants", productId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const current = drafts[0];

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Label className="text-sm font-semibold">Variantes</Label>
          <p className="text-xs text-muted-foreground">
            Ex : Contenance 1L / 0.5L, Taille 42/43/44, Couleur… Chaque variante a son prix, stock et image.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" className="w-full shrink-0 sm:w-auto" onClick={startNew} disabled={openId !== null}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Ajouter une variante
        </Button>
      </div>


      {isLoading ? (
        <SkeletonListRows rows={3} />
      ) : rows.length === 0 && openId !== "new" ? (
        <p className="rounded-sm border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          Aucune variante définie. Le produit se comporte alors comme un article simple (prix et stock au niveau du produit).
        </p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2">Attributs</th>
                <th className="p-2">Prix</th>
                <th className="p-2">Stock</th>
                <th className="p-2">MOQ</th>
                <th className="p-2">SKU</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2">
                    {Object.entries(r.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}
                    {r.is_default && <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-accent"><Star className="h-3 w-3 fill-current" /> défaut</span>}
                    {r.status === "archived" && <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Archivée</span>}
                  </td>
                  <td className="p-2">{r.price != null ? formatFcfa(Number(r.price)) : <span className="text-muted-foreground">hérité</span>}</td>
                  <td className="p-2">{r.stock_quantity}</td>
                  <td className="p-2">{r.min_order_quantity ?? <span className="text-muted-foreground">hérité</span>}</td>
                  <td className="p-2 text-xs text-muted-foreground">{r.sku ?? "—"}</td>
                  <td className="p-2">
                    <div className="flex justify-end gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => startEdit(r)} disabled={openId !== null}>
                        Modifier
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => confirm("Supprimer cette variante ?") && del.mutate(r.id)} aria-label="Supprimer">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {current && (
        <div className="space-y-3 rounded-sm border border-accent/40 bg-accent/5 p-3">
          <div className="text-sm font-semibold">{current.id ? "Modifier la variante" : "Nouvelle variante"}</div>

          <div className="space-y-2">
            <Label className="text-xs">Attributs *</Label>
            {current.attributes.map((a, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  placeholder="Nom (ex : Contenance)"
                  value={a.key}
                  onChange={(e) => {
                    const next = [...current.attributes];
                    next[idx] = { ...next[idx], key: e.target.value };
                    setDrafts([{ ...current, attributes: next }]);
                  }}
                />
                <Input
                  placeholder="Valeur (ex : 1L)"
                  value={a.value}
                  onChange={(e) => {
                    const next = [...current.attributes];
                    next[idx] = { ...next[idx], value: e.target.value };
                    setDrafts([{ ...current, attributes: next }]);
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    const next = current.attributes.filter((_, i) => i !== idx);
                    setDrafts([{ ...current, attributes: next.length ? next : [{ key: "", value: "" }] }]);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDrafts([{ ...current, attributes: [...current.attributes, { key: "", value: "" }] }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Ajouter un attribut
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Prix (FCFA)</Label>
              <Input
                type="number"
                min="0"
                placeholder="Hérite du produit"
                value={current.price}
                onChange={(e) => setDrafts([{ ...current, price: e.target.value }])}
              />
            </div>
            <div>
              <Label className="text-xs">Prix barré (FCFA)</Label>
              <Input
                type="number"
                min="0"
                value={current.compare_at_price}
                onChange={(e) => setDrafts([{ ...current, compare_at_price: e.target.value }])}
              />
            </div>
            <div>
              <Label className="text-xs">Stock</Label>
              <Input
                type="number"
                min="0"
                value={current.stock_quantity}
                onChange={(e) => setDrafts([{ ...current, stock_quantity: e.target.value }])}
              />
            </div>
            <div>
              <Label className="text-xs">SKU</Label>
              <Input value={current.sku} onChange={(e) => setDrafts([{ ...current, sku: e.target.value }])} />
            </div>
            <div>
              <Label className="text-xs">Quantité minimum</Label>
              <Input
                type="number"
                min="1"
                placeholder="Hérite du produit"
                value={current.min_order_quantity}
                onChange={(e) => setDrafts([{ ...current, min_order_quantity: e.target.value }])}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id={`def-${current.id ?? "new"}`}
                type="checkbox"
                checked={current.is_default}
                onChange={(e) => setDrafts([{ ...current, is_default: e.target.checked }])}
              />
              <Label htmlFor={`def-${current.id ?? "new"}`} className="text-xs">Variante par défaut</Label>
            </div>
          </div>

          <div>
            <Label className="text-xs">Image (optionnelle)</Label>
            <div className="mt-1 flex items-center gap-2">
              {current.image_url && (
                <img src={current.image_url} alt="" className="h-14 w-14 rounded-sm border border-border object-contain bg-white" />
              )}
              <Input
                placeholder="URL de l'image"
                value={current.image_url}
                onChange={(e) => setDrafts([{ ...current, image_url: e.target.value }])}
              />
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-sm border border-border px-2 py-1 text-xs hover:bg-muted">
                <Upload className="h-3.5 w-3.5" /> Uploader
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const url = await uploadProductImage(file);
                      setDrafts([{ ...current, image_url: url }]);
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <Label className="text-xs">Statut</Label>
            <select
              className="mt-1 h-9 w-full rounded-sm border border-input bg-background px-3 text-sm"
              value={current.status}
              onChange={(e) => setDrafts([{ ...current, status: e.target.value as "active" | "archived" }])}
            >
              <option value="active">Active</option>
              <option value="archived">Archivée</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-2">
            <Button type="button" variant="outline" onClick={cancel}>Annuler</Button>
            <Button type="button" onClick={() => save.mutate(current)} disabled={save.isPending}>
              {save.isPending ? "…" : "Enregistrer la variante"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
