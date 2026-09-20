import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ClipboardList, 
  Printer, 
  FileSpreadsheet, 
  Package,
  Check,
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
  ExternalLink,
  Calendar,
  ChevronDown,
  MessageCircle,
  Send,
  Share2,
  Copy,
  History,
  ListChecks,
  Tag,
  SlidersHorizontal,
  FileText,
  ArrowRight,
  CheckCircle2,
  Eye,
  Save,
  Warehouse,
  X,
  Search,
  Filter,
  Layers,
  Undo2
} from 'lucide-react';
import { ShipmentRecord } from '../types';
import { COMPANY_INFO } from '../data/initialData';
import { exportYardInventoryToExcel } from '../utils/excel';

export const YARD_INVENTORY_STORAGE_KEY = 'ocean_atlas_yard_inventory_draft_v3';

export interface DispatchedInfo {
  dispatched: boolean;
  time: string;
  date?: string;
  fullDateTime?: string;
  user?: string;
}

export interface DispatchMovement {
  id: string;
  quantity: number;
  date: string;
  time: string;
  fullDateTime: string;
  user?: string;
  type?: 'dispatch' | 'return';
}

export interface YardDraftData {
  lastSavedAt: string;
  checkedItems: Record<string, boolean>;
  actualCounts: Record<string, number | ''>;
  itemNotes: Record<string, string>;
  dispatchedItems?: Record<string, DispatchedInfo>;
  dispatchMovements?: Record<string, DispatchMovement[]>;
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

// Fallback only: an item that is already in the yard but has no recorded tally
// date is treated as if it entered today. The real entry date is always the day
// the physical tally (الجرد الفعلي) was migrated from واجهة جرد المستودعات.
export const getDefaultEntryDate = (_item: ShipmentRecord): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
  if (fallbackItem) return calculateDaysInYard(getDefaultEntryDate(fallbackItem));
  return 0;
};

