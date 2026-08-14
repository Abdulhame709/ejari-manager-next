-- EJARI: restore production role-based access after the temporary demo mode.
-- This migration is additive and safe to apply after all prior migrations.
-- It intentionally does not infer or overwrite roles for real existing users;
-- review those assignments from the Users page after applying it.

-- ---------------------------------------------------------------------------
-- 1. Stop the fixed seeded account from having application access.
-- Keep the auth row instead of deleting it because historical receipts/audit
-- rows may reference that user without ON DELETE CASCADE.
-- ---------------------------------------------------------------------------
DELETE FROM public.user_roles
WHERE user_id IN (
  SELECT id FROM auth.users WHERE lower(email) = 'admin@ejari.local'
);

UPDATE public.profiles
SET is_active = false, updated_at = now()
WHERE id IN (
  SELECT id FROM auth.users WHERE lower(email) = 'admin@ejari.local'
);

-- ---------------------------------------------------------------------------
-- 2. Persist the selected portal type independently from staff roles.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'staff';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_type_check
  CHECK (account_type IN ('staff', 'tenant', 'visitor'));

UPDATE public.profiles p
SET account_type = 'tenant'
WHERE EXISTS (
  SELECT 1 FROM public.tenant_accounts ta WHERE ta.user_id = p.id AND ta.is_active = true
);

-- New users are never granted unrestricted demo access. The first real staff
-- account becomes admin only when no admin exists; later staff accounts start
-- as viewer until an admin explicitly assigns their intended role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_type TEXT := COALESCE(NEW.raw_user_meta_data->>'account_type', 'staff');
  linked_customer_id UUID;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, is_active, account_type)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, 'مستخدم'),
    NEW.raw_user_meta_data->>'phone',
    true,
    CASE
      WHEN requested_type IN ('staff', 'tenant', 'visitor') THEN requested_type
      ELSE 'staff'
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    is_active = true,
    account_type = EXCLUDED.account_type,
    updated_at = now();

  IF requested_type = 'tenant' THEN
    -- Link by the verified account email only when that customer is not already
    -- linked to another auth account. Otherwise create a separate tenant record.
    SELECT c.id INTO linked_customer_id
    FROM public.customers c
    WHERE lower(c.email) = lower(NEW.email)
      AND NOT EXISTS (
        SELECT 1 FROM public.tenant_accounts ta WHERE ta.customer_id = c.id
      )
    ORDER BY c.created_at
    LIMIT 1;

    IF linked_customer_id IS NULL THEN
      INSERT INTO public.customers (full_name, phone, email, is_active)
      VALUES (
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, 'مستأجر'),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), 'غير محدد'),
        NEW.email,
        true
      )
      RETURNING id INTO linked_customer_id;
    END IF;

    INSERT INTO public.tenant_accounts (user_id, customer_id, is_active)
    VALUES (NEW.id, linked_customer_id, true)
    ON CONFLICT (user_id) DO UPDATE SET
      customer_id = EXCLUDED.customer_id,
      is_active = true;

  ELSIF requested_type = 'visitor' THEN
    -- Visitor is a virtual application role read from auth metadata. It does
    -- not receive a user_roles row and therefore cannot pass staff RLS checks.
    NULL;

  ELSE
    -- The first real staff registration bootstraps the installation. Every
    -- later management registration starts read-only until an admin assigns it.
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE role = 'admin'::public.app_role
    ) THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'admin'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    ELSE
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'viewer'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. Shared role helpers used by the policies below.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_any_role(
  _user_id UUID,
  _roles public.app_role[]
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(
    _user_id,
    ARRAY['admin','manager','accountant','data_entry','viewer']::public.app_role[]
  );
$$;

-- Remove all prior public-table policies for EJARI. Several older migrations
-- used broad can_manage() policies, so leaving even one would bypass the new
-- page/module permission matrix because PostgreSQL combines policies with OR.
DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY(ARRAY[
        'profiles', 'user_roles', 'properties', 'shops', 'customers', 'contracts',
        'meter_types', 'meter_readings', 'invoices', 'receipts', 'receipt_details',
        'additional_charges', 'settings', 'audit_log', 'unit_images', 'bank_accounts',
        'viewing_requests', 'tenant_accounts', 'payment_requests',
        'payment_request_invoices'
      ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END $$;

-- Profiles and roles ---------------------------------------------------------
CREATE POLICY profiles_read_own_or_admin
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY profiles_update_own_or_admin
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY profiles_admin_insert_delete
  ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY roles_read_own_or_admin
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY roles_admin_manage
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Properties ----------------------------------------------------------------
CREATE POLICY properties_staff_read
  ON public.properties FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY properties_admin_manager_insert
  ON public.properties FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));
CREATE POLICY properties_admin_manager_update
  ON public.properties FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));
