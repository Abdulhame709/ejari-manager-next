# 📋 خطة بناء نظام إدارة الإيجارات والخدمات — الإصدار 3.0

> **مشروع:** Suite Manager — نظام إيجارات المحلات التجارية
> **التقنية:** React 19 + TypeScript + TanStack Start + Supabase (PostgreSQL) + Tailwind CSS v4
> **الحالة الحالية:** ~35% مكتمل (Dashboard, Shops, Customers, Contracts جاهزة)
> **التاريخ:** يوليو 2025

---

## 🎯 ملخص تنفيذي

هذا المستند يحدد خطة شاملة لإكمال نظام إدارة الإيجارات المبني على **Supabase + TanStack Start**. النظام الحالي يحتوي على قاعدة بيانات متكاملة (13 جدول مع RLS) وواجهة أمامية لثلاث وحدات أساسية. المتبقي هو تنفيذ الوحدات المالية والتشغيلية: **الفواتير، قراءات العدادات، سندات القبض، التقارير، الإعدادات، إدارة المستخدمين**.

---

## 📊 الحالة الحالية بالتفصيل

| الوحدة | الحالة | التفاصيل |
|----------|--------|----------|
| **قاعدة البيانات (Supabase)** | ✅ 100% | 13 جدول، RLS، Triggers، Functions، Enums |
| **المصادقة (Supabase Auth)** | ⚠️ 10% | معطّلة حالياً (Mock) - تحتاج تفعيل |
| **Dashboard** | ✅ 100% | إحصائيات، تنبيهات، إجراءات سريعة |
| **المحلات (Shops)** | ✅ 100% | CRUD كامل، فلترة، ترقيم، تفاصيل العقد |
| **العملاء (Customers)** | ✅ 100% | CRUD كامل، بحث، حالة |
| **العقود (Contracts)** | ✅ 100% | CRUD كامل، تحقق من التداخل، ربط محل+عميل |
| **أنواع العدادات (Meter Types)** | ✅ 100% | في قاعدة البيانات، تستخدم في المحلات |
| **الفواتير (Invoices)** | ❌ 0% | Coming Soon — **أولوية قصوى** |
| **قراءات العدادات (Readings)** | ❌ 0% | Coming Soon — **أولوية قصوى** |
| **سندات القبض (Receipts)** | ❌ 0% | Coming Soon — **أولوية قصوى** |
| **التقارير (Reports)** | ❌ 0% | Coming Soon — المرحلة 2 |
| **الإعدادات (Settings)** | ❌ 0% | Coming Soon — المرحلة 2 |
| **إدارة المستخدمين (Users)** | ❌ 0% | Coming Soon — المرحلة 2 |
| **بوابة المستأجر (Tenant Portal)** | ❌ 0% | **ميزة جديدة** — المرحلة 3 |

---

## 🏗️ خطة التطوير بالمراحل

### المرحلة 1: الوحدات المالية والتشغيلية الأساسية (6-8 أسابيع)
**الهدف:** إكمال دورة الإيرادات الكاملة (قراءات → فواتير → قبض)

#### 1.1 تفعيل المصادقة الحقيقية (أسبوع 1)
- [ ] تفعيل `supabase.auth` في `auth-context.tsx`
- [ ] صفحة تسجيل دخول `/login` حقيقية مع معالجة الأخطاء
- [ ] حماية المسارات (Route Guards) حسب الأدوار
- [ ] تسجيل خروج يعمل
- [ ] اختبار الأدوار: admin, manager, accountant, data_entry, viewer

#### 1.2 قراءات العدادات `/readings` (أسبوع 2-3)
**المتطلبات من الدليل + تحسينات:**
- [ ] جدول المحلات مع حالة القراءة للشهر الحالي (مكتمل/معلق/متأخر)
- [ ] إدخال/تعديل قراءة (كهرباء + ماء) في صف واحد
- [ ] **ميزة جديدة:** عرض القراءة السابقة تلقائياً من آخر شهر
- [ ] **ميزة جديدة:** حساب الاستهلاك فوراً (Current - Previous)
- [ ] **ميزة جديدة:** تنبيه بصري إذا القراءة الحالية < السابقة
- [ ] **ترحيل القراءات:** نسخ قراءات الشهر الماضي كسابقة للشهر الجديد
- [ ] إلغاء الترحيل (Uncarry) لقراءة واحدة أو كلها
- [ ] فلترة: شهر/سنة، حالة، بحث باسم المحل
- [ ] تصدير Excel للقراءات

