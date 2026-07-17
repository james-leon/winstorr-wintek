import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatFcfa } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pagination, usePagination } from "@/components/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/retraits")({
  component: AdminWithdrawals,
});

type W = {
  id: string; vendor_id: string; amount_requested: number;
  available_balance_at_request: number; status: string;
  payout_method: string; payout_details: string; staff_notes: string | null;
  created_at: string; processed_at: string | null;
  vendors: { name: string; slug: string } | null;
};

function AdminWithdrawals() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("pending");
  const [active, setActive] = useState<W | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["admin-withdrawals", filter],
    queryFn: async () => {
      const q = supabase
        .from("vendor_withdrawal_requests")
        .select("id, vendor_id, amount_requested, available_balance_at_request, status, payout_method, payout_details, staff_notes, created_at, processed_at, vendors:vendor_id(name, slug)")
        .order("created_at", { ascending: false })
        .limit(200);
      const { data, error } = filter === "all" ? await q : await q.eq("status", filter as "pending" | "approved" | "paid" | "rejected");
      if (error) throw error;
      return (data ?? []) as unknown as W[];
    },
  });

  const { page, setPage, paged, total, pageCount, rangeStart, rangeEnd } = usePagination(rows, 25);

  const setStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { error } = await supabase
        .from("vendor_withdrawal_requests")
        .update({
          status: status as "pending" | "approved" | "paid" | "rejected",
          staff_notes: notes ?? null,
          processed_at: status === "pending" ? null : new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Retrait mis à jour"); qc.invalidateQueries({ queryKey: ["admin-withdrawals"] }); setActive(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl text-foreground">Retraits vendeurs</h2>
      <div className="flex gap-2">
        {["pending", "approved", "paid", "rejected", "all"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-sm border px-3 py-1 text-xs ${filter === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}>
            {s === "all" ? "Tous" : s}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Vendeur</th>
              <th className="p-3">Montant</th>
              <th className="p-3">Solde au moment</th>
              <th className="p-3">Méthode</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Date</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-3 font-medium">{r.vendors?.name ?? r.vendor_id.slice(0, 8)}</td>
                <td className="p-3 font-semibold">{formatFcfa(Number(r.amount_requested))}</td>
                <td className="p-3 text-xs text-muted-foreground">{formatFcfa(Number(r.available_balance_at_request))}</td>
                <td className="p-3 text-xs">{r.payout_method}<div className="text-muted-foreground">{r.payout_details}</div></td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    r.status === "paid" ? "bg-success/15 text-success" :
                    r.status === "approved" ? "bg-secondary/15 text-secondary" :
                    r.status === "rejected" ? "bg-destructive/15 text-destructive" :
                    "bg-accent/10 text-accent"}`}>{r.status}</span>
                </td>
                <td className="p-3 text-xs">{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => setActive(r)}>Traiter</Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucun retrait.</td></tr>}
          </tbody>
        </table>
      </div>

      {active && <ProcessDialog w={active} onClose={() => setActive(null)} onDone={(status, notes) => setStatus.mutate({ id: active.id, status, notes })} />}
    </div>
  );
}

function ProcessDialog({ w, onClose, onDone }: { w: W; onClose: () => void; onDone: (status: string, notes: string) => void }) {
  const [notes, setNotes] = useState(w.staff_notes ?? "");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Traiter la demande de retrait</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div><span className="text-muted-foreground">Vendeur :</span> <b>{w.vendors?.name}</b></div>
          <div><span className="text-muted-foreground">Montant :</span> <b>{formatFcfa(Number(w.amount_requested))}</b></div>
          <div><span className="text-muted-foreground">Méthode :</span> {w.payout_method} — <span className="font-mono">{w.payout_details}</span></div>
          <Textarea rows={3} placeholder="Notes internes…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          <Button variant="destructive" onClick={() => onDone("rejected", notes)}>Rejeter</Button>
          <Button variant="secondary" onClick={() => onDone("approved", notes)}>Approuver</Button>
          <Button onClick={() => onDone("paid", notes)}>Marquer payé</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
