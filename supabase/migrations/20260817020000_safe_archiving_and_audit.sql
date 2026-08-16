-- EJARI P0/P1: preserve financial history by archiving instead of deleting.

CREATE OR REPLACE FUNCTION public.archive_shop(p_shop_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.can_manage(v_user) THEN
    RAISE EXCEPTION 'غير مصرح بأرشفة الوحدة';
  END IF;
  UPDATE public.shops
     SET is_active = false,
         is_public = false,
         status = 'inactive',
         updated_at = now()
   WHERE id = p_shop_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الوحدة غير موجودة'; END IF;
  INSERT INTO public.audit_log(table_name, record_id, action, new_values, user_id, user_name, created_at)
  VALUES ('shops', p_shop_id::TEXT, 'archive', jsonb_build_object('is_active', false, 'status', 'inactive'), v_user, COALESCE(auth.jwt()->>'email', v_user::TEXT), now());
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_customer(p_customer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.can_manage(v_user) THEN
    RAISE EXCEPTION 'غير مصرح بأرشفة العميل';
  END IF;
  UPDATE public.customers SET is_active = false, updated_at = now() WHERE id = p_customer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;
  INSERT INTO public.audit_log(table_name, record_id, action, new_values, user_id, user_name, created_at)
  VALUES ('customers', p_customer_id::TEXT, 'archive', jsonb_build_object('is_active', false), v_user, COALESCE(auth.jwt()->>'email', v_user::TEXT), now());
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_contract(p_contract_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.can_manage(v_user) THEN
    RAISE EXCEPTION 'غير مصرح بأرشفة العقد';
  END IF;
  UPDATE public.contracts SET status = 'cancelled', updated_at = now() WHERE id = p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'العقد غير موجود'; END IF;
  INSERT INTO public.audit_log(table_name, record_id, action, new_values, user_id, user_name, created_at)
  VALUES ('contracts', p_contract_id::TEXT, 'archive', jsonb_build_object('status', 'cancelled'), v_user, COALESCE(auth.jwt()->>'email', v_user::TEXT), now());
END;
$$;

REVOKE ALL ON FUNCTION public.archive_shop(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_customer(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_contract(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_shop(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_customer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_contract(UUID) TO authenticated;
