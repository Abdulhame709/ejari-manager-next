-- EJARI RLS role matrix: production-safe verification.
-- All fixtures and temporary role changes live inside one transaction and are rolled back.
-- The active administrator's existing Auth identity is reused so profiles.auth FK is never bypassed.

BEGIN;

CREATE TEMP TABLE rls_context (user_id UUID NOT NULL) ON COMMIT DROP;
INSERT INTO rls_context (user_id)
SELECT ur.user_id
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role = 'admin' AND p.is_active = true
LIMIT 1;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM rls_context) <> 1 THEN
    RAISE EXCEPTION 'RLS test requires one active administrator account';
  END IF;
END $$;

-- Data fixtures only; all IDs are reserved test identifiers and are rolled back.
INSERT INTO public.customers (id, full_name, phone, is_active)
VALUES
  ('00000000-0000-4000-8000-000000000201', 'RLS Tenant Customer', '700000201', true),
  ('00000000-0000-4000-8000-000000000202', 'RLS Other Customer', '700000202', true);

INSERT INTO public.tenant_accounts (id, user_id, customer_id, is_active)
SELECT '00000000-0000-4000-8000-000000000301', user_id, '00000000-0000-4000-8000-000000000201', true
FROM rls_context;

INSERT INTO public.audit_log (id, table_name, record_id, action, user_id, user_name)
SELECT '00000000-0000-4000-8000-000000000401', 'rls_test', 'fixture', 'transaction_probe', user_id, 'RLS Administrator Probe'
FROM rls_context;

-- Anonymous visitor: public configuration is readable, tenant data and dashboard RPC are not.
SET LOCAL ROLE anon;
DO $$
DECLARE customer_rows INTEGER; settings_rows INTEGER; denied BOOLEAN := false;
BEGIN
  SELECT COUNT(*) INTO customer_rows FROM public.customers WHERE id = '00000000-0000-4000-8000-000000000201';
  SELECT COUNT(*) INTO settings_rows FROM public.settings;
  BEGIN
    PERFORM public.get_dashboard_stats(1, 2026);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF customer_rows <> 0 THEN RAISE EXCEPTION 'RLS anon failure: customer data became visible'; END IF;
  IF settings_rows < 1 THEN RAISE EXCEPTION 'RLS anon failure: public settings are not readable'; END IF;
  IF NOT denied THEN RAISE EXCEPTION 'RLS anon failure: dashboard RPC is executable'; END IF;
END $$;
RESET ROLE;

-- Tenant: remove all roles temporarily and verify an owned customer is visible, not another customer.
DELETE FROM public.user_roles WHERE user_id = (SELECT user_id FROM rls_context);
SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM rls_context), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE own_rows INTEGER; foreign_rows INTEGER; denied BOOLEAN := false;
BEGIN
  SELECT COUNT(*) INTO own_rows FROM public.customers WHERE id = '00000000-0000-4000-8000-000000000201';
  SELECT COUNT(*) INTO foreign_rows FROM public.customers WHERE id = '00000000-0000-4000-8000-000000000202';
  BEGIN
    PERFORM public.get_dashboard_stats(1, 2026);
  EXCEPTION WHEN OTHERS THEN denied := true;
  END;
  IF own_rows <> 1 OR foreign_rows <> 0 THEN RAISE EXCEPTION 'RLS tenant failure: own/foreign customer boundary is incorrect'; END IF;
  IF NOT denied THEN RAISE EXCEPTION 'RLS tenant failure: dashboard statistics are visible'; END IF;
END $$;
RESET ROLE;

-- Viewer: staff read and dashboard access, but no customer creation.
INSERT INTO public.user_roles (user_id, role) SELECT user_id, 'viewer' FROM rls_context;
SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM rls_context), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE customer_rows INTEGER; denied BOOLEAN := false; dashboard JSONB;
BEGIN
  SELECT COUNT(*) INTO customer_rows FROM public.customers WHERE id IN ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202');
  SELECT public.get_dashboard_stats(1, 2026) INTO dashboard;
  BEGIN
    INSERT INTO public.customers (id, full_name, phone) VALUES ('00000000-0000-4000-8000-000000000501', 'Viewer Deny Probe', '700000501');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF customer_rows <> 2 THEN RAISE EXCEPTION 'RLS viewer failure: staff records are unreadable'; END IF;
  IF dashboard IS NULL THEN RAISE EXCEPTION 'RLS viewer failure: dashboard is unavailable'; END IF;
  IF NOT denied THEN RAISE EXCEPTION 'RLS viewer failure: customer creation is allowed'; END IF;
