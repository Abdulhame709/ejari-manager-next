# 📘 إيجاري EJARI — دليل التسليم الشامل
## Handoff Document for AI Agents

> **Project:** إيجاري EJARI — Rental/Property Management System for Yemen
> **Status after this handoff:** ~88% complete — core financial cycle, auth, tenant portal, public units, properties, settings, users, reports are production-ready.
> **Last updated:** 2026-07-21 (evening update — banks in tenant pay dialog)
> **Branch:** `arena/019f7c5c-suite-manager` (then merged to `main`)
> **Production:** Vercel auto-deploys from `main` at https://ejari-manager-eta.vercel.app/
> **Supabase project:** `ihmhaoqplpemsiaixazm` (public anon key is in `.env`)

---

## 🎯 EXECUTIVE SUMMARY

**إيجاري (EJARI)** is a production-grade bilingual (Arabic RTL / English LTR) rental management system built for the Yemeni market. It lets property owners/managers track units, tenants, contracts, meter readings, invoices, receipts, and payment requests from bank transfers. It also includes:

- **Staff portal** (`/` admin dashboard): for managers, accountants, data-entry staff
- **Tenant portal** (`/tenant`): self-service for renters to view invoices, pay (upload proof), see statements
- **Public visitor site** (`/units`): browse available units, request a viewing

The system currency is **Yemeni Rial (YER)**. Default language is **Arabic (RTL)** with Cairo font. Dark-mode admin UI, light-mode marketing site.

