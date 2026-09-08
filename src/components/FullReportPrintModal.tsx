import React, { useState } from 'react';
import { X, Printer, FileText, Download, CheckCircle2, Building2, Search } from 'lucide-react';
import { ShipmentRecord, CitySummary, FilterState } from '../types';
import { COMPANY_INFO } from '../data/initialData';

interface FullReportPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipments: ShipmentRecord[];
  citySummaries: CitySummary[];
  filters: FilterState;
  totalClients: number;
  totalPackages: number;
  totalCbm: number;
  totalWeight: number;
  totalSales: number;
}

export const FullReportPrintModal: React.FC<FullReportPrintModalProps> = ({
  isOpen,
  onClose,
  shipments,
  citySummaries,
  filters,
  totalClients,
  totalPackages,
  totalCbm,
  totalWeight,
  totalSales,
}) => {
  const [modalSearch, setModalSearch] = useState('');

  if (!isOpen) return null;

  const todayStr = new Date().toLocaleDateString('ar-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const currentTimeStr = new Date().toLocaleTimeString('ar-IQ', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const displayedShipments = modalSearch.trim()
    ? shipments.filter(s =>
        s.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
        s.code.toLowerCase().includes(modalSearch.toLowerCase()) ||
        s.phone.includes(modalSearch) ||
        (s.address && s.address.toLowerCase().includes(modalSearch.toLowerCase())) ||
        s.city.toLowerCase().includes(modalSearch.toLowerCase()) ||
        (s.guarantor && s.guarantor.toLowerCase().includes(modalSearch.toLowerCase()))
      )
    : shipments;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'height=950,width=1300');
    if (!printWindow) {
      window.print();
      return;
    }

    const cityRows = citySummaries.map((c) => `
      <tr>
        <td style="text-align: center; font-weight: bold; width: 5%;">${c.index}</td>
        <td style="font-weight: bold; width: 22%;">${c.city}</td>
        <td style="text-align: center; width: 12%; font-family: 'Cairo', sans-serif;">${c.clientCount}</td>
        <td style="text-align: center; width: 12%; font-weight: bold;">${c.packagesCount}</td>
        <td style="text-align: center; width: 14%; font-family: monospace;">${c.cbmTotal.toFixed(1)}</td>
        <td style="text-align: center; width: 15%; font-family: monospace;">${c.weightTotal.toFixed(1)}</td>
        <td style="text-align: left; padding-left: 12px; font-weight: 800; font-family: monospace; width: 20%; color: #991b1b;">$${c.salesTotal.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
      </tr>
    `).join('');

    const shipmentRows = shipments.map((s, idx) => `
      <tr>
        <td style="text-align: center; font-weight: bold; font-size: 8px;">${idx + 1}</td>
        <td style="font-family: monospace; font-weight: bold; text-align: center; color: #1e3a8a;">${s.shipment}</td>
        <td style="font-family: monospace; font-weight: bold; text-align: center; background-color: #f8fafc;">${s.code}</td>
        <td style="font-weight: bold; font-size: 8.5px;">${s.name}</td>
        <td style="color: #475569; font-size: 8.5px;">${s.guarantor || '-'}</td>
        <td style="text-align: center; font-family: monospace;">${s.weight}</td>
        <td style="text-align: center; font-family: monospace;">${s.cbm.toFixed(1)}</td>
        <td style="text-align: center; font-weight: bold;">${s.packages}</td>
        <td style="text-align: center; font-family: monospace;">$${s.price.toFixed(1)}</td>
        <td style="text-align: left; padding-left: 6px; font-family: monospace; font-weight: bold; color: #991b1b;">$${s.sales.toFixed(1)}</td>
        <td style="direction: ltr; font-family: monospace; font-size: 8px; text-align: right;">${s.phone}</td>
        <td style="font-size: 8px; color: #0f172a; white-space: normal; word-break: break-word; line-height: 1.35; font-weight: 500;">${s.address || '-'}</td>
        <td style="text-align: center; font-size: 8.5px;">${s.city}</td>
        <td style="text-align: center; font-size: 8px;">${s.type}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>كشف الشحنة الشامل والبيانات التفصيلية - ${COMPANY_INFO.nameAr}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page { 
            size: A4 landscape; 
            margin: 8mm 8mm 10mm 8mm; 
          }
          * { 
            box-sizing: border-box; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          body { 
            font-family: 'Cairo', Tahoma, Arial, sans-serif; 
            direction: rtl; 
            color: #0f172a; 
            margin: 0; 
            padding: 0;
            background: #ffffff;
            font-size: 9px;
          }
          .report-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2.5px solid #0f172a;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          .brand-box {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .brand-logo {
            width: 44px;
            height: 44px;
            background: #f59e0b;
            color: #0f172a;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 20px;
          }
          .brand-titles h1 {
            margin: 0;
            font-size: 17px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: -0.5px;
          }
          .brand-titles p {
            margin: 2px 0 0;
            font-size: 10px;
            color: #64748b;
            font-weight: 600;
          }
          .report-meta {
            text-align: left;
            font-size: 9.5px;
            line-height: 1.5;
            color: #334155;
          }
          .report-meta strong {
            color: #0f172a;
          }
          .report-badge {
            display: inline-block;
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #fde68a;
            font-weight: 800;
            padding: 2px 8px;
            border-radius: 4px;
            margin-bottom: 3px;
          }

          /* Section 1: KPI Metrics */
          .section-title {
            font-size: 11px;
            font-weight: 800;
            color: #0f172a;
            background: #f1f5f9;
            padding: 4px 8px;
            border-right: 4px solid #f59e0b;
            border-radius: 3px;
            margin: 10px 0 6px 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .metrics-grid { 
            display: flex; 
            gap: 6px; 
            margin-bottom: 10px; 
          }
          .metric-box { 
            flex: 1; 
            padding: 6px 8px; 
            border-radius: 6px; 
            text-align: center; 
            border: 1px solid #cbd5e1; 
          }
          .box-1 { background-color: #eff6ff !important; border-color: #bfdbfe; color: #1e40af; }
          .box-2 { background-color: #f0fdf4 !important; border-color: #bbf7d0; color: #166534; }
          .box-3 { background-color: #f5f3ff !important; border-color: #ddd6fe; color: #5b21b6; }
          .box-4 { background-color: #fffbeb !important; border-color: #fde68a; color: #92400e; }
          .box-5 { background-color: #fdf2f8 !important; border-color: #fbcfe8; color: #9d174d; }
          .metric-title { font-size: 9.5px; font-weight: bold; }
          .metric-val { font-size: 13px; font-weight: 900; margin-top: 2px; }

          /* Tables Styling */
          table { 
            width: 100% !important; 
            border-collapse: collapse; 
            font-size: 8.5px !important; 
            margin-bottom: 12px; 
          }
          thead {
            display: table-header-group;
          }
          tr {
            page-break-inside: avoid;
          }
          th, td { 
            padding: 3.5px 5px !important; 
            border: 1px solid #cbd5e1; 
            text-align: right; 
          }
          th { 
            background-color: #0f172a !important; 
            color: #ffffff !important; 
            font-weight: 700; 
            text-align: center; 
            font-size: 8.5px;
          }
          tr:nth-child(even) { 
            background-color: #f8fafc; 
          }

          /* Approval Footer */
          .approval-footer {
            margin-top: 14px;
            padding-top: 10px;
            border-top: 1.5px dashed #94a3b8;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
          }
          .sig-block {
            text-align: center;
            width: 30%;
          }
          .sig-title {
            font-size: 9.5px;
            font-weight: bold;
            color: #334155;
            margin-bottom: 24px;
          }
          .sig-line {
            border-bottom: 1px dotted #64748b;
            margin: 0 20px;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="report-header">
          <div class="brand-box">
            <div class="brand-logo">A</div>
            <div class="brand-titles">
              <h1>${COMPANY_INFO.nameAr}</h1>
              <p>نظام الشحن الدولي والتخليص الجمركي وإدارة المستودعات</p>
            </div>
          </div>
          <div class="report-meta">
            <div class="report-badge">كشف الشحنة الشامل والبيانات التفصيلية (A4 Landscape)</div>
            <div><strong>تاريخ الطباعة:</strong> ${todayStr} - ${currentTimeStr}</div>
            <div><strong>رقم الشحنة:</strong> ${filters.shipment} | <strong>الكفيل:</strong> ${filters.guarantor}</div>
          </div>
        </div>

        <!-- 1. KPI Metrics Section -->
        <div class="section-title">
          <span>1. المؤشرات الإحصائية العامة للشحنة</span>
          <span>إجمالي المطابقة: ${totalClients} عميل / ${totalPackages} طرد</span>
        </div>
        <div class="metrics-grid">
          <div class="metric-box box-1">
            <div class="metric-title">👥 عدد العملاء</div>
            <div class="metric-val">${totalClients} عميل</div>
          </div>
          <div class="metric-box box-2">
            <div class="metric-title">📦 إجمالي الطرود</div>
            <div class="metric-val">${totalPackages} طرد</div>
          </div>
          <div class="metric-box box-3">
            <div class="metric-title">📐 إجمالي الحجم</div>
            <div class="metric-val">${totalCbm.toFixed(1)} CBM</div>
          </div>
          <div class="metric-box box-4">
            <div class="metric-title">⚖️ الوزن الكلي</div>
            <div class="metric-val">${totalWeight.toFixed(1)} كغ</div>
          </div>
          <div class="metric-box box-5">
            <div class="metric-title">💰 إجمالي الديون / المبيعات</div>
            <div class="metric-val">$${totalSales.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
          </div>
        </div>

        <!-- 2. City Summaries Section -->
        <div class="section-title">
          <span>2. جدول ملخص المحافظات والمدن المستلمة</span>
          <span>${citySummaries.length} محافظة</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 5%;">#</th>
              <th style="width: 22%;">المحافظة</th>
              <th style="width: 12%;">عدد العملاء</th>
              <th style="width: 12%;">إجمالي الطرود</th>
              <th style="width: 14%;">الحجم (CBM)</th>
              <th style="width: 15%;">الوزن (كغ)</th>
              <th style="width: 20%;">إجمالي الديون ($)</th>
            </tr>
          </thead>
          <tbody>
            ${cityRows}
          </tbody>
        </table>

        <!-- 3. Full Detailed Shipments Table Section -->
        <div class="section-title">
          <span>3. جدول تفاصيل الشحنات والعملاء المفصل</span>
          <span>${shipments.length} سجل شحنة تفصيلي</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 2.5%;">#</th>
              <th style="width: 5.5%;">الشحنة</th>
              <th style="width: 5.5%;">الكود</th>
              <th style="width: 13%;">اسم العميل</th>
              <th style="width: 8.5%;">الكفيل</th>
              <th style="width: 4.5%;">الوزن</th>
              <th style="width: 4.5%;">CBM</th>
              <th style="width: 4.5%;">الطرود</th>
              <th style="width: 4.5%;">السعر</th>
              <th style="width: 6.5%;">المبلغ ($)</th>
              <th style="width: 9%;">الهاتف</th>
              <th style="width: 16%;">العنوان</th>
              <th style="width: 6.5%;">المحافظة</th>
              <th style="width: 4%;">النوع</th>
            </tr>
          </thead>
          <tbody>
            ${shipmentRows}
          </tbody>
        </table>

        <!-- Approval Signatures -->
        <div class="approval-footer">
          <div class="sig-block">
            <div class="sig-title">توقيع مسؤول المستودع والتفريغ</div>
            <div class="sig-line"></div>
          </div>
          <div class="sig-block">
            <div class="sig-title">توقيع وتدقيق المحاسب العام</div>
            <div class="sig-line"></div>
          </div>
          <div class="sig-block">
            <div class="sig-title">اعتماد وختم إدارة أطلس المحيط</div>
            <div class="sig-line"></div>
          </div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 no-print">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden max-h-[94vh] flex flex-col font-['Cairo']">
        
        {/* Modal Top Navigation Bar */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-800 via-slate-800 to-slate-750 text-white flex items-center justify-between border-b border-slate-700/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  كشف الشحنة الشامل والبيانات التفصيلية (PDF / A4 Landscape)
                </h3>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40 font-semibold">
                  3 أقسام كاملة
                </span>
              </div>
              <p className="text-xs text-slate-300">
                تقرير إداري متكامل يتضمن المؤشرات، ملخص المحافظات، وجدول الشحنات التفصيلي بالكامل
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition-all active:scale-95"
              title="طباعة أو تصدير التقرير كملف PDF"
            >
              <Printer className="w-4 h-4 stroke-[2.5]" />
              <span>طباعة / حفظ PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Preview Content */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50 space-y-5">
          
          {/* Section 1: KPI Metrics Preview */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                1. المؤشرات الإحصائية العامة للتقرير
              </h4>
              <span className="text-[11px] text-slate-500">
                الشحنة: <strong className="text-slate-900">{filters.shipment}</strong> | الكفيل: <strong className="text-slate-900">{filters.guarantor}</strong>
              </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
              <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-950">
                <div className="text-[11px] font-bold text-blue-700 mb-0.5">👥 عدد العملاء</div>
                <div className="text-base font-extrabold">{totalClients} عميل</div>
              </div>
              <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-950">
                <div className="text-[11px] font-bold text-emerald-700 mb-0.5">📦 إجمالي الطرود</div>
                <div className="text-base font-extrabold">{totalPackages} طرد</div>
              </div>
              <div className="p-2.5 bg-purple-50/80 border border-purple-200 rounded-xl text-purple-950">
                <div className="text-[11px] font-bold text-purple-700 mb-0.5">📐 إجمالي الحجم</div>
                <div className="text-base font-extrabold font-mono">{totalCbm.toFixed(1)} CBM</div>
              </div>
              <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-950">
                <div className="text-[11px] font-bold text-amber-700 mb-0.5">⚖️ الوزن الكلي</div>
                <div className="text-base font-extrabold font-mono">{totalWeight.toFixed(1)} كغ</div>
              </div>
              <div className="p-2.5 bg-rose-50/80 border border-rose-200 rounded-xl text-rose-950 col-span-2 sm:col-span-1">
                <div className="text-[11px] font-bold text-rose-700 mb-0.5">💰 إجمالي المبيعات / الديون</div>
                <div className="text-base font-extrabold font-mono text-rose-700">${totalSales.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
              </div>
            </div>
          </div>

          {/* Section 2: City Summary Table Preview */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                2. جدول ملخص المحافظات ({citySummaries.length} محافظة)
              </h4>
              <span className="text-[11px] text-slate-500">مرتبة حسب أعلى إجمالي ديون</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white font-bold">
                    <th className="p-2.5 text-center w-12">#</th>
                    <th className="p-2.5">المحافظة</th>
                    <th className="p-2.5 text-center">العملاء</th>
                    <th className="p-2.5 text-center">إجمالي الطرود</th>
                    <th className="p-2.5 text-center">الحجم (CBM)</th>
                    <th className="p-2.5 text-center">الوزن (كغ)</th>
                    <th className="p-2.5 text-left">إجمالي الديون ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {citySummaries.map((c) => (
                    <tr key={c.city} className="hover:bg-slate-50">
                      <td className="p-2.5 text-center font-bold text-slate-600">{c.index}</td>
                      <td className="p-2.5 font-bold text-slate-900">{c.city}</td>
                      <td className="p-2.5 text-center">{c.clientCount}</td>
                      <td className="p-2.5 text-center font-bold">{c.packagesCount}</td>
                      <td className="p-2.5 text-center font-mono">{c.cbmTotal.toFixed(1)}</td>
                      <td className="p-2.5 text-center font-mono">{c.weightTotal.toFixed(1)}</td>
                      <td className="p-2.5 text-left font-mono font-bold text-rose-700">${c.salesTotal.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Full Detailed Shipments Table Preview */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <h4 className="text-xs font-bold text-slate-800">
                  3. جدول تفاصيل الشحنات والعملاء المفصل
                </h4>
                <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {shipments.length} سجل شحنة
                </span>
              </div>

              {/* In-Modal Filter */}
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="بحث سريع في جدول التفاصيل..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-96">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-800 text-white font-bold z-10">
                  <tr>
                    <th className="p-2 text-center w-10">#</th>
                    <th className="p-2 text-center">الشحنة</th>
                    <th className="p-2 text-center">الكود</th>
                    <th className="p-2">اسم العميل</th>
                    <th className="p-2">الكفيل</th>
                    <th className="p-2 text-center">الوزن</th>
                    <th className="p-2 text-center">CBM</th>
                    <th className="p-2 text-center">الطرود</th>
                    <th className="p-2 text-center">السعر</th>
                    <th className="p-2 text-left">المبلغ ($)</th>
                    <th className="p-2">الهاتف</th>
                    <th className="p-2 min-w-[180px]">العنوان</th>
                    <th className="p-2">المحافظة</th>
                    <th className="p-2 text-center">النوع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {displayedShipments.map((s, idx) => (
                    <tr key={s.id || idx} className="hover:bg-slate-50/80">
                      <td className="p-2 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-2 text-center font-mono font-bold text-blue-700">{s.shipment}</td>
                      <td className="p-2 text-center font-mono font-bold bg-slate-50">{s.code}</td>
                      <td className="p-2 font-bold text-slate-900">{s.name}</td>
                      <td className="p-2 text-slate-600">{s.guarantor || '-'}</td>
                      <td className="p-2 text-center font-mono">{s.weight}</td>
                      <td className="p-2 text-center font-mono">{s.cbm.toFixed(1)}</td>
                      <td className="p-2 text-center font-bold">{s.packages}</td>
                      <td className="p-2 text-center font-mono">${s.price.toFixed(1)}</td>
                      <td className="p-2 text-left font-mono font-bold text-rose-700">${s.sales.toFixed(1)}</td>
                      <td className="p-2 font-mono text-[11px] text-slate-700" dir="ltr">{s.phone}</td>
                      <td className="p-2 text-slate-800 text-xs min-w-[180px] whitespace-normal break-words leading-relaxed">
                        {s.address ? (
                          <span>{s.address}</span>
                        ) : (
                          <span className="text-slate-400 italic">بدون عنوان تفصيلي</span>
                        )}
                      </td>
                      <td className="p-2 text-slate-800">{s.city}</td>
                      <td className="p-2 text-center text-slate-600">{s.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 font-bold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
              <span>عند النقر على "طباعة / حفظ PDF"، سيتم تجهيز المستند كاملاً بتنسيق A4 أفقي رسمي يشمل المؤشرات الإحصائية، ملخص المحافظات، وجدول تفاصيل جميع الشحنات مع خانات التواقيع الإدارية.</span>
            </div>
            <button
              onClick={handlePrint}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black shadow-xs shrink-0"
            >
              طباعة الآن
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

