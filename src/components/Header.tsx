import React from 'react';
import { 
  Package, 
  FileCheck2, 
  ClipboardList, 
  Calendar,
  Ship,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { ActivePage } from '../types';
import { COMPANY_INFO } from '../data/initialData';

interface HeaderProps {
  activePage: ActivePage;
  setActivePage: (page: ActivePage) => void;
  isSidebarVisible?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activePage,
  setActivePage,
  isSidebarVisible = true,
  onToggleSidebar,
}) => {
  const today = new Date().toLocaleDateString('ar-IQ', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="no-print bg-gradient-to-r from-slate-800 via-slate-800/95 to-slate-750 text-white shadow-lg border-b border-slate-700/50 sticky top-0 z-30">
      {/* Top Brand Bar */}
      <div className="w-full px-3 sm:px-5 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Company Identity */}
        <div className="flex items-center gap-3.5 text-right w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/30">
              <Ship className="w-7 h-7 text-slate-950" />
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

          <div className="md:hidden flex items-center gap-1.5 text-xs bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>{new Date().toLocaleDateString('en-CA')}</span>
          </div>
        </div>

        {/* Right Side: Current Date & System Indicator */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700/80 text-xs font-semibold text-slate-300 shadow-xs">
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
              onClick={() => setActivePage('dispatch_approval')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                activePage === 'dispatch_approval'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              <span>موافقة إخراج البضائع</span>
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
              <span>جرد الساحة والمستودع</span>
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
