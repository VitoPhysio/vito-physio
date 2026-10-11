-- Public, minimal organisation directory for the unauthenticated sign-up picker.
-- SECURITY DEFINER avoids exposing the schools table through a broad anon SELECT policy.
CREATE OR REPLACE FUNCTION public.list_public_organisations()
RETURNS TABLE(id uuid, name text, school_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.school_type
  FROM public.schools AS s
  ORDER BY s.name
  LIMIT 500;
$$;

REVOKE EXECUTE ON FUNCTION public.list_public_organisations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_organisations() TO anon, authenticated;
