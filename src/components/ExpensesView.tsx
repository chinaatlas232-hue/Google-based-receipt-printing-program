import React, { useState } from 'react';
import { Receipt, Container, Settings } from 'lucide-react';
import { ContainerExpensesSheet } from './ContainerExpensesSheet';

type ExpenseSheetTab = 'container_expenses' | 'operating_expenses';

export const ExpensesView: React.FC = () => {
  const [activeSheet, setActiveSheet] = useState<ExpenseSheetTab>('container_expenses');

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">المصاريف</h2>
            <p className="text-xs font-bold text-slate-500 mt-1">
              اختر أحد القسمين أدناه. تفاصيل البيانات والجداول ستُضاف لاحقاً.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveSheet('container_expenses')}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-extrabold transition-all ${
            activeSheet === 'container_expenses'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-white dark:bg-[#1e1e1e] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
        >
          <Container className="w-4 h-4" />
          مصاريف الحاويات
        </button>
        <button
          type="button"
          onClick={() => setActiveSheet('operating_expenses')}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-extrabold transition-all ${
            activeSheet === 'operating_expenses'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-white dark:bg-[#1e1e1e] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
        >
          <Settings className="w-4 h-4" />
          المصاريف التشغيلية
        </button>
      </div>

      {activeSheet === 'container_expenses' && <ContainerExpensesSheet />}

      {activeSheet === 'operating_expenses' && (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 min-h-[220px] flex items-center justify-center">
          <p className="text-sm font-bold text-slate-500 text-center">
            شيت المصاريف التشغيلية — جاهز لاستقبال التفاصيل لاحقاً
          </p>
        </div>
      )}
    </div>
  );
};
