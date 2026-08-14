-- ربط المستأجر وقاعدة البيانات
CREATE TABLE IF NOT EXISTS tenant_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_account_id UUID REFERENCES tenant_accounts(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(16,2) NOT NULL DEFAULT 0,
  method VARCHAR(20) DEFAULT 'transfer' CHECK (method IN ('transfer','cash','cheque','deposit')),
  reference_no VARCHAR(100),
  bank_name VARCHAR(100),
  receipt_path VARCHAR(500),
  status VARCHAR(20) DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected')),
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_type VARCHAR(20);
-- سياسات RLS صارمة للمستأجر
ALTER TABLE tenant_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_read_own ON tenant_accounts FOR SELECT USING (auth.uid() = user_id);
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_read_own_requests ON payment_requests FOR SELECT USING (auth.uid() = tenant_account_id);