// Render an ISO date (YYYY-MM-DD) as plain text in the YYYY/MM/DD format
export const formatEntryDate = (isoDate?: string): string => {
  if (!isoDate) return '—';
  const parts = String(isoDate).split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`;
  }
  return toLatinDigits(String(isoDate));
};

interface YardInventoryViewProps {
  shipments: ShipmentRecord[];
  onNavigateToDashboard?: () => void;
  canDispatch?: boolean;
  canExport?: boolean;
  canPrint?: boolean;
  loggedInUserName?: string;
}

export const YardInventoryView: React.FC<YardInventoryViewProps> = ({ 
  shipments, 
  onNavigateToDashboard,
  canDispatch = true,
  canExport = true,
  canPrint = true,
  loggedInUserName,
}) => {
  // Shipment selection is fixed to all items (the UI selector was removed)
  const [selectedShipment] = useState<string>('الكل');
  const setSelectedShipment = (_value: string) => {};

  // Smart search + filters for the yard dispatch table
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [shipmentFilter, setShipmentFilter] = useState<string>('الكل');
  const [codeFilter, setCodeFilter] = useState<string>('');

  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  // User identity & device identifier for cross-device synchronization
  const [currentUserName, setCurrentUserName] = useState<string>(() => {
    return loggedInUserName || localStorage.getItem('atlas_yard_user_name') || 'أمين المستودع (محمد)';
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
  const lastSyncPollTimestampRef = useRef<number>(Date.now());
  // When a one-time cleanup runs, we skip merging the stale server state back in
  const skipServerMergeRef = useRef<boolean>(false);

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

  // Partial dispatch movements: per-item array of dispatch records (quantity + date/time)
  const [dispatchMovements, setDispatchMovements] = useState<Record<string, DispatchMovement[]>>(() => {
    try {
      const raw = localStorage.getItem(YARD_INVENTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as YardDraftData;
        return parsed.dispatchMovements || {};
      }
    } catch (e) {
      console.warn('Failed to parse saved dispatch movements', e);
    }
    return {};
  });

  // Controlled input values for the "new dispatch" field of each row
  const [newDispatchInputs, setNewDispatchInputs] = useState<Record<string, string>>({});
  const [newReturnInputs, setNewReturnInputs] = useState<Record<string, string>>({});

  // Client whose movement-history modal is currently open
  const [movementHistoryItem, setMovementHistoryItem] = useState<ShipmentRecord | null>(null);

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

  // Global batch entry date picker removed: entry dates are fixed and read-only.

  // 1. Batch Selection for Bulk Actions
  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>({});

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

  // Entry date = the day the physical tally (الجرد الفعلي) was saved/migrated to
  // the yard. The removed batch-date tool had stamped every item with one stale
  // placeholder date, so this one-time repair re-stamps each tallied item with
  // the actual tally/save day and drops leftovers for untallied items.
  const entryDateRepairDone = useRef<boolean>(false);
  useEffect(() => {
    if (entryDateRepairDone.current) return;
    if (localStorage.getItem('atlas_yard_entry_date_repair_v1') === 'done') {
      entryDateRepairDone.current = true;
      return;
    }

    const talliedIds = Object.keys(actualCounts).filter(
      id => actualCounts[id] !== undefined && actualCounts[id] !== ''
    );
    if (talliedIds.length === 0) return; // wait until the tally state is loaded

    const pad = (n: number) => String(n).padStart(2, '0');
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    // Prefer the recorded tally save day over "now" when it is available.
    const savedDay = (lastSavedTime || '').slice(0, 10);
    const entryDate = /^\d{4}-\d{2}-\d{2}$/.test(savedDay) ? savedDay : todayStr;

    setEntryDates(() => {
      const next: Record<string, string> = {};
      talliedIds.forEach(id => {
        next[id] = entryDate;
      });
      return next;
    });

    // Persist immediately so the repaired dates stick even if the app closes
    // before the debounced / periodic auto-save fires.
    try {
      const repairTime = new Date();
      const timeStr = toLatinDigits(repairTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const fullTimeStr = `${entryDate} - ${timeStr}`;
      const repairedDraft: YardDraftData = {
        lastSavedAt: fullTimeStr,
        checkedItems,
        actualCounts,
        itemNotes,
        dispatchedItems,
        dispatchMovements,
        entryDates: Object.fromEntries(talliedIds.map(id => [id, entryDate])),
      };
      localStorage.setItem(YARD_INVENTORY_STORAGE_KEY, JSON.stringify(repairedDraft));
      fetch('/api/yard-inventory/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          userName: currentUserName,
          draft: repairedDraft,
          ...repairedDraft,
          action: 'تصحيح تاريخ الجرد الفعلي (تاريخ الترحيل)',
        }),
      }).catch(() => {});
    } catch (err) {
      console.warn('Could not persist repaired entry dates', err);
    }

    localStorage.setItem('atlas_yard_entry_date_repair_v1', 'done');
    entryDateRepairDone.current = true;
  }, [actualCounts, lastSavedTime]);

  const [saveModalOpen, setSaveModalOpen] = useState(false);
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

  // One-time cleanup: ensure the physical tally starts at zero for existing users.
  // Runs only if an older draft exists in this browser and the cleanup hasn't run yet.
  useEffect(() => {
    const MIGRATION_KEY = 'atlas_yard_zero_migration_v4';
    try {
      if (localStorage.getItem(MIGRATION_KEY)) return;
      // Only truly legacy draft keys are considered; the current key may already
      // hold a valid tally migrated from "جرد المستودعات" and must not be wiped.
      const legacyDraft =
        localStorage.getItem('ocean_atlas_yard_inventory_draft_v2') ||
        localStorage.getItem('ocean_atlas_yard_inventory_draft');
      if (!legacyDraft) {
        // Fresh browser: nothing to clean, keep any server-side official data.
        localStorage.setItem(MIGRATION_KEY, 'fresh');
        return;
      }
      skipServerMergeRef.current = true;
      setActualCounts({});
      setCheckedItems({});
      setDispatchedItems({});
      setDispatchMovements({});
      localStorage.setItem(MIGRATION_KEY, 'cleaned');
      fetch('/api/yard-inventory/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, userName: currentUserName })
      }).catch(() => {});
    } catch {
      // ignore storage errors
    }
  }, []);

  // Cross-device server synchronization: initial load + SSE real-time stream + fallback polling
  useEffect(() => {
    let sse: EventSource | null = null;
    let pollInterval: any = null;

    // 1. Initial fetch from server
    const fetchInitialServerState = async () => {
      const skipMerge = skipServerMergeRef.current;
      try {
        const res = await fetch('/api/yard-inventory');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.state) {
            const state = data.state;
            if (!skipMerge) {
              if (state.checkedItems && Object.keys(state.checkedItems).length > 0) {
                setCheckedItems(prev => ({ ...state.checkedItems, ...prev }));
              }
              if (state.actualCounts && Object.keys(state.actualCounts).length > 0) {
                setActualCounts(prev => ({ ...state.actualCounts, ...prev }));
              }
              if (state.dispatchedItems && Object.keys(state.dispatchedItems).length > 0) {
                setDispatchedItems(prev => ({ ...state.dispatchedItems, ...prev }));
              }
            }
            if (state.itemNotes && Object.keys(state.itemNotes).length > 0) {
              setItemNotes(prev => ({ ...state.itemNotes, ...prev }));
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

  // Dispatch availability is decided per ITEM, not per shipment: shipments arrive
  // in parts, so any item whose physical tally (الجرد الفعلي) was entered becomes
  // immediately dispatchable while the rest of the shipment keeps waiting.
  const isItemTallied = (item: ShipmentRecord): boolean => {
    const value = actualCounts[item.id];
    return value !== undefined && value !== '';
  };

  // Actual tallied quantity of an item (الطرود المجرودة فعلياً)
  const getCountedQty = (item: ShipmentRecord): number => {
    const value = actualCounts[item.id];
    return value !== undefined && value !== '' ? Number(value) || 0 : 0;
  };

  // Dispatched quantity: derived from the tallied stock only.
  const getDispatchedQty = (item: ShipmentRecord): number => {
    if (!isItemTallied(item)) return 0;
    const counted = getCountedQty(item);
    const movements = dispatchMovements[item.id] || [];
    const movedQty = movements.reduce((sum, m) => {
      const q = Number(m.quantity) || 0;
      return m.type === 'return' ? sum - q : sum + q;
    }, 0);
    if (movements.length > 0) {
      return Math.min(counted, Math.max(0, movedQty));
    }
    const legacyFull = dispatchedItems[item.id]?.dispatched ? counted : 0;
    return Math.min(counted, legacyFull);
  };

  // Remaining in yard = tallied quantity - dispatched quantity
  const getRemainingQty = (item: ShipmentRecord): number => {
    if (!isItemTallied(item)) return 0;
    return Math.max(0, getCountedQty(item) - getDispatchedQty(item));
  };

  // Execute a partial dispatch: record the movement and update the remaining balance
  const handlePartialDispatch = (item: ShipmentRecord) => {
    if (!canDispatch) {
      setToastMessage('ليست لديك صلاحية إخراج البضائع');
      return;
    }
    if (!isItemTallied(item)) {
      setToastMessage(`لا يمكن الإخراج: لم يتم جرد البند ${item.code} فعلياً بعد`);
      return;
    }
    const raw = (newDispatchInputs[item.id] || '').replace(/[^\d]/g, '');
    const quantity = Number(raw);
    const remaining = getRemainingQty(item);

    if (!raw || quantity <= 0) {
      setToastMessage(`يرجى إدخال كمية إخراج صحيحة للعميل ${item.code}`);
      return;
    }
    if (quantity > remaining) {
      setToastMessage(`الكمية المطلوبة (${quantity}) أكبر من المتبقي في الساحة (${remaining}) للعميل ${item.code}`);
      return;
    }

    const now = new Date();
    const timeStr = toLatinDigits(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    const dateStr = toLatinDigits(now.toISOString().slice(0, 10));
    const fullDateTime = `${dateStr} ${timeStr}`;

    const movement: DispatchMovement = {
      id: 'mv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      quantity,
      date: dateStr,
      time: timeStr,
      fullDateTime,
      user: currentUserName,
      type: 'dispatch',
    };

    const updatedMovements = {
      ...dispatchMovements,
      [item.id]: [...(dispatchMovements[item.id] || []), movement]
    };
    const newRemaining = Math.max(0, remaining - quantity);

    setDispatchMovements(updatedMovements);
    setNewDispatchInputs(prev => ({ ...prev, [item.id]: '' }));

    const nextState: DispatchedInfo = {
      dispatched: newRemaining === 0,
      time: timeStr,
      date: dateStr,
      fullDateTime,
      user: currentUserName
    };
    setDispatchedItems(prev => ({ ...prev, [item.id]: nextState }));

    const actionText = `إخراج جزئي (${quantity} طرد) للعميل ${item.code} في [${fullDateTime}] - المتبقي بالساحة: ${newRemaining} طرد`;
    setToastMessage(`تم تنفيذ الإخراج: ${actionText}`);
    syncItemUpdate(item, actionText, { dispatched: nextState, dispatchMovements: updatedMovements });
  };

  const handleReturnToYard = (item: ShipmentRecord) => {
    if (!canDispatch) {
      setToastMessage('ليست لديك صلاحية إرجاع الطرود');
      return;
    }
    if (!isItemTallied(item)) {
      setToastMessage(`لا يمكن الإرجاع: لم يتم جرد البند ${item.code} فعلياً بعد`);
      return;
    }
    const raw = (newReturnInputs[item.id] || '').replace(/[^\d]/g, '');
    const quantity = Number(raw);
    const dispatchedQty = getDispatchedQty(item);

    if (!raw || quantity <= 0) {
      setToastMessage(`يرجى إدخال كمية إرجاع صحيحة للعميل ${item.code}`);
      return;
    }
    if (quantity > dispatchedQty) {
      setToastMessage(`الكمية المطلوبة (${quantity}) أكبر من إجمالي المخرجات (${dispatchedQty}) للعميل ${item.code}`);
      return;
    }

    const now = new Date();
    const timeStr = toLatinDigits(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    const dateStr = toLatinDigits(now.toISOString().slice(0, 10));
    const fullDateTime = `${dateStr} ${timeStr}`;

    const existing = dispatchMovements[item.id] || [];
    const counted = getCountedQty(item);
    const seedMovements =
      existing.length === 0 && dispatchedQty > 0
        ? [
            {
              id: 'mv_seed_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              quantity: dispatchedQty,
              date: dateStr,
              time: timeStr,
              fullDateTime,
              user: currentUserName,
              type: 'dispatch' as const,
            },
          ]
        : existing;

    const movement: DispatchMovement = {
      id: 'mv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      quantity,
      date: dateStr,
      time: timeStr,
      fullDateTime,
      user: currentUserName,
      type: 'return',
    };

    const updatedMovements = {
      ...dispatchMovements,
      [item.id]: [...seedMovements, movement],
    };
    const newDispatched = Math.max(0, dispatchedQty - quantity);
    const newRemaining = Math.max(0, counted - newDispatched);

    setDispatchMovements(updatedMovements);
    setNewReturnInputs((prev) => ({ ...prev, [item.id]: '' }));

    const nextState: DispatchedInfo = {
      dispatched: newRemaining === 0,
      time: timeStr,
      date: dateStr,
      fullDateTime,
      user: currentUserName,
    };
    setDispatchedItems((prev) => ({ ...prev, [item.id]: nextState }));

    const actionText = `إرجاع طرود (${quantity} طرد) للعميل ${item.code} في [${fullDateTime}] - المتبقي بالساحة: ${newRemaining} طرد`;
    setToastMessage(`تم تنفيذ الإرجاع: ${actionText}`);
    syncItemUpdate(item, actionText, { dispatched: nextState, dispatchMovements: updatedMovements });
  };

  // Teammate-update simulation removed: it wrote to the physical tally, which is now
  // read-only in this view and can only be edited from واجهة جرد المستودعات.

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
          dispatchMovements,
          entryDates
        };
        localStorage.setItem(YARD_INVENTORY_STORAGE_KEY, JSON.stringify(draft));
        setLastSavedTime(fullTimeStr);
      } catch (err) {
        console.error('Error saving yard draft to localStorage', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [checkedItems, actualCounts, itemNotes, dispatchedItems, dispatchMovements, entryDates]);

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
          dispatchMovements,
          entryDates
        };
        localStorage.setItem(YARD_INVENTORY_STORAGE_KEY, JSON.stringify(draft));
        setLastSavedTime(fullTimeStr);

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
            dispatchMovements,
            entryDates,
            action: 'حفظ تلقائي دوري كل 1 دقيقة'
          })
        }).catch(() => {});
      } catch (err) {
        console.warn('Auto save error:', err);
      }
    }, 60000); // 1 minute interval

    return () => clearInterval(autoSaveInterval);
  }, [checkedItems, actualCounts, itemNotes, dispatchedItems, dispatchMovements, entryDates, deviceId, currentUserName]);

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

  // Items for the current shipment scope (all items)
  const baseItems = useMemo(() => {
    return shipments.filter(s => selectedShipment === 'الكل' || s.shipment === selectedShipment);
  }, [shipments, selectedShipment]);

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

  // The dispatch table starts completely empty. An item only appears once its
  // physical tally (الجرد الفعلي) has been migrated from the inventory system.
  // No dummy / hardcoded data is used to populate this table.
  const migratedItems = useMemo(() => {
    return baseItems.filter(
      item => actualCounts[item.id] !== undefined && actualCounts[item.id] !== ''
    );
  }, [baseItems, actualCounts]);

  // Shipment codes available in the migrated (tallied) yard items, for the filter dropdown
  const availableShipmentCodes = useMemo(() => {
    const codes = new Set<string>();
    migratedItems.forEach(item => {
      if (item.shipment) codes.add(item.shipment);
    });
    return Array.from(codes).sort();
  }, [migratedItems]);

  // Smart filtering: comprehensive search (name, address, notes, code, shipment)
  // combined with the shipment-code and customer-code filters.
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const codeQuery = codeFilter.trim().toLowerCase();

    return migratedItems.filter(item => {
      if (shipmentFilter !== 'الكل' && item.shipment !== shipmentFilter) return false;

      if (codeQuery && !String(item.code || '').toLowerCase().includes(codeQuery)) return false;

      if (query) {
        const haystack = [
          item.name,
          item.address,
          item.city,
          item.code,
          item.shipment,
          item.guarantor,
          itemNotes[item.id],
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [migratedItems, searchQuery, shipmentFilter, codeFilter, itemNotes]);

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

  // Batch Action 1 (approve audit) removed: the physical tally is read-only in this view.
  // The actual count is entered and migrated from واجهة جرد المستودعات only.

  // Batch Action 2: Mark Yard Dispatch for all selected
  const handleBatchMarkDispatch = () => {
    if (!canDispatch) return;
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

  // Batch Action 3 (apply entry date) removed: entry dates are fixed and read-only here.

  // Generate Smart Pre-formatted Notification Messages for Clients
  const getPreformattedMessage = (item: ShipmentRecord, type: 'ready' | 'overdue' | 'mismatch' | 'debt'): string => {
    const cleanPhone = (item.phone || item.phone2 || '').trim();
    const itemEntry = entryDates[item.id] || getDefaultEntryDate(item);
    const days = calculateDaysInYard(itemEntry, item);
    const actual = actualCounts[item.id] !== undefined && actualCounts[item.id] !== '' ? actualCounts[item.id] : item.packages;
    const debt = Number(item.sales || 0);

    if (type === 'ready') {
      return `السلام عليكم ورحمة الله وبركاته، الأخ الكريم / ${item.name} المحترم.\nتحية طيبة من شركة أطلس المحيط للشحن الدولي والتخليص الجمركي 🚢✈️.\n\nيسرنا إعلامكم بأن بضاعتكم شحنة [${item.shipment}] بالكود [${item.code}] بعدد (${item.packages} طرد) جاهزة ومفحوصة للاستلام في ساحة ومستودع الشركة.\nالمبلغ المستحق: $${debt.toLocaleString('en-US')}\nالعنوان: ${item.address || item.city}\n\nيرجى التفضل بالحضور للاستلام، مع خالص التقدير.`;
    }

    if (type === 'overdue') {
      return `تنبيه ومتابعة بضاعة في الساحة - شركة أطلس المحيط.\nالأخ الكريم / ${item.name} المحترم (الكود: ${item.code}).\n\nنود لفت عنايتكم الكريمة إلى أن بضاعتكم في شحنة [${item.shipment}] بعدد (${item.packages} طرد) متواجدة في ساحة الشركة منذ (${days} أيام).\nنرجو التكرم بالتنسيق واستلام البضاعة بأقرب وقت لتفادي أي رسوم تخزين إضافية.\nالمبلغ المستحق: $${debt.toLocaleString('en-US')}\nللتواصل والاستفسار يرجى الرد على هذه الرسالة. شكراً لتعاونكم.`;
    }

    if (type === 'mismatch') {
      const diff = Number(actual) - item.packages;
      const note = itemNotes[item.id] || '';
      return `إشعار تدقيق وجرد الساحة - شركة أطلس المحيط.\nالأخ الكريم / ${item.name} المحترم (الكود: ${item.code}).\n\nنحيطكم علماً بأنه تم إجراء الجرد والتدقيق الفعلي لشحنتكم [${item.shipment}]:\n- الطرود المقيدة بالمنفيست: (${item.packages}) طرد\n- الطرود المحصورة فعلياً بالساحة: (${actual}) طرد ${diff !== 0 ? `(يوجد فرق: ${diff > 0 ? `+${diff}` : diff})` : '(مطابقة)'}\n${note ? `- ملاحظة الجرد: ${note}\n` : ''}\nيرجى التنسيق مع مسؤول الساحة أو الكفيل [${item.guarantor || 'الإدارة'}].`;
    }

    // debt
    return `تذكير بالمطالبة المالية - شركة أطلس المحيط.\nالأخ الكريم / ${item.name} المحترم (الكود: ${item.code}).\n\nنرجو التكرم بالعلم بأن المبلغ المستحق على شحنتكم [${item.shipment}] بعدد (${item.packages} طرد) هو: $${debt.toLocaleString('en-US')}.\nيرجى تسديد المبلغ عند الاستلام أو التنسيق مع القسم المالي.\nشاكرين ومقدرين حسن تعاملكم.`;
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
          <td style="text-align: center; font-weight: 800; color: #047857; font-family: monospace;">$${Number(item.sales || 0).toLocaleString('en-US')}</td>
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
              تقرير جرد الساحة والتدقيق المحاسبي المعتمد - الشحنة: [${selectedShipment}]
            </div>
          </div>
          <div style="text-align: left; font-size: 10px; color: #475569;">
            <div>تاريخ التقرير: <b>${new Date().toLocaleDateString('ar-IQ-u-nu-latn')}</b></div>
            <div>اسم المدقق: <b>${currentUserName}</b></div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">إجمالي المبالغ والديون ($)</div>
            <div class="kpi-val" style="color: #047857;">$${totalFilteredSales.toLocaleString('en-US')}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">المبالغ المحصلة / المخرجة ($)</div>
            <div class="kpi-val" style="color: #0284c7;">$${dispatchedSales.toLocaleString('en-US')}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">الديون المتبقية بالساحة ($)</div>
            <div class="kpi-val" style="color: #b45309;">$${remainingInYardSales.toLocaleString('en-US')}</div>
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

  // Reset handler removed: the physical tally is read-only in this view and can only
  // be cleared from واجهة جرد المستودعات, so no local reset of these numbers is allowed.

  // Print Handler
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'height=900,width=800');
    if (!printWindow) {
      window.print();
      return;
    }

    // This sheet is a BLANK PRINT TEMPLATE for manual pen entry in the yard.
    // It intentionally prints no tallied numbers, no match status and no notes.
    const tableRows = filteredItems.map((item, idx) => {
      return `
        <tr>
          <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
          <td style="font-weight: bold; font-family: monospace; font-size: 16px;">${item.code}</td>
          <td>
            <b>${item.name}</b>
            <div style="font-size: 10px; color: #475569;">${item.address || item.city}</div>
          </td>
          <td style="text-align: center; font-weight: bold;">${item.packages}</td>
          <td class="blank-cell"></td>
          <td class="blank-cell"></td>
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
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 5px; table-layout: fixed; }
          th, td { padding: 6px 8px; border: 1px solid #94a3b8; text-align: right; }
          th { background-color: #1e293b !important; color: #ffffff !important; font-weight: bold; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .blank-cell { height: 42px; min-height: 42px; background-color: #ffffff !important; }
          .footer { margin-top: 35px; display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h2>${COMPANY_INFO.nameAr}</h2>
          <p>نموذج ومحضر جرد الساحة والمستودع الفعلي (A4) — قالب للتدوين اليدوي</p>
        </div>
        <div class="info-bar">
          <div>الشحنة: <b>${selectedShipment}</b></div>
          <div>تاريخ الجرد: <b>${todayStr}</b></div>
          <div>الطرود المقيدة: <b>${totalExpectedPackages} طرد</b></div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 6%; text-align: center;">#</th>
              <th style="width: 14%;">كود العميل</th>
              <th style="width: 42%;">العميل والعنوان</th>
              <th style="width: 12%; text-align: center;">الطرود المقيدة</th>
              <th style="width: 13%; text-align: center;">الجرد الفعلي بالساحة</th>
              <th style="width: 13%; text-align: center;">الفرق / ملاحظات</th>
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
    <div className="w-full max-w-none space-y-3 font-['Cairo'] overflow-x-hidden">
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
      <div className="w-full max-w-none bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-200">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-600 border border-amber-500/30 flex items-center justify-center font-bold shrink-0">
              <Warehouse className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 font-['Cairo']">
                  واجهة إخراج البضائع
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
                إدارة إخراج الطرود الجزئي للعملاء وتتبع حركة الإخراج، مع احتساب المتبقي في الساحة تلقائياً
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
                      {canPrint && (
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
                      )}

                      {canExport && (
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
                      )}
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

                      {/* 8. Teammate Simulation removed: tally is read-only in this view */}

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

                    {/* Section 3 removed: no local reset of the migrated tally numbers */}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* الإخراج متاح لكل بند تم جرده فعلياً — البنود غير المجرودة لا تظهر حتى يتم جردها */}

      </div>

      {/* Main Yard Table */}
      <div className="w-full max-w-none bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-3 py-3 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold font-['Cairo']">
              جدول طرود الساحة - الشحنة: [{selectedShipment}]
            </h3>
            <span className="text-xs bg-slate-700/80 text-amber-400 px-2 py-0.5 rounded font-mono font-bold">
              المعروض: {filteredItems.length} عميل
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-300 hidden sm:inline">
              💾 يتم حفظ التعديلات في المتصفح تلقائياً عند إدخال أي رقم أو ملاحظة
            </span>
          </div>
        </div>

        {/* Smart Search & Filters Toolbar */}
        <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث شامل: الاسم، العنوان، الملاحظات، الكود..."
              className="w-full pr-9 pl-8 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500 font-medium text-slate-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                title="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-slate-500" />
            <select
              value={shipmentFilter}
              onChange={(e) => setShipmentFilter(e.target.value)}
              className="py-2 px-3 text-xs border border-slate-300 rounded-lg bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500 font-bold text-slate-800 cursor-pointer"
              title="تصفية حسب رقم الشحنة"
            >
              <option value="الكل">كل الشحنات</option>
              {availableShipmentCodes.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={codeFilter}
              onChange={(e) => setCodeFilter(e.target.value)}
              placeholder="فلتر كود العميل..."
              className="w-40 py-2 px-3 text-xs border border-slate-300 rounded-lg bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500 font-mono font-medium text-slate-800"
              title="تصفية حسب كود العميل"
            />
          </div>

          {(searchQuery || shipmentFilter !== 'الكل' || codeFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setShipmentFilter('الكل');
                setCodeFilter('');
              }}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all"
              title="إعادة تعيين جميع الفلاتر"
            >
              <X className="w-3.5 h-3.5" />
              مسح الفلاتر
            </button>
          )}

          <span className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-2 whitespace-nowrap">
            النتائج: <span className="font-mono text-slate-900">{filteredItems.length}</span>
          </span>
        </div>

        <div className="w-full overflow-x-auto custom-scrollbar min-h-[min(70vh,860px)] max-h-[min(75vh,900px)]">
          <table className="w-full min-w-full text-right text-xs border-collapse table-auto">
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
                <th className="py-3 px-3 text-center w-24 bg-slate-700/60 text-amber-300">إجمالي الطرود المقيدة</th>
                <th className="py-3 px-3 text-center w-24 bg-slate-700/60 text-amber-300">إجمالي المخرجات</th>
                <th className="py-3 px-3 text-center w-32 bg-slate-700/60 text-amber-300">المتبقي في الساحة</th>
                <th className="py-3 px-3 text-center w-28 bg-slate-700/60 text-amber-300">الإخراج الجديد</th>
                <th className="py-3 px-3 text-center w-24 bg-slate-700/60 text-amber-300">تنفيذ الإخراج</th>
                <th className="py-3 px-3 text-center w-28 bg-rose-900/70 text-rose-200">إرجاع طرود</th>
                <th className="py-3 px-3 text-center w-24 bg-rose-900/70 text-rose-200">تنفيذ الإرجاع</th>
                <th className="py-3 px-2 text-center w-14 bg-slate-750" title="سجل تدقيق وتعديلات البند ومراسلة العميل">
                  <span className="inline-flex items-center justify-center gap-1 text-[11px] font-bold text-amber-300">
                    <History className="w-3 h-3 text-amber-400" />
                    <span>سجل</span>
                  </span>
                </th>
                <th className="py-3 px-3 w-24">الكود</th>
                <th className="py-3 px-3 text-center w-24 bg-slate-700/60 text-amber-300">رقم الشحنة</th>
                <th className="py-3 px-3 text-center w-28 bg-slate-700/60 text-amber-300">المبلغ / الديون ($)</th>
                <th className="py-3 px-3 w-32 bg-slate-700/60 text-amber-300">الكفيل</th>
                <th className="py-3 px-3 min-w-[140px]">اسم العميل</th>
                <th className="py-3 px-3 min-w-[170px]">العنوان والمحافظة</th>
                <th className="py-3 px-3 text-center w-24">الطرود المقيدة</th>
                <th className="py-3 px-3 text-center min-w-[170px]">تاريخ الدخول وعداد البقاء بالساحة</th>
                <th className="py-3 px-3 text-center w-48">الجرد الفعلي في الساحة</th>
                <th className="py-3 px-3 text-center min-w-[320px]">ملاحظات الساحة والأوسمة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={21} className="py-16 text-center text-slate-400">
                    <div className="max-w-md mx-auto text-center">
                      <Package className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                      <p className="text-sm font-bold text-slate-600">الجدول فارغ، بانتظار ترحيل البضائع من الجرد</p>
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
                  const dispatchedQty = getDispatchedQty(item);
                  const remainingQty = getRemainingQty(item);
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
                            const actionText = newChecked ? 'تأكيد تدقيق البند ومطابقته' : 'إلغاء تدقيق البند';
                            syncItemUpdate(item, actionText, { checked: newChecked });
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

                      {/* Partial dispatch: totals, remaining balance, new dispatch input & execute button */}
                      <td className="py-3 px-3 text-center font-bold text-slate-800 font-mono bg-slate-50/40">
                        {item.packages}
                      </td>

                      <td className="py-3 px-3 text-center font-bold font-mono bg-slate-50/40">
                        <span className={dispatchedQty > 0 ? 'text-cyan-700' : 'text-slate-400'}>{dispatchedQty}</span>
                      </td>

                      <td className="py-3 px-3 text-center bg-slate-50/40">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`font-black font-mono ${remainingQty === 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
                            {remainingQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => setMovementHistoryItem(item)}
                            className="inline-flex items-center justify-center p-1 rounded-lg bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 hover:border-amber-400 transition-colors cursor-pointer shadow-2xs"
                            title="عرض سجل حركات إخراج الطرود لهذا العميل"
                          >
                            <History className="w-3.5 h-3.5 text-amber-700" />
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={newDispatchInputs[item.id] || ''}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/[^\d]/g, '');
                            setNewDispatchInputs(prev => ({ ...prev, [item.id]: digits }));
                          }}
                          disabled={remainingQty === 0 || !canDispatch}
                          placeholder="0"
                          className="w-20 px-2 py-1.5 text-center font-bold font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          title={!canDispatch ? 'ليست لديك صلاحية الإخراج' : remainingQty === 0 ? 'تم إخراج كامل الطرود المجرودة' : 'أدخل عدد الطرود المراد إخراجها الآن'}
                        />
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handlePartialDispatch(item)}
                          disabled={remainingQty === 0 || !canDispatch}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] shadow-xs cursor-pointer transition-all active:scale-95 whitespace-nowrap disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                          title={
                            !canDispatch
                              ? 'ليست لديك صلاحية الإخراج'
                              : remainingQty === 0
                              ? 'تم إخراج كامل الطرود المجرودة'
                              : 'تنفيذ إخراج الكمية المدخلة'
                          }
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>إخراج</span>
                        </button>
                        {isDispatched && (
                          <div className="mt-1 text-[9px] text-emerald-800 font-mono font-bold leading-tight">
                            {dispatchedInfo?.fullDateTime}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={newReturnInputs[item.id] || ''}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/[^\d]/g, '');
                            setNewReturnInputs((prev) => ({ ...prev, [item.id]: digits }));
                          }}
                          disabled={dispatchedQty === 0 || !canDispatch}
                          placeholder="0"
                          className="w-20 px-2 py-1.5 text-center font-bold font-mono text-xs bg-rose-50 border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          title={!canDispatch ? 'ليست لديك صلاحية الإرجاع' : dispatchedQty === 0 ? 'لا توجد مخرجات لإرجاعها' : 'أدخل عدد الطرود المراد إرجاعها للساحة'}
                        />
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleReturnToYard(item)}
                          disabled={dispatchedQty === 0 || !canDispatch}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] shadow-xs cursor-pointer transition-all active:scale-95 whitespace-nowrap disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                          title={
                            !canDispatch
                              ? 'ليست لديك صلاحية الإرجاع'
                              : dispatchedQty === 0
                              ? 'لا توجد مخرجات لإرجاعها'
                              : 'تنفيذ إرجاع الكمية المدخلة إلى الساحة'
                          }
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          <span>إرجاع</span>
                        </button>
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

                      {/* Shipment Number */}
                      <td className="py-3 px-3 text-center bg-amber-50/20">
                        {item.shipment ? (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 font-mono font-bold text-[11px] whitespace-nowrap">
                            {item.shipment}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Amount / Debt ($) Column (Directive #4) */}
                      <td className="py-3 px-3 font-mono font-extrabold text-center whitespace-nowrap bg-amber-50/20">
                        <span className="text-emerald-700 font-mono text-xs font-black">
                          ${Number(item.sales || 0).toLocaleString('en-US')}
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

                      {/* Entry date (plain text, migrated/read-only) & Accurate Days in Yard Counter */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center gap-1.5 min-w-[130px]">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-mono font-bold text-xs shadow-2xs"
                            dir="ltr"
                            title="تاريخ دخول البضاعة للساحة (ثابت ومُرحّل من الجرد)"
                          >
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>{formatEntryDate(itemEntryDate)}</span>
                          </span>

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

                      {/* Actual tally (read-only): the number is migrated from واجهة جرد المستودعات */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                           <input
                             type="text"
                             dir="ltr"
                             readOnly
                             disabled
                             aria-readonly="true"
                             tabIndex={-1}
                             value={hasActual ? toLatinDigits(String(actual)) : ''}
                             placeholder="0"
                             className={`w-20 px-2 py-1 text-center font-mono font-bold text-xs border rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed ${
                               hasMismatch ? 'border-rose-300' : 'border-slate-300'
                             }`}
                             title="حقل مقفل للقراءة فقط — يتم ترحيل الرقم من واجهة جرد المستودعات"
                           />
                        </div>
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
              {/* Batch Action 1 removed: الجرد الفعلي is read-only here and comes from جرد المستودعات */}

              {/* Batch Action 2: تسجيل إخراج الساحة دفعة واحدة */}
              {canDispatch && (
              <button
                type="button"
                onClick={handleBatchMarkDispatch}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                title="تسجيل إشارة إخراج الساحة لكافة البنود المحددة دفعة واحدة"
              >
                <Truck className="w-4 h-4" />
                <span>تسجيل إخراج الساحة ({selectedCount})</span>
              </button>
              )}

              {/* Batch Action 3 removed: entry dates are fixed and read-only in this view */}

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

      {/* 5. Modal: Confirm Reset Draft — removed (tally is read-only in this view) */}

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
                  ${(activeMessageClient.totalSales || activeMessageClient.sales || 0).toLocaleString('en-US')}
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

      {/* 12. Modal: Partial Dispatch Movement History (سجل حركات إخراج الطرود للعميل) */}
      {movementHistoryItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden p-6 text-right font-['Cairo'] animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">سجل حركات إخراج الطرود</h3>
                  <p className="text-xs text-slate-500">
                    العميل: <b className="text-slate-800">{movementHistoryItem.name}</b>
                    <span className="mx-1.5 text-slate-300">|</span>
                    الكود: <b className="font-mono text-amber-700">{movementHistoryItem.code}</b>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMovementHistoryItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
              <div className="bg-slate-50 rounded-xl p-2 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-bold">الطرود المقيدة</div>
                <div className="font-black font-mono text-slate-800">{movementHistoryItem.packages}</div>
              </div>
              <div className="bg-cyan-50 rounded-xl p-2 border border-cyan-200">
                <div className="text-[10px] text-cyan-800 font-bold">إجمالي المخرجات</div>
                <div className="font-black font-mono text-cyan-900">{getDispatchedQty(movementHistoryItem)}</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-2 border border-amber-200">
                <div className="text-[10px] text-amber-800 font-bold">المتبقي في الساحة</div>
                <div className="font-black font-mono text-amber-950">{getRemainingQty(movementHistoryItem)}</div>
              </div>
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {(dispatchMovements[movementHistoryItem.id] || []).length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  لا توجد حركات إخراج مسجلة لهذا العميل حتى الآن.
                </div>
              ) : (
                [...(dispatchMovements[movementHistoryItem.id] || [])].reverse().map(mv => (
                  <div key={mv.id} className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-xs flex items-center justify-between gap-3 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-black font-mono">
                        {mv.quantity}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">تم إخراج {mv.quantity} طرد</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          المسؤول: <b className="text-indigo-900">{mv.user || '—'}</b>
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
                      {mv.fullDateTime}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                إجمالي الحركات: <b className="font-mono text-slate-900">{(dispatchMovements[movementHistoryItem.id] || []).length}</b>
              </span>
              <button
                type="button"
                onClick={() => setMovementHistoryItem(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
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
                <b className="font-mono text-emerald-700">${totalFilteredSales.toLocaleString('en-US')}</b>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>المحصل (المُخرج) مقابل المتبقي:</span>
                <b className="font-mono text-cyan-800">${dispatchedSales.toLocaleString('en-US')} / ${remainingInYardSales.toLocaleString('en-US')}</b>
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
