import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProductCardData } from "@/components/product-card";

const KEY = "winstorr:recently-viewed";
const MAX = 12;

function safeRead(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function safeWrite(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  } catch {
    // ignore
  }
}

export function pushRecentlyViewed(productId: string) {
  const current = safeRead();
  const next = [productId, ...current.filter((id) => id !== productId)].slice(0, MAX);
  safeWrite(next);
}

export function useRecentlyViewedIds(exclude?: string): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const all = safeRead();
    setIds(exclude ? all.filter((id) => id !== exclude) : all);
  }, [exclude]);
  return ids;
}

export function useRecentlyViewedProducts(exclude?: string) {
  const ids = useRecentlyViewedIds(exclude);
  return useQuery({
    queryKey: ["recently-viewed", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<ProductCardData[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, short_description, images, type, price, price_type, stock_quantity, compare_at_price, rating_average, rating_count, quality_verified")
        .in("id", ids)
        .eq("status", "active");
      if (error) throw error;
      const byId = new Map((data ?? []).map((p) => [p.id, p]));
      // preserve LRU order
      return ids
        .map((id) => byId.get(id))
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map((p) => ({ ...p, images: Array.isArray(p.images) ? (p.images as string[]) : [] })) as ProductCardData[];
    },
  });
}
