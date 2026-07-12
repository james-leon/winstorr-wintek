
CREATE INDEX IF NOT EXISTS idx_products_active_created ON public.products (created_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_products_active_rating ON public.products (rating_average DESC, rating_count DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_products_active_price ON public.products (price) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_products_active_featured ON public.products (featured DESC, created_at DESC) WHERE status = 'active';
