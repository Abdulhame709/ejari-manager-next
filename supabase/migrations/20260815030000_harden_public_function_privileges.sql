-- Harden exposed SECURITY DEFINER functions in the public API schema.
REVOKE EXECUTE ON FUNCTION public.approve_payment_request(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_payment_request(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_delete(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(UUID, public.app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
