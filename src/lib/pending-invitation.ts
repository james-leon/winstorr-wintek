// Keeps an invitation link alive across the sign-up / sign-in flow.
// The token is stored client-side when the invitation page is opened, then
// re-applied right after authentication so the store activates in one pass.

const KEY = "winstorr:pending-invitation";
const MAX_AGE_MS = 60 * 60 * 1000; // 1h

export type PendingInvitation = {
  kind: "vendor" | "partner";
  token: string;
  path: string;
  ts: number;
};

export function rememberPendingInvitation(kind: PendingInvitation["kind"], token: string) {
  if (typeof window === "undefined") return;
  const path = kind === "vendor" ? `/vendeur/invitation/${token}` : `/partenaire/invitation/${token}`;
  try {
    localStorage.setItem(KEY, JSON.stringify({ kind, token, path, ts: Date.now() } satisfies PendingInvitation));
  } catch {
    /* storage unavailable — the ?next= param still carries the context */
  }
}

export function readPendingInvitation(): PendingInvitation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingInvitation;
    if (!parsed?.token || !parsed?.path || Date.now() - parsed.ts > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingInvitation() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/** Only same-origin absolute paths are accepted as post-auth destinations. */
export function safeNextPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}
