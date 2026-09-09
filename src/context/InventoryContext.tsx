import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Product,
  StoreStockLevel,
  ProductCategory,
  WarehouseStore,
  Supplier,
  StockTransaction,
  StockTransfer,
  StockTransferStatus,
  PurchaseOrder,
  GoodsReceipt,
  StockReservation,
  StockAudit,
  StockAuditStatus,
  StockAdjustment,
} from '../types/inventory';
import {
  initialProducts,
  initialCategories,
  initialStores,
  initialSuppliers,
  initialStockTransactions,
  initialStockTransfers,
  initialPurchaseOrders,
  initialGoodsReceipts,
  initialStockReservations,
  initialStockAudits,
} from '../data/inventorySeedData';
import { useApp } from './AppContext';
import { db } from '../firebase/config';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  runTransaction,
  onSnapshot,
} from 'firebase/firestore';

export type InventoryTabType =
  | 'dashboard'
  | 'products'
  | 'stores'
  | 'suppliers'
  | 'transactions'
  | 'stock-in'
  | 'stock-out'
  | 'transfers'
  | 'audits'
  | 'reservations'
  | 'purchase-orders'
  | 'reports';

interface CreateTransactionParams {
  type: StockTransaction['type'];
  productId: string;
  quantity: number;
  direction: 'in' | 'out';
  storeId?: string;
  sourceStoreId?: string;
  destinationStoreId?: string;
  referenceType?: StockTransaction['referenceType'];
  referenceNumber?: string;
  remarks: string;
  unitPrice?: number;
}

interface InventoryContextType {
  // State
  products: Product[];
  categories: ProductCategory[];
  stores: WarehouseStore[];
  suppliers: Supplier[];
  stockTransactions: StockTransaction[];
  stockTransfers: StockTransfer[];
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceipt[];
  stockReservations: StockReservation[];
  stockAudits: StockAudit[];
  stockAdjustments: StockAdjustment[];

  // Navigation & Filtering
  activeInventoryTab: InventoryTabType;
  setActiveInventoryTab: (tab: InventoryTabType) => void;
  selectedStoreFilter: string;
  setSelectedStoreFilter: (storeId: string) => void;

  // Computed Metrics
  totalProductsCount: number;
  totalStockQuantity: number;
  totalStockValue: number;
  lowStockProducts: Product[];
  outOfStockProducts: Product[];
  pendingPurchaseOrdersCount: number;

  // Core Actions
  addProduct: (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'organizationId' | 'currentStock' | 'reservedStock' | 'availableStock'> & { openingStock?: number; initialStoreId?: string }) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  bulkImportProducts: (importedList: Partial<Product>[]) => Promise<number>;

  addCategory: (categoryData: Omit<ProductCategory, 'id' | 'organizationId'>) => Promise<ProductCategory>;
  addStore: (storeData: Omit<WarehouseStore, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>) => Promise<WarehouseStore>;
  updateStore: (id: string, updates: Partial<WarehouseStore>) => Promise<void>;

  addSupplier: (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>) => Promise<Supplier>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>;

  // Transaction Processor (Enforces strict stock validation and audit trail)
  createStockTransaction: (params: CreateTransactionParams) => Promise<StockTransaction>;

  // Purchase / Stock In
  createPurchaseOrder: (poData: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'organizationId' | 'createdById' | 'createdByName'>) => Promise<PurchaseOrder>;
  updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => Promise<void>;
  createGoodsReceipt: (grnData: Omit<GoodsReceipt, 'id' | 'createdAt' | 'organizationId' | 'receivedById' | 'receivedByName'>) => Promise<GoodsReceipt>;

  // Stock Transfer
  createStockTransfer: (transferData: Omit<StockTransfer, 'id' | 'createdAt' | 'updatedAt' | 'organizationId' | 'initiatedById' | 'initiatedByName' | 'status'>) => Promise<StockTransfer>;
  approveStockTransfer: (id: string) => Promise<void>;
  receiveStockTransfer: (id: string) => Promise<void>;
  completeStockTransfer: (id: string) => Promise<void>;
  cancelStockTransfer: (id: string, reason?: string) => Promise<void>;

  // Stock Reservation
  createStockReservation: (resData: Omit<StockReservation, 'id' | 'createdAt' | 'updatedAt' | 'organizationId' | 'createdById' | 'createdByName' | 'status'>) => Promise<StockReservation>;
  releaseStockReservation: (id: string) => Promise<void>;
  fulfillStockReservation: (id: string) => Promise<void>;

  // Stock Audit & Reconciliation
  createStockAudit: (auditData: Omit<StockAudit, 'id' | 'createdAt' | 'organizationId' | 'auditorId' | 'auditorName' | 'status'>) => Promise<StockAudit>;
  approveStockAudit: (id: string) => Promise<void>;
  reconcileStockAudit: (id: string) => Promise<void>;

  // Manual Adjustments
  createStockAdjustment: (adjData: Omit<StockAdjustment, 'id' | 'createdAt' | 'organizationId' | 'approvedById' | 'approvedByName' | 'status'>) => Promise<StockAdjustment>;

  // Cross-Module Issue
  issueStockForComplaint: (complaintId: string, productId: string, quantity: number, remarks?: string, storeId?: string) => Promise<void>;
  issueStockForInvoice: (invoiceId: string, productId: string, quantity: number, remarks?: string, storeId?: string) => Promise<void>;

