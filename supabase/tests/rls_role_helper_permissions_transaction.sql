-- Verifies that role helpers are unavailable to anon and cannot be used by an
-- authenticated user to inspect another user's roles. No data is persisted.

BEGIN;

CREATE TEMP TABLE rls_helper_context (user_id UUID NOT NULL) ON COMMIT DROP;
INSERT INTO rls_helper_context (user_id)
SELECT ur.user_id
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role = 'admin' AND p.is_active = true
LIMIT 1;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM rls_helper_context) <> 1 THEN
    RAISE EXCEPTION 'RLS helper test requires one active administrator account';
  END IF;
END $$;

SELECT set_config('rls_test.user_id', (SELECT user_id::text FROM rls_helper_context), true);

-- Anonymous callers must not be granted EXECUTE on the helpers.
SET LOCAL ROLE anon;
DO $$
DECLARE
  denied BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM public.has_role(current_setting('rls_test.user_id')::uuid, 'admin'::public.app_role);
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;

  IF NOT denied THEN
    RAISE EXCEPTION 'RLS helper failure: anon can execute has_role';
  END IF;
END $$;
RESET ROLE;

-- An authenticated caller can inspect only the role set of its current identity.
SELECT set_config('request.jwt.claim.sub', current_setting('rls_test.user_id'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  current_user_id UUID := auth.uid();
  other_user_id UUID := '00000000-0000-4000-8000-000000000601';
BEGIN
  IF NOT public.has_role(current_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'RLS helper failure: authenticated user cannot inspect own admin role';
  END IF;

  IF NOT public.has_any_role(current_user_id, ARRAY['admin'::public.app_role]) THEN
    RAISE EXCEPTION 'RLS helper failure: authenticated user cannot inspect own role set';
  END IF;

  IF NOT public.is_staff(current_user_id) THEN
    RAISE EXCEPTION 'RLS helper failure: authenticated staff identity is not recognized';
  END IF;

  IF public.has_role(other_user_id, 'admin'::public.app_role)
     OR public.has_any_role(other_user_id, ARRAY['admin'::public.app_role])
     OR public.is_staff(other_user_id) THEN
    RAISE EXCEPTION 'RLS helper failure: authenticated user can inspect another user role';
  END IF;
END $$;
RESET ROLE;

ROLLBACK;
SELECT 'rls_role_helpers_passed_and_rolled_back' AS status LIMIT 1;
