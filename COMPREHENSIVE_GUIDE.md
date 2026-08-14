# 📚 الدليل الشامل لبناء نظام إدارة الإيجارات — الإصدار 3.0

> **مشروع:** Suite Manager — نظام إيجارات المحلات التجارية والخدمات الشهرية
> **التقنية الحالية:** React 19 + TypeScript + TanStack Start + Supabase (PostgreSQL) + Tailwind CSS v4
> **التقنية في الدليل الأصلي:** React + Node.js/Express + PostgreSQL/Sequelize
> **الحالة:** دمج الدليل الأصلي مع الواقع الحالي للمشروع
> **التاريخ:** يوليو 2025

---

## 🎯 نظرة عامة على النظام

نظام **Web احترافي متكامل** لإدارة الإيجارات والخدمات في المحلات التجارية والمباني. مبني بتقنية حديثة بالكامل:

- **Frontend:** React 19 + TypeScript + TanStack Router (File-based) + TanStack Query
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions)
- **Styling:** Tailwind CSS v4 + Radix UI Primitives + Lucide Icons
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod
- **Notifications:** Sonner

---

## 💻 بيئة التطوير الحالية

```bash
# متطلبات النظام
Node.js       : 18+ (المشروع يستخدم Bun)
Package Mgr   : Bun (bun.lockb موجود)
TypeScript    : 5.8+
Framework     : TanStack Start (Vite-based)
Database      : Supabase (PostgreSQL مُدار)
Auth          : Supabase Auth
Deployment    : Cloudflare Pages / Netlify / Vercel / Docker

# تشغيل المشروع
bun install
bun run dev          # يبدأ على http://localhost:5173
bun run build        # بناء للإنتاج
bun run lint         # فحص الكود
bun run format       # تنسيق Prettier
```

### متغيرات البيئة (.env)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
# مفاتيح الخدمة (للإدمن فقط - لا توضع في الفرونت)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 📁 هيكل المشروع الكامل (الحالي)

```
suite-manager/
├── public/                          # ملفات ثابتة
├── src/
│   ├── components/
│   │   ├── ui/                      # 30+ مكونات Radix UI مغلفة
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── table.tsx
│   │   │   ├── select.tsx
│   │   │   ├── form.tsx             # React Hook Form integration
│   │   │   ├── sonner.tsx           # Toasts
│   │   │   └── ... (30 ملف)
│   │   ├── app-layout.tsx           # Layout رئيسي مع Sidebar
│   │   ├── app-sidebar.tsx          # شريط جانبي مع صلاحيات
│   │   └── coming-soon.tsx          # مكون placeholder
│   ├── hooks/
│   │   └── use-mobile.tsx
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts            # Client للفرونت
│   │       ├── client.server.ts     # Server-side (SSR)
│   │       ├── auth-attacher.ts     # إرفاق JWT
│   │       ├── auth-middleware.ts   # Middleware للمصادقة
│   │       └── types.ts             # Types مولدة من Supabase
│   ├── lib/
│   │   ├── auth-context.tsx         # سياق المصادقة (حالياً Mock)
│   │   ├── format.ts                # formatMoney, formatDate, formatNumber
│   │   └── utils.ts                 # cn() للـ classnames
│   ├── routes/                      # File-based Routing (TanStack Router)
│   │   ├── __root.tsx               # Root layout + Providers
│   │   ├── index.tsx                # Dashboard ✅
│   │   ├── shops.tsx                # المحلات ✅
│   │   ├── customers.tsx            # العملاء ✅
│   │   ├── contracts.tsx            # العقود ✅
│   │   ├── readings.tsx             # قراءات العدادات 🚧
│   │   ├── invoices.tsx             # الفواتير 🚧
│   │   ├── receipts.tsx             # سندات القبض 🚧
│   │   ├── reports.tsx              # التقارير 🚧
│   │   ├── users.tsx                # المستخدمين 🚧
│   │   ├── settings.tsx             # الإعدادات 🚧
│   │   └── login.tsx                # تسجيل الدخول 🚧
│   ├── styles.css                   # Tailwind v4 + متغيرات CSS
│   ├── routeTree.gen.ts             # مولد تلقائي للمسارات
│   ├── router.tsx                   # إعداد الراوتر
│   └── main.tsx                     # نقطة الدخول
├── supabase/
│   └── migrations/
│       ├── 20260423191655_*.sql     # Schema كامل (13 جدول)
│       ├── 20260423191721_*.sql     # Fixes
│       └── 20260503221414_*.sql     # Trigger auth
├── supabase/config.toml             # إعدادات Supabase المحلية
├── package.json
├── tsconfig.json
├── vite.config.ts
├── components.json                  # shadcn/ui config
├── .env
└── BUILD_PLAN.md                    # خطة البناء (هذا الملف)
```

