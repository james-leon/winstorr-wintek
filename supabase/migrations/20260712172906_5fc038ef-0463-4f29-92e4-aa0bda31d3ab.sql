
DO $$ BEGIN
  CREATE TYPE public.category_status AS ENUM ('active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS status public.category_status NOT NULL DEFAULT 'active';

CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_unique ON public.categories (slug);
CREATE INDEX IF NOT EXISTS categories_parent_idx ON public.categories (parent_id);
CREATE INDEX IF NOT EXISTS categories_type_order_idx ON public.categories (product_type, display_order);
