import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pause, Play, Pencil, Trash2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatFcfa } from "@/lib/format";
import { Pagination, usePagination } from "@/components/pagination";

export const Route = createFileRoute("/_authenticated/admin/codes-promo")({
  head: () => ({ meta: [{ title: "Codes promo — Admin Winstorr" }] }),
  component: AdminCoupons,
});

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  applies_to: "all_products" | "specific_products" | "specific_category" | "specific_vendor";
  applies_to_ids: string[] | null;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  usage_limit_total: number | null;
  usage_limit_per_customer: number | null;
  current_usage_count: number;
  valid_from: string;
  valid_until: string | null;
  status: "active" | "paused" | "expired";
  excludes_sale_items: boolean;
};

function AdminCoupons() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Coupon | null>(null);

  const { data: coupons = [] } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Coupon[];
    },
  });

  const toggle = useMutation({
    mutationFn: async (c: Coupon) => {
      const next = c.status === "active" ? "paused" : "active";
      const { error } = await supabase.from("coupons").update({ status: next }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Statut mis à jour"); qc.invalidateQueries({ queryKey: ["admin-coupons"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Code supprimé"); qc.invalidateQueries({ queryKey: ["admin-coupons"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { page, setPage, paged, total, pageCount, rangeStart, rangeEnd } = usePagination(coupons, 25);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Codes promo</h2>
        <Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" /> Nouveau code</Button>
      </div>

      <div className="rounded-sm border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Réduction</th>
              <th className="p-3">Portée</th>
              <th className="p-3">Utilisations</th>
              <th className="p-3">Validité</th>
              <th className="p-3">Statut</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paged.map((c) => (
              <tr key={c.id}>
                <td className="p-3">
                  <div className="font-mono font-semibold">{c.code}</div>
                  {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
                </td>
                <td className="p-3">
                  {c.discount_type === "percentage"
                    ? `${c.discount_value}%${c.max_discount_amount ? ` (max ${formatFcfa(c.max_discount_amount)})` : ""}`
                    : formatFcfa(c.discount_value)}
                </td>
                <td className="p-3 text-xs">
                  {c.applies_to === "all_products" ? "Tous les produits" :
                   c.applies_to === "specific_products" ? `${c.applies_to_ids?.length ?? 0} produit(s)` :
                   c.applies_to === "specific_category" ? "Catégorie" : "Vendeur"}
                </td>
                <td className="p-3 text-xs">
                  {c.current_usage_count} / {c.usage_limit_total ?? "∞"}
                  {c.usage_limit_per_customer && <div className="text-muted-foreground">{c.usage_limit_per_customer} / client</div>}
                </td>
                <td className="p-3 text-xs">
                  {c.valid_until ? `jusqu'au ${new Date(c.valid_until).toLocaleDateString("fr-FR")}` : "sans expiration"}
                </td>
                <td className="p-3">
                  <span className={
                    c.status === "active" ? "text-success text-xs font-medium" :
                    c.status === "paused" ? "text-muted-foreground text-xs" :
                    "text-destructive text-xs"
                  }>{c.status}</span>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setViewing(c)} title="Historique">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggle.mutate(c)} title={c.status === "active" ? "Mettre en pause" : "Réactiver"}>
                      {c.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)} title="Modifier">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Supprimer ${c.code} ?`)) del.mutate(c.id); }} title="Supprimer">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Aucun code promo.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} total={total} rangeStart={rangeStart} rangeEnd={rangeEnd} onPageChange={setPage} label="codes" />

      {(creating || editing) && (
        <CouponDialog
          coupon={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["admin-coupons"] }); setCreating(false); setEditing(null); }}
        />
      )}

      {viewing && <RedemptionsDialog coupon={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function CouponDialog({ coupon, onClose, onSaved }: { coupon: Coupon | null; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(coupon?.code ?? "");
  const [description, setDescription] = useState(coupon?.description ?? "");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount">(coupon?.discount_type ?? "percentage");
  const [discountValue, setDiscountValue] = useState(String(coupon?.discount_value ?? ""));
  const [appliesTo, setAppliesTo] = useState<Coupon["applies_to"]>(coupon?.applies_to ?? "all_products");
  const [appliesToIds, setAppliesToIds] = useState<string[]>(coupon?.applies_to_ids ?? []);
  const [minOrder, setMinOrder] = useState(coupon?.min_order_amount?.toString() ?? "");
  const [maxDiscount, setMaxDiscount] = useState(coupon?.max_discount_amount?.toString() ?? "");
  const [limitTotal, setLimitTotal] = useState(coupon?.usage_limit_total?.toString() ?? "");
  const [limitPerCustomer, setLimitPerCustomer] = useState(coupon?.usage_limit_per_customer?.toString() ?? "1");
  const [validFrom, setValidFrom] = useState((coupon?.valid_from ?? new Date().toISOString()).slice(0, 10));
  const [validUntil, setValidUntil] = useState(coupon?.valid_until ? coupon.valid_until.slice(0, 10) : "");
  const [status, setStatus] = useState<Coupon["status"]>(coupon?.status ?? "active");
  const [excludesSale, setExcludesSale] = useState(coupon?.excludes_sale_items ?? false);

  // Load options depending on scope
  const { data: products = [] } = useQuery({
    queryKey: ["admin-coupon-products"],
    enabled: appliesTo === "specific_products",
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name").order("name").limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["admin-coupon-categories"],
    enabled: appliesTo === "specific_category",
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ["admin-coupon-vendors"],
    enabled: appliesTo === "specific_vendor",
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!code.trim()) throw new Error("Code requis.");
      if (!discountValue || Number(discountValue) <= 0) throw new Error("Valeur de réduction invalide.");
      if (appliesTo !== "all_products" && appliesToIds.length === 0) {
        throw new Error("Sélectionnez au moins un élément pour la portée choisie.");
      }
      const payload = {
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        discount_type: discountType,
        discount_value: Number(discountValue),
        applies_to: appliesTo,
        applies_to_ids: appliesTo === "all_products" ? null : appliesToIds,
        min_order_amount: minOrder ? Number(minOrder) : null,
        max_discount_amount: maxDiscount ? Number(maxDiscount) : null,
        usage_limit_total: limitTotal ? Number(limitTotal) : null,
        usage_limit_per_customer: limitPerCustomer ? Number(limitPerCustomer) : null,
        valid_from: new Date(validFrom).toISOString(),
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        status,
        excludes_sale_items: excludesSale,
      };
      if (coupon) {
        const { error } = await supabase.from("coupons").update(payload).eq("id", coupon.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coupons").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(coupon ? "Code mis à jour" : "Code créé"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const scopeOptions = useMemo(() => {
    if (appliesTo === "specific_products") return products.map((p) => ({ id: p.id, label: p.name }));
    if (appliesTo === "specific_category") return categories.map((c) => ({ id: c.id, label: c.name }));
    if (appliesTo === "specific_vendor") return vendors.map((v) => ({ id: v.id, label: v.name }));
    return [];
  }, [appliesTo, products, categories, vendors]);

  const singleScope = appliesTo === "specific_category" || appliesTo === "specific_vendor";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{coupon ? "Modifier le code" : "Nouveau code promo"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Code *</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BIENVENUE10" className="uppercase font-mono" />
          </div>
          <div className="sm:col-span-2">
            <Label>Description (interne)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Type de réduction *</Label>
            <Select value={discountType} onValueChange={(v) => setDiscountType(v as typeof discountType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                <SelectItem value="fixed_amount">Montant fixe (FCFA)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valeur *</Label>
            <Input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountType === "percentage" ? "10" : "2000"} />
          </div>
          <div>
            <Label>Portée</Label>
            <Select value={appliesTo} onValueChange={(v) => { setAppliesTo(v as typeof appliesTo); setAppliesToIds([]); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_products">Tous les produits</SelectItem>
                <SelectItem value="specific_products">Produits spécifiques</SelectItem>
                <SelectItem value="specific_category">Catégorie</SelectItem>
                <SelectItem value="specific_vendor">Vendeur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Statut</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="paused">En pause</SelectItem>
                <SelectItem value="expired">Expiré</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {appliesTo !== "all_products" && (
            <div className="sm:col-span-2">
              <Label>{singleScope ? "Sélection" : "Produits éligibles"}</Label>
              {singleScope ? (
                <Select value={appliesToIds[0] ?? ""} onValueChange={(v) => setAppliesToIds([v])}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {scopeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-sm border border-border p-2 space-y-1">
                  {scopeOptions.length === 0 && <p className="text-xs text-muted-foreground">Aucun élément.</p>}
                  {scopeOptions.map((o) => (
                    <label key={o.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer hover:bg-muted rounded px-1">
                      <Checkbox
                        checked={appliesToIds.includes(o.id)}
                        onCheckedChange={(checked) => {
                          setAppliesToIds((prev) => checked ? [...prev, o.id] : prev.filter((x) => x !== o.id));
                        }}
                      />
                      <span className="line-clamp-1">{o.label}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{appliesToIds.length} sélectionné(s)</p>
            </div>
          )}

          <div>
            <Label>Montant minimum (FCFA)</Label>
            <Input type="number" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} placeholder="Optionnel" />
          </div>
          {discountType === "percentage" && (
            <div>
              <Label>Plafond de réduction (FCFA)</Label>
              <Input type="number" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="Optionnel" />
            </div>
          )}
          <div>
            <Label>Utilisations totales max</Label>
            <Input type="number" value={limitTotal} onChange={(e) => setLimitTotal(e.target.value)} placeholder="Illimité" />
          </div>
          <div>
            <Label>Utilisations par client</Label>
            <Input type="number" value={limitPerCustomer} onChange={(e) => setLimitPerCustomer(e.target.value)} placeholder="1" />
          </div>
          <div>
            <Label>Valide à partir de</Label>
            <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </div>
          <div>
            <Label>Valide jusqu'au</Label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <Checkbox id="excludes-sale" checked={excludesSale} onCheckedChange={(c) => setExcludesSale(Boolean(c))} />
            <Label htmlFor="excludes-sale" className="cursor-pointer">Exclure les articles déjà en promotion</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RedemptionsDialog({ coupon, onClose }: { coupon: Coupon; onClose: () => void }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["coupon-redemptions", coupon.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupon_redemptions")
        .select("id, order_id, customer_email, discount_applied, created_at, orders(order_number, total)")
        .eq("coupon_id", coupon.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalDiscount = rows.reduce((sum, r) => sum + Number(r.discount_applied), 0);
  const avgOrderValue = rows.length > 0
    ? rows.reduce((sum, r) => sum + Number((r.orders as unknown as { total: number } | null)?.total ?? 0), 0) / rows.length
    : 0;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historique — <span className="font-mono">{coupon.code}</span></DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-sm border border-border p-3">
            <div className="text-xs text-muted-foreground">Redemptions</div>
            <div className="text-lg font-bold">{rows.length}</div>
          </div>
          <div className="rounded-sm border border-border p-3">
            <div className="text-xs text-muted-foreground">Réduction totale</div>
            <div className="text-lg font-bold text-success">{formatFcfa(totalDiscount)}</div>
          </div>
          <div className="rounded-sm border border-border p-3">
            <div className="text-xs text-muted-foreground">Panier moyen</div>
            <div className="text-lg font-bold">{formatFcfa(avgOrderValue)}</div>
          </div>
        </div>
        <div className="rounded-sm border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2">Commande</th>
                <th className="p-2">Client</th>
                <th className="p-2">Réduction</th>
                <th className="p-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const order = r.orders as unknown as { order_number: string } | null;
                return (
                  <tr key={r.id}>
                    <td className="p-2 font-mono text-xs">{order?.order_number ?? r.order_id.slice(0, 8)}</td>
                    <td className="p-2 text-xs">{r.customer_email ?? "—"}</td>
                    <td className="p-2 text-success font-medium">{formatFcfa(Number(r.discount_applied))}</td>
                    <td className="p-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Aucune utilisation.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