---

## 🗄️ قاعدة البيانات (Supabase PostgreSQL)

### المخطط الكامل (13 جدول)

```sql
-- Enums
app_role: admin, manager, accountant, data_entry, viewer
meter_category: electricity, water
contract_status: active, expired, cancelled
payment_status: unpaid, paid, partial
payment_method: cash, check, transfer

-- Tables
1. profiles           -- بيانات المستخدمين الممددة
2. user_roles         -- أدوار المستخدمين (عديد-لكثير)
3. shops              -- المحلات التجارية
4. customers          -- المستأجرون
5. contracts          -- العقود (تربط محل + عميل)
6. meter_types        -- أنواع العدادات (ثابت + استهلاكي)
7. meter_readings     -- قراءات شهرية (Unique: shop+month+year)
8. invoices           -- الفواتير الشهرية
9. receipts           -- سندات القبض
10. receipt_details   -- توزيع السند على الفواتير
11. additional_charges-- رسوم إضافية على محل/عقد
12. settings          -- إعدادات النظام (صف واحد)
13. audit_log         -- سجل التدقيق
```

### العلاقات الرئيسية
```
shops 1──∞ contracts ∞──1 customers
contracts 1──∞ invoices
shops 1──∞ meter_readings
invoices 1──∞ receipt_details ∞──1 receipts
shops 1──∞ additional_charges
```

### الدوال المساعدة (PostgreSQL Functions)
```sql
has_role(user_id, role)           -- تحقق من دور
get_user_role(user_id)            -- أعلى دور
can_manage(user_id)               -- admin/manager/accountant/data_entry
can_delete(user_id)               -- admin/manager
handle_new_user()                 -- Trigger: إنشاء profile + دور تلقائي
set_updated_at()                  -- Trigger: تحديث updated_at
```

### Row Level Security (RLS)
**مفعل على جميع الجداول** مع سياسات مبنية على الدوال أعلاه:
- `authenticated` يمكنهم القراءة من معظم الجداول
- `can_manage` للإضافة/التعديل
- `can_delete` للحذف (admin/manager فقط)
- `admin` لإدارة الأدوار والإعدادات

---

## 🔐 نظام المصادقة والصلاحيات

### الأدوار الخمسة
| الدور | الصلاحيات | الصفحات |
|-------|-----------|---------|
| **admin** | كل شيء | جميع الصفحات + Users + Settings |
| **manager** | إدارة العمليات | شاملة ما عدا Users |
| **accountant** | مالي فقط | Invoices, Receipts, Reports, Readings |
| **data_entry** | إدخال بيانات | Shops, Customers, Contracts, Readings |
| **viewer** | قراءة فقط | Dashboard, Reports |

### الحالة الحالية
```typescript
// في auth-context.tsx - حالياً Mock (الكل Admin)
const MOCK_VALUE: AuthContextType = {
  user: { id: "dev-user" },
  role: "admin",
  userRole: "admin",
  fullName: "مستخدم تجريبي",
  // ...
};
```

### المطلوب تفعيله
1. `supabase.auth.getSession()` عند التحميل
2. `onAuthStateChange` للاستماع للتغييرات
3. تسجيل دخول حقيقي في `/login`
4. حماية المسارات حسب الدور
5. تسجيل خروج يعمل

---

