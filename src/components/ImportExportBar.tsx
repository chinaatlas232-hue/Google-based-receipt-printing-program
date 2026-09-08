import React from 'react';
import { 
  Printer, 
  ClipboardCheck, 
  FileSpreadsheet, 
  FileText, 
  Download, 
  Sparkles, 
  RefreshCw 
} from 'lucide-react';

interface ImportExportBarProps {
  onPrintAllReceipts: () => void;
  onPrintYardInventory: () => void;
  onPrintFullReport: () => void;
  onExportExcel: () => void;
  onExportYardExcel?: () => void;
  onSyncDrive?: () => void;
  isSyncing?: boolean;
  receiptCount: number;
}

export const ImportExportBar: React.FC<ImportExportBarProps> = ({
  onPrintAllReceipts,
  onPrintYardInventory,
  onPrintFullReport,
  onExportExcel,
  onExportYardExcel,
  onSyncDrive,
  isSyncing = false,
  receiptCount,
}) => {
  return (
    <div className="no-print bg-slate-800/95 border border-slate-700/70 rounded-xl p-2.5 sm:p-3 shadow-md mb-5 backdrop-blur-xs">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
        {/* Compact Section Title */}
        <div className="flex items-center justify-between sm:justify-start gap-2.5 shrink-0 px-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Printer className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-white font-['Cairo'] whitespace-nowrap">
                أزرار الطبع والتصدير:
              </span>
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold text-amber-300/90 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 whitespace-nowrap">
                <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                جاهز للطباعة فوراً
              </span>
            </div>
          </div>
        </div>

        {/* Side-by-Side (Horizontal) Buttons Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:flex xl:items-center gap-2 w-full xl:w-auto">
          {/* 1. Drive Sync */}
          {onSyncDrive && (
            <button
              onClick={onSyncDrive}
              disabled={isSyncing}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-sm active:scale-95 transition-all disabled:opacity-60 whitespace-nowrap"
              title="تحديث البيانات وسحب أحدث الملفات من درايف فوراً"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'جارٍ السحب...' : 'سحب من درايف'}</span>
            </button>
          )}

          {/* 2. Print All Receipts (A5) */}
          <button
            onClick={onPrintAllReceipts}
            disabled={receiptCount === 0}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-sm shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
            title="طباعة وصولات التسليم المعروضة بمقاس A5"
          >
            <Printer className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
            <span>وصولات الشحنة (A5)</span>
            <span className="bg-slate-950/20 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">
              {receiptCount}
            </span>
          </button>

          {/* 3. Yard Inventory Print (A4) */}
          <button
            onClick={onPrintYardInventory}
            disabled={receiptCount === 0}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/40 font-bold text-xs shadow-xs active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
            title="طباعة نموذج جرد الساحة والمستودع A4 مع خانات التحقق"
          >
            <ClipboardCheck className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>جرد الساحة (A4)</span>
          </button>

          {/* 4. Comprehensive Report Print (PDF) */}
          <button
            onClick={onPrintFullReport}
            disabled={receiptCount === 0}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/90 text-indigo-200 border border-indigo-500/40 font-bold text-xs shadow-xs active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
            title="كشف الشحنة الشامل للطباعة والحفظ كـ PDF"
          >
            <FileText className="w-3.5 h-3.5 shrink-0 text-indigo-300" />
            <span>كشف الشحنة (PDF)</span>
          </button>

          {/* 5. Export Excel */}
          <button
            onClick={onExportExcel}
            disabled={receiptCount === 0}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 font-bold text-xs shadow-xs active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
            title="تصدير جدول الشحنات وملخص المحافظات إلى Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>تصدير إكسل</span>
          </button>

          {/* 6. Export Yard Excel (compact supplementary button) */}
          {onExportYardExcel && (
            <button
              onClick={onExportYardExcel}
              disabled={receiptCount === 0}
              className="hidden sm:flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs transition-all disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
              title="تنزيل نموذج إكسل لجرد الساحة"
            >
              <Download className="w-3 h-3 text-slate-400" />
              <span>جرد XLSX</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
