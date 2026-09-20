import React, { useMemo, useState } from 'react';
import { User, Search, ShieldCheck, Truck, BarChart3, Printer, ChevronDown } from 'lucide-react';
import { CollectionRecord, PaymentEntry, ShipmentRecord } from '../types';

interface StatementRow {
  id: number;
  date: string;
  ref: string;
  code: string;
  details: string;
  debit: number;
  credit: number;
  balance: number;
}

interface CustomerStatementProps {
  shipments?: ShipmentRecord[];
  codeOptions?: string[];
  guarantorOptions?: string[];
  shipmentOptions?: string[];
}

const COLLECTIONS_STORAGE_KEY = 'atlas_debt_collections_v2';

function money(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function loadCollections(): Record<string, CollectionRecord> {
  try {
    const saved = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function keyOf(value: string | undefined | null): string {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function exactMatch(itemValue: string | undefined | null, selected: string): boolean {
  if (!selected) return true;
  return keyOf(itemValue) === keyOf(selected);
}

function uniqueSorted(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  values.forEach((value) => {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return;
    const key = keyOf(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    next.push(trimmed);
  });
  return next.sort((a, b) => a.localeCompare(b, 'ar'));
}

function constrainChoices(list: string[], allowed?: string[]): string[] {
  if (!allowed?.length) return list;
  const allow = new Set(allowed.map(keyOf));
  return list.filter((item) => allow.has(keyOf(item)));
}

function shipmentDate(_item: ShipmentRecord): string {
  return '';
}

function buildStatementRows(matched: ShipmentRecord[]): StatementRow[] {
  const collections = loadCollections();
  const events: { date: string; ref: string; code: string; details: string; debit: number; credit: number }[] = [];

  matched.forEach((item) => {
    const recId = item.id || `${item.shipment}_${item.code}`;
    const saved = collections[recId];
    const debit = Number(item.sales) || 0;
    const typeLabel = item.type || (String(item.shipment || '').toUpperCase().startsWith('RA') ? 'جوي' : 'بحري');
    const code = String(item.code || '').trim();
    events.push({
      date: shipmentDate(item) || saved?.lastUpdated?.slice(0, 10) || '—',
      ref: item.shipment || recId,
      code,
      details: `استحقاق شحنة ${typeLabel} — ${item.name || item.code || ''}`.trim(),
      debit,
      credit: 0,
    });

    const payments: PaymentEntry[] = Array.isArray(saved?.payments) ? saved.payments : [];
    payments.forEach((pay) => {
      events.push({
        date: pay.date || saved?.lastUpdated?.slice(0, 10) || '—',
        ref: pay.receiptNumber || item.shipment || recId,
        code,
        details: `تسديد ${pay.paymentMethod}${pay.driverName ? ` — ${pay.driverName}` : ''}${pay.notes ? ` — ${pay.notes}` : ''}`,
        debit: 0,
        credit: Number(pay.amount) || 0,
      });
    });
  });

  events.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  let running = 0;
  return events.map((event, index) => {
    running += event.debit - event.credit;
      return {
        id: index + 1,
        date: event.date,
        ref: event.ref,
        code: event.code,
        details: event.details,
        debit: event.debit,
        credit: event.credit,
        balance: running,
      };
  });
}

export const CustomerStatement: React.FC<CustomerStatementProps> = ({
  shipments = [],
  codeOptions = [],
  guarantorOptions = [],
  shipmentOptions = [],
}) => {
  const [filters, setFilters] = useState({ clientCode: '', guarantor: '', shipment: '' });
  const [queried, setQueried] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const { clientCode, guarantor, shipment } = filters;

  const clientCodeChoices = useMemo(() => {
    const scoped = shipments.filter((item) => exactMatch(item.guarantor, guarantor) && exactMatch(item.shipment, shipment));
    const list = constrainChoices(uniqueSorted(scoped.map((item) => item.code)), codeOptions);
    if (clientCode && !list.some((item) => exactMatch(item, clientCode))) return [clientCode, ...list];
    return list;
  }, [shipments, guarantor, shipment, codeOptions, clientCode]);

  const guarantorChoices = useMemo(() => {
    const scoped = shipments.filter((item) => exactMatch(item.code, clientCode) && exactMatch(item.shipment, shipment));
    const list = constrainChoices(uniqueSorted(scoped.map((item) => item.guarantor)), guarantorOptions);
    if (guarantor && !list.some((item) => exactMatch(item, guarantor))) return [guarantor, ...list];
    return list;
  }, [shipments, clientCode, shipment, guarantorOptions, guarantor]);

  const shipmentChoices = useMemo(() => {
    const scoped = shipments.filter((item) => exactMatch(item.code, clientCode) && exactMatch(item.guarantor, guarantor));
    const list = constrainChoices(uniqueSorted(scoped.map((item) => item.shipment)), shipmentOptions);
    if (shipment && !list.some((item) => exactMatch(item, shipment))) return [shipment, ...list];
    return list;
  }, [shipments, clientCode, guarantor, shipmentOptions, shipment]);

  const selectClass =
    'w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200';

  const matchedShipments = useMemo(() => {
    if (!clientCode && !guarantor && !shipment) return [];
    return shipments.filter(
      (item) =>
        exactMatch(item.code, clientCode) &&
        exactMatch(item.guarantor, guarantor) &&
        exactMatch(item.shipment, shipment)
    );
  }, [shipments, clientCode, guarantor, shipment]);

  const rows = useMemo(() => buildStatementRows(matchedShipments), [matchedShipments]);

  const openingBalance = 0;
  const totalDebit = useMemo(() => rows.reduce((sum, row) => sum + row.debit, 0), [rows]);
  const totalCredit = useMemo(() => rows.reduce((sum, row) => sum + row.credit, 0), [rows]);
  const finalBalance = openingBalance + totalDebit - totalCredit;
  const maxBar = Math.max(totalDebit, totalCredit, 1);

  const revealResults = () => {
    setQueried(true);
    setTableOpen(true);
    setChartOpen(true);
  };

  const applyClientCode = (value: string) => {
    if (!value) {
      setFilters({ clientCode: '', guarantor: '', shipment: '' });
      revealResults();
      return;
    }
    const related = shipments.filter((item) => exactMatch(item.code, value));
    const linkedGuarantors = uniqueSorted(related.map((item) => item.guarantor));
    setFilters({
      clientCode: value,
      guarantor: linkedGuarantors.length === 1 ? linkedGuarantors[0] : '',
      shipment: '',
    });
    revealResults();
  };

  const applyGuarantor = (value: string) => {
    if (!value) {
      setFilters((prev) => ({ ...prev, guarantor: '', shipment: '' }));
      revealResults();
      return;
    }
    const related = shipments.filter((item) => exactMatch(item.guarantor, value));
    const linkedCodes = uniqueSorted(related.map((item) => item.code));
    setFilters((prev) => ({
      clientCode: prev.clientCode && linkedCodes.some((item) => exactMatch(item, prev.clientCode))
        ? prev.clientCode
        : '',
      guarantor: value,
      shipment: '',
    }));
    revealResults();
  };

  const applyShipment = (value: string) => {
    if (!value) {
      setFilters((prev) => ({ ...prev, shipment: '' }));
      revealResults();
      return;
    }
    const related = shipments.filter((item) => exactMatch(item.shipment, value));
    const linkedCodes = uniqueSorted(related.map((item) => item.code));
    const linkedGuarantors = uniqueSorted(related.map((item) => item.guarantor));
    setFilters((prev) => ({
      clientCode: prev.clientCode && linkedCodes.some((item) => exactMatch(item, prev.clientCode))
        ? prev.clientCode
        : '',
      guarantor: prev.guarantor && linkedGuarantors.some((item) => exactMatch(item, prev.guarantor))
        ? prev.guarantor
        : '',
      shipment: value,
    }));
    revealResults();
  };

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    revealResults();
  };

  const handlePrint = () => {
    setTableOpen(true);
    window.setTimeout(() => window.print(), 50);
  };

  return (
    <div className="w-full space-y-5 customer-statement-print" dir="rtl">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          html, body {
            background: #fff !important;
            width: 100% !important;
            height: auto !important;
          }
          aside, header, footer, nav, .no-print, button,
          .statement-filters, .statement-chart {
            display: none !important;
          }
          .customer-statement-print {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #000 !important;
            box-shadow: none !important;
          }
          .customer-statement-print * {
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .statement-header {
            margin-bottom: 10px !important;
            padding: 10px 14px !important;
            border-radius: 8px !important;
          }
          .statement-header h2 { font-size: 16px !important; }
          .statement-header p { font-size: 11px !important; color: #e2e8f0 !important; }
          .statement-summary {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 8px !important;
            width: 100% !important;
            margin: 0 0 10px !important;
          }
          .statement-summary > div {
            break-inside: avoid !important;
            padding: 10px 12px !important;
            border-radius: 8px !important;
          }
          .statement-summary p:first-child { font-size: 10px !important; }
          .statement-summary p:last-child { font-size: 16px !important; }
          .statement-table-wrap,
          .statement-table-wrap.print-only-open {
            display: block !important;
            width: 100% !important;
            overflow: visible !important;
          }
          .statement-table-card { border-radius: 8px !important; }
          .statement-table-title {
            display: flex !important;
            width: 100% !important;
            padding: 8px 12px !important;
          }
          table { width: 100% !important; font-size: 11px !important; border-collapse: collapse !important; }
          th, td { padding: 6px 8px !important; }
        }
      `}</style>

      <div className="statement-header bg-gradient-to-r from-slate-800 to-slate-750 text-white rounded-2xl shadow-md border border-slate-700/60 px-5 py-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold font-['Cairo']">كشف حساب عميل - تفصيلي</h2>
          <p className="text-xs text-slate-300">عرض حركة المدين والدائن والرصيد المتراكم للعميل</p>
        </div>
      </div>

      <form
        onSubmit={handleSearch}
        className="statement-filters bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-5 grid grid-cols-1 md:grid-cols-5 gap-3"
      >
        <div>
          <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
            <Search className="w-3.5 h-3.5 text-amber-500" />
            كود العميل
          </label>
          <select value={clientCode} onChange={(e) => applyClientCode(e.target.value)} className={selectClass}>
            <option value="">الكل</option>
            {clientCodeChoices.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            الكفيل
          </label>
          <select value={guarantor} onChange={(e) => applyGuarantor(e.target.value)} className={selectClass}>
            <option value="">الكل</option>
            {guarantorChoices.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
            <Truck className="w-3.5 h-3.5 text-blue-500" />
            رقم الشحنة
          </label>
          <select value={shipment} onChange={(e) => applyShipment(e.target.value)} className={selectClass}>
            <option value="">الكل</option>
            {shipmentChoices.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end no-print">
          <button
            type="submit"
            className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm py-2.5 shadow-md shadow-amber-500/20"
          >
            استعلام
          </button>
        </div>
        <div className="flex items-end no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm py-2.5 shadow-md inline-flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            طباعة / تصدير PDF
          </button>
        </div>
      </form>

      {queried && (
        <>
          <div className="statement-summary grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">الرصيد الافتتاحي</p>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1 tabular-nums">
                {money(openingBalance)}$
              </p>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-800 p-4">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300">إجمالي الديون</p>
              <p className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1 tabular-nums">
                {money(totalDebit)}$
              </p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-4">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">إجمالي المسدد</p>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
                {money(totalCredit)}$
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 p-4">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">الرصيد النهائي المتبقي</p>
              <p className="text-2xl font-black text-amber-800 dark:text-amber-300 mt-1 tabular-nums">
                {money(finalBalance)}$
              </p>
            </div>
          </div>

          <div className="statement-chart bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setChartOpen((v) => !v)}
              className="w-full px-5 py-3 flex items-center justify-between no-print"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">حركات السحب والتسديد</h3>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${chartOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`px-5 pb-5 ${chartOpen ? 'block' : 'hidden'} print-only-open`}>
              <div className="flex items-end justify-center gap-16 h-56 pt-8">
                <div className="flex flex-col items-center justify-end h-full w-28">
                  <span className="mb-2 text-xs font-black text-rose-600 tabular-nums">{money(totalDebit)}$</span>
                  <div
                    className="w-20 bg-gradient-to-t from-rose-700 to-rose-400 rounded-t-xl shadow-inner min-h-[8px]"
                    style={{ height: `${Math.max(8, (totalDebit / maxBar) * 100)}%` }}
                  />
                  <span className="text-[11px] font-bold text-slate-500 mt-2">مدين / سحب</span>
                </div>
                <div className="flex flex-col items-center justify-end h-full w-28">
                  <span className="mb-2 text-xs font-black text-emerald-600 tabular-nums">{money(totalCredit)}$</span>
                  <div
                    className="w-20 bg-gradient-to-t from-emerald-700 to-emerald-400 rounded-t-xl shadow-inner min-h-[8px]"
                    style={{ height: `${Math.max(8, (totalCredit / maxBar) * 100)}%` }}
                  />
                  <span className="text-[11px] font-bold text-slate-500 mt-2">دائن / تسديد</span>
                </div>
              </div>
            </div>
          </div>

          <div className="statement-table-card bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setTableOpen((v) => !v)}
              className="statement-table-title w-full px-5 py-3 bg-slate-800 text-white flex items-center justify-between no-print"
            >
              <h3 className="text-sm font-extrabold">كشف الحساب — {clientCode || shipment || guarantor || 'بدون كود'}</h3>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-300 font-bold">{rows.length} حركة</span>
                <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${tableOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>
            <div className={`statement-table-wrap ${tableOpen ? 'block' : 'hidden'} print-only-open overflow-x-auto`}>
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs">
                  <tr>
                    <th className="px-4 py-3 font-extrabold">التسلسل</th>
                    <th className="px-4 py-3 font-extrabold">التاريخ</th>
                    <th className="px-4 py-3 font-extrabold">رقم الشحنة / الوصل</th>
                    <th className="px-4 py-3 font-extrabold">الكود</th>
                    <th className="px-4 py-3 font-extrabold">البيان / التفاصيل</th>
                    <th className="px-4 py-3 font-extrabold">مدين (عليه)</th>
                    <th className="px-4 py-3 font-extrabold">دائن (له)</th>
                    <th className="px-4 py-3 font-extrabold">الرصيد المتراكم</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-400 font-bold text-xs">
                        لا توجد حركات مطابقة للبحث.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
                      >
                        <td className="px-4 py-3 font-bold text-slate-500">{row.id}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {row.date}
                        </td>
                        <td className="px-4 py-3 font-black text-slate-800 dark:text-slate-100">{row.ref}</td>
                        <td className="px-4 py-3 font-black text-amber-700 dark:text-amber-400 font-mono">{row.code || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.details}</td>
                        <td className="px-4 py-3 font-black text-rose-600 tabular-nums">
                          {row.debit ? `${money(row.debit)}$` : '-'}
                        </td>
                        <td className="px-4 py-3 font-black text-emerald-600 tabular-nums">
                          {row.credit ? `${money(row.credit)}$` : '-'}
                        </td>
                        <td className="px-4 py-3 font-black text-slate-900 dark:text-slate-100 tabular-nums">
                          {money(row.balance)}$
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
