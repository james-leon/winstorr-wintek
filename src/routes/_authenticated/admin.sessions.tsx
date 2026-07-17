import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatFcfa } from "@/lib/format";
import { Pagination, usePagination } from "@/components/pagination";

export const Route = createFileRoute("/_authenticated/admin/sessions")({
  component: AdminSessions,
});

type Row = {
  id: string; product_id: string; start_date: string; end_date: string; location: string | null;
  capacity: number; seats_taken: number; price_override: number | null; status: string;
  products: { name: string } | null;
};

function AdminSessions() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, product_id, start_date, end_date, location, capacity, seats_taken, price_override, status, products(name)")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  const { data: trainings = [] } = useQuery({
    queryKey: ["training-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name").eq("type", "training").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const [open, setOpen] = useState(false);
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Session supprimée"); qc.invalidateQueries({ queryKey: ["admin-sessions"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { page, setPage, paged, total, pageCount, rangeStart, rangeEnd } = usePagination(rows, 25);

  return (
    <div>
      <div className="mb-4 flex justify-between">
        <div className="text-sm text-muted-foreground">{rows.length} session(s)</div>
        <Button onClick={() => setOpen(true)} disabled={trainings.length === 0}><Plus className="mr-1 h-4 w-4" /> Nouvelle session</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Formation</th><th className="p-3">Date</th><th className="p-3">Lieu</th>
              <th className="p-3">Places</th><th className="p-3">Prix</th><th className="p-3">Statut</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 font-medium">{r.products?.name}</td>
                <td className="p-3">{new Date(r.start_date).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="p-3">{r.location ?? "—"}</td>
                <td className="p-3">{r.seats_taken} / {r.capacity}</td>
                <td className="p-3">{r.price_override ? formatFcfa(r.price_override) : "—"}</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => confirm("Supprimer ?") && del.mutate(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} total={total} rangeStart={rangeStart} rangeEnd={rangeEnd} onPageChange={setPage} label="sessions" />
      {open && <SessionDialog trainings={trainings} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["admin-sessions"] }); }} />}
    </div>
  );
}

function SessionDialog({ trainings, onClose, onSaved }: { trainings: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ product_id: trainings[0]?.id ?? "", start_date: "", end_date: "", location: "", capacity: "10", price_override: "" });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("training_sessions").insert({
        product_id: f.product_id,
        start_date: new Date(f.start_date).toISOString(),
        end_date: new Date(f.end_date).toISOString(),
        location: f.location.trim() || null,
        capacity: Number(f.capacity),
        price_override: f.price_override ? Number(f.price_override) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Session créée"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvelle session</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <div>
            <Label>Formation *</Label>
            <Select value={f.product_id} onValueChange={(v) => setF({ ...f, product_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{trainings.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Début *</Label><Input required type="datetime-local" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
            <div><Label>Fin *</Label><Input required type="datetime-local" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
          </div>
          <div><Label>Lieu</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Capacité *</Label><Input required type="number" min="1" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></div>
            <div><Label>Prix personnalisé (FCFA)</Label><Input type="number" min="0" value={f.price_override} onChange={(e) => setF({ ...f, price_override: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "..." : "Créer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
