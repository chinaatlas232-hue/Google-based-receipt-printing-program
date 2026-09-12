import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Search, 
  Printer, 
  FileSpreadsheet, 
  TrendingUp, 
  DollarSign, 
  Layers, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  RefreshCw,
  Boxes,
  CheckCircle2,
  Calendar,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plane,
  Ship
} from 'lucide-react';
import { ShipmentRecord } from '../types';
import { COMPANY_INFO } from '../data/initialData';
import * as XLSX from 'xlsx';

interface ShipmentReportsViewProps {
  shipments: ShipmentRecord[];
  onSyncDrive?: () => void;
  isSyncing?: boolean;
}

type ReportMode = 'grouped' | 'detailed';
type FreightFilter = 'all' | 'air' | 'sea';
type SortField = 'no' | 'shipamnt' | 'cost' | 'packages' | 'weight';
type SortOrder = 'asc' | 'desc';

interface GroupedShipmentItem {
  shipment: string;
  totalCost: number;
  totalPackages: number;
  totalWeight: number;
  totalCbm: number;
  recordsCount: number;
  clientCodes: string[];
  types: string[];
}

// Utility: Normalize and convert any Eastern Arabic / Persian numerals (٠-٩) to standard English numerals (0-9)
export const toLatinDigits = (val: string | number | undefined | null): string => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776));
};

// Format numbers strictly with standard English locale (en-US)
export const formatEnNumber = (val: number | string | undefined | null, options?: Intl.NumberFormatOptions): string => {
  if (val === null || val === undefined || val === '') return '0';
  const num = typeof val === 'number' ? val : Number(val);
  if (isNaN(num)) return toLatinDigits(String(val));
  return toLatinDigits(num.toLocaleString('en-US', options));
};

