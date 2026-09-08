import React, { useState, useMemo, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, X, SlidersHorizontal, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ShipmentRecord, FilterState, CitySummary, ActivePage } from './types';
import { initialShipments } from './data/initialData';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { FiltersBar } from './components/FiltersBar';
import { ImportExportBar } from './components/ImportExportBar';
import { DashboardSidebar } from './components/DashboardSidebar';
import { CitySummaryTable } from './components/CitySummaryTable';
import { ShipmentTable } from './components/ShipmentTable';
import { ReceiptModal } from './components/ReceiptModal';
import { YardInventoryModal } from './components/YardInventoryModal';
import { FullReportPrintModal } from './components/FullReportPrintModal';
import { AddShipmentModal } from './components/AddShipmentModal';
import { DriveSyncModal } from './components/DriveSyncModal';
import { DispatchApprovalView } from './components/DispatchApprovalView';
import { YardInventoryView } from './components/YardInventoryView';
import { exportShipmentsToExcel, exportYardInventoryToExcel } from './utils/excel';
import { auth } from './services/firebaseAuth';

export default function App() {
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
  const [syncBanner, setSyncBanner] = useState<{ type: 'loading' | 'success' | 'error'; message: string } | null>(null);

  // Sidebar Visibility State (Full Width Expansion)
  const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('atlas_sidebar_visible');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleSidebar = () => {
    setIsSidebarVisible(prev => {
      const next = !prev;
      try {
        localStorage.setItem('atlas_sidebar_visible', String(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  // Fetch real merged data from server backend on mount
  useEffect(() => {
    async function loadBackendData() {
      try {
        const res = await fetch('/api/data');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.shipments) && json.shipments.length > 0) {
            setShipments(json.shipments);
            console.log(`Loaded ${json.shipments.length} records from server database`);
          }
        }
      } catch (err) {
        console.warn('Could not load /api/data:', err);
      }
    }
    loadBackendData();
  }, []);

  const handleDirectDriveSync = async () => {
    setIsDriveSyncing(true);
    setSyncBanner({
      type: 'loading',
      message: 'جارٍ سحب وتحديث ملفات الشحنات والعملاء من Google Drive ودمجها...'
    });
    try {
      const res = await fetch('/api/sync-drive', { method: 'POST' });
      const data = await res.json();
      if (data.success && Array.isArray(data.shipments)) {
        setShipments(data.shipments);
        setSyncBanner({
          type: 'success',
          message: `تم بنجاح سحب وتحديث ${data.count.toLocaleString('ar-IQ')} شحنة من Google Drive ودمج بيانات العملاء!`
        });
        setTimeout(() => setSyncBanner(null), 8000);
      } else {
        throw new Error(data.error || 'حدث خطأ أثناء السحب');
      }
    } catch (err: any) {
      console.error(err);
      setSyncBanner({
        type: 'error',
        message: `تعذر سحب البيانات: ${err.message || 'خطأ في الاتصال بالسيرفر'}`
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

  // 2. Navigation State
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');

  // 3. Filter State
  const [filters, setFilters] = useState<FilterState>({
    shipment: 'الكل',
    guarantor: 'الكل',
    code: 'الكل',
    type: 'الكل',
    city: 'الكل',
    searchQuery: '',
  });

  // 4. Modal States
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [modalShipments, setModalShipments] = useState<ShipmentRecord[]>([]);
  const [isBatchReceipt, setIsBatchReceipt] = useState(false);

  const [yardModalOpen, setYardModalOpen] = useState(false);
  const [fullReportModalOpen, setFullReportModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState<ShipmentRecord | null>(null);
  const [driveModalOpen, setDriveModalOpen] = useState(false);

  // 5. Unique Filter Options Extraction
  const shipmentOptions = useMemo(() => {
    const set = new Set(shipments.map(s => s.shipment).filter(Boolean));
    return Array.from(set).sort();
  }, [shipments]);

  const guarantorOptions = useMemo(() => {
    const set = new Set(shipments.map(s => s.guarantor).filter(Boolean));
    return Array.from(set).sort();
  }, [shipments]);

  const codeOptions = useMemo(() => {
    const set = new Set(shipments.map(s => s.code).filter(Boolean));
    return Array.from(set).sort();
  }, [shipments]);

  const typeOptions = useMemo(() => {
    const set = new Set(shipments.map(s => s.type).filter(Boolean));
    return Array.from(set).sort();
  }, [shipments]);

  const cityOptions = useMemo(() => {
    const set = new Set(shipments.map(s => s.city).filter(Boolean));
    return Array.from(set).sort();
  }, [shipments]);

  // 6. Filtered Shipments Logic
  const filteredShipments = useMemo(() => {
    return shipments.filter(item => {
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
  }, [shipments, filters]);

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
    setModalShipments([item]);
    setIsBatchReceipt(false);
    setReceiptModalOpen(true);
  };

  const handlePrintSingleReceipt = (item: ShipmentRecord) => {
    setModalShipments([item]);
    setIsBatchReceipt(false);
    setReceiptModalOpen(true);
  };

  const handlePrintAllReceipts = () => {
    if (filteredShipments.length === 0) return;
    setModalShipments(filteredShipments);
    setIsBatchReceipt(true);
    setReceiptModalOpen(true);
  };

  const handleOpenEdit = (item: ShipmentRecord) => {
    setEditingShipment(item);
    setAddModalOpen(true);
  };

  const handleDeleteShipment = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا السجل نهائياً؟')) {
      setShipments(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleSaveShipment = (record: ShipmentRecord) => {
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

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-['Cairo'] flex flex-col selection:bg-amber-100 selection:text-amber-900">
      {/* 1. Top Navigation & Brand Header */}
      <Header
        activePage={activePage}
        setActivePage={setActivePage}
        isSidebarVisible={isSidebarVisible}
        onToggleSidebar={handleToggleSidebar}
      />

      {/* 2. Main Page Content (Full Width) */}
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

        {activePage === 'dashboard' && (
          <div className="flex flex-col lg:flex-row items-start gap-4 xl:gap-5 w-full">
            {/* Dedicated Sidebar for Filters & Print/Export Actions */}
            {isSidebarVisible && (
              <DashboardSidebar
                filters={filters}
                setFilters={setFilters}
                shipmentOptions={shipmentOptions}
                guarantorOptions={guarantorOptions}
                codeOptions={codeOptions}
                typeOptions={typeOptions}
                cityOptions={cityOptions}
                totalMatches={filteredShipments.length}
                totalAll={shipments.length}
                onPrintAllReceipts={handlePrintAllReceipts}
                onPrintYardInventory={() => setYardModalOpen(true)}
                onPrintFullReport={() => setFullReportModalOpen(true)}
                onExportExcel={() => exportShipmentsToExcel(filteredShipments, citySummaries, `تقرير_أطلس_الشحنة_${filters.shipment}`)}
                onExportYardExcel={() => exportYardInventoryToExcel(filteredShipments, filters.shipment)}
                onSyncDrive={handleDirectDriveSync}
                isSyncing={isDriveSyncing}
                receiptCount={filteredShipments.length}
                onCloseSidebar={() => {
                  setIsSidebarVisible(false);
                  try {
                    localStorage.setItem('atlas_sidebar_visible', 'false');
                  } catch (e) {
                    console.error(e);
                  }
                }}
              />
            )}

            {/* Main Center Area: Metric Cards -> City Summary Table -> Master Details Table */}
            <div className={`w-full ${isSidebarVisible ? 'flex-1 min-w-0' : 'w-full'} space-y-5`}>
              {/* If sidebar is hidden, show a prominent banner to restore or see current filter state */}
              {!isSidebarVisible && (
                <div className="bg-gradient-to-r from-slate-800 via-slate-800 to-slate-750 text-white rounded-2xl p-3.5 px-5 shadow-md flex flex-wrap items-center justify-between gap-3 border border-slate-700/60 transition-all">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex h-3 w-3 relative shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400"></span>
                    </span>
                    <div>
                      <div className="font-extrabold text-amber-300 text-sm font-['Cairo'] flex items-center gap-2">
                        <span>وضع التوسيع الكامل (100% Full Width)</span>
                        <span className="text-[11px] font-normal text-slate-300 hidden sm:inline">
                          — تم إخفاء الشريط الجانبي لتوفير أقصى اتساع للجداول
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        عدد السجلات المعروضة: <b className="text-white">{filteredShipments.length}</b> من أصل <b className="text-white">{shipments.length}</b>
                        {filters.shipment !== 'الكل' && <span className="text-amber-300 mr-2 font-bold">• شحنة: {filters.shipment}</span>}
                        {filters.city !== 'الكل' && <span className="text-blue-300 mr-2 font-bold">• محافظة: {filters.city}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleSidebar}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md shadow-amber-400/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <SlidersHorizontal className="w-4 h-4 stroke-[2.5]" />
                      <span>إظهار الشريط الجانبي (الفلاتر وأوامر الطباعة)</span>
                    </button>
                  </div>
                </div>
              )}
              {/* KPI Metric Cards */}
              <MetricCards
                clientCount={totalClients}
                packagesCount={totalPackages}
                cbmTotal={totalCbm}
                weightTotal={totalWeight}
                salesTotal={totalSales}
              />

              {/* City & Governorates Summary Table */}
              <CitySummaryTable summaries={citySummaries} />

              {/* Pristine Master Shipments Table */}
              <ShipmentTable
                shipments={filteredShipments}
                onViewReceipt={handleViewReceipt}
                onPrintReceipt={handlePrintSingleReceipt}
                onEditShipment={handleOpenEdit}
                onDeleteShipment={handleDeleteShipment}
              />
            </div>
          </div>
        )}

        {activePage === 'dispatch_approval' && (
          <DispatchApprovalView shipments={shipments} />
        )}

        {activePage === 'yard_inventory' && (
          <YardInventoryView 
            shipments={shipments} 
            onNavigateToDashboard={() => setActivePage('dashboard')}
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
  );
}

