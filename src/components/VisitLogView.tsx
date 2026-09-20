import React, { useState } from 'react';
import { NotebookPen, Users, UserRoundSearch } from 'lucide-react';

type VisitSheetTab = 'user_visits' | 'coded_customer_visits';

export const VisitLogView: React.FC = () => {
  const [activeSheet, setActiveSheet] = useState<VisitSheetTab>('user_visits');

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center shrink-0">
            <NotebookPen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">سجل الزيارات</h2>
            <p className="text-xs font-bold text-slate-500 mt-1">
              اختر أحد القسمين أدناه. تفاصيل البيانات والجداول ستُضاف لاحقاً.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveSheet('user_visits')}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-extrabold transition-all ${
            activeSheet === 'user_visits'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-white dark:bg-[#1e1e1e] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          زيارات المستخدمين
        </button>
        <button
          type="button"
          onClick={() => setActiveSheet('coded_customer_visits')}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-extrabold transition-all ${
            activeSheet === 'coded_customer_visits'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-white dark:bg-[#1e1e1e] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
        >
          <UserRoundSearch className="w-4 h-4" />
          زيارة العملاء من لديهم كود
        </button>
      </div>

      {activeSheet === 'user_visits' && (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 min-h-[220px] flex items-center justify-center">
          <p className="text-sm font-bold text-slate-500 text-center">
            شيت زيارات المستخدمين — جاهز لاستقبال التفاصيل لاحقاً
          </p>
        </div>
      )}

      {activeSheet === 'coded_customer_visits' && (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 min-h-[220px] flex items-center justify-center">
          <p className="text-sm font-bold text-slate-500 text-center">
            شيت زيارة العملاء من لديهم كود — جاهز لاستقبال التفاصيل لاحقاً
          </p>
        </div>
      )}
    </div>
  );
};
