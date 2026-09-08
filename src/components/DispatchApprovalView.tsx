import React, { useState, useMemo } from 'react';
import { 
  FileCheck2, 
  Printer, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Calendar,
  Building2,
  Search,
  Check,
  FileSpreadsheet
} from 'lucide-react';
import { ShipmentRecord } from '../types';
import { COMPANY_INFO } from '../data/initialData';
import * as XLSX from 'xlsx';

interface DispatchApprovalViewProps {
  shipments: ShipmentRecord[];
}

export const DispatchApprovalView: React.FC<DispatchApprovalViewProps> = ({ shipments }) => {
  // Available shipments
  const availableShipments = useMemo(() => {
    const list = Array.from(new Set(shipments.map(s => s.shipment)));
    return list.sort();
  }, [shipments]);

  const [selectedShipment, setSelectedShipment] = useState<string>(availableShipments[0] || 'RA6062');
  const [approvals, setApprovals] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const checkDate = new Date().toLocaleDateString('ar-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const filteredItems = useMemo(() => {
    return shipments.filter(s => {
      const matchShip = selectedShipment === 'الكل' || s.shipment === selectedShipment;
      const matchSearch = searchQuery.trim() === '' || 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.city.toLowerCase().includes(searchQuery.toLowerCase());
      return matchShip && matchSearch;
    });
  }, [shipments, selectedShipment, searchQuery]);

  const totalPackages = filteredItems.reduce((acc, s) => acc + s.packages, 0);
  const totalSales = filteredItems.reduce((acc, s) => acc + s.sales, 0);
  const approvedCount = filteredItems.filter(s => approvals[s.id]).length;

  const handleToggleAll = () => {
    const allApproved = filteredItems.every(s => approvals[s.id]);
    const nextState = { ...approvals };
    filteredItems.forEach(s => {
      nextState[s.id] = !allApproved;
    });
    setApprovals(nextState);
  };

  const handlePrintGatePass = () => {
    const printWindow = window.open('', '_blank', 'height=900,width=850');
    if (!printWindow) {
      window.print();
      return;
    }

    const rowsHtml = filteredItems.map((item, idx) => {
      const isApproved = !!approvals[item.id];
      return `
        <tr>
          <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: bold; text-align: center;">${item.code}</td>
          <td style="font-weight: bold;">${item.name}</td>
          <td>${item.address || item.city}</td>
          <td style="text-align: center;">${item.city}</td>
          <td>${item.guarantor || 'بدون كفيل'}</td>
          <td style="text-align: center; font-weight: bold;">${item.packages}</td>
          <td style="text-align: center; font-weight: bold; font-family: monospace;">$${item.sales.toFixed(1)}</td>
          <td style="text-align: center; font-weight: bold; color: ${isApproved ? '#166534' : '#991b1b'};">
            ${isApproved ? '✅ مُصرّح بالإخراج' : '⏳ قيد التدقيق'}
          </td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>كشف موافقة إخراج البضائع - ${COMPANY_INFO.shortNameAr}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Cairo', Tahoma, Arial, sans-serif; direction: rtl; color: #0f172a; margin: 0; padding: 10px; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
          h2 { margin: 0; font-size: 19px; color: #0f172a; }
          p { margin: 3px 0 0; font-size: 11px; color: #475569; }
          .meta-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 15px; display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { padding: 6px 7px; border: 1px solid #94a3b8; text-align: right; }
          th { background-color: #0f172a !important; color: #ffffff !important; font-weight: bold; text-align: center; }
          tr:nth-child(even) { background-color: #f1f5f9; }
          .signatures-box { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; }
          .stamp-box { width: 110px; height: 75px; border: 2px dashed #94a3b8; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #64748b; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${COMPANY_INFO.nameAr}</h2>
          <p>إدارة العمليات واللوجستيك - كشف موافقة إخراج وتفريغ البضائع الرسمي (Gate Pass)</p>
        </div>

        <div class="meta-box">
          <div>الشحنة المستهدفة: <b>${selectedShipment}</b></div>
          <div>تاريخ الكشف: <b>${checkDate}</b></div>
          <div>عدد البنود: <b>${filteredItems.length}</b></div>
          <div>إجمالي الطرود: <b>${totalPackages} طرد</b></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 5%;">#</th>
              <th style="width: 10%;">الكود</th>
              <th style="width: 22%;">اسم العميل</th>
              <th style="width: 20%;">العنوان</th>
              <th style="width: 10%;">المحافظة</th>
              <th style="width: 13%;">الكفيل</th>
              <th style="width: 6%;">الطرود</th>
              <th style="width: 8%;">المبلغ</th>
              <th style="width: 10%;">حالة الإذن</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="signatures-box">
          <div>
            تدقيق الحسابات والمالية:<br>
            ................................................<br>
            <div class="stamp-box">ختم المالية</div>
          </div>
          <div>
            مسؤول الساحة والمستودع:<br>
            ................................................<br>
            <div class="stamp-box">ختم المستودع</div>
          </div>
          <div>
            موافقة الإدارة العامة:<br>
            ................................................<br>
            <div class="stamp-box">الختم الرسمي</div>
          </div>
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

  const handleExportApprovalExcel = () => {
    const data = filteredItems.map((item, idx) => ({
      'التسلسل': idx + 1,
      'رقم الشحنة': item.shipment,
      'كود العميل': item.code,
      'اسم العميل': item.name,
      'العنوان': item.address,
      'المحافظة': item.city,
      'الكفيل': item.guarantor,
      'عدد الطرود': item.packages,
      'المبلغ المستحق ($)': item.sales,
      'حالة الموافقة': approvals[item.id] ? 'تمت الموافقة' : 'قيد التدقيق'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'موافقة إخراج البضائع');
    XLSX.writeFile(wb, `موافقة_إخراج_الشحنة_${selectedShipment}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 font-['Cairo']">
                موافقة إخراج البضائع (Gate Pass Approval)
              </h2>
              <p className="text-xs text-slate-500">
                إصدار أوامر الصرف والتسليم للعملاء ومطابقة براءة الذمة المالية
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handlePrintGatePass}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>طباعة استمارة إخراج البضائع الرسمية</span>
            </button>

            <button
              onClick={handleExportApprovalExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs border border-slate-300 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>تصدير إكسل</span>
            </button>
          </div>
        </div>

        {/* Selection Bar & Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 mt-4 items-center">
          {/* Shipment Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              اختر رقم الشحنة للكشف:
            </label>
            <select
              value={selectedShipment}
              onChange={(e) => setSelectedShipment(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-slate-900"
            >
              <option value="الكل">كافة الشحنات</option>
              {availableShipments.map(s => (
                <option key={s} value={s}>شحنة رقم: {s}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              بحث في كشف الإخراج:
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث بالاسم أو الكود أو المحافظة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-medium"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Metadata Display */}
          <div className="bg-slate-50 rounded-lg p-2 border border-slate-200 text-xs flex items-center justify-between">
            <div>
              <span className="text-slate-500 block text-[10px]">تاريخ الكشف</span>
              <span className="font-bold text-slate-800">{checkDate}</span>
            </div>
            <div className="text-left">
              <span className="text-slate-500 block text-[10px]">الموافقات</span>
              <span className="font-black text-emerald-700">{approvedCount} / {filteredItems.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Approval Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold font-['Cairo']">
              قائمة إذونات التسليم للشحنة: [{selectedShipment}]
            </h3>
            <span className="text-xs bg-slate-700/80 text-amber-400 px-2 py-0.5 rounded font-mono font-bold">
              {filteredItems.length} عميل
            </span>
          </div>

          <button
            onClick={handleToggleAll}
            className="text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700"
          >
            <Check className="w-3.5 h-3.5" />
            <span>تحديد الكل كمصادق عليه</span>
          </button>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-slate-800 text-white font-bold">
              <tr>
                <th className="py-3 px-3 text-center w-12">#</th>
                <th className="py-3 px-3 text-center w-12">الإذن</th>
                <th className="py-3 px-3">كود العميل</th>
                <th className="py-3 px-3">اسم العميل</th>
                <th className="py-3 px-3">عنوان الاستلام</th>
                <th className="py-3 px-3">المحافظة</th>
                <th className="py-3 px-3">الكفيل</th>
                <th className="py-3 px-3 text-center">عدد الطرود</th>
                <th className="py-3 px-3 text-left pl-6">المبلغ / الديون ($)</th>
                <th className="py-3 px-3 text-center">حالة الصرف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    لا توجد سجلات مطابقة لهذه الشحنة
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const isApproved = !!approvals[item.id];
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isApproved ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center text-slate-400 font-bold">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setApprovals(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                          className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                            isApproved
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                              : 'border-slate-300 hover:border-amber-500 bg-white'
                          }`}
                          title={isApproved ? 'إلغاء الموافقة' : 'منح موافقة إخراج'}
                        >
                          {isApproved && <Check className="w-4 h-4 stroke-[3]" />}
                        </button>
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-amber-700">
                        {item.code}
                      </td>

                      <td className="py-3 px-3 font-bold text-slate-900">
                        {item.name}
                      </td>

                      <td className="py-3 px-3 text-slate-600">
                        {item.address || 'الفرع الرئيسي'}
                      </td>

                      <td className="py-3 px-3 font-semibold text-indigo-900">
                        {item.city}
                      </td>

                      <td className="py-3 px-3 text-slate-600">
                        {item.guarantor || <span className="text-slate-300">بدون كفيل</span>}
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-emerald-800">
                        📦 {item.packages}
                      </td>

                      <td className="py-3 px-3 text-left pl-6 font-mono font-black text-rose-800">
                        ${item.sales.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-bold ${
                            isApproved
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {isApproved ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>مُصرّح بالإخراج</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>قيد التدقيق</span>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
