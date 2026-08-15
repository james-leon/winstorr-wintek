import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  rating: number;
  count?: number;
  size?: "sm" | "md" | "lg" | "xl";
  showCount?: boolean;
  className?: string;
  interactive?: boolean;
  onRate?: (rating: number) => void;
};

const SIZES = {
  sm: { star: "h-3.5 w-3.5", text: "text-xs", px: 14 },
  md: { star: "h-4 w-4", text: "text-sm", px: 16 },
  lg: { star: "h-5 w-5", text: "text-base", px: 20 },
  xl: { star: "h-6 w-6", text: "text-lg", px: 24 },
};

export function StarRating({
  rating,
  count,
  size = "sm",
  showCount = true,
  className,
  interactive,
  onRate,
}: Props) {
  const [hover, setHover] = useState(0);
  const s = SIZES[size];
  const displayRating = interactive && hover ? hover : rating;
  const rounded = Math.round(displayRating * 2) / 2;

  const starNode = (i: number, filled: boolean, half: boolean) => (
    <span className="relative inline-block shrink-0" style={{ width: s.px, height: s.px }}>
      <Star className={cn(s.star, "text-muted-foreground/55")} />
      {(filled || half) && (
        <span
          className="absolute inset-0 overflow-hidden text-accent"
          style={{ width: half ? "50%" : "100%" }}
        >
          <Star className={cn(s.star, "fill-accent text-accent")} />
        </span>
      )}
    </span>
  );

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div
        className={cn(
          "flex flex-nowrap items-center gap-1",
          interactive && "overflow-hidden"
        )}
        style={interactive ? { width: `${5 * s.px + 4 * 4}px` } : undefined}
        role={interactive ? "radiogroup" : undefined}
        aria-label={interactive ? "Note" : undefined}
      >
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = rounded >= i;
          const half = !filled && rounded >= i - 0.5;
          if (!interactive) {
            return <span key={i}>{starNode(i, filled, half)}</span>;
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => onRate?.(i)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              className="shrink-0 p-0 leading-none"
              style={{ width: s.px, height: s.px }}
              aria-label={`${i} étoiles`}
              aria-checked={rating === i}
              role="radio"
            >
              {starNode(i, filled, half)}
            </button>
          );
        })}
      </div>
      {showCount && (
        <span className={cn(s.text, "text-muted-foreground")}>
          {count && count > 0 ? (
            <>
              <span className="font-medium text-foreground">{rating.toFixed(1)}</span> ({count})
            </>
          ) : (
            "Aucun avis"
          )}
        </span>
      )}
    </div>
  );
}
