import React, { useEffect, useMemo, useState } from 'react';
import { Plane, Ship, X, Save, ChevronDown, ChevronUp, Banknote, ArrowLeftRight, RefreshCw, Landmark, FileSpreadsheet, FileText, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import { CashSafeType, CashTransaction } from '../types';
import { toLatinDigits } from './YardInventoryView';

let amiriFontBase64: string | null = null;

function hasArabic(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

function reshapeArabic(convertArabic: (value: string) => string, value: string): string {
  const text = String(value ?? '');
  if (!text) return text;
  const reshaped = convertArabic(text);
  if (!hasArabic(text)) return text;
  return reshaped
    .split(' ')
    .map((word) => (hasArabic(word) ? word.split('').reverse().join('') : word))
    .reverse()
    .join(' ');
}

async function loadAmiriFontBase64(): Promise<string> {
  if (amiriFontBase64) return amiriFontBase64;
  const res = await fetch('/fonts/Amiri-Regular.ttf');
  if (!res.ok) throw new Error('تعذر تحميل الخط العربي');
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  amiriFontBase64 = btoa(binary);
  return amiriFontBase64;
}

interface CashRegisterViewProps {
  userName: string;
  canEdit?: boolean;
}

export const CASH_REGISTER_STORAGE_KEY = 'atlas_cash_register_v1';
export const CASH_REGISTER_EVENT = 'atlas-cash-register-updated';
const STORAGE_KEY = CASH_REGISTER_STORAGE_KEY;
const COLLECTIONS_STORAGE_KEY = 'atlas_debt_collections_v2';
const INVENTORY_STORAGE_KEY = 'atlas_cash_inventory_v1';
const IQD_DENOMS = [50000, 25000, 10000, 5000, 1000] as const;
const IQD_ROW_CLASSES: Record<number, string> = {
  50000: 'bg-rose-50',
  25000: 'bg-emerald-50',
  10000: 'bg-sky-50',
  5000: 'bg-amber-50',
  1000: 'bg-slate-50',
};

type SafeTab = CashSafeType;

interface FinanceDetail {
  id: string;
  amount: string;
  recipient: string;
  formNo: string;
  evidence: string;
  evidenceName: string;
  payDate: string;
  notes: string;
}

interface SafeInventory {
  counts: Record<number, number>;
  paidOut: number;
  otherUsd: number;
  exchangeRate: number;
  details: FinanceDetail[];
}

interface InventoryState {
  air: SafeInventory;
  sea: SafeInventory;
}

function emptyInventory(): SafeInventory {
  return {
    counts: { 50000: 0, 25000: 0, 10000: 0, 5000: 0, 1000: 0 },
    paidOut: 0,
    otherUsd: 0,
    exchangeRate: 0,
    details: [],
  };
}

function defaultInventory(): InventoryState {
  return { air: emptyInventory(), sea: emptyInventory() };
}

export function detectSafeType(shipment: string, fallbackType?: string): CashSafeType | null {
  const code = toLatinDigits(shipment || '').trim().toUpperCase().replace(/\s+/g, '');
  if (/\bRA\d/i.test(code) || code.startsWith('RA')) return 'air';
  if (/\bRQ\d/i.test(code) || code.startsWith('RQ')) return 'sea';
  const t = toLatinDigits(fallbackType || '').trim().toLowerCase();
  if (t.includes('جوي') || t.includes('air')) return 'air';
  if (t.includes('بحري') || t.includes('sea')) return 'sea';
  return 'air';
}

function formatAmount(value: number): string {
  return `$ ${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

function formatIqd(value: number): string {
  return value.toLocaleString('en-US');
}

function parseMoneyAmount(value: string | number | null | undefined): number {
  const latin = toLatinDigits(String(value ?? '')).trim();
  if (!latin) return 0;
  const cleaned = latin.replace(/,/g, '').replace(/[^\d.]/g, '');
  if (!cleaned) return 0;
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function loadStoredTransactions(): CashTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CashTransaction =>
        item &&
        typeof item.id === 'string' &&
        typeof item.shipment === 'string' &&
        (item.type === 'air' || item.type === 'sea') &&
        typeof item.amount === 'number'
    );
  } catch {
    return [];
  }
}

function loadCollectionCashTransactions(): CashTransaction[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return [];
    const next: CashTransaction[] = [];
    Object.values(parsed as Record<string, { shipmentCode?: string; shipmentType?: string; payments?: Array<{ id?: string; amount?: number; date?: string; driverName?: string }> }>).forEach((record) => {
      const shipment = String(record?.shipmentCode || '').trim().toUpperCase();
      const type = detectSafeType(shipment, record?.shipmentType);
      if (!type || !Array.isArray(record?.payments)) return;
      record.payments.forEach((pay) => {
        const amount = Number(pay?.amount) || 0;
        if (!pay?.id || amount <= 0) return;
        next.push({
          id: `col_${pay.id}`,
          shipment,
          type,
          amount,
          time: String(pay.date || ''),
          userName: pay.driverName,
        });
      });
    });
    return next;
  } catch {
    return [];
  }
}

export function loadTransactions(): CashTransaction[] {
  const byId = new Map<string, CashTransaction>();
  loadStoredTransactions().forEach((tx) => byId.set(tx.id, tx));
  loadCollectionCashTransactions().forEach((tx) => {
    if (!byId.has(tx.id)) byId.set(tx.id, tx);
  });
  return Array.from(byId.values());
}

function persistTransactions(next: CashTransaction[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.error(e);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CASH_REGISTER_EVENT));
  }
}

export function syncPaymentToCashRegister(input: {
  paymentId: string;
  shipment: string;
  amount: number;
  time: string;
  userName?: string;
  shipmentType?: string;
}) {
  const type = detectSafeType(input.shipment, input.shipmentType);
  const amount = Number(input.amount) || 0;
  if (!type || amount <= 0 || !input.paymentId) return;
  const id = `col_${input.paymentId}`;
  const stored = loadStoredTransactions().filter((tx) => tx.id !== id);
  persistTransactions([
    {
      id,
      shipment: toLatinDigits(input.shipment).trim().toUpperCase(),
      type,
      amount,
      time: input.time,
      userName: input.userName,
    },
    ...stored,
  ]);
}

export function removePaymentFromCashRegister(paymentId: string) {
  if (!paymentId) return;
  const id = `col_${paymentId}`;
  persistTransactions(loadTransactions().filter((tx) => tx.id !== id));
}

function loadInventory(): InventoryState {
  try {
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) return defaultInventory();
    const parsed = JSON.parse(raw) as Partial<InventoryState>;
    const merge = (side?: Partial<SafeInventory>): SafeInventory => ({
      ...emptyInventory(),
      ...side,
      counts: { ...emptyInventory().counts, ...(side?.counts ?? {}) },
      details: Array.isArray(side?.details)
        ? side.details.map((row) => ({ ...row, notes: row.notes || '' }))
        : [],
    });
    return { air: merge(parsed.air), sea: merge(parsed.sea) };
  } catch {
    return defaultInventory();
  }
}

function emptyDetail(): FinanceDetail {
  return {
    id: `fin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    amount: '',
    recipient: '',
    formNo: '',
    evidence: '',
    evidenceName: '',
    payDate: '',
    notes: '',
  };
}

export const CashRegisterView: React.FC<CashRegisterViewProps> = ({
  userName,
  canEdit = true,
}) => {
  const [transactions, setTransactions] = useState<CashTransaction[]>(loadTransactions);
  const [activeTab, setActiveTab] = useState<SafeTab>('air');
  const [inventory, setInventory] = useState<InventoryState>(loadInventory);
  const [draftDetail, setDraftDetail] = useState<FinanceDetail>(emptyDetail);
  const [financeCardOpen, setFinanceCardOpen] = useState(false);
  const [currencyTableOpen, setCurrencyTableOpen] = useState(true);
  const [editingDetailId, setEditingDetailId] = useState<string | null>(null);

  const refreshTransactions = () => setTransactions(loadTransactions());

  useEffect(() => {
    refreshTransactions();
    window.addEventListener(CASH_REGISTER_EVENT, refreshTransactions);
    window.addEventListener('storage', refreshTransactions);
    window.addEventListener('focus', refreshTransactions);
    document.addEventListener('visibilitychange', refreshTransactions);
    return () => {
      window.removeEventListener(CASH_REGISTER_EVENT, refreshTransactions);
      window.removeEventListener('storage', refreshTransactions);
      window.removeEventListener('focus', refreshTransactions);
      document.removeEventListener('visibilitychange', refreshTransactions);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
    } catch (e) {
      console.error(e);
    }
  }, [inventory]);

  const totals = useMemo(
    () =>
      transactions.reduce(
        (acc, tx) => {
          acc[tx.type] += tx.amount;
          return acc;
        },
        { air: 0, sea: 0 }
      ),
    [transactions]
  );

  const current = inventory[activeTab];
  const paidOut = current.details.reduce((sum, row) => sum + parseMoneyAmount(row.amount), 0);
  const iqdTotal = IQD_DENOMS.reduce((sum, denom) => sum + denom * (Number(current.counts[denom]) || 0), 0);
  const remaining = totals[activeTab] - paidOut;
  const otherUsd = parseMoneyAmount(current.otherUsd);
  const exchangeRate = parseMoneyAmount(current.exchangeRate);
  const usdDifference = remaining - otherUsd;
  const iraqiSafe = Math.max(0, usdDifference) * exchangeRate;
  const tallyDifference = iqdTotal - iraqiSafe;
  const isAir = activeTab === 'air';

  const updateCurrent = (patch: Partial<SafeInventory>) => {
    setInventory((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], ...patch },
    }));
  };

  const handleCountChange = (denom: number, value: string) => {
    if (!canEdit) return;
    const count = Number(toLatinDigits(value).replace(/[^\d]/g, '')) || 0;
    updateCurrent({ counts: { ...current.counts, [denom]: count } });
  };

  const resetDraft = () => {
    setDraftDetail(emptyDetail());
    setEditingDetailId(null);
  };

  const handleDraftChange = (field: keyof FinanceDetail, value: string) => {
    setDraftDetail((prev) => ({ ...prev, [field]: value }));
  };

  const handleDraftEvidence = (file?: File) => {
    if (!canEdit || !file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      setDraftDetail((prev) => ({ ...prev, evidence: dataUrl, evidenceName: file.name }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveDraft = () => {
    if (!canEdit) return;
    const amount = toLatinDigits(draftDetail.amount).trim();
    const recipient = draftDetail.recipient.trim();
    const formNo = draftDetail.formNo.trim();
    const notes = draftDetail.notes.trim();
    if (!amount && !recipient && !formNo && !draftDetail.evidence && !draftDetail.payDate && !notes) return;
    const nextRow: FinanceDetail = {
      ...draftDetail,
      id: editingDetailId || `fin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      amount,
      recipient,
      formNo,
      notes,
    };
    const nextDetails = editingDetailId
      ? current.details.map((item) => (item.id === editingDetailId ? nextRow : item))
      : [nextRow, ...current.details];
    updateCurrent({
      details: nextDetails,
      paidOut: nextDetails.reduce((sum, row) => sum + parseMoneyAmount(row.amount), 0),
    });
    resetDraft();
    setFinanceCardOpen(false);
  };

  const handleEditDetail = (row: FinanceDetail) => {
    if (!canEdit) return;
    setEditingDetailId(row.id);
    setDraftDetail({ ...row, notes: row.notes || '' });
    setFinanceCardOpen(true);
  };

  const handleRemoveDetail = (id: string) => {
    if (!canEdit) return;
    if (editingDetailId === id) resetDraft();
    const nextDetails = current.details.filter((item) => item.id !== id);
    updateCurrent({
      details: nextDetails,
      paidOut: nextDetails.reduce((sum, item) => sum + parseMoneyAmount(item.amount), 0),
    });
  };

  const financeExportRows = current.details.map((row, index) => [
    String(index + 1),
    row.amount || '-',
    row.recipient || '-',
    row.formNo || '-',
    row.notes || '-',
    row.evidenceName || (row.evidence ? 'مرفق' : '-'),
    row.payDate || '-',
  ]);

  const exportFinanceExcel = () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['تسلسل', 'المبلغ', 'اسم المستلم', 'رقم الفورم', 'الملاحظات', 'الدليل', 'تاريخ التسديد'],
      ...financeExportRows,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'التفاصيل المالية');
    XLSX.writeFile(wb, `التفاصيل_المالية_${isAir ? 'جوي' : 'بحري'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportFinancePdf = async () => {
    const [{ jsPDF }, autoTableMod, reshaperMod] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
      import('arabic-reshaper'),
    ]);
    const autoTable = autoTableMod.default;
    const convertArabic =
      (reshaperMod as { default?: { convertArabic?: (v: string) => string }; convertArabic?: (v: string) => string }).default?.convertArabic
      || (reshaperMod as { convertArabic?: (v: string) => string }).convertArabic
      || ((v: string) => v);
    const toRtlPdfText = (value: string) => reshapeArabic(convertArabic, value);
    const fontBase64 = await loadAmiriFontBase64();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    doc.setFont('Amiri', 'normal');
    doc.setFontSize(14);
    const title = toRtlPdfText(`التفاصيل المالية — ${isAir ? 'جوي' : 'بحري'}`);
    doc.text(title, 283, 16, { align: 'right' });
    const rtlHead = [
      toRtlPdfText('تاريخ التسديد'),
      toRtlPdfText('الدليل'),
      toRtlPdfText('الملاحظات'),
      toRtlPdfText('رقم الفورم'),
      toRtlPdfText('اسم المستلم'),
      toRtlPdfText('المبلغ'),
      toRtlPdfText('تسلسل'),
    ];
    const rtlBody = financeExportRows.map((row) =>
      [...row].reverse().map((cell) => toRtlPdfText(String(cell)))
    );
    autoTable(doc, {
      startY: 22,
      head: [rtlHead],
      body: rtlBody,
      styles: { font: 'Amiri', fontStyle: 'normal', fontSize: 10, halign: 'right', cellPadding: 2 },
      headStyles: { font: 'Amiri', fontStyle: 'normal', fillColor: [30, 41, 59], textColor: 255, halign: 'right' },
      columnStyles: {
        5: { halign: 'center' },
      },
    });
    doc.save(`التفاصيل_المالية_${isAir ? 'جوي' : 'بحري'}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="w-full space-y-5" dir="rtl">
      <div className="text-center">
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 font-['Cairo']">واجهة القاصة (الاستحصالات)</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">RA للقاصة الجوية و RQ للقاصة البحرية</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-5 justify-center">
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 w-full sm:w-[45%] text-center border-t-[5px] border-t-blue-600">
          <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 font-extrabold mb-2">
            <Plane className="w-5 h-5 text-blue-600" />
            <span>القاصة الجوية (RA)</span>
          </div>
          <div className="text-3xl font-black text-blue-600 tabular-nums">{formatAmount(totals.air)}</div>
        </div>
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 w-full sm:w-[45%] text-center border-t-[5px] border-t-emerald-500">
          <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 font-extrabold mb-2">
            <Ship className="w-5 h-5 text-emerald-600" />
            <span>القاصة البحرية (RQ)</span>
          </div>
          <div className="text-3xl font-black text-emerald-600 tabular-nums">{formatAmount(totals.sea)}</div>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e1e1e] p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('air')}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition-all ${
              isAir ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Plane className="w-4 h-4" />
            جرد القاصة الجوية
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sea')}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition-all ${
              !isAir ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Ship className="w-4 h-4" />
            جرد القاصة البحرية
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 p-4 border-t-4 ${isAir ? 'border-t-blue-600' : 'border-t-emerald-600'}`}>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">إجمالي القاصة</p>
            <p className={`text-xl font-black mt-1 tabular-nums ${isAir ? 'text-blue-700' : 'text-emerald-700'}`}>{formatAmount(totals[activeTab])}</p>
          </div>
          <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 p-4 border-t-4 border-t-rose-500">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">دفع من القاصة</p>
            <p className="text-xl font-black text-rose-700 mt-1 tabular-nums">{formatAmount(paidOut)}</p>
          </div>
          <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 p-4 border-t-4 border-t-amber-500">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">متبقي رصيد</p>
            <p className={`text-xl font-black mt-1 tabular-nums ${remaining < 0 ? 'text-rose-700' : 'text-amber-700'}`}>{formatAmount(remaining)}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-emerald-100 p-4 border-t-4 border-t-emerald-400 bg-emerald-50">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-emerald-700">المتوفر دولار</p>
              <Banknote className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-1 flex items-center gap-1">
              <input
                value={current.otherUsd ? String(current.otherUsd) : ''}
                onChange={(e) => updateCurrent({ otherUsd: parseMoneyAmount(e.target.value) })}
                disabled={!canEdit}
                inputMode="decimal"
                placeholder="0"
                className="w-full bg-transparent text-xl font-black text-emerald-700 tabular-nums outline-none"
              />
              <span className="text-sm font-black text-emerald-700">$</span>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-100 p-4 border-t-4 border-t-amber-400 bg-amber-50">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-amber-700">الفرق بالدولار</p>
              <ArrowLeftRight className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl font-black text-amber-800 mt-1 tabular-nums" dir="ltr">
              $ {usdDifference.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </p>
          </div>
          <div className="rounded-2xl border border-blue-100 p-4 border-t-4 border-t-blue-400 bg-blue-50">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-blue-700">سعر الصرف</p>
              <RefreshCw className="w-4 h-4 text-blue-500" />
            </div>
              <input
                value={current.exchangeRate ? String(current.exchangeRate) : ''}
                onChange={(e) => updateCurrent({ exchangeRate: parseMoneyAmount(e.target.value) })}
                disabled={!canEdit}
                inputMode="decimal"
                placeholder="0"
                className="mt-1 w-full bg-transparent text-xl font-black text-blue-700 tabular-nums outline-none"
              />
          </div>
          <div className="rounded-2xl border border-violet-100 p-4 border-t-4 border-t-violet-400 bg-violet-50">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-violet-700">قاصة عراقي</p>
              <Landmark className="w-4 h-4 text-violet-500" />
            </div>
            <p className="text-xl font-black text-violet-800 mt-1 tabular-nums">
              {formatIqd(iraqiSafe)} <span className="text-sm">د.ع</span>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 text-white flex items-center justify-between bg-[#1e3a5f]">
          <h3 className="text-base font-extrabold">جرد الفئات النقدية (دينار عراقي) — {isAir ? 'جوي' : 'بحري'}</h3>
          <span className="text-sm font-bold">المجموع: {formatIqd(iqdTotal)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-base text-right">
            <thead className="bg-[#1e3a5f] text-white text-sm">
              <tr>
                <th className="px-4 py-3 font-extrabold">#</th>
                <th className="px-4 py-3 font-extrabold">الفئة</th>
                <th className="px-4 py-3 font-extrabold">العدد</th>
                <th className="px-4 py-3 font-extrabold">المجموع</th>
              </tr>
            </thead>
            <tbody>
              {IQD_DENOMS.map((denom, index) => {
                const count = Number(current.counts[denom]) || 0;
                const rowTotal = denom * count;
                return (
                  <tr key={denom} className={`border-t border-slate-100 dark:border-slate-700 ${IQD_ROW_CLASSES[denom]}`}>
                    <td className="px-4 py-3.5 font-bold text-slate-500 text-base">{index + 1}</td>
                    <td className="px-4 py-3.5 font-black text-slate-800 dark:text-slate-100 tabular-nums text-lg">{formatIqd(denom)} دينار</td>
                    <td className="px-4 py-3.5">
                      <input
                        value={count || ''}
                        onChange={(e) => handleCountChange(denom, e.target.value)}
                        disabled={!canEdit}
                        inputMode="numeric"
                        placeholder="0"
                        className="w-28 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-2 py-2 text-center font-black text-lg outline-none focus:border-amber-500"
                      />
                    </td>
                    <td className="px-4 py-3.5 font-black text-slate-900 dark:text-slate-100 tabular-nums text-lg">{formatIqd(rowTotal)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60">
                <td className="px-4 py-3.5 font-extrabold text-base" colSpan={2}>المجموع</td>
                <td className="px-4 py-3.5 font-black tabular-nums text-lg">
                  {IQD_DENOMS.reduce((sum, denom) => sum + (Number(current.counts[denom]) || 0), 0)}
                </td>
                <td className="px-4 py-3.5 font-black tabular-nums text-lg">{formatIqd(iqdTotal)}</td>
              </tr>
              <tr className={tallyDifference > 0 ? 'bg-emerald-50' : tallyDifference < 0 ? 'bg-rose-50' : 'bg-slate-50'}>
                <td className={`px-4 py-3.5 font-extrabold text-base ${tallyDifference > 0 ? 'text-emerald-800' : tallyDifference < 0 ? 'text-rose-800' : 'text-slate-700'}`} colSpan={3}>الفرق</td>
                <td className={`px-4 py-3.5 font-black tabular-nums text-lg ${tallyDifference > 0 ? 'text-emerald-800' : tallyDifference < 0 ? 'text-rose-800' : 'text-slate-700'}`}>
                  {tallyDifference === 0
                    ? 'مطابق'
                    : `${formatIqd(Math.abs(tallyDifference))} ${tallyDifference > 0 ? 'زيادة' : 'نقص'}`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {canEdit && (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setFinanceCardOpen((open) => !open)}
            className="w-full px-5 py-3 bg-slate-800 text-white flex items-center justify-between"
          >
            <h3 className="text-sm font-extrabold">بطاقة إدخال التفاصيل المالية — {isAir ? 'جوي' : 'بحري'}</h3>
            {financeCardOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {financeCardOpen && (
          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[11px] font-extrabold text-slate-500">
              المبلغ
              <input
                value={draftDetail.amount}
                onChange={(e) => handleDraftChange('amount', e.target.value)}
                inputMode="decimal"
                placeholder="0"
                className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-extrabold text-slate-500">
              اسم المستلم
              <input
                value={draftDetail.recipient}
                onChange={(e) => handleDraftChange('recipient', e.target.value)}
                placeholder="اسم المستلم"
                className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-extrabold text-slate-500">
              رقم الفورم
              <input
                value={draftDetail.formNo}
                onChange={(e) => handleDraftChange('formNo', e.target.value)}
                placeholder="رقم الفورم"
                className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-extrabold text-slate-500">
              تاريخ التسديد
              <input
                type="date"
                value={draftDetail.payDate}
                onChange={(e) => handleDraftChange('payDate', e.target.value)}
                className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-extrabold text-slate-500 md:col-span-2">
              الملاحظات
              <textarea
                value={draftDetail.notes}
                onChange={(e) => handleDraftChange('notes', e.target.value)}
                placeholder="أدخل الملاحظات"
                rows={2}
                className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 resize-y"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-extrabold text-slate-500 md:col-span-2">
              الدليل
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleDraftEvidence(e.target.files?.[0])}
                className="w-full text-xs file:ml-2 file:rounded-lg file:border-0 file:bg-amber-500 file:px-3 file:py-1.5 file:text-[11px] file:font-black file:text-slate-950"
              />
              {draftDetail.evidence ? (
                <a href={draftDetail.evidence} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-blue-600 truncate">
                  {draftDetail.evidenceName || 'عرض الدليل'}
                </a>
              ) : (
                <span className="text-[11px] text-slate-400">لم يُرفع مستند</span>
              )}
            </label>
            <div className="md:col-span-2 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={resetDraft}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-xs font-black text-slate-600 dark:text-slate-300"
              >
                <X className="w-4 h-4" />
                إلغاء / حذف
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 text-xs font-black"
              >
                <Save className="w-4 h-4" />
                {editingDetailId ? 'تحديث' : 'حفظ'}
              </button>
            </div>
          </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold">جدول التفاصيل المالية — {isAir ? 'جوي' : 'بحري'}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportFinanceExcel}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 text-[11px] font-black"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
            <button
              type="button"
              onClick={exportFinancePdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white px-3 py-1.5 text-[11px] font-black"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#1e3a5f] text-white text-xs">
              <tr>
                <th className="px-3 py-3 font-extrabold">#</th>
                <th className="px-3 py-3 font-extrabold">المبلغ</th>
                <th className="px-3 py-3 font-extrabold">اسم المستلم</th>
                <th className="px-3 py-3 font-extrabold">رقم الفورم</th>
                <th className="px-3 py-3 font-extrabold">الملاحظات</th>
                <th className="px-3 py-3 font-extrabold">الدليل</th>
                <th className="px-3 py-3 font-extrabold">تاريخ التسديد</th>
                {canEdit && <th className="px-3 py-3 font-extrabold">إجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {current.details.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="px-4 py-10 text-center text-slate-400 font-bold text-xs">
                    لا توجد تفاصيل مالية لهذه القاصة.
                  </td>
                </tr>
              ) : (
                current.details.map((row, index) => (
                  <tr key={row.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-3 py-2 text-slate-500 font-bold">{index + 1}</td>
                    <td className="px-3 py-2 font-black tabular-nums">{row.amount || '-'}</td>
                    <td className="px-3 py-2 font-semibold">{row.recipient || '-'}</td>
                    <td className="px-3 py-2 font-semibold">{row.formNo || '-'}</td>
                    <td className="px-3 py-2 font-semibold max-w-[220px]">{row.notes || '-'}</td>
                    <td className="px-3 py-2">
                      {row.evidence ? (
                        <a href={row.evidence} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-blue-600 truncate">
                          {row.evidenceName || 'عرض الدليل'}
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400">لم يُرفع مستند</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap">{row.payDate || '-'}</td>
                    {canEdit && (
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditDetail(row)}
                            className="inline-flex items-center justify-center rounded-lg border border-amber-200 text-amber-700 px-2 py-1"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveDetail(row.id)}
                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 text-rose-700 px-2 py-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setCurrencyTableOpen((open) => !open)}
          className="w-full px-5 py-3 bg-[#1e3a5f] text-white flex items-center justify-between"
        >
          <h3 className="text-sm font-extrabold">جدول العملات / حركات الاستحصال</h3>
          {currencyTableOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {currencyTableOpen && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#1e3a5f] text-white">
              <tr>
                <th className="px-4 py-3 font-extrabold">#</th>
                <th className="px-4 py-3 font-extrabold">رقم الشحنة</th>
                <th className="px-4 py-3 font-extrabold">النوع</th>
                <th className="px-4 py-3 font-extrabold">المبلغ ($)</th>
                <th className="px-4 py-3 font-extrabold">وقت الاستحصال</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400 font-bold text-xs">
                    لا توجد حركات مسجلة في القاصة حتى الآن.
                  </td>
                </tr>
              ) : (
                transactions.map((tx, index) => (
                  <tr key={tx.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/60">
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-bold">{transactions.length - index}</td>
                    <td className="px-4 py-3 font-black text-slate-800 dark:text-slate-100">{tx.shipment}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-extrabold text-white ${
                          tx.type === 'air' ? 'bg-blue-600' : 'bg-emerald-500'
                        }`}
                      >
                        {tx.type === 'air' ? <Plane className="w-3.5 h-3.5" /> : <Ship className="w-3.5 h-3.5" />}
                        {tx.type === 'air' ? 'جوي' : 'بحري'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black text-slate-900 tabular-nums">{formatAmount(tx.amount)}</td>
                    <td className="px-4 py-3 text-slate-600 font-semibold whitespace-nowrap">{tx.time}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
};
