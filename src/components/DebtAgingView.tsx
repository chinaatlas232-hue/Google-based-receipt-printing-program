import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, DollarSign, Filter, Hash, RotateCcw, ShieldCheck, Truck, UserCheck } from 'lucide-react';
import { CollectionRecord, ShipmentRecord } from '../types';
import { YARD_INVENTORY_STORAGE_KEY } from './YardInventoryView';

interface DebtAgingViewProps {
  shipments: ShipmentRecord[];
  shipmentOptions?: string[];
  guarantorOptions?: string[];
  codeOptions?: string[];
}

const STORAGE_KEY = 'atlas_debt_collections_v2';
const DEBT_DATES_KEY = 'atlas_debt_registered_at_v1';
const MS_PER_DAY = 86400000;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function todayKey(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDebtDate(value?: string): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoDay = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) {
    const parsed = new Date(Number(isoDay[1]), Number(isoDay[2]) - 1, Number(isoDay[3]));
    return Number.isNaN(parsed.getTime()) ? null : startOfLocalDay(parsed);
  }

  const dmy = trimmed.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) return startOfLocalDay(parsed);
  }

  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : startOfLocalDay(fallback);
}

function toIsoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function debtAgeDays(registeredAt: string | undefined, now: Date): number {
  const start = parseDebtDate(registeredAt);
  if (!start) return 0;
  return Math.max(0, Math.floor((startOfLocalDay(now).getTime() - start.getTime()) / MS_PER_DAY));
}

function bucketForDays(days: number): 'd1' | 'd31' | 'd61' | 'd90' {
  if (days <= 30) return 'd1';
  if (days <= 60) return 'd31';
  if (days <= 90) return 'd61';
  return 'd90';
}

