import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  CloudDownload, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  RefreshCw,
  Database,
  LogIn,
  LogOut,
  FolderOpen,
  Key,
  ExternalLink,
  ChevronDown,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { ShipmentRecord } from '../types';
import { parseExcelFile, parseCustomerFile, mergeShipmentsWithCustomers } from '../utils/excel';
import { 
  googleSignIn, 
  getAccessToken, 
  logout, 
  auth, 
  setAccessTokenDirect 
} from '../services/firebaseAuth';
import { 
  syncShipmentsAndCustomersFromDrive, 
  listUserDriveFiles, 
  downloadDriveFile,
  KNOWN_DRIVE_FILES, 
  DriveFileInfo 
} from '../services/googleDrive';
import { User } from 'firebase/auth';

interface DriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (records: ShipmentRecord[], mode: 'replace' | 'append') => void;
  currentCount: number;
}

export const DriveSyncModal: React.FC<DriveSyncModalProps> = ({
  isOpen,
  onClose,
  onDataLoaded,
  currentCount,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileInfo[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // File IDs state
  const [shipmentsFileId, setShipmentsFileId] = useState(KNOWN_DRIVE_FILES.SHIPMENTS_FILE_ID);
  const [customersFileId, setCustomersFileId] = useState(KNOWN_DRIVE_FILES.CUSTOMERS_FILE_ID);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const customerFileInputRef = useRef<HTMLInputElement>(null);

  // Monitor auth state on open
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      const cached = await getAccessToken();
      if (cached) {
        setToken(cached);
        loadFilesFromDrive(cached);
      }
    });

    return () => unsubscribe();
  }, [isOpen]);

  const loadFilesFromDrive = async (accessToken: string) => {
    setIsLoadingFiles(true);
    try {
      const files = await listUserDriveFiles(accessToken);
      setDriveFiles(files);
    } catch (err) {
      console.warn('Failed to load drive files list:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setIsError(false);
    setSyncMessage(null);

    try {
      const result = await googleSignIn();
      setUser(result.user);
      setToken(result.accessToken);
      setSyncMessage(`تم تسجيل الدخول بنجاح بحساب (${result.user.email}). جارٍ قراءة ملفات Drive...`);
      loadFilesFromDrive(result.accessToken);
    } catch (err: any) {
      setIsError(true);
      if (err.code === 'auth/popup-blocked') {
        setSyncMessage('تم حظر النافذة المنبثقة من قِبل المتصفح. يرجى السماح بالنوافذ المنبثقة (Popups) ثم المحاولة مجدداً.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setSyncMessage('تم إغلاق نافذة تسجيل الدخول.');
      } else {
        setSyncMessage(`تعذر تسجيل الدخول عبر Google: ${err.message || err}`);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setDriveFiles([]);
    setSyncMessage('تم تسجيل الخروج من Google Drive.');
    setIsError(false);
  };

  const handleDriveSync = async () => {
    if (!token) {
      setIsError(true);
      setSyncMessage('يرجى أولاً تسجيل الدخول بحساب Google للوصول إلى ملفات Drive المصرح بها.');
      return;
    }

    setIsSyncing(true);
    setSyncMessage(null);
    setIsError(false);

    try {
      const result = await syncShipmentsAndCustomersFromDrive(
        token,
        shipmentsFileId.trim(),
        customersFileId.trim() ? customersFileId.trim() : undefined
      );

      onDataLoaded(result.shipments, 'replace');

      const customerMsg = result.customerFileName 
        ? ` ودمجها مع بيانات العملاء من (${result.customerFileName})` 
        : '';
      setSyncMessage(`تم بنجاح تحميل ${result.shipments.length} شحنة من ملف (${result.shipmentFileName})${customerMsg} وتحديث النظام فوراً!`);
      setIsError(false);
    } catch (err: any) {
      console.error('Drive Sync Error:', err);
      setIsError(true);
      setSyncMessage(
        err.message || 'حدث خطأ أثناء الاتصال بـ Google Drive. تأكد من صحة معرفات الملفات (File IDs) وتصاريح الحساب.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSelectDriveFileForShipments = async (file: DriveFileInfo) => {
    setShipmentsFileId(file.id);
    if (!token) return;

    setIsSyncing(true);
    setIsError(false);
    try {
      const download = await downloadDriveFile(file.id, token);
      const parsed = parseExcelFile(download.arrayBuffer);
      if (parsed.length === 0) {
        throw new Error('لم يتم العثور على سجلات شحنات في هذا الملف');
      }
      onDataLoaded(parsed, 'replace');
      setSyncMessage(`تم بنجاح تحميل ${parsed.length} سجل مباشرة من ملف (${file.name}) في Google Drive!`);
    } catch (err: any) {
      setIsError(true);
      setSyncMessage(`خطأ في قراءة ملف (${file.name}): ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, mode: 'replace' | 'append') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const parsedRecords = parseExcelFile(buffer);
        if (parsedRecords.length === 0) {
          alert('لم يتم العثور على سجلات في الملف!');
          return;
        }

        onDataLoaded(parsedRecords, mode);
        setSyncMessage(`تم استيراد ${parsedRecords.length} سجل بنجاح من ملف ${file.name}`);
        setIsError(false);
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء معالجة ملف الإكسل. يرجى التأكد من صيغة الملف.');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleCustomerFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const parsedCustomers = parseCustomerFile(buffer);
        if (parsedCustomers.length === 0) {
          alert('لم يتم العثور على بيانات عملاء في الملف!');
          return;
        }

        // We load current shipments from localStorage or trigger callback
        const saved = localStorage.getItem('atlas_shipments_data');
        if (saved) {
          const currentShipments: ShipmentRecord[] = JSON.parse(saved);
          const merged = mergeShipmentsWithCustomers(currentShipments, parsedCustomers);
          onDataLoaded(merged, 'replace');
          setSyncMessage(`تم بنجاح دمج وتحديث بيانات ${parsedCustomers.length} عميل (الهواتف والعناوين) مع الشحنات الحالية!`);
          setIsError(false);
        }
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء معالجة ملف العملاء.');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 no-print">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-800 text-white flex items-center justify-between border-b border-slate-700/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold">
              <CloudDownload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-['Cairo']">
                الربط مع Google Drive ومزامنة ملفات الشحنات والعملاء
              </h3>
              <p className="text-xs text-slate-400">
                اتصال حقيقي وآمن عبر Google OAuth 2.0 لقراءة ملفات الإكسل وجداول البيانات
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5 text-xs text-slate-700">
          {/* Status / Alert Banner */}
          {syncMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 leading-relaxed ${
                isError
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
              }`}
            >
              {isError ? (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <span>{syncMessage}</span>
              </div>
            </div>
          )}

          {/* Authentication Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <span className={`w-3 h-3 rounded-full ${user ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-amber-500 ring-4 ring-amber-100'}`}></span>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {user ? `حساب Google متصل: ${user.email}` : 'تسجيل الدخول إلى Google Drive'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {user 
                      ? 'تم تفعيل ترخيص القراءة لملفات Google Drive وجداول البيانات.' 
                      : 'سجل الدخول بحسابك للسماح للنظام بقراءة ملفات الشحنات والعملاء تلقائياً.'}
                  </p>
                </div>
              </div>

              <div>
                {user ? (
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-200 font-medium text-xs transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5 text-slate-500" />
                    <span>تسجيل الخروج</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSignIn}
                    disabled={isAuthenticating}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-xs transition-all active:scale-95 disabled:opacity-60"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span>{isAuthenticating ? 'جارٍ الاتصال...' : 'Sign in with Google'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Section: Specified Google Drive Files */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                <span>معرفات الملفات المعتمدة في Google Drive (File IDs)</span>
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">
                جاهزة للربط والمزامنة
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Shipments File ID */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  1. معرف ملف الشحنات الرئيسي (Shipments File ID):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shipmentsFileId}
                    onChange={(e) => setShipmentsFileId(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-[11px] bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                    placeholder="1IESujqsd6-4RbEfr9cnx8xeYNq-WvTUj"
                  />
                  <a
                    href={`https://drive.google.com/file/d/${shipmentsFileId}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded-lg"
                    title="فتح الملف في Google Drive"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  ملف الشحنات: يحتوي تفاصيل الطرود، الأوزان، الأكواد والمبيعات.
                </span>
              </div>

              {/* Customers File ID */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  2. معرف ملف بيانات العملاء (Customer Info File ID):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customersFileId}
                    onChange={(e) => setCustomersFileId(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-[11px] bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                    placeholder="1gCjzU7Gx5alpv7KZY1mxjIVDJO-yvzww"
                  />
                  <a
                    href={`https://drive.google.com/file/d/${customersFileId}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded-lg"
                    title="فتح الملف في Google Drive"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  دليل العملاء: لربط ودمج أرقام الهواتف، العناوين، والمحافظات تلقائياً عبر كود العميل.
                </span>
              </div>
            </div>

            {/* Sync Action Button */}
            <div className="pt-2">
              <button
                onClick={handleDriveSync}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 active:scale-98 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncing
                    ? 'جارٍ الاتصال بـ Google Drive وتنزيل ودمج الملفات...'
                    : '⚡ مزامنة وسحب بيانات الشحنات والعملاء من Google Drive الآن'}
                </span>
              </button>
            </div>
          </div>

          {/* Section: Live Drive File Explorer (when connected) */}
          {user && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-indigo-600" />
                  <span>الملفات المكتشفة في حسابك في Google Drive:</span>
                </h4>
                <button
                  onClick={() => token && loadFilesFromDrive(token)}
                  disabled={isLoadingFiles}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  <span>تحديث القائمة</span>
                </button>
              </div>

              {isLoadingFiles ? (
                <div className="py-4 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-slate-400" />
                  <span>جارٍ فحص الملفات في Google Drive...</span>
                </div>
              ) : driveFiles.length > 0 ? (
                <div className="max-h-40 overflow-y-auto custom-scrollbar divide-y divide-slate-200 bg-white rounded-lg border border-slate-200">
                  {driveFiles.map((file) => (
                    <div
                      key={file.id}
                      className="p-2.5 flex items-center justify-between hover:bg-amber-50/50 transition-colors gap-2"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-slate-900 truncate">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          ({file.id.slice(0, 8)}...)
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleSelectDriveFileForShipments(file)}
                          className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded text-[10px] transition-colors"
                        >
                          تحميل كشحنات
                        </button>
                        <button
                          onClick={() => {
                            setCustomersFileId(file.id);
                            setSyncMessage(`تم اختيار (${file.name}) كملف العملاء.`);
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[10px] transition-colors"
                        >
                          اختيار كدليل عملاء
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-white rounded-lg border border-dashed border-slate-200 text-center text-slate-400 text-[11px]">
                  لم يتم العثور على ملفات إكسل إضافية بالقائمة المباشرة. يمكنك استخدام المعرف المباشر أعلاه أو رفع الملف محلياً.
                </div>
              )}
            </div>
          )}

          {/* Section: Direct Local File Upload Backup */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Upload Shipments File */}
            <div className="border-2 border-dashed border-slate-200 hover:border-amber-400 rounded-xl p-4 text-center bg-white transition-all">
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'replace')}
              />
              <FileSpreadsheet className="w-7 h-7 text-amber-600 mx-auto mb-1.5" />
              <h5 className="font-bold text-slate-900 text-xs mb-0.5">
                رفع ملف الشحنات (Excel محلي)
              </h5>
              <p className="text-[10px] text-slate-400 mb-2.5">
                تحميل ملف الشحنات مباشرة واستبدال القائمة
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-all shadow-xs"
              >
                اختيار ملف الشحنات
              </button>
            </div>

            {/* Upload Customer Directory File */}
            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 text-center bg-white transition-all">
              <input
                type="file"
                ref={customerFileInputRef}
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleCustomerFileUpload}
              />
              <UserCheck className="w-7 h-7 text-indigo-600 mx-auto mb-1.5" />
              <h5 className="font-bold text-slate-900 text-xs mb-0.5">
                رفع دليل العملاء (Excel محلي)
              </h5>
              <p className="text-[10px] text-slate-400 mb-2.5">
                دمج وتحديث أرقام الهواتف والعناوين بالكود
              </p>
              <button
                type="button"
                onClick={() => customerFileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition-all shadow-xs"
              >
                دمج ملف بيانات العملاء
              </button>
            </div>
          </div>

          {/* Footer Info */}
          <div className="flex items-center justify-between text-slate-500 text-[11px] pt-3 border-t border-slate-200">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>السجلات المحملة حالياً في النظام: <strong>{currentCount} سجل</strong></span>
            </span>
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>مشفر ومصرح رسمياً عبر OAuth 2.0</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
