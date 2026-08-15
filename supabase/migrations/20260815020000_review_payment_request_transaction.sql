-- EJARI: atomic rejection workflow for payment requests.

CREATE OR REPLACE FUNCTION public.reject_payment_request(
  p_payment_request_id UUID,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reviewer UUID := auth.uid();
  v_old public.payment_requests%ROWTYPE;
  v_reason TEXT := NULLIF(left(trim(coalesce(p_rejection_reason, '')), 1000), '');
BEGIN
  IF v_reviewer IS NULL OR NOT public.can_manage(v_reviewer) THEN
    RAISE EXCEPTION 'غير مصرح برفض طلبات الدفع';
  END IF;

  SELECT *
    INTO v_old
    FROM public.payment_requests
   WHERE id = p_payment_request_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب الدفع غير موجود';
  END IF;

  IF v_old.status <> 'pending_review' THEN
    RAISE EXCEPTION 'لا يمكن رفض طلب بحالة %', v_old.status;
  END IF;

  UPDATE public.payment_requests
     SET status = 'rejected',
         rejection_reason = v_reason,
         reviewed_at = now(),
         reviewer_id = v_reviewer,
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
    user_name,
    created_at
  )
  VALUES (
    'payment_requests',
    p_payment_request_id::TEXT,
    'reject_payment',
    jsonb_build_object('status', v_old.status),
    jsonb_build_object('status', 'rejected', 'rejection_reason', v_reason),
    v_reviewer,
    coalesce(auth.jwt()->>'email', v_reviewer::TEXT),
    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reject_payment_request(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_payment_request(UUID, TEXT) TO authenticated;
