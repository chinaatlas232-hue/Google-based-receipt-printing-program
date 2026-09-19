import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Ship,
  RefreshCw,
  Menu,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import { ActivePage, SystemUser } from '../types';
import { COMPANY_INFO } from '../data/initialData';
import { PAGE_LABELS } from '../auth/permissions';

type SyncOutcome = 'changed' | 'unchanged' | 'throttled' | 'error' | 'idle';

interface HeaderProps {
  activePage: ActivePage;
  onSyncDrive?: () => void;
  isSyncing?: boolean;
  lastSyncTime?: string | null;
  syncOutcome?: SyncOutcome;
  syncDelta?: { added: number; modified: number; removed: number };
  onOpenNav?: () => void;
  onToggleNav?: () => void;
  isNavOpen?: boolean;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  currentUser?: SystemUser | null;
  onLogout?: () => void;
}

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
  onSyncDrive,
  isSyncing = false,
  lastSyncTime,
  syncOutcome,
  syncDelta,
  onOpenNav,
  onToggleNav,
  isNavOpen = true,
  darkMode = false,
  onToggleDarkMode,
  currentUser,
  onLogout,
}) => {
  const today = new Date().toLocaleDateString('ar-IQ-u-nu-latn', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

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

  const pageTitles = PAGE_LABELS;

  return (
    <header className="no-print bg-gradient-to-r from-slate-800 via-slate-800/95 to-slate-750 text-white shadow-lg border-b border-slate-700/50 sticky top-0 z-30">
      <div className="w-full px-3 sm:px-5 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 text-right w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            {onOpenNav && (
              <button
                onClick={onOpenNav}
                className="lg:hidden p-2 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-white transition-colors"
                aria-label="فتح قائمة التنقل"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="lg:hidden w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/30">
              <Ship className="w-6 h-6 text-slate-950" />
            </div>
            <div className="lg:hidden">
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
            <h2 className="hidden lg:block text-base font-bold text-white font-['Cairo']">
              {pageTitles[activePage]}
            </h2>
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

        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto justify-end">
          {onSyncDrive && (
            <div className="flex items-center gap-2 bg-slate-900/60 p-1 rounded-xl border border-slate-700/70">
              <button
                onClick={onSyncDrive}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-400/20 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
                title="تحديث ومزامنة فورية ومباشرة مع شيت جوجل (Google Sheets)"
              >
                <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${isSyncing ? 'animate-spin text-slate-950' : ''}`} />
                <span>{isSyncing ? 'جارٍ مزامنة الشيت...' : 'مزامنة الشيت (Sync)'}</span>
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

          {onToggleNav && (
            <button
              onClick={onToggleNav}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md cursor-pointer"
              title={isNavOpen ? 'طي القائمة الجانبية' : 'إظهار القائمة الجانبية'}
            >
              <Menu className="w-4 h-4" />
              <span className="hidden sm:inline">طي/إظهار القائمة</span>
            </button>
          )}

          {onToggleDarkMode && (
            <button
              onClick={onToggleDarkMode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
              title={darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-200" />}
              <span className="hidden sm:inline">{darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
            </button>
          )}

          {currentUser && onLogout && (
            <button
              onClick={onLogout}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700/80 hover:bg-rose-700 text-slate-200 hover:text-white transition-colors"
              title={`تسجيل خروج ${currentUser.name}`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
