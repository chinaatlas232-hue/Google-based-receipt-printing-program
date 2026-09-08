import React, { useState } from 'react';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { CitySummary } from '../types';

interface CitySummaryTableProps {
  summaries: CitySummary[];
}

export const CitySummaryTable: React.FC<CitySummaryTableProps> = ({ summaries }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (summaries.length === 0) return null;

  const totalClients = summaries.reduce((acc, s) => acc + s.clientCount, 0);
  const totalPackages = summaries.reduce((acc, s) => acc + s.packagesCount, 0);
  const totalCbm = summaries.reduce((acc, s) => acc + s.cbmTotal, 0);
  const totalSales = summaries.reduce((acc, s) => acc + s.salesTotal, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/90 overflow-hidden mb-6">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-4 py-3 bg-gradient-to-r from-slate-50 to-indigo-50/40 border-b border-slate-200/80 flex items-center justify-between text-right hover:bg-slate-100/70 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-700 flex items-center justify-center font-bold">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              ملخص الإحصائيات والديون حسب المحافظات والمدن
            </h3>
            <p className="text-xs text-slate-500">
              توزيع عدد العملاء، الطرود، الحجم CBM، وإجمالي مبالغ الديون لكل محافظة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold px-2.5 py-1 bg-indigo-100/80 text-indigo-800 rounded-lg">
            {summaries.length} محافظات
          </span>
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Table Content */}
      {!isCollapsed && (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white font-bold">
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3">المحافظة / المدينة</th>
                <th className="py-2.5 px-3 text-center">عدد العملاء</th>
                <th className="py-2.5 px-3 text-center">إجمالي الطرود</th>
                <th className="py-2.5 px-3 text-center">إجمالي الحجم (CBM)</th>
                <th className="py-2.5 px-3 text-left pl-6">إجمالي الديون / المبيعات ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {summaries.map((row) => (
                <tr key={row.city} className="hover:bg-indigo-50/40 transition-colors">
                  <td className="py-2.5 px-3 text-center font-bold text-slate-500 bg-slate-50/60">
                    {row.index}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    <span>{row.city}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-blue-900">
                    {row.clientCount} عميل
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-emerald-900">
                    {row.packagesCount} طرد
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-semibold text-purple-900">
                    {row.cbmTotal.toFixed(1)} CBM
                  </td>
                  <td className="py-2.5 px-3 text-left pl-6 font-mono font-bold text-rose-800">
                    ${row.salesTotal.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100/90 font-extrabold text-slate-950 border-t-2 border-slate-300">
                <td className="py-2.5 px-3 text-center">الإجمالي</td>
                <td className="py-2.5 px-3">كافة المحافظات المعروضة</td>
                <td className="py-2.5 px-3 text-center text-blue-950 font-black">
                  {totalClients} عميل
                </td>
                <td className="py-2.5 px-3 text-center text-emerald-950 font-black">
                  {totalPackages} طرد
                </td>
                <td className="py-2.5 px-3 text-center font-mono font-black text-purple-950">
                  {totalCbm.toFixed(1)} CBM
                </td>
                <td className="py-2.5 px-3 text-left pl-6 font-mono font-black text-rose-950 text-sm">
                  ${totalSales.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