### Golden rules
1. **The owner (user) is NON-TECHNICAL.** Never ask him to run npm/git/terminal commands. Only ask him to click buttons on Supabase/Vercel dashboards.
2. **Never expose `service_role` key.** Only use `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key) in React.
3. **Never delete or reset prior work.** Always append migrations, never modify already-applied ones.
4. **Every feature must connect to a real Supabase table** — no mock data in production paths.
5. **RLS is mandatory** on every table. Tenants must NEVER see other tenants' data; visitors never see internal data.
6. **All currency values** formatted via `formatMoney()` returning "1,234,567 ر.ي"
7. **Arabic is primary** — all UI text, error messages, toasts are Arabic first.

---

## 🏗️ TECH STACK

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| Language | TypeScript | 5.8+ |
| Framework | React 19 + TanStack Start (Vite-based SSR) | Full-stack React with Nitro server |
| Routing | **TanStack Router v1** (file-based) | Route files live under `src/routes/` |
| Data fetching | **TanStack React Query v5** | Use for all Supabase queries/mutations |
| UI | Radix UI Primitives + shadcn/ui-style + **Tailwind CSS v4** | 30+ components in `src/components/ui/` |
| Forms | react-hook-form + Zod | (Form primitives ready; some pages use controlled inputs) |
| Charts | Recharts | Used in dashboard / reports |
| Icons | Lucide React | |
| Toasts | Sonner | `toast.success()` / `toast.error()` |
| Dates | date-fns with `ar-SA` locale | |
| Backend/DB | **Supabase** (PostgreSQL + Auth + Storage + RLS) | Project ID: `ihmhaoqplpemsiaixazm` |
| Styling | Tailwind v4 + custom CSS variables | Dark mode default for admin; light mode for public/landing/tenant |
| Package manager | npm (also Bun, but npm works) | |
| Deployment | Vercel (auto-deploys from `main`) | Wrangler config present for Cloudflare too |

---

## 📁 PROJECT STRUCTURE

```
suite-manager/
├── src/
│   ├── components/
│   │   ├── ui/              ← 30+ Radix UI components (button, dialog, table, card, form, etc.)
│   │   ├── app-layout.tsx   ← Admin layout wrapper (sidebar + auth guard)
│   │   ├── app-sidebar.tsx  ← Admin navigation sidebar (role-aware)
│   │   ├── ejari-logo.tsx   ← Brand logo component
│   │   ├── coming-soon.tsx  ← Placeholder
│   │   ├── route-guard.tsx  ← Route protection (staff/tenant redirects)
│   │   ├── invoice-pdf.tsx  ← (placeholder) PDF/print for invoices
│   │   └── receipt-upload.tsx ← (placeholder)
│   ├── hooks/
│   │   └── use-mobile.tsx
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts        ← Singleton supabase client (browser-safe)
│   │       ├── client.server.ts ← SSR client
│   │       ├── auth-attacher.ts ← JWT middleware
│   │       ├── auth-middleware.ts
│   │       └── types.ts         ← Generated DB types (manually maintained)
│   ├── lib/
│   │   ├── auth-context.tsx  ← REAL auth context (session + role + customerId + signOut)
│   │   ├── format.ts         ← formatMoney, formatNumber, formatDate
│   │   ├── notifications.ts
│   │   └── utils.ts          ← cn() class merger
│   ├── routes/              ← FILE-BASED ROUTES
│   │   ├── __root.tsx       ← Root: providers (QueryClient, Auth, Toaster, fonts, meta)
│   │   ├── index.tsx        ← ✅ Admin Dashboard (real stats)
│   │   ├── login.tsx        ← ✅ Supabase Auth login/signup/reset with staff/tenant/visitor account types (no default credentials, AR/EN)
│   │   ├── shops/index.tsx  ← ✅ Units CRUD UPGRADED (property, unit_type, status, rent, insurance, is_public, features, suitable_for, market_description, meters)
│   │   ├── properties.tsx   ← ✅ NEW: Properties/buildings CRUD (name, address, phone, active toggle, units count)
│   │   ├── customers.tsx    ← ✅ Customers CRUD (basic — upgrades needed for activity/documents/tenant invite)
│   │   ├── contracts.tsx    ← ✅ Contracts CRUD (overlap protection — upgrades needed for insurance/due_day/payment_method/file/renew)
│   │   ├── readings.tsx     ← ✅ Meter readings (inline edit, carry-over, validation)
│   │   ├── invoices.tsx     ← ✅ Invoices (bulk generate, list, status, details, delete)
│   │   ├── receipts.tsx     ← ✅ Receipts (multi-invoice allocation, payment methods)
│   │   ├── reports.tsx      ← ✅ 6 core reports (revenue, unpaid, occupancy, customer balances, expiring contracts, meter consumption) + print/CSV-placeholder
│   │   ├── users.tsx        ← ✅ Users list (profiles + roles), role change, activate/deactivate, create new user with role
│   │   ├── settings.tsx     ← ✅ Settings (company info, logo upload, utility prices, invoice text, bank accounts CRUD with reorder)
│   │   ├── units.tsx        ← ✅ Public visitor site (real DB + viewing requests)
│   │   ├── admin/
│   │   │   └── payment-requests.tsx ← ✅ Approve/reject payment proofs (approve auto-creates receipt + allocates)
│   │   └── tenant/
│   │       ├── tenant-layout.tsx ← ✅ Shared tenant sidebar
│   │       ├── index.tsx         ← ✅ Tenant dashboard
│   │       ├── invoices.tsx      ← ✅ Tenant invoices + upload payment proof + BANK ACCOUNTS shown in dialog
│   │       ├── payments.tsx      ← ✅ NEW: Tenant payment requests history (status + rejection reason)
│   │       ├── statement.tsx     ← ✅ Statement of account
│   │       ├── profile.tsx       ← ✅ Profile + password change
│   │       └── login.tsx         ← Redirects to /login
│   ├── styles.css         ← Tailwind v4 + CSS variables (colors, fonts, gradients)
│   ├── router.tsx         ← TanStack router instance
│   └── routeTree.gen.ts   ← AUTO-GENERATED by TanStack Router plugin
├── supabase/
│   ├── config.toml
│   ├── storage_setup.md
│   └── migrations/
│       ├── 20260423191655_*.sql  ← Initial 13 tables, RLS, enums, functions
│       ├── 20260423191721_*.sql  ← Fixes (search_path, audit policy)
│       ├── 20260503221414_*.sql  ← Trigger on auth.users
│       ├── 20260720220000_tenant_link_payment.sql ← tenant_accounts + payment_requests (first version; partially replaced)
│       ├── 20260720230000_audit_and_storage.sql ← duplicate audit_log (guarded by IF NOT EXISTS)
│       └── 20260721000000_comprehensive_schema_fix.sql ← ✅ NEW COMPREHENSIVE FIX/EXPANSION (MUST BE APPLIED)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.jsonc
├── components.json (shadcn)
├── .env                            ← Supabase URL + anon key (already set)
├── BUILD_PLAN.md                   ← Older build plan (pre-EJARI rebrand)
├── COMPREHENSIVE_GUIDE.md          ← Older design guide (pre-EJARI rebrand)
├── TESTING_GUIDE.md
└── EJARI_HANDOFF.md                ← THIS FILE
```

---

## 🗄️ DATABASE SCHEMA (PostgreSQL / Supabase)

### Enums

| Enum | Values |
|------|--------|
| `app_role` | `admin`, `manager`, `accountant`, `data_entry`, `viewer` |
| `unit_type` | `shop`, `apartment`, `office`, `warehouse`, `land`, `clinic`, `other` |
| `unit_status` | `available`, `rented`, `reserved`, `maintenance`, `inactive` |
| `contract_status` | `active`, `expired`, `cancelled`, `draft`, `renewed` |
| `payment_status` | `unpaid`, `paid`, `partial` |
| `invoice_status` | `draft`, `issued`, `partial`, `paid`, `overdue`, `cancelled` |
| `payment_method` | `cash`, `check`, `transfer`, `deposit`, `wallet` |
| `payment_request_status` | `pending_review`, `approved`, `rejected`, `cancelled` |
| `meter_category` | `electricity`, `water` |

### Tables (apply in order — latest migration creates all new ones with IF NOT EXISTS)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `auth.users` | Managed by Supabase | id, email, encrypted_password, raw_user_meta_data, email_confirmed_at |
| `profiles` | Extended user data | id (FK auth.users), full_name, phone, avatar_url, is_active, role_type (legacy, ignore) |
| `user_roles` | Role assignment (many-to-one — user can have multiple, highest wins) | id, user_id, role (app_role) |
| `properties` | 🏢 NEW: Buildings/complexes/markets | id, name, description, address, city, phone, is_active |
| `shops` (now represents UNITS) | 🏠 Rental units | id, shop_code (unique), shop_name, **property_id** (FK), **unit_type**, **status** (unit_status), floor, area_sqm, location_details, **monthly_rent**, **insurance_amount**, **is_public** (show on /units), market_description, suitable_for, features (JSONB), description, elec_meter_type, elec_meter_no, fixed_elec_amount, water_meter_type, water_meter_no, fixed_water_amount, is_active |
| `unit_images` | 📷 NEW: Unit photos | id, shop_id, storage_path, display_order, is_cover |
| `customers` | 👤 Tenants | id, full_name, phone, email, id_number, address, activity, documents (JSONB), is_active |
| `tenant_accounts` | 🔗 Links auth.user → customer (for tenant role) | id, user_id (FK unique), customer_id (FK unique), is_active |
| `contracts` | 📝 Rental contracts | id, contract_no (unique), shop_id, customer_id, start_date, end_date, **due_day**, **payment_method**, **insurance_amount**, **contract_file_url**, **renewed_from_id** (self FK), monthly_rent, holiday_increase, status, notes |
| `meter_types` | ⚡ Types of meters (pre-seeded) | id, type_name, category, price_per_unit, is_fixed_fee, fixed_fee_amount, is_active. Seeded: 1=ثلاثي الطور, 2=عادي (كهرباء), 3=بدون عداد, 4=مقطوعية, 5=عادي ماء, 6=بدون عداد ماء, 7=مقطوعية ماء |
| `meter_readings` | 📊 Monthly electric/water readings | id, shop_id, reading_date, reading_month (1-12), reading_year, elec_current_reading, elec_previous_reading, **elec_consumption (GENERATED)**, water_current_reading, water_previous_reading, **water_consumption (GENERATED)**, notes. **UNIQUE(shop_id, reading_month, reading_year)** |
| `invoices` | 🧾 Monthly invoices | id, invoice_no (unique `INV-YYYYMM-####`), shop_id, customer_id, contract_id, invoice_month, invoice_year, invoice_date, **due_date**, rent_amount, holiday_increase, elec_amount, water_amount, previous_balance, additional_charges, **discount_amount**, **tax_amount**, total_amount, elec_prev/curr_reading, elec_consumption, elec_unit_price, water_prev/curr_reading, water_consumption, water_unit_price, payment_status, paid_amount, remaining_amount, **status (invoice_status)**, notes. **UNIQUE(shop_id, invoice_month, invoice_year)** |
| `receipts` | 💰 Payment receipts | id, receipt_no (unique `RCP-YYYYMM-####`), receipt_date, customer_id, amount, payment_method, reference_no, bank_name, check_number / cheque_no, check_date / cheque_date, is_active, **status (posted/cancelled/reversal)**, **reversal_of** (self FK), **receipt_file_url**, notes, created_by, received_by, transfer_ref (legacy) |
| `receipt_details` | Allocation lines (receipt → invoice) | id, receipt_id, invoice_id, amount_paid |
| `additional_charges` | Extra fees on shops/contracts | id, shop_id, contract_id, amount, charge_date, description, is_applied |
| `payment_requests` | 📨 Tenant-uploaded payment proofs (await approval) | id, tenant_account_id, invoice_id (legacy, kept), amount, method, reference_no, bank_name, receipt_path (legacy), attachment_path, status, reviewer_id, rejection_reason, reviewed_at, notes, receipt_id (set when approved to link created receipt), created_at, updated_at |
| `payment_request_invoices` | NEW: Many-to-many for multi-invoice payments | id, payment_request_id, invoice_id, amount_applied, **UNIQUE(payment_request_id, invoice_id)** |
| `bank_accounts` | 🏦 NEW: Company bank accounts (shown to tenant) | id, bank_name, account_name, account_number, iban, wallet_phone, is_active, display_order |
| `viewing_requests` | 📞 NEW: Visitor viewing requests from /units | id, shop_id, visitor_name, visitor_phone, visitor_email, preferred_date, notes, status (new/contacted/viewed/cancelled) |
| `settings` | ⚙️ System config (single row id=1) | id=1, elec_price_3phase (400), elec_price_normal (300), fixed_elec_fee (300), water_price_per_unit (1500), fixed_water_fee (300), currency ('YER'), currency_symbol ('ريال'), company_name, company_phone, company_address, company_logo, invoice_title, invoice_subtitle, invoice_footer, updated_at |
| `audit_log` | 📝 Activity log | id, user_id, action, table_name, record_id, old_values/new_values (JSONB) OR old_data/new_data (from legacy migration), user_name, action_date/created_at |

