import { cn } from "@/lib/utils";

/**
 * One moment of delight — animated SVG checkmark for the confirmation page.
 * Pure CSS stroke-dashoffset animation, ~700ms, respects prefers-reduced-motion.
 */
export function SuccessCheckmark({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)} role="img" aria-label="Commande confirmée">
      <svg
        viewBox="0 0 56 56"
        className="h-14 w-14"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle
          cx="28"
          cy="28"
          r="25"
          stroke="var(--color-success)"
          strokeWidth="3"
          className="success-checkmark__circle"
        />
        <path
          d="M17 29 L25 37 L40 21"
          stroke="var(--color-success)"
          strokeWidth="3.5"
          className="success-checkmark__check"
        />
      </svg>
    </div>
  );
}
