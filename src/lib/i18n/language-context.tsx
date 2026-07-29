import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import i18n, { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, isLanguage, type Language } from "./index";
import { supabase } from "@/integrations/supabase/client";

type Ctx = {
  language: Language;
  setLanguage: (lang: Language) => void;
};

const LanguageCtx = createContext<Ctx | null>(null);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Language>(DEFAULT_LANGUAGE);

  // Apply stored preference after hydration (keeps SSR markup stable).
  useEffect(() => {
    const stored = readCookie(LANGUAGE_COOKIE);
    if (isLanguage(stored) && stored !== i18n.language) {
      setLang(stored);
      void i18n.changeLanguage(stored);
    }
  }, []);

  // Logged-in users: profile preference wins if no explicit cookie choice yet.
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user || cancelled) return;
      if (readCookie(LANGUAGE_COOKIE)) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("id", user.id)
        .maybeSingle();
      const pref = (profile as { preferred_language?: string } | null)?.preferred_language;
      if (!cancelled && isLanguage(pref) && pref !== i18n.language) {
        setLang(pref);
        void i18n.changeLanguage(pref);
      }
    };
    void sync().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLang(lang);
    void i18n.changeLanguage(lang);
    writeCookie(LANGUAGE_COOKIE, lang);
    void (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;
        await supabase.from("profiles").update({ preferred_language: lang } as never).eq("id", data.user.id);
      } catch {
        /* preference is still kept in the cookie */
      }
    })();
  }, []);

  return <LanguageCtx.Provider value={{ language, setLanguage }}>{children}</LanguageCtx.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageCtx);
  if (!ctx) return { language: DEFAULT_LANGUAGE as Language, setLanguage: () => {} };
  return ctx;
}

export { useTranslation };