## 🎨 نظام التصميم

### الوضع
- **Dark Mode افتراضي** (يمكن إضافة Light Mode لاحقاً)
- **RTL كامل** مع خط **Cairo** (الأوزان 400-800)

### الألوان (CSS Variables في `styles.css`)
```css
:root {
  --background: 222.2 84% 4.9%;      /* #0f172a */
  --foreground: 210 40% 98%;         /* أبيض شبه كامل */
  --card: 222.2 84% 7%;              /* بطاقات Glass */
  --primary: 217 91% 60%;            /* أزرق #3b82f6 */
  --success: 142 76% 36%;            /* أخضر #22c55e */
  --warning: 38 92% 50%;             /* برتقالي #f59e0b */
  --destructive: 0 84% 60%;          /* أحمر/وردي #f43f5e */
  --info: 262 83% 58%;               /* بنفسجي #8b5cf6 */
  --sidebar: 222 84% 5%;             /* شريط جانبي */
}
```

### مكونات UI المشتركة (في `components/ui/`)
| المكون | الاستخدام |
|---------|----------|
| `Button` | جميع الأزرار (variant: default, outline, ghost, destructive) |
| `Card` | حاويات المحتوى |
| `Dialog` | نوافذ الإضافة/التعديل |
| `AlertDialog` | تأكيد الحذف |
| `Table` | جداول البيانات |
| `Select` | قوائم منسدلة |
| `Form` | تكامل React Hook Form + Zod |
| `Badge` | حالات (نشط/معطل، مدفوع/غير مدفوع) |
| `Input` / `Textarea` | حقول الإدخال |
| `Tooltip` / `Popover` | تلميحات |
| `Pagination` | تقسيم الصفحات |
| `Sonner` | إشعارات Toast |

---

## 📦 المكتبات المثبتة

### الإنتاج (Dependencies)
```json
{
  "@tanstack/react-router": "^1.168",      // Routing
  "@tanstack/react-query": "^5.100",       // Data fetching
  "@tanstack/react-start": "^1.167",       // Full-stack framework
  "@supabase/supabase-js": "^2.104",       // Database + Auth
  "react": "^19.2", "react-dom": "^19.2",
  "react-hook-form": "^7.71",              // Forms
  "zod": "^3.24",                          // Validation
  "tailwindcss": "^4.2",                   // Styling
  "@radix-ui/*": "^1.x",                   // 30+ UI primitives
  "lucide-react": "^0.575",                // Icons
  "recharts": "^2.15",                     // Charts
  "sonner": "^2.0",                        // Toasts
  "date-fns": "^4.1",                      // Dates
  "clsx": "^2.1", "tailwind-merge": "^3.5" // Class utilities
}
```

### التطوير (DevDependencies)
```json
{
  "typescript": "^5.8",
  "vite": "^7.3",
  "@vitejs/plugin-react": "^5.0",
  "eslint": "^9.32", "prettier": "^3.7",
  "@tanstack/router-plugin": "^1.167"      // Codegen للـ routes
}
```

---

## 📊 ميزات كل صفحة (الحالية والمستقبلية)

### ✅ المكتملة (المرحلة 0)

#### 1. Dashboard (`/`)
- إحصائيات: محلات نشطة/إجمالية، عملاء، عقود سارية، فواتير الشهر
- بطاقات مالية: إيرادات الشهر، محصل، مستحق
- تنبيهات: فواتير غير مسددة، عقود تنتهي خلال 30 يوم
- إجراءات سريعة: إضافة محل/عميل/عقد/قراءة/سند

#### 2. المحلات (`/shops`) — مكتمل 100%
- قائمة مع بحث (كود/اسم) وفلترة (نشط/معطل) وتقسيم صفحات
- لوحة تفاصيل جانبية: معلومات، عدادات، عقد ساري
- إضافة/تعديل/حذف/تفعيل مع التحقق من البيانات المرتبطة
- منطق أنواع العدادات: استهلاكي / ثابت / بدون عداد
- نافذة منبثقة موحدة للإضافة والتعديل

