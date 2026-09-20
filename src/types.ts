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

export type ActivePage =
  | 'dashboard'
  | 'yard_inventory'
  | 'warehouse_inventory'
  | 'reports'
  | 'debt_collection'
  | 'cash_register'
  | 'customer_statement'
  | 'container_radar'
  | 'warehouse_yard'
  | 'print_prep'
  | 'debt_aging'
  | 'visit_log'
  | 'expenses'
  | 'user_permissions';

export type CashSafeType = 'air' | 'sea';

export interface CashTransaction {
  id: string;
  shipment: string;
  type: CashSafeType;
  amount: number;
  time: string;
  userName?: string;
}

export type PageAccess = 'none' | 'view' | 'edit';

export type FilterKey = 'shipment' | 'guarantor' | 'code' | 'type' | 'city' | 'searchQuery';

export interface FilterPermission {
  allowed: boolean;
  allowedValues: string[];
}

export type ActionKey =
  | 'print_receipts'
  | 'print_yard'
  | 'print_full_report'
  | 'export_excel'
  | 'export_yard_excel'
  | 'sync_drive'
  | 'edit_shipment'
  | 'delete_shipment'
  | 'view_receipt'
  | 'warehouse_tally'
  | 'warehouse_print'
  | 'dispatch_goods'
  | 'record_payment'
  | 'delete_payment'
  | 'manage_users';

export interface UserPermissions {
  pages: Record<ActivePage, PageAccess>;
  filters: Record<FilterKey, FilterPermission>;
  actions: Record<ActionKey, boolean>;
}

export interface SystemUser {
  id: string;
  name: string;
  username: string;
  password: string;
  role: string;
  permissions: UserPermissions;
}

export interface PaymentEntry {
  id: string;
  amount: number;
  date: string;
  driverName: string;
  paymentMethod: 'نقد' | 'حوالة' | 'زين كاش' | 'شيك' | 'أخرى';
  notes?: string;
  receiptNumber?: string;
}

export type CollectionStatus = 'مكتمل' | 'جزئي' | 'لم يبدأ';

export interface CollectionRecord {
  id: string;             // Unique identifier (typically shipment.id or `${shipment.shipment}_${shipment.code}`)
  shipmentCode: string;   // كود الشحنة (e.g. RQ6042)
  shipmentType?: string;  // نوع الشحنة (جوي، بحري)
  clientCode: string;     // كود العميل (e.g. B201)
  clientName: string;     // اسم الزبون
  guarantor: string;      // الكفيل
  totalAmount: number;    // المبلغ الكلي ($)
  collectedAmount: number;// المبلغ المستحصل ($)
  remainingAmount: number;// المبلغ المتبقي ($)
  status: CollectionStatus;// حالة الاستحصال (مكتمل / جزئي / لم يبدأ)
  driverName?: string;    // اسم السائق المسؤول عن آخر تحصيل
  notes?: string;         // ملاحظات
  lastUpdated?: string;   // تاريخ ووقت آخر حركة
  debtRegisteredAt?: string; // تاريخ تسجيل الدين / وصول الشحنة (ثابت، لا يُعاد عند الدفع)
  payments: PaymentEntry[];
}
