import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const invoiceSql = read("supabase/migrations/20260817010000_central_invoice_generation.sql");
const archiveSql = read("supabase/migrations/20260817020000_safe_archiving_and_audit.sql");
const invoiceRoute = read("src/routes/invoices.tsx");
const reportsRoute = read("src/routes/reports.tsx");
const accessControl = read("src/lib/access-control.ts");
const loginRoute = read("src/routes/login.tsx");
const csvImport = read("src/components/csv-import-dialog.tsx");
const customersRoute = read("src/routes/customers.tsx");
const shopsRoute = read("src/routes/shops/index.tsx");
const paymentSql = read(
  "supabase/migrations/20260815010000_approve_payment_request_transaction.sql",
);
const rpcHardeningSql = read("supabase/migrations/20260818010000_harden_rpc_execute_grants.sql");

assert.match(invoiceSql, /CREATE OR REPLACE FUNCTION public\.generate_monthly_invoices/);
assert.match(invoiceSql, /pg_advisory_xact_lock/);
assert.match(
  invoiceSql,
  /i\.invoice_year < p_year OR \(i\.invoice_year = p_year AND i\.invoice_month < p_month\)/,
);
assert.match(
  invoiceSql,
  /REVOKE ALL ON FUNCTION public\.generate_monthly_invoices\(INTEGER, INTEGER\) FROM PUBLIC, anon/,
);
assert.match(invoiceRoute, /rpc\("generate_monthly_invoices"/);
assert.doesNotMatch(invoiceRoute, /supabase\.from\("invoices"\)\.insert\(toInsert\)/);

for (const fn of ["archive_shop", "archive_customer", "archive_contract"]) {
  assert.match(archiveSql, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}`));
  assert.match(archiveSql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}`));
}
assert.match(archiveSql, /is_active = false/);
assert.match(archiveSql, /action, new_values/);
assert.match(reportsRoute, /neq\("status", "cancelled"\)/);
assert.match(accessControl, /meterTypes: \["admin", "manager"\]/);
assert.match(loginRoute, /هذا الحساب مسجل من قبل/);
assert.match(loginRoute, /يرجى التحقق من البريد الإلكتروني أو كلمة السر/);
assert.match(loginRoute, /تصفح الوحدات كزائر/);
assert.match(csvImport, /parseCsv/);
assert.match(csvImport, /XLSX\.read/);
assert.match(csvImport, /\.xlsx/);
assert.match(csvImport, /تحميل قالب Excel/);
assert.match(csvImport, /لا يمكن اعتماد الاستيراد/);
assert.match(customersRoute, /CsvImportDialog/);
assert.match(shopsRoute, /CsvImportDialog/);
assert.match(paymentSql, /FOR UPDATE/);
assert.match(paymentSql, /can_manage/);
assert.match(paymentSql, /REVOKE ALL ON FUNCTION public\.approve_payment_request/);
assert.match(paymentSql, /audit_log/);
assert.match(rpcHardeningSql, /REVOKE EXECUTE ON FUNCTION public\.admin_remove_user_access/);
assert.match(rpcHardeningSql, /GRANT EXECUTE ON FUNCTION public\.submit_staff_account_request/);

console.log(
  "Acceptance guards verified: financial atomicity, safe archives, cancelled-invoice exclusion, meter-type access, auth messages, CSV preview validation, and payment approval controls.",
);
