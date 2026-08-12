import { cn } from "@/lib/utils";

/**
 * Base skeleton block. CSS-only shimmer (see `@utility skeleton` in styles.css),
 * no JS animation, respects prefers-reduced-motion.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("skeleton", className)} {...props} />;
}

export { Skeleton };