  // Reset
  resetInventoryToSampleData: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const LOCAL_STORAGE_PREFIX = 'smart_hub_inventory_v1';

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentOrg,
    currentUser,
    logActivity,
    dispatchWebhookEvent,
    complaints,
    invoices,
  } = useApp();

  const [activeInventoryTab, setActiveInventoryTab] = useState<InventoryTabType>('dashboard');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');

  // 1. Initial State from localStorage or Seed Data
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}_products`);
    return saved ? JSON.parse(saved) : initialProducts;
  });

  const [categories, setCategories] = useState<ProductCategory[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}_categories`);
    return saved ? JSON.parse(saved) : initialCategories;
  });

  const [stores, setStores] = useState<WarehouseStore[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}_stores`);
    return saved ? JSON.parse(saved) : initialStores;
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}_suppliers`);
    return saved ? JSON.parse(saved) : initialSuppliers;
  });

  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}_transactions`);
    return saved ? JSON.parse(saved) : initialStockTransactions;
  });

  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}_transfers`);
    return saved ? JSON.parse(saved) : initialStockTransfers;
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}_purchase_orders`);
    return saved ? JSON.parse(saved) : initialPurchaseOrders;
  });

  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}_goods_receipts`);
    return saved ? JSON.parse(saved) : initialGoodsReceipts;
  });

  const [stockReservations, setStockReservations] = useState<StockReservation[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}_reservations`);
    return saved ? JSON.parse(saved) : initialStockReservations;
  });

  const [stockAudits, setStockAudits] = useState<StockAudit[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}_audits`);
    return saved ? JSON.parse(saved) : initialStockAudits;
  });

  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}_adjustments`);
    return saved ? JSON.parse(saved) : [];
  });

  // 2. Sync to localStorage
  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}_products`, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}_categories`, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}_stores`, JSON.stringify(stores));
  }, [stores]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}_suppliers`, JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}_transactions`, JSON.stringify(stockTransactions));
  }, [stockTransactions]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}_transfers`, JSON.stringify(stockTransfers));
  }, [stockTransfers]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}_purchase_orders`, JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}_goods_receipts`, JSON.stringify(goodsReceipts));
  }, [goodsReceipts]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}_reservations`, JSON.stringify(stockReservations));
  }, [stockReservations]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}_audits`, JSON.stringify(stockAudits));
  }, [stockAudits]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}_adjustments`, JSON.stringify(stockAdjustments));
  }, [stockAdjustments]);

  // Firestore Cloud Database Real-Time Sync & Initial Seeding
  useEffect(() => {
    if (!currentOrg?.id) return;

    let isMounted = true;
    const unsubscribers: (() => void)[] = [];

    async function initFirestoreRealtimeSync() {
      try {
        const prodRef = collection(db, 'products');
        const qProds = query(prodRef, where('organizationId', '==', currentOrg.id));
        const prodSnap = await getDocs(qProds);

        if (prodSnap.empty) {
          // Initialize Firestore with sample products for durability across sessions
          for (const p of initialProducts) {
            await setDoc(doc(db, 'products', p.id), { ...p, organizationId: currentOrg.id }, { merge: true });
          }
          for (const s of initialStores) {
            await setDoc(doc(db, 'stores', s.id), { ...s, organizationId: currentOrg.id }, { merge: true });
          }
          for (const cat of initialCategories) {
            await setDoc(doc(db, 'categories', cat.id), { ...cat, organizationId: currentOrg.id }, { merge: true });
          }
          for (const sup of initialSuppliers) {
            await setDoc(doc(db, 'suppliers', sup.id), { ...sup, organizationId: currentOrg.id }, { merge: true });
          }
          for (const txn of initialStockTransactions) {
            await setDoc(doc(db, 'stockTransactions', txn.id), { ...txn, organizationId: currentOrg.id }, { merge: true });
          }
        }

        // 1. Products Real-time onSnapshot listener
        const unsubProducts = onSnapshot(
          query(collection(db, 'products'), where('organizationId', '==', currentOrg.id)),
          (snapshot) => {
            if (!snapshot.empty && isMounted) {
              const list: Product[] = [];
              snapshot.forEach((d) => list.push(d.data() as Product));
              setProducts(list);
            }
          },
          (err) => console.warn('Products live listener notice:', err)
        );
        unsubscribers.push(unsubProducts);

        // 2. Stores Real-time onSnapshot listener
        const unsubStores = onSnapshot(
          query(collection(db, 'stores'), where('organizationId', '==', currentOrg.id)),
          (snapshot) => {
            if (!snapshot.empty && isMounted) {
              const list: WarehouseStore[] = [];
              snapshot.forEach((d) => list.push(d.data() as WarehouseStore));
              setStores(list);
            }
          },
          (err) => console.warn('Stores live listener notice:', err)
        );
        unsubscribers.push(unsubStores);

        // 3. Categories Real-time onSnapshot listener
        const unsubCategories = onSnapshot(
          query(collection(db, 'categories'), where('organizationId', '==', currentOrg.id)),
          (snapshot) => {
            if (!snapshot.empty && isMounted) {
              const list: ProductCategory[] = [];
              snapshot.forEach((d) => list.push(d.data() as ProductCategory));
              setCategories(list);
            }
          },
          (err) => console.warn('Categories live listener notice:', err)
        );
        unsubscribers.push(unsubCategories);

        // 4. Suppliers Real-time onSnapshot listener
        const unsubSuppliers = onSnapshot(
          query(collection(db, 'suppliers'), where('organizationId', '==', currentOrg.id)),
          (snapshot) => {
            if (!snapshot.empty && isMounted) {
              const list: Supplier[] = [];
              snapshot.forEach((d) => list.push(d.data() as Supplier));
              setSuppliers(list);
            }
          },
          (err) => console.warn('Suppliers live listener notice:', err)
        );
        unsubscribers.push(unsubSuppliers);

        // 5. Stock Transactions Real-time onSnapshot listener
        const unsubTxns = onSnapshot(
          query(collection(db, 'stockTransactions'), where('organizationId', '==', currentOrg.id)),
          (snapshot) => {
            if (!snapshot.empty && isMounted) {
              const list: StockTransaction[] = [];
              snapshot.forEach((d) => list.push(d.data() as StockTransaction));
              list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              setStockTransactions(list);
            }
          },
          (err) => console.warn('Transactions live listener notice:', err)
        );
        unsubscribers.push(unsubTxns);

        // 6. Stock Transfers Real-time onSnapshot listener
        const unsubTransfers = onSnapshot(
          query(collection(db, 'stockTransfers'), where('organizationId', '==', currentOrg.id)),
          (snapshot) => {
            if (!snapshot.empty && isMounted) {
              const list: StockTransfer[] = [];
              snapshot.forEach((d) => list.push(d.data() as StockTransfer));
              setStockTransfers(list);
            }
          },
          (err) => console.warn('Transfers live listener notice:', err)
        );
        unsubscribers.push(unsubTransfers);
      } catch (err) {
        console.warn('Firestore initial sync note (operating with resilient local storage):', err);
      }
    }

    initFirestoreRealtimeSync();

    return () => {
      isMounted = false;
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [currentOrg.id]);

  // 3. Computed Metrics
  const totalProductsCount = products.length;

  const totalStockQuantity = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.currentStock || 0), 0);
  }, [products]);

  const totalStockValue = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.currentStock || 0) * (p.purchasePrice || 0), 0);
  }, [products]);

  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.currentStock > 0 && p.currentStock <= p.reorderLevel);
  }, [products]);

  const outOfStockProducts = useMemo(() => {
    return products.filter((p) => p.currentStock <= 0);
  }, [products]);

  const pendingPurchaseOrdersCount = useMemo(() => {
    return purchaseOrders.filter((po) => po.status === 'Sent' || po.status === 'Approved' || po.status === 'Partially Received').length;
  }, [purchaseOrders]);

  // 4. Core Stock Transaction Engine
  const createStockTransaction = useCallback(
    async (params: CreateTransactionParams): Promise<StockTransaction> => {
      const {
        type,
        productId,
        quantity,
        direction,
        storeId,
        sourceStoreId,
        destinationStoreId,
        referenceType = 'manual',
        referenceNumber,
        remarks,
        unitPrice,
      } = params;

      if (quantity <= 0) {
        throw new Error('Stock transaction quantity must be greater than zero.');
      }

      // Initial fast local validation
      const localProduct = products.find((p) => p.id === productId);
      if (!localProduct) {
        throw new Error(`Product with ID "${productId}" not found.`);
      }

      const activeStoreId = storeId || (direction === 'out' ? sourceStoreId : destinationStoreId) || stores[0]?.id;
      const activeStore = stores.find((s) => s.id === activeStoreId) || stores[0];

      // Deterministic Idempotency Key:
      // If referenceType and referenceNumber are provided (e.g., invoices, GRNs, transfers),
      // identical retry attempts (from n8n webhooks or rapid double-clicks) resolve to the same transaction key.
      const isIdempotentOperation = Boolean(referenceType && referenceType !== 'manual' && referenceNumber);
      const safeRefNum = referenceNumber ? referenceNumber.replace(/[^a-zA-Z0-9_-]/g, '_') : '';
      const txnId = isIdempotentOperation
        ? `txn_${referenceType}_${safeRefNum}_${productId}_${direction}`
        : `txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      let committedTxn: StockTransaction | null = null;
      let committedProduct: {
        newStock: number;
        newAvailable: number;
        storeStocks: Record<string, StoreStockLevel>;
      } | null = null;
      let isAlreadyProcessed = false;

      // Atomic execution via Firestore runTransaction
      try {
        await runTransaction(db, async (transaction) => {
          const txnRef = doc(db, 'stockTransactions', txnId);
          const productRef = doc(db, 'products', productId);

          // 1. Idempotency check inside transaction
          if (isIdempotentOperation) {
            const existingTxnSnap = await transaction.get(txnRef);
            if (existingTxnSnap.exists()) {
              // Exact transaction already committed. Return existing without re-mutating stock.
              committedTxn = existingTxnSnap.data() as StockTransaction;
              isAlreadyProcessed = true;
              return;
            }
          }

          // 2. Read latest product state INSIDE the transaction (optimistic concurrency lock)
          const productSnap = await transaction.get(productRef);
          let targetProduct: Product = localProduct;
          if (productSnap.exists()) {
            targetProduct = productSnap.data() as Product;
          }

          const currentPhysical = targetProduct.currentStock || 0;
          const currentReserved = targetProduct.reservedStock || 0;

          // 3. Strict negative stock constraint at global level
          if (direction === 'out' && currentPhysical < quantity) {
            throw new Error(
              `Insufficient physical stock for ${targetProduct.name} (${targetProduct.sku}). Available: ${currentPhysical} ${targetProduct.unit}, requested deduction: ${quantity} ${targetProduct.unit}.`
            );
          }

          // 4. Strict negative stock constraint at store level
          if (direction === 'out' && activeStoreId) {
            const storeQty = targetProduct.storeStocks?.[activeStoreId]?.physicalStock || 0;
            if (storeQty < quantity) {
              throw new Error(
                `Insufficient stock at warehouse "${activeStore?.name || activeStoreId}". Available at this location: ${storeQty} ${targetProduct.unit}, requested deduction: ${quantity} ${targetProduct.unit}.`
              );
            }
          }

          // 5. Compute fresh balances
          const previousStock = currentPhysical;
          let newStock = direction === 'in' ? previousStock + quantity : previousStock - quantity;

          // 6. Compute updated storeStocks
          const updatedStoreStocks: Record<string, StoreStockLevel> = { ...(targetProduct.storeStocks || {}) };
          if (activeStoreId) {
            const currentStoreLevel = updatedStoreStocks[activeStoreId] || {
              physicalStock: 0,
              reservedStock: 0,
              availableStock: 0,
            };
            const updatedStorePhysical =
              direction === 'in'
                ? (currentStoreLevel.physicalStock || 0) + quantity
                : Math.max(0, (currentStoreLevel.physicalStock || 0) - quantity);
            const storeReserved = currentStoreLevel.reservedStock || 0;
            updatedStoreStocks[activeStoreId] = {
              ...currentStoreLevel,
              physicalStock: updatedStorePhysical,
              reservedStock: storeReserved,
              availableStock: Math.max(0, updatedStorePhysical - storeReserved),
            };
          }

          // 7. Enforce multi-store integrity invariant: SUM(storeStocks[*].physicalStock) === products.currentStock
          if (Object.keys(updatedStoreStocks).length > 0) {
            let totalStorePhysical = 0;
            for (const sId of Object.keys(updatedStoreStocks)) {
              totalStorePhysical += (updatedStoreStocks[sId]?.physicalStock || 0);
            }
            newStock = totalStorePhysical;
          }

          const newAvailable = Math.max(0, newStock - currentReserved);
          const price = unitPrice !== undefined ? unitPrice : targetProduct.purchasePrice;
          const totalValue = price * quantity;
          const txnNumber = `TXN-${Date.now().toString().slice(-6)}`;

          // 8. Generate immutable ledger entry
          const newTxn: StockTransaction = {
            id: txnId,
            organizationId: currentOrg.id,
            transactionNumber: txnNumber,
            type,
            productId: targetProduct.id,
            productName: targetProduct.name,
            sku: targetProduct.sku,
            quantity,
            direction,
            unit: targetProduct.unit,
            unitPrice: price,
            totalValue,
            sourceStoreId: direction === 'out' ? activeStore?.id : sourceStoreId,
            sourceStoreName: direction === 'out' ? activeStore?.name : undefined,
            destinationStoreId: direction === 'in' ? activeStore?.id : destinationStoreId,
            destinationStoreName: direction === 'in' ? activeStore?.name : undefined,
            referenceType,
            referenceNumber: referenceNumber || txnNumber,
            userId: currentUser?.uid || 'user_admin',
            userName: currentUser?.displayName || 'Administrator',
            remarks: remarks || '',
            previousStock,
            newStock,
            timestamp: new Date().toISOString(),
          };

          // 9. Atomic write to both product and immutable stockTransactions ledger
          transaction.set(txnRef, newTxn);
          transaction.set(
            productRef,
            {
              currentStock: newStock,
              reservedStock: currentReserved,
              availableStock: newAvailable,
              storeStocks: updatedStoreStocks,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );

          committedTxn = newTxn;
          committedProduct = {
            newStock,
            newAvailable,
            storeStocks: updatedStoreStocks,
          };
        });
      } catch (fsErr) {
        // If the error was thrown due to insufficient stock, rethrow immediately to the caller
        if (fsErr instanceof Error && fsErr.message.includes('Insufficient')) {
          throw fsErr;
        }
        console.warn('Firestore runTransaction notice:', fsErr);
      }

      // If this transaction was already processed idempotently, return existing record
      if (isAlreadyProcessed && committedTxn) {
        return committedTxn;
      }

      // If transaction succeeded and was newly committed
      if (committedTxn && committedProduct) {
        const finalTxn: StockTransaction = committedTxn;
        const finalProduct = committedProduct;

        // Synchronize local state
        setProducts((prev) =>
          prev.map((p) => {
            if (p.id !== productId) return p;
            return {
              ...p,
              currentStock: finalProduct.newStock,
              availableStock: finalProduct.newAvailable,
              storeStocks: finalProduct.storeStocks,
              updatedAt: new Date().toISOString(),
            };
          })
        );

        setStockTransactions((prev) => [finalTxn, ...prev.filter((t) => t.id !== finalTxn.id)]);

        // Audit Trail
        logActivity(
          'status_change',
          'products',
          localProduct.id,
          localProduct.name,
          `${finalTxn.previousStock} ${localProduct.unit}`,
          `${finalTxn.newStock} ${localProduct.unit} (${direction === 'in' ? '+' : '-'}${quantity})`
        );

        // Webhook Alerts: Out of Stock or Low Stock
        if (finalProduct.newStock <= 0) {
          dispatchWebhookEvent('out_of_stock_alert', {
            productId: localProduct.id,
            sku: localProduct.sku,
            productName: localProduct.name,
            currentStock: 0,
            unit: localProduct.unit,
            reorderLevel: localProduct.reorderLevel,
            minStockLevel: localProduct.minStockLevel,
            storeName: activeStore?.name || 'Central Warehouse',
            supplierName: localProduct.supplierName || 'Preferred Supplier',
            suggestedReorderQty: localProduct.maxStockLevel - 0,
          });
        } else if (finalProduct.newStock <= localProduct.reorderLevel) {
          dispatchWebhookEvent('low_stock_alert', {
            productId: localProduct.id,
            sku: localProduct.sku,
            productName: localProduct.name,
            currentStock: finalProduct.newStock,
            unit: localProduct.unit,
            reorderLevel: localProduct.reorderLevel,
            minStockLevel: localProduct.minStockLevel,
            storeName: activeStore?.name || 'Central Warehouse',
            supplierName: localProduct.supplierName || 'Preferred Supplier',
            suggestedReorderQty: Math.max(localProduct.reorderLevel * 2, localProduct.maxStockLevel - finalProduct.newStock),
          });
        }

        return finalTxn;
      }

      // Offline / Local-only Fallback if Firestore was unavailable
      const fallbackPrev = localProduct.currentStock;
      const fallbackNew = direction === 'in' ? fallbackPrev + quantity : fallbackPrev - quantity;
      const fallbackAvail = Math.max(0, fallbackNew - (localProduct.reservedStock || 0));

      const fallbackStoreStocks = { ...(localProduct.storeStocks || {}) };
      if (activeStoreId) {
        const cur = fallbackStoreStocks[activeStoreId] || { physicalStock: 0, reservedStock: 0, availableStock: 0 };
        const newPhys = direction === 'in' ? cur.physicalStock + quantity : Math.max(0, cur.physicalStock - quantity);
        fallbackStoreStocks[activeStoreId] = {
          ...cur,
          physicalStock: newPhys,
          availableStock: Math.max(0, newPhys - (cur.reservedStock || 0)),
        };
      }

      const fallbackTxn: StockTransaction = {
        id: txnId,
        organizationId: currentOrg.id,
        transactionNumber: `TXN-${Date.now().toString().slice(-6)}`,
        type,
        productId: localProduct.id,
        productName: localProduct.name,
        sku: localProduct.sku,
        quantity,
        direction,
        unit: localProduct.unit,
        unitPrice: unitPrice !== undefined ? unitPrice : localProduct.purchasePrice,
        totalValue: (unitPrice !== undefined ? unitPrice : localProduct.purchasePrice) * quantity,
        sourceStoreId: direction === 'out' ? activeStore?.id : sourceStoreId,
        sourceStoreName: direction === 'out' ? activeStore?.name : undefined,
        destinationStoreId: direction === 'in' ? activeStore?.id : destinationStoreId,
        destinationStoreName: direction === 'in' ? activeStore?.name : undefined,
        referenceType,
        referenceNumber: referenceNumber || txnId,
        userId: currentUser?.uid || 'user_admin',
        userName: currentUser?.displayName || 'Administrator',
        remarks: remarks || '',
        previousStock: fallbackPrev,
        newStock: fallbackNew,
        timestamp: new Date().toISOString(),
      };

      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                currentStock: fallbackNew,
                availableStock: fallbackAvail,
                storeStocks: fallbackStoreStocks,
                updatedAt: new Date().toISOString(),
              }
            : p
        )
      );
      setStockTransactions((prev) => [fallbackTxn, ...prev]);
      return fallbackTxn;
    },
    [products, stores, currentOrg.id, currentUser, logActivity, dispatchWebhookEvent]
  );

  // 5. Product Management
  const addProduct = useCallback(
    async (
      productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'organizationId' | 'currentStock' | 'reservedStock' | 'availableStock'> & {
        openingStock?: number;
        initialStoreId?: string;
      }
    ): Promise<Product> => {
      const opening = Number(productData.openingStock || 0);
      const storeId = productData.initialStoreId || stores[0]?.id || 'store_01';
      const store = stores.find((s) => s.id === storeId) || stores[0];

      const initialStoreStocks: Record<string, any> = {};
      if (storeId) {
        initialStoreStocks[storeId] = {
          physicalStock: opening,
          reservedStock: 0,
          availableStock: opening,
          storageLocation: productData.storageLocation || 'Main Bay',
        };
      }

      const newProduct: Product = {
        ...productData,
        id: `prod_${Date.now()}`,
        organizationId: currentOrg.id,
        currentStock: opening,
        reservedStock: 0,
        availableStock: opening,
        openingStock: opening,
        storeStocks: initialStoreStocks,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setProducts((prev) => [newProduct, ...prev]);

      // If opening stock is greater than 0, create audit transaction
      if (opening > 0) {
        const openingTxn: StockTransaction = {
          id: `txn_${Date.now()}_opn`,
          organizationId: currentOrg.id,
          transactionNumber: `TXN-${Date.now().toString().slice(-6)}`,
          type: 'Opening Stock',
          productId: newProduct.id,
          productName: newProduct.name,
          sku: newProduct.sku,
          quantity: opening,
          direction: 'in',
          unit: newProduct.unit,
          unitPrice: newProduct.purchasePrice,
          totalValue: opening * newProduct.purchasePrice,
          destinationStoreId: store?.id,
          destinationStoreName: store?.name,
          referenceType: 'manual',
          referenceNumber: `OPN-${newProduct.sku}`,
          userId: currentUser?.uid || 'user_admin',
          userName: currentUser?.displayName || 'Administrator',
          remarks: 'Initial opening stock recorded at item creation',
          previousStock: 0,
          newStock: opening,
          timestamp: new Date().toISOString(),
        };
        setStockTransactions((prev) => [openingTxn, ...prev]);
        try {
          await setDoc(doc(db, 'stockTransactions', openingTxn.id), openingTxn);
        } catch (fsErr) {
          console.warn('Firestore transaction write note:', fsErr);
        }
      }

      try {
        await setDoc(doc(db, 'products', newProduct.id), newProduct);
      } catch (fsErr) {
        console.warn('Firestore product write note:', fsErr);
      }

      logActivity('create', 'products', newProduct.id, newProduct.name, undefined, `Created SKU: ${newProduct.sku}`);

      return newProduct;
    },
    [currentOrg.id, currentUser, stores, logActivity]
  );

  const updateProduct = useCallback(
    async (id: string, updates: Partial<Product>) => {
      const target = products.find((p) => p.id === id);
      if (!target) return;

      // Note: Direct stock modification is blocked; stock must go through createStockTransaction
      const sanitizedUpdates = { ...updates };
      delete (sanitizedUpdates as any).currentStock;
      delete (sanitizedUpdates as any).availableStock;

      const updatedDoc = { ...sanitizedUpdates, updatedAt: new Date().toISOString() };

      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updatedDoc } : p))
      );

      try {
        await setDoc(doc(db, 'products', id), updatedDoc, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore update note:', fsErr);
      }

      logActivity('update', 'products', id, target.name, undefined, 'Updated product master specifications');
    },
    [products, logActivity]
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      const target = products.find((p) => p.id === id);
      if (!target) return;
      if (target.currentStock > 0) {
        throw new Error(`Cannot delete product with existing stock (${target.currentStock} ${target.unit}). Please adjust stock to zero first.`);
      }

      setProducts((prev) => prev.filter((p) => p.id !== id));

      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (fsErr) {
        console.warn('Firestore delete note:', fsErr);
      }

      logActivity('delete', 'products', id, target.name, undefined, `Removed SKU: ${target.sku}`);
    },
    [products, logActivity]
  );

  const bulkImportProducts = useCallback(
    async (importedList: Partial<Product>[]): Promise<number> => {
      let count = 0;
      const defaultStore = stores[0];

      const newProductsToAdd: Product[] = [];
      const newTransactionsToAdd: StockTransaction[] = [];

      importedList.forEach((item) => {
        if (!item.name || !item.sku) return;
        const opening = Number(item.openingStock || item.currentStock || 0);
        const prodId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        const productObj: Product = {
          id: prodId,
          organizationId: currentOrg.id,
          sku: item.sku.toUpperCase(),
          name: item.name,
          category: item.category || 'General Components',
          subcategory: item.subcategory || 'General',
          brand: item.brand || 'Generic',
          description: item.description || item.name,
          unit: (item.unit as any) || 'PCS',
          barcode: item.barcode || `890${Date.now().toString().slice(-10)}`,
          hsnCode: item.hsnCode || '85000000',
          gstRate: Number(item.gstRate || 18),
          purchasePrice: Number(item.purchasePrice || 0),
          sellingPrice: Number(item.sellingPrice || 0),
          minStockLevel: Number(item.minStockLevel || 5),
          maxStockLevel: Number(item.maxStockLevel || 100),
          reorderLevel: Number(item.reorderLevel || 10),
          openingStock: opening,
          currentStock: opening,
          reservedStock: 0,
          availableStock: opening,
          supplierName: item.supplierName || (suppliers[0] ? suppliers[0].name : 'Default Supplier'),
          storageLocation: item.storageLocation || 'Main Aisle',
          storeStocks: defaultStore
            ? {
                [defaultStore.id]: {
                  physicalStock: opening,
                  reservedStock: 0,
                  availableStock: opening,
                  storageLocation: item.storageLocation || 'Main Aisle',
                },
              }
            : {},
          status: 'Active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        newProductsToAdd.push(productObj);

        if (opening > 0) {
          newTransactionsToAdd.push({
            id: `txn_${Date.now()}_imp_${count}`,
            organizationId: currentOrg.id,
            transactionNumber: `TXN-IMP-${Date.now().toString().slice(-4)}${count}`,
            type: 'Opening Stock',
            productId: prodId,
            productName: productObj.name,
            sku: productObj.sku,
            quantity: opening,
            direction: 'in',
            unit: productObj.unit,
            unitPrice: productObj.purchasePrice,
            totalValue: opening * productObj.purchasePrice,
            destinationStoreId: defaultStore?.id,
            destinationStoreName: defaultStore?.name,
            referenceType: 'manual',
            referenceNumber: `CSV-IMPORT-${new Date().toISOString().split('T')[0]}`,
            userId: currentUser?.uid || 'user_admin',
            userName: currentUser?.displayName || 'Administrator',
            remarks: 'Bulk CSV opening inventory balance import',
            previousStock: 0,
            newStock: opening,
            timestamp: new Date().toISOString(),
          });
        }

        count++;
      });

      if (newProductsToAdd.length > 0) {
        setProducts((prev) => [...newProductsToAdd, ...prev]);
        if (newTransactionsToAdd.length > 0) {
          setStockTransactions((prev) => [...newTransactionsToAdd, ...prev]);
        }
        logActivity('import', 'products', 'bulk', `Imported ${count} products via CSV`, undefined, `${count} items added to catalog`);
      }

      return count;
    },
    [currentOrg.id, currentUser, stores, suppliers, logActivity]
  );

  // 6. Category, Store, Supplier
  const addCategory = useCallback(
    async (catData: Omit<ProductCategory, 'id' | 'organizationId'>): Promise<ProductCategory> => {
      const newCat: ProductCategory = {
        ...catData,
        id: `cat_${Date.now()}`,
        organizationId: currentOrg.id,
        productCount: 0,
      };
      setCategories((prev) => [newCat, ...prev]);
      try {
        await setDoc(doc(db, 'categories', newCat.id), newCat);
      } catch (fsErr) {
        console.warn('Firestore category write note:', fsErr);
      }
      logActivity('create', 'products', newCat.id, newCat.name, undefined, 'Added new product category');
      return newCat;
    },
    [currentOrg.id, logActivity]
  );

  const addStore = useCallback(
    async (storeData: Omit<WarehouseStore, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>): Promise<WarehouseStore> => {
      const newStore: WarehouseStore = {
        ...storeData,
        id: `store_${Date.now()}`,
        organizationId: currentOrg.id,
        totalStockQty: 0,
        totalStockValue: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setStores((prev) => [newStore, ...prev]);
      try {
        await setDoc(doc(db, 'stores', newStore.id), newStore);
      } catch (fsErr) {
        console.warn('Firestore store write note:', fsErr);
      }
      logActivity('create', 'stores', newStore.id, newStore.name, undefined, `Registered Warehouse Store: ${newStore.storeCode}`);
      return newStore;
    },
    [currentOrg.id, logActivity]
  );

  const updateStore = useCallback(
    async (id: string, updates: Partial<WarehouseStore>) => {
      const target = stores.find((s) => s.id === id);
      if (!target) return;
      const updated = { ...updates, updatedAt: new Date().toISOString() };
      setStores((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
      try {
        await setDoc(doc(db, 'stores', id), updated, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore store update note:', fsErr);
      }
      logActivity('update', 'stores', id, target.name, undefined, 'Updated warehouse store details');
    },
    [stores, logActivity]
  );

  const addSupplier = useCallback(
    async (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>): Promise<Supplier> => {
      const newSup: Supplier = {
        ...supplierData,
        id: `sup_${Date.now()}`,
        organizationId: currentOrg.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSuppliers((prev) => [newSup, ...prev]);
      try {
        await setDoc(doc(db, 'suppliers', newSup.id), newSup);
      } catch (fsErr) {
        console.warn('Firestore supplier write note:', fsErr);
      }
      logActivity('create', 'suppliers', newSup.id, newSup.name, undefined, `Added Supplier: ${newSup.supplierCode}`);
      return newSup;
    },
    [currentOrg.id, logActivity]
  );

  const updateSupplier = useCallback(
    async (id: string, updates: Partial<Supplier>) => {
      const target = suppliers.find((s) => s.id === id);
      if (!target) return;
      const updated = { ...updates, updatedAt: new Date().toISOString() };
      setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
      try {
        await setDoc(doc(db, 'suppliers', id), updated, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore supplier update note:', fsErr);
      }
      logActivity('update', 'suppliers', id, target.name, undefined, 'Updated supplier vendor profile');
    },
    [suppliers, logActivity]
  );

  // 7. Purchase Order Management
  const createPurchaseOrder = useCallback(
    async (
      poData: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'organizationId' | 'createdById' | 'createdByName'>
    ): Promise<PurchaseOrder> => {
      const newPo: PurchaseOrder = {
        ...poData,
        id: `po_${Date.now()}`,
        organizationId: currentOrg.id,
        createdById: currentUser?.uid || 'user_admin',
        createdByName: currentUser?.displayName || 'Administrator',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setPurchaseOrders((prev) => [newPo, ...prev]);
      logActivity('create', 'inventory', newPo.id, newPo.poNumber, undefined, `Created PO for ${newPo.supplierName} (₹${newPo.grandTotal.toLocaleString('en-IN')})`);

      dispatchWebhookEvent('purchase_order_created', {
        poId: newPo.id,
        poNumber: newPo.poNumber,
        supplierName: newPo.supplierName,
        supplierEmail: newPo.supplierEmail,
        supplierPhone: newPo.supplierPhone,
        destinationStoreName: newPo.destinationStoreName,
        expectedDeliveryDate: newPo.expectedDeliveryDate,
        grandTotal: newPo.grandTotal,
        itemsCount: newPo.items.length,
        items: newPo.items,
      });

      return newPo;
    },
    [currentOrg.id, currentUser, logActivity, dispatchWebhookEvent]
  );

  const updatePurchaseOrder = useCallback(
    async (id: string, updates: Partial<PurchaseOrder>) => {
      const target = purchaseOrders.find((po) => po.id === id);
      if (!target) return;
      setPurchaseOrders((prev) => prev.map((po) => (po.id === id ? { ...po, ...updates, updatedAt: new Date().toISOString() } : po)));
      logActivity('update', 'inventory', id, target.poNumber, target.status, updates.status || 'Updated PO');
    },
    [purchaseOrders, logActivity]
  );

  // 8. Goods Receipt Note (GRN) - Adds stock via transaction
  const createGoodsReceipt = useCallback(
    async (
      grnData: Omit<GoodsReceipt, 'id' | 'createdAt' | 'organizationId' | 'receivedById' | 'receivedByName'>
    ): Promise<GoodsReceipt> => {
      const newGrn: GoodsReceipt = {
        ...grnData,
        id: `grn_${Date.now()}`,
        organizationId: currentOrg.id,
        receivedById: currentUser?.uid || 'user_admin',
        receivedByName: currentUser?.displayName || 'Administrator',
        createdAt: new Date().toISOString(),
      };

      // For every accepted item, process an automatic Stock Transaction (direction: 'in', type: 'Purchase')
      for (const item of newGrn.items) {
        if (item.acceptedQty > 0) {
          await createStockTransaction({
            type: 'Purchase',
            productId: item.productId,
            quantity: item.acceptedQty,
            direction: 'in',
            storeId: newGrn.storeId,
            referenceType: 'goods_receipt',
            referenceNumber: newGrn.grnNumber,
            remarks: `Received against ${newGrn.poNumber || 'PO'} (Supplier: ${newGrn.supplierName})`,
            unitPrice: item.unitPrice,
          });
        }
      }

      // If linked to PO, update received quantities
      if (newGrn.poId) {
        setPurchaseOrders((prev) =>
          prev.map((po) => {
            if (po.id !== newGrn.poId) return po;

            const updatedItems = po.items.map((poItem) => {
              const matchedGrnItem = newGrn.items.find((gi) => gi.productId === poItem.productId);
              if (matchedGrnItem) {
                const newRecQty = poItem.receivedQty + matchedGrnItem.acceptedQty;
                return { ...poItem, receivedQty: newRecQty };
              }
              return poItem;
            });

            const allComplete = updatedItems.every((item) => item.receivedQty >= item.orderedQty);
            const partiallyComplete = updatedItems.some((item) => item.receivedQty > 0);
            const newStatus = allComplete ? 'Received' : partiallyComplete ? 'Partially Received' : po.status;

            return {
              ...po,
              items: updatedItems,
              status: newStatus,
              updatedAt: new Date().toISOString(),
            };
          })
        );
      }

      setGoodsReceipts((prev) => [newGrn, ...prev]);
      try {
        await setDoc(doc(db, 'goodsReceipts', newGrn.id), newGrn);
      } catch (fsErr) {
        console.warn('Firestore GRN write notice:', fsErr);
      }
      logActivity('create', 'inventory', newGrn.id, newGrn.grnNumber, undefined, `Processed GRN: Stock added to ${newGrn.storeName}`);

      dispatchWebhookEvent('goods_received', {
        grnId: newGrn.id,
        grnNumber: newGrn.grnNumber,
        poNumber: newGrn.poNumber || 'Manual Receipt',
        supplierName: newGrn.supplierName,
        storeName: newGrn.storeName,
        itemsCount: newGrn.items.length,
        items: newGrn.items,
      });

      return newGrn;
    },
    [currentOrg.id, currentUser, createStockTransaction, logActivity, dispatchWebhookEvent]
  );

  // 9. Stock Transfer Workflow
  const createStockTransfer = useCallback(
    async (
      transferData: Omit<StockTransfer, 'id' | 'createdAt' | 'updatedAt' | 'organizationId' | 'initiatedById' | 'initiatedByName' | 'status'>
    ): Promise<StockTransfer> => {
      // Validate that source warehouse has sufficient available stock
      for (const item of transferData.items) {
        const prod = products.find((p) => p.id === item.productId);
        if (!prod) continue;
        const sourceStoreLevel = prod.storeStocks?.[transferData.sourceStoreId]?.physicalStock || 0;
        if (sourceStoreLevel < item.quantity) {
          throw new Error(
            `Cannot initiate transfer: Origin store "${transferData.sourceStoreName}" only has ${sourceStoreLevel} ${item.unit} of ${item.productName}, but requested transfer is ${item.quantity} ${item.unit}.`
          );
        }
      }

      const newTransfer: StockTransfer = {
        ...transferData,
        id: `trf_${Date.now()}`,
        organizationId: currentOrg.id,
        status: 'Pending',
        initiatedById: currentUser?.uid || 'user_admin',
        initiatedByName: currentUser?.displayName || 'Administrator',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setStockTransfers((prev) => [newTransfer, ...prev]);
      try {
        await setDoc(doc(db, 'stockTransfers', newTransfer.id), newTransfer);
      } catch (fsErr) {
        console.warn('Firestore stock transfer write notice:', fsErr);
      }
      logActivity('create', 'inventory', newTransfer.id, newTransfer.transferNumber, undefined, `Initiated transfer from ${newTransfer.sourceStoreName} to ${newTransfer.destinationStoreName}`);

      dispatchWebhookEvent('stock_transfer_created', {
        transferId: newTransfer.id,
        transferNumber: newTransfer.transferNumber,
        sourceStoreName: newTransfer.sourceStoreName,
        destinationStoreName: newTransfer.destinationStoreName,
        itemsCount: newTransfer.items.length,
        initiatedByName: newTransfer.initiatedByName,
      });

      return newTransfer;
    },
    [currentOrg.id, currentUser, products, logActivity, dispatchWebhookEvent]
  );

  const approveStockTransfer = useCallback(
    async (id: string) => {
      const transfer = stockTransfers.find((t) => t.id === id);
      if (!transfer || transfer.status !== 'Pending') return;

      // Deduct from source store with direction: 'out'
      for (const item of transfer.items) {
        await createStockTransaction({
          type: 'Stock Transfer',
          productId: item.productId,
          quantity: item.quantity,
          direction: 'out',
          storeId: transfer.sourceStoreId,
          destinationStoreId: transfer.destinationStoreId,
          referenceType: 'stock_transfer',
          referenceNumber: transfer.transferNumber,
          remarks: `Transfer dispatch to ${transfer.destinationStoreName}`,
        });
      }

      const transferUpdates = {
        status: 'In Transit' as StockTransferStatus,
        approvedById: currentUser?.uid || 'user_admin',
        approvedByName: currentUser?.displayName || 'Administrator',
        updatedAt: new Date().toISOString(),
      };

      setStockTransfers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...transferUpdates } : t))
      );
      try {
        await updateDoc(doc(db, 'stockTransfers', id), transferUpdates);
      } catch (fsErr) {
        console.warn('Firestore stock transfer update notice:', fsErr);
      }

      logActivity('status_change', 'inventory', id, transfer.transferNumber, 'Pending', 'In Transit');

      dispatchWebhookEvent('stock_transfer_approved', {
        transferId: transfer.id,
        transferNumber: transfer.transferNumber,
        sourceStoreName: transfer.sourceStoreName,
        destinationStoreName: transfer.destinationStoreName,
        approvedByName: currentUser?.displayName || 'Administrator',
      });
    },
    [stockTransfers, currentUser, createStockTransaction, logActivity, dispatchWebhookEvent]
  );

  const receiveStockTransfer = useCallback(
    async (id: string) => {
      const transfer = stockTransfers.find((t) => t.id === id);
      if (!transfer || (transfer.status !== 'In Transit' && transfer.status !== 'Approved')) return;

      // Add to destination store with direction: 'in'
      for (const item of transfer.items) {
        await createStockTransaction({
          type: 'Stock Transfer',
          productId: item.productId,
          quantity: item.quantity,
          direction: 'in',
          storeId: transfer.destinationStoreId,
          sourceStoreId: transfer.sourceStoreId,
          referenceType: 'stock_transfer',
          referenceNumber: transfer.transferNumber,
          remarks: `Transfer received from ${transfer.sourceStoreName}`,
        });
      }

      const transferUpdates = {
        status: 'Received' as StockTransferStatus,
        receivedById: currentUser?.uid || 'user_admin',
        receivedByName: currentUser?.displayName || 'Administrator',
        updatedAt: new Date().toISOString(),
      };

      setStockTransfers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...transferUpdates } : t))
      );
      try {
        await updateDoc(doc(db, 'stockTransfers', id), transferUpdates);
      } catch (fsErr) {
        console.warn('Firestore stock transfer receipt notice:', fsErr);
      }

      logActivity('status_change', 'inventory', id, transfer.transferNumber, 'In Transit', 'Received');
    },
    [stockTransfers, currentUser, createStockTransaction, logActivity]
  );

  const cancelStockTransfer = useCallback(
    async (id: string, reason?: string) => {
      const transfer = stockTransfers.find((t) => t.id === id);
      if (!transfer || transfer.status === 'Cancelled' || transfer.status === 'Received') return;

      // If already deducted (In Transit or Approved), reverse the deduction by restocking source store
      if (transfer.status === 'In Transit' || transfer.status === 'Approved') {
        for (const item of transfer.items) {
          await createStockTransaction({
            type: 'Stock Transfer',
            productId: item.productId,
            quantity: item.quantity,
            direction: 'in',
            storeId: transfer.sourceStoreId,
            referenceType: 'stock_transfer',
            referenceNumber: transfer.transferNumber,
            remarks: `Transfer cancelled - Restocked back into ${transfer.sourceStoreName}. Reason: ${reason || 'Cancelled by operator'}`,
          });
        }
      }

      const cancelUpdates = {
        status: 'Cancelled' as StockTransferStatus,
        remarks: reason ? `${transfer.remarks || ''} [Cancelled: ${reason}]`.trim() : transfer.remarks,
        updatedAt: new Date().toISOString(),
      };

      setStockTransfers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...cancelUpdates } : t))
      );
      try {
        await updateDoc(doc(db, 'stockTransfers', id), cancelUpdates);
      } catch (fsErr) {
        console.warn('Firestore stock transfer cancel notice:', fsErr);
      }

      logActivity('status_change', 'inventory', id, transfer.transferNumber, transfer.status, 'Cancelled');

      dispatchWebhookEvent('stock_transfer_cancelled', {
        transferId: transfer.id,
        transferNumber: transfer.transferNumber,
        sourceStoreName: transfer.sourceStoreName,
        destinationStoreName: transfer.destinationStoreName,
        reason: reason || 'Transfer cancelled by user',
      });
    },
    [stockTransfers, createStockTransaction, logActivity, dispatchWebhookEvent]
  );

  // 10. Stock Reservation (For Quotes & Invoices)
  const createStockReservation = useCallback(
    async (
      resData: Omit<StockReservation, 'id' | 'createdAt' | 'updatedAt' | 'organizationId' | 'createdById' | 'createdByName' | 'status'>
    ): Promise<StockReservation> => {
      // Validate available stock
      for (const item of resData.items) {
        const prod = products.find((p) => p.id === item.productId);
        if (!prod) continue;
        if (prod.availableStock < item.reservedQty) {
          throw new Error(
            `Cannot reserve: ${prod.name} has only ${prod.availableStock} ${prod.unit} unreserved available (Requested: ${item.reservedQty} ${prod.unit}).`
          );
        }
      }

      const newReservation: StockReservation = {
        ...resData,
        id: `res_${Date.now()}`,
        organizationId: currentOrg.id,
        status: 'Active',
        createdById: currentUser?.uid || 'user_admin',
        createdByName: currentUser?.displayName || 'Administrator',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Update reserved and available stocks in product state & Firestore
      for (const item of resData.items) {
        const matched = products.find((p) => p.id === item.productId);
        if (matched) {
          const newReserved = (matched.reservedStock || 0) + item.reservedQty;
          const newAvail = Math.max(0, matched.currentStock - newReserved);
          try {
            await updateDoc(doc(db, 'products', matched.id), {
              reservedStock: newReserved,
              availableStock: newAvail,
              updatedAt: new Date().toISOString(),
            });
          } catch (fsErr) {
            console.warn('Firestore reservation product update notice:', fsErr);
          }
        }
      }

      setProducts((prev) =>
        prev.map((p) => {
          const matchedItem = resData.items.find((i) => i.productId === p.id);
          if (!matchedItem) return p;
          const newReserved = (p.reservedStock || 0) + matchedItem.reservedQty;
          const newAvail = Math.max(0, p.currentStock - newReserved);
          return {
            ...p,
            reservedStock: newReserved,
            availableStock: newAvail,
          };
        })
      );

      setStockReservations((prev) => [newReservation, ...prev]);
      try {
        await setDoc(doc(db, 'stockReservations', newReservation.id), newReservation);
      } catch (fsErr) {
        console.warn('Firestore stock reservation write notice:', fsErr);
      }

      logActivity('create', 'inventory', newReservation.id, newReservation.reservationNumber, undefined, `Reserved stock against ${newReservation.referenceNumber} for ${newReservation.customerName}`);

      dispatchWebhookEvent('stock_reserved', {
        reservationId: newReservation.id,
        reservationNumber: newReservation.reservationNumber,
        customerName: newReservation.customerName,
        referenceNumber: newReservation.referenceNumber,
        itemsCount: newReservation.items.length,
        items: newReservation.items,
      });

      return newReservation;
    },
    [currentOrg.id, currentUser, products, logActivity, dispatchWebhookEvent]
  );

  const releaseStockReservation = useCallback(
    async (id: string) => {
      const target = stockReservations.find((r) => r.id === id);
      if (!target || target.status !== 'Active') return;

      // Restore unreserved available balance in products
      for (const item of target.items) {
        const matched = products.find((p) => p.id === item.productId);
        if (matched) {
          const newReserved = Math.max(0, (matched.reservedStock || 0) - item.reservedQty);
          const newAvail = Math.max(0, matched.currentStock - newReserved);
          try {
            await updateDoc(doc(db, 'products', matched.id), {
              reservedStock: newReserved,
              availableStock: newAvail,
              updatedAt: new Date().toISOString(),
            });
          } catch (fsErr) {
            console.warn('Firestore product unreservation notice:', fsErr);
          }
        }
      }

      setProducts((prev) =>
        prev.map((p) => {
          const matchedItem = target.items.find((i) => i.productId === p.id);
          if (!matchedItem) return p;
          const newReserved = Math.max(0, (p.reservedStock || 0) - matchedItem.reservedQty);
          const newAvail = Math.max(0, p.currentStock - newReserved);
          return {
            ...p,
            reservedStock: newReserved,
            availableStock: newAvail,
          };
        })
      );

      const releaseUpdates = { status: 'Released' as const, updatedAt: new Date().toISOString() };
      setStockReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...releaseUpdates } : r))
      );
      try {
        await updateDoc(doc(db, 'stockReservations', id), releaseUpdates);
      } catch (fsErr) {
        console.warn('Firestore reservation release notice:', fsErr);
      }

      logActivity('status_change', 'inventory', id, target.reservationNumber, 'Active', 'Released');

      dispatchWebhookEvent('stock_released', {
        reservationId: target.id,
        reservationNumber: target.reservationNumber,
        customerName: target.customerName,
        referenceNumber: target.referenceNumber,
      });
    },
    [stockReservations, products, logActivity, dispatchWebhookEvent]
  );

  const fulfillStockReservation = useCallback(
    async (id: string) => {
      const target = stockReservations.find((r) => r.id === id);
      if (!target || target.status !== 'Active') return;

      // Release reserved quantity and deduct physical stock via 'Sale' transaction
      for (const item of target.items) {
        await createStockTransaction({
          type: 'Sale',
          productId: item.productId,
          quantity: item.reservedQty,
          direction: 'out',
          storeId: target.storeId,
          referenceType: target.referenceType === 'quotation' ? 'quotation' : 'invoice',
          referenceNumber: target.referenceNumber,
          remarks: `Fulfillment of stock reservation ${target.reservationNumber} for ${target.customerName}`,
        });
      }

      // Decrement reserved stock counter since it's now officially consumed
      for (const item of target.items) {
        const matched = products.find((p) => p.id === item.productId);
        if (matched) {
          const newReserved = Math.max(0, (matched.reservedStock || 0) - item.reservedQty);
          try {
            await updateDoc(doc(db, 'products', matched.id), {
              reservedStock: newReserved,
              availableStock: Math.max(0, matched.currentStock - newReserved),
              updatedAt: new Date().toISOString(),
            });
          } catch (fsErr) {
            console.warn('Firestore product fulfillment notice:', fsErr);
          }
        }
      }

      setProducts((prev) =>
        prev.map((p) => {
          const matchedItem = target.items.find((i) => i.productId === p.id);
          if (!matchedItem) return p;
          const newReserved = Math.max(0, (p.reservedStock || 0) - matchedItem.reservedQty);
          return {
            ...p,
            reservedStock: newReserved,
            availableStock: Math.max(0, p.currentStock - newReserved),
          };
        })
      );

      const fulfillUpdates = { status: 'Fulfilled' as const, updatedAt: new Date().toISOString() };
      setStockReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...fulfillUpdates } : r))
      );
      try {
        await updateDoc(doc(db, 'stockReservations', id), fulfillUpdates);
      } catch (fsErr) {
        console.warn('Firestore reservation fulfillment notice:', fsErr);
      }

      logActivity('status_change', 'inventory', id, target.reservationNumber, 'Active', 'Fulfilled');
    },
    [stockReservations, products, createStockTransaction, logActivity]
  );

  // 11. Stock Audit & Discrepancy Reconciliation
  const createStockAudit = useCallback(
    async (
      auditData: Omit<StockAudit, 'id' | 'createdAt' | 'organizationId' | 'auditorId' | 'auditorName' | 'status'>
    ): Promise<StockAudit> => {
      const newAudit: StockAudit = {
        ...auditData,
        id: `aud_${Date.now()}`,
        organizationId: currentOrg.id,
        status: 'Pending Approval',
        auditorId: currentUser?.uid || 'user_admin',
        auditorName: currentUser?.displayName || 'Administrator',
        createdAt: new Date().toISOString(),
      };

      setStockAudits((prev) => [newAudit, ...prev]);
      try {
        await setDoc(doc(db, 'stockAudits', newAudit.id), newAudit);
      } catch (fsErr) {
        console.warn('Firestore audit write notice:', fsErr);
      }
      logActivity('create', 'inventory', newAudit.id, newAudit.auditNumber, undefined, `Submitted physical stock audit for ${newAudit.storeName}`);

      return newAudit;
    },
    [currentOrg.id, currentUser, logActivity]
  );

  const approveStockAudit = useCallback(
    async (id: string) => {
      const audit = stockAudits.find((a) => a.id === id);
      if (!audit || audit.status !== 'Pending Approval') return;

      // Automatically adjust product inventory for any item with non-zero variance
      for (const item of audit.items) {
        if (item.variance !== 0) {
          const direction = item.variance > 0 ? 'in' : 'out';
          await createStockTransaction({
            type: 'Stock Adjustment',
            productId: item.productId,
            quantity: Math.abs(item.variance),
            direction,
            storeId: audit.storeId,
            referenceType: 'audit',
            referenceNumber: audit.auditNumber,
            remarks: `Audit adjustment: ${item.reason || 'Physical cycle count variance'} (System: ${item.systemQty}, Physical: ${item.physicalQty})`,
            unitPrice: item.unitCost,
          });
        }
      }

      const auditUpdates = {
        status: 'Approved & Adjusted' as StockAuditStatus,
        approvedById: currentUser?.uid || 'user_admin',
        approvedByName: currentUser?.displayName || 'Administrator',
        completedAt: new Date().toISOString(),
      };

      setStockAudits((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...auditUpdates } : a))
      );
      try {
        await updateDoc(doc(db, 'stockAudits', id), auditUpdates);
      } catch (fsErr) {
        console.warn('Firestore audit approval notice:', fsErr);
      }

      logActivity('status_change', 'inventory', id, audit.auditNumber, 'Pending Approval', 'Approved & Adjusted');

      dispatchWebhookEvent('stock_audit_completed', {
        auditId: audit.id,
        auditNumber: audit.auditNumber,
        storeName: audit.storeName,
        totalDiscrepancyValue: audit.totalDiscrepancyValue,
        approvedByName: currentUser?.displayName || 'Administrator',
        itemsCount: audit.items.length,
      });
    },
    [stockAudits, currentUser, createStockTransaction, logActivity, dispatchWebhookEvent]
  );

  // 12. Manual Stock Adjustment
  const createStockAdjustment = useCallback(
    async (
      adjData: Omit<StockAdjustment, 'id' | 'createdAt' | 'organizationId' | 'approvedById' | 'approvedByName' | 'status'>
    ): Promise<StockAdjustment> => {
      const newAdj: StockAdjustment = {
        ...adjData,
        id: `adj_${Date.now()}`,
        organizationId: currentOrg.id,
        status: 'Approved',
        approvedById: currentUser?.uid || 'user_admin',
        approvedByName: currentUser?.displayName || 'Administrator',
        createdAt: new Date().toISOString(),
      };

      for (const item of newAdj.items) {
        const direction = item.quantityChange > 0 ? 'in' : 'out';
        await createStockTransaction({
          type:
            newAdj.reason === 'Damaged Goods'
              ? 'Damaged Stock'
              : newAdj.reason === 'Expiry'
              ? 'Expired Stock'
              : 'Stock Adjustment',
          productId: item.productId,
          quantity: Math.abs(item.quantityChange),
          direction,
          storeId: newAdj.storeId,
          referenceType: 'manual',
          referenceNumber: newAdj.adjustmentNumber,
          remarks: `${newAdj.reason}: ${item.reason}`,
          unitPrice: item.unitCost,
        });
      }

      setStockAdjustments((prev) => [newAdj, ...prev]);
      try {
        await setDoc(doc(db, 'stockAdjustments', newAdj.id), newAdj);
      } catch (fsErr) {
        console.warn('Firestore adjustment write notice:', fsErr);
      }
      logActivity('create', 'inventory', newAdj.id, newAdj.adjustmentNumber, undefined, `Manual adjustment: ${newAdj.reason} at ${newAdj.storeName}`);

      dispatchWebhookEvent('stock_adjustment', {
        adjustmentId: newAdj.id,
        adjustmentNumber: newAdj.adjustmentNumber,
        storeName: newAdj.storeName,
        reason: newAdj.reason,
        approvedByName: newAdj.approvedByName,
      });

      return newAdj;
    },
    [currentOrg.id, currentUser, createStockTransaction, logActivity, dispatchWebhookEvent]
  );

  // 13. Cross-Module: Issue stock for Complaint / Service Ticket
  const issueStockForComplaint = useCallback(
    async (complaintId: string, productId: string, quantity: number, remarks?: string, storeId?: string) => {
      const complaint = complaints.find((c) => c.id === complaintId);
      const product = products.find((p) => p.id === productId);
      if (!product) throw new Error('Product not found');

      const ticketRef = complaint?.ticketNumber || complaintId;
      const targetStoreId = storeId || stores[stores.length - 1]?.id || stores[0]?.id; // Default to Service Spares store

      await createStockTransaction({
        type: 'Stock Issue',
        productId,
        quantity,
        direction: 'out',
        storeId: targetStoreId,
        referenceType: 'complaint',
        referenceNumber: ticketRef,
        remarks: remarks || `Issued spare part for service complaint ${ticketRef}`,
      });

      logActivity('update', 'complaints', complaintId, ticketRef, undefined, `Issued ${quantity} ${product.unit} of ${product.name}`);

      dispatchWebhookEvent('stock_issued_complaint', {
        complaintId,
        ticketNumber: ticketRef,
        customerName: complaint?.customerName || 'Service Client',
        contactNumber: complaint?.customerPhone || '+91 98201 94821',
        email: complaint?.customerEmail || 'client@example.com',
        productName: product.name,
        sku: product.sku,
        quantity,
        unit: product.unit,
        issuedBy: currentUser?.displayName || 'Service Engineer',
      });
    },
    [complaints, products, stores, createStockTransaction, logActivity, dispatchWebhookEvent, currentUser]
  );

  // 14. Cross-Module: Issue stock for Invoice
  const issueStockForInvoice = useCallback(
    async (invoiceId: string, productId: string, quantity: number, remarks?: string, storeId?: string) => {
      const inv = invoices.find((i) => i.id === invoiceId);
      const product = products.find((p) => p.id === productId);
      if (!product) throw new Error('Product not found');

      const invRef = inv?.invoiceNumber || invoiceId;
      const targetStoreId = storeId || stores[0]?.id;

      await createStockTransaction({
        type: 'Sale',
        productId,
        quantity,
        direction: 'out',
        storeId: targetStoreId,
        referenceType: 'invoice',
        referenceNumber: invRef,
        remarks: remarks || `Sold & issued against Invoice ${invRef}`,
      });

      logActivity('update', 'invoices', invoiceId, invRef, undefined, `Deducted ${quantity} ${product.unit} of ${product.name} for invoice fulfillment`);
    },
    [invoices, products, stores, createStockTransaction, logActivity]
  );

  // 15. Reset Inventory to Sample Data
  const resetInventoryToSampleData = useCallback(async () => {
    setProducts(initialProducts);
    setCategories(initialCategories);
    setStores(initialStores);
    setSuppliers(initialSuppliers);
    setStockTransactions(initialStockTransactions);
    setStockTransfers(initialStockTransfers);
    setPurchaseOrders(initialPurchaseOrders);
    setGoodsReceipts(initialGoodsReceipts);
    setStockReservations(initialStockReservations);
    setStockAudits(initialStockAudits);
    setStockAdjustments([]);

    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}_products`);
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}_categories`);
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}_stores`);
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}_suppliers`);
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}_transactions`);
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}_transfers`);
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}_purchase_orders`);
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}_goods_receipts`);
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}_reservations`);
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}_audits`);
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}_adjustments`);
  }, []);

  const value = useMemo(
    () => ({
      products,
      categories,
      stores,
      suppliers,
      stockTransactions,
      stockTransfers,
      purchaseOrders,
      goodsReceipts,
      stockReservations,
      stockAudits,
      stockAdjustments,
      activeInventoryTab,
      setActiveInventoryTab,
      selectedStoreFilter,
      setSelectedStoreFilter,
      totalProductsCount,
      totalStockQuantity,
      totalStockValue,
      lowStockProducts,
      outOfStockProducts,
      pendingPurchaseOrdersCount,
      addProduct,
      updateProduct,
      deleteProduct,
      bulkImportProducts,
      addCategory,
      addStore,
      updateStore,
      addSupplier,
      updateSupplier,
      createStockTransaction,
      createPurchaseOrder,
      updatePurchaseOrder,
      createGoodsReceipt,
      createStockTransfer,
      approveStockTransfer,
      receiveStockTransfer,
      completeStockTransfer: receiveStockTransfer,
      cancelStockTransfer,
      createStockReservation,
      releaseStockReservation,
      fulfillStockReservation,
      createStockAudit,
      approveStockAudit,
      reconcileStockAudit: approveStockAudit,
      createStockAdjustment,
      issueStockForComplaint,
      issueStockForInvoice,
      resetInventoryToSampleData,
    }),
    [
      products,
      categories,
      stores,
      suppliers,
      stockTransactions,
      stockTransfers,
      purchaseOrders,
      goodsReceipts,
      stockReservations,
      stockAudits,
      stockAdjustments,
      activeInventoryTab,
      selectedStoreFilter,
      totalProductsCount,
      totalStockQuantity,
      totalStockValue,
      lowStockProducts,
      outOfStockProducts,
      pendingPurchaseOrdersCount,
      addProduct,
      updateProduct,
      deleteProduct,
      bulkImportProducts,
      addCategory,
      addStore,
      updateStore,
      addSupplier,
      updateSupplier,
      createStockTransaction,
      createPurchaseOrder,
      updatePurchaseOrder,
      createGoodsReceipt,
      createStockTransfer,
      approveStockTransfer,
      receiveStockTransfer,
      cancelStockTransfer,
      createStockReservation,
      releaseStockReservation,
      fulfillStockReservation,
      createStockAudit,
      approveStockAudit,
      createStockAdjustment,
      issueStockForComplaint,
      issueStockForInvoice,
      resetInventoryToSampleData,
    ]
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
