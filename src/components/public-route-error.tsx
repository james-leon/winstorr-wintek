import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { friendlyErrorMessage, isSessionExpiredError, recoverSession } from "@/lib/session-recovery";
import { EmptyState } from "@/components/empty-state";
import type { LucideIcon } from "lucide-react";

/**
 * Error UI for public routes: never shows raw technical errors, and silently
 * recovers (token refresh, or fallback to visitor mode) when the session died.
 */
export function PublicRouteError({
  error,
  title,
  icon,
}: {
  error: unknown;
  title: string;
  icon?: LucideIcon;
}) {
  const router = useRouter();
  const expired = isSessionExpiredError(error);

  useEffect(() => {
    if (!expired) return;
    void recoverSession().then(() => router.invalidate());
  }, [expired, router]);

  return (
    <div className="mx-auto max-w-3xl p-8">
      <EmptyState
        title={expired ? "Session expirée" : title}
        description={expired ? "Rechargement en cours…" : friendlyErrorMessage(error)}
        icon={icon}
      />
    </div>
  );
}