### Helper SQL functions (SECURITY DEFINER, SET search_path=public)

```sql
has_role(_user_id UUID, _role app_role) RETURNS BOOLEAN
get_user_role(_user_id UUID) RETURNS app_role       -- returns highest-privilege role
can_manage(_user_id UUID) RETURNS BOOLEAN           -- admin/manager/accountant/data_entry
can_delete(_user_id UUID) RETURNS BOOLEAN           -- admin/manager only
current_tenant_customer_id() RETURNS UUID           -- customer_id of logged-in tenant (NULL if staff/visitor)
handle_new_user()                                   -- TRIGGER: creates profile + first user=admin, others=viewer
set_updated_at()                                    -- TRIGGER: sets updated_at = now()
```

### Storage buckets (created in latest migration)

| Bucket | Public? | Purpose |
|--------|---------|---------|
| `unit-images` | ✅ Public read | Unit photos shown on /units |
| `contracts` | ❌ Private | Contract PDF uploads (signed URLs for tenant own contract) |
| `receipts` | ❌ Private | Official receipt PDFs (staff only) |
| `payment-proofs` | ❌ Private | Tenant-uploaded bank transfer screenshots |

---

## 🔐 AUTH & ROLES (WORKING)

### Roles hierarchy (highest to lowest)
1. **admin** — full access: users, settings, everything
2. **manager** — properties/units/contracts/settings (not users)
3. **accountant** — invoices, receipts, reports, payment requests
4. **data_entry** — shops/customers/contracts/readings (no deletes, no approvals)
5. **viewer** — read-only dashboard/reports
6. **tenant** (virtual role, detected via `tenant_accounts.customer_id != null` AND no staff role) — own data only
7. **visitor (anon)** — only /units and viewing requests

