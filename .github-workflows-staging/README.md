# GitHub Actions Workflows (staged)

ملفات CI/CD جاهزة لكن لا يمكن رفعها تلقائياً لأن صلاحية `workflows` غير ممنوحة لتطبيق GitHub المرتبط.

## طريقة التفعيل (خطوة واحدة)
انقل الملفين إلى مجلد `.github/workflows/` من واجهة GitHub مباشرة:

1. افتح المستودع على GitHub → **Add file → Create new file**
2. اكتب اسم الملف: `.github/workflows/ci.yml` والصق محتوى `ci.yml` من هذا المجلد
3. كرر ذلك مع `codeql.yml`

- **ci.yml** — فحص Lint + TypeScript + Build + Audit عند كل push/PR
- **codeql.yml** — فحص أمني أسبوعي للكود (CodeQL security-extended)
