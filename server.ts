import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import XLSX from 'xlsx';
import { computeDelta, hasChanges } from './syncDelta';

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

/**
 * Cache validators for each remote file. They let us ask Google "has this
 * changed since last time?" instead of blindly re-downloading the whole file.
 */
interface RemoteFileState {
  etag: string | null;
  lastModified: string | null;
  contentHash: string | null;
  bytes: number;
  /** When we last fully verified this file (a real download + hash check). */
  lastVerifiedAt: number;
}

const remoteFileState: Record<string, RemoteFileState> = {};

function getRemoteState(fileId: string): RemoteFileState {
  if (!remoteFileState[fileId]) {
    remoteFileState[fileId] = {
      etag: null,
      lastModified: null,
      contentHash: null,
      bytes: 0,
      lastVerifiedAt: 0,
    };
  }
  return remoteFileState[fileId];
}

function hashBuffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Even when the metadata probe says "unchanged", we still perform a real
 * download at least this often. This bounds any risk of the remote metadata
 * being stale and guarantees we can never drift from the spreadsheet.
 */
const PROBE_MAX_AGE_MS = 10 * 60 * 1000;

type DownloadOutcome = 'downloaded' | 'not-modified' | 'failed';

interface RemoteMetadata {
  lastModified: string | null;
  contentLength: number | null;
}

/**
 * Cheap HEAD probe returning only the file's validators (no body). Google's
 * spreadsheet export does not answer 304 to conditional GETs, so a metadata
 * comparison is the only way to avoid transferring ~1 MB on every check.
 */
async function probeRemoteMetadata(fileId: string): Promise<RemoteMetadata | null> {
  const url = `https://docs.google.com/uc?export=download&id=${fileId}&confirm=t`;
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (!res.ok) return null;
    const len = Number(res.headers.get('content-length'));
    return {
      lastModified: res.headers.get('last-modified'),
      contentLength: Number.isFinite(len) && len > 0 ? len : null,
    };
  } catch (err) {
    console.warn(`Metadata probe failed for ${fileId}:`, err);
    return null;
  }
}

/**
 * Smart download, in order of increasing cost:
 *   1. Metadata probe (HEAD) - skip entirely when the remote file is unchanged.
 *   2. Conditional GET (If-None-Match / If-Modified-Since) - honours 304.
 *   3. Body hash comparison - catches servers that send no validators.
 *
 * @param allowProbe Set to false to force an authoritative download (manual sync).
 */
