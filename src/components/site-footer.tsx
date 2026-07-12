export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-4 text-sm">
        <div>
          <div className="font-display text-lg tracking-wide">Winstorr</div>
          <p className="mt-2 text-xs text-primary-foreground/70 leading-relaxed">
            Par Wintek — Winner Technology. La marketplace tech de confiance au Cameroun.
          </p>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/80">
            Catégories
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-primary-foreground/80">
            <li>Produits physiques</li>
            <li>Produits numériques</li>
            <li>Services techniques</li>
            <li>Formations</li>
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/80">
            À propos
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-primary-foreground/80">
            <li>Notre engagement qualité</li>
            <li>Devenir vendeur</li>
            <li>Support & SAV</li>
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/80">
            Contact
          </div>
          <p className="mt-3 text-xs text-primary-foreground/80 leading-relaxed">
            Équipe basée au Cameroun, joignable par téléphone ou en atelier.
          </p>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 py-3 text-center text-[11px] text-primary-foreground/60">
        © {new Date().getFullYear()} Wintek — Winstorr. Tous droits réservés.
      </div>
    </footer>
  );
}
