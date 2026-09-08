import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Package } from 'lucide-react';
import { ShipmentRecord } from '../types';

interface AddShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: ShipmentRecord) => void;
  editingRecord?: ShipmentRecord | null;
}

export const AddShipmentModal: React.FC<AddShipmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingRecord,
}) => {
  const [formData, setFormData] = useState<Partial<ShipmentRecord>>({
    shipment: 'RA6062',
    code: '',
    name: '',
    guarantor: '',
    weight: 10,
    cbm: 0.5,
    packages: 1,
    price: 3.0,
    sales: 30.0,
    phone: '',
    phone2: '',
    address: '',
    city: 'بغداد',
    type: 'جوي سريع',
    status: 'جاهز للتسليم',
    notes: '',
  });

  useEffect(() => {
    if (editingRecord) {
      setFormData(editingRecord);
    } else {
      setFormData({
        shipment: 'RA6062',
        code: `B${Math.floor(1000 + Math.random() * 9000)}`,
        name: '',
        guarantor: '',
        weight: 10,
        cbm: 0.5,
        packages: 1,
        price: 3.0,
        sales: 30.0,
        phone: '+964 ',
        phone2: '',
        address: '',
        city: 'بغداد',
        type: 'جوي سريع',
        status: 'جاهز للتسليم',
        notes: '',
      });
    }
  }, [editingRecord, isOpen]);

  // Recalculate sales automatically when weight or price changes
  const handleWeightChange = (val: number) => {
    const price = formData.price || 0;
    setFormData(prev => ({
      ...prev,
      weight: val,
      sales: Number((val * price).toFixed(2))
    }));
  };

  const handlePriceChange = (val: number) => {
    const weight = formData.weight || 0;
    setFormData(prev => ({
      ...prev,
      price: val,
      sales: Number((weight * val).toFixed(2))
    }));
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim() || !formData.code?.trim()) {
      alert('يرجى كتابة اسم العميل وكود العميل');
      return;
    }

    const record: ShipmentRecord = {
      id: editingRecord?.id || String(Date.now()),
      shipment: formData.shipment || 'RA6062',
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      guarantor: formData.guarantor?.trim() || '',
      weight: Number(formData.weight) || 0,
      cbm: Number(formData.cbm) || 0,
      packages: Math.max(1, Number(formData.packages) || 1),
      price: Number(formData.price) || 0,
      sales: Number(formData.sales) || 0,
      phone: formData.phone?.trim() || '+964 7800000000',
      phone2: formData.phone2?.trim() || '',
      address: formData.address?.trim() || '',
      city: formData.city?.trim() || 'بغداد',
      type: formData.type || 'جوي سريع',
      status: formData.status || 'جاهز للتسليم',
      notes: formData.notes || '',
    };

    onSave(record);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 no-print">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-800 text-white flex items-center justify-between border-b border-slate-700/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-['Cairo']">
                {editingRecord ? 'تعديل بيانات الشحنة' : 'إضافة شحنة وعميل جديد'}
              </h3>
              <p className="text-xs text-slate-400">
                تسجيل بيانات الطرد، الأسعار، العميل، ومعلومات الاستلام
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4 text-xs font-medium text-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Shipment */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">رقم الشحنة (Shipment #) *</label>
              <input
                type="text"
                required
                value={formData.shipment}
                onChange={(e) => setFormData(p => ({ ...p, shipment: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900 font-mono font-bold"
                placeholder="مثال: RA6062"
              />
            </div>

            {/* Code */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">كود العميل (Code) *</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900 font-mono font-bold"
                placeholder="مثال: B1020"
              />
            </div>

            {/* Client Name */}
            <div className="sm:col-span-2">
              <label className="block text-slate-800 font-bold mb-1">اسم العميل الكامل *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900 font-bold"
                placeholder="الاسم الرباعي أو اسم المكتب / المتجر"
              />
            </div>

            {/* Guarantor */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">الكفيل الضامن</label>
              <input
                type="text"
                value={formData.guarantor}
                onChange={(e) => setFormData(p => ({ ...p, guarantor: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900"
                placeholder="مثال: شركة النور أو اتركه فارغاً"
              />
            </div>

            {/* Shipment Type */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">نوع الشحنة</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(p => ({ ...p, type: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900"
              >
                <option value="جوي سريع">جوي سريع (Express Air)</option>
                <option value="بحري تجاري">بحري تجاري (Commercial Sea)</option>
                <option value="بري سريع">بري سريع (Land Freight)</option>
              </select>
            </div>

            {/* Weight */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">الوزن الإجمالي (كغ)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.weight}
                onChange={(e) => handleWeightChange(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900 font-mono font-bold"
              />
            </div>

            {/* Packages */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">عدد الطرود 📦</label>
              <input
                type="number"
                min="1"
                value={formData.packages}
                onChange={(e) => setFormData(p => ({ ...p, packages: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900 font-mono font-bold"
              />
            </div>

            {/* Volume CBM */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">حجم الشحنة (CBM)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.cbm}
                onChange={(e) => setFormData(p => ({ ...p, cbm: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900 font-mono"
              />
            </div>

            {/* Price per kg */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">السعر للكيلو ($)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.price}
                onChange={(e) => handlePriceChange(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900 font-mono font-bold"
              />
            </div>

            {/* Total Sales */}
            <div className="sm:col-span-2 bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center justify-between">
              <div>
                <label className="block text-amber-950 font-bold">إجمالي المبيعات المستحقة (الديون) $</label>
                <p className="text-[11px] text-amber-700">يُحسب تلقائياً (الوزن × سعر الكيلو) ويمكن تعديله يدوياً</p>
              </div>
              <div className="w-36">
                <input
                  type="number"
                  step="0.01"
                  value={formData.sales}
                  onChange={(e) => setFormData(p => ({ ...p, sales: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border-2 border-amber-400 bg-white rounded-lg text-amber-950 font-mono font-black text-sm text-left"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">رقم الهاتف الأول</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900 font-mono"
                placeholder="+964 7800000000"
                dir="ltr"
              />
            </div>

            {/* Phone 2 */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">رقم الهاتف الثاني (اختياري)</label>
              <input
                type="text"
                value={formData.phone2}
                onChange={(e) => setFormData(p => ({ ...p, phone2: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900 font-mono"
                placeholder="+964 7700000000"
                dir="ltr"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">المحافظة / المدينة</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900 font-semibold"
                placeholder="بغداد، البصرة، أربيل..."
              />
            </div>

            {/* Address */}
            <div className="sm:col-span-2">
              <label className="block text-slate-800 font-bold mb-1">عنوان استلام البضاعة التفصيلي</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData(p => ({ ...p, address: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900"
                placeholder="الشارع، المحلة، أقرب نقطة دالة أو اسم المتجر"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              إلغاء
            </button>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{editingRecord ? 'حفظ التعديلات' : 'إضافة السجل'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
