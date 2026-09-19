import React, { useState } from 'react';
import { Ship, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { COMPANY_INFO } from '../data/initialData';

interface LoginPageProps {
  onLogin: (username: string, password: string) => boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const userValue = username.trim();
    const passValue = password.trim();
    if (!userValue || !passValue) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    const ok = onLogin(userValue, passValue);
    if (!ok) {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة. استخدم admin و 123');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-['Cairo']" dir="rtl">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950" />
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent" />

      <div className="relative w-full max-w-md">
        <div className="bg-slate-800 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden">
          <div className="px-8 pt-8 pb-5 text-center border-b border-slate-700/80">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/40 mb-4">
              <Ship className="w-8 h-8 text-slate-950" />
            </div>
            <h1 className="text-xl font-extrabold text-white font-['Cairo']">
              {COMPANY_INFO.shortNameAr}
            </h1>
            <p className="text-[11px] text-slate-400 tracking-wider uppercase mt-1 font-medium">
              {COMPANY_INFO.nameEn}
            </p>
            <span className="inline-flex mt-3 bg-amber-500/20 text-amber-300 text-[10px] px-2.5 py-0.5 rounded-full border border-amber-500/40 font-semibold">
              تسجيل الدخول إلى النظام المعتمد
            </span>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم المستخدم</label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  autoComplete="username"
                  dir="ltr"
                  className="w-full bg-slate-900/70 border border-slate-600 rounded-xl py-2.5 pr-10 pl-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 font-medium text-left"
                  placeholder="أدخل اسم المستخدم"
                />
                <User className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  autoComplete="current-password"
                  dir="ltr"
                  inputMode="numeric"
                  className="w-full bg-slate-900/70 border border-slate-600 rounded-xl py-2.5 pr-10 pl-10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 font-medium text-left"
                  placeholder="أدخل كلمة المرور"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-300"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs font-bold rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm shadow-md shadow-amber-500/20 active:scale-[0.98] transition-all"
            >
              دخول النظام
            </button>

            <p className="text-[10px] text-slate-500 text-center pt-1">
              اسم المستخدم: admin — كلمة المرور: 123
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
