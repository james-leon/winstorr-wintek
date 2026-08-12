import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, X, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatFcfa } from "@/lib/format";
import { useMyVendors } from "@/lib/vendor";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { waTemplates } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { SkeletonTableRows } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/vendeur/commandes")({
  component: VendorOrders,
});

const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  pending_acceptance: "À confirmer",
  accepted: "Acceptée",
  refused: "Refusée",
  pending_pickup: "En préparation",
  ready_for_pickup: "Prête",
  shipped: "Expédiée",
  delivered: "Livrée",
  completed: "Terminée",
  cancelled: "Annulée",
};

const REFUSAL_REASONS = [
  { value: "rupture_stock", label: "Rupture de stock" },
  { value: "produit_endommage", label: "Produit endommagé" },
  { value: "prix_incorrect", label: "Prix incorrect" },
  { value: "autre", label: "Autre" },
];

type Shipment = {
  id: string;
  shipment_number: string;
  status: string;
  acceptance_status: "pending_acceptance" | "accepted" | "refused";
  acceptance_deadline: string | null;
  accepted_at: string | null;
  refused_at: string | null;
  refusal_reason: string | null;
  subtotal: number;
  currency: string;
  created_at: string;
  order: {
    id: string;
    order_number: string;
    customer_name: string;
    customer_phone: string | null;
    status: string;
    created_at: string;
    has_physical_items: boolean;
    shipping_address: any;
    delivery_mode: string | null;
  };
  items: {
    id: string;
    product_name: string;
    quantity: number;
    subtotal: number;
  }[];
};

function formatCountdown(deadline: string | null, now: number): { text: string; urgent: boolean; expired: boolean } {
  if (!deadline) return { text: "—", urgent: false, expired: false };
  const diff = new Date(deadline).getTime() - now;
  if (diff <= 0) return { text: "Délai dépassé", urgent: true, expired: true };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return {
    text: h > 0 ? `${h}h ${m}min restantes` : `${m}min restantes`,
    urgent: diff < 4 * 3600000,
    expired: false,
  };
}

