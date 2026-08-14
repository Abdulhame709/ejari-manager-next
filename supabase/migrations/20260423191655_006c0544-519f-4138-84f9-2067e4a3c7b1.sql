
-- ============================================================
-- 1. ENUMS & CORE TYPES
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'accountant', 'data_entry', 'viewer');
CREATE TYPE public.meter_category AS ENUM ('electricity', 'water');
CREATE TYPE public.contract_status AS ENUM ('active', 'expired', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid', 'partial');
CREATE TYPE public.payment_method AS ENUM ('cash', 'check', 'transfer');

-- ============================================================
-- 2. PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. USER ROLES (separate table — security best practice)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Security definer function for role checks (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'manager' THEN 2
    WHEN 'accountant' THEN 3
    WHEN 'data_entry' THEN 4
    WHEN 'viewer' THEN 5
  END
  LIMIT 1
$$;

-- Helper: can the user write/manage data?
CREATE OR REPLACE FUNCTION public.can_manage(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'manager', 'accountant', 'data_entry')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_delete(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'manager')
  )
$$;

-- ============================================================
-- 4. SHOPS
-- ============================================================
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_code TEXT NOT NULL UNIQUE,
  shop_name TEXT NOT NULL,
  description TEXT,
  area NUMERIC(10,2),
  elec_meter_type INT NOT NULL DEFAULT 1,
  elec_meter_no TEXT,
  fixed_elec_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  water_meter_type INT NOT NULL DEFAULT 5,
  water_meter_no TEXT,
  fixed_water_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shops_active ON public.shops(is_active);
CREATE INDEX idx_shops_code ON public.shops(shop_code);

-- ============================================================
-- 5. CUSTOMERS
-- ============================================================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  id_number TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_active ON public.customers(is_active);
CREATE INDEX idx_customers_phone ON public.customers(phone);

-- ============================================================
-- 6. CONTRACTS
-- ============================================================
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_no TEXT NOT NULL UNIQUE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monthly_rent NUMERIC(18,2) NOT NULL,
  holiday_increase NUMERIC(18,2) NOT NULL DEFAULT 0,
  status public.contract_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_shop ON public.contracts(shop_id, status);
CREATE INDEX idx_contracts_customer ON public.contracts(customer_id);
CREATE INDEX idx_contracts_status ON public.contracts(status);

-- ============================================================
-- 7. METER TYPES
-- ============================================================
CREATE TABLE public.meter_types (
  id INT PRIMARY KEY,
  type_name TEXT NOT NULL,
  category public.meter_category NOT NULL,
  price_per_unit NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_fixed_fee BOOLEAN NOT NULL DEFAULT false,
  fixed_fee_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO public.meter_types (id, type_name, category, price_per_unit, is_fixed_fee, fixed_fee_amount) VALUES
  (1, 'ثلاثي الطور', 'electricity', 400, false, 0),
  (2, 'عادي', 'electricity', 300, false, 0),
  (3, 'بدون عداد', 'electricity', 0, true, 300),
  (4, 'مقطوعية', 'electricity', 0, true, 0),
  (5, 'عادي', 'water', 1500, false, 0),
  (6, 'بدون عداد', 'water', 0, true, 300),
  (7, 'مقطوعية', 'water', 0, true, 0);

-- ============================================================
-- 8. METER READINGS
-- ============================================================
CREATE TABLE public.meter_readings (
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
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, reading_month, reading_year)
);

CREATE INDEX idx_readings_shop_period ON public.meter_readings(shop_id, reading_year, reading_month);

-- ============================================================
-- 9. INVOICES
-- ============================================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT NOT NULL UNIQUE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
  invoice_month INT NOT NULL CHECK (invoice_month BETWEEN 1 AND 12),
  invoice_year INT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  rent_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  holiday_increase NUMERIC(18,2) NOT NULL DEFAULT 0,
  elec_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  water_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  previous_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  additional_charges NUMERIC(18,2) NOT NULL DEFAULT 0,
  additional_charges_desc TEXT,
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
  paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, invoice_month, invoice_year)
);

CREATE INDEX idx_invoices_period ON public.invoices(invoice_year, invoice_month);
CREATE INDEX idx_invoices_customer ON public.invoices(customer_id, payment_status);
CREATE INDEX idx_invoices_shop ON public.invoices(shop_id);
CREATE INDEX idx_invoices_status ON public.invoices(payment_status);

-- ============================================================
-- 10. RECEIPTS
-- ============================================================
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no TEXT NOT NULL UNIQUE,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  check_number TEXT,
  check_date DATE,
  bank_name TEXT,
  transfer_ref TEXT,
  notes TEXT,
  received_by TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_receipts_customer ON public.receipts(customer_id, receipt_date DESC);
CREATE INDEX idx_receipts_date ON public.receipts(receipt_date DESC);

-- ============================================================
-- 11. RECEIPT DETAILS
-- ============================================================
CREATE TABLE public.receipt_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  amount_paid NUMERIC(18,2) NOT NULL CHECK (amount_paid > 0)
);

