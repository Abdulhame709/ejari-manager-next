-- Tenant account requests, controlled approval, and visitor activity.
-- Public registration creates a pending request; it never grants tenant access directly.

CREATE TABLE IF NOT EXISTS public.account_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL DEFAULT 'tenant' CHECK (request_type = 'tenant'),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  id_number TEXT,
  address TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_account_requests_status_created
  ON public.account_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_requests_email
  ON public.account_requests (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_requests_pending_email
  ON public.account_requests (lower(email))
  WHERE status = 'pending';

ALTER TABLE public.account_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_requests_operations_read ON public.account_requests;
CREATE POLICY account_requests_operations_read
  ON public.account_requests FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

DROP POLICY IF EXISTS account_requests_own_read ON public.account_requests;
CREATE POLICY account_requests_own_read
  ON public.account_requests FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.submit_tenant_account_request(
  p_email TEXT,
  p_full_name TEXT,
  p_phone TEXT,
  p_id_number TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id UUID;
  v_auth_user_id UUID;
  v_email TEXT := lower(trim(p_email));
BEGIN
  IF v_email = '' OR trim(p_full_name) = '' OR trim(p_phone) = '' THEN
    RAISE EXCEPTION 'الاسم والبريد والهاتف مطلوبة';
  END IF;

  v_auth_user_id := auth.uid();
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
    request_type, auth_user_id, email, full_name, phone, id_number, address, notes
  )
  VALUES (
    'tenant', v_auth_user_id, v_email, trim(p_full_name), trim(p_phone),
    NULLIF(trim(p_id_number), ''), NULLIF(trim(p_address), ''), NULLIF(trim(p_notes), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_tenant_account_request(
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_request public.account_requests;
  v_customer_id UUID;
  v_user_id UUID;
  v_user_name TEXT;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]) THEN
    RAISE EXCEPTION 'غير مخول لاعتماد طلبات الحسابات';
  END IF;

  SELECT * INTO v_request
  FROM public.account_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب الحساب غير موجود';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'تمت معالجة هذا الطلب مسبقاً';
  END IF;

  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE lower(email) = lower(v_request.email)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (full_name, phone, email, id_number, address, is_active)
    VALUES (
      v_request.full_name, v_request.phone, v_request.email,
      v_request.id_number, v_request.address, true
    )
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
    SET full_name = v_request.full_name,
        phone = v_request.phone,
        id_number = COALESCE(v_request.id_number, id_number),
        address = COALESCE(v_request.address, address),
        is_active = true,
        updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  SELECT COALESCE(v_request.auth_user_id, u.id) INTO v_user_id
  FROM auth.users u
  WHERE lower(u.email) = lower(v_request.email)
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET account_type = 'tenant', is_active = true, full_name = v_request.full_name,
        phone = v_request.phone, updated_at = now()
    WHERE id = v_user_id;

    INSERT INTO public.tenant_accounts (user_id, customer_id, is_active)
    VALUES (v_user_id, v_customer_id, true)
    ON CONFLICT (user_id) DO UPDATE
      SET customer_id = EXCLUDED.customer_id, is_active = true;
  END IF;

  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = auth.uid();

  UPDATE public.account_requests
  SET status = 'approved', customer_id = v_customer_id,
      reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.audit_log (table_name, record_id, action, user_id, user_name, created_at)
  VALUES ('account_requests', p_request_id::TEXT, 'approve_tenant_account', auth.uid(), v_user_name, now());

  RETURN jsonb_build_object('request_id', p_request_id, 'customer_id', v_customer_id, 'user_id', v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_tenant_account_request(
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
  VALUES ('account_requests', p_request_id::TEXT, 'reject_tenant_account', auth.uid(), v_user_name, now());
END;
$$;

CREATE OR REPLACE FUNCTION public.record_last_login()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET last_login_at = now(), updated_at = now()
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.submit_tenant_account_request(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_tenant_account_request(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_tenant_account_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_tenant_account_request(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.reject_tenant_account_request(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_tenant_account_request(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.record_last_login() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_last_login() TO authenticated;
