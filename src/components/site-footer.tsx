import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ShieldCheck, Lock, Wrench, MapPin, ChevronUp, Phone, Mail, MessageCircle } from "lucide-react";
import logo from "@/assets/winstorr-logo.png.asset.json";
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_RAW,
  SUPPORT_WHATSAPP_RAW,
  SUPPORT_CITY,
} from "@/lib/site-contact";

type Item = { key: string; to?: string; href?: string };

const COLS: { titleKey: string; items: Item[] }[] = [
  {
    titleKey: "footer.colAbout",
    items: [
      { key: "footer.aboutWintek", to: "/a-propos" },
      { key: "footer.qualityCommitment", to: "/engagement-qualite" },
      { key: "footer.howItWorks", to: "/comment-ca-marche" },
      { key: "footer.academy", to: "/wintek-academy" },
      { key: "footer.contactUs", to: "/contact" },
    ],
  },
  {
    titleKey: "footer.colSell",
    items: [
      { key: "footer.becomeVendor", to: "/devenir-vendeur" },
      { key: "footer.ourStores", to: "/boutiques" },
      { key: "footer.vendorSpace", to: "/vendeur/tableau-de-bord" },
    ],
  },
  {
    titleKey: "footer.colPayment",
    items: [
      { key: "footer.paymentMethods", to: "/moyens-de-paiement" },
      { key: "footer.pickupPoints", to: "/points-retrait" },
      { key: "footer.deliveryZones", to: "/zones-livraison" },
      { key: "footer.trackOrder", to: "/mon-compte/commandes" },
      { key: "footer.cashOnDelivery", to: "/paiement-a-la-reception" },
    ],
  },
  {
    titleKey: "footer.colHelp",
    items: [
      { key: "footer.returns", to: "/retours-remboursements" },
      { key: "footer.warranty", to: "/garantie" },
      { key: "footer.faq", to: "/faq" },
      { key: "footer.whatsapp", href: "whatsapp" },
      { key: "footer.reportProblem", to: "/signaler-un-probleme" },
    ],
  },
];

const TRUST = [
  { icon: ShieldCheck, titleKey: "footer.trustQualityTitle", subKey: "footer.trustQualitySub" },
  { icon: Lock, titleKey: "footer.trustPaymentTitle", subKey: "footer.trustPaymentSub" },
  { icon: Wrench, titleKey: "footer.trustServiceTitle", subKey: "footer.trustServiceSub" },
  { icon: MapPin, titleKey: "footer.trustDeliveryTitle", subKey: "footer.trustDeliverySub" },
];

const LEGAL: Item[] = [
  { key: "footer.cgv", to: "/cgv" },
  { key: "footer.privacy", to: "/confidentialite" },
  { key: "footer.returnPolicy", to: "/politique-de-retour" },
  { key: "footer.legal", to: "/mentions-legales" },
  { key: "footer.cookies", to: "/cookies" },
];

const linkClass =
  "no-link-color text-primary-foreground/75 hover:text-primary-foreground hover:underline";

function FooterLink({ item }: { item: Item }) {
  const { t } = useTranslation();
  const label = t(item.key);
  if (item.href === "whatsapp") {
    return (
      <a
        href={`https://wa.me/${SUPPORT_WHATSAPP_RAW}?text=${encodeURIComponent(t("footer.whatsappMessage"))}`}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        {label}
      </a>
    );
  }
  if (item.to) {
    return (
      <Link to={item.to} className={linkClass}>
        {label}
      </Link>
    );
  }
  return <span className="text-primary-foreground/75">{label}</span>;
}

export function SiteFooter() {
  const { t } = useTranslation();
  const scrollTop = () => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="mt-12 bg-header text-primary-foreground">
      {/* 1. Back to top */}
      <button
        type="button"
        onClick={scrollTop}
        className="flex w-full items-center justify-center gap-1.5 bg-header-alt py-3 text-xs font-medium text-primary-foreground/90 transition-colors hover:bg-header-alt/80"
      >
        <ChevronUp className="h-4 w-4" />
        {t("footer.backToTop")}
      </button>

      {/* 2. Link columns */}
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 text-sm md:grid-cols-4">
        {COLS.map((col) => (
          <div key={col.titleKey} className="min-w-0">
            <div className="text-[13px] font-bold text-primary-foreground">{t(col.titleKey)}</div>
            <ul className="mt-3 space-y-2 text-xs">
              {col.items.map((it) => (
                <li key={it.key}>
                  <FooterLink item={it} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* 3. Trust strip */}
      <div className="border-t border-primary-foreground/10">
        <ul className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:grid-cols-2 md:grid-cols-4">
          {TRUST.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.titleKey} className="flex items-start gap-2.5">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-success" strokeWidth={2.25} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-primary-foreground">{t(item.titleKey)}</div>
                  <div className="text-[11px] text-primary-foreground/65">{t(item.subKey)}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 4. Brand + region */}
      <div className="border-t border-primary-foreground/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-6">
          <Link to="/" className="no-link-color">
            <img src={logo.url} alt="Winstorr" className="h-7 w-auto" loading="lazy" />
          </Link>
          <span className="text-[11px] text-primary-foreground/60">{t("footer.region", { city: SUPPORT_CITY })}</span>
          <LanguageSwitcher />
        </div>
      </div>

      {/* 5. Legal bar */}
      <div className="bg-black/40">
        <div className="mx-auto max-w-7xl px-4 py-5 text-center">
          <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px]">
            {LEGAL.map((l) => (
              <li key={l.key}>
                <FooterLink item={l} />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-primary-foreground/70">
            <a href={`tel:+${SUPPORT_PHONE_RAW}`} className={`${linkClass} inline-flex items-center gap-1.5`}>
              <Phone className="h-3.5 w-3.5" /> {SUPPORT_PHONE_DISPLAY}
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}`} className={`${linkClass} inline-flex items-center gap-1.5`}>
              <Mail className="h-3.5 w-3.5" /> {SUPPORT_EMAIL}
            </a>
            <a
              href={`https://wa.me/${SUPPORT_WHATSAPP_RAW}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkClass} inline-flex items-center gap-1.5`}
            >
              <MessageCircle className="h-3.5 w-3.5 text-success" /> WhatsApp
            </a>
          </div>
          <div className="mt-3 text-[11px] text-primary-foreground/55">
            {t("footer.rights", { year: new Date().getFullYear() })}
          </div>
        </div>
      </div>
    </footer>
  );
}