END $$;
RESET ROLE;

-- Data entry: customer creation is allowed, audit trail remains hidden.
DELETE FROM public.user_roles WHERE user_id = (SELECT user_id FROM rls_context);
INSERT INTO public.user_roles (user_id, role) SELECT user_id, 'data_entry' FROM rls_context;
SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM rls_context), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE inserted_rows INTEGER; audit_rows INTEGER;
BEGIN
  INSERT INTO public.customers (id, full_name, phone) VALUES ('00000000-0000-4000-8000-000000000502', 'Data Entry Allow Probe', '700000502');
  SELECT COUNT(*) INTO inserted_rows FROM public.customers WHERE id = '00000000-0000-4000-8000-000000000502';
  SELECT COUNT(*) INTO audit_rows FROM public.audit_log WHERE id = '00000000-0000-4000-8000-000000000401';
  IF inserted_rows <> 1 THEN RAISE EXCEPTION 'RLS data_entry failure: customer creation is denied'; END IF;
  IF audit_rows <> 0 THEN RAISE EXCEPTION 'RLS data_entry failure: audit trail is visible'; END IF;
END $$;
RESET ROLE;

-- Accountant: financial staff read is allowed but customer creation is denied.
DELETE FROM public.user_roles WHERE user_id = (SELECT user_id FROM rls_context);
INSERT INTO public.user_roles (user_id, role) SELECT user_id, 'accountant' FROM rls_context;
SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM rls_context), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE customer_rows INTEGER; denied BOOLEAN := false;
BEGIN
  SELECT COUNT(*) INTO customer_rows FROM public.customers WHERE id IN ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202');
  BEGIN
    INSERT INTO public.customers (id, full_name, phone) VALUES ('00000000-0000-4000-8000-000000000503', 'Accountant Deny Probe', '700000503');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF customer_rows <> 2 THEN RAISE EXCEPTION 'RLS accountant failure: operational read is denied'; END IF;
  IF NOT denied THEN RAISE EXCEPTION 'RLS accountant failure: customer creation is allowed'; END IF;
END $$;
RESET ROLE;

-- Manager: customer creation and audit access are both allowed.
DELETE FROM public.user_roles WHERE user_id = (SELECT user_id FROM rls_context);
INSERT INTO public.user_roles (user_id, role) SELECT user_id, 'manager' FROM rls_context;
SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM rls_context), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE inserted_rows INTEGER; audit_rows INTEGER;
BEGIN
  INSERT INTO public.customers (id, full_name, phone) VALUES ('00000000-0000-4000-8000-000000000504', 'Manager Allow Probe', '700000504');
  SELECT COUNT(*) INTO inserted_rows FROM public.customers WHERE id = '00000000-0000-4000-8000-000000000504';
  SELECT COUNT(*) INTO audit_rows FROM public.audit_log WHERE id = '00000000-0000-4000-8000-000000000401';
  IF inserted_rows <> 1 THEN RAISE EXCEPTION 'RLS manager failure: customer creation is denied'; END IF;
  IF audit_rows <> 1 THEN RAISE EXCEPTION 'RLS manager failure: audit trail is hidden'; END IF;
END $$;
RESET ROLE;

-- Admin: customer deletion and audit access are allowed.
DELETE FROM public.user_roles WHERE user_id = (SELECT user_id FROM rls_context);
INSERT INTO public.user_roles (user_id, role) SELECT user_id, 'admin' FROM rls_context;
SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM rls_context), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE deleted_rows INTEGER; audit_rows INTEGER;
BEGIN
  DELETE FROM public.customers WHERE id = '00000000-0000-4000-8000-000000000202';
  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  SELECT COUNT(*) INTO audit_rows FROM public.audit_log WHERE id = '00000000-0000-4000-8000-000000000401';
  IF deleted_rows <> 1 THEN RAISE EXCEPTION 'RLS admin failure: customer deletion is denied'; END IF;
  IF audit_rows <> 1 THEN RAISE EXCEPTION 'RLS admin failure: audit trail is hidden'; END IF;
END $$;
RESET ROLE;

ROLLBACK;
SELECT 'rls_role_matrix_passed_and_rolled_back' AS status LIMIT 1;
