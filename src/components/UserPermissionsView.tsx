import React, { useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  Shield,
  UserRound,
  Save,
  X,
  Search,
  KeyRound,
  Briefcase,
  Lock,
} from 'lucide-react';
import { ActionKey, FilterKey, PageAccess, ShipmentRecord, SystemUser, UserPermissions } from '../types';
import {
  ACTION_KEYS,
  ACTION_LABELS,
  FILTER_KEYS,
  FILTER_LABELS,
  PAGE_ACCESS_LABELS,
  PAGE_KEYS,
  PAGE_LABELS,
  clonePermissions,
} from '../auth/permissions';
import { JOB_TITLES } from '../data/users';

interface UserPermissionsViewProps {
  users: SystemUser[];
  currentUser: SystemUser;
  shipments: ShipmentRecord[];
  canManage: boolean;
  onSaveUser: (user: SystemUser) => void;
}

const PAGE_ACCESS_OPTIONS: PageAccess[] = ['none', 'view', 'edit'];

export const UserPermissionsView: React.FC<UserPermissionsViewProps> = ({
  users,
  currentUser,
  shipments,
  canManage,
  onSaveUser,
}) => {
  const [search, setSearch] = useState('');
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<SystemUser | null>(null);
  const [draft, setDraft] = useState<SystemUser | null>(null);

  const shipmentOptions = useMemo(
    () => Array.from(new Set(shipments.map((s) => s.shipment).filter(Boolean))).sort(),
    [shipments]
  );
  const guarantorOptions = useMemo(
    () => Array.from(new Set(shipments.map((s) => s.guarantor).filter(Boolean))).sort(),
    [shipments]
  );
  const codeOptions = useMemo(
    () => Array.from(new Set(shipments.map((s) => s.code).filter(Boolean))).sort(),
    [shipments]
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(shipments.map((s) => s.type).filter(Boolean))).sort(),
    [shipments]
  );
  const cityOptions = useMemo(
    () => Array.from(new Set(shipments.map((s) => s.city).filter(Boolean))).sort(),
    [shipments]
  );

  const filterValueOptions: Record<FilterKey, string[]> = {
    shipment: shipmentOptions,
    guarantor: guarantorOptions,
    code: codeOptions,
    type: typeOptions,
    city: cityOptions,
    searchQuery: [],
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, search]);

  const openCard = (user: SystemUser) => {
    setEditing(user);
    setDraft({
      ...user,
      permissions: clonePermissions(user.permissions),
    });
  };

  const closeCard = () => {
    setEditing(null);
    setDraft(null);
  };

  const updateDraft = (patch: Partial<SystemUser>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updatePermissions = (updater: (p: UserPermissions) => UserPermissions) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            permissions: updater(clonePermissions(prev.permissions)),
          }
        : prev
    );
  };

  const toggleFilterValue = (key: FilterKey, value: string) => {
    updatePermissions((p) => {
      const current = p.filters[key].allowedValues;
      const nextValues = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      p.filters[key] = { ...p.filters[key], allowedValues: nextValues };
      return p;
    });
  };

  const handleSave = () => {
    if (!draft || !canManage) return;
    onSaveUser(draft);
    closeCard();
  };

  return (
    <div className="w-full space-y-5" dir="rtl">
      <div className="bg-gradient-to-r from-slate-800 to-slate-750 text-white rounded-2xl shadow-md border border-slate-700/60 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold font-['Cairo']">صلاحيات المستخدمين</h2>
            <p className="text-xs text-slate-300">
              إدارة الدخول، الوظائف، وكل صلاحية جزئية داخل الواجهات والفلاتر
            </p>
          </div>
        </div>
        <span className="text-xs bg-slate-900/50 text-amber-300 px-3 py-1 rounded-lg border border-amber-500/30 font-bold">
          {users.length} مستخدم
        </span>
      </div>

      {!canManage && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold rounded-xl px-4 py-3">
          صلاحيتك عرض فقط. تعديل بطاقات المستخدمين مقصور على مدير النظام.
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-4">
        <div className="relative max-w-md mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو اسم المستخدم أو الوظيفة"
            className="w-full pl-3 pr-9 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-slate-800 text-white font-bold">
              <tr>
                <th className="py-3 px-3 text-center w-12">#</th>
                <th className="py-3 px-3">الاسم</th>
                <th className="py-3 px-3">اسم المستخدم</th>
                <th className="py-3 px-3">الوظيفة</th>
                <th className="py-3 px-3">الرقم السري</th>
                <th className="py-3 px-3 text-center">بطاقة المستخدم</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, idx) => (
                <tr key={user.id} className="border-b border-slate-100 hover:bg-amber-50/40">
                  <td className="py-2.5 px-3 text-center text-slate-500">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{user.name}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-700">{user.username}</td>
                  <td className="py-2.5 px-3">
                    <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-semibold border border-slate-200">
                      {user.role}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono tracking-widest">
                        {revealed[user.id] ? user.password : '••••••'}
                      </span>
                      <button
                        onClick={() => setRevealed((prev) => ({ ...prev, [user.id]: !prev[user.id] }))}
                        className="p-1 rounded-md hover:bg-slate-100 text-slate-500"
                        title={revealed[user.id] ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      >
                        {revealed[user.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => openCard(user)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[11px]"
                    >
                      <UserRound className="w-3.5 h-3.5" />
                      بطاقة المستخدم
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {draft && editing && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-extrabold font-['Cairo']">بطاقة المستخدم</h3>
                <p className="text-[11px] text-slate-300">{editing.name} — {editing.role}</p>
              </div>
              <button onClick={closeCard} className="p-1.5 rounded-lg hover:bg-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar space-y-5 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="الاسم">
                  <input
                    value={draft.name}
                    disabled={!canManage}
                    onChange={(e) => updateDraft({ name: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 disabled:bg-slate-100"
                  />
                </Field>
                <Field label="اسم المستخدم">
                  <input
                    value={draft.username}
                    disabled={!canManage}
                    onChange={(e) => updateDraft({ username: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 disabled:bg-slate-100"
                  />
                </Field>
                <Field label="الوظيفة">
                  <select
                    value={draft.role}
                    disabled={!canManage}
                    onChange={(e) => updateDraft({ role: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 disabled:bg-slate-100"
                  >
                    {!JOB_TITLES.includes(draft.role) && <option value={draft.role}>{draft.role}</option>}
                    {JOB_TITLES.map((job) => (
                      <option key={job} value={job}>{job}</option>
                    ))}
                  </select>
                </Field>
                <Field label="الرقم السري">
                  <div className="relative">
                    <input
                      value={draft.password}
                      disabled={!canManage}
                      onChange={(e) => updateDraft({ password: e.target.value })}
                      className="w-full px-2.5 py-2 pl-8 text-xs bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 disabled:bg-slate-100"
                    />
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </Field>
              </div>

              <Section title="صلاحيات الصفحات" icon={<Briefcase className="w-4 h-4" />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PAGE_KEYS.map((page) => (
                    <div key={page} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-slate-800">{PAGE_LABELS[page]}</span>
                      <select
                        disabled={!canManage}
                        value={draft.permissions.pages[page]}
                        onChange={(e) =>
                          updatePermissions((p) => {
                            p.pages[page] = e.target.value as PageAccess;
                            return p;
                          })
                        }
                        className="text-[11px] font-bold bg-white border border-slate-300 rounded-lg px-2 py-1"
                      >
                        {PAGE_ACCESS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{PAGE_ACCESS_LABELS[opt]}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="صلاحيات الفلاتر الجزئية" icon={<Lock className="w-4 h-4" />}>
                <p className="text-[11px] text-slate-500 mb-3">
                  إن حُددت قيم معيّنة يُقيَّد المستخدم بها تلقائياً ولا يرى سواها. اترك القائمة فارغة للسماح بكل القيم.
                </p>
                <div className="space-y-3">
                  {FILTER_KEYS.map((key) => {
                    const perm = draft.permissions.filters[key];
                    const options = filterValueOptions[key];
                    return (
                      <div key={key} className="border border-slate-200 rounded-xl p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-extrabold text-slate-800">{FILTER_LABELS[key]}</span>
                          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                            <input
                              type="checkbox"
                              disabled={!canManage}
                              checked={perm.allowed}
                              onChange={(e) =>
                                updatePermissions((p) => {
                                  p.filters[key] = { ...p.filters[key], allowed: e.target.checked };
                                  return p;
                                })
                              }
                            />
                            تفعيل الفلتر
                          </label>
                        </div>
                        {key !== 'searchQuery' && options.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                            {options.slice(0, 80).map((opt) => {
                              const selected = perm.allowedValues.includes(opt);
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  disabled={!canManage || !perm.allowed}
                                  onClick={() => toggleFilterValue(key, opt)}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                    selected
                                      ? 'bg-amber-400 text-slate-950 border-amber-500'
                                      : 'bg-slate-50 text-slate-600 border-slate-200'
                                  } disabled:opacity-40`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {key !== 'searchQuery' && (
                          <p className="text-[10px] text-slate-400 mt-1.5">
                            {perm.allowedValues.length
                              ? `مقيّد بـ ${perm.allowedValues.length} قيمة`
                              : 'غير مقيّد — كل القيم متاحة'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Section>

              <Section title="صلاحيات الإجراءات" icon={<Shield className="w-4 h-4" />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ACTION_KEYS.map((action: ActionKey) => (
                    <label
                      key={action}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                    >
                      <span>{ACTION_LABELS[action]}</span>
                      <input
                        type="checkbox"
                        disabled={!canManage}
                        checked={draft.permissions.actions[action]}
                        onChange={(e) =>
                          updatePermissions((p) => {
                            p.actions[action] = e.target.checked;
                            return p;
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </Section>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0 bg-slate-50">
              <button onClick={closeCard} className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700">
                إغلاق
              </button>
              {canManage && (
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950"
                >
                  <Save className="w-3.5 h-3.5" />
                  حفظ البطاقة
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="block text-[11px] font-bold text-slate-700 mb-1">{label}</span>
    {children}
  </label>
);

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  children,
}) => (
  <div>
    <div className="flex items-center gap-2 mb-2.5">
      <div className="w-7 h-7 rounded-lg bg-slate-800 text-amber-300 flex items-center justify-center">{icon}</div>
      <h4 className="text-sm font-extrabold text-slate-900 font-['Cairo']">{title}</h4>
    </div>
    {children}
  </div>
);
