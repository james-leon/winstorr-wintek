CREATE OR REPLACE FUNCTION public.identifier_has_account(_identifier text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = lower(trim(_identifier))
       OR regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = regexp_replace(trim(_identifier), '[^0-9]', '', 'g')
       AND regexp_replace(trim(_identifier), '[^0-9]', '', 'g') <> ''
  );
$$;

REVOKE ALL ON FUNCTION public.identifier_has_account(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.identifier_has_account(text) TO anon, authenticated;