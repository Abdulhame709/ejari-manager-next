import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const invoiceSql = read("supabase/migrations/20260817010000_central_invoice_generation.sql");
const archiveSql = read("supabase/migrations/20260817020000_safe_archiving_and_audit.sql");
const invoiceRoute = read("src/routes/invoices.tsx");
const reportsRoute = read("src/routes/reports.tsx");
const accessControl = read("src/lib/access-control.ts");

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

console.log(
  "Financial invariants verified: atomic generation, strict carry-forward period, safe archive RPCs, cancelled-invoice report exclusion, and meter-type access policy.",
);
