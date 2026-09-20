import React, { useEffect, useMemo, useState } from 'react';
import { Save, CheckCircle2, AlertCircle } from 'lucide-react';

type CurrencyCode = 'USD' | 'IQD';

interface ExpenseItemDef {
  id: string;
  label: string;
}

interface ExpenseStageDef {
  id: string;
  label: string;
  items: ExpenseItemDef[];
}

interface ExpenseRowValue {
  cost: string;
  currency: CurrencyCode;
  notes: string;
}

const STAGES: ExpenseStageDef[] = [
  {
    id: 'china',
    label: 'في الصين (بلد المنشأ)',
    items: [
      { id: 'china_inland', label: 'النقل الداخلي' },
      { id: 'china_export_clearance', label: 'التخليص الجمركي للتصدير' },
      { id: 'china_port_handling', label: 'رسوم المناولة في الميناء' },
      { id: 'china_docs', label: 'إصدار المستندات' },
    ],
  },
  {
    id: 'international',
    label: 'الشحن الدولي',
    items: [
      { id: 'intl_ocean_freight', label: 'أجور الشحن البحري' },
      { id: 'intl_marine_insurance', label: 'التأمين البحري' },
    ],
  },
  {
    id: 'iraq_port',
    label: 'في العراق (ميناء أم قصر)',
    items: [
      { id: 'iq_delivery_order', label: 'إذن التسليم' },
      { id: 'iq_unload_handling', label: 'رسوم التفريغ والمناولة' },
      { id: 'iq_customs_tax', label: 'التخليص الجمركي والضرائب' },
      { id: 'iq_demurrage', label: 'أجور الأرضيات والتأخير' },
    ],
  },
  {
    id: 'iraq_inland',
    label: 'النقل الداخلي (داخل العراق)',
    items: [
      { id: 'iq_road_transport', label: 'أجور النقل البري' },
      { id: 'iq_unloading', label: 'أجور التفريغ' },
      { id: 'iq_container_wash_return', label: 'غسيل وإرجاع الحاوية' },
    ],
  },
  {
    id: 'admin',
    label: 'مصاريف إدارية (متفرقة)',
    items: [
      { id: 'admin_broker', label: 'أجور المُخلص الجمركي' },
      { id: 'admin_bank_fees', label: 'العمولات البنكية وأجور الحوالات' },
    ],
  },
];

const ALL_ITEMS = STAGES.flatMap((stage) =>
  stage.items.map((item) => ({ stageId: stage.id, stageLabel: stage.label, ...item }))
);

const STORAGE_KEY = 'atlas_container_expenses_v1';

function emptyRow(): ExpenseRowValue {
  return { cost: '', currency: 'USD', notes: '' };
}

function defaultRows(): Record<string, ExpenseRowValue> {
  return Object.fromEntries(ALL_ITEMS.map((item) => [item.id, emptyRow()]));
}

function parseCost(value: string): number {
  const cleaned = String(value ?? '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[^\d.]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(value: number, currency: CurrencyCode): string {
  const formatted = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === 'IQD' ? `${formatted} د.ع` : `$${formatted}`;
}

function sanitizeCostInput(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[^\d.]/g, '')
    .replace(/(\..*)\./g, '$1');
}

