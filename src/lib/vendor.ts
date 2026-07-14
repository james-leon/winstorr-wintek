import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type VendorMembership = {
  vendor_id: string;
  role: "owner" | "staff";
  vendor: { id: string; name: string; slug: string; status: string };
};

export function useMyVendors() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["my-vendors", user?.id],
    enabled: !!user && !loading,
    staleTime: 30_000,
    queryFn: async (): Promise<VendorMembership[]> => {
      const { data, error } = await supabase
        .from("vendor_members")
        .select("vendor_id, role, vendors:vendor_id (id, name, slug, status)")
        .eq("user_id", user!.id);
      if (error) {
        console.error("[useMyVendors] query error", error);
        throw error;
      }
      console.debug("[useMyVendors] memberships for", user!.id, data);
      return (data ?? []).map((r: any) => ({
        vendor_id: r.vendor_id,
        role: r.role,
        vendor: r.vendors,
      }));
    },
  });
}
