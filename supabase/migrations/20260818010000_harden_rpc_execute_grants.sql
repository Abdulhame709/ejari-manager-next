-- EJARI security hardening: anonymous clients must not invoke administrative RPCs.
-- Public registration request RPCs remain available to anon intentionally.

REVOKE EXECUTE ON FUNCTION public.admin_remove_user_access(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_active(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_staff_account_request(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_tenant_account_request(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_payment_request(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.archive_contract(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.archive_customer(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.archive_shop(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_monthly_invoices(INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_last_login() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_account_request(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_payment_request(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_tenant_account_request(UUID, TEXT) FROM PUBLIC, anon;

-- These helpers are called by server-side/RPC code and are not client API endpoints.
REVOKE EXECUTE ON FUNCTION public.can_delete(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_any_role(UUID, public.app_role[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(UUID) FROM PUBLIC, anon, authenticated;

-- Trigger-only function; it does not need a REST/RPC grant.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Keep the two intended public registration request endpoints available.
GRANT EXECUTE ON FUNCTION public.submit_staff_account_request(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_tenant_account_request(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
