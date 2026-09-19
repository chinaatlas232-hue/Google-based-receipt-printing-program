import {
  ActionKey,
  ActivePage,
  FilterKey,
  FilterPermission,
  FilterState,
  PageAccess,
  ShipmentRecord,
  SystemUser,
  UserPermissions,
} from '../types';

export const PAGE_KEYS: ActivePage[] = [
  'dashboard',
  'warehouse_inventory',
  'yard_inventory',
  'debt_collection',
  'cash_register',
  'reports',
  'customer_statement',
  'container_radar',
  'warehouse_yard',
  'print_prep',
  'debt_aging',
  'user_permissions',
];

export const PAGE_LABELS: Record<ActivePage, string> = {
  dashboard: 'الصفحة الرئيسية والوصولات',
  warehouse_inventory: 'جرد المستودعات',
  yard_inventory: 'واجهة إخراج البضائع',
  debt_collection: 'واجهة الاستحصالات',
  cash_register: 'واجهة القاصة',
  reports: 'تقارير',
  customer_statement: 'كشف حساب عميل',
  container_radar: 'رادار تتبع الحاويات',
  warehouse_yard: 'جرد المستودع والساحة',
  print_prep: 'التحظير الطباعي',
  debt_aging: 'أعمار الديون والديون المتأخرة',
  user_permissions: 'صلاحيات المستخدمين',
};

export const FILTER_KEYS: FilterKey[] = [
  'shipment',
  'guarantor',
  'code',
  'type',
  'city',
  'searchQuery',
];

export const FILTER_LABELS: Record<FilterKey, string> = {
  shipment: 'رقم الشحنة',
  guarantor: 'الكفيل الضامن',
  code: 'كود العميل',
  type: 'نوع الشحنة',
  city: 'المحافظة / المدينة',
  searchQuery: 'البحث الفوري',
};

export const ACTION_KEYS: ActionKey[] = [
  'print_receipts',
  'print_yard',
  'print_full_report',
  'export_excel',
  'export_yard_excel',
  'sync_drive',
  'edit_shipment',
  'delete_shipment',
  'view_receipt',
  'warehouse_tally',
  'warehouse_print',
  'dispatch_goods',
  'record_payment',
  'delete_payment',
  'manage_users',
];

export const ACTION_LABELS: Record<ActionKey, string> = {
  print_receipts: 'طباعة الوصولات',
  print_yard: 'طباعة جرد الساحة',
  print_full_report: 'كشف الشحنة الشامل',
  export_excel: 'تصدير إكسل',
  export_yard_excel: 'تصدير جرد الساحة',
  sync_drive: 'مزامنة Google Sheets',
  edit_shipment: 'تعديل سجل شحنة',
  delete_shipment: 'حذف سجل شحنة',
  view_receipt: 'معاينة الوصل',
  warehouse_tally: 'إدخال الجرد الفعلي',
  warehouse_print: 'طباعة جرد المستودع',
  dispatch_goods: 'اعتماد إخراج البضائع',
  record_payment: 'تسجيل دفعة استحصال',
  delete_payment: 'حذف دفعة استحصال',
  manage_users: 'إدارة المستخدمين والصلاحيات',
};

export const PAGE_ACCESS_LABELS: Record<PageAccess, string> = {
  none: 'لا وصول',
  view: 'عرض فقط',
  edit: 'عرض وتعديل',
};

export function createFullPermissions(): UserPermissions {
  return {
    pages: {
      dashboard: 'edit',
      warehouse_inventory: 'edit',
      yard_inventory: 'edit',
      debt_collection: 'edit',
      cash_register: 'edit',
      reports: 'edit',
      customer_statement: 'edit',
      container_radar: 'edit',
      warehouse_yard: 'edit',
      print_prep: 'edit',
      debt_aging: 'edit',
      user_permissions: 'edit',
    },
    filters: {
      shipment: { allowed: true, allowedValues: [] },
      guarantor: { allowed: true, allowedValues: [] },
      code: { allowed: true, allowedValues: [] },
      type: { allowed: true, allowedValues: [] },
      city: { allowed: true, allowedValues: [] },
      searchQuery: { allowed: true, allowedValues: [] },
    },
    actions: {
      print_receipts: true,
      print_yard: true,
      print_full_report: true,
      export_excel: true,
      export_yard_excel: true,
      sync_drive: true,
      edit_shipment: true,
      delete_shipment: true,
      view_receipt: true,
      warehouse_tally: true,
      warehouse_print: true,
      dispatch_goods: true,
      record_payment: true,
      delete_payment: true,
      manage_users: true,
    },
  };
}

export function clonePermissions(source?: UserPermissions): UserPermissions {
  const base = source ? normalizePermissions(source) : createFullPermissions();
  return JSON.parse(JSON.stringify(base)) as UserPermissions;
}

export function normalizePermissions(source?: UserPermissions): UserPermissions {
  const next = createFullPermissions();
  if (!source) {
    PAGE_KEYS.forEach((key) => {
      next.pages[key] = 'none';
    });
    return next;
  }
  PAGE_KEYS.forEach((key) => {
    next.pages[key] =
      source.pages?.[key] ??
      (key === 'cash_register'
        ? source.pages?.debt_collection ?? 'none'
        : key === 'customer_statement'
          ? source.pages?.reports ?? 'none'
          : key === 'container_radar'
            ? source.pages?.reports ?? 'none'
            : key === 'warehouse_yard'
              ? source.pages?.warehouse_inventory ?? 'none'
              : key === 'print_prep'
                ? 'none'
                : key === 'debt_aging'
                  ? source.pages?.debt_collection ?? 'none'
                  : 'none');
  });
  FILTER_KEYS.forEach((key) => {
    const value = source.filters?.[key];
    next.filters[key] = {
      allowed: value?.allowed ?? true,
      allowedValues: value?.allowedValues ?? [],
    };
  });
  ACTION_KEYS.forEach((key) => {
    next.actions[key] = typeof source.actions?.[key] === 'boolean' ? source.actions[key] : false;
  });
  return next;
}

