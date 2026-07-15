ALTER TYPE public.product_status ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE public.product_status ADD VALUE IF NOT EXISTS 'rejected';