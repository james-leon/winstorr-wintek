import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/questions")({
  component: AdminQuestions,
});

function AdminQuestions() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("pending");

  const { data: rows = [] } = useQuery({
    queryKey: ["admin-questions", filter],
    queryFn: async () => {
      const q = supabase
        .from("product_questions")
        .select("id, question, answer, status, created_at, product_id, products:product_id(name, slug, vendor_id, vendors:vendor_id(name))")
        .order("created_at", { ascending: false })
        .limit(200);
      const { data, error } = filter === "all" ? await q : await q.eq("status", filter as "pending" | "answered" | "hidden");
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("product_questions").update({ status: status as "pending" | "answered" | "hidden" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mis à jour"); qc.invalidateQueries({ queryKey: ["admin-questions"] }); },
  });

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl text-foreground">Questions produits — modération</h2>
      <div className="flex gap-2">
        {["pending", "answered", "hidden", "all"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-sm border px-3 py-1 text-xs ${filter === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}>
            {s === "all" ? "Tous" : s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {rows.map((q) => {
          const p = (q as { products?: { name?: string; vendors?: { name?: string } } }).products;
          return (
            <div key={q.id} className="rounded-sm border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{p?.name} · {p?.vendors?.name ?? "—"} · {new Date(q.created_at).toLocaleDateString("fr-FR")}</span>
                <span className={`rounded-full px-2 py-0.5 ${
                  q.status === "answered" ? "bg-success/15 text-success" :
                  q.status === "hidden" ? "bg-muted text-muted-foreground" :
                  "bg-accent/10 text-accent"}`}>{q.status}</span>
              </div>
              <p className="text-sm text-foreground">{q.question}</p>
              {q.answer && <p className="mt-2 border-l-2 border-secondary pl-3 text-sm text-muted-foreground">{q.answer}</p>}
              <div className="mt-2 flex justify-end gap-2">
                {q.status !== "hidden" && <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: q.id, status: "hidden" })}>Masquer</Button>}
                {q.status === "hidden" && <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: q.id, status: q.answer ? "answered" : "pending" })}>Restaurer</Button>}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="rounded-sm border border-border bg-card p-6 text-center text-sm text-muted-foreground">Aucune question.</div>}
      </div>
    </div>
  );
}