CREATE POLICY properties_admin_manager_delete
  ON public.properties FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

-- Units (legacy table name: shops) ------------------------------------------
CREATE POLICY shops_public_read
  ON public.shops FOR SELECT TO anon, authenticated
  USING (is_public = true AND status = 'available' AND is_active = true);
CREATE POLICY shops_staff_read
  ON public.shops FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY shops_tenant_read_own
  ON public.shops FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT c.shop_id
      FROM public.contracts c
      JOIN public.tenant_accounts ta ON ta.customer_id = c.customer_id
      WHERE ta.user_id = auth.uid() AND ta.is_active = true AND c.status = 'active'
    )
  );
CREATE POLICY shops_operations_insert
  ON public.shops FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[]));
CREATE POLICY shops_operations_update
  ON public.shops FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[]));
CREATE POLICY shops_admin_manager_delete
  ON public.shops FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

-- Customers -----------------------------------------------------------------
CREATE POLICY customers_staff_read
  ON public.customers FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY customers_tenant_read_own
  ON public.customers FOR SELECT TO authenticated
  USING (id IN (SELECT customer_id FROM public.tenant_accounts WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY customers_operations_insert
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[]));
CREATE POLICY customers_operations_update
  ON public.customers FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[]));
CREATE POLICY customers_admin_manager_delete
  ON public.customers FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

-- Contracts -----------------------------------------------------------------
CREATE POLICY contracts_staff_read
  ON public.contracts FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY contracts_tenant_read_own
  ON public.contracts FOR SELECT TO authenticated
  USING (customer_id IN (SELECT customer_id FROM public.tenant_accounts WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY contracts_operations_insert
  ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[]));
CREATE POLICY contracts_operations_update
  ON public.contracts FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[]));
CREATE POLICY contracts_admin_manager_delete
  ON public.contracts FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

-- Meter types and readings ---------------------------------------------------
CREATE POLICY meter_types_public_read
  ON public.meter_types FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY meter_types_admin_manager_manage
  ON public.meter_types FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

CREATE POLICY readings_staff_read
  ON public.meter_readings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY readings_tenant_read_own
  ON public.meter_readings FOR SELECT TO authenticated
  USING (
    shop_id IN (
      SELECT c.shop_id
      FROM public.contracts c
      JOIN public.tenant_accounts ta ON ta.customer_id = c.customer_id
      WHERE ta.user_id = auth.uid() AND ta.is_active = true AND c.status = 'active'
    )
  );
CREATE POLICY readings_operations_insert
  ON public.meter_readings FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant','data_entry']::public.app_role[]));
CREATE POLICY readings_operations_update
  ON public.meter_readings FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant','data_entry']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant','data_entry']::public.app_role[]));
CREATE POLICY readings_admin_manager_delete
  ON public.meter_readings FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

-- Invoices ------------------------------------------------------------------
CREATE POLICY invoices_staff_read
  ON public.invoices FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY invoices_tenant_read_own
  ON public.invoices FOR SELECT TO authenticated
  USING (customer_id IN (SELECT customer_id FROM public.tenant_accounts WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY invoices_finance_insert
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));
CREATE POLICY invoices_finance_update
  ON public.invoices FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));
CREATE POLICY invoices_admin_manager_delete
  ON public.invoices FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

-- Receipts and allocations ---------------------------------------------------
CREATE POLICY receipts_staff_read
  ON public.receipts FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY receipts_tenant_read_own
  ON public.receipts FOR SELECT TO authenticated
  USING (customer_id IN (SELECT customer_id FROM public.tenant_accounts WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY receipts_finance_insert
  ON public.receipts FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));
CREATE POLICY receipts_finance_update
  ON public.receipts FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));
CREATE POLICY receipts_admin_manager_delete
  ON public.receipts FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

CREATE POLICY receipt_details_staff_read
  ON public.receipt_details FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY receipt_details_tenant_read_own
  ON public.receipt_details FOR SELECT TO authenticated
  USING (
    receipt_id IN (
      SELECT r.id FROM public.receipts r
      WHERE r.customer_id IN (
        SELECT customer_id FROM public.tenant_accounts WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );
CREATE POLICY receipt_details_finance_insert
  ON public.receipt_details FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));
CREATE POLICY receipt_details_finance_update
  ON public.receipt_details FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));
CREATE POLICY receipt_details_admin_manager_delete
  ON public.receipt_details FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

-- Additional charges ---------------------------------------------------------
CREATE POLICY charges_staff_read
  ON public.additional_charges FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY charges_finance_insert
  ON public.additional_charges FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));
CREATE POLICY charges_finance_update
  ON public.additional_charges FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));
CREATE POLICY charges_admin_manager_delete
  ON public.additional_charges FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

