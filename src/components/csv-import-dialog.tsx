import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, Download, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export interface CsvImportRow {
  rowNumber: number;
  values: Record<string, string>;
  error?: string;
}

interface CsvImportDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  headers: string[];
  headerAliases?: Record<string, string>;
  previewColumns: string[];
  parseRow: (row: Record<string, string>, rowNumber: number) => { value?: T; error?: string };
  onImport: (rows: T[]) => Promise<void>;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell.trim());
      cell = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function downloadTemplate(headers: string[], title: string, format: "csv" | "xlsx") {
  const filename = `${title.replace(/\s+/g, "-")}-template`;
  if (format === "xlsx") {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Import");
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    return;
  }
  const blob = new Blob(["\uFEFF" + headers.join(",") + "\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CsvImportDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  headers,
  headerAliases = {},
  previewColumns,
  parseRow,
  onImport,
}: CsvImportDialogProps<T>) {
  const [rows, setRows] = useState<CsvImportRow[]>([]);
  const [validRows, setValidRows] = useState<T[]>([]);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const errors = useMemo(() => rows.filter((row) => row.error), [rows]);

  function reset() {
    setRows([]);
    setValidRows([]);
    setReading(false);
    setImporting(false);
  }
  function close(next: boolean) {
    if (!next && !importing) {
      reset();
      onOpenChange(false);
    } else onOpenChange(next);
  }
  async function readFile(file?: File) {
    if (!file) return;
    const filename = file.name.toLowerCase();
    if (!filename.endsWith(".csv") && !filename.endsWith(".xlsx") && !filename.endsWith(".xls")) {
      toast.error("يرجى اختيار ملف CSV أو Excel بصيغة XLSX");
      return;
    }
    setReading(true);
    try {
      let raw: string[][];
      if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) throw new Error("ملف Excel لا يحتوي على ورقة عمل");
        raw = (
          XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "", raw: false }) as unknown[][]
        ).map((line) => line.map((cell) => String(cell ?? "").trim()));
      } else {
        raw = parseCsv(await file.text());
      }
      if (raw.length < 2) throw new Error("الملف يجب أن يحتوي على صف العناوين وصف واحد على الأقل");
      const headerRow = raw[0].map((header) => headerAliases[header.trim()] ?? header.trim());
      const missing = headers.filter((header) => !headerRow.includes(header));
      if (missing.length) throw new Error(`الأعمدة المطلوبة مفقودة: ${missing.join("، ")}`);
      const parsed: CsvImportRow[] = [];
      const values: T[] = [];
      raw.slice(1).forEach((line, index) => {
        const rowNumber = index + 2;
        const record = Object.fromEntries(
          headerRow.map((header, col) => [header, line[col] ?? ""]),
        );
        const result = parseRow(record, rowNumber);
        parsed.push({ rowNumber, values: record, error: result.error });
        if (result.value && !result.error) values.push(result.value);
      });
      setRows(parsed);
      setValidRows(values);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر قراءة الملف");
      reset();
    } finally {
      setReading(false);
    }
  }
  async function importRows() {
    if (!validRows.length || errors.length) return;
    setImporting(true);
    try {
      await onImport(validRows);
      toast.success(`✅ تم استيراد ${validRows.length} صف بنجاح`);
      close(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل الاستيراد ولم يتم اعتماد البيانات");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent dir="rtl" className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadTemplate(headers, title, "csv")}
            >
              <Download className="h-4 w-4 ml-1" />
              تحميل قالب CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadTemplate(headers, title, "xlsx")}
            >
              <Download className="h-4 w-4 ml-1" />
              تحميل قالب Excel
            </Button>
            <Input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              disabled={reading || importing}
              onChange={(event) => void readFile(event.target.files?.[0])}
              className="max-w-sm"
            />
          </div>
          {reading && (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              جارٍ تحليل الملف...
            </div>
          )}
          {rows.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="p-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>
                    صفوف صالحة: <strong>{validRows.length}</strong>
                  </span>
                </Card>
                <Card className="p-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>
                    صفوف مرفوضة: <strong>{errors.length}</strong>
                  </span>
                </Card>
                <Card className="p-3">
                  <span>
                    الإجمالي: <strong>{rows.length}</strong>
                  </span>
                </Card>
              </div>
              <div className="max-h-72 overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-right">السطر</th>
                      {previewColumns.map((column) => (
                        <th key={column} className="p-2 text-right">
                          {column}
                        </th>
                      ))}
                      <th className="p-2 text-right">التحقق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((row) => (
                      <tr key={row.rowNumber} className="border-t">
                        <td className="p-2">{row.rowNumber}</td>
                        {previewColumns.map((column) => (
                          <td key={column} className="p-2 max-w-48 truncate">
                            {row.values[column] || "—"}
                          </td>
                        ))}
                        <td
                          className={`p-2 ${row.error ? "text-destructive" : "text-emerald-700"}`}
                        >
                          {row.error || "صالح"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 100 && (
                <p className="text-xs text-muted-foreground">
                  تم عرض أول 100 صف فقط؛ سيتم التحقق من جميع الصفوف.
                </p>
              )}
              {errors.length > 0 && (
                <p className="text-sm text-destructive">
                  لا يمكن اعتماد الاستيراد قبل إصلاح الصفوف المرفوضة وإعادة رفع الملف.
                </p>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={importing}>
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={() => void importRows()}
            disabled={importing || reading || !validRows.length || errors.length > 0}
          >
            {importing && <Loader2 className="h-4 w-4 animate-spin ml-2" />}تأكيد الاستيراد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
