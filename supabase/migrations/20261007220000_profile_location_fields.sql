ALTER TABLE public.community_profiles
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS country text;

ALTER TABLE public.community_profiles
  DROP CONSTRAINT IF EXISTS community_profiles_location_length;

ALTER TABLE public.community_profiles
  ADD CONSTRAINT community_profiles_location_length
  CHECK (length(coalesce(district, '')) <= 120 AND length(coalesce(country, '')) <= 120);
