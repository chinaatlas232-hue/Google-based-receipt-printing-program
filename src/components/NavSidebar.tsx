import React from 'react';
import {
  Package,
  ClipboardList,
  BarChart3,
  Ship,
  Wallet,
  Landmark,
  Warehouse,
  X,
  Shield,
  LogOut,
  User,
  Search,
  Filter,
  RotateCcw,
  Truck,
  ShieldCheck,
  Hash,
  Layers,
  MapPin,
} from 'lucide-react';
import { ActivePage, FilterKey, FilterPermission, FilterState, SystemUser } from '../types';
import { COMPANY_INFO } from '../data/initialData';
import { canAccessPage } from '../auth/permissions';

interface NavSidebarProps {
  activePage: ActivePage;
  setActivePage: (page: ActivePage) => void;
  isOpen: boolean;
  onClose: () => void;
  currentUser?: SystemUser | null;
  onLogout?: () => void;
  filters?: FilterState;
  setFilters?: (next: FilterState | ((prev: FilterState) => FilterState)) => void;
  shipmentOptions?: string[];
  guarantorOptions?: string[];
  codeOptions?: string[];
  typeOptions?: string[];
  cityOptions?: string[];
  filterPermissions?: Record<FilterKey, FilterPermission>;
  totalMatches?: number;
  totalAll?: number;
}

const NAV_ITEMS: { id: ActivePage; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'الصفحة الرئيسية والوصولات', icon: Package },
  { id: 'warehouse_inventory', label: 'مطابقة الشحنة المرسلة', icon: Warehouse },
  { id: 'yard_inventory', label: 'واجهة إخراج البضائع', icon: ClipboardList },
  { id: 'debt_collection', label: 'واجهة الاستحصالات', icon: Wallet },
  { id: 'cash_register', label: 'واجهة القاصة', icon: Landmark },
  { id: 'reports', label: 'تقارير', icon: BarChart3 },
  { id: 'warehouse_yard', label: 'جرد المستودع والساحة', icon: Warehouse },
  { id: 'customer_statement', label: 'كشف حساب عميل', icon: User },
  { id: 'container_radar', label: 'رادار تتبع الحاويات', icon: Ship },
  { id: 'user_permissions', label: 'صلاحيات المستخدمين', icon: Shield },
];

