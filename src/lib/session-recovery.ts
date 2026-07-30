import { supabase } from "@/integrations/supabase/client";

/**
 * Detects errors caused by an expired / invalid Supabase session.
 * PostgREST returns 401 with code PGRST301 and message "JWT expired".
 */
export function isSessionExpiredError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; code?: string; status?: number; name?: string };
  const msg = (e.message ?? "").toLowerCase();
  return (
    e.code === "PGRST301" ||
    msg.includes("jwt expired") ||
    msg.includes("invalid jwt") ||
    msg.includes("token is expired") ||
    msg.includes("refresh_token_not_found") ||
    msg.includes("invalid refresh token")
  );
}

let inflight: Promise<boolean> | null = null;

/**
 * Tries to refresh the Supabase session. If the refresh token is dead,
 * clears the local session so subsequent requests are made as an anonymous
 * visitor (public pages keep working instead of showing "JWT expired").
 * Returns true when a valid session is available afterwards.
 */
export function recoverSession(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session) return true;
    } catch {
      /* fall through to local sign-out */
    }
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* ignore */
    }
    return false;
  })().finally(() => {
    // allow a new attempt on the next failure burst
    setTimeout(() => {
      inflight = null;
    }, 1000);
  });

  return inflight;
}

/**
 * Called once at app start: proactively refreshes a session that is expired
 * (or about to expire) so the very first data request never carries a dead JWT.
 */
export async function ensureFreshSessionOnBoot() {
  if (typeof window === "undefined") return;
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return;
    const expiresAt = (session.expires_at ?? 0) * 1000;
    if (expiresAt - Date.now() < 60_000) await recoverSession();
  } catch {
    /* ignore */
  }
}

/** Human-readable (French) message for any thrown error shown to users. */
export function friendlyErrorMessage(error: unknown): string {
  if (isSessionExpiredError(error)) {
    return "Votre session a expiré. La page a été rechargée en mode visiteur — réessayez.";
  }
  const msg =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!msg) return "Une erreur est survenue. Réessayez dans un instant.";
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return "Connexion impossible. Vérifiez votre réseau et réessayez.";
  }
  if (/permission denied|row-level security|not authorized|unauthorized/i.test(msg)) {
    return "Vous n'avez pas accès à ce contenu.";
  }
  return msg;
}
