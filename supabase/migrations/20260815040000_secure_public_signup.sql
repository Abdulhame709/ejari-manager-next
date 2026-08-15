-- Public sign-up must never grant an administrator role.
-- Existing roles are preserved; future staff sign-ups start as viewer.
-- The first administrator must be provisioned by a controlled bootstrap/admin flow.

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

  -- Never grant admin from a public sign-up. Staff accounts created through
  -- the public auth endpoint receive the least-privileged staff role.
  IF requested_account_type = 'staff' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'viewer')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Tenant and visitor accounts intentionally receive no staff role. Tenant
  -- access is granted only after an active tenant_accounts link exists.
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
