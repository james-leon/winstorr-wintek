
# Module 1 v2 — Marketplace-Ready Catalog

Upgrades Module 1 with a `vendors` table, `product_reviews` with denormalized ratings, quality/trust fields on products, and an Amazon-style UX (buy box, faceted filters, star ratings, trust section). No checkout yet.

## 1. Database migration (single migration)

**New:**
- `vendors` (id, name, slug, type enum internal/external, logo_url, description, status enum active/suspended/pending_approval, commission_rate, contact_email, contact_phone, timestamps). Seed one row: **Wintek**, internal, active.
- `product_reviews` (product_id, customer_id → profiles, rating 1-5, title, comment, verified_purchase bool, status enum published/pending/hidden, timestamps).
- Enums: `vendor_type`, `vendor_status`, `source_type`, `review_status`.

**Altered `products`:**
- Add `vendor_id uuid NOT NULL` (backfilled to Wintek vendor for existing rows, then FK + NOT NULL).
- Add `compare_at_price`, `rating_average numeric default 0`, `rating_count int default 0`.
- Add `quality_verified bool default false`, `warranty_duration text`, `source_type source_type`.
- Add `requires_diagnostic bool default false` on service products.

**Triggers:**
- `recompute_product_rating()` on `product_reviews` INSERT/UPDATE/DELETE — recomputes `rating_average` and `rating_count` from published reviews only.
- Reuse existing `set_updated_at()`.

**RLS + GRANTs (public tables get anon SELECT with policy filters):**
- `vendors`: public read where `status='active'` (columns limited via view or client projection); admin write via `has_role`.
- `product_reviews`: public read where `status='published'`; authenticated insert own (`customer_id = auth.uid()`); staff update/delete.
- Products: keep existing public-read-active + staff-write policies; add vendor scoping later (comment placeholder).

## 2. Design system tweaks

`src/styles.css`: confirm tokens for navy/blue/orange/green + a new `--success` already present. Add star-rating color token (accent orange for filled stars).

## 3. Shared components

- `StarRating` — filled/half/empty SVG, sizes sm/md/lg, optional count label. Used in cards, buy box, reviews.
- `QualityBadge` — small "Qualité vérifiée" chip with checkmark, tooltip-ready.
- `VendorLine` — "Vendu par <Link>{vendor.name}</Link>".
- Update `ProductCard` to show rating, compare_at_price strike, vendor line, quality badge.

## 4. Pages

**Homepage (`/`)** — refresh:
- Sticky header with prominent centered search bar (already exists; enhance).
- Hero + category tiles (already present).
- Three carousels: Populaire (top rated), Nouveautés (recent), Recommandé (mixed) — horizontal scroll, snap.
- **"Pourquoi Winstorr" trust section** (3 columns above the fold on desktop, stacked mobile): produits authentiques / SAV Wintek / paiement MoMo & Orange Money sécurisé.

**Catalog (`/catalogue`)** — expand:
- Left sidebar filters (collapsible on mobile via Sheet): type, category (dependent), price min/max, min rating (4+, 3+, 2+).
- Sort dropdown: pertinence, prix ↑, prix ↓, meilleures notes, plus récent.
- Cards show star rating, compare price strike, vendor line, quality badge.
- URL-driven state via `validateSearch`.

**Product detail (`/produits/:slug`)** — Amazon-style buy box:
- Gallery left, buy box right.
- Buy box: name, star rating (anchor to reviews), price + strike compare_at_price, vendor line, quality/warranty banner, stock status, type-specific CTA (unchanged flow but visual refresh).
- Below fold: description tabs, then reviews section — rating distribution bars (5→1★), review list, "Laisser un avis" form (auth-gated, else inline "Connectez-vous pour laisser un avis" link).

**Admin (`/admin/*`)** — extend:
- `admin.produits`: add vendor filter/dropdown, quality_verified toggle, warranty_duration, source_type fields in the create/edit form.
- `admin.avis` (new): reviews moderation — list with status, approve/hide actions.
- Existing sessions & demandes pages remain.

## Technical Details

- One migration for schema; then update `src/integrations/supabase/types.ts` regenerates automatically.
- Loader pattern: `ensureQueryData` + `useSuspenseQuery`, per project conventions.
- Ratings recomputed via trigger — no client-side aggregation.
- Vendor page `/vendeurs/:slug`: not built now; `VendorLine` renders a `Link` that 404s gracefully via root notFoundComponent.
- Existing seeded products get `vendor_id` = Wintek in the migration itself (UPDATE before adding NOT NULL constraint).
- Charts for rating distribution: simple flex bars, no chart lib.
- Mobile filters: shadcn `Sheet` triggered by a "Filtres" button.

## Out of scope (per user)

Payments, real cart persistence, vendor onboarding, commission logic, full-text search.
