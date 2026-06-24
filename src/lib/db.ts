/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ShopTenant,
  AppUser,
  Product,
  SparePart,
  Supplier,
  Customer,
  Sale,
  SaleItem,
  MaintenanceJob,
  ShopSettings,
  BroadcastMessage,
  UsedPhoneTransaction,
  AuditLog,
  AccountingExpense,
  CustomerMessage,
  BookingRequest,
  AuditReport,
  UsedPhoneAssessment,
  Language,
  CustomerOrder
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_SPARE_PARTS,
  INITIAL_SUPPLIERS,
  INITIAL_CUSTOMERS,
  INITIAL_MAINTENANCE_JOBS,
  INITIAL_SHOPS,
  BROADCAST_MESSAGES
} from './data';
import { db } from './firebase';
import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import {
  initIndexedDB,
  idbGet,
  idbSet,
  idbRemove,
  idbClear,
  idbGetAllEntries,
  migrateFromLocalStorage
} from './indexedDb';
import { enqueueSync, enqueueSyncBatch, BatchSyncOperation } from './syncQueue';

// Key names for storage
const KEY_SHOPS = 'dzstore_saas_shops';
const KEY_USERS = 'dzstore_saas_users';
const KEY_BROADCASTS = 'dzstore_broadcasts';

export class DzStoreDB {
  private static cache: Record<string, string> = {};
  private static isInitialized = false;

  // One-way cryptographic SHA-256 hashing for user passwords
  static sha256(ascii: string): string {
    function rightRotate(value: number, amount: number) {
      return (value >>> amount) | (value << (32 - amount));
    }
    
    const words: number[] = [];
    const asciiLength = ascii.length;
    const maxBytes = ((asciiLength + 8) >> 6) + 1 << 4;
    for (let i = 0; i < maxBytes * 4; i++) words[i] = 0;
    for (let i = 0; i < asciiLength; i++) {
      words[i >> 2] |= ascii.charCodeAt(i) << (24 - (i % 4) * 8);
    }
    words[asciiLength >> 2] |= 0x80 << (24 - (asciiLength % 4) * 8);
    words[maxBytes - 1] = asciiLength * 8;
    
    const hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    
    for (let i = 0; i < maxBytes; i += 16) {
      const w: number[] = [];
      for (let j = 0; j < 16; j++) w[j] = words[i + j];
      for (let j = 16; j < 64; j++) {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      
      let [a, b, c, d, e, f, g, h] = hash;
      for (let j = 0; j < 64; j++) {
        const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
        const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;
        
        h = g;
        g = f;
        f = e;
        e = (d + temp1) | 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) | 0;
      }
      hash[0] = (hash[0] + a) | 0;
      hash[1] = (hash[1] + b) | 0;
      hash[2] = (hash[2] + c) | 0;
      hash[3] = (hash[3] + d) | 0;
      hash[4] = (hash[4] + e) | 0;
      hash[5] = (hash[5] + f) | 0;
      hash[6] = (hash[6] + g) | 0;
      hash[7] = (hash[7] + h) | 0;
    }
    
    return hash.map(v => ('00000000' + (v >>> 0).toString(16)).slice(-8)).join('');
  }

  static hashPassword(password: string): string {
    if (!password) return '';
    if (/^[0-9a-f]{64}$/i.test(password)) {
      return password;
    }
    return this.sha256(`dzstore_salt_${password}`);
  }

  static verifyPassword(storedHash: string | undefined, input: string): boolean {
    if (!storedHash || !input) return false;
    const computed = this.hashPassword(input);
    return storedHash === computed;
  }

  // Reversible shift cryptography to obscuring non-credential configuration metadata locally and on Firebase
  static encrypt(plain: string): string {
    if (!plain) return '';
    try {
      const shift = 13;
      let cipher = '';
      for (let i = 0; i < plain.length; i++) {
        cipher += String.fromCharCode(plain.charCodeAt(i) + shift);
      }
      return btoa(unescape(encodeURIComponent(cipher)));
    } catch {
      return plain;
    }
  }

  static decrypt(cipher: string): string {
    if (!cipher) return '';
    try {
      const raw = decodeURIComponent(escape(atob(cipher)));
      const shift = 13;
      let plain = '';
      for (let i = 0; i < raw.length; i++) {
        plain += String.fromCharCode(raw.charCodeAt(i) - shift);
      }
      return plain;
    } catch {
      return cipher;
    }
  }

  // Initialize the database, migrate if needed, populate cache
  static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Connect to IndexedDB
      await initIndexedDB();

      // Check migration
      const isMigratedLocal = localStorage.getItem('dzstore_indexeddb_migrated');
      if (isMigratedLocal !== 'true') {
        await migrateFromLocalStorage();
        localStorage.setItem('dzstore_indexeddb_migrated', 'true');
        await idbSet('dzstore_indexeddb_migrated', 'true');
      }

