import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORT_WHATSAPP_RAW } from "@/lib/site-contact";

/**
 * Centralized Winstorr support WhatsApp number.
 * Reads `app_settings.whatsapp_support_number` (editable in Admin → Paramètres généraux),
 * and falls back to the hardcoded constant while loading or if unset.
 */
export function useSupportWhatsApp(): string {
  const { data } = useQuery({
    queryKey: ["whatsapp-support-number"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "whatsapp_support_number")
        .maybeSingle();
      const v = data?.value as { number?: string } | string | null;
      if (!v) return null;
      return typeof v === "string" ? v : v.number ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
  return data || SUPPORT_WHATSAPP_RAW;
}