-- Settings, audit, images and bank accounts ---------------------------------
CREATE POLICY settings_public_read
  ON public.settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY settings_admin_manager_update
  ON public.settings FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

CREATE POLICY audit_admin_manager_read
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));
CREATE POLICY audit_insert_own
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY unit_images_public_read
  ON public.unit_images FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY unit_images_operations_insert
  ON public.unit_images FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[]));
CREATE POLICY unit_images_operations_update
  ON public.unit_images FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[]));
CREATE POLICY unit_images_admin_manager_delete
  ON public.unit_images FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

CREATE POLICY bank_accounts_authenticated_read
  ON public.bank_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY bank_accounts_admin_manager_manage
  ON public.bank_accounts FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

-- Viewing requests -----------------------------------------------------------
CREATE POLICY viewing_requests_public_insert
  ON public.viewing_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY viewing_requests_operations_read
  ON public.viewing_requests FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[]));
CREATE POLICY viewing_requests_operations_update
  ON public.viewing_requests FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[]));
CREATE POLICY viewing_requests_admin_manager_delete
  ON public.viewing_requests FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

-- Tenant-account mapping -----------------------------------------------------
CREATE POLICY tenant_accounts_read_own_or_admin
  ON public.tenant_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY tenant_accounts_admin_manage
  ON public.tenant_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Payment requests -----------------------------------------------------------
CREATE POLICY payment_requests_read_own_or_finance
  ON public.payment_requests FOR SELECT TO authenticated
  USING (
    tenant_account_id IN (
      SELECT id FROM public.tenant_accounts WHERE user_id = auth.uid() AND is_active = true
    )
    OR public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[])
  );
CREATE POLICY payment_requests_tenant_insert
  ON public.payment_requests FOR INSERT TO authenticated
  WITH CHECK (
    tenant_account_id IN (
      SELECT id FROM public.tenant_accounts WHERE user_id = auth.uid() AND is_active = true
    )
    AND status = 'pending_review'
    AND (
      invoice_id IS NULL
      OR invoice_id IN (
        SELECT i.id
        FROM public.invoices i
        JOIN public.tenant_accounts ta ON ta.customer_id = i.customer_id
        WHERE ta.user_id = auth.uid() AND ta.is_active = true
      )
    )
  );
CREATE POLICY payment_requests_tenant_cancel
  ON public.payment_requests FOR UPDATE TO authenticated
  USING (
    tenant_account_id IN (
      SELECT id FROM public.tenant_accounts WHERE user_id = auth.uid() AND is_active = true
    )
    AND status = 'pending_review'
  )
  WITH CHECK (
    tenant_account_id IN (
      SELECT id FROM public.tenant_accounts WHERE user_id = auth.uid() AND is_active = true
    )
    AND status = 'cancelled'
  );
CREATE POLICY payment_requests_finance_update
  ON public.payment_requests FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));
CREATE POLICY payment_requests_admin_manager_delete
  ON public.payment_requests FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[]));

CREATE POLICY payment_request_invoices_read_own_or_finance
  ON public.payment_request_invoices FOR SELECT TO authenticated
  USING (
    payment_request_id IN (
      SELECT pr.id
      FROM public.payment_requests pr
      JOIN public.tenant_accounts ta ON ta.id = pr.tenant_account_id
      WHERE ta.user_id = auth.uid() AND ta.is_active = true
    )
    OR public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[])
  );
CREATE POLICY payment_request_invoices_tenant_insert
  ON public.payment_request_invoices FOR INSERT TO authenticated
  WITH CHECK (
    payment_request_id IN (
      SELECT pr.id
      FROM public.payment_requests pr
      JOIN public.tenant_accounts ta ON ta.id = pr.tenant_account_id
      WHERE ta.user_id = auth.uid() AND ta.is_active = true AND pr.status = 'pending_review'
    )
  );
CREATE POLICY payment_request_invoices_finance_manage
  ON public.payment_request_invoices FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[]));

