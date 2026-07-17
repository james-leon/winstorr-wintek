import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, EyeOff, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/star-rating";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, usePagination } from "@/components/pagination";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/avis")({
  component: AdminReviews,
});

type ReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status: "pending" | "published" | "hidden";
  created_at: string;
  verified_purchase: boolean;
  product: { name: string; slug: string } | null;
  customer: { full_name: string | null } | null;
};

const STATUS_LABELS: Record<ReviewRow["status"], string> = {
  pending: "En attente",
  published: "Publié",
  hidden: "Masqué",
};
const STATUS_STYLES: Record<ReviewRow["status"], string> = {
  pending: "bg-accent/15 text-accent",
  published: "bg-success/15 text-success",
  hidden: "bg-muted text-muted-foreground",
};

function AdminReviews() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | ReviewRow["status"]>("pending");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-reviews", filter],
    queryFn: async () => {
      let q = supabase
        .from("product_reviews")
        .select("id, rating, title, comment, status, created_at, verified_purchase, product:products(name, slug), customer:profiles(full_name)")
        .order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data as ReviewRow[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ReviewRow["status"] }) => {
      const { error } = await supabase.from("product_reviews").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mis à jour"); qc.invalidateQueries({ queryKey: ["admin-reviews"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["admin-reviews"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { page, setPage, paged, total, pageCount, rangeStart, rangeEnd } = usePagination(rows, 25);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">{rows.length} avis</div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="published">Publiés</SelectItem>
            <SelectItem value="hidden">Masqués</SelectItem>
            <SelectItem value="all">Tous</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Chargement...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-10 text-center text-muted-foreground">
          Aucun avis à afficher.
        </div>
      ) : (
        <ul className="space-y-3">
          {paged.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRating rating={r.rating} showCount={false} />
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                    {r.verified_purchase && <span className="text-xs text-success">Achat vérifié</span>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {r.product?.name ?? "Produit inconnu"} • {r.customer?.full_name ?? "Anonyme"} • {new Date(r.created_at).toLocaleDateString("fr-FR")}
                  </div>
                  {r.title && <div className="mt-2 font-medium text-foreground">{r.title}</div>}
                  {r.comment && <div className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{r.comment}</div>}
                </div>
                <div className="flex gap-1">
                  {r.status !== "published" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r.id, status: "published" })}>
                      <Check className="h-4 w-4" /> Publier
                    </Button>
                  )}
                  {r.status !== "hidden" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r.id, status: "hidden" })}>
                      <EyeOff className="h-4 w-4" /> Masquer
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => confirm("Supprimer cet avis ?") && del.mutate(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} pageCount={pageCount} total={total} rangeStart={rangeStart} rangeEnd={rangeEnd} onPageChange={setPage} label="avis" />
    </div>
  );
}
