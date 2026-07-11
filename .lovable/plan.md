# Winstorr — Module 1 Plan

Foundation for Wintek's e-commerce platform: database schema for a multi-type product catalog (physical / digital / service / training), public storefront, and a basic admin panel. No payments yet.

## 1. Backend (Lovable Cloud)

Enable Lovable Cloud, then ship one migration with:

**Enums**: `product_type`, `product_status`, `price_type`, `delivery_type`, `service_area`, `training_mode`, `training_session_status`, `service_request_status`, `training_enrollment_status`, `app_role`.

**Tables** (all with GRANTs + RLS):
- `profiles` — auto-created via `handle_new_user` trigger on `auth.users`.
- `user_roles` (separate from profiles) + `has_role(_user_id, _role)` SECURITY DEFINER.
- `categories` — hierarchical (parent_id), scoped by product_type.
- `products` — one row per product, all type-specific fields nullable. App-layer validation, not SQL CHECK.
- `training_sessions` — FK to a training product.
- `service_requests` — customer-submitted, staff-managed.
- `training_enrollments` — placeholder (payment wiring in Module 2).

**RLS pattern**:
- Public SELECT for `status='active'` products, categories, scheduled training_sessions.
- Staff/admin (via `has_role`) full write on catalog tables.
- `service_requests` and `training_enrollments`: public INSERT; SELECT/UPDATE restricted to staff/admin (customers get a confirmation UI, no self-serve lookup in M1).
- `profiles`: self read/update; admin read all.

**Storage**: create a public `product-images` bucket for admin uploads (products + service_request photos).

## 2. Design system

Update `src/styles.css` tokens (oklch equivalents):
- `--navy` #0D2C54, `--primary` #1A6BB5, `--accent` #F58B1F (CTA), `--success` #2EC04E.
- Map to shadcn tokens: primary=navy, secondary=blue, accent=orange, success=green. Foreground/background clean white + slate.
- Fonts: Russo One (headings/logo) + Inter (body) via `<link>` in `__root.tsx`; `--font-display`, `--font-sans` in `@theme`.
- Type badges: physical=blue, digital=orange, service=green, training=navy. Add a `<TypeBadge type>` component.

Update `__root.tsx` head with real Winstorr title/description/OG.

## 3. Routes

```
src/routes/
  __root.tsx                  (nav header + footer, providers)
  index.tsx                   Homepage (hero, 4 type tiles, featured products)
  catalogue.tsx               Catalog with filter sidebar + grid + search
  produits.$slug.tsx          Product detail (branches by type)
  _authenticated/
    route.tsx                 (managed auth gate)
    admin.tsx                 Admin layout (staff/admin only; non-staff → home)
    admin.produits.tsx        Products table + create/edit dialog
    admin.sessions.tsx        Training sessions manager
    admin.demandes.tsx        Service requests kanban
  auth.tsx                    Sign in / sign up (email+password, minimal)
  sitemap[.]xml.ts
```

Public routes with loaders use `context.queryClient.ensureQueryData` calling **public** server fns (publishable-key client, no auth). Admin routes use `requireSupabaseAuth` server fns + `has_role` checks.

## 4. Product detail per-type behavior

- **Physical**: gallery, stock indicator, quantity, "Ajouter au panier" (local Zustand/Context cart — stub).
- **Digital**: gallery, delivery-type info box, "Acheter maintenant" (stub → toast "Bientôt disponible").
- **Service**: request form (name/phone/email/description/preferred_date/optional photo upload to storage) → insert `service_requests` → success state.
- **Training**: session list with seats-remaining, "S'inscrire" opens dialog → insert `training_enrollments`. Full sessions disabled.

## 5. Admin

- `/admin/produits`: table with type + status filters, "Nouveau produit" dialog with dynamic fields per type, edit, archive.
- `/admin/sessions`: list per training product, create/edit/cancel sessions.
- `/admin/demandes`: kanban columns per `service_request_status`, drag-or-select to update status, add internal notes, set quoted_price.

Bootstrap: first signed-up user can be promoted to admin via a one-shot server fn gated by "no admin exists yet", or via a documented SQL insert. I'll ship the "first user becomes admin" server fn for convenience.

## 6. Cart stub

Simple `CartContext` in `src/lib/cart-context.tsx` with localStorage persistence. Header shows item count. No cart page yet (Module 2), but "Ajouter au panier" adds and toasts.

## 7. Out of scope (Module 2)

Payments (CinetPay), cart page/checkout, shipping addresses, email notifications, customer-facing order history.

## Technical notes

- Server fns live in `src/lib/*.functions.ts`; admin ones use `requireSupabaseAuth` + `has_role` check.
- No seed data — user will add products via admin panel.
- Validation with zod on all forms.
- French UI copy throughout.
- Mobile-first Tailwind, semantic tokens only (no hardcoded colors in components).

Ready to build on approval.
