import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { updateReturnRequest } from "@/lib/returns.functions";
import { formatFcfa } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/retours")({
  component: AdminReturnsPage,
});

const STATUSES = ["requested", "under_review", "approved", "rejected", "refunded", "exchanged"] as const;
const STATUS_LABEL: Record<string, string> = {
  requested: "Demandé",
  under_review: "En examen",
  approved: "Approuvé",
  rejected: "Rejeté",
  refunded: "Remboursé",
  exchanged: "Échangé",
};
const REASON_LABEL: Record<string, string> = {
  defective: "Défectueux",
  wrong_item: "Mauvais article",
  not_as_described: "Non conforme",
  changed_mind: "Changement d'avis",
  other: "Autre",
};
const TONE: Record<string, string> = {
  requested: "bg-muted text-muted-foreground",
  under_review: "bg-secondary/10 text-secondary",
  approved: "bg-success/10 text-success",
  refunded: "bg-success/10 text-success",
  exchanged: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

function AdminReturnsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [newStatus, setNewStatus] = useState<string>("under_review");
  const [notes, setNotes] = useState("");
  const [refund, setRefund] = useState<string>("");

  const { data } = useQuery({
    queryKey: ["admin-returns", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("return_requests")
        .select("id, order_id, order_item_id, reason, description, photo_urls, status, resolution_notes, refund_amount, created_at, orders(order_number, customer_name, customer_phone, total)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateFn = useServerFn(updateReturnRequest);
  const mut = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          returnId: selected.id,
          status: newStatus as any,
          resolutionNotes: notes || null,
          refundAmount: refund ? Number(refund) : null,
        },
      }),
    onSuccess: () => {
      toast.success("Retour mis à jour.");
      qc.invalidateQueries({ queryKey: ["admin-returns"] });
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDetail = (r: any) => {
    setSelected(r);
    setNewStatus(r.status === "requested" ? "under_review" : r.status);
    setNotes(r.resolution_notes || "");
    setRefund(r.refund_amount ? String(r.refund_amount) : "");
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-medium">Filtrer :</label>
        <select
          className="h-9 rounded-sm border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Tous</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <div className="rounded-sm border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">Commande</th>
              <th className="p-2">Client</th>
              <th className="p-2">Raison</th>
              <th className="p-2">Statut</th>
              <th className="p-2">Date</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data?.map((r: any) => (
              <tr key={r.id} className="hover:bg-muted/50">
                <td className="p-2 font-mono">{r.orders?.order_number}</td>
                <td className="p-2">{r.orders?.customer_name}<div className="text-xs text-muted-foreground">{r.orders?.customer_phone}</div></td>
                <td className="p-2">{REASON_LABEL[r.reason]}</td>
                <td className="p-2"><span className={cn("rounded-sm px-2 py-0.5 text-xs", TONE[r.status] || "bg-muted")}>{STATUS_LABEL[r.status]}</span></td>
                <td className="p-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                <td className="p-2"><Button size="sm" variant="outline" onClick={() => openDetail(r)}>Traiter</Button></td>
              </tr>
            ))}
            {(!data || data.length === 0) && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucune demande.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Retour — {selected?.orders?.order_number}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div><strong>Raison :</strong> {REASON_LABEL[selected.reason]}</div>
              <div className="whitespace-pre-wrap rounded-sm border border-border bg-muted/40 p-2">{selected.description}</div>
              {Array.isArray(selected.photo_urls) && selected.photo_urls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {selected.photo_urls.map((u: string) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-sm border border-border">
                      <img src={u} alt="Preuve" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              <div>
                <label className="text-sm font-medium block mb-1">Nouveau statut</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="h-9 w-full rounded-sm border border-input bg-background px-3 text-sm">
                  {STATUSES.filter((s) => s !== "requested").map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Montant remboursé (XAF, optionnel)</label>
                <Input type="number" value={refund} onChange={(e) => setRefund(e.target.value)} placeholder="0" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Le remboursement CinetPay se fait manuellement depuis leur dashboard, puis marquez le retour comme « {STATUS_LABEL.refunded} ». Total commande : {selected.orders?.total ? formatFcfa(Number(selected.orders.total)) : "—"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Notes de résolution</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Annuler</Button>
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