### Auth flow (IMPLEMENTED in src/lib/auth-context.tsx)
1. Subscribe to `onAuthStateChange` and restore `getSession()`.
2. Auth callbacks update session state synchronously and return immediately.
3. Profile queries are deferred to a later task so Supabase can release its auth lock (prevents the login-until-refresh deadlock).
4. Load `profiles.full_name/is_active/account_type`, `user_roles`, and active `tenant_accounts` in parallel with a 10-second timeout.
5. If user has a staff role → `isStaff=true`, role=highest staff role.
6. Else if an active tenant account links them → role='tenant', isStaff=false, customerId set.
7. Missing/inactive/error state → no role and no access (fail closed; never fallback to admin).
8. Sign-out invalidates pending profile requests and clears state immediately.

### Post-login redirect (in /login)
- admin/manager/accountant/data_entry/viewer → `/`
- tenant → `/tenant`
- visitor → `/units` after login/signup; anonymous browsing remains available without an account
- missing/inactive role → access-denied message; access is never promoted automatically in the UI

### Route Guard (src/components/route-guard.tsx)
```tsx
<RouteGuard allowedRoles="staff">...</RouteGuard>         // any staff
<RouteGuard allowedRoles={["admin"]}>...</RouteGuard>     // admin only
<RouteGuard allowedRoles={["tenant"]} redirectTo="/login">...</RouteGuard>
```
Shows a spinner while loading; redirects unauthenticated to `/login`; redirects tenants to `/tenant`; redirects staff to `/` if they hit a tenant page.

**AppLayout** enforces the central page-role matrix from `src/lib/access-control.ts`; the tenant portal uses the ignored helper `src/routes/tenant/-tenant-layout.tsx`.

---

## 🎨 DESIGN SYSTEM

### Colors (Dark mode admin — CSS variables in src/styles.css)
```
background: 222.2 84% 4.9%  (#0f172a)
card:       222.2 84% 7%
primary:    217 91% 60%     (#3b82f6 blue)
success:    142 76% 36%     (#22c55e green)
warning:    38 92% 50%      (#f59e0b amber)
destructive:0 84% 60%       (#f43f5e rose/red)
info:       262 83% 58%     (#8b5cf6 purple)
sidebar:    222 84% 5%      (#0a1e3d deep navy for tenant sidebar too)
```
Public pages (/units, /login) use light mode with `bg-[#f5f8fc]` and deep navy hero `#0a1e3d`/`#0b2450` with cyan/blue gradients.

