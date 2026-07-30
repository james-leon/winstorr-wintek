CREATE OR REPLACE FUNCTION public.set_vendor_allow_financing(_vendor_id uuid, _allow boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF NOT (public.is_vendor_member(_vendor_id, uid) OR public.is_staff(uid)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  UPDATE public.vendors SET allow_financing = _allow, updated_at = now() WHERE id = _vendor_id;
  RETURN jsonb_build_object('ok', true, 'allow_financing', _allow);
END;
$$;
REVOKE ALL ON FUNCTION public.set_vendor_allow_financing(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_vendor_allow_financing(uuid, boolean) TO authenticated, service_role;