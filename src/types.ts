export interface ShipmentRecord {
  id: string;
  shipment: string;       // رقم الشحنة (e.g. RA6062)
  code: string;           // كود العميل (e.g. B1020)
  name: string;           // اسم العميل
  guarantor: string;      // الكفيل
  weight: number;         // الوزن كغ
  cbm: number;            // حجم الشحنة CBM
  packages: number;       // عدد الطرود
  price: number;          // السعر / سعر الكيلو $
  sales: number;          // إجمالي المبيعات / الديون $
  phone: string;          // رقم الهاتف 1
  phone2?: string;        // رقم الهاتف 2
  address: string;        // عنوان استلام البضاعة
  city: string;           // المحافظة / المدينة
  type: string;           // نوع الشحنة (جوي، بحري، بري)
  status?: 'جاهز للتسليم' | 'تم التسليم' | 'معلق' | 'في الساحة';
  notes?: string;
}

export interface CitySummary {
  index: number;
  city: string;
  clientCount: number;
  packagesCount: number;
  cbmTotal: number;
  salesTotal: number;
  weightTotal: number;
}

export interface FilterState {
  shipment: string;
  guarantor: string;
  code: string;
  type: string;
  city: string;
  searchQuery: string;
}

export type ActivePage = 'dashboard' | 'dispatch_approval' | 'yard_inventory' | 'reports';