**API Supabase المطلوبة:**
```typescript
// قراءة واحدة لمحل في شهر/سنة
GET /rest/v1/meter_readings?shop_id=eq.x&reading_month=eq.1&reading_year=eq.2025

// آخر قراءة لمحل (للترحيل)
GET /rest/v1/meter_readings?shop_id=eq.x&order=reading_year.desc,reading_month.desc&limit=1

// Upsert قراءة (إضافة أو تعديل)
POST /rest/v1/meter_readings (on_conflict: shop_id,reading_month,reading_year)
```

#### 1.3 الفواتير `/invoices` (أسبوع 3-4)
**المتطلبات من الدليل + تحسينات:**
- [ ] قائمة الفواتير مع فلترة شهر/سنة، حالة الدفع، بحث
- [ ] **إنشاء دفعي (Bulk Generate):** إنشاء فواتير لجميع المحلات ذات العقود السارية
- [ ] **معاينة قبل الإنشاء:** عرض ملخص المبالغ قبل الحفظ
- [ ] حساب تلقائي:
  - الإيجار من العقد
  - زيادة العيد من العقد
  - الكهرباء: استهلاك × سعر الوحدة (أو مبلغ ثابت)
  - الماء: استهلاك × سعر الوحدة (أو مبلغ ثابت)
  - الرصيد السابق من آخر فاتورة غير مدفوعة
  - رسوم إضافية (Additional Charges)
- [ ] رقم فاتورة تلقائي: `INV-{YYYY}{MM}-{SEQ}`
- [ ] تغيير حالة الدفع: غير مدفوعة / مدفوعة / جزئية
- [ ] ربط الفاتورة بالعقد والمحل والعميل
- [ ] عرض تفاصيل الفاتورة (Modal أو صفحة منفصلة)
- [ ] حذف فاتورة (مع تحقق من عدم وجود سندات قبض مرتبطة)

**منطق إنشاء الفاتورة (مطابق للدليل):**
```sql
-- لكل محل له عقد نشط في الشهر المستهدف:
INSERT INTO invoices (
  invoice_no, shop_id, customer_id, contract_id,
  invoice_month, invoice_year, invoice_date,
  rent_amount, holiday_increase,
  elec_amount, water_amount,
  previous_balance, additional_charges, additional_charges_desc,
  total_amount,
  elec_prev_reading, elec_curr_reading, elec_consumption, elec_unit_price,
  water_prev_reading, water_curr_reading, water_consumption, water_unit_price,
  payment_status, paid_amount, remaining_amount
) VALUES (...)
```

#### 1.4 سندات القبض `/receipts` (أسبوع 4-5)
**المتطلبات من الدليل:**
- [ ] إنشاء سند قبض جديد
- [ ] اختيار العميل → عرض فواتيره غير المدفوعة/جزيئياً
- [ ] توزيع المبلغ على فواتير محددة (مع حقل مبلغ مدفوع لكل فاتورة)
- [ ] طرق الدفع: نقدي / شيك / تحويل (مع حقول مخصصة لكل طريقة)
- [ ] رقم سند تلقائي: `RCP-{YYYY}{MM}-{SEQ}`
- [ ] تحديث تلقائي لـ `invoices.payment_status` و `paid_amount` و `remaining_amount`
- [ ] قائمة السندات مع فلترة تاريخ/عميل/طريقة دفع
- [ ] عرض تفاصيل السند (الفواتير المغطاة)
- [ ] طباعة سند القبض (تصميم احترافي)

#### 1.5 الربط والتكامل (أسبوع 5-6)
- [ ] **Dashboard:** تحديث الإحصائيات لجلب بيانات حقيقية من الفواتير والسندات
- [ ] **Shops:** عرض آخر قراءة وآخر فاتورة في بطاقة التفاصيل
- [ ] **Contracts:** عرض حالة الفواتير للعقد
- [ ] **Customers:** كشف حساب مدمج (فواتير + سندات)
- [ ] تدقيق شامل لمسار البيانات: قراءة → فاتورة → سند قبض

