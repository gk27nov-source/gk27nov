export type ProductUnit = 'PCS' | 'KG' | 'LTR' | 'BOX' | 'MTR' | 'SET' | 'ROLL' | 'PACK' | 'UNIT';
export type UnitOfMeasurement = ProductUnit;

export interface StoreStockLevel {
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  storageLocation?: string;
}

export interface Product {
  id: string;
  organizationId: string;
  sku: string; // Product ID / SKU
  name: string;
  category: string;
  subcategory?: string;
  brand: string;
  description: string;
  unit: ProductUnit;
  barcode?: string;
  hsnCode?: string;
  gstRate: number; // 0, 5, 12, 18, 28
  purchasePrice: number;
  sellingPrice: number;
  minStockLevel: number;
  maxStockLevel: number;
  reorderLevel: number;
  openingStock: number;
  currentStock: number; // Physical stock total
  reservedStock: number; // Reserved against quotes/orders
  availableStock: number; // Physical - Reserved
  supplierId?: string;
  supplierName?: string;
  storageLocation?: string; // Default or main store location
  storeStocks?: Record<string, StoreStockLevel>; // keyed by storeId
  status: 'Active' | 'Inactive';
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description?: string;
  productCount?: number;
}

export interface WarehouseStore {
  id: string;
  organizationId: string;
  storeCode: string;
  name: string;
  address: string;
  city: string;
  state?: string;
  managerName: string;
  managerContact: string;
  managerEmail: string;
  isMainStore: boolean;
  isActive: boolean;
  totalStockQty?: number;
  totalStockValue?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  organizationId: string;
  supplierCode: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  gstNumber?: string;
  paymentTerms: string;
  suppliedCategories: string[];
  outstandingAmount: number;
  rating?: number;
  status: 'Active' | 'Inactive';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type StockTransactionType =
  | 'Opening Stock'
  | 'Purchase'
  | 'Sale'
  | 'Stock Issue'
  | 'Stock Receipt'
  | 'Stock Transfer'
  | 'Sales Return'
  | 'Purchase Return'
  | 'Stock Adjustment'
  | 'Damaged Stock'
  | 'Expired Stock';

export interface StockTransaction {
  id: string;
  organizationId: string;
  transactionNumber: string; // e.g. TXN-2026-001
  type: StockTransactionType;
  productId: string;
  productName: string;
  sku: string;
  quantity: number; // Magnitude
  direction: 'in' | 'out'; // in = adds to stock, out = subtracts from stock
  unit: string;
  unitPrice?: number;
  totalValue?: number;
  sourceStoreId?: string;
  sourceStoreName?: string;
  destinationStoreId?: string;
  destinationStoreName?: string;
  referenceType?: 'purchase_order' | 'goods_receipt' | 'invoice' | 'quotation' | 'complaint' | 'stock_transfer' | 'audit' | 'manual';
  referenceNumber?: string;
  userId: string;
  userName: string;
  remarks: string;
  previousStock: number;
  newStock: number;
  timestamp: string;
}

export type StockTransferStatus = 'Pending' | 'Approved' | 'In Transit' | 'Received' | 'Cancelled';

export interface StockTransferItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
}

export interface StockTransfer {
  id: string;
  organizationId: string;
  transferNumber: string;
  sourceStoreId: string;
  sourceStoreName: string;
  destinationStoreId: string;
  destinationStoreName: string;
  status: StockTransferStatus;
  items: StockTransferItem[];
  initiatedById: string;
  initiatedByName: string;
  approvedById?: string;
  approvedByName?: string;
  receivedById?: string;
  receivedByName?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseOrderStatus = 'Draft' | 'Sent' | 'Approved' | 'Partially Received' | 'Received' | 'Cancelled';

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  sku: string;
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
  gstRate: number;
  total: number;
  unit: string;
}

export interface PurchaseOrder {
  id: string;
  organizationId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  supplierPhone: string;
  destinationStoreId: string;
  destinationStoreName: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  notes?: string;
  terms?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceiptItem {
  productId: string;
  productName: string;
  sku: string;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  unitPrice: number;
  remarks?: string;
  unit: string;
}

export interface GoodsReceipt {
  id: string;
  organizationId: string;
  grnNumber: string; // GRN-2026-001
  poId?: string;
  poNumber?: string;
  supplierId: string;
  supplierName: string;
  storeId: string;
  storeName: string;
  receiptDate: string;
  challanOrInvoiceNumber?: string;
  items: GoodsReceiptItem[];
  inspectionRemarks?: string;
  status: 'Verified & Received' | 'Rejected';
  receivedById: string;
  receivedByName: string;
  createdAt: string;
}

export interface StockReservationItem {
  productId: string;
  productName: string;
  sku: string;
  reservedQty: number;
  unit: string;
}

export interface StockReservation {
  id: string;
  organizationId: string;
  reservationNumber: string;
  referenceType: 'quotation' | 'invoice' | 'order' | 'complaint';
  referenceId: string;
  referenceNumber: string;
  customerId?: string;
  customerName: string;
  storeId: string;
  storeName: string;
  status: 'Active' | 'Released' | 'Fulfilled';
  items: StockReservationItem[];
  notes?: string;
  expiresAt?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockAuditItem {
  productId: string;
  productName: string;
  sku: string;
  systemQty: number;
  physicalQty: number;
  variance: number; // physical - system
  unit: string;
  unitCost: number;
  varianceValue: number;
  reason?: string;
}

export type StockAuditStatus = 'In Progress' | 'Pending Approval' | 'Approved & Adjusted' | 'Rejected';

export interface StockAudit {
  id: string;
  organizationId: string;
  auditNumber: string; // AUD-2026-001
  storeId: string;
  storeName: string;
  auditDate: string;
  status: StockAuditStatus;
  auditorId: string;
  auditorName: string;
  approvedById?: string;
  approvedByName?: string;
  items: StockAuditItem[];
  totalDiscrepancyValue: number;
  remarks?: string;
  createdAt: string;
  completedAt?: string;
}

export interface StockAdjustmentItem {
  productId: string;
  productName: string;
  sku: string;
  quantityChange: number; // + or -
  unit: string;
  reason: string;
  unitCost?: number;
}

export interface StockAdjustment {
  id: string;
  organizationId: string;
  adjustmentNumber: string; // ADJ-2026-001
  storeId: string;
  storeName: string;
  reason: 'Audit Discrepancy' | 'Damaged Goods' | 'Expiry' | 'Theft / Loss' | 'Data Entry Correction' | 'Other';
  status: 'Approved' | 'Pending';
  items: StockAdjustmentItem[];
  approvedById: string;
  approvedByName: string;
  referenceAuditId?: string;
  notes?: string;
  createdAt: string;
}