#### 3. العملاء (`/customers`) — مكتمل 100%
- بطاقات عرض (Grid) مع بحث وفلترة
- إضافة/تعديل/حذف/تفعيل
- تحقق من العقود المرتبطة قبل الحذف

#### 4. العقود (`/contracts`) — مكتمل 100%
- جدول مع بحث برقم العقد وفلترة حسب الحالة
- إنشاء عقد: اختيار محل شاغر + عميل + تواريخ + إيجار + زيادة عيد
- تحقق: لا يمكن إنشاء عقدين لمحل واحد في فترة متداخلة
- تعديل/حذف (يمنع الحذف إذا له فواتير)

---

### 🚧 قيد البناء (المرحلة 1)

#### 5. قراءات العدادات (`/readings`)
**المتطلبات:**
- جدول المحلات مع أعمدة: قراءة سابقة، حالية، استهلاك (لكل من كهرباء وماء)
- حالة القراءة: ✅ مكتمل / ⏳ معلق / 🔴 متأخر
- إدخال/تعديل في صف واحد (Inline أو Modal)
- **ترحيل شهري:** نسخ قراءات الشهر الماضي كسابقة للشهر الجديد
- **إلغاء الترحيل:** لقراءة واحدة أو كلها
- فلترة: شهر/سنة، حالة، بحث
- تصدير Excel

#### 6. الفواتير (`/invoices`)
**المتطلبات:**
- قائمة مع فلترة شهر/سنة، حالة دفع، بحث
- **إنشاء دفعي (Bulk):** لجميع المحلات ذات عقود سارية
- **معاينة قبل الإنشاء:** ملخص المبالغ
- حساب تلقائي كامل:
  - إيجار من العقد
  - زيادة عيد من العقد
  - كهرباء: استهلاك × سعر (أو ثابت)
  - ماء: استهلاك × سعر (أو ثابت)
  - رصيد سابق من آخر فاتورة غير مدفوعة
  - رسوم إضافية
- رقم فاتورة: `INV-{YYYY}{MM}-{SEQ}`
- تغيير حالة دفع: غير مدفوعة / مدفوعة / جزئية
- عرض تفاصيل، حذف (مع تحقق)

#### 7. سندات القبض (`/receipts`)
**المتطلبات:**
- إنشاء سند: اختيار عميل → عرض فواتيره المستحقة
- توزيع المبلغ على فواتير محددة
- طرق دفع: نقدي / شيك (رقم، تاريخ، بنك) / تحويل (مرجع)
- رقم سند: `RCP-{YYYY}{MM}-{SEQ}`
- تحديث تلقائي للفواتير المرتبطة
- قائمة السندات مع فلترة
- طباعة سند احترافية

---

### 🚧 قيد البناء (المرحلة 2)

#### 8. التقارير (`/reports`) — 16 تقرير
| # | التقرير | الفئة |
|---|----------|-------|
| 1 | الإيجارات الشهرية | أساسي |
| 2 | استهلاك الكهرباء | أساسي |
| 3 | استهلاك المياه | أساسي |
| 4 | التقرير الإجمالي الشامل | أساسي |
| 5 | كشف حساب عميل | عملاء |
| 6 | قائمة العملاء | عملاء |
| 7 | أرصدة العملاء | عملاء |
| 8 | العملاء ذوو الزيادات | عملاء |
| 9 | الفواتير غير المسددة | مالي |
| 10 | الإيرادات السنوية | مالي |
| 11 | مقارنة الفترات | تحليلي |
| 12 | أداء المحلات | تحليلي |
| 13 | تحليل الاستهلاك | تحليلي |
| 14 | العقود السارية | عقود |
| 15 | العقود قاربت الانتهاء | عقود |
| 16 | حالة المحلات | عقود |

**ميزات موحدة:**
- فلاتر سياقية
- عرض في الصفحة + ترقيم
- طباعة (`window.open` مع CSS print)
- تصدير CSV
- ترويسة احترافية (شعار + عنوان + توقيعات من الإعدادات)

