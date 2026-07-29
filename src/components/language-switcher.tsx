import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/lib/i18n/language-context";
import { LANGUAGES, type Language } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LABELS: Record<Language, string> = { fr: "FR", en: "EN" };

/** FR / EN switcher. `variant` controls the color scheme for dark bars vs. light surfaces. */
export function LanguageSwitcher({
  variant = "dark",
  className,
}: {
  variant?: "dark" | "light";
  className?: string;
}) {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const dark = variant === "dark";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-1",
        dark ? "text-white/85" : "text-foreground/80",
        className,
      )}
      role="group"
      aria-label={t("common.language")}
    >
      <Globe className="h-4 w-4 shrink-0" aria-hidden />
      {LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => setLanguage(lng)}
          aria-pressed={language === lng}
          aria-label={lng === "fr" ? t("common.french") : t("common.english")}
          className={cn(
            "rounded-sm px-1.5 py-0.5 text-[11px] font-semibold transition-colors",
            language === lng
              ? dark
                ? "bg-white/20 text-white"
                : "bg-muted text-foreground"
              : dark
                ? "text-white/60 hover:text-white"
                : "text-muted-foreground hover:text-foreground",
          )}
        >
          {LABELS[lng]}
        </button>
      ))}
    </div>
  );
}