// Format currency strictly with standard English locale ($0.00)
export const formatEnCurrency = (val: number | string | undefined | null): string => {
  const num = typeof val === 'number' ? val : Number(val) || 0;
  return '$' + toLatinDigits(num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
};

// Helper: Check if a shipment is Air Freight (RA)
export const isAirItem = (shipmentCode: string = '', itemType: string = ''): boolean => {
  const code = (shipmentCode || '').toUpperCase().trim();
  const type = (itemType || '').toLowerCase().trim();
  return code.startsWith('RA') || code.includes('RA') || type.includes('جوي') || type.includes('air') || type.includes('طيران');
};

// Helper: Check if a shipment is Sea Freight (RQ)
export const isSeaItem = (shipmentCode: string = '', itemType: string = ''): boolean => {
  const code = (shipmentCode || '').toUpperCase().trim();
  const type = (itemType || '').toLowerCase().trim();
  return code.startsWith('RQ') || code.includes('RQ') || type.includes('بحري') || type.includes('sea') || type.includes('حاوية') || type.includes('باخرة');
};

export const ShipmentReportsView: React.FC<ShipmentReportsViewProps> = ({
  shipments,
  onSyncDrive,
  isSyncing = false,
}) => {
  const [reportMode, setReportMode] = useState<ReportMode>('grouped');
  const [freightFilter, setFreightFilter] = useState<FreightFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('cost');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Formatted date strictly using English digits
  const reportDate = useMemo(() => {
    try {
      const formatted = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(new Date());
      return toLatinDigits(formatted);
    } catch {
      return toLatinDigits(new Date().toISOString().split('T')[0]);
    }
  }, []);

  // 1. Grouped Data by Shipment
  const groupedData: GroupedShipmentItem[] = useMemo(() => {
    const map = new Map<string, GroupedShipmentItem>();

    shipments.forEach(item => {
      const shipKey = (item.shipment || 'غير محدد').trim();
      const existing = map.get(shipKey);

      if (existing) {
        existing.totalCost += item.sales || 0;
        existing.totalPackages += item.packages || 0;
        existing.totalWeight += item.weight || 0;
        existing.totalCbm += item.cbm || 0;
        existing.recordsCount += 1;
        if (item.code && !existing.clientCodes.includes(item.code)) {
          existing.clientCodes.push(item.code);
        }
        if (item.type && !existing.types.includes(item.type)) {
          existing.types.push(item.type);
        }
      } else {
        map.set(shipKey, {
          shipment: shipKey,
          totalCost: item.sales || 0,
          totalPackages: item.packages || 0,
          totalWeight: item.weight || 0,
          totalCbm: item.cbm || 0,
          recordsCount: 1,
          clientCodes: item.code ? [item.code] : [],
          types: item.type ? [item.type] : []
        });
      }
    });

    return Array.from(map.values());
  }, [shipments]);

  // Counts for RA Air and RQ Sea toggles
  const freightCounts = useMemo(() => {
    if (reportMode === 'grouped') {
      const air = groupedData.filter(item => isAirItem(item.shipment) || item.types.some(t => isAirItem('', t))).length;
      const sea = groupedData.filter(item => isSeaItem(item.shipment) || item.types.some(t => isSeaItem('', t))).length;
      return { all: groupedData.length, air, sea };
    } else {
      const air = shipments.filter(item => isAirItem(item.shipment, item.type)).length;
      const sea = shipments.filter(item => isSeaItem(item.shipment, item.type)).length;
      return { all: shipments.length, air, sea };
    }
  }, [groupedData, shipments, reportMode]);

  // 2. Filtered and Sorted Data
  const processedData = useMemo(() => {
    if (reportMode === 'grouped') {
      let items = groupedData.filter(item => {
        // Filter by Freight Type: Air (RA) vs Sea (RQ) vs All
        if (freightFilter === 'air') {
          const isAir = isAirItem(item.shipment) || item.types.some(t => isAirItem('', t));
          if (!isAir) return false;
        } else if (freightFilter === 'sea') {
          const isSea = isSeaItem(item.shipment) || item.types.some(t => isSeaItem('', t));
          if (!isSea) return false;
        }

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.shipment.toLowerCase().includes(q) ||
          item.clientCodes.some(c => c.toLowerCase().includes(q))
        );
      });

      items.sort((a, b) => {
        let cmp = 0;
        if (sortField === 'shipamnt') {
          cmp = a.shipment.localeCompare(b.shipment);
        } else if (sortField === 'cost') {
          cmp = a.totalCost - b.totalCost;
        } else if (sortField === 'packages') {
          cmp = a.totalPackages - b.totalPackages;
        } else if (sortField === 'weight') {
          cmp = a.totalWeight - b.totalWeight;
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });

      return items;
    } else {
      let items = shipments.filter(item => {
        // Filter by Freight Type: Air (RA) vs Sea (RQ) vs All
        if (freightFilter === 'air') {
          if (!isAirItem(item.shipment, item.type)) return false;
        } else if (freightFilter === 'sea') {
          if (!isSeaItem(item.shipment, item.type)) return false;
        }

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (item.shipment && item.shipment.toLowerCase().includes(q)) ||
          (item.code && item.code.toLowerCase().includes(q)) ||
          (item.name && item.name.toLowerCase().includes(q))
        );
      });

      items.sort((a, b) => {
        let cmp = 0;
        if (sortField === 'shipamnt') {
          cmp = (a.shipment || '').localeCompare(b.shipment || '');
        } else if (sortField === 'cost') {
          cmp = (a.sales || 0) - (b.sales || 0);
        } else if (sortField === 'packages') {
          cmp = (a.packages || 0) - (b.packages || 0);
        } else if (sortField === 'weight') {
          cmp = (a.weight || 0) - (b.weight || 0);
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });

      return items;
    }
  }, [reportMode, freightFilter, groupedData, shipments, searchQuery, sortField, sortOrder]);

  // Calculations & Totals
  const totalRecords = processedData.length;
  const totalCostSum = useMemo(() => {
    if (reportMode === 'grouped') {
      return (processedData as GroupedShipmentItem[]).reduce((sum, item) => sum + item.totalCost, 0);
    } else {
      return (processedData as ShipmentRecord[]).reduce((sum, item) => sum + (item.sales || 0), 0);
    }
  }, [processedData, reportMode]);

  const avgCost = totalRecords > 0 ? totalCostSum / totalRecords : 0;
  const maxCost = useMemo(() => {
    if (reportMode === 'grouped') {
      return (processedData as GroupedShipmentItem[]).reduce((max, item) => Math.max(max, item.totalCost), 0);
    } else {
      return (processedData as ShipmentRecord[]).reduce((max, item) => Math.max(max, item.sales || 0), 0);
    }
  }, [processedData, reportMode]);

  // Pagination
  const totalPages = Math.ceil(totalRecords / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, currentPage, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'cost' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  // Export to Excel
  const handleExportExcel = () => {
    let exportRows: any[] = [];

    if (reportMode === 'grouped') {
      exportRows = (processedData as GroupedShipmentItem[]).map((item, idx) => ({
        'no': idx + 1,
        'shipamnt': toLatinDigits(item.shipment),
        'نوع الشحن': (isAirItem(item.shipment) || item.types.some(t => isAirItem('', t))) ? 'شحن جوي (RA)' : 'شحن بحري (RQ)',
        'cost ($)': Number(item.totalCost.toFixed(2)),
        'عدد الطرود': item.totalPackages,
        'الوزن (كغ)': Number(item.totalWeight.toFixed(1)),
        'عدد العملاء': item.recordsCount
      }));
    } else {
      exportRows = (processedData as ShipmentRecord[]).map((item, idx) => ({
        'no': idx + 1,
        'shipamnt': toLatinDigits(item.shipment),
        'نوع الشحن': isAirItem(item.shipment, item.type) ? 'شحن جوي (RA)' : 'شحن بحري (RQ)',
        'cost ($)': Number((item.sales || 0).toFixed(2)),
        'كود العميل': toLatinDigits(item.code),
        'اسم العميل': item.name,
        'عدد الطرود': item.packages,
        'الوزن (كغ)': item.weight
      }));
    }

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير الشحنات');
    XLSX.writeFile(workbook, `تقرير_الشحنات_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Print Report
  const handlePrintReport = () => {
    const printWin = window.open('', '_blank', 'width=900,height=900');
    if (!printWin) {
      window.print();
      return;
    }

    const rowsHtml = (processedData as any[]).map((item, idx) => {
      const shipamnt = toLatinDigits(reportMode === 'grouped' ? item.shipment : item.shipment);
      const costVal = reportMode === 'grouped' ? item.totalCost : item.sales;
      const extraCols = reportMode === 'grouped' ? `
        <td style="text-align: center; font-family: monospace;">${formatEnNumber(item.totalPackages)}</td>
        <td style="text-align: center; font-family: monospace;">${formatEnNumber(item.totalWeight, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} كغ</td>
        <td style="text-align: center; font-family: monospace;">${formatEnNumber(item.recordsCount)}</td>
      ` : `
        <td style="text-align: center; font-family: monospace;">${toLatinDigits(item.code || '-')}</td>
        <td>${item.name || '-'}</td>
        <td style="text-align: center; font-family: monospace;">${formatEnNumber(item.packages)}</td>
      `;

      return `
        <tr>
          <td style="text-align: center; font-weight: bold; background: #f8fafc; font-family: monospace;">${formatEnNumber(idx + 1)}</td>
          <td style="text-align: center; font-family: monospace; font-weight: bold; color: #0284c7;">${shipamnt}</td>
          <td style="text-align: center; font-family: monospace; font-weight: 800; color: #0f172a;">${formatEnCurrency(costVal)}</td>
          ${extraCols}
        </tr>
      `;
    }).join('');

    const extraHeaders = reportMode === 'grouped' 
      ? '<th>الطرود</th><th>الوزن الإجمالي</th><th>عدد السجلات</th>'
      : '<th>كود العميل</th><th>اسم العميل</th><th>الطرود</th>';

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>تقرير الشحنات والتكاليف - ${COMPANY_INFO.shortNameAr}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Cairo', Tahoma, sans-serif; direction: rtl; color: #0f172a; margin: 0; padding: 10px; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .header h1 { margin: 0 0 4px 0; font-size: 22px; color: #0f172a; }
          .header p { margin: 2px 0; font-size: 13px; color: #64748b; }
          .kpi-box { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
          .kpi-card { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: center; background: #f8fafc; }
          .kpi-title { font-size: 11px; color: #64748b; margin-bottom: 4px; }
          .kpi-value { font-size: 16px; font-weight: 800; color: #0f172a; font-family: 'JetBrains Mono', monospace; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th { background: #0f172a; color: #ffffff; padding: 8px 6px; text-align: center; font-size: 12px; border: 1px solid #0f172a; }
          td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .total-row { background: #e2e8f0 !important; font-weight: 800; }
          .footer { margin-top: 25px; padding-top: 12px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
          .sign-area { display: flex; justify-content: space-between; margin-top: 30px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${COMPANY_INFO.nameAr}</h1>
          <p>تقرير الشحنات والأسعار المعتمد | Columns: (no, shipamnt, cost)</p>
          <p>تاريخ استخراج التقرير: ${reportDate}</p>
        </div>

        <div class="kpi-box">
          <div class="kpi-card">
            <div class="kpi-title">عدد السجلات (no)</div>
            <div class="kpi-value">${formatEnNumber(totalRecords)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">إجمالي التكلفة والمبيعات (cost)</div>
            <div class="kpi-value">${formatEnCurrency(totalCostSum)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">متوسط التكلفة للسطر</div>
            <div class="kpi-value">${formatEnCurrency(avgCost)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">no (التسلسل)</th>
              <th style="text-align: center;">shipamnt (رقم الشحنة)</th>
              <th style="text-align: center;">cost (سعر البيع / التكلفة $)</th>
              ${extraHeaders}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td style="text-align: center; font-family: monospace;">الإجمالي</td>
              <td style="text-align: center; font-weight: 800; font-family: monospace;">${formatEnNumber(totalRecords)} شحنة / سجل</td>
              <td style="text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #0f172a;">${formatEnCurrency(totalCostSum)}</td>
              <td colspan="${reportMode === 'grouped' ? 3 : 3}" style="text-align: center; font-size: 11px; color: #475569;">
                كافة البيانات متزامنة ومحدثة تلقائياً
              </td>
            </tr>
          </tbody>
        </table>

        <div class="sign-area">
          <div>مسؤول الحسابات: ...........................</div>
          <div>التدقيق المالي: ...........................</div>
          <div>الختم المعتمد: ...........................</div>
        </div>

        <div class="footer">
          <div>شركة أطلس آسيا للشحن الدولي والتخليص الجمركي</div>
          <div>تمت الطباعة تلقائياً عبر نظام الشحن المعتمد</div>
        </div>
      </body>
      </html>
    `);

    printWin.document.close();
    setTimeout(() => {
      printWin.focus();
      printWin.print();
    }, 400);
  };

  return (
    <div className="space-y-4">
      {/* 1. Header and Breadcrumb */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-amber-600 font-bold mb-1">
              <BarChart3 className="w-4 h-4" />
              <span>لوحة التقارير والبيانات المالية المعتمدة</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <span>تقارير الشحنات (Shipment Reports)</span>
              <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-300">
                no | shipamnt | cost
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              عرض تفصيلي وتجميعي لبيانات الشحنات، تكلفة ومبيعات كل شحنة مستخرجة ومحدثة تلقائياً من جداول النظام.
            </p>
          </div>

          {/* Actions: Sync, Print, Export */}
          <div className="flex flex-wrap items-center gap-2">
            {onSyncDrive && (
              <button
                onClick={onSyncDrive}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="تحديث ومزامنة البيانات من Google Sheets"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-600' : 'text-slate-600'}`} />
                <span>{isSyncing ? 'جارٍ المزامنة...' : 'تحديث البيانات'}</span>
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
              title="تصدير جدول التقرير إلى ملف Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>تصدير Excel</span>
            </button>

            <button
              onClick={handlePrintReport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-black shadow-md shadow-slate-900/10 transition-all active:scale-95 cursor-pointer"
              title="طباعة التقرير الرسمي A4"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs & Freight Filter Toggle */}
        <div className="mt-4 pt-3 border-t border-slate-150 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Grouped vs Detailed mode */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold">
              <button
                onClick={() => {
                  setReportMode('grouped');
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  reportMode === 'grouped'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>تجميعي حسب رقم الشحنة</span>
                <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  reportMode === 'grouped' ? 'bg-amber-300/80 text-slate-950' : 'bg-slate-200 text-slate-700'
                }`}>
                  {formatEnNumber(groupedData.length)}
                </span>
              </button>

              <button
                onClick={() => {
                  setReportMode('detailed');
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  reportMode === 'detailed'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>تفصيلي لجميع السجلات</span>
                <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  reportMode === 'detailed' ? 'bg-amber-300/80 text-slate-950' : 'bg-slate-200 text-slate-700'
                }`}>
                  {formatEnNumber(shipments.length)}
                </span>
              </button>
            </div>

            {/* Air (RA) vs Sea (RQ) Filter Toggle */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setFreightFilter('all');
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  freightFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span>الكل</span>
                <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  freightFilter === 'all' ? 'bg-slate-800 text-amber-300' : 'bg-slate-200 text-slate-700'
                }`}>
                  {formatEnNumber(freightCounts.all)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFreightFilter('air');
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  freightFilter === 'air'
                    ? 'bg-sky-600 text-white shadow-xs font-black'
                    : 'text-slate-700 hover:text-sky-700 hover:bg-sky-50'
                }`}
                title="تصفية شحنات الشحن الجوي (RA)"
              >
                <Plane className="w-3.5 h-3.5" />
                <span>شحن جوي (RA)</span>
                <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  freightFilter === 'air' ? 'bg-sky-700 text-white' : 'bg-sky-100 text-sky-800'
                }`}>
                  {formatEnNumber(freightCounts.air)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFreightFilter('sea');
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  freightFilter === 'sea'
                    ? 'bg-teal-700 text-white shadow-xs font-black'
                    : 'text-slate-700 hover:text-teal-700 hover:bg-teal-50'
                }`}
                title="تصفية شحنات الشحن البحري (RQ)"
              >
                <Ship className="w-3.5 h-3.5" />
                <span>شحن بحري (RQ)</span>
                <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  freightFilter === 'sea' ? 'bg-teal-800 text-white' : 'bg-teal-100 text-teal-800'
                }`}>
                  {formatEnNumber(freightCounts.sea)}
                </span>
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            تاريخ التقرير: <span className="font-bold text-slate-800 font-mono">{reportDate}</span>
          </div>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Count of records / shipments */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block mb-1">
              {reportMode === 'grouped' ? 'إجمالي أرقام الشحنات (shipamnt)' : 'إجمالي السجلات (no)'}
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {formatEnNumber(totalRecords)}
            </div>
            <span className="text-[11px] text-slate-400">
              {reportMode === 'grouped' ? 'شحنة وحاوية مختلفة' : 'بوليصة وسجل شحن'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Total Cost / Sales */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block mb-1">
              إجمالي سعر البيع والتكلفة (cost)
            </span>
            <div className="text-2xl font-black text-emerald-600 font-mono tracking-tight">
              {formatEnCurrency(totalCostSum)}
            </div>
            <span className="text-[11px] text-slate-400">
              مجموع التكلفة الإجمالية للشحنات
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Average Cost */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block mb-1">
              متوسط التكلفة للسطر الواحد
            </span>
            <div className="text-2xl font-black text-slate-800 font-mono">
              {formatEnCurrency(avgCost)}
            </div>
            <span className="text-[11px] text-slate-400">
              معدل التكلفة لكل {reportMode === 'grouped' ? 'شحنة' : 'سجل'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Max Cost */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block mb-1">
              أعلى قيمة تكلفة (Max Cost)
            </span>
            <div className="text-2xl font-black text-amber-600 font-mono">
              {formatEnCurrency(maxCost)}
            </div>
            <span className="text-[11px] text-slate-400">
              أكبر قيمة مسجلة في التقرير
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Controls */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="بحث برقم الشحنة (shipamnt) أو الكود أو الاسم..."
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600">
            <span>عرض لكل صفحة:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 text-slate-800 border border-slate-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
            </select>
          </div>

          <div className="text-slate-500 font-semibold font-mono">
            عرض {formatEnNumber(paginatedData.length)} من أصل {formatEnNumber(totalRecords)}
          </div>
        </div>
      </div>

      {/* 4. The Reports Table (Matching exactly no, shipamnt, cost) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-xs border-b border-slate-800">
                {/* Column 1: no */}
                <th 
                  onClick={() => handleSort('no')}
                  className="px-4 py-3.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors w-24 text-center border-l border-slate-800/60"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="font-mono text-amber-400 font-extrabold text-sm">no</span>
                    <span className="text-[11px] text-slate-300">(التسلسل)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Column 2: shipamnt - CENTERED */}
                <th 
                  onClick={() => handleSort('shipamnt')}
                  className="px-4 py-3.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors border-l border-slate-800/60 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-amber-400 font-extrabold text-sm">shipamnt</span>
                    <span className="text-[11px] text-slate-300">(رقم الشحنة / الكنوصو)</span>
                    {sortField === 'shipamnt' && (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-400" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                    )}
                  </div>
                </th>

                {/* Column 3: cost */}
                <th 
                  onClick={() => handleSort('cost')}
                  className="px-4 py-3.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors border-l border-slate-800/60 text-left"
                >
                  <div className="flex items-center justify-end gap-2">
                    {sortField === 'cost' && (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-400" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span className="text-[11px] text-slate-300">(سعر البيع / التكلفة)</span>
                    <span className="font-mono text-amber-400 font-extrabold text-sm">cost</span>
                  </div>
                </th>

                {/* Additional context columns based on mode */}
                {reportMode === 'grouped' ? (
                  <>
                    <th 
                      onClick={() => handleSort('packages')}
                      className="px-4 py-3.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors text-center border-l border-slate-800/60"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>إجمالي الطرود</span>
                        {sortField === 'packages' && (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-400" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('weight')}
                      className="px-4 py-3.5 font-bold cursor-pointer hover:bg-slate-800 transition-colors text-center border-l border-slate-800/60"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>الوزن الإجمالي (كغ)</span>
                        {sortField === 'weight' && (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-400" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3.5 font-bold text-center">
                      <span>عدد السجلات المشمولة</span>
                    </th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3.5 font-bold text-center border-l border-slate-800/60">
                      <span>كود العميل</span>
                    </th>
                    <th className="px-4 py-3.5 font-bold border-l border-slate-800/60">
                      <span>اسم العميل</span>
                    </th>
                    <th className="px-4 py-3.5 font-bold text-center border-l border-slate-800/60">
                      <span>الطرود</span>
                    </th>
                    <th className="px-4 py-3.5 font-bold text-center">
                      <span>الوزن كغ</span>
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={reportMode === 'grouped' ? 6 : 7} className="text-center py-12 text-slate-400">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold">لا توجد بيانات مطابقة لخيارات البحث والتصفية</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item: any, idx: number) => {
                  const globalIndex = (currentPage - 1) * pageSize + idx + 1;
                  const isGrouped = reportMode === 'grouped';
                  const shipCode = isGrouped ? item.shipment : item.shipment;
                  const costAmount = isGrouped ? item.totalCost : item.sales;
                  const isAir = isAirItem(shipCode, item.type);
                  const isSea = isSeaItem(shipCode, item.type);

                  return (
                    <tr 
                      key={isGrouped ? item.shipment : item.id}
                      className="hover:bg-amber-50/40 transition-colors even:bg-slate-50/60"
                    >
                      {/* 1. no */}
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-500 border-l border-slate-200/80 bg-slate-100/50">
                        {formatEnNumber(globalIndex)}
                      </td>

                      {/* 2. shipamnt - VISUALLY CENTERED */}
                      <td className="px-4 py-3 font-mono font-black text-slate-900 border-l border-slate-200/80 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-mono font-black tracking-wider border inline-flex items-center gap-1.5 shadow-2xs ${
                            isAir 
                              ? 'bg-sky-50 text-sky-800 border-sky-300' 
                              : isSea 
                              ? 'bg-teal-50 text-teal-800 border-teal-300' 
                              : 'bg-slate-100 text-slate-800 border-slate-300'
                          }`}>
                            {isAir && <Plane className="w-3 h-3 text-sky-600" />}
                            {isSea && <Ship className="w-3 h-3 text-teal-600" />}
                            <span>{toLatinDigits(shipCode)}</span>
                          </span>
                          {isGrouped && item.clientCodes.length > 0 && (
                            <span className="text-[10px] text-slate-400 font-normal whitespace-nowrap">
                              ({formatEnNumber(item.recordsCount)} سجل)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. cost */}
                      <td className="px-4 py-3 text-left font-mono font-black text-emerald-700 text-sm border-l border-slate-200/80">
                        <div className="flex items-center justify-end gap-1">
                          <span>{formatEnCurrency(costAmount)}</span>
                        </div>
                      </td>

                      {/* Extra context */}
                      {isGrouped ? (
                        <>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-700 border-l border-slate-200/80">
                            {formatEnNumber(item.totalPackages)}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-700 border-l border-slate-200/80">
                            {formatEnNumber(item.totalWeight, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold text-[11px] font-mono">
                              {formatEnNumber(item.recordsCount)} سجلات
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-center font-mono font-bold text-amber-700 border-l border-slate-200/80">
                            {toLatinDigits(item.code || '-')}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-800 border-l border-slate-200/80">
                            {item.name || '-'}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-700 border-l border-slate-200/80">
                            {formatEnNumber(item.packages || 0)}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">
                            {formatEnNumber(item.weight || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Grand Totals Footer */}
            <tfoot>
              <tr className="bg-slate-900 text-white text-xs font-bold border-t-2 border-slate-700">
                <td className="px-4 py-3.5 text-center text-amber-400 font-black border-l border-slate-800">
                  الإجمالي
                </td>
                {/* shipamnt Column Footer - CENTERED */}
                <td className="px-4 py-3.5 font-bold text-slate-200 border-l border-slate-800 text-center font-mono">
                  <span>{formatEnNumber(totalRecords)} {reportMode === 'grouped' ? 'شحنة مجمعة' : 'سجل شحن'}</span>
                </td>
                <td className="px-4 py-3.5 text-left font-mono font-black text-amber-400 text-sm border-l border-slate-800">
                  <div className="flex items-center justify-end gap-1">
                    <span>{formatEnCurrency(totalCostSum)}</span>
                  </div>
                </td>
                <td colSpan={reportMode === 'grouped' ? 3 : 4} className="px-4 py-3.5 text-center text-slate-400 text-[11px] font-normal">
                  تقرير رسمي مطابق للتنسيق المعتمد (no | shipamnt | cost)
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500 font-medium">
              الصفحة <span className="font-bold text-slate-800 font-mono">{formatEnNumber(currentPage)}</span> من{' '}
              <span className="font-bold text-slate-800 font-mono">{formatEnNumber(totalPages)}</span> (إجمالي{' '}
              <span className="font-bold text-slate-800 font-mono">{formatEnNumber(totalRecords)}</span> سجل)
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="الصفحة الأولى"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="السابق"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="px-3 py-1 font-mono font-bold text-slate-800 bg-white border border-slate-300 rounded-lg">
                {formatEnNumber(currentPage)} / {formatEnNumber(totalPages)}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="التالي"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="الصفحة الأخيرة"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
