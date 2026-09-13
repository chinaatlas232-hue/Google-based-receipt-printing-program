import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ClipboardList, 
  Printer, 
  FileSpreadsheet, 
  Search, 
  Check, 
  Warehouse,
  CheckCircle2,
  Save,
  RotateCcw,
  CheckCheck,
  AlertTriangle,
  ArrowRight,
  Clock,
  Sparkles,
  Filter,
  X,
  MessageSquare,
  Eye,
  CheckSquare,
  Square,
  Truck,
  Bell,
  UserCheck,
  CalendarClock,
  Volume2,
  VolumeX,
  Radio,
  Users,
  UserCog,
  RefreshCw,
  ExternalLink,
  Ship,
  Plane,
  Calendar,
  DollarSign,
  ChevronDown,
  MessageCircle,
  Send,
  Share2,
  Copy,
  History,
  ListChecks,
  Tag,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
  Percent,
  FileText
} from 'lucide-react';
import { ShipmentRecord } from '../types';
import { COMPANY_INFO } from '../data/initialData';
import { exportYardInventoryToExcel } from '../utils/excel';

export const YARD_INVENTORY_STORAGE_KEY = 'ocean_atlas_yard_inventory_draft_v2';

export interface DispatchedInfo {
  dispatched: boolean;
  time: string;
  date?: string;
  fullDateTime?: string;
  user?: string;
}

export interface YardDraftData {
  lastSavedAt: string;
  checkedItems: Record<string, boolean>;
  actualCounts: Record<string, number | ''>;
  itemNotes: Record<string, string>;
  dispatchedItems?: Record<string, DispatchedInfo>;
  entryDates?: Record<string, string>;
}

export interface TeamActivityAlert {
  id: string;
  deviceId?: string;
  userName: string;
  action: string;
  itemCode: string;
  customerName?: string;
  shipment?: string;
  itemId?: string;
  time: string;
  isExternalDevice?: boolean;
}

export interface YardAuditLog {
  id: string;
  itemId?: string;
  code?: string;
  clientName?: string;
  shipment?: string;
  userName: string;
  action: string;
  timestamp: string;
}

// Utility: Normalize and convert any Eastern Arabic / Persian numerals (٠-٩) to standard English numerals (0-9)
export function toLatinDigits(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  return str
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776));
}

export const getDaysInYard = (item: ShipmentRecord): number => {
  if (['RQ6025', 'RA6048', 'WA6053', 'RA6057', 'RQ6038'].includes(item.shipment)) {
    const hash = (item.id + item.code).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return 6 + (hash % 8); // 6 to 13 days
  }
  if (item.shipment === 'RA6062') return 4;
  if (item.shipment === 'RA6064') return 2;
  const hash = item.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return (hash % 5) + 1; // 1 to 5 days
};

export const getDefaultEntryDate = (item: ShipmentRecord): string => {
  const days = getDaysInYard(item);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

export const calculateDaysInYard = (entryDateStr?: string, fallbackItem?: ShipmentRecord): number => {
  if (entryDateStr) {
    try {
      const parts = entryDateStr.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const entryTime = new Date(y, m, d).setHours(0, 0, 0, 0);
        const nowTime = new Date().setHours(0, 0, 0, 0);
        if (!isNaN(entryTime)) {
          const diff = Math.floor((nowTime - entryTime) / (1000 * 60 * 60 * 24));
          return Math.max(0, diff);
        }
      }
    } catch {
      // fallback
    }
  }
  return fallbackItem ? getDaysInYard(fallbackItem) : 1;
};

interface YardInventoryViewProps {
  shipments: ShipmentRecord[];
  onNavigateToDashboard?: () => void;
}

