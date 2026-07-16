import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMyVendors } from "@/lib/vendor";
import { formatFcfa } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { requestWithdrawal } from "@/lib/marketplace.functions";

export const Route = createFileRoute("/_authenticated/vendeur/revenus")({
  component: VendorRevenues,
});

function VendorRevenues() {
  const { data: memberships } = useMyVendors();
  const vendorId = memberships?.[0]?.vendor_id;
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ["vendor-revenues", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const [{ data: items, error: e1 }, { data: bal, error: e2 }] = await Promise.all([
        supabase
          .from("order_items")
          .select("subtotal, commission_amount, orders!inner(payment_status,status,created_at)")
          .eq("vendor_id", vendorId!)
          .neq("orders.status", "cancelled"),
        supabase.rpc("vendor_available_balance", { _vendor_id: vendorId! }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      let gross = 0, commission = 0;
      for (const it of items ?? []) {
        gross += Number(it.subtotal ?? 0);
        commission += Number((it as { commission_amount: number | null }).commission_amount ?? 0);
      }
      return { gross, commission, net: gross - commission, available: Number(bal ?? 0) };
    },
  });

  const { data: withdrawals = [] } = useQuery({
    queryKey: ["vendor-withdrawals", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_withdrawal_requests")
        .select("id, amount_requested, status, payout_method, payout_details, created_at, processed_at, staff_notes")
        .eq("vendor_id", vendorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-foreground">Revenus</h2>
        <Button onClick={() => setDialogOpen(true)} disabled={!summary || summary.available <= 0}>
          Demander un retrait
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card label="Ventes brutes" value={summary ? formatFcfa(summary.gross) : "…"} />
        <Card label="Commission Winstorr" value={summary ? formatFcfa(summary.commission) : "…"} />
        <Card label="Net perçu" value={summary ? formatFcfa(summary.net) : "…"} />
        <Card label="Solde disponible" value={summary ? formatFcfa(summary.available) : "…"} highlight />
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Historique des retraits</h3>
        <div className="overflow-x-auto rounded-sm border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Montant</th>
                <th className="p-3">Méthode</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {withdrawals.map((w) => (
                <tr key={w.id}>
                  <td className="p-3 text-xs">{new Date(w.created_at).toLocaleDateString("fr-FR")}</td>
                  <td className="p-3 font-medium">{formatFcfa(Number(w.amount_requested))}</td>
                  <td className="p-3 text-xs">{w.payout_method}<div className="text-muted-foreground">{w.payout_details}</div></td>
                  <td className="p-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                      w.status === "paid" ? "bg-success/15 text-success" :
                      w.status === "approved" ? "bg-secondary/15 text-secondary" :
                      w.status === "rejected" ? "bg-destructive/15 text-destructive" :
                      "bg-accent/10 text-accent"}`}>{w.status}</span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{w.staff_notes ?? "—"}</td>
                </tr>
              ))}
              {withdrawals.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Aucun retrait pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {dialogOpen && vendorId && summary && (
        <WithdrawDialog
          vendorId={vendorId}
          available={summary.available}
          onClose={() => setDialogOpen(false)}
          onDone={() => {
            setDialogOpen(false);
            qc.invalidateQueries({ queryKey: ["vendor-withdrawals", vendorId] });
            qc.invalidateQueries({ queryKey: ["vendor-revenues", vendorId] });
          }}
        />
      )}
    </div>
  );
}

function Card({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-sm border p-4 ${highlight ? "border-accent bg-accent/5" : "border-border bg-card"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${highlight ? "text-accent" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function WithdrawDialog({ vendorId, available, onClose, onDone }: {
  vendorId: string; available: number; onClose: () => void; onDone: () => void;
}) {
  const [amount, setAmount] = useState<string>(String(available));
  const [method, setMethod] = useState("MTN MoMo");
  const [details, setDetails] = useState("");

  const fn = useServerFn(requestWithdrawal);
  const mut = useMutation({
    mutationFn: () => fn({ data: {
      vendor_id: vendorId,
      amount: Number(amount),
      payout_method: method,
      payout_details: details,
    }}),
    onSuccess: (res) => {
      if (res && res.ok === false) {
        toast.error(res.reason === "insufficient_balance"
          ? `Solde insuffisant. Disponible : ${formatFcfa(Number(res.available ?? 0))}`
          : "Impossible de créer la demande.");
        return;
      }
      toast.success("Demande envoyée");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Demander un retrait</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Solde disponible : <span className="font-semibold text-foreground">{formatFcfa(available)}</span></p>
          <div><Label>Montant (FCFA) *</Label><Input type="number" min={100} max={available} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div>
            <Label>Méthode *</Label>
            <select className="mt-1 h-10 w-full rounded-sm border border-border bg-background px-3 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>MTN MoMo</option>
              <option>Orange Money</option>
              <option>Virement bancaire</option>
            </select>
          </div>
          <div><Label>Détails de paiement *</Label><Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Numéro de téléphone, RIB…" /></div>
          <p className="text-xs text-muted-foreground">Les retraits sont traités manuellement par l'équipe Wintek sous 48-72h ouvrées.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={mut.isPending || !amount || !details} onClick={() => mut.mutate()}>
            {mut.isPending ? "Envoi…" : "Envoyer la demande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
