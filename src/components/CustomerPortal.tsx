import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Wrench, 
  Shield, 
  CreditCard, 
  ArrowLeft, 
  Receipt, 
  Calendar, 
  User, 
  QrCode, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Smartphone,
  ChevronRight,
  Info,
  ExternalLink,
  Mail,
  Send,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Phone,
  MapPin,
  MessageSquare,
  Sparkles,
  Plus,
  Minus,
  Trash2,
  Check,
  Upload
} from 'lucide-react';
import { DzStoreDB } from '../lib/db';
import { db } from '../lib/firebase';
import { collection, getDocs, collectionGroup, setDoc, doc } from 'firebase/firestore';
import { ShopTenant, MaintenanceJob, Sale, Customer, Currency, CustomerMessage, Product, CustomerOrder } from '../types';
import { Html5Qrcode } from 'html5-qrcode';

// Normalization helper: convert Arabic / Persian keyboard numerals to standard English digits
const toEnglishDigits = (str: string): string => {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(arabicDigits[i], 'g'), String(i));
    result = result.replace(new RegExp(persianDigits[i], 'g'), String(i));
  }
  return result;
};

// Clean non-digits and normalize digits
const cleanPhone = (phone: string): string => {
  if (!phone) return '';
  let res = toEnglishDigits(phone);
  res = res.replace(/\D/g, ''); 
  return res;
};

// Smart lenient matching for search inputs vs database entries
const isPhoneMatch = (dbPhone: string, searchInput: string): boolean => {
  if (!dbPhone || !searchInput) return false;
  
  const cleanDb = cleanPhone(dbPhone);
  const cleanSearch = cleanPhone(searchInput);
  
  if (cleanDb.length < 6 || cleanSearch.length < 6) return false;
  
  // Try suffix comparisons (last 9 digits are typical for Algerian mobile carriers)
  const dbSuffix = cleanDb.slice(-9);
  const searchSuffix = cleanSearch.slice(-9);
  if (dbSuffix.length >= 8 && searchSuffix.length >= 8 && dbSuffix === searchSuffix) {
    return true;
  }
  
  const dbSuffix8 = cleanDb.slice(-8);
  const searchSuffix8 = cleanSearch.slice(-8);
  if (dbSuffix8.length >= 7 && searchSuffix8.length >= 7 && dbSuffix8 === searchSuffix8) {
    return true;
  }
  
  if (cleanDb.includes(cleanSearch) || cleanSearch.includes(cleanDb)) {
    return true;
  }
  
  return false;
};

interface CustomerPortalProps {
  lang: 'ar' | 'fr' | 'en';
  onBack: () => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({ lang, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isQueryingServer, setIsQueryingServer] = useState(false);
  const [shops, setShops] = useState<ShopTenant[]>([]);
  
  // Results for global search
  const [matchedJobs, setMatchedJobs] = useState<{ job: MaintenanceJob; shopName: string }[]>([]);
  const [matchedInvoices, setMatchedInvoices] = useState<{ sale: Sale; shopName: string; currency: Currency }[]>([]);
  const [matchedInstallments, setMatchedInstallments] = useState<{ customer: Customer; shopName: string; currency: Currency }[]>([]);
  
  // View states: 'hub' (main lookup page) or 'storefront' (specifically browsing one shop)
  const [portalMode, setPortalMode] = useState<'hub' | 'storefront'>('hub');
  const [selectedShop, setSelectedShop] = useState<ShopTenant | null>(null);
  
  // Storefront specific states
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [storefrontTab, setStorefrontTab] = useState<'catalog' | 'order' | 'track' | 'contact'>('catalog');
  
  // Checkout cart
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Maintenance tracing inside Storefront
  const [localTicketNum, setLocalTicketNum] = useState('');
  const [tracedJob, setTracedJob] = useState<MaintenanceJob | null>(null);
  const [tracedShopName, setTracedShopName] = useState('');
  const [hasTraced, setHasTraced] = useState(false);

  // Message Form States
  const [msgName, setMsgName] = useState('');
  const [msgPhone, setMsgPhone] = useState('');
  const [msgSubject, setMsgSubject] = useState('');
  const [msgContent, setMsgContent] = useState('');
  const [msgTicket, setMsgTicket] = useState('');
  const [msgSuccess, setMsgSuccess] = useState(false);

  // QR Scan States and Decoders
  const [manualShopCode, setManualShopCode] = useState('');
  const [qrScanError, setQrScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startingRef = useRef(false);
  const shouldStopRef = useRef(false);
  const isMountedRef = useRef(true);
  const [activeScanTab, setActiveScanTab] = useState<'camera' | 'upload' | 'manual'>('camera');

  const handleDecodeShopCode = (decodedText: string) => {
    let cleanText = decodedText.trim();
    
    // Extract shop ID if the QR contains full URL format
    if (cleanText.includes('#store-')) {
      cleanText = cleanText.split('#store-')[1];
    } else if (cleanText.includes('store-')) {
      cleanText = cleanText.split('store-')[1];
    }
    
    // Clean trailing params or hashes
    cleanText = cleanText.split('?')[0].split('#')[0].trim();

    // Look up shop
    const targetShop = shops.find(s => s.id === cleanText && (s.status === 'active' || s.status === 'trial'));
    if (targetShop) {
      setQrScanError(null);
      stopCameraScan()
        .then(() => {
          if (isMountedRef.current) {
            handleOpenStorefront(targetShop);
          }
        })
        .catch((err) => {
          console.warn("Stop scanner on successful scan failed gracefully:", err);
          if (isMountedRef.current) {
            handleOpenStorefront(targetShop);
          }
        });
    } else {
      setQrScanError(lang === 'ar' ? 'رمز المتجر غير صحيح أو غير متطابق مع أي محل نشط!' : 'Invalid shop code or no active match found!');
    }
  };

  const startCameraScan = async () => {
    if (startingRef.current || isScanning) return;
    setQrScanError(null);
    startingRef.current = true;
    shouldStopRef.current = false;
    setIsScanning(true);

    try {
      // If there's an existing scanner instance, try to stop it first
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
        } catch (e) {
          console.warn("Error stopping previous scanner instance:", e);
        }
        scannerRef.current = null;
      }

      // Clear the container's inner HTML to ensure a clean start state
      const container = document.getElementById("qr-reader-container");
      if (container) {
        container.innerHTML = "";
      } else {
        // If element is missing from DOM, do not try to initialize
        throw new Error("Scanner container element not found in DOM");
      }

      const html5QrCode = new Html5Qrcode("qr-reader-container");
      scannerRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          if (isMountedRef.current) {
            handleDecodeShopCode(decodedText);
          }
        },
        () => {
          // Silent scan failure is normal for frame scanning
        }
      );

      startingRef.current = false;