export function mergePermissions(partial: DeepPartialPermissions): UserPermissions {
  const next = createFullPermissions();
  if (partial.pages) {
    (Object.keys(partial.pages) as ActivePage[]).forEach((key) => {
      const value = partial.pages?.[key];
      if (value) next.pages[key] = value;
    });
  }
  if (partial.filters) {
    (Object.keys(partial.filters) as FilterKey[]).forEach((key) => {
      const value = partial.filters?.[key];
      if (!value) return;
      next.filters[key] = {
        allowed: value.allowed ?? next.filters[key].allowed,
        allowedValues: value.allowedValues ?? next.filters[key].allowedValues,
      };
    });
  }
  if (partial.actions) {
    (Object.keys(partial.actions) as ActionKey[]).forEach((key) => {
      const value = partial.actions?.[key];
      if (typeof value === 'boolean') next.actions[key] = value;
    });
  }
  return next;
}

type DeepPartialPermissions = {
  pages?: Partial<Record<ActivePage, PageAccess>>;
  filters?: Partial<Record<FilterKey, Partial<FilterPermission>>>;
  actions?: Partial<Record<ActionKey, boolean>>;
};

export function canAccessPage(user: SystemUser | null, page: ActivePage): boolean {
  if (!user) return false;
  if (page === 'customer_statement' || page === 'container_radar' || page === 'warehouse_yard' || page === 'print_prep' || page === 'debt_aging') return true;
  return user.permissions.pages[page] !== 'none';
}

export function canEditPage(user: SystemUser | null, page: ActivePage): boolean {
  if (!user) return false;
  return user.permissions.pages[page] === 'edit';
}

export function canDoAction(user: SystemUser | null, action: ActionKey): boolean {
  if (!user) return false;
  return !!user.permissions.actions[action];
}

export function getFilterPermission(user: SystemUser | null, key: FilterKey): FilterPermission {
  if (!user) return { allowed: false, allowedValues: [] };
  return user.permissions.filters[key];
}

export function constrainOptions(options: string[], permission: FilterPermission): string[] {
  if (!permission.allowedValues.length) return options;
  return options.filter((opt) => permission.allowedValues.includes(opt));
}

export function applyPermissionScope(
  shipments: ShipmentRecord[],
  user: SystemUser | null
): ShipmentRecord[] {
  if (!user) return [];
  const { filters } = user.permissions;
  return shipments.filter((item) => {
    if (filters.shipment.allowedValues.length && !filters.shipment.allowedValues.includes(item.shipment)) {
      return false;
    }
    if (filters.guarantor.allowedValues.length && !filters.guarantor.allowedValues.includes(item.guarantor)) {
      return false;
    }
    if (filters.code.allowedValues.length && !filters.code.allowedValues.includes(item.code)) {
      return false;
    }
    if (filters.type.allowedValues.length && !filters.type.allowedValues.includes(item.type)) {
      return false;
    }
    if (filters.city.allowedValues.length && !filters.city.allowedValues.includes(item.city)) {
      return false;
    }
    return true;
  });
}

export function defaultFiltersForUser(user: SystemUser | null): FilterState {
  const base: FilterState = {
    shipment: 'الكل',
    guarantor: 'الكل',
    code: 'الكل',
    type: 'الكل',
    city: 'الكل',
    searchQuery: '',
  };
  if (!user) return base;
  (['shipment', 'guarantor', 'code', 'type', 'city'] as FilterKey[]).forEach((key) => {
    const perm = user.permissions.filters[key];
    if (perm.allowedValues.length === 1 && key !== 'searchQuery') {
      base[key] = perm.allowedValues[0];
    }
  });
  return base;
}

export function constrainFilterState(filters: FilterState, user: SystemUser | null): FilterState {
  if (!user) return filters;
  const next = { ...filters };
  (['shipment', 'guarantor', 'code', 'type', 'city'] as FilterKey[]).forEach((key) => {
    const perm = user.permissions.filters[key];
    const current = next[key];
    if (!perm.allowed) {
      next[key] = perm.allowedValues.length === 1 ? perm.allowedValues[0] : 'الكل';
      return;
    }
    if (perm.allowedValues.length) {
      if (current === 'الكل' || !perm.allowedValues.includes(current)) {
        next[key] = perm.allowedValues.length === 1 ? perm.allowedValues[0] : perm.allowedValues[0];
      }
    }
  });
  if (!user.permissions.filters.searchQuery.allowed) {
    next.searchQuery = '';
  }
  return next;
}

export function firstAccessiblePage(user: SystemUser | null): ActivePage {
  if (!user) return 'dashboard';
  const preferred: ActivePage[] = [
    'dashboard',
    'warehouse_inventory',
    'yard_inventory',
    'debt_collection',
    'cash_register',
    'reports',
    'customer_statement',
    'user_permissions',
  ];
  return preferred.find((page) => canAccessPage(user, page)) ?? 'dashboard';
}
