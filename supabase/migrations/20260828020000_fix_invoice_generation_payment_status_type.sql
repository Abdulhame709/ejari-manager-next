-- EJARI — إصلاح نوع payment_status في إجراء إنشاء الفواتير.
-- تعبير CASE يعيد text افتراضياً، بينما العمود هو public.payment_status.
-- يجبر التحويل الصريح على النوع الصحيح دون تغيير منطق الحساب أو الوصول.

CREATE OR REPLACE FUNCTION public.generate_monthly_invoices(
  p_month INTEGER,
  p_year INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reviewer UUID := auth.uid();
  v_contract RECORD;
  v_reading RECORD;
  v_elec_type RECORD;
  v_water_type RECORD;
  v_prev_balance NUMERIC(18,2);
  v_elec_consumption NUMERIC(18,2);
  v_water_consumption NUMERIC(18,2);
  v_elec_amount NUMERIC(18,2);
  v_water_amount NUMERIC(18,2);
  v_elec_price NUMERIC(18,2);
  v_water_price NUMERIC(18,2);
  v_total NUMERIC(18,2);
  v_invoice_no TEXT;
  v_serial INTEGER;
  v_created INTEGER := 0;
  v_skipped INTEGER := 0;
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  IF v_reviewer IS NULL OR NOT public.can_manage(v_reviewer) THEN
    RAISE EXCEPTION 'غير مصرح بإنشاء الفواتير';
  END IF;
  IF p_month IS NULL OR p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'الشهر غير صحيح';
  END IF;
  IF p_year IS NULL OR p_year < 2020 OR p_year > 2100 THEN
    RAISE EXCEPTION 'السنة غير صحيحة';
  END IF;

  v_period_start := make_date(p_year, p_month, 1);
  v_period_end := (v_period_start + INTERVAL '1 month - 1 day')::DATE;

  PERFORM pg_advisory_xact_lock(hashtext(format('ejari-invoice-generation:%s-%s', p_year, p_month)));

  SELECT COALESCE(MAX(invoice_number_serial), 0) + 1
    INTO v_serial
    FROM public.invoices
   WHERE invoice_year = p_year AND invoice_month = p_month;

  FOR v_contract IN
    SELECT
      c.id AS contract_id,
      c.shop_id,
      c.customer_id,
      c.monthly_rent,
      c.holiday_increase,
      s.elec_meter_type,
      s.fixed_elec_amount,
      s.water_meter_type,
      s.fixed_water_amount
    FROM public.contracts c
    JOIN public.shops s ON s.id = c.shop_id
   WHERE c.status = 'active'
     AND c.start_date <= v_period_end
     AND c.end_date >= v_period_start
     AND s.is_active = true
   ORDER BY c.shop_id, c.id
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.invoices i
       WHERE i.shop_id = v_contract.shop_id
         AND i.invoice_month = p_month
         AND i.invoice_year = p_year
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT *
      INTO v_reading
      FROM public.meter_readings r
     WHERE r.shop_id = v_contract.shop_id
       AND r.reading_month = p_month
       AND r.reading_year = p_year;

    SELECT * INTO v_elec_type FROM public.meter_types WHERE id = v_contract.elec_meter_type AND is_active = true;
    SELECT * INTO v_water_type FROM public.meter_types WHERE id = v_contract.water_meter_type AND is_active = true;

    v_elec_consumption := GREATEST(0, COALESCE(v_reading.elec_current_reading, 0) - COALESCE(v_reading.elec_previous_reading, 0));
    v_water_consumption := GREATEST(0, COALESCE(v_reading.water_current_reading, 0) - COALESCE(v_reading.water_previous_reading, 0));
    v_elec_price := CASE WHEN COALESCE(v_elec_type.is_fixed_fee, false) THEN 0 ELSE COALESCE(v_elec_type.price_per_unit, 0) END;
    v_water_price := CASE WHEN COALESCE(v_water_type.is_fixed_fee, false) THEN 0 ELSE COALESCE(v_water_type.price_per_unit, 0) END;
    v_elec_amount := CASE
      WHEN v_elec_type.id IS NULL THEN 0
      WHEN v_elec_type.is_fixed_fee THEN GREATEST(0, COALESCE(NULLIF(v_contract.fixed_elec_amount, 0), v_elec_type.fixed_fee_amount, 0))
      ELSE ROUND(v_elec_consumption * v_elec_price, 2)
    END;
    v_water_amount := CASE
      WHEN v_water_type.id IS NULL THEN 0
      WHEN v_water_type.is_fixed_fee THEN GREATEST(0, COALESCE(NULLIF(v_contract.fixed_water_amount, 0), v_water_type.fixed_fee_amount, 0))
      ELSE ROUND(v_water_consumption * v_water_price, 2)
    END;

    SELECT COALESCE(SUM(GREATEST(0, i.remaining_amount)), 0)
      INTO v_prev_balance
      FROM public.invoices i
     WHERE i.shop_id = v_contract.shop_id
       AND i.payment_status <> 'paid'
       AND (i.invoice_year < p_year OR (i.invoice_year = p_year AND i.invoice_month < p_month));

    v_total := ROUND(
      COALESCE(v_contract.monthly_rent, 0)
      + COALESCE(v_contract.holiday_increase, 0)
      + v_elec_amount
      + v_water_amount
      + COALESCE(v_prev_balance, 0), 2
    );

    v_invoice_no := format('INV-%s%s-%s', p_year, lpad(p_month::TEXT, 2, '0'), lpad(v_serial::TEXT, 4, '0'));
    INSERT INTO public.invoices (
      invoice_no, shop_id, customer_id, contract_id,
      invoice_month, invoice_year, invoice_date, due_date,
      rent_amount, holiday_increase, elec_amount, water_amount,
      previous_balance, additional_charges, discount_amount, tax_amount,
      total_amount, elec_prev_reading, elec_curr_reading, elec_consumption, elec_unit_price,
      water_prev_reading, water_curr_reading, water_consumption, water_unit_price,
      payment_status, status, paid_amount, remaining_amount, invoice_number_serial, notes
    ) VALUES (
      v_invoice_no, v_contract.shop_id, v_contract.customer_id, v_contract.contract_id,
      p_month, p_year, CURRENT_DATE, make_date(p_year, p_month, 10),
      COALESCE(v_contract.monthly_rent, 0), COALESCE(v_contract.holiday_increase, 0), v_elec_amount, v_water_amount,
      COALESCE(v_prev_balance, 0), 0, 0, 0,
      v_total,
      COALESCE(v_reading.elec_previous_reading, 0), COALESCE(v_reading.elec_current_reading, 0), v_elec_consumption, v_elec_price,
      COALESCE(v_reading.water_previous_reading, 0), COALESCE(v_reading.water_current_reading, 0), v_water_consumption, v_water_price,
      CASE
        WHEN v_total > 0 THEN 'unpaid'::public.payment_status
        ELSE 'paid'::public.payment_status
      END,
      'issued', 0, v_total, v_serial,
      format('تم الإنشاء مركزياً للفترة %s-%s', p_year, lpad(p_month::TEXT, 2, '0'))
    );
    v_serial := v_serial + 1;
    v_created := v_created + 1;
  END LOOP;

  INSERT INTO public.audit_log (table_name, record_id, action, new_values, user_id, user_name, created_at)
  VALUES (
    'invoices', format('%s-%s', p_year, p_month), 'generate_monthly_invoices',
    jsonb_build_object('month', p_month, 'year', p_year, 'created', v_created, 'skipped', v_skipped),
    v_reviewer, COALESCE(auth.jwt()->>'email', v_reviewer::TEXT), now()
  );

  RETURN jsonb_build_object('created', v_created, 'skipped', v_skipped, 'month', p_month, 'year', p_year);
END;
$$;

REVOKE ALL ON FUNCTION public.generate_monthly_invoices(INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_monthly_invoices(INTEGER, INTEGER) TO authenticated;
