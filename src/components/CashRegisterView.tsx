import React, { useEffect, useMemo, useState } from 'react';
import { Plane, Ship, PlusCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { CashSafeType, CashTransaction } from '../types';
import { toLatinDigits } from './YardInventoryView';

interface CashRegisterViewProps {
  userName: string;
  canEdit?: boolean;
}

const STORAGE_KEY = 'atlas_cash_register_v1';
const INVENTORY_STORAGE_KEY = 'atlas_cash_inventory_v1';
const IQD_DENOMS = [50000, 25000, 10000, 5000, 1000] as const;

type SafeTab = CashSafeType;

interface FinanceDetail {
  id: string;
  amount: string;
  recipient: string;
  formNo: string;
  evidence: string;
  shipDate: string;
  arrivalDate: string;
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

function detectSafeType(shipment: string): CashSafeType | null {
  const code = shipment.trim().toUpperCase();
  if (code.startsWith('RA')) return 'air';
  if (code.startsWith('RQ')) return 'sea';
  return null;
}

function formatAmount(value: number): string {
  return `$ ${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

function formatIqd(value: number): string {
  return value.toLocaleString('en-US');
}

function loadTransactions(): CashTransaction[] {
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
    shipDate: '',
    arrivalDate: '',
    payDate: '',
  };
}

export const CashRegisterView: React.FC<CashRegisterViewProps> = ({
  userName,
  canEdit = true,
}) => {
  const [transactions, setTransactions] = useState<CashTransaction[]>(loadTransactions);
  const [shipment, setShipment] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<SafeTab>('air');
  const [inventory, setInventory] = useState<InventoryState>(loadInventory);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
      console.error(e);
    }
  }, [transactions]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    const code = toLatinDigits(shipment).trim().toUpperCase();
    const numeric = Number(toLatinDigits(amount).replace(/[^\d.]/g, ''));
    const type = detectSafeType(code);

    if (!code || !Number.isFinite(numeric) || numeric <= 0) {
      setMessage({ type: 'error', text: 'يرجى إدخال رقم شحنة صحيح ومبلغ صالح.' });
      return;
    }
    if (!type) {
      setMessage({
        type: 'error',
        text: 'رمز الشحنة غير معروف. يجب أن يبدأ بـ RA للشحن الجوي أو RQ للشحن البحري.',
      });
      return;
    }

    const now = new Date();
    const next: CashTransaction = {
      id: `cash_${now.getTime()}`,
      shipment: code,
      type,
      amount: numeric,
      time: now.toLocaleTimeString('ar-IQ-u-nu-latn', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      userName,
    };

    setTransactions((prev) => [next, ...prev]);
    setShipment('');
    setAmount('');
    setActiveTab(type);
    setMessage({
      type: 'success',
      text: `تم استحصال ${formatAmount(numeric)} في القاصة ${type === 'air' ? 'الجوية' : 'البحرية'}.`,
    });
  };

  const handleCountChange = (denom: number, value: string) => {
    if (!canEdit) return;
    const count = Number(toLatinDigits(value).replace(/[^\d]/g, '')) || 0;
    updateCurrent({ counts: { ...current.counts, [denom]: count } });
  };

  const handleDetailChange = (id: string, field: keyof FinanceDetail, value: string) => {
    if (!canEdit) return;
    updateCurrent({
      details: current.details.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    });
  };

  const addDetailRow = () => {
    if (!canEdit) return;
    updateCurrent({ details: [...current.details, emptyDetail()] });
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

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center"
      >
        <input
          value={shipment}
          onChange={(e) => {
            setShipment(e.target.value);
            setMessage(null);
          }}
          disabled={!canEdit}
          placeholder="رقم الشحنة (مثال: RA6062 أو RQ6042)"
          className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:bg-slate-100"
        />
        <input
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setMessage(null);
          }}
          disabled={!canEdit}
          inputMode="decimal"
          placeholder="المبلغ المستحصل ($)"
          className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:bg-slate-100"
        />
        <button
          type="submit"
          disabled={!canEdit}
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm px-5 py-2.5 disabled:bg-slate-300 disabled:text-slate-500"
        >
          <PlusCircle className="w-4 h-4" />
          استحصال المبلغ
        </button>
      </form>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold ${
            message.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {message.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

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

      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-800 text-white flex items-center justify-between">
          <h3 className="text-sm font-extrabold">جدول التفاصيل المالية — {isAir ? 'جوي' : 'بحري'}</h3>
          {canEdit && (
            <button type="button" onClick={addDetailRow} className="text-[11px] font-black bg-amber-500 text-slate-950 rounded-lg px-3 py-1.5">
              إضافة صف
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs">
              <tr>
                <th className="px-3 py-3 font-extrabold">المبلغ</th>
                <th className="px-3 py-3 font-extrabold">اسم المستلم</th>
                <th className="px-3 py-3 font-extrabold">رقم الفورم</th>
                <th className="px-3 py-3 font-extrabold">الدليل</th>
                <th className="px-3 py-3 font-extrabold">تاريخ الشحن</th>
                <th className="px-3 py-3 font-extrabold">تاريخ الوصول</th>
                <th className="px-3 py-3 font-extrabold">تاريخ التسديد</th>
              </tr>
            </thead>
            <tbody>
              {current.details.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400 font-bold text-xs">
                    لا توجد تفاصيل مالية لهذه القاصة.
                  </td>
                </tr>
              ) : (
                current.details.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 dark:border-slate-700">
                    {(
                      [
                        ['amount', 'المبلغ'],
                        ['recipient', 'اسم المستلم'],
                        ['formNo', 'رقم الفورم'],
                        ['evidence', 'الدليل'],
                        ['shipDate', 'تاريخ الشحن'],
                        ['arrivalDate', 'تاريخ الوصول'],
                        ['payDate', 'تاريخ التسديد'],
                      ] as [keyof FinanceDetail, string][]
                    ).map(([field]) => (
                      <td key={field} className="px-3 py-2">
                        <input
                          value={String(row[field] ?? '')}
                          onChange={(e) => handleDetailChange(row.id, field, e.target.value)}
                          disabled={!canEdit}
                          className="w-full min-w-[110px] rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-2 py-1.5 text-xs font-semibold outline-none focus:border-amber-500"
                        />
                      </td>
                    ))}
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