-- ---------------------------------------------------------------------------
-- 4. Storage policies aligned with the same module permissions.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "unit_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "unit_images_staff_write" ON storage.objects;
DROP POLICY IF EXISTS "unit_images_staff_update" ON storage.objects;
DROP POLICY IF EXISTS "unit_images_staff_delete" ON storage.objects;
DROP POLICY IF EXISTS "contracts_staff_all" ON storage.objects;
DROP POLICY IF EXISTS "contracts_tenant_read" ON storage.objects;
DROP POLICY IF EXISTS "receipts_staff_all" ON storage.objects;
DROP POLICY IF EXISTS "pp_tenant_upload" ON storage.objects;
DROP POLICY IF EXISTS "pp_tenant_read_own" ON storage.objects;
DROP POLICY IF EXISTS "ui_public_read" ON storage.objects;
DROP POLICY IF EXISTS "ui_staff_write" ON storage.objects;
DROP POLICY IF EXISTS "ui_staff_update" ON storage.objects;
DROP POLICY IF EXISTS "ui_staff_delete" ON storage.objects;
DROP POLICY IF EXISTS "con_staff_all" ON storage.objects;
DROP POLICY IF EXISTS "con_tenant_read" ON storage.objects;
DROP POLICY IF EXISTS "rec_staff_all" ON storage.objects;
DROP POLICY IF EXISTS "pp_staff_all" ON storage.objects;
DROP POLICY IF EXISTS "pp_upload" ON storage.objects;
DROP POLICY IF EXISTS "pp_read_own" ON storage.objects;
DROP POLICY IF EXISTS "ejari_payment_proof_tenant_upload" ON storage.objects;
DROP POLICY IF EXISTS "ejari_payment_proof_tenant_read" ON storage.objects;
DROP POLICY IF EXISTS "ejari_unit_images_read" ON storage.objects;
DROP POLICY IF EXISTS "ejari_unit_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "ejari_unit_images_update" ON storage.objects;
DROP POLICY IF EXISTS "ejari_unit_images_delete" ON storage.objects;
DROP POLICY IF EXISTS "ejari_contracts_staff_read" ON storage.objects;
DROP POLICY IF EXISTS "ejari_contracts_tenant_read" ON storage.objects;
DROP POLICY IF EXISTS "ejari_contracts_insert" ON storage.objects;
DROP POLICY IF EXISTS "ejari_contracts_update" ON storage.objects;
DROP POLICY IF EXISTS "ejari_contracts_delete" ON storage.objects;
DROP POLICY IF EXISTS "ejari_receipts_finance_read" ON storage.objects;
DROP POLICY IF EXISTS "ejari_receipts_finance_insert" ON storage.objects;
DROP POLICY IF EXISTS "ejari_receipts_finance_update" ON storage.objects;
DROP POLICY IF EXISTS "ejari_receipts_admin_manager_delete" ON storage.objects;
DROP POLICY IF EXISTS "ejari_payment_proofs_tenant_insert" ON storage.objects;
DROP POLICY IF EXISTS "ejari_payment_proofs_tenant_read" ON storage.objects;
DROP POLICY IF EXISTS "ejari_payment_proofs_finance_read" ON storage.objects;
DROP POLICY IF EXISTS "ejari_payment_proofs_finance_update" ON storage.objects;
DROP POLICY IF EXISTS "ejari_payment_proofs_finance_delete" ON storage.objects;

CREATE POLICY "ejari_unit_images_read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'unit-images');
CREATE POLICY "ejari_unit_images_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'unit-images'
    AND public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[])
  );
CREATE POLICY "ejari_unit_images_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'unit-images'
    AND public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[])
  );
CREATE POLICY "ejari_unit_images_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'unit-images'
    AND public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[])
  );

CREATE POLICY "ejari_contracts_staff_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contracts' AND public.is_staff(auth.uid()));
CREATE POLICY "ejari_contracts_tenant_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'contracts'
    AND split_part(name, '/', 1) IN (
      SELECT c.id::text
      FROM public.contracts c
      JOIN public.tenant_accounts ta ON ta.customer_id = c.customer_id
      WHERE ta.user_id = auth.uid() AND ta.is_active = true
    )
  );
CREATE POLICY "ejari_contracts_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contracts'
    AND public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[])
  );
CREATE POLICY "ejari_contracts_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'contracts'
    AND public.has_any_role(auth.uid(), ARRAY['admin','manager','data_entry']::public.app_role[])
  );
CREATE POLICY "ejari_contracts_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'contracts'
    AND public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[])
  );

CREATE POLICY "ejari_receipts_finance_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[])
  );
CREATE POLICY "ejari_receipts_finance_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[])
  );
CREATE POLICY "ejari_receipts_finance_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[])
  );
CREATE POLICY "ejari_receipts_admin_manager_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND public.has_any_role(auth.uid(), ARRAY['admin','manager']::public.app_role[])
  );

CREATE POLICY "ejari_payment_proofs_tenant_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM public.tenant_accounts WHERE user_id = auth.uid() AND is_active = true
    )
  );
CREATE POLICY "ejari_payment_proofs_tenant_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM public.tenant_accounts WHERE user_id = auth.uid() AND is_active = true
    )
  );
CREATE POLICY "ejari_payment_proofs_finance_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[])
  );
CREATE POLICY "ejari_payment_proofs_finance_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[])
  );
CREATE POLICY "ejari_payment_proofs_finance_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND public.has_any_role(auth.uid(), ARRAY['admin','manager','accountant']::public.app_role[])
  );