#### 9. الإعدادات (`/settings`)
- بيانات الشركة + رفع شعار (Supabase Storage)
- أسعار الوحدات (كهرباء 3طور/عادي، ماء، رسوم ثابتة)
- إعدادات الفاتورة/التقرير (عناوين، ألوان، توقيعات، حجم ورق)
- النسخ الاحتياطي: إنشاء/تحميل/استعادة/حذف

#### 10. المستخدمين (`/users`) — للـ Admin فقط
- قائمة من `auth.users` + `profiles` + `user_roles`
- دعوة مستخدم جديد (Supabase Admin API)
- تعيين دور، تفعيل/إيقاف، آخر دخول

---

### 🆕 ميزات جديدة مقترحة (المرحلة 3)

#### 11. بوابة المستأجر (`/tenant/*`)
- تسجيل دخول منفصل (OTP أو كلمة مرور)
- لوحة معلومات: فاتورة حالية، مستحق، حالة
- قائمة الفواتير + تحميل PDF
- كشف حساب تراكمي (مدين/دائن/رصيد)
- الملف الشخصي
- **اختياري:** تقديم قراءة عداد مع صورة

#### 12. التحسينات المتقدمة
- نظام ثيمات (Dark/Light/Blue/Green/Purple)
- تصدير Excel حقيقي (`exceljs`)
- مصفوفة صلاحيات مفصلة
- نسخ احتياطي تلقائي مجدول (pg_cron)
- إشعارات بريد إلكتروني (Edge Functions + Resend)
- طباعة محسنة (A4/A5)

---

## 🔧 قواعد مهمة للمطور (محدثة للتقنية الحالية)

### 1. نمط الاستعلامات في Supabase
```typescript
// ✅ صحيح: تحديد الأعمدة، استخدام count، ترقيم
const { data, count, error } = await supabase
  .from('invoices')
  .select('id, invoice_no, total_amount, payment_status, shops(shop_code), customers(full_name)', { count: 'exact' })
  .eq('invoice_month', month)
  .eq('invoice_year', year)
  .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  .order('created_at', { ascending: false });

// ❌ خطأ: جلب كل الأعمدة بدون ترقيم
const { data } = await supabase.from('invoices').select('*');
```

### 2. Upsert للقراءات (Unique Constraint)
```typescript
// meter_readings لها unique على (shop_id, reading_month, reading_year)
await supabase
  .from('meter_readings')
  .upsert({
    shop_id,
    reading_month,
    reading_year,
    elec_current_reading,
    elec_previous_reading,
    water_current_reading,
    water_previous_reading,
  }, { onConflict: 'shop_id,reading_month,reading_year' });
```

### 3. React Query Keys موحدة
```typescript
// في lib/query-keys.ts
export const queryKeys = {
  shops: (filters: ShopFilters) => ['shops', filters] as const,
  shop: (id: string) => ['shop', id] as const,
  invoices: (filters: InvoiceFilters) => ['invoices', filters] as const,
  dashboardStats: () => ['dashboard-stats'] as const,
};

// الاستخدام
useQuery({ queryKey: queryKeys.invoices({ month, year }), queryFn: fetchInvoices });
```

### 4. Mutations مع Invalidation
```typescript
const mutation = useMutation({
  mutationFn: createInvoice,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['shops'] }); // لتحديث حالة القراءة
  },
});
```

### 5. التعامل مع الأرقام
```typescript
// استخدم دوال التنسيق من lib/format.ts
import { formatMoney, formatNumber } from '@/lib/format';

formatMoney(1234567.5);  // "1,234,567.50 ريال"
formatNumber(1234);      // "1,234"
```

### 6. التواريخ
```typescript
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

format(new Date(), 'yyyy/MM/dd', { locale: arSA });  // "2025/01/15"
format(new Date(), 'MMMM yyyy', { locale: arSA });   // "يناير 2025"
```

