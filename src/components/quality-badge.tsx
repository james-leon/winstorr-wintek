import { CheckCircle2, ShieldCheck, Store } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * PRODUCT-level trust badge: "Qualité vérifiée" (check-in-circle, green).
 * Awarded by Wintek staff only — never self-awarded by vendors.
 */
export function QualityBadge({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const { t } = useTranslation();
  const sm = size === "sm";
  const label = t("trust.qualityVerified");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-success/30 bg-success/10 font-semibold text-success",
        sm ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        className,
      )}
      title={label}
      aria-label={label}
    >
      <CheckCircle2 className={cn(sm ? "h-3 w-3" : "h-3.5 w-3.5", "shrink-0")} strokeWidth={2.5} />
      {label}
    </span>
  );
}

/**
 * VENDOR-level trust badge: "Vendeur vérifié" (shield, green).
 * Distinct icon + full label so customers know WHAT is verified.
 */
export function SellerVerifiedBadge({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const { t } = useTranslation();
  const sm = size === "sm";
  const label = t("trust.sellerVerified");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 font-semibold text-success",
        sm ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        className,
      )}
      title={label}
      aria-label={label}
    >
      <ShieldCheck className={cn(sm ? "h-3 w-3" : "h-3.5 w-3.5", "shrink-0")} strokeWidth={2.5} />
      {label}
    </span>
  );
}

export function VendorLine({
  name,
  slug,
  internal,
  className,
}: {
  name: string;
  slug?: string;
  internal?: boolean;
  className?: string;
}) {
  const inner = (
    <>
      <Store className="h-3.5 w-3.5" />
      <span>
        Vendu par{" "}
        <span className={cn("font-medium", slug ? "text-secondary group-hover:underline" : "text-foreground")}>
          {name}
        </span>
        {internal && <span className="ml-1 text-secondary">· Officiel</span>}
      </span>
    </>
  );
  const base = "inline-flex items-center gap-1.5 text-xs text-muted-foreground";
  if (slug) {
    return (
      <Link
        to="/boutiques/$vendorSlug"
        params={{ vendorSlug: slug }}
        className={cn(base, "group no-link-color", className)}
      >
        {inner}
      </Link>
    );
  }
  return <div className={cn(base, className)}>{inner}</div>;
}
