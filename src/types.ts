
export type Language = 'ar' | 'fr' | 'en' | 'es';
export type Currency = 'DZD' | 'EUR' | 'USD' | 'GBP' | 'SAR' | 'AED';
export type UserRole = 'owner' | 'cashier' | 'technician' | 'admin';
export type PaymentMethod = 'cash' | 'card' | 'installments';

export interface CustomerMessage {
  id: string;
  shopId: string;
  senderName: string;
  senderPhone: string;
  subject: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  ticketRelated?: string; // Optional related ticket number
}

export interface ShopTenant {
  id: string;
  name: string;
  ownerEmail: string;
  phone: string;
  address: string;
  logoUrl?: string;
  stampUrl?: string; // Shop stamp representation
  status: 'pending' | 'active' | 'suspended' | 'trial' | 'expired';
  trialEndDate?: string;
  createdAt: string;
  updatedAt: string;
  subscriptionPlan?: 'monthly' | 'yearly' | 'lifetime';
  paymentDetails?: string; // Information on cash or BaridiMob verification
  licenseKey?: string; // Active license key
  licenseType?: 'lifetime' | 'subscription' | 'trial';
  expirationDate?: string;
  hardwareFingerprint?: string; // Machine fingerprint linked to the license
  registeredDeviceSignatures?: string[];
  registeredDevices?: {
    id: string;
    type: 'computer' | 'phone';
    name: string;
    ip: string;
    lastActive: string;
  }[];
  maxComputers?: number;
  maxPhones?: number;
}

export interface AppUser {
  id: string;
  shopId: string;
  email: string;
  password?: string;
  name: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  permissions?: string[];
  createdAt: string;
  canDeleteSales?: boolean;
  canRefundSales?: boolean;
  canEditPrices?: boolean;
  canViewReports?: boolean;
}

export interface AuditLog {
  id: string;
  shopId: string;
  userId: string;
  userName: string;
  action: 'delete_sale' | 'refund_sale' | 'edit_price' | 'edit_product' | 'delete_product' | 'add_product' | 'add_maintenance' | 'edit_maintenance' | 'used_phone_trans' | 'add_expense' | string;
  details: string; // e.g., "حذف فاتورة رقم INV-2026-0001 بقيمة 36000 د.ج"
  timestamp: string;
}

export interface AccountingExpense {
  id: string;
  shopId: string;
  title: string;
  amount: number;
  category: 'rent' | 'salaries' | 'electricity' | 'internet' | 'other';
  date: string;
  notes?: string;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  type: string; // Phone, Accessory, SmartDevice, etc.
  brand: string;
  barcode: string;
  imageUrl?: string;
  quantity: number;
  minQuantity: number; // Low stock alert threshold
  purchasePrice: number;
  sellingPrice: number;
  serialNumbers: string[]; // List of IMEIs or serial numbers
  dateAdded: string;
  notes?: string;
  supplierId?: string;
  supplierName?: string;
  updatedAt?: string;
}

export interface SparePart {
  id: string;
  shopId: string;
  name: string;
  model: string; // e.g., iPhone 13, Galaxy S21
  purchasePrice: number;
  sellingPrice: number;
  supplierId: string;
  supplierName: string;
  quantity: number;
  minQuantity: number;
  dateAdded: string;
  notes?: string;
  updatedAt?: string;
}

export interface Supplier {
  id: string;
  shopId: string;
  name: string;
  type: 'phones_accessories' | 'spare_parts';
  phone: string;
  email?: string;
  address?: string;
  totalDue: number; // Remaining credit (الكريدي المتبقي)
  totalPaid: number; // Paid amount
  paymentHistory: {
    amount: number;
    date: string;
    note?: string;
  }[];
  createdAt: string;
  returnHistory?: {
    id: string;
    itemName: string;
    itemType: 'product' | 'part';
    quantity: number;
    refundAmount: number;
    date: string;
  }[];
}

export interface Customer {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalDebt: number; // Remaining debt on installments (أقساط / كريدي متبقي)
  installments: {
    id: string;
    saleId?: string;
    totalAmount: number;
    paidAmount: number;
    dueDate: string;
    paidHistory: {
      amount: number;
      date: string;
    }[];
    status: 'pending' | 'paid' | 'overdue';
  }[];
  createdAt: string;
}

export interface SaleItem {
  productId?: string;
  partId?: string;
  name: string;
  type: 'product' | 'part' | 'service';
  quantity: number;
  price: number;
  originalPrice: number; // Before discount
  discount: number;
  serialNumber?: string; // Custom designated IMEI/SN
  returnedQuantity?: number; // Tracks returned stock quantity
  cost?: number; // UNIT COST/purchasePrice at time of sale for true profit calculation
}