async function downloadDriveFile(
  fileId: string,
  destPath: string,
  allowProbe = true
): Promise<DownloadOutcome> {
  const state = getRemoteState(fileId);

  // 1. Metadata fast-path
  if (allowProbe && state.lastModified && fs.existsSync(destPath) && state.lastVerifiedAt > 0) {
    const probeAge = Date.now() - state.lastVerifiedAt;
    if (probeAge < PROBE_MAX_AGE_MS) {
      const meta = await probeRemoteMetadata(fileId);
      const unchanged =
        meta &&
        meta.lastModified === state.lastModified &&
        (meta.contentLength === null || meta.contentLength === state.bytes);

      if (unchanged) {
        console.log(`File ${fileId} unchanged per metadata probe, skipping download (~${state.bytes} bytes saved).`);
        return 'not-modified';
      }
    } else {
      console.log(`File ${fileId} metadata probe skipped (last full verification ${Math.round(probeAge / 60000)} min ago).`);
    }
  }

  const urls = [
    `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`,
    `https://docs.google.com/uc?export=download&id=${fileId}&confirm=t`
  ];

  let sawNotModified = false;

  for (const url of urls) {
    // 2. Conditional GET
    const headers: Record<string, string> = {};
    if (state.etag) headers['If-None-Match'] = state.etag;
    if (state.lastModified) headers['If-Modified-Since'] = state.lastModified;

    try {
      const res = await fetch(url, { redirect: 'follow', headers });

      if (res.status === 304) {
        console.log(`File ${fileId} is unchanged (304 Not Modified), skipping download.`);
        state.lastVerifiedAt = Date.now();
        return 'not-modified';
      }

      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength <= 1000) {
          console.warn(`Attempt from ${url} returned a suspiciously small body (${arrayBuffer.byteLength} bytes)`);
          continue;
        }

        const buf = Buffer.from(arrayBuffer);
        const newHash = hashBuffer(buf);

        // Keep the newest validators for the probe / conditional GET.
        const headerLastModified = res.headers.get('last-modified');
        if (headerLastModified) state.lastModified = headerLastModified;
        state.etag = res.headers.get('etag') || state.etag;

        // 3. Body hash comparison
        if (state.contentHash && state.contentHash === newHash && fs.existsSync(destPath)) {
          state.bytes = buf.byteLength;
          state.lastVerifiedAt = Date.now();
          console.log(`File ${fileId} body identical to cached copy (hash ${newHash.slice(0, 12)}), keeping existing file.`);
          return 'not-modified';
        }

        fs.writeFileSync(destPath, buf);
        state.contentHash = newHash;
        state.bytes = buf.byteLength;
        state.lastVerifiedAt = Date.now();

        // The `export?format=xlsx` endpoint sends no validators, so grab the
        // file's last-modified time from a HEAD request once. Without it the
        // metadata probe can never short-circuit future downloads.
        if (!state.lastModified) {
          const meta = await probeRemoteMetadata(fileId);
          if (meta?.lastModified) state.lastModified = meta.lastModified;
          if (meta?.contentLength && meta.contentLength === buf.byteLength) {
            state.bytes = meta.contentLength;
          }
        }

        console.log(
          `Successfully downloaded file ${fileId} (${buf.byteLength} bytes, hash ${newHash.slice(0, 12)}) from ${url}`
        );
        return 'downloaded';
      }

      if (res.status === 304) sawNotModified = true;
      console.warn(`Attempt from ${url} returned status: ${res.status}`);
    } catch (err) {
      console.warn(`Error fetching file ${fileId} from ${url}:`, err);
    }
  }

  return sawNotModified ? 'not-modified' : 'failed';
}

// Memory cache & Sync State
let cachedShipments: any[] = [];
let lastSyncTime: string | null = null;
let isCurrentlySyncing = false;

// Smart-sync bookkeeping
export type SyncOutcome = 'changed' | 'unchanged' | 'throttled' | 'error' | 'idle';

let lastSyncAttemptTime = 0;        // epoch ms of the last completed sync attempt
let lastDataChangeTime: string | null = null; // ISO time the data actually changed
let lastSyncOutcome: SyncOutcome = 'idle';
let lastDelta: { added: number; modified: number; removed: number } = { added: 0, modified: 0, removed: 0 };
let lastSyncError: string | null = null;

/**
 * Minimum gap between two network syncs triggered by background/automatic
 * callers. Rapid successive triggers (tab focus, polling, overlapping timers)
 * collapse into a single download. A manual user sync bypasses this.
 */
const SYNC_MIN_INTERVAL_MS = 15_000;
const SYNC_INTERVAL_MS = 45_000;    // background refresh cadence

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

export interface SyncResult {
  count: number;
  shipments: any[];
  changed: boolean;
  throttled: boolean;
  skippedDownload: boolean;
  delta: { added: number; modified: number; removed: number };
  lastSync: string | null;
  lastChange: string | null;
  outcome: SyncOutcome;
}

/**
 * Smart sync.
 *
 * @param bypassThrottle Check right now even if a sync just happened.
 * @param authoritative  Always download the files instead of trusting the
 *                       metadata probe (used by the user's sync button and at
 *                       startup, where a guaranteed-fresh read is expected).
 */
