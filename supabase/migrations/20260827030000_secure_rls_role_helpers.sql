-- Restore the minimum EXECUTE grants required by RLS policy expressions.
-- Each helper is constrained to the caller's own JWT subject so it cannot be
-- used to enumerate another user's roles through the public RPC surface.

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
     AND _user_id = auth.uid()
     AND EXISTS (
       SELECT 1
       FROM public.user_roles
       WHERE user_id = _user_id
         AND role = _role
     );
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(
  _user_id UUID,
  _roles public.app_role[]
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
     AND _user_id = auth.uid()
     AND EXISTS (
       SELECT 1
       FROM public.user_roles
       WHERE user_id = _user_id
         AND role = ANY(_roles)
     );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_any_role(
    _user_id,
    ARRAY['admin', 'manager', 'accountant', 'data_entry', 'viewer']::public.app_role[]
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_any_role(UUID, public.app_role[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(UUID, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(UUID) TO authenticated;
