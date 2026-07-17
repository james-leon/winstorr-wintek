import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, PackageCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatFcfa } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createReturnRequest } from "@/lib/returns.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mon-compte/commandes/$orderNumber")({
  head: () => ({ meta: [{ title: "Détail de commande — Winstorr" }] }),
  component: OrderDetail,
});

const STATUS_LABEL: Record<string, string> = {
  requested: "Demandé",
  under_review: "En examen",
  approved: "Approuvé",
  rejected: "Rejeté",
  refunded: "Remboursé",
  exchanged: "Échangé",
};
const REASONS = [
  { value: "defective", label: "Article défectueux" },
  { value: "wrong_item", label: "Mauvais article reçu" },
  { value: "not_as_described", label: "Non conforme à la description" },
  { value: "changed_mind", label: "Changement d'avis" },
  { value: "other", label: "Autre" },
];
const TIMELINE = ["requested", "under_review", "approved", "refunded"] as const;

function OrderDetail() {
  const { orderNumber } = Route.useParams();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["order-detail", orderNumber],
    queryFn: async () => {
      const [{ data: order }, { data: items }, { data: returns }] = await Promise.all([
        supabase.rpc("get_order_by_number", { _order_number: orderNumber }),
        supabase.rpc("get_order_items_by_number", { _order_number: orderNumber }),
        supabase.rpc("get_order_returns", { _order_number: orderNumber }),
      ]);
      const orderRow = order?.[0] ?? null;
      let shipments: any[] = [];
      if (orderRow?.id) {
        const { data: sh } = await supabase
          .from("order_shipments")
          .select("id, shipment_number, status, delivered_at, confirmation_deadline, customer_confirmed_at, auto_confirmed, subtotal, vendor_id")
          .eq("order_id", orderRow.id)
          .order("created_at", { ascending: true });
        shipments = sh ?? [];
      }
      return { order: orderRow, items: items ?? [], returns: returns ?? [], shipments };
    },
  });

  const confirmMut = useMutation({
    mutationFn: async (shipmentId: string) => {
      const { data, error } = await supabase.rpc("customer_confirm_shipment", { _shipment_id: shipmentId });
      if (error) throw new Error(error.message);
      const res = data as { ok: boolean; reason?: string };
      if (!res?.ok) throw new Error(res?.reason ?? "unknown_error");
      return res;
    },
    onSuccess: () => {
      toast.success("Réception confirmée. Merci !");
      qc.invalidateQueries({ queryKey: ["order-detail", orderNumber] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [dlgOpen, setDlgOpen] = useState(false);
  const [itemId, setItemId] = useState<string>("");
  const [reason, setReason] = useState<string>("defective");
  const [desc, setDesc] = useState("");

  const createFn = useServerFn(createReturnRequest);
  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          orderNumber,
          orderItemId: itemId || null,
          reason: reason as any,
          description: desc,
        },
      }),
    onSuccess: () => {
      toast.success("Demande envoyée. Notre équipe va l'examiner.");
      setDlgOpen(false);
      setDesc("");
      qc.invalidateQueries({ queryKey: ["order-detail", orderNumber] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return <div className="mx-auto max-w-3xl px-4 py-8 text-center text-muted-foreground">Chargement…</div>;
  if (!data.order) return <div className="mx-auto max-w-3xl px-4 py-8 text-center">Commande introuvable.</div>;

  const { order, items, returns } = data;
  const eligible =
    (order.has_physical_items && order.status === "delivered") ||
    (!order.has_physical_items && order.payment_status === "paid");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <Link to="/mon-compte/commandes" className="text-sm text-secondary hover:underline">← Mes commandes</Link>
        <h1 className="mt-2 font-display text-2xl text-foreground">Commande <span className="font-mono text-base">{order.order_number}</span></h1>
        <div className="mt-1 text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString("fr-FR")}</div>
      </div>

      <section className="rounded-sm border border-border bg-card p-4">
        <h2 className="font-semibold mb-2">Articles</h2>
        <ul className="divide-y divide-border">
          {items.map((it: any) => (
            <li key={it.id} className="py-2 flex justify-between text-sm">
              <span>{it.product_name} × {it.quantity}</span>
              <span className="font-medium">{formatFcfa(Number(it.subtotal))}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-border pt-2">
          <strong>Total</strong><span className="font-bold text-accent">{formatFcfa(Number(order.total))}</span>
        </div>
      </section>

      <section className="rounded-sm border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Retours & problèmes</h2>
          {eligible ? (
            <Button size="sm" variant="outline" onClick={() => setDlgOpen(true)}>
              <AlertTriangle className="mr-1 h-4 w-4" /> Signaler un problème
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Disponible après livraison / paiement.</span>
          )}
        </div>

        {returns.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Aucune demande de retour pour cette commande.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {returns.map((r: any) => (
              <li key={r.id} className="rounded-sm border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{STATUS_LABEL[r.status]}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                {r.resolution_notes && (
                  <p className="mt-1 text-xs"><strong>Réponse :</strong> {r.resolution_notes}</p>
                )}
                <div className="mt-3 flex items-center gap-1">
                  {TIMELINE.map((s, idx) => {
                    const currentIdx = TIMELINE.indexOf(r.status as any);
                    const done = r.status === "rejected" ? idx === 0 : currentIdx >= idx;
                    return (
                      <div key={s} className="flex-1 flex items-center gap-1">
                        <div className={cn("h-1.5 flex-1 rounded-full", done ? (r.status === "rejected" ? "bg-destructive" : "bg-success") : "bg-muted")} />
                        {idx < TIMELINE.length - 1 && <span className="w-1" />}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  {TIMELINE.map((s) => (<span key={s}>{STATUS_LABEL[s]}</span>))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Signaler un problème</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            {items.length > 1 && (
              <div>
                <label className="block mb-1 font-medium">Article concerné</label>
                <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="h-9 w-full rounded-sm border border-input bg-background px-3 text-sm">
                  <option value="">Toute la commande</option>
                  {items.map((it: any) => (<option key={it.id} value={it.id}>{it.product_name}</option>))}
                </select>
              </div>
            )}
            <div>
              <label className="block mb-1 font-medium">Raison</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 w-full rounded-sm border border-input bg-background px-3 text-sm">
                {REASONS.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
              </select>
            </div>
            <div>
              <label className="block mb-1 font-medium">Description</label>
              <Textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Décrivez le problème (minimum 10 caractères)…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>Annuler</Button>
            <Button onClick={() => mut.mutate()} disabled={mut.isPending || desc.trim().length < 10}>Envoyer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
