# Winstorr — Design Excellence Pass

Scope: a consistency + polish sweep across the existing app. No new features beyond what's listed; no new colors/fonts/spacing values outside the systems below.

## 1. Systemize the foundations (`src/styles.css`)

Codify the spacing and type scale as CSS variables so every component pulls from the same source. Keeps the Cream/Navy/Orange/Green palette exactly as-is; only tightens usage.

- Spacing tokens `--space-1..--space-8` on the 4/8/12/16/24/32/48/64 scale, exposed as Tailwind arbitrary values via `@theme`.
- Type scale `--fs-12..--fs-40` (12/14/16/18/20/24/32/40) with matching line-heights (1.5 body, 1.3 headings). Restrict weights to 400/500/600/700 — audit and strip any `font-extrabold`/`font-light` usage.
- Focus ring: standardize on a 2px orange (`--accent`) ring at 2px offset. Applied via a `.focus-visible-ring` utility and Button/Input variants.
- Motion tokens: `--dur-fast: 150ms`, `--dur-med: 200ms`, `--ease-out: cubic-bezier(0.2, 0, 0, 1)`. Global default `transition-duration` bumped to 150ms ease-out.
- Contrast audit: verify muted-foreground on cream, and secondary-blue link on cream, both hit AA. Nudge `--muted-foreground` darker if needed.

## 2. Component-level primitives

New/updated small components used everywhere:

- `src/components/ui/skeleton.tsx` already exists (shadcn) — wire it into the pages below.
- `src/components/product-card-skeleton.tsx` — matches ProductCard footprint (square image + 3 text lines + price).
- `src/components/empty-state.tsx` — icon + title + description + optional CTA. Reused by cart, wishlist, orders, search-no-results, admin tables.
- `src/components/confirm-dialog.tsx` — small wrapper over shadcn AlertDialog for destructive actions (delete product, remove address, cancel order, delete coupon). Replace every raw `confirm()`/single-click delete.
- `src/components/trust-strip.tsx` — compact reusable strip (Qualité vérifiée · Paiement sécurisé · Garantie) to drop into buy box, cart summary, and checkout summary. Not just homepage.
- `StarRating`, `QualityBadge` — already good, leave.

## 3. Loading + empty + feedback pass (per page)

For each page: replace blank/`Chargement…` states with skeletons matching final layout, add designed empty states, ensure every mutation shows a toast.

- `routes/catalogue.tsx` — grid skeleton while products load; empty state when filters yield 0 results (with "Réinitialiser les filtres" CTA).
- `routes/index.tsx` — shelf skeletons for each dynamic shelf.
- `routes/produits.$slug.tsx` — product page skeleton (image square + title lines + buy box block).
- `routes/panier.tsx` — empty cart state with illustration icon + "Découvrir le catalogue" CTA.
- `_authenticated/mon-compte.commandes.tsx` — skeleton rows + empty state.
- `_authenticated/mon-compte.liste-de-souhaits.tsx` — empty wishlist state.
- Admin list pages (`admin.produits`, `admin.commandes`, `admin.codes-promo`, `admin.categories`, `admin.retours`, `admin.avis`) — table skeletons + empty states + confirm dialog on every delete/archive.

## 4. Forms: inline validation

Convert `onSubmit`-only validation to `onBlur` + `onChange` inline errors under each field, plain-language messages.

- `routes/auth.tsx` (email/password rules on blur).
- `routes/commande.tsx` (checkout shipping form: name, phone, city required; phone format hint).
- Review submission on product page.
- Admin product editor (slug format, price required unless quote_only, tier rows ordered).
- Return request form.

Use react-hook-form + zod (already in deps) with `mode: "onBlur"`.

## 5. Accessibility (WCAG 2.1 AA)

- Add `aria-label` to every icon-only button (already partly done; sweep header, product card wishlist heart, quantity +/- buttons, admin row actions).
- Replace placeholder-only inputs with real `<Label htmlFor>` bindings in checkout, auth, admin forms.
- Product images: `alt={product.name}` everywhere (audit ProductCard, buy box, cart line, order line).
- Ensure tap targets ≥44px on mobile: bump icon buttons in header/cart/quantity stepper to `min-h-11 min-w-11`.
- Visible focus rings on all interactive elements via the standardized utility.
- Single `<main>` per page (already enforced by root layout).

## 6. Retention patterns

- **Recently viewed**: `src/lib/recently-viewed.ts` — localStorage-backed (last 12 product IDs, dedup, LRU). Push on product page mount. New `RecentlyViewedShelf` component rendered on homepage (below hero, above bestsellers) and at bottom of product page. Falls back silently when empty.
- **"Recommandé pour vous"** shelf on homepage: if recently-viewed exists, query products from the same category as the most-recent viewed item; else fall back to bestsellers (existing shelf). Keep it simple and client-side — no schema changes.
- **Cart/wishlist counts** in header: already wired; verify they update optimistically on add/remove.
- **Post-purchase account nudge**: on `commande.$orderNumber.confirmation.tsx`, if guest checkout, show a small "Créer un compte pour suivre vos commandes" card (dismissible). Not a gate.
- **Sticky order summary**: on `commande.tsx` (checkout), make the right-column summary `sticky top-4` on desktop; add a compact bottom bar with total + CTA on mobile.

## 7. One moment of delight

On `commande.$orderNumber.confirmation.tsx`: SVG checkmark draw-in animation (green stroke, ~600ms) above the "Merci pour votre commande" heading. Pure CSS `stroke-dasharray` animation, respects `prefers-reduced-motion`. No confetti, no sound. This is the only added animation.

## 8. Trust reinforcement at hesitation points

Drop `<TrustStrip />` (compact one-liner) into:
- Product buy box (below the CTA)
- Cart summary card
- Checkout summary card

Content: `✓ Qualité vérifiée · ✓ Paiement sécurisé (MoMo/OM/Carte) · ✓ Retour sous 7 jours`.

## 9. Motion polish

- Global: default transitions 150ms ease-out via base layer.
- Hover on cards: border color shift + subtle shadow bump (no scale).
- Remove any `transition-transform hover:scale-*` on cards/buttons found during sweep.
- Respect `prefers-reduced-motion` for the confirmation checkmark.

## Out of scope

- No schema changes.
- No new colors, fonts, or spacing values beyond the systemized tokens.
- No feature additions (no reviews list redesign, no new admin pages, no new checkout steps).
- Personalization stays client-side (localStorage) — no `recently_viewed` table.

## Technical notes

Files touched (approx): `src/styles.css`, `src/components/{empty-state,product-card-skeleton,confirm-dialog,trust-strip,recently-viewed-shelf}.tsx`, `src/lib/recently-viewed.ts`, and targeted edits to catalogue/index/produits.$slug/panier/commande/confirmation/mon-compte.*/admin.*/auth route files, plus ProductCard and site-header sweep for a11y.

Execution order per turn to keep diffs reviewable:
1. Tokens + primitives (styles.css + new components).
2. Skeletons + empty states across public routes.
3. Checkout polish (sticky summary, inline validation, confirmation delight, post-purchase nudge).
4. Admin sweep (confirm dialogs, skeletons, empty states).
5. Recently-viewed + recommended shelf.
6. Final a11y + motion sweep.
