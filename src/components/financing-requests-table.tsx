import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatFcfa } from "@/lib/format";
import { buildWaLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import {
  FINANCING_STATUS_LABEL,
  FINANCING_STATUS_TINT,
  type FinancingRequestStatus,
} from "@/lib/financing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type FinancingRequestRow = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_message: string | null;
  product_name: string;
  product_price: number;
  status: FinancingRequestStatus;
  partner_notes: string | null;
  financing_partner_id: string;
  vendor_id: string | null;
  financing_partners?: { name: string } | null;
  vendors?: { name: string } | null;
};

const STATUSES: FinancingRequestStatus[] = ["new", "contacted", "approved", "rejected", "completed"];

export function useFinancingRequests(partnerId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["financing-requests", partnerId ?? "all"],
    enabled,
    queryFn: async (): Promise<FinancingRequestRow[]> => {
      let q = supabase
        .from("financing_requests")
        .select(
          "id, created_at, customer_name, customer_phone, customer_email, customer_message, product_name, product_price, status, partner_notes, financing_partner_id, vendor_id, financing_partners:financing_partner_id(name), vendors:vendor_id(name)",
        )
        .order("created_at", { ascending: false });
      if (partnerId) q = q.eq("financing_partner_id", partnerId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FinancingRequestRow[];
    },
  });
}

export function FinancingRequestsTable({
  rows,
  showPartner = false,
  invalidateKey,
}: {
  rows: FinancingRequestRow[];
  showPartner?: boolean;
  invalidateKey: (string | null)[];
}) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | FinancingRequestStatus>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const update = useMutation({
    mutationFn: async (patch: { id: string; status?: FinancingRequestStatus; partner_notes?: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("financing_requests").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande mise à jour");
      qc.invalidateQueries({ queryKey: ["financing-requests", ...invalidateKey] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(["all", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-sm border px-2.5 py-1 text-xs font-medium transition",
              filter === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {s === "all" ? `Toutes (${rows.length})` : `${FINANCING_STATUS_LABEL[s]} (${rows.filter((r) => r.status === s).length})`}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-sm border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucune demande de financement.
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => {
            const wa = buildWaLink(
              r.customer_phone,
              `Bonjour ${r.customer_name}, nous vous contactons au sujet de votre demande de paiement échelonné pour "${r.product_name}".`,
            );
            const open = openId === r.id;
            return (
              <div key={r.id} className="rounded-sm border border-border bg-card p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {r.customer_name} · <span className="font-normal text-muted-foreground">{r.customer_phone}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.product_name} — <span className="font-medium text-foreground">{formatFcfa(Number(r.product_price))}</span>
                      {r.vendors?.name ? ` · Vendeur : ${r.vendors.name}` : ""}
                      {showPartner && r.financing_partners?.name ? ` · Partenaire : ${r.financing_partners.name}` : ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("fr-FR")}
                      {r.customer_email ? ` · ${r.customer_email}` : ""}
                    </div>
                    {r.customer_message && (
                      <div className="mt-1 rounded-sm bg-muted/50 p-2 text-xs text-foreground">{r.customer_message}</div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-sm px-2 py-0.5 text-[11px] font-medium", FINANCING_STATUS_TINT[r.status])}>
                      {FINANCING_STATUS_LABEL[r.status]}
                    </span>
                    <Select value={r.status} onValueChange={(v) => update.mutate({ id: r.id, status: v as FinancingRequestStatus })}>
                      <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{FINANCING_STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="no-link-color">
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </Button>
                      </a>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => { setOpenId(open ? null : r.id); setNotes(r.partner_notes ?? ""); }}
                    >
                      {open ? "Fermer" : "Notes"}
                    </Button>
                  </div>
                </div>
                {open && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Notes de suivi…" />
                    <div className="flex justify-end">
                      <Button size="sm" disabled={update.isPending} onClick={() => update.mutate({ id: r.id, partner_notes: notes })}>
                        Enregistrer les notes
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
