import React from 'react';
import { Ship } from 'lucide-react';

export const ContainerRadar: React.FC = () => {
  return (
    <div className="w-full" dir="rtl">
      <div className="bg-slate-800 text-white rounded-2xl shadow-md border border-slate-700/60 px-5 py-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
          <Ship className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-extrabold font-['Cairo']">رادار تتبع الحاويات</h2>
      </div>
    </div>
  );
};
