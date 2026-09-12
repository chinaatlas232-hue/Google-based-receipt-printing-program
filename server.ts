import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import XLSX from 'xlsx';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

const SHIPMENT_FILE_ID = '1IESujqsd6-4RbEfr9cnx8xeYNq-WvTUj';
const CUSTOMER_INFO_FILE_ID = '1gCjzU7Gx5alpv7KZY1mxjIVDJO-yvzww';
const UPLOAD_DIR = path.join(process.cwd(), 'saved_files');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const shipmentPath = path.join(UPLOAD_DIR, 'shipments_data.xlsx');
const customerInfoPath = path.join(UPLOAD_DIR, 'customer_info.xlsx');

const CITY_ARABIC_MAP: Record<string, string> = {
  'Baghdad': 'بغداد',
  'Basra': 'البصرة',
  'Erbil': 'أربيل',
  'Najaf': 'النجف',
  'Sulaymaniyah': 'السليمانية',
  'Kirkuk / Tamim': 'كركوك',
  'Karbala': 'كربلاء',
  'Duhok': 'دهوك',
  'Babylon': 'بابل',
  'Nineveh / Mosul': 'نينوى / الموصل',
  'Diyala': 'ديالى',
  'Wasit': 'واسط',
  'Maysan': 'ميسان',
  'Dhi Qar': 'ذي قار',
  'Muthanna': 'المثنى',
  'Qadisiyyah': 'القادسية / الديوانية',
  'Salah al-Din': 'صلاح الدين',
  'Anbar': 'الأنبار',
};

function normalizeCity(rawCity: string): string {
  if (!rawCity) return 'بغداد';
  const trimmed = rawCity.trim();
  return CITY_ARABIC_MAP[trimmed] || trimmed;
}

function normalizePhone(rawPhone: unknown): string {
  if (!rawPhone) return '+964 7800000000';
  let p = String(rawPhone).trim();
  if (p === '#ERROR!' || p === 'NaN' || p === 'undefined' || p === 'null') {
    return '+964 7800000000';
  }
  if (!p.startsWith('+')) {
    if (p.startsWith('964')) {
      p = `+964 ${p.slice(3)}`;
    } else if (p.startsWith('07')) {
      p = `+964 ${p.slice(1)}`;
    } else {
      p = `+964 ${p}`;
    }
  }
  return p;
}

// Download helper from Google Drive & Google Spreadsheets
async function downloadDriveFile(fileId: string, destPath: string): Promise<boolean> {
  const urls = [
    `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`,
    `https://docs.google.com/uc?export=download&id=${fileId}&confirm=t`
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength > 1000) {
          fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
          console.log(`Successfully downloaded file ${fileId} (${arrayBuffer.byteLength} bytes) from ${url}`);
          return true;
        }
      }
      console.warn(`Attempt from ${url} returned status: ${res.status}`);
    } catch (err) {
      console.warn(`Error fetching file ${fileId} from ${url}:`, err);
    }
  }
  return false;
}

// Memory cache & Sync State
let cachedShipments: any[] = [];
let lastSyncTime: string | null = null;
let isCurrentlySyncing = false;

function parseNumeric(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).replace(/[\$,\s]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function getRowField(row: any, ...keys: string[]): any {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') {
      return row[k];
    }
  }
  // Try trimming row keys to match
  for (const rowKey of Object.keys(row)) {
    const trimmed = rowKey.trim();
    for (const k of keys) {
      if (trimmed === k.trim() && row[rowKey] !== undefined && row[rowKey] !== null && row[rowKey] !== '') {
        return row[rowKey];
      }
    }
  }
  return undefined;
}

