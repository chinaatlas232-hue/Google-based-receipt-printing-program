import React, { useMemo, useState } from 'react';
import { Printer, FileSpreadsheet, ClipboardList, X } from 'lucide-react';
import { ShipmentRecord } from '../types';
import { COMPANY_INFO } from '../data/initialData';
import { ATLAS_LOGO_BASE64 } from '../data/logoBase64';

type SheetTab = 'receipts' | 'tally';

interface PrintPrepViewProps {
  shipments: ShipmentRecord[];
}

function keyOf(value: string | undefined | null): string {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function uniqueShipmentCodes(shipments: ShipmentRecord[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  shipments.forEach((item) => {
    const raw = String(item.shipment ?? '').trim();
    if (!raw) return;
    const key = keyOf(raw);
    if (seen.has(key)) return;
    seen.add(key);
    next.push(raw);
  });
  return next.sort((a, b) => a.localeCompare(b, 'ar'));
}

function priceUnitLabel(type: string): string {
  return type.includes('بحري') || type.toLowerCase().includes('sea')
    ? 'السعر للمكعب (CBM):'
    : 'السعر للكيلو (KG):';
}

function money(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function todayStr(): string {
  return new Date().toLocaleDateString('ar-IQ-u-nu-latn', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export const PrintPrepView: React.FC<PrintPrepViewProps> = ({ shipments }) => {
  const [activeSheet, setActiveSheet] = useState<SheetTab>('receipts');
  const [selectedReceiptShipment, setSelectedReceiptShipment] = useState('');
  const [tallyOpen, setTallyOpen] = useState(false);
  const [selectedTallyShipment, setSelectedTallyShipment] = useState('');

  const shipmentOptions = useMemo(() => uniqueShipmentCodes(shipments), [shipments]);

  const receiptsToPrint = useMemo(() => {
    const code = keyOf(selectedReceiptShipment);
    if (!code) return [];
    return shipments.filter((item) => keyOf(item.shipment) === code);
  }, [shipments, selectedReceiptShipment]);

  const tallyRows = useMemo(() => {
    const code = keyOf(selectedTallyShipment);
    if (!code) return [];
    return shipments.filter((item) => keyOf(item.shipment) === code);
  }, [shipments, selectedTallyShipment]);

  const printReceipts = () => {
    if (receiptsToPrint.length === 0) return;
    const issue = todayStr();
    const pages = receiptsToPrint
      .map((row) => {
        const type = String(row.type || '');
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
              <td><b>كود العميل:</b> <span class="amber">${escapeHtml(row.code || '—')}</span></td>
              <td><b>رقم الشحنة:</b> <span class="amber">${escapeHtml(row.shipment || '—')}</span></td>
              <td><b>تاريخ الإصدار:</b> <span class="amber">${escapeHtml(issue)}</span></td>
            </tr>
            <tr>
              <td><b>اسم العميل:</b> ${escapeHtml(row.name || '—')}</td>
              <td><b>رقم الهاتف:</b> <span dir="ltr">${escapeHtml(row.phone || '—')}</span></td>
              <td><b>عنوان الاستلام:</b> ${escapeHtml(row.address || row.city || '—')}</td>
            </tr>
            <tr>
              <td><b>عدد الطرود:</b> ${escapeHtml(String(row.packages || 0))} طرد</td>
              <td><b>الوزن الإجمالي:</b> ${escapeHtml(String(row.weight || 0))} كغ</td>
              <td><b>نوع الشحنة:</b> ${escapeHtml(type || '—')}</td>
            </tr>
            <tr>
              <td><b>${escapeHtml(priceUnitLabel(type))}</b> $${escapeHtml(money(Number(row.price) || 0))}</td>
              <td colspan="2" class="sales">
                <b>إجمالي المبيعات / الديون:</b> $${escapeHtml(money(Number(row.sales) || 0))}
                &nbsp;&nbsp; طريقة الدفع: ☐ نقداً &nbsp; ☐ آجل
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
  };

  const printTally = () => {
    if (!selectedTallyShipment) return;
    const totalPackages = tallyRows.reduce((sum, row) => sum + (Number(row.packages) || 0), 0);
    const tableRows = tallyRows
      .map(
        (row, index) => `
        <tr>
          <td class="col-index">${index + 1}</td>
          <td class="col-code">${escapeHtml(row.code || '')}</td>
          <td class="col-client">
            <div class="client-name">${escapeHtml(row.name || '—')}</div>
            <div class="client-address">${escapeHtml(row.address || row.city || '')}</div>
          </td>
          <td class="col-packages">${escapeHtml(String(row.packages || 0))}</td>
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
          <div>تاريخ الجرد: <b>${todayStr()}</b></div>
          <div>إجمالي الطرود المقيدة: <b>${totalPackages} طرد</b></div>
          <div>عدد البنود: <b>${tallyRows.length}</b></div>
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
      @page { size: A4 portrait; margin: 6mm; }
      @media print {
        @page { size: A4 portrait; margin: 6mm; }
        html, body { width: 100%; margin: 0; padding: 0; }
        .sheet { padding: 0; }
      }
      .sheet { padding: 2mm; }
      .header-box { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 6px; }
      h2 { margin: 0; font-size: 16px; line-height: 1.2; }
      p { margin: 2px 0 0; font-size: 10px; color: #64748b; line-height: 1.2; }
      .info-bar { font-size: 11px; font-weight: 700; margin-bottom: 6px; background: #f1f5f9; padding: 4px 8px; border: 1px solid #cbd5e1; display: flex; justify-content: space-between; gap: 6px; flex-wrap: wrap; line-height: 1.2; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { padding: 2px 4px; border: 1px solid #94a3b8; text-align: right; line-height: 1.15; vertical-align: middle; }
      th { background: #0f172a !important; color: #fff !important; font-size: 11px; padding: 3px 4px; }
      tr { page-break-inside: avoid; }
      tr:nth-child(even) { background: #f8fafc; }
      .col-index { text-align: center; width: 5%; font-size: 11px; font-weight: 700; }
      .col-code { width: 16%; font-family: monospace; font-weight: 800; font-size: 15px; }
      .col-client { width: 35%; }
      .client-name { font-weight: 800; font-size: 15px; line-height: 1.15; }
      .client-address { font-size: 18px; color: #334155; line-height: 1.15; font-weight: 600; }
      .col-packages { text-align: center; width: 12%; font-weight: 800; font-size: 12px; }
      .tally-cell { height: 16px; min-height: 16px; background: #fff !important; width: 32%; }
      .footer { margin-top: 10px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; page-break-inside: avoid; }
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
            {activeSheet === 'receipts' ? 'طباعة وصولات الشحنة' : 'جرد الشحنة'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
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
          onClick={() => {
            setActiveSheet('tally');
            setTallyOpen(true);
          }}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black border ${
            activeSheet === 'tally'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-white dark:bg-[#1e1e1e] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          جرد الشحنة
        </button>
      </div>

      {activeSheet === 'receipts' && (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 sm:p-6">
          <div className="max-w-xl mx-auto space-y-4">
            <label className="flex flex-col gap-1.5 text-[11px] font-extrabold text-slate-500">
              رقم الشحنة
              <select
                value={selectedReceiptShipment}
                onChange={(e) => setSelectedReceiptShipment(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-3 py-3 text-sm font-black text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
              >
                <option value="">اختر رقم الشحنة</option>
                {shipmentOptions.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs font-bold text-slate-500">
              {selectedReceiptShipment
                ? `${receiptsToPrint.length} وصل جاهز للطباعة من الشحنة ${selectedReceiptShipment}`
                : `${shipmentOptions.length} شحنة متاحة في النظام`}
            </p>
            <button
              type="button"
              onClick={printReceipts}
              disabled={receiptsToPrint.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-3 text-sm font-black disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              طباعة الوصولات (A5 أفقي)
            </button>
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
                <button
                  type="button"
                  onClick={() => {
                    setTallyOpen(false);
                    setActiveSheet('receipts');
                  }}
                  className="rounded-lg p-1 hover:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto tally-print-body p-4">
              {selectedTallyShipment ? (
                <div className="space-y-3">
                  <table className="w-full text-sm text-right border-collapse">
                    <thead className="bg-[#1e3a5f] text-white sticky top-0">
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
                          <tr key={row.id || `${row.shipment}-${row.code}-${index}`} className="border-t border-slate-200 dark:border-slate-700">
                            <td className="px-3 py-3 text-center text-xs font-bold text-slate-500">{index + 1}</td>
                            <td className="px-3 py-3 font-black font-mono">{row.code}</td>
                            <td className="px-3 py-3">
                              <div className="font-extrabold text-slate-800 dark:text-slate-100">{row.name}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{row.address || row.city}</div>
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
              ) : (
                <p className="text-center text-sm font-bold text-slate-400 py-16">اختر رقم الشحنة لعرض كافة البنود</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
