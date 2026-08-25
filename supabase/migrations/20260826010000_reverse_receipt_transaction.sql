-- Reverse a posted receipt atomically.
-- The original receipt remains visible for audit purposes and is marked cancelled.
-- Invoice balances are restored in the same transaction, and a linked reversal record is created.

CREATE OR REPLACE FUNCTION public.reverse_receipt(
  p_receipt_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_receipt public.receipts%ROWTYPE;
  v_reversal_id UUID;
  v_reversal_no TEXT;
  v_prefix TEXT;
  v_next_seq INTEGER;
  v_invoice RECORD;
  v_new_paid NUMERIC(18, 2);
  v_new_remaining NUMERIC(18, 2);
  v_reason TEXT := NULLIF(trim(COALESCE(p_reason, '')), '');
BEGIN
  IF v_actor IS NULL OR NOT public.can_delete(v_actor) THEN
    RAISE EXCEPTION 'غير مصرح بعكس سندات القبض';
  END IF;

  SELECT *
    INTO v_receipt
    FROM public.receipts
   WHERE id = p_receipt_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'سند القبض غير موجود';
  END IF;

  IF v_receipt.status <> 'posted' OR NOT v_receipt.is_active THEN
    RAISE EXCEPTION 'لا يمكن عكس سند بحالة %', v_receipt.status;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.receipts
     WHERE reversal_of = v_receipt.id
       AND status = 'reversal'
  ) THEN
    RAISE EXCEPTION 'تم عكس هذا السند مسبقاً';
  END IF;

  -- Lock and restore each linked invoice balance before changing receipt state.
  FOR v_invoice IN
    SELECT i.id, i.total_amount, i.paid_amount, rd.amount_paid
      FROM public.receipt_details rd
      JOIN public.invoices i ON i.id = rd.invoice_id
     WHERE rd.receipt_id = v_receipt.id
     FOR UPDATE OF i
  LOOP
    v_new_paid := round(greatest(0, coalesce(v_invoice.paid_amount, 0) - v_invoice.amount_paid)::numeric, 2);
    v_new_remaining := round(greatest(0, v_invoice.total_amount - v_new_paid)::numeric, 2);

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
  END LOOP;

  -- Serialize reversal numbering within the month.
  v_prefix := 'RVR-' || to_char(current_date, 'YYYYMM') || '-';
  PERFORM pg_advisory_xact_lock(hashtext(v_prefix));

  SELECT COALESCE(
           MAX(NULLIF(substring(receipt_no FROM '([0-9]+)$'), '')::INTEGER),
           0
         ) + 1
    INTO v_next_seq
    FROM public.receipts
   WHERE receipt_no LIKE v_prefix || '%';

  v_reversal_no := v_prefix || lpad(v_next_seq::TEXT, 4, '0');

  INSERT INTO public.receipts (
    receipt_no,
    receipt_date,
    customer_id,
    amount,
    payment_method,
    reference_no,
    bank_name,
    check_number,
    cheque_no,
    check_date,
    cheque_date,
    transfer_ref,
    is_active,
    status,
    reversal_of,
    notes,
    created_by
  )
  VALUES (
    v_reversal_no,
    current_date,
    v_receipt.customer_id,
    v_receipt.amount,
    v_receipt.payment_method,
    v_receipt.reference_no,
    v_receipt.bank_name,
    v_receipt.check_number,
    v_receipt.cheque_no,
    v_receipt.check_date,
    v_receipt.cheque_date,
    v_receipt.transfer_ref,
    true,
    'reversal',
    v_receipt.id,
    concat(
      'عكس للسند ', v_receipt.receipt_no,
      CASE WHEN v_reason IS NOT NULL THEN ': ' || v_reason ELSE '' END
    ),
    v_actor
  )
  RETURNING id INTO v_reversal_id;

  UPDATE public.receipts
     SET status = 'cancelled',
         notes = concat(
           coalesce(notes || E'\n', ''),
           'تم عكس السند برقم ', v_reversal_no,
           CASE WHEN v_reason IS NOT NULL THEN ': ' || v_reason ELSE '' END
         )
   WHERE id = v_receipt.id;

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
    'receipts',
    v_receipt.id::TEXT,
    'reverse_receipt',
    jsonb_build_object(
      'receipt_no', v_receipt.receipt_no,
      'status', 'posted',
      'amount', v_receipt.amount
    ),
    jsonb_build_object(
      'status', 'cancelled',
      'reversal_receipt_id', v_reversal_id,
      'reversal_receipt_no', v_reversal_no,
      'reason', v_reason
    ),
    v_actor,
    COALESCE(auth.jwt()->>'email', v_actor::TEXT),
    now()
  );

  RETURN v_reversal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_receipt(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_receipt(UUID, TEXT) TO authenticated;
