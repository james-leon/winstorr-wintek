import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/demandes")({
  component: AdminRequests,
});

type Request = {
  id: string; created_at: string; customer_name: string; customer_phone: string; customer_email: string | null;
  description: string; preferred_date: string | null; status: string;
  products: { name: string } | null;
};
type Enrollment = {
  id: string; created_at: string; name: string; phone: string; email: string | null; status: string;
  training_sessions: { start_date: string; products: { name: string } | null } | null;
};

function AdminRequests() {
  const qc = useQueryClient();

  const { data: requests = [] } = useQuery({
    queryKey: ["admin-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("id, created_at, customer_name, customer_phone, customer_email, description, preferred_date, status, products(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Request[];
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["admin-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_enrollments")
        .select("id, created_at, name, phone, email, status, training_sessions(start_date, products(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Enrollment[];
    },
  });

  const updateReq = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("service_requests").update({ status: status as "received" | "quoted" | "accepted" | "completed" | "cancelled" | "diagnosing" | "in_progress" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mis à jour"); qc.invalidateQueries({ queryKey: ["admin-requests"] }); },
  });

  const updateEnr = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("training_enrollments").update({ status: status as "pending" | "confirmed" | "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mis à jour"); qc.invalidateQueries({ queryKey: ["admin-enrollments"] }); },
  });

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 font-display text-xl">Demandes de service ({requests.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Date</th><th className="p-3">Client</th><th className="p-3">Service</th>
                <th className="p-3">Description</th><th className="p-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                  <td className="p-3"><div className="font-medium">{r.customer_name}</div><div className="text-xs text-muted-foreground">{r.customer_phone}{r.customer_email && ` · ${r.customer_email}`}</div></td>
                  <td className="p-3">{r.products?.name}</td>
                  <td className="p-3 max-w-sm"><div className="line-clamp-3">{r.description}</div>{r.preferred_date && <div className="mt-1 text-xs text-muted-foreground">Souhaité : {new Date(r.preferred_date).toLocaleDateString("fr-FR")}</div>}</td>
                  <td className="p-3">
                    <Select value={r.status} onValueChange={(v) => updateReq.mutate({ id: r.id, status: v })}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="received">Reçu</SelectItem>
                        <SelectItem value="diagnosing">Diagnostic</SelectItem>
                        <SelectItem value="quoted">Devisé</SelectItem>
                        <SelectItem value="accepted">Accepté</SelectItem>
                        <SelectItem value="in_progress">En cours</SelectItem>
                        <SelectItem value="completed">Terminé</SelectItem>
                        <SelectItem value="cancelled">Annulé</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Aucune demande</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl">Inscriptions formations ({enrollments.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Date</th><th className="p-3">Participant</th><th className="p-3">Formation</th>
                <th className="p-3">Session</th><th className="p-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="p-3 whitespace-nowrap">{new Date(e.created_at).toLocaleDateString("fr-FR")}</td>
                  <td className="p-3"><div className="font-medium">{e.name}</div><div className="text-xs text-muted-foreground">{e.phone}{e.email && ` · ${e.email}`}</div></td>
                  <td className="p-3">{e.training_sessions?.products?.name}</td>
                  <td className="p-3">{e.training_sessions?.start_date && new Date(e.training_sessions.start_date).toLocaleDateString("fr-FR")}</td>
                  <td className="p-3">
                    <Select value={e.status} onValueChange={(v) => updateEnr.mutate({ id: e.id, status: v })}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">En attente</SelectItem>
                        <SelectItem value="confirmed">Confirmé</SelectItem>
                        <SelectItem value="cancelled">Annulé</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
              {enrollments.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Aucune inscription</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
