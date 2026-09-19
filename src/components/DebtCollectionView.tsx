import React, { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, 
  Wallet, 
  Search, 
  Filter, 
  PlusCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowUpDown, 
  FileSpreadsheet, 
  Printer, 
  RefreshCw, 
  UserCheck, 
  Truck, 
  History, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft,
  ChevronsRight,
  Trash2, 
  Receipt,
  FileText,
  SlidersHorizontal,
  Info,
  Check
} from 'lucide-react';
import { ShipmentRecord, CollectionRecord, PaymentEntry, CollectionStatus } from '../types';
import { COMPANY_INFO } from '../data/initialData';
import { ATLAS_LOGO_BASE64 } from '../data/logoBase64';
import { YARD_INVENTORY_STORAGE_KEY } from './YardInventoryView';
import * as XLSX from 'xlsx';

interface DebtCollectionViewProps {
  shipments: ShipmentRecord[];
  onSyncDrive?: () => void;
  isSyncing?: boolean;
  canRecordPayment?: boolean;
  canDeletePayment?: boolean;
  canExport?: boolean;
  canPrint?: boolean;
}

const STORAGE_KEY = 'atlas_debt_collections_v2';

export const DebtCollectionView: React.FC<DebtCollectionViewProps> = ({
  shipments,
  onSyncDrive,
  isSyncing = false,
  canRecordPayment = true,
  canDeletePayment = true,
  canExport = true,
  canPrint = true,
}) => {
  // 1. Saved Collections State (Local persistence + Server sync)
  const [collectionMap, setCollectionMap] = useState<Record<string, CollectionRecord>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading collections from localStorage:', e);
    }
    return {};
  });

  // Load from server API if available on mount
  useEffect(() => {
    async function loadServerCollections() {
      try {
        const res = await fetch('/api/collections');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.collections) {
            setCollectionMap(prev => {
              const merged = { ...prev, ...data.collections };
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
              } catch (e) {
                console.error(e);
              }
              return merged;
            });
          }
        }
      } catch (err) {
        // Silently fallback to localStorage
      }
    }
    loadServerCollections();
  }, []);

  // Physical yard tally state (الجرد الفعلي). This view is fully unlinked from the
  // default/initial dataset: a shipment (and all of its clients) only appears here
  // once EVERY one of its items has been physically tallied in واجهة جرد المستودعات.
  const [tallyActualCounts, setTallyActualCounts] = useState<Record<string, number | ''>>(() => {
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.actualCounts || {};
      }
    } catch (e) {
      console.warn('Failed to read yard tally state from localStorage', e);
    }
    return {};
  });

  useEffect(() => {
    const loadTallyState = async () => {
      let serverCounts: Record<string, number | ''> = {};
      try {
        const res = await fetch('/api/yard-inventory');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.state) {
            serverCounts = data.state.actualCounts || {};
          }
        }
      } catch {
        // fall back to localStorage only
      }

      let localCounts: Record<string, number | ''> = {};
      try {
        const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
        if (raw) localCounts = JSON.parse(raw).actualCounts || {};
      } catch {
        // ignore malformed local draft
      }

      setTallyActualCounts({ ...serverCounts, ...localCounts });
    };

    loadTallyState();
    window.addEventListener('focus', loadTallyState);
    window.addEventListener('storage', loadTallyState);
    return () => {
      window.removeEventListener('focus', loadTallyState);
      window.removeEventListener('storage', loadTallyState);
    };
  }, []);

  // Availability is decided per ITEM: any client whose physical tally is entered
  // appears immediately, while items still awaiting their tally stay hidden.
  const isItemTallied = (item: ShipmentRecord): boolean => {
    const value = tallyActualCounts[item.id];
    return value !== undefined && value !== '';
  };

  // Only physically tallied items are eligible to be shown in this view
  const visibleShipments = useMemo(
    () => shipments.filter(isItemTallied),
    [shipments, tallyActualCounts]
  );

  // Save collections helper
  const saveCollections = (updatedMap: Record<string, CollectionRecord>) => {
    setCollectionMap(updatedMap);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMap));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
    // Also broadcast to server
    fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collections: updatedMap })
    }).catch(() => {
      // server persistence optional
    });
  };

  // 2. Filters & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShipment, setSelectedShipment] = useState('الكل');
  const [selectedGuarantor, setSelectedGuarantor] = useState('الكل');
  const [selectedStatus, setSelectedStatus] = useState<string>('الكل');
  const [onlyWithDebt, setOnlyWithDebt] = useState(false);

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortField, setSortField] = useState<'name' | 'shipment' | 'total' | 'collected' | 'remaining'>('remaining');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal States
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState<CollectionRecord | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyRecord, setHistoryRecord] = useState<CollectionRecord | null>(null);

  // Form Inputs for Payment Modal
  const [inputAmount, setInputAmount] = useState<number | ''>('');
  const [inputDriver, setInputDriver] = useState('');
  const [inputMethod, setInputMethod] = useState<'نقد' | 'حوالة' | 'زين كاش' | 'شيك' | 'أخرى'>('نقد');
  const [inputReceiptNo, setInputReceiptNo] = useState('');
  const [inputNotes, setInputNotes] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Delete Action State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetRecord, setDeleteTargetRecord] = useState<CollectionRecord | null>(null);

  // Extract unique filter lists from tallied shipments only
  const shipmentCodes = useMemo(() => {
    const set = new Set(visibleShipments.map(s => s.shipment).filter(Boolean));
    return Array.from(set).sort();
  }, [visibleShipments]);

  const guarantorList = useMemo(() => {
    const set = new Set(visibleShipments.map(s => s.guarantor).filter(Boolean));
    return Array.from(set).sort();
  }, [visibleShipments]);

  // Generate complete collection records list merging tallied shipments with saved collections
  const allRecords = useMemo<CollectionRecord[]>(() => {
    return visibleShipments.map(s => {
      const recId = s.id || `${s.shipment}_${s.code}`;
      const saved = collectionMap[recId];

      const totalAmount = Number(s.sales) || 0;
      let collectedAmount = 0;
      let payments: PaymentEntry[] = [];
      let driverName = '';
      let notes = s.notes || '';
      let lastUpdated = '';

      if (saved) {
        payments = Array.isArray(saved.payments) ? saved.payments : [];
        collectedAmount = saved.collectedAmount !== undefined 
          ? Number(saved.collectedAmount) 
          : payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        driverName = saved.driverName || '';
        notes = saved.notes || notes;
        lastUpdated = saved.lastUpdated || '';
      }

      const remainingAmount = Math.max(0, totalAmount - collectedAmount);

      // Determine status automatically
      let status: CollectionStatus = 'لم يبدأ';
      if (totalAmount <= 0) {
        status = 'مكتمل';
      } else if (collectedAmount >= totalAmount) {
        status = 'مكتمل';
      } else if (collectedAmount > 0) {
        status = 'جزئي';
      } else {
        status = 'لم يبدأ';
      }

      return {
        id: recId,
        shipmentCode: s.shipment || 'غير محدد',
        clientCode: s.code || '',
        clientName: s.name || '',
        guarantor: s.guarantor || '',
        totalAmount,
        collectedAmount,
        remainingAmount,
        status,
        driverName,
        notes,
        lastUpdated,
        payments
      };
    });
  }, [visibleShipments, collectionMap]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return allRecords.filter(item => {
      if (selectedShipment !== 'الكل' && item.shipmentCode !== selectedShipment) {
        return false;
      }
      if (selectedGuarantor !== 'الكل' && item.guarantor !== selectedGuarantor) {
        return false;
      }
      if (selectedStatus !== 'الكل' && item.status !== selectedStatus) {
        return false;
      }
      if (onlyWithDebt && item.remainingAmount <= 0) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.clientName.toLowerCase().includes(q);
        const matchCode = item.clientCode.toLowerCase().includes(q);
        const matchShipment = item.shipmentCode.toLowerCase().includes(q);
        const matchGuarantor = item.guarantor.toLowerCase().includes(q);
        const matchDriver = item.driverName?.toLowerCase().includes(q) || false;
        if (!matchName && !matchCode && !matchShipment && !matchGuarantor && !matchDriver) {
          return false;
        }
      }
      return true;
    });
  }, [allRecords, selectedShipment, selectedGuarantor, selectedStatus, onlyWithDebt, searchQuery]);

  // Sorted Records
  const sortedRecords = useMemo(() => {
    const list = [...filteredRecords];
    list.sort((a, b) => {
      let valA: any;
      let valB: any;
      if (sortField === 'name') {
        valA = a.clientName;
        valB = b.clientName;
        return sortDirection === 'asc' ? valA.localeCompare(valB, 'ar') : valB.localeCompare(valA, 'ar');
      } else if (sortField === 'shipment') {
        valA = a.shipmentCode;
        valB = b.shipmentCode;
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortField === 'total') {
        valA = a.totalAmount;
        valB = b.totalAmount;
      } else if (sortField === 'collected') {
        valA = a.collectedAmount;
        valB = b.collectedAmount;
      } else {
        valA = a.remainingAmount;
        valB = b.remainingAmount;
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
    return list;
  }, [filteredRecords, sortField, sortDirection]);

  // Paginated View
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const displayedRecords = useMemo(() => {
    const start = (currentPageSafe - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPageSafe, pageSize]);

  // Global Financial Statistics
  const stats = useMemo(() => {
    let totalRequired = 0;
    let totalCollected = 0;
    let totalRemaining = 0;
    let completedCount = 0;
    let partialCount = 0;
    let notStartedCount = 0;

    filteredRecords.forEach(r => {
      totalRequired += r.totalAmount;
      totalCollected += r.collectedAmount;
      totalRemaining += r.remainingAmount;
      if (r.status === 'مكتمل') completedCount++;
      else if (r.status === 'جزئي') partialCount++;
      else notStartedCount++;
    });

    const collectionPercentage = totalRequired > 0 
      ? Math.min(100, (totalCollected / totalRequired) * 100) 
      : 0;

    return {
      totalRequired,
      totalCollected,
      totalRemaining,
      collectionPercentage,
      completedCount,
      partialCount,
      notStartedCount,
      totalCount: filteredRecords.length
    };
  }, [filteredRecords]);

  // Open Payment Modal
  const handleOpenPayment = (record: CollectionRecord) => {
    if (!canRecordPayment) return;
    setActiveRecord(record);
    setInputAmount('');
    setInputDriver(record.driverName || '');
    setInputMethod('نقد');
    setInputReceiptNo('');
    setInputNotes(record.notes || '');
    setSaveSuccessMsg(null);
    setPaymentModalOpen(true);
  };

  // Open History Modal
  const handleOpenHistory = (record: CollectionRecord) => {
    setHistoryRecord(record);
    setHistoryModalOpen(true);
  };

  // Calculate dynamic preview for payment modal
  const dynamicPaymentPreview = useMemo(() => {
    if (!activeRecord) return { newCollected: 0, newRemaining: 0, isFullyPaid: false };
    const addAmt = typeof inputAmount === 'number' ? inputAmount : 0;
    const newCollected = activeRecord.collectedAmount + addAmt;
    const newRemaining = Math.max(0, activeRecord.totalAmount - newCollected);
    const isFullyPaid = newRemaining === 0 && activeRecord.totalAmount > 0;
    return {
      newCollected,
      newRemaining,
      isFullyPaid
    };
  }, [activeRecord, inputAmount]);

  // Submit Payment
  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRecord) return;

    const amountNum = typeof inputAmount === 'number' ? inputAmount : 0;
    if (amountNum <= 0 && !inputNotes.trim() && inputDriver === activeRecord.driverName) {
      alert('يرجى إدخال مبلغ صحيح للدفعة أو تعديل الملاحظات / السائق.');
      return;
    }

    const now = new Date();
    const formattedDate = now.toLocaleString('ar-IQ-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const newPayment: PaymentEntry | null = amountNum > 0 ? {
      id: 'pay_' + Date.now(),
      amount: amountNum,
      date: formattedDate,
      driverName: inputDriver.trim() || 'غير محدد',
      paymentMethod: inputMethod,
      notes: inputNotes.trim() || undefined,
      receiptNumber: inputReceiptNo.trim() || undefined
    } : null;

    const updatedPayments = newPayment 
      ? [newPayment, ...(activeRecord.payments || [])]
      : (activeRecord.payments || []);

    const newTotalCollected = activeRecord.collectedAmount + amountNum;
    const newRemaining = Math.max(0, activeRecord.totalAmount - newTotalCollected);

    let newStatus: CollectionStatus = 'لم يبدأ';
    if (activeRecord.totalAmount <= 0 || newTotalCollected >= activeRecord.totalAmount) {
      newStatus = 'مكتمل';
    } else if (newTotalCollected > 0) {
      newStatus = 'جزئي';
    }

    const updatedRecord: CollectionRecord = {
      ...activeRecord,
      collectedAmount: newTotalCollected,
      remainingAmount: newRemaining,
      status: newStatus,
      driverName: inputDriver.trim() || activeRecord.driverName,
      notes: inputNotes.trim() || activeRecord.notes,
      lastUpdated: formattedDate,
      payments: updatedPayments
    };

    const newMap = {
      ...collectionMap,
      [activeRecord.id]: updatedRecord
    };

    saveCollections(newMap);
    setSaveSuccessMsg(`تم حفظ الاستحصال بنجاح! الحالة الحالية: ${newStatus === 'مكتمل' ? 'خالصة بالكامل' : 'عليها ديون متبقية'}`);

    setTimeout(() => {
      setPaymentModalOpen(false);
      setSaveSuccessMsg(null);
    }, 1200);
  };

  // Delete a specific payment entry by ID safely with dynamic recalculation
  const handleDeleteSpecificPayment = (targetRecordId: string, paymentId: string) => {
    const record = collectionMap[targetRecordId] || allRecords.find(r => r.id === targetRecordId);
    if (!record) return;

    const updatedPayments = (record.payments || []).filter(p => p.id !== paymentId);
    const newCollected = updatedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const newRemaining = Math.max(0, record.totalAmount - newCollected);

    let newStatus: CollectionStatus = 'لم يبدأ';
    if (record.totalAmount <= 0 || newCollected >= record.totalAmount) {
      newStatus = 'مكتمل';
    } else if (newCollected > 0) {
      newStatus = 'جزئي';
    }

    const latestPayment = updatedPayments[0];

    const updated: CollectionRecord = {
      ...record,
      collectedAmount: newCollected,
      remainingAmount: newRemaining,
      status: newStatus,
      payments: updatedPayments,
      driverName: latestPayment ? latestPayment.driverName : (newCollected > 0 ? record.driverName : ''),
      lastUpdated: new Date().toLocaleString('en-US')
    };

    const newMap = {
      ...collectionMap,
      [record.id]: updated
    };

    saveCollections(newMap);

    // Sync with modal records if active
    if (historyRecord && historyRecord.id === targetRecordId) {
      setHistoryRecord(updated);
    }
    if (deleteTargetRecord && deleteTargetRecord.id === targetRecordId) {
      setDeleteTargetRecord(updated);
    }
  };

  // Delete last payment (التراجع عن آخر حركة استحصال)
  const handleDeleteLastPayment = (record: CollectionRecord) => {
    if (!record.payments || record.payments.length === 0) return;
    const lastPayment = record.payments[0]; // first item is newest
    handleDeleteSpecificPayment(record.id, lastPayment.id);
  };

  // Delete a payment entry from history modal
  const handleDeletePayment = (paymentId: string) => {
    if (!historyRecord) return;
    if (!confirm('هل أنت متأكد من حذف هذه الدفعة المحددة؟ سيتم إعادة احتساب المبلغ المستحصل والمتبقي تلقائياً.')) return;
    handleDeleteSpecificPayment(historyRecord.id, paymentId);
  };

  // Open Delete Management Dialog from table row
  const handleOpenDeleteDialog = (record: CollectionRecord) => {
    setDeleteTargetRecord(record);
    setDeleteModalOpen(true);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredRecords.map((r, idx) => ({
      'ت': idx + 1,
      'كود العميل': r.clientCode,
      'اسم الزبون': r.clientName,
      'كود الشحنة': r.shipmentCode,
      'الكفيل': r.guarantor,
      'المبلغ الكلي المطلوب ($)': r.totalAmount,
      'المبلغ المستحصل ($)': r.collectedAmount,
      'المبلغ المتبقي ($)': r.remainingAmount,
      'حالة الاستحصال': r.status,
      'السائق المسؤول': r.driverName || '—',
      'ملاحظات': r.notes || '—',
      'آخر تحديث': r.lastUpdated || '—'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!dir'] = 'rtl';
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير الاستحصالات والديون');
    XLSX.writeFile(wb, `كشف_الاستحصالات_المالية_${selectedShipment}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Print Report Window
  const handlePrint = () => {
    window.print();
  };

  // Print Shipment Payment Statement (طباعة كشف حساب واستحصالات الشحنة)
  const handlePrintPaymentStatement = (record: CollectionRecord) => {
    // Find related shipment record from Google Sheets dataset for additional metadata
    const shipInfo = visibleShipments.find(
      s => s.id === record.id || (s.shipment === record.shipmentCode && s.code === record.clientCode)
    );

    const todayStr = new Date().toLocaleDateString('ar-IQ-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const isFullyPaid = record.remainingAmount <= 0;
    const isPartiallyPaid = record.collectedAmount > 0 && record.remainingAmount > 0;
    const statusColor = isFullyPaid ? '#059669' : isPartiallyPaid ? '#d97706' : '#dc2626';
    const statusBg = isFullyPaid ? '#ecfdf5' : isPartiallyPaid ? '#fffbeb' : '#fef2f2';
    const statusBorder = isFullyPaid ? '#a7f3d0' : isPartiallyPaid ? '#fde68a' : '#fecaca';
    const statusLabel = isFullyPaid 
      ? 'خالص بالكامل (مكتمل)' 
      : isPartiallyPaid 
        ? 'تسديد جزئي (يوجد دين متبقي)' 
        : 'غير مسدد (لم يبدأ الاستحصال)';

    const paymentsRows = record.payments.length === 0 ? `
      <tr>
        <td colspan="7" style="text-align: center; padding: 22px; color: #64748b; font-size: 11px; background-color: #f8fafc;">
          لا توجد أي دفعات أو استحصالات مسجلة لهذه الشحنة حتى الآن.
        </td>
      </tr>
    ` : record.payments.map((p, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="text-align: center; font-weight: bold; font-family: monospace; color: #475569;">${idx + 1}</td>
        <td style="text-align: center; font-weight: 600; color: #1e293b; font-size: 10.5px;">${p.date || '—'}</td>
        <td style="text-align: center; font-family: monospace; font-weight: bold; color: #0284c7;">${p.receiptNumber || `REC-${record.shipmentCode}-${idx + 1}`}</td>
        <td style="text-align: left; font-family: 'JetBrains Mono', monospace; font-weight: 900; color: #059669; font-size: 13px;" dir="ltr">
          $${p.amount.toFixed(2)}
        </td>
        <td style="text-align: center; font-weight: 700; color: #334155;">
          <span style="background: #e2e8f0; padding: 2px 7px; border-radius: 4px; font-size: 10px;">${p.paymentMethod || 'نقد'}</span>
        </td>
        <td style="text-align: right; font-weight: bold; color: #0f172a;">${p.driverName || '—'}</td>
        <td style="text-align: right; color: #475569; font-size: 10px;">${p.notes || '—'}</td>
      </tr>
    `).join('');

    const printHtml = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>كشف حساب واستحصالات الشحنة - ${record.shipmentCode} - ${record.clientName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=JetBrains+Mono:wght@600;700;800&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            margin: 0;
            padding: 8px;
            font-family: 'Cairo', Tahoma, Arial, sans-serif;
            direction: rtl;
            background: #ffffff;
            color: #0f172a;
            line-height: 1.4;
          }
          .statement-wrapper {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
            border: 2px solid #0f172a;
            border-radius: 8px;
            padding: 16px;
            background: #ffffff;
          }
          .header-table {
            width: 100%;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 14px;
            border-collapse: collapse;
          }
          .header-table td {
            border: none;
            padding: 0;
            vertical-align: middle;
          }
          .title-badge {
            display: inline-block;
            background: #0f172a;
            color: #f8fafc;
            padding: 4px 14px;
            border-radius: 6px;
            font-weight: 800;
            font-size: 14px;
            letter-spacing: 0.5px;
          }
          .info-grid {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
            font-size: 11px;
          }
          .info-grid td {
            border: 1px solid #cbd5e1;
            padding: 6px 10px;
          }
          .financial-summary {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          .financial-summary td {
            border: 1px solid #cbd5e1;
            padding: 10px 8px;
            text-align: center;
            vertical-align: middle;
          }
          .ledger-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 11px;
          }
          .ledger-table th {
            background: #0f172a;
            color: #ffffff;
            border: 1px solid #0f172a;
            padding: 7px 6px;
            text-align: center;
            font-size: 11px;
          }
          .ledger-table td {
            border: 1px solid #cbd5e1;
            padding: 6px 6px;
            font-size: 11px;
          }
          .total-row {
            background: #e2e8f0 !important;
            font-weight: 800;
          }
          .signatures-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 24px;
            font-size: 11px;
          }
          .signatures-table td {
            border: none;
            padding: 8px 12px;
            vertical-align: top;
            width: 33.33%;
            text-align: center;
          }
          .sign-box {
            border: 1px dashed #94a3b8;
            border-radius: 6px;
            padding: 24px 8px 8px;
            background: #f8fafc;
            min-height: 70px;
            margin-top: 6px;
          }
          .stamp-box {
            border: 2px solid #cbd5e1;
            border-radius: 8px;
            padding: 20px 8px 8px;
            background: #fafafa;
            min-height: 70px;
            margin-top: 6px;
            color: #94a3b8;
            font-weight: bold;
          }
          .footer-note {
            margin-top: 14px;
            padding-top: 8px;
            border-top: 1px dashed #cbd5e1;
            font-size: 9px;
            color: #64748b;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
        </style>
      </head>
      <body>
        <div class="statement-wrapper">
          <!-- 1. Header -->
          <table class="header-table">
            <tr>
              <td style="width: 20%; text-align: right;">
                <img src="${ATLAS_LOGO_BASE64}" style="height: 56px; width: 56px; object-fit: contain;" alt="Atlas Logo" />
              </td>
              <td style="width: 55%; text-align: center;">
                <div style="font-size: 17px; font-weight: 900; color: #0f172a; margin-bottom: 2px;">
                  شركة أطلس المحيط للتجارة العامة
                </div>
                <div style="font-size: 10px; color: #64748b; font-weight: 600; margin-bottom: 6px;">
                  OCEAN ATLAS GENERAL TRADING
                </div>
                <div class="title-badge">
                  كشف حساب واستحصالات الشحنة | سند مالي معتمد
                </div>
              </td>
              <td style="width: 25%; text-align: left; font-size: 10px; color: #475569;">
                <div><strong>تاريخ الاستخراج:</strong> ${todayStr}</div>
                <div><strong>رقم الكشف:</strong> STMT-${record.shipmentCode}</div>
                <div><strong>الفرع:</strong> بغداد - العراق</div>
              </td>
            </tr>
          </table>

          <!-- 2. Customer & Shipment Information Grid -->
          <table class="info-grid">
            <tr style="background-color: #f1f5f9;">
              <td style="width: 25%;"><strong>رقم / كود الشحنة:</strong></td>
              <td style="width: 25%; font-family: monospace; font-weight: 800; color: #b45309; font-size: 13px;">${record.shipmentCode}</td>
              <td style="width: 25%;"><strong>كود الزبون (العميل):</strong></td>
              <td style="width: 25%; font-family: monospace; font-weight: 800; color: #0f172a;">${record.clientCode}</td>
            </tr>
            <tr>
              <td><strong>اسم العميل (الزبون):</strong></td>
              <td style="font-weight: 800; font-size: 12px; color: #0f172a;">${record.clientName}</td>
              <td><strong>الكفيل الضامن:</strong></td>
              <td style="font-weight: bold; color: #334155;">${record.guarantor || 'بدون كفيل'}</td>
            </tr>
            <tr style="background-color: #f8fafc;">
              <td><strong>المحافظة / المدينة:</strong></td>
              <td>${shipInfo?.city || '—'}</td>
              <td><strong>رقم الهاتف:</strong></td>
              <td dir="ltr" style="text-align: right; font-family: monospace; font-weight: bold;">${shipInfo?.phone || '—'}</td>
            </tr>
            <tr>
              <td><strong>عدد الطرود والوزن:</strong></td>
              <td>${shipInfo ? `${shipInfo.packages} طرد / ${shipInfo.weight} كغ` : '—'}</td>
              <td><strong>عنوان الاستلام:</strong></td>
              <td>${shipInfo?.address || 'مركز الشركة / فرع التسليم'}</td>
            </tr>
          </table>

          <!-- 3. Financial Summary Bar -->
          <table class="financial-summary">
            <tr>
              <td style="width: 25%; background: #eff6ff;">
                <div style="font-size: 10px; font-weight: bold; color: #1e40af; margin-bottom: 2px;">المبلغ الكلي المطلوب</div>
                <div style="font-size: 17px; font-weight: 900; color: #1e3a8a; font-family: 'JetBrains Mono', monospace;" dir="ltr">
                  $${record.totalAmount.toFixed(2)}
                </div>
              </td>
              <td style="width: 25%; background: #ecfdf5;">
                <div style="font-size: 10px; font-weight: bold; color: #065f46; margin-bottom: 2px;">إجمالي المستحصل (المسدد)</div>
                <div style="font-size: 17px; font-weight: 900; color: #047857; font-family: 'JetBrains Mono', monospace;" dir="ltr">
                  $${record.collectedAmount.toFixed(2)}
                </div>
              </td>
              <td style="width: 25%; background: #fff1f2;">
                <div style="font-size: 10px; font-weight: bold; color: #9f1239; margin-bottom: 2px;">المبلغ المتبقي (الدين)</div>
                <div style="font-size: 17px; font-weight: 900; color: #be123c; font-family: 'JetBrains Mono', monospace;" dir="ltr">
                  $${record.remainingAmount.toFixed(2)}
                </div>
              </td>
              <td style="width: 25%; background: ${statusBg}; border-color: ${statusBorder};">
                <div style="font-size: 10px; font-weight: bold; color: #475569; margin-bottom: 3px;">حالة الاستحصال</div>
                <div style="font-size: 11px; font-weight: 800; color: ${statusColor}; padding: 3px 6px; border: 1px solid ${statusColor}; border-radius: 4px; display: inline-block;">
                  ${statusLabel}
                </div>
              </td>
            </tr>
          </table>

          <!-- 4. Payment History Ledger Table -->
          <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span>📋 تفاصيل دفعات وسندات القبض المسجلة:</span>
            <span style="font-size: 10px; color: #64748b; font-weight: normal;">عدد الدفعات: ${record.payments.length}</span>
          </div>
          <table class="ledger-table">
            <thead>
              <tr>
                <th style="width: 35px;">#</th>
                <th style="width: 110px;">التاريخ والوقت</th>
                <th style="width: 105px;">رقم السند/الوصل</th>
                <th style="width: 110px; text-align: left;">المبلغ المستلم ($)</th>
                <th style="width: 80px;">طريقة الدفع</th>
                <th style="width: 115px;">السائق المسؤول</th>
                <th>الملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${paymentsRows}
              <tr class="total-row">
                <td colspan="3" style="text-align: center; font-weight: 800;">مجموع المبالغ المستحصلة المسددة</td>
                <td style="text-align: left; font-family: 'JetBrains Mono', monospace; font-weight: 900; color: #047857; font-size: 13px;" dir="ltr">
                  $${record.collectedAmount.toFixed(2)}
                </td>
                <td colspan="3" style="text-align: center; font-size: 10.5px; color: #334155;">
                  المتبقي بذمة الزبون: <strong dir="ltr" style="color: ${record.remainingAmount > 0 ? '#be123c' : '#059669'}; font-size: 12px;">$${record.remainingAmount.toFixed(2)}</strong>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- 5. Signature and Stamp Section -->
          <table class="signatures-table">
            <tr>
              <td>
                <strong>المحصل / السائق المسؤول:</strong>
                <div class="sign-box">
                  <span style="font-weight: bold; color: #1e293b;">${record.driverName || '...........................................'}</span>
                </div>
              </td>
              <td>
                <strong>الحسابات والتدقيق المالي:</strong>
                <div class="sign-box">
                  <span style="font-weight: bold; color: #1e293b;">...........................................</span>
                </div>
              </td>
              <td>
                <strong>الختم المعتمد للشركة:</strong>
                <div class="stamp-box">
                  محل الختم الرسمي
                </div>
              </td>
            </tr>
          </table>

          <!-- 6. Footer -->
          <div class="footer-note">
            <span>${COMPANY_INFO.address} | هاتف: ${COMPANY_INFO.phone1} - ${COMPANY_INFO.phone2}</span>
            <span>هذا الكشف صادر آلياً من نظام إدارة الشحنات والاستحصالات وهو وثيقة رسمية معتمدة.</span>
          </div>
        </div>
      </body>
      </html>
    `;

    // Printing execution: window.open with hidden iframe fallback for sandboxed environments
    const printWindow = window.open('', '_blank', 'height=850,width=800');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 450);
    } else {
      // If popup is blocked by iframe sandbox, dynamically create a hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(printHtml);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }, 500);
      }
    }
  };

  return (
    <div className="w-full space-y-5 animate-fadeIn font-['Cairo'] pb-10 text-slate-800">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none translate-x-1/2 translate-y-1/2"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 text-slate-950">
                <Wallet className="w-6 h-6 stroke-[2.3]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    واجهة الاستحصالات المالية والديون
                  </h2>
                  <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/40 font-bold">
                    مباشر ومربوط مع الشيت
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
                  إدارة المبالغ المطلوبة، تسجيل دفعات السائقين والزبائن، ومتابعة الديون المتبقية لحظة بلحظة
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5 self-end md:self-center">
            {onSyncDrive && (
              <button
                onClick={onSyncDrive}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-amber-500/30 hover:border-amber-400 transition-all active:scale-95 disabled:opacity-60 cursor-pointer shadow-sm"
                title="تحديث البيانات من Google Sheets"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
                <span>{isSyncing ? 'جارٍ التزامن...' : 'تحديث من الشيت'}</span>
              </button>
            )}

            {canExport && (
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>تصدير Excel</span>
            </button>
            )}

            {canPrint && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-600 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>طباعة الكشف</span>
            </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. KPI Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Required */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي المبلغ المطلوب (الكلي)</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight" dir="ltr">
              ${stats.totalRequired.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <span>إجمالي أجور ومبيعات الشحنات المعروضة</span>
            </div>
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white rounded-2xl p-4 border border-emerald-200/90 shadow-sm relative overflow-hidden flex flex-col justify-between bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700">إجمالي المبلغ المستحصل</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight" dir="ltr">
              ${stats.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-emerald-600 mt-1 font-bold flex items-center justify-between">
              <span>نسبة الاستحصال: {stats.collectionPercentage.toFixed(1)}%</span>
              <span className="text-[11px] font-normal text-slate-500">{stats.completedCount} شحنة خالصة</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-emerald-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                style={{ width: `${stats.collectionPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Total Remaining Debt */}
        <div className="bg-white rounded-2xl p-4 border border-rose-200/90 shadow-sm relative overflow-hidden flex flex-col justify-between bg-gradient-to-br from-white to-rose-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700">إجمالي الديون المتبقية</span>
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-black text-rose-600 tracking-tight" dir="ltr">
              ${stats.totalRemaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-rose-600 mt-1 font-semibold flex items-center gap-1">
              <span>مستحقات بذمة الزبائن واجبة الاستحصال</span>
            </div>
          </div>
        </div>

        {/* Status Breakdown Counts */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">حالات الاستحصال للشحنات</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200/60">
              <div className="text-base font-black text-emerald-700">{stats.completedCount}</div>
              <div className="text-[10px] font-bold text-emerald-800">مكتمل</div>
            </div>
            <div className="p-2 bg-amber-50 rounded-xl border border-amber-200/60">
              <div className="text-base font-black text-amber-700">{stats.partialCount}</div>
              <div className="text-[10px] font-bold text-amber-800">جزئي</div>
            </div>
            <div className="p-2 bg-rose-50 rounded-xl border border-rose-200/60">
              <div className="text-base font-black text-rose-700">{stats.notStartedCount}</div>
              <div className="text-[10px] font-bold text-rose-800">لم يبدأ</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Fast Search & Filter Panel */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Quick Search Input */}
          <div className="lg:col-span-4 relative">
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="بحث بالاسم، كود الزبون، كود الشحنة، أو الكفيل..."
              className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Shipment Filter */}
          <div className="lg:col-span-2">
            <select
              value={selectedShipment}
              onChange={e => {
                setSelectedShipment(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            >
              <option value="الكل">📦 كافة الشحنات ({shipmentCodes.length})</option>
              {shipmentCodes.map(code => (
                <option key={code} value={code}>شحنة: {code}</option>
              ))}
            </select>
          </div>

          {/* Guarantor Filter */}
          <div className="lg:col-span-2">
            <select
              value={selectedGuarantor}
              onChange={e => {
                setSelectedGuarantor(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            >
              <option value="الكل">🛡️ كافة الكفلاء ({guarantorList.length})</option>
              {guarantorList.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-2">
            <select
              value={selectedStatus}
              onChange={e => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            >
              <option value="الكل">🎯 كافة الحالات</option>
              <option value="مكتمل">✅ مكتمل (خالص)</option>
              <option value="جزئي">⚠️ جزئي (مسدد جزئياً)</option>
              <option value="لم يبدأ">❌ لم يبدأ (غير مسدد)</option>
            </select>
          </div>

          {/* Debt Only Toggle & Reset */}
          <div className="lg:col-span-2 flex items-center justify-between sm:justify-end gap-2">
            <button
              onClick={() => setOnlyWithDebt(!onlyWithDebt)}
              className={`flex-1 sm:flex-initial px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                onlyWithDebt
                  ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${onlyWithDebt ? 'text-rose-600' : 'text-slate-400'}`} />
              <span>الديون فقط</span>
            </button>

            {(searchQuery || selectedShipment !== 'الكل' || selectedGuarantor !== 'الكل' || selectedStatus !== 'الكل' || onlyWithDebt) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedShipment('الكل');
                  setSelectedGuarantor('الكل');
                  setSelectedStatus('الكل');
                  setOnlyWithDebt(false);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-2.5 text-xs text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-colors"
                title="إعادة ضبط الفلاتر"
              >
                تصفير
              </button>
            )}
          </div>
        </div>

        {/* Active Filters Summary Bar */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-500">
          <div className="flex items-center gap-2">
            <span>عدد النتائج المطابقة:</span>
            <span className="font-extrabold text-slate-900 bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
              {filteredRecords.length.toLocaleString('en-US')} سجل
            </span>
            <span>من إجمالي {allRecords.length.toLocaleString('en-US')} شحنة</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400">ترتيب حسب:</span>
            <div className="flex items-center gap-1">
              {(['remaining', 'total', 'collected', 'name'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => {
                    if (sortField === f) {
                      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField(f);
                      setSortDirection('desc');
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                    sortField === f 
                      ? 'bg-slate-800 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'remaining' && 'المتبقي'}
                  {f === 'total' && 'الكلي'}
                  {f === 'collected' && 'المستحصل'}
                  {f === 'name' && 'اسم الزبون'}
                  {sortField === f && (sortDirection === 'desc' ? ' ↓' : ' ↑')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Master Debt Collection Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-850 text-white font-extrabold border-b border-slate-700">
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-3">كود الزبون</th>
                <th className="py-3 px-3 min-w-[160px]">اسم الزبون</th>
                <th className="py-3 px-3 text-center">كود الشحنة</th>
                <th className="py-3 px-3">الكفيل</th>
                <th className="py-3 px-3 text-left">المبلغ الكلي ($)</th>
                <th className="py-3 px-3 text-left">المبلغ المستحصل ($)</th>
                <th className="py-3 px-3 text-left">المبلغ المتبقي (الدين)</th>
                <th className="py-3 px-3 text-center">حالة الاستحصال</th>
                <th className="py-3 px-3">السائق المسؤول / ملاحظات</th>
                <th className="py-3 px-3 text-center min-w-[150px]">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {displayedRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    {visibleShipments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Wallet className="w-8 h-8 text-slate-300" />
                        <p className="font-bold text-slate-500">الجدول فارغ، بانتظار إتمام جرد الشحنات لعرض المبالغ والديون</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Wallet className="w-8 h-8 text-slate-300" />
                        <p className="font-bold text-slate-500">لا توجد سجلات مطابقة لمعايير البحث الحالية</p>
                        <p className="text-xs text-slate-400">جرب تغيير كلمات البحث أو إعادة ضبط الفلاتر</p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                displayedRecords.map((item, index) => {
                  const globalIdx = (currentPageSafe - 1) * pageSize + index + 1;
                  return (
                    <tr 
                      key={item.id}
                      className={`hover:bg-amber-50/40 transition-colors ${
                        item.remainingAmount > 0 ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                    >
                      <td className="py-3 px-3 text-center text-slate-400 font-semibold">{globalIdx}</td>
                      
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {item.clientCode}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-bold text-slate-900">
                        {item.clientName}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="font-black text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                          {item.shipmentCode}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {item.guarantor || '—'}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-3 text-left font-bold text-slate-900" dir="ltr">
                        ${item.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Collected Amount */}
                      <td className="py-3 px-3 text-left font-black text-emerald-700" dir="ltr">
                        ${item.collectedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Remaining Amount */}
                      <td className="py-3 px-3 text-left" dir="ltr">
                        {item.remainingAmount > 0 ? (
                          <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            ${item.remainingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-600 text-xs flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            خالص $0.00
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3 text-center">
                        {item.status === 'مكتمل' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            مكتمل
                          </span>
                        )}
                        {item.status === 'جزئي' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3" />
                            جزئي
                          </span>
                        )}
                        {item.status === 'لم يبدأ' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
                            <AlertTriangle className="w-3 h-3" />
                            لم يبدأ
                          </span>
                        )}
                      </td>

                      {/* Driver & Notes */}
                      <td className="py-3 px-3 text-xs text-slate-500 max-w-[200px]">
                        {item.driverName && (
                          <div className="font-bold text-slate-700 flex items-center gap-1">
                            <Truck className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>{item.driverName}</span>
                          </div>
                        )}
                        {item.notes ? (
                          <div className="truncate text-slate-500" title={item.notes}>
                            {item.notes}
                          </div>
                        ) : (!item.driverName && <span className="text-slate-300">—</span>)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {canRecordPayment && (
                          <button
                            onClick={() => handleOpenPayment(item)}
                            className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                            title="إدخال دفعة جديدة وتحديث الحالة"
                          >
                            <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>استحصال</span>
                          </button>
                          )}

                          {/* Payment History Button */}
                          <button
                            onClick={() => handleOpenHistory(item)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200"
                            title="عرض سجل الدفعات السابقة"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          {canPrint && (
                          <button
                            onClick={() => handlePrintPaymentStatement(item)}
                            className="p-1.5 bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 rounded-lg transition-colors border border-slate-200"
                            title="طباعة كشف حساب واستحصالات هذه الشحنة"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          )}

                          {canDeletePayment && (
                          <button
                            onClick={() => handleOpenDeleteDialog(item)}
                            disabled={!item.payments || item.payments.length === 0}
                            className={`p-1.5 rounded-lg transition-colors border ${
                              item.payments && item.payments.length > 0
                                ? 'bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border-slate-200 cursor-pointer'
                                : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-50'
                            }`}
                            title={
                              item.payments && item.payments.length > 0
                                ? `إلغاء أو حذف حركة دفع (دفعات مسجلة: ${item.payments.length})`
                                : 'لا توجد دفعات قابلة للحذف'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-2">
            <span>عدد السجلات لكل صفحة:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-700"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-slate-400 mr-2">
              (صفحة {currentPageSafe} من {totalPages})
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPageSafe === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="الصفحة الأولى"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPageSafe === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            
            <div className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-800">
              {currentPageSafe} / {totalPages}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPageSafe === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPageSafe === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="الصفحة الأخيرة"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. MODAL: Collection Payment Window (نافذة الاستحصال المالي والتسديد السريع) */}
      {paymentModalOpen && activeRecord && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden text-right">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md font-bold">
                  <DollarSign className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    💰 نافذة الاستحصالات المالية للشحنة: <span className="text-amber-400 font-mono">{activeRecord.shipmentCode}</span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    تسجيل استلام نقد من السائق وتحديث المتبقي والحالة المالية
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitPayment} className="p-5 sm:p-6 space-y-4">
              {/* Client Info Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">الزبون:</span>
                  <span className="font-extrabold text-slate-900 text-sm">{activeRecord.clientName}</span>
                  <span className="text-slate-500 mr-2">({activeRecord.clientCode})</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">الكفيل:</span>
                  <span className="font-bold text-slate-800">{activeRecord.guarantor || 'بدون كفيل'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">المبلغ الكلي المطلوب:</span>
                  <span className="font-black text-blue-700 text-sm" dir="ltr">
                    ${activeRecord.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Financial Status Comparison */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[10px] font-bold">المستحصل سابقاً</span>
                  <span className="font-black text-emerald-700 text-sm" dir="ltr">
                    ${activeRecord.collectedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  <span className="text-amber-800 block text-[10px] font-bold">الدفعة الجديدة</span>
                  <span className="font-black text-amber-700 text-sm" dir="ltr">
                    ${(typeof inputAmount === 'number' ? inputAmount : 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  <span className="text-rose-800 block text-[10px] font-bold">المتبقي بعد الدفعة</span>
                  <span className="font-black text-rose-700 text-sm" dir="ltr">
                    ${dynamicPaymentPreview.newRemaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  المبلغ المستلم نقداً من السائق ($) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                    $
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={activeRecord.remainingAmount || activeRecord.totalAmount}
                    value={inputAmount}
                    onChange={e => {
                      const val = e.target.value;
                      setInputAmount(val === '' ? '' : Math.max(0, parseFloat(val)));
                    }}
                    placeholder={`المتبقي الحالي: ${activeRecord.remainingAmount}`}
                    className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-left transition-all"
                    dir="ltr"
                    autoFocus
                  />
                </div>

                {/* Quick Fill Buttons */}
                {activeRecord.remainingAmount > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] text-slate-400 font-bold">تعبئة سريعة:</span>
                    <button
                      type="button"
                      onClick={() => setInputAmount(activeRecord.remainingAmount)}
                      className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-extrabold transition-colors cursor-pointer"
                    >
                      تسديد كامل المتبقي (${activeRecord.remainingAmount})
                    </button>
                    {activeRecord.remainingAmount >= 20 && (
                      <button
                        type="button"
                        onClick={() => setInputAmount(Math.round(activeRecord.remainingAmount / 2))}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        50% (${Math.round(activeRecord.remainingAmount / 2)})
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Driver & Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    اسم السائق المسؤول عن التحصيل
                  </label>
                  <input
                    type="text"
                    value={inputDriver}
                    onChange={e => setInputDriver(e.target.value)}
                    placeholder="مثال: علي كريم / أحمد النجار..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    طريقة التحصيل
                  </label>
                  <select
                    value={inputMethod}
                    onChange={e => setInputMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  >
                    <option value="نقد">💵 نقداً (كاش)</option>
                    <option value="حوالة">🏦 حوالة مصرفية</option>
                    <option value="زين كاش">📱 زين كاش / محفظة</option>
                    <option value="شيك">📜 شيك</option>
                    <option value="أخرى">🔹 أخرى</option>
                  </select>
                </div>
              </div>

              {/* Receipt Number (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم الوصل أو سند القبض (اختياري)
                </label>
                <input
                  type="text"
                  value={inputReceiptNo}
                  onChange={e => setInputReceiptNo(e.target.value)}
                  placeholder="مثال: REC-90412"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>

              {/* Dynamic Status Notification Alert */}
              <div>
                {dynamicPaymentPreview.newRemaining > 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-amber-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      ⚠️ يوجد مبلغ متبقي (دين على الزبون): <strong className="font-mono text-sm" dir="ltr">${dynamicPaymentPreview.newRemaining.toFixed(2)}</strong>
                    </span>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      ✅ الحساب خالص بالكامل (لا توجد أي ديون متبقية).
                    </span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ملاحظات إضافية (موعد السداد القادم، سبب تأجيل الباقي...)
                </label>
                <textarea
                  rows={2}
                  value={inputNotes}
                  onChange={e => setInputNotes(e.target.value)}
                  placeholder="اكتب أي ملاحظات تتعلق بالاستحصال أو موعد سداد الدفعة التالية..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                ></textarea>
              </div>

              {/* Save Success Alert */}
              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce">
                  <Check className="w-4 h-4 text-emerald-700" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>حفظ وتحديث الحالة المالية فوراً</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: Payment History (سجل الدفعات والاستحصالات السابقة) */}
      {historyModalOpen && historyRecord && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden text-right">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md font-bold">
                  <History className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    سجل دفعات الشحنة: <span className="text-amber-400 font-mono">{historyRecord.shipmentCode}</span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    الزبون: {historyRecord.clientName} ({historyRecord.clientCode})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintPaymentStatement(historyRecord)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                  title="طباعة كشف حساب واستحصالات الشحنة"
                >
                  <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>طباعة الكشف</span>
                </button>
                <button
                  onClick={() => setHistoryModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {/* Financial Quick Glance */}
              <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-400 block text-[10px]">الكلي المطلوب</span>
                  <span className="font-black text-slate-800 text-sm" dir="ltr">${historyRecord.totalAmount.toFixed(2)}</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-emerald-700 block text-[10px]">المستحصل</span>
                  <span className="font-black text-emerald-700 text-sm" dir="ltr">${historyRecord.collectedAmount.toFixed(2)}</span>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <span className="text-rose-700 block text-[10px]">المتبقي (الدين)</span>
                  <span className="font-black text-rose-700 text-sm" dir="ltr">${historyRecord.remainingAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* History Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">التاريخ والوقت</th>
                      <th className="py-2.5 px-3 text-left">المبلغ المستلم</th>
                      <th className="py-2.5 px-3">السائق المسؤول</th>
                      <th className="py-2.5 px-3">طريقة الدفع</th>
                      <th className="py-2.5 px-3">الملاحظات</th>
                      <th className="py-2.5 px-3 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {historyRecord.payments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          لم يتم تسجيل أي دفعات سابقة لهذه الشحنة حتى الآن.
                        </td>
                      </tr>
                    ) : (
                      historyRecord.payments.map(pay => (
                        <tr key={pay.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-slate-600 font-semibold">{pay.date}</td>
                          <td className="py-2.5 px-3 text-left font-black text-emerald-700" dir="ltr">
                            ${pay.amount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800 font-bold">{pay.driverName || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-600">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold">
                              {pay.paymentMethod}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-[150px] truncate" title={pay.notes}>
                            {pay.notes || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => handleDeletePayment(pay.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                              title="حذف هذه الدفعة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200">
                <div className="text-xs text-slate-500 font-medium text-center sm:text-right">
                  كشف حساب واستحصالات الشحنة معتمد للطباعة الفورية الرسمية
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => handlePrintPaymentStatement(historyRecord)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4 stroke-[2.5]" />
                    <span>طباعة الكشف</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryModalOpen(false)}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Delete & Movement Revert Management Modal */}
      {deleteModalOpen && deleteTargetRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-rose-600 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-700 rounded-xl">
                  <Trash2 className="w-5 h-5 text-rose-100" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg">
                    إدارة حذف وتعديل الحركات المالية
                  </h3>
                  <p className="text-xs text-rose-100">
                    الشحنة: <strong className="text-white">{deleteTargetRecord.shipmentCode}</strong> — الزبون: <strong className="text-white">{deleteTargetRecord.clientName}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="p-1.5 text-rose-200 hover:text-white rounded-lg hover:bg-rose-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Financial Status Summary */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <div>
                  <span className="text-[10px] text-slate-500 block">المطلوب</span>
                  <span className="font-black text-sm text-slate-800" dir="ltr">${deleteTargetRecord.totalAmount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 block">المستحصل حالياً</span>
                  <span className="font-black text-sm text-emerald-700" dir="ltr">${deleteTargetRecord.collectedAmount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-rose-600 block">المتبقي (الدين)</span>
                  <span className="font-black text-sm text-rose-700" dir="ltr">${deleteTargetRecord.remainingAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Safety notice banner */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>تنبيه الأمان المالي:</strong> لن يتم مسح بيانات الشحنة أو جميع الاستحصالات، بل سيتم حذف الحركة المحددة فقط وإعادة احتساب المتبقي والمستحصل فورياً.
                </div>
              </div>

              {/* Quick Undo Action for Latest Payment */}
              {deleteTargetRecord.payments && deleteTargetRecord.payments.length > 0 && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-rose-900">
                      التراجع عن آخر حركة استحصال (سريعة):
                    </span>
                    <span className="text-xs font-black text-rose-700" dir="ltr">
                      ${deleteTargetRecord.payments[0].amount.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-800">
                    التاريخ: {deleteTargetRecord.payments[0].date} — السائق: {deleteTargetRecord.payments[0].driverName || '—'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`هل أنت متأكد من التراجع عن آخر دفعة بقيمة $${deleteTargetRecord.payments[0].amount.toFixed(2)}؟`)) {
                        handleDeleteLastPayment(deleteTargetRecord);
                      }
                    }}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>إلغاء آخر دفعة فقط وإعادة احتساب الدين</span>
                  </button>
                </div>
              )}

              {/* All Individual Payments List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>قائمة الحركات والدفعات المسجلة ({deleteTargetRecord.payments?.length || 0}):</span>
                </h4>
                <div className="max-h-56 overflow-y-auto space-y-2 divide-y divide-slate-100">
                  {(!deleteTargetRecord.payments || deleteTargetRecord.payments.length === 0) ? (
                    <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl">
                      لا توجد أي حركات دفع مسجلة حالياً لهذه الشحنة.
                    </p>
                  ) : (
                    deleteTargetRecord.payments.map((p, idx) => (
                      <div
                        key={p.id}
                        className="pt-2 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">دفعة #{idx + 1}</span>
                            <span className="font-black text-emerald-700" dir="ltr">${p.amount.toFixed(2)}</span>
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600 font-semibold">{p.paymentMethod}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {p.date} • السائق: {p.driverName || '—'} {p.notes ? `• ${p.notes}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف هذه الدفعة المحددة بقيمة $${p.amount.toFixed(2)}؟`)) {
                              handleDeleteSpecificPayment(deleteTargetRecord.id, p.id);
                            }
                          }}
                          className="px-2.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                          title="حذف هذه الدفعة وإعادة احتساب الرصيد"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
