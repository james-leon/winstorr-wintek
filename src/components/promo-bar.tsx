import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, Check, Gift } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

export type PromoBarSetting = {
  active?: boolean;
  message?: string;
  message_en?: string;
  code?: string;
  cta_label?: string;
  cta_label_en?: string;
  cta_link?: string;
};

export const PROMO_BAR_KEY = "homepage_promo_bar";

export function usePromoBar() {
  return useQuery({
    queryKey: ["settings", PROMO_BAR_KEY],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PromoBarSetting | null> => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", PROMO_BAR_KEY)
        .maybeSingle();
      return (data?.value as PromoBarSetting | null) ?? null;
    },
  });
}

export function PromoBar() {
  const { t, i18n } = useTranslation();
  const { data } = usePromoBar();
  const [copied, setCopied] = useState(false);

  const en = i18n.language?.startsWith("en");
  const message = (en ? data?.message_en : data?.message) || data?.message;
  if (!data?.active || !message?.trim()) return null;

  const ctaLabel = (en ? data.cta_label_en : data.cta_label) || data.cta_label;
  const code = data.code?.trim();

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6">
      <div className="flex flex-col gap-3 rounded-[var(--radius-r-lg)] border border-[var(--color-accent-500)]/35 bg-[linear-gradient(100deg,rgba(245,139,31,0.12),rgba(245,139,31,0.03))] px-4 py-3.5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-r)]"
            style={{ background: "var(--color-accent-500)", color: "#fff" }}
          >
            <Gift className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
          <p className="min-w-0 text-[13.5px] font-semibold leading-snug text-[var(--color-ink)] md:text-[15px]">
            {message}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {code && (
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-2 rounded-[var(--radius-r)] border border-dashed border-[var(--color-accent-500)] bg-white px-3 py-1.5 text-[13px] font-bold tracking-wide text-[var(--color-ink)] transition-colors hover:bg-[var(--color-accent-500)]/10"
              aria-label={t("home.copyCode")}
            >
              <span className="font-mono">{code}</span>
              {copied ? (
                <Check className="h-3.5 w-3.5" style={{ color: "var(--color-success, #16A34A)" }} />
              ) : (
                <Copy className="h-3.5 w-3.5 text-[var(--color-muted-ink)]" />
              )}
              <span className="sr-only">{copied ? t("home.codeCopied") : t("home.copyCode")}</span>
            </button>
          )}
          {ctaLabel && data.cta_link && (
            <Link
              to={data.cta_link as never}
              className="no-link-color inline-flex items-center rounded-[var(--radius-r)] px-4 py-2 text-[13px] font-bold text-white shadow-[var(--shadow-soft)]"
              style={{ background: "var(--color-accent-500)" }}
            >
              {ctaLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
