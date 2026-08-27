-- EJARI — الأداء: تجميع إحصاءات لوحة التحكم داخل قاعدة البيانات.
-- تعيد الدالة قيماً مجمعة فقط للمستخدمين العاملين ولا تعدل أي بيانات.

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  p_month INTEGER,
  p_year INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_month_start DATE;
  v_month_end DATE;
  v_today DATE := CURRENT_DATE;
  v_expiring_end DATE := CURRENT_DATE + 30;
BEGIN
  IF auth.uid() IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.is_active = true
     )
     OR NOT EXISTS (
       SELECT 1
       FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role IN ('admin', 'manager', 'accountant', 'data_entry', 'viewer')
     ) THEN
    RAISE EXCEPTION 'غير مصرح بعرض إحصاءات لوحة التحكم';
  END IF;

  IF p_month IS NULL OR p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'الشهر غير صحيح';
  END IF;

  IF p_year IS NULL OR p_year < 2020 OR p_year > 2100 THEN
    RAISE EXCEPTION 'السنة غير صحيحة';
  END IF;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + INTERVAL '1 month')::DATE;

  RETURN (
    WITH shop_stats AS (
      SELECT
        COUNT(*)::INTEGER AS total_shops,
        COUNT(*) FILTER (WHERE is_active)::INTEGER AS active_shops
      FROM public.shops
    ),
    contract_stats AS (
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')::INTEGER AS active_contracts,
        COUNT(*) FILTER (
          WHERE status = 'active'
            AND end_date >= v_today
            AND end_date <= v_expiring_end
        )::INTEGER AS expiring_contracts
      FROM public.contracts
    ),
    customer_stats AS (
      SELECT COUNT(*) FILTER (WHERE is_active)::INTEGER AS total_customers
      FROM public.customers
    ),
    invoice_stats AS (
      SELECT
        COUNT(*) FILTER (
          WHERE invoice_month = p_month
            AND invoice_year = p_year
            AND status <> 'cancelled'
        )::INTEGER AS this_month_invoices,
        COALESCE(SUM(total_amount) FILTER (
          WHERE invoice_month = p_month
            AND invoice_year = p_year
            AND status <> 'cancelled'
        ), 0)::NUMERIC AS this_month_revenue,
        COALESCE(SUM(remaining_amount) FILTER (
          WHERE payment_status IN ('unpaid', 'partial')
            AND status <> 'cancelled'
        ), 0)::NUMERIC AS total_unpaid,
        COUNT(*) FILTER (
          WHERE payment_status IN ('unpaid', 'partial')
            AND status <> 'cancelled'
        )::INTEGER AS unpaid_invoices_count,
        COUNT(*) FILTER (
          WHERE payment_status = 'paid'
            AND status <> 'cancelled'
        )::INTEGER AS paid_invoices_count
      FROM public.invoices
    ),
    receipt_stats AS (
      SELECT COALESCE(SUM(amount), 0)::NUMERIC AS this_month_collected
      FROM public.receipts
      WHERE receipt_date >= v_month_start
        AND receipt_date < v_month_end
        AND is_active = true
        AND status = 'posted'
    ),
    reading_stats AS (
      SELECT COUNT(*)::INTEGER AS missing_readings
      FROM public.shops s
      WHERE s.is_active = true
        AND NOT EXISTS (
          SELECT 1
          FROM public.meter_readings mr
          WHERE mr.shop_id = s.id
            AND mr.reading_month = p_month
            AND mr.reading_year = p_year
        )
    )
    SELECT jsonb_build_object(
      'total_shops', shop_stats.total_shops,
      'active_shops', shop_stats.active_shops,
      'total_customers', customer_stats.total_customers,
      'active_contracts', contract_stats.active_contracts,
      'this_month_invoices', invoice_stats.this_month_invoices,
      'this_month_revenue', invoice_stats.this_month_revenue,
      'this_month_collected', receipt_stats.this_month_collected,
      'total_unpaid', invoice_stats.total_unpaid,
      'unpaid_invoices_count', invoice_stats.unpaid_invoices_count,
      'paid_invoices_count', invoice_stats.paid_invoices_count,
      'expiring_contracts', contract_stats.expiring_contracts,
      'missing_readings', reading_stats.missing_readings
    )
    FROM shop_stats, contract_stats, customer_stats, invoice_stats, receipt_stats, reading_stats
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats(INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(INTEGER, INTEGER) TO authenticated;
