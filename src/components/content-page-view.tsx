import { Link } from "@tanstack/react-router";
import type { ContentPage } from "@/lib/site-content";

export function ContentPageView({ page }: { page: ContentPage }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <nav className="text-xs text-muted-foreground">
        <Link to="/" className="no-link-color hover:underline">
          Accueil
        </Link>{" "}
        <span aria-hidden>›</span> <span className="text-foreground">{page.title}</span>
      </nav>

      <h1 className="mt-3 font-display text-2xl text-primary sm:text-3xl">{page.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{page.intro}</p>

      {page.placeholder && (
        <p className="mt-4 rounded-sm border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-foreground">
          Contenu à venir — cette page sera complétée avant le lancement officiel.
        </p>
      )}

      <div className="mt-8 space-y-6">
        {page.sections.map((s, i) => (
          <section key={i} className="rounded-sm border border-border bg-card p-4">
            {s.heading && <h2 className="text-sm font-semibold text-foreground">{s.heading}</h2>}
            {s.body.map((b, j) => (
              <p key={j} className="mt-2 text-sm text-muted-foreground">
                {b}
              </p>
            ))}
            {s.bullets && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {s.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

export function ContentNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="font-display text-2xl text-primary">Page introuvable</h1>
      <p className="mt-2 text-sm text-muted-foreground">Cette page n'existe pas ou a été déplacée.</p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground no-link-color"
      >
        Retour à l'accueil
      </Link>
    </div>
  );
}
