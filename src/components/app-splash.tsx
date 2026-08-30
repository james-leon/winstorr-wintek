import { useEffect, useState } from "react";

/**
 * Brand loading screen shown while the app boots (web + PWA standalone).
 * Rendered during SSR so there is never a white flash, then faded out on mount.
 */
export function AppSplash() {
  const [hidden, setHidden] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setHidden(true), 350);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hidden) return;
    const t = window.setTimeout(() => setRemoved(true), 450);
    return () => window.clearTimeout(t);
  }, [hidden]);

  if (removed) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        backgroundColor: "#0D2C54",
        opacity: hidden ? 0 : 1,
        transition: "opacity 400ms ease",
        pointerEvents: hidden ? "none" : "auto",
      }}
    >
      <img
        src="/icon-512.png"
        alt=""
        width={128}
        height={128}
        style={{ width: 128, height: 128, borderRadius: 24 }}
      />
      <p
        style={{
          margin: 0,
          color: "rgba(255,255,255,0.92)",
          fontSize: 15,
          letterSpacing: "0.02em",
          fontWeight: 600,
        }}
      >
        Achetez avec confiance
      </p>
    </div>
  );
}
