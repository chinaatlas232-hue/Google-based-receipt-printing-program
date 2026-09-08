import React from 'react';
import { X, Printer, Ship, Check, AlertCircle } from 'lucide-react';
import { ShipmentRecord } from '../types';
import { COMPANY_INFO } from '../data/initialData';
import { ATLAS_LOGO_BASE64 } from '../data/logoBase64';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipments: ShipmentRecord[];
  isBatch?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  shipments,
  isBatch = false,
}) => {
  if (!isOpen || shipments.length === 0) return null;

  const todayStr = new Date().toLocaleDateString('ar-IQ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const handlePrint = () => {
    // Open clean print window
    const printWindow = window.open('', '_blank', 'height=800,width=700');
    if (!printWindow) {
      window.print();
      return;
    }

    const receiptsHtml = shipments.map((item) => renderReceiptHtml(item, todayStr)).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>وصل تسليم بضاعة - ${COMPANY_INFO.shortNameAr}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A5 portrait;
            margin: 6mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Cairo', Tahoma, Arial, sans-serif;
            direction: rtl;
            background: #ffffff;
            color: #0f172a;
          }
          .receipt-page {
            width: 100%;
            max-width: 144mm;
            margin: 0 auto;
            padding: 10px;
            border: 2px solid #0f172a;
            border-radius: 4px;
            background: #ffffff;
            page-break-after: always;
            break-after: page;
          }
          .receipt-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            padding: 5px 6px;
            border: 1px solid #cbd5e1;
            font-size: 11px;
            text-align: right;
          }
          .bg-light {
            background-color: #f1f5f9 !important;
          }
          .bg-highlight {
            background-color: #fef3c7 !important;
            border-color: #f59e0b !important;
          }
          .text-amber {
            color: #b45309 !important;
            font-weight: bold;
          }
          .text-primary {
            color: #0f172a !important;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        ${receiptsHtml}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 no-print">
      <div className="bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 w-full max-w-3xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-['Cairo']">
                {isBatch ? `معاينة وصولات الدفعة (${shipments.length} وصل)` : `معاينة وصل التسليم: ${shipments[0]?.name}`}
              </h3>
              <p className="text-[11px] text-slate-400">
                مقاس الطباعة المعتمد: A5 Portrait مع نموذج الإقرار والتوقيع
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>طباعة الآن (A5)</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Preview Canvas */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-200/80 space-y-6">
          {shipments.map((item, idx) => (
            <div
              key={item.id || idx}
              className="bg-white rounded-lg shadow-md border-2 border-slate-900 p-4 max-w-[150mm] mx-auto text-slate-900 font-['Cairo'] text-xs"
            >
              {/* Receipt Header */}
              <div className="border-b-2 border-slate-900 pb-3 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={ATLAS_LOGO_BASE64}
                    alt="Atlas Ocean Logo"
                    className="w-12 h-12 object-contain rounded-md"
                  />
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900 m-0 leading-tight">
                      {COMPANY_INFO.shortNameAr}
                    </h2>
                    <p className="text-[9px] text-slate-500 m-0 font-sans tracking-wide">
                      {COMPANY_INFO.nameEn}
                    </p>
                  </div>
                </div>

                <div className="text-left">
                  <div className="text-xs font-black text-amber-700">
                    وصل تسليم بضاعة
                  </div>
                  <div className="text-[9px] text-slate-600 font-sans">
                    Cargo Delivery Receipt
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <table className="w-full border-collapse border border-slate-300 text-[11px] mb-3">
                <tbody>
                  <tr className="bg-slate-100">
                    <td className="p-1.5 border border-slate-300 w-1/2">
                      <span className="font-bold text-slate-700">كود العميل:</span>{' '}
                      <span className="font-bold text-amber-700 font-mono text-xs">{item.code}</span>
                    </td>
                    <td className="p-1.5 border border-slate-300 w-1/2">
                      <span className="font-bold text-slate-700">رقم الشحنة:</span>{' '}
                      <span className="font-bold text-amber-700 font-mono text-xs">{item.shipment}</span>
                    </td>
                  </tr>

                  <tr>
                    <td className="p-1.5 border border-slate-300">
                      <span className="font-bold text-slate-700">اسم العميل:</span>{' '}
                      <span className="font-bold text-slate-950">{item.name}</span>
                    </td>
                    <td className="p-1.5 border border-slate-300" dir="ltr">
                      <span className="font-bold text-slate-700 float-right">رقم الهاتف:</span>{' '}
                      <span className="font-mono font-bold text-slate-900">{item.phone}</span>
                    </td>
                  </tr>

                  {item.guarantor && (
                    <tr className="bg-slate-50">
                      <td colSpan={2} className="p-1.5 border border-slate-300">
                        <span className="font-bold text-slate-700">الكفيل الضامن:</span>{' '}
                        <span className="font-bold text-slate-900">{item.guarantor}</span>
                      </td>
                    </tr>
                  )}

                  <tr className="bg-slate-100">
                    <td className="p-1.5 border border-slate-300">
                      <span className="font-bold text-slate-700">عنوان الاستلام:</span>{' '}
                      <span className="font-semibold text-slate-800">{item.address || 'مركز الفرع'}</span>
                    </td>
                    <td className="p-1.5 border border-slate-300">
                      <span className="font-bold text-slate-700">عدد الطرود:</span>{' '}
                      <span className="font-black text-emerald-800 font-mono">📦 {item.packages} طرد</span>
                    </td>
                  </tr>

                  <tr>
                    <td className="p-1.5 border border-slate-300">
                      <span className="font-bold text-slate-700">تاريخ الإصدار:</span>{' '}
                      <span className="font-mono font-bold text-amber-700">{todayStr}</span>
                    </td>
                    <td className="p-1.5 border border-slate-300">
                      <span className="font-bold text-slate-700">الوزن الإجمالي:</span>{' '}
                      <span className="font-mono font-bold text-slate-950">{item.weight} كغ</span>
                    </td>
                  </tr>

                  <tr className="bg-slate-100">
                    <td className="p-1.5 border border-slate-300">
                      <span className="font-bold text-slate-700">نوع الشحنة:</span>{' '}
                      <span className="font-semibold">{item.type}</span>
                    </td>
                    <td className="p-1.5 border border-slate-300">
                      <span className="font-bold text-slate-700">حجم الشحنة (CBM):</span>{' '}
                      <span className="font-mono font-bold text-purple-800">{item.cbm.toFixed(2)} CBM</span>
                    </td>
                  </tr>

                  <tr>
                    <td colSpan={2} className="p-1.5 border border-slate-300">
                      <span className="font-bold text-slate-700">السعر للكيلو:</span>{' '}
                      <span className="font-mono font-semibold">${item.price.toFixed(2)}</span>
                    </td>
                  </tr>

                  <tr className="bg-amber-50 border-amber-300">
                    <td colSpan={2} className="p-2 border border-amber-300">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900">إجمالي المبيعات (الديون):</span>{' '}
                          <span className="font-black text-amber-800 text-sm font-mono mr-1">
                            ${item.sales.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-800">
                          <span className="flex items-center gap-1">
                            <span className="w-3.5 h-3.5 border border-slate-500 inline-block rounded-xs"></span>
                            نقداً
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-3.5 h-3.5 border border-slate-500 inline-block rounded-xs"></span>
                            أجل
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Receipt Pledge */}
              <div className="bg-amber-50/70 border border-amber-200 rounded p-2 mb-3">
                <p className="text-[10px] text-amber-900 m-0 leading-relaxed font-semibold">
                  <strong>إقرار الاستلام:</strong> أقر أنا الموقع أدناه، بأنني استلمت البضاعة والشحنة المذكورة أعلاه كاملة، وبحالة سليمة وممتازة، ومطابقة لكافة الأوزان والأوصاف المدونة.
                </p>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-4 my-3 pt-2 text-[11px] font-bold">
                <div>
                  اسم المستلم: .......................................
                  <br /><br />
                  التاريخ: ...........................................
                </div>
                <div className="text-left">
                  توقيع وختم المستلم:
                  <br /><br />
                  ....................................................
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-dashed border-slate-300 pt-2 text-center text-[9px] text-slate-600 flex flex-wrap justify-between items-center gap-1">
                <span>{COMPANY_INFO.address}</span>
                <span dir="ltr">📞 {COMPANY_INFO.phone1} / {COMPANY_INFO.phone2}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Helper to generate print HTML string
function renderReceiptHtml(item: ShipmentRecord, todayDate: string): string {
  const guarantorHtml = item.guarantor ? `
    <tr style="background-color: #f8fafc;">
      <td colspan="2" style="padding: 5px; border: 1px solid #bcccdc;">
        <strong>الكفيل الضامن:</strong> <span style="font-weight: bold;">${item.guarantor}</span>
      </td>
    </tr>
  ` : '';

  return `
    <div class="receipt-page">
      <table style="width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 10px;">
        <tr>
          <td style="text-align: right; vertical-align: middle; border: none; padding: 0; display: flex; align-items: center; gap: 8px;">
            <img src="${ATLAS_LOGO_BASE64}" style="height: 46px; width: 46px; object-fit: contain;" alt="Logo" />
            <div>
              <h2 style="margin: 0; font-size: 14px; color: #0f172a; font-weight: 800;">${COMPANY_INFO.shortNameAr}</h2>
              <p style="margin: 2px 0 0; font-size: 9px; color: #64748b;">${COMPANY_INFO.nameEn}</p>
            </div>
          </td>
          <td style="text-align: left; vertical-align: middle; border: none; padding: 0;">
            <h3 style="margin: 0; font-size: 14px; color: #b45309; font-weight: 800;">وصل تسليم بضاعة</h3>
            <p style="margin: 2px 0 0; font-size: 9px; color: #334155;">Cargo Delivery Receipt</p>
          </td>
        </tr>
      </table>

      <table style="width: 100%; font-size: 11px; margin-bottom: 8px;">
        <tr style="background-color: #f1f5f9;">
          <td style="width: 50%;"><strong>كود العميل:</strong> <span style="color: #b45309; font-weight: bold;">${item.code}</span></td>
          <td style="width: 50%;"><strong>رقم الشحنة:</strong> <span style="color: #b45309; font-weight: bold;">${item.shipment}</span></td>
        </tr>
        <tr>
          <td><strong>اسم العميل:</strong> <span style="font-weight: bold;">${item.name}</span></td>
          <td><strong>رقم الهاتف:</strong> <span style="direction: ltr; display: inline-block; font-weight: bold;">${item.phone}</span></td>
        </tr>
        ${guarantorHtml}
        <tr style="background-color: #f1f5f9;">
          <td><strong>عنوان الاستلام:</strong> <span>${item.address || 'الفرع'}</span></td>
          <td><strong>عدد الطرود:</strong> 📦 <b>${item.packages} طرد</b></td>
        </tr>
        <tr>
          <td><strong>تاريخ الإصدار:</strong> <span style="color: #b45309; font-weight: bold;">${todayDate}</span></td>
          <td><strong>الوزن الإجمالي:</strong> <b>${item.weight} كغ</b></td>
        </tr>
        <tr style="background-color: #f1f5f9;">
          <td><strong>نوع الشحنة:</strong> ${item.type}</td>
          <td><strong>حجم الشحنة (CBM):</strong> <span style="color: #6b21a8; font-weight: bold;">${item.cbm.toFixed(2)}</span></td>
        </tr>
        <tr>
          <td colspan="2"><strong>السعر للكيلو:</strong> $${item.price.toFixed(2)}</td>
        </tr>
        <tr style="background-color: #fef3c7;">
          <td colspan="2" style="border: 1px solid #f59e0b;">
            <strong>إجمالي المبيعات (الديون):</strong> 
            <span style="color: #b45309; font-weight: bold; font-size: 13px;">$${item.sales.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</span>
            &nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;&nbsp;
            <strong>طريقة الدفع:</strong> [ &nbsp; ] نقداً &nbsp;&nbsp; [ &nbsp; ] أجل
          </td>
        </tr>
      </table>

      <div style="background-color: #fffbeb; border: 1px solid #fde68a; padding: 6px; border-radius: 4px; margin-bottom: 8px;">
        <p style="margin: 0; font-size: 9.5px; color: #92400e; line-height: 1.3;">
          <strong>إقرار الاستلام:</strong><br>
          أقر أنا الموقع أدناه، بأنني استلمت البضاعة والشحنة المذكورة أعلاه كاملة، وبحالة سليمة وممتازة، ومطابقة لكافة الأوزان والأوصاف المدونة.
        </p>
      </div>

      <table style="width: 100%; font-size: 10.5px; margin-bottom: 8px; border: none;">
        <tr>
          <td style="width: 50%; border: none; padding: 2px;"><strong>اسم المستلم:</strong><br><br>............................................</td>
          <td style="width: 50%; border: none; padding: 2px; text-align: left;"><strong>توقيع وختم المستلم:</strong><br><br>............................................</td>
        </tr>
      </table>

      <div style="border-top: 1px dashed #cbd5e1; margin-top: 6px; padding-top: 4px; text-align: center; font-size: 9px; color: #475569;">
        <span>${COMPANY_INFO.address}</span> | <span style="direction: ltr; display: inline-block;">📞 ${COMPANY_INFO.phone1} / ${COMPANY_INFO.phone2}</span>
      </div>
    </div>
  `;
}