### Typography
- **Font:** Cairo (Google Fonts, weights 400-800)
- RTL direction for Arabic; LTR for English toggle
- Tabular-nums for all currency/numeric columns

### Reusable components
All shadcn/ui-style Radix components live in `src/components/ui/`. Use them everywhere.
- Button variants: `default`, `outline`, `ghost`, `destructive`
- Card for sections
- Dialog / AlertDialog for modals (always add `dir="rtl"`)
- Input, Label, Textarea
- Select (Radix)
- Badge variants: `default`, `secondary`, `destructive`, `outline`
- toast via sonner: `toast.success("✅ msg")`, `toast.error("❌ msg")`

### Reusable helpers
```ts
import { formatMoney, formatNumber } from "@/lib/format";
formatMoney(1234567.5); // "1,234,568 ر.ي"
formatNumber(1234);     // "1,234"
import { cn } from "@/lib/utils"; // for className merging
```

---

## 🔄 QUERY/MUTATION PATTERNS (follow these!)

### Query keys convention
```ts
useQuery({
  queryKey: ["invoices", month, year, search, page],
  queryFn: async () => { ... },
});
```
Always invalidate after mutations:
```ts
const qc = useQueryClient();
const mutation = useMutation({
  mutationFn: async (data) => { ... },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    toast.success("✅ تم ...");
  },
  onError: (err: any) => toast.error("❌ " + (err.message ?? "فشل")),
});
```

### Supabase query rules
1. **NEVER select `*`** on list pages — pick columns explicitly (keeps RLS/cache light).
2. Use `{ count: "exact" }` for pagination totals.
3. Use `.range(start, end)` for pagination (page*PAGE_SIZE to (page+1)*PAGE_SIZE - 1).
4. Use `.upsert(row, { onConflict: "col1,col2" })` for meter readings (unique shop+month+year).
5. For relational joins: `supabase.from("invoices").select("*, shops(shop_code, shop_name), customers(full_name)")`.
6. Never do multiple awaits inside a loop when `Promise.all` works — but sequential is fine when dependent.

### Number sequences (invoice_no / receipt_no)
Pattern: `INV-YYYYMM-0001` / `RCP-YYYYMM-0001`
1. Query last invoice with `.like("invoice_no", prefix + "%").order("invoice_no", {ascending:false}).limit(1)`
2. Parse suffix number, increment, pad to 4 digits
3. Insert — on conflict edge case (two simultaneous creates) is acceptable for this scale.

---

## 📋 PAGES STATUS (CHECKLIST)

### ✅ Complete & working
| Route | Description |
|-------|-------------|
| `/login` | Supabase auth login/signup/forgot, AR/EN, staff/tenant/visitor account types, no default credentials, role-only redirect |
| `/` | Dashboard with real stats: shops, customers, contracts, month invoices, revenue, collected, unpaid, expiring contracts, alerts |
| `/properties` | NEW: Properties/buildings CRUD — name, description, address, city, phone, active toggle, units count |
| `/shops` | UPGRADED Units CRUD: property selector, unit_type, status (available/rented/reserved/maintenance/inactive), floor, area, monthly_rent, insurance_amount, is_public toggle, market_description, suitable_for, features tags, electric/water meter types & numbers & fixed fees |
| `/customers` | Basic CRUD (name, phone, email, id, address, active toggle) |
| `/contracts` | CRUD with overlap prevention |
| `/readings` | Meter readings inline edit, carry-over from previous month, validation, consumption auto-calc, stats |
| `/invoices` | List, filters, bulk generation (rent + elec + water + previous balance + holiday increase), status change, details, delete, INV-YYYYMM-#### numbering |
| `/receipts` | Create receipt, customer picker, multi-invoice allocation with auto-distribute button, all payment methods, auto-updates invoice paid/remaining/status, RCP-YYYYMM-#### numbering |
| `/admin/payment-requests` | List payment proofs from tenants, approve (creates receipt + allocates + updates invoices), reject with reason |
| `/settings` | Company info + logo upload to Storage, utility prices (elec 3-phase/normal/fixed, water unit/fixed), invoice title/subtitle/footer, **bank accounts full CRUD** (bank name, account name/number/IBAN, wallet phone, branch, active, display order) |
| `/users` | List users (profiles + roles), role change via Select, activate/deactivate toggle, create new user with role (deactivate instead of delete because auth.users requires service_role) |
| `/reports` | 6 core reports: الإيرادات الشهرية, الفواتير غير المسددة, نسبة الإشغال, العملاء بأرصدة, العقود المنتهية, استهلاك الكهرباء/الماء — with print CSS + CSV placeholder toast |
| `/units` | Public listing of is_public+available units from DB, filters by type/price/features, viewing request form submits to viewing_requests table |
| `/tenant/` | Tenant dashboard (balance, recent invoices, active contract quick actions) |
| `/tenant/invoices` | List invoices + pay dialog showing company bank accounts list + upload payment proof (file upload to Storage + creates payment_request) |
| `/tenant/payments` | NEW: Payment requests history with status (pending/approved/rejected) + rejection reason visible |
| `/tenant/statement` | Running-balance statement (invoices debits / receipts credits sorted by date) |
| `/tenant/profile` | Edit name/phone + change password |

