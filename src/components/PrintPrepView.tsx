import React, { useMemo, useState } from 'react';
import { Printer, FileSpreadsheet, Users, ClipboardList, X } from 'lucide-react';

type SheetTab = 'customers' | 'receipts';
type PaymentMethod = '' | 'نقداً' | 'آجل';
type ShipmentKind = '' | 'جوي' | 'بحري';

interface CustomerRow {
  id: number;
  clientCode: string;
  clientName: string;
  phone: string;
  city: string;
}

interface ReceiptPrintRow {
  id: number;
  shipment: string;
  clientCode: string;
  packages: string;
  weight: string;
  type: ShipmentKind;
  price: string;
  sales: string;
  issueDate: string;
  paymentMethod: PaymentMethod;
  printed: boolean;
}

const DUMMY_CUSTOMERS: CustomerRow[] = [
  { id: 1, clientCode: 'B449', clientName: 'علي ولي', phone: '+964 7715391754', city: 'أربيل' },
  { id: 2, clientCode: 'B102', clientName: 'محمد كريم', phone: '+964 7501122334', city: 'بغداد' },
  { id: 3, clientCode: 'B210', clientName: 'سارة أحمد', phone: '+964 7709988776', city: 'البصرة' },
  { id: 4, clientCode: 'B318', clientName: 'حسين علي', phone: '+964 7512233445', city: 'كركوك' },
  { id: 5, clientCode: 'B427', clientName: 'نور فاضل', phone: '+964 7723344556', city: 'الموصل' },
  { id: 6, clientCode: 'B533', clientName: 'ياسين جبار', phone: '+964 7734455667', city: 'النجف' },
  { id: 7, clientCode: 'B641', clientName: 'زينب عباس', phone: '+964 7745566778', city: 'كربلاء' },
  { id: 8, clientCode: 'B754', clientName: 'أحمد صالح', phone: '+964 7756677889', city: 'السليمانية' },
  { id: 9, clientCode: 'B866', clientName: 'ليلى حسن', phone: '+964 7767788990', city: 'دهوك' },
  { id: 10, clientCode: 'B970', clientName: 'كاظم مهدي', phone: '+964 7778899001', city: 'الناصرية' },
];

const RECEIPT_COLUMNS = [
  'رقم الشحنة',
  'كود العميل',
  'اسم العميل (آلي)',
  'رقم الهاتف (آلي)',
  'عنوان الاستلام / المدينة (آلي)',
  'عدد الطرود',
  'الوزن الإجمالي (كغ)',
  'نوع الشحنة',
  'سعر الكيلو ($)',
  'إجمالي المبيعات / الديون ($)',
  'تاريخ الإصدار',
  'طريقة الدفع',
  'حالة الطباعة',
] as const;

function emptyReceiptRow(id: number): ReceiptPrintRow {
  return {
    id,
    shipment: '',
    clientCode: '',
    packages: '',
    weight: '',
    type: '',
    price: '',
    sales: '',
    issueDate: '',
    paymentMethod: '',
    printed: false,
  };
}

function emptyCustomerRow(id: number): CustomerRow {
  return { id, clientCode: '', clientName: '', phone: '', city: '' };
}

function lookupCustomer(customers: CustomerRow[], code: string): CustomerRow | null {
  const key = code.trim().toUpperCase();
  if (!key) return null;
  return customers.find((row) => row.clientCode.trim().toUpperCase() === key) ?? null;
}

function parcelThumb(code: string, index: number): string {
  const hue = (index * 53 + code.length * 17) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88">
    <rect width="88" height="88" rx="10" fill="hsl(${hue} 45% 92%)"/>
    <rect x="16" y="22" width="56" height="44" rx="6" fill="hsl(${hue} 55% 42%)"/>
    <rect x="16" y="38" width="56" height="8" fill="hsl(${hue} 45% 28%)"/>
    <text x="44" y="52" text-anchor="middle" font-size="14" font-family="Arial" font-weight="700" fill="#fff">${index + 1}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function parcelCount(row: { packages: string }): number {
  const n = Number(row.packages);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 24) : 1;
}