function VendorOrders() {
  const { data: memberships } = useMyVendors();
  const vendorId = memberships?.[0]?.vendor_id;
  const qc = useQueryClient();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [refuseFor, setRefuseFor] = useState<Shipment | null>(null);
  const [refuseReason, setRefuseReason] = useState("rupture_stock");
  const [refuseNotes, setRefuseNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-shipments", vendorId],
    enabled: !!vendorId,
    queryFn: async (): Promise<Shipment[]> => {
      const { data: shipments, error } = await supabase
        .from("order_shipments")
        .select(`
          id, shipment_number, status, acceptance_status, acceptance_deadline,
          accepted_at, refused_at, refusal_reason, subtotal, currency, created_at,
          orders!inner(id, order_number, customer_name, customer_phone, status, created_at, has_physical_items, shipping_address, delivery_mode)
        `)
        .eq("vendor_id", vendorId!)
        .order("acceptance_deadline", { ascending: true, nullsFirst: false })
        .limit(300);
      if (error) throw error;

      const ids = (shipments ?? []).map((s: any) => s.id);
      if (ids.length === 0) return [];
      const { data: items } = await supabase
        .from("order_items")
        .select("id, shipment_id, product_name, quantity, subtotal")
        .in("shipment_id", ids);
      const byShip = new Map<string, any[]>();
      for (const it of items ?? []) {
        const arr = byShip.get(it.shipment_id!) ?? [];
        arr.push(it);
        byShip.set(it.shipment_id!, arr);
      }
      return (shipments ?? []).map((s: any) => ({
        ...s,
        order: s.orders,
        items: byShip.get(s.id) ?? [],
      }));
    },
  });

  const acceptMut = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("vendor_accept_shipment", { _shipment_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Expédition acceptée.");
      qc.invalidateQueries({ queryKey: ["vendor-shipments"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const refuseMut = useMutation({
    mutationFn: async ({ id, reason, notes }: { id: string; reason: string; notes: string }) => {
      const { data, error } = await supabase.rpc("vendor_refuse_shipment", {
        _shipment_id: id,
        _reason: reason as "rupture_stock" | "produit_endommage" | "prix_incorrect" | "autre",
        _notes: notes || undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Expédition refusée. Un remboursement a été initié.");
      setRefuseFor(null);
      setRefuseNotes("");
      qc.invalidateQueries({ queryKey: ["vendor-shipments"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const pending = (data ?? []).filter((s) => s.acceptance_status === "pending_acceptance");
  const others = (data ?? []).filter((s) => s.acceptance_status !== "pending_acceptance");

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Chaque commande payée génère une expédition par vendeur. Vous avez <strong>24 heures</strong> pour l'accepter ou la refuser — sans réponse, elle est automatiquement refusée et remboursée au client.
      </div>

      {pending.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-accent" />
            À confirmer sous 24h ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((s) => {
              const cd = formatCountdown(s.acceptance_deadline, now);
              return (
                <div key={s.id} className={cn(
                  "rounded-md border p-3 bg-card",
                  cd.urgent ? "border-destructive/40 bg-destructive/5" : "border-border",
                )}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-muted-foreground">
                        {s.shipment_number} · Commande {s.order.order_number}
                      </div>
                      <div className="text-sm font-medium">{s.order.customer_name}</div>
                      <ul className="mt-1 text-xs text-muted-foreground">
                        {s.items.map((it) => (
                          <li key={it.id}>{it.product_name} × {it.quantity}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-accent">{formatFcfa(Number(s.subtotal))}</div>
                      <div className={cn(
                        "mt-1 inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs",
                        cd.urgent ? "bg-destructive/10 text-destructive" : "bg-muted",
                      )}>
                        <Clock className="h-3 w-3" /> {cd.text}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => acceptMut.mutate(s.id)}
                      disabled={acceptMut.isPending}
                    >
                      <Check className="mr-1 h-4 w-4" /> Accepter
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setRefuseFor(s); setRefuseReason("rupture_stock"); setRefuseNotes(""); }}
                    >
                      <X className="mr-1 h-4 w-4" /> Refuser
                    </Button>
                    <WhatsAppButton
                      phone={s.order.customer_phone}
                      message={waTemplates.vendorContact({
                        customer_name: s.order.customer_name,
                        order_number: s.order.order_number,
                        shipment_number: s.shipment_number,
                      })}
                      label="Contacter client"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Historique ({others.length})
        </h2>
        <div className="rounded-md border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2">Expédition</th>
                <th className="p-2">Commande</th>
                <th className="p-2">Client</th>
                <th className="p-2">Articles</th>
                <th className="p-2">Sous-total</th>
                <th className="p-2">Statut</th>
                <th className="p-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <SkeletonTableRows rows={6} cols={8} />}
              {others.map((s) => (
                <tr key={s.id} className="hover:bg-muted/40">
                  <td className="p-2 font-mono text-xs">{s.shipment_number}</td>
                  <td className="p-2 font-mono text-xs">{s.order.order_number}</td>
                  <td className="p-2">{s.order.customer_name}</td>
                  <td className="p-2 text-xs">
                    {s.items.length} ligne(s) · {s.items.reduce((a, i) => a + i.quantity, 0)} unité(s)
                  </td>
                  <td className="p-2 font-semibold text-accent">{formatFcfa(Number(s.subtotal))}</td>
                  <td className="p-2">
                    <span className={cn(
                      "rounded-sm px-2 py-0.5 text-xs",
                      s.acceptance_status === "accepted" ? "bg-success/10 text-success" :
                      s.acceptance_status === "refused" ? "bg-destructive/10 text-destructive" :
                      "bg-muted",
                    )}>
                      {SHIPMENT_STATUS_LABEL[s.status] ?? s.status}
                    </span>
                    {s.acceptance_status === "refused" && s.refusal_reason && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {s.refusal_reason === "delai_depasse" ? "Auto-refus (24h dépassées)" : s.refusal_reason}
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
              {others.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucune expédition dans l'historique.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={!!refuseFor} onOpenChange={(v) => { if (!v) setRefuseFor(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser l'expédition {refuseFor?.shipment_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Le client sera automatiquement remboursé du sous-total ({refuseFor && formatFcfa(Number(refuseFor.subtotal))}). Cette action est irréversible.
            </p>
            <div>
              <label className="block mb-1 font-medium">Motif</label>
              <select
                value={refuseReason}
                onChange={(e) => setRefuseReason(e.target.value)}
                className="h-9 w-full rounded-sm border border-input bg-background px-3 text-sm"
              >
                {REFUSAL_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 font-medium">Note (facultatif)</label>
              <Textarea
                rows={3}
                value={refuseNotes}
                onChange={(e) => setRefuseNotes(e.target.value)}
                placeholder="Précisions internes…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefuseFor(null)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={refuseMut.isPending}
              onClick={() => refuseFor && refuseMut.mutate({ id: refuseFor.id, reason: refuseReason, notes: refuseNotes })}
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
