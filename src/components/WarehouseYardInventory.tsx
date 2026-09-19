import React, { useMemo, useState } from 'react';
import { Warehouse, Search, Hash, MapPin } from 'lucide-react';

type StoragePlace = 'all' | 'warehouse' | 'yard';

interface InventoryRow {
  id: number;
  shipment: string;
  clientCode: string;
  location: 'المستودع' | 'الساحة';
  entryDate: string;
  parcels: number;
}

const MOCK_ROWS: InventoryRow[] = [];

export const WarehouseYardInventory: React.FC = () => {
  const [shipment, setShipment] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [place, setPlace] = useState<StoragePlace>('all');

  const filtered = useMemo(() => {
    return MOCK_ROWS.filter((row) => {
      const matchShipment = !shipment.trim() || row.shipment.toLowerCase().includes(shipment.trim().toLowerCase());
      const matchCode = !clientCode.trim() || row.clientCode.toLowerCase().includes(clientCode.trim().toLowerCase());
      const matchPlace =
        place === 'all' ||
        (place === 'warehouse' && row.location === 'المستودع') ||
        (place === 'yard' && row.location === 'الساحة');
      return matchShipment && matchCode && matchPlace;
    });
  }, [shipment, clientCode, place]);

  const warehouseParcels = MOCK_ROWS.filter((row) => row.location === 'المستودع').reduce((sum, row) => sum + row.parcels, 0);
  const yardParcels = MOCK_ROWS.filter((row) => row.location === 'الساحة').reduce((sum, row) => sum + row.parcels, 0);

  return (
    <div className="w-full space-y-5" dir="rtl">
      <div className="bg-gradient-to-r from-slate-800 to-slate-750 text-white rounded-2xl shadow-md border border-slate-700/60 px-5 py-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
          <Warehouse className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold font-['Cairo']">جرد المستودع والساحة</h2>
          <p className="text-xs text-slate-300">عرض الطرود حسب مكان التخزين الحالي</p>
        </div>
      </div>

      <form
        onSubmit={(e) => e.preventDefault()}
        className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-3"
      >
        <div>
          <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
            <Search className="w-3.5 h-3.5 text-amber-500" />
            رقم الشحنة
          </label>
          <input
            value={shipment}
            onChange={(e) => setShipment(e.target.value)}
            placeholder="RA6062 / RQ6042"
            className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
            <Hash className="w-3.5 h-3.5 text-blue-500" />
            كود العميل
          </label>
          <input
            value={clientCode}
            onChange={(e) => setClientCode(e.target.value)}
            placeholder="مثال: B1020"
            className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
            مكان التخزين
          </label>
          <select
            value={place}
            onChange={(e) => setPlace(e.target.value as StoragePlace)}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#121212] px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          >
            <option value="all">الكل</option>
            <option value="warehouse">المستودع</option>
            <option value="yard">الساحة</option>
          </select>
        </div>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-800 p-4">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-300">إجمالي الطرود في المستودع</p>
          <p className="text-2xl font-black text-blue-800 dark:text-blue-200 mt-1 tabular-nums">{warehouseParcels}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-4">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">إجمالي الطرود في الساحة</p>
          <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200 mt-1 tabular-nums">{yardParcels}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-800 text-white flex items-center justify-between">
          <h3 className="text-sm font-extrabold">سجلات الجرد</h3>
          <span className="text-[11px] text-slate-300 font-bold">{filtered.length} سجل</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs">
              <tr>
                <th className="px-4 py-3 font-extrabold">التسلسل</th>
                <th className="px-4 py-3 font-extrabold">رقم الشحنة</th>
                <th className="px-4 py-3 font-extrabold">كود العميل</th>
                <th className="px-4 py-3 font-extrabold">الموقع الحالي</th>
                <th className="px-4 py-3 font-extrabold">تاريخ الدخول</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
                >
                  <td className="px-4 py-3 font-bold text-slate-500">{row.id}</td>
                  <td className="px-4 py-3 font-black text-slate-800 dark:text-slate-100">{row.shipment}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{row.clientCode}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${
                        row.location === 'المستودع'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                      }`}
                    >
                      {row.location}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {row.entryDate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
