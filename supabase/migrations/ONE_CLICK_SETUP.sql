-- ============================================================
--  إيجاري EJARI — إعداد كامل لقاعدة البيانات في استعلام واحد
--  ينشئ كل الجداول والأنواع والدوال والسياسات وحساب المدير الافتراضي
--  آمن لإعادة التشغيل (يستخدم IF NOT EXISTS في كل مكان)
--  بيانات المدير: admin@ejari.local / admin123
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========================
-- 1. ENUMS (الأنواع)
-- ========================
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'accountant', 'data_entry', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.meter_category AS ENUM ('electricity', 'water');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.contract_status AS ENUM ('active', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid', 'partial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_method AS ENUM ('cash', 'check', 'transfer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'deposit';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'wallet';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'cheque';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.unit_type AS ENUM ('shop', 'apartment', 'office', 'warehouse', 'land', 'clinic', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.unit_status AS ENUM ('available', 'rented', 'reserved', 'maintenance', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_request_status AS ENUM ('pending_review', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'draft';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'renewed';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;

-- ========================
-- 2. HELPER FUNCTIONS (دوال مساعدة)
-- ========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 WHEN 'accountant' THEN 3 WHEN 'data_entry' THEN 4 WHEN 'viewer' THEN 5 END LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_manage(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','manager','accountant','data_entry'));
$$;

CREATE OR REPLACE FUNCTION public.can_delete(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','manager'));
$$;

-- Trigger: عند تسجيل مستخدم جديد ينشئ بروفايل، وأول مستخدم يصبح مدير
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.raw_user_meta_data->>'phone');
  -- Demo mode: every newly registered account is an admin so visitors can
  -- explore the complete product without waiting for role assignment.
  -- Disable this behavior before production and grant viewer/tenant roles explicitly.
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================
-- 3. CORE TABLES (الجداول الأساسية)
-- ========================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL, phone TEXT, avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_code TEXT NOT NULL UNIQUE, shop_name TEXT NOT NULL, description TEXT,
  area NUMERIC(10,2), area_sqm NUMERIC(10,2),
  property_id UUID, unit_type public.unit_type NOT NULL DEFAULT 'shop',
  status public.unit_status NOT NULL DEFAULT 'available',
  floor INT, location_details TEXT,
  monthly_rent NUMERIC(18,2) NOT NULL DEFAULT 0,
  insurance_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT false,
  market_description TEXT, suitable_for TEXT, features JSONB DEFAULT '[]'::jsonb,
  elec_meter_type INT NOT NULL DEFAULT 1, elec_meter_no TEXT,
  fixed_elec_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  water_meter_type INT NOT NULL DEFAULT 5, water_meter_no TEXT,
  fixed_water_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_shops_updated ON public.shops;
CREATE TRIGGER trg_shops_updated BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_shops_active ON public.shops(is_active);
CREATE INDEX IF NOT EXISTS idx_shops_code ON public.shops(shop_code);
CREATE INDEX IF NOT EXISTS idx_shops_property ON public.shops(property_id);
CREATE INDEX IF NOT EXISTS idx_shops_status ON public.shops(status);
CREATE INDEX IF NOT EXISTS idx_shops_public ON public.shops(is_public, status);

CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL,
  description TEXT, address TEXT, city TEXT, phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_properties_updated ON public.properties;
CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_property_id_fkey;
ALTER TABLE public.shops ADD CONSTRAINT shops_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, id_number TEXT, address TEXT,
  activity TEXT, documents JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_customers_updated ON public.customers;
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_customers_active ON public.customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_no TEXT NOT NULL UNIQUE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL, end_date DATE NOT NULL,
  due_day INT DEFAULT 1, payment_method public.payment_method DEFAULT 'cash',
  monthly_rent NUMERIC(18,2) NOT NULL, holiday_increase NUMERIC(18,2) NOT NULL DEFAULT 0,
  insurance_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  contract_file_url TEXT,
  renewed_from_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  status public.contract_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_contracts_updated ON public.contracts;
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_contracts_shop ON public.contracts(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_customer ON public.contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);

CREATE TABLE IF NOT EXISTS public.meter_types (
  id INT PRIMARY KEY, type_name TEXT NOT NULL,
  category public.meter_category NOT NULL,
  price_per_unit NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_fixed_fee BOOLEAN NOT NULL DEFAULT false,
  fixed_fee_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO public.meter_types (id, type_name, category, price_per_unit, is_fixed_fee, fixed_fee_amount)
VALUES
  (1, 'ثلاثي الطور', 'electricity', 400, false, 0),
  (2, 'عادي', 'electricity', 300, false, 0),
  (3, 'بدون عداد', 'electricity', 0, true, 300),
  (4, 'مقطوعية', 'electricity', 0, true, 0),
  (5, 'عادي', 'water', 1500, false, 0),
  (6, 'بدون عداد', 'water', 0, true, 300),
  (7, 'مقطوعية', 'water', 0, true, 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.meter_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reading_month INT NOT NULL CHECK (reading_month BETWEEN 1 AND 12),
  reading_year INT NOT NULL CHECK (reading_year >= 2020),
  elec_current_reading NUMERIC(18,2) NOT NULL DEFAULT 0,
  elec_previous_reading NUMERIC(18,2) NOT NULL DEFAULT 0,
  elec_consumption NUMERIC(18,2) GENERATED ALWAYS AS (elec_current_reading - elec_previous_reading) STORED,
  water_current_reading NUMERIC(18,2) NOT NULL DEFAULT 0,
  water_previous_reading NUMERIC(18,2) NOT NULL DEFAULT 0,
  water_consumption NUMERIC(18,2) GENERATED ALWAYS AS (water_current_reading - water_previous_reading) STORED,
  notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, reading_month, reading_year)
);
CREATE INDEX IF NOT EXISTS idx_readings_shop_period ON public.meter_readings(shop_id, reading_year, reading_month);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT NOT NULL UNIQUE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
  invoice_month INT NOT NULL CHECK (invoice_month BETWEEN 1 AND 12),
  invoice_year INT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE, due_date DATE,
  rent_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  holiday_increase NUMERIC(18,2) NOT NULL DEFAULT 0,
  elec_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  water_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  previous_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  additional_charges NUMERIC(18,2) NOT NULL DEFAULT 0,
  additional_charges_desc TEXT,
  discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  elec_prev_reading NUMERIC(18,2) NOT NULL DEFAULT 0,
  elec_curr_reading NUMERIC(18,2) NOT NULL DEFAULT 0,
  elec_consumption NUMERIC(18,2) NOT NULL DEFAULT 0,
  elec_unit_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  water_prev_reading NUMERIC(18,2) NOT NULL DEFAULT 0,
  water_curr_reading NUMERIC(18,2) NOT NULL DEFAULT 0,
  water_consumption NUMERIC(18,2) NOT NULL DEFAULT 0,
  water_unit_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  status public.invoice_status NOT NULL DEFAULT 'issued',
  paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  invoice_number_serial INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, invoice_month, invoice_year)
);
DROP TRIGGER IF EXISTS trg_invoices_updated ON public.invoices;
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_invoices_period ON public.invoices(invoice_year, invoice_month);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_shop ON public.invoices(shop_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(payment_status);

CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no TEXT NOT NULL UNIQUE,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  check_number TEXT, cheque_no TEXT, check_date DATE, cheque_date DATE,
  bank_name TEXT, transfer_ref TEXT, reference_no TEXT,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','cancelled','reversal')),
  reversal_of UUID REFERENCES public.receipts(id) ON DELETE SET NULL,
  receipt_file_url TEXT,
  notes TEXT, received_by TEXT, is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_receipts_customer ON public.receipts(customer_id, receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON public.receipts(receipt_date DESC);

CREATE TABLE IF NOT EXISTS public.receipt_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  amount_paid NUMERIC(18,2) NOT NULL CHECK (amount_paid > 0)
);
CREATE INDEX IF NOT EXISTS idx_receipt_details_receipt ON public.receipt_details(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_details_invoice ON public.receipt_details(invoice_id);

CREATE TABLE IF NOT EXISTS public.additional_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  charge_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(18,2) NOT NULL,
  description TEXT, is_applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  elec_price_3phase NUMERIC(18,2) NOT NULL DEFAULT 400,
  elec_price_normal NUMERIC(18,2) NOT NULL DEFAULT 300,
  fixed_elec_fee NUMERIC(18,2) NOT NULL DEFAULT 300,
  water_price_per_unit NUMERIC(18,2) NOT NULL DEFAULT 1500,
  fixed_water_fee NUMERIC(18,2) NOT NULL DEFAULT 300,
  currency TEXT NOT NULL DEFAULT 'YER',
  currency_symbol TEXT NOT NULL DEFAULT 'ريال',
  company_name TEXT NOT NULL DEFAULT 'شركتي للإيجارات',
  company_phone TEXT, company_address TEXT, company_logo TEXT,
  invoice_title TEXT NOT NULL DEFAULT 'فاتورة إيجار',
  invoice_subtitle TEXT, invoice_footer TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL, record_id TEXT, action TEXT NOT NULL,
  old_values JSONB, new_values JSONB,
  old_data JSONB, new_data JSONB,
  user_id UUID REFERENCES auth.users(id), user_name TEXT,
  action_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_table ON public.audit_log(table_name, action_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_log(user_id, action_date DESC);

CREATE TABLE IF NOT EXISTS public.unit_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_cover BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_unit_images_shop ON public.unit_images(shop_id, display_order);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT NOT NULL, account_name TEXT NOT NULL,
  account_number TEXT, iban TEXT, wallet_phone TEXT, branch TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_bank_accounts_updated ON public.bank_accounts;
CREATE TRIGGER trg_bank_accounts_updated BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.viewing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  visitor_name TEXT NOT NULL, visitor_phone TEXT NOT NULL,
  visitor_email TEXT, preferred_date TEXT, notes TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','viewed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_viewing_shop ON public.viewing_requests(shop_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.tenant_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_accounts_user ON public.tenant_accounts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_accounts_customer ON public.tenant_accounts(customer_id);

CREATE TABLE IF NOT EXISTS public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_account_id UUID, invoice_id UUID,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'transfer' CHECK (method IN ('transfer','cash','cheque','deposit','wallet')),
  reference_no TEXT, bank_name TEXT, receipt_path TEXT, attachment_path TEXT,
  status public.payment_request_status NOT NULL DEFAULT 'pending_review',
  rejection_reason TEXT, reviewer_id UUID, reviewed_at TIMESTAMPTZ,
  receipt_id UUID REFERENCES public.receipts(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pr_status ON public.payment_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pr_tenant ON public.payment_requests(tenant_account_id, created_at DESC);
DROP TRIGGER IF EXISTS trg_payment_requests_updated ON public.payment_requests;
CREATE TRIGGER trg_payment_requests_updated BEFORE UPDATE ON public.payment_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

-- ========================
-- 4. STORAGE BUCKETS
-- ========================
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts','contracts',false), ('receipts','receipts',false),
       ('unit-images','unit-images',true), ('payment-proofs','payment-proofs',false)
ON CONFLICT (id) DO NOTHING;

-- ========================
-- 5. RLS ENABLE + POLICIES
-- ========================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.additional_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_request_invoices ENABLE ROW LEVEL SECURITY;

-- Drop old policies to avoid duplicates
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT polname, relname FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
           WHERE nspname='public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.polname, r.relname);
  END LOOP;
END $$;

-- Profiles
CREATE POLICY profiles_self ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid()=id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()=id);
CREATE POLICY profiles_admin_all ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- User roles
CREATE POLICY ur_self ON public.user_roles FOR SELECT TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY ur_admin ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Shops
CREATE POLICY shops_anon ON public.shops FOR SELECT TO anon USING (is_public=true AND status='available' AND is_active=true);
CREATE POLICY shops_staff ON public.shops FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY shops_tenant ON public.shops FOR SELECT TO authenticated USING (
  id IN (SELECT c.shop_id FROM public.contracts c JOIN public.tenant_accounts ta ON ta.customer_id=c.customer_id
         WHERE ta.user_id=auth.uid() AND c.status='active'));

-- Properties
CREATE POLICY props_staff ON public.properties FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY props_view ON public.properties FOR SELECT TO authenticated USING (true);

-- Customers
CREATE POLICY cust_staff ON public.customers FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY cust_tenant ON public.customers FOR SELECT TO authenticated
  USING (id IN (SELECT customer_id FROM public.tenant_accounts WHERE user_id=auth.uid()));

-- Contracts
CREATE POLICY con_staff ON public.contracts FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY con_tenant ON public.contracts FOR SELECT TO authenticated
  USING (customer_id IN (SELECT customer_id FROM public.tenant_accounts WHERE user_id=auth.uid()));

-- Meter types
CREATE POLICY mt_view ON public.meter_types FOR SELECT TO authenticated USING (true);
CREATE POLICY mt_anon ON public.meter_types FOR SELECT TO anon USING (true);
CREATE POLICY mt_manage ON public.meter_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Meter readings
CREATE POLICY rdg_staff ON public.meter_readings FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY rdg_tenant ON public.meter_readings FOR SELECT TO authenticated USING (
  shop_id IN (SELECT c.shop_id FROM public.contracts c JOIN public.tenant_accounts ta ON ta.customer_id=c.customer_id
              WHERE ta.user_id=auth.uid() AND c.status='active'));

-- Invoices
CREATE POLICY inv_staff ON public.invoices FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY inv_tenant ON public.invoices FOR SELECT TO authenticated
  USING (customer_id IN (SELECT customer_id FROM public.tenant_accounts WHERE user_id=auth.uid()));

-- Receipts
CREATE POLICY rcp_staff ON public.receipts FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY rcp_tenant ON public.receipts FOR SELECT TO authenticated
  USING (customer_id IN (SELECT customer_id FROM public.tenant_accounts WHERE user_id=auth.uid()));

-- Receipt details
CREATE POLICY rd_staff ON public.receipt_details FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY rd_tenant ON public.receipt_details FOR SELECT TO authenticated USING (
  receipt_id IN (SELECT r.id FROM public.receipts r
                 WHERE r.customer_id IN (SELECT customer_id FROM public.tenant_accounts WHERE user_id=auth.uid())));

-- Additional charges
CREATE POLICY chg_staff ON public.additional_charges FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- Settings
CREATE POLICY set_view ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY set_anon ON public.settings FOR SELECT TO anon USING (true);
CREATE POLICY set_manage ON public.settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Audit log
CREATE POLICY al_view ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY al_insert ON public.audit_log FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());

-- Unit images
CREATE POLICY ui_public ON public.unit_images FOR SELECT TO anon USING (true);
CREATE POLICY ui_auth ON public.unit_images FOR SELECT TO authenticated USING (true);
CREATE POLICY ui_staff ON public.unit_images FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- Bank accounts
CREATE POLICY ba_view ON public.bank_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY ba_manage ON public.bank_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Viewing requests
CREATE POLICY vr_anon ON public.viewing_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY vr_auth ON public.viewing_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY vr_staff ON public.viewing_requests FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- Tenant accounts
CREATE POLICY ta_read ON public.tenant_accounts FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.can_manage(auth.uid()));
CREATE POLICY ta_update ON public.tenant_accounts FOR UPDATE TO authenticated
  USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
CREATE POLICY ta_staff ON public.tenant_accounts FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- Payment requests
CREATE POLICY pr_read ON public.payment_requests FOR SELECT TO authenticated USING (
  tenant_account_id IN (SELECT id FROM public.tenant_accounts WHERE user_id=auth.uid())
  OR public.can_manage(auth.uid()));
CREATE POLICY pr_insert ON public.payment_requests FOR INSERT TO authenticated WITH CHECK (
  tenant_account_id IN (SELECT id FROM public.tenant_accounts WHERE user_id=auth.uid())
  AND status='pending_review');
CREATE POLICY pr_cancel ON public.payment_requests FOR UPDATE TO authenticated USING (
  tenant_account_id IN (SELECT id FROM public.tenant_accounts WHERE user_id=auth.uid()) AND status='pending_review')
  WITH CHECK (tenant_account_id IN (SELECT id FROM public.tenant_accounts WHERE user_id=auth.uid()) AND status='cancelled');
CREATE POLICY pr_staff ON public.payment_requests FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- Payment request invoices
CREATE POLICY pri_read ON public.payment_request_invoices FOR SELECT TO authenticated USING (
  payment_request_id IN (SELECT pr.id FROM public.payment_requests pr JOIN public.tenant_accounts ta ON ta.id=pr.tenant_account_id
                         WHERE ta.user_id=auth.uid()) OR public.can_manage(auth.uid()));
CREATE POLICY pri_insert ON public.payment_request_invoices FOR INSERT TO authenticated WITH CHECK (
  payment_request_id IN (SELECT pr.id FROM public.payment_requests pr JOIN public.tenant_accounts ta ON ta.id=pr.tenant_account_id
                         WHERE ta.user_id=auth.uid() AND pr.status='pending_review'));
CREATE POLICY pri_staff ON public.payment_request_invoices FOR ALL TO authenticated
  USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- ========================
-- 6. STORAGE POLICIES
-- ========================
DROP POLICY IF EXISTS "unit_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "unit_images_staff_write" ON storage.objects;
DROP POLICY IF EXISTS "unit_images_staff_update" ON storage.objects;
DROP POLICY IF EXISTS "unit_images_staff_delete" ON storage.objects;
DROP POLICY IF EXISTS "contracts_staff_all" ON storage.objects;
DROP POLICY IF EXISTS "contracts_tenant_read" ON storage.objects;
DROP POLICY IF EXISTS "receipts_staff_all" ON storage.objects;
DROP POLICY IF EXISTS "pp_tenant_upload" ON storage.objects;
DROP POLICY IF EXISTS "pp_staff_all" ON storage.objects;
DROP POLICY IF EXISTS "pp_tenant_read_own" ON storage.objects;

CREATE POLICY "ui_public_read" ON storage.objects FOR SELECT USING (bucket_id='unit-images');
CREATE POLICY "ui_staff_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='unit-images' AND public.can_manage(auth.uid()));
CREATE POLICY "ui_staff_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='unit-images' AND public.can_manage(auth.uid()));
CREATE POLICY "ui_staff_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='unit-images' AND public.can_manage(auth.uid()));

CREATE POLICY "con_staff_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id='contracts' AND public.can_manage(auth.uid()))
  WITH CHECK (bucket_id='contracts' AND public.can_manage(auth.uid()));
CREATE POLICY "con_tenant_read" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='contracts' AND split_part(name,'/',1) IN (
    SELECT c.id::text FROM public.contracts c JOIN public.tenant_accounts ta ON ta.customer_id=c.customer_id
    WHERE ta.user_id=auth.uid()));

CREATE POLICY "rec_staff_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id='receipts' AND public.can_manage(auth.uid()))
  WITH CHECK (bucket_id='receipts' AND public.can_manage(auth.uid()));

CREATE POLICY "pp_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='payment-proofs' AND split_part(name,'/',1) IN (
    SELECT ta.id::text FROM public.tenant_accounts ta WHERE ta.user_id=auth.uid()));
CREATE POLICY "pp_staff_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id='payment-proofs' AND public.can_manage(auth.uid()))
  WITH CHECK (bucket_id='payment-proofs' AND public.can_manage(auth.uid()));
CREATE POLICY "pp_read_own" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='payment-proofs' AND split_part(name,'/',1) IN (
    SELECT ta.id::text FROM public.tenant_accounts ta WHERE ta.user_id=auth.uid()));

-- Helper for tenant customer id
CREATE OR REPLACE FUNCTION public.current_tenant_customer_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT customer_id FROM public.tenant_accounts WHERE user_id=auth.uid() LIMIT 1;
$$;

-- ========================
-- 7. DEFAULT ADMIN ACCOUNT
-- ========================
DO $$
DECLARE v_uid UUID; v_enc TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email='admin@ejari.local') THEN
    v_enc := crypt('admin123', gen_salt('bf', 10));
    INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','admin@ejari.local',v_enc,now(),
      '{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"مدير النظام"}'::jsonb,now(),now(),false)
    RETURNING id INTO v_uid;
  END IF;
END $$;

SELECT '✅ تم إعداد قاعدة البيانات بنجاح — حساب المدير: admin@ejari.local / admin123' AS result;
