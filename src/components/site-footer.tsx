import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ShieldCheck, Lock, Wrench, MapPin, Phone, Mail, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useMyVendors } from "@/lib/vendor";
import { buildWaLink } from "@/lib/whatsapp";
import logo from "@/assets/winstorr-logo.png.asset.json";

type FooterLink = { label: string; to?: string; params?: Record<string, string>; href?: string };
type FooterCol = { title: string; items: FooterLink[] };

const CONTACT_EMAIL = "contact@winstorr.com";
const FALLBACK_PHONE = "+237 6 99 00 00 00";

function LinkItem({ item }: { item: FooterLink }) {
  const cls =
    "block py-1 text-primary-foreground/80 no-link-color transition-colors hover:text-primary-foreground hover:underline";
  if (item.href) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={cls}>
        {item.label}
      </a>
    );
  }
  return (
    <Link to={item.to!} params={item.params as never} className={cls}>
      {item.label}
    </Link>
  );
}

function Column({ col }: { col: FooterCol }) {
  return (
    <>
      {/* Mobile: accordion */}
      <details className="group border-b border-primary-foreground/10 sm:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-semibold text-primary-foreground">
          {col.title}
          <span className="text-primary-foreground/60 transition-transform group-open:rotate-180" aria-hidden>
            ⌄
          </span>
        </summary>
        <ul className="pb-3 text-sm">
          {col.items.map((it) => (
            <li key={it.label}>
              <LinkItem item={it} />
            </li>
          ))}
        </ul>
      </details>

      {/* Desktop / tablet */}
      <div className="hidden sm:block">
        <div className="text-sm font-semibold text-primary-foreground">{col.title}</div>
        <ul className="mt-3 space-y-0.5 text-[13px]">
          {col.items.map((it) => (
            <li key={it.label}>
              <LinkItem item={it} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

const TRUST = [
  { Icon: ShieldCheck, title: "Qualité vérifiée", sub: "Chaque produit contrôlé" },
  { Icon: Lock, title: "Paiement sécurisé", sub: "MoMo, Orange Money, carte" },
  { Icon: Wrench, title: "SAV assuré par Wintek", sub: "Réparation & garantie" },
  { Icon: MapPin, title: "Retrait & livraison", sub: "Douala et tout le Cameroun" },
];

const LEGAL: FooterLink[] = [
  { label: "CGV", to: "/legal/$slug", params: { slug: "cgv" } },
  { label: "Politique de confidentialité", to: "/legal/$slug", params: { slug: "confidentialite" } },
  { label: "Politique de retour", to: "/legal/$slug", params: { slug: "politique-de-retour" } },
  { label: "Mentions légales", to: "/legal/$slug", params: { slug: "mentions-legales" } },
  { label: "Cookies", to: "/legal/$slug", params: { slug: "cookies" } },
];

export function SiteFooter() {
  const { user } = useAuth();
  const { data: myVendors } = useMyVendors();
  const isVendor = !!myVendors && myVendors.length > 0;

  const { data: supportPhone } = useQuery({
    queryKey: ["whatsapp-support-number"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "whatsapp_support_number")
        .maybeSingle();
      return (data?.value as string | null) ?? null;
    },
  });

  const waHref =
    buildWaLink(supportPhone, "Bonjour Winstorr, j'ai une question.") ?? undefined;

  const cols: FooterCol[] = [
    {
      title: "À propos de Winstorr",
      items: [
        { label: "À propos de Wintek", to: "/infos/$slug", params: { slug: "a-propos" } },
        { label: "Notre engagement qualité", to: "/infos/$slug", params: { slug: "engagement-qualite" } },
        { label: "Comment ça marche", to: "/infos/$slug", params: { slug: "comment-ca-marche" } },
        { label: "Wintek Academy", to: "/infos/$slug", params: { slug: "wintek-academy" } },
        { label: "Nous contacter", to: "/infos/$slug", params: { slug: "contact" } },
      ],
    },
    {
      title: "Vendre sur Winstorr",
      items: [
        { label: "Devenir vendeur", to: "/devenir-vendeur" },
        {
          label: "Espace vendeur",
          to: isVendor ? "/vendeur/tableau-de-bord" : user ? "/devenir-vendeur" : "/connexion",
        },
        { label: "Nos boutiques", to: "/boutiques" },
        { label: "Guide du vendeur", to: "/infos/$slug", params: { slug: "guide-du-vendeur" } },
      ],
    },
    {
      title: "Paiement & Livraison",
      items: [
        { label: "Moyens de paiement", to: "/infos/$slug", params: { slug: "moyens-de-paiement" } },
        { label: "Points de retrait", to: "/infos/$slug", params: { slug: "points-de-retrait" } },
        { label: "Zones de livraison", to: "/infos/$slug", params: { slug: "zones-de-livraison" } },
        { label: "Suivre ma commande", to: "/mon-compte/commandes" },
        { label: "Paiement à la réception", to: "/infos/$slug", params: { slug: "paiement-a-la-reception" } },
      ],
    },
    {
      title: "Aide & Confiance",
      items: [
        { label: "Retours & remboursements", to: "/infos/$slug", params: { slug: "retours-remboursements" } },
        { label: "Garantie qualité", to: "/infos/$slug", params: { slug: "garantie" } },
        { label: "FAQ", to: "/infos/$slug", params: { slug: "faq" } },
        ...(waHref ? [{ label: "Nous contacter sur WhatsApp", href: waHref }] : []),
        { label: "Signaler un problème", to: "/infos/$slug", params: { slug: "signaler-un-probleme" } },
      ],
    },
  ];

  return (
    <footer className="mt-12 bg-header text-primary-foreground">
      {/* 1. Back to top */}
      <button
        type="button"
        onClick={() =>
          window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
        }
        className="w-full bg-header-alt py-3 text-center text-xs font-medium text-primary-foreground/90 transition-colors hover:bg-header-alt/80"
      >
        <span className="inline-flex items-center gap-1.5">
          Retour en haut <ArrowUp className="h-3.5 w-3.5" />
        </span>
      </button>

      {/* 2. Link columns */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
        <div className="grid grid-cols-1 gap-x-8 gap-y-0 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-4">
          {cols.map((c) => (
            <Column key={c.title} col={c} />
          ))}
        </div>
      </div>

      {/* 3. Trust strip */}
      <div className="border-t border-primary-foreground/10">
        <ul className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ Icon, title, sub }) => (
            <li key={title} className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-success/15">
                <Icon className="h-4.5 w-4.5 text-success" strokeWidth={2.25} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-primary-foreground">{title}</span>
                <span className="block truncate text-xs text-primary-foreground/70">{sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* 4. Brand + region */}
      <div className="border-t border-primary-foreground/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-6">
          <Link to="/" className="no-link-color">
            <img src={logo.url} alt="Winstorr — Wintek" className="h-8 w-auto" loading="lazy" />
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-primary-foreground/15 px-2 py-1 text-[11px] text-primary-foreground/70">
            <MapPin className="h-3 w-3" /> Cameroun · Français
          </span>
        </div>
      </div>

      {/* 5. Legal bottom bar */}
      <div className="bg-[#0B0C0F]">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center">
          <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px]">
            {LEGAL.map((l) => (
              <li key={l.label}>
                <Link
                  to={l.to!}
                  params={l.params as never}
                  className="text-primary-foreground/60 no-link-color hover:text-primary-foreground hover:underline"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-primary-foreground/60">
            <a href={`tel:${(supportPhone ?? FALLBACK_PHONE).replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 no-link-color hover:text-primary-foreground">
              <Phone className="h-3 w-3" /> {supportPhone ?? FALLBACK_PHONE}
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-1 no-link-color hover:text-primary-foreground">
              <Mail className="h-3 w-3" /> {CONTACT_EMAIL}
            </a>
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 no-link-color hover:text-primary-foreground"
              >
                <MessageCircle className="h-3 w-3" /> WhatsApp
              </a>
            )}
          </div>

          <p className="mt-3 text-[11px] text-primary-foreground/45">
            © {new Date().getFullYear()} Wintek — Winstorr. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