export const YardInventoryView: React.FC<YardInventoryViewProps> = ({ 
  shipments, 
  onNavigateToDashboard 
}) => {
  // Freight Type Selection: All / Sea / Air
  const [freightType, setFreightType] = useState<'all' | 'sea' | 'air'>('all');

  const availableShipments = useMemo(() => {
    let list = shipments;
    if (freightType === 'sea') {
      list = list.filter(s => {
        const sh = (s.shipment || '').toUpperCase();
        const ty = (s.type || '').toLowerCase();
        return sh.startsWith('RQ') || sh.includes('RQ') || ty.includes('بحري') || ty.includes('sea') || ty.includes('حاوية');
      });
    } else if (freightType === 'air') {
      list = list.filter(s => {
        const sh = (s.shipment || '').toUpperCase();
        const ty = (s.type || '').toLowerCase();
        return sh.startsWith('RA') || sh.includes('RA') || ty.includes('جوي') || ty.includes('air') || ty.includes('طيران');
      });
    }
    const unique = Array.from(new Set(list.map(s => s.shipment))).filter(Boolean);
    return unique.sort();
  }, [shipments, freightType]);

  // Retain last selected shipment and last search query in localStorage (Directive #11 & #12)
  const [selectedShipment, setSelectedShipment] = useState<string>(() => {
    return localStorage.getItem('atlas_yard_last_selected_shipment') || 'الكل';
  });

  const [searchQuery, setSearchQuery] = useState<string>(() => {
    return localStorage.getItem('atlas_yard_last_search_query') || '';
  });

  const [shipmentSearchTerm, setShipmentSearchTerm] = useState<string>('');
  const [isShipmentDropdownOpen, setIsShipmentDropdownOpen] = useState<boolean>(false);

  // Persistence effects for search and shipment
  useEffect(() => {
    try {
      localStorage.setItem('atlas_yard_last_selected_shipment', selectedShipment);
    } catch {}
  }, [selectedShipment]);

  useEffect(() => {
    try {
      localStorage.setItem('atlas_yard_last_search_query', searchQuery);
    } catch {}
  }, [searchQuery]);

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'audited' | 'mismatch' | 'overdue' | 'dispatched' | 'in_yard'>('all');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  // User identity & device identifier for cross-device synchronization
  const [currentUserName, setCurrentUserName] = useState<string>(() => {
    return localStorage.getItem('atlas_yard_user_name') || 'أمين المستودع (محمد)';
  });
  const [deviceId] = useState<string>(() => {
    let id = localStorage.getItem('atlas_yard_device_id');
    if (!id) {
      id = 'device_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('atlas_yard_device_id', id);
    }
    return id;
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('atlas_yard_sound_enabled') !== 'false';
  });

  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [recentlyModifiedItems, setRecentlyModifiedItems] = useState<Record<string, { userName: string; time: string; action: string; timestamp: number }>>({});
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const lastSyncPollTimestampRef = useRef<number>(Date.now());

  // 1. Load Draft from localStorage on initialization
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as YardDraftData;
        return parsed.checkedItems || {};
      }
    } catch (e) {
      console.warn('Failed to parse saved yard draft', e);
    }
    return {};
  });

  const [actualCounts, setActualCounts] = useState<Record<string, number | ''>>(() => {
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as YardDraftData;
        return parsed.actualCounts || {};
      }
    } catch (e) {
      console.warn('Failed to parse saved yard draft counts', e);
    }
    return {};
  });

  const [itemNotes, setItemNotes] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as YardDraftData;
        return parsed.itemNotes || {};
      }
    } catch (e) {
      console.warn('Failed to parse saved yard draft notes', e);
    }
    return {};
  });

  const [dispatchedItems, setDispatchedItems] = useState<Record<string, DispatchedInfo>>(() => {
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as YardDraftData;
        return parsed.dispatchedItems || {};
      }
    } catch (e) {
      console.warn('Failed to parse saved dispatched items', e);
    }
    return {};
  });

  // Entry Dates for each item
  const [entryDates, setEntryDates] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as YardDraftData;
        return parsed.entryDates || {};
      }
    } catch (e) {
      console.warn('Failed to parse entryDates from draft', e);
    }
    return {};
  });

  // Global Date Picker for unified shipment entry date
  const [batchEntryDate, setBatchEntryDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // 1. Batch Selection for Bulk Actions
  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>({});

  // 2. Advanced Filtering: By Guarantor / Responsible Employee & Financial Status
  const [selectedGuarantor, setSelectedGuarantor] = useState<string>('الكل');
  const [financialFilter, setFinancialFilter] = useState<'all' | 'with_debt' | 'zero_debt' | 'high_debt'>('all');

  // 3. Client Communication (WhatsApp / Telegram Alerts)
  const [activeMessageClient, setActiveMessageClient] = useState<ShipmentRecord | null>(null);
  const [messageTemplate, setMessageTemplate] = useState<'ready' | 'overdue' | 'mismatch' | 'debt'>('ready');
  const [customMessageText, setCustomMessageText] = useState<string>('');

  // 4. Audit Trail Tracking Modal
  const [auditTrailItem, setAuditTrailItem] = useState<ShipmentRecord | null>(null);
  const [showFullAuditModal, setShowFullAuditModal] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<YardAuditLog[]>(() => {
    try {
      const raw = localStorage.getItem('atlas_yard_audit_logs');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  const handleClearBatchSelection = () => {
    setSelectedItemIds({});
  };

  // 5. Accounting & Inventory Report Export Modal
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // 6. Tools & Actions Dropdown (Far Left)
  const [isToolsDropdownOpen, setIsToolsDropdownOpen] = useState<boolean>(false);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(event.target as Node)) {
        setIsToolsDropdownOpen(false);
      }
    };
    if (isToolsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isToolsDropdownOpen]);

  // 7. Quick Note Tags Popover
  const [activeNoteTagItemId, setActiveNoteTagItemId] = useState<string | null>(null);

  // Quick note preset tags
  const QUICK_NOTE_TAGS = [
    '📦 تلف في التعبئة والكرتون',
    '⚠️ نقص في محتويات الطرد',
    '🔍 تم فتح الكرتون والفحص',
    '⏳ بانتظار تعليمات الكفيل',
    '✅ طرود سليمة ومغلفة بالكامل',
    '🏷️ ملصق الكود غير واضح'
  ];

  // Synchronize batchEntryDate when selectedShipment changes
  useEffect(() => {
    if (selectedShipment && selectedShipment !== 'الكل') {
      const matchingItem = shipments.find(s => (s.shipment || '').trim() === selectedShipment.trim());
      if (matchingItem) {
        const existing = entryDates[matchingItem.id];
        if (existing) {
          setBatchEntryDate(existing);
        } else {
          setBatchEntryDate(getDefaultEntryDate(matchingItem));
        }
      }
    }
  }, [selectedShipment, shipments]);

  // Apply unified entry date to all items in current shipment (Global Date Picker)
  const handleApplyBatchEntryDate = (dateToApply: string) => {
    if (!dateToApply) return;
    
    const targetItems = selectedShipment !== 'الكل'
      ? shipments.filter(s => (s.shipment || '').trim() === selectedShipment.trim())
      : filteredItems;

    if (targetItems.length === 0) {
      setToastMessage('يرجى اختيار شحنة أولاً لتطبيق تاريخ الدخول الموحد لبنودها');
      return;
    }

    const updatedEntryDates: Record<string, string> = { ...entryDates };
    targetItems.forEach(item => {
      updatedEntryDates[item.id] = dateToApply;
    });

    setEntryDates(updatedEntryDates);

    const timeStr = toLatinDigits(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    const dateStr = toLatinDigits(new Date().toISOString().slice(0, 10));
    const fullTimeStr = `${dateStr} - ${timeStr}`;

    // Immediately save to localStorage draft
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      const updatedDraft = {
        ...prev,
        entryDates: updatedEntryDates,
        lastSavedAt: fullTimeStr
      };
      localStorage.setItem(YARD_INVENTORY_STORAGE_KEY, JSON.stringify(updatedDraft));
      setLastSavedTime(fullTimeStr);
    } catch (e) {
      console.warn('Failed to save batch entry dates to draft', e);
    }

    const daysDiff = calculateDaysInYard(dateToApply);
    const shipmentLabel = selectedShipment !== 'الكل' ? `الشحنة [${selectedShipment}]` : 'كافة البنود المعروضة';
    const actionText = `تثبيت تاريخ دخول موحد (${dateToApply}) لـ ${targetItems.length} بند بـ ${shipmentLabel}`;

    // Broadcast to other open browser tabs
    try {
      const bc = new BroadcastChannel('atlas_yard_sync_channel');
      bc.postMessage({
        type: 'YARD_UPDATE',
        id: 'bc_batch_' + Date.now(),
        deviceId,
        userName: currentUserName,
        shipment: selectedShipment,
        action: actionText,
        time: timeStr,
        changes: {
          allSaved: true,
          entryDates: updatedEntryDates
        }
      });
      bc.close();
    } catch {}

    // Post to backend server
    fetch('/api/yard-inventory/batch-entry-date', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        userName: currentUserName,
        shipment: selectedShipment,
        entryDate: dateToApply,
        itemIds: targetItems.map(it => it.id),
        action: actionText
      })
    }).catch(() => {
      fetch('/api/yard-inventory/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          userName: currentUserName,
          entryDates: updatedEntryDates,
          action: actionText
        })
      }).catch(() => {});
    });

    setToastMessage(`✅ تم تثبيت تاريخ الدخول الموحد (${dateToApply}) بنجاح على ${targetItems.length} بند بـ ${shipmentLabel} (تساوي ${daysDiff} ${daysDiff === 1 ? 'يوم' : 'أيام'} بالساحة). تم تحديث العدادات تلقائياً.`);
  };

  const [lastSavedTime, setLastSavedTime] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as YardDraftData;
        return parsed.lastSavedAt || null;
      }
    } catch {
      // ignore
    }
    return null;
  });

  // 1-minute auto-save timestamp indicator
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string | null>(null);

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real-time team collaboration alerts
  const [activeAlert, setActiveAlert] = useState<TeamActivityAlert | null>(null);
  const [teamAlerts, setTeamAlerts] = useState<TeamActivityAlert[]>([]);
  const [showAlertsDrawer, setShowAlertsDrawer] = useState(false);

  // Web Audio API Synthesizer Chime for subtle, pleasant sound alerts
  const playChimeSound = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      // Tone 1: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.09, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.28);

      // Tone 2: B5 (987.77 Hz) - bright harmonic chime
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.09);
      gain2.gain.setValueAtTime(0.12, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.55);
    } catch {
      // audio might be blocked by browser policy until interaction
    }
  };

  // Process incoming update from another user or another device
  const handleIncomingRemoteEvent = (event: any, isFromRemoteServer = true) => {
    if (!event || !event.id) return;
    // Do not show self-generated alerts
    if (event.deviceId === deviceId) return;

    const formattedTime = toLatinDigits(event.time || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));

    const alert: TeamActivityAlert = {
      id: event.id,
      deviceId: event.deviceId,
      userName: event.userName || 'زميل في الفريق',
      action: event.action,
      itemCode: event.itemCode,
      customerName: event.customerName,
      shipment: event.shipment,
      itemId: event.itemId,
      time: formattedTime,
      isExternalDevice: isFromRemoteServer
    };

    // Trigger visual notification banner
    setActiveAlert(alert);

    // Add to team alerts log
    setTeamAlerts(prev => {
      if (prev.some(p => p.id === alert.id)) return prev;
      return [alert, ...prev.slice(0, 49)];
    });

    // Play pleasant chime
    playChimeSound();

    // Mark item with pulse highlighting in table
    if (event.itemId) {
      setRecentlyModifiedItems(prev => ({
        ...prev,
        [event.itemId]: {
          userName: event.userName,
          time: formattedTime,
          action: event.action,
          timestamp: Date.now()
        }
      }));
    }

    // Seamlessly merge incoming remote data changes
    if (event.changes) {
      if (event.changes.allSaved) {
        if (event.changes.checkedItems) setCheckedItems(event.changes.checkedItems);
        if (event.changes.actualCounts) setActualCounts(event.changes.actualCounts);
        if (event.changes.itemNotes) setItemNotes(event.changes.itemNotes);
        if (event.changes.dispatchedItems) setDispatchedItems(event.changes.dispatchedItems);
        if (event.changes.entryDates) setEntryDates(event.changes.entryDates);
      } else if (event.itemId) {
        if (event.changes.actualCount !== undefined) {
          setActualCounts(prev => ({ ...prev, [event.itemId]: event.changes.actualCount }));
        }
        if (event.changes.checked !== undefined) {
          setCheckedItems(prev => ({ ...prev, [event.itemId]: event.changes.checked }));
        }
        if (event.changes.dispatched !== undefined) {
          setDispatchedItems(prev => ({ ...prev, [event.itemId]: event.changes.dispatched }));
        }
        if (event.changes.entryDate !== undefined) {
          setEntryDates(prev => ({ ...prev, [event.itemId]: event.changes.entryDate }));
        }
        if (event.changes.note !== undefined) {
          setItemNotes(prev => ({ ...prev, [event.itemId]: event.changes.note }));
        }
      }
    }
  };

  // Cross-device server synchronization: initial load + SSE real-time stream + fallback polling
  useEffect(() => {
    let sse: EventSource | null = null;
    let pollInterval: any = null;

    // 1. Initial fetch from server
    const fetchInitialServerState = async () => {
      try {
        const res = await fetch('/api/yard-inventory');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.state) {
            const state = data.state;
            if (state.checkedItems && Object.keys(state.checkedItems).length > 0) {
              setCheckedItems(prev => ({ ...state.checkedItems, ...prev }));
            }
            if (state.actualCounts && Object.keys(state.actualCounts).length > 0) {
              setActualCounts(prev => ({ ...state.actualCounts, ...prev }));
            }
            if (state.itemNotes && Object.keys(state.itemNotes).length > 0) {
              setItemNotes(prev => ({ ...state.itemNotes, ...prev }));
            }
            if (state.dispatchedItems && Object.keys(state.dispatchedItems).length > 0) {
              setDispatchedItems(prev => ({ ...state.dispatchedItems, ...prev }));
            }
            if (state.entryDates && Object.keys(state.entryDates).length > 0) {
              setEntryDates(prev => ({ ...state.entryDates, ...prev }));
            }
            if (state.itemLastModified && typeof state.itemLastModified === 'object') {
              setRecentlyModifiedItems(prev => ({ ...state.itemLastModified, ...prev }));
            }
            if (state.history && Array.isArray(state.history)) {
              setTeamAlerts(state.history.slice(0, 30));
            }
            if (state.lastSavedAt) {
              setLastSavedTime(toLatinDigits(state.lastSavedAt));
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch initial yard inventory state:', err);
      }
    };

    fetchInitialServerState();

    // 2. Connect to Server-Sent Events for instant push notifications
    try {
      sse = new EventSource('/api/yard-inventory/events');
      sse.onopen = () => {
        setIsLiveConnected(true);
      };
      sse.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'INIT') {
            setIsLiveConnected(true);
          } else if (payload.type === 'YARD_UPDATE' && payload.event) {
            lastSyncPollTimestampRef.current = payload.event.timestamp || Date.now();
            handleIncomingRemoteEvent(payload.event, true);
          }
        } catch (err) {
          console.error('Error parsing SSE yard event', err);
        }
      };
      sse.onerror = () => {
        setIsLiveConnected(false);
      };
    } catch (err) {
      console.warn('SSE connection error:', err);
    }

    // 3. Fallback polling every 3.5 seconds to guarantee 100% sync reliability
    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/yard-inventory/poll?since=${lastSyncPollTimestampRef.current}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setIsLiveConnected(true);
            if (Array.isArray(data.newEvents) && data.newEvents.length > 0) {
              data.newEvents.forEach((ev: any) => {
                if (ev.timestamp > lastSyncPollTimestampRef.current) {
                  lastSyncPollTimestampRef.current = ev.timestamp;
                }
                handleIncomingRemoteEvent(ev, true);
              });
            }
          }
        }
      } catch {
        // network hiccup
      }
    }, 3500);

    // 4. Same-browser cross-tab BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('atlas_yard_sync_channel');
      bc.onmessage = (event) => {
        if (event.data && event.data.type === 'YARD_UPDATE') {
          handleIncomingRemoteEvent(event.data, false);
        }
      };
    } catch {
      // ignore
    }

    return () => {
      if (sse) sse.close();
      if (pollInterval) clearInterval(pollInterval);
      if (bc) bc.close();
    };
  }, [deviceId]);

  // Clean up old row highlight marks after 40 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRecentlyModifiedItems(prev => {
        const next: typeof prev = {};
        let changed = false;
        Object.keys(prev).forEach(key => {
          const item = prev[key];
          if (item && now - item.timestamp < 40000) {
            next[key] = item;
          } else {
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Sync item update with BroadcastChannel and Backend Server API
  const syncItemUpdate = async (item: ShipmentRecord, actionText: string, changes: any) => {
    const time = toLatinDigits(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    
    // Save to local audit logs
    const newLog: YardAuditLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      itemId: item.id,
      code: item.code,
      clientName: item.name,
      shipment: item.shipment,
      userName: currentUserName,
      action: actionText,
      timestamp: `${toLatinDigits(new Date().toISOString().slice(0, 10))} ${time}`
    };
    setAuditLogs(prev => {
      const updated = [newLog, ...prev.slice(0, 199)];
      try {
        localStorage.setItem('atlas_yard_audit_logs', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Broadcast locally between tabs
    try {
      const bc = new BroadcastChannel('atlas_yard_sync_channel');
      bc.postMessage({
        type: 'YARD_UPDATE',
        id: 'bc_' + Date.now(),
        deviceId,
        userName: currentUserName,
        itemId: item.id,
        itemCode: item.code,
        customerName: item.name,
        shipment: item.shipment,
        action: actionText,
        time,
        changes
      });
      bc.close();
    } catch {
      // ignore
    }

    // Push to backend server for other devices & teams
    try {
      await fetch('/api/yard-inventory/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          userName: currentUserName,
          itemId: item.id,
          itemCode: item.code,
          customerName: item.name,
          shipment: item.shipment,
          action: actionText,
          changes
        })
      });
    } catch (err) {
      console.warn('Could not push yard update to server:', err);
    }
  };

  // Scroll directly to item in table with focus ring
  const scrollToItem = (itemId?: string) => {
    if (!itemId) return;
    const el = document.getElementById(`yard-row-${itemId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-amber-500', 'bg-amber-100');
      setTimeout(() => {
        el.classList.remove('ring-4', 'ring-amber-500', 'bg-amber-100');
      }, 3500);
    }
  };

  // Toggle dispatched from yard
  const toggleDispatched = (item: ShipmentRecord) => {
    const isCurrentlyDispatched = !!dispatchedItems[item.id]?.dispatched;
    const now = new Date();
    const timeStr = toLatinDigits(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    const dateStr = toLatinDigits(now.toISOString().slice(0, 10));
    const fullDateTime = `${dateStr} ${timeStr}`;

    const nextState: DispatchedInfo = {
      dispatched: !isCurrentlyDispatched,
      time: timeStr,
      date: dateStr,
      fullDateTime: fullDateTime,
      user: currentUserName
    };

    setDispatchedItems(prev => {
      const updated = { ...prev, [item.id]: nextState };
      return updated;
    });

    const actionText = !isCurrentlyDispatched 
      ? `وضع إشارة تم إخراج البضاعة من الساحة (${item.packages} طرد) في [${fullDateTime}]`
      : `إلغاء إشارة إخراج البضاعة وإعادتها للساحة`;

    setToastMessage(`الشحنة ${item.code}: ${actionText}`);
    syncItemUpdate(item, actionText, { dispatched: nextState });
  };

  // Interactive Simulation of teammate update from another device
  const handleSimulateRemoteUpdate = async () => {
    setIsSimulating(true);
    const demoTeammates = [
      'مشرف الساحة (أحمد الموسوي)',
      'أمين المستودع (علي كاظم)',
      'مراقب التدقيق (حسين البصري)',
      'مسؤول تفريغ الحاويات (عمر الورد)'
    ];
    const chosenUser = demoTeammates[Math.floor(Math.random() * demoTeammates.length)];
    const candidate = filteredItems[Math.floor(Math.random() * filteredItems.length)] || baseItems[0];
    
    if (!candidate) {
      setIsSimulating(false);
      return;
    }

    const currentCount = actualCounts[candidate.id] !== undefined && actualCounts[candidate.id] !== '' 
      ? Number(actualCounts[candidate.id]) 
      : candidate.packages;
    const newCount = Math.max(1, currentCount + (Math.random() > 0.5 ? 2 : -1));
    const demoAction = `تعديل ومطابقة الجرد الفعلي إلى (${newCount}) طرد`;

    try {
      const res = await fetch('/api/yard-inventory/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'remote_device_simulated_' + Math.random().toString(36).substring(2, 7),
          userName: chosenUser,
          itemId: candidate.id,
          itemCode: candidate.code,
          customerName: candidate.name,
          shipment: candidate.shipment,
          action: demoAction,
          changes: {
            actualCount: newCount,
            checked: true
          }
        })
      });
      const data = await res.json();
      if (data.success && data.event) {
        handleIncomingRemoteEvent(data.event, true);
        setToastMessage(`🔔 تم استقبال إشعار تفاعلي فوري من جهاز آخر: [${chosenUser}] قام بتعديل (${candidate.code})`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  // 3. Automatic background synchronization to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const now = new Date();
        const timeStr = toLatinDigits(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        const dateStr = toLatinDigits(now.toISOString().slice(0, 10));
        const fullTimeStr = `${dateStr} - ${timeStr}`;

        const draft: YardDraftData = {
          lastSavedAt: fullTimeStr,
          checkedItems,
          actualCounts,
          itemNotes,
          dispatchedItems,
          entryDates
        };
        localStorage.setItem(YARD_INVENTORY_STORAGE_KEY, JSON.stringify(draft));
        setLastSavedTime(fullTimeStr);
      } catch (err) {
        console.error('Error saving yard draft to localStorage', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [checkedItems, actualCounts, itemNotes, dispatchedItems, entryDates]);

  // 1-minute periodic auto-save to localStorage and backend (Directive #6)
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      try {
        const now = new Date();
        const timeStr = toLatinDigits(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        const dateStr = toLatinDigits(now.toISOString().slice(0, 10));
        const fullTimeStr = `${dateStr} - ${timeStr}`;

        const draft: YardDraftData = {
          lastSavedAt: fullTimeStr,
          checkedItems,
          actualCounts,
          itemNotes,
          dispatchedItems,
          entryDates
        };
        localStorage.setItem(YARD_INVENTORY_STORAGE_KEY, JSON.stringify(draft));
        setLastSavedTime(fullTimeStr);
        setLastAutoSaveTime(timeStr);

        fetch('/api/yard-inventory/save-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId,
            userName: currentUserName,
            draft,
            checkedItems,
            actualCounts,
            itemNotes,
            dispatchedItems,
            entryDates,
            action: 'حفظ تلقائي دوري كل 1 دقيقة'
          })
        }).catch(() => {});
      } catch (err) {
        console.warn('Auto save error:', err);
      }
    }, 60000); // 1 minute interval

    return () => clearInterval(autoSaveInterval);
  }, [checkedItems, actualCounts, itemNotes, dispatchedItems, entryDates, deviceId, currentUserName]);

  // Flash toast and active alert auto-dismiss
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    if (!activeAlert) return;
    const t = setTimeout(() => setActiveAlert(null), 7000);
    return () => clearTimeout(t);
  }, [activeAlert]);

  // Unique list of guarantors for advanced filtering
  const availableGuarantors = useMemo(() => {
    const set = new Set<string>();
    shipments.forEach(s => {
      if (s.guarantor && s.guarantor.trim()) {
        set.add(s.guarantor.trim());
      }
    });
    return Array.from(set).sort();
  }, [shipments]);

  // 3. Computed items with Advanced Filtering (Guarantor & Financial Status)
  const baseItems = useMemo(() => {
    return shipments.filter(s => {
      // Freight type filtering
      if (freightType === 'sea') {
        const sh = (s.shipment || '').toUpperCase();
        const ty = (s.type || '').toLowerCase();
        const isSea = sh.startsWith('RQ') || sh.includes('RQ') || ty.includes('بحري') || ty.includes('sea') || ty.includes('حاوية');
        if (!isSea) return false;
      } else if (freightType === 'air') {
        const sh = (s.shipment || '').toUpperCase();
        const ty = (s.type || '').toLowerCase();
        const isAir = sh.startsWith('RA') || sh.includes('RA') || ty.includes('جوي') || ty.includes('air') || ty.includes('طيران');
        if (!isAir) return false;
      }

      const matchShip = selectedShipment === 'الكل' || s.shipment === selectedShipment;
      const matchSearch = searchQuery.trim() === '' ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.guarantor && s.guarantor.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.address && s.address.toLowerCase().includes(searchQuery.toLowerCase()));

      // Filter by Guarantor / Responsible employee
      const matchGuarantor = selectedGuarantor === 'الكل' || (s.guarantor && s.guarantor.trim() === selectedGuarantor.trim());

      // Filter by Financial Status
      let matchFinancial = true;
      const amount = Number(s.sales || 0);
      if (financialFilter === 'with_debt') {
        matchFinancial = amount > 0;
      } else if (financialFilter === 'zero_debt') {
        matchFinancial = amount === 0;
      } else if (financialFilter === 'high_debt') {
        matchFinancial = amount >= 500;
      }

      return matchShip && matchSearch && matchGuarantor && matchFinancial;
    });
  }, [shipments, selectedShipment, searchQuery, freightType, selectedGuarantor, financialFilter]);

  // Calculate days in yard with live entryDate support
  const getItemDays = (s: ShipmentRecord) => {
    const customDate = entryDates[s.id];
    return calculateDaysInYard(customDate, s);
  };

  // Statistics for current selection
  const totalItemsCount = baseItems.length;
  const auditedItemsCount = useMemo(() => {
    return baseItems.filter(s => !!checkedItems[s.id] || (actualCounts[s.id] !== undefined && actualCounts[s.id] !== '')).length;
  }, [baseItems, checkedItems, actualCounts]);

  const pendingItemsCount = totalItemsCount - auditedItemsCount;

  const mismatchItemsCount = useMemo(() => {
    return baseItems.filter(s => {
      const act = actualCounts[s.id];
      return act !== undefined && act !== '' && Number(act) !== s.packages;
    }).length;
  }, [baseItems, actualCounts]);

  const overdueItemsCount = useMemo(() => {
    return baseItems.filter(s => getItemDays(s) > 5 && !dispatchedItems[s.id]?.dispatched).length;
  }, [baseItems, dispatchedItems, entryDates]);

  const dispatchedItemsCount = useMemo(() => {
    return baseItems.filter(s => !!dispatchedItems[s.id]?.dispatched).length;
  }, [baseItems, dispatchedItems]);

  const inYardItemsCount = useMemo(() => {
    return baseItems.filter(s => !dispatchedItems[s.id]?.dispatched).length;
  }, [baseItems, dispatchedItems]);

  const filteredItems = useMemo(() => {
    return baseItems.filter(item => {
      const isChecked = !!checkedItems[item.id];
      const act = actualCounts[item.id];
      const hasActual = act !== undefined && act !== '';
      const isAudited = isChecked || hasActual;
      const isMismatch = hasActual && Number(act) !== item.packages;
      const isOverdue = getItemDays(item) > 5 && !dispatchedItems[item.id]?.dispatched;
      const isDispatched = !!dispatchedItems[item.id]?.dispatched;

      if (filterStatus === 'audited') return isAudited;
      if (filterStatus === 'pending') return !isAudited;
      if (filterStatus === 'mismatch') return isMismatch;
      if (filterStatus === 'overdue') return isOverdue;
      if (filterStatus === 'dispatched') return isDispatched;
      if (filterStatus === 'in_yard') return !isDispatched;
      return true;
    });
  }, [baseItems, filterStatus, checkedItems, actualCounts, dispatchedItems, entryDates]);

  // Financial KPIs & Visual Summary Calculations
  const totalFilteredSales = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + (Number(item.sales) || 0), 0);
  }, [filteredItems]);

  const totalShipmentSales = useMemo(() => {
    return baseItems.reduce((sum, item) => sum + (Number(item.sales) || 0), 0);
  }, [baseItems]);

  const dispatchedSales = useMemo(() => {
    return filteredItems
      .filter(item => !!dispatchedItems[item.id]?.dispatched)
      .reduce((sum, item) => sum + (Number(item.sales) || 0), 0);
  }, [filteredItems, dispatchedItems]);

  const remainingInYardSales = Math.max(0, totalFilteredSales - dispatchedSales);

  const healthyItemsCount = useMemo(() => {
    return filteredItems.filter(item => {
      const isChecked = !!checkedItems[item.id];
      const act = actualCounts[item.id];
      const hasActual = act !== undefined && act !== '';
      const isMismatch = hasActual && Number(act) !== item.packages;
      return isChecked && !isMismatch;
    }).length;
  }, [filteredItems, checkedItems, actualCounts]);

  const clientsWithDebtsCount = useMemo(() => {
    return filteredItems.filter(item => Number(item.sales || 0) > 0).length;
  }, [filteredItems]);

  const healthyPercentage = filteredItems.length > 0 
    ? Math.round((healthyItemsCount / filteredItems.length) * 100) 
    : 0;

  const mismatchPercentage = filteredItems.length > 0 
    ? Math.round((mismatchItemsCount / filteredItems.length) * 100) 
    : 0;

  const dispatchedSalesRate = totalFilteredSales > 0
    ? Math.round((dispatchedSales / totalFilteredSales) * 100)
    : 0;

  // Selected Count for Batch Actions
  const selectedCount = useMemo(() => {
    return Object.keys(selectedItemIds).filter(id => selectedItemIds[id]).length;
  }, [selectedItemIds]);

  const handleSelectAllVisible = (check: boolean) => {
    const updated: Record<string, boolean> = {};
    if (check) {
      filteredItems.forEach(item => {
        updated[item.id] = true;
      });
    }
    setSelectedItemIds(updated);
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedItemIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Batch Action 1: Approve Audit and Match for all selected
  const handleBatchApproveAudit = () => {
    const selectedList = filteredItems.filter(it => selectedItemIds[it.id]);
    if (selectedList.length === 0) return;

    const newChecks = { ...checkedItems };
    const newCounts = { ...actualCounts };

    selectedList.forEach(item => {
      newChecks[item.id] = true;
      newCounts[item.id] = item.packages;
    });

    setCheckedItems(newChecks);
    setActualCounts(newCounts);
    setSelectedItemIds({});

    const actionText = `اعتماد تدقيق ومطابقة جماعية لـ (${selectedList.length}) طرد بنجاح`;
    setToastMessage(`✅ ${actionText}`);

    fetch('/api/yard-inventory/save-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        userName: currentUserName,
        checkedItems: newChecks,
        actualCounts: newCounts,
        action: actionText
      })
    }).catch(() => {});
  };

  // Batch Action 2: Mark Yard Dispatch for all selected
  const handleBatchMarkDispatch = () => {
    const selectedList = filteredItems.filter(it => selectedItemIds[it.id]);
    if (selectedList.length === 0) return;

    const now = new Date();
    const timeStr = toLatinDigits(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    const dateStr = toLatinDigits(now.toISOString().slice(0, 10));
    const fullDateTime = `${dateStr} ${timeStr}`;

    const newDispatched = { ...dispatchedItems };
    selectedList.forEach(item => {
      newDispatched[item.id] = {
        dispatched: true,
        time: timeStr,
        date: dateStr,
        fullDateTime,
        user: currentUserName
      };
    });

    setDispatchedItems(newDispatched);
    setSelectedItemIds({});

    const actionText = `تسجيل إشارة إخراج جماعية لـ (${selectedList.length}) طرد في [${fullDateTime}]`;
    setToastMessage(`🚚 ${actionText}`);

    fetch('/api/yard-inventory/save-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        userName: currentUserName,
        dispatchedItems: newDispatched,
        action: actionText
      })
    }).catch(() => {});
  };

  // Batch Action 3: Apply Entry Date to Selected Items
  const handleBatchApplyDateToSelected = (dateToApply: string) => {
    const selectedList = filteredItems.filter(it => selectedItemIds[it.id]);
    if (selectedList.length === 0 || !dateToApply) return;

    const updatedEntryDates: Record<string, string> = { ...entryDates };
    selectedList.forEach(item => {
      updatedEntryDates[item.id] = dateToApply;
    });

    setEntryDates(updatedEntryDates);
    setSelectedItemIds({});

    const actionText = `تطبيق تاريخ دخول (${dateToApply}) على (${selectedList.length}) طرد محدد`;
    setToastMessage(`📅 ${actionText}`);

    fetch('/api/yard-inventory/batch-entry-date', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        userName: currentUserName,
        entryDate: dateToApply,
        itemIds: selectedList.map(it => it.id),
        action: actionText
      })
    }).catch(() => {});
  };

  // Generate Smart Pre-formatted Notification Messages for Clients
  const getPreformattedMessage = (item: ShipmentRecord, type: 'ready' | 'overdue' | 'mismatch' | 'debt'): string => {
    const cleanPhone = (item.phone || item.phone2 || '').trim();
    const itemEntry = entryDates[item.id] || getDefaultEntryDate(item);
    const days = calculateDaysInYard(itemEntry, item);
    const actual = actualCounts[item.id] !== undefined && actualCounts[item.id] !== '' ? actualCounts[item.id] : item.packages;
    const debt = Number(item.sales || 0);

    if (type === 'ready') {
      return `السلام عليكم ورحمة الله وبركاته، الأخ الكريم / ${item.name} المحترم.\nتحية طيبة من شركة أطلس المحيط للشحن الدولي والتخليص الجمركي 🚢✈️.\n\nيسرنا إعلامكم بأن بضاعتكم شحنة [${item.shipment}] بالكود [${item.code}] بعدد (${item.packages} طرد) جاهزة ومفحوصة للاستلام في ساحة ومستودع الشركة.\nالمبلغ المستحق: $${debt.toLocaleString()}\nالعنوان: ${item.address || item.city}\n\nيرجى التفضل بالحضور للاستلام، مع خالص التقدير.`;
    }

    if (type === 'overdue') {
      return `تنبيه ومتابعة بضاعة في الساحة - شركة أطلس المحيط.\nالأخ الكريم / ${item.name} المحترم (الكود: ${item.code}).\n\nنود لفت عنايتكم الكريمة إلى أن بضاعتكم في شحنة [${item.shipment}] بعدد (${item.packages} طرد) متواجدة في ساحة الشركة منذ (${days} أيام).\nنرجو التكرم بالتنسيق واستلام البضاعة بأقرب وقت لتفادي أي رسوم تخزين إضافية.\nالمبلغ المستحق: $${debt.toLocaleString()}\nللتواصل والاستفسار يرجى الرد على هذه الرسالة. شكراً لتعاونكم.`;
    }

    if (type === 'mismatch') {
      const diff = Number(actual) - item.packages;
      const note = itemNotes[item.id] || '';
      return `إشعار تدقيق وجرد الساحة - شركة أطلس المحيط.\nالأخ الكريم / ${item.name} المحترم (الكود: ${item.code}).\n\nنحيطكم علماً بأنه تم إجراء الجرد والتدقيق الفعلي لشحنتكم [${item.shipment}]:\n- الطرود المقيدة بالمنفيست: (${item.packages}) طرد\n- الطرود المحصورة فعلياً بالساحة: (${actual}) طرد ${diff !== 0 ? `(يوجد فرق: ${diff > 0 ? `+${diff}` : diff})` : '(مطابقة)'}\n${note ? `- ملاحظة الجرد: ${note}\n` : ''}\nيرجى التنسيق مع مسؤول الساحة أو الكفيل [${item.guarantor || 'الإدارة'}].`;
    }

    // debt
    return `تذكير بالمطالبة المالية - شركة أطلس المحيط.\nالأخ الكريم / ${item.name} المحترم (الكود: ${item.code}).\n\nنرجو التكرم بالعلم بأن المبلغ المستحق على شحنتكم [${item.shipment}] بعدد (${item.packages} طرد) هو: $${debt.toLocaleString()}.\nيرجى تسديد المبلغ عند الاستلام أو التنسيق مع القسم المالي.\nشاكرين ومقدرين حسن تعاملكم.`;
  };

  // Set message text when opening client message modal or changing template
  useEffect(() => {
    if (activeMessageClient) {
      setCustomMessageText(getPreformattedMessage(activeMessageClient, messageTemplate));
    }
  }, [activeMessageClient, messageTemplate]);

  // Clean phone number for WhatsApp
  const getCleanWhatsAppPhone = (rawPhone?: string): string => {
    if (!rawPhone) return '';
    let digits = rawPhone.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('07')) digits = '964' + digits.slice(1);
    if (digits.startsWith('7') && digits.length === 10) digits = '964' + digits;
    return digits;
  };

  // Print Accounting Audit Report (PDF/A4)
  const handlePrintAccountingReport = () => {
    const printWindow = window.open('', '_blank', 'height=950,width=850');
    if (!printWindow) {
      window.print();
      return;
    }

    const tableRows = filteredItems.map((item, idx) => {
      const act = actualCounts[item.id];
      const hasActual = act !== undefined && act !== '';
      const isChecked = !!checkedItems[item.id];
      const note = itemNotes[item.id] || '';
      const displayActual = hasActual ? act : item.packages;
      const diff = Number(displayActual) - item.packages;
      const isMismatch = hasActual && diff !== 0;
      const isDispatched = !!dispatchedItems[item.id]?.dispatched;
      const itemEntry = entryDates[item.id] || getDefaultEntryDate(item);
      const days = calculateDaysInYard(itemEntry, item);

      return `
        <tr style="${isMismatch ? 'background-color: #fff1f2;' : (isChecked ? 'background-color: #f0fdf4;' : '')}">
          <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
          <td style="font-weight: bold; font-family: monospace; color: #b45309;">${item.code}</td>
          <td style="text-align: center; font-weight: 800; color: #047857; font-family: monospace;">$${Number(item.sales || 0).toLocaleString()}</td>
          <td style="font-size: 10px;">${item.guarantor || '—'}</td>
          <td>
            <b>${item.name}</b>
            <div style="font-size: 9.5px; color: #64748b;">${item.phone || ''} | ${item.city || ''}</div>
            ${note ? `<div style="font-size: 9.5px; color: #991b1b; font-weight: bold; margin-top: 2px;">⚠️ ${note}</div>` : ''}
          </td>
          <td style="text-align: center; font-weight: bold;">${item.packages}</td>
          <td style="text-align: center; font-weight: bold; font-family: monospace; ${isMismatch ? 'color: #dc2626;' : 'color: #166534;'}">
            ${displayActual}
          </td>
          <td style="text-align: center; font-size: 10px; font-weight: bold;">
            ${isMismatch ? `<span style="color: #b91c1c;">فرق (${diff > 0 ? `+${diff}` : diff})</span>` : (isChecked ? '<span style="color: #15803d;">مطابق ومفحوص</span>' : '<span style="color: #64748b;">قيد الجرد</span>')}
          </td>
          <td style="text-align: center; font-size: 10px; font-family: monospace;">
            ${itemEntry} (${days} يوم)
          </td>
          <td style="text-align: center; font-size: 10px; font-weight: bold;">
            ${isDispatched ? '<span style="color: #0d9488;">تم الإخراج</span>' : '<span style="color: #334155;">بالساحة</span>'}
          </td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>تقرير جرد الساحة والتدقيق المحاسبي - ${COMPANY_INFO.shortNameAr}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Cairo', Tahoma, Arial, sans-serif; direction: rtl; color: #0f172a; padding: 5px; margin: 0; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
          h2 { margin: 0; font-size: 17px; color: #0f172a; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
          .kpi-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; text-align: center; }
          .kpi-title { font-size: 10px; color: #64748b; font-weight: bold; }
          .kpi-val { font-size: 13px; font-weight: 800; color: #0f172a; font-family: monospace; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 5px; }
          th, td { padding: 5px 6px; border: 1px solid #cbd5e1; text-align: right; }
          th { background-color: #1e293b !important; color: #ffffff !important; font-weight: bold; font-size: 10px; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .footer-signs { margin-top: 28px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; font-size: 11px; font-weight: bold; }
          .sign-line { margin-top: 35px; border-top: 1px dashed #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h2>${COMPANY_INFO.nameAr}</h2>
            <div style="font-size: 11px; color: #64748b; font-weight: bold; margin-top: 2px;">
              تقرير جرد الساحة والتدقيق المحاسبي المعتمد - الشحنة: [${selectedShipment}] (${freightType === 'sea' ? 'بحري' : freightType === 'air' ? 'جوي' : 'عام'})
            </div>
          </div>
          <div style="text-align: left; font-size: 10px; color: #475569;">
            <div>تاريخ التقرير: <b>${new Date().toLocaleDateString('ar-IQ')}</b></div>
            <div>اسم المدقق: <b>${currentUserName}</b></div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">إجمالي المبالغ والديون ($)</div>
            <div class="kpi-val" style="color: #047857;">$${totalFilteredSales.toLocaleString()}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">المبالغ المحصلة / المخرجة ($)</div>
            <div class="kpi-val" style="color: #0284c7;">$${dispatchedSales.toLocaleString()}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">الديون المتبقية بالساحة ($)</div>
            <div class="kpi-val" style="color: #b45309;">$${remainingInYardSales.toLocaleString()}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">إجمالي الطرود المقيدة / الفعلية</div>
            <div class="kpi-val">${totalExpectedPackages} / ${totalActualPackages} (فروقات: ${mismatchItemsCount})</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 4%; text-align: center;">#</th>
              <th style="width: 10%;">كود العميل</th>
              <th style="width: 11%; text-align: center;">المبلغ ($)</th>
              <th style="width: 10%;">الكفيل</th>
              <th style="width: 27%;">العميل والعنوان وملاحظات الساحة</th>
              <th style="width: 7%; text-align: center;">الطرود</th>
              <th style="width: 7%; text-align: center;">الفعلي</th>
              <th style="width: 8%; text-align: center;">المطابقة</th>
              <th style="width: 9%; text-align: center;">تاريخ الدخول</th>
              <th style="width: 7%; text-align: center;">الإخراج</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="footer-signs">
          <div>
            مسؤول الساحة والجرد
            <div class="sign-line">التوقيع والختم</div>
          </div>
          <div>
            مدقق الحسابات والمطابقة
            <div class="sign-line">التوقيع والختم</div>
          </div>
          <div>
            إدارة الحركة واللوجستيك
            <div class="sign-line">الاعتماد النهائي</div>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 450);
  };

  const totalExpectedPackages = baseItems.reduce((sum, s) => sum + s.packages, 0);
  const totalActualPackages = baseItems.reduce((sum, s) => {
    const act = actualCounts[s.id];
    return sum + (act !== undefined && act !== '' ? Number(act) : s.packages);
  }, 0);

  const progressPercentage = totalItemsCount > 0 
    ? Math.round((auditedItemsCount / totalItemsCount) * 100) 
    : 0;

  const todayStr = toLatinDigits(new Date().toISOString().slice(0, 10));

  // Explicit Save & Return Later Handler
  const handleSaveAndReturnLater = () => {
    try {
      const now = new Date();
      const timeStr = toLatinDigits(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const dateStr = toLatinDigits(now.toISOString().slice(0, 10));
      const fullTimeStr = `${dateStr} - ${timeStr}`;

      const draft: YardDraftData = {
        lastSavedAt: fullTimeStr,
        checkedItems,
        actualCounts,
        itemNotes,
        dispatchedItems,
        entryDates
      };
      localStorage.setItem(YARD_INVENTORY_STORAGE_KEY, JSON.stringify(draft));
      setLastSavedTime(fullTimeStr);
      setSaveModalOpen(true);

      // Push complete snapshot to server for cross-device sync
      fetch('/api/yard-inventory/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          userName: currentUserName,
          draft,
          checkedItems,
          actualCounts,
          itemNotes,
          dispatchedItems,
          entryDates
        })
      }).catch(err => console.warn('Sync save-all error:', err));
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء الحفظ في ذاكرة المتصفح');
    }
  };

  // Top action button: Confirm and synchronize dispatched items (Directive #7)
  const handleConfirmDispatchedSync = async () => {
    if (dispatchedItemsCount === 0) return;
    try {
      const now = new Date();
      const timeStr = toLatinDigits(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const dateStr = toLatinDigits(now.toISOString().slice(0, 10));
      const fullTimeStr = `${dateStr} - ${timeStr}`;

      const draft: YardDraftData = {
        lastSavedAt: fullTimeStr,
        checkedItems,
        actualCounts,
        itemNotes,
        dispatchedItems,
        entryDates
      };
      localStorage.setItem(YARD_INVENTORY_STORAGE_KEY, JSON.stringify(draft));
      setLastSavedTime(fullTimeStr);

      await fetch('/api/yard-inventory/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          userName: currentUserName,
          draft,
          checkedItems,
          actualCounts,
          itemNotes,
          dispatchedItems,
          entryDates,
          action: `اعتماد وحفظ إخراج (${dispatchedItemsCount}) بضاعة من الساحة ومزامنتها فورياً`
        })
      });

      setToastMessage(`✅ تم بنجاح حفظ واعتماد إخراج (${dispatchedItemsCount}) بضاعة من الساحة ومزامنتها فورياً مع النظام.`);
    } catch (e) {
      console.error(e);
      setToastMessage('تم حفظ التعديلات محلياً وسيتم المزامنة تلقائياً عند توفر الاتصال');
    }
  };

  // Mark all visible items as matching
  const handleMarkAllVisibleMatching = () => {
    const updatedChecks = { ...checkedItems };
    const updatedCounts = { ...actualCounts };
    filteredItems.forEach(item => {
      updatedChecks[item.id] = true;
      updatedCounts[item.id] = item.packages;
    });
    setCheckedItems(updatedChecks);
    setActualCounts(updatedCounts);
    setToastMessage(`تم ضبط (${filteredItems.length}) بند مطابقاً للطرود المقيدة.`);
    
    // Broadcast action
    if (filteredItems[0]) {
      syncItemUpdate(filteredItems[0], `ضبط كافة البنود المرئية (${filteredItems.length} بند) كبنود مطابقة`, {
        bulkUpdate: true
      });
    }
  };

  // Reset inventory for current view
  const handleConfirmReset = () => {
    const updatedChecks = { ...checkedItems };
    const updatedCounts = { ...actualCounts };
    const updatedNotes = { ...itemNotes };

    baseItems.forEach(item => {
      delete updatedChecks[item.id];
      delete updatedCounts[item.id];
      delete updatedNotes[item.id];
    });

    setCheckedItems(updatedChecks);
    setActualCounts(updatedCounts);
    setItemNotes(updatedNotes);
    setResetConfirmOpen(false);
    setToastMessage(`تمت إعادة ضبط مسودة الجرد للشحنة [${selectedShipment}] بنجاح.`);

    // Reset in server
    fetch('/api/yard-inventory/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        userName: currentUserName,
        shipment: selectedShipment
      })
    }).catch(err => console.warn('Sync reset error:', err));
  };

  // Print Handler
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'height=900,width=800');
    if (!printWindow) {
      window.print();
      return;
    }

    const tableRows = filteredItems.map((item, idx) => {
      const act = actualCounts[item.id];
      const hasActual = act !== undefined && act !== '';
      const isChecked = !!checkedItems[item.id];
      const note = itemNotes[item.id] || '';
      const displayActual = hasActual ? act : item.packages;
      const isMismatch = hasActual && Number(act) !== item.packages;

      return `
        <tr style="${isMismatch ? 'background-color: #fff1f2;' : (isChecked ? 'background-color: #f0fdf4;' : '')}">
          <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
          <td style="font-weight: bold; font-family: monospace;">${item.code}</td>
          <td>
            <b>${item.name}</b>
            <div style="font-size: 10px; color: #475569;">${item.address || item.city}</div>
            ${note ? `<div style="font-size: 9.5px; color: #991b1b; margin-top: 2px;">ملاحظة: ${note}</div>` : ''}
          </td>
          <td style="text-align: center; font-weight: bold;">${item.packages}</td>
          <td style="text-align: center; font-weight: bold; font-family: monospace; ${isMismatch ? 'color: #dc2626;' : 'color: #166534;'}">
            ${displayActual}
          </td>
          <td style="text-align: center; font-size: 10px; font-weight: bold;">
            ${isMismatch ? `<span style="color: #b91c1c;">فرق (${Number(displayActual) - item.packages})</span>` : (isChecked ? '<span style="color: #15803d;">مطابق ومفحوص</span>' : '<span style="color: #64748b;">مسودة</span>')}
          </td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>ورقة جرد الساحة والمستودع - ${COMPANY_INFO.shortNameAr}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Cairo', Tahoma, Arial, sans-serif; direction: rtl; color: #0f172a; padding: 10px; margin: 0; }
          .header-box { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
          h2 { margin: 0; font-size: 18px; color: #0f172a; }
          p { margin: 3px 0 0; font-size: 11px; color: #64748b; }
          .info-bar { font-size: 12px; font-weight: bold; margin-bottom: 12px; background: #f1f5f9; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 5px; }
          th, td { padding: 6px 8px; border: 1px solid #94a3b8; text-align: right; }
          th { background-color: #1e293b !important; color: #ffffff !important; font-weight: bold; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .footer { margin-top: 35px; display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h2>${COMPANY_INFO.nameAr}</h2>
          <p>نموذج ومحضر جرد الساحة والمستودع الفعلي (A4) - ${lastSavedTime ? `آخر حفظ: ${lastSavedTime}` : ''}</p>
        </div>
        <div class="info-bar">
          <div>الشحنة: <b>${selectedShipment}</b></div>
          <div>تاريخ الجرد: <b>${todayStr}</b></div>
          <div>الطرود المقيدة: <b>${totalExpectedPackages} طرد</b></div>
          <div>الطرود المحصورة فعلياً: <b>${totalActualPackages} طرد</b></div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 6%; text-align: center;">#</th>
              <th style="width: 14%;">كود العميل</th>
              <th style="width: 44%;">العميل والعنوان وملاحظات الساحة</th>
              <th style="width: 12%; text-align: center;">الطرود المقيدة</th>
              <th style="width: 12%; text-align: center;">الجرد الفعلي</th>
              <th style="width: 12%; text-align: center;">حالة المطابقة</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <div class="footer">
          <div>اسم مسؤول الساحة / أمين المستودع: ........................................</div>
          <div>التوقيع والختم: ........................................</div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 600);
  };

  return (
    <div className="space-y-5 font-['Cairo']">
      {/* Real-time interactive team activity notification banner */}
      {activeAlert && (
        <div className="p-4 bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-2 border-amber-300 animate-fade-in ring-4 ring-amber-500/20">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center shrink-0 shadow-inner">
              <Bell className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] bg-black/35 text-amber-100 px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide flex items-center gap-1">
                  <Radio className="w-3 h-3 text-emerald-300 animate-pulse" />
                  🔔 تنبيه تفاعلي فوري بالساحة
                </span>
                <span className="font-mono text-[11px] bg-white/20 px-2 py-0.5 rounded-md font-bold">
                  {activeAlert.time}
                </span>
                {activeAlert.isExternalDevice && (
                  <span className="text-[10px] bg-emerald-950/40 text-emerald-200 border border-emerald-300/40 px-2 py-0.5 rounded font-bold">
                    🌐 من جهاز آخر متزامن
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-black mt-1 text-white leading-relaxed">
                قام <span className="underline decoration-amber-200 font-extrabold bg-black/25 px-2 py-0.5 rounded-lg text-amber-100">{activeAlert.userName}</span> بـ: {activeAlert.action}
                {activeAlert.shipment && (
                  <span className="mr-1.5 font-mono bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-300/30 text-amber-200 font-bold">
                    الشحنة: {toLatinDigits(activeAlert.shipment)}
                  </span>
                )}
                {activeAlert.itemCode && activeAlert.itemCode !== 'الكل' && (
                  <span className="mr-1.5 font-mono bg-black/30 px-2 py-0.5 rounded-md border border-white/20">
                    الكود: {toLatinDigits(activeAlert.itemCode)} {activeAlert.customerName ? `(${activeAlert.customerName})` : ''}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {activeAlert.itemId && (
              <button
                onClick={() => scrollToItem(activeAlert.itemId)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-950/85 hover:bg-slate-900 text-amber-300 font-bold text-xs border border-amber-400/40 shadow-sm cursor-pointer transition-all hover:scale-105 active:scale-95"
                title="الانتقال الفوري إلى بند هذه الشحنة داخل الجدول"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>الانتقال للبند في الجدول</span>
              </button>
            )}
            <button 
              onClick={() => setActiveAlert(null)} 
              className="p-1.5 hover:bg-white/20 rounded-xl cursor-pointer transition-colors text-white/90 hover:text-white"
              title="إغلاق التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toastMessage && (
        <div className="p-3 bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:bg-emerald-800 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner & Main Action Strip */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-600 border border-amber-500/30 flex items-center justify-center font-bold shrink-0">
              <Warehouse className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 font-['Cairo']">
                  شيت جرد الساحة والمستودع (Yard Inventory & Tally)
                </h2>
                {isLiveConnected ? (
                  <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    مزامنة حية للأجهزة متصلة
                  </span>
                ) : (
                  <span className="text-[11px] bg-slate-100 text-slate-600 border border-slate-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    مزامنة محلية
                  </span>
                )}
                {/* Active user badge & switch */}
                <button
                  onClick={() => setShowUserModal(true)}
                  className="text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="اضغط لتغيير اسم المستخدم أو دورك في الفريق"
                >
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>المستخدم: <b className="text-indigo-950">{currentUserName}</b></span>
                  <UserCog className="w-3 h-3 text-indigo-500" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                تدقيق ومطابقة عدد الطرود الفعلية في الساحة لكل عميل، مع إشعارات فورية مباشرة عند تعديل أي جهاز لمنع تداخل البيانات
              </p>
            </div>
          </div>

          {/* Actions & Tools Bar - Far Left (أقصى اليسار) */}
          <div className="flex items-center gap-2.5 w-full xl:w-auto justify-start xl:justify-end">
            {/* Primary Instant Save Button */}
            <button
              onClick={handleSaveAndReturnLater}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 active:scale-95 transition-all cursor-pointer"
              title="حفظ كافة البيانات المدخلة الآن ومزامنتها للعودة إليها ومراجعتها في أي وقت"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>حفظ ومزامنة الجرد</span>
            </button>

            {/* Comprehensive Tools & Actions Dropdown (أقصى اليسار) */}
            <div className="relative" ref={toolsDropdownRef}>
              <button
                id="yard-tools-dropdown-toggle-btn"
                type="button"
                onClick={() => setIsToolsDropdownOpen(prev => !prev)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs shadow-sm border transition-all cursor-pointer select-none ${
                  isToolsDropdownOpen
                    ? 'bg-slate-900 text-amber-400 border-slate-900 ring-2 ring-amber-400/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                }`}
                title="قائمة أدوات وإجراءات الساحة المجمعة (التقارير، التصدير، سجل التدقيق، تنبيهات الفريق، والصوت)"
              >
                <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                <span>أدوات وإجراءات الساحة</span>
                {dispatchedItemsCount > 0 ? (
                  <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                    {dispatchedItemsCount}
                  </span>
                ) : teamAlerts.length > 0 ? (
                  <span className="bg-slate-700 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {teamAlerts.length}
                  </span>
                ) : null}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isToolsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu Panel */}
              {isToolsDropdownOpen && (
                <div
                  id="yard-tools-dropdown-content"
                  className="absolute left-0 mt-2 w-80 sm:w-88 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                  style={{ maxHeight: '85vh', overflowY: 'auto' }}
                >
                  {/* Header of Dropdown */}
                  <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between border-b border-slate-700">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        <SlidersHorizontal className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-extrabold text-xs text-white">أدوات وإجراءات الساحة</div>
                        <div className="text-[10px] text-slate-400">كافة العمليات والتقارير والتدقيق</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsToolsDropdownOpen(false)}
                      className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-2 space-y-3 divide-y divide-slate-100">
                    {/* Section 1: Core Operations & Export */}
                    <div className="space-y-1 pt-1">
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        العمليات والمزامنة والتقارير
                      </div>

                      {/* 1. Save & Sync */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsToolsDropdownOpen(false);
                          handleSaveAndReturnLater();
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 text-slate-700 hover:text-emerald-950 transition-colors text-right cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Save className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-950">حفظ ومزامنة الجرد</div>
                            <div className="text-[10px] text-slate-500">مزامنة فورية مع السيرفر والأجهزة</div>
                          </div>
                        </div>
                      </button>

                      {/* 2. Dispatch Sync */}
                      <button
                        type="button"
                        onClick={() => {
                          if (dispatchedItemsCount > 0) {
                            setIsToolsDropdownOpen(false);
                            handleConfirmDispatchedSync();
                          }
                        }}
                        disabled={dispatchedItemsCount === 0}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-colors text-right cursor-pointer group ${
                          dispatchedItemsCount > 0
                            ? 'hover:bg-amber-50 text-slate-900'
                            : 'opacity-50 cursor-not-allowed text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            dispatchedItemsCount > 0 ? 'bg-amber-100 text-amber-700 group-hover:scale-105 transition-transform' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold">حفظ ومزامنة عمليات الإخراج</div>
                            <div className="text-[10px] text-slate-500">
                              {dispatchedItemsCount > 0 ? `${dispatchedItemsCount} طرد محدد للإخراج` : 'اضغط إشارة إخراج لأي طرد لتفعيله'}
                            </div>
                          </div>
                        </div>
                        {dispatchedItemsCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs">
                            {dispatchedItemsCount}
                          </span>
                        )}
                      </button>

                      {/* 3. Export Accounting Report Modal */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsToolsDropdownOpen(false);
                          setShowExportModal(true);
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50 text-slate-700 hover:text-blue-950 transition-colors text-right cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-blue-950">تقرير الجرد والتدقيق (PDF/Excel)</div>
                            <div className="text-[10px] text-slate-500">طباعة رسمية A4 أو ملف معتمد مع الفروقات</div>
                          </div>
                        </div>
                      </button>

                      {/* 4. Quick Tally Sheet Print */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsToolsDropdownOpen(false);
                          handlePrint();
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-amber-50 text-slate-700 hover:text-amber-950 transition-colors text-right cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Printer className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-amber-950">ورقة الجرد السريعة</div>
                            <div className="text-[10px] text-slate-500">طباعة فورية لشيت التدقيق اليدوي في الساحة</div>
                          </div>
                        </div>
                      </button>

                      {/* 5. Export Excel */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsToolsDropdownOpen(false);
                          exportYardInventoryToExcel(filteredItems, selectedShipment, actualCounts, checkedItems, itemNotes);
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 text-slate-700 hover:text-emerald-950 transition-colors text-right cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-950">تصدير إكسل (Excel)</div>
                            <div className="text-[10px] text-slate-500">تحميل ملف إكسل مع الأرقام الفعلية والملاحظات</div>
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Section 2: Audit & Real-time Collaboration */}
                    <div className="space-y-1 pt-2">
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        التدقيق والربط اللحظي للفريق
                      </div>

                      {/* 6. General Audit Trail */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsToolsDropdownOpen(false);
                          setShowFullAuditModal(true);
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-amber-50 text-slate-700 hover:text-amber-950 transition-colors text-right cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <History className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-amber-950">سجل التدقيق والتتبع</div>
                            <div className="text-[10px] text-slate-500">سجل كامل للحركات وتعديلات المستخدمين</div>
                          </div>
                        </div>
                      </button>

                      {/* 7. Team Alerts Drawer */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsToolsDropdownOpen(false);
                          setShowAlertsDrawer(!showAlertsDrawer);
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 hover:text-slate-950 transition-colors text-right cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Bell className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">تنبيهات الفريق اللحظية</div>
                            <div className="text-[10px] text-slate-500">درج التنبيهات المباشرة بين الأجهزة</div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold text-[11px]">
                          {teamAlerts.length}
                        </span>
                      </button>

                      {/* 8. Teammate Simulation */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsToolsDropdownOpen(false);
                          handleSimulateRemoteUpdate();
                        }}
                        disabled={isSimulating}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-amber-50 text-slate-700 hover:text-amber-950 transition-colors text-right cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            {isSimulating ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Radio className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-amber-950">تجربة تنبيه من جهاز آخر</div>
                            <div className="text-[10px] text-slate-500">محاكاة تعديل فوري واختبار الإشعار الصوتي</div>
                          </div>
                        </div>
                      </button>

                      {/* 9. Sound Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          const next = !soundEnabled;
                          setSoundEnabled(next);
                          localStorage.setItem('atlas_yard_sound_enabled', String(next));
                          if (next) playChimeSound();
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors text-right cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            soundEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                          }`}>
                            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              صوت التنبيهات: {soundEnabled ? 'مفعّل' : 'مكتوم'}
                            </div>
                            <div className="text-[10px] text-slate-500">نغمة صوتية هادئة عند تحديث أي جهاز</div>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          soundEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {soundEnabled ? 'انقر للكتم' : 'انقر للتفعيل'}
                        </span>
                      </button>
                    </div>

                    {/* Section 3: Reset & Maintenance */}
                    <div className="space-y-1 pt-2">
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        خيارات وإعادة الضبط
                      </div>

                      {/* 10. Reset Draft */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsToolsDropdownOpen(false);
                          setResetConfirmOpen(true);
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-rose-50 text-slate-700 hover:text-rose-700 transition-colors text-right cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <RotateCcw className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-rose-700">تفريغ المسودة وإعادة الضبط</div>
                            <div className="text-[10px] text-slate-500">مسح المدخلات غير المحفوظة لهذه الشحنة</div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Audit Progress & Storage Status Bar with 1-Minute Auto-Save */}
        <div className="mt-4 bg-slate-50 border border-slate-200/90 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-700">نسبة إنجاز الجرد:</span>
            <div className="w-36 sm:w-48 bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  progressPercentage === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-emerald-500'
                }`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="font-mono font-extrabold text-slate-900">{progressPercentage}%</span>
            <span className="text-slate-500 text-[11px]">
              ({auditedItemsCount} من أصل {totalItemsCount} بند تم جردها)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {/* Live 1-Minute Auto-Save Pill (Directive #6) */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold">
              <RefreshCw className="w-3 h-3 text-emerald-600 animate-spin" style={{ animationDuration: '6s' }} />
              <span>حفظ تلقائي كل 1 دقيقة: <b className="font-mono text-emerald-950">{lastAutoSaveTime || 'نشط'}</b></span>
            </div>

            <div className="flex items-center gap-1 text-slate-600 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {lastSavedTime ? (
                  <>آخر حفظ: <b className="text-slate-900 font-mono">{lastSavedTime}</b></>
                ) : (
                  'المتصفح جاهز للحفظ'
                )}
              </span>
            </div>
          </div>
        </div>

        {/* 🌟 مؤشرات الأداء المالي والإحصائي (KPIs & Financial Summary) */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-['Cairo']">
          {/* Card 1: إجمالي المبالغ والديون المستحقة المعروضة */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-3.5 border border-slate-700 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5" />
                <span>إجمالي مبالغ البنود المعروضة ($)</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                {filteredItems.length} بند
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-emerald-400">
                ${totalFilteredSales.toLocaleString()}
              </span>
              {selectedShipment !== 'الكل' && totalShipmentSales > totalFilteredSales && (
                <span className="text-[10px] text-slate-400">
                  من أصل <b className="font-mono">${totalShipmentSales.toLocaleString()}</b>
                </span>
              )}
            </div>
            <div className="mt-2 text-[10px] text-slate-300 flex items-center justify-between border-t border-slate-700/80 pt-1.5">
              <span>عملاء عليهم مستحقات مالية:</span>
              <span className="font-bold text-amber-300 font-mono">{clientsWithDebtsCount} عميل</span>
            </div>
          </div>

          {/* Card 2: المبالغ المحصلة (المُخرجة) مقابل المتبقية بالساحة */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-600 text-[11px] font-bold">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-600" />
                  <span>المحصل (المُخرج) مقابل المتبقي</span>
                </span>
                <span className="font-mono text-cyan-700 font-extrabold text-[11px]">
                  {dispatchedSalesRate}% تم إخراجه
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                <div className="bg-cyan-50/70 p-1.5 rounded-lg border border-cyan-200/60">
                  <div className="text-[10px] text-cyan-800 font-bold">تم إخراجه / محصل</div>
                  <div className="text-sm font-black font-mono text-cyan-900">${dispatchedSales.toLocaleString()}</div>
                </div>
                <div className="bg-amber-50/70 p-1.5 rounded-lg border border-amber-200/60">
                  <div className="text-[10px] text-amber-800 font-bold">متبقي في الساحة</div>
                  <div className="text-sm font-black font-mono text-amber-950">${remainingInYardSales.toLocaleString()}</div>
                </div>
              </div>
            </div>
            {/* Dual visual progress bar */}
            <div className="w-full bg-amber-100 rounded-full h-2 mt-2.5 overflow-hidden flex shadow-inner">
              <div 
                className="bg-cyan-600 h-full transition-all duration-500" 
                style={{ width: `${dispatchedSalesRate}%` }} 
                title={`المبالغ المخرجة: ${dispatchedSalesRate}%`}
              />
              <div 
                className="bg-amber-500 h-full transition-all duration-500" 
                style={{ width: `${100 - dispatchedSalesRate}%` }} 
                title={`المبالغ المتبقية بالساحة: ${100 - dispatchedSalesRate}%`}
              />
            </div>
          </div>

          {/* Card 3: مؤشر سلامة ومطابقة الطرود (السليمة مقابل الفروقات) */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-600 text-[11px] font-bold">
                <span className="flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-emerald-600" />
                  <span>مؤشر مطابقة وسلامة الطرود</span>
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                  mismatchItemsCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {mismatchItemsCount > 0 ? `${mismatchItemsCount} فروقات` : 'مطابقة تامة'}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <span className="text-xl font-black font-mono text-emerald-700">{healthyPercentage}%</span>
                  <span className="text-[10px] text-slate-500 mr-1.5">طرود سليمة ومطابقة</span>
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold font-mono text-rose-600">{mismatchPercentage}%</span>
                  <span className="text-[10px] text-slate-400 mr-1">فروقات</span>
                </div>
              </div>
            </div>
            {/* Visual ratio bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2.5 overflow-hidden flex shadow-inner">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500" 
                style={{ width: `${healthyPercentage}%` }} 
                title={`طرود مطابقة: ${healthyPercentage}%`}
              />
              <div 
                className="bg-rose-500 h-full transition-all duration-500" 
                style={{ width: `${mismatchPercentage}%` }} 
                title={`طرود بها فروقات: ${mismatchPercentage}%`}
              />
              <div 
                className="bg-amber-400 h-full transition-all duration-500" 
                style={{ width: `${Math.max(0, 100 - healthyPercentage - mismatchPercentage)}%` }} 
                title="قيد التدقيق"
              />
            </div>
          </div>

          {/* Card 4: ديون وبضائع معلقة (> 5 أيام) */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-600 text-[11px] font-bold">
              <span className="flex items-center gap-1 text-amber-900">
                <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
                <span>شحنات متأخرة بالساحة (&gt; 5 أيام)</span>
              </span>
              <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                {overdueItemsCount} طرد
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="text-lg font-black text-amber-900 font-mono">
                  {overdueItemsCount} <span className="text-xs font-sans text-slate-600">بند يحتاج إخراج</span>
                </div>
                <div className="text-[10px] text-slate-500">تحتاج متابعة وتواصل مع العميل لتفادي الرسوم</div>
              </div>
              <button
                type="button"
                onClick={() => setFilterStatus('overdue')}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[11px] transition-all cursor-pointer active:scale-95 shadow-2xs whitespace-nowrap"
              >
                عرض المتأخرة
              </button>
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
              <span>الطرود المحصورة: <b className="text-slate-800 font-mono font-bold">{totalActualPackages}</b></span>
              <span>الطرود المقيدة: <b className="text-slate-800 font-mono font-bold">{totalExpectedPackages}</b></span>
            </div>
          </div>
        </div>

        {/* Freight Type Selection, Searchable Shipment Combobox, Global Date Picker & Search Bar */}
        <div className="mt-4 p-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-xl shadow-xs border border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
            
            {/* 1. Freight Type Selector (Directive #2) */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-amber-300 mb-1.5">
                اختر نوع الشحن (بحري أو جوي):
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setFreightType('all')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    freightType === 'all'
                      ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>الكل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFreightType('sea')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    freightType === 'sea'
                      ? 'bg-cyan-500 text-slate-950 shadow-xs font-extrabold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                  title="شحن بحري - حاويات RQ"
                >
                  <Ship className="w-3.5 h-3.5" />
                  <span>بحري (RQ)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFreightType('air')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    freightType === 'air'
                      ? 'bg-sky-400 text-slate-950 shadow-xs font-extrabold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                  title="شحن جوي - طيران RA"
                >
                  <Plane className="w-3.5 h-3.5" />
                  <span>جوي (RA)</span>
                </button>
              </div>
            </div>

            {/* 2. Searchable Shipment Combobox (Directives #3 & #12) */}
            <div className="md:col-span-3 relative">
              <label className="block text-xs font-bold text-amber-300 mb-1.5">
                رقم الشحنة المراد جردها (بحث وقائمة منسدلة):
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="اكتب رقم الشحنة أو اختر من القائمة..."
                  value={shipmentSearchTerm !== '' ? shipmentSearchTerm : (selectedShipment === 'الكل' ? '' : selectedShipment)}
                  onChange={(e) => {
                    setShipmentSearchTerm(e.target.value);
                    setIsShipmentDropdownOpen(true);
                  }}
                  onFocus={() => setIsShipmentDropdownOpen(true)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-950 border border-slate-600 hover:border-amber-400 focus:border-amber-400 rounded-lg text-white font-bold font-mono focus:ring-2 focus:ring-amber-500 shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setIsShipmentDropdownOpen(prev => !prev)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 p-1 cursor-pointer"
                  title="فتح قائمة أرقام الشحنات"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${isShipmentDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Combobox Dropdown Results */}
              {isShipmentDropdownOpen && (
                <div 
                  className="absolute z-30 right-0 left-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar p-1.5 font-['Cairo'] text-xs"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedShipment('الكل');
                      setShipmentSearchTerm('');
                      setIsShipmentDropdownOpen(false);
                    }}
                    className={`w-full text-right px-3 py-2 rounded-lg font-bold transition-colors flex items-center justify-between cursor-pointer ${
                      selectedShipment === 'الكل' ? 'bg-amber-500 text-slate-950' : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span>كافة الشحنات</span>
                    <span className="font-mono text-[11px] opacity-80">{shipments.length} بند</span>
                  </button>

                  {availableShipments
                    .filter(s => {
                      if (!shipmentSearchTerm) return true;
                      return s.toLowerCase().includes(shipmentSearchTerm.toLowerCase());
                    })
                    .map(s => {
                      const count = shipments.filter(item => item.shipment === s).length;
                      const isSea = s.toUpperCase().startsWith('RQ');
                      const isAir = s.toUpperCase().startsWith('RA');
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setSelectedShipment(s);
                            setShipmentSearchTerm('');
                            setIsShipmentDropdownOpen(false);
                          }}
                          className={`w-full text-right px-3 py-2 rounded-lg font-bold transition-colors flex items-center justify-between cursor-pointer ${
                            selectedShipment === s ? 'bg-amber-500 text-slate-950' : 'text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-mono">
                            {isSea && <span className="text-cyan-400 text-xs">🚢</span>}
                            {isAir && <span className="text-sky-300 text-xs">✈️</span>}
                            <span>{s}</span>
                          </div>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 font-mono text-slate-300">
                            {count} بند
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* 3. Global Date Picker: تثبيت تاريخ دخول موحد للشحنة */}
            <div className="md:col-span-3">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <label className="block text-xs font-bold text-amber-300 truncate">
                  رزنامة عامة (تاريخ دخول للشحنة):
                </label>
                {selectedShipment !== 'الكل' ? (
                  <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-400/20 px-1.5 py-0.5 rounded whitespace-nowrap">
                    [{selectedShipment}]
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-mono">
                    (لكافة البنود)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={batchEntryDate}
                  onChange={(e) => setBatchEntryDate(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-950 border border-slate-600 hover:border-amber-400 focus:border-amber-400 rounded-lg text-white font-mono font-bold text-center focus:ring-2 focus:ring-amber-500 shadow-inner cursor-pointer"
                  title="اختر تاريخ الدخول لتطبيقه على كافة بنود الشحنة المحددة"
                />
                <button
                  type="button"
                  onClick={() => handleApplyBatchEntryDate(batchEntryDate)}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap shadow-xs cursor-pointer transition-all active:scale-95"
                  title="تطبيق وتثبيت هذا التاريخ على كافة بنود الشحنة وتحديث عدادات البقاء تلقائياً"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>تثبيت للشحنة</span>
                </button>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-300 mt-1 px-0.5">
                <span>
                  المدة المحسوبة: <b className="text-amber-400 font-mono font-bold">{calculateDaysInYard(batchEntryDate)} {calculateDaysInYard(batchEntryDate) === 1 ? 'يوم' : 'أيام'}</b>
                </span>
                {calculateDaysInYard(batchEntryDate) > 5 && (
                  <span className="text-amber-300 font-bold">⚠️ &gt; 5 أيام</span>
                )}
              </div>
            </div>

            {/* 4. Fast Text Search (Retains in localStorage, Directive #12) */}
            <div className="md:col-span-3 relative">
              <label className="block text-xs font-bold text-amber-300 mb-1.5">
                بحث سريع بالاسم، الكود، المحافظة، الكفيل أو العنوان:
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث بالاسم، الكود، المحافظة، العنوان، الكفيل..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 text-xs bg-slate-950 border border-slate-600 rounded-lg text-white font-medium focus:ring-2 focus:ring-amber-500 shadow-inner"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                    title="مسح البحث"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Advanced Filtering Controls (Guarantor / Auditor & Financial Status) */}
          <div className="pt-3 mt-3 border-t border-slate-700/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-center text-xs">
            {/* Filter by Guarantor / Responsible Employee */}
            <div className="md:col-span-4 flex items-center gap-2">
              <label className="text-slate-300 font-bold whitespace-nowrap flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>فلترة الكفيل / المدقق:</span>
              </label>
              <select
                value={selectedGuarantor}
                onChange={(e) => setSelectedGuarantor(e.target.value)}
                className="w-full bg-slate-950 border border-slate-600 rounded-lg px-2.5 py-1.5 text-white font-medium focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                <option value="الكل">كافة الكفلاء والمسؤولين ({availableGuarantors.length})</option>
                {availableGuarantors.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Filter by Financial Status */}
            <div className="md:col-span-5 flex items-center gap-2">
              <label className="text-slate-300 font-bold whitespace-nowrap flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>الحالة المالية ($):</span>
              </label>
              <div className="grid grid-cols-4 gap-1 w-full bg-slate-950/70 p-1 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setFinancialFilter('all')}
                  className={`py-1 px-1 rounded text-center font-bold text-[11px] transition-all cursor-pointer ${
                    financialFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setFinancialFilter('with_debt')}
                  className={`py-1 px-1 rounded text-center font-bold text-[11px] transition-all cursor-pointer ${
                    financialFilter === 'with_debt'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-rose-300 hover:text-white'
                  }`}
                  title="عرض فقط البنود التي عليها مبالغ وديون مستحقة"
                >
                  عليها ديون
                </button>
                <button
                  type="button"
                  onClick={() => setFinancialFilter('high_debt')}
                  className={`py-1 px-1 rounded text-center font-bold text-[11px] transition-all cursor-pointer ${
                    financialFilter === 'high_debt'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-amber-300 hover:text-white'
                  }`}
                  title="عرض البنود ذات الديون المرتفعة $500 فأكثر"
                >
                  &ge; $500
                </button>
                <button
                  type="button"
                  onClick={() => setFinancialFilter('zero_debt')}
                  className={`py-1 px-1 rounded text-center font-bold text-[11px] transition-all cursor-pointer ${
                    financialFilter === 'zero_debt'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-300 hover:text-white'
                  }`}
                  title="عرض البنود الخالصة تماماً من الديون ($0)"
                >
                  خالصة ($0)
                </button>
              </div>
            </div>

            {/* Reset Advanced Filters if active */}
            <div className="md:col-span-3 flex justify-end">
              {(selectedGuarantor !== 'الكل' || financialFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGuarantor('الكل');
                    setFinancialFilter('all');
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>إلغاء تصفية الكفيل والمالية</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 7 Reordered Filter Buttons: EXACT SEQUENCE REQUESTED BY USER (Directive #1)
            1. كافة البنود
            2. قيد الانتظار لم تُجرد
            3. تم الجرد والتدقيق
            4. يوجد فرق في الطرود
            5. تجاوزت ٥ أيام
            6. تم إخراجها من الساحة
            7. متواجدة بالساحة
        */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            
            {/* 1. كافة البنود */}
            <button
              onClick={() => setFilterStatus('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-slate-800 text-white shadow-xs font-extrabold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>1. كافة البنود</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                filterStatus === 'all' ? 'bg-slate-700 text-amber-300' : 'bg-slate-200 text-slate-700'
              }`}>
                {totalItemsCount}
              </span>
            </button>

            {/* 2. قيد الانتظار لم تُجرد */}
            <button
              onClick={() => setFilterStatus('pending')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs font-extrabold ring-2 ring-amber-400'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>2. قيد الانتظار لم تُجرد</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                filterStatus === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'
              }`}>
                {pendingItemsCount}
              </span>
            </button>

            {/* 3. تم الجرد والتدقيق */}
            <button
              onClick={() => setFilterStatus('audited')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'audited'
                  ? 'bg-emerald-700 text-white shadow-xs font-extrabold'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>3. تم الجرد والتدقيق</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                filterStatus === 'audited' ? 'bg-emerald-800 text-white' : 'bg-emerald-200 text-emerald-900'
              }`}>
                {auditedItemsCount}
              </span>
            </button>

            {/* 4. يوجد فرق في الطرود */}
            <button
              onClick={() => setFilterStatus('mismatch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'mismatch'
                  ? 'bg-rose-700 text-white shadow-xs font-extrabold'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>4. يوجد فرق في الطرود</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                filterStatus === 'mismatch' ? 'bg-rose-800 text-white' : 'bg-rose-200 text-rose-900'
              }`}>
                {mismatchItemsCount}
              </span>
            </button>

            {/* 5. تجاوزت ٥ أيام */}
            <button
              onClick={() => setFilterStatus('overdue')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'overdue'
                  ? 'bg-amber-600 text-white shadow-xs font-extrabold ring-2 ring-amber-400'
                  : 'bg-amber-100/90 text-amber-900 hover:bg-amber-200 border border-amber-300'
              }`}
              title="شحنات تجاوزت مدة وجودها في الساحة 5 أيام وتحتاج معالجة عاجلة"
            >
              <CalendarClock className="w-3.5 h-3.5 text-amber-800" />
              <span>5. تجاوزت ٥ أيام</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                filterStatus === 'overdue' ? 'bg-amber-800 text-white' : 'bg-amber-300 text-amber-950'
              }`}>
                {overdueItemsCount}
              </span>
            </button>

            {/* 6. تم إخراجها من الساحة */}
            <button
              onClick={() => setFilterStatus('dispatched')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'dispatched'
                  ? 'bg-cyan-700 text-white shadow-xs font-extrabold'
                  : 'bg-cyan-50 text-cyan-900 hover:bg-cyan-100 border border-cyan-300'
              }`}
              title="بضائع تم وضع إشارة إخراجها من الساحة"
            >
              <Truck className="w-3.5 h-3.5 text-cyan-700" />
              <span>6. تم إخراجها من الساحة</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                filterStatus === 'dispatched' ? 'bg-cyan-900 text-white' : 'bg-cyan-200 text-cyan-950'
              }`}>
                {dispatchedItemsCount}
              </span>
            </button>

            {/* 7. متواجدة بالساحة */}
            <button
              onClick={() => setFilterStatus('in_yard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'in_yard'
                  ? 'bg-slate-700 text-white shadow-xs font-extrabold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
              title="بضائع ما زالت متواجدة في الساحة"
            >
              <Warehouse className="w-3.5 h-3.5 text-slate-600" />
              <span>7. متواجدة بالساحة</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                filterStatus === 'in_yard' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-800'
              }`}>
                {inYardItemsCount}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllVisibleMatching}
              className="flex items-center gap-1.5 text-xs text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
              title="اعتماد عدد الطرود المقيدة كجرد فعلي لكافة البنود الظاهرة حالياً"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>مطابقة كافة المعروض</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Yard Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold font-['Cairo']">
              جدول طرود الساحة - الشحنة: [{selectedShipment}]
            </h3>
            <span className="text-xs bg-slate-700/80 text-amber-400 px-2 py-0.5 rounded font-mono font-bold">
              المعروض: {filteredItems.length} عميل
            </span>
            {filterStatus !== 'all' && (
              <span className="text-[11px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold">
                فلتر مفعّل: {filterStatus === 'audited' ? 'المجرودة' : filterStatus === 'pending' ? 'قيد الانتظار' : 'فروقات'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-300 hidden sm:inline">
              💾 يتم حفظ التعديلات في المتصفح تلقائياً عند إدخال أي رقم أو ملاحظة
            </span>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar max-h-[550px]">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-800 text-white font-bold z-10">
              <tr>
                {/* Batch Selection Header Checkbox */}
                <th className="py-3 px-2 text-center w-10">
                  <input
                    type="checkbox"
                    checked={filteredItems.length > 0 && selectedCount === filteredItems.length}
                    onChange={(e) => handleSelectAllVisible(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer accent-amber-500"
                    title="تحديد أو إلغاء تحديد كافة البنود المعروضة للعمليات الجماعية"
                  />
                </th>
                <th className="py-3 px-2 text-center w-10">#</th>
                <th className="py-3 px-3 text-center w-14">تدقيق</th>
                <th className="py-3 px-3 text-center w-40">إشارة إخراج الساحة</th>
                <th className="py-3 px-2 text-center w-14 bg-slate-750" title="سجل تدقيق وتعديلات البند ومراسلة العميل">
                  <span className="inline-flex items-center justify-center gap-1 text-[11px] font-bold text-amber-300">
                    <History className="w-3 h-3 text-amber-400" />
                    <span>سجل</span>
                  </span>
                </th>
                <th className="py-3 px-3 w-24">الكود</th>
                <th className="py-3 px-3 text-center w-28 bg-slate-700/60 text-amber-300">المبلغ / الديون ($)</th>
                <th className="py-3 px-3 w-32 bg-slate-700/60 text-amber-300">الكفيل</th>
                <th className="py-3 px-3 min-w-[140px]">اسم العميل</th>
                <th className="py-3 px-3 min-w-[170px]">العنوان والمحافظة</th>
                <th className="py-3 px-3 text-center w-24">الطرود المقيدة</th>
                <th className="py-3 px-3 text-center min-w-[170px]">تاريخ الدخول وعداد البقاء بالساحة</th>
                <th className="py-3 px-3 text-center w-48">الجرد الفعلي في الساحة</th>
                <th className="py-3 px-3 text-center w-28">حالة المطابقة</th>
                <th className="py-3 px-3 text-center min-w-[320px]">ملاحظات الساحة والأوسمة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto text-center">
                      <p className="text-sm font-bold text-slate-600 mb-1">لا توجد بنود مطابقة للفلتر المحدد</p>
                      <p className="text-xs text-slate-400">يرجى تعديل الفلتر أو اختيار "كافة البنود" للمراجعة</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const isChecked = !!checkedItems[item.id];
                  const actual = actualCounts[item.id];
                  const hasActual = actual !== undefined && actual !== '';
                  const hasMismatch = hasActual && Number(actual) !== item.packages;
                  const note = itemNotes[item.id] || '';
                  const itemEntryDate = entryDates[item.id] || getDefaultEntryDate(item);
                  const daysInYard = calculateDaysInYard(itemEntryDate, item);
                  const isOverdue = daysInYard > 5;
                  const isDispatched = !!dispatchedItems[item.id]?.dispatched;
                  const dispatchedInfo = dispatchedItems[item.id];
                  const recentMod = recentlyModifiedItems[item.id];
                  const isRecentlyModified = !!recentMod;

                  const isItemSelected = !!selectedItemIds[item.id];

                  return (
                    <tr
                      id={`yard-row-${item.id}`}
                      key={item.id}
                      className={`transition-all duration-300 ${
                        isItemSelected
                          ? 'bg-amber-100/90 ring-1 ring-amber-400 font-medium'
                          : isRecentlyModified
                          ? 'ring-2 ring-indigo-500 bg-indigo-50/80 shadow-md font-medium'
                          : isDispatched
                          ? 'bg-slate-50/80 text-slate-500 opacity-90'
                          : isOverdue
                          ? 'bg-amber-100/70 hover:bg-amber-100/90 border-r-4 border-r-amber-500 font-medium'
                          : hasMismatch 
                          ? 'bg-rose-50/40 hover:bg-rose-50/60' 
                          : isChecked 
                          ? 'bg-emerald-50/35 hover:bg-emerald-50/50' 
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Multi-Select Checkbox */}
                      <td className="py-3 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={isItemSelected}
                          onChange={() => handleToggleSelectOne(item.id)}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer accent-amber-500"
                          title="تحديد هذا البند لتنفيذ عمليات جماعية"
                        />
                      </td>

                      <td className="py-3 px-2 text-center text-slate-400 font-bold">
                        {idx + 1}
                      </td>

                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const newChecked = !isChecked;
                            setCheckedItems(prev => ({ ...prev, [item.id]: newChecked }));
                            let newActual = actual;
                            if (!hasActual && newChecked) {
                              newActual = item.packages;
                              setActualCounts(prev => ({ ...prev, [item.id]: item.packages }));
                            }
                            const actionText = newChecked ? 'تأكيد تدقيق البند ومطابقته' : 'إلغاء تدقيق البند';
                            syncItemUpdate(item, actionText, { checked: newChecked, actualCount: newActual });
                          }}
                          className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                              : 'border-slate-300 hover:border-amber-500 bg-white'
                          }`}
                          title={isChecked ? 'تم تدقيق هذا البند بنجاح' : 'اضغط لتأكيد تدقيق وجرد هذا البند'}
                        >
                          {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                        </button>
                      </td>

                      {/* Out of yard dispatch toggle button with Date and Clock (Directive #10) */}
                      <td className="py-3 px-3 text-center">
                        {isDispatched ? (
                          <div className="flex flex-col items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleDispatched(item)}
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                              title="تم وضع إشارة الإخراج - اضغط للإلغاء"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>تم الإخراج</span>
                            </button>
                            <div className="flex flex-col items-center text-[10px] text-emerald-900 font-mono font-bold leading-tight">
                              <span>📅 {dispatchedInfo?.date || todayStr}</span>
                              <span>⏰ {dispatchedInfo?.time}</span>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleDispatched(item)}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-950 border border-slate-300 hover:border-amber-400 font-bold text-[11px] cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                            title="وضع إشارة إخراج بضاعة الساحة لهذا العميل"
                          >
                            <Truck className="w-3.5 h-3.5 text-slate-400" />
                            <span>إشارة إخراج</span>
                          </button>
                        )}
                      </td>

                      {/* Audit Trail Button */}
                      <td className="py-3 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => setAuditTrailItem(item)}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 hover:border-amber-400 transition-colors cursor-pointer shadow-2xs"
                          title="عرض سجل التدقيق والتعديلات ومراسلة العميل لهذا البند"
                        >
                          <History className="w-3.5 h-3.5 text-amber-700" />
                        </button>
                      </td>

                      {/* Code */}
                      <td className="py-3 px-3 font-mono font-bold text-amber-700">
                        {item.code}
                      </td>

                      {/* Amount / Debt ($) Column (Directive #4) */}
                      <td className="py-3 px-3 font-mono font-extrabold text-center whitespace-nowrap bg-amber-50/20">
                        <span className="text-emerald-700 font-mono text-xs font-black">
                          ${Number(item.sales || 0).toLocaleString()}
                        </span>
                      </td>

                      {/* Guarantor Column (Directive #5) */}
                      <td className="py-3 px-3 text-slate-800 font-medium whitespace-nowrap">
                        {item.guarantor ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-900 border border-indigo-200 text-[11px] font-bold">
                            👤 {item.guarantor}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Customer Name with discreet communication button */}
                      <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{item.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMessageClient(item);
                            }}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white border border-emerald-200 transition-all cursor-pointer shrink-0 shadow-2xs group"
                            title={`إرسال إشعار للعميل ${item.name} (واتساب / تيليجرام)`}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Address & City */}
                      <td className="py-3 px-3 text-slate-600">
                        <div className="font-medium text-slate-800 whitespace-normal break-words max-w-[220px]">
                          {item.address || item.city}
                        </div>
                        <div className="text-[11px] text-indigo-900 font-bold mt-0.5">
                          📍 {item.city}
                        </div>
                      </td>

                      {/* Packages */}
                      <td className="py-3 px-3 text-center font-bold text-slate-900 font-mono text-sm">
                        📦 {item.packages}
                      </td>

                      {/* Live Date Picker & Accurate Days in Yard Counter (Directive #8) */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center gap-1.5 min-w-[150px]">
                          <div className="relative w-full">
                            <input
                              type="date"
                              value={itemEntryDate}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                setEntryDates(prev => ({ ...prev, [item.id]: newDate }));
                                syncItemUpdate(item, `تعديل تاريخ دخول البضاعة إلى ${newDate}`, { entryDate: newDate });
                              }}
                              className="w-full px-2 py-1 text-xs border border-slate-300 hover:border-amber-500 focus:border-amber-500 rounded-lg text-slate-900 font-mono font-bold bg-white text-center focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-2xs"
                              title="تعديل وتحديد تاريخ دخول البضاعة للساحة"
                            />
                          </div>
                          
                          {/* Live computed days in yard badge */}
                          {isDispatched ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                              أُخرجت ({dispatchedInfo?.time})
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-950 border border-amber-300 shadow-2xs whitespace-nowrap">
                              <CalendarClock className="w-3 h-3 text-amber-900" />
                              <span>{daysInYard} أيام (متأخرة ⚠️)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 font-mono whitespace-nowrap border border-slate-200">
                              <span>بقيت {daysInYard} {daysInYard === 1 ? 'يوم' : 'أيام'}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actual Input with Quick Matching Button */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            placeholder={String(item.packages)}
                            value={hasActual ? actual : ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setActualCounts(prev => ({ ...prev, [item.id]: val }));
                              const newChecked = isChecked || val !== '';
                              if (!isChecked && val !== '') {
                                setCheckedItems(prev => ({ ...prev, [item.id]: true }));
                              }
                              syncItemUpdate(item, `تعديل الجرد الفعلي إلى ${val} طرد`, { actualCount: val, checked: newChecked });
                            }}
                            className={`w-20 px-2 py-1 text-center font-mono font-bold text-xs border rounded-lg focus:ring-2 focus:ring-amber-500 transition-all ${
                              hasMismatch
                                ? 'border-rose-400 bg-rose-50 text-rose-800 ring-1 ring-rose-300'
                                : hasActual
                                ? 'border-emerald-300 bg-emerald-50/50 text-emerald-900'
                                : 'border-slate-300 bg-white'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setActualCounts(prev => ({ ...prev, [item.id]: item.packages }));
                              setCheckedItems(prev => ({ ...prev, [item.id]: true }));
                              syncItemUpdate(item, `مطابقة الجرد الفعلي (${item.packages} طرد)`, { actualCount: item.packages, checked: true });
                            }}
                            className="px-1.5 py-1 text-[10px] bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 border border-slate-200 rounded font-bold transition-all cursor-pointer whitespace-nowrap"
                            title="ضبط الجرد الفعلي مطابقاً للطرود المقيدة"
                          >
                            مطابق
                          </button>
                        </div>
                      </td>

                      {/* Match Status Badge */}
                      <td className="py-3 px-3 text-center">
                        {hasMismatch ? (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200 whitespace-nowrap">
                            فرق ({Number(actual) - item.packages > 0 ? `+${Number(actual) - item.packages}` : Number(actual) - item.packages})
                          </span>
                        ) : isChecked ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap">
                            مطابق ومفحوص
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 whitespace-nowrap">
                            بانتظار الجرد
                          </span>
                        )}
                      </td>

                      {/* Notes Column with quick tags and generous space */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 min-w-[320px]">
                          <input
                            type="text"
                            placeholder="ملاحظات الساحة (تتسع لجملة من 9 كلمات أو أكثر)..."
                            value={note}
                            onChange={(e) => {
                              const val = e.target.value;
                              setItemNotes(prev => ({ ...prev, [item.id]: val }));
                            }}
                            onBlur={(e) => {
                              const val = e.target.value;
                              if (val) {
                                syncItemUpdate(item, `إضافة/تعديل ملاحظة ساحة`, { note: val });
                              }
                            }}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 hover:border-amber-400 focus:border-amber-500 rounded-lg focus:ring-2 focus:ring-amber-500 font-medium bg-white shadow-2xs"
                          />

                          {/* Quick Tag Selector Button */}
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() => setActiveNoteTagItemId(activeNoteTagItemId === item.id ? null : item.id)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-900 border border-slate-200 hover:border-amber-300 transition-colors cursor-pointer"
                              title="إضافة وسم وملاحظة جاهزة سريعة"
                            >
                              <Tag className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown with Quick Tags */}
                            {activeNoteTagItemId === item.id && (
                              <div className="absolute left-0 bottom-full mb-1 z-30 bg-white border border-slate-200 shadow-xl rounded-xl p-2 w-56 flex flex-col gap-1 font-['Cairo'] text-right">
                                <div className="text-[10px] font-bold text-slate-500 pb-1 border-b border-slate-100 flex items-center justify-between">
                                  <span>ملاحظات سريعة:</span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveNoteTagItemId(null)}
                                    className="text-slate-400 hover:text-slate-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                                  {QUICK_NOTE_TAGS.map(tag => (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() => {
                                        const updated = note ? `${note} | ${tag}` : tag;
                                        setItemNotes(prev => ({ ...prev, [item.id]: updated }));
                                        syncItemUpdate(item, `إضافة وسم ملاحظة: ${tag}`, { note: updated });
                                        setActiveNoteTagItemId(null);
                                      }}
                                      className="text-right text-[11px] font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-900 p-1 rounded-md transition-colors cursor-pointer"
                                    >
                                      {tag}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {note && (
                            <button
                              type="button"
                              onClick={() => {
                                setItemNotes(prev => ({ ...prev, [item.id]: '' }));
                                syncItemUpdate(item, `حذف ملاحظة ساحة`, { note: '' });
                              }}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors shrink-0"
                              title="مسح الملاحظة"
                            >
                              <X className="w-3.5 h-3.5" />
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

        {/* 🌟 Floating Batch Actions Toolbar (تحديد جماعي للعمليات السريعة) */}
        {selectedCount > 0 && (
          <div className="p-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-t border-amber-500/40 flex flex-wrap items-center justify-between gap-3 animate-fade-in font-['Cairo']">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-xs">
                <CheckSquare className="w-4 h-4" />
                <span>تم تحديد {selectedCount} بند</span>
              </span>
              <span className="text-xs text-slate-300">
                يمكنك تطبيق العمليات التالية على كافة البنود المحددة دفعة واحدة:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Batch Action 1: اعتماد التدقيق والمطابقة دفعة واحدة */}
              <button
                type="button"
                onClick={handleBatchApproveAudit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                title="اعتماد تدقيق ومطابقة كافة البنود المحددة دفعة واحدة"
              >
                <CheckCheck className="w-4 h-4" />
                <span>اعتماد التدقيق للمحدد ({selectedCount})</span>
              </button>

              {/* Batch Action 2: تسجيل إخراج الساحة دفعة واحدة */}
              <button
                type="button"
                onClick={handleBatchMarkDispatch}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                title="تسجيل إشارة إخراج الساحة لكافة البنود المحددة دفعة واحدة"
              >
                <Truck className="w-4 h-4" />
                <span>تسجيل إخراج الساحة ({selectedCount})</span>
              </button>

              {/* Batch Action 3: تطبيق تاريخ الدخول المختار على المحدد فقط */}
              <button
                type="button"
                onClick={() => handleBatchApplyDateToSelected(batchEntryDate)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                title={`تطبيق تاريخ ${batchEntryDate} على البنود المحددة وتحديث عداداتها`}
              >
                <Calendar className="w-4 h-4" />
                <span>تثبيت التاريخ ({batchEntryDate})</span>
              </button>

              {/* Clear Selection */}
              <button
                type="button"
                onClick={handleClearBatchSelection}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                title="إلغاء التحديد الجماعي"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Modal: Confirm Save & Return Later Dialog */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fade-in p-6 text-right font-['Cairo']">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 text-center mb-1">
              تم الحفظ المؤقت بنجاح في المتصفح
            </h3>
            
            <p className="text-xs text-slate-600 text-center leading-relaxed mb-4">
              تم حفظ كافة أرقام الجرد الفعلي، حالات التدقيق، والملاحظات المدخلة لـ <b className="text-slate-900">({auditedItemsCount})</b> بند تلقائياً في ذاكرة هذا المتصفح. يمكنك مغادرة البرنامج أو إغلاق الصفحة بأمان وستجد بياناتك محفوظة بدقة عند العودة في أي وقت.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs mb-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">الشحنة المفحوصة:</span>
                <span className="font-bold text-slate-900">{selectedShipment}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">توقيت الحفظ المسجل:</span>
                <span className="font-mono font-bold text-slate-900">{lastSavedTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">إجمالي الطرود المحصورة:</span>
                <span className="font-bold text-emerald-800 font-mono">{totalActualPackages} طرد</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              {onNavigateToDashboard && (
                <button
                  onClick={() => {
                    setSaveModalOpen(false);
                    onNavigateToDashboard();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>العودة للوحة التحكم الرئيسية</span>
                </button>
              )}

              <button
                onClick={() => setSaveModalOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 transition-all cursor-pointer"
              >
                <span>البقاء والاستمرار في الجرد</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: Confirm Reset Draft */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 text-right font-['Cairo']">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4 border border-rose-200">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 text-center mb-1">
              تأكيد إعادة ضبط مسودة الجرد
            </h3>
            
            <p className="text-xs text-slate-600 text-center leading-relaxed mb-5">
              هل أنت متأكد من رغبتك في تفريغ كافة الأرقام الفعلية وعلامات التدقيق المسجلة لشحنة <b className="text-slate-900">[{selectedShipment}]</b>؟ لا يمكن التراجع عن هذه الخطوة.
            </p>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleConfirmReset}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                نعم، تفريغ المسودة
              </button>
              <button
                onClick={() => setResetConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Team Activity & Real-Time Alerts Drawer */}
      {showAlertsDrawer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-fade-in text-right font-['Cairo']">
            <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">سجل تنبيهات الفريق المباشرة</h3>
                  <p className="text-[11px] text-slate-300">مزامنة حية لنشاط جرد الساحة لمنع تداخل البيانات</p>
                </div>
              </div>
              <button
                onClick={() => setShowAlertsDrawer(false)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-[420px] overflow-y-auto custom-scrollbar space-y-2.5">
              {teamAlerts.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">لا توجد تنبيهات نشاط جديدة حتى الآن</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    عندما يقوم أي عضو في الفريق أو جهاز متصل بتعديل كميات الجرد أو وضع إشارات الإخراج ستظهر التنبيهات هنا فوراً
                  </p>
                </div>
              ) : (
                teamAlerts.map(alert => (
                  <div 
                    key={alert.id}
                    className="p-3 bg-slate-50 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-200 rounded-xl flex items-start justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {alert.userName.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">{alert.userName}</span>
                          {alert.itemCode && (
                            <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-mono font-bold">
                              {alert.itemCode}
                            </span>
                          )}
                          {alert.isExternalDevice && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded font-bold">
                              جهاز خارجي
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 font-medium">{alert.action}</p>
                        {alert.itemId && (
                          <button
                            onClick={() => {
                              setShowAlertsDrawer(false);
                              scrollToItem(alert.itemId);
                            }}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold mt-1 flex items-center gap-1 cursor-pointer hover:underline"
                          >
                            <Eye className="w-3 h-3" />
                            <span>الانتقال للبند في الجدول</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0 font-bold">
                      {alert.time}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  إجمالي التنبيهات: <b>{teamAlerts.length}</b>
                </span>
                <button
                  onClick={handleSimulateRemoteUpdate}
                  disabled={isSimulating}
                  className="px-2.5 py-1 text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg cursor-pointer transition-colors"
                  title="محاكاة تعديل فوري لاختبار التنبيه"
                >
                  🧪 تجربة تنبيه فوري
                </button>
              </div>
              <div className="flex items-center gap-2">
                {teamAlerts.length > 0 && (
                  <button
                    onClick={() => setTeamAlerts([])}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-700 text-xs font-bold cursor-pointer transition-colors"
                  >
                    مسح السجل
                  </button>
                )}
                <button
                  onClick={() => setShowAlertsDrawer(false)}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal: WhatsApp & Telegram Client Communication / Alerts */}
      {activeMessageClient && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden p-6 text-right font-['Cairo'] animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    إرسال إشعار للعميل (واتساب / تيليجرام)
                  </h3>
                  <p className="text-xs text-slate-500">
                    العميل: <b className="text-slate-800">{activeMessageClient.name}</b> (كود: <b className="font-mono text-indigo-900">{activeMessageClient.code}</b>)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveMessageClient(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Item Details Summary in Modal */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs mb-4">
              <div>
                <span className="text-slate-500 block text-[10px]">الطرود:</span>
                <b className="text-slate-900 font-mono text-sm">📦 {activeMessageClient.packages}</b>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">أيام البقاء بالساحة:</span>
                <b className="text-amber-800 font-mono text-sm">
                  ⏳ {calculateDaysInYard(entryDates[activeMessageClient.id] || getDefaultEntryDate(activeMessageClient))} يوم
                </b>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">المبلغ / الديون ($):</span>
                <b className="text-emerald-700 font-mono text-sm">
                  ${(activeMessageClient.totalSales || activeMessageClient.sales || 0).toLocaleString()}
                </b>
              </div>
            </div>

            {/* Template Selector */}
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-700 block mb-1.5">اختر نموذج الرسالة السريعة:</label>
              <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold">
                {[
                  { id: 'ready', label: '✅ جاهزية الاستلام' },
                  { id: 'overdue', label: '⚠️ تنبيه تجاوز 5 أيام' },
                  { id: 'mismatch', label: '🔍 مراجعة فرق الطرود' },
                  { id: 'debt', label: '💵 تسوية المستحقات' }
                ].map(tmpl => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      const days = calculateDaysInYard(entryDates[activeMessageClient.id] || getDefaultEntryDate(activeMessageClient));
                      const debtVal = activeMessageClient.totalSales || activeMessageClient.sales || 0;
                      const debtText = debtVal > 0 ? `علماً أن المبلغ المستحق هو $${debtVal}` : 'البضاعة خالصة المستحقات';
                      
                      let msg = '';
                      if (tmpl.id === 'ready') {
                        msg = `السلام عليكم أخي الكريم ${activeMessageClient.name}، نود إعلامكم بأن شحنتكم كود (${activeMessageClient.code}) بعدد (${activeMessageClient.packages}) طرود متواجدة وجاهزة للاستلام في الساحة. ${debtText}. يرجى التكرم بجدولة الاستلام. شكراً لتعاملكم معنا.`;
                      } else if (tmpl.id === 'overdue') {
                        msg = `عناية السيد ${activeMessageClient.name}، نود التنويه بأن بضاعتكم كود (${activeMessageClient.code}) مضى على تواجدها في الساحة أكثر من ${days} أيام. نرجو التكرم بالحضور للاستلام تفادياً لاحتساب رسوم إضافية. ${debtText}. مع التحية.`;
                      } else if (tmpl.id === 'mismatch') {
                        msg = `السلام عليكم ${activeMessageClient.name}، بخصوص الشحنة كود (${activeMessageClient.code})، يرجى التنسيق مع مشرف الساحة لتأكيد جرد ومطابقة الطرود قبل الاستلام.`;
                      } else {
                        msg = `السلام عليكم أخي ${activeMessageClient.name}، نرجو التكرم بتسوية المبلغ المستحق (${debtText}) على كود (${activeMessageClient.code}) تمهيداً لإنهاء إجراءات الإخراج والتسليم.`;
                      }
                      setCustomMessageText(msg);
                    }}
                    className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 text-right cursor-pointer transition-colors"
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Editable Notification Text */}
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-700 block mb-1.5">نص الرسالة المرسلة:</label>
              <textarea
                rows={4}
                value={customMessageText || `السلام عليكم أخي الكريم ${activeMessageClient.name}، نود إعلامكم بأن شحنتكم كود (${activeMessageClient.code}) بعدد (${activeMessageClient.packages}) طرود جاهزة للاستلام في الساحة. يرجى التكرم بالاستلام. شكراً لتعاملكم معنا.`}
                onChange={(e) => setCustomMessageText(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const phone = getCleanWhatsAppPhone(activeMessageClient.phone || activeMessageClient.phone2);
                  const msg = encodeURIComponent(customMessageText || `السلام عليكم ${activeMessageClient.name}، شحنتكم كود (${activeMessageClient.code}) جاهزة للاستلام بالساحة.`);
                  const url = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
                  window.open(url, '_blank');
                  syncItemUpdate(activeMessageClient, 'إرسال إشعار عبر واتساب للعميل', {});
                }}
                className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>إرسال واتساب</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const msg = encodeURIComponent(customMessageText || `السلام عليكم ${activeMessageClient.name}، شحنتكم كود (${activeMessageClient.code}) جاهزة للاستلام بالساحة.`);
                  window.open(`https://t.me/share/url?url=&text=${msg}`, '_blank');
                  syncItemUpdate(activeMessageClient, 'إرسال إشعار عبر تيليجرام للعميل', {});
                }}
                className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>إرسال تيليجرام</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const textToCopy = customMessageText || `السلام عليكم ${activeMessageClient.name}، شحنتكم كود (${activeMessageClient.code}) جاهزة للاستلام بالساحة.`;
                  navigator.clipboard.writeText(textToCopy);
                  setToastMessage('تم نسخ نص الإشعار بنجاح إلى الحافظة');
                }}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 transition-all cursor-pointer"
                title="نسخ نص الرسالة"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Modal: Individual Item Audit Trail (سجل تدقيق البند) */}
      {auditTrailItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden p-6 text-right font-['Cairo'] animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    سجل تدقيق وتعديلات البند
                  </h3>
                  <p className="text-xs text-slate-500">
                    كود: <b className="font-mono text-indigo-900">{auditTrailItem.code}</b> | العميل: <b className="text-slate-800">{auditTrailItem.name}</b>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuditTrailItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {auditLogs.filter(log => log.itemId === auditTrailItem.id || log.code === auditTrailItem.code).length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  لم يتم تسجيل أي تعديلات يدوية على هذا البند بعد. البند يحتفظ ببياناته الأصلية.
                </div>
              ) : (
                auditLogs
                  .filter(log => log.itemId === auditTrailItem.id || log.code === auditTrailItem.code)
                  .map(log => (
                    <div key={log.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-800">{log.action}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          بواسطة: <b className="text-indigo-900">{log.userName}</b>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                        {log.timestamp}
                      </span>
                    </div>
                  ))
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const target = auditTrailItem;
                  setAuditTrailItem(null);
                  setActiveMessageClient(target);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
                title="إرسال إشعار للعميل عبر واتساب أو تيليجرام"
              >
                <MessageCircle className="w-4 h-4" />
                <span>إشعار العميل (واتساب / تيليجرام)</span>
              </button>
              <button
                type="button"
                onClick={() => setAuditTrailItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Modal: Full General Audit Trail (سجل حركات وتدقيق الساحة العام) */}
      {showFullAuditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden p-6 text-right font-['Cairo'] animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    سجل التدقيق والتتبع العام لعمليات الساحة
                  </h3>
                  <p className="text-xs text-slate-500">
                    توثيق كامل لكافة عمليات مطابقة الأعداد، تسجيل الإخراج، وتعديل الملاحظات بالوقت واسم المستخدم
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFullAuditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {auditLogs.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  لا توجد حركات تدقيق مسجلة حتى الآن.
                </div>
              ) : (
                auditLogs.map(log => (
                  <div key={log.id} className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-xs flex items-center justify-between gap-3 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center text-[10px] font-bold">
                        {log.code ? log.code.slice(0, 3) : 'ساحة'}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">
                          {log.action}
                          {log.clientName && <span className="text-slate-500 font-normal mr-1.5">({log.clientName})</span>}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          المسؤول: <b className="text-indigo-900">{log.userName}</b>
                          {log.shipment && <span className="mr-2 text-slate-400">الشحنة: {log.shipment}</span>}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
                      {log.timestamp}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                إجمالي السجلات: <b className="font-mono text-slate-900">{auditLogs.length}</b> حركة
              </span>
              <div className="flex items-center gap-2">
                {auditLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuditLogs([]);
                      localStorage.removeItem('atlas_yard_audit_logs');
                      setToastMessage('تم تفريغ سجل التدقيق بنجاح');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 text-xs font-semibold cursor-pointer"
                  >
                    مسح السجل
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowFullAuditModal(false)}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 11. Modal: Inventory & Accounting Report Options (تصدير تقرير الجرد والتدقيق المحاسبي) */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 text-right font-['Cairo'] animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto mb-3 border border-indigo-200">
              <FileText className="w-6 h-6" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 text-center mb-1">
              تقرير الجرد والتدقيق المحاسبي
            </h3>
            
            <p className="text-xs text-slate-500 text-center leading-relaxed mb-4">
              تقرير رسمي للشحنة الحالية <b className="text-slate-800">({selectedShipment})</b> يتضمن كافة مؤشرات الأداء المالي، الطرود المحصلة، الفروقات، والديون
            </p>

            {/* Quick Metrics in Export Modal */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-xs mb-5">
              <div className="flex justify-between items-center text-slate-600">
                <span>عدد البنود في التقرير:</span>
                <b className="font-mono text-slate-900">{filteredItems.length} بند</b>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>إجمالي المبالغ المستحقة ($):</span>
                <b className="font-mono text-emerald-700">${totalFilteredSales.toLocaleString()}</b>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>المحصل (المُخرج) مقابل المتبقي:</span>
                <b className="font-mono text-cyan-800">${dispatchedSales.toLocaleString()} / ${remainingInYardSales.toLocaleString()}</b>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>البنود التي بها فروقات:</span>
                <b className="font-mono text-rose-700">{mismatchItemsCount} بند</b>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowExportModal(false);
                  handlePrintAccountingReport();
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة تقرير التدقيق المحاسبي المعتمد (A4 / PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowExportModal(false);
                  exportYardInventoryToExcel(filteredItems, selectedShipment, actualCounts, checkedItems, itemNotes);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تصدير إلى ملف إكسل متكامل (Excel)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {showUserModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 text-right font-['Cairo'] animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto mb-3 border border-indigo-200">
              <UserCog className="w-6 h-6" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 text-center mb-1">
              تحديد هوية واسم المستخدم للساحة والمستودع
            </h3>
            
            <p className="text-xs text-slate-500 text-center leading-relaxed mb-4">
              سيظهر هذا الاسم لزملائك في الفريق عند قيامك بتدقيق أي شحنة أو تعديل كميات الجرد الفعلي لمنع التداخل
            </p>

            {/* Role Quick Selection */}
            <div className="space-y-2 mb-4">
              <label className="text-xs font-bold text-slate-700 block">اختر من الأدوار السريعة:</label>
              {[
                'أمين المستودع (محمد)',
                'مشرف الساحة (أحمد)',
                'مراقب الجرد والتدقيق (علي)',
                'مسؤول التسليم والإخراج (عمر)',
                'إدارة الحركة واللوجستيك'
              ].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setCurrentUserName(preset);
                    localStorage.setItem('atlas_yard_user_name', preset);
                    setShowUserModal(false);
                    setToastMessage(`تم تعيين اسم المستخدم: ${preset}`);
                  }}
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold text-right flex items-center justify-between transition-colors cursor-pointer ${
                    currentUserName === preset
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-200'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <span>{preset}</span>
                  {currentUserName === preset && <Check className="w-4 h-4 text-indigo-600" />}
                </button>
              ))}
            </div>

            {/* Custom Name Input */}
            <div className="mb-5">
              <label className="text-xs font-bold text-slate-700 block mb-1.5">أو اكتب اسماً مخصصاً:</label>
              <input
                type="text"
                value={currentUserName}
                onChange={(e) => setCurrentUserName(e.target.value)}
                placeholder="اكتب اسمك ولقبك أو صفتك..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (currentUserName.trim()) {
                    localStorage.setItem('atlas_yard_user_name', currentUserName.trim());
                  }
                  setShowUserModal(false);
                  setToastMessage(`تم حفظ هوية المستخدم: ${currentUserName}`);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                تأكيد وحفظ
              </button>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