      // If stop was requested while we were starting, or if component unmounted, trigger stop now
      if (!isMountedRef.current || shouldStopRef.current) {
        await stopCameraScan();
      }
    } catch (err: any) {
      startingRef.current = false;
      setIsScanning(false);
      console.error("Camera access failed", err);
      
      let errorMsg = lang === 'ar' 
        ? 'فشل تشغيل الكاميرا! يرجى التحقق من صلاحيات الكاميرا بالمتصفح.' 
        : 'Failed to start camera. Please verify device permissions.';
        
      const errStr = String(err?.message || err?.name || err || '');
      if (err?.name === 'NotReadableError' || errStr.includes('NotReadableError') || errStr.includes('Device in use') || errStr.includes('Could not start video source')) {
        errorMsg = lang === 'ar'
          ? 'الكاميرا قيد الاستخدام حالياً من تطبيق آخر أو علامة تبويب أخرى بالمتصفح! يرجى إغلاق التطبيقات الأخرى والمحاولة مجدداً، أو استخدام خيار "تحميل كصورة" أو "إدخال كود المحل".'
          : 'The camera is currently in use by another application or browser tab! Please close other apps using the camera and try again, or use the "Upload QR Image" or "Enter Shop ID" options.';
      }
      
      setQrScanError(errorMsg);
    }
  };

  const stopCameraScan = async () => {
    shouldStopRef.current = true;
    if (startingRef.current) {
      // Transitioning: we set isScanning to false immediately to give positive UI feedback
      setIsScanning(false);
      return;
    }

    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          // Verify container exists before stopping to prevent internal library crash
          if (document.getElementById("qr-reader-container")) {
            await scannerRef.current.stop();
          }
        }
      } catch (err) {
        console.warn("Failed to stop html5-qrcode scanner smoothly:", err);
      } finally {
        scannerRef.current = null;
        setIsScanning(false);
      }
    } else {
      setIsScanning(false);
    }
  };

  const handleQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setQrScanError(null);
    const containerHidden = document.getElementById("qr-reader-container-hidden");
    if (!containerHidden) {
      setQrScanError(lang === 'ar' ? 'حدث خطأ في النظام الداخلي' : 'Internal scanner element not ready');
      return;
    }

    try {
      const html5QrCode = new Html5Qrcode("qr-reader-container-hidden");
      try {
        const decodedText = await html5QrCode.scanFile(file, false);
        handleDecodeShopCode(decodedText);
      } catch (err) {
        console.error("File scan failed", err);
        setQrScanError(lang === 'ar' ? 'لم نتمكن من قراءة رمز QR من الصورة المرفوعة! تأكد أنها صورة واضحة لرمز الاستجابة السريعة للمحل.' : 'Failed to decode QR code from the uploaded image. Ensure the code is clearly visible.');
      } finally {
        try {
          html5QrCode.clear();
        } catch (clearErr) {
          console.warn("Failed to clear hidden scanner:", clearErr);
        }
      }
    } catch (initErr) {
      console.error("Failed to initialize hidden scanner instance:", initErr);
      setQrScanError(lang === 'ar' ? 'حدث خطأ في تهيئة قارئ الصور' : 'Failed to initialize scanner for image upload');
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Clean up scanning on unmount
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            if (document.getElementById("qr-reader-container")) {
              scannerRef.current.stop().catch((err: any) => console.warn("Async stop failed on unmount", err));
            }
          }
        } catch (e) {
          console.warn("Cleanup scanner exception ignored", e);
        }
      }
    };
  }, []);

  // Load shops and check routing
  useEffect(() => {
    // 1. Fetch live registered shops from Firebase / DB
    const loadShopsRegistry = async () => {
      let localShops = DzStoreDB.getShops();
      try {
        const shopsSnap = await getDocs(collection(db, 'shops'));
        if (shopsSnap && !shopsSnap.empty) {
          const liveShops: ShopTenant[] = [];
          shopsSnap.forEach(docSnap => {
            liveShops.push(docSnap.data() as ShopTenant);
          });
          if (liveShops.length > 0) {
            localShops = liveShops;
          }
        }
      } catch (shopErr) {
        console.warn("[CustomerPortal] Using local cached shops:", shopErr);
      }
      setShops(localShops);

      // Check URL Hash routing (e.g. #store-SHOP_ID or #ticket-TICKET_ID)
      const hash = window.location.hash;
      if (hash) {
        if (hash.startsWith('#store-')) {
          const shopId = hash.replace('#store-', '');
          const target = localShops.find(s => s.id === shopId);
          if (target) {
            handleOpenStorefront(target);
          }
        } else if (hash.startsWith('#ticket-')) {
          const ticketId = hash.replace('#ticket-', '');
          setSearchQuery(ticketId);
          triggerSearch(ticketId, localShops);
        }
      }
    };

    loadShopsRegistry();
  }, []);

  const handleOpenStorefront = (shop: ShopTenant) => {
    setSelectedShop(shop);
    setPortalMode('storefront');
    setStorefrontTab('catalog');
    
    // Load products of this specific shop isolated
    const allProds = DzStoreDB.getProducts(shop.id);
    setStoreProducts(allProds);
    setCart([]);
    setOrderSuccess(false);
    setHasTraced(false);
    setTracedJob(null);
  };

  const handleBackToHub = () => {
    setPortalMode('hub');
    setSelectedShop(null);
    window.location.hash = '';
  };

  const triggerSearch = async (queryStr: string, customShopsList?: ShopTenant[]) => {
    const targetShops = customShopsList || shops;
    const translatedQuery = toEnglishDigits(queryStr.trim());
    const q = translatedQuery.toLowerCase();
    if (!q) return;

    setIsQueryingServer(true);
    setHasSearched(false);

    try {
      const jobsFound: { job: MaintenanceJob; shopName: string }[] = [];
      const invoicesFound: { sale: Sale; shopName: string; currency: Currency }[] = [];
      const installmentsFound: { customer: Customer; shopName: string; currency: Currency }[] = [];

      // Fetch live child collections in parallel
      let allJobsDocs: any[] = [];
      let allCustDocs: any[] = [];
      let allSalesDocs: any[] = [];

      try {
        const jobsSnap = await getDocs(collectionGroup(db, 'maintenance'));
        if (jobsSnap && !jobsSnap.empty) allJobsDocs = jobsSnap.docs;
      } catch (e) {
        console.warn("[CustomerPortal] collectionGroup fetch for maintenance failed:", e);
      }

      try {
        const custSnap = await getDocs(collectionGroup(db, 'customers'));
        if (custSnap && !custSnap.empty) allCustDocs = custSnap.docs;
      } catch (e) {
        console.warn("[CustomerPortal] collectionGroup fetch for customers failed:", e);
      }

      try {
        const salesSnap = await getDocs(collectionGroup(db, 'sales'));
        if (salesSnap && !salesSnap.empty) allSalesDocs = salesSnap.docs;
      } catch (e) {
        console.warn("[CustomerPortal] collectionGroup fetch for sales failed:", e);
      }

      // 1. Process Jobs
      if (allJobsDocs.length === 0) {
        targetShops.forEach(shop => {
          const localJobs = DzStoreDB.getMaintenanceJobs(shop.id);
          localJobs.forEach(job => {
            const phoneMatch = isPhoneMatch(job.customerPhone, q);
            const ticketMatch = (job.ticketNumber || '').toLowerCase().includes(q) || (job.id || '').toLowerCase().includes(q);
            if (phoneMatch || ticketMatch) {
              jobsFound.push({ job, shopName: shop.name });
            }
          });
        });
      } else {
        allJobsDocs.forEach(docSnap => {
          const job = docSnap.data() as MaintenanceJob;
          const parentShopId = docSnap.ref.parent.parent?.id || job.shopId;
          const matchedShop = targetShops.find(s => s.id === parentShopId);
          const shopName = matchedShop ? matchedShop.name : 'متجر صيانة';

          const phoneMatch = isPhoneMatch(job.customerPhone, q);
          const ticketMatch = (job.ticketNumber || '').toLowerCase().includes(q) || (job.id || '').toLowerCase().includes(q);

          if (phoneMatch || ticketMatch) {
            jobsFound.push({ job: { ...job, shopId: parentShopId }, shopName });
          }
        });
      }

      // 2. Process Installments
      const matchedCustomersMap = new Map<string, Customer>();
      if (allCustDocs.length === 0) {
        targetShops.forEach(shop => {
          const localCustomers = DzStoreDB.getCustomers(shop.id);
          localCustomers.forEach(cust => {
            if (isPhoneMatch(cust.phone, q) || (cust.name || '').toLowerCase().includes(q)) {
              matchedCustomersMap.set(cust.name, cust);
              installmentsFound.push({ customer: cust, shopName: shop.name, currency: 'DZD' });
            }
          });
        });
      } else {
        allCustDocs.forEach(docSnap => {
          const cust = docSnap.data() as Customer;
          const parentShopId = docSnap.ref.parent.parent?.id || cust.shopId;
          const matchedShop = targetShops.find(s => s.id === parentShopId);
          const shopName = matchedShop ? matchedShop.name : 'متجر مبيعات';

          if (isPhoneMatch(cust.phone, q) || (cust.name || '').toLowerCase().includes(q)) {
            matchedCustomersMap.set(cust.name, { ...cust, shopId: parentShopId });
            installmentsFound.push({ customer: { ...cust, shopId: parentShopId }, shopName, currency: 'DZD' });
          }
        });
      }

      // 3. Process Invoices
      if (allSalesDocs.length === 0) {
        targetShops.forEach(shop => {
          const localSales = DzStoreDB.getSales(shop.id);
          localSales.forEach(sale => {
            const invoiceMatch = (sale.invoiceNumber || '').toLowerCase() === q || (sale.id || '').toLowerCase() === q;
            const customerNameMatch = sale.customerName && sale.customerName.toLowerCase().includes(q);
            const customerPhoneMatch = matchedCustomersMap.has(sale.customerName || '');
            if (invoiceMatch || customerNameMatch || customerPhoneMatch) {
              invoicesFound.push({ sale, shopName: shop.name, currency: 'DZD' });
            }
          });
        });
      } else {
        allSalesDocs.forEach(docSnap => {
          const sale = docSnap.data() as Sale;
          const parentShopId = docSnap.ref.parent.parent?.id || sale.shopId;
          const matchedShop = targetShops.find(s => s.id === parentShopId);
          const shopName = matchedShop ? matchedShop.name : 'متجر مبيعات';

          const invoiceMatch = (sale.invoiceNumber || '').toLowerCase() === q || (sale.id || '').toLowerCase() === q;
          const customerNameMatch = sale.customerName && sale.customerName.toLowerCase().includes(q);
          const customerPhoneMatch = matchedCustomersMap.has(sale.customerName || '');

          if (invoiceMatch || customerNameMatch || customerPhoneMatch) {
            invoicesFound.push({ sale: { ...sale, shopId: parentShopId }, shopName, currency: 'DZD' });
          }
        });
      }

      setMatchedJobs(jobsFound);
      setMatchedInvoices(invoicesFound);
      setMatchedInstallments(installmentsFound);

    } catch (globalErr) {
      console.error("[CustomerPortal Live search] Query execution error:", globalErr);
    } finally {
      setIsQueryingServer(false);
      setHasSearched(true);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerSearch(searchQuery);
  };

  const getWarrantyInfo = (saleDate: string, periodString: string) => {
    const start = new Date(saleDate);
    let days = 90;
    const pLower = (periodString || '').toLowerCase().trim();
    if (pLower.includes('no warranty') || pLower.includes('بدون') || pLower.includes('لا يوجد')) {
      return null;
    } else if (pLower.includes('1 month') || pLower.includes('شهر واحد')) {
      days = 30;
    } else if (pLower.includes('3 month') || pLower.includes('3 أشهر')) {
      days = 90;
    } else if (pLower.includes('6 month') || pLower.includes('6 أشهر')) {
      days = 180;
    } else if (pLower.includes('12 month') || pLower.includes('1 year') || pLower.includes('سنة')) {
      days = 365;
    }
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    const today = new Date();
    const remainingTime = end.getTime() - today.getTime();
    const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));

    return {
      startDateStr: start.toISOString().split('T')[0],
      endDateStr: end.toISOString().split('T')[0],
      remainingDays,
      status: remainingDays > 7 ? 'active' : remainingDays > 0 ? 'expiring' : 'expired'
    };
  };

  const getStatusLabel = (status: MaintenanceJob['status']) => {
    switch (status) {
      case 'pending': return lang === 'ar' ? 'بانتظار الفحص' : 'Pending';
      case 'inspecting': return lang === 'ar' ? 'قيد الفحص والتشخيص' : 'Under Diagnosis';
      case 'repairing': return lang === 'ar' ? 'قيد التصليح حالياً' : 'Being Repaired';
      case 'ready_for_pickup': return lang === 'ar' ? 'جاهز للاستلام! 🎉' : 'Ready for Pickup!';
      case 'delivered': return lang === 'ar' ? 'تم التسليم والحمد لله' : 'Delivered';
      case 'cancelled': return lang === 'ar' ? 'ملغى / يتعذر التصليح' : 'Cancelled';
      default: return status;
    }
  };

  const getStatusColor = (status: MaintenanceJob['status']) => {
    switch (status) {
      case 'ready_for_pickup': return 'bg-emerald-100 text-emerald-800 border-emerald-250';
      case 'delivered': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'cancelled': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  // Add to cart
  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
    triggerToast(lang === 'ar' ? '🛒 تم الإضافة للسلة' : 'Added to cart', 'success');
  };

  const updateCartQty = (productId: string, val: number) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;
    const nextQty = item.quantity + val;
    if (nextQty <= 0) {
      setCart(cart.filter(i => i.product.id !== productId));
    } else {
      setCart(cart.map(i => i.product.id === productId ? { ...i, quantity: nextQty } : i));
    }
  };

  // Place purchase order to current selected shop
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop) return;
    if (cart.length === 0) {
      alert(lang === 'ar' ? 'السلة فارغة! برجاء اختيار منتجات أولاً.' : 'Cart is empty!');
      return;
    }
    if (!orderName.trim() || !orderPhone.trim() || !orderAddress.trim()) {
      alert(lang === 'ar' ? 'برجاء اكمال الاسم، الهاتف، والعنوان.' : 'Complete Name, Phone & Address please.');
      return;
    }

    setSubmittingOrder(true);
    const orderId = 'ord-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
    const totalAmount = cart.reduce((sum, item) => sum + (item.product.sellingPrice * item.quantity), 0);

    const newOrder: CustomerOrder = {
      id: orderId,
      shopId: selectedShop.id,
      customerName: orderName.trim(),
      customerPhone: orderPhone.trim(),
      customerAddress: orderAddress.trim(),
      items: cart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.sellingPrice
      })),
      totalAmount,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(orderNotes.trim() ? { notes: orderNotes.trim() } : {})
    };

    try {
      // 1. Save locally with Multi-tenant isolation
      const currentOrders = DzStoreDB.getOrders(selectedShop.id);
      DzStoreDB.saveOrders(selectedShop.id, [newOrder, ...currentOrders]);

      // 2. Write direct to Cloud Firestore
      await setDoc(doc(db, `shops/${selectedShop.id}/orders`, orderId), newOrder);

      setOrderSuccess(true);
      setCart([]);
      setOrderName('');
      setOrderPhone('');
      setOrderAddress('');
      setOrderNotes('');
    } catch (err) {
      console.error("Failed to place purchase order:", err);
      // Fallback: order is saved locally and will auto-sync next time
      setOrderSuccess(true);
      setCart([]);
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Trace ticket inside specific store
  const handleTraceTicketLocal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop || !localTicketNum.trim()) return;

    const ticketsList = DzStoreDB.getMaintenanceJobs(selectedShop.id);
    const ticket = ticketsList.find(t => 
      t.ticketNumber.toLowerCase().trim() === localTicketNum.toLowerCase().trim() ||
      t.id.toLowerCase().trim() === localTicketNum.toLowerCase().trim()
    );

    if (ticket) {
      setTracedJob(ticket);
      setTracedShopName(selectedShop.name);
    } else {
      setTracedJob(null);
    }
    setHasTraced(true);
  };

  // Direct messaging form inside storefront
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop) return;
    if (!msgName.trim() || !msgPhone.trim() || !msgSubject.trim() || !msgContent.trim()) {
      alert(lang === 'ar' ? '⚠️ يرجى ملء كافة الحقول الأساسية!' : '⚠️ Missing required fields!');
      return;
    }

    const newMessage: CustomerMessage = {
      id: 'msg-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
      shopId: selectedShop.id,
      senderName: msgName.trim(),
      senderPhone: msgPhone.trim(),
      subject: msgSubject.trim(),
      content: msgContent.trim(),
      createdAt: new Date().toISOString(),
      isRead: false,
      ...(msgTicket.trim() ? { ticketRelated: msgTicket.trim() } : {})
    };

    const currentMessages = DzStoreDB.getMessages(selectedShop.id);
    DzStoreDB.saveMessages(selectedShop.id, [newMessage, ...currentMessages]);

    setMsgSuccess(true);
    setMsgSubject('');
    setMsgContent('');
    setMsgTicket('');
    setTimeout(() => setMsgSuccess(false), 8000);
  };

  const triggerToast = (msg: string, role: string) => {
    console.log(`[Toast: ${role}] ${msg}`);
  };

  const totalCartCost = cart.reduce((val, item) => val + (item.product.sellingPrice * item.quantity), 0);
  const productsFiltered = storeProducts.filter(p => 
    p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    p.brand.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    p.type.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div className="max-w-4xl w-full mx-auto p-4 md:p-8 space-y-8 animate-glass-in" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* ==================== VIEW 1: HUB / UNIFIED GLOBAL LOOKUP ==================== */}
      {portalMode === 'hub' && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/50 pb-6 text-start w-full">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-650 text-white rounded-2xl shadow-md transform hover:rotate-6 transition-transform">
                <Smartphone className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 leading-tight">
                  {lang === 'ar' ? 'بوابة الزبائن الذكية والطلب السريع • DzStore' : 'DzStore Smart Consumer Gateway'}
                </h1>
                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                  {lang === 'ar' ? 'تتبع حالة الصيانة، كشوفات الضمان والوصلات، المتاجر والطلب الإلكتروني المباشر.' : 'Verify workshops, purchase smartphone items, and trace repair tickets.'}
                </p>
              </div>
            </div>

            <button
              onClick={onBack}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 px-4 py-2.5 rounded-xl transition-all font-extrabold text-xs cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === 'ar' ? 'بوابة إدارة المحلات (الموظفون)' : 'Staff Gateway'}</span>
            </button>
          </div>

          {/* Smart QR Code Access Entry Portal */}
          <div className="glass-panel p-6 rounded-3xl border border-white bg-indigo-500/5 relative overflow-hidden text-start space-y-5 shadow-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-start gap-3">
              <div className="bg-indigo-650 text-white p-2.5 rounded-2xl shadow-md">
                <QrCode className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-900">
                  {lang === 'ar' ? 'بوابة الدخول الذكية للمحلات' : 'Smart Storefront Access Portal'}
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  {lang === 'ar'
                    ? 'كل محل يمتلك رمز QR خاصاً به تم إنشاؤه من النظام. يرجى مسح الرمز أو إدخال كود المحل الحصري لتصفح المنتجات وتقديم طلبات الشراء أو تتبع صيانتك.'
                    : 'Each shop owns a custom system-generated QR code. Scan the code or enter their shop key to view catalog, submit orders, or trace maintenance tasks.'}
                </p>
              </div>
            </div>

            {/* QR Scan Methods Tabs */}
            <div className="flex border-b border-slate-100 pb-1.5 gap-4 text-xs font-black">
              <button
                type="button"
                onClick={() => { stopCameraScan(); setActiveScanTab('camera'); }}
                className={`pb-1.5 border-b-2 transition-colors cursor-pointer ${activeScanTab === 'camera' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                📷 {lang === 'ar' ? 'مسح بالكاميرا' : 'Camera Scanner'}
              </button>
              <button
                type="button"
                onClick={() => { stopCameraScan(); setActiveScanTab('upload'); }}
                className={`pb-1.5 border-b-2 transition-colors cursor-pointer ${activeScanTab === 'upload' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                🖼️ {lang === 'ar' ? 'تحميل كصورة' : 'Upload QR Image'}
              </button>
              <button
                type="button"
                onClick={() => { stopCameraScan(); setActiveScanTab('manual'); }}
                className={`pb-1.5 border-b-2 transition-colors cursor-pointer ${activeScanTab === 'manual' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                ✏️ {lang === 'ar' ? 'إدخال كود المحل' : 'Enter Shop ID'}
              </button>
            </div>

            {qrScanError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-850 p-3 rounded-2xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{qrScanError}</span>
              </div>
            )}

            {/* Hidden container required by html5-qrcode for offline file scanning */}
            <div id="qr-reader-container-hidden" className="hidden" />

            {/* CAMERA TAB */}
            <div className={activeScanTab === 'camera' ? 'space-y-4' : 'hidden'}>
              <div className="relative max-w-sm mx-auto bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-md flex flex-col items-center justify-center p-4">
                {/* Scanner video element placeholder */}
                <div id="qr-reader-container" className="w-full aspect-square max-h-[250px] bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center relative">
                  {!isScanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-5 text-slate-400 space-y-3">
                      <QrCode className="w-12 h-12 text-indigo-400 opacity-60" />
                      <p className="text-xs font-extrabold">{lang === 'ar' ? 'الكاميرا غير نشطة حالياً' : 'Camera is currently inactive'}</p>
                      <p className="text-[10px] text-slate-500 leading-snug">
                        {lang === 'ar' ? 'انقر على الزر بالأسفل لبدء تشغيل كاميرا الهاتف لمسح رمز QR المطبوع.' : 'Click start to open back camera for scanning printed tags.'}
                      </p>
                    </div>
                  )}
                </div>
                
                {isScanning && (
                  <div className="absolute top-6 left-6 right-6 bottom-16 border-2 border-indigo-400 border-dashed rounded-xl pointer-events-none animate-pulse">
                    <div className="absolute inset-x-0 top-1/2 h-0.5 bg-indigo-500/80 animate-bounce" />
                  </div>
                )}
              </div>

              <div className="flex justify-center">
                {!isScanning ? (
                  <button
                    type="button"
                    onClick={startCameraScan}
                    className="bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold text-xs px-6 py-3 rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    📷 {lang === 'ar' ? 'تشغيل الكاميرا للمسح' : 'Start Camera Scan'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCameraScan}
                    className="bg-rose-650 hover:bg-rose-750 text-white font-extrabold text-xs px-6 py-3 rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    🛑 {lang === 'ar' ? 'إيقاف الكاميرا' : 'Stop Scanner'}
                  </button>
                )}
              </div>
            </div>

            {/* UPLOAD TAB */}
            {activeScanTab === 'upload' && (
              <div className="bg-white border-2 border-dashed border-slate-200 p-6 rounded-2xl text-center space-y-3">
                <Upload className="w-10 h-10 mx-auto text-indigo-500 opacity-70" />
                <div>
                  <p className="text-xs font-extrabold text-slate-800">
                    {lang === 'ar' ? 'اختر صورة الرمز من الاستوديو أو الملفات' : 'Pick QR screenshot from photo library'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                    {lang === 'ar'
                      ? 'مفيد جداً إذا قام صاحب المحل بإرسال رمز QR لك كصورة عبر فيسبوك أو واتساب.'
                      : 'Ideal if the shop owner shared their QR code via WhatsApp or messenger.'}
                  </p>
                </div>
                
                <div className="flex justify-center pt-2">
                  <label className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-extrabold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-xs transition-colors">
                    <span>📁 {lang === 'ar' ? 'اختيار صورة الرمز' : 'Choose File'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQrImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* MANUAL TAB */}
            {activeScanTab === 'manual' && (
              <div className="bg-white border p-5 rounded-2xl space-y-3.5 shadow-xs">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 mb-1">
                    {lang === 'ar' ? 'كود تعريف المحل (Shop ID / Code):' : 'Enter unique shop ID key:'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="shop-XXXXXXXXXXXXX"
                    value={manualShopCode}
                    onChange={(e) => setManualShopCode(e.target.value.trim())}
                    className="w-full text-center font-mono font-bold text-xs bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!manualShopCode) return;
                    handleDecodeShopCode(manualShopCode);
                  }}
                  className="w-full bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold text-xs py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  🏪 {lang === 'ar' ? 'دخول متجر المحل' : 'Enter Storefront'}
                </button>
              </div>
            )}
          </div>

          {/* Unified Global Query Bar */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-100 shadow-md bg-white">
            <h2 className="text-sm font-extrabold text-slate-850 text-start flex items-center gap-2 mb-2.5">
              <Search className="w-4 h-4 text-indigo-650" />
              <span>{lang === 'ar' ? 'البحث التقني والمالي الموحد (برقم الهاتف)' : 'Unified Consumer Query Engine (By Phone)'}</span>
            </h2>

            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                placeholder={lang === 'ar' ? 'أدخل رقم هاتفك (مثال: 0555123456) أو رقم التذكرة / الفاتورة...' : 'Enter phone number, invoice code or repair ticker serial...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={isQueryingServer}
                className="bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold text-xs px-6 py-3.5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {isQueryingServer ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>{isQueryingServer ? (lang === 'ar' ? 'جاري الفحص المباشر...' : 'Searching...') : (lang === 'ar' ? 'تتبع وبحث' : 'Search Account')}</span>
              </button>
            </form>
          </div>

          {/* Global Search Results Block */}
          {hasSearched && (
            <div className="space-y-6 animate-glass-in text-start">
              
              {matchedJobs.length === 0 && matchedInvoices.length === 0 && matchedInstallments.length === 0 && (
                <div className="p-8 text-center bg-slate-50 border rounded-3xl space-y-3">
                  <AlertCircle className="w-10 h-10 mx-auto text-slate-400" />
                  <p className="font-extrabold text-sm text-slate-700">{lang === 'ar' ? 'عذراً! لم نجد أي سجلات مطابقة.' : 'No matching consumer records found.'}</p>
                  <p className="text-xs text-slate-500">{lang === 'ar' ? 'تأكد من كتابة رقم الهاتف بشكل صحيح.' : 'Check telephone digits alignment or contact your shop operator.'}</p>
                </div>
              )}

              {/* Maintenance list */}
              {matchedJobs.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-black text-xs text-slate-500 uppercase tracking-widest flex items-center gap-1.5 border-b pb-1.5">
                    <Wrench className="w-4 h-4 text-indigo-600" />
                    <span>{lang === 'ar' ? 'طلبات وبطاقات ورشة الصيانة المكتشفة:' : 'Active Workshop Repairs tracking:'}</span>
                  </h3>

                  {matchedJobs.map(({ job, shopName }) => (
                    <div key={job.id} className="bg-white border rounded-3xl p-5 shadow-xs flex flex-col md:flex-row justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{shopName}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(job.status)}`}>
                            {getStatusLabel(job.status)}
                          </span>
                        </div>
                        <h4 className="font-black text-sm text-slate-900">📱 {job.deviceModel}</h4>
                        <p className="text-[10.5px] text-slate-400 font-mono">Ticket: #{job.ticketNumber} | Substituted: {new Date(job.createdAt).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-650 font-medium">⚠️ {lang === 'ar' ? 'العطل المصرح به:' : 'Problem:'} {job.issueDescription}</p>
                        {job.notes && <p className="text-[11px] bg-slate-50 text-slate-600 p-2.5 rounded-xl border border-dashed mt-2">💡 {lang === 'ar' ? 'ملاحظة الورشة:' : 'Workshop Note:'} {job.notes}</p>}
                      </div>

                      <div className="bg-slate-50 p-4 border rounded-2xl text-center flex flex-col items-center justify-center min-w-[150px]">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">{lang === 'ar' ? 'تكلفة التصليح ككل:' : 'Repair Expense:'}</span>
                        <strong className="text-lg font-black text-indigo-650 font-mono mt-0.5">{job.finalCost || job.estimatedCost} DZD</strong>
                        <span className="text-[8.5px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 border border-emerald-150 rounded font-black mt-2">
                          {lang === 'ar' ? 'دفعة مسبقة:' : 'Paid Advance:'} {job.amountPaid} DZD
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Invoices List */}
              {matchedInvoices.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-black text-xs text-slate-500 uppercase tracking-widest flex items-center gap-1.5 border-b pb-1.5">
                    <Receipt className="w-4 h-4 text-indigo-600" />
                    <span>{lang === 'ar' ? 'وصولات وفواتير الشراء النشطة:' : 'Official Certified Invoices:'}</span>
                  </h3>

                  {matchedInvoices.map(({ sale, shopName }) => (
                    <div key={sale.id} className="bg-white border rounded-3xl p-5 shadow-xs space-y-4">
                      <div className="flex justify-between items-center border-b pb-2">
                        <div>
                          <span className="text-[9px] font-black text-indigo-800 bg-indigo-55/10 px-2 rounded">{shopName}</span>
                          <h4 className="font-extrabold text-xs text-slate-800 mt-1">🧾 {lang === 'ar' ? 'رقم الوصول:' : 'Receipt:'} <span className="font-mono text-slate-900">#{sale.invoiceNumber}</span></h4>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">{new Date(sale.date).toLocaleDateString()}</span>
                      </div>

                      <div className="text-xs space-y-1">
                        {sale.items.map((itm, i) => (
                          <div key={i} className="flex justify-between font-bold text-slate-700 py-1 border-b border-slate-50">
                            <span>📱 {itm.name} (x{itm.quantity})</span>
                            <span className="font-mono text-slate-900">{itm.price * itm.quantity} DZD</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <span className="text-[10px] text-slate-400 font-bold">{lang === 'ar' ? 'الضمان الكفالة:' : 'Warranty Coverage:'} <strong className="text-rose-600 font-serif">{sale.warrantyPeriod}</strong></span>
                        <span className="text-sm font-black text-emerald-600 font-mono">{sale.total.toLocaleString()} DZD</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ==================== VIEW 2: STORE-SPECIFIC E-COMMERCE & ORDERING PORTAL ==================== */}
      {portalMode === 'storefront' && selectedShop && (
        <div className="space-y-6">
          
          {/* Store welcome head bento frame */}
          <div className="bg-slate-900 text-white p-6 lg:p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden text-start">
            <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <button
              onClick={handleBackToHub}
              className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer transition-transform shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'الرجوع ومسح' : 'Go Back'}</span>
            </button>

            <div className="space-y-3.5 mt-2">
              <span className="text-[9px] bg-amber-500/10 text-amber-500 font-black tracking-widest uppercase rounded px-2 py-0.5 border border-amber-500/20">DZSTORE CHOSEN SHOPFRONT</span>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
                <div>
                  <h2 className="text-2xl font-black text-white">{selectedShop.name}</h2>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span>{selectedShop.address}</span>
                    <span>|</span>
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="font-mono">{selectedShop.phone}</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <a
                    href={`https://wa.me/${cleanPhone(selectedShop.phone)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] py-2 px-3.5 rounded-xl transition-all shadow-sm flex items-center gap-1"
                  >
                    💬 WhatsApp
                  </a>
                  <button
                    onClick={() => setStorefrontTab('contact')}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-black text-[10px] py-2 px-3.5 rounded-xl transition-all shadow-sm"
                  >
                    📬 {lang === 'ar' ? 'راسل المتجر' : 'Send Message'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Component inner navigation tabs */}
          <div className="flex border-b border-slate-200 overflow-x-auto gap-2.5 pb-px text-start">
            <button
              onClick={() => setStorefrontTab('catalog')}
              className={`px-3 py-2 text-xs font-black cursor-pointer border-b-2 transition-all flex items-center gap-1.5 ${
                storefrontTab === 'catalog' ? 'border-indigo-600 text-indigo-700 font-black' : 'border-transparent text-slate-500'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{lang === 'ar' ? 'كتالوج المنتجات والإكسسوارات' : 'Browse Catalog'}</span>
              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px] font-mono">{productsFiltered.length}</span>
            </button>

            <button
              onClick={() => setStorefrontTab('order')}
              className={`px-3 py-2 text-xs font-black cursor-pointer border-b-2 transition-all relative flex items-center gap-1.5 ${
                storefrontTab === 'order' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{lang === 'ar' ? 'سلة المشتريات والطلب' : 'My Cart'}</span>
              {cart.length > 0 && (
                <span className="absolute -top-1 right-1 bg-rose-600 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center animate-bounce">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>

            <button
              onClick={() => setStorefrontTab('track')}
              className={`px-3 py-2 text-xs font-black cursor-pointer border-b-2 transition-all flex items-center gap-1.5 ${
                storefrontTab === 'track' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>{lang === 'ar' ? 'تتبع تذكرة صيانة هاتفك' : 'Track Local Repair'}</span>
            </button>

            <button
              onClick={() => setStorefrontTab('contact')}
              className={`px-3 py-2 text-xs font-black cursor-pointer border-b-2 transition-all flex items-center gap-1.5 ${
                storefrontTab === 'contact' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>{lang === 'ar' ? 'مراسلة مباشرة غلق تذكرة' : 'Direct Workspace Chat'}</span>
            </button>
          </div>

          {/* TAB CONTENT RENDERING */}
          {storefrontTab === 'catalog' && (
            <div className="space-y-4">
              {/* Product search box */}
              <div className="relative">
                <Search className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'ابحث عن هاتف، شاحن، غلاف، حماية شاشة...' : 'Search handset, cases, charger...'}
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-205 py-3 pr-10 pl-4 rounded-2xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {productsFiltered.length === 0 ? (
                <div className="bg-slate-50 py-12 rounded-3xl text-center text-slate-400">
                  <ShoppingBag className="w-12 h-12 mx-auto opacity-20 mb-2" />
                  <p>{lang === 'ar' ? 'لا توجد منتجات مسجلة مطابقة لبحثك في المتجر.' : 'No matched items in this storefront.'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-start">
                  {productsFiltered.map(p => (
                    <div key={p.id} className="bg-white border rounded-2xl p-4.5 flex flex-col justify-between gap-4.5 hover:shadow-md transition-all">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[8.5px] uppercase font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">{p.brand}</span>
                          <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded-full ${p.quantity > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                            {p.quantity > 0 ? (lang === 'ar' ? 'متوفر' : 'In Stock') : (lang === 'ar' ? 'نفذ' : 'Out of Stock')}
                          </span>
                        </div>
                        
                        <h4 className="font-extrabold text-sm text-slate-900 mt-2">📱 {p.name}</h4>
                        <p className="text-[10px] text-slate-400 font-medium">Type: {p.type}</p>
                        {p.notes && <p className="text-[11px] text-slate-500 mt-1 pb-1">{p.notes}</p>}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-base font-black text-rose-600 font-mono">{p.sellingPrice.toLocaleString()} DZD</span>
                        <button
                          onClick={() => addToCart(p)}
                          disabled={p.quantity <= 0}
                          className="bg-indigo-600 hover:bg-indigo-750 disabled:bg-slate-200 text-white font-extrabold text-[10.5px] px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                        >
                          + {lang === 'ar' ? 'أضف للسلة' : 'Add to Cart'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CART AND PURCHASE ORDER SUBMISSION */}
          {storefrontTab === 'order' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-start">
              
              {/* Left col: Cart items list */}
              <div className="md:col-span-2 space-y-4">
                <div className="bg-white border rounded-3xl p-5 space-y-3.5">
                  <h3 className="font-black text-sm text-slate-800 border-b pb-2">🛒 {lang === 'ar' ? 'محتويات سلتك الحالية:' : 'Your Cart Contents:'}</h3>

                  {cart.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                      <ShoppingCart className="w-10 h-10 mx-auto opacity-10 mb-2" />
                      <p>{lang === 'ar' ? 'سلتك فارغة! تصفح الكتالوج وأضف بانتظار الشراء.' : 'Cart is absolutely empty.'}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 font-sans">
                      {cart.map(item => (
                        <div key={item.product.id} className="py-3 flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <span className="text-[8px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-500 uppercase font-bold">{item.product.brand}</span>
                            <h4 className="font-bold text-xs text-slate-900 mt-0.5">{item.product.name}</h4>
                            <p className="text-rose-600 font-mono text-[10.5px] font-extrabold mt-0.5">{item.product.sellingPrice} DZD</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateCartQty(item.product.id, -1)}
                              className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-mono font-black text-xs min-w-[20px] text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateCartQty(item.product.id, 1)}
                              className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => updateCartQty(item.product.id, -item.quantity)}
                              className="w-7 h-7 hover:bg-rose-50 rounded-lg flex items-center justify-center text-rose-500 cursor-pointer border border-transparent hover:border-rose-200 ml-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      <div className="pt-4 flex justify-between items-center font-black text-slate-900 border-t mt-4 text-xs">
                        <span>{lang === 'ar' ? 'إجمالي مبلغ المنتجات:' : 'Total Amount:'}</span>
                        <span className="text-rose-600 font-mono text-base">{totalCartCost.toLocaleString()} DZD</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right col: Shipping Form & checkout button */}
              <div className="space-y-4">
                <div className="bg-white border rounded-3xl p-5 space-y-4">
                  <h3 className="font-black text-sm text-slate-800 border-b pb-2">📦 {lang === 'ar' ? 'معلومات التوصيل والطلب الكلي:' : 'Shipping Address:'}</h3>
                  
                  {orderSuccess ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold leading-relaxed text-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1 animate-bounce" />
                      <p>{lang === 'ar' ? '🎉 تم تقديم طلبيتك بنجاح وبسرور!' : 'Order received!'}</p>
                      <p className="text-[10px] text-slate-550 mt-1 leading-normal">
                        {lang === 'ar' ? 'لقد وصلت التفاصيل لمدير المتجر مباشرة وسيتم مراجعتها والاتصال بك هاتفياً.' : 'The store operator will contact you via phone shortly.'}
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handlePlaceOrder} className="space-y-3.5 text-xs">
                      <div>
                        <label className="font-bold text-slate-650 block mb-1">{lang === 'ar' ? 'الاسم بالكامل *' : 'Full Name *'}</label>
                        <input
                          type="text"
                          required
                          value={orderName}
                          onChange={e => setOrderName(e.target.value)}
                          placeholder={lang === 'ar' ? 'مثال: بهاء الدين الجزائري' : 'e.g. John Doe'}
                          className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold font-sans"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-650 block mb-1">{lang === 'ar' ? 'رقم الهاتف للتواصل *' : 'Phone *'}</label>
                        <input
                          type="text"
                          required
                          value={orderPhone}
                          onChange={e => setOrderPhone(e.target.value)}
                          placeholder="e.g. 0555..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold font-mono text-start"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-650 block mb-1">{lang === 'ar' ? 'العنوان / مكان الإقامة *' : 'Delivery Address *'}</label>
                        <textarea
                          required
                          rows={2}
                          value={orderAddress}
                          onChange={e => setOrderAddress(e.target.value)}
                          placeholder={lang === 'ar' ? 'اكتب الولاية، المدينة ومكان التسليم بوضوح...' : 'City, Street...'}
                          className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold font-sans resize-none"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-650 block mb-1">{lang === 'ar' ? 'ملاحظات إضافية (اختياري)' : 'Order Notes (Optional)'}</label>
                        <input
                          type="text"
                          value={orderNotes}
                          onChange={e => setOrderNotes(e.target.value)}
                          placeholder={lang === 'ar' ? 'توصيل في الفترة المسائية...' : 'Delivery details...'}
                          className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold font-sans"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={cart.length === 0 || submittingOrder}
                        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-750 disabled:bg-slate-200 text-white rounded-xl font-extrabold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
                      >
                        {submittingOrder ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span>{lang === 'ar' ? 'إرسال طلبية الشراء الفوري كلياً' : 'Confirm Purchase Order'}</span>
                      </button>
                    </form>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* LOCAL WORKSHOP REPAIR TRACKER FOR A SPECIFIC STORE */}
          {storefrontTab === 'track' && (
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="bg-white border rounded-3xl p-6 shadow-xs text-start space-y-4">
                <h3 className="font-black text-sm text-slate-800 flex items-center gap-1.5 leading-snug">
                  <Wrench className="w-4 h-4 text-indigo-650" />
                  <span>{lang === 'ar' ? 'تتبع فوري لتذكرة الصيانة الخاصة بجهازك' : 'Workshop Repair Ticket Lookup'}</span>
                </h3>

                <form onSubmit={handleTraceTicketLocal} className="flex gap-2 text-xs">
                  <input
                    type="text"
                    required
                    placeholder={lang === 'ar' ? 'أدخل كود التذكرة (مثل: TK-2026-0002) أو تدوين IMEI...' : 'Enter ticket ID or IMEI...'}
                    value={localTicketNum}
                    onChange={e => setLocalTicketNum(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-205 px-4 py-2.5 rounded-xl font-black font-sans text-xs focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-5 py-2.5 rounded-xl cursor-pointer shadow-sm shrink-0"
                  >
                    {lang === 'ar' ? 'استعلام' : 'Track'}
                  </button>
                </form>

                {hasTraced && !tracedJob && (
                  <div className="p-4 bg-slate-50 text-slate-500 rounded-2xl italic text-xs text-center border">
                    {lang === 'ar' ? '⚠️ عوداً! لم يتم اكتشاف تذكرة صيانة مطابقة في هذا المحل حالياً...' : 'No workshop ticket matched.'}
                  </div>
                )}

                {hasTraced && tracedJob && (
                  <div className="border border-slate-200 rounded-2xl p-5 space-y-5 animate-glass-in">
                    <div className="flex justify-between items-center border-b pb-3">
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900">📱 {tracedJob.deviceModel}</h4>
                        <p className="text-[10px] text-slate-400 font-mono">Ticket No: #{tracedJob.ticketNumber}</p>
                      </div>
                      <span className={`text-[10.5px] font-black px-2.5 py-1 rounded-full border ${getStatusColor(tracedJob.status)}`}>
                        {getStatusLabel(tracedJob.status)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-normal font-sans">
                      <span className="font-extrabold block text-slate-400 text-[10px] uppercase">{lang === 'ar' ? 'العطل المسجل:' : 'Problem Details:'}</span>
                      <strong className="text-slate-800 font-sans mt-0.5">{tracedJob.issueDescription}</strong>
                    </p>

                    <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                      <div>
                        <span className="text-[10px] text-slate-400 block">{lang === 'ar' ? 'التكلفة الإجمالية:' : 'Grand cost:'}</span>
                        <strong className="text-slate-800 font-mono">{tracedJob.finalCost || tracedJob.estimatedCost} DZD</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">{lang === 'ar' ? 'المبلغ المسدد مسبقاً:' : 'Paid Sum:'}</span>
                        <strong className="text-emerald-500 font-mono">{tracedJob.amountPaid} DZD</strong>
                      </div>
                    </div>

                    {tracedJob.notes && (
                      <p className="p-3 bg-indigo-500/5 text-slate-700 text-xs rounded-xl border border-dashed font-sans">
                        💡 <strong className="text-indigo-800">{lang === 'ar' ? 'توضيح تقني:' : 'Diagnostic:'}</strong> {tracedJob.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DUST DIRECT COMMUNICATIONS FOR SPECIFIC SHOP CHAT */}
          {storefrontTab === 'contact' && (
            <div className="max-w-xl mx-auto">
              <div className="bg-white border rounded-3xl p-5 space-y-4 text-start">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Mail className="w-5 h-5 text-indigo-600 animate-bounce" />
                  <h3 className="font-black text-sm text-slate-800">{lang === 'ar' ? 'إرسال مراسلة للمحل مباشرة' : 'Send Direct Store Inquiry'}</h3>
                </div>

                {msgSuccess ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold leading-relaxed text-center">
                    {lang === 'ar' ? '🎉 تم تسليم رسالتك للمتجر بنجاح! سيتم فحصها والتواصل معك قريباً.' : 'Message sent successfully!'}
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="space-y-3.5 text-xs">
                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="font-semibold block text-slate-650">{lang === 'ar' ? 'الاسم بالكامل *' : 'Name *'}</label>
                        <input
                          type="text"
                          required
                          value={msgName}
                          onChange={e => setMsgName(e.target.value)}
                          placeholder="Baha"
                          className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                        />
                      </div>
                      <div>
                        <label className="font-semibold block text-slate-650">{lang === 'ar' ? 'رقم هاتف للتواصل *' : 'Phone *'}</label>
                        <input
                          type="text"
                          required
                          value={msgPhone}
                          onChange={e => setMsgPhone(e.target.value)}
                          placeholder="+213"
                          className="w-full p-2.5 bg-slate-50 border rounded-xl font-black font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold block text-slate-650">{lang === 'ar' ? 'رقم التذكرة أو الفاتورة (اختياري)' : 'Ticket ID (Optional)'}</label>
                      <input
                        type="text"
                        value={msgTicket}
                        onChange={e => setMsgTicket(e.target.value)}
                        placeholder="TK-1029..."
                        className="w-full p-2.5 bg-slate-50 border rounded-xl font-black font-mono"
                      />
                    </div>

                    <div>
                      <label className="font-semibold block text-slate-650">{lang === 'ar' ? 'موضوع الرسالة *' : 'Subject *'}</label>
                      <input
                        type="text"
                        required
                        value={msgSubject}
                        onChange={e => setMsgSubject(e.target.value)}
                        placeholder="استفسار عن تصليح هاتف..."
                        className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                      />
                    </div>

                    <div>
                      <label className="font-semibold block text-slate-650">{lang === 'ar' ? 'محتوى ونصوص الرسالة *' : 'Message content *'}</label>
                      <textarea
                        required
                        rows={3}
                        value={msgContent}
                        onChange={e => setMsgContent(e.target.value)}
                        placeholder="أدخل رسالتك هنا..."
                        className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold resize-none font-sans"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-indigo-650 hover:bg-indigo-750 text-white font-black rounded-xl cursor-pointer transition-all"
                    >
                      {lang === 'ar' ? 'إرسال الرسالة لإدارة المتجر' : 'Deliver Message'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Helpful terms and info footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 border rounded-3xl text-slate-500 mt-6 text-center sm:text-start leading-relaxed shrink-0">
        <div className="flex items-center gap-2.5">
          <Info className="w-5 h-5 text-indigo-650 shrink-0" />
          <span className="text-[10.5px]">
            {lang === 'ar'
              ? 'تتم معالجة وضمان الخصوصية والبيانات للوصولات تلقائياً. في حال وجود مشكلة، اتصل مباشرة بالدعم الفني.'
              : 'Our distributed consumer security checks operate independently without cookies trackers.'
            }
          </span>
        </div>
        <p className="text-[9.5px] font-mono whitespace-nowrap">DzStore Terminal System v3.5.2</p>
      </div>

    </div>
  );
};
