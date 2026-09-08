import React, { useState, useMemo } from 'react';
import { 
  Printer, 
  Eye, 
  EyeOff,
  ArrowUpDown, 
  Phone, 
  Edit3, 
  Trash2, 
  ChevronRight, 
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  FileSpreadsheet
} from 'lucide-react';
import { ShipmentRecord } from '../types';

interface ShipmentTableProps {
  shipments: ShipmentRecord[];
  onViewReceipt: (shipment: ShipmentRecord) => void;
  onPrintReceipt: (shipment: ShipmentRecord) => void;
  onEditShipment: (shipment: ShipmentRecord) => void;
  onDeleteShipment: (id: string) => void;
}

type SortField = 'code' | 'name' | 'weight' | 'cbm' | 'packages' | 'price' | 'sales' | 'shipment';
type SortOrder = 'asc' | 'desc';

export const ShipmentTable: React.FC<ShipmentTableProps> = ({
  shipments,
  onViewReceipt,
  onPrintReceipt,
  onEditShipment,
  onDeleteShipment,
}) => {
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Toggle state for Actions column with localStorage persistence
  const [showActionsColumn, setShowActionsColumn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('atlas_show_actions_col');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleActionsColumn = () => {
    setShowActionsColumn(prev => {
      const next = !prev;
      try {
        localStorage.setItem('atlas_show_actions_col', String(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedShipments = useMemo(() => {
    return [...shipments].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' 
          ? (aVal as string).localeCompare(bVal as string, 'ar')
          : (bVal as string).localeCompare(aVal as string, 'ar');
      }

      if (typeof aVal === 'number') {
        return sortOrder === 'asc' 
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      }

      return 0;
    });
  }, [shipments, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedShipments.length / pageSize) || 1;
  const paginatedShipments = useMemo(() => {
    if (pageSize === -1) return sortedShipments;
    const start = (currentPage - 1) * pageSize;
    return sortedShipments.slice(start, start + pageSize);
  }, [sortedShipments, currentPage, pageSize]);

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200/90 overflow-hidden mb-8">
      {/* Table Top Bar */}
      <div className="px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-750 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white font-['Cairo']">
              جدول تفاصيل الشحنات والعملاء
            </h3>
            <p className="text-xs text-slate-300">
              تنسيق فائق الدقة مع إمكانية الفرز، المعاينة، والطباعة الفردية لكل وصل
            </p>
          </div>
        </div>

        {/* Page Size & Count & Column Toggle */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Toggle Actions Column Button */}
          <button
            onClick={toggleActionsColumn}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-xs cursor-pointer select-none ${
              showActionsColumn
                ? 'bg-slate-800/90 hover:bg-slate-700 text-amber-300 border-amber-500/40 hover:border-amber-400'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black border-amber-400 shadow-md shadow-amber-400/20'
            }`}
            title={showActionsColumn ? 'إخفاء عمود إجراءات الوصل لتوفير مساحة إضافية للجداول' : 'إظهار عمود إجراءات الوصل'}
          >
            {showActionsColumn ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                <span>إخفاء إجراءات الوصل</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>إظهار إجراءات الوصل</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-1.5 text-slate-300">
            <span>عدد السجلات لكل صفحة:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-800 text-white border border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={-1}>عرض الكل ({shipments.length})</option>
            </select>
          </div>

          <span className="bg-slate-800 px-3 py-1 rounded-lg text-amber-300 font-bold border border-slate-700">
            إجمالي السجلات: {shipments.length}
          </span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
        <table className="w-full text-right text-xs border-collapse font-medium">
          <thead className="sticky top-0 z-10 bg-slate-800 text-slate-100 shadow-sm border-b-2 border-slate-700/80 select-none">
            <tr>
              <th className="py-3.5 px-3 text-center w-12 font-bold text-slate-300">#</th>

              <th 
                onClick={() => handleSort('shipment')}
                className="py-3.5 px-3 font-bold cursor-pointer hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>الشحنة</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th 
                onClick={() => handleSort('code')}
                className="py-3.5 px-3 font-bold cursor-pointer hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>الكود</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th 
                onClick={() => handleSort('name')}
                className="py-3.5 px-3 font-bold cursor-pointer hover:text-amber-300 transition-colors whitespace-nowrap min-w-[160px]"
              >
                <div className="flex items-center gap-1">
                  <span>اسم العميل</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th className="py-3.5 px-3 font-bold whitespace-nowrap">الكفيل</th>

              <th 
                onClick={() => handleSort('weight')}
                className="py-3.5 px-3 font-bold text-center cursor-pointer hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>الوزن (كغ)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th 
                onClick={() => handleSort('cbm')}
                className="py-3.5 px-3 font-bold text-center cursor-pointer hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>الحجم (CBM)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th 
                onClick={() => handleSort('packages')}
                className="py-3.5 px-3 font-bold text-center cursor-pointer hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>الطرود</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th 
                onClick={() => handleSort('price')}
                className="py-3.5 px-3 font-bold text-center cursor-pointer hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>السعر ($)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th 
                onClick={() => handleSort('sales')}
                className="py-3.5 px-3 font-bold text-center cursor-pointer hover:text-amber-300 transition-colors whitespace-nowrap min-w-[120px]"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>الديون ($)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th className="py-3.5 px-3 font-bold whitespace-nowrap">رقم الهاتف</th>
              <th className="py-3.5 px-3 font-bold min-w-[200px] max-w-[340px]">العنوان</th>
              <th className="py-3.5 px-3 font-bold whitespace-nowrap">المدينة</th>
              <th className="py-3.5 px-3 font-bold whitespace-nowrap">النوع</th>
              {showActionsColumn && (
                <th className="py-3.5 px-3 text-center font-bold whitespace-nowrap sticky left-0 bg-slate-800 z-10 min-w-[130px]">
                  إجراءات الوصل
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 text-slate-800">
            {paginatedShipments.length === 0 ? (
              <tr>
                <td colSpan={showActionsColumn ? 15 : 14} className="py-12 text-center text-slate-400">
                  <div className="max-w-xs mx-auto text-center">
                    <p className="text-sm font-bold text-slate-600 mb-1">لا توجد بيانات مطابقة</p>
                    <p className="text-xs text-slate-400">يرجى تعديل خيارات الفلتر أو إضافة شحنات جديدة</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedShipments.map((row, index) => {
                const seq = pageSize === -1 ? index + 1 : (currentPage - 1) * pageSize + index + 1;
                return (
                  <tr 
                    key={row.id}
                    className="hover:bg-amber-50/50 transition-colors group"
                  >
                    {/* Seq */}
                    <td className="py-3 px-3 text-center font-bold text-slate-400 group-hover:text-amber-700 bg-slate-50/70 group-hover:bg-amber-100/40">
                      {seq}
                    </td>

                    {/* Shipment */}
                    <td className="py-3 px-3 font-black text-slate-900 whitespace-nowrap">
                      <span className="bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-800 border border-slate-300">
                        {row.shipment}
                      </span>
                    </td>

                    {/* Code */}
                    <td className="py-3 px-3 font-mono font-bold text-amber-700 whitespace-nowrap">
                      <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-300 font-extrabold">
                        {row.code}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                      {row.name}
                    </td>

                    {/* Guarantor */}
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {row.guarantor || <span className="text-slate-300">بدون كفيل</span>}
                    </td>

                    {/* Weight */}
                    <td className="py-3 px-3 text-center font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {row.weight.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </td>

                    {/* CBM */}
                    <td className="py-3 px-3 text-center font-mono font-semibold text-purple-700 whitespace-nowrap">
                      {row.cbm.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                    </td>

                    {/* Packages */}
                    <td className="py-3 px-3 text-center font-bold text-emerald-800 whitespace-nowrap">
                      <span className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        📦 {row.packages}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="py-3 px-3 text-center font-mono text-slate-700 whitespace-nowrap">
                      ${row.price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </td>

                    {/* Sales / Debt */}
                    <td className="py-3 px-3 text-center font-mono font-black text-rose-700 whitespace-nowrap">
                      <span className="bg-rose-50 text-rose-800 px-2.5 py-1 rounded-md border border-rose-300 text-xs font-black shadow-xs">
                        ${row.sales.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                      </span>
                    </td>

                    {/* Phone */}
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600" dir="ltr">
                      <div className="flex items-center gap-1 justify-end">
                        <span>{row.phone}</span>
                        <Phone className="w-3 h-3 text-slate-400" />
                      </div>
                    </td>

                    {/* Address (Full Text Wrapping without truncation) */}
                    <td className="py-3 px-3 text-slate-700 min-w-[200px] max-w-[340px] whitespace-normal break-words leading-relaxed text-xs">
                      {row.address ? (
                        <span>{row.address}</span>
                      ) : (
                        <span className="text-slate-400 italic">بدون عنوان تفصيلي</span>
                      )}
                    </td>

                    {/* City */}
                    <td className="py-3 px-3 font-semibold text-indigo-900 whitespace-nowrap">
                      {row.city}
                    </td>

                    {/* Type */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="bg-slate-100 text-slate-700 text-[11px] px-2 py-0.5 rounded font-semibold border border-slate-200">
                        {row.type}
                      </span>
                    </td>

                    {/* Actions (Sticky Left - Controlled by Toggle Button) */}
                    {showActionsColumn && (
                      <td className="py-3 px-3 text-center whitespace-nowrap sticky left-0 bg-white group-hover:bg-amber-50/50 z-10 border-r border-slate-200 shadow-sm">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Print Receipt */}
                          <button
                            onClick={() => onPrintReceipt(row)}
                            className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-xs cursor-pointer"
                            title="طباعة وصل هذا العميل فورا (A5)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* View Modal */}
                          <button
                            onClick={() => onViewReceipt(row)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            title="معاينة تفاصيل الوصل"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Record */}
                          <button
                            onClick={() => onEditShipment(row)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors cursor-pointer"
                            title="تعديل بيانات الشحنة"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Record */}
                          <button
                            onClick={() => onDeleteShipment(row.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                            title="حذف هذا السجل"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {pageSize !== -1 && totalPages > 1 && (
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-600 font-medium">
            صفحة <strong className="text-slate-950 font-bold">{currentPage}</strong> من أصل {totalPages} (إجمالي {sortedShipments.length} شحنة)
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="الصفحة الأولى"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="الصفحة السابقة"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-bold text-slate-800 bg-white border border-slate-300 rounded-lg">
              {currentPage}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="الصفحة التالية"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="الصفحة الأخيرة"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
