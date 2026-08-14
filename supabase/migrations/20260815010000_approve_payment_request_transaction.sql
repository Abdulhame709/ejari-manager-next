-- EJARI: approve payment requests atomically.
-- All invoice updates, receipt creation, receipt details, and request status
-- changes succeed or roll back together.

CREATE OR REPLACE FUNCTION public.approve_payment_request(p_payment_request_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.payment_requests%ROWTYPE;
  v_customer_id UUID;
  v_receipt_id UUID;
  v_receipt_no TEXT;
  v_prefix TEXT;
  v_next_seq INTEGER;
  v_reviewer UUID := auth.uid();
  v_remaining NUMERIC(18,2);
  v_apply NUMERIC(18,2);
  v_new_paid NUMERIC(18,2);
  v_new_remaining NUMERIC(18,2);
  v_invoice RECORD;
BEGIN
  IF v_reviewer IS NULL OR NOT public.can_manage(v_reviewer) THEN
    RAISE EXCEPTION 'غير مصرح باعتماد طلبات الدفع';
  END IF;

  SELECT *
    INTO v_request
    FROM public.payment_requests
   WHERE id = p_payment_request_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب الدفع غير موجود';
  END IF;

  IF v_request.status <> 'pending_review' THEN
    RAISE EXCEPTION 'لا يمكن اعتماد طلب بحالة %', v_request.status;
  END IF;

  IF v_request.tenant_account_id IS NULL THEN
    RAISE EXCEPTION 'طلب الدفع لا يحتوي على حساب مستأجر';
  END IF;

  SELECT customer_id
    INTO v_customer_id
    FROM public.tenant_accounts
   WHERE id = v_request.tenant_account_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد عميل مرتبط بحساب المستأجر';
  END IF;

  v_remaining := round(v_request.amount::numeric, 2);
  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'مبلغ طلب الدفع يجب أن يكون أكبر من صفر';
  END IF;

  -- Serialize receipt numbers per month to prevent duplicate numbers under concurrency.
  v_prefix := 'RCP-' || to_char(current_date, 'YYYYMM') || '-';
  PERFORM pg_advisory_xact_lock(hashtext(v_prefix));

  SELECT COALESCE(
           MAX(NULLIF(substring(receipt_no FROM '([0-9]+)$'), '')::INTEGER),
           0
         ) + 1
    INTO v_next_seq
    FROM public.receipts
   WHERE receipt_no LIKE v_prefix || '%';

  v_receipt_no := v_prefix || lpad(v_next_seq::TEXT, 4, '0');

  INSERT INTO public.receipts (
    receipt_no,
    receipt_date,
    customer_id,
    amount,
    payment_method,
    reference_no,
    bank_name,
    transfer_ref,
    is_active,
    status,
    notes,
    created_by
  )
  VALUES (
    v_receipt_no,
    current_date,
    v_customer_id,
    v_request.amount,
    CASE
      WHEN v_request.method = 'cheque' THEN 'check'
      ELSE COALESCE(NULLIF(v_request.method, ''), 'transfer')
    END::public.payment_method,
    v_request.reference_no,
    v_request.bank_name,
    v_request.reference_no,
    true,
    'posted',
    format('اعتماد طلب دفع %s', p_payment_request_id),
    v_reviewer
  )
  RETURNING id INTO v_receipt_id;

  -- Allocate against the oldest unpaid invoices for this customer.
  FOR v_invoice IN
    SELECT id, total_amount, paid_amount, remaining_amount
      FROM public.invoices
     WHERE customer_id = v_customer_id
       AND payment_status <> 'paid'
       AND remaining_amount > 0
       AND (v_request.invoice_id IS NULL OR id = v_request.invoice_id)
     ORDER BY invoice_year, invoice_month, invoice_date, created_at, id
     FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_apply := round(least(v_remaining, v_invoice.remaining_amount)::numeric, 2);
    v_new_paid := round(coalesce(v_invoice.paid_amount, 0) + v_apply, 2);
    v_new_remaining := round(greatest(0, v_invoice.total_amount - v_new_paid), 2);

    UPDATE public.invoices
       SET paid_amount = v_new_paid,
           remaining_amount = v_new_remaining,
           payment_status = CASE
             WHEN v_new_remaining <= 0.01 THEN 'paid'::public.payment_status
             WHEN v_new_paid > 0 THEN 'partial'::public.payment_status
             ELSE 'unpaid'::public.payment_status
           END,
           updated_at = now()
     WHERE id = v_invoice.id;

    INSERT INTO public.receipt_details (receipt_id, invoice_id, amount_paid)
    VALUES (v_receipt_id, v_invoice.id, v_apply);

    v_remaining := round(v_remaining - v_apply, 2);
  END LOOP;

  IF v_remaining > 0.01 THEN
    RAISE EXCEPTION 'مبلغ الطلب يتجاوز إجمالي المبالغ المستحقة بمقدار %', v_remaining;
  END IF;

  UPDATE public.payment_requests
     SET status = 'approved',
         reviewed_at = now(),
         reviewer_id = v_reviewer,
         receipt_id = v_receipt_id,
         updated_at = now()
   WHERE id = p_payment_request_id
     AND status = 'pending_review';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'تعذر تحديث حالة طلب الدفع';
  END IF;

  INSERT INTO public.audit_log (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    user_id,
    user_name
  )
  VALUES (
    'payment_requests',
    p_payment_request_id::TEXT,
    'approve_payment',
    jsonb_build_object('status', 'pending_review'),
    jsonb_build_object('status', 'approved', 'receipt_id', v_receipt_id),
    v_reviewer,
    COALESCE(auth.jwt()->>'email', v_reviewer::TEXT)
  );

  RETURN v_receipt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_payment_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_payment_request(UUID) TO authenticated;