function loadAndMergeFromDisk(): any[] {
  if (!fs.existsSync(shipmentPath)) {
    return [];
  }

  try {
    const wbShip = XLSX.readFile(shipmentPath);
    const rawShipments: any[] = XLSX.utils.sheet_to_json(wbShip.Sheets[wbShip.SheetNames[0]]);

    let custMap = new Map<string, any>();
    if (fs.existsSync(customerInfoPath)) {
      const wbCust = XLSX.readFile(customerInfoPath);
      const rawCust: any[] = XLSX.utils.sheet_to_json(wbCust.Sheets[wbCust.SheetNames[0]]);
      rawCust.forEach((c) => {
        const code = String(getRowField(c, 'الكود', 'كود العميل', 'Code') || '').trim().toUpperCase();
        if (code) custMap.set(code, c);
      });
    }

    const merged = rawShipments.map((s, idx) => {
      const code = String(getRowField(s, 'الكود', 'كود العميل', 'Code') || '').trim().toUpperCase();
      const c = custMap.get(code) || {};

      const weight = parseNumeric(getRowField(s, 'الوزن', 'وزن', 'Weight'));
      const packages = Math.max(1, parseNumeric(getRowField(s, 'عدد الطرود', 'الطرود', 'عدد الكراتين', 'Packages')) || 1);
      const cbm = parseNumeric(getRowField(s, 'cbm', 'CBM', 'الحجم'));
      const price = parseNumeric(getRowField(s, 'سعر الكيلو', 'السعر', 'سعر', 'Price'));
      
      const explicitSales = getRowField(s, ' اجمالي مبيعات ', 'اجمالي مبيعات', 'المبيعات', 'إجمالي مبيعات', 'Sales');
      const sales = explicitSales !== undefined ? parseNumeric(explicitSales) : (weight * price);

      const guarantor = String(getRowField(s, 'الكفيل', 'كفيل', 'Guarantor') || '').trim();
      const shipment = String(getRowField(s, 'الشحنة', 'رقم الشحنة', 'Shipment') || 'عام').trim();
      const type = String(getRowField(s, 'نوع الشحنة', 'نوع', 'Type') || 'جوي').trim();

      const customerName = c['الاسم'] ? String(c['الاسم']).trim() : `عميل ${code}`;
      const phoneRaw = getRowField(c, 'رقم العاتف', 'الهاتف', 'phone', 'رقم الهاتف');
      const address = c['استلام البظاعة'] ? String(c['استلام البظاعة']).trim() : '';
      const city = normalizeCity(getRowField(c, 'المحافظات', 'المحافظة', 'city') || 'بغداد');

      return {
        id: `rec_${idx + 1}`,
        shipment,
        code,
        name: customerName,
        guarantor,
        weight,
        cbm,
        packages,
        price,
        sales,
        phone: normalizePhone(phoneRaw),
        phone2: '',
        address,
        city,
        type,
        status: 'جاهز للتسليم',
        notes: '',
      };
    });

    cachedShipments = merged;
    return merged;
  } catch (err) {
    console.error('Error in loadAndMergeFromDisk:', err);
    return cachedShipments;
  }
}

async function syncDriveData(forceDownload = true): Promise<{ count: number; shipments: any[] }> {
  if (isCurrentlySyncing) {
    return { count: cachedShipments.length, shipments: cachedShipments };
  }

  isCurrentlySyncing = true;
  try {
    if (forceDownload || !fs.existsSync(shipmentPath)) {
      console.log('Fetching fresh live data from Google Sheets...');
      await Promise.all([
        downloadDriveFile(SHIPMENT_FILE_ID, shipmentPath),
        downloadDriveFile(CUSTOMER_INFO_FILE_ID, customerInfoPath),
      ]);
    }
    const merged = loadAndMergeFromDisk();
    lastSyncTime = new Date().toISOString();
    console.log(`Google Sheets synced successfully: ${merged.length} records. Last sync: ${lastSyncTime}`);
    return { count: merged.length, shipments: merged };
  } catch (err) {
    console.error('Failed to sync Google Sheets:', err);
    return { count: cachedShipments.length, shipments: cachedShipments };
  } finally {
    isCurrentlySyncing = false;
  }
}

