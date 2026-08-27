-- EJARI — الأداء: فهارس مسارات القراءة والمفاتيح الخارجية
-- نطاق الترحيل: إضافة فهارس فقط وANALYZE. لا يغير البيانات أو RLS أو الصلاحيات.
-- آمن لإعادة التنفيذ بسبب IF NOT EXISTS.

-- مسارات لوحة التحكم والتقارير والفوترة.
CREATE INDEX IF NOT EXISTS idx_contracts_active_end_date
  ON public.contracts (end_date)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_invoices_due_unpaid
  ON public.invoices (due_date)
  WHERE payment_status <> 'paid';

CREATE INDEX IF NOT EXISTS idx_invoices_customer_invoice_date
  ON public.invoices (customer_id, invoice_date);

CREATE INDEX IF NOT EXISTS idx_receipts_customer_receipt_date
  ON public.receipts (customer_id, receipt_date);

CREATE INDEX IF NOT EXISTS idx_invoices_invoice_no_pattern
  ON public.invoices (invoice_no text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_receipts_receipt_no_pattern
  ON public.receipts (receipt_no text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at_desc
  ON public.audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_requests_status_created_at_desc
  ON public.payment_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_viewing_requests_status_created_at_desc
  ON public.viewing_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_active_display_order
  ON public.bank_accounts (display_order)
  WHERE is_active = true;

-- مفاتيح خارجية كشف عنها مستشار الأداء في Supabase. تؤثر في joins
-- وفحوصات سلامة العلاقات عند نمو الجداول أو حذف/أرشفة السجلات.
CREATE INDEX IF NOT EXISTS idx_account_requests_auth_user_id
  ON public.account_requests (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_account_requests_customer_id
  ON public.account_requests (customer_id);
CREATE INDEX IF NOT EXISTS idx_account_requests_reviewed_by
  ON public.account_requests (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_additional_charges_contract_id
  ON public.additional_charges (contract_id);
CREATE INDEX IF NOT EXISTS idx_additional_charges_shop_id
  ON public.additional_charges (shop_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id
  ON public.audit_log (user_id);

CREATE INDEX IF NOT EXISTS idx_contracts_customer_id
  ON public.contracts (customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_renewed_from_id
  ON public.contracts (renewed_from_id);
CREATE INDEX IF NOT EXISTS idx_contracts_shop_id
  ON public.contracts (shop_id);

CREATE INDEX IF NOT EXISTS idx_invoices_contract_id
  ON public.invoices (contract_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id
  ON public.invoices (customer_id);

CREATE INDEX IF NOT EXISTS idx_payment_request_invoices_invoice_id
  ON public.payment_request_invoices (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_receipt_id
  ON public.payment_requests (receipt_id);

CREATE INDEX IF NOT EXISTS idx_receipt_details_invoice_id
  ON public.receipt_details (invoice_id);
CREATE INDEX IF NOT EXISTS idx_receipt_details_receipt_id
  ON public.receipt_details (receipt_id);

CREATE INDEX IF NOT EXISTS idx_receipts_created_by
  ON public.receipts (created_by);
CREATE INDEX IF NOT EXISTS idx_receipts_customer_id
  ON public.receipts (customer_id);
CREATE INDEX IF NOT EXISTS idx_receipts_reversal_of
  ON public.receipts (reversal_of);

CREATE INDEX IF NOT EXISTS idx_shops_property_id
  ON public.shops (property_id);
CREATE INDEX IF NOT EXISTS idx_tenant_accounts_customer_id
  ON public.tenant_accounts (customer_id);
CREATE INDEX IF NOT EXISTS idx_unit_images_shop_id
  ON public.unit_images (shop_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_granted_by
  ON public.user_permissions (granted_by);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_shop_id
  ON public.viewing_requests (shop_id);

-- تحديث إحصاءات المخطط بعد إضافة الفهارس حتى يختار PostgreSQL خططاً مناسبة.
ANALYZE public.account_requests;
ANALYZE public.additional_charges;
ANALYZE public.audit_log;
ANALYZE public.contracts;
ANALYZE public.invoices;
ANALYZE public.payment_request_invoices;
ANALYZE public.payment_requests;
ANALYZE public.receipt_details;
ANALYZE public.receipts;
ANALYZE public.shops;
ANALYZE public.tenant_accounts;
ANALYZE public.unit_images;
ANALYZE public.user_permissions;
ANALYZE public.viewing_requests;
