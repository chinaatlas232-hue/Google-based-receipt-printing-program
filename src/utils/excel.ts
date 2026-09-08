import * as XLSX from 'xlsx';
import { ShipmentRecord, CitySummary } from '../types';
import { AttachedPhoto } from './imageCompressor';

/**
 * Export filtered shipments and city summary to a multi-sheet Excel file (.xlsx)
 */
export function exportShipmentsToExcel(
  shipments: ShipmentRecord[],
  citySummaries: CitySummary[],
  fileNamePrefix: string = 'Atlas_Cargo_Report'
) {
  const wb = XLSX.utils.book_new();

  // 1. Shipments Detailed Sheet
  const shipmentsData = shipments.map((item, idx) => ({
    'التسلسل': idx + 1,
    'رقم الشحنة': item.shipment,
    'كود العميل': item.code,
    'اسم العميل': item.name,
    'الكفيل': item.guarantor,
    'الوزن (كغ)': item.weight,
    'حجم الشحنة (CBM)': item.cbm,
    'عدد الطرود': item.packages,
    'السعر ($)': item.price,
    'إجمالي المبيعات / الديون ($)': item.sales,
    'رقم الهاتف': item.phone,
    'رقم الهاتف 2': item.phone2 || '',
    'عنوان الاستلام': item.address,
    'المحافظة / المدينة': item.city,
    'نوع الشحنة': item.type,
    'الحالة': item.status || 'جاهز للتسليم',
    'ملاحظات': item.notes || ''
  }));

  const wsShipments = XLSX.utils.json_to_sheet(shipmentsData);
  // Auto-set column widths
  wsShipments['!cols'] = [
    { wch: 8 },  // التسلسل
    { wch: 12 }, // رقم الشحنة
    { wch: 12 }, // كود العميل
    { wch: 24 }, // اسم العميل
    { wch: 20 }, // الكفيل
    { wch: 12 }, // الوزن
    { wch: 15 }, // الحجم
    { wch: 12 }, // الطرود
    { wch: 10 }, // السعر
    { wch: 20 }, // المبيعات
    { wch: 16 }, // الهاتف
    { wch: 16 }, // الهاتف 2
    { wch: 30 }, // العنوان
    { wch: 16 }, // المحافظة
    { wch: 14 }, // نوع الشحنة
    { wch: 14 }, // الحالة
    { wch: 24 }  // ملاحظات
  ];
  XLSX.utils.book_append_sheet(wb, wsShipments, 'تفاصيل الشحنات');

  // 2. City Summaries Sheet
  if (citySummaries.length > 0) {
    const citiesData = citySummaries.map(c => ({
      'التسلسل': c.index,
      'المحافظة / المدينة': c.city,
      'عدد العملاء': c.clientCount,
      'إجمالي الطرود': c.packagesCount,
      'إجمالي الحجم (CBM)': Number(c.cbmTotal.toFixed(2)),
      'إجمالي الوزن (كغ)': Number(c.weightTotal.toFixed(2)),
      'إجمالي الديون / المبيعات ($)': Number(c.salesTotal.toFixed(2))
    }));

    const wsCities = XLSX.utils.json_to_sheet(citiesData);
    wsCities['!cols'] = [
      { wch: 8 },
      { wch: 20 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 24 }
    ];
    XLSX.utils.book_append_sheet(wb, wsCities, 'ملخص المحافظات');
  }

  // Generate file name with current date
  const dateStr = new Date().toISOString().split('T')[0];
  const fullFileName = `${fileNamePrefix}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fullFileName);
}

/**
 * Export Yard Inventory Sheet (.xlsx)
 */
export function exportYardInventoryToExcel(
  shipments: ShipmentRecord[],
  shipmentNumber: string = 'الكل',
  actualCounts?: Record<string, number | ''>,
  checkedItems?: Record<string, boolean>,
  itemNotes?: Record<string, string>,
  itemPhotos?: Record<string, AttachedPhoto[]>
) {
  const wb = XLSX.utils.book_new();

  const yardData = shipments.map((item, idx) => {
    const act = actualCounts ? actualCounts[item.id] : undefined;
    const isChecked = checkedItems ? !!checkedItems[item.id] : false;
    let note = itemNotes ? (itemNotes[item.id] || '') : '';
    const photos = itemPhotos ? itemPhotos[item.id] : undefined;
    if (photos && photos.length > 0) {
      const photoTag = `[مرفق ${photos.length} صور في النظام]`;
      note = note ? `${note} - ${photoTag}` : photoTag;
    }

    const actualVal = act !== undefined && act !== '' ? Number(act) : '';
    const statusVal = isChecked 
      ? (actualVal !== '' && actualVal !== item.packages ? `يوجد فرق (${Number(actualVal) - item.packages})` : 'مطابق ومفحوص')
      : (actualVal !== '' ? 'تم الرصد' : 'قيد الانتظار');

    return {
      'التسلسل': idx + 1,
      'كود العميل': item.code,
      'اسم العميل': item.name,
      'العنوان': item.address,
      'المحافظة': item.city,
      'عدد الطرود المقيد': item.packages,
      'الجرد الفعلي (الساحة)': actualVal !== '' ? actualVal : item.packages,
      'حالة التدقيق': statusVal,
      'ملاحظات ومرفقات الساحة': note,
      'توقيع مسؤول الجرد': ''
    };
  });

  const ws = XLSX.utils.json_to_sheet(yardData);
  ws['!cols'] = [
    { wch: 8 },
    { wch: 14 },
    { wch: 24 },
    { wch: 30 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 45 },
    { wch: 20 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'جرد الساحة');
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `جرد_الساحة_${shipmentNumber}_${dateStr}.xlsx`);
}

/**
 * Parse uploaded Excel or CSV file buffer into ShipmentRecord[]
 */
export function parseExcelFile(arrayBuffer: ArrayBuffer): ShipmentRecord[] {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  return jsonData.map((row, idx) => {
    // Flexible column resolution matching the Python code logic
    const findValue = (keywords: string[], fallback: string = ''): string => {
      const entry = Object.entries(row).find(([k]) =>
        keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase()))
      );
      return entry ? String(entry[1] ?? '').trim() : fallback;
    };

    const findNum = (keywords: string[], fallback: number = 0): number => {
      const entry = Object.entries(row).find(([k]) =>
        keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase()))
      );
      if (!entry || entry[1] === null || entry[1] === undefined) return fallback;
      const parsed = parseFloat(String(entry[1]).replace(/[^0-9.-]+/g, ''));
      return isNaN(parsed) ? fallback : parsed;
    };

    const weight = findNum(['وزن', 'weight']);
    const price = findNum(['سعر', 'price']);
    let sales = findNum(['مبيعات', 'اجمالي', 'ديون', 'total', 'sales']);
    if (sales === 0 && weight > 0 && price > 0) {
      sales = weight * price;
    }

    let phone = findValue(['هاتف', 'phone', 'موبايل', 'جوال']);
    if (phone && !phone.startsWith('+')) {
      if (phone.startsWith('964')) {
        phone = `+964 ${phone.slice(3)}`;
      } else if (phone.startsWith('07')) {
        phone = `+964 ${phone.slice(1)}`;
      }
    }

    return {
      id: String(idx + 1),
      shipment: findValue(['شحنة', 'shipment'], 'RA6062'),
      code: findValue(['كود', 'code'], `C${1000 + idx}`),
      name: findValue(['اسم', 'name', 'العميل'], `عميل ${idx + 1}`),
      guarantor: findValue(['كفيل', 'guarantor'], ''),
      weight: weight,
      cbm: findNum(['حجم', 'cbm']),
      packages: Math.round(findNum(['طرود', 'packages', 'عدد'])),
      price: price,
      sales: sales,
      phone: phone || '+964 7800000000',
      phone2: findValue(['هاتف 2', 'phone 2', 'هاتف2']),
      address: findValue(['عنوان', 'address', 'البضاعة', 'البض']),
      city: findValue(['مدينة', 'محافظة', 'city'], 'بغداد'),
      type: findValue(['نوع', 'type'], 'جوي سريع'),
      status: 'جاهز للتسليم',
      notes: findValue(['ملاحظات', 'notes'])
    };
  });
}

export interface CustomerInfoRecord {
  code: string;
  name: string;
  phone: string;
  phone2?: string;
  address: string;
  city: string;
  guarantor?: string;
}

/**
 * Parse Customer directory file buffer
 */
export function parseCustomerFile(arrayBuffer: ArrayBuffer): CustomerInfoRecord[] {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  return jsonData.map(row => {
    const findValue = (keywords: string[], fallback: string = ''): string => {
      const entry = Object.entries(row).find(([k]) =>
        keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase()))
      );
      return entry ? String(entry[1] ?? '').trim() : fallback;
    };

    let phone = findValue(['هاتف', 'phone', 'موبايل', 'جوال']);
    if (phone && !phone.startsWith('+')) {
      if (phone.startsWith('964')) {
        phone = `+964 ${phone.slice(3)}`;
      } else if (phone.startsWith('07')) {
        phone = `+964 ${phone.slice(1)}`;
      }
    }

    return {
      code: findValue(['كود', 'code', 'رمز']),
      name: findValue(['اسم', 'name', 'العميل', 'الزبون']),
      phone: phone,
      phone2: findValue(['هاتف 2', 'phone 2', 'هاتف2', 'آخر']),
      address: findValue(['عنوان', 'address', 'منطقة']),
      city: findValue(['محافظة', 'مدينة', 'city'], 'بغداد'),
      guarantor: findValue(['كفيل', 'guarantor', 'ضامن'])
    };
  }).filter(c => c.code || c.name);
}

/**
 * Merge shipments with customer info by Customer Code
 */
export function mergeShipmentsWithCustomers(
  shipments: ShipmentRecord[],
  customers: CustomerInfoRecord[]
): ShipmentRecord[] {
  const customerMap = new Map<string, CustomerInfoRecord>();
  customers.forEach(c => {
    if (c.code) customerMap.set(c.code.trim().toUpperCase(), c);
    if (c.name) customerMap.set(c.name.trim().toLowerCase(), c);
  });

  return shipments.map(s => {
    const matchByCode = s.code ? customerMap.get(s.code.trim().toUpperCase()) : undefined;
    const matchByName = !matchByCode && s.name ? customerMap.get(s.name.trim().toLowerCase()) : undefined;
    const customer = matchByCode || matchByName;

    if (!customer) return s;

    return {
      ...s,
      name: customer.name || s.name,
      phone: customer.phone || s.phone,
      phone2: customer.phone2 || s.phone2,
      address: customer.address || s.address,
      city: customer.city || s.city,
      guarantor: customer.guarantor || s.guarantor,
    };
  });
}