async function syncDriveData(bypassThrottle = false, authoritative = false): Promise<SyncResult> {
  const result = (changed: boolean, throttled = false, skippedDownload = false): SyncResult => ({
    count: cachedShipments.length,
    shipments: cachedShipments,
    changed,
    throttled,
    skippedDownload,
    delta: lastDelta,
    lastSync: lastSyncTime,
    lastChange: lastDataChangeTime,
    outcome: lastSyncOutcome,
  });

  // A sync is already in flight - it will publish its own result.
  if (isCurrentlySyncing) {
    return result(false);
  }

  // Debounce: collapse rapid automatic triggers into one network round-trip.
  const sinceLastAttempt = Date.now() - lastSyncAttemptTime;
  if (!bypassThrottle && lastSyncAttemptTime > 0 && sinceLastAttempt < SYNC_MIN_INTERVAL_MS) {
    console.log(
      `Smart sync throttled (${Math.round(sinceLastAttempt / 1000)}s since last attempt, minimum ${SYNC_MIN_INTERVAL_MS / 1000}s).`
    );
    lastSyncOutcome = 'throttled';
    return result(false, true);
  }

  isCurrentlySyncing = true;
  lastSyncAttemptTime = Date.now();

  try {
    const mustDownload = !fs.existsSync(shipmentPath) || !fs.existsSync(customerInfoPath);

    // An authoritative sync always performs a real download; automatic syncs
    // may skip it entirely via the cheap metadata probe.
    const allowProbe = !authoritative;

    let skippedDownload = false;
    if (mustDownload) {
      console.log('Cache missing on disk, fetching fresh data from Google Sheets...');
      await Promise.all([
        downloadDriveFile(SHIPMENT_FILE_ID, shipmentPath, false),
        downloadDriveFile(CUSTOMER_INFO_FILE_ID, customerInfoPath, false),
      ]);
    } else {
      const outcomes = await Promise.all([
        downloadDriveFile(SHIPMENT_FILE_ID, shipmentPath, allowProbe),
        downloadDriveFile(CUSTOMER_INFO_FILE_ID, customerInfoPath, allowProbe),
      ]);
      skippedDownload = outcomes.every(o => o === 'not-modified');
      if (skippedDownload) {
        console.log('No remote changes detected, skipping re-parse of the spreadsheets.');
      }
    }

    const previousSnapshot = cachedShipments;

    if (skippedDownload && previousSnapshot.length > 0) {
      // Nothing changed remotely and we already hold the data - avoid all the
      // parsing work and every downstream re-render.
      lastSyncTime = new Date().toISOString();
      lastDelta = { added: 0, modified: 0, removed: 0 };
      lastSyncOutcome = 'unchanged';
      lastSyncError = null;
      return result(false, false, true);
    }

    const merged = loadAndMergeFromDisk();
    const delta = computeDelta(previousSnapshot, merged);
    const changed = hasChanges(delta);

    lastDelta = delta;
    lastSyncOutcome = changed ? 'changed' : 'unchanged';
    lastSyncError = null;
    lastSyncTime = new Date().toISOString();
    if (changed) lastDataChangeTime = lastSyncTime;

    if (changed) {
      cachedShipments = merged;
      console.log(
        `Google Sheets sync: ${merged.length} records (added ${delta.added}, modified ${delta.modified}, removed ${delta.removed}) at ${lastSyncTime}`
      );
      return result(true);
    }

    console.log(`Google Sheets sync: no data changes (${merged.length} records verified) at ${lastSyncTime}`);
    return result(false);
  } catch (err: any) {
    console.error('Failed to sync Google Sheets:', err);
    lastSyncOutcome = 'error';
    lastSyncError = err?.message || String(err);
    return result(false);
  } finally {
    isCurrentlySyncing = false;
  }
}