CREATE INDEX idx_receipt_details_receipt ON public.receipt_details(receipt_id);
CREATE INDEX idx_receipt_details_invoice ON public.receipt_details(invoice_id);

-- ============================================================
-- 12. ADDITIONAL CHARGES
-- ============================================================
CREATE TABLE public.additional_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  charge_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(18,2) NOT NULL,
  description TEXT,
  is_applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 13. SETTINGS (single row)
-- ============================================================
CREATE TABLE public.settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  elec_price_3phase NUMERIC(18,2) NOT NULL DEFAULT 400,
  elec_price_normal NUMERIC(18,2) NOT NULL DEFAULT 300,
  fixed_elec_fee NUMERIC(18,2) NOT NULL DEFAULT 300,
  water_price_per_unit NUMERIC(18,2) NOT NULL DEFAULT 1500,
  fixed_water_fee NUMERIC(18,2) NOT NULL DEFAULT 300,
  currency TEXT NOT NULL DEFAULT 'YER',
  currency_symbol TEXT NOT NULL DEFAULT 'ريال',
  company_name TEXT NOT NULL DEFAULT 'شركتي للإيجارات',
  company_phone TEXT,
  company_address TEXT,
  company_logo TEXT,
  invoice_title TEXT NOT NULL DEFAULT 'فاتورة إيجار',
  invoice_subtitle TEXT,
  invoice_footer TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.settings (id) VALUES (1);

-- ============================================================
-- 14. AUDIT LOG
-- ============================================================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  action_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_table ON public.audit_log(table_name, action_date DESC);
CREATE INDEX idx_audit_user ON public.audit_log(user_id, action_date DESC);

-- ============================================================
-- 15. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone'
  );

  -- First user becomes admin automatically
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 16. UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_shops_updated BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 17. ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
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

-- ============================================================
-- 18. RLS POLICIES
-- ============================================================

-- PROFILES
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins manage all profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- USER_ROLES
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- SHOPS
CREATE POLICY "Authenticated view shops" ON public.shops FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers insert shops" ON public.shops FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Managers update shops" ON public.shops FOR UPDATE TO authenticated USING (public.can_manage(auth.uid()));
CREATE POLICY "Admins delete shops" ON public.shops FOR DELETE TO authenticated USING (public.can_delete(auth.uid()));

-- CUSTOMERS
CREATE POLICY "Authenticated view customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Managers update customers" ON public.customers FOR UPDATE TO authenticated USING (public.can_manage(auth.uid()));
CREATE POLICY "Admins delete customers" ON public.customers FOR DELETE TO authenticated USING (public.can_delete(auth.uid()));

-- CONTRACTS
CREATE POLICY "Authenticated view contracts" ON public.contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers insert contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Managers update contracts" ON public.contracts FOR UPDATE TO authenticated USING (public.can_manage(auth.uid()));
CREATE POLICY "Admins delete contracts" ON public.contracts FOR DELETE TO authenticated USING (public.can_delete(auth.uid()));

-- METER TYPES
CREATE POLICY "Authenticated view meter types" ON public.meter_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage meter types" ON public.meter_types FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- METER READINGS
CREATE POLICY "Authenticated view readings" ON public.meter_readings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers insert readings" ON public.meter_readings FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Managers update readings" ON public.meter_readings FOR UPDATE TO authenticated USING (public.can_manage(auth.uid()));
CREATE POLICY "Admins delete readings" ON public.meter_readings FOR DELETE TO authenticated USING (public.can_delete(auth.uid()));

-- INVOICES
CREATE POLICY "Authenticated view invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Accountants insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Accountants update invoices" ON public.invoices FOR UPDATE TO authenticated USING (public.can_manage(auth.uid()));
CREATE POLICY "Admins delete invoices" ON public.invoices FOR DELETE TO authenticated USING (public.can_delete(auth.uid()));

-- RECEIPTS
CREATE POLICY "Authenticated view receipts" ON public.receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Accountants insert receipts" ON public.receipts FOR INSERT TO authenticated WITH CHECK (public.can_manage(auth.uid()));
CREATE POLICY "Accountants update receipts" ON public.receipts FOR UPDATE TO authenticated USING (public.can_manage(auth.uid()));
CREATE POLICY "Admins delete receipts" ON public.receipts FOR DELETE TO authenticated USING (public.can_delete(auth.uid()));

-- RECEIPT DETAILS
CREATE POLICY "Authenticated view receipt details" ON public.receipt_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "Accountants manage receipt details" ON public.receipt_details FOR ALL TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- ADDITIONAL CHARGES
CREATE POLICY "Authenticated view charges" ON public.additional_charges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers manage charges" ON public.additional_charges FOR ALL TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

-- SETTINGS
CREATE POLICY "Authenticated view settings" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- AUDIT LOG
CREATE POLICY "Admins view audit log" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "System inserts audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);
