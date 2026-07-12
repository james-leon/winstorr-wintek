import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PriceTier = { min_quantity: number; unit_price: number };

/** Given tiers (any order) + a quantity, return the effective unit price.
 *  Returns null when quantity is below the lowest tier and no fallback is given. */
export function resolveUnitPrice(
  tiers: PriceTier[] | undefined | null,
  quantity: number,
  fallback: number | null,
): number | null {
  const list = (tiers ?? []).slice().sort((a, b) => a.min_quantity - b.min_quantity);
  let match: PriceTier | null = null;
  for (const t of list) {
    if (quantity >= t.min_quantity) match = t;
    else break;
  }
  if (match) return Number(match.unit_price);
  return fallback == null ? null : Number(fallback);
}

export function useProductTiers(productId: string | undefined) {
  return useQuery({
    enabled: !!productId,
    queryKey: ["product-tiers", productId],
    queryFn: async (): Promise<PriceTier[]> => {
      const { data, error } = await supabase
        .from("product_price_tiers")
        .select("min_quantity, unit_price")
        .eq("product_id", productId!)
        .order("min_quantity", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({ min_quantity: r.min_quantity, unit_price: Number(r.unit_price) }));
    },
  });
}

export function useCartTiers(productIds: string[]) {
  const key = productIds.slice().sort().join(",");
  return useQuery({
    enabled: productIds.length > 0,
    queryKey: ["cart-tiers", key],
    queryFn: async (): Promise<Record<string, PriceTier[]>> => {
      const { data, error } = await supabase
        .from("product_price_tiers")
        .select("product_id, min_quantity, unit_price")
        .in("product_id", productIds);
      if (error) throw error;
      const map: Record<string, PriceTier[]> = {};
      for (const r of data ?? []) {
        (map[r.product_id] ??= []).push({ min_quantity: r.min_quantity, unit_price: Number(r.unit_price) });
      }
      return map;
    },
  });
}