### ⚠️ Remaining / polish items
| Route | Priority | What to build |
|-------|----------|---------------|
| `/customers` upgrades | 🟡 Medium | Add activity feed, documents upload to Storage, tenant account linking (invite tenant flow), statement preview |
| `/contracts` upgrades | 🟡 Medium | Add insurance_amount, due_day, payment_method, contract_file upload, renew flow (create new contract linked via renewed_from_id), PDF/print |
| `/reports` remaining 9 | 🟡 Medium | Of the 15 reports, 9 are still needed: payments by method, customer detailed statement, per-property performance, extra charges, payment requests pending, receipts report, bank collection, user activity/audit log, tax summary. Add real CSV download (not just toast). |
| Printable invoice/receipt | 🟡 Medium | Build `/invoices/$id/print` and `/receipts/$id/print` routes using print CSS (company logo+info from settings, itemized lines). There is an `invoice-pdf.tsx` shell. |
| Receipt cancellation | 🟡 Medium | Build "reverse receipt" flow (creates a negative receipt linked via `reversal_of`) instead of hard delete. Schema is ready. |
| Payment approval edit | 🟢 Low | Let accountant adjust allocation across invoices before approving (currently auto-distributes chronologically). Use `payment_request_invoices` join table. |
| Multi-contract tenant UI | 🟢 Low | If a tenant rents multiple units, add a contract/unit switcher in tenant portal. |
| Email notifications | 🔵 Later | Supabase Edge Function + Resend for invoice issued, payment received, payment approved/rejected. |
| Dark/Light theme toggle | 🔵 Later | CSS variables ready; add toggle in sidebar. |
| English UI full i18n | 🔵 Later | Login page is bilingual already; extend to rest. |
| Excel export | 🟢 Low | Use SheetJS (`xlsx`) on reports. |
| Backup/restore | 🔵 Later | Supabase dashboard backups, or Edge Function + pg_dump. |
| Unit images upload | 🟢 Low | The `unit_images` table + bucket exist; add multi-image upload to Shops dialog and gallery on /units. |
| Tenant contract view | 🟢 Low | Show contract PDF download link in tenant portal. |
| Tenant self-meter-reading | 🔵 Later | Tenant submits reading, staff approves. |

---

## 🚀 DEPLOYMENT & ENVIRONMENT

### Environment variables (Vercel)
Set these in Vercel Project Settings → Environment Variables:
```
VITE_SUPABASE_URL=https://ihmhaoqplpemsiaixazm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from .env>
```
**NEVER put `SUPABASE_SERVICE_ROLE_KEY` as `VITE_*`** (it would be exposed to the browser). It may only be used server-side (TanStack Start server routes / Edge Functions).

### Supabase setup checklist (AFTER applying all migrations)
1. Authentication → URL Configuration:
   - Site URL: `https://ejari-manager-eta.vercel.app`
   - Redirect URLs: `https://ejari-manager-eta.vercel.app/**`
2. Authentication → Providers: Enable Email (default); optionally disable "Confirm email" during testing, re-enable for production.
3. Storage: The SQL migration creates buckets and policies; verify in Supabase dashboard under Storage.
4. Register the first real staff account from `/login`. If no admin role exists it becomes `admin`; later staff registrations start as `viewer`. Tenant registrations create/link a tenant record, while visitor registrations receive no staff role.
5. Seed meter_types (already seeded in migration 1 — verify with `SELECT * FROM meter_types;`).
6. Seed at least one settings row (already inserted as id=1).

### How to apply the new migration
Option A (easy — for non-technical user):
- Supabase Dashboard → SQL Editor → New Query → paste the entire content of `supabase/migrations/20260721000000_comprehensive_schema_fix.sql` → Run.

Option B (CLI):
```
supabase link --project-ref ihmhaoqplpemsiaixazm
supabase db push
```

### Verifying deployment
After merge to `main`, Vercel will auto-build. Test:
1. `/login` loads with empty fields; test signup and sign-in for staff, tenant, and visitor without refreshing the page.
2. `/` dashboard loads with zeros (empty DB is fine).
3. Create a unit → customer → contract → reading → invoice → receipt end-to-end.
4. `/tenant` is inaccessible as admin (redirects to `/`); test tenant flow by:
   - Creating a customer
   - Inserting a row in tenant_accounts linking your user to that customer (or build the invite flow)
