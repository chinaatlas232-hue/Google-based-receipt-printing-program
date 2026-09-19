import React, { useMemo, useState } from 'react';
import { Printer, FileSpreadsheet, Users, ClipboardList, X } from 'lucide-react';
import { COMPANY_INFO } from '../data/initialData';
import { ATLAS_LOGO_BASE64 } from '../data/logoBase64';

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

function formatIssueDate(value: string): string {
  if (!value) return '';
  const [y, m, d] = value.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return value;
}

function priceUnitLabel(type: string): string {
  return type.includes('بحري') ? 'السعر للمكعب (CBM):' : 'السعر للكيلو (KG):';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function openPrintWindow(title: string, bodyHtml: string, pageCss: string) {
  const printWindow = window.open('', '_blank', 'height=900,width=1200');
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 0; font-family: 'Cairo', Tahoma, Arial, sans-serif; direction: rtl; background: #fff; color: #0f172a; }
    ${pageCss}
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
    return;
  }
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  window.setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    iframe.remove();
  }, 500);
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
  const [selectedReceiptShipment, setSelectedReceiptShipment] = useState('');

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

  const printableReceipts = useMemo(
    () => resolvedReceipts.filter((row) => row.shipment.trim() && row.clientCode.trim()),
    [resolvedReceipts]
  );

  const receiptsToPrint = useMemo(() => {
    const code = selectedReceiptShipment.trim().toUpperCase();
    if (!code) return printableReceipts;
    return printableReceipts.filter((row) => row.shipment.trim().toUpperCase() === code);
  }, [printableReceipts, selectedReceiptShipment]);

  const openTally = () => {
    setTallyOpen(true);
  };

  const printReceipts = () => {
    if (receiptsToPrint.length === 0) return;
    const pages = receiptsToPrint
      .map((row) => {
        const cashMark = row.paymentMethod === 'نقداً' ? '☑' : '☐';
        const creditMark = row.paymentMethod === 'آجل' ? '☑' : '☐';
        const issue = formatIssueDate(row.issueDate);
        return `
        <section class="receipt-page">
          <header class="receipt-head">
            <div class="brand">
              <img src="${ATLAS_LOGO_BASE64}" alt="logo" />
              <div>
                <h1>${escapeHtml(COMPANY_INFO.shortNameAr)}</h1>
                <p>${escapeHtml(COMPANY_INFO.nameEn)}</p>
              </div>
            </div>
            <div class="title">
              <h2>وصل تسليم بضاعة</h2>
              <p>Cargo Delivery Receipt — A5 Landscape</p>
            </div>
          </header>
          <table class="meta">
            <tr>
              <td><b>كود العميل:</b> <span class="amber">${escapeHtml(row.clientCode)}</span></td>
              <td><b>رقم الشحنة:</b> <span class="amber">${escapeHtml(row.shipment)}</span></td>
              <td><b>تاريخ الإصدار:</b> <span class="amber">${escapeHtml(issue)}</span></td>
            </tr>
            <tr>
              <td><b>اسم العميل:</b> ${escapeHtml(row.clientName || '—')}</td>
              <td><b>رقم الهاتف:</b> <span dir="ltr">${escapeHtml(row.phone || '—')}</span></td>
              <td><b>عنوان الاستلام:</b> ${escapeHtml(row.city || '—')}</td>
            </tr>
            <tr>
              <td><b>عدد الطرود:</b> ${escapeHtml(row.packages || '0')} طرد</td>
              <td><b>الوزن الإجمالي:</b> ${escapeHtml(row.weight || '0')} كغ</td>
              <td><b>نوع الشحنة:</b> ${escapeHtml(row.type || '—')}</td>
            </tr>
            <tr>
              <td><b>${escapeHtml(priceUnitLabel(row.type))}</b> $${escapeHtml(row.price || '0')}</td>
              <td colspan="2" class="sales">
                <b>إجمالي المبيعات / الديون:</b> $${escapeHtml(row.sales || '0')}
                &nbsp;&nbsp; طريقة الدفع: ${cashMark} نقداً &nbsp; ${creditMark} آجل
              </td>
            </tr>
          </table>
          <div class="pledge">
            <b>إقرار الاستلام:</b>
            أقر أنا الموقع أدناه بأنني استلمت البضاعة والشحنة المذكورة أعلاه كاملة وبحالة سليمة ومطابقة للأوزان والأوصاف المدونة.
          </div>
          <div class="signs">
            <div>اسم المستلم: ........................................<br/>التاريخ: ........................................</div>
            <div>توقيع وختم المستلم:<br/>........................................</div>
          </div>
          <footer>
            ${escapeHtml(COMPANY_INFO.address)} | <span dir="ltr">${escapeHtml(COMPANY_INFO.phone1)} / ${escapeHtml(COMPANY_INFO.phone2)}</span>
          </footer>
        </section>`;
      })
      .join('');

    openPrintWindow('وصولات تسليم الشحنة', pages, `
      @page { size: A5 landscape; margin: 6mm; }
      .receipt-page {
        width: 198mm;
        min-height: 136mm;
        margin: 0 auto 8mm;
        padding: 7mm;
        border: 2px solid #0f172a;
        border-radius: 4px;
        page-break-after: always;
        break-after: page;
      }
      .receipt-page:last-child { page-break-after: auto; break-after: auto; }
      .receipt-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 8px; }
      .brand { display: flex; align-items: center; gap: 8px; }
      .brand img { width: 42px; height: 42px; object-fit: contain; }
      .brand h1 { margin: 0; font-size: 14px; }
      .brand p { margin: 2px 0 0; font-size: 9px; color: #64748b; }
      .title { text-align: left; }
      .title h2 { margin: 0; font-size: 16px; color: #b45309; }
      .title p { margin: 2px 0 0; font-size: 9px; color: #475569; }
      table.meta { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }
      table.meta td { border: 1px solid #cbd5e1; padding: 5px 7px; width: 33.33%; }
      table.meta tr:nth-child(odd) td { background: #f8fafc; }
      .amber { color: #b45309; font-weight: 800; }
      .sales { background: #fef3c7 !important; }
      .pledge { background: #fffbeb; border: 1px solid #fde68a; padding: 7px; font-size: 10px; line-height: 1.5; margin-bottom: 10px; }
      .signs { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin-bottom: 10px; }
      footer { border-top: 1px dashed #94a3b8; padding-top: 5px; text-align: center; font-size: 9px; color: #475569; }
      @media print { body { padding: 0; } .receipt-page { margin: 0; width: auto; min-height: auto; } }
    `);

    const printedIds = new Set(receiptsToPrint.map((row) => row.id));
    setReceipts((prev) => prev.map((row) => (printedIds.has(row.id) ? { ...row, printed: true } : row)));
  };

  const printTally = () => {
    if (!selectedTallyShipment) return;
    const todayStr = new Date().toLocaleDateString('ar-IQ-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const totalPackages = tallyRows.reduce((sum, row) => sum + (Number(row.packages) || 0), 0);
    const tableRows = tallyRows
      .map(
        (row, index) => `
        <tr>
          <td style="text-align:center;">${index + 1}</td>
          <td style="font-weight:800; font-family:monospace;">${escapeHtml(row.clientCode)}</td>
          <td>
            <div style="font-weight:800;">${escapeHtml(row.clientName || '—')}</div>
            <div style="font-size:10px; color:#64748b;">${escapeHtml(row.city || '')}</div>
          </td>
          <td style="text-align:center; font-weight:800;">${escapeHtml(row.packages || '0')}</td>
          <td class="tally-cell"></td>
        </tr>`
      )
      .join('');

    openPrintWindow(`جرد الشحنة ${selectedTallyShipment}`, `
      <div class="sheet">
        <div class="header-box">
          <h2>${escapeHtml(COMPANY_INFO.nameAr)}</h2>
          <p>ورقة جرد الشحنة واستلام الطرود الفعلي</p>
        </div>
        <div class="info-bar">
          <div>الشحنة: <b>${escapeHtml(selectedTallyShipment)}</b></div>
          <div>تاريخ الجرد: <b>${todayStr}</b></div>
          <div>إجمالي الطرود المقيدة: <b>${totalPackages} طرد</b></div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:6%; text-align:center;">#</th>
              <th style="width:16%;">كود العميل</th>
              <th style="width:34%;">العميل والعنوان</th>
              <th style="width:14%; text-align:center;">عدد الطرود المقيد</th>
              <th style="width:30%; text-align:center;">الجرد الفعلي بالساحة</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="footer">
          <div>اسم مسؤول الساحة / أمين المستودع: ........................................</div>
          <div>التوقيع والختم: ........................................</div>
        </div>
      </div>
    `, `
      @page { size: A4 landscape; margin: 8mm; }
      .sheet { padding: 4mm; }
      .header-box { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
      h2 { margin: 0; font-size: 18px; }
      p { margin: 3px 0 0; font-size: 11px; color: #64748b; }
      .info-bar { font-size: 12px; font-weight: 700; margin-bottom: 10px; background: #f1f5f9; padding: 8px 12px; border: 1px solid #cbd5e1; display: flex; justify-content: space-between; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
      th, td { padding: 8px; border: 1px solid #94a3b8; text-align: right; }
      th { background: #0f172a !important; color: #fff !important; }
      tr:nth-child(even) { background: #f8fafc; }
      .tally-cell { height: 36px; background: #fff !important; }
      .footer { margin-top: 28px; display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; }
    `);
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
        {activeSheet === 'receipts' && (
          <>
            <select
              value={selectedReceiptShipment}
              onChange={(e) => setSelectedReceiptShipment(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e1e1e] text-slate-700 dark:text-slate-200 text-xs font-black px-3 py-2 outline-none min-w-[150px]"
            >
              <option value="">كل الشحنات</option>
              {shipmentOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={printReceipts}
              disabled={receiptsToPrint.length === 0}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black border bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              طباعة الوصولات (A5 أفقي)
            </button>
          </>
        )}
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
                        <th className="px-3 py-3 text-xs font-extrabold w-36">كود العميل</th>
                        <th className="px-3 py-3 text-xs font-extrabold">العميل والعنوان</th>
                        <th className="px-3 py-3 text-center text-xs font-extrabold w-36">عدد الطرود المقيد</th>
                        <th className="px-3 py-3 text-center text-xs font-extrabold">الجرد الفعلي بالساحة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tallyRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-xs font-bold text-slate-400">
                            لا توجد بنود لهذه الشحنة
                          </td>
                        </tr>
                      ) : (
                        tallyRows.map((row, index) => (
                          <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700">
                            <td className="px-3 py-3 text-center text-xs font-bold text-slate-500">{index + 1}</td>
                            <td className="px-3 py-3 font-black font-mono">{row.clientCode}</td>
                            <td className="px-3 py-3">
                              <div className="font-extrabold text-slate-800 dark:text-slate-100">{row.clientName}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{row.city}</div>
                            </td>
                            <td className="px-3 py-3 text-center font-black tabular-nums">{row.packages}</td>
                            <td className="px-3 py-3">
                              <div className="min-h-[42px] rounded-md border border-dashed border-slate-300 bg-white dark:bg-slate-900" />
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