// 1. API: Get Current Shipments Data
app.get('/api/data', async (req, res) => {
  try {
    // `force=true` (initial load / explicit request) bypasses the debounce.
    // Otherwise this is a throttled check: rapid calls collapse into one and
    // an unchanged remote file costs nothing but a HEAD request.
    const force = req.query.force === 'true';
    const sync = await syncDriveData(force, false);
    res.json({
      success: true,
      count: cachedShipments.length,
      lastSync: lastSyncTime,
      lastChange: lastDataChangeTime,
      isSyncing: isCurrentlySyncing,
      changed: sync ? sync.changed : false,
      throttled: sync ? sync.throttled : false,
      delta: lastDelta,
      outcome: lastSyncOutcome,
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
    const result = await syncDriveData(true, true); // manual => bypass throttle, always fetch
    const { added, modified, removed } = result.delta;
    const deltaText =
      added || modified || removed
        ? ` — جديد: ${added}، معدّل: ${modified}، محذوف: ${removed}`
        : ' — لا توجد تغييرات جديدة';
    res.json({
      success: true,
      message: `تمت المزامنة الذكية مع Google Sheets بنجاح! (${result.count.toLocaleString('en-US')} سجل)${deltaText}`,
      count: result.count,
      lastSync: result.lastSync,
      lastChange: result.lastChange,
      changed: result.changed,
      delta: result.delta,
      outcome: result.outcome,
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

// 3. API: Status check (lightweight, never triggers a download)
app.get('/api/sync-status', (_req, res) => {
  const sinceLastAttempt = lastSyncAttemptTime > 0 ? Date.now() - lastSyncAttemptTime : null;
  const nextSyncIn = sinceLastAttempt === null
    ? 0
    : Math.max(0, Math.ceil((SYNC_MIN_INTERVAL_MS - sinceLastAttempt) / 1000));

  res.json({
    success: true,
    count: cachedShipments.length,
    lastSync: lastSyncTime,
    lastChange: lastDataChangeTime,
    isSyncing: isCurrentlySyncing,
    outcome: lastSyncOutcome,
    delta: lastDelta,
    error: lastSyncError,
    nextSyncIn,
    syncIntervalSeconds: Math.round(SYNC_INTERVAL_MS / 1000),
  });
});

// 3. API: Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ============================================================================
// Debt Collections & Payments Persistence Engine
// ============================================================================
const collectionsPath = path.join(UPLOAD_DIR, 'collections_data.json');
let cachedCollections: Record<string, any> = {};

if (fs.existsSync(collectionsPath)) {
  try {
    const raw = fs.readFileSync(collectionsPath, 'utf8');
    cachedCollections = JSON.parse(raw);
    console.log('[Debt Collection] Loaded cached collections from disk.');
  } catch (err) {
    console.error('Failed to parse collections_data.json:', err);
  }
}

app.get('/api/collections', (req, res) => {
  res.json({
    success: true,
    collections: cachedCollections,
  });
});

app.post('/api/collections', (req, res) => {
  try {
    const { collections } = req.body;
    if (collections && typeof collections === 'object') {
      cachedCollections = { ...cachedCollections, ...collections };
      fs.writeFileSync(collectionsPath, JSON.stringify(cachedCollections, null, 2), 'utf8');
      return res.json({ success: true, count: Object.keys(cachedCollections).length });
    }
    res.status(400).json({ success: false, error: 'Invalid collections payload' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const containerExpensesPath = path.join(UPLOAD_DIR, 'container_expenses.json');
let cachedContainerExpenses: Record<string, any> = {};

if (fs.existsSync(containerExpensesPath)) {
  try {
    const raw = fs.readFileSync(containerExpensesPath, 'utf8');
    cachedContainerExpenses = JSON.parse(raw);
    console.log('[Container Expenses] Loaded cached expenses from disk.');
  } catch (err) {
    console.error('Failed to parse container_expenses.json:', err);
  }
}

app.get('/api/container-expenses', (_req, res) => {
  res.json({
    success: true,
    expenses: cachedContainerExpenses,
  });
});

app.post('/api/container-expenses', (req, res) => {
  try {
    const { expenses } = req.body;
    if (expenses && typeof expenses === 'object') {
      cachedContainerExpenses = expenses;
      fs.writeFileSync(containerExpensesPath, JSON.stringify(cachedContainerExpenses, null, 2), 'utf8');
      return res.json({ success: true, savedAt: cachedContainerExpenses.savedAt ?? new Date().toISOString() });
    }
    res.status(400).json({ success: false, error: 'Invalid expenses payload' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
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

  // Immediately trigger a real live sync from Google Sheets in the background
  syncDriveData(true, true).catch(err => {
    console.warn('Initial Google Sheets background sync error:', err);
  });

  // Background refresh. The smart-sync layer only downloads when the remote
  // spreadsheets actually changed, so this is cheap even at a short cadence.
  setInterval(() => {
    syncDriveData(false).catch(err => {
      console.warn('Periodic Google Sheets background sync error:', err);
    });
  }, SYNC_INTERVAL_MS);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      plugins: [
        {
          name: 'strip-vite-hmr-client',
          transformIndexHtml: {
            order: 'post',
            handler(html) {
              return html.replace(/<script type="module" src="\/@vite\/client"><\/script>/g, '');
            },
          },
        },
      ],
      server: { middlewareMode: true, hmr: false },
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