---

### المرحلة 2: التقارير والإدارة (4-5 أسابيع)

#### 2.1 مركز التقارير `/reports` (أسبوع 6-8)
**16 تقرير كما في الدليل:**

| # | التقرير | النوع | الفلاتر |
|---|----------|-------|---------|
| 1 | الإيجارات الشهرية | أساسي | شهر، سنة |
| 2 | استهلاك الكهرباء | أساسي | شهر، سنة، نوع عداد |
| 3 | استهلاك المياه | أساسي | شهر، سنة، نوع عداد |
| 4 | التقرير الإجمالي الشامل | أساسي | شهر، سنة |
| 5 | كشف حساب عميل | عملاء | عميل، من/إلى تاريخ |
| 6 | قائمة العملاء | عملاء | حالة |
| 7 | أرصدة العملاء | عملاء | حالة الدفع |
| 8 | العملاء ذوو الزيادات | عملاء | شهر، سنة |
| 9 | الفواتير غير المسددة | مالي | عميل، شهر، سنة |
| 10 | الإيرادات السنوية | مالي | سنة |
| 11 | مقارنة الفترات | تحليلي | فترتين |
| 12 | أداء المحلات | تحليلي | سنة |
| 13 | تحليل الاستهلاك | تحليلي | شهر، سنة |
| 14 | العقود السارية | عقود | - |
| 15 | العقود قاربت الانتهاء | عقود | أيام (30/60/90) |
| 16 | حالة المحلات | عقود | - |

**ميزات كل تقرير:**
- [ ] عرض في الصفحة مع ترقيم
- [ ] طباعة (`window.open` مع CSS مخصص للطباعة)
- [ ] تصدير CSV
- [ ] ترويسة احترافية (شعار + عنوان + تاريخ + توقيعات من الإعدادات)
- [ ] ألوان الجداول من الإعدادات

**التنفيذ التقني:**
- استخدام **RPC Functions** في Supabase للاستعلامات المعقدة
- أو `supabase.rpc()` مع دوال PostgreSQL معرفة مسبقاً
- React Query للـ caching والتحميل الكسول

#### 2.2 الإعدادات `/settings` (أسبوع 8-9)
- [ ] بيانات الشركة (الاسم، الهاتف، العنوان، الشعار)
- [ ] رفع الشعار (Supabase Storage bucket)
- [ ] أسعار الوحدات (الكهرباء 3طور/عادي، الماء، الرسوم الثابتة)
- [ ] إعدادات الفاتورة (العنوان، التذييل، إظهار الشعار)
- [ ] إعدادات التقارير (ألوان، توقيعات، حجم الورق)
- [ ] **النسخ الاحتياطي:** إنشاء/تحميل/استعادة/حذف (pg_dump عبر Edge Function)

#### 2.3 إدارة المستخدمين `/users` (أسبوع 9)
- [ ] قائمة المستخدمين من `auth.users` + `profiles` + `user_roles`
- [ ] دعوة مستخدم جديد (Supabase Admin API)
- [ ] تعيين/تعديل الدور (admin, manager, accountant, data_entry, viewer)
- [ ] تفعيل/إيقاف مستخدم
- [ ] عرض آخر تسجيل دخول
- [ ] **صلاحيات الصفحات:** حماية المسارات حسب الدور (مطبق في Sidebar)

---

### المرحلة 3: الميزات المتقدمة وبوابة المستأجر (4-6 أسابيع)

#### 3.1 بوابة المستأجر `/tenant/*` (أولوية عالية - أسبوع 10-12)
**مفهوم:** تطبيق منفصل (أو مسارات محمية) للمستأجرين

