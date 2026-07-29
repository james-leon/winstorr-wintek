ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'fr';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_preferred_language_check CHECK (preferred_language IN ('fr','en'));
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS short_description_en text;