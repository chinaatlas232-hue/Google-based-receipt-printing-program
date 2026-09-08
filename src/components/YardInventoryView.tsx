import React, { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardList, 
  Printer, 
  FileSpreadsheet, 
  Search, 
  Check, 
  Warehouse,
  CheckCircle2,
  Save,
  RotateCcw,
  CheckCheck,
  AlertTriangle,
  ArrowRight,
  Clock,
  Sparkles,
  Filter,
  X,
  MessageSquare,
  Eye,
  CheckSquare
} from 'lucide-react';
import { ShipmentRecord } from '../types';
import { COMPANY_INFO } from '../data/initialData';
import { exportYardInventoryToExcel } from '../utils/excel';

export const YARD_INVENTORY_STORAGE_KEY = 'ocean_atlas_yard_inventory_draft_v2';

export interface YardDraftData {
  lastSavedAt: string;
  checkedItems: Record<string, boolean>;
  actualCounts: Record<string, number | ''>;
  itemNotes: Record<string, string>;
}

interface YardInventoryViewProps {
  shipments: ShipmentRecord[];
  onNavigateToDashboard?: () => void;
}

export const YardInventoryView: React.FC<YardInventoryViewProps> = ({ 
  shipments, 
  onNavigateToDashboard 
}) => {
  const availableShipments = useMemo(() => {
    const list = Array.from(new Set(shipments.map(s => s.shipment)));
    return list.sort();
  }, [shipments]);

  const [selectedShipment, setSelectedShipment] = useState<string>(availableShipments[0] || 'الكل');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'audited' | 'pending' | 'mismatch'>('all');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  // 1. Load Draft from localStorage on initialization
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as YardDraftData;
        return parsed.checkedItems || {};
      }
    } catch (e) {
      console.warn('Failed to parse saved yard draft', e);
    }
    return {};
  });

  const [actualCounts, setActualCounts] = useState<Record<string, number | ''>>(() => {
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as YardDraftData;
        return parsed.actualCounts || {};
      }
    } catch (e) {
      console.warn('Failed to parse saved yard draft counts', e);
    }
    return {};
  });

  const [itemNotes, setItemNotes] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as YardDraftData;
        return parsed.itemNotes || {};
      }
    } catch (e) {
      console.warn('Failed to parse saved yard draft notes', e);
    }
    return {};
  });

  const [lastSavedTime, setLastSavedTime] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as YardDraftData;
        return parsed.lastSavedAt || null;
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 2. Automatic background synchronization to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = now.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'numeric', day: 'numeric' });
        const fullTimeStr = `${dateStr} - ${timeStr}`;

        const draft: YardDraftData = {
          lastSavedAt: fullTimeStr,
          checkedItems,
          actualCounts,
          itemNotes
        };
        localStorage.setItem(YARD_INVENTORY_STORAGE_KEY, JSON.stringify(draft));
        setLastSavedTime(fullTimeStr);
      } catch (err) {
        console.error('Error saving yard draft to localStorage', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [checkedItems, actualCounts, itemNotes]);

  // Flash toast auto-dismiss
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // 3. Computed items
  const baseItems = useMemo(() => {
    return shipments.filter(s => {
      const matchShip = selectedShipment === 'الكل' || s.shipment === selectedShipment;
      const matchSearch = searchQuery.trim() === '' ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.address && s.address.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchShip && matchSearch;
    });
  }, [shipments, selectedShipment, searchQuery]);

  // Statistics for current selection
  const totalItemsCount = baseItems.length;
  const auditedItemsCount = useMemo(() => {
    return baseItems.filter(s => !!checkedItems[s.id] || (actualCounts[s.id] !== undefined && actualCounts[s.id] !== '')).length;
  }, [baseItems, checkedItems, actualCounts]);

  const pendingItemsCount = totalItemsCount - auditedItemsCount;

  const mismatchItemsCount = useMemo(() => {
    return baseItems.filter(s => {
      const act = actualCounts[s.id];
      return act !== undefined && act !== '' && Number(act) !== s.packages;
    }).length;
  }, [baseItems, actualCounts]);

  const filteredItems = useMemo(() => {
    return baseItems.filter(item => {
      const isChecked = !!checkedItems[item.id];
      const act = actualCounts[item.id];
      const hasActual = act !== undefined && act !== '';
      const isAudited = isChecked || hasActual;
      const isMismatch = hasActual && Number(act) !== item.packages;

      if (filterStatus === 'audited') return isAudited;
      if (filterStatus === 'pending') return !isAudited;
      if (filterStatus === 'mismatch') return isMismatch;
      return true;
    });
  }, [baseItems, filterStatus, checkedItems, actualCounts]);

  const totalExpectedPackages = baseItems.reduce((sum, s) => sum + s.packages, 0);
  const totalActualPackages = baseItems.reduce((sum, s) => {
    const act = actualCounts[s.id];
    return sum + (act !== undefined && act !== '' ? Number(act) : s.packages);
  }, 0);

  const progressPercentage = totalItemsCount > 0 
    ? Math.round((auditedItemsCount / totalItemsCount) * 100) 
    : 0;

  const todayStr = new Date().toLocaleDateString('ar-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Explicit Save & Return Later Handler
  const handleSaveAndReturnLater = () => {
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'numeric', day: 'numeric' });
      const fullTimeStr = `${dateStr} - ${timeStr}`;

      const draft: YardDraftData = {
        lastSavedAt: fullTimeStr,
        checkedItems,
        actualCounts,
        itemNotes
      };
      localStorage.setItem(YARD_INVENTORY_STORAGE_KEY, JSON.stringify(draft));
      setLastSavedTime(fullTimeStr);
      setSaveModalOpen(true);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء الحفظ في ذاكرة المتصفح');
    }
  };

  // Mark all visible items as matching
  const handleMarkAllVisibleMatching = () => {
    const updatedChecks = { ...checkedItems };
    const updatedCounts = { ...actualCounts };
    filteredItems.forEach(item => {
      updatedChecks[item.id] = true;
      updatedCounts[item.id] = item.packages;
    });
    setCheckedItems(updatedChecks);
    setActualCounts(updatedCounts);
    setToastMessage(`تم ضبط (${filteredItems.length}) بند مطابقاً للطرود المقيدة.`);
  };

  // Reset inventory for current view
  const handleConfirmReset = () => {
    const updatedChecks = { ...checkedItems };
    const updatedCounts = { ...actualCounts };
    const updatedNotes = { ...itemNotes };

    baseItems.forEach(item => {
      delete updatedChecks[item.id];
      delete updatedCounts[item.id];
      delete updatedNotes[item.id];
    });

    setCheckedItems(updatedChecks);
    setActualCounts(updatedCounts);
    setItemNotes(updatedNotes);
    setResetConfirmOpen(false);
    setToastMessage(`تمت إعادة ضبط مسودة الجرد للشحنة [${selectedShipment}] بنجاح.`);
  };

  // Print Handler
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'height=900,width=800');
    if (!printWindow) {
      window.print();
      return;
    }

    const tableRows = filteredItems.map((item, idx) => {
      const act = actualCounts[item.id];
      const hasActual = act !== undefined && act !== '';
      const isChecked = !!checkedItems[item.id];
      const note = itemNotes[item.id] || '';
      const displayActual = hasActual ? act : item.packages;
      const isMismatch = hasActual && Number(act) !== item.packages;

      return `
        <tr style="${isMismatch ? 'background-color: #fff1f2;' : (isChecked ? 'background-color: #f0fdf4;' : '')}">
          <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
          <td style="font-weight: bold; font-family: monospace;">${item.code}</td>
          <td>
            <b>${item.name}</b>
            <div style="font-size: 10px; color: #475569;">${item.address || item.city}</div>
            ${note ? `<div style="font-size: 9.5px; color: #991b1b; margin-top: 2px;">ملاحظة: ${note}</div>` : ''}
          </td>
          <td style="text-align: center; font-weight: bold;">${item.packages}</td>
          <td style="text-align: center; font-weight: bold; font-family: monospace; ${isMismatch ? 'color: #dc2626;' : 'color: #166534;'}">
            ${displayActual}
          </td>
          <td style="text-align: center; font-size: 10px; font-weight: bold;">
            ${isMismatch ? `<span style="color: #b91c1c;">فرق (${Number(displayActual) - item.packages})</span>` : (isChecked ? '<span style="color: #15803d;">مطابق ومفحوص</span>' : '<span style="color: #64748b;">مسودة</span>')}
          </td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>ورقة جرد الساحة والمستودع - ${COMPANY_INFO.shortNameAr}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Cairo', Tahoma, Arial, sans-serif; direction: rtl; color: #0f172a; padding: 10px; margin: 0; }
          .header-box { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
          h2 { margin: 0; font-size: 18px; color: #0f172a; }
          p { margin: 3px 0 0; font-size: 11px; color: #64748b; }
          .info-bar { font-size: 12px; font-weight: bold; margin-bottom: 12px; background: #f1f5f9; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 5px; }
          th, td { padding: 6px 8px; border: 1px solid #94a3b8; text-align: right; }
          th { background-color: #1e293b !important; color: #ffffff !important; font-weight: bold; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .footer { margin-top: 35px; display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h2>${COMPANY_INFO.nameAr}</h2>
          <p>نموذج ومحضر جرد الساحة والمستودع الفعلي (A4) - ${lastSavedTime ? `آخر حفظ: ${lastSavedTime}` : ''}</p>
        </div>
        <div class="info-bar">
          <div>الشحنة: <b>${selectedShipment}</b></div>
          <div>تاريخ الجرد: <b>${todayStr}</b></div>
          <div>الطرود المقيدة: <b>${totalExpectedPackages} طرد</b></div>
          <div>الطرود المحصورة فعلياً: <b>${totalActualPackages} طرد</b></div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 6%; text-align: center;">#</th>
              <th style="width: 14%;">كود العميل</th>
              <th style="width: 44%;">العميل والعنوان وملاحظات الساحة</th>
              <th style="width: 12%; text-align: center;">الطرود المقيدة</th>
              <th style="width: 12%; text-align: center;">الجرد الفعلي</th>
              <th style="width: 12%; text-align: center;">حالة المطابقة</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <div class="footer">
          <div>اسم مسؤول الساحة / أمين المستودع: ........................................</div>
          <div>التوقيع والختم: ........................................</div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 600);
  };

  return (
    <div className="space-y-5 font-['Cairo']">
      {/* Toast notification */}
      {toastMessage && (
        <div className="p-3 bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:bg-emerald-800 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner & Main Action Strip */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-600 border border-amber-500/30 flex items-center justify-center font-bold shrink-0">
              <Warehouse className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 font-['Cairo']">
                  شيت جرد الساحة والمستودع (Yard Inventory & Tally)
                </h2>
                <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  حفظ تلقائي للمتصفح مفعّل
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                تدقيق ومطابقة عدد الطرود الفعلية في الساحة لكل عميل، مع الحفظ المؤقت التلقائي واستعراض النتائج دون ضياع
              </p>
            </div>
          </div>

          {/* Core Action Buttons with Prominent "حفظ مؤقت والعودة لاحقاً" */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start xl:justify-end">
            {/* Primary Action Button */}
            <button
              onClick={handleSaveAndReturnLater}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 active:scale-95 transition-all cursor-pointer"
              title="حفظ كافة البيانات المدخلة الآن في ذاكرة المتصفح للعودة إليها ومراجعتها في أي وقت"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>حفظ مؤقت والعودة لاحقاً</span>
            </button>

            {/* Print A4 Sheet */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 stroke-[2.2]" />
              <span>طباعة ورقة الجرد (A4)</span>
            </button>

            {/* Export Excel with Actual Counts & Notes */}
            <button
              onClick={() => exportYardInventoryToExcel(filteredItems, selectedShipment, actualCounts, checkedItems, itemNotes)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              title="تصدير شيت الجرد مع الأرقام الفعلية والمطابقات وملاحظات الساحة إلى ملف إكسل"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>تصدير إكسل</span>
            </button>

            {/* Reset Draft */}
            <button
              onClick={() => setResetConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-300 font-semibold text-xs transition-colors cursor-pointer"
              title="إعادة ضبط المسودة وتفريغ الإدخالات لهذه الشحنة"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تفريغ المسودة</span>
            </button>
          </div>
        </div>

        {/* Audit Progress & Storage Status Bar */}
        <div className="mt-4 bg-slate-50 border border-slate-200/90 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-700">نسبة إنجاز الجرد:</span>
            <div className="w-36 sm:w-48 bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  progressPercentage === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-emerald-500'
                }`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="font-mono font-extrabold text-slate-900">{progressPercentage}%</span>
            <span className="text-slate-500 text-[11px]">
              ({auditedItemsCount} من أصل {totalItemsCount} بند تم جردها)
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {lastSavedTime ? (
                <>آخر حفظ مؤقت مسجل: <b className="text-slate-900 font-mono">{lastSavedTime}</b></>
              ) : (
                'المتصفح جاهز للحفظ المؤقت'
              )}
            </span>
          </div>
        </div>

        {/* Filters & KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4 items-center">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              الشحنة المراد جردها:
            </label>
            <select
              value={selectedShipment}
              onChange={(e) => setSelectedShipment(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-slate-900 shadow-xs"
            >
              <option value="الكل">كافة الشحنات ({shipments.length} بند)</option>
              {availableShipments.map(s => (
                <option key={s} value={s}>شحنة رقم: {s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              بحث سريع بالاسم، الكود، المحافظة أو العنوان:
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث بالاسم، الكود، المحافظة، العنوان..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-medium shadow-xs"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200/90 rounded-xl p-2.5 text-xs shadow-xs">
            <span className="text-emerald-800 block text-[10px] font-bold">إجمالي الطرود المقيدة</span>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-emerald-950 text-base font-black font-mono">📦 {totalExpectedPackages} طرد</span>
              <span className="text-[10px] text-emerald-700 font-bold">لـ {totalItemsCount} عميل</span>
            </div>
          </div>

          <div className={`rounded-xl p-2.5 text-xs border shadow-xs ${
            mismatchItemsCount > 0 
              ? 'bg-rose-50 border-rose-200' 
              : 'bg-indigo-50 border-indigo-200'
          }`}>
            <span className={`block text-[10px] font-bold ${mismatchItemsCount > 0 ? 'text-rose-800' : 'text-indigo-800'}`}>
              إجمالي الطرود المدخلة فعلياً
            </span>
            <div className="flex items-center justify-between mt-0.5">
              <span className={`text-base font-black font-mono ${mismatchItemsCount > 0 ? 'text-rose-950' : 'text-indigo-950'}`}>
                📦 {totalActualPackages} طرد
              </span>
              {mismatchItemsCount > 0 ? (
                <span className="text-[10px] bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded font-bold">
                  {mismatchItemsCount} فروقات
                </span>
              ) : (
                <span className="text-[10px] bg-indigo-200 text-indigo-900 px-1.5 py-0.5 rounded font-bold">
                  مطابق تماماً
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab Filter Pills for Reviewing Results: All / Audited / Pending / Mismatch */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <button
              onClick={() => setFilterStatus('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterStatus === 'all'
                  ? 'bg-slate-800 text-white shadow-xs font-extrabold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>كافة البنود</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                filterStatus === 'all' ? 'bg-slate-700 text-amber-300' : 'bg-slate-200 text-slate-700'
              }`}>
                {totalItemsCount}
              </span>
            </button>

            <button
              onClick={() => setFilterStatus('audited')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterStatus === 'audited'
                  ? 'bg-emerald-700 text-white shadow-xs font-extrabold'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تم جردها وتدقيقها</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                filterStatus === 'audited' ? 'bg-emerald-800 text-white' : 'bg-emerald-200 text-emerald-900 font-bold'
              }`}>
                {auditedItemsCount}
              </span>
            </button>

            <button
              onClick={() => setFilterStatus('pending')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterStatus === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs font-extrabold'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>قيد الانتظار لم تُجرد</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                filterStatus === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900 font-bold'
              }`}>
                {pendingItemsCount}
              </span>
            </button>

            <button
              onClick={() => setFilterStatus('mismatch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterStatus === 'mismatch'
                  ? 'bg-rose-700 text-white shadow-xs font-extrabold'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>يوجد فرق في الطرود</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                filterStatus === 'mismatch' ? 'bg-rose-800 text-white' : 'bg-rose-200 text-rose-900 font-bold'
              }`}>
                {mismatchItemsCount}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllVisibleMatching}
              className="flex items-center gap-1.5 text-xs text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
              title="اعتماد عدد الطرود المقيدة كجرد فعلي لكافة البنود الظاهرة حالياً"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>مطابقة كافة المعروض</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Yard Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold font-['Cairo']">
              جدول طرود الساحة - الشحنة: [{selectedShipment}]
            </h3>
            <span className="text-xs bg-slate-700/80 text-amber-400 px-2 py-0.5 rounded font-mono font-bold">
              المعروض: {filteredItems.length} عميل
            </span>
            {filterStatus !== 'all' && (
              <span className="text-[11px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold">
                فلتر مفعّل: {filterStatus === 'audited' ? 'المجرودة' : filterStatus === 'pending' ? 'قيد الانتظار' : 'فروقات'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-300 hidden sm:inline">
              💾 يتم حفظ التعديلات في المتصفح تلقائياً عند إدخال أي رقم أو ملاحظة
            </span>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar max-h-[550px]">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-800 text-white font-bold z-10">
              <tr>
                <th className="py-3 px-3 text-center w-12">#</th>
                <th className="py-3 px-3 text-center w-14">تدقيق</th>
                <th className="py-3 px-3 w-24">الكود</th>
                <th className="py-3 px-3">اسم العميل</th>
                <th className="py-3 px-3 min-w-[180px]">العنوان والمحافظة</th>
                <th className="py-3 px-3 text-center w-28">الطرود المقيدة</th>
                <th className="py-3 px-3 text-center w-48">الجرد الفعلي في الساحة</th>
                <th className="py-3 px-3 text-center w-28">حالة المطابقة</th>
                <th className="py-3 px-3 text-center w-36">ملاحظات الساحة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto text-center">
                      <p className="text-sm font-bold text-slate-600 mb-1">لا توجد بنود مطابقة للفلتر المحدد</p>
                      <p className="text-xs text-slate-400">يرجى تعديل الفلتر أو اختيار "كافة البنود" للمراجعة</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const isChecked = !!checkedItems[item.id];
                  const actual = actualCounts[item.id];
                  const hasActual = actual !== undefined && actual !== '';
                  const hasMismatch = hasActual && Number(actual) !== item.packages;
                  const note = itemNotes[item.id] || '';
                  const isNotesOpen = !!expandedNotes[item.id];

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        hasMismatch 
                          ? 'bg-rose-50/40' 
                          : isChecked 
                          ? 'bg-emerald-50/35' 
                          : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center text-slate-400 font-bold">
                        {idx + 1}
                      </td>

                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setCheckedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                            if (!hasActual && !isChecked) {
                              setActualCounts(prev => ({ ...prev, [item.id]: item.packages }));
                            }
                          }}
                          className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                              : 'border-slate-300 hover:border-amber-500 bg-white'
                          }`}
                          title={isChecked ? 'تم تدقيق هذا البند بنجاح' : 'اضغط لتأكيد تدقيق وجرد هذا البند'}
                        >
                          {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                        </button>
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-amber-700">
                        {item.code}
                      </td>

                      <td className="py-3 px-3 font-bold text-slate-900">
                        {item.name}
                      </td>

                      <td className="py-3 px-3 text-slate-600">
                        <div className="font-medium text-slate-800 whitespace-normal break-words max-w-[240px]">
                          {item.address || item.city}
                        </div>
                        <div className="text-[11px] text-indigo-900 font-bold mt-0.5">
                          📍 {item.city}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-slate-900 font-mono text-sm">
                        📦 {item.packages}
                      </td>

                      {/* Actual Input with Quick Matching Button */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            placeholder={String(item.packages)}
                            value={hasActual ? actual : ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setActualCounts(prev => ({ ...prev, [item.id]: val }));
                              if (!isChecked && val !== '') {
                                setCheckedItems(prev => ({ ...prev, [item.id]: true }));
                              }
                            }}
                            className={`w-20 px-2 py-1 text-center font-mono font-bold text-xs border rounded-lg focus:ring-2 focus:ring-amber-500 transition-all ${
                              hasMismatch
                                ? 'border-rose-400 bg-rose-50 text-rose-800 ring-1 ring-rose-300'
                                : hasActual
                                ? 'border-emerald-300 bg-emerald-50/50 text-emerald-900'
                                : 'border-slate-300 bg-white'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setActualCounts(prev => ({ ...prev, [item.id]: item.packages }));
                              setCheckedItems(prev => ({ ...prev, [item.id]: true }));
                            }}
                            className="px-1.5 py-1 text-[10px] bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 border border-slate-200 rounded font-bold transition-all cursor-pointer whitespace-nowrap"
                            title="ضبط الجرد الفعلي مطابقاً للطرود المقيدة"
                          >
                            مطابق
                          </button>
                        </div>
                      </td>

                      {/* Match Status Badge */}
                      <td className="py-3 px-3 text-center">
                        {hasMismatch ? (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200 whitespace-nowrap">
                            فرق ({Number(actual) - item.packages > 0 ? `+${Number(actual) - item.packages}` : Number(actual) - item.packages})
                          </span>
                        ) : isChecked ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap">
                            مطابق ومفحوص
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 whitespace-nowrap">
                            بانتظار الجرد
                          </span>
                        )}
                      </td>

                      {/* Notes Column */}
                      <td className="py-3 px-3 text-center">
                        {isNotesOpen || note ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="ملاحظة الساحة..."
                              value={note}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItemNotes(prev => ({ ...prev, [item.id]: val }));
                              }}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 font-medium"
                            />
                            {note && (
                              <button
                                type="button"
                                onClick={() => setItemNotes(prev => ({ ...prev, [item.id]: '' }))}
                                className="text-slate-400 hover:text-rose-600 p-0.5"
                                title="مسح الملاحظة"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpandedNotes(prev => ({ ...prev, [item.id]: true }))}
                            className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1 mx-auto hover:underline"
                          >
                            <MessageSquare className="w-3 h-3 text-slate-400" />
                            <span>إضافة ملاحظة</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modal: Confirm Save & Return Later Dialog */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fade-in p-6 text-right font-['Cairo']">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 text-center mb-1">
              تم الحفظ المؤقت بنجاح في المتصفح
            </h3>
            
            <p className="text-xs text-slate-600 text-center leading-relaxed mb-4">
              تم حفظ كافة أرقام الجرد الفعلي، حالات التدقيق، والملاحظات المدخلة لـ <b className="text-slate-900">({auditedItemsCount})</b> بند تلقائياً في ذاكرة هذا المتصفح. يمكنك مغادرة البرنامج أو إغلاق الصفحة بأمان وستجد بياناتك محفوظة بدقة عند العودة في أي وقت.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs mb-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">الشحنة المفحوصة:</span>
                <span className="font-bold text-slate-900">{selectedShipment}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">توقيت الحفظ المسجل:</span>
                <span className="font-mono font-bold text-slate-900">{lastSavedTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">إجمالي الطرود المحصورة:</span>
                <span className="font-bold text-emerald-800 font-mono">{totalActualPackages} طرد</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              {onNavigateToDashboard && (
                <button
                  onClick={() => {
                    setSaveModalOpen(false);
                    onNavigateToDashboard();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>العودة للوحة التحكم الرئيسية</span>
                </button>
              )}

              <button
                onClick={() => setSaveModalOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 transition-all cursor-pointer"
              >
                <span>البقاء والاستمرار في الجرد</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: Confirm Reset Draft */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 text-right font-['Cairo']">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4 border border-rose-200">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 text-center mb-1">
              تأكيد إعادة ضبط مسودة الجرد
            </h3>
            
            <p className="text-xs text-slate-600 text-center leading-relaxed mb-5">
              هل أنت متأكد من رغبتك في تفريغ كافة الأرقام الفعلية وعلامات التدقيق المسجلة لشحنة <b className="text-slate-900">[{selectedShipment}]</b>؟ لا يمكن التراجع عن هذه الخطوة.
            </p>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleConfirmReset}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                نعم، تفريغ المسودة
              </button>
              <button
                onClick={() => setResetConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
