import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Variant = {
  id: string;
  product_id: string;
  sku: string | null;
  attributes: Record<string, string>;
  price: number | null;
  compare_at_price: number | null;
  stock_quantity: number;
  image_url: string | null;
  min_order_quantity: number | null;
  is_default: boolean;
  status: "active" | "archived";
};

export function useProductVariants(productId: string | undefined, enabled = true) {
  return useQuery({
    enabled: !!productId && enabled,
    queryKey: ["product-variants", productId],
    queryFn: async (): Promise<Variant[]> => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, product_id, sku, attributes, price, compare_at_price, stock_quantity, image_url, min_order_quantity, is_default, status")
        .eq("product_id", productId!)
        .eq("status", "active")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        attributes: (r.attributes ?? {}) as Record<string, string>,
      })) as Variant[];
    },
  });
}

/** Distinct attribute keys and possible values, preserving insertion order. */
export function extractAttributeOptions(variants: Variant[]): { key: string; values: string[] }[] {
  const map = new Map<string, string[]>();
  for (const v of variants) {
    for (const [k, val] of Object.entries(v.attributes || {})) {
      if (!map.has(k)) map.set(k, []);
      const arr = map.get(k)!;
      const s = String(val);
      if (!arr.includes(s)) arr.push(s);
    }
  }
  return Array.from(map.entries()).map(([key, values]) => ({ key, values }));
}

/** Find the variant matching a full attribute selection (exact match). */
export function findVariantByAttrs(variants: Variant[], selected: Record<string, string>): Variant | null {
  return (
    variants.find((v) => {
      const attrs = v.attributes || {};
      const attrKeys = Object.keys(attrs);
      if (attrKeys.length !== Object.keys(selected).length) return false;
      for (const [k, val] of Object.entries(selected)) {
        if (attrs[k] !== val) return false;
      }
      return true;
    }) ?? null
  );
}

/** Is a given attribute value selectable given the current partial selection? */
export function isValueAvailable(
  variants: Variant[],
  key: string,
  value: string,
  selected: Record<string, string>,
): boolean {
  return variants.some((v) => {
    if ((v.attributes || {})[key] !== value) return false;
    for (const [k, val] of Object.entries(selected)) {
      if (k === key) continue;
      if ((v.attributes || {})[k] !== val) return false;
    }
    return true;
  });
}

/** Human label for a variant, e.g. "Contenance: 1L · Couleur: Noir". */
export function variantLabel(attrs: Record<string, string> | null | undefined): string {
  if (!attrs) return "";
  return Object.entries(attrs)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}