export interface Sale {
  id: string;
  shopId: string;
  invoiceNumber: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashierId: string;
  cashierName: string;
  customerId?: string;
  customerName?: string;
  warrantyPeriod: string; // e.g. "3 months", "no warranty"
  warrantyNotes?: string;
  date: string;
  updatedAt?: string;
  status?: 'completed' | 'returned' | 'partially_returned'; // Tracks returned logs
  returnedAmount?: number; // Sum of money refunded
}

export interface MaintenanceJob {
  id: string;
  shopId: string;
  ticketNumber: string;
  customerName: string;
  customerPhone: string;
  deviceType: 'phone' | 'computer' | 'tablet' | 'receiver' | 'other';
  deviceModel: string;
  serialOrImei?: string;
  issueDescription: string;
  status: 'pending' | 'inspecting' | 'repairing' | 'ready_for_pickup' | 'delivered' | 'cancelled';
  technicianId?: string;
  technicianName?: string;
  estimatedCost: number;
  finalCost: number;
  amountPaid: number;
  partsUsed: {
    partId: string;
    name: string;
    quantity: number;
    cost: number;
  }[];
  notes?: string;
  receiptWarrantyNote?: string;
  createdAt: string;
  updatedAt: string;
  scratches?: string;
  accessoriesReceived?: string[];
  physicalCondition?: string;
  signatureData?: string;
  bookingDate?: string;
  isOnlineBooking?: boolean;
}

export interface ShopSettings {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  shopEmail?: string;
  logoImage?: string;
  stampImage?: string;
  receiptHeader: string;
  receiptFooter: string;
  warrantyHeader: string;
  warrantyFooter: string;
  currency: Currency;
  language: Language;
  primaryColor: 'sky' | 'emerald' | 'indigo' | 'violet' | 'amber';
  activeTheme?: 'sky-ocean' | 'emerald-grass' | 'indigo-royal' | 'violet-blossom' | 'amber-sunset' | 'rose-ruby';
  darkMode: boolean;
  // Hardware and print characteristics
  stickerPrinterEnabled?: boolean;
  receiptPaperWidth?: '58mm' | '80mm' | 'A4';
  barcodeScannerEnabled?: boolean;
  cashDrawerEnabled?: boolean;
  warrantyPolicyText?: string;
}

export interface BroadcastMessage {
  id: string;
  title: string;
  content: string;
  date: string;
  isUpdate: boolean;
}

export interface UsedPhoneTransaction {
  id: string;
  shopId: string;
  type: 'buy' | 'sell';
  dateTime: string;
  brand: string;
  model: string;
  imei: string;
  imei2?: string;
  serialNumber?: string;
  color?: string;
  storage?: string;
  condition: 'new' | 'excellent' | 'good' | 'fair' | 'broken';
  price: number;
  warrantyPeriod?: string;
  notes?: string;
  status: 'available' | 'sold' | 'returned';
  citizenName: string;
  citizenPhone: string;
  citizenIdType: 'national_card' | 'passport' | 'driver_license' | 'other';
  citizenIdNumber: string;
  citizenIdIssueDate?: string;
  citizenAddress?: string;
  legalDeclaration: boolean;
  signatureData?: string;
  fingerprintData?: string;
  idCardFrontData?: string;
  idCardBackData?: string;
  cashierId: string;
  cashierName: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingRequest {
  id: string;
  shopId: string;
  customerName: string;
  customerPhone: string;
  productName: string; // e.g. iPhone 15 Pro
  notes?: string;
  status: 'pending' | 'available' | 'notified' | 'cancelled';
  createdAt: string;
}

export interface AuditReport {
  id: string;
  shopId: string;
  date: string;
  findings: {
    productId: string;
    barcode: string;
    name: string;
    expectedQty: number;
    actualQty: number;
    difference: number;
  }[];
  checkedBy: string;
  createdAt: string;
}

export interface UsedPhoneAssessment {
  id: string;
  shopId: string;
  model: string;
  imei: string;
  checks: {
    faceIdOrTouchId: 'pass' | 'fail' | 'na';
    batteryHealth: number; // e.g. 88
    screenOriginal: 'yes' | 'no' | 'replaced_high_quality';
    cameraWorking: 'yes' | 'no' | 'issues';
    wifiBluetooth: 'yes' | 'no';
    bodyCondition: 'excellent' | 'good' | 'fair' | 'scratched';
    chargingPort: 'yes' | 'no';
    overallStatus: 'excellent' | 'good' | 'fair' | 'faulty';
  };
  technicianNotes?: string;
  technicianName: string;
  createdAt: string;
}

export interface CustomerOrder {
  id: string;
  shopId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes?: string;
  items: {
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}


