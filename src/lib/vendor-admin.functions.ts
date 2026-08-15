import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ vendor_id: z.string().uuid() });

type ImpactPayload = {
  vendor: { id: string; name: string; slug: string; type: string };
  products: number;
  followers: number;
  withdrawals: number;
  commissionRules: number;
  members: number;
  invitations: number;
  orderItems: number;
  serviceRequests: number;
  trainingEnrollments: number;
  couponRedemptions: number;
  blocked: boolean;
  blockers: string[];
};

export const getVendorDeletionImpact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: impact, error } = await context.supabase.rpc("vendor_deletion_impact", {
      _vendor_id: data.vendor_id,
    });
    if (error) throw new Error(error.message);
    return impact as unknown as ImpactPayload;
  });

export const deleteVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Single atomic RPC: all dependency checks run first, then the whole
    // cascade happens in one transaction. A failure rolls everything back.
    const { data: result, error } = await context.supabase.rpc("delete_vendor_cascade", {
      _vendor_id: data.vendor_id,
    });
    if (error) throw new Error(error.message);
    return result as unknown as { ok: boolean; deleted: ImpactPayload };
  });