const cellInput =
  'w-full min-w-[110px] bg-transparent px-2 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none';
const autoCell =
  'px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 min-w-[120px]';

export const PrintPrepView: React.FC = () => {
  const [activeSheet, setActiveSheet] = useState<SheetTab>('customers');
  const [customers, setCustomers] = useState<CustomerRow[]>(DUMMY_CUSTOMERS);
  const [receipts, setReceipts] = useState<ReceiptPrintRow[]>(() => [
    { ...emptyReceiptRow(1), shipment: 'RA6003', clientCode: 'B449', packages: '1', weight: '43.4', type: 'جوي', price: '9', sales: '390.60', issueDate: '2026-08-26', paymentMethod: 'آجل' },
    { ...emptyReceiptRow(2), shipment: 'RA6003', clientCode: 'B102', packages: '3', weight: '88.2', type: 'جوي', price: '9', sales: '793.80', issueDate: '2026-08-26', paymentMethod: 'نقداً' },
    { ...emptyReceiptRow(3), shipment: 'RA6003', clientCode: 'B210', packages: '2', weight: '51.0', type: 'جوي', price: '9', sales: '459.00', issueDate: '2026-08-26', paymentMethod: 'آجل' },
    { ...emptyReceiptRow(4), shipment: 'RQ6042', clientCode: 'B318', packages: '6', weight: '210.5', type: 'بحري', price: '4', sales: '842.00', issueDate: '2026-08-20', paymentMethod: 'نقداً' },
    { ...emptyReceiptRow(5), shipment: 'RQ6042', clientCode: 'B427', packages: '4', weight: '140.0', type: 'بحري', price: '4', sales: '560.00', issueDate: '2026-08-20', paymentMethod: 'آجل' },
    ...Array.from({ length: 7 }, (_, i) => emptyReceiptRow(i + 6)),
  ]);
  const [tallyOpen, setTallyOpen] = useState(false);
  const [selectedTallyShipment, setSelectedTallyShipment] = useState('');

  const updateCustomer = (id: number, patch: Partial<CustomerRow>) => {
    setCustomers((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const updateReceipt = (id: number, patch: Partial<ReceiptPrintRow>) => {
    setReceipts((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const resolvedReceipts = useMemo(
    () =>
      receipts.map((row) => {
        const found = lookupCustomer(customers, row.clientCode);
        return {
          ...row,
          clientName: found?.clientName ?? '',
          phone: found?.phone ?? '',
          city: found?.city ?? '',
        };
      }),
    [customers, receipts]
  );

  const shipmentOptions = useMemo(() => {
    const codes = new Set<string>();
    resolvedReceipts.forEach((row) => {
      const code = row.shipment.trim().toUpperCase();
      if (code) codes.add(code);
    });
    return Array.from(codes);
  }, [resolvedReceipts]);

  const tallyRows = useMemo(() => {
    const code = selectedTallyShipment.trim().toUpperCase();
    if (!code) return [];
    return resolvedReceipts.filter((row) => row.shipment.trim().toUpperCase() === code);
  }, [resolvedReceipts, selectedTallyShipment]);

  const openTally = () => {
    setTallyOpen(true);
  };

  const printTally = () => {
    if (!selectedTallyShipment) return;
    window.print();
  };

  return (
    <div className="w-full space-y-4" dir="rtl">
      <div className="bg-slate-800 text-white rounded-2xl shadow-md border border-slate-700/60 px-5 py-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
          <Printer className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold font-['Cairo']">التحظير الطباعي</h2>
          <p className="text-[11px] text-slate-300 font-bold mt-0.5">
            {activeSheet === 'customers' ? 'قاعدة بيانات العملاء' : 'طباعة وصولات الشحنة'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveSheet('customers')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black border ${
            activeSheet === 'customers'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-white dark:bg-[#1e1e1e] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          قاعدة بيانات العملاء
        </button>
        <button
          type="button"
          onClick={() => setActiveSheet('receipts')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black border ${
            activeSheet === 'receipts'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-white dark:bg-[#1e1e1e] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          طباعة وصولات الشحنة
        </button>
        <button
          type="button"
          onClick={openTally}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black border bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400"
        >
          <ClipboardList className="w-4 h-4" />
          جرد الشحنة
        </button>
      </div>

      {activeSheet === 'customers' && (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm text-right border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-blue-700 text-white">
                  <th className="px-3 py-3 font-black text-[11px] whitespace-nowrap">#</th>
                  <th className="px-3 py-3 font-black text-[11px] whitespace-nowrap">كود العميل</th>
                  <th className="px-3 py-3 font-black text-[11px] whitespace-nowrap">اسم العميل</th>
                  <th className="px-3 py-3 font-black text-[11px] whitespace-nowrap">رقم الهاتف</th>
                  <th className="px-3 py-3 font-black text-[11px] whitespace-nowrap">عنوان الاستلام / المدينة</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((row, index) => (
                  <tr key={row.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-3 py-1.5 text-[11px] font-bold text-slate-400 tabular-nums">{index + 1}</td>
                    <td className="px-1 py-1">
                      <input
                        value={row.clientCode}
                        onChange={(e) => updateCustomer(row.id, { clientCode: e.target.value })}
                        className={cellInput}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={row.clientName}
                        onChange={(e) => updateCustomer(row.id, { clientName: e.target.value })}
                        className={cellInput}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={row.phone}
                        onChange={(e) => updateCustomer(row.id, { phone: e.target.value })}
                        className={cellInput}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={row.city}
                        onChange={(e) => updateCustomer(row.id, { city: e.target.value })}
                        className={cellInput}
                      />
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-slate-100 dark:border-slate-700">
                  <td colSpan={5} className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCustomers((prev) => [...prev, emptyCustomerRow((prev[prev.length - 1]?.id ?? 0) + 1)])
                      }
                      className="text-[11px] font-black text-blue-700 dark:text-blue-300"
                    >
                      + إضافة صف
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSheet === 'receipts' && (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm text-right border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-amber-500 text-slate-950">
                  <th className="px-3 py-3 font-black text-[11px] whitespace-nowrap border-l border-amber-400/60">#</th>
                  {RECEIPT_COLUMNS.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-3 font-black text-[11px] whitespace-nowrap border-l border-amber-400/60 last:border-l-0"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resolvedReceipts.map((row, index) => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-3 py-1.5 text-[11px] font-bold text-slate-400 tabular-nums">{index + 1}</td>
                    <td className="px-1 py-1">
                      <input
                        value={row.shipment}
                        onChange={(e) => updateReceipt(row.id, { shipment: e.target.value })}
                        placeholder="RA6003"
                        className={cellInput}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={row.clientCode}
                        onChange={(e) => updateReceipt(row.id, { clientCode: e.target.value })}
                        placeholder="B449"
                        className={cellInput}
                      />
                    </td>
                    <td className={autoCell}>{row.clientName}</td>
                    <td className={autoCell}>{row.phone}</td>
                    <td className={autoCell}>{row.city}</td>
                    <td className="px-1 py-1">
                      <input
                        value={row.packages}
                        onChange={(e) => updateReceipt(row.id, { packages: e.target.value })}
                        inputMode="numeric"
                        className={`${cellInput} text-center`}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={row.weight}
                        onChange={(e) => updateReceipt(row.id, { weight: e.target.value })}
                        inputMode="decimal"
                        className={`${cellInput} text-center`}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <select
                        value={row.type}
                        onChange={(e) => updateReceipt(row.id, { type: e.target.value as ShipmentKind })}
                        className={`${cellInput} min-w-[90px]`}
                      >
                        <option value=""></option>
                        <option value="جوي">جوي</option>
                        <option value="بحري">بحري</option>
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={row.price}
                        onChange={(e) => updateReceipt(row.id, { price: e.target.value })}
                        inputMode="decimal"
                        className={`${cellInput} text-center`}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={row.sales}
                        onChange={(e) => updateReceipt(row.id, { sales: e.target.value })}
                        inputMode="decimal"
                        className={`${cellInput} text-center`}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="date"
                        value={row.issueDate}
                        onChange={(e) => updateReceipt(row.id, { issueDate: e.target.value })}
                        className={`${cellInput} min-w-[130px]`}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <select
                        value={row.paymentMethod}
                        onChange={(e) => updateReceipt(row.id, { paymentMethod: e.target.value as PaymentMethod })}
                        className={`${cellInput} min-w-[90px]`}
                      >
                        <option value=""></option>
                        <option value="نقداً">نقداً</option>
                        <option value="آجل">آجل</option>
                      </select>
                    </td>
                    <td className="px-3 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={row.printed}
                        onChange={(e) => updateReceipt(row.id, { printed: e.target.checked })}
                        className="h-4 w-4 accent-amber-500"
                      />
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-slate-100 dark:border-slate-700">
                  <td colSpan={14} className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        setReceipts((prev) => [...prev, emptyReceiptRow((prev[prev.length - 1]?.id ?? 0) + 1)])
                      }
                      className="text-[11px] font-black text-amber-700 dark:text-amber-300"
                    >
                      + إضافة صف
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tallyOpen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-[#121212] tally-print-root" dir="rtl">
          <div className="h-full w-full flex flex-col">
            <div className="px-5 py-3 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-3 no-print">
              <h3 className="text-sm font-extrabold">جرد الشحنة</h3>
              <div className="flex items-center gap-2">
                <select
                  value={selectedTallyShipment}
                  onChange={(e) => setSelectedTallyShipment(e.target.value)}
                  className="rounded-lg bg-slate-700 text-white text-xs font-bold px-3 py-2 outline-none min-w-[160px]"
                >
                  <option value="">اختر رقم الشحنة</option>
                  {shipmentOptions.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={printTally}
                  disabled={!selectedTallyShipment}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-slate-950 px-3 py-2 text-xs font-black disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  طباعة PDF
                </button>
                <button type="button" onClick={() => setTallyOpen(false)} className="rounded-lg p-1 hover:bg-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto tally-print-body p-4">
              {selectedTallyShipment ? (
                <div className="space-y-3">
                  <div className="print-only hidden">
                    <h1 className="text-xl font-extrabold">جرد الشحنة {selectedTallyShipment}</h1>
                  </div>
                  <table className="w-full text-sm text-right border-collapse">
                    <thead className="bg-slate-800 text-white sticky top-0">
                      <tr>
                        <th className="px-3 py-3 text-center text-xs font-extrabold w-14">#</th>
                        <th className="px-3 py-3 text-center text-xs font-extrabold w-20">تحقق</th>
                        <th className="px-3 py-3 text-xs font-extrabold w-36">كود العميل</th>
                        <th className="px-3 py-3 text-xs font-extrabold">العميل والعنوان</th>
                        <th className="px-3 py-3 text-center text-xs font-extrabold w-36">عدد الطرود المقيد</th>
                        <th className="px-3 py-3 text-center text-xs font-extrabold">الجرد الفعلي بالساحة / مطابقة الجرد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tallyRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-xs font-bold text-slate-400">
                            لا توجد بنود لهذه الشحنة
                          </td>
                        </tr>
                      ) : (
                        tallyRows.map((row, index) => (
                          <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700 align-top">
                            <td className="px-3 py-3 text-center text-xs font-bold text-slate-500">{index + 1}</td>
                            <td className="px-3 py-3 text-center">
                              <span className="inline-block w-4 h-4 border-2 border-slate-700 rounded-sm" />
                            </td>
                            <td className="px-3 py-3 font-black font-mono">{row.clientCode}</td>
                            <td className="px-3 py-3">
                              <div className="font-extrabold text-slate-800 dark:text-slate-100">{row.clientName}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{row.city}</div>
                            </td>
                            <td className="px-3 py-3 text-center font-black tabular-nums">{row.packages}</td>
                            <td className="px-3 py-3">
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 min-h-[88px]">
                                {Array.from({ length: parcelCount(row) }, (_, i) => (
                                  <img
                                    key={`${row.id}-${i}`}
                                    src={parcelThumb(row.clientCode || selectedTallyShipment, i)}
                                    alt={`طرد ${i + 1}`}
                                    className="w-full h-[72px] object-cover rounded-md border border-slate-200"
                                  />
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
