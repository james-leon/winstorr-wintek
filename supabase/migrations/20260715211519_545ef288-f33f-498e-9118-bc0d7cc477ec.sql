
CREATE OR REPLACE FUNCTION public.accept_vendor_invitation(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv public.vendor_invitations;
  v_id uuid;
  uid uuid := auth.uid();
  base_name text;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;

  SELECT * INTO inv FROM public.vendor_invitations WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF inv.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_pending', 'status', inv.status); END IF;
  IF inv.expires_at < now() THEN
    UPDATE public.vendor_invitations SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  IF inv.vendor_id IS NULL THEN
    base_name := COALESCE(inv.proposed_vendor_name, split_part(inv.email, '@', 1));
    INSERT INTO public.vendors (name, slug, type, status, contact_email)
    VALUES (
      base_name,
      trim(both '-' from regexp_replace(lower(base_name) || '-' || substr(gen_random_uuid()::text, 1, 6), '[^a-z0-9]+', '-', 'g')),
      'external',
      'active',
      inv.email
    )
    RETURNING id INTO v_id;
  ELSE
    v_id := inv.vendor_id;
  END IF;

  INSERT INTO public.vendor_members (vendor_id, user_id, role)
  VALUES (v_id, uid, 'owner')
  ON CONFLICT DO NOTHING;

  UPDATE public.vendor_invitations
    SET status = 'accepted', accepted_at = now(), vendor_id = v_id
    WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true, 'vendor_id', v_id);
END; $function$;

-- Repair existing broken slugs (start/end with dash, or contain empty segments)
UPDATE public.vendors
SET slug = trim(both '-' from regexp_replace(lower(name) || '-' || substr(id::text, 1, 6), '[^a-z0-9]+', '-', 'g'))
WHERE slug ~ '^-' OR slug ~ '-$' OR slug ~ '--' OR slug = '';
