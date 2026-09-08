import React from 'react';
import { Users, PackageCheck, Box, Scale, Coins } from 'lucide-react';

interface MetricCardsProps {
  clientCount: number;
  packagesCount: number;
  cbmTotal: number;
  weightTotal: number;
  salesTotal: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  clientCount,
  packagesCount,
  cbmTotal,
  weightTotal,
  salesTotal,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
      {/* 1. Clients */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100/70 border border-blue-200/80 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-blue-800">👥 عدد العملاء</span>
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-700">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <div className="text-2xl font-black text-blue-950 font-['Tajawal']">
            {clientCount.toLocaleString('ar-IQ')} <span className="text-sm font-semibold text-blue-700">عميل</span>
          </div>
          <p className="text-[11px] text-blue-600/90 mt-0.5">عملاء الشحنات المحددة</p>
        </div>
      </div>

      {/* 2. Packages */}
      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/70 border border-emerald-200/80 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-800">📦 إجمالي الطرود</span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700">
            <PackageCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <div className="text-2xl font-black text-emerald-950 font-['Tajawal']">
            {packagesCount.toLocaleString('ar-IQ')} <span className="text-sm font-semibold text-emerald-700">طرد</span>
          </div>
          <p className="text-[11px] text-emerald-600/90 mt-0.5">إجمالي الصناديق والطرود</p>
        </div>
      </div>

      {/* 3. CBM Volume */}
      <div className="bg-gradient-to-br from-purple-50 to-purple-100/70 border border-purple-200/80 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-purple-800">📐 إجمالي الحجم</span>
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-700">
            <Box className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <div className="text-2xl font-black text-purple-950 font-['Tajawal']">
            {cbmTotal.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-purple-700">CBM</span>
          </div>
          <p className="text-[11px] text-purple-600/90 mt-0.5">متر مكعب للحيز المشغول</p>
        </div>
      </div>

      {/* 4. Total Weight */}
      <div className="bg-gradient-to-br from-amber-50 to-amber-100/70 border border-amber-200/80 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-amber-900">⚖️ الوزن الكلي</span>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-800">
            <Scale className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <div className="text-2xl font-black text-amber-950 font-['Tajawal']">
            {weightTotal.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-xs font-bold text-amber-800">كغ</span>
          </div>
          <p className="text-[11px] text-amber-700/90 mt-0.5">الوزن الفعلي القائم</p>
        </div>
      </div>

      {/* 5. Total Debt / Sales */}
      <div className="bg-gradient-to-br from-rose-50 to-rose-100/70 border border-rose-200/80 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-rose-900">💰 المبلغ الإجمالي (الديون)</span>
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-700">
            <Coins className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <div className="text-2xl font-black text-rose-950 font-['Tajawal']">
            ${salesTotal.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-rose-700/90 mt-0.5">مجموع مبالغ الشحنات المستحقة</p>
        </div>
      </div>
    </div>
  );
};
