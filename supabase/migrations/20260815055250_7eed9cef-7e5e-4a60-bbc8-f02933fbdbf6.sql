CREATE OR REPLACE FUNCTION public.vendor_deletion_impact(_vendor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
  product_ids uuid[];
  blockers text[] := ARRAY[]::text[];
  c_products int; c_followers int; c_withdrawals int; c_rules int;
  c_members int; c_invitations int; c_orderitems int; c_services int;
  c_enrollments int; c_redemptions int;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT id, name, slug, type INTO v FROM public.vendors WHERE id = _vendor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendeur introuvable';
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO product_ids FROM public.products WHERE vendor_id = _vendor_id;

  c_products := coalesce(array_length(product_ids, 1), 0);
  SELECT count(*) INTO c_followers FROM public.store_follows WHERE vendor_id = _vendor_id;
  SELECT count(*) INTO c_withdrawals FROM public.vendor_withdrawal_requests WHERE vendor_id = _vendor_id;
  SELECT count(*) INTO c_rules FROM public.commission_rules WHERE scope_id = _vendor_id;
  SELECT count(*) INTO c_members FROM public.vendor_members WHERE vendor_id = _vendor_id;
  SELECT count(*) INTO c_invitations FROM public.vendor_invitations WHERE vendor_id = _vendor_id;
  SELECT count(*) INTO c_orderitems FROM public.order_items WHERE vendor_id = _vendor_id;
  SELECT count(*) INTO c_services FROM public.service_requests
    WHERE vendor_id = _vendor_id OR product_id = ANY(product_ids);
  SELECT count(*) INTO c_enrollments FROM public.training_enrollments te
    JOIN public.training_sessions ts ON ts.id = te.session_id
    WHERE ts.product_id = ANY(product_ids);
  SELECT count(*) INTO c_redemptions FROM public.coupon_redemptions cr
    JOIN public.coupons c ON c.id = cr.coupon_id
    WHERE c.vendor_id = _vendor_id;

  IF v.type = 'internal' THEN
    blockers := blockers || 'Le vendeur officiel Winstorr ne peut pas être supprimé.';
  END IF;
  IF c_orderitems > 0 THEN
    blockers := blockers || 'Ce vendeur a un historique de commandes, il ne peut pas être supprimé définitivement. Vous pouvez le suspendre à la place.';
  END IF;
  IF c_services > 0 THEN
    blockers := blockers || 'Ce vendeur a des demandes de service liées, impossible de supprimer.';
  END IF;
  IF c_enrollments > 0 THEN
    blockers := blockers || 'Des inscriptions à des formations sont liées aux produits de ce vendeur, impossible de supprimer.';
  END IF;
  IF c_redemptions > 0 THEN
    blockers := blockers || 'Des codes promo de ce vendeur ont déjà été utilisés dans des commandes, impossible de supprimer.';
  END IF;

  RETURN jsonb_build_object(
    'vendor', jsonb_build_object('id', v.id, 'name', v.name, 'slug', v.slug, 'type', v.type),
    'products', c_products,
    'followers', c_followers,
    'withdrawals', c_withdrawals,
    'commissionRules', c_rules,
    'members', c_members,
    'invitations', c_invitations,
    'orderItems', c_orderitems,
    'serviceRequests', c_services,
    'trainingEnrollments', c_enrollments,
    'couponRedemptions', c_redemptions,
    'blocked', array_length(blockers, 1) IS NOT NULL,
    'blockers', to_jsonb(blockers)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_deletion_impact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_deletion_impact(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_vendor_cascade(_vendor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  impact jsonb;
  blockers jsonb;
  product_ids uuid[];
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Lock the vendor row so concurrent writes cannot slip past the checks.
  PERFORM 1 FROM public.vendors WHERE id = _vendor_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendeur introuvable';
  END IF;

  impact := public.vendor_deletion_impact(_vendor_id);
  blockers := impact -> 'blockers';

  IF (impact ->> 'blocked')::boolean THEN
    RAISE EXCEPTION '%', (SELECT string_agg(value, ' ') FROM jsonb_array_elements_text(blockers) AS t(value));
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO product_ids FROM public.products WHERE vendor_id = _vendor_id;

  -- Everything below runs inside the function's single transaction:
  -- any failure rolls back the whole cascade, no partial deletion is possible.
  IF array_length(product_ids, 1) IS NOT NULL THEN
    DELETE FROM public.training_sessions WHERE product_id = ANY(product_ids);
    DELETE FROM public.product_questions WHERE product_id = ANY(product_ids);
    DELETE FROM public.product_reviews WHERE product_id = ANY(product_ids);
    DELETE FROM public.product_price_tiers WHERE product_id = ANY(product_ids);
    DELETE FROM public.wishlist_items WHERE product_id = ANY(product_ids);
    DELETE FROM public.financing_requests WHERE product_id = ANY(product_ids) OR vendor_id = _vendor_id;
    DELETE FROM public.product_variants WHERE product_id = ANY(product_ids);
    DELETE FROM public.products WHERE id = ANY(product_ids);
  END IF;

  DELETE FROM public.financing_requests WHERE vendor_id = _vendor_id;
  DELETE FROM public.store_follows WHERE vendor_id = _vendor_id;
  DELETE FROM public.vendor_withdrawal_requests WHERE vendor_id = _vendor_id;
  DELETE FROM public.vendor_announcements WHERE vendor_id = _vendor_id;
  DELETE FROM public.coupons WHERE vendor_id = _vendor_id;
  DELETE FROM public.commission_rules WHERE scope = 'vendor' AND scope_id = _vendor_id;
  DELETE FROM public.vendor_storefronts WHERE vendor_id = _vendor_id;
  DELETE FROM public.vendor_members WHERE vendor_id = _vendor_id;
  DELETE FROM public.vendor_invitations WHERE vendor_id = _vendor_id;
  DELETE FROM public.vendors WHERE id = _vendor_id;

  INSERT INTO public.admin_audit_log (action, entity_type, entity_id, actor_id, metadata)
  VALUES ('vendor.deleted', 'vendor', _vendor_id, auth.uid(), impact);

  RETURN jsonb_build_object('ok', true, 'deleted', impact);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_vendor_cascade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_vendor_cascade(uuid) TO authenticated, service_role;