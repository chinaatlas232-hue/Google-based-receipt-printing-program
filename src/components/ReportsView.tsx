import React, { useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { ShipmentRecord } from '../types';
import { ShipmentReportsView } from './ShipmentReportsView';

type ReportSheetTab = 'shipment_reports' | 'shipment_profit_reports';

interface ReportsViewProps {
  shipments: ShipmentRecord[];
  onSyncDrive?: () => void;
  isSyncing?: boolean;
}

export const ReportsView: React.FC<ReportsViewProps> = (props) => {
  const [activeSheet, setActiveSheet] = useState<ReportSheetTab>('shipment_reports');

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveSheet('shipment_reports')}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-extrabold transition-all ${
            activeSheet === 'shipment_reports'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-white dark:bg-[#1e1e1e] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          تقارير الشحنات
        </button>
        <button
          type="button"
          onClick={() => setActiveSheet('shipment_profit_reports')}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-extrabold transition-all ${
            activeSheet === 'shipment_profit_reports'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-white dark:bg-[#1e1e1e] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          تقارير أرباح الشحنات
        </button>
      </div>

      {activeSheet === 'shipment_reports' && <ShipmentReportsView {...props} />}

      {activeSheet === 'shipment_profit_reports' && (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 min-h-[220px] flex items-center justify-center">
          <p className="text-sm font-bold text-slate-500 text-center">
            شيت تقارير أرباح الشحنات — جاهز لاستقبال التفاصيل لاحقاً
          </p>
        </div>
      )}
    </div>
  );
};