// 1. API: Get Current Shipments Data
app.get('/api/data', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    if (force || cachedShipments.length === 0) {
      await syncDriveData(force);
    }
    res.json({
      success: true,
      count: cachedShipments.length,
      lastSync: lastSyncTime,
      isSyncing: isCurrentlySyncing,
      shipments: cachedShipments,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. API: Trigger Drive Sync (Immediate live sync)
const handleSync = async (req: express.Request, res: express.Response) => {
  try {
    console.log('User requested manual Google Sheets live synchronization...');
    const result = await syncDriveData(true);
    res.json({
      success: true,
      message: `تم تحديث وسحب أحدث بيانات الشحنات من Google Sheets بنجاح! (${result.count.toLocaleString('ar-IQ')} سجل)`,
      count: result.count,
      lastSync: lastSyncTime,
      shipments: result.shipments,
    });
  } catch (err: any) {
    console.error('Drive sync error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

app.post('/api/sync-drive', handleSync);
app.post('/api/sync', handleSync);
app.get('/api/sync', handleSync);

// 3. API: Status check
app.get('/api/sync-status', (req, res) => {
  res.json({
    success: true,
    count: cachedShipments.length,
    lastSync: lastSyncTime,
    isSyncing: isCurrentlySyncing,
  });
});

// 3. API: Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ============================================================================
// Real-time Yard Inventory Multi-User & Multi-Device Collaboration Engine
// ============================================================================
const yardStatePath = path.join(UPLOAD_DIR, 'yard_inventory_state.json');

export interface YardEvent {
  id: string;
  deviceId: string;
  userName: string;
  action: string;
  itemCode: string;
  customerName?: string;
  shipment?: string;
  itemId?: string;
  time: string;
  timestamp: number;
  changes?: {
    actualCount?: number | '';
    checked?: boolean;
    note?: string;
    dispatched?: { dispatched: boolean; time: string; user?: string };
    [key: string]: any;
  };
}

export interface YardState {
  lastSavedAt: string;
  lastModifiedBy?: string;
  checkedItems: Record<string, boolean>;
  actualCounts: Record<string, number | ''>;
  itemNotes: Record<string, string>;
  dispatchedItems: Record<string, { dispatched: boolean; time: string; fullDateTime?: string; user?: string }>;
  entryDates?: Record<string, string>;
  itemLastModified: Record<string, { userName: string; time: string; action: string; timestamp: number }>;
  history: YardEvent[];
}

let cachedYardState: YardState = {
  lastSavedAt: '',
  lastModifiedBy: '',
  checkedItems: {},
  actualCounts: {},
  itemNotes: {},
  dispatchedItems: {},
  entryDates: {},
  itemLastModified: {},
  history: []
};

// Pre-load yard state if file exists on disk
if (fs.existsSync(yardStatePath)) {
  try {
    const raw = fs.readFileSync(yardStatePath, 'utf8');
    const parsed = JSON.parse(raw);
    cachedYardState = {
      lastSavedAt: parsed.lastSavedAt || '',
      lastModifiedBy: parsed.lastModifiedBy || '',
      checkedItems: parsed.checkedItems || {},
      actualCounts: parsed.actualCounts || {},
      itemNotes: parsed.itemNotes || {},
      dispatchedItems: parsed.dispatchedItems || {},
      entryDates: parsed.entryDates || {},
      itemLastModified: parsed.itemLastModified || {},
      history: Array.isArray(parsed.history) ? parsed.history : []
    };
    console.log(`[Yard Inventory] Loaded existing state from disk. History events: ${cachedYardState.history.length}`);
  } catch (err) {
    console.error('Failed to parse yard_inventory_state.json:', err);
  }
}

function persistYardState() {
  try {
    fs.writeFileSync(yardStatePath, JSON.stringify(cachedYardState, null, 2), 'utf8');
  } catch (err) {
    console.error('Error persisting yard inventory state to disk:', err);
  }
}

// Active Server-Sent Events (SSE) connections for cross-device real-time sync
let sseClients: { id: string; res: express.Response }[] = [];

function broadcastToSSE(event: YardEvent) {
  const payload = `data: ${JSON.stringify({ type: 'YARD_UPDATE', event, state: cachedYardState })}\n\n`;
  sseClients.forEach(client => {
    try {
      client.res.write(payload);
    } catch {
      // client connection might be broken
    }
  });
}

// 1. GET full yard inventory state
app.get('/api/yard-inventory', (req, res) => {
  res.json({
    success: true,
    serverTime: Date.now(),
    state: cachedYardState
  });
});

// 2. Server-Sent Events (SSE) endpoint for real-time instant push notifications
app.get('/api/yard-inventory/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const clientId = Math.random().toString(36).substring(2) + Date.now();
  sseClients.push({ id: clientId, res });

  // Initial connection heartbeat
  res.write(`data: ${JSON.stringify({ type: 'INIT', clientId, serverTime: Date.now(), totalEvents: cachedYardState.history.length })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// 3. Fallback fast polling endpoint for environments where SSE might reconnect
app.get('/api/yard-inventory/poll', (req, res) => {
  const since = Number(req.query.since) || 0;
  const newEvents = cachedYardState.history.filter(e => e.timestamp > since);
  res.json({
    success: true,
    serverTime: Date.now(),
    newEvents,
    state: cachedYardState
  });
});

// 4. POST update single item or batch change
app.post('/api/yard-inventory/update', (req, res) => {
  try {
    const { deviceId, userName, itemId, itemCode, customerName, shipment, action, changes } = req.body;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fullDateStr = `${now.toISOString().slice(0, 10)} ${timeStr}`;

    const newEvent: YardEvent = {
      id: Math.random().toString(36).substring(2) + Date.now(),
      deviceId: deviceId || 'unknown',
      userName: userName || 'مشرف الساحة',
      action: action || 'تحديث بيانات الجرد',
      itemCode: itemCode || 'غير محدد',
      customerName: customerName || '',
      shipment: shipment || '',
      itemId: itemId || '',
      time: timeStr,
      timestamp: Date.now(),
      changes: changes || {}
    };

    if (itemId) {
      if (changes?.actualCount !== undefined) {
        cachedYardState.actualCounts[itemId] = changes.actualCount;
      }
      if (changes?.checked !== undefined) {
        cachedYardState.checkedItems[itemId] = changes.checked;
      }
      if (changes?.note !== undefined) {
        cachedYardState.itemNotes[itemId] = changes.note;
      }
      if (changes?.dispatched !== undefined) {
        cachedYardState.dispatchedItems[itemId] = changes.dispatched;
      }
      if (changes?.entryDate !== undefined) {
        if (!cachedYardState.entryDates) cachedYardState.entryDates = {};
        cachedYardState.entryDates[itemId] = changes.entryDate;
      }

      cachedYardState.itemLastModified[itemId] = {
        userName: newEvent.userName,
        time: timeStr,
        action: newEvent.action,
        timestamp: Date.now()
      };
    }

    cachedYardState.lastSavedAt = fullDateStr;
    cachedYardState.lastModifiedBy = newEvent.userName;
    cachedYardState.history = [newEvent, ...cachedYardState.history.slice(0, 199)];

    persistYardState();
    broadcastToSSE(newEvent);

    res.json({
      success: true,
      event: newEvent,
      state: cachedYardState
    });
  } catch (err: any) {
    console.error('Error handling /api/yard-inventory/update:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. POST full save or bulk sync
app.post('/api/yard-inventory/save-all', (req, res) => {
  try {
    const { deviceId, userName, checkedItems, actualCounts, itemNotes, dispatchedItems, entryDates, action, draft } = req.body;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fullDateStr = `${now.toISOString().slice(0, 10)} ${timeStr}`;

    const finalChecked = checkedItems || draft?.checkedItems;
    const finalCounts = actualCounts || draft?.actualCounts;
    const finalNotes = itemNotes || draft?.itemNotes;
    const finalDispatched = dispatchedItems || draft?.dispatchedItems;
    const finalEntryDates = entryDates || draft?.entryDates;

    if (finalChecked) cachedYardState.checkedItems = finalChecked;
    if (finalCounts) cachedYardState.actualCounts = finalCounts;
    if (finalNotes) cachedYardState.itemNotes = finalNotes;
    if (finalDispatched) cachedYardState.dispatchedItems = finalDispatched;
    if (finalEntryDates) cachedYardState.entryDates = finalEntryDates;

    cachedYardState.lastSavedAt = fullDateStr;
    cachedYardState.lastModifiedBy = userName || 'مشرف الساحة';

    const newEvent: YardEvent = {
      id: Math.random().toString(36).substring(2) + Date.now(),
      deviceId: deviceId || 'unknown',
      userName: userName || 'مشرف الساحة',
      action: action || 'حفظ ومزامنة كامل بيانات الجرد الفعلي للمستودع',
      itemCode: 'الكل',
      time: timeStr,
      timestamp: Date.now(),
      changes: {
        allSaved: true,
        checkedItems: finalChecked,
        actualCounts: finalCounts,
        itemNotes: finalNotes,
        dispatchedItems: finalDispatched,
        entryDates: finalEntryDates
      }
    };

    cachedYardState.history = [newEvent, ...cachedYardState.history.slice(0, 199)];

    persistYardState();
    broadcastToSSE(newEvent);

    res.json({
      success: true,
      event: newEvent,
      state: cachedYardState
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5.5 POST batch entry date for shipment
app.post('/api/yard-inventory/batch-entry-date', (req, res) => {
  try {
    const { deviceId, userName, shipment, entryDate, itemIds, action } = req.body;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fullDateStr = `${now.toISOString().slice(0, 10)} ${timeStr}`;

    if (!cachedYardState.entryDates) {
      cachedYardState.entryDates = {};
    }

    if (Array.isArray(itemIds) && entryDate) {
      itemIds.forEach((id: string) => {
        if (cachedYardState.entryDates) {
          cachedYardState.entryDates[id] = entryDate;
        }
      });
    }

    cachedYardState.lastSavedAt = fullDateStr;
    cachedYardState.lastModifiedBy = userName || 'مشرف الساحة';

    const newEvent: YardEvent = {
      id: Math.random().toString(36).substring(2) + Date.now(),
      deviceId: deviceId || 'unknown',
      userName: userName || 'مشرف الساحة',
      action: action || `تثبيت تاريخ دخول موحد (${entryDate}) للشحنة [${shipment || 'عام'}]`,
      itemCode: shipment || 'عام',
      shipment: shipment || '',
      time: timeStr,
      timestamp: Date.now(),
      changes: {
        allSaved: true,
        entryDates: cachedYardState.entryDates
      }
    };

    cachedYardState.history = [newEvent, ...cachedYardState.history.slice(0, 199)];

    persistYardState();
    broadcastToSSE(newEvent);

    res.json({
      success: true,
      event: newEvent,
      state: cachedYardState
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. POST reset inventory with notification
app.post('/api/yard-inventory/reset', (req, res) => {
  try {
    const { deviceId, userName } = req.body;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    cachedYardState.checkedItems = {};
    cachedYardState.actualCounts = {};
    cachedYardState.itemNotes = {};
    cachedYardState.dispatchedItems = {};
    cachedYardState.itemLastModified = {};
    cachedYardState.lastSavedAt = '';
    cachedYardState.lastModifiedBy = userName || 'مشرف الساحة';

    const newEvent: YardEvent = {
      id: Math.random().toString(36).substring(2) + Date.now(),
      deviceId: deviceId || 'unknown',
      userName: userName || 'مشرف الساحة',
      action: 'إعادة ضبط وتصفير بيانات الجرد والتدقيق بالكامل',
      itemCode: 'تصفير شامل',
      time: timeStr,
      timestamp: Date.now()
    };

    cachedYardState.history = [newEvent, ...cachedYardState.history.slice(0, 199)];

    persistYardState();
    broadcastToSSE(newEvent);

    res.json({ success: true, event: newEvent, state: cachedYardState });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server with Vite
async function startServer() {
  // Pre-load data from disk on startup for immediate responses
  loadAndMergeFromDisk();
  console.log(`Loaded ${cachedShipments.length} records into cache from disk.`);

  // Immediately trigger fresh live sync from Google Sheets in the background
  syncDriveData(true).catch(err => {
    console.warn('Initial Google Sheets background sync error:', err);
  });

  // Automatically refresh and sync with Google Sheets every 45 seconds
  setInterval(() => {
    syncDriveData(true).catch(err => {
      console.warn('Periodic Google Sheets background sync error:', err);
    });
  }, 45 * 1000);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Atlas Cargo Management System running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
