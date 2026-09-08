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

// Download helper from Google Drive
async function downloadDriveFile(fileId: string, destPath: string): Promise<boolean> {
  const url = `https://docs.google.com/uc?export=download&id=${fileId}`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
      console.error(`Failed to download ${fileId}: HTTP ${res.status}`);
      return false;
    }
    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
    return true;
  } catch (err) {
    console.error(`Error downloading file ${fileId}:`, err);
    return false;
  }
}

// Memory cache
let cachedShipments: any[] = [];
let lastSyncTime: string | null = null;

function loadAndMergeFromDisk(): any[] {
  if (!fs.existsSync(shipmentPath)) {
    return [];
  }

  const wbShip = XLSX.readFile(shipmentPath);
  const rawShipments: any[] = XLSX.utils.sheet_to_json(wbShip.Sheets[wbShip.SheetNames[0]]);

  let custMap = new Map<string, any>();
  if (fs.existsSync(customerInfoPath)) {
    const wbCust = XLSX.readFile(customerInfoPath);
    const rawCust: any[] = XLSX.utils.sheet_to_json(wbCust.Sheets[wbCust.SheetNames[0]]);
    rawCust.forEach((c) => {
      const code = String(c['الكود'] || '').trim().toUpperCase();
      if (code) custMap.set(code, c);
    });
  }

  const merged = rawShipments.map((s, idx) => {
    const code = String(s['الكود'] || '').trim().toUpperCase();
    const c = custMap.get(code) || {};

    const weight = Number(s['الوزن']) || 0;
    const packages = Math.max(1, Number(s['عدد الطرود']) || 1);
    const cbm = Number(s['cbm']) || 0;
    const price = Number(s['سعر الكيلو']) || 0;
    const sales = Number(s[' اجمالي مبيعات '] ?? s['اجمالي مبيعات'] ?? s['المبيعات'] ?? (weight * price)) || 0;

    return {
      id: `rec_${idx + 1}`,
      shipment: String(s['الشحنة'] || 'عام').trim(),
      code: code,
      name: c['الاسم'] ? String(c['الاسم']).trim() : `عميل ${code}`,
      guarantor: s['الكفيل'] ? String(s['الكفيل']).trim() : '',
      weight,
      cbm,
      packages,
      price,
      sales,
      phone: normalizePhone(c['رقم العاتف'] || c['الهاتف'] || c['phone']),
      phone2: '',
      address: c['استلام البظاعة'] ? String(c['استلام البظاعة']).trim() : '',
      city: normalizeCity(c['المحافظات'] || c['المحافظة'] || 'بغداد'),
      type: s['نوع الشحنة'] ? String(s['نوع الشحنة']).trim() : 'جوي',
      status: 'جاهز للتسليم',
      notes: '',
    };
  });

  cachedShipments = merged;
  return merged;
}

// 1. API: Get Current Shipments Data
app.get('/api/data', async (req, res) => {
  try {
    if (cachedShipments.length === 0) {
      loadAndMergeFromDisk();
    }
    res.json({
      success: true,
      count: cachedShipments.length,
      lastSync: lastSyncTime,
      shipments: cachedShipments,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. API: Trigger Drive Sync (Identical to Streamlit: 🔄 تحديث البيانات وسحبها من درايف)
app.post('/api/sync-drive', async (req, res) => {
  try {
    console.log('Syncing data directly from Google Drive...');
    const okShip = await downloadDriveFile(SHIPMENT_FILE_ID, shipmentPath);
    const okCust = await downloadDriveFile(CUSTOMER_INFO_FILE_ID, customerInfoPath);

    const merged = loadAndMergeFromDisk();
    lastSyncTime = new Date().toISOString();

    res.json({
      success: true,
      message: 'تم تحديث وسحب ملفات الشحنات والعملاء بنجاح من Google Drive!',
      count: merged.length,
      downloaded: { shipments: okShip, customers: okCust },
      lastSync: lastSyncTime,
      shipments: merged,
    });
  } catch (err: any) {
    console.error('Drive sync error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. API: Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Start Server with Vite
async function startServer() {
  // Pre-load data from disk on startup
  loadAndMergeFromDisk();
  console.log(`Loaded ${cachedShipments.length} records into cache.`);

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
