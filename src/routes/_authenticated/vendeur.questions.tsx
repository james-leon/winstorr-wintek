import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMyVendors } from "@/lib/vendor";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/vendeur/questions")({
  component: VendorQuestions,
});

function VendorQuestions() {
  const { data: memberships } = useMyVendors();
  const vendorId = memberships?.[0]?.vendor_id;
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: questions = [] } = useQuery({
    queryKey: ["vendor-questions", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      // Fetch this vendor's products, then their questions
      const { data: prods, error: pe } = await supabase.from("products").select("id, name, slug").eq("vendor_id", vendorId!);
      if (pe) throw pe;
      const ids = (prods ?? []).map((p) => p.id);
      if (ids.length === 0) return [];
      const { data: qs, error } = await supabase
        .from("product_questions")
        .select("id, product_id, question, answer, status, created_at, answered_at, guest_name")
        .in("product_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const nameById = new Map((prods ?? []).map((p) => [p.id, { name: p.name, slug: p.slug }]));
      return (qs ?? []).map((q) => ({ ...q, product: nameById.get(q.product_id)! }));
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl text-foreground">Questions clients</h2>
      <div className="space-y-3">
        {questions.map((q) => (
          <QuestionCard key={q.id} q={q} userId={user?.id ?? null} onAnswered={() => qc.invalidateQueries({ queryKey: ["vendor-questions", vendorId] })} />
        ))}
        {questions.length === 0 && (
          <div className="rounded-sm border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Aucune question pour le moment.
          </div>
        )}
      </div>
    </div>
  );
}

type Q = {
  id: string; product_id: string; question: string; answer: string | null;
  status: string; created_at: string; answered_at: string | null; guest_name: string | null;
  product: { name: string; slug: string };
};

function QuestionCard({ q, userId, onAnswered }: { q: Q; userId: string | null; onAnswered: () => void }) {
  const [reply, setReply] = useState(q.answer ?? "");
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("product_questions")
        .update({ answer: reply, answered_by: userId, answered_at: new Date().toISOString(), status: "answered" })
        .eq("id", q.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Réponse enregistrée"); onAnswered(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Sur <span className="font-semibold text-foreground">{q.product.name}</span> · {new Date(q.created_at).toLocaleDateString("fr-FR")}</span>
        <span className={`rounded-full px-2 py-0.5 ${q.status === "answered" ? "bg-success/15 text-success" : "bg-accent/10 text-accent"}`}>{q.status}</span>
      </div>
      <p className="text-sm text-foreground">{q.question}</p>
      <div className="mt-3">
        <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Votre réponse…" />
        <div className="mt-2 flex justify-end">
          <Button size="sm" disabled={mut.isPending || !reply.trim()} onClick={() => mut.mutate()}>
            {q.answer ? "Mettre à jour" : "Répondre"}
          </Button>
        </div>
      </div>
    </div>
  );
}
