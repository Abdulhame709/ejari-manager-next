-- ============================================================
-- EJARI — Production hardening: performance indexes
-- Safe & idempotent (IF NOT EXISTS everywhere). Append-only.
-- Covers query paths used by dashboard, reports, and portals.
-- ============================================================

-- Expiring-contracts report filters on status + end_date range.
CREATE INDEX IF NOT EXISTS idx_contracts_end_date
  ON public.contracts (end_date)
  WHERE status = 'active';

-- Invoice due-date lookups (overdue detection, tenant portal).
CREATE INDEX IF NOT EXISTS idx_invoices_due_date
  ON public.invoices (due_date)
  WHERE payment_status <> 'paid';

-- Customer statement: invoices by customer ordered by date.
CREATE INDEX IF NOT EXISTS idx_invoices_customer_date
  ON public.invoices (customer_id, invoice_date);

-- Receipts by customer ordered by date (statement + tenant portal).
CREATE INDEX IF NOT EXISTS idx_receipts_customer_date
  ON public.receipts (customer_id, receipt_date);

-- Receipt numbering: prefix scan `LIKE 'RCP-YYYYMM-%'` sorted desc.
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_no
  ON public.receipts (receipt_no text_pattern_ops);

-- Invoice numbering prefix scan.
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_no
  ON public.invoices (invoice_no text_pattern_ops);

-- Audit log is queried newest-first.
CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON public.audit_log (created_at DESC);

-- Payment requests review queue is newest-first per status.
CREATE INDEX IF NOT EXISTS idx_payment_requests_status_created
  ON public.payment_requests (status, created_at DESC);

-- Viewing requests admin triage.
CREATE INDEX IF NOT EXISTS idx_viewing_requests_status_created
  ON public.viewing_requests (status, created_at DESC);

-- Bank accounts are always listed active-first by display order.
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active_order
  ON public.bank_accounts (display_order)
  WHERE is_active = true;

-- ============================================================
-- ANALYZE the hot tables so the planner picks the new indexes.
-- ============================================================
ANALYZE public.contracts;
ANALYZE public.invoices;
ANALYZE public.receipts;
ANALYZE public.payment_requests;
