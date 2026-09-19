import React, { useEffect, useMemo, useState } from 'react';
import {
  Warehouse,
  Package,
  PackageCheck,
  Scale,
  Calendar,
  Truck,
  RotateCcw,
  Save,
  Printer,
  Check,
  CheckCheck,
  Search,
  Info,
} from 'lucide-react';
import { ShipmentRecord } from '../types';
import { YARD_INVENTORY_STORAGE_KEY, toLatinDigits, YardDraftData } from './YardInventoryView';

interface WarehouseInventoryProps {
  shipments: ShipmentRecord[];
  canTally?: boolean;
  canPrint?: boolean;
  allowedShipments?: string[];
}

export const WarehouseInventory: React.FC<WarehouseInventoryProps> = ({
  shipments,
  canTally = true,
  canPrint = true,
  allowedShipments = [],
}) => {
  const [selectedShipment, setSelectedShipment] = useState<string>('');
  const [inventoryDate, setInventoryDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [actualCounts, setActualCounts] = useState<Record<string, number | ''>>({});

  const shipmentOptions = useMemo<string[]>(() => {
    const unique: string[] = [];
    shipments.forEach(s => {
      const value = (s.shipment || '').trim();
      if (value && !unique.includes(value)) unique.push(value);
    });
    const sorted = unique.sort((a, b) => a.localeCompare(b, 'ar'));
    if (!allowedShipments.length) return sorted;
    return sorted.filter(v => allowedShipments.includes(v));
  }, [shipments, allowedShipments]);

  const shipmentItems = useMemo(() => {
    if (!selectedShipment) return [];
    const query = searchQuery.trim().toLowerCase();
    return shipments.filter(s => {
      if ((s.shipment || '').trim() !== selectedShipment) return false;
      if (!query) return true;
      return (
        (s.code || '').toLowerCase().includes(query) ||
        (s.name || '').toLowerCase().includes(query) ||
        (s.address || '').toLowerCase().includes(query) ||
        (s.city || '').toLowerCase().includes(query)
      );
    });
  }, [shipments, selectedShipment, searchQuery]);

  // Reset draft entries whenever the selected shipment changes
  useEffect(() => {
    setCheckedItems({});
    setActualCounts({});
    setSearchQuery('');
  }, [selectedShipment]);

  // Live KPI calculations (recomputed whenever items or counts change)
  const [stats, setStats] = useState({ sent: 0, audited: 0, result: 0, auditedItems: 0 });

  useEffect(() => {
    const sent = shipmentItems.reduce((sum, item) => sum + (Number(item.packages) || 0), 0);

    const audited = shipmentItems.reduce((sum, item) => {
      const value = actualCounts[item.id];
      return sum + (value !== undefined && value !== '' ? Number(value) : 0);
    }, 0);

    const auditedItems = shipmentItems.filter(
      item => checkedItems[item.id] || (actualCounts[item.id] !== undefined && actualCounts[item.id] !== '')
    ).length;

    setStats({ sent, audited, result: audited - sent, auditedItems });
  }, [shipmentItems, actualCounts, checkedItems]);

  const { sent: totalSent, audited: totalAudited, result, auditedItems: auditedItemsCount } = stats;

  const hasSelection = selectedShipment !== '';

  const handleActualCountChange = (id: string, raw: string) => {
    if (!canTally) return;
    const digits = toLatinDigits(raw).replace(/[^\d]/g, '');
    setActualCounts(prev => ({ ...prev, [id]: digits === '' ? '' : Number(digits) }));
  };

  const handleToggleCheck = (id: string) => {
    if (!canTally) return;
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleReset = () => {
    if (!canTally) return;
    setCheckedItems({});
    setActualCounts({});
  };

  // "مطابقة الشحنة بالكامل": fill every actual-tally field of the selected shipment
  // with the registered packages count so the tally matches exactly (result = 0).
  const handleMatchEntireShipment = () => {
    if (!canTally || !hasSelection) return;
    const scope = shipments.filter(s => (s.shipment || '').trim() === selectedShipment);

    setActualCounts(prev => {
      const updated = { ...prev };
      scope.forEach(item => {
        updated[item.id] = Number(item.packages) || 0;
      });
      return updated;
    });

    setCheckedItems(prev => {
      const updated = { ...prev };
      scope.forEach(item => {
        updated[item.id] = true;
      });
      return updated;
    });
  };

  const handleSave = () => {
    if (!canTally) return;
    try {
      localStorage.setItem(
        'atlas_warehouse_inventory_draft',
        JSON.stringify({
          shipment: selectedShipment,
          date: inventoryDate,
          checkedItems,
          actualCounts,
          savedAt: new Date().toISOString(),
        })
      );
    } catch (e) {
      console.error(e);
    }

    // Migrate every tallied item into the yard dispatch state so that it becomes
    // immediately available in "واجهة إخراج البضائع" (item-level, no full-shipment gate).
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      const existing: YardDraftData = raw
        ? JSON.parse(raw)
        : { lastSavedAt: '', checkedItems: {}, actualCounts: {}, itemNotes: {} };

      const mergedCounts: Record<string, number | ''> = { ...(existing.actualCounts || {}) };
      const mergedChecked: Record<string, boolean> = { ...(existing.checkedItems || {}) };

      (Object.entries(actualCounts) as [string, number | ''][]).forEach(([id, val]) => {
        if (val !== undefined && val !== '') {
          mergedCounts[id] = val;
          if (checkedItems[id]) mergedChecked[id] = true;
        }
      });

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toISOString().slice(0, 10);
      const fullTimeStr = `${dateStr} - ${timeStr}`;

      // The entry date is the day the physical tally is migrated to the yard.
      // Stamp each tallied item on its first migration (an item that already has
      // a recorded tally date keeps it).
      const mergedEntryDates: Record<string, string> = { ...(existing.entryDates || {}) };
      (Object.entries(actualCounts) as [string, number | ''][]).forEach(([id, val]) => {
        if (val !== undefined && val !== '' && !mergedEntryDates[id]) {
          mergedEntryDates[id] = dateStr;
        }
      });

      const draft: YardDraftData = {
        ...existing,
        lastSavedAt: fullTimeStr,
        checkedItems: mergedChecked,
        actualCounts: mergedCounts,
        entryDates: mergedEntryDates,
      };

      localStorage.setItem(YARD_INVENTORY_STORAGE_KEY, JSON.stringify(draft));

      const deviceId = localStorage.getItem('atlas_yard_device_id') || 'warehouse_device';
      const userName = localStorage.getItem('atlas_yard_user_name') || 'أمين المستودع (محمد)';

      fetch('/api/yard-inventory/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          userName,
          checkedItems: draft.checkedItems,
          actualCounts: draft.actualCounts,
          itemNotes: draft.itemNotes,
          dispatchedItems: draft.dispatchedItems,
          dispatchMovements: draft.dispatchMovements,
          entryDates: draft.entryDates,
          action: 'ترحيل الجرد الفعلي من واجهة جرد المستودعات',
        }),
      }).catch(() => {});
    } catch (e) {
      console.warn('Could not migrate warehouse tally into yard state', e);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const resultLabel = result === 0 ? 'مطابق تماماً' : result > 0 ? 'زيادة في الجرد' : 'نقص في الجرد';
  const resultTone =
    result === 0
      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : result > 0
      ? 'bg-sky-50 border-sky-200 text-sky-700'
      : 'bg-rose-50 border-rose-200 text-rose-700';

  return (
    <div className="w-full space-y-5" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-750 text-white rounded-2xl shadow-md border border-slate-700/60 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold font-['Cairo']">جرد المستودعات</h2>
            <p className="text-xs text-slate-300">
              جرد فعلي مستقل لطرود الشحنات مع احتساب النتيجة تلقائياً
            </p>
          </div>
        </div>
      </div>

      {/* Selection Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Truck className="w-4 h-4 text-amber-500" />
              <span>شحنة رقم</span>
            </label>
            <select
              value={selectedShipment}
              onChange={e => setSelectedShipment(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            >
              <option value="">-- اختر رقم الشحنة --</option>
              {shipmentOptions.map(shipment => (
                <option key={shipment} value={shipment}>
                  {shipment}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>تاريخ الجرد</span>
            </label>
            <input
              type="date"
              value={inventoryDate}
              onChange={e => setInventoryDate(e.target.value)}
              disabled={!hasSelection}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Search className="w-4 h-4 text-amber-500" />
              <span>بحث</span>
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              disabled={!hasSelection}
              placeholder="كود العميل أو الاسم أو العنوان"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>
        </div>

        {!hasSelection && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
            <Info className="w-4 h-4 shrink-0" />
            <span>يرجى اختيار رقم الشحنة أولاً لتفعيل الجرد والبطاقات والجدول.</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-3 gap-4 transition-all ${
          hasSelection ? '' : 'pointer-events-none opacity-50 select-none'
        }`}
        aria-disabled={!hasSelection}
      >
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">عدد الطرود المرسلة</p>
            <p className="text-2xl font-black text-slate-800 tabular-nums">{totalSent}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">عدد الطرود المجرودة</p>
            <p className="text-2xl font-black text-slate-800 tabular-nums">{totalAudited}</p>
          </div>
        </div>

        <div className={`rounded-2xl shadow-sm border p-4 flex items-center gap-4 ${resultTone}`}>
          <div className="w-12 h-12 rounded-xl bg-white/70 border border-current flex items-center justify-center">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold opacity-80">النتيجة (الفرق)</p>
            <p className="text-2xl font-black tabular-nums" dir="ltr">
              {result > 0 ? `+${result}` : result}
            </p>
            <p className="text-[11px] font-bold opacity-80">{resultLabel}</p>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div
        className={`bg-white rounded-2xl shadow-md border border-slate-200/90 overflow-hidden transition-all ${
          hasSelection ? '' : 'pointer-events-none opacity-50 select-none'
        }`}
        aria-disabled={!hasSelection}
      >
        <div className="px-5 py-4 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold font-['Cairo']">جدول الجرد الفعلي</h3>
              <p className="text-xs text-slate-300">
                {hasSelection
                  ? `الشحنة ${selectedShipment} — ${auditedItemsCount} من ${shipmentItems.length} بند تم جرده`
                  : 'بانتظار اختيار الشحنة'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canTally && (
            <button
              onClick={handleMatchEntireShipment}
              disabled={!hasSelection}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-500/40 bg-slate-800 hover:bg-slate-700 text-amber-300 transition-all active:scale-95 disabled:opacity-50"
              title="مطابقة الجرد الفعلي لجميع الزبائن مع عدد الطرود المقيد"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>مطابقة الشحنة بالكامل</span>
            </button>
            )}

            {canTally && (
            <button
              onClick={handleSave}
              disabled={!hasSelection}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-500/40 bg-slate-800 hover:bg-slate-700 text-amber-300 transition-all active:scale-95 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ</span>
            </button>
            )}

            {canPrint && (
            <button
              onClick={handlePrint}
              disabled={!hasSelection}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-500/40 bg-slate-800 hover:bg-slate-700 text-amber-300 transition-all active:scale-95 disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة</span>
            </button>
            )}

            {canTally && (
            <button
              onClick={handleReset}
              disabled={!hasSelection}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-500/40 bg-slate-800 hover:bg-slate-700 text-amber-300 transition-all active:scale-95 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تصفير الجرد</span>
            </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-3 text-center text-xs font-extrabold w-14">#</th>
                <th className="px-3 py-3 text-center text-xs font-extrabold w-20">تحقق</th>
                <th className="px-3 py-3 text-right text-xs font-extrabold w-36">كود العميل</th>
                <th className="px-3 py-3 text-right text-xs font-extrabold">العميل والعنوان</th>
                <th className="px-3 py-3 text-center text-xs font-extrabold w-36">عدد الطرود المقيد</th>
                <th className="px-3 py-3 text-center text-xs font-extrabold w-44">الجرد الفعلي بالساحة</th>
              </tr>
            </thead>
            <tbody>
              {shipmentItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                    {hasSelection ? 'لا توجد بنود مطابقة' : 'اختر رقم الشحنة لعرض البنود'}
                  </td>
                </tr>
              ) : (
                shipmentItems.map((item, index) => {
                  const isChecked = !!checkedItems[item.id];
                  const actual = actualCounts[item.id];
                  const hasActual = actual !== undefined && actual !== '';
                  const isMismatch = hasActual && Number(actual) !== item.packages;

                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-slate-100 transition-colors ${
                        isMismatch ? 'bg-rose-50/70' : isChecked ? 'bg-emerald-50/60' : 'bg-white'
                      } hover:bg-slate-50`}
                    >
                      <td className="px-3 py-3 text-center font-bold text-slate-500 tabular-nums">
                        {index + 1}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleCheck(item.id)}
                          disabled={!canTally}
                          className={`mx-auto flex h-6 w-6 items-center justify-center rounded-md border transition-all ${
                            isChecked
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : 'border-slate-300 bg-white text-transparent hover:border-emerald-400'
                          }`}
                          title={isChecked ? 'إلغاء التحقق' : 'تأكيد التحقق'}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-amber-700">
                        {item.code}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="text-xs text-slate-500">
                          {item.address || '—'}
                          {item.city ? ` — ${item.city}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-slate-800 tabular-nums">
                        {item.packages}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={actual}
                          onChange={e => handleActualCountChange(item.id, e.target.value)}
                          disabled={!canTally}
                          placeholder={String(item.packages)}
                          className={`w-24 rounded-lg border px-2 py-1.5 text-center font-bold tabular-nums outline-none transition-all focus:ring-2 ${
                            isMismatch
                              ? 'border-rose-300 bg-rose-50 text-rose-700 focus:border-rose-500 focus:ring-rose-200'
                              : 'border-slate-300 bg-white text-slate-800 focus:border-amber-500 focus:ring-amber-200'
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WarehouseInventory;
