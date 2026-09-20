import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { ShipmentRecord, FilterState, CitySummary, ActivePage, SystemUser } from './types';
import { initialShipments } from './data/initialData';
import { defaultUsers } from './data/users';
import { Header } from './components/Header';
import { NavSidebar } from './components/NavSidebar';
import { MetricCards } from './components/MetricCards';
import { CitySummaryTable } from './components/CitySummaryTable';
import { ShipmentTable } from './components/ShipmentTable';
import { ReceiptModal } from './components/ReceiptModal';
import { YardInventoryModal } from './components/YardInventoryModal';
import { FullReportPrintModal } from './components/FullReportPrintModal';
import { AddShipmentModal } from './components/AddShipmentModal';
import { DriveSyncModal } from './components/DriveSyncModal';
import { YardInventoryView } from './components/YardInventoryView';
import { WarehouseInventory } from './components/WarehouseInventory';
import { ReportsView } from './components/ReportsView';
import { DebtCollectionView } from './components/DebtCollectionView';
import { UserPermissionsView } from './components/UserPermissionsView';
import { CashRegisterView } from './components/CashRegisterView';
import { CustomerStatement } from './components/CustomerStatement';
import { ContainerRadar } from './components/ContainerRadar';
import { WarehouseYardInventory } from './components/WarehouseYardInventory';
import { PrintPrepView } from './components/PrintPrepView';
import { DebtAgingView } from './components/DebtAgingView';
import { VisitLogView } from './components/VisitLogView';
import { ExpensesView } from './components/ExpensesView';
import { LoginPage } from './components/LoginPage';
import { exportShipmentsToExcel, exportYardInventoryToExcel } from './utils/excel';
import { auth } from './services/firebaseAuth';
import {
  applyPermissionScope,
  canAccessPage,
  canDoAction,
  canEditPage,
  constrainFilterState,
  constrainOptions,
  defaultFiltersForUser,
  firstAccessiblePage,
  normalizePermissions,
} from './auth/permissions';

const USERS_STORAGE_KEY = 'atlas_system_users_v5';
const AUTH_SESSION_KEY = 'atlas_auth_session_v1';
const UNIFIED_PASSWORD = '123';

function hydrateUsers(stored?: SystemUser[]): SystemUser[] {
  const byUsername = new Map<string, SystemUser>();
  defaultUsers.forEach((user) => {
    byUsername.set(user.username.toLowerCase(), {
      ...user,
      password: UNIFIED_PASSWORD,
      permissions: normalizePermissions(user.permissions),
    });
  });
  (stored ?? []).forEach((user) => {
    if (!user?.username) return;
    const key = String(user.username).toLowerCase();
    const current = byUsername.get(key);
    byUsername.set(key, {
      ...(current ?? user),
      ...user,
      username: current?.username ?? String(user.username).trim(),
      password: UNIFIED_PASSWORD,
      permissions: normalizePermissions(user.permissions ?? current?.permissions),
    });
  });
  return Array.from(byUsername.values());
}

