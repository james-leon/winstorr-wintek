import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

/** Whether the current user follows this vendor. Null-safe when signed out. */
export function useIsFollowing(vendorId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["store-follow", vendorId, user?.id ?? "anon"],
    enabled: !!vendorId && !!user,
    queryFn: async () => {
      if (!vendorId || !user) return false;
      const { data, error } = await supabase
        .from("store_follows")
        .select("id")
        .eq("vendor_id", vendorId)
        .eq("customer_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    staleTime: 30_000,
  });
}

/** Public follower count for a vendor. */
export function useFollowerCount(vendorId: string | null | undefined) {
  return useQuery({
    queryKey: ["store-follow-count", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      if (!vendorId) return 0;
      const { count, error } = await supabase
        .from("store_follows")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", vendorId);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });
}

export function useToggleFollow() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ vendorId, following }: { vendorId: string; following: boolean }) => {
      if (!user) throw new Error("Vous devez être connecté pour suivre une boutique.");
      if (following) {
        const { error } = await supabase
          .from("store_follows")
          .delete()
          .eq("vendor_id", vendorId)
          .eq("customer_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("store_follows")
          .insert({ vendor_id: vendorId, customer_id: user.id });
        if (error) throw error;
      }
      return !following;
    },
    onSuccess: (nowFollowing, { vendorId }) => {
      qc.invalidateQueries({ queryKey: ["store-follow", vendorId] });
      qc.invalidateQueries({ queryKey: ["store-follow-count", vendorId] });
      toast.success(nowFollowing ? "Boutique suivie" : "Vous ne suivez plus cette boutique");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
