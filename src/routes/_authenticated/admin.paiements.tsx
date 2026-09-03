import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CheckCircle2, XCircle, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPaymentProviderStatus } from "@/lib/payment-methods.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/admin/paiements")({
  component: AdminPayments,
});

type Row = {
  id: string;
  provider_key: string;
  display_name: string;
  display_name_en: string | null;
  is_enabled: boolean;
  supports_environment: boolean;
  environment: "test" | "production";
  applies_to_product_types: string[];
  display_order: number;
  config_note: string | null;
};

const TYPES = ["physical", "digital", "service", "training"] as const;

function AdminPayments() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const statusFn = useServerFn(getPaymentProviderStatus);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "payment-methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        applies_to_product_types: (r.applies_to_product_types as string[] | null) ?? [],
      })) as Row[];
    },
  });

  const { data: status } = useQuery({ queryKey: ["admin", "payment-provider-status"], queryFn: () => statusFn() });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Row> }) => {
      const { error } = await supabase.from("payment_methods").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "payment-methods"] });
      qc.invalidateQueries({ queryKey: ["checkout-payment-methods"] });
      toast.success(t("adminPayments.saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = (row: Row, dir: -1 | 1) => {
    const sorted = [...rows].sort((a, b) => a.display_order - b.display_order);
    const i = sorted.findIndex((r) => r.id === row.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const other = sorted[j]!;
    update.mutate({ id: row.id, patch: { display_order: other.display_order } });
    update.mutate({ id: other.id, patch: { display_order: row.display_order } });
  };

  const toggleType = (row: Row, type: string, on: boolean) => {
    const next = on
      ? Array.from(new Set([...row.applies_to_product_types, type]))
      : row.applies_to_product_types.filter((x) => x !== type);
    update.mutate({ id: row.id, patch: { applies_to_product_types: next as never } });
  };

  return (
    <div className="max-w-3xl space-y-4">
      <header>
        <h1 className="font-heading text-xl">{t("adminPayments.title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" />
          {t("adminPayments.secretsNotice")}
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}

      {rows.map((row) => {
        const providerStatus = row.provider_key === "campay" ? status?.campay : null;
        return (
          <section key={row.id} className="rounded-sm border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{row.display_name}</h2>
                <p className="text-xs text-muted-foreground">{row.provider_key}</p>
                {row.config_note && <p className="mt-1 text-xs text-muted-foreground">{row.config_note}</p>}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={() => move(row, -1)} aria-label="Monter">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => move(row, 1)} aria-label="Descendre">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`en-${row.id}`}
                    checked={row.is_enabled}
                    onCheckedChange={(v) => update.mutate({ id: row.id, patch: { is_enabled: v } })}
                  />
                  <Label htmlFor={`en-${row.id}`} className="text-sm">
                    {row.is_enabled ? t("adminPayments.enabled") : t("adminPayments.disabled")}
                  </Label>
                </div>
              </div>
            </div>

            {row.supports_environment && (
              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`env-${row.id}`}
                    checked={row.environment === "production"}
                    onCheckedChange={(v) =>
                      update.mutate({ id: row.id, patch: { environment: v ? "production" : "test" } })
                    }
                  />
                  <Label htmlFor={`env-${row.id}`} className="text-sm">
                    {row.environment === "production" ? t("adminPayments.production") : t("adminPayments.test")}
                  </Label>
                </div>
                {providerStatus && (
                  <span className="flex items-center gap-1.5 text-xs">
                    {providerStatus.configured ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        {t("adminPayments.keysConfigured")}
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-destructive" />
                        {t("adminPayments.keysMissing")}
                      </>
                    )}
                  </span>
                )}
              </div>
            )}

            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-sm font-medium">{t("adminPayments.appliesTo")}</p>
              <div className="flex flex-wrap gap-4">
                {TYPES.map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={row.applies_to_product_types.includes(type)}
                      onCheckedChange={(v) => toggleType(row, type, v === true)}
                    />
                    {t(`productTypes.${type}`)}
                  </label>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
