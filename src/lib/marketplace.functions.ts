import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      vendor_id: z.string().uuid(),
      amount: z.number().positive().max(100_000_000),
      payout_method: z.string().trim().min(2).max(60),
      payout_details: z.string().trim().min(2).max(300),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("request_withdrawal", {
      _vendor_id: data.vendor_id,
      _amount: data.amount,
      _payout_method: data.payout_method,
      _payout_details: data.payout_details,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; reason?: string; available?: number; id?: string };
  });

export const createVendorCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      vendor_id: z.string().uuid(),
      code: z.string().trim().min(3).max(40),
      description: z.string().trim().max(200).optional().nullable(),
      discount_type: z.enum(["percentage", "fixed_amount"]),
      discount_value: z.number().positive(),
      min_order_amount: z.number().nonnegative().optional().nullable(),
      max_discount_amount: z.number().positive().optional().nullable(),
      usage_limit_total: z.number().int().positive().optional().nullable(),
      usage_limit_per_customer: z.number().int().positive().optional().nullable(),
      valid_from: z.string().optional().nullable(),
      valid_until: z.string().optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Verify vendor membership
    const { data: isMember } = await context.supabase.rpc("is_vendor_member", {
      _vendor_id: data.vendor_id,
      _user_id: context.userId,
    });
    if (!isMember) throw new Error("Forbidden");

    // Enforce platform cap on percentage discounts
    if (data.discount_type === "percentage") {
      const { data: setting } = await context.supabase
        .from("app_settings")
        .select("value")
        .eq("key", "max_vendor_discount_percentage")
        .maybeSingle();
      const cap = Number((setting?.value as { max?: number } | null)?.max ?? 30);
      if (data.discount_value > cap) {
        throw new Error(`Le pourcentage maximum autorisé pour un vendeur est de ${cap}%.`);
      }
    }

    const { data: row, error } = await context.supabase
      .from("coupons")
      .insert({
        code: data.code.toUpperCase(),
        description: data.description ?? null,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        applies_to: "specific_vendor",
        applies_to_ids: [data.vendor_id],
        min_order_amount: data.min_order_amount ?? null,
        max_discount_amount: data.max_discount_amount ?? null,
        usage_limit_total: data.usage_limit_total ?? null,
        usage_limit_per_customer: data.usage_limit_per_customer ?? null,
        valid_from: data.valid_from ?? new Date().toISOString(),
        valid_until: data.valid_until ?? null,
        status: "active",
        vendor_id: data.vendor_id,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });
