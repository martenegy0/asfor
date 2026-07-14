export interface User {
  name: string;
  role: string;
  pass: string;
  active: string;
  email?: string;
  perms?: string;
}

export interface Courier {
  name: string;
  phone: string;
  commission: number;
  salary: number;
  region: string;
  hire_date?: string;
}

export interface Supplier {
  name: string;
  phone: string;
  price: number;
  notes?: string;
}

export interface Order {
  tracking: string;
  createdAt: string;
  updatedAt: string;
  orderDate: string;
  supplier: string;
  customer: string;
  phone: string;
  phone2?: string;
  gov: string;
  region: string;
  address: string;
  prodPrice: number;
  shipPrice: number;
  totalCOD: number;
  shipCost: number;
  courier: string;
  status: string;
  notes: string;
  delivDate?: string;
  retDate?: string;
  addedBy: string;
  commission: number;
  returnShippingType?: 'paid' | 'unpaid' | '';
  returnQueueStatus?: string;
  returnQueueAgent?: string;
  actionLogs?: { dateTime: string; user: string; text: string; }[];
  lat?: number;
  lng?: number;
  geoLogs?: { dateTime: string; status: string; lat: number; lng: number; }[];
}

export interface Expense {
  date: string;
  cat: string;
  desc: string;
  amount: number;
  by: string;
}

export interface TreasuryEntry {
  date: string;
  desc: string;
  type: 'وارد' | 'صادر' | 'تحصيل مندوب' | 'سداد مورد';
  amount: number;
  ref?: string;
  addedBy: string;
  balance?: number;
}

export interface StatusHistoryEntry {
  tracking: string;
  oldStatus: string;
  newStatus: string;
  updatedBy: string;
  dateTime: string;
}

export interface SupplierLedgerEntry {
  supplier: string;
  date: string;
  type: 'أوردر مستلم' | 'مرتجع' | 'تسوية' | 'دفع نقدي';
  tracking: string;
  amount: number;
  desc: string;
  balanceAfter?: number;
}

export interface CourierLedgerEntry {
  courier: string;
  date: string;
  type: 'تسليم' | 'مرتجع مدفوع الشحن' | 'مرتجع غير مدفوع الشحن' | 'مكافأة' | 'جزاء';
  tracking: string;
  amount: number;
  desc: string;
}

export interface CourierLedgerSummary {
  courierName: string;
  basicSalary: number;
  deliveredCount: number;
  delivCommission: number;
  returnedPaidCount: number;
  returnShippingCommission: number;
  bonusesSum: number;
  penaltiesSum: number;
  netSalary: number;
}
