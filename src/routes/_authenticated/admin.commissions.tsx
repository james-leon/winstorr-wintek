import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/admin/commissions")({
  component: AdminCommissions,
});

type Scope = "global" | "vendor" | "category" | "product";

function useScopeTargets() {
  const { data: vendors = [] } = useQuery({
    queryKey: ["commission-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["commission-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, product_type")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  return { vendors, categories };
}

function AdminCommissions() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { vendors, categories } = useScopeTargets();

  const { data: rules = [] } = useQuery({
    queryKey: ["commission-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_rules")
        .select("id, scope, scope_id, commission_type, commission_value, priority, is_active, created_at")
        .order("scope").order("priority", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const scopeIds = rules.filter((r) => r.scope === "product" && r.scope_id).map((r) => r.scope_id as string);
  const { data: products = [] } = useQuery({
    queryKey: ["commission-rule-products", scopeIds.join(",")],
    enabled: scopeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name").in("id", scopeIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const targetName = (scope: string, id: string | null) => {
    if (scope === "global" || !id) return "—";
    const list = scope === "vendor" ? vendors : scope === "category" ? categories : products;
    return (list as { id: string; name: string }[]).find((x) => x.id === id)?.name ?? "—";
  };

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commission_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Règle supprimée"); qc.invalidateQueries({ queryKey: ["commission-rules"] }); },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("commission_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commission-rules"] }),
  });


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-foreground">Commissions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Précédence : <b>Produit</b> → <b>Catégorie</b> → <b>Vendeur</b> → <b>Global</b>. La première règle active trouvée s'applique à chaque ligne de commande.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> Nouvelle règle</Button>
      </div>

      <div className="overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Portée</th>
              <th className="p-3">Cible</th>
              <th className="p-3">Type</th>
              <th className="p-3">Valeur</th>
              <th className="p-3">Priorité</th>
              <th className="p-3">Actif</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((r) => (
              <tr key={r.id}>
                <td className="p-3 font-medium capitalize">{r.scope}</td>
                <td className="p-3 text-xs">{targetName(r.scope, r.scope_id)}</td>
                <td className="p-3 text-xs">{r.commission_type === "percentage" ? "Pourcentage" : "Fixe"}</td>
                <td className="p-3 font-semibold">{r.commission_type === "percentage" ? `${r.commission_value}%` : `${r.commission_value} FCFA`}</td>
                <td className="p-3 text-xs">{r.priority}</td>
                <td className="p-3">
                  <input type="checkbox" checked={r.is_active} onChange={(e) => toggle.mutate({ id: r.id, is_active: e.target.checked })} />
                </td>
                <td className="p-3 text-right">
                  <ConfirmDialog
                    trigger={<Button size="sm" variant="ghost"><Trash2 className="h-3.5 w-3.5" /></Button>}
                    title="Supprimer cette règle ?"
                    description="Les commandes historiques conservent leur snapshot de commission."
                    onConfirm={() => del.mutate(r.id)}
                  />
                </td>
              </tr>
            ))}
            {rules.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucune règle.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && <CreateRuleDialog onClose={() => setOpen(false)} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["commission-rules"] }); }} />}
    </div>
  );
}

function CreateRuleDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [scope, setScope] = useState<Scope>("global");
  const [scopeId, setScopeId] = useState("");
  const [ctype, setCtype] = useState<"percentage" | "fixed_amount">("percentage");
  const [cval, setCval] = useState("10");
  const [priority, setPriority] = useState<string>("10");

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("commission_rules").insert({
        scope,
        scope_id: scope === "global" ? null : scopeId || null,
        commission_type: ctype,
        commission_value: Number(cval),
        priority: Number(priority),
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Règle créée"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvelle règle de commission</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Portée *</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global (défaut)</SelectItem>
                <SelectItem value="vendor">Vendeur spécifique</SelectItem>
                <SelectItem value="category">Catégorie</SelectItem>
                <SelectItem value="product">Produit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope !== "global" && (
            <div>
              <Label>ID {scope} *</Label>
              <Input value={scopeId} onChange={(e) => setScopeId(e.target.value)} placeholder="UUID" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Type *</Label>
              <Select value={ctype} onValueChange={(v) => setCtype(v as "percentage" | "fixed_amount")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Pourcentage</SelectItem>
                  <SelectItem value="fixed_amount">Montant fixe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Valeur *</Label><Input type="number" value={cval} onChange={(e) => setCval(e.target.value)} /></div>
          </div>
          <div><Label>Priorité (plus élevé = plus prioritaire)</Label><Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>{mut.isPending ? "…" : "Créer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