export default function App() {
  const [users, setUsers] = useState<SystemUser[]>(() => {
    try {
      const saved = localStorage.getItem(USERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return hydrateUsers(parsed);
        }
      }
    } catch (e) {
      console.error(e);
    }
    return hydrateUsers();
  });

  const [sessionUsername, setSessionUsername] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(AUTH_SESSION_KEY);
    } catch {
      return null;
    }
  });

  const currentUser = useMemo(() => {
    if (!sessionUsername) return null;
    return users.find((u) => u.username.toLowerCase() === sessionUsername.toLowerCase()) ?? null;
  }, [users, sessionUsername]);

  // 1. Data State (with local persistence for seamless editing)
  const [shipments, setShipments] = useState<ShipmentRecord[]>(() => {
    try {
      const saved = localStorage.getItem('atlas_shipments_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return initialShipments;
  });

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastChangeTime, setLastChangeTime] = useState<string | null>(null);
  const [syncOutcome, setSyncOutcome] = useState<'changed' | 'unchanged' | 'throttled' | 'error' | 'idle'>('idle');
  const [syncDelta, setSyncDelta] = useState<{ added: number; modified: number; removed: number }>({
    added: 0,
    modified: 0,
    removed: 0,
  });
  const [syncBanner, setSyncBanner] = useState<{ type: 'loading' | 'success' | 'error'; message: string } | null>(null);

  // Guards against overlapping sync requests (poll timer + focus event + button
  // can all fire close together). A sync already in flight is simply reused.
  const syncInFlightRef = useRef(false);
  // Whether we have ever adopted server data; the first successful load always wins.
  const dataLoadedRef = useRef(false);



  // Fetch real merged data from server backend on mount and auto-sync periodically.
  // Only replaces local state when the server reports the data actually changed,
  // so unchanged polls cost nothing and never cause a re-render.
  const loadBackendData = useMemo(() => {
    return async (force = false) => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      try {
        const url = force ? '/api/data?force=true' : '/api/data';
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.lastSync) setLastSyncTime(json.lastSync);
          if (json.lastChange) setLastChangeTime(json.lastChange);
          if (json.outcome) setSyncOutcome(json.outcome);
          if (json.delta) setSyncDelta(json.delta);

          const shouldAdopt = force || json.changed === true || !dataLoadedRef.current;
          if (json.success && Array.isArray(json.shipments) && json.shipments.length > 0 && shouldAdopt) {
            setShipments(json.shipments);
            dataLoadedRef.current = true;
            console.log(`[Smart Sync] Adopted ${json.shipments.length} records (changed=${!!json.changed}). Last sync: ${json.lastSync}`);
          }
        }
      } catch (err) {
        console.warn('Could not load /api/data:', err);
      } finally {
        syncInFlightRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    // Initial fetch: check for changes immediately.
    loadBackendData(true);

    // Periodic poll. This is cheap: the server only downloads when the remote
    // spreadsheet changed, and the client only re-renders when data changed.
    const interval = setInterval(() => {
      loadBackendData(false);
    }, 30 * 1000);

    // Check on tab focus (server-side throttle collapses bursts).
    const handleWindowFocus = () => {
      loadBackendData(false);
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [loadBackendData]);

  const handleDirectDriveSync = async () => {
    setIsDriveSyncing(true);
    setSyncBanner({
      type: 'loading',
      message: 'جارٍ التحقق من التغييرات الجديدة في Google Sheets...'
    });
    try {
      const res = await fetch('/api/sync-drive', { method: 'POST' });
      const data = await res.json();
      if (data.success && Array.isArray(data.shipments)) {
        // The server tells us whether anything actually changed, so an
        // unchanged sync leaves the current records untouched.
        if (data.changed || !dataLoadedRef.current) {
          setShipments(data.shipments);
          dataLoadedRef.current = true;
        }
        if (data.lastSync) setLastSyncTime(data.lastSync);
        if (data.lastChange) setLastChangeTime(data.lastChange);
        if (data.outcome) setSyncOutcome(data.outcome);
        if (data.delta) setSyncDelta(data.delta);

        const { added = 0, modified = 0, removed = 0 } = data.delta || {};
        const hasDelta = added > 0 || modified > 0 || removed > 0;

        setSyncBanner({
          type: 'success',
          message: hasDelta
            ? `تمت المزامنة الذكية: ${added} جديد، ${modified} معدّل${removed ? `، ${removed} محذوف` : ''} — الإجمالي ${data.count.toLocaleString('en-US')} سجل.`
            : `تمت المزامنة الذكية — لا توجد تغييرات جديدة (${data.count.toLocaleString('en-US')} سجل محدّث).`
        });
        setTimeout(() => setSyncBanner(null), 7000);
      } else {
        throw new Error(data.error || 'حدث خطأ أثناء السحب');
      }
    } catch (err: any) {
      console.error(err);
      setSyncOutcome('error');
      setSyncBanner({
        type: 'error',
        message: `تعذر التزامن مع Google Sheets: ${err.message || 'خطأ في الاتصال بالسيرفر'}`
      });
    } finally {
      setIsDriveSyncing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUserEmail(u ? u.email : null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('atlas_shipments_data', JSON.stringify(shipments));
    } catch (e) {
      console.error(e);
    }
  }, [shipments]);

  useEffect(() => {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error(e);
    }
  }, [users]);

  // 2. Navigation State
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [isNavOpen, setIsNavOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 1024;
  });
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('atlas_dark_mode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.body.classList.toggle('dark-mode', darkMode);
    try {
      localStorage.setItem('atlas_dark_mode', String(darkMode));
    } catch (e) {
      console.error(e);
    }
  }, [darkMode]);

  // 3. Filter State
  const [filters, setFilters] = useState<FilterState>(() => defaultFiltersForUser(currentUser));

  const handleSaveUser = (updated: SystemUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...updated, password: UNIFIED_PASSWORD } : u)));
  };

  const handleLogin = (username: string, password: string): boolean => {
    const matched = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!matched || matched.password !== password.trim()) return false;
    setSessionUsername(matched.username);
    try {
      sessionStorage.setItem(AUTH_SESSION_KEY, matched.username);
    } catch {
      /* ignore */
    }
    setActivePage(firstAccessiblePage(matched));
    setFilters(defaultFiltersForUser(matched));
    return true;
  };

  const handleLogout = () => {
    setSessionUsername(null);
    try {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      /* ignore */
    }
    setActivePage('dashboard');
    setFilters(defaultFiltersForUser(null));
  };

  // 4. Modal States
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [modalShipments, setModalShipments] = useState<ShipmentRecord[]>([]);
  const [isBatchReceipt, setIsBatchReceipt] = useState(false);

  const [yardModalOpen, setYardModalOpen] = useState(false);
  const [fullReportModalOpen, setFullReportModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState<ShipmentRecord | null>(null);
  const [driveModalOpen, setDriveModalOpen] = useState(false);

  const scopedShipments = useMemo(
    () => applyPermissionScope(shipments, currentUser),
    [shipments, currentUser]
  );

  // 5. Unique Filter Options Extraction
  const shipmentOptions = useMemo(() => {
    const set = new Set(scopedShipments.map(s => s.shipment).filter(Boolean) as string[]);
    return constrainOptions(Array.from(set).sort(), currentUser?.permissions.filters.shipment ?? { allowed: true, allowedValues: [] });
  }, [scopedShipments, currentUser]);

  const guarantorOptions = useMemo(() => {
    const set = new Set(scopedShipments.map(s => s.guarantor).filter(Boolean) as string[]);
    return constrainOptions(Array.from(set).sort(), currentUser?.permissions.filters.guarantor ?? { allowed: true, allowedValues: [] });
  }, [scopedShipments, currentUser]);

  const codeOptions = useMemo(() => {
    const set = new Set(scopedShipments.map(s => s.code).filter(Boolean) as string[]);
    return constrainOptions(Array.from(set).sort(), currentUser?.permissions.filters.code ?? { allowed: true, allowedValues: [] });
  }, [scopedShipments, currentUser]);

  const typeOptions = useMemo(() => {
    const set = new Set(scopedShipments.map(s => s.type).filter(Boolean) as string[]);
    return constrainOptions(Array.from(set).sort(), currentUser?.permissions.filters.type ?? { allowed: true, allowedValues: [] });
  }, [scopedShipments, currentUser]);

  const cityOptions = useMemo(() => {
    const set = new Set(scopedShipments.map(s => s.city).filter(Boolean) as string[]);
    return constrainOptions(Array.from(set).sort(), currentUser?.permissions.filters.city ?? { allowed: true, allowedValues: [] });
  }, [scopedShipments, currentUser]);

  const applyFilters = (next: FilterState | ((prev: FilterState) => FilterState)) => {
    setFilters((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      return constrainFilterState(resolved, currentUser);
    });
  };

  useEffect(() => {
    if (!currentUser) return;
    setFilters((prev) => constrainFilterState(prev, currentUser));
    if (!canAccessPage(currentUser, activePage)) {
      setActivePage(firstAccessiblePage(currentUser));
    }
  }, [currentUser, activePage]);

  // 6. Filtered Shipments Logic
  const filteredShipments = useMemo(() => {
    return scopedShipments.filter(item => {
      // Filter by Shipment
      if (filters.shipment !== 'الكل' && item.shipment !== filters.shipment) {
        return false;
      }
      // Filter by Guarantor
      if (filters.guarantor !== 'الكل' && item.guarantor !== filters.guarantor) {
        return false;
      }
      // Filter by Customer Code
      if (filters.code !== 'الكل' && item.code !== filters.code) {
        return false;
      }
      // Filter by Type
      if (filters.type !== 'الكل' && item.type !== filters.type) {
        return false;
      }
      // Filter by City
      if (filters.city !== 'الكل' && item.city !== filters.city) {
        return false;
      }
      // Search Query
      if (filters.searchQuery.trim() !== '') {
        const query = filters.searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(query);
        const matchCode = item.code.toLowerCase().includes(query);
        const matchPhone = item.phone.includes(query) || (item.phone2 && item.phone2.includes(query));
        const matchAddress = item.address.toLowerCase().includes(query);
        const matchCity = item.city.toLowerCase().includes(query);
        const matchShipment = item.shipment.toLowerCase().includes(query);
        const matchGuarantor = item.guarantor.toLowerCase().includes(query);

        if (!matchName && !matchCode && !matchPhone && !matchAddress && !matchCity && !matchShipment && !matchGuarantor) {
          return false;
        }
      }

      return true;
    });
  }, [scopedShipments, filters]);

  // 7. Calculate Aggregated City Summaries
  const citySummaries = useMemo<CitySummary[]>(() => {
    const cityMap: Record<string, {
      clients: Set<string>;
      packages: number;
      cbm: number;
      sales: number;
      weight: number;
    }> = {};

    filteredShipments.forEach(item => {
      const city = item.city?.trim() || 'غير محدد';
      if (!cityMap[city]) {
        cityMap[city] = {
          clients: new Set(),
          packages: 0,
          cbm: 0,
          sales: 0,
          weight: 0,
        };
      }
      cityMap[city].clients.add(item.code || item.name);
      cityMap[city].packages += item.packages || 0;
      cityMap[city].cbm += item.cbm || 0;
      cityMap[city].sales += item.sales || 0;
      cityMap[city].weight += item.weight || 0;
    });

    return Object.entries(cityMap)
      .map(([city, stats], idx) => ({
        index: idx + 1,
        city,
        clientCount: stats.clients.size,
        packagesCount: stats.packages,
        cbmTotal: stats.cbm,
        salesTotal: stats.sales,
        weightTotal: stats.weight,
      }))
      .sort((a, b) => b.salesTotal - a.salesTotal);
  }, [filteredShipments]);

  // 8. KPI Calculations
  const totalClients = useMemo(() => {
    const clients = new Set(filteredShipments.map(s => s.code || s.name));
    return clients.size;
  }, [filteredShipments]);

  const totalPackages = useMemo(() => {
    return filteredShipments.reduce((sum, s) => sum + (s.packages || 0), 0);
  }, [filteredShipments]);

  const totalCbm = useMemo(() => {
    return filteredShipments.reduce((sum, s) => sum + (s.cbm || 0), 0);
  }, [filteredShipments]);

  const totalWeight = useMemo(() => {
    return filteredShipments.reduce((sum, s) => sum + (s.weight || 0), 0);
  }, [filteredShipments]);

  const totalSales = useMemo(() => {
    return filteredShipments.reduce((sum, s) => sum + (s.sales || 0), 0);
  }, [filteredShipments]);

  // 9. Handlers
  const handleViewReceipt = (item: ShipmentRecord) => {
    if (!canDoAction(currentUser, 'view_receipt')) return;
    setModalShipments([item]);
    setIsBatchReceipt(false);
    setReceiptModalOpen(true);
  };

  const handlePrintSingleReceipt = (item: ShipmentRecord) => {
    if (!canDoAction(currentUser, 'print_receipts')) return;
    setModalShipments([item]);
    setIsBatchReceipt(false);
    setReceiptModalOpen(true);
  };

  const handlePrintAllReceipts = () => {
    if (!canDoAction(currentUser, 'print_receipts')) return;
    if (filteredShipments.length === 0) return;
    setModalShipments(filteredShipments);
    setIsBatchReceipt(true);
    setReceiptModalOpen(true);
  };

  const handleOpenEdit = (item: ShipmentRecord) => {
    if (!canDoAction(currentUser, 'edit_shipment')) return;
    setEditingShipment(item);
    setAddModalOpen(true);
  };

  const handleDeleteShipment = (id: string) => {
    if (!canDoAction(currentUser, 'delete_shipment')) return;
    if (window.confirm('هل أنت متأكد من حذف هذا السجل نهائياً؟')) {
      setShipments(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleSaveShipment = (record: ShipmentRecord) => {
    if (!canDoAction(currentUser, 'edit_shipment')) return;
    setShipments(prev => {
      const existsIndex = prev.findIndex(s => s.id === record.id);
      if (existsIndex >= 0) {
        const next = [...prev];
        next[existsIndex] = record;
        return next;
      }
      return [record, ...prev];
    });
    setEditingShipment(null);
  };

  const handleDataLoadedFromImport = (records: ShipmentRecord[], mode: 'replace' | 'append') => {
    if (mode === 'replace') {
      setShipments(records);
    } else {
      setShipments(prev => [...records, ...prev]);
    }
    setDriveModalOpen(false);
  };

  const allowSync = canDoAction(currentUser, 'sync_drive');
  const allowPrintReceipts = canDoAction(currentUser, 'print_receipts');
  const allowPrintYard = canDoAction(currentUser, 'print_yard');
  const allowPrintFull = canDoAction(currentUser, 'print_full_report');
  const allowExportExcel = canDoAction(currentUser, 'export_excel');
  const allowExportYard = canDoAction(currentUser, 'export_yard_excel');

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 dark:bg-[#121212] dark:text-slate-100 font-['Cairo'] flex selection:bg-amber-100 selection:text-amber-900">
      <NavSidebar
        activePage={activePage}
        setActivePage={setActivePage}
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
        filters={filters}
        setFilters={applyFilters}
        shipmentOptions={shipmentOptions}
        guarantorOptions={guarantorOptions}
        codeOptions={codeOptions}
        typeOptions={typeOptions}
        cityOptions={cityOptions}
        filterPermissions={currentUser.permissions.filters}
        totalMatches={filteredShipments.length}
        totalAll={scopedShipments.length}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen transition-all duration-300">
      <Header
        activePage={activePage}
        onSyncDrive={allowSync ? handleDirectDriveSync : undefined}
        isSyncing={isDriveSyncing}
        lastSyncTime={lastSyncTime}
        syncOutcome={syncOutcome}
        syncDelta={syncDelta}
        onOpenNav={() => setIsNavOpen(true)}
        onToggleNav={() => setIsNavOpen((prev) => !prev)}
        isNavOpen={isNavOpen}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="flex-1 w-full px-3 sm:px-4 lg:px-5 py-4">
        {/* Real-time sync status banner */}
        {syncBanner && (
          <div className={`mb-4 p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold shadow-xs transition-all ${
            syncBanner.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : syncBanner.type === 'loading'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}>
            <div className="flex items-center gap-2.5">
              {syncBanner.type === 'loading' && <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />}
              {syncBanner.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {syncBanner.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
              <span>{syncBanner.message}</span>
            </div>
            <button
              onClick={() => setSyncBanner(null)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {activePage === 'dashboard' && canAccessPage(currentUser, 'dashboard') && (
          <div className="w-full space-y-5">
            <MetricCards
              clientCount={totalClients}
              packagesCount={totalPackages}
              cbmTotal={totalCbm}
              weightTotal={totalWeight}
              salesTotal={totalSales}
            />
            <CitySummaryTable summaries={citySummaries} />
            <ShipmentTable
              shipments={filteredShipments}
              onViewReceipt={handleViewReceipt}
              onPrintReceipt={handlePrintSingleReceipt}
              onEditShipment={handleOpenEdit}
              onDeleteShipment={handleDeleteShipment}
              onSyncDrive={allowSync ? handleDirectDriveSync : undefined}
              isSyncing={isDriveSyncing}
              canViewReceipt={canDoAction(currentUser, 'view_receipt')}
              canPrint={allowPrintReceipts}
              canEdit={canDoAction(currentUser, 'edit_shipment')}
              canDelete={canDoAction(currentUser, 'delete_shipment')}
            />
          </div>
        )}

        {activePage === 'yard_inventory' && canAccessPage(currentUser, 'yard_inventory') && (
          <YardInventoryView 
            shipments={scopedShipments} 
            onNavigateToDashboard={() => setActivePage('dashboard')}
            canDispatch={canDoAction(currentUser, 'dispatch_goods') && canEditPage(currentUser, 'yard_inventory')}
            canExport={allowExportYard}
            canPrint={allowPrintYard}
            loggedInUserName={currentUser.name}
          />
        )}

        {activePage === 'warehouse_inventory' && canAccessPage(currentUser, 'warehouse_inventory') && (
          <WarehouseInventory
            shipments={scopedShipments}
            canTally={canDoAction(currentUser, 'warehouse_tally') && canEditPage(currentUser, 'warehouse_inventory')}
            canPrint={canDoAction(currentUser, 'warehouse_print')}
            allowedShipments={currentUser.permissions.filters.shipment.allowedValues}
          />
        )}

        {activePage === 'reports' && canAccessPage(currentUser, 'reports') && (
          <ReportsView 
            shipments={scopedShipments} 
            onSyncDrive={allowSync ? handleDirectDriveSync : undefined} 
            isSyncing={isDriveSyncing} 
          />
        )}

        {activePage === 'debt_collection' && canAccessPage(currentUser, 'debt_collection') && (
          <DebtCollectionView
            shipments={scopedShipments}
            onSyncDrive={allowSync ? handleDirectDriveSync : undefined}
            isSyncing={isDriveSyncing}
            canRecordPayment={canDoAction(currentUser, 'record_payment') && canEditPage(currentUser, 'debt_collection')}
            canDeletePayment={canDoAction(currentUser, 'delete_payment') && canEditPage(currentUser, 'debt_collection')}
            canExport={allowExportExcel}
            canPrint={allowPrintReceipts}
          />
        )}

        {activePage === 'cash_register' && canAccessPage(currentUser, 'cash_register') && (
          <CashRegisterView
            userName={currentUser.name}
            canEdit={canEditPage(currentUser, 'cash_register')}
          />
        )}

        {activePage === 'customer_statement' && (
          <CustomerStatement
            shipments={scopedShipments}
            codeOptions={codeOptions}
            guarantorOptions={guarantorOptions}
            shipmentOptions={shipmentOptions}
          />
        )}

        {activePage === 'container_radar' && (
          <ContainerRadar />
        )}

        {activePage === 'warehouse_yard' && (
          <WarehouseYardInventory />
        )}

        {activePage === 'print_prep' && (
          <PrintPrepView shipments={scopedShipments} />
        )}

        {activePage === 'debt_aging' && (
          <DebtAgingView
            shipments={scopedShipments}
            shipmentOptions={shipmentOptions}
            guarantorOptions={guarantorOptions}
            codeOptions={codeOptions}
          />
        )}

        {activePage === 'visit_log' && (
          <VisitLogView />
        )}

        {activePage === 'expenses' && (
          <ExpensesView />
        )}

        {activePage === 'user_permissions' && canAccessPage(currentUser, 'user_permissions') && (
          <UserPermissionsView
            users={users}
            currentUser={currentUser}
            shipments={shipments}
            canManage={canDoAction(currentUser, 'manage_users') && canEditPage(currentUser, 'user_permissions')}
            onSaveUser={handleSaveUser}
          />
        )}
      </main>

      {/* 3. Footer */}
      <footer className="no-print bg-slate-800 text-slate-300 border-t border-slate-700/70 text-xs py-5 px-4 text-center mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 font-medium">
          <p>
            نظام وصولات تسليم البضائع والجرد المعتمد © {new Date().getFullYear()} - شركة أطلس المحيط للتجارة العامة والشحن الدولي
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>📍 بغداد - المنصور - تقاطع الرواد</span>
            <span dir="ltr">📞 07858588899 / 07814518989</span>
          </div>
        </div>
      </footer>

      {/* 4. Modals */}
      <ReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        shipments={modalShipments}
        isBatch={isBatchReceipt}
      />

      <YardInventoryModal
        isOpen={yardModalOpen}
        onClose={() => setYardModalOpen(false)}
        shipments={filteredShipments}
        shipmentFilter={filters.shipment}
      />

      <FullReportPrintModal
        isOpen={fullReportModalOpen}
        onClose={() => setFullReportModalOpen(false)}
        shipments={filteredShipments}
        citySummaries={citySummaries}
        filters={filters}
        totalClients={totalClients}
        totalPackages={totalPackages}
        totalCbm={totalCbm}
        totalWeight={totalWeight}
        totalSales={totalSales}
      />

      <AddShipmentModal
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setEditingShipment(null);
        }}
        onSave={handleSaveShipment}
        editingRecord={editingShipment}
      />

      <DriveSyncModal
        isOpen={driveModalOpen}
        onClose={() => setDriveModalOpen(false)}
        onDataLoaded={handleDataLoadedFromImport}
        currentCount={shipments.length}
      />
      </div>
    </div>
  );
}

