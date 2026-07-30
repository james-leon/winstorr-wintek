import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type FinancingPartner = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string;
  contact_phone: string;
  contact_email: string | null;
  min_product_price: number;
  default_terms_description: string | null;
  is_active: boolean;
};

export type FinancingRequestStatus = "new" | "contacted" | "approved" | "rejected" | "completed";

export const FINANCING_STATUS_LABEL: Record<FinancingRequestStatus, string> = {
  new: "Nouvelle",
  contacted: "Contactée",
  approved: "Approuvée",
  rejected: "Refusée",
  completed: "Aboutie",
};

export const FINANCING_STATUS_TINT: Record<FinancingRequestStatus, string> = {
  new: "bg-accent/15 text-accent",
  contacted: "bg-primary/10 text-primary",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
  completed: "bg-success/15 text-success",
};

/** Example number of months used for the indicative monthly estimate on product pages. */
export const FINANCING_EXAMPLE_MONTHS = 6;

export function estimateMonthly(price: number, months = FINANCING_EXAMPLE_MONTHS): number {
  return Math.ceil(price / months / 500) * 500;
}

/** The first active financing partner (single-partner setup for now). */
export function useActiveFinancingPartner() {
  return useQuery({
    queryKey: ["financing-partner-active"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<FinancingPartner | null> => {
      const { data, error } = await supabase
        .from("financing_partners")
        .select("id, name, slug, logo_url, description, contact_phone, contact_email, min_product_price, default_terms_description, is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as FinancingPartner) ?? null;
    },
  });
}

export type PartnerMembership = {
  financing_partner_id: string;
  role: "owner" | "staff";
  partner: { id: string; name: string; slug: string };
};

export function useMyFinancingPartners() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ["my-financing-partners", user?.id],
    enabled: !!user && !loading,
    staleTime: 30_000,
    queryFn: async (): Promise<PartnerMembership[]> => {
      const { data, error } = await supabase
        .from("financing_partner_members")
        .select("financing_partner_id, role, financing_partners:financing_partner_id (id, name, slug)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        financing_partner_id: r.financing_partner_id,
        role: r.role,
        partner: r.financing_partners,
      }));
    },
  });
}