**الصفحات:**
- [ ] `/tenant/login` — تسجيل دخول برقم العقد/الهوية + OTP أو كلمة مرور
- [ ] `/tenant/dashboard` — ملخص: آخر فاتورة، المبلغ المستحق، حالة الدفع
- [ ] `/tenant/invoices` — قائمة فواتير المستأجر (فلترة سنة/شهر)
- [ ] `/tenant/invoices/:id` — تفاصيل فاتورة مع تحميل PDF
- [ ] `/tenant/statement` — كشف حساب تراكمي (مدين/دائن/رصيد)
- [ ] `/tenant/profile` — تحديث بيانات الاتصال، تغيير كلمة المرور
- [ ] **اختياري:** `/tenant/meter-reading` — تقديم قراءة عداد مع صورة

**الأمان:**
- Row Level Security على مستوى المستأجر (`customer_id = auth.uid()` عبر mapping)
- JWT منفصل أو استخدام Supabase Auth مع `custom claims`

#### 3.2 التحسينات المطلوبة في الدليل (أسبوع 12-14)
- [ ] **نظام الثيمات:** Dark/Light/Blue/Green/Purple (Tailwind CSS variables)
- [ ] **تصدير Excel حقيقي:** باستخدام `exceljs` أو `xlsx`
- [ ] **الصلاحيات المفصلة:** Permissions matrix لكل دور
- [ ] **النسخ الاحتياطي التلقائي:** جدولة يومية/أسبوعية (Supabase Cron / pg_cron)
- [ ] **الإشعارات:** بريد إلكتروني عند إصدار فاتورة، تذكير استحقاق (Edge Functions + Resend/SendGrid)
- [ ] **طباعة محسنة:** الفواتير والسندات بتصميم جاهز للطباعة (A4/A5)

#### 3.3 ميزات إضافية مقترحة (أسبوع 14-16)
- [ ] **الرسوم المتكررة (Recurring Charges):** خدمات شهرية ثابتة (نظافة، صيانة، أمن)
- [ ] **إدارة الشيكات:** تتبع الشيكات المؤجلة، تواريخ الاستحقاق، الحالة
- [ ] **اللوج المتقدم:** تصفية Audit Log، تصدير
- [ ] **API للموبايل:** توثيق OpenAPI/Swagger

---

## 🗄️ هيكل قاعدة البيانات — مراجعة سريعة

الجداول موجودة وجاهزة في Supabase:

```sql
-- الجداول الأساسية (13 جدول)
profiles, user_roles, shops, customers, contracts,
meter_types, meter_readings, invoices,
receipts, receipt_details, additional_charges,
settings, audit_log
```

**العلاقات الرئيسية:**
- `shops 1──∞ contracts`
- `customers 1──∞ contracts`
- `contracts 1──∞ invoices`
- `shops 1──∞ meter_readings`
- `invoices 1──∞ receipt_details`
- `receipts 1──∞ receipt_details`
- `shops 1──∞ additional_charges`

**RLS مفعل على جميع الجداول** مع سياسات مبنية على الدوال `has_role()`, `can_manage()`, `can_delete()`.

---

## 🔧 التفاصيل التقنية للتنفيذ

### نمط الكود المعتمد
```typescript
// 1. Types في بداية الملف
interface Invoice {
  id: string;
  invoice_no: string;
  // ...
}

// 2. Query Keys موحدة
const QUERY_KEYS = {
  invoices: (filters: InvoiceFilters) => ['invoices', filters] as const,
  invoice: (id: string) => ['invoice', id] as const,
};

// 3. Custom Hooks للـ Queries
function useInvoices(filters: InvoiceFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.invoices(filters),
    queryFn: () => fetchInvoices(filters),
  });
}

// 4. Mutations مع Invalidation
function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

// 5. Components مفككة: List, Form, Details, Dialog
```

### المكتبات المستخدمة
| الغرض | المكتبة |
|-------|---------|
| Routing | `@tanstack/react-router` (File-based) |
| Data Fetching | `@tanstack/react-query` |
| Forms | `react-hook-form` + `zod` |
| UI | `@radix-ui/*` + `tailwindcss` + `class-variance-authority` |
| Charts | `recharts` |
| Icons | `lucide-react` |
| Notifications | `sonner` |
| Date | `date-fns` |
| Auth/DB | `@supabase/supabase-js` |

