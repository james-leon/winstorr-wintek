import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export function useWishlistIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["wishlist-ids", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("product_id")
        .eq("customer_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.product_id as string));
    },
    staleTime: 60_000,
  });
}

export function useToggleWishlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  return useMutation({
    mutationFn: async ({ productId, wished }: { productId: string; wished: boolean }) => {
      if (!user) {
        void nav({ to: "/auth" });
        throw new Error("Connectez-vous pour utiliser la liste de souhaits.");
      }
      if (wished) {
        const { error } = await supabase
          .from("wishlist_items")
          .delete()
          .eq("customer_id", user.id)
          .eq("product_id", productId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wishlist_items")
          .insert({ customer_id: user.id, product_id: productId });
        if (error && error.code !== "23505") throw error;
      }
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["wishlist-ids"] });
      qc.invalidateQueries({ queryKey: ["wishlist-items"] });
      toast.success(vars.wished ? "Retiré de la liste de souhaits" : "Ajouté à la liste de souhaits");
    },
    onError: (e: Error) => {
      if (e.message.startsWith("Connectez")) toast.info(e.message);
      else toast.error(e.message);
    },
  });
}
