-- Staff registration follows the same approval boundary as tenant registration.
-- Visitor registration remains immediate and receives the visitor portal only.

ALTER TABLE public.account_requests
  DROP CONSTRAINT IF EXISTS account_requests_request_type_check;

ALTER TABLE public.account_requests
  ADD CONSTRAINT account_requests_request_type_check
  CHECK (request_type IN ('tenant', 'staff'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_account_type TEXT;
BEGIN
  requested_account_type := CASE
    WHEN NEW.raw_user_meta_data->>'account_type' IN ('tenant', 'visitor', 'staff')
      THEN NEW.raw_user_meta_data->>'account_type'
    ELSE 'staff'
  END;

  INSERT INTO public.profiles (id, full_name, phone, account_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    requested_account_type
  );

  -- Public staff sign-ups remain without a staff role until approval.
  -- Admin-created accounts receive their explicit role through the admin flow.
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_staff_account_request(
  p_email TEXT,
  p_full_name TEXT,
  p_phone TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id UUID;
  v_auth_user_id UUID := auth.uid();
  v_email TEXT := lower(trim(p_email));
BEGIN
  IF v_email = '' OR trim(p_full_name) = '' OR trim(p_phone) = '' THEN
    RAISE EXCEPTION 'الاسم والبريد والهاتف مطلوبة';
  END IF;

  IF v_auth_user_id IS NULL THEN
    SELECT id INTO v_auth_user_id
    FROM auth.users
    WHERE lower(email) = v_email
    LIMIT 1;
  END IF;

  SELECT id INTO v_id
  FROM public.account_requests
  WHERE lower(email) = v_email AND status = 'pending'
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.account_requests (
    request_type, auth_user_id, email, full_name, phone, notes
  )
  VALUES (
    'staff', v_auth_user_id, v_email, trim(p_full_name), trim(p_phone),
    NULLIF(trim(p_notes), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_staff_account_request(
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_request public.account_requests;
  v_user_id UUID;
  v_user_name TEXT;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]) THEN
    RAISE EXCEPTION 'غير مخول لاعتماد طلبات الحسابات';
  END IF;

  SELECT * INTO v_request
  FROM public.account_requests
  WHERE id = p_request_id AND request_type = 'staff'
  FOR UPDATE;

  IF NOT FOUND OR v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'طلب الموظف غير موجود أو تمت معالجته مسبقاً';
  END IF;

  v_user_id := v_request.auth_user_id;
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = lower(v_request.email)
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'يجب أن يؤكد صاحب الطلب بريده الإلكتروني أولاً';
  END IF;

  UPDATE public.profiles
  SET account_type = 'staff', is_active = true,
      full_name = v_request.full_name, phone = v_request.phone, updated_at = now()
  WHERE id = v_user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'viewer')
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = auth.uid();

  UPDATE public.account_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id AND status = 'pending';

  INSERT INTO public.audit_log (table_name, record_id, action, user_id, user_name, created_at)
  VALUES ('account_requests', p_request_id::TEXT, 'approve_staff_account', auth.uid(), v_user_name, now());

  RETURN jsonb_build_object('request_id', p_request_id, 'user_id', v_user_id, 'role', 'viewer');
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_account_request(
  p_request_id UUID,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]) THEN
    RAISE EXCEPTION 'غير مخول برفض طلبات الحسابات';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.account_requests
    WHERE id = p_request_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'طلب الحساب غير موجود أو تمت معالجته مسبقاً';
  END IF;

  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = auth.uid();

  UPDATE public.account_requests
  SET status = 'rejected', rejection_reason = NULLIF(trim(p_rejection_reason), ''),
      reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id AND status = 'pending';

  INSERT INTO public.audit_log (table_name, record_id, action, user_id, user_name, created_at)
  VALUES ('account_requests', p_request_id::TEXT, 'reject_account_request', auth.uid(), v_user_name, now());
END;
$$;

REVOKE ALL ON FUNCTION public.submit_staff_account_request(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_staff_account_request(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_staff_account_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_staff_account_request(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.reject_account_request(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_account_request(UUID, TEXT) TO authenticated;