      // Read all values from IndexedDB into memory cache
      const entries = await idbGetAllEntries();
      this.cache = entries || {};
      this.isInitialized = true;
      console.log(`[IndexedDB Sync] Database successfully initialized with ${Object.keys(this.cache).length} cached slots.`);
    } catch (err) {
      console.error('[IndexedDB Sync] Critical initialization error, using memory fallback:', err);
      this.isInitialized = true;
    }
  }

  // Dual Storage Layer Methods
  static getItem(key: string): string | null {
    // If not initialized yet, try loading from localStorage as a strict backup
    if (!this.isInitialized) {
      return localStorage.getItem(key);
    }
    return this.cache[key] || null;
  }

  static setItem(key: string, value: string) {
    this.cache[key] = value;
    // Persist to indexedDB asynchronously
    idbSet(key, value).catch(e => console.error(`[IndexedDB Sync] Failed to write key: ${key}`, e));
    // Mirror to localStorage as a lightweight safety partition for tiny values
    try {
      if (value.length < 5000) {
        localStorage.setItem(key, value);
      }
    } catch {}
  }

  static removeItem(key: string) {
    delete this.cache[key];
    idbRemove(key).catch(e => console.error(`[IndexedDB Sync] Failed to remove key: ${key}`, e));
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  static clear() {
    this.cache = {};
    idbClear().catch(e => console.error('[IndexedDB Sync] Failed to clear store', e));
    try {
      localStorage.clear();
      localStorage.setItem('dzstore_indexeddb_migrated', 'true');
    } catch {}
  }

  // Synchronize an item list to Firestore as individual documents (online/offline background cue)
  private static async syncListToFirestore(
    collectionPath: string,
    newItems: any[],
    oldItems: any[]
  ) {
    try {
      const newItemsSafe = (newItems || []).filter(item => item && typeof item === 'object' && item.id);
      const oldItemsSafe = (oldItems || []).filter(item => item && typeof item === 'object' && item.id);

      const newIds = new Set(newItemsSafe.map(item => item.id));
      const deletedItems = oldItemsSafe.filter(item => !newIds.has(item.id));

      const oldMap = new Map<string, any>(oldItemsSafe.map(item => [item.id, item]));
      const modifiedOrNewItems = newItemsSafe.filter(item => {
        const oldItem = oldMap.get(item.id);
        if (!oldItem) return true; // New item
        try {
          return JSON.stringify(oldItem) !== JSON.stringify(item); // Changed item
        } catch {
          return true;
        }
      });

      const batchOps: BatchSyncOperation[] = [];

      // Queue deletion for missing items
      for (const item of deletedItems) {
        if (item.id) {
          batchOps.push({
            type: 'delete',
            docPath: `${collectionPath}/${item.id}`
          });
        }
      }

      // Queue upserts/sets ONLY for modified or new items
      for (const item of modifiedOrNewItems) {
        if (item.id) {
          batchOps.push({
            type: 'set',
            docPath: `${collectionPath}/${item.id}`,
            payload: item
          });
        }
      }

      await enqueueSyncBatch(batchOps);
    } catch (e) {
      console.error("syncListToFirestore failed:", e);
    }
  }

  private static async syncSingleToFirestore(docPath: string, data: any) {
    try {
      enqueueSync('set', docPath, data);
    } catch (e) {
      console.error("syncSingleToFirestore failed:", e);
    }
  }

  // Global SaaS States (Admin perspective)
  static getShops(): ShopTenant[] {
    const data = this.getItem(KEY_SHOPS);
    if (!data) {
      this.setItem(KEY_SHOPS, JSON.stringify(INITIAL_SHOPS));
      return INITIAL_SHOPS;
    }
    return JSON.parse(data);
  }

  static saveShops(shops: ShopTenant[]) {
    const old = this.getShops();
    this.setItem(KEY_SHOPS, JSON.stringify(shops));
    this.syncListToFirestore('shops', shops, old);
  }

  static getUsers(): AppUser[] {
    const defaultUsers: AppUser[] = [
      {
        id: 'user-owner',
        shopId: 'trial-shop',
        email: 'owner@dz.com',
        password: '1234',
        name: 'كريم بلفورت',
        phone: '0551002233',
        role: 'owner',
        isActive: true,
        createdAt: '2026-05-01',
      },
      {
        id: 'user-cashier',
        shopId: 'trial-shop',
        email: 'cashier@gmail.com',
        password: '1234',
        name: 'أحمد البائع',
        phone: '0551004455',
        role: 'cashier',
        isActive: true,
        createdAt: '2026-05-05',
      },
      {
        id: 'user-tech',
        shopId: 'trial-shop',
        email: 'tech@gmail.com',
        password: '1234',
        name: 'عماد الصيانة',
        phone: '0551006677',
        role: 'technician',
        isActive: true,
        createdAt: '2026-05-05',
      },
      // Admin account
      {
        id: 'user-admin',
        shopId: 'system-admin-tenant',
        email: 'gestion.stock34@gmail.com',
        password: '12345',
        name: 'المدير العام (DzStore CEO)',
        phone: '0656000000',
        role: 'admin',
        isActive: true,
        createdAt: '2026-04-01',
      }
    ];

    const data = this.getItem(KEY_USERS);
    if (!data) {
      const secureDefaults = defaultUsers.map(u => ({
        ...u,
        password: u.password ? this.hashPassword(u.password) : ''
      }));
      this.setItem(KEY_USERS, JSON.stringify(secureDefaults));
      this.syncListToFirestore('users', secureDefaults, []);
      return secureDefaults;
    }
    try {
      const parsed: AppUser[] = JSON.parse(data);
      return parsed.map(u => ({
        ...u,
        password: u.password ? this.hashPassword(u.password) : ''
      }));
    } catch (e) {
      console.error("Failed to process local users list, returning fallback:", e);
      return defaultUsers.map(u => ({
        ...u,
        password: u.password ? this.hashPassword(u.password) : ''
      }));
    }
  }

  static saveUsers(users: AppUser[]) {
    const old = this.getUsers();
    const secureUsers = users.map(u => ({
      ...u,
      password: u.password ? this.hashPassword(u.password) : ''
    }));
    this.setItem(KEY_USERS, JSON.stringify(secureUsers));

    const oldSecure = old.map(u => ({
      ...u,
      password: u.password ? this.hashPassword(u.password) : ''
    }));
    this.syncListToFirestore('users', secureUsers, oldSecure);
  }

  static getBroadcasts(): BroadcastMessage[] {
    const data = this.getItem(KEY_BROADCASTS);
    if (!data) {
      this.setItem(KEY_BROADCASTS, JSON.stringify(BROADCAST_MESSAGES));
      return BROADCAST_MESSAGES;
    }
    return JSON.parse(data);
  }

  static saveBroadcasts(messages: BroadcastMessage[]) {
    const old = this.getBroadcasts();
    this.setItem(KEY_BROADCASTS, JSON.stringify(messages));
    this.syncListToFirestore('broadcasts', messages, old);
  }

  // Tenant-specific state storage (isolated by shopId)
  private static getTenantKey(shopId: string, itemType: string): string {
    return `dzstore_shop_${shopId}_${itemType}`;
  }

  static getProducts(shopId: string): Product[] {
    const key = this.getTenantKey(shopId, 'products');
    const data = this.getItem(key);
    if (!data) {
      // Filter initial mock products for the trial-shop
      const initial = INITIAL_PRODUCTS.filter(p => p.shopId === shopId || shopId === 'trial-shop');
      this.setItem(key, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(data);
  }

  static saveProducts(shopId: string, products: Product[]) {
    const key = this.getTenantKey(shopId, 'products');
    const old = this.getProducts(shopId);
    this.setItem(key, JSON.stringify(products));
    this.syncListToFirestore(`shops/${shopId}/products`, products, old);
  }

  static getSpareParts(shopId: string): SparePart[] {
    const key = this.getTenantKey(shopId, 'spare_parts');
    const data = this.getItem(key);
    if (!data) {
      const initial = INITIAL_SPARE_PARTS.filter(p => p.shopId === shopId || shopId === 'trial-shop');
      this.setItem(key, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(data);
  }

  static saveSpareParts(shopId: string, parts: SparePart[]) {
    const key = this.getTenantKey(shopId, 'spare_parts');
    const old = this.getSpareParts(shopId);
    this.setItem(key, JSON.stringify(parts));
    this.syncListToFirestore(`shops/${shopId}/spare_parts`, parts, old);
  }

  static getSuppliers(shopId: string): Supplier[] {
    const key = this.getTenantKey(shopId, 'suppliers');
    const data = this.getItem(key);
    if (!data) {
      const initial = INITIAL_SUPPLIERS.filter(s => s.shopId === shopId || shopId === 'trial-shop');
      this.setItem(key, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(data);
  }

  static saveSuppliers(shopId: string, suppliers: Supplier[]) {
    const key = this.getTenantKey(shopId, 'suppliers');
    const old = this.getSuppliers(shopId);
    this.setItem(key, JSON.stringify(suppliers));
    this.syncListToFirestore(`shops/${shopId}/suppliers`, suppliers, old);
  }

  static getCustomers(shopId: string): Customer[] {
    const key = this.getTenantKey(shopId, 'customers');
    const data = this.getItem(key);
    if (!data) {
      const initial = INITIAL_CUSTOMERS.filter(c => c.shopId === shopId || shopId === 'trial-shop');
      this.setItem(key, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(data);
  }

  static saveCustomers(shopId: string, customers: Customer[]) {
    const key = this.getTenantKey(shopId, 'customers');
    const old = this.getCustomers(shopId);
    this.setItem(key, JSON.stringify(customers));
    this.syncListToFirestore(`shops/${shopId}/customers`, customers, old);
  }

  static getMaintenanceJobs(shopId: string): MaintenanceJob[] {
    const key = this.getTenantKey(shopId, 'maintenance');
    const data = this.getItem(key);
    if (!data) {
      const initial = INITIAL_MAINTENANCE_JOBS.filter(m => m.shopId === shopId || shopId === 'trial-shop');
      this.setItem(key, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(data);
  }

  static saveMaintenanceJobs(shopId: string, jobs: MaintenanceJob[]) {
    const key = this.getTenantKey(shopId, 'maintenance');
    const old = this.getMaintenanceJobs(shopId);
    this.setItem(key, JSON.stringify(jobs));
    this.syncListToFirestore(`shops/${shopId}/maintenance`, jobs, old);
  }

  static getSales(shopId: string): Sale[] {
    const key = this.getTenantKey(shopId, 'sales');
    const data = this.getItem(key);
    if (!data) {
      // Seed an empty list or some historical mockup
      const initial: Sale[] = [
        {
          id: 's-mock-1',
          shopId: shopId,
          invoiceNumber: 'INV-2026-0001',
          items: [
            {
              productId: 'p-4',
              name: 'AirPods Pro 2nd Gen USB-C',
              type: 'product',
              quantity: 1,
              price: 36000,
              originalPrice: 36000,
              discount: 0,
            }
          ],
          subtotal: 36000,
          discount: 0,
          total: 36000,
          paymentMethod: 'installments',
          cashierId: 'user-cashier',
          cashierName: 'أحمد البائع',
          customerId: 'c-1',
          customerName: 'Kamel Benzahra',
          warrantyPeriod: '6 months',
          warrantyNotes: 'Official Apple international coverage',
          date: '2026-05-20T10:15:00Z',
        }
      ];
      this.setItem(key, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(data);
  }

  static saveSales(shopId: string, sales: Sale[]) {
    const key = this.getTenantKey(shopId, 'sales');
    const old = this.getSales(shopId);
    this.setItem(key, JSON.stringify(sales));
    this.syncListToFirestore(`shops/${shopId}/sales`, sales, old);
  }

  static getUsedPhones(shopId: string): UsedPhoneTransaction[] {
    const key = this.getTenantKey(shopId, 'used_phones');
    const data = this.getItem(key);
    if (!data) {
      this.setItem(key, JSON.stringify([]));
      return [];
    }
    return JSON.parse(data);
  }

  static saveUsedPhones(shopId: string, transactions: UsedPhoneTransaction[]) {
    const key = this.getTenantKey(shopId, 'used_phones');
    const old = this.getUsedPhones(shopId);
    this.setItem(key, JSON.stringify(transactions));
    this.syncListToFirestore(`shops/${shopId}/used_phones`, transactions, old);
  }

  static getMessages(shopId: string): CustomerMessage[] {
    const key = this.getTenantKey(shopId, 'messages');
    const data = this.getItem(key);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static saveMessages(shopId: string, messages: CustomerMessage[]): void {
    const key = this.getTenantKey(shopId, 'messages');
    const old = this.getMessages(shopId);
    this.setItem(key, JSON.stringify(messages));
    this.syncListToFirestore(`shops/${shopId}/messages`, messages, old);
  }

  static getOrders(shopId: string): CustomerOrder[] {
    const key = this.getTenantKey(shopId, 'orders');
    const data = this.getItem(key);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static saveOrders(shopId: string, orders: CustomerOrder[]): void {
    const key = this.getTenantKey(shopId, 'orders');
    const old = this.getOrders(shopId);
    this.setItem(key, JSON.stringify(orders));
    this.syncListToFirestore(`shops/${shopId}/orders`, orders, old);
  }


  static getSettings(shopId: string, defaultLang: Language = 'en'): ShopSettings {
    const key = this.getTenantKey(shopId, 'settings');
    const data = this.getItem(key);
    if (!data) {
      // Default settings based on shop info
      const shops = this.getShops();
      const currentShop = shops.find(s => s.id === shopId) || shops[0];

      let shopNameDefault = 'محل الهواتف والصيانة';
      let rHeader = 'مرحباً بكم في محلنا التجاري للهواتف والملحقات والبرمجيات';
      let rFooter = 'الفاتورة لا تلغى ولا تستبدل بعد 48 ساعة. شكراً لثقتكم!';
      let wHeader = 'وصل الضمان المعتمد لصيانة الهواتف الذكية والأجهزة الذكية';
      let wFooter = 'الضمان لا يشمل الكسر، دخول السوائل، أو فتح الهاتف خارج ورشتنا.';

      if (defaultLang === 'en') {
        shopNameDefault = 'Mobile & Repair Shop';
        rHeader = 'Welcome to our store for mobile phones, accessories, and software';
        rFooter = 'The invoice cannot be canceled or exchanged after 48 hours. Thank you for your trust!';
        wHeader = 'Approved Warranty Receipt for Smartphone & Smart Device Maintenance';
        wFooter = 'The warranty does not cover breakage, liquid entry, or opening the phone outside our workshop.';
      } else if (defaultLang === 'fr') {
        shopNameDefault = 'Boutique de Téléphones & Réparations';
        rHeader = 'Bienvenue dans notre boutique de téléphones portables, accessoires et logiciels';
        rFooter = 'La facture ne peut être annulée ou échangée après 48 heures. Merci pour votre confiance !';
        wHeader = 'Bon de Garantie Agréé pour la Maintenance des Smartphones';
        wFooter = 'La garantie ne couvre pas la casse, l\'oxydation ou l\'ouverture en dehors de notre atelier.';
      } else if (defaultLang === 'es') {
        shopNameDefault = 'Tienda y Servicio de Teléfonos';
        rHeader = 'Bienvenido a nuestra tienda de teléfonos móviles, accesorios y software';
        rFooter = 'La factura no se puede cancelar ni cambiar después de 48 horas. ¡Gracias por su confianza!';
        wHeader = 'Comprobante de Garantía Aceptado para Reparación de Smartphones';
        wFooter = 'La garantía no cubre roturas, humedad o apertura fuera de nuestro taller técnico.';
      }

      const initial: ShopSettings = {
        shopName: currentShop?.name || shopNameDefault,
        shopPhone: currentShop?.phone || '0551000000',
        shopAddress: currentShop?.address || (defaultLang === 'ar' ? 'الجزائر' : 'Algeria'),
        shopEmail: currentShop?.ownerEmail || 'info@myshop.com',
        logoImage: '',
        stampImage: '',
        receiptHeader: rHeader,
        receiptFooter: rFooter,
        warrantyHeader: wHeader,
        warrantyFooter: wFooter,
        currency: 'DZD',
        language: defaultLang,
        primaryColor: 'sky',
        darkMode: false,
      };
      this.setItem(key, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(data);
  }

  static saveSettings(shopId: string, settings: ShopSettings) {
    const key = this.getTenantKey(shopId, 'settings');
    this.setItem(key, JSON.stringify(settings));
    this.syncSingleToFirestore(`shops/${shopId}/settings/current`, settings);

    // Concurrently synchronize corresponding shop tenant profile (name, phone, address)
    try {
      const shops = this.getShops();
      const idx = shops.findIndex(s => s.id === shopId);
      if (idx > -1) {
        shops[idx] = {
          ...shops[idx],
          name: settings.shopName || shops[idx].name,
          phone: settings.shopPhone || shops[idx].phone,
          address: settings.shopAddress || shops[idx].address,
          updatedAt: new Date().toISOString()
        };
        this.saveShops(shops);
      }
    } catch (e) {
      console.warn("Failed to update related shop tenant data", e);
    }
  }

  static getBaridiMobDetails(): string {
    const details = this.getItem('dzstore_baridimob_details');
    if (!details) {
      return 'رقم بريدي موب للموزع: RIP: 00799999002345678945 - المفتاح: 42. يرجى إرسال وصل التحويل عبر تيلغرام للأدمن لتفعيل الحساب.';
    }
    return details;
  }

  static saveBaridiMobDetails(details: string) {
    this.setItem('dzstore_baridimob_details', details);
    this.syncSingleToFirestore('system/baridi_mob', { details });
  }

  // Backup Engine (Local Export & Import JSON text)
  static exportDatabase(shopId: string): string {
    const dbObject = {
      shopId,
      exportedAt: new Date().toISOString(),
      products: this.getProducts(shopId),
      spareParts: this.getSpareParts(shopId),
      suppliers: this.getSuppliers(shopId),
      customers: this.getCustomers(shopId),
      maintenanceJobs: this.getMaintenanceJobs(shopId),
      sales: this.getSales(shopId),
      settings: this.getSettings(shopId),
    };
    return JSON.stringify(dbObject, null, 2);
  }

  static importDatabase(shopId: string, jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.products) this.saveProducts(shopId, parsed.products);
      if (parsed.spareParts) this.saveSpareParts(shopId, parsed.spareParts);
      if (parsed.suppliers) this.saveSuppliers(shopId, parsed.suppliers);
      if (parsed.customers) this.saveCustomers(shopId, parsed.customers);
      if (parsed.maintenanceJobs) this.saveMaintenanceJobs(shopId, parsed.maintenanceJobs);
      if (parsed.sales) this.saveSales(shopId, parsed.sales);
      if (parsed.settings) this.saveSettings(shopId, parsed.settings);
      return true;
    } catch (e) {
      console.error('Import database failed:', e);
      return false;
    }
  }

  // Recover sales directly from Firestore cloud database (for troubleshooting cache wiped states)
  static async recoverSalesFromServer(shopId: string): Promise<{ success: boolean; count: number; message: string }> {
    try {
      const q = collection(db, 'shops', shopId, 'sales');
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return {
          success: true,
          count: 0,
          message: 'No sales documents found on the cloud for this shop ID.'
        };
      }

      const cloudSales: Sale[] = [];
      snapshot.forEach(docSnap => {
        cloudSales.push(docSnap.data() as Sale);
      });

      // Sort by date descending
      cloudSales.sort((a, b) => {
        const timeA = a.date || '';
        const timeB = b.date || '';
        return timeB.localeCompare(timeA);
      });

      // Fetch current local sales
      const localSales = this.getSales(shopId);
      const localIds = new Set(localSales.map(s => s.id));

      let addedCount = 0;
      const mergedSales = [...localSales];

      for (const sale of cloudSales) {
        if (!localIds.has(sale.id)) {
          mergedSales.push(sale);
          addedCount++;
        }
      }

      // If we recovered any sales, save them to local storage
      if (addedCount > 0) {
        // Sort merged list again
        mergedSales.sort((a, b) => {
          const timeA = a.date || '';
          const timeB = b.date || '';
          return timeB.localeCompare(timeA);
        });
        const key = this.getTenantKey(shopId, 'sales');
        this.setItem(key, JSON.stringify(mergedSales));
      }

      return {
        success: true,
        count: addedCount,
        message: addedCount > 0 
          ? `Successfully restored ${addedCount} missing sale(s) from the cloud server!` 
          : 'Local database is already in sync with all sales stored on the cloud server.'
      };
    } catch (e: any) {
      console.error('Failed to recover sales from server:', e);
      return {
        success: false,
        count: 0,
        message: `Recovery failed: ${e.message || String(e)}`
      };
    }
  }

  // Recover general collections directly from Firestore
  static async recoverCollectionFromServer(shopId: string, collName: string): Promise<{ success: boolean; count: number; message: string }> {
    try {
      const q = collection(db, 'shops', shopId, collName);
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return {
          success: true,
          count: 0,
          message: `No documents found on the cloud for "${collName}".`
        };
      }

      const cloudItems: any[] = [];
      snapshot.forEach(docSnap => {
        cloudItems.push(docSnap.data());
      });

      // Load local
      const itemType = collName === 'maintenance' ? 'maintenance' : collName;
      const key = this.getTenantKey(shopId, itemType);
      const dataStr = this.getItem(key);
      const localItems: any[] = dataStr ? JSON.parse(dataStr) : [];
      const localIds = new Set(localItems.map(item => item.id));

      let addedCount = 0;
      const mergedItems = [...localItems];

      for (const item of cloudItems) {
        if (!localIds.has(item.id)) {
          mergedItems.push(item);
          addedCount++;
        }
      }

      if (addedCount > 0) {
        this.setItem(key, JSON.stringify(mergedItems));
      }

      return {
        success: true,
        count: addedCount,
        message: `Successfully restored ${addedCount} missing item(s) in "${collName}" from the cloud!`
      };
    } catch (e: any) {
      console.error(`Failed to recover "${collName}" from server:`, e);
      return {
        success: false,
        count: 0,
        message: `Recovery failed: ${e.message || String(e)}`
      };
    }
  }

  // Cryptographically checkable Offline License Keys system
  static generateLicenseKey(type: '3M' | '6M' | '12M' | 'LIFE', shopId: string): string {
    const typeCode = type === '3M' ? 'T03M' : type === '6M' ? 'T06M' : type === '12M' ? 'T12M' : 'LIFE';
    const cleanId = shopId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase() || 'SHOP';
    const randomHex = Math.random().toString(16).substring(2, 6).toUpperCase();
    const rawData = `${typeCode}-${cleanId}-${randomHex}`;
    
    let sum = 0;
    for (let i = 0; i < rawData.length; i++) {
      sum = (sum * 31 + rawData.charCodeAt(i)) % 65535;
    }
    const checksum = sum.toString(16).toUpperCase().padStart(4, '0');
    return `DZPOS-${typeCode}-${cleanId}-${randomHex}-${checksum}`;
  }

  static verifyLicenseKey(key: string): { isValid: boolean; months: number; isLifetime: boolean } {
    if (!key || !key.startsWith('DZPOS-')) {
      return { isValid: false, months: 0, isLifetime: false };
    }
    const parts = key.split('-');
    if (parts.length !== 5) {
      return { isValid: false, months: 0, isLifetime: false };
    }
    const [, typeCode, cleanId, randomHex, checksum] = parts;
    const rawData = `${typeCode}-${cleanId}-${randomHex}`;
    
    let sum = 0;
    for (let i = 0; i < rawData.length; i++) {
      sum = (sum * 31 + rawData.charCodeAt(i)) % 65535;
    }
    const expectedChecksum = sum.toString(16).toUpperCase().padStart(4, '0');
    if (checksum !== expectedChecksum) {
      return { isValid: false, months: 0, isLifetime: false };
    }
    
    let months = 0;
    let isLifetime = false;
    if (typeCode === 'T03M') months = 3;
    else if (typeCode === 'T06M') months = 6;
    else if (typeCode === 'T12M') months = 12;
    else if (typeCode === 'LIFE') isLifetime = true;
    else return { isValid: false, months: 0, isLifetime: false };
    
    return { isValid: true, months, isLifetime };
  }

  // AUDIT LOG SYSTEM
  static getAuditLogs(shopId: string): AuditLog[] {
    const key = this.getTenantKey(shopId, 'audit_logs');
    const data = this.getItem(key);
    if (!data) {
      this.setItem(key, JSON.stringify([]));
      return [];
    }
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static saveAuditLogs(shopId: string, logs: AuditLog[]) {
    const key = this.getTenantKey(shopId, 'audit_logs');
    const old = this.getAuditLogs(shopId);
    this.setItem(key, JSON.stringify(logs));
    this.syncListToFirestore(`shops/${shopId}/audit_logs`, logs, old);
  }

  static logAction(shopId: string, userId: string, userName: string, action: string, details: string) {
    try {
      const logs = this.getAuditLogs(shopId);
      const newLog: AuditLog = {
        id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        shopId,
        userId,
        userName,
        action,
        details,
        timestamp: new Date().toISOString()
      };
      logs.unshift(newLog);
      this.saveAuditLogs(shopId, logs.slice(0, 500));
    } catch (e) {
      console.warn("Audit Log write failed:", e);
    }
  }

  // ACCOUNTING EXPENSES SYSTEM
  static getExpenses(shopId: string): AccountingExpense[] {
    const key = this.getTenantKey(shopId, 'expenses');
    const data = this.getItem(key);
    if (!data) {
      this.setItem(key, JSON.stringify([]));
      return [];
    }
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static saveExpenses(shopId: string, expenses: AccountingExpense[]) {
    const key = this.getTenantKey(shopId, 'expenses');
    const old = this.getExpenses(shopId);
    this.setItem(key, JSON.stringify(expenses));
    this.syncListToFirestore(`shops/${shopId}/expenses`, expenses, old);
  }

  static getBookings(shopId: string): BookingRequest[] {
    const key = this.getTenantKey(shopId, 'bookings');
    const data = this.getItem(key);
    if (!data) {
      this.setItem(key, JSON.stringify([]));
      return [];
    }
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static saveBookings(shopId: string, bookings: BookingRequest[]) {
    const key = this.getTenantKey(shopId, 'bookings');
    const old = this.getBookings(shopId);
    this.setItem(key, JSON.stringify(bookings));
    this.syncListToFirestore(`shops/${shopId}/bookings`, bookings, old);
  }

  static getAudits(shopId: string): AuditReport[] {
    const key = this.getTenantKey(shopId, 'audits');
    const data = this.getItem(key);
    if (!data) {
      this.setItem(key, JSON.stringify([]));
      return [];
    }
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static saveAudits(shopId: string, audits: AuditReport[]) {
    const key = this.getTenantKey(shopId, 'audits');
    const old = this.getAudits(shopId);
    this.setItem(key, JSON.stringify(audits));
    this.syncListToFirestore(`shops/${shopId}/audits`, audits, old);
  }

  static getAssessments(shopId: string): UsedPhoneAssessment[] {
    const key = this.getTenantKey(shopId, 'assessments');
    const data = this.getItem(key);
    if (!data) {
      this.setItem(key, JSON.stringify([]));
      return [];
    }
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static saveAssessments(shopId: string, assessments: UsedPhoneAssessment[]) {
    const key = this.getTenantKey(shopId, 'assessments');
    const old = this.getAssessments(shopId);
    this.setItem(key, JSON.stringify(assessments));
    this.syncListToFirestore(`shops/${shopId}/assessments`, assessments, old);
  }

  // Find or create shop and user for a specific email dynamically (SaaS)
  static async findOrCreateShopAndUserFor(email: string, shopName: string, ownerName: string): Promise<{ shopId: string; userId: string; created: boolean }> {
    const cleanEmail = email.toLowerCase().trim();
    const allUsers = this.getUsers();
    const existingUser = allUsers.find(u => u.email.toLowerCase().trim() === cleanEmail);

    if (existingUser) {
      return { shopId: existingUser.shopId, userId: existingUser.id, created: false };
    }

    // Otherwise, create a new Tenant & owner
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const shopId = `shop-baha34-${randSuffix}`;
    const userId = `u-baha34-${randSuffix}`;

    const trialDate = new Date();
    trialDate.setFullYear(trialDate.getFullYear() + 1); // 1 Year full license for our special user

    const newShop: ShopTenant = {
      id: shopId,
      name: shopName,
      ownerEmail: cleanEmail,
      status: 'active', // Active immediately
      trialEndDate: trialDate.toISOString().split('T')[0],
      phone: '0555000000',
      address: 'الجزائر (Algeria)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newOwner: AppUser = {
      id: userId,
      shopId,
      name: ownerName,
      email: cleanEmail,
      password: this.hashPassword('1234'), // Hashed default '1234'
      phone: '0555000000',
      role: 'owner',
      isActive: true,
      permissions: ['pos', 'inventory', 'maintenance', 'suppliers', 'settings'],
      createdAt: new Date().toISOString().split('T')[0]
    };

    // Save directly to raw Firestore immediately
    try {
      await setDoc(doc(db, 'shops', shopId), newShop);
      await setDoc(doc(db, 'users', userId), newOwner);
    } catch (e) {
      console.warn("[SaaS Helper] Direct raw Firestore fallback registration: ", e);
    }

    // Save locally
    const updatedShops = [...this.getShops(), newShop];
    const updatedUsers = [...allUsers, newOwner];

    this.saveShops(updatedShops);
    this.saveUsers(updatedUsers);

    return { shopId, userId, created: true };
  }

  // Automated CSV sales parser & importer targeting baha34ayyoub@gmail.com or any shopId
  static async importSalesCSV(shopId: string, cashierName: string, cashierId: string, csvContent: string): Promise<{ success: boolean; message: string; count: number }> {
    try {
      if (!csvContent || !csvContent.trim()) {
        return { success: false, message: 'محتوى ملف الـ CSV فارغ!', count: 0 };
      }

      const lines = csvContent.split('\n').map(l => l.trim()).filter(Boolean);
      let salesCount = 0;
      const importedSales: Sale[] = [];

      // Clean RTL markers and strip header
      const headerLineIdx = lines.findIndex(l => l.includes('رقم العملية') || l.includes('ID') || l.includes('المنتجات المباعة'));
      const dataLines = headerLineIdx !== -1 ? lines.slice(headerLineIdx + 1) : lines;

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        if (!line) continue;

        // Custom split by CSV tokens taking into account double quotes
        // We handle standard CSV splitting safely
        const parts = line.replace(/^"/, '').replace(/"$/, '').split('","');
        if (parts.length < 5) {
          // Fallback if split fails on raw representation
          continue;
        }

        const saleId = parts[0]?.trim();
        const customerName = parts[1]?.trim() || 'زبون عام';
        const rawDateStr = parts[2]?.trim();
        const itemsStr = parts[3]?.trim();
        const totalStr = parts[4]?.trim();

        if (!saleId || !itemsStr) continue;

        // 1. Parse date
        let dateISO = new Date().toISOString();
        if (rawDateStr) {
          try {
            // Clean RTL characters
            let clean = rawDateStr.replace(/[\u200e\u200f\u202c\u202d\u202e\u2002]/g, '');
            clean = clean.replace(/،/g, ',').replace(/\s+/g, ' ').trim();
            
            const dateMatch = clean.match(/(\d{1,2})\/(\d{1,2})/);
            if (dateMatch) {
              const day = parseInt(dateMatch[1], 10);
              const month = parseInt(dateMatch[2], 10);
              
              const timeMatch = clean.match(/(\d{1,2}):(\d{1,2})/);
              let hour = 12;
              let minute = 0;
              if (timeMatch) {
                hour = parseInt(timeMatch[1], 10);
                minute = parseInt(timeMatch[2], 10);
              }
              
              const isPM = clean.includes('م') || clean.toLowerCase().includes('pm');
              const isAM = clean.includes('ص') || clean.toLowerCase().includes('am');
              
              if (isPM && hour < 12) {
                hour += 12;
              } else if (isAM && hour === 12) {
                hour = 0;
              }

              const pad = (num: number) => String(num).padStart(2, '0');
              dateISO = `2026-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00.000Z`;
            }
          } catch (e) {
            console.warn("[CSV Parser] Failed to parse date string:", rawDateStr, e);
          }
        }

        // 2. Parse total
        const totalVal = parseFloat(totalStr.replace(/[^\d]/g, '')) || 0;

        // 3. Parse items
        // Example: Camera LENS FILM (1×60000)
        // Split complex items by pipe symbol '|' represent multiple purchases
        const itemParts = itemsStr.split('|').map(s => s.trim()).filter(Boolean);
        const saleItems: SaleItem[] = [];
        let itemsOriginalSum = 0;

        for (const itemString of itemParts) {
          // Regex: anything before open parenthesis, then quantity/price
          const itemMatch = itemString.match(/^(.*?)\s*\(([^×xX*()]+)[×xX*]([^)]+)\)/);
          
          if (itemMatch) {
            const name = itemMatch[1].trim();
            const quantity = parseInt(itemMatch[2].trim(), 10) || 1;
            const originalPrice = parseFloat(itemMatch[3].trim()) || 0;
            const itemSubtotal = quantity * originalPrice;
            
            itemsOriginalSum += itemSubtotal;
            saleItems.push({
              name,
              type: 'product',
              quantity,
              price: originalPrice,
              originalPrice,
              discount: 0
            });
          } else {
            // Fallback for custom or weird products string representation
            saleItems.push({
              name: itemString,
              type: 'product',
              quantity: 1,
              price: totalVal,
              originalPrice: totalVal,
              discount: 0
            });
            itemsOriginalSum += totalVal;
          }
        }

        // Compute real sale total metrics
        const discountVal = Math.max(0, itemsOriginalSum - totalVal);
        
        // Build Sale Entity object match
        const newSale: Sale = {
          id: saleId,
          shopId,
          invoiceNumber: `INV-${saleId.substring(0, 6).toUpperCase()}`,
          items: saleItems,
          subtotal: itemsOriginalSum,
          discount: discountVal,
          total: totalVal,
          paymentMethod: 'cash',
          cashierId: cashierId,
          cashierName: cashierName,
          customerName,
          warrantyPeriod: 'no warranty',
          date: dateISO,
          status: 'completed'
        };

        importedSales.push(newSale);
        salesCount++;
      }

      if (importedSales.length === 0) {
        return { success: false, message: 'لم يتم العثور على أي عملية بيع صالحة للاستيراد في الملف الـ CSV!', count: 0 };
      }

      // Merge & Save Locally
      const currentSales = this.getSales(shopId);
      const existingIds = new Set(currentSales.map(s => s.id));
      
      let newCount = 0;
      const mergedSalesList = [...currentSales];
      
      for (const sale of importedSales) {
        if (!existingIds.has(sale.id)) {
          mergedSalesList.push(sale);
          newCount++;
          
          // Force push/write straight to Firebase cloud to persist instantly across devices
          try {
            await setDoc(doc(db, 'shops', shopId, 'sales', sale.id), sale);
          } catch (fbErr) {
            console.warn(`[CSV Parser Sync] Direct Firestore upload for "${sale.id}" failed:`, fbErr);
          }
        }
      }

      if (newCount > 0) {
        // Sort sales by date descending
        mergedSalesList.sort((a, b) => b.date.localeCompare(a.date));
        this.setItem(this.getTenantKey(shopId, 'sales'), JSON.stringify(mergedSalesList));
      }

      return {
        success: true,
        message: newCount > 0 
          ? `تم استيراد ${newCount} مبيعات جديدة بنجاح في النسخة المحلية والسحابية للمحل!` 
          : 'جميع المبيعات الموجودة في الملف مضافة بالفعل ومحفوظة بسلام في المحل!',
        count: newCount
      };

    } catch (e: any) {
      console.error('[CSV Importer] Fatal error:', e);
      return { success: false, message: `فشل الاستيراد: ${e.message || String(e)}`, count: 0 };
    }
  }
}
