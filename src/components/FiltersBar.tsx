import React from 'react';
import { Search, Filter, RotateCcw, Truck, ShieldCheck, Hash, Layers } from 'lucide-react';
import { FilterState } from '../types';

interface FiltersBarProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  shipmentOptions: string[];
  guarantorOptions: string[];
  codeOptions: string[];
  typeOptions: string[];
  cityOptions: string[];
  totalMatches: number;
  totalAll: number;
}

export const FiltersBar: React.FC<FiltersBarProps> = ({
  filters,
  setFilters,
  shipmentOptions,
  guarantorOptions,
  codeOptions,
  typeOptions,
  cityOptions,
  totalMatches,
  totalAll,
}) => {
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/90 p-4 mb-6">
      {/* Title & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">فلتر وبحث الشحنات</h2>
            <p className="text-xs text-slate-500">تصفية السجلات حسب رقم الشحنة أو الكفيل أو الكود والنوع</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 bg-slate-100 px-3 py-1 rounded-full font-medium">
            عرض <strong className="text-slate-950 font-bold">{totalMatches}</strong> من أصل {totalAll} شحنة
          </span>
          {isFiltered && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط الفلاتر</span>
            </button>
          )}
        </div>
      </div>

      {/* Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Search Query */}
        <div className="lg:col-span-2 relative">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            البحث السريع (الاسم، الهاتف، العنوان، الكود)
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="اكتب للبحث الفوري..."
              value={filters.searchQuery}
              onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
              className="w-full pl-3 pr-9 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium text-slate-900"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Shipment Selector */}
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

        {/* Guarantor Selector */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            الكفيل
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

        {/* Customer Code Selector */}
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
      </div>
    </div>
  );
};
