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

/** Cart lookup key for a (product, variant) pair. Variant `null` means product-level tiers. */
export const tierKey = (productId: string, variantId: string | null | undefined) =>
  `${productId}::${variantId ?? ""}`;

/** Tiers for a single (product, variant?) pair. When variantId is null the query returns
 *  ONLY product-level tiers (variant_id IS NULL); when set, ONLY variant-scoped tiers. */
export function useProductTiers(productId: string | undefined, variantId: string | null = null) {
  return useQuery({
    enabled: !!productId,
    queryKey: ["product-tiers", productId, variantId ?? null],
    queryFn: async (): Promise<PriceTier[]> => {
      let q = supabase
        .from("product_price_tiers")
        .select("min_quantity, unit_price")
        .eq("product_id", productId!);
      if (variantId) q = q.eq("variant_id", variantId);
      else q = q.is("variant_id", null);
      const { data, error } = await q.order("min_quantity", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({ min_quantity: r.min_quantity, unit_price: Number(r.unit_price) }));
    },
  });
}

/** Batched tier fetch for the cart. Returns a map keyed by tierKey(productId, variantId). */
export function useCartTiers(items: { productId: string; variantId: string | null }[]) {
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const cacheKey = items
    .map((i) => `${i.productId}:${i.variantId ?? ""}`)
    .sort()
    .join(",");
  return useQuery({
    enabled: productIds.length > 0,
    queryKey: ["cart-tiers", cacheKey],
    queryFn: async (): Promise<Record<string, PriceTier[]>> => {
      const { data, error } = await supabase
        .from("product_price_tiers")
        .select("product_id, variant_id, min_quantity, unit_price")
        .in("product_id", productIds);
      if (error) throw error;
      const map: Record<string, PriceTier[]> = {};
      for (const r of data ?? []) {
        const k = tierKey(r.product_id, (r as { variant_id: string | null }).variant_id);
        (map[k] ??= []).push({ min_quantity: r.min_quantity, unit_price: Number(r.unit_price) });
      }
      return map;
    },
  });
}
