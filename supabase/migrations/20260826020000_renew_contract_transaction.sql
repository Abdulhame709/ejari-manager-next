-- Renew a contract without overwriting its historical commercial terms.
-- The source contract is retained with status `renewed` and the successor references it.

CREATE OR REPLACE FUNCTION public.renew_contract(
  p_contract_id UUID,
  p_contract_no TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_monthly_rent NUMERIC,
  p_holiday_increase NUMERIC DEFAULT NULL,
  p_due_day INTEGER DEFAULT NULL,
  p_payment_method public.payment_method DEFAULT NULL,
  p_insurance_amount NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_source public.contracts%ROWTYPE;
  v_new_contract_id UUID;
  v_contract_no TEXT := trim(COALESCE(p_contract_no, ''));
BEGIN
  IF v_actor IS NULL OR NOT public.can_delete(v_actor) THEN
    RAISE EXCEPTION 'غير مصرح بتجديد العقود';
  END IF;

  IF v_contract_no = '' THEN
    RAISE EXCEPTION 'رقم العقد الجديد مطلوب';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RAISE EXCEPTION 'فترة العقد الجديد غير صالحة';
  END IF;

  IF COALESCE(p_monthly_rent, 0) < 0 THEN
    RAISE EXCEPTION 'الإيجار الشهري لا يمكن أن يكون سالباً';
  END IF;

  SELECT *
    INTO v_source
    FROM public.contracts
   WHERE id = p_contract_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'العقد المراد تجديده غير موجود';
  END IF;

  IF v_source.status NOT IN ('active', 'expired') THEN
    RAISE EXCEPTION 'لا يمكن تجديد عقد بحالة %', v_source.status;
  END IF;

  IF p_start_date <= v_source.end_date THEN
    RAISE EXCEPTION 'يجب أن يبدأ العقد الجديد بعد تاريخ نهاية العقد السابق';
  END IF;

  IF EXISTS (SELECT 1 FROM public.contracts WHERE contract_no = v_contract_no) THEN
    RAISE EXCEPTION 'رقم العقد الجديد مستخدم مسبقاً';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.contracts c
     WHERE c.shop_id = v_source.shop_id
       AND c.id <> v_source.id
       AND c.status = 'active'
       AND daterange(c.start_date, c.end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
  ) THEN
    RAISE EXCEPTION 'يوجد عقد ساري متداخل لهذه الوحدة ضمن الفترة الجديدة';
  END IF;

  INSERT INTO public.contracts (
    contract_no,
    shop_id,
    customer_id,
    start_date,
    end_date,
    due_day,
    payment_method,
    monthly_rent,
    holiday_increase,
    insurance_amount,
    contract_file_url,
    renewed_from_id,
    status,
    notes
  )
  VALUES (
    v_contract_no,
    v_source.shop_id,
    v_source.customer_id,
    p_start_date,
    p_end_date,
    COALESCE(p_due_day, v_source.due_day),
    COALESCE(p_payment_method, v_source.payment_method),
    COALESCE(p_monthly_rent, v_source.monthly_rent),
    COALESCE(p_holiday_increase, v_source.holiday_increase),
    COALESCE(p_insurance_amount, v_source.insurance_amount),
    NULL,
    v_source.id,
    'active',
    NULLIF(trim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_new_contract_id;

  UPDATE public.contracts
     SET status = 'renewed',
         updated_at = now()
   WHERE id = v_source.id;

  INSERT INTO public.audit_log (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    user_id,
    user_name,
    created_at
  )
  VALUES (
    'contracts',
    v_source.id::TEXT,
    'renew_contract',
    jsonb_build_object(
      'contract_no', v_source.contract_no,
      'status', v_source.status,
      'end_date', v_source.end_date
    ),
    jsonb_build_object(
      'status', 'renewed',
      'renewed_contract_id', v_new_contract_id,
      'renewed_contract_no', v_contract_no,
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    v_actor,
    COALESCE(auth.jwt()->>'email', v_actor::TEXT),
    now()
  );

  RETURN v_new_contract_id;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_contract(
  UUID, TEXT, DATE, DATE, NUMERIC, NUMERIC, INTEGER, public.payment_method, NUMERIC, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_contract(
  UUID, TEXT, DATE, DATE, NUMERIC, NUMERIC, INTEGER, public.payment_method, NUMERIC, TEXT
) TO authenticated;
