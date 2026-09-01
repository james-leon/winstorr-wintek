import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DeliveryZone = {
  id: string;
  name: string;
  city: string;
  fee: number;
  quartiers: string[];
  sort_order: number;
  is_active: boolean;
};

export type HomeDeliverySettings = {
  enabled: boolean;
  courier_name: string;
  delay_text: string;
  free_shipping_threshold: number | null;
  note: string;
};

export const DEFAULT_HOME_DELIVERY: HomeDeliverySettings = {
  enabled: false,
  courier_name: "Intello Express",
  delay_text: "sous 24-48h",
  free_shipping_threshold: null,
  note: "Tarifs valables si le lieu est en bordure d'une route principale/secondaire.",
};

export const HOME_DELIVERY_SETTINGS_KEY = "home_delivery";

export function useHomeDeliverySettings() {
  return useQuery({
    queryKey: ["settings", HOME_DELIVERY_SETTINGS_KEY],
    queryFn: async (): Promise<HomeDeliverySettings> => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", HOME_DELIVERY_SETTINGS_KEY)
        .maybeSingle();
      const v = (data?.value ?? {}) as Partial<HomeDeliverySettings>;
      return { ...DEFAULT_HOME_DELIVERY, ...v };
    },
  });
}

export function useDeliveryZones(includeInactive = false) {
  return useQuery({
    queryKey: ["delivery-zones", includeInactive],
    queryFn: async (): Promise<DeliveryZone[]> => {
      let q = supabase
        .from("delivery_zones")
        .select("id, name, city, fee, quartiers, sort_order, is_active")
        .order("sort_order")
        .order("name");
      if (!includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((z) => ({
        ...z,
        fee: Number(z.fee),
        quartiers: (z.quartiers ?? []) as string[],
      })) as DeliveryZone[];
    },
  });
}

/** Delivery fee for a zone, honouring the free-shipping threshold on the product subtotal. */
export function resolveDeliveryFee(
  zone: Pick<DeliveryZone, "fee"> | null | undefined,
  productSubtotal: number,
  settings: Pick<HomeDeliverySettings, "free_shipping_threshold"> | null | undefined,
): number {
  if (!zone) return 0;
  const threshold = settings?.free_shipping_threshold;
  if (threshold != null && threshold > 0 && productSubtotal >= threshold) return 0;
  return Number(zone.fee) || 0;
}
