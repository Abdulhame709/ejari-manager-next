-- EJARI security hardening
-- Fixes private payment-proof uploads for the current client flow.
-- The client uploads before creating the payment request, so the object is
-- scoped to the tenant_account folder rather than a request that does not
-- exist yet. The bucket remains private; staff use signed URLs.

DROP POLICY IF EXISTS "pp_tenant_upload" ON storage.objects;
DROP POLICY IF EXISTS "pp_tenant_read_own" ON storage.objects;
DROP POLICY IF EXISTS "pp_upload" ON storage.objects;
DROP POLICY IF EXISTS "pp_read_own" ON storage.objects;

CREATE POLICY "ejari_payment_proof_tenant_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND split_part(name, '/', 1) IN (
      SELECT ta.id::text
      FROM public.tenant_accounts ta
      WHERE ta.user_id = auth.uid()
    )
  );

CREATE POLICY "ejari_payment_proof_tenant_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND split_part(name, '/', 1) IN (
      SELECT ta.id::text
      FROM public.tenant_accounts ta
      WHERE ta.user_id = auth.uid()
    )
  );

-- Prevent a tenant from submitting a payment request for another tenant's
-- invoice. The application also validates this, but RLS must be the final
-- authority because the browser talks directly to Supabase.
DROP POLICY IF EXISTS "tenant_insert_requests" ON public.payment_requests;
DROP POLICY IF EXISTS "pr_insert" ON public.payment_requests;

CREATE POLICY "ejari_tenant_insert_payment_request"
  ON public.payment_requests FOR INSERT TO authenticated
  WITH CHECK (
    tenant_account_id IN (
      SELECT ta.id FROM public.tenant_accounts ta WHERE ta.user_id = auth.uid()
    )
    AND status = 'pending_review'
    AND (
      invoice_id IS NULL
      OR invoice_id IN (
        SELECT i.id
        FROM public.invoices i
        JOIN public.tenant_accounts ta ON ta.customer_id = i.customer_id
        WHERE ta.user_id = auth.uid()
      )
    )
  );