function money(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function readYardEntryDates(): Record<string, string> {
  try {
    const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed?.entryDates && typeof parsed.entryDates === 'object' ? parsed.entryDates : {};
  } catch {
    return {};
  }
}

function readStoredDebtDates(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DEBT_DATES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function resolveDebtRegisteredAt(
  recId: string,
  options: {
    storedDates?: Record<string, string>;
    saved?: CollectionRecord;
    yardEntryDates?: Record<string, string>;
    fallbackToday?: boolean;
  },
): string | undefined {
  const stored = parseDebtDate(options.storedDates?.[recId]);
  if (stored) return toIsoDay(stored);

  const existing = parseDebtDate(options.saved?.debtRegisteredAt);
  if (existing) return toIsoDay(existing);

  const yard = parseDebtDate(options.yardEntryDates?.[recId]);
  if (yard) return toIsoDay(yard);

  if (options.fallbackToday === false) return undefined;
  return todayKey();
}

export const DebtAgingView: React.FC<DebtAgingViewProps> = ({
  shipments,
  shipmentOptions = [],
  guarantorOptions = [],
  codeOptions = [],
}) => {
  const [collectionMap, setCollectionMap] = useState<Record<string, CollectionRecord>>({});
  const [yardEntryDates, setYardEntryDates] = useState<Record<string, string>>({});
  const [debtDates, setDebtDates] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => new Date());
  const [selectedShipment, setSelectedShipment] = useState('الكل');
  const [selectedGuarantor, setSelectedGuarantor] = useState('الكل');
  const [selectedCode, setSelectedCode] = useState('الكل');

  useEffect(() => {
    const loadLocal = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        setCollectionMap(saved ? JSON.parse(saved) : {});
      } catch {
        setCollectionMap({});
      }
      setYardEntryDates(readYardEntryDates());
      setDebtDates(readStoredDebtDates());
      setNow(new Date());
    };

    const loadRemote = async () => {
      try {
        const res = await fetch('/api/yard-inventory');
        if (!res.ok) return;
        const data = await res.json();
        if (data?.success && data.state?.entryDates) {
          setYardEntryDates((prev) => ({ ...data.state.entryDates, ...prev }));
        }
      } catch {
        // local dates remain
      }
    };

    loadLocal();
    loadRemote();
    window.addEventListener('focus', loadLocal);
    window.addEventListener('storage', loadLocal);
    return () => {
      window.removeEventListener('focus', loadLocal);
      window.removeEventListener('storage', loadLocal);
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const next = new Date();
      setNow((prev) => (todayKey(prev) === todayKey(next) ? prev : next));
    };
    const id = window.setInterval(tick, 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!shipments.length) return;
    let changed = false;
    const nextDates = { ...debtDates };

    shipments.forEach((s) => {
      const recId = s.id || `${s.shipment}_${s.code}`;
      const registeredAt = resolveDebtRegisteredAt(recId, {
        storedDates: nextDates,
        saved: collectionMap[recId],
        yardEntryDates,
        fallbackToday: true,
      });
      if (!registeredAt || nextDates[recId] === registeredAt) return;
      nextDates[recId] = registeredAt;
      changed = true;
    });

    if (!changed) return;
    setDebtDates(nextDates);
    try {
      localStorage.setItem(DEBT_DATES_KEY, JSON.stringify(nextDates));
    } catch {
      // ignore quota
    }
  }, [shipments, collectionMap, yardEntryDates, debtDates]);

  const shipmentChoices = useMemo(() => {
    if (shipmentOptions.length) return shipmentOptions;
    return Array.from(new Set(shipments.map((s) => s.shipment).filter(Boolean))).sort();
  }, [shipmentOptions, shipments]);

  const guarantorChoices = useMemo(() => {
    if (guarantorOptions.length) return guarantorOptions;
    return Array.from(new Set(shipments.map((s) => s.guarantor).filter(Boolean))).sort();
  }, [guarantorOptions, shipments]);

  const codeChoices = useMemo(() => {
    if (codeOptions.length) return codeOptions;
    return Array.from(new Set(shipments.map((s) => s.code).filter(Boolean))).sort();
  }, [codeOptions, shipments]);

  const allAgingRows = useMemo(() => {
    return shipments
      .map((s) => {
        const recId = s.id || `${s.shipment}_${s.code}`;
        const saved = collectionMap[recId];
        const payments = Array.isArray(saved?.payments) ? saved.payments : [];
        const totalAmount = Number(s.sales) || 0;
        const collectedAmount = saved?.collectedAmount !== undefined
          ? Number(saved.collectedAmount)
          : payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const remainingAmount = Math.max(0, totalAmount - collectedAmount);
        const registeredAt = resolveDebtRegisteredAt(recId, {
          storedDates: debtDates,
          saved,
          yardEntryDates,
          fallbackToday: true,
        });
        const days = debtAgeDays(registeredAt, now);
        const bucket = bucketForDays(days);
        return {
          id: recId,
          clientName: s.name || '',
          clientCode: s.code || '',
          guarantor: s.guarantor || '',
          shipmentCode: s.shipment || '',
          totalDebt: remainingAmount,
          days,
          registeredAt,
          d1: bucket === 'd1' ? remainingAmount : 0,
          d31: bucket === 'd31' ? remainingAmount : 0,
          d61: bucket === 'd61' ? remainingAmount : 0,
          d90: bucket === 'd90' ? remainingAmount : 0,
        };
      })
      .filter((row) => row.totalDebt > 0);
  }, [shipments, collectionMap, yardEntryDates, debtDates, now]);

  const agingRows = useMemo(() => {
    return allAgingRows.filter((row) => {
      if (selectedShipment !== 'الكل' && row.shipmentCode !== selectedShipment) return false;
      if (selectedGuarantor !== 'الكل' && row.guarantor !== selectedGuarantor) return false;
      if (selectedCode !== 'الكل' && row.clientCode !== selectedCode) return false;
      return true;
    });
  }, [allAgingRows, selectedShipment, selectedGuarantor, selectedCode]);

  const agingStats = useMemo(() => {
    let totalDebt = 0;
    let overdue = 0;
    const defaulting = new Set<string>();
    agingRows.forEach((r) => {
      totalDebt += r.totalDebt;
      const late = r.d31 + r.d61 + r.d90;
      overdue += late;
      if (late > 0) defaulting.add(r.clientCode || r.clientName || r.id);
    });
    return { totalDebt, overdue, defaultingCount: defaulting.size };
  }, [agingRows]);

  const hasActiveFilters =
    selectedShipment !== 'الكل' || selectedGuarantor !== 'الكل' || selectedCode !== 'الكل';

  const resetFilters = () => {
    setSelectedShipment('الكل');
    setSelectedGuarantor('الكل');
    setSelectedCode('الكل');
  };

  const selectClass =
    'w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200/60';

  return (
    <div className="w-full space-y-4" dir="rtl">
      <div className="bg-slate-800 text-white rounded-2xl shadow-md border border-slate-700/60 px-5 py-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
          <Clock className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold font-['Cairo']">أعمار الديون والديون المتأخرة</h2>
          <p className="text-xs text-slate-300 font-bold mt-0.5">
            بيانات Google Sheets — البطاقات والجدول يتحدّثان لحظياً حسب الفلاتر
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-sm p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Filter className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-extrabold">فلاتر البحث</span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-amber-600"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              إعادة ضبط الفلاتر
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <Truck className="w-3.5 h-3.5 text-amber-500" />
              رقم الشحنة
            </span>
            <select
              value={selectedShipment}
              onChange={(e) => setSelectedShipment(e.target.value)}
              className={selectClass}
            >
              <option value="الكل">كافة الشحنات ({shipmentChoices.length})</option>
              {shipmentChoices.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
              الكفيل الضامن
            </span>
            <select
              value={selectedGuarantor}
              onChange={(e) => setSelectedGuarantor(e.target.value)}
              className={selectClass}
            >
              <option value="الكل">كافة الكفلاء ({guarantorChoices.length})</option>
              {guarantorChoices.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <Hash className="w-3.5 h-3.5 text-amber-500" />
              كود العميل
            </span>
            <select
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              className={selectClass}
            >
              <option value="الكل">كافة الأكواد ({codeChoices.length})</option>
              {codeChoices.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي الديون</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-black text-slate-800 dark:text-slate-100 tabular-nums" dir="ltr">
            {money(agingStats.totalDebt)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي الديون المتأخرة</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-black text-rose-700 tabular-nums" dir="ltr">
            {money(agingStats.overdue)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">عدد العملاء المتعثرين</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-black text-slate-800 dark:text-slate-100 tabular-nums">
            {agingStats.defaultingCount}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-800 text-white font-extrabold">
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-3 min-w-[180px]">اسم العميل / الكود</th>
                <th className="py-3 px-3 text-center">رقم الشحنة</th>
                <th className="py-3 px-3 text-left">إجمالي الدين</th>
                <th className="py-3 px-3 text-left">1-30 يوم</th>
                <th className="py-3 px-3 text-left">31-60 يوم</th>
                <th className="py-3 px-3 text-left">61-90 يوم</th>
                <th className="py-3 px-3 text-left">+90 يوم (ديون معدومة/حرجة)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 font-medium text-slate-700 dark:text-slate-200">
              {agingRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 font-bold">
                    لا توجد ديون متبقية لعرض أعمارها.
                  </td>
                </tr>
              ) : (
                agingRows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-3 text-center text-slate-500 font-bold">{index + 1}</td>
                    <td className="py-3 px-3">
                      <div className="font-extrabold text-slate-800 dark:text-slate-100">{row.clientName || '—'}</div>
                      <div className="text-[11px] font-mono font-bold text-amber-700">{row.clientCode}</div>
                    </td>
                    <td className="py-3 px-3 text-center font-black font-mono">{row.shipmentCode}</td>
                    <td className="py-3 px-3 text-left font-black tabular-nums" dir="ltr">{money(row.totalDebt)}</td>
                    <td className="py-3 px-3 text-left tabular-nums" dir="ltr">{row.d1 ? money(row.d1) : '—'}</td>
                    <td className="py-3 px-3 text-left tabular-nums" dir="ltr">{row.d31 ? money(row.d31) : '—'}</td>
                    <td className="py-3 px-3 text-left tabular-nums" dir="ltr">{row.d61 ? money(row.d61) : '—'}</td>
                    <td className={`py-3 px-3 text-left font-black tabular-nums ${row.d90 ? 'text-rose-700' : ''}`} dir="ltr">
                      {row.d90 ? money(row.d90) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
