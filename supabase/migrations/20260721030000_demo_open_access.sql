-- EJARI demo mode
-- Every newly registered account receives full staff access so a product
-- demonstration can be shared without manual role assignment or approval.
-- IMPORTANT: replace this policy before production use.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;

  -- Demo access: all new accounts can explore every module.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Upgrade existing non-tenant demo accounts too, so the behavior is
-- consistent for people already registered before this migration.
DELETE FROM public.user_roles ur
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_accounts ta WHERE ta.user_id = ur.user_id
);

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::public.app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_accounts ta WHERE ta.user_id = p.id
)
ON CONFLICT (user_id, role) DO NOTHING;