export const NavSidebar: React.FC<NavSidebarProps> = ({
  activePage,
  setActivePage,
  isOpen,
  onClose,
  currentUser,
  onLogout,
  filters,
  setFilters,
  shipmentOptions = [],
  guarantorOptions = [],
  codeOptions = [],
  typeOptions = [],
  cityOptions = [],
  filterPermissions,
  totalMatches = 0,
  totalAll = 0,
}) => {
  const handleNav = (page: ActivePage) => {
    setActivePage(page);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onClose();
    }
  };

  const handleReset = () => {
    if (!setFilters) return;
    setFilters({
      shipment: 'الكل',
      guarantor: 'الكل',
      code: 'الكل',
      type: 'الكل',
      city: 'الكل',
      searchQuery: '',
    });
  };

  const isFiltered = !!(
    filters &&
    (filters.shipment !== 'الكل' ||
      filters.guarantor !== 'الكل' ||
      filters.code !== 'الكل' ||
      filters.type !== 'الكل' ||
      filters.city !== 'الكل' ||
      filters.searchQuery.trim() !== '')
  );

  const selectClass =
    'w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-900';

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 z-40 lg:hidden no-print"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`no-print bg-slate-800 dark:bg-slate-950 text-white flex flex-col w-64 shrink-0 overflow-y-auto custom-scrollbar z-50 fixed inset-y-0 right-0 transition-transform duration-300 ease-in-out lg:min-h-screen lg:z-20 ${
          isOpen ? 'translate-x-0 lg:static' : 'translate-x-full lg:fixed'
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-slate-700/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/30 shrink-0">
              <Ship className="w-5 h-5 text-slate-950" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight text-white font-['Cairo'] truncate">
                {COMPANY_INFO.shortNameAr}
              </h1>
              <p className="text-[10px] text-slate-400 tracking-wider uppercase font-medium truncate">
                {COMPANY_INFO.nameEn}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2">
          <span className="inline-flex bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/40 font-semibold">
            النظام المعتمد
          </span>
        </div>

        <nav className="px-3 py-2 space-y-1">
          {NAV_ITEMS.filter((item) => item.id === 'customer_statement' || item.id === 'container_radar' || item.id === 'warehouse_yard' || canAccessPage(currentUser ?? null, item.id)).map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-right ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/70'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="leading-snug">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {filters && setFilters && (
          <div className="mx-3 mt-3 mb-2 bg-white rounded-2xl shadow-sm border border-slate-200/90 p-4">
            <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
                  <Filter className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 font-['Cairo']">الفلاتر والبحث</h3>
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
              {(!filterPermissions || filterPermissions.searchQuery.allowed) && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    البحث الفوري (الاسم، الهاتف، الكود)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="اكتب للبحث..."
                      value={filters.searchQuery}
                      onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
                      className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium text-slate-900"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}

              {(!filterPermissions || filterPermissions.shipment.allowed) && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Truck className="w-3 h-3 text-amber-600" />
                    رقم الشحنة
                    {filterPermissions?.shipment.allowedValues.length ? (
                      <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 rounded">مقيّد</span>
                    ) : null}
                  </label>
                  <select
                    value={filters.shipment}
                    onChange={(e) => setFilters((prev) => ({ ...prev, shipment: e.target.value }))}
                    className={selectClass}
                  >
                    {(!filterPermissions?.shipment.allowedValues.length) && (
                      <option value="الكل">الكل (جميع الشحنات)</option>
                    )}
                    {shipmentOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}

              {(!filterPermissions || filterPermissions.guarantor.allowed) && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    الكفيل الضامن
                    {filterPermissions?.guarantor.allowedValues.length ? (
                      <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 rounded">مقيّد</span>
                    ) : null}
                  </label>
                  <select
                    value={filters.guarantor}
                    onChange={(e) => setFilters((prev) => ({ ...prev, guarantor: e.target.value }))}
                    className={selectClass}
                  >
                    {(!filterPermissions?.guarantor.allowedValues.length) && (
                      <option value="الكل">الكل (جميع الكفلاء)</option>
                    )}
                    {guarantorOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}

              {(!filterPermissions || filterPermissions.code.allowed) && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Hash className="w-3 h-3 text-blue-600" />
                    كود العميل
                    {filterPermissions?.code.allowedValues.length ? (
                      <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 rounded">مقيّد</span>
                    ) : null}
                  </label>
                  <select
                    value={filters.code}
                    onChange={(e) => setFilters((prev) => ({ ...prev, code: e.target.value }))}
                    className={selectClass}
                  >
                    {(!filterPermissions?.code.allowedValues.length) && (
                      <option value="الكل">الكل (جميع الأكواد)</option>
                    )}
                    {codeOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}

              {(!filterPermissions || filterPermissions.type.allowed) && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-purple-600" />
                    نوع الشحنة
                    {filterPermissions?.type.allowedValues.length ? (
                      <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 rounded">مقيّد</span>
                    ) : null}
                  </label>
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
                    className={selectClass}
                  >
                    {(!filterPermissions?.type.allowedValues.length) && (
                      <option value="الكل">الكل (جميع الأنواع)</option>
                    )}
                    {typeOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}

              {(!filterPermissions || filterPermissions.city.allowed) && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-rose-600" />
                    المحافظة / المدينة
                    {filterPermissions?.city.allowedValues.length ? (
                      <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 rounded">مقيّد</span>
                    ) : null}
                  </label>
                  <select
                    value={filters.city}
                    onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value }))}
                    className={selectClass}
                  >
                    {(!filterPermissions?.city.allowedValues.length) && (
                      <option value="الكل">الكل (جميع المحافظات)</option>
                    )}
                    {cityOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>المطابقة الحالية:</span>
              <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                {totalMatches} من {totalAll}
              </span>
            </div>
          </div>
        )}

        <div className="mt-auto px-4 py-4 border-t border-slate-700/80 space-y-3">
          {currentUser && (
            <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/70">
              <p className="text-xs font-extrabold text-white truncate">{currentUser.name}</p>
              <p className="text-[10px] text-amber-300 font-bold mt-0.5">{currentUser.role}</p>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-700 hover:bg-rose-700 text-slate-200 hover:text-white text-[11px] font-bold transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  تسجيل الخروج
                </button>
              )}
            </div>
          )}
          <p className="text-[10px] text-slate-400 font-medium">
            شركة أطلس المحيط للتجارة العامة والشحن الدولي
          </p>
        </div>
      </aside>
    </>
  );
};