export const ContainerExpensesSheet: React.FC = () => {
  const [rows, setRows] = useState<Record<string, ExpenseRowValue>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultRows();
      const parsed = JSON.parse(raw);
      const next = defaultRows();
      if (parsed?.rows && typeof parsed.rows === 'object') {
        ALL_ITEMS.forEach((item) => {
          const saved = parsed.rows[item.id];
          if (!saved) return;
          next[item.id] = {
            cost: String(saved.cost ?? ''),
            currency: saved.currency === 'IQD' ? 'IQD' : 'USD',
            notes: String(saved.notes ?? ''),
          };
        });
      }
      return next;
    } catch {
      return defaultRows();
    }
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const totals = useMemo(() => {
    return ALL_ITEMS.reduce(
      (acc, item) => {
        const row = rows[item.id] ?? emptyRow();
        const amount = parseCost(row.cost);
        if (row.currency === 'IQD') acc.iqd += amount;
        else acc.usd += amount;
        return acc;
      },
      { usd: 0, iqd: 0 }
    );
  }, [rows]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 4000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const updateRow = (id: string, patch: Partial<ExpenseRowValue>) => {
    setRows((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyRow()), ...patch },
    }));
  };

  const buildPayload = () => {
    const items = ALL_ITEMS.map((item) => {
      const row = rows[item.id] ?? emptyRow();
      return {
        id: item.id,
        stage: item.stageLabel,
        item: item.label,
        cost: parseCost(row.cost),
        costRaw: row.cost,
        currency: row.currency,
        notes: row.notes.trim(),
      };
    });
    return {
      sheet: 'container_expenses',
      savedAt: new Date().toISOString(),
      rows: Object.fromEntries(items.map((item) => [item.id, item])),
      items,
      grandTotal: {
        usd: totals.usd,
        iqd: totals.iqd,
      },
    };
  };

  const handleSave = async () => {
    const payload = buildPayload();
    setSaving(true);
    setStatus(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      const res = await fetch('/api/container-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses: payload }),
      });
      if (!res.ok) throw new Error('save_failed');
      const data = await res.json().catch(() => ({ success: false }));
      if (!data?.success) throw new Error('save_failed');
      setStatus({ type: 'success', message: 'تم حفظ تعديلات مصاريف الحاويات' });
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setStatus({ type: 'error', message: 'حُفظ محلياً. تعذر الإرسال إلى الخادم حالياً' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold">مصاريف الحاويات</h3>
        <p className="text-[11px] font-bold text-slate-300">أدخل التكلفة والملاحظات لكل بند — الإجمالي يتحدث فورياً</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm text-right">
          <thead className="bg-[#1e3a5f] text-white text-xs">
            <tr>
              <th className="px-3 py-3 font-extrabold w-[22%]">المرحلة الرئيسية</th>
              <th className="px-3 py-3 font-extrabold w-[24%]">نوع المصروف / البند</th>
              <th className="px-3 py-3 font-extrabold w-[22%]">السعر / التكلفة</th>
              <th className="px-3 py-3 font-extrabold">الملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {STAGES.map((stage) =>
              stage.items.map((item, index) => {
                const row = rows[item.id] ?? emptyRow();
                return (
                  <tr key={item.id} className="border-t border-slate-100 dark:border-slate-700">
                    {index === 0 && (
                      <td
                        rowSpan={stage.items.length}
                        className="px-3 py-3 align-top font-black text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-[#171717] border-l border-slate-100 dark:border-slate-700"
                      >
                        {stage.label}
                      </td>
                    )}
                    <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200">{item.label}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="relative flex-1">
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-black text-amber-600">
                            {row.currency === 'IQD' ? 'د.ع' : '$'}
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.cost}
                            onChange={(e) => updateRow(item.id, { cost: sanitizeCostInput(e.target.value) })}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] pr-10 pl-2 py-2 text-sm font-black tabular-nums text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
                            placeholder="0.00"
                          />
                        </div>
                        <select
                          value={row.currency}
                          onChange={(e) => updateRow(item.id, { currency: e.target.value as CurrencyCode })}
                          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#121212] px-2 py-2 text-[11px] font-black text-slate-700 dark:text-slate-200 outline-none"
                        >
                          <option value="USD">$</option>
                          <option value="IQD">د.ع</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        maxLength={120}
                        value={row.notes}
                        onChange={(e) => updateRow(item.id, { notes: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-amber-500"
                        placeholder="رقم الوصل، اسم الجهة المستلمة..."
                      />
                    </td>
                  </tr>
                );
              })
            )}
            <tr className="border-t-2 border-slate-800 bg-amber-50 dark:bg-amber-500/10">
              <td colSpan={2} className="px-3 py-3 font-black text-slate-900 dark:text-slate-100">
                الإجمالي الكلي (Grand Total)
              </td>
              <td colSpan={2} className="px-3 py-3 font-black tabular-nums text-slate-900 dark:text-amber-300">
                <div className="flex flex-wrap gap-3">
                  <span>{formatMoney(totals.usd, 'USD')}</span>
                  <span>{formatMoney(totals.iqd, 'IQD')}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
        {status ? (
          <div
            className={`inline-flex items-center gap-2 text-xs font-bold ${
              status.type === 'success' ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            {status.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {status.message}
          </div>
        ) : (
          <span className="text-[11px] font-bold text-slate-400">يُحفظ الجدول ككائن JSON ويرسل إلى مسار الحفظ المعتمد</span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2.5 text-sm font-black disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>
    </div>
  );
};
