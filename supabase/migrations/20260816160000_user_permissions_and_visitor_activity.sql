-- Fine-grained permissions and reliable visitor activity tracking.

CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_key),
  CONSTRAINT user_permissions_key_check CHECK (
    permission_key IN (
      'configuration.view', 'configuration.manage',
      'inputs.view', 'inputs.manage',
      'screens.dashboard', 'screens.properties', 'screens.shops', 'screens.customers',
      'screens.contracts', 'screens.readings', 'screens.invoices', 'screens.receipts',
      'screens.reports', 'screens.users', 'screens.permissions',
      'operations.contracts', 'operations.payments', 'operations.payment_approvals',
      'reports.view', 'reports.export'
    )
  )
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_permissions_admin_read ON public.user_permissions;
DROP POLICY IF EXISTS user_permissions_admin_manage ON public.user_permissions;
CREATE POLICY user_permissions_admin_read
  ON public.user_permissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY user_permissions_admin_manage
  ON public.user_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.record_last_login()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.profiles
  SET last_login_at = now(), updated_at = now()
  WHERE id = auth.uid() AND is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_active(
  p_user_id UUID,
  p_is_active BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'غير مخول بإدارة حالة المستخدمين';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'لا يمكنك تغيير حالة حسابك الحالي';
  END IF;
  UPDATE public.profiles SET is_active = p_is_active, updated_at = now() WHERE id = p_user_id;
  IF NOT p_is_active THEN
    DELETE FROM public.user_roles WHERE user_id = p_user_id;
    DELETE FROM public.tenant_accounts WHERE user_id = p_user_id;
    DELETE FROM public.user_permissions WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- Permanent auth deletion needs a server-side service-role boundary. This safe
-- browser operation removes application access and records a soft deletion.
CREATE OR REPLACE FUNCTION public.admin_remove_user_access(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'غير مخول بإزالة وصول المستخدمين';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'لا يمكنك إزالة وصول حسابك الحالي';
  END IF;
  UPDATE public.profiles SET is_active = false, updated_at = now() WHERE id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.tenant_accounts WHERE user_id = p_user_id;
  DELETE FROM public.user_permissions WHERE user_id = p_user_id;
  UPDATE public.account_requests SET status = 'rejected', rejection_reason = 'تم إزالة الوصول من الإدارة', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE auth_user_id = p_user_id AND status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_active(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_active(UUID, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_remove_user_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_user_access(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.record_last_login() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_last_login() TO authenticated;

-- Backfill visitor account type for profiles created with visitor metadata.
UPDATE public.profiles p
SET account_type = 'visitor', updated_at = now()
FROM auth.users u
WHERE u.id = p.id
  AND u.raw_user_meta_data->>'account_type' = 'visitor'
  AND p.account_type IS DISTINCT FROM 'visitor';
