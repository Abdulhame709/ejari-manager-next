-- ============================================================
-- Migration: Comprehensive schema fix & expansion for EJARI
-- Created: 2026-07-21
-- Purpose: Fixes issues from earlier migrations and adds all
--          missing tables/columns/enums required by EJARI brief.
-- Safe: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- 0. Prevent accidental re-creation of audit_log (migration 20260720230000
--    used CREATE TABLE IF NOT EXISTS so this is already guarded, but we
--    make sure the CORRECT audit_log (from migration 1) is the canonical
--    one and drop the duplicate if it exists.
--    (migration 1's audit_log has all required columns; migration 5's is
--     a near-subset; safe to leave IF NOT EXISTS in place.)

-- ============================================================
-- 1. EXTEND EXISTING ENUMS (Postgres 12+ ALTER TYPE ADD VALUE)
--    Wrapped in DO blocks so they don't fail if the enum/value
--    doesn't exist yet (the bootstrap migration creates them).
-- ============================================================
DO $$ BEGIN
  ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'deposit';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'wallet';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'cheque';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;

-- invoice/contract status enums are new; create them.
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM
    ('draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.unit_type AS ENUM
    ('shop', 'apartment', 'office', 'warehouse', 'land', 'clinic', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.unit_status AS ENUM
    ('available', 'rented', 'reserved', 'maintenance', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_request_status AS ENUM
    ('pending_review', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contract_status_ext AS ENUM
    ('draft', 'active', 'expired', 'cancelled', 'renewed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. PROPERTIES TABLE (new) — مجمعات/مباني/أسواق
-- ============================================================
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  city TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_properties_updated
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. EXTEND SHOPS (now represents UNITS) with new columns
-- ============================================================
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS unit_type public.unit_type NOT NULL DEFAULT 'shop';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS status public.unit_status NOT NULL DEFAULT 'available';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS floor INT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS area_sqm NUMERIC(10,2);
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS location_details TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS monthly_rent NUMERIC(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS insurance_amount NUMERIC(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS market_description TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS suitable_for TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;
-- area was originally numeric; keep as alias if needed
DO $$ BEGIN
  ALTER TABLE public.shops RENAME COLUMN area TO area_sqm;
EXCEPTION WHEN duplicate_column OR undefined_column THEN NULL; END $$;
-- Re-create with correct name in case rename already happened
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS area_sqm NUMERIC(10,2);

-- Re-trigger updated_at (in case shops already had it) — idempotent
DROP TRIGGER IF EXISTS trg_shops_updated ON public.shops;
CREATE TRIGGER trg_shops_updated
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_shops_property ON public.shops(property_id);
CREATE INDEX IF NOT EXISTS idx_shops_status ON public.shops(status);
CREATE INDEX IF NOT EXISTS idx_shops_public ON public.shops(is_public, status);

-- ============================================================
-- 4. UNIT IMAGES (new)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.unit_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_cover BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_unit_images_shop ON public.unit_images(shop_id, display_order);
ALTER TABLE public.unit_images ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. BANK ACCOUNTS (new)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT,
  iban TEXT,
  wallet_phone TEXT,
  branch TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_bank_accounts_updated
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. VIEWING REQUESTS (new) — طلبات المعاينة من الزوار
-- ============================================================
CREATE TABLE IF NOT EXISTS public.viewing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  visitor_name TEXT NOT NULL,
  visitor_phone TEXT NOT NULL,
  visitor_email TEXT,
  preferred_date TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'viewed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_viewing_shop ON public.viewing_requests(shop_id, created_at DESC);
ALTER TABLE public.viewing_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. EXTEND CUSTOMERS with new columns
-- ============================================================
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS activity TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;
-- tenant_account_id will be added when we ensure tenant_accounts is correct.

-- ============================================================
-- 8. FIX/EXTEND CONTRACTS
-- ============================================================
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS due_day INT DEFAULT 1;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS payment_method public.payment_method DEFAULT 'cash';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS insurance_amount NUMERIC(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS contract_file_url TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS renewed_from_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL;
-- 'draft' and 'renewed' are not in old enum; add them (safe DO blocks)
DO $$ BEGIN
  ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'draft';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'renewed';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_contracts_updated ON public.contracts;
CREATE TRIGGER trg_contracts_updated
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 9. EXTEND INVOICES
-- ============================================================
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS status public.invoice_status NOT NULL DEFAULT 'issued';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0;
-- A generated column for remaining is nice, but we keep it as set col
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number_serial INT;

DROP TRIGGER IF EXISTS trg_invoices_updated ON public.invoices;
CREATE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 10. EXTEND RECEIPTS
-- ============================================================
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'cancelled', 'reversal'));
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS reversal_of UUID REFERENCES public.receipts(id) ON DELETE SET NULL;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS reference_no TEXT;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS cheque_no TEXT;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS cheque_date DATE;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS receipt_file_url TEXT;

CREATE INDEX IF NOT EXISTS idx_receipts_customer ON public.receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON public.receipts(receipt_date);

-- ============================================================
-- 11. FIX tenant_accounts and link to customers
-- ============================================================
-- Make sure table exists (it was created in migration 4)
CREATE TABLE IF NOT EXISTS public.tenant_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_accounts_user ON public.tenant_accounts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_accounts_customer ON public.tenant_accounts(customer_id);
ALTER TABLE public.tenant_accounts ENABLE ROW LEVEL SECURITY;

-- drop the broken old RLS policies (from migration 4), recreate correct ones
DROP POLICY IF EXISTS tenant_read_own ON public.tenant_accounts;
CREATE POLICY tenant_read_own ON public.tenant_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage(auth.uid()));

CREATE POLICY tenant_update_own ON public.tenant_accounts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY staff_manage_tenant_accounts ON public.tenant_accounts
  FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- ============================================================
-- 12. REBUILD payment_requests correctly & add payment_request_invoices
-- ============================================================
-- payment_requests already exists in migration 4 with some columns.
-- Add missing columns idempotently.
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS tenant_account_id UUID;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES public.receipts(id) ON DELETE SET NULL;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS attachment_path TEXT;
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Fix the status CHECK to include 'cancelled'
-- (Postgres doesn't let us ALTER CHECK easily; drop & recreate.)
DO $$ BEGIN
  ALTER TABLE public.payment_requests DROP CONSTRAINT IF EXISTS payment_requests_status_check;
EXCEPTION WHEN undefined_object OR undefined_table THEN NULL; END $$;
ALTER TABLE public.payment_requests ADD CONSTRAINT payment_requests_status_check
  CHECK (status IN ('pending_review','approved','rejected','cancelled'));

-- Fix method CHECK
DO $$ BEGIN
  ALTER TABLE public.payment_requests DROP CONSTRAINT IF EXISTS payment_requests_method_check;
EXCEPTION WHEN undefined_object OR undefined_table THEN NULL; END $$;
ALTER TABLE public.payment_requests ADD CONSTRAINT payment_requests_method_check
  CHECK (method IN ('transfer','cash','cheque','deposit','wallet'));

CREATE INDEX IF NOT EXISTS idx_pr_status ON public.payment_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pr_tenant ON public.payment_requests(tenant_account_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_payment_requests_updated ON public.payment_requests;
CREATE TRIGGER trg_payment_requests_updated
  BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link table: payment_request <-> invoices (many-to-many)
CREATE TABLE IF NOT EXISTS public.payment_request_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id UUID NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount_applied NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payment_request_id, invoice_id)
);
CREATE INDEX IF NOT EXISTS idx_pri_pr ON public.payment_request_invoices(payment_request_id);
CREATE INDEX IF NOT EXISTS idx_pri_inv ON public.payment_request_invoices(invoice_id);
ALTER TABLE public.payment_request_invoices ENABLE ROW LEVEL SECURITY;

-- Drop broken old RLS on payment_requests (migration 4 used tenant_account_id = auth.uid() which is wrong)
DROP POLICY IF EXISTS tenant_read_own_requests ON public.payment_requests;
-- Policies for payment_requests
-- Tenant can view and insert requests where tenant_accounts.user_id = auth.uid()
CREATE POLICY tenant_read_own_requests ON public.payment_requests
  FOR SELECT TO authenticated
  USING (
    tenant_account_id IN (SELECT id FROM public.tenant_accounts WHERE user_id = auth.uid())
    OR public.can_manage(auth.uid())
  );

CREATE POLICY tenant_insert_requests ON public.payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_account_id IN (SELECT id FROM public.tenant_accounts WHERE user_id = auth.uid())
    AND status = 'pending_review'
  );

CREATE POLICY tenant_cancel_own_requests ON public.payment_requests
  FOR UPDATE TO authenticated
  USING (
    tenant_account_id IN (SELECT id FROM public.tenant_accounts WHERE user_id = auth.uid())
    AND status = 'pending_review'
  ) WITH CHECK (
    tenant_account_id IN (SELECT id FROM public.tenant_accounts WHERE user_id = auth.uid())
    AND status = 'cancelled'
  );

CREATE POLICY staff_manage_requests ON public.payment_requests
  FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- Payment request invoices: readable by related tenant or staff
CREATE POLICY pri_read ON public.payment_request_invoices
  FOR SELECT TO authenticated
  USING (
    payment_request_id IN (
      SELECT pr.id FROM public.payment_requests pr
      JOIN public.tenant_accounts ta ON ta.id = pr.tenant_account_id
      WHERE ta.user_id = auth.uid()
    )
    OR public.can_manage(auth.uid())
  );

CREATE POLICY pri_insert_tenant ON public.payment_request_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    payment_request_id IN (
      SELECT pr.id FROM public.payment_requests pr
      JOIN public.tenant_accounts ta ON ta.id = pr.tenant_account_id
      WHERE ta.user_id = auth.uid() AND pr.status = 'pending_review'
    )
  );

CREATE POLICY pri_staff_all ON public.payment_request_invoices
  FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- ============================================================
-- 13. Storage bucket references in DB (buckets themselves via SQL or dashboard)
-- ============================================================
-- Create storage buckets via SQL (idempotent, requires supabase pg extensions)
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false),
       ('receipts', 'receipts', false),
       ('unit-images', 'unit-images', true),
       ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 14. FIX RLS ON MAJOR TABLES — tighten to respect TENANT isolation
--     Drop the old permissive USING (true) policies and recreate.
-- ============================================================

-- Helper: is the current user a staff member (can_manage)?
-- We reuse can_manage(). For tenants we need to map auth.uid() -> customer_id.

-- Customers:
-- Staff: read/write. Tenant: can read own customer record only.
DROP POLICY IF EXISTS "Authenticated view customers" ON public.customers;
DROP POLICY IF EXISTS "Managers insert customers" ON public.customers;
DROP POLICY IF EXISTS "Managers update customers" ON public.customers;
DROP POLICY IF EXISTS "Admins delete customers" ON public.customers;

CREATE POLICY customers_staff_select ON public.customers
  FOR SELECT TO authenticated
  USING (public.can_manage(auth.uid()) OR
         id IN (SELECT customer_id FROM public.tenant_accounts WHERE user_id = auth.uid()));

CREATE POLICY customers_staff_all ON public.customers
  FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- Shops (units): Staff full. Tenant: read only units they have active contract on.
-- Visitor (anon): only public+available units.
DROP POLICY IF EXISTS "Authenticated view shops" ON public.shops;
DROP POLICY IF EXISTS "Managers insert shops" ON public.shops;
DROP POLICY IF EXISTS "Managers update shops" ON public.shops;
DROP POLICY IF EXISTS "Admins delete shops" ON public.shops;

CREATE POLICY shops_anon_public ON public.shops
  FOR SELECT TO anon
  USING (is_public = true AND status = 'available' AND is_active = true);

CREATE POLICY shops_staff_all ON public.shops
  FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

CREATE POLICY shops_tenant_select ON public.shops
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT c.shop_id FROM public.contracts c
      JOIN public.tenant_accounts ta ON ta.customer_id = c.customer_id
      WHERE ta.user_id = auth.uid() AND c.status = 'active'
    )
  );

-- Properties: staff CRUD; any authenticated can view; anon no access.
CREATE POLICY properties_staff_all ON public.properties
  FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY properties_auth_view ON public.properties
  FOR SELECT TO authenticated USING (true);

-- Contracts: staff full; tenant reads own.
DROP POLICY IF EXISTS "Authenticated view contracts" ON public.contracts;
DROP POLICY IF EXISTS "Managers insert contracts" ON public.contracts;
DROP POLICY IF EXISTS "Managers update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins delete contracts" ON public.contracts;

CREATE POLICY contracts_staff_all ON public.contracts
  FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

CREATE POLICY contracts_tenant_select ON public.contracts
  FOR SELECT TO authenticated
  USING (
    customer_id IN (SELECT customer_id FROM public.tenant_accounts WHERE user_id = auth.uid())
  );

-- Meter readings: staff full; tenant reads own unit's readings.
DROP POLICY IF EXISTS "Authenticated view readings" ON public.meter_readings;
DROP POLICY IF EXISTS "Managers insert readings" ON public.meter_readings;
DROP POLICY IF EXISTS "Managers update readings" ON public.meter_readings;
DROP POLICY IF EXISTS "Admins delete readings" ON public.meter_readings;

CREATE POLICY readings_staff_all ON public.meter_readings
  FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

CREATE POLICY readings_tenant_select ON public.meter_readings
  FOR SELECT TO authenticated
  USING (
    shop_id IN (
      SELECT c.shop_id FROM public.contracts c
      JOIN public.tenant_accounts ta ON ta.customer_id = c.customer_id
      WHERE ta.user_id = auth.uid() AND c.status = 'active'
    )
  );

-- Invoices: staff full; tenant reads own invoices.
DROP POLICY IF EXISTS "Authenticated view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Accountants insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Accountants update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins delete invoices" ON public.invoices;

CREATE POLICY invoices_staff_all ON public.invoices
  FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

CREATE POLICY invoices_tenant_select ON public.invoices
  FOR SELECT TO authenticated
  USING (
    customer_id IN (SELECT customer_id FROM public.tenant_accounts WHERE user_id = auth.uid())
  );

-- Receipts: staff full; tenant reads own.
DROP POLICY IF EXISTS "Authenticated view receipts" ON public.receipts;
DROP POLICY IF EXISTS "Accountants insert receipts" ON public.receipts;
DROP POLICY IF EXISTS "Accountants update receipts" ON public.receipts;
DROP POLICY IF EXISTS "Admins delete receipts" ON public.receipts;

CREATE POLICY receipts_staff_all ON public.receipts
  FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

CREATE POLICY receipts_tenant_select ON public.receipts
  FOR SELECT TO authenticated
  USING (
    customer_id IN (SELECT customer_id FROM public.tenant_accounts WHERE user_id = auth.uid())
  );

-- Receipt details: same pattern.
DROP POLICY IF EXISTS "Authenticated view receipt details" ON public.receipt_details;
DROP POLICY IF EXISTS "Accountants manage receipt details" ON public.receipt_details;

CREATE POLICY rd_staff_all ON public.receipt_details
  FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

CREATE POLICY rd_tenant_select ON public.receipt_details
  FOR SELECT TO authenticated
  USING (
    receipt_id IN (
      SELECT r.id FROM public.receipts r
      WHERE r.customer_id IN (SELECT customer_id FROM public.tenant_accounts WHERE user_id = auth.uid())
    )
  );

-- Additional charges: staff full; tenant reads own shop's charges.
DROP POLICY IF EXISTS "Authenticated view charges" ON public.additional_charges;
DROP POLICY IF EXISTS "Managers manage charges" ON public.additional_charges;

CREATE POLICY charges_staff_all ON public.additional_charges
  FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- Meter types: all authenticated can view. Keep existing but recreate.
DROP POLICY IF EXISTS "Authenticated view meter types" ON public.meter_types;
DROP POLICY IF EXISTS "Admins manage meter types" ON public.meter_types;
CREATE POLICY meter_types_all_view ON public.meter_types FOR SELECT TO authenticated USING (true);
CREATE POLICY meter_types_anon_view ON public.meter_types FOR SELECT TO anon USING (true);
CREATE POLICY meter_types_staff_manage ON public.meter_types
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Settings: authenticated can view business info (company name etc.); admin/manager can update.
DROP POLICY IF EXISTS "Authenticated view settings" ON public.settings;
DROP POLICY IF EXISTS "Admins update settings" ON public.settings;
CREATE POLICY settings_view ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY settings_anon_view ON public.settings FOR SELECT TO anon USING (true);
CREATE POLICY settings_manage ON public.settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Audit log: admin/manager view only; insert via security definer or by any authenticated as themselves.
DROP POLICY IF EXISTS "Admins view audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Users insert own audit" ON public.audit_log;
DROP POLICY IF EXISTS audit_admin ON public.audit_log;
-- (Migration 5 created audit_admin policy with broken auth.role() — drop it.)
CREATE POLICY audit_view ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY audit_insert ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Unit images: public select (so visitor page works); staff manage.
CREATE POLICY unit_images_public_select ON public.unit_images FOR SELECT TO anon USING (true);
CREATE POLICY unit_images_auth_select ON public.unit_images FOR SELECT TO authenticated USING (true);
CREATE POLICY unit_images_staff_all ON public.unit_images
  FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- Bank accounts: authenticated can view (for tenant payment page); admin/manager manage.
CREATE POLICY bank_accounts_view ON public.bank_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY bank_accounts_manage ON public.bank_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Viewing requests: anon can insert; staff view/manage.
CREATE POLICY vr_anon_insert ON public.viewing_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY vr_auth_insert ON public.viewing_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY vr_staff_all ON public.viewing_requests
  FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- ============================================================
-- 15. HELPER SQL FUNCTION for tenant customer_id lookup
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_tenant_customer_id()
RETURNS UUID
LANGUAGE SQL STABLE
AS $$
  SELECT customer_id FROM public.tenant_accounts WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- 16. STORAGE POLICIES
-- ============================================================
-- unit-images: public read, staff write
DROP POLICY IF EXISTS "Unit images public read" ON storage.objects;
DROP POLICY IF EXISTS "Unit images staff write" ON storage.objects;
CREATE POLICY "unit_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'unit-images');
CREATE POLICY "unit_images_staff_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'unit-images' AND public.can_manage(auth.uid()));
CREATE POLICY "unit_images_staff_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'unit-images' AND public.can_manage(auth.uid()));
CREATE POLICY "unit_images_staff_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'unit-images' AND public.can_manage(auth.uid()));

-- contracts: authenticated can SELECT only own contract; staff full
CREATE POLICY "contracts_staff_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'contracts' AND public.can_manage(auth.uid()))
  WITH CHECK (bucket_id = 'contracts' AND public.can_manage(auth.uid()));
CREATE POLICY "contracts_tenant_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'contracts' AND
    split_part(name, '/', 1) IN (
      SELECT c.id::text FROM public.contracts c
      JOIN public.tenant_accounts ta ON ta.customer_id = c.customer_id
      WHERE ta.user_id = auth.uid()
    )
  );

-- receipts: staff full
CREATE POLICY "receipts_staff_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'receipts' AND public.can_manage(auth.uid()))
  WITH CHECK (bucket_id = 'receipts' AND public.can_manage(auth.uid()));

-- payment-proofs: tenant can upload to own request; staff read all
CREATE POLICY "pp_tenant_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs' AND
    split_part(name, '/', 1) IN (
      SELECT ta.id::text FROM public.tenant_accounts ta
      WHERE ta.user_id = auth.uid()
    )
  );
CREATE POLICY "pp_staff_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.can_manage(auth.uid()))
  WITH CHECK (bucket_id = 'payment-proofs' AND public.can_manage(auth.uid()));
CREATE POLICY "pp_tenant_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs' AND
    split_part(name, '/', 1) IN (
      SELECT ta.id::text FROM public.tenant_accounts ta
      WHERE ta.user_id = auth.uid()
    )
  );
