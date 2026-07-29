import { Link } from "@tanstack/react-router";
import { ShieldCheck, Lock, Wrench, MapPin, ChevronUp, Phone, Mail, MessageCircle } from "lucide-react";
import logo from "@/assets/winstorr-logo.png.asset.json";
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_RAW,
  SUPPORT_WHATSAPP_RAW,
  SUPPORT_CITY,
} from "@/lib/site-contact";

type Item = { label: string; to?: string; href?: string };

const COLS: { title: string; items: Item[] }[] = [
  {
    title: "À propos de Winstorr",
    items: [
      { label: "À propos de Wintek", to: "/a-propos" },
      { label: "Notre engagement qualité", to: "/engagement-qualite" },
      { label: "Comment ça marche", to: "/comment-ca-marche" },
      { label: "Wintek Academy", to: "/wintek-academy" },
      { label: "Nous contacter", to: "/contact" },
    ],
  },
  {
    title: "Vendre sur Winstorr",
    items: [
      { label: "Devenir vendeur", to: "/devenir-vendeur" },
      { label: "Nos boutiques", to: "/boutiques" },
      { label: "Espace vendeur", to: "/vendeur/tableau-de-bord" },
    ],
  },
  {
    title: "Paiement & Livraison",
    items: [
      { label: "Moyens de paiement", to: "/moyens-de-paiement" },
      { label: "Points de retrait", to: "/points-retrait" },
      { label: "Zones de livraison", to: "/zones-livraison" },
      { label: "Suivre ma commande", to: "/mon-compte/commandes" },
      { label: "Paiement à la réception", to: "/paiement-a-la-reception" },
    ],
  },
  {
    title: "Aide & Confiance",
    items: [
      { label: "Retours & remboursements", to: "/retours-remboursements" },
      { label: "Garantie qualité", to: "/garantie" },
      { label: "FAQ", to: "/faq" },
      {
        label: "Nous contacter sur WhatsApp",
        href: `https://wa.me/${SUPPORT_WHATSAPP_RAW}?text=${encodeURIComponent("Bonjour Winstorr, j'ai besoin d'aide.")}`,
      },
      { label: "Signaler un problème", to: "/signaler-un-probleme" },
    ],
  },
];

const TRUST = [
  { icon: ShieldCheck, title: "Qualité vérifiée", sub: "Chaque produit contrôlé" },
  { icon: Lock, title: "Paiement sécurisé", sub: "MoMo, Orange Money, carte" },
  { icon: Wrench, title: "SAV assuré par Wintek", sub: "Réparation & garantie" },
  { icon: MapPin, title: "Retrait & livraison", sub: "Douala et environs" },
];

const LEGAL: Item[] = [
  { label: "Conditions Générales de Vente", to: "/cgv" },
  { label: "Politique de confidentialité", to: "/confidentialite" },
  { label: "Politique de retour", to: "/politique-de-retour" },
  { label: "Mentions légales", to: "/mentions-legales" },
  { label: "Cookies", to: "/cookies" },
];

const linkClass =
  "no-link-color text-primary-foreground/75 hover:text-primary-foreground hover:underline";

function FooterLink({ item }: { item: Item }) {
  if (item.href) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {item.label}
      </a>
    );
  }
  if (item.to) {
    return (
      <Link to={item.to} className={linkClass}>
        {item.label}
      </Link>
    );
  }
  return <span className="text-primary-foreground/75">{item.label}</span>;
}

export function SiteFooter() {
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
        Retour en haut
      </button>

      {/* 2. Link columns */}
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 text-sm md:grid-cols-4">
        {COLS.map((col) => (
          <div key={col.title} className="min-w-0">
            <div className="text-[13px] font-bold text-primary-foreground">{col.title}</div>
            <ul className="mt-3 space-y-2 text-xs">
              {col.items.map((it) => (
                <li key={it.label}>
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
          {TRUST.map((t) => {
            const Icon = t.icon;
            return (
              <li key={t.title} className="flex items-start gap-2.5">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-success" strokeWidth={2.25} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-primary-foreground">{t.title}</div>
                  <div className="text-[11px] text-primary-foreground/65">{t.sub}</div>
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
          <span className="text-[11px] text-primary-foreground/60">🇨🇲 Cameroun — {SUPPORT_CITY}</span>
        </div>
      </div>

      {/* 5. Legal bar */}
      <div className="bg-black/40">
        <div className="mx-auto max-w-7xl px-4 py-5 text-center">
          <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px]">
            {LEGAL.map((l) => (
              <li key={l.label}>
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
            © {new Date().getFullYear()} Wintek — Winstorr. Tous droits réservés.
          </div>
        </div>
      </div>
    </footer>
  );
}
