import { Link } from "@tanstack/react-router";

/**
 * Simple static page used for informational/legal pages whose final copy
 * is not written yet. Keeps footer links alive (no dead links).
 */
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl text-foreground">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      <div className="mt-8 rounded-sm border border-border bg-card p-6">
        <p className="text-sm text-foreground">Contenu à venir.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page sera bientôt complétée. En attendant, notre équipe reste joignable.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/contact"
            className="inline-flex rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground no-link-color"
          >
            Nous contacter
          </Link>
          <Link
            to="/catalogue"
            className="inline-flex rounded-sm border border-input bg-background px-4 py-2 text-sm font-medium no-link-color"
          >
            Voir le catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
