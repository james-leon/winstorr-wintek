import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyVendors } from "@/lib/vendor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createVendorCoupon } from "@/lib/marketplace.functions";

export const Route = createFileRoute("/_authenticated/vendeur/codes-promo")({
  component: VendorCoupons,
});

function VendorCoupons() {
  const { data: memberships } = useMyVendors();
  const vendorId = memberships?.[0]?.vendor_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: cap = 30 } = useQuery({
    queryKey: ["max-vendor-discount"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "max_vendor_discount_percentage").maybeSingle();
      return Number((data?.value as { max?: number } | null)?.max ?? 30);
    },
  });

  const { data: coupons = [] } = useQuery({
    queryKey: ["vendor-coupons", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("id, code, description, discount_type, discount_value, status, valid_until, current_usage_count, usage_limit_total")
        .eq("vendor_id", vendorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "disabled" }) => {
      const { error } = await supabase.from("coupons").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-coupons", vendorId] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-foreground">Mes codes promo</h2>
        <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> Nouveau code</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Réduction maximum autorisée : <span className="font-semibold text-foreground">{cap}%</span> (fixé par la plateforme).
      </p>

      <div className="overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Réduction</th>
              <th className="p-3">Utilisations</th>
              <th className="p-3">Expire</th>
              <th className="p-3">Statut</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {coupons.map((c) => (
              <tr key={c.id}>
                <td className="p-3 font-mono font-semibold">{c.code}</td>
                <td className="p-3">{c.discount_type === "percentage" ? `${c.discount_value}%` : `${c.discount_value} FCFA`}</td>
                <td className="p-3 text-xs">{c.current_usage_count}{c.usage_limit_total ? ` / ${c.usage_limit_total}` : ""}</td>
                <td className="p-3 text-xs">{c.valid_until ? new Date(c.valid_until).toLocaleDateString("fr-FR") : "—"}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs ${c.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{c.status}</span></td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => toggle.mutate({ id: c.id, status: c.status === "active" ? "paused" : "active" })}>
                    {c.status === "active" ? "Désactiver" : "Activer"}
                  </Button>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucun code promo.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && vendorId && (
        <CreateDialog vendorId={vendorId} cap={cap} onClose={() => setOpen(false)} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["vendor-coupons", vendorId] }); }} />
      )}
    </div>
  );
}

function CreateDialog({ vendorId, cap, onClose, onDone }: {
  vendorId: string; cap: number; onClose: () => void; onDone: () => void;
}) {
  const [code, setCode] = useState("");
  const [dtype, setDtype] = useState<"percentage" | "fixed_amount">("percentage");
  const [dvalue, setDvalue] = useState<string>("10");
  const [min, setMin] = useState<string>("");
  const [limit, setLimit] = useState<string>("");
  const [until, setUntil] = useState<string>("");

  const fn = useServerFn(createVendorCoupon);
  const mut = useMutation({
    mutationFn: () => fn({ data: {
      vendor_id: vendorId,
      code,
      discount_type: dtype,
      discount_value: Number(dvalue),
      min_order_amount: min ? Number(min) : null,
      usage_limit_total: limit ? Number(limit) : null,
      valid_until: until ? new Date(until).toISOString() : null,
    }}),
    onSuccess: () => { toast.success("Code créé"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau code promo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Code *</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SUMMER20" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Type *</Label>
              <select className="mt-1 h-10 w-full rounded-sm border border-border bg-background px-3 text-sm" value={dtype} onChange={(e) => setDtype(e.target.value as "percentage" | "fixed_amount")}>
                <option value="percentage">Pourcentage</option>
                <option value="fixed_amount">Montant fixe</option>
              </select>
            </div>
            <div>
              <Label>Valeur * {dtype === "percentage" && <span className="text-xs text-muted-foreground">(max {cap}%)</span>}</Label>
              <Input type="number" value={dvalue} onChange={(e) => setDvalue(e.target.value)} max={dtype === "percentage" ? cap : undefined} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Panier min. (FCFA)</Label><Input type="number" value={min} onChange={(e) => setMin(e.target.value)} /></div>
            <div><Label>Utilisations max.</Label><Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} /></div>
          </div>
          <div><Label>Expire le</Label><Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={mut.isPending || !code || !dvalue} onClick={() => mut.mutate()}>{mut.isPending ? "…" : "Créer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
