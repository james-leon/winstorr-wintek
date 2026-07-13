import { Link } from "@tanstack/react-router";

const COLS: { title: string; items: { label: string; to?: string }[] }[] = [
  {
    title: "À propos",
    items: [
      { label: "À propos de Wintek" },
      { label: "Notre engagement qualité" },
      { label: "Contact" },
      { label: "Wintek Academy" },
    ],
  },
  {
    title: "Vendre sur Winstorr",
    items: [
      { label: "Devenir vendeur" },
      { label: "Espace vendeur", to: "/vendeur/tableau-de-bord" },
    ],
  },
  {
    title: "Paiement & Livraison",
    items: [
      { label: "MTN Mobile Money" },
      { label: "Orange Money" },
      { label: "Carte bancaire" },
      { label: "Zones de livraison" },
      { label: "Suivre ma commande", to: "/mon-compte/commandes" },
    ],
  },
  {
    title: "Besoin d’aide ?",
    items: [
      { label: "Retours & remboursements" },
      { label: "Garantie" },
      { label: "FAQ" },
      { label: "Nous contacter (WhatsApp)" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-4 text-sm">
        {COLS.map((col) => (
          <div key={col.title}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/80">
              {col.title}
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-primary-foreground/85">
              {col.items.map((it) =>
                it.to ? (
                  <li key={it.label}>
                    <Link to={it.to} className="hover:text-primary-foreground hover:underline no-link-color">
                      {it.label}
                    </Link>
                  </li>
                ) : (
                  <li key={it.label}>{it.label}</li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-primary-foreground/10 py-3 text-center text-[11px] text-primary-foreground/60">
        © {new Date().getFullYear()} Wintek — Winstorr. Tous droits réservés.
      </div>
    </footer>
  );
}
