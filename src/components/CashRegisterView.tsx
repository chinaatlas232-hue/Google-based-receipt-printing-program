import React, { useEffect, useMemo, useState } from 'react';
import { Plane, Ship, X, Save } from 'lucide-react';
import { CashSafeType, CashTransaction } from '../types';
import { toLatinDigits } from './YardInventoryView';

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

type SafeTab = CashSafeType;

interface FinanceDetail {
  id: string;
  amount: string;
  recipient: string;
  formNo: string;
  evidence: string;
  evidenceName: string;
  payDate: string;
}

interface SafeInventory {
  counts: Record<number, number>;
  paidOut: number;
  otherUsd: number;
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
      details: Array.isArray(side?.details) ? side.details : [],
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
  const iqdTotal = IQD_DENOMS.reduce((sum, denom) => sum + denom * (Number(current.counts[denom]) || 0), 0);
  const remaining = totals[activeTab] - (Number(current.paidOut) || 0);
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

  const resetDraft = () => setDraftDetail(emptyDetail());

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
    if (!amount && !recipient && !formNo && !draftDetail.evidence && !draftDetail.payDate) return;
    updateCurrent({
      details: [
        {
          ...draftDetail,
          id: `fin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          amount,
          recipient,
          formNo,
        },
        ...current.details,
      ],
    });
    resetDraft();
  };

  const handleRemoveDetail = (id: string) => {
    if (!canEdit) return;
    updateCurrent({ details: current.details.filter((row) => row.id !== id) });
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

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3`}>
        <div className={`bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 p-4 border-t-4 ${isAir ? 'border-t-blue-600' : 'border-t-emerald-600'}`}>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">إجمالي القاصة</p>
          <p className={`text-xl font-black mt-1 tabular-nums ${isAir ? 'text-blue-700' : 'text-emerald-700'}`}>{formatAmount(totals[activeTab])}</p>
        </div>
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 p-4 border-t-4 border-t-rose-500">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">دفع من القاصة</p>
          <input
            value={current.paidOut || ''}
            onChange={(e) => updateCurrent({ paidOut: Number(toLatinDigits(e.target.value).replace(/[^\d.]/g, '')) || 0 })}
            disabled={!canEdit}
            inputMode="decimal"
            placeholder="0"
            className="mt-1 w-full bg-transparent text-xl font-black text-rose-700 tabular-nums outline-none"
          />
        </div>
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 p-4 border-t-4 border-t-amber-500">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">متبقي رصيد</p>
          <p className="text-xl font-black text-amber-700 mt-1 tabular-nums">{formatAmount(remaining)}</p>
        </div>
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 p-4 border-t-4 border-t-slate-600">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">قاصة عراقي</p>
          <p className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1 tabular-nums">{formatIqd(iqdTotal)}</p>
        </div>
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 p-4 border-t-4 border-t-cyan-500">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">مبالغ أخرى دولار</p>
          <input
            value={current.otherUsd || ''}
            onChange={(e) => updateCurrent({ otherUsd: Number(toLatinDigits(e.target.value).replace(/[^\d.]/g, '')) || 0 })}
            disabled={!canEdit}
            inputMode="decimal"
            placeholder="0"
            className="mt-1 w-full bg-transparent text-xl font-black text-cyan-700 tabular-nums outline-none"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className={`px-5 py-3 text-white flex items-center justify-between ${isAir ? 'bg-blue-700' : 'bg-emerald-700'}`}>
          <h3 className="text-sm font-extrabold">جرد الفئات النقدية (دينار عراقي) — {isAir ? 'جوي' : 'بحري'}</h3>
          <span className="text-[11px] font-bold">المجموع: {formatIqd(iqdTotal)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs">
              <tr>
                <th className="px-4 py-3 font-extrabold">no</th>
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
                  <tr key={denom} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-3 font-bold text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 font-black text-slate-800 dark:text-slate-100 tabular-nums">{formatIqd(denom)}</td>
                    <td className="px-4 py-3">
                      <input
                        value={count || ''}
                        onChange={(e) => handleCountChange(denom, e.target.value)}
                        disabled={!canEdit}
                        inputMode="numeric"
                        placeholder="0"
                        className="w-24 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-2 py-1.5 text-center font-black text-sm outline-none focus:border-amber-500"
                      />
                    </td>
                    <td className="px-4 py-3 font-black text-slate-900 dark:text-slate-100 tabular-nums">{formatIqd(rowTotal)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60">
                <td className="px-4 py-3 font-extrabold" colSpan={2}>المجموع</td>
                <td className="px-4 py-3 font-black tabular-nums">
                  {IQD_DENOMS.reduce((sum, denom) => sum + (Number(current.counts[denom]) || 0), 0)}
                </td>
                <td className="px-4 py-3 font-black tabular-nums">{formatIqd(iqdTotal)}</td>
              </tr>
              <tr className="bg-amber-50 dark:bg-amber-950/30">
                <td className="px-4 py-3 font-extrabold text-amber-800 dark:text-amber-300" colSpan={3}>الفرق</td>
                <td className="px-4 py-3 font-black text-amber-800 dark:text-amber-300 tabular-nums">
                  {formatIqd(iqdTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {canEdit && (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-800 text-white">
            <h3 className="text-sm font-extrabold">بطاقة إدخال التفاصيل المالية — {isAir ? 'جوي' : 'بحري'}</h3>
          </div>
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
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-800 text-white">
          <h3 className="text-sm font-extrabold">جدول التفاصيل المالية — {isAir ? 'جوي' : 'بحري'}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs">
              <tr>
                <th className="px-3 py-3 font-extrabold">المبلغ</th>
                <th className="px-3 py-3 font-extrabold">اسم المستلم</th>
                <th className="px-3 py-3 font-extrabold">رقم الفورم</th>
                <th className="px-3 py-3 font-extrabold">الدليل</th>
                <th className="px-3 py-3 font-extrabold">تاريخ التسديد</th>
                {canEdit && <th className="px-3 py-3 font-extrabold">حذف</th>}
              </tr>
            </thead>
            <tbody>
              {current.details.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="px-4 py-10 text-center text-slate-400 font-bold text-xs">
                    لا توجد تفاصيل مالية لهذه القاصة.
                  </td>
                </tr>
              ) : (
                current.details.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-3 py-2 font-black tabular-nums">{row.amount || '-'}</td>
                    <td className="px-3 py-2 font-semibold">{row.recipient || '-'}</td>
                    <td className="px-3 py-2 font-semibold">{row.formNo || '-'}</td>
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
                        <button
                          type="button"
                          onClick={() => handleRemoveDetail(row.id)}
                          className="inline-flex items-center justify-center rounded-lg border border-rose-200 text-rose-700 px-2 py-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
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
      </div>
    </div>
  );
};
