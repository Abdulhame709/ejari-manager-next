# النسخ اليومي المشفر إلى Google Drive

أضيف إلى المستودع مسار تشغيل يومي في GitHub Actions باسم **Daily encrypted Supabase backup**. يعمل المسار تلقائياً الساعة 02:30 UTC، ويمكن تشغيله يدوياً من تبويب Actions. ينشئ نسخة PostgreSQL منطقية بصيغة `pg_dump custom`، يشفرها بخوارزمية AES-256 قبل الرفع، ويرفع معها ملف manifest يتضمن الحجم والتجزئة SHA-256.

## الإعداد مرة واحدة

أضف الأسرار التالية إلى مستودع GitHub من **Settings → Secrets and variables → Actions**:

| الاسم | المحتوى |
|---|---|
| `SUPABASE_DB_URL` | رابط اتصال PostgreSQL المباشر لمشروع Supabase، مع كلمة المرور. لا تستخدم مفتاح anon أو service-role مكانه. |
| `BACKUP_ENCRYPTION_PASSPHRASE` | عبارة قوية طويلة لحماية النسخ. تحفظ خارج GitHub ولا تضعها في المستودع. |
| `RCLONE_CONFIG_CONTENT` | محتوى إعداد rclone الذي يعرّف remote باسم `manus_google_drive` لنفس حساب Google Drive. |

يمكن ضبط المتغير الاختياري `GDRIVE_BACKUP_PATH`، وقيمته الافتراضية:

```text
manus_google_drive:Ejari Manager Backups
```

يجب أن يكون remote من نوع Google Drive، وأن يمنح حساب النسخ صلاحية الكتابة إلى مجلد النسخ فقط قدر الإمكان. لا تُرفع كلمات المرور أو مفاتيح Supabase إلى Google Drive؛ الملفات المرفوعة مشفرة، وملف manifest لا يحتوي بيانات عملاء.

## سياسة الاحتفاظ

يحتفظ المسار بنسخ يومية لمدة 35 يوماً، ونسخة شهرية في أول يوم من كل شهر لمدة 365 يوماً، ونسخة سنوية في أول يوم من السنة لمدة 2555 يوماً تقريباً. التنظيف محصور داخل مجلد النسخ المحدد، ولا يستخدم حذفاً دائماً خارج هذا المسار.

## التحقق بعد الإعداد

شغّل workflow يدوياً مرة واحدة، ثم تحقق من ظهور ملفي `.dump.gpg` و`.manifest.json` داخل مجلد `daily`. طابق قيمة `sha256` في manifest مع الملف المرفوع، ثم نفذ تمرين استعادة ربع سنوي في مشروع Supabase منفصل. لا تختبر الاستعادة فوق الإنتاج.

لفك التشفير والاستعادة في بيئة اختبار فقط:

```bash
gpg --batch --pinentry-mode loopback --passphrase-file /secure/passphrase.txt \
  --output ejari-restored.dump --decrypt ejari-supabase-YYYY-MM-DDTHH-MM-SSZ.dump.gpg
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname="$TEST_SUPABASE_DB_URL" ejari-restored.dump
```

تظل النسخ المنطقية منفصلة عن كائنات Supabase Storage وإعدادات Auth. لذلك يجب تنفيذ فهرسة Storage واستعادة إعدادات Auth وفق السياسة التشغيلية الموجودة في `BACKUP_RESTORE_RETENTION_POLICY.md` قبل اعتبار تمرين الاستعادة مكتملاً.
