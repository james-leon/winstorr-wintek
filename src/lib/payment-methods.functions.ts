import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ProductTypeKey = "physical" | "digital" | "service" | "training";

export type CheckoutMethod = {
  provider_key: string;
  display_name: string;
  display_name_en: string | null;
  environment: "test" | "production";
  display_order: number;
};

const productTypes = z.array(z.enum(["physical", "digital", "service", "training"])).max(8);

function serverPublicClient() {
  return createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Server-side source of truth for which payment methods a cart may use.
 * The client never decides this — `createOrder` re-checks the same rules.
 */
export const getCheckoutPaymentMethods = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ productTypes }).parse(data))
  .handler(async ({ data }) => {
    const supabase = serverPublicClient();
    const { data: rows } = await supabase
      .from("payment_methods")
      .select("provider_key, display_name, display_name_en, environment, display_order, applies_to_product_types, is_enabled")
      .eq("is_enabled", true)
      .order("display_order");

    const { campayConfigured } = await import("./campay.server");
    const cartTypes = data.productTypes.length ? data.productTypes : (["physical"] as ProductTypeKey[]);

    const methods: CheckoutMethod[] = (rows ?? [])
      .filter((r) => {
        const applies = (r.applies_to_product_types as string[] | null) ?? [];
        // A method must cover EVERY product type present in the cart.
        if (!cartTypes.every((t) => applies.includes(t))) return false;
        if (r.provider_key === "campay" && !campayConfigured()) return false;
        return true;
      })
      .map((r) => ({
        provider_key: r.provider_key,
        display_name: r.display_name,
        display_name_en: r.display_name_en,
        environment: (r.environment ?? "test") as "test" | "production",
        display_order: r.display_order,
      }));

    return { methods };
  });

/** Non-secret provider status for the admin panel: keys configured yes/no. */
export const getPaymentProviderStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { campayConfigured } = await import("./campay.server");
  return {
    campay: {
      configured: campayConfigured(),
      appIdConfigured: Boolean(process.env["CAMPAY_APP_ID"]),
      webhookKeyConfigured: Boolean(process.env["CAMPAY_WEBHOOK_KEY"]),
    },
  };
});

/**
 * Server-side guard used by order creation. Throws when the requested provider
 * is disabled or does not apply to the cart's product types.
 */
export async function assertPaymentMethodAllowed(
  providerKey: string,
  cartTypes: ProductTypeKey[],
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("payment_methods")
    .select("is_enabled, applies_to_product_types, display_name")
    .eq("provider_key", providerKey)
    .maybeSingle();

  if (!row || !row.is_enabled) {
    throw new Error("Ce moyen de paiement n'est pas disponible actuellement.");
  }
  const applies = (row.applies_to_product_types as string[] | null) ?? [];
  const bad = cartTypes.find((t) => !applies.includes(t));
  if (bad) {
    throw new Error(`« ${row.display_name} » n'est pas disponible pour ce type de produit.`);
  }
}