### 7. مكونات الصفحة - نمط موحد
```typescript
// كل صفحة: List Component + Dialog Component
function ShopsPage() {
  return <AppLayout><ShopsList /></AppLayout>;
}

function ShopsList() {
  // State, Queries, Mutations
  return (
    <div className="space-y-4">
      {/* Header + Actions */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Sidebar: List + Filters */}
        {/* Main: Details / Empty State */}
      </div>
      {/* Dialogs */}
    </div>
  );
}
```

### 8. حماية المسارات حسب الدور
```typescript
// في AppLayout (مطبق في Sidebar)
const visibleItems = NAV_ITEMS.filter(item => {
  if (!item.roles) return true;
  return role && item.roles.includes(role);
});

// للصفحات الحساسة: تحقق في المكون أيضاً
if (!canManage(role)) return <AccessDenied />;
```

---

## 🚀 خطوات البدء الفورية

### 1. تفعيل المصادقة الحقيقية (أولوية قصوى)
```bash
# في src/lib/auth-context.tsx
# استبدل MOCK_VALUE بـ:
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      // جلب الدور من user_roles
      fetchUserRole(session.user.id);
    }
    setSession(session);
    setLoading(false);
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    // تحديث الحالة
  });
  return () => subscription.unsubscribe();
}, []);
```

### 2. إنشاء صفحة `/login` حقيقية
```tsx
// src/routes/login.tsx
export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const form = useForm<LoginForm>({ resolver: zodResolver(schema) });
  
  const mutation = useMutation({
    mutationFn: (data) => supabase.auth.signInWithPassword(data),
    onSuccess: () => navigate({ to: '/' }),
  });
  
  return (
    <form onSubmit={form.handleSubmit(mutation.mutate)}>
      {/* Email + Password + Submit */}
    </form>
  );
}
```

### 3. البدء بـ `/readings` (أسهل وحدة)
1. إنشاء `src/routes/readings.tsx` حقيقي (بدل ComingSoon)
2. استنساخ نمط `shops.tsx`: List + Details + Dialog
3. Query لجلب المحلات مع آخر قراءة لكل محل
4. Mutation للـ Upsert قراءة
5. زر "ترحيل القراءات" (نسخ من شهر لآخر)

---

## 📅 خارطة الطريق الملخصة

| المرحلة | المدة | الوحدات | التسليم |
|----------|------|---------|---------|
| **0. Auth** | 1 أسبوع | Login, Roles, Guards | مصادقة تعمل |
| **1. Core Ops** | 6 أسابيع | Readings, Invoices, Receipts | دورة إيرادات كاملة |
| **2. Integration** | 2 أسبوع | Dashboard, Cross-links | نظام متكامل |
| **3. Reports** | 3 أسابيع | 16 Report + Export | تقارير احترافية |
| **4. Admin** | 2 أسبوع | Settings, Users | إدارة النظام |
| **5. Tenant Portal** | 3 أسابيع | Tenant App | بوابة ذاتية |
| **6. Polish** | 3 أسابيع | Themes, Excel, Notifs, Backup | منتج جاهز |

**المجموع: ~20 أسبوع (5 أشهر) لإطلاق v1.0 كامل**

---

## 🔗 مراجع وملفات مهمة

| الملف | الوصف |
|--------|-------|
| `supabase/migrations/20260423191655_*.sql` | Schema كامل مع RLS |
| `src/integrations/supabase/types.ts` | Types مولدة من Supabase |
| `src/lib/format.ts` | دوال تنسيق موحدة |
| `src/components/ui/*.tsx` | مكتبة مكونات UI |
| `BUILD_PLAN.md` | خطة البناء التفصيلية |
| `COMPREHENSIVE_GUIDE.md` | هذا الملف |

---

> **ملاحظة:** هذا الدليل يدمج مواصفات الدليل الأصلي (Express + Sequelize) مع الواقع الحالي (Supabase + TanStack Start). جميع متطلبات قاعدة البيانات والمنطق التجاري متطابقة؛ الاختلاف فقط في طبقة الـ API (Supabase Client بدل Express Controllers).

**الخطوة التالية:** ابدأ بتنفيذ **المرحلة 0 — تفعيل المصادقة** ثم **المرحلة 1.1 — قراءات العدادات**.