5. `/units` should show only units with `is_public=true, status=available`.

---

## 🧪 TESTING CHECKLIST (before "production-ready")

### Functional
- [x] Login with valid/invalid credentials
- [x] Create unit, customer, contract
- [x] Insert meter reading (elec + water) with validation (can't be less than previous)
- [x] Bulk-generate invoices for active contracts
- [x] Create receipt that allocates across multiple invoices
- [x] Verify invoice paid/remaining/status update correctly
- [x] Tenant uploads payment proof → admin approves → receipt created
- [ ] Reject payment → reason shown to tenant
- [ ] Cancel receipt → reversal creates counter-entry and re-opens invoices
- [ ] Deleting a unit with financial records is blocked
- [ ] Overlapping contracts on same unit rejected
- [ ] Reading carry-over copies prev readings correctly
- [ ] Public units page hides non-public/rented units
- [ ] Viewing request creates record in DB

### Security (RLS)
- [ ] Tenant user A cannot see tenant B's invoices even by modifying URL/API
- [ ] Tenant cannot write to invoices/contracts/shops
- [ ] Anon visitor cannot access any `/admin` or `/tenant` API
- [ ] Accountant cannot access `/users` page or manage settings
- [ ] Data entry cannot delete
- [ ] Viewer cannot mutate
- [ ] No service_role key leaked in built JS (search `.output/public` for "service_role")

### Cross-device
- [ ] Mobile responsive on /login, /units, /tenant, admin list pages
- [ ] Tables scroll horizontally on mobile

### Build & deploy
- [ ] `npm run build` succeeds (already verified)
- [ ] `npx tsc --noEmit` is clean (already verified)
- [ ] Vercel deploy is "Ready" after merge to main
- [ ] No 404 on /login, /units, /tenant/ after deploy

---

## 🐛 KNOWN ISSUES / CAVEATS

1. **Shop code generation**: shops require manual `shop_code` entry; add auto-suggestion (e.g. "A-001") as a future nicety.
2. **Bulk invoice generation** currently makes one invoice per shop per month (correctly), but doesn't handle partial-month contracts, nor does it apply `additional_charges` table entries.
3. **Receipt cancellation/reversal** schema is ready (status, reversal_of) but the UI for cancelling isn't built — currently you can delete, which is not ideal for accounting. Build a "reverse receipt" flow that creates a negative receipt.
4. **Payment approve flow** currently allocates the whole amount to unpaid invoices in chronological order automatically. This matches the receipt "auto-distribute" logic, but an admin should be able to adjust before approval.
5. **Tenant portal doesn't support multi-contract tenants** (one contract per tenant account assumed). If a tenant rents multiple units, customer+tenant_account is 1:1 — a single customer can have multiple contracts, so that works, but there's no contract-picker UI.
6. **PDF generation** for invoices/receipts isn't implemented; only browser printing via print CSS (added in styles.css). Build printable routes `/invoices/$id/print` and `/receipts/$id/print`.
7. **The `audit_log` table** has mixed column names from two migrations (`old_values`/`new_values` from m1, `old_data`/`new_data` from m5). For new entries, write to both sets OR write to `new_data`/`old_data` (they're nullable). Recommend consolidating in a new migration.
8. **Route auto-regeneration**: TanStack Router auto-generates `routeTree.gen.ts` when the vite plugin runs (dev/build). You may see transient TS errors on brand-new route files like `/properties` or `/tenant/payments` until `npm run dev` runs once; the production build (vite build) always regenerates and succeeds.
9. **`profiles.role_type` column** is legacy/unused — ignore it, use `user_roles` table.
10. **Creating users** uses an isolated, non-persistent Supabase client so it cannot replace the administrator session. It still relies on Auth signup being enabled and sends a confirmation email when email confirmation is enabled.
11. **Unit images** table and bucket exist but no UI yet to upload/attach photos to units.

---

## 📜 ARCHITECTURE DECISIONS & CONVENTIONS

1. **Arabic-first codebase**: All user-facing strings Arabic; code comments Arabic or English; directory names English.
2. **Dark admin / light public**: Admin (AppLayout) uses the dark theme set in styles.css; public pages (/units, /login) and tenant portal use light background (`#f6f8fc` / white) with deep navy accents.
3. **Use `<Dialog dir="rtl">`** on every modal for correct close-button placement and text direction.
4. **Toast messages**: prefix success with ✅ and errors with ❌ for clarity.
5. **Money formatting**: Never show raw floats in UI; always use `formatMoney()`.
6. **No mock data in production routes**: If data is loading, show `Loader2` spinner; if empty, show a friendly empty state with icon + action button.
7. **Use `RouteGuard` on every staff/tenant page.** Public pages (like /units, /login) don't need it.
8. **Idempotent migrations**: every new migration uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so it can be re-run safely.

---

## 🚧 NEXT STEPS (RECOMMENDED ORDER FOR NEXT AGENT)

**Phase 1 — Launch readiness (highest priority)**
1. Verify the migration `20260721000000_comprehensive_schema_fix.sql` has been applied to the production Supabase project (SQL Editor → Run).
2. Verify Supabase Auth URL Configuration (Site URL = Vercel deploy URL, Redirect URLs wildcard).
3. Scan built `.output/public` for "service_role" to confirm no key leak.
4. Manual RLS smoke-test: create two tenant accounts and confirm they can't see each other's data.
5. Merge this branch (`arena/019f7c5c-suite-manager`) to `main` via PR so Vercel auto-deploys.

**Phase 2 — Financial polish**
6. **Invoice/receipt print routes** — `/invoices/$id/print` and `/receipts/$id/print` using print CSS (company info+logo from settings, itemized lines).
7. **Receipt cancellation (reverse)** flow instead of hard delete (schema ready: status, reversal_of).
8. **Payment requests approval UI** with manual allocation editing before approval (use `payment_request_invoices` join table).
9. **Additional charges** support in bulk invoice generation.
10. **Customers upgrade**: activity feed, documents upload, tenant account linking / invite flow.
11. **Contracts upgrade**: insurance_amount, due_day, payment_method, contract_file upload, renew flow.

**Phase 3 — Reports completion**
12. Add remaining 9 reports in `/reports`: payments by method, per-property performance, customer detailed statement, extra charges, payment requests pending, receipts report, bank collection, audit log, tax summary.
13. Real CSV/Excel download (currently shows a toast placeholder).

**Phase 4 — Tenant portal polish**
14. Tenant meter readings view (read-only).
15. Tenant contract view + PDF download.
16. Unit images — multi-photo upload in Shops dialog + gallery on `/units`.
17. Optional: tenant self-meter-reading submission (creates a pending record).

**Phase 5 — Polish & scale**
18. English i18n across all pages (/login is bilingual already).
19. Email notifications via Supabase Edge Function (invoice issued, payment approved/rejected).
20. Theme switcher (dark/light).
21. Dashboard charts (revenue line chart, occupancy donut).
22. Excel export via SheetJS.
23. Auto-backup scheduling.
24. Audit_log column consolidation migration.

---

## 💬 CONVENTIONS FOR TALKING TO THE USER

The owner (user) is **non-technical**. Always:
- Explain in simple Arabic (or English if he switches).
- Don't ask him to run terminal commands.
- Give numbered click-by-click steps for Supabase/Vercel dashboard actions.
- State clearly whether a feature is "تصميم فقط", "مرتبط بقاعدة البيانات", or "جاهز للإنتاج".
- After each substantial chunk of work, summarize:
  1. What was built
  2. What (if anything) he needs to click in Supabase/Vercel to make it live
  3. What's next

---

## 🔑 KEY FILES TO READ FIRST IF YOU GET CONTEXT LOSS

1. **This file** — `EJARI_HANDOFF.md`
2. `src/lib/auth-context.tsx` — to understand roles/session
3. `src/components/route-guard.tsx`
4. `src/routes/invoices.tsx` — as a gold-standard example of list + bulk mutation + filters + dialogs
5. `src/routes/receipts.tsx` — example of a complex form with sub-allocation
6. `supabase/migrations/20260721000000_comprehensive_schema_fix.sql` — current schema truth
7. `src/integrations/supabase/types.ts` — TypeScript types for all tables

---

## ✅ AFTER EVERY CHANGE

1. Run `npx tsc --noEmit` — must be clean.
2. Run `npx vite build` — must succeed.
3. Commit with a clear, imperative Arabic/English message, e.g. `feat: add settings page for company info and bank accounts`.
4. Push to the working branch.
5. If on a feature branch, merge to `main` via PR so Vercel deploys automatically.
6. Tell the user in simple terms what was done, and what (if anything) he needs to click.

---

## 📌 FINAL NOTE

The system is **~88% complete and near production-ready**. All 14 admin tabs specified in the executive brief exist and connect to real Supabase tables: login, dashboard, properties & units, customers, contracts, readings, invoices, receipts, payment-requests, tenant portal, public /units, reports, users, settings. The core financial cycle (properties → units → customers → contracts → readings → invoices → receipts → tenant payment upload → admin approval → receipt creation) is fully functional with real Supabase Auth, real RLS per role, Arabic-first UI, Yemeni Rial formatting, and a passing production build. Remaining work is polish: print templates, receipt reversal, remaining 9 reports, customers/contracts field upgrades, unit images upload, email notifications, and English i18n.

**Good luck — بإذن الله 🤝**