### Supabase Patterns
```typescript
// Select مع عد
const { data, count } = await supabase
  .from('invoices')
  .select('*, shops(shop_code), customers(full_name)', { count: 'exact' })
  .eq('invoice_month', month)
  .range(0, 19);

// Upsert (إضافة أو تحديث)
const { data, error } = await supabase
  .from('meter_readings')
  .upsert(reading, { onConflict: 'shop_id,reading_month,reading_year' });

// RPC للاستعلامات المعقدة
const { data } = await supabase.rpc('get_customer_statement', {
  p_customer_id: customerId,
  p_from_date: fromDate,
  p_to_date: toDate,
});
```

---

## 📅 الجدول الزمني المقترح

| المرحلة | المدة | الأسابيع | التسليم الرئيسي |
|----------|------|----------|-----------------|
| **0. الإعداد** | 1 أسبوع | 1 | Auth حقيقي، بيئة مستقرة |
| **1. الوحدات الأساسية** | 6 أسابيع | 2-7 | Readings, Invoices, Receipts تعمل |
| **2. التكامل** | 2 أسبوع | 8-9 | Dashboard محدث، الربط كامل |
| **3. التقارير** | 3 أسابيع | 10-12 | 16 تقرير يعمل |
| **4. الإعدادات + المستخدمين** | 2 أسبوع | 13-14 | Settings, Users |
| **5. بوابة المستأجر** | 3 أسابيع | 15-17 | Tenant Portal MVP |
| **6. التحسينات النهائية** | 3 أسابيع | 18-20 | Themes, Excel, Notifications, Backup |
| **المجموع** | **~20 أسبوع** | | **إطلاق v1.0** |

> **ملاحظة:** يمكن تسريع المرحلة 1 بالعمل المتوازي على Readings و Invoices (مطورين منفصلين).

---

## ✅ معايير الجاهزية (Definition of Done)

لكل ميزة تعتبر "مكتملة" عند:
- [ ] الكود يمر `lint` و `type-check` بلا أخطاء
- [ ] يعمل على Mobile/Tablet/Desktop (Responsive)
- [ ] يدعم RTL الكامل مع خط Cairo
- [ ] رسائل خطأ واضحة للمستخدم (Toasts)
- [ ] حالات التحميل (Skeletons/Spinners)
- [ ] حالات الفراغ (Empty States)
- [ ] اختبارات يدوية للسيناريوهات الرئيسية
- [ ] توثيق API في التعليقات (JSDoc للوظائف العامة)

---

## 🚀 خطوات البدء الفورية

### 1. تفعيل المصادقة (أول شيء)
```bash
# في auth-context.tsx: استبدال MOCK_VALUE بـ:
const { data: { session } } = await supabase.auth.getSession();
const { data: { user } } = await supabase.auth.getUser();
```

### 2. إنشاء صفحة `/login` حقيقية
- نموذج بريد/كلمة مرور
- معالجة أخطاء: مستخدم غير موجود، كلمة مرور خاطئة، حساب معطل
- إعادة توجيه للصفحة المطلوبة بعد الدخول

### 3. بدء العمل على `/readings`
- أسهل وحدة للبدء (لا حسابات معقدة)
- تبني الثقة في نمط الكود
- تحتاجها الفواتير لاحقاً

---

## 📝 ملاحظات هامة للفريق

1. **لا تكرر الكود:** استخرج Hooks مشتركة (`useShops`, `useCustomers`, `useMeterTypes`)
2. **Supabase Types:** استخدم `supabase/functions/types.ts` المولد من CLI
3. **RLS:** اختبر السياسات بمستخدمين بأدوار مختلفة
4. **الأداء:** استخدم `select` محدد الأعمدة، لا تجلب `*` في القوائم الكبيرة
5. **الأرقام:** استخدم `formatMoney` و `formatNumber` من `@/lib/format` دائماً
6. **التواريخ:** `date-fns` مع locale `ar-SA` للعرض، ISO للتخزين

---

## 🔗 مراجع مفيدة

- [TanStack Router Docs](https://tanstack.com/router)
- [TanStack Query Docs](https://tanstack.com/query)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Radix UI Primitives](https://www.radix-ui.com/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)

---

> **هذا المستند حي** — يُحدث مع كل مرحلة. الخطوة التالية: ابدأ بالمرحلة 0 (المصادقة) ثم المرحلة 1.1 (القراءات).