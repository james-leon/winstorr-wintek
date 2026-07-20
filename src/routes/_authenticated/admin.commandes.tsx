import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatFcfa } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { updateOrderStatus, confirmCashPayment } from "@/lib/orders.functions";
import { Pagination, usePagination } from "@/components/pagination";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { waTemplates } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/admin/commandes")({
  component: AdminOrdersPage,
});

const STATUSES = [
  "pending_payment", "paid", "processing", "shipped", "delivered", "completed", "cancelled", "payment_failed",
] as const;
const STATUS_LABEL: Record<string, string> = {
  pending_payment: "En attente", paid: "Payée", processing: "En préparation",
  shipped: "Expédiée", delivered: "Livrée", completed: "Terminée",
  cancelled: "Annulée", payment_failed: "Paiement échoué",
};

function AdminOrdersPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<any>(null);

  const { data } = useQuery({
    queryKey: ["admin-orders", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, order_number, status, payment_status, payment_method, total, customer_name, customer_phone, has_physical_items, shipping_address, delivery_mode, pickup_point_id, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: autoConfirmed } = useQuery({
    queryKey: ["admin-auto-confirmed-shipments"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("order_shipments")
        .select("id, shipment_number, subtotal, customer_confirmed_at, order_id, vendor_id, vendors:vendor_id(name), orders:order_id(order_number)")
        .eq("auto_confirmed", true)
        .gte("customer_confirmed_at", since)
        .order("customer_confirmed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: itemsData } = useQuery({
    queryKey: ["admin-order-items", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, product_name, quantity, unit_price, subtotal, product_type")
        .eq("order_id", selected.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pickup } = useQuery({
    queryKey: ["admin-order-pickup", selected?.pickup_point_id],
    enabled: !!selected?.pickup_point_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pickup_points")
        .select("name, address, city, contact_phone, opening_hours")
        .eq("id", selected.pickup_point_id)
        .maybeSingle();
      return data;
    },
  });

  const updateFn = useServerFn(updateOrderStatus);
  const [newStatus, setNewStatus] = useState<string>("");
  const [notes, setNotes] = useState("");
  const mut = useMutation({
    mutationFn: () => updateFn({ data: { orderId: selected.id, status: newStatus as any, notes: notes || null } }),
    onSuccess: () => {
      toast.success("Commande mise à jour.");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      setSelected(null); setNewStatus(""); setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmCashFn = useServerFn(confirmCashPayment);
  const cashMut = useMutation({
    mutationFn: (orderId: string) => confirmCashFn({ data: { orderId, notes: notes || null } }),
    onSuccess: (res: any) => {
      if (res?.ok === false) {
        toast.info(res.reason === "already_paid" ? "Déjà payée." : "Impossible de confirmer.");
      } else {
        toast.success("Paiement en espèces confirmé.");
      }
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data ?? [];
  const { page, setPage, paged, total, pageCount, rangeStart, rangeEnd } = usePagination(rows, 25);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-medium">Filtrer :</label>
        <select
          className="h-9 rounded-sm border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Tous les statuts</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      {autoConfirmed && autoConfirmed.length > 0 && (
        <details className="mb-4 rounded-sm border border-amber-500/40 bg-amber-500/5 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            Expéditions auto-validées (30j) — {autoConfirmed.length}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Livraisons validées automatiquement faute de réponse client — à surveiller si un vendeur en accumule anormalement.
            </span>
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr><th className="p-1">Expédition</th><th className="p-1">Commande</th><th className="p-1">Vendeur</th><th className="p-1">Montant</th><th className="p-1">Validée le</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {autoConfirmed.map((s: any) => (
                  <tr key={s.id}>
                    <td className="p-1 font-mono">{s.shipment_number}</td>
                    <td className="p-1 font-mono">{s.orders?.order_number ?? "—"}</td>
                    <td className="p-1">{s.vendors?.name ?? "—"}</td>
                    <td className="p-1 font-medium">{formatFcfa(Number(s.subtotal))}</td>
                    <td className="p-1">{new Date(s.customer_confirmed_at).toLocaleDateString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <div className="rounded-sm border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">N°</th><th className="p-2">Client</th><th className="p-2">Total</th>
              <th className="p-2">Statut</th><th className="p-2">Paiement</th><th className="p-2">Date</th><th className="p-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paged.map((o) => (
              <tr key={o.id} className="hover:bg-muted/50">
                <td className="p-2 font-mono">{o.order_number}</td>
                <td className="p-2">{o.customer_name}<div className="text-xs text-muted-foreground">{o.customer_phone}</div></td>
                <td className="p-2 font-bold text-accent">{formatFcfa(Number(o.total))}</td>
                <td className="p-2"><span className={cn("rounded-sm px-2 py-0.5 text-xs", o.status === "paid" || o.status === "delivered" ? "bg-success/10 text-success" : o.status === "payment_failed" || o.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-muted")}>{STATUS_LABEL[o.status]}</span></td>
                <td className="p-2 text-xs">
                  {o.payment_status}
                  {o.payment_method === "cash_on_pickup" && (
                    <span className="ml-1 inline-flex items-center gap-0.5 rounded-sm bg-accent/10 text-accent px-1 py-0.5 text-[10px] font-medium">
                      <Wallet className="h-2.5 w-2.5" /> espèces
                    </span>
                  )}
                </td>
                <td className="p-2 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("fr-FR")}</td>
                <td className="p-2"><Button size="sm" variant="outline" onClick={() => { setSelected(o); setNewStatus(o.status); setNotes(o.notes || ""); }}>Détails</Button></td>
              </tr>
            ))}
            {total === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucune commande.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} total={total} rangeStart={rangeStart} rangeEnd={rangeEnd} onPageChange={setPage} label="commandes" />

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Commande {selected?.order_number}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div><strong>Client :</strong> {selected.customer_name} — {selected.customer_phone}</div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-sm bg-muted px-2 py-0.5">Mode : {selected.delivery_mode === "pickup" ? "Retrait" : selected.delivery_mode === "home_delivery" ? "Livraison" : "—"}</span>
                {selected.payment_method === "cash_on_pickup" && (
                  <span className="inline-flex items-center gap-1 rounded-sm bg-accent/10 text-accent px-2 py-0.5">
                    <Wallet className="h-3 w-3" /> Paiement à la réception
                  </span>
                )}
              </div>
              {selected.delivery_mode === "home_delivery" && selected.shipping_address && (
                <div>
                  <strong>Livraison :</strong> {selected.shipping_address.quartier}, {selected.shipping_address.ville}
                  {selected.shipping_address.landmark && <> — {selected.shipping_address.landmark}</>}
                </div>
              )}
              <div>
                <strong>Articles :</strong>
                <ul className="mt-1 divide-y divide-border rounded-sm border border-border">
                  {itemsData?.map((it) => (
                    <li key={it.id} className="p-2 flex justify-between">
                      <span>{it.product_name} × {it.quantity}</span>
                      <span className="font-medium">{formatFcfa(Number(it.subtotal))}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <strong>Total</strong><span className="font-bold text-accent">{formatFcfa(Number(selected.total))}</span>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Nouveau statut</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="h-9 w-full rounded-sm border border-input bg-background px-3 text-sm">
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Notes internes</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
          )}
          {selected && (
            <div className="rounded-sm border border-border bg-muted/30 p-2 flex flex-wrap gap-2">
              <WhatsAppButton
                phone={selected.customer_phone}
                message={waTemplates.orderConfirmation({
                  customer_name: selected.customer_name,
                  order_number: selected.order_number,
                  total: selected.total,
                  pickup: pickup ?? null,
                  items: (itemsData ?? []).map((it: any) => ({ name: it.product_name, quantity: it.quantity })),
                })}
                label="Confirmation WhatsApp"
              />
              <WhatsAppButton
                phone={selected.customer_phone}
                message={waTemplates.readyForPickup({
                  customer_name: selected.customer_name,
                  order_number: selected.order_number,
                  pickup: pickup ?? null,
                })}
                label="Prévenir : commande prête"
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Annuler</Button>
            {selected?.payment_method === "cash_on_pickup" && selected?.payment_status !== "paid" && (
              <Button
                variant="outline"
                className="border-success text-success hover:bg-success/10"
                onClick={() => cashMut.mutate(selected.id)}
                disabled={cashMut.isPending}
              >
                <Wallet className="h-4 w-4 mr-1" /> Marquer payée (espèces)
              </Button>
            )}
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
