export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-3">
        <div>
          <div className="font-display text-2xl">Winstorr</div>
          <p className="mt-2 text-sm text-primary-foreground/70">
            Par Wintek — Winner Technology. Électronique, produits numériques,
            services et formations pour vos besoins tech.
          </p>
        </div>
        <div>
          <div className="text-sm font-semibold uppercase tracking-wider text-primary-foreground/80">
            Catégories
          </div>
          <ul className="mt-3 space-y-2 text-sm text-primary-foreground/80">
            <li>Électronique</li>
            <li>Produits numériques</li>
            <li>Services</li>
            <li>Formations</li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold uppercase tracking-wider text-primary-foreground/80">
            Contact
          </div>
          <p className="mt-3 text-sm text-primary-foreground/80">
            Une question sur un produit ou un devis&nbsp;?
            <br />
            Passez par la page catalogue et sélectionnez le service concerné.
          </p>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 py-4 text-center text-xs text-primary-foreground/60">
        © {new Date().getFullYear()} Wintek — Winstorr. Tous droits réservés.
      </div>
    </footer>
  );
}
