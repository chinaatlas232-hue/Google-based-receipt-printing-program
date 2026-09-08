import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  RotateCcw, 
  Truck, 
  ShieldCheck, 
  Hash, 
  Layers, 
  MapPin,
  Printer, 
  ClipboardCheck, 
  FileSpreadsheet, 
  FileText, 
  Download, 
  Sparkles, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  PanelLeftClose
} from 'lucide-react';
import { FilterState } from '../types';

interface DashboardSidebarProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  shipmentOptions: string[];
  guarantorOptions: string[];
  codeOptions: string[];
  typeOptions: string[];
  cityOptions: string[];
  totalMatches: number;
  totalAll: number;

  onPrintAllReceipts: () => void;
  onPrintYardInventory: () => void;
  onPrintFullReport: () => void;
  onExportExcel: () => void;
  onExportYardExcel?: () => void;
  onSyncDrive?: () => void;
  isSyncing?: boolean;
  receiptCount: number;
  onCloseSidebar?: () => void;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  filters,
  setFilters,
  shipmentOptions,
  guarantorOptions,
  codeOptions,
  typeOptions,
  cityOptions,
  totalMatches,
  totalAll,
  onPrintAllReceipts,
  onPrintYardInventory,
  onPrintFullReport,
  onExportExcel,
  onExportYardExcel,
  onSyncDrive,
  isSyncing = false,
  receiptCount,
  onCloseSidebar,
}) => {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const handleReset = () => {
    setFilters({
      shipment: 'الكل',
      guarantor: 'الكل',
      code: 'الكل',
      type: 'الكل',
      city: 'الكل',
      searchQuery: '',
    });
  };

  const isFiltered =
    filters.shipment !== 'الكل' ||
    filters.guarantor !== 'الكل' ||
    filters.code !== 'الكل' ||
    filters.type !== 'الكل' ||
    filters.city !== 'الكل' ||
    filters.searchQuery.trim() !== '';

  return (
    <aside className="w-full lg:w-72 xl:w-76 shrink-0 no-print">
      {/* Mobile Toggle Button (Visible only on < lg screens) */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 text-white rounded-xl shadow-md border border-slate-700/80 font-bold text-sm"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            <span>لوحة الفلاتر وأوامر الطباعة</span>
            <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40">
              {totalMatches} شحنة
            </span>
          </div>
          {mobileExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Main Sidebar Card - Sticky on Desktop */}
      <div className={`space-y-4 ${mobileExpanded ? 'block' : 'hidden lg:block'} lg:sticky lg:top-20`}>
        
        {/* Section 1: Print & Export Operations (Stacked Vertically) */}
        <div className="bg-gradient-to-br from-slate-800 via-slate-800/95 to-slate-750 border border-slate-700/70 rounded-2xl p-4 shadow-md text-white">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-700/80">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
                <Printer className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-extrabold font-['Cairo'] text-white">
                أوامر الطبع والتصدير
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                جاهز
              </span>
              {onCloseSidebar && (
                <button
                  onClick={onCloseSidebar}
                  className="hidden lg:flex items-center p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="إخفاء الشريط الجانبي لتوسيع الجداول"
                >
                  <PanelLeftClose className="w-4 h-4 text-amber-400" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {/* 1. Drive Sync Button */}
            {onSyncDrive && (
              <button
                onClick={onSyncDrive}
                disabled={isSyncing}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-400/20 active:scale-98 transition-all disabled:opacity-60"
                title="تحديث وسحب أحدث بيانات الشحنات والعملاء من Google Drive فوراً"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'جارٍ السحب من درايف...' : '🔄 سحب وتحديث من درايف'}</span>
                </div>
                <span className="text-[10px] bg-slate-950/20 text-slate-950 px-1.5 py-0.5 rounded font-bold">
                  سحابي
                </span>
              </button>
            )}

            {/* 2. Print All Receipts A5 */}
            <button
              onClick={onPrintAllReceipts}
              disabled={receiptCount === 0}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold text-xs shadow-sm active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none"
              title="طباعة وصولات التسليم المعروضة بمقاس A5 الرسمي"
            >
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-400 stroke-[2.2]" />
                <span>طباعة الوصولات دفعة واحدة (A5)</span>
              </div>
              <span className="bg-amber-400 text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-black">
                {receiptCount}
              </span>
            </button>

            {/* 3. Yard Inventory A4 */}
            <button
              onClick={onPrintYardInventory}
              disabled={receiptCount === 0}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 font-bold text-xs shadow-sm active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none"
              title="طباعة نموذج جرد الساحة والمستودع A4"
            >
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-amber-400" />
                <span>ورقة جرد الساحة والمستودع (A4)</span>
              </div>
              <span className="text-[10px] text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/80">
                A4
              </span>
            </button>

            {/* 4. Full Report PDF */}
            <button
              onClick={onPrintFullReport}
              disabled={receiptCount === 0}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-200 border border-indigo-500/40 font-bold text-xs shadow-sm active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none"
              title="كشف الشحنة الشامل للطباعة أو التصدير PDF"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-300" />
                <span>كشف الشحنة الشامل (PDF)</span>
              </div>
              <span className="text-[10px] text-indigo-300 bg-indigo-900/60 px-1.5 py-0.5 rounded">
                تقرير
              </span>
            </button>

            {/* 5. Export to Excel (Split or Full) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={onExportExcel}
                disabled={receiptCount === 0}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 font-bold text-xs shadow-sm active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none"
                title="تصدير جدول الشحنات وملخص المحافظات إلى Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>تصدير إكسل</span>
              </button>

              {onExportYardExcel && (
                <button
                  onClick={onExportYardExcel}
                  disabled={receiptCount === 0}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs shadow-sm active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none"
                  title="تنزيل نموذج إكسل لجرد الساحة"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>جرد الساحة</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Filters & Search Panel (Stacked Vertically) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-4">
          <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
                <Filter className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-['Cairo']">
                  الفلاتر والبحث
                </h3>
              </div>
            </div>

            {isFiltered && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg border border-rose-200 transition-colors"
                title="إعادة ضبط جميع الفلاتر"
              >
                <RotateCcw className="w-3 h-3" />
                <span>إعادة ضبط</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {/* Quick Search */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                البحث الفوري (الاسم، الهاتف، الكود)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="اكتب للبحث..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                  className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium text-slate-900"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Shipment Number */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Truck className="w-3 h-3 text-amber-600" />
                رقم الشحنة
              </label>
              <select
                value={filters.shipment}
                onChange={(e) => setFilters(prev => ({ ...prev, shipment: e.target.value }))}
                className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-900"
              >
                <option value="الكل">الكل (جميع الشحنات)</option>
                {shipmentOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Guarantor */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                الكفيل الضامن
              </label>
              <select
                value={filters.guarantor}
                onChange={(e) => setFilters(prev => ({ ...prev, guarantor: e.target.value }))}
                className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-900"
              >
                <option value="الكل">الكل (جميع الكفلاء)</option>
                {guarantorOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Customer Code */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Hash className="w-3 h-3 text-blue-600" />
                كود العميل
              </label>
              <select
                value={filters.code}
                onChange={(e) => setFilters(prev => ({ ...prev, code: e.target.value }))}
                className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-900"
              >
                <option value="الكل">الكل (جميع الأكواد)</option>
                {codeOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Shipment Type */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Layers className="w-3 h-3 text-purple-600" />
                نوع الشحنة
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-900"
              >
                <option value="الكل">الكل (جميع الأنواع)</option>
                {typeOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* City / Governorate */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-rose-600" />
                المحافظة / المدينة
              </label>
              <select
                value={filters.city}
                onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}
                className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-900"
              >
                <option value="الكل">الكل (جميع المحافظات)</option>
                {cityOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Stats Footer */}
          <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>المطابقة الحالية:</span>
            <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
              {totalMatches} من {totalAll}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
