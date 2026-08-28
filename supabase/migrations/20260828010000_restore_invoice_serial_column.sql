-- EJARI — استعادة توافق مخطط الفواتير مع إجراء الإنشاء المركزي.
-- الإجراء generate_monthly_invoices يخصص رقماً تسلسلياً داخل كل شهر
-- ويكتب القيمة في invoice_number_serial. كان العمود مفقوداً في الإنتاج
-- رغم وجود الإجراء، مما جعل PostgREST يعيد 400 ويوقف العملية بالكامل.
-- هذا الترحيل لا يغير أي فاتورة قائمة ولا ينشئ بيانات جديدة.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_number_serial INTEGER;

COMMENT ON COLUMN public.invoices.invoice_number_serial IS
  'تسلسل الفاتورة ضمن شهر وسنة الفاتورة؛ يملؤه generate_monthly_invoices للفواتير الجديدة.';
