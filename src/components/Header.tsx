import React, { useState, useEffect } from 'react';
import { 
  Package, 
  FileCheck2, 
  ClipboardList, 
  BarChart3,
  Calendar,
  Ship,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Wallet,
  Warehouse
} from 'lucide-react';
import { ActivePage } from '../types';
import { COMPANY_INFO } from '../data/initialData';

type SyncOutcome = 'changed' | 'unchanged' | 'throttled' | 'error' | 'idle';

interface HeaderProps {
  activePage: ActivePage;
  setActivePage: (page: ActivePage) => void;
  isSidebarVisible?: boolean;
  onToggleSidebar?: () => void;
  onSyncDrive?: () => void;
  isSyncing?: boolean;
  lastSyncTime?: string | null;
  lastChangeTime?: string | null;
  syncOutcome?: SyncOutcome;
  syncDelta?: { added: number; modified: number; removed: number };
}

/**
 * Arabic relative-time label: "قبل X ثانية / دقيقة / ساعة / يوم".
 * Kept dependency-free so it works without pulling in a date library.
 */
const formatRelativeTime = (iso: string | null | undefined, nowMs: number): string | null => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return null;

  const seconds = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (seconds < 10) return 'الآن';
  if (seconds < 60) return `قبل ${seconds} ثانية`;

  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return 'قبل دقيقة';
  if (minutes < 60) return `قبل ${minutes} دقيقة`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'قبل ساعة';
  if (hours < 24) return `قبل ${hours} ساعة`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'قبل يوم';
  return `قبل ${days} أيام`;
};

export const Header: React.FC<HeaderProps> = ({
  activePage,
  setActivePage,
  isSidebarVisible = true,
  onToggleSidebar,
  onSyncDrive,
  isSyncing = false,
  lastSyncTime,
  lastChangeTime,
  syncOutcome,
  syncDelta,
}) => {
  const today = new Date().toLocaleDateString('ar-IQ-u-nu-latn', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Re-render every 20s so the "قبل X دقيقة" label stays truthful.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 20_000);
    return () => clearInterval(timer);
  }, []);

  const formattedSyncTime = lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString('ar-IQ-u-nu-latn', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) : null;

  const relativeSync = formatRelativeTime(lastSyncTime, nowMs);

  const syncState = isSyncing
    ? { text: 'جارٍ المزامنة...', tone: 'text-amber-300', dot: 'bg-amber-400' }
    : syncOutcome === 'error'
    ? { text: 'تعذرت المزامنة', tone: 'text-rose-300', dot: 'bg-rose-500' }
    : relativeSync
    ? { text: relativeSync, tone: 'text-emerald-400', dot: 'bg-emerald-500' }
    : { text: 'بانتظار المزامنة', tone: 'text-slate-400', dot: 'bg-slate-500' };

  const deltaTotal = syncDelta ? syncDelta.added + syncDelta.modified + syncDelta.removed : 0;

  return (
    <header className="no-print bg-gradient-to-r from-slate-800 via-slate-800/95 to-slate-750 text-white shadow-lg border-b border-slate-700/50 sticky top-0 z-30">
      {/* Top Brand Bar */}
      <div className="w-full px-3 sm:px-5 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Company Identity */}
        <div className="flex items-center gap-3.5 text-right w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/30">
              <Ship className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white font-['Cairo']">
                  {COMPANY_INFO.shortNameAr}
                </h1>
                <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full border border-amber-500/40 font-semibold">
                  النظام المعتمد
                </span>
              </div>
              <p className="text-xs text-slate-400 tracking-wider uppercase font-medium">
                {COMPANY_INFO.nameEn}
              </p>
            </div>
          </div>

          <div className="md:hidden flex items-center gap-2">
            {onSyncDrive && (
              <button
                onClick={onSyncDrive}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 disabled:opacity-60"
                title="مزامنة فورية من Google Sheets"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'مزامنة...' : 'Sync'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Sync Controls & Date Indicator */}
        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto justify-end">
          {/* Direct Live Google Sheets Sync Button */}
          {onSyncDrive && (
            <div className="flex items-center gap-2 bg-slate-900/60 p-1 rounded-xl border border-slate-700/70">
              <button
                onClick={onSyncDrive}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-400/20 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
                title="تحديث ومزامنة فورية ومباشرة مع شيت جوجل (Google Sheets)"
              >
                <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${isSyncing ? 'animate-spin text-slate-950' : ''}`} />
                <span>{isSyncing ? 'جارٍ مزامنة الشيت...' : '🔄 مزامنة الشيت (Sync)'}</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-slate-950/15 px-1.5 py-0.5 rounded font-extrabold text-slate-950">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  مباشر
                </span>
              </button>

              <div className="hidden sm:flex flex-col text-right px-2 py-0.5 border-r border-slate-700/60 text-[11px]">
                <div className="flex items-center gap-1 font-bold text-emerald-400">
                  <span className={`w-1.5 h-1.5 rounded-full ${syncState.dot} ${isSyncing ? 'animate-pulse' : ''}`}></span>
                  <span className="text-emerald-400">Google Sheets متصل</span>
                </div>

                <span className={`text-[10px] font-medium ${syncState.tone}`}>
                  {syncState.text}
                  {formattedSyncTime ? ` — ${formattedSyncTime}` : ''}
                </span>

                {deltaTotal > 0 && !isSyncing && (
                  <span className="text-[9px] text-slate-400 font-medium">
                    آخر تغيير: {syncDelta!.added} جديد، {syncDelta!.modified} معدّل
                    {syncDelta!.removed > 0 ? `، ${syncDelta!.removed} محذوف` : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="hidden md:flex items-center gap-2 bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700/80 text-xs font-semibold text-slate-300 shadow-xs">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>{today}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="bg-slate-800/95 border-t border-slate-700/60 px-3 sm:px-5">
        <div className="w-full flex items-center justify-between">
          <nav className="flex items-center gap-1 sm:gap-2 py-1.5 overflow-x-auto">
            <button
              onClick={() => setActivePage('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                activePage === 'dashboard'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>الصفحة الرئيسية والوصولات</span>
            </button>

            <button
              onClick={() => setActivePage('warehouse_inventory')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                activePage === 'warehouse_inventory'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Warehouse className="w-4 h-4" />
              <span>جرد المستودعات</span>
            </button>

            <button
              onClick={() => setActivePage('yard_inventory')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                activePage === 'yard_inventory'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>واجهة إخراج البضائع</span>
            </button>

            <button
              onClick={() => setActivePage('debt_collection')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                activePage === 'debt_collection'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>واجهة الاستحصالات</span>
            </button>

            <button
              onClick={() => setActivePage('reports')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                activePage === 'reports'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>تقارير</span>
            </button>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0 py-1">
            {activePage === 'dashboard' && onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer select-none ${
                  isSidebarVisible
                    ? 'bg-slate-800/95 hover:bg-slate-700 text-amber-300 border border-amber-500/40 hover:border-amber-400'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black shadow-md shadow-amber-400/20'
                }`}
                title={isSidebarVisible ? 'إخفاء الشريط الجانبي لتوسيع الجداول' : 'إظهار الشريط الجانبي والفلاتر'}
              >
                {isSidebarVisible ? (
                  <>
                    <PanelLeftClose className="w-4 h-4 text-amber-400" />
                    <span className="hidden sm:inline">إخفاء القائمة الجانبية</span>
                  </>
                ) : (
                  <>
                    <PanelLeftOpen className="w-4 h-4 stroke-[2.5]" />
                    <span>إظهار القائمة الجانبية (الفلاتر)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
