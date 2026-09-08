import React, { useState, useEffect } from 'react';
import { X, Printer, ClipboardCheck, FileSpreadsheet, Check } from 'lucide-react';
import { ShipmentRecord } from '../types';
import { COMPANY_INFO } from '../data/initialData';
import { exportYardInventoryToExcel } from '../utils/excel';
import { YARD_INVENTORY_STORAGE_KEY, YardDraftData } from './YardInventoryView';

interface YardInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipments: ShipmentRecord[];
  shipmentFilter: string;
}

export const YardInventoryModal: React.FC<YardInventoryModalProps> = ({
  isOpen,
  onClose,
  shipments,
  shipmentFilter,
}) => {
  if (!isOpen) return null;

  const [actualCounts, setActualCounts] = useState<Record<string, number | ''>>(() => {
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as YardDraftData;
        return parsed.actualCounts || {};
      }
    } catch {
      // ignore
    }
    return {};
  });

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as YardDraftData;
        return parsed.checkedItems || {};
      }
    } catch {
      // ignore
    }
    return {};
  });

  // Keep localStorage synced if edits are made in modal
  useEffect(() => {
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      const existing: YardDraftData = raw ? JSON.parse(raw) : { lastSavedAt: '', checkedItems: {}, actualCounts: {}, itemNotes: {} };
      existing.actualCounts = { ...existing.actualCounts, ...actualCounts };
      existing.checkedItems = { ...existing.checkedItems, ...checkedItems };
      existing.lastSavedAt = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      localStorage.setItem(YARD_INVENTORY_STORAGE_KEY, JSON.stringify(existing));
    } catch (e) {
      console.warn('Could not sync modal changes to localStorage', e);
    }
  }, [actualCounts, checkedItems]);

  const todayStr = new Date().toLocaleDateString('ar-IQ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const totalExpected = shipments.reduce((sum, item) => sum + item.packages, 0);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'height=900,width=800');
    if (!printWindow) {
      window.print();
      return;
    }

    const tableRows = shipments.map((item, idx) => `
      <tr>
        <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
        <td style="font-weight: bold; font-family: monospace;">${item.code}</td>
        <td>${item.name} - ${item.address || item.city}</td>
        <td style="text-align: center; font-weight: bold;">${item.packages}</td>
        <td style="text-align: center; height: 28px;">
          ${actualCounts[item.id] !== undefined && actualCounts[item.id] !== '' ? actualCounts[item.id] : '[ &nbsp;&nbsp;&nbsp;&nbsp; ]'}
        </td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>ورقة جرد الساحة والمستودع - ${COMPANY_INFO.shortNameAr}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Cairo', Tahoma, Arial, sans-serif; direction: rtl; color: #0f172a; padding: 10px; margin: 0; }
          .header-box { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
          h2 { margin: 0; font-size: 18px; color: #0f172a; }
          p { margin: 3px 0 0; font-size: 11px; color: #64748b; }
          .info-bar { font-size: 12px; font-weight: bold; margin-bottom: 12px; background: #f1f5f9; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 5px; }
          th, td { padding: 6px 8px; border: 1px solid #94a3b8; text-align: right; }
          th { background-color: #0f172a !important; color: #ffffff !important; font-weight: bold; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .footer { margin-top: 35px; display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h2>${COMPANY_INFO.nameAr}</h2>
          <p>نموذج جرد الساحة والمستودع واستلام الطرود الفعلي (A4)</p>
        </div>
        <div class="info-bar">
          <div>الشحنة المستهدفة: <b>${shipmentFilter}</b></div>
          <div>تاريخ الجرد: <b>${todayStr}</b></div>
          <div>إجمالي الطرود المقيدة: <b>${totalExpected} طرد</b></div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 7%; text-align: center;">#</th>
              <th style="width: 15%;">كود العميل</th>
              <th style="width: 48%;">العميل والعنوان</th>
              <th style="width: 14%; text-align: center;">الطرود المقيدة</th>
              <th style="width: 16%; text-align: center;">الجرد الفعلي</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <div class="footer">
          <div>اسم مسؤول الساحة / أمين المستودع: ........................................</div>
          <div>التوقيع والختم: ........................................</div>
        </div>
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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Top Bar */}
        <div className="px-5 py-4 bg-slate-800 text-white flex items-center justify-between border-b border-slate-700/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-['Cairo']">
                ورقة جرد الساحة والمستودع - الشحنة: {shipmentFilter}
              </h3>
              <p className="text-xs text-slate-400">
                تدقيق ومطابقة عدد الطرود المقيدة بالمنظومة مع الطرود الفعلية في الساحة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة ورقة الجرد (A4)</span>
            </button>

            <button
              onClick={() => exportYardInventoryToExcel(shipments, shipmentFilter)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-semibold"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>تصدير إكسل</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between text-xs text-amber-900 font-bold">
            <span>عدد البنود للجرد: {shipments.length} عميل</span>
            <span>إجمالي الطرود المقيدة: {totalExpected} طرد</span>
            <span>تاريخ اليوم: {todayStr}</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-right text-xs border-collapse font-medium">
              <thead className="bg-slate-800 text-white font-bold">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 w-10 text-center">تحقق</th>
                  <th className="py-2.5 px-3 w-24">كود العميل</th>
                  <th className="py-2.5 px-3">العميل والعنوان</th>
                  <th className="py-2.5 px-3 w-28 text-center">عدد الطرود المقيد</th>
                  <th className="py-2.5 px-3 w-36 text-center">الجرد الفعلي بالساحة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shipments.map((item, index) => {
                  const isChecked = !!checkedItems[item.id];
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isChecked ? 'bg-emerald-50/60' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-bold">
                        {index + 1}
                      </td>

                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setCheckedItems((prev) => ({
                              ...prev,
                              [item.id]: !prev[item.id],
                            }))
                          }
                          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            isChecked
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 hover:border-amber-500'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      </td>

                      <td className="py-2 px-3 font-mono font-bold text-amber-700">
                        {item.code}
                      </td>

                      <td className="py-2 px-3 text-slate-900">
                        <span className="font-bold">{item.name}</span>
                        <span className="text-slate-500 text-[11px] block">
                          {item.address || item.city}
                        </span>
                      </td>

                      <td className="py-2 px-3 text-center font-bold text-emerald-800">
                        📦 {item.packages}
                      </td>

                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          placeholder={String(item.packages)}
                          value={actualCounts[item.id] !== undefined ? actualCounts[item.id] : ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setActualCounts((prev) => ({ ...prev, [item.id]: val }));
                          }}
                          className="w-20 px-2 py-1 text-center font-mono text-xs border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
