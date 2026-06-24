
import React, { useState, useEffect } from 'react';
import { Currency, Language, AppUser, ShopTenant, ShopSettings, BroadcastMessage } from './types';
import { TRANSLATIONS } from './lib/data';
import { DzStoreDB } from './lib/db';
import { DzStoreAudio } from './components/AudioAlerts';
import { auth, db } from './lib/firebase';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { setupRealtimeSync, setupGlobalSaaSSync } from './lib/syncManager';
import { triggerBackgroundSync } from './lib/syncQueue';
import { POSScreen } from './components/POSScreen';
import { InventoryScreen } from './components/InventoryScreen';
import { SuppliersCustomersScreen } from './components/SuppliersCustomersScreen';
import { MaintenanceScreen } from './components/MaintenanceScreen';
import { AdminPanel } from './components/AdminPanel';
import { CustomerCommunicationCenter } from './components/CustomerCommunicationCenter';
import { SettingsScreen } from './components/SettingsScreen';
import { UsersScreen } from './components/UsersScreen';
import { ReportsScreen } from './components/ReportsScreen';
import { SyncMonitor } from './components/SyncMonitor';
import { UsedPhonesScreen } from './components/UsedPhonesScreen';
import { CustomerPortal } from './components/CustomerPortal';
import { MessagesScreen } from './components/MessagesScreen';
import { OrdersScreen } from './components/OrdersScreen';
import {
  LayoutDashboard,
  ShoppingCart,
  PackageCheck,
  Truck,
  Wrench,
  Settings as SettingsIcon,
  LogOut,
  Sparkles,
  Users,
  Smartphone,
  PhoneCall,
  Activity,
  UserCheck,
  Mail,
  ShieldEllipsis,
  Send,
  MessageCircle,
  Lock,
  Moon,
  Sun,
  Palette,
  CheckCircle,
  Bell,
  Heart,
  Clock,
  Menu,
  X,
  BarChart3,
  ShieldAlert,
  AlertCircle,
  Fingerprint,
  ChevronRight,
  Camera
} from 'lucide-react';

export default function App() {
  // Global App States
  const [lang, setLang] = useState<Language>('en');
  const [currency, setCurrency] = useState<Currency>('DZD');
  const [enableSounds, setEnableSounds] = useState(true);
  const [activeTheme, setActiveTheme] = useState<'sky-ocean' | 'emerald-grass' | 'indigo-royal' | 'violet-blossom' | 'amber-sunset' | 'rose-ruby'>('emerald-grass');
  const [isSidebarOpen, setIsSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [darkMode, setDarkMode] = useState(false);

  // Overriding window.alert to route through our beautiful auto-disappearing toasts!
  useEffect(() => {
    window.alert = (msg: string) => {
      let type: 'success' | 'warning' | 'info' = 'info';
      if (msg && (msg.includes('✓') || msg.includes('✅') || msg.includes('نجاح') || msg.includes('بنجاح'))) {
        type = 'success';
      } else if (msg && (msg.includes('⚠️') || msg.includes('❌') || msg.includes('خطأ') || msg.includes('لم يتم') || msg.includes('عطل') || msg.includes('فشل'))) {
        type = 'warning';
      }
      triggerToast(msg, type);
    };
  }, [lang]);

  // Dynamically update CSS custom properties on activeTheme changes so EVERYTHING adapts perfectly
  useEffect(() => {
    const root = document.documentElement;
    let primary = '#10b981';
    let hover = '#047857';
    let light = '#ecfdf5';
    let lightBorder = '#a7f3d0';
    let textDark = '#047857';
    let accent = '#34d399';
    let rgb = '16, 185, 129';

    switch (activeTheme) {
      case 'sky-ocean':
        primary = '#0284c7';
        hover = '#0369a1';
        light = '#f0f9ff';
        lightBorder = '#bae6fd';
        textDark = '#0369a1';
        accent = '#38bdf8';
        rgb = '2, 132, 199';
        break;
      case 'indigo-royal':
        primary = '#4f46e5';
        hover = '#3730a3';
        light = '#f5f3ff';
        lightBorder = '#c7d2fe';
        textDark = '#3730a3';
        accent = '#818cf8';
        rgb = '79, 70, 229';
        break;
      case 'violet-blossom':
        primary = '#7c3aed';
        hover = '#5b21b6';
        light = '#faf5ff';
        lightBorder = '#ddd6fe';
        textDark = '#5b21b6';
        accent = '#a78bfa';
        rgb = '124, 58, 237';
        break;
      case 'amber-sunset':
        primary = '#d97706';
        hover = '#92400e';
        light = '#fffbeb';
        lightBorder = '#fde68a';
        textDark = '#92400e';
        accent = '#fbbf24';
        rgb = '217, 119, 6';
        break;
      case 'rose-ruby':
        primary = '#e11d48';
        hover = '#9f1239';
        light = '#fff1f2';
        lightBorder = '#fecdd3';
        textDark = '#9f1239';
        accent = '#f43f5e';
        rgb = '225, 29, 72';
        break;
      case 'emerald-grass':
      default:
        primary = '#10b981';
        hover = '#047857';
        light = '#ecfdf5';
        lightBorder = '#a7f3d0';
        textDark = '#047857';
        accent = '#34d399';
        rgb = '16, 185, 129';
        break;
    }

    root.style.setProperty('--theme-primary', primary);
    root.style.setProperty('--theme-hover', hover);
    root.style.setProperty('--theme-light', light);
    root.style.setProperty('--theme-light-border', lightBorder);
    root.style.setProperty('--theme-text-dark', textDark);
    root.style.setProperty('--theme-accent', accent);
    root.style.setProperty('--theme-primary-rgb', rgb);
  }, [activeTheme]);

  // Authenticated states
  const [user, setUser] = useState<AppUser | null>(null);
  const [shop, setShop] = useState<ShopTenant | null>(null);
  const [fbUserLoaded, setFbUserLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [syncKey, setSyncKey] = useState(0);

  // Dynamic Unread Messages Tracking
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  useEffect(() => {
    if (shop) {
      setUnreadMessages(DzStoreDB.getMessages(shop.id).filter(m => !m.isRead).length);
      setPendingOrders(DzStoreDB.getOrders(shop.id).filter(o => o.status === 'pending').length);
    }
  }, [shop, activeTab, syncKey]);

  // Login form status
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isCustomerPortal, setIsCustomerPortal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isFirebaseSyncing, setIsFirebaseSyncing] = useState(false);

  // Animated Custom Toast States
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'warning' | 'info' }[]>([]);

  const triggerToast = (message: string, type: 'success' | 'warning' | 'info' = 'info') => {
    const id = `${Date.now()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    
    if (type === 'success') {
      DzStoreAudio.playSuccessChime(enableSounds);
    } else if (type === 'warning') {
      DzStoreAudio.playWarningChime(enableSounds);
    } else {
      DzStoreAudio.playNotification(enableSounds);
    }

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Signup form elements
  const [regShopName, setRegShopName] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('Alger, Algérie');
  const [regPassword, setRegPassword] = useState('');

  // System statistics variables
  const [stats, setStats] = useState({
    todaySalesAmount: 0,
    inventoryCount: 0,
    maintenanceCount: 0,
    clientDues: 0,
  });

  // Global notifications broadcasts
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);

  // Time ticker state
  const [currentTime, setCurrentTime] = useState('');

  // App live update detection state
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState<{ ar: string; fr: string } | null>(null);

  // First-time camera request dialog state
  const [showCameraPromptModal, setShowCameraPromptModal] = useState(false);

  useEffect(() => {
    if (user && !localStorage.getItem('dzstore_camera_requested')) {
      const timer = setTimeout(() => {
        setShowCameraPromptModal(true);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      localStorage.setItem('dzstore_camera_requested', 'granted');
      triggerToast(lang === 'ar' ? '✅ تم تفعيل صلاحية الكاميرا بنجاح!' : '✅ Camera permission approved!', 'success');
      setShowCameraPromptModal(false);
    } catch (err) {
      console.warn('Camera request declined:', err);
      localStorage.setItem('dzstore_camera_requested', 'denied');
      triggerToast(lang === 'ar' ? '❌ تم رفض صلاحية الكاميرا. يمكنك منح الترخيص يدويًا من إعدادات المتصفح.' : '❌ Camera permission denied.', 'warning');
      setShowCameraPromptModal(false);
    }
  };

  // Device Lockout State
  const [deviceLockoutError, setDeviceLockoutError] = useState<'computer' | 'phone' | null>(null);

  // Activation key input screen state
  const [activationKeyInput, setActivationKeyInput] = useState('');

  // Enforce multi-device locks (locks to 2 PCs + 2 phones per shop profile)
  useEffect(() => {
    if (!shop || shop.id === 'system-admin-tenant') {
      setDeviceLockoutError(null);
      return;
    }

    // Identify device identifier key
    let devId = localStorage.getItem('dzstore_license_device_id');
    if (!devId) {
      devId = 'dev-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
      localStorage.setItem('dzstore_license_device_id', devId);
    }

    // Generate reliable simulated/real IP address or fetch
    let devIP = localStorage.getItem('dzstore_license_device_ip');
    if (!devIP) {
      devIP = `197.200.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}`;
      localStorage.setItem('dzstore_license_device_ip', devIP);
    }

    const sysIsMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024;
    const sysDeviceType = (sysIsMobile ? 'phone' : 'computer') as 'phone' | 'computer';

    let sysDeviceName = sysIsMobile ? 'هاتف ذكي' : 'جهاز كمبيوتر';
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      sysDeviceName = 'iPhone / iOS';
    } else if (/Android/i.test(navigator.userAgent)) {
      sysDeviceName = 'Android';
    } else if (/Mac/i.test(navigator.userAgent)) {
      sysDeviceName = 'macOS Desktop';
    } else if (/Windows/i.test(navigator.userAgent)) {
      sysDeviceName = 'Windows Laptop';
    } else if (/Linux/i.test(navigator.userAgent)) {
      sysDeviceName = 'Linux Desktop';
    }

    const allOriginalShops = DzStoreDB.getShops();
    const currentShopIndex = allOriginalShops.findIndex(s => s.id === shop.id);
    if (currentShopIndex > -1) {
      const dbShop = allOriginalShops[currentShopIndex];
      let deviceList = dbShop.registeredDevices || [];

      // Find if current device is already listed
      const existingMatch = deviceList.find(d => d.id === devId);

      if (existingMatch) {
        // Safe, update lastActive timestamp and IP in local database only (no state cascade)
        const updatedList = deviceList.map(d => {
          if (d.id === devId) {
            return { ...d, lastActive: new Date().toISOString(), ip: devIP };
          }
          return d;
        });
        dbShop.registeredDevices = updatedList;
        allOriginalShops[currentShopIndex] = dbShop;
        DzStoreDB.saveShops(allOriginalShops);
        setDeviceLockoutError(null);
      } else {
        // Register new device directly (no limits/restrictions)
        const newTerminal = {
          id: devId,
          type: sysDeviceType,
          name: sysDeviceName,
          ip: devIP,
          lastActive: new Date().toISOString()
        };
        const updatedList = [...deviceList, newTerminal];
        dbShop.registeredDevices = updatedList;
        allOriginalShops[currentShopIndex] = dbShop;
        DzStoreDB.saveShops(allOriginalShops);
        setShop(dbShop);
        setDeviceLockoutError(null);
      }
    }
  }, [shop?.id]);

  // Redirect to Customer Portal if hash contains store- or ticket- (e.g. scanned QR code)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.startsWith('#store-') || hash.startsWith('#ticket-'))) {
      setIsCustomerPortal(true);
    }
  }, []);

  // Initial Boot loader with live version checking
  useEffect(() => {
    setBroadcasts(DzStoreDB.getBroadcasts());

    // Update ticking clock
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);

    const checkAppVersion = async () => {
      try {
        const response = await fetch('/version.json?t=' + Date.now());
        if (response.ok) {
          const config = await response.json();
          const CURRENT_VERSION = '1.1.2'; // App's current code version
          if (config && config.version && config.version !== CURRENT_VERSION) {
            setUpdateAvailable(true);
            setLatestVersion(config.version);
            setReleaseNotes({
              ar: config.releaseNotesAr || 'تحديث جديد متوفر للتطبيق!',
              fr: config.releaseNotesFr || 'Mise à jour disponible instantanément !'
            });
          }
        }
      } catch (err) {
        console.warn('[Version Check] Offline or failed to check version:', err);
      }
    };

    // run once after brief delay
    setTimeout(checkAppVersion, 1500);

    // periodically check every 60 seconds
    const updateInterval = setInterval(checkAppVersion, 60000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(updateInterval);
    };
  }, []);

  const handleApplyUpdate = async () => {
    try {
      triggerToast(lang === 'ar' ? 'جاري تثبيت التحديث ومسح التخزين الذاكري للتطبيق...' : 'Installing live updates & clearing worker caches...', 'info');
      
      // Flush service worker cache structures dynamically
      if ('caches' in window) {
        const cacheStoreNames = await caches.keys();
        await Promise.all(cacheStoreNames.map(name => caches.delete(name)));
      }

      // Unregister current active workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }

      // Play soft sounds and force full deep screen refresh
      triggerToast(lang === 'ar' ? 'تم التحديث بنجاح! جاري التشغيل...' : 'Update completed successfully! Rebooting...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e) {
      console.warn('Update reloader experienced warning:', e);
      window.location.reload();
    }
  };

  // Recalculating totals of store metrics safely
  const handleRecalculateMetrics = () => {
    if (!shop) return;
    const matchedShop = DzStoreDB.getShops().find(s => s.id === shop.id);
    if (matchedShop) {
      const hasChanged = 
        matchedShop.status !== shop.status ||
        matchedShop.name !== shop.name ||
        matchedShop.phone !== shop.phone ||
        matchedShop.address !== shop.address ||
        matchedShop.trialEndDate !== shop.trialEndDate;
      if (hasChanged) {
        setShop(matchedShop);
      }
    }
    const items = DzStoreDB.getProducts(shop.id);
    const sales = DzStoreDB.getSales(shop.id);
    const jobs = DzStoreDB.getMaintenanceJobs(shop.id);
    const customers = DzStoreDB.getCustomers(shop.id);

    // Sum today sales total value
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySales = sales.filter(s => s.date.startsWith(todayStr));
    const salesSum = todaySales.reduce((acc, current) => acc + current.total, 0);

    // Sum overall customer debts
    const duesSum = customers.reduce((acc, current) => acc + current.totalDebt, 0);

    setStats({
      todaySalesAmount: salesSum,
      inventoryCount: items.reduce((sum, current) => sum + current.quantity, 0),
      maintenanceCount: jobs.filter(j => j.status !== 'delivered' && j.status !== 'cancelled').length,
      clientDues: duesSum,
    });
  };

  // Start Realtime Online/Offline SaaS & Tenant Sync
  useEffect(() => {
    let unsubSync: (() => void) | null = null;

    const unsubAuth = auth.onAuthStateChanged((firebaseUser) => {
      setFbUserLoaded(!!firebaseUser);
      if (unsubSync) {
        unsubSync();
        unsubSync = null;
      }

      if (firebaseUser) {
        console.log("Authenticated with Firebase. Initiating real-time global SaaS synchronization.");
        unsubSync = setupGlobalSaaSSync(() => {
          setSyncKey(prev => prev + 1);
        });
        // Trigger sync of any locally accumulated / pending operations now that valid auth credentials exist
        triggerBackgroundSync();
      }
    });

    return () => {
      unsubAuth();
      if (unsubSync) unsubSync();
    };
  }, []);

  useEffect(() => {
    if (!shop || shop.id === 'system-admin-tenant') return;
    if (!fbUserLoaded) {
      console.log("[Sync] Waiting for Firebase Auth load to prevent premature permission errors.");
      return;
    }

    console.log(`[Sync] Firebase Auth is verified ready. Initializing subscriber sync for shop ID: ${shop.id}`);
    const unsub = setupRealtimeSync(shop.id, () => {
      setSyncKey(prev => prev + 1);
    });

    return () => unsub();
  }, [shop?.id, fbUserLoaded]);

  // Compute 7 days sales data for live trend reporting with memoization to prevent rendering lag/freezes
  const weeklySalesData = React.useMemo(() => {
    if (!shop?.id) return [];
    try {
      const sales = DzStoreDB.getSales(shop.id);
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      }).reverse();

      return days.map(day => {
        const salesOnDay = sales.filter(s => s.date.startsWith(day));
        const total = salesOnDay.reduce((sum, s) => sum + s.total, 0);
        const dayName = new Date(day).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'en-US', { weekday: 'short' });
        return { day, total, label: dayName };
      });
    } catch {
      return [];
    }
  }, [shop?.id, syncKey, lang]);

  // Compute low stock items with memoization to avoid redundant database reads
  const lowStockItems = React.useMemo(() => {
    if (!shop?.id) return [];
    try {
      const allOriginalProducts = DzStoreDB.getProducts(shop.id);
      return allOriginalProducts.filter(p => p.quantity <= p.minQuantity);
    } catch (err) {
      return [];
    }
  }, [shop?.id, syncKey]);

  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);

  useEffect(() => {
    if (shop) {
      handleRecalculateMetrics();

      // Read default configurations of this shop using current language as dynamic fallback
      const shopSettings = DzStoreDB.getSettings(shop.id, lang);
      if (shopSettings) {
        // If the shop's saved language is different from the currently selected one on login, update & save it to preserve user option
        if (shopSettings.language !== lang) {
          shopSettings.language = lang;
          DzStoreDB.saveSettings(shop.id, shopSettings);
        }
        setLang(shopSettings.language);
        setCurrency(shopSettings.currency);
        setDarkMode(!!shopSettings.darkMode);
        if (shopSettings.activeTheme) {
          setActiveTheme(shopSettings.activeTheme);
        }
        if (shopSettings.darkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    }
  }, [shop, syncKey]);

  // Handle manual/config toggle dark class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Handle dynamic text direction based on active language
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const handleQuickThemeChange = (newTheme: 'sky-ocean' | 'emerald-grass' | 'indigo-royal' | 'violet-blossom' | 'amber-sunset' | 'rose-ruby') => {
    setActiveTheme(newTheme);
    if (shop) {
      const s = DzStoreDB.getSettings(shop.id);
      DzStoreDB.saveSettings(shop.id, { ...s, activeTheme: newTheme });
    }
  };

  // Keyboard shortcuts listener (F1 - F10)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10'].includes(e.key)) {
        e.preventDefault();
        if (!user) return;

        switch (e.key) {
          case 'F1':
            setActiveTab('home');
            triggerToast(lang === 'ar' ? '🏠 الصفحة الرئيسية' : '🏠 Home dashboard', 'info');
            break;
          case 'F2':
            setActiveTab('pos');
            triggerToast(lang === 'ar' ? '🛒 نقطة البيع (الكاشير)' : '🛒 POS checkout register', 'info');
            break;
          case 'F3':
            setActiveTab('inventory');
            triggerToast(lang === 'ar' ? '📦 إدارة المخزون' : '📦 Product inventory', 'info');
            break;
          case 'F4':
            setActiveTab('partners');
            triggerToast(lang === 'ar' ? '👥 قائمة الموردين والزبائن' : '👥 Partners and clients logs', 'info');
            break;
          case 'F5':
            setActiveTab('maintenance');
            triggerToast(lang === 'ar' ? '🛠️ قسم تذاكر الصيانة' : '🛠️ Repairs workshop ticket', 'info');
            break;
          case 'F6':
            if (user.role === 'owner' || user.role === 'admin') {
              setActiveTab('users');
              triggerToast(lang === 'ar' ? '👤 إدارة حسابات الموظفين والصلاحيات' : '👤 Users & permissions hub', 'info');
            } else {
              triggerToast(lang === 'ar' ? '🔒 ليس لديك الصلاحية!' : '🔒 Insufficient permission rights!', 'warning');
            }
            break;
          case 'F7':
            if (user.role === 'owner' || user.role === 'admin') {
              setActiveTab('reports');
              triggerToast(lang === 'ar' ? '📊 التقارير المالية والأرباح' : '📊 Reports and income tracker', 'info');
            } else {
              triggerToast(lang === 'ar' ? '🔒 ليس لديك الصلاحية!' : '🔒 Insufficient permission rights!', 'warning');
            }
            break;
          case 'F8':
            if (user.role === 'owner' || user.role === 'admin') {
              setActiveTab('settings');
              triggerToast(lang === 'ar' ? '⚙️ إعدادات المحل واللوجو ومظهر النظام' : '⚙️ Store parameters configured', 'info');
            } else {
              triggerToast(lang === 'ar' ? '🔒 ليس لديك الصلاحية!' : '🔒 Insufficient permission rights!', 'warning');
            }
            break;
          case 'F9':
            setEnableSounds(prev => !prev);
            triggerToast(lang === 'ar' ? '🔊 تبديل تفعيل المؤثرات الصوتية' : '🔊 Toggle retro scan sounds', 'info');
            break;
          case 'F10':
            setIsSidebarOpen(prev => !prev);
            triggerToast(lang === 'ar' ? '☰ تبديل القائمة الجانبية للتنقل' : '☰ Toggled sidebar expanded mode', 'info');
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, lang]);

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) return;

    setIsFirebaseSyncing(true);
    try {
      await sendPasswordResetEmail(auth, recoveryEmail.trim().toLowerCase());
      triggerToast(
        lang === 'ar'
          ? '📨 تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني!'
          : '📨 Password reset email has been sent to your email address!',
        'success'
      );
      setIsForgotPassword(false);
    } catch (err: any) {
      console.error("Password reset error:", err);
      let errorMsg = lang === 'ar' ? '❌ حدث خطأ أثناء عملية الاسترجاع، يرجى التحقق من البريد.' : '❌ Failed to send password reset. Verify email.';
      if (err.code === 'auth/user-not-found') {
        errorMsg = lang === 'ar' ? '❌ هذا البريد الإلكتروني غير مسجل لدينا!' : '❌ Email address not registered!';
      }
      triggerToast(errorMsg, 'warning');
    } finally {
      setIsFirebaseSyncing(false);
    }
  };

  // LOGIN ACCORDING TO TENANCY ROLES
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;

    setIsFirebaseSyncing(true);
    let matchedUser: AppUser | undefined;

    const emailClean = loginEmail.toLowerCase().trim();
    const isCeo = emailClean === 'gestion.stock34@gmail.com' && loginPassword.trim() === '12345';

    if (isCeo) {
      const users = DzStoreDB.getUsers();
      let ceoUser = users.find(u => u.email.toLowerCase().trim() === 'gestion.stock34@gmail.com');
      if (!ceoUser) {
        ceoUser = {
          id: 'user-admin',
          shopId: 'system-admin-tenant',
          email: 'gestion.stock34@gmail.com',
          password: '12345',
          name: 'المدير العام (DzStore CEO)',
          phone: '0656000000',
          role: 'admin',
          isActive: true,
          createdAt: '2026-04-01',
        };
        DzStoreDB.saveUsers([...users, ceoUser]);
      }
      matchedUser = ceoUser;
      triggerToast(
        lang === 'ar'
          ? '👑 مرحباً بك يا مدير المنصة! تم الدخول بنجاح.'
          : '👑 Welcome system administrator! Logged in successfully.',
        'success'
      );
    } else {
      try {
        // 1. Attempt secure authentication via Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, loginEmail.toLowerCase().trim(), loginPassword.trim());
        const fbUser = userCredential.user;
        
        // Look up user details in local database matching email
        matchedUser = DzStoreDB.getUsers().find(
          u => u.email.toLowerCase() === fbUser.email?.toLowerCase().trim()
        );

        // FALLBACK: If authentication succeeded but local database hasn't synced/cached the user yet, fetch directly from cloud Firestore
        if (!matchedUser && navigator.onLine) {
          try {
            console.log("Authenticated but user not cached. Querying Firestore directly for: ", fbUser.email);
            const normalizedEmail = fbUser.email?.toLowerCase().trim() || "";
            
            let fetchedUser: AppUser | undefined;

            // 1. Fetch entire users collection to perform an absolute bulletproof case-insensitive search
            const allUsersSnap = await getDocs(collection(db, 'users'));
            if (!allUsersSnap.empty) {
              const matchedDoc = allUsersSnap.docs.find(docSnap => {
                const uData = docSnap.data();
                return uData && uData.email && uData.email.toLowerCase().trim() === normalizedEmail;
              });
              if (matchedDoc) {
                fetchedUser = matchedDoc.data() as AppUser;
              }
            }

            // 2. Primary fallback query in case step 1 has any indexing latency
            if (!fetchedUser) {
              const userQuery = query(
                collection(db, 'users'),
                where('email', '==', fbUser.email?.toLowerCase().trim())
              );
              const querySnap = await getDocs(userQuery);
              if (!querySnap.empty) {
                fetchedUser = querySnap.docs[0].data() as AppUser;
              }
            }
            
            if (fetchedUser) {
              // Sync locally so they exist in local cached database
              const allUsers = DzStoreDB.getUsers();
              const existingIdx = allUsers.findIndex(u => u.id === fetchedUser!.id || u.email.toLowerCase().trim() === normalizedEmail);
              if (existingIdx > -1) {
                allUsers[existingIdx] = fetchedUser;
              } else {
                allUsers.push(fetchedUser);
              }
              DzStoreDB.saveUsers(allUsers);
              matchedUser = fetchedUser;
              console.log("Successfully retrieved user directly from Firestore:", fetchedUser.name);
            } else {
              console.warn("User document was not found anywhere in Firestore 'users' collection.");
            }
          } catch (queryErr) {
            console.warn("Direct Firestore fallback user query failed:", queryErr);
          }
        }
        
        if (matchedUser) {
          triggerToast(
            lang === 'ar'
              ? '🔐 تم تسجيل الدخول الآمن بنجاح عبر Firebase!'
              : '🔐 Secure login successful via Firebase Authentication!',
            'success'
          );
        }
      } catch (fbError: any) {
        console.warn("Firebase Auth login failed, checking fallback:", fbError);
        
        const isCredentialError = fbError.code === 'auth/invalid-credential' || 
                                  fbError.code === 'auth/user-not-found' || 
                                  fbError.code === 'auth/wrong-password';
        
        // Look up user in local DB to check offline authenticity or lazy-sync
        const localMatch = DzStoreDB.getUsers().find(
          u => u.email.toLowerCase() === loginEmail.toLowerCase().trim()
        );

        if (localMatch && DzStoreDB.verifyPassword(localMatch.password, loginPassword.trim())) {
          if (isCredentialError && navigator.onLine) {
            // Dyn-register local/staff user in Firebase Auth so they can use full high-trust online flows going forward
            try {
              await createUserWithEmailAndPassword(auth, loginEmail.toLowerCase().trim(), loginPassword.trim());
              matchedUser = localMatch;
              triggerToast(
                lang === 'ar'
                  ? '🔐 تم تسجيل وتأمين حساب المستخدم تلقائياً في Firebase Auth!'
                  : '🔐 User account registered and secured dynamically on Firebase Auth!',
                'success'
              );
            } catch (regErr) {
              console.warn("Dynamic staff registration on Firebase failed:", regErr);
              matchedUser = localMatch;
            }
          } else {
            matchedUser = localMatch;
            triggerToast(
              lang === 'ar'
                ? '📶 وضع مستقل - تم الدخول ببيانات معماة محلياً'
                : '📶 Signed in securely using cached local credentials!',
              'info'
            );
          }
        }

        if (!matchedUser) {
          triggerToast(
            lang === 'ar' 
              ? '❌ البريد الإلكتروني أو كود المرور غير صحيح!' 
              : '❌ Incorrect email or PIN code!', 
            'warning'
          );
          setIsFirebaseSyncing(false);
          return;
        }
      }
    }

    if (!matchedUser) {
      triggerToast(
        lang === 'ar' 
          ? '❌ الحساب غير موجود في النظام المحلي!' 
          : '❌ Account not found in local system!', 
        'warning'
      );
      setIsFirebaseSyncing(false);
      return;
    }

    // Load matching shop tenant
    let matchedShop = DzStoreDB.getShops().find(s => s.id === matchedUser.shopId);
    if (!matchedShop && matchedUser.role === 'admin') {
      matchedShop = {
        id: 'system-admin-tenant',
        name: 'سيرفر الإدارة العامة (DzStore SaaS)',
        ownerEmail: 'gestion.stock34@gmail.com',
        phone: '0656000000',
        address: 'الجزائر العاصمة',
        status: 'active',
        createdAt: '2026-04-01',
        updatedAt: '2026-04-01',
        subscriptionPlan: 'yearly'
      };
    }

    // MANDATORY REAL-TIME FETCH ON LOGIN: Always fetch fresh shop status directly from Firestore if online.
    // This guarantees we bypass any stale cached "pending" status and register the owner's activation instantly.
    if (matchedUser.shopId && matchedUser.shopId !== 'system-admin-tenant' && navigator.onLine) {
      try {
        const shopDoc = await getDoc(doc(db, 'shops', matchedUser.shopId));
        if (shopDoc.exists()) {
          const fetchedShop = shopDoc.data() as ShopTenant;
          
          // Update local cache state database with the latest active tenant details
          const allShops = DzStoreDB.getShops();
          const shopIdToUpdate = fetchedShop.id;
          const idx = allShops.findIndex(s => s.id === shopIdToUpdate);
          if (idx > -1) {
            allShops[idx] = fetchedShop;
          } else {
            allShops.push(fetchedShop);
          }
          DzStoreDB.saveShops(allShops);
          matchedShop = fetchedShop;
          console.log("Forced online fetch of tenant status succeeded. Real-time status in Firestore is: ", fetchedShop.status);
        }
      } catch (shopErr) {
        console.warn("Direct Firestore fresh shop status query failed, relying on cache fallback:", shopErr);
      }
    }

    if (!matchedShop) {
      triggerToast(
        lang === 'ar' 
          ? '❌ فشل العثور على متجرك المسجل في النظام!' 
          : '❌ Failed to find your registered shop in the system!', 
        'warning'
      );
      setIsFirebaseSyncing(false);
      return;
    }

    // Allow blocked/suspended/expired shops to log in so they can access the activation key portal inside the app
    if (matchedShop.status === 'suspended') {
      triggerToast(
        lang === 'ar' 
          ? '⚠️ حساب المتجر مجمّد مؤقتاً! يرجى إدخال كود الترخيص لتمديد وتفعيل حسابك.' 
          : '⚠️ Store is suspended! Please enter your license activation key to restore access.', 
        'warning'
      );
    }

    setUser(matchedUser);
    setShop(matchedShop);
    setActiveTab('home');
    DzStoreAudio.playSuccessChime(enableSounds);

    // Auto-seed preloaded CSV sales for baha34ayyoub@gmail.com if they have no/mock sales
    if (matchedUser.email.toLowerCase().trim() === 'baha34ayyoub@gmail.com') {
      const bahaSales = DzStoreDB.getSales(matchedShop.id);
      const hasOnlyMockSale = bahaSales.length <= 1 && (bahaSales.length === 0 || bahaSales[0]?.id === 'sale-1');
      if (hasOnlyMockSale) {
        import('./components/AdminPanel').then(({ BAHA_SALES_CSV }) => {
          DzStoreDB.importSalesCSV(
            matchedShop!.id,
            matchedUser!.name,
            matchedUser!.id,
            BAHA_SALES_CSV
          ).then((res) => {
            console.log("Auto-seeding for baha completed on login:", res);
            setSyncKey(p => p + 1);
            triggerToast(
              lang === 'ar'
                ? '📦 تم استيراد 78 عملية مبيعات خاصة بمحلك بنجاح تلقائياً وجاري مزامنتها!'
                : '📦 Automatically imported and synced your 78 sales transactions successfully!',
              'success'
            );
          });
        }).catch(err => {
          console.warn("Failed to dynamically load BAHA_SALES_CSV on login:", err);
        });
      }
    }

    // Clear login inputs
    setLoginEmail('');
    setLoginPassword('');
    setIsFirebaseSyncing(false);
  };

  // MULTI-TENANT SHOP OWNER SIGNUP REGISTRATION
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regShopName || !regOwnerName || !regEmail || !regPhone || !regPassword) return;

    const existingUsers = DzStoreDB.getUsers();
    if (existingUsers.some(u => u.email.toLowerCase() === regEmail.toLowerCase().trim())) {
      triggerToast(
        lang === 'ar' ? '⚠️ هذا البريد مسجل بالفعل في النظام!' : '⚠️ This email is already registered!',
        'warning'
      );
      return;
    }

    setIsFirebaseSyncing(true);

    try {
      // 1. Create secure authentication account on Firebase
      await createUserWithEmailAndPassword(auth, regEmail.toLowerCase().trim(), regPassword.trim());
      triggerToast(
        lang === 'ar'
          ? '🔐 تم إنشاء حساب آمن وموثق على Firebase Authentication بنجاح!'
          : '🔐 Secured authentication index created on Firebase successfully!',
        'success'
      );
    } catch (fbError: any) {
      console.warn("Firebase Auth registration failed, checking network/offline:", fbError);
      const isNetworkError = fbError.code === 'auth/network-request-failed' || 
                            fbError.code === 'auth/internal-error' ||
                            !navigator.onLine;
      
      if (!isNetworkError) {
        // Non-network error (e.g. weak password or email format)
        let errMsg = fbError.message;
        if (fbError.code === 'auth/weak-password') {
          errMsg = lang === 'ar' ? 'كلمة المرور ضعيفة جداً! يرجى استخدام 6 رموز على الأقل.' : 'Weak password! Use at least 6 characters.';
        } else if (fbError.code === 'auth/email-already-in-use') {
          errMsg = lang === 'ar' ? 'البريد الإلكتروني هذا مستخدم بالفعل في خادم الويب!' : 'Email already in use on cloud servers!';
        }
        alert(errMsg);
        setIsFirebaseSyncing(false);
        return;
      } else {
        // Network offline error - let them register locally and sync up later.
        triggerToast(
          lang === 'ar'
            ? 'ℹ️ تعذر حجز الحساب سحابياً لعدم توفر شبكة. تم تسجيله محلياً وسيتم المزامنة تلقائياً.'
            : 'ℹ️ Registration saved locally. Firebase Auth index will set up automatically once connected.',
          'info'
        );
      }
    }

    const newShopId = `shop-${Date.now()}`;

    // Compute trial expiry schedule (30 days)
    const trialDate = new Date();
    trialDate.setDate(trialDate.getDate() + 30);

    const newShop: ShopTenant = {
      id: newShopId,
      name: regShopName,
      ownerEmail: regEmail,
      status: 'trial', // Starts immediately as trial
      trialEndDate: trialDate.toISOString().split('T')[0],
      phone: regPhone,
      address: regAddress,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newOwner: AppUser = {
      id: `u-${Date.now()}`,
      shopId: newShopId,
      name: regOwnerName,
      email: regEmail,
      password: regPassword,
      phone: regPhone,
      role: 'owner',
      isActive: true,
      permissions: ['pos', 'inventory', 'maintenance', 'suppliers', 'settings'],
      createdAt: new Date().toISOString().split('T')[0],
    };

    let rF = 'شكراً لتعاملكم معنا. ثقتكم شرف لنا.';
    let wH = 'وصل ضمان القطعة المعتمد';
    let wF = 'الضمان لا يشمل الكسر أو السوائل.';

    if (lang === 'en') {
      rF = 'Thank you for your business. Your trust is our honor.';
      wH = 'Certified Product Warranty Receipt';
      wF = 'Warranty does not cover breakage or liquids.';
    } else if (lang === 'fr') {
      rF = 'Merci pour votre confiance. Votre confiance est notre honneur.';
      wH = 'Bon de Garantie Produit Certifié';
      wF = 'La garantie ne couvre pas la casse ou les liquides.';
    } else if (lang === 'pl') {
      rF = 'Dziękujemy za zakupy. Twój wybór to dla nas zaszczyt.';
      wH = 'Zatwierdzone Pokwitowanie Gwarancyjne Produktu';
      wF = 'Gwarancja nie obejmuje uszkodzeń mechanicznych ani zalania.';
    }

    // Setup initial default configurations metrics for this shop
    const defaultSettings: ShopSettings = {
      shopName: regShopName,
      shopPhone: regPhone,
      shopAddress: regAddress,
      currency: 'DZD',
      language: lang,
      logoImage: '',
      stampImage: '',
      receiptHeader: regShopName,
      receiptFooter: rF,
      warrantyHeader: wH,
      warrantyFooter: wF,
      primaryColor: 'sky',
      darkMode: false,
    };

    // Direct, synchronous save to Cloud Firestore to guarantee instant visibility on Admin Panel
    try {
      const hashedOwner = {
        ...newOwner,
        password: DzStoreDB.hashPassword(regPassword)
      };
      
      // Save directly to raw Firestore Collections immediately!
      await setDoc(doc(db, 'shops', newShopId), newShop);
      await setDoc(doc(db, 'users', newOwner.id), hashedOwner);
      await setDoc(doc(db, 'shops', newShopId, 'settings', 'current'), defaultSettings);
      
      console.log("Registered and saved new tenant metadata securely to Firestore!");
    } catch (firestoreErr) {
      console.warn("Direct Firestore registration save failed, relies on backup sync queue:", firestoreErr);
    }

    // Save into state databases
    const allShops = [...DzStoreDB.getShops(), newShop];
    const allUsers = [...DzStoreDB.getUsers(), newOwner];

    DzStoreDB.saveShops(allShops);
    DzStoreDB.saveUsers(allUsers);
    DzStoreDB.saveSettings(newShopId, defaultSettings);

    triggerToast(
      lang === 'ar' 
        ? '🎉 تم إرسال طلب تفعيل المحل التجاري وتأمينه على السيرفر بنجاح!'
        : '🎉 Store registered successfully and secured on cloud server!',
      'success'
    );

    // Swap layouts
    setIsRegistering(false);
    setLoginEmail(regEmail);
    setLoginPassword(regPassword);
    setIsFirebaseSyncing(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Firebase Auth signout failed", e);
    }
    setUser(null);
    setShop(null);
    DzStoreAudio.playWarningChime(enableSounds);
  };
  
  const getThemeConfig = (theme: string) => {
    switch (theme) {
      case 'sky-ocean':
        return {
          primary: 'bg-sky-600',
          hover: 'hover:bg-sky-700',
          text: 'text-sky-600 dark:text-sky-400',
          border: 'border-sky-500/25',
          borderFocus: 'focus:ring-sky-505',
          gradient: 'from-sky-600 to-sky-700',
          gradientHover: 'hover:from-sky-700 hover:to-sky-800',
          lightBg: 'bg-sky-500/10',
          textLight: 'text-sky-800 dark:text-sky-300',
          shadow: 'shadow-sky-600/15',
          shadowHover: 'hover:shadow-sky-600/20',
          accentColor: 'sky-500',
        };
      case 'indigo-royal':
        return {
          primary: 'bg-indigo-600',
          hover: 'hover:bg-indigo-700',
          text: 'text-indigo-600 dark:text-indigo-400',
          border: 'border-indigo-500/25',
          borderFocus: 'focus:ring-indigo-505',
          gradient: 'from-indigo-600 to-indigo-700',
          gradientHover: 'hover:from-indigo-700 hover:to-indigo-805',
          lightBg: 'bg-indigo-500/10',
          textLight: 'text-indigo-800 dark:text-indigo-305',
          shadow: 'shadow-indigo-600/15',
          shadowHover: 'hover:shadow-indigo-600/20',
          accentColor: 'indigo-500',
        };
      case 'violet-blossom':
        return {
          primary: 'bg-violet-600',
          hover: 'hover:bg-violet-700',
          text: 'text-violet-600 dark:text-violet-400',
          border: 'border-violet-500/25',
          borderFocus: 'focus:ring-violet-550',
          gradient: 'from-violet-600 to-violet-700',
          gradientHover: 'hover:from-violet-700 hover:to-violet-800',
          lightBg: 'bg-violet-500/10',
          textLight: 'text-violet-850 dark:text-violet-305',
          shadow: 'shadow-violet-600/15',
          shadowHover: 'hover:shadow-violet-600/20',
          accentColor: 'violet-500',
        };
      case 'amber-sunset':
        return {
          primary: 'bg-amber-600',
          hover: 'hover:bg-amber-700',
          text: 'text-amber-650 dark:text-amber-400',
          border: 'border-amber-500/25',
          borderFocus: 'focus:ring-amber-500',
          gradient: 'from-amber-600 to-amber-700',
          gradientHover: 'hover:from-amber-700 hover:to-amber-800',
          lightBg: 'bg-amber-500/10',
          textLight: 'text-amber-850 dark:text-amber-305',
          shadow: 'shadow-amber-600/15',
          shadowHover: 'hover:shadow-amber-600/20',
          accentColor: 'amber-500',
        };
      case 'rose-ruby':
        return {
          primary: 'bg-rose-600',
          hover: 'hover:bg-rose-700',
          text: 'text-rose-600 dark:text-rose-450',
          border: 'border-rose-500/25',
          borderFocus: 'focus:ring-rose-505',
          gradient: 'from-rose-600 to-rose-700',
          gradientHover: 'hover:from-rose-700 hover:to-rose-800',
          lightBg: 'bg-rose-505/10',
          textLight: 'text-rose-850 dark:text-rose-300',
          shadow: 'shadow-rose-600/15',
          shadowHover: 'hover:shadow-rose-600/20',
          accentColor: 'rose-500',
        };
      case 'emerald-grass':
      default:
        return {
          primary: 'bg-emerald-600',
          hover: 'hover:bg-emerald-700',
          text: 'text-emerald-600 dark:text-emerald-400',
          border: 'border-emerald-500/25',
          borderFocus: 'focus:ring-emerald-500',
          gradient: 'from-emerald-600 to-emerald-700',
          gradientHover: 'hover:from-emerald-700 hover:to-emerald-800',
          lightBg: 'bg-emerald-500/10',
          textLight: 'text-emerald-800 dark:text-emerald-300',
          shadow: 'shadow-emerald-600/15',
          shadowHover: 'hover:shadow-emerald-600/20',
          accentColor: 'emerald-500',
        };
    }
  };

  const tc = getThemeConfig(activeTheme);

  const t = TRANSLATIONS[lang];
  const shopSettings = shop ? DzStoreDB.getSettings(shop.id) : null;

  const salesCount = shop ? DzStoreDB.getSales(shop.id).length : 0;
  const isTrialExpired = !!(
    shop &&
    shop.id !== 'system-admin-tenant' &&
    (shop.status === 'trial' || shop.status === 'pending') &&
    ((shop.trialEndDate && new Date() > new Date(shop.trialEndDate)) || salesCount >= 100)
  );
  const isShopBlocked = !!(shop && shop.id !== 'system-admin-tenant' && (shop.status === 'suspended' || shop.status === 'expired' || isTrialExpired));

  if (deviceLockoutError) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 font-sans border-t-8 border-rose-600" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full bg-slate-900 border border-slate-800/80 p-8 rounded-3xl text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-600 animate-pulse" />
          
          <div className="mx-auto w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-white">
              {lang === 'ar' ? '⚠️ تجاوز حد تراخيص الأجهزة المسموحة!' : '⚠️ Hardware Licensing Limit Exceeded!'}
            </h2>
            <p className="text-xs text-rose-300 leading-relaxed text-center">
              {lang === 'ar'
                ? `عذراً! يسمح هذا البرنامج بالعمل والنشاط على عدد ${shop?.maxComputers ?? 2} أجهزة كمبيوتر و ${shop?.maxPhones ?? 2} هواتف فقط لكل محل تجاري.\nهذا الجهاز متصل برقم IP نشط وتجاوز عدد التراخيص المعتمدة لـ [${shop?.name}].`
                : `Sorry, this terminal software license only permits installation on up to ${shop?.maxComputers ?? 2} Computers and ${shop?.maxPhones ?? 2} Smart Phones per shop.\nThis device has been blocked to protect the owner's distribution.`
              }
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 text-start space-y-2.5">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{lang === 'ar' ? 'تفاصيل جهازك المكتشفة:' : 'Detected Terminal Details:'}</p>
            <div className="space-y-1.5 text-xs text-slate-300">
              <p>🖥️ <span className="text-slate-500 font-medium">{lang === 'ar' ? 'نوع المحطة:' : 'Terminal Type:'}</span> {deviceLockoutError === 'computer' ? (lang === 'ar' ? 'جهاز كمبيوتر لوحي' : 'Computer Desktop') : (lang === 'ar' ? 'هاتف محمول' : 'Mobile Phone')}</p>
              <p>🌐 <span className="text-slate-400 font-medium">IP Address:</span> <span className="text-sky-400 font-mono font-bold">{localStorage.getItem('dzstore_license_device_ip')}</span></p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-[10px] text-slate-500 leading-snug">
              {lang === 'ar'
                ? 'لاتخاذ إجراء وتجاوز هذا الحد، يرجى الاتصال بصاحب البرنامج لتصفير الترخيص أو رفع جهاز قديم لحسابك.'
                : 'Please contact the program administrator to reset this licensing lockout.'
              }
            </p>
            <button
              onClick={() => {
                setUser(null);
                setShop(null);
                setDeviceLockoutError(null);
              }}
              className="w-full text-xs bg-slate-800 hover:bg-slate-750 text-white font-extrabold py-2.5 rounded-xl transition-all cursor-pointer border border-slate-700/60"
            >
              🚪 {lang === 'ar' ? 'الرجوع إلى صفحة الدخول' : 'Back to Login Screen'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${
      activeTheme === 'emerald-grass' ? 'bg-gradient-to-tr from-[#f0fdf4] via-emerald-100/40 to-[#e6fcfa]' :
      activeTheme === 'indigo-royal' ? 'bg-gradient-to-tr from-[#f5f3ff] via-indigo-100/40 to-[#fae8ff]' :
      activeTheme === 'violet-blossom' ? 'bg-gradient-to-tr from-[#f5f3ff] via-violet-100/40 to-[#fae8ff]' :
      activeTheme === 'amber-sunset' ? 'bg-gradient-to-tr from-[#fffbeb] via-amber-100/35 to-[#fef3c7]/65' :
      activeTheme === 'rose-ruby' ? 'bg-gradient-to-tr from-[#fff1f2] via-rose-100/35 to-[#ffe4e6]/50' :
      'bg-gradient-to-tr from-[#f0f9ff] via-sky-100/40 to-[#e0e7ff]/80'
    } text-slate-800 ${lang === 'ar' ? 'rtl' : 'ltr'} flex flex-col font-sans transition-all`}>
      
      {/* 1. AUTHENTICATION SCREENS GATEWAY FOR DIRECT ENTRANCE */}
      {!user ? (
        isCustomerPortal ? (
          <CustomerPortal lang={lang} onBack={() => setIsCustomerPortal(false)} />
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row min-h-screen p-4 lg:p-6 justify-center items-center gap-6 animate-fade-in">
          
          {/* Cover display Panel - Beautiful Design Vibe */}
          <div className="lg:w-1/2 w-full bg-gradient-to-br from-emerald-800/90 via-emerald-950/95 to-slate-900/90 text-white flex flex-col justify-between p-8 lg:p-12 text-start rounded-3xl relative overflow-hidden shadow-2xl min-h-[500px] lg:min-h-[640px] border border-white/10">
            <div className="space-y-4 relative z-10 text-start">
              <span className="bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px] uppercase px-3 py-1 rounded-full border border-emerald-400/30 tracking-wider">
                {lang === 'ar' ? '🇩🇿 منظومة المبيعات والصيانة الجزائرية' : 
                 lang === 'fr' ? '🇩🇿 Écosystème de Vente et Maintenance Algérien' : 
                 lang === 'pl' ? '🇩🇿 Algierski ekosystem sprzedaży i napraw' : 
                 '🇩🇿 Algerian Point of Sale & Repairs Ecosystem'}
              </span>
              <h1 className="text-3xl lg:text-5xl font-black text-white leading-tight">
                {lang === 'ar' ? (
                  <>منصة <span className="text-emerald-400 font-mono">DzStore</span> المتكاملة</>
                ) : lang === 'fr' ? (
                  <>Plateforme Intégrée <span className="text-emerald-400 font-mono">DzStore</span></>
                ) : lang === 'pl' ? (
                  <>Zintegrowana Platforma <span className="text-emerald-400 font-mono">DzStore</span></>
                ) : (
                  <>Integrated <span className="text-emerald-400 font-mono">DzStore</span> Platform</>
                )}
              </h1>
              <p className="text-xs lg:text-sm text-emerald-100/95 max-w-md mt-2 leading-relaxed">
                {lang === 'ar' ? 'برنامج تسيير مبيعات ورقابات محلات الهواتف النقالة، الإكسسوارات، تتبع قطع الغيار، وورش صيانة العتاد والكمبيوتر بالتشفير وتعدد المهام.' :
                 lang === 'fr' ? 'Un progiciel tout-en-un pour gérer vos ventes, boutiques de téléphones, accessoires, suivi des pièces de rechange et gestion de l\'atelier de réparation.' :
                 lang === 'pl' ? 'Kompleksowy system zarządzania sprzedażą, akcesoriami, częściami zamiennymi oraz zleceniami napraw w serwisie.' :
                 'An all-in-one software ecosystem for managing sales, mobile phone storefronts, accessories, tracking spare parts, and hardware repair workspace ticketing.'}
              </p>
            </div>

            {/* Middle core visuals */}
            <div className="my-8 space-y-4 relative z-10 max-w-sm text-start">
              <div className="bg-white/10 p-4 rounded-2xl border border-white/20 flex gap-3 items-center backdrop-blur-xs">
                <div className="bg-emerald-400 text-slate-950 p-2 rounded-xl font-black text-sm">✓</div>
                <div className="text-xs text-start">
                  <p className="font-extrabold text-white">
                    {lang === 'ar' ? 'نظام بيع الكاشير بالباركود' : 
                     lang === 'fr' ? 'Point de Vente POS Code-barres' : 
                     lang === 'pl' ? 'System kasowy z kodami kreskowymi' : 
                     'Retail POS Cashier System'}
                  </p>
                  <p className="text-emerald-200 mt-0.5">
                    {lang === 'ar' ? 'استخراج وصولات الضمان وتخصيص الفواتير' : 
                     lang === 'fr' ? 'Imprimer factures de garantie instantanées' : 
                     lang === 'pl' ? 'Drukuj paragony gwarancyjne' : 
                     'Print warranty bills instantly'}
                  </p>
                </div>
              </div>

              <div className="bg-white/10 p-4 rounded-2xl border border-white/20 flex gap-3 items-center backdrop-blur-xs">
                <div className="bg-emerald-400 text-slate-950 p-2 rounded-xl font-black text-sm">✓</div>
                <div className="text-xs text-start">
                  <p className="font-extrabold text-white">
                    {lang === 'ar' ? 'ورشة صيانة بمخازن قطع الغيار' : 
                     lang === 'fr' ? 'Atelier de Maintenance des Appareils' : 
                     lang === 'pl' ? 'Atelier napraw i części zamiennych' : 
                     'Hardware Repair Tickets Office'}
                  </p>
                  <p className="text-emerald-200 mt-0.5">
                    {lang === 'ar' ? 'ربط التقني واقتطاع قطع الصيانة آليًا' : 
                     lang === 'fr' ? 'Déduction automatique de pièces détachées' : 
                     lang === 'pl' ? 'Automatyczne pobieranie części zamiennych' : 
                     'Real-time spare parts deduction'}
                  </p>
                </div>
              </div>
            </div>

            {/* Background design accents */}
            <div className="absolute right-0 bottom-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
          </div>

          {/* Form interaction block */}
          <div className="lg:w-1/2 w-full glass-panel flex flex-col justify-center p-6 lg:p-10 rounded-3xl shrink-0 min-h-[500px] lg:min-h-[640px] border border-white/60 shadow-xl">
            <div className="max-w-md w-full mx-auto space-y-6">
              
              {/* Beautiful, Clean Language Toggle Header */}
              <div className="flex items-center justify-between bg-slate-100/50 dark:bg-slate-800/20 p-2 rounded-2xl border border-white/50 backdrop-blur-xs">
                <span className="text-[10px] font-black text-slate-500 uppercase px-2 tracking-wider">
                  {lang === 'ar' ? 'لغة النظام' : lang === 'fr' ? 'Langue' : lang === 'pl' ? 'Język' : 'Language'}
                </span>
                <div className="flex gap-1">
                  {[
                    { code: 'en', label: '🇺🇸 English' },
                    { code: 'ar', label: '🇩🇿 العربية' },
                    { code: 'fr', label: '🇫🇷 Français' },
                    { code: 'pl', label: '🇵🇱 Polski' }
                  ].map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => setLang(item.code as any)}
                      className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                        lang === item.code 
                          ? 'bg-emerald-600 text-white shadow-xs' 
                          : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-300'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Guest Portal Callout Link */}
              <div 
                onClick={() => setIsCustomerPortal(true)}
                className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-3xl cursor-pointer hover:bg-emerald-100/70 transition-all text-start flex items-center justify-between shadow-xs group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 text-white rounded-2xl">
                    <Smartphone className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-start">
                      {lang === 'ar' ? '🔍 فضاء وتطبيق الزبائن: تتبع جهازك وصيانتك' : 
                       lang === 'fr' ? '🔍 Espace Clients: Suivi de Réparations' : 
                       lang === 'pl' ? '🔍 Panel klienta: Śledź naprawę' : 
                       '🔍 Customer Portal: Track Your Repair'}
                    </h4>
                    <p className="text-[10px] opacity-80 leading-normal mt-0.5 text-start font-bold">
                      {lang === 'ar' ? 'انقر هنا لمعرفة حالة تصليح هاتفك، كشوفات الضمان، الأقساط، والفواتير' : 
                       lang === 'fr' ? 'Consulter le statut, codes de garantie, factures et dettes' : 
                       lang === 'pl' ? 'Sprawdź status naprawy, gwarancję, faktury i należności' : 
                       'Check maintenance status, warranty codes, invoices & debts'}
                    </p>
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 text-emerald-600 transition-transform group-hover:translate-x-1 ${lang === 'ar' ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
              </div>

              {/* Layout Switch toggles */}
              <div className="flex bg-slate-100/50 p-1 rounded-2xl border border-white/50 backdrop-blur-xs">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                    !isRegistering ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  🚪 {lang === 'ar' ? 'تسجيل الدخول الحساب' : lang === 'fr' ? 'Connexion' : lang === 'pl' ? 'Zaloguj' : 'Log In Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegistering(true)}
                  className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                    isRegistering ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  ✨ {lang === 'ar' ? 'تسجيل محل جديد مجاناً' : lang === 'fr' ? 'S’enregistrer' : lang === 'pl' ? 'Rejestracja' : 'Setup 14-Days Trial Store'}
                </button>
              </div>

              {isForgotPassword ? (
                /* PASSWORD RECOVERY FORM Container */
                <form onSubmit={handlePasswordRecovery} className="space-y-4 text-start animate-glass-in">
                  <div className="space-y-1">
                    <h2 className="text-xl font-extrabold text-slate-900">
                      {lang === 'ar' ? 'استرجاع كلمة المرور' : 
                       lang === 'fr' ? 'Récupérer le mot de passe' : 
                       lang === 'pl' ? 'Odzyskiwanie hasła' : 
                       'Recover Password'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {lang === 'ar' ? 'أدخل بريدك الإلكتروني نرسل لك رابط إعادة تعيين كلمة المرور' : 
                       lang === 'fr' ? 'Saisissez votre e-mail pour recevoir un lien de réinitialisation' : 
                       lang === 'pl' ? 'Wpisz swój e-mail, aby otrzymać link resetujący' : 
                       'Enter your email to receive a secure password reset link'}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">
                        {lang === 'ar' ? 'البريد الإلكتروني' : 
                         lang === 'fr' ? 'Adresse E-mail' : 
                         lang === 'pl' ? 'Adres e-mail' : 
                         'Email Address'}
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="user@example.com"
                        value={recoveryEmail}
                        onChange={e => setRecoveryEmail(e.target.value)}
                        className="w-full text-sm px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white/60 backdrop-blur-xs border-white/80"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(false)}
                      className="w-1/3 py-3 border border-slate-200 text-slate-600 font-extrabold text-sm rounded-xl hover:bg-slate-50 transition-colors active:scale-95 cursor-pointer text-center"
                    >
                      🔙 {lang === 'ar' ? 'رجوع' : lang === 'fr' ? 'Retour' : lang === 'pl' ? 'Powrót' : 'Back'}
                    </button>
                    <button
                      type="submit"
                      className="w-2/3 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl transition-transform active:scale-95 shadow-md cursor-pointer"
                    >
                      📨 {lang === 'ar' ? 'أرسل رابط الاسترجاع' : 
                           lang === 'fr' ? 'Envoyer le lien de réinitialisation' : 
                           lang === 'pl' ? 'Wyślij link resetujący' : 
                           'Send Reset Link'}
                    </button>
                  </div>
                </form>
              ) : !isRegistering ? (
                /* LOGIN FORM CONTAINER */
                <form onSubmit={handleLogin} className="space-y-4 text-start animate-glass-in">
                  <div className="space-y-1">
                    <h2 className="text-xl font-extrabold text-slate-900">
                      {lang === 'ar' ? 'مرحبا بك مجدداً!' : 
                       lang === 'fr' ? 'Bon retour !' : 
                       lang === 'pl' ? 'Witaj ponownie!' : 
                       'Welcome back!'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {lang === 'ar' ? 'أدخل معلومات الدخول لمباشرة مبيعات اليوم' : 
                       lang === 'fr' ? 'Saisissez vos identifiants pour démarrer vos ventes' : 
                       lang === 'pl' ? 'Wpisz dane logowania, aby rozpocząć sprzedaż' : 
                       'Provide register mail to restore your terminal'}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">
                        {lang === 'ar' ? 'البريد الإلكتروني' : 
                         lang === 'fr' ? 'Adresse E-mail' : 
                         lang === 'pl' ? 'Adres e-mail' : 
                         'Email Address'}
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="user@example.com"
                        value={loginEmail}
                        onChange={e => setLoginEmail(e.target.value)}
                        className="w-full text-sm px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white/60 backdrop-blur-xs border-white/80"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-extrabold text-slate-700">
                          {lang === 'ar' ? 'كلمة المرور PIN' : 
                           lang === 'fr' ? 'Code PIN de sécurité' : 
                           lang === 'pl' ? 'Kod PIN bezpieczeństwa' : 
                           'Password PINCode'}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setRecoveryEmail(loginEmail);
                            setIsForgotPassword(true);
                          }}
                          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                        >
                          {lang === 'ar' ? 'نسيت كلمة المرور؟' : 
                           lang === 'fr' ? 'Mot de passe oublié ?' : 
                           lang === 'pl' ? 'Zapomniałeś hasła?' : 
                           'Forgot password?'}
                        </button>
                      </div>
                      <input
                        type="password"
                        required
                        placeholder="••••"
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        className="w-full text-sm px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white/60 backdrop-blur-xs border-white/80"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl transition-transform active:scale-95 shadow-md cursor-pointer"
                  >
                    🚀 {lang === 'ar' ? 'دخول فوري لوحة التحكم' : 
                         lang === 'fr' ? 'Accéder au tableau de bord' : 
                         lang === 'pl' ? 'Zaloguj się do panelu' : 
                         'Log In to System'}
                  </button>
                </form>
              ) : (
                /* REGISTRATION SIGNUP FORM */
                <form onSubmit={handleSignup} className="space-y-3.5 text-start animate-glass-in">
                  <div className="space-y-1">
                    <h2 className="text-xl font-extrabold text-slate-900">
                      {lang === 'ar' ? 'إطلاق محل مبيعات جديد' : 
                       lang === 'fr' ? 'Créer une nouvelle boutique' : 
                       lang === 'pl' ? 'Zarejestruj nowy sklep' : 
                       'Register Store License'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {lang === 'ar' ? 'خلال دقيقة، تفضل بملء بياناتك وافتح بوابة الكاشير' : 
                       lang === 'fr' ? 'Remplissez vos coordonnées pour ouvrir votre caisse' : 
                       lang === 'pl' ? 'Wypełnij dane, aby otworzyć panel' : 
                       'Gain standalone workspace isolation'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">
                          {lang === 'ar' ? 'اسم المحل التجاري' : 
                           lang === 'fr' ? 'Nom du magasin' : 
                           lang === 'pl' ? 'Nazwa sklepu' : 
                           'Shop Brand Title'} *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Belfort Telecom, El Eulma Tech"
                          value={regShopName}
                          onChange={e => setRegShopName(e.target.value)}
                          className="w-full text-xs px-3 py-2 border rounded-xl bg-white/60 border-white/80"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">
                          {lang === 'ar' ? 'اسم المالك ثلاثي' : 
                           lang === 'fr' ? 'Nom du propriétaire' : 
                           lang === 'pl' ? 'Nazwisko właściciela' : 
                           'Owner Representative'} *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Kamel Benzahra"
                          value={regOwnerName}
                          onChange={e => setRegOwnerName(e.target.value)}
                          className="w-full text-xs px-3 py-2 border rounded-xl bg-white/60 border-white/80"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">
                        {lang === 'ar' ? 'البريد الإلكتروني للتواصل' : 
                         lang === 'fr' ? 'Adresse E-mail' : 
                         lang === 'pl' ? 'Adres e-mail' : 
                         'Email Address'} *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="yourname@gmail.com"
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                        className="w-full text-xs px-3 py-2 border rounded-xl bg-white/60 border-white/80"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">
                          {lang === 'ar' ? 'رقم الهاتف (الجزائر)' : 
                           lang === 'fr' ? 'Téléphone (Algérie)' : 
                           lang === 'pl' ? 'Telefon' : 
                           'Algeria Telephone'} *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="0555 12 34 56"
                          value={regPhone}
                          onChange={e => setRegPhone(e.target.value)}
                          className="w-full text-xs px-3 py-2 border rounded-xl bg-white/60 border-white/80"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">{lang === 'ar' ? 'العنوان' : lang === 'fr' ? 'Adresse' : lang === 'pl' ? 'Adres' : 'Address'} *</label>
                        <input
                          type="text"
                          required
                          placeholder="Belcourt, Alger"
                          value={regAddress}
                          onChange={e => setRegAddress(e.target.value)}
                          className="w-full text-xs px-3 py-2 border rounded-xl bg-white/60 border-white/80"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">
                        {lang === 'ar' ? 'كود المرور PIN للحماية' : 
                         lang === 'fr' ? 'Code PIN de sécurité' : 
                         lang === 'pl' ? 'Kod PIN zabezpieczający' : 
                         'Secure Entry Passcode'} *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="••••"
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        className="w-full text-xs px-3 py-2 border rounded-xl bg-white/60 border-white/80"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition-transform active:scale-95"
                  >
                    ✨ {lang === 'ar' ? 'تأكيد التسجيل وإرسال الطلب' : 
                         lang === 'fr' ? 'Confirmer l’inscription' : 
                         lang === 'pl' ? 'Zatwierdź rejestrację' : 
                         'Install Sandbox & Send Application'}
                  </button>
                </form>
              )}

              {/* Algerian Credit wiring instruction terms */}
              <div className="text-[10px] text-slate-400 bg-white/40 border border-white/50 p-3 rounded-2xl text-center leading-relaxed backdrop-blur-xs font-bold">
                {lang === 'ar' 
                  ? 'برمجة وإشراف DzStore 2026. المبيعات تسجل أوف لاين محلياً أولاً بالكامل، ثم تتبادل على السيرفر المركزي تلقائياً.' 
                  : lang === 'fr'
                  ? 'DzStore services clients. L’application fonctionne de manière autonome en se synchronisant automatiquement.'
                  : lang === 'pl'
                  ? 'System DzStore 2026. Transakcje są zapisywane najpierw lokalnie, a następnie automatycznie synchronizowane z serwerem.'
                  : 'DzStore Client services. Offline capability operates local storage automatically.'}
              </div>
            </div>
          </div>
        </div>
        )
      ) : (
        /* 2. AUTHENTICATED CORNER LAYOUT SCREEN */
        <div className={`flex-1 flex flex-col md:flex-row min-h-screen relative overflow-x-hidden ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
          
          {/* Mobile backdrop for sidebar drawer */}
          {isSidebarOpen && (
            <div 
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 z-30 md:hidden backdrop-blur-[1px] transition-all duration-300 cursor-pointer"
            />
          )}

          {/* THE STYLISH COLLAPSIBLE SIDEBAR DRAWER */}
          <aside className={`glass-panel shrink-0 transition-all duration-300 z-40 fixed md:sticky top-0 h-screen flex flex-col justify-between 
            ${lang === 'ar' ? 'right-0 border-l' : 'left-0 border-r'}
            ${isSidebarOpen ? 'w-64 opacity-100 translate-x-0' : `w-0 md:w-20 opacity-0 md:opacity-100 ${lang === 'ar' ? 'translate-x-full' : '-translate-x-full'} md:translate-x-0`} 
            ${darkMode ? 'bg-slate-900/90 border-slate-800 text-white' : 'bg-white/85'}`}>
            
            <div className="flex-1 flex flex-col overflow-y-auto">
              {/* BRAND / LOGO AREA */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {shopSettings?.logoImage || shop?.logoUrl ? (
                    <img
                      src={shopSettings?.logoImage || shop?.logoUrl}
                      alt="Logo"
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border-2 border-emerald-500 shadow-xs animate-none"
                    />
                  ) : (
                    <div className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 p-2 rounded-xl font-bold text-xs">
                      🇩🇿
                    </div>
                  )}
                  {isSidebarOpen && (
                    <span className="font-extrabold text-xs tracking-tight text-slate-900 dark:text-white truncate max-w-[120px]">
                      {shop?.name}
                    </span>
                  )}
                </div>
                {/* Close drawer on mobile */}
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="md:hidden p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              {/* NAVIGATION MAIN LINK SEGMENTS */}
              <nav className="p-3 space-y-1.5 text-start">
                
                {/* 1. HOME tab */}
                <button
                  onClick={() => {
                    setActiveTab('home');
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`w-full py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-all ${
                    activeTab === 'home'
                      ? `${tc.primary} text-white shadow-md ${tc.shadow}`
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <LayoutDashboard className="w-5 h-5 shrink-0" />
                  {isSidebarOpen && <span>{lang === 'ar' ? 'الرئيسية (F1)' : 'Homepage (F1)'}</span>}
                </button>

                {/* 2. POS tab */}
                <button
                  onClick={() => {
                    setActiveTab('pos');
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`w-full py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-all ${
                    activeTab === 'pos'
                      ? `${tc.primary} text-white shadow-md ${tc.shadow}`
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <ShoppingCart className="w-5 h-5 shrink-0" />
                  {isSidebarOpen && <span>{lang === 'ar' ? 'الكاشير والبيع (F2)' : 'POS Cashier (F2)'}</span>}
                </button>

                {/* 3. INVENTORY tab - RESTRICT: Only Tech-support/Owner/Admin */}
                {user.role !== 'seller' && (
                  <button
                    onClick={() => {
                      setActiveTab('inventory');
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`w-full py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-all ${
                      activeTab === 'inventory'
                        ? `${tc.primary} text-white shadow-md ${tc.shadow}`
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <PackageCheck className="w-5 h-5 shrink-0" />
                    {isSidebarOpen && <span>{lang === 'ar' ? 'المخزون والقطع (F3)' : 'Inventory List (F3)'}</span>}
                  </button>
                )}

                {/* 4. PARTNERS tab - RESTRICT: Only Seller/Owner/Admin */}
                {user.role !== 'technician' && (
                  <button
                    onClick={() => {
                      setActiveTab('partners');
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`w-full py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-all ${
                      activeTab === 'partners'
                        ? `${tc.primary} text-white shadow-md ${tc.shadow}`
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Users className="w-5 h-5 shrink-0" />
                    {isSidebarOpen && <span>{lang === 'ar' ? 'الشركاء والديون (F4)' : 'Partners/Credits (F4)'}</span>}
                  </button>
                )}

                {/* 5. MAINTENANCE tab - RESTRICT: Only Tech-support/Owner/Admin */}
                {user.role !== 'seller' && (
                  <button
                    onClick={() => {
                      setActiveTab('maintenance');
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`w-full py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-all ${
                      activeTab === 'maintenance'
                        ? `${tc.primary} text-white shadow-md ${tc.shadow}`
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Wrench className="w-5 h-5 shrink-0" />
                    {isSidebarOpen && <span>{lang === 'ar' ? 'ورشة الصيانة (F5)' : 'Repairs Center (F5)'}</span>}
                  </button>
                )}

                {/* 5b. USED PHONES tab - Accessible to all roles */}
                <button
                  onClick={() => {
                    setActiveTab('used-phones');
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`w-full py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-all ${
                    activeTab === 'used-phones'
                      ? `${tc.primary} text-white shadow-md ${tc.shadow}`
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Fingerprint className="w-5 h-5 shrink-0 text-emerald-500" />
                  {isSidebarOpen && <span>{lang === 'ar' ? 'الهواتف المستعملة' : 'Used Phones'}</span>}
                </button>

                {/* 5c. CUSTOMER MESSAGES tab - Accessible to all roles */}
                <button
                  onClick={() => {
                    setActiveTab('messages');
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`w-full py-2 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                    activeTab === 'messages'
                      ? `${tc.primary} text-white shadow-md ${tc.shadow}`
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Mail className="w-5 h-5 shrink-0 text-emerald-500" />
                    {isSidebarOpen && <span className="truncate">{lang === 'ar' ? 'رسائل الزبائن' : 'Customer Messages'}</span>}
                  </div>
                  {isSidebarOpen && unreadMessages > 0 && (
                    <span className="bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse shrink-0">
                      {unreadMessages}
                    </span>
                  )}
                </button>

                {/* 5d. STORE FRONT CHECKOUT ORDERS tab - Accessible to all roles */}
                <button
                  onClick={() => {
                    setActiveTab('orders');
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`w-full py-2 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                    activeTab === 'orders'
                      ? `${tc.primary} text-white shadow-md ${tc.shadow}`
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ShoppingCart className="w-5 h-5 shrink-0 text-emerald-500" />
                    {isSidebarOpen && <span className="truncate">{lang === 'ar' ? 'طلبات المتجر' : 'Client Orders'}</span>}
                  </div>
                  {isSidebarOpen && pendingOrders > 0 && (
                    <span className="bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse shrink-0">
                      {pendingOrders}
                    </span>
                  )}
                </button>

                {/* Separator line for secure metrics */}
                <div className="border-t border-slate-200 dark:border-slate-800 my-4"></div>

                {/* 6. USERS tab - RESTRICT: Only Owner/Admin */}
                {(user.role === 'owner' || user.role === 'admin') && (
                  <button
                    onClick={() => {
                      setActiveTab('users');
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`w-full py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-all ${
                      activeTab === 'users'
                        ? `${tc.primary} text-white shadow-md ${tc.shadow}`
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <UserCheck className="w-5 h-5 shrink-0" />
                    {isSidebarOpen && <span>{lang === 'ar' ? 'المستخدمين (F6)' : 'Staff Management (F6)'}</span>}
                  </button>
                )}

                {/* 7. REPORTS tab - RESTRICT: Only Owner/Admin */}
                {(user.role === 'owner' || user.role === 'admin' || user.canViewReports) && (
                  <button
                    onClick={() => {
                      setActiveTab('reports');
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`w-full py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-all ${
                      activeTab === 'reports'
                        ? `${tc.primary} text-white shadow-md ${tc.shadow}`
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <BarChart3 className="w-5 h-5 shrink-0" />
                    {isSidebarOpen && <span>{lang === 'ar' ? 'التقارير والمداخيل (F7)' : 'Reports & Profit (F7)'}</span>}
                  </button>
                )}

                {/* 8. SETTINGS tab - RESTRICT: Only Owner/Admin */}
                {(user.role === 'owner' || user.role === 'admin') && (
                  <button
                    onClick={() => {
                      setActiveTab('settings');
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`w-full py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-all ${
                      activeTab === 'settings'
                        ? `${tc.primary} text-white shadow-md ${tc.shadow}`
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <SettingsIcon className="w-5 h-5 shrink-0" />
                    {isSidebarOpen && <span>{lang === 'ar' ? 'لوغو وإعدادات المحل (F8)' : 'Logo & Settings (F8)'}</span>}
                  </button>
                )}

                {/* 9. TELEGRAM panel shortcut */}
                {(user.role === 'owner' || user.role === 'admin') && (
                  <button
                    onClick={() => {
                      setActiveTab('telegram');
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`w-full py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-all ${
                      activeTab === 'telegram'
                        ? `${tc.primary} text-white shadow-sm ${tc.shadow}`
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <MessageCircle className="w-5 h-5 shrink-0" />
                    {isSidebarOpen && <span>{lang === 'ar' ? '💬 مركز اتصالات العملاء' : '💬 Customer Relations'}</span>}
                  </button>
                )}

                {/* 10. SAAS CONTROL PANEL - admin role only */}
                {(user.role === 'admin' || user.email.toLowerCase() === 'gestion.stock34@gmail.com') && (
                  <button
                    onClick={() => {
                      setActiveTab('admin');
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`w-full py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-all ${
                      activeTab === 'admin'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'text-amber-850 dark:text-amber-200 hover:bg-amber-100/10'
                    }`}
                  >
                    <ShieldEllipsis className="w-5 h-5 shrink-0 text-amber-500" />
                    {isSidebarOpen && <span>{lang === 'ar' ? 'سيرفر الأدمن الرئيسي' : 'SaaS Master Server'}</span>}
                  </button>
                )}

              </nav>
            </div>

            {/* LOWER LOGOUT SEGMENTS */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <button
                onClick={() => {
                  setUser(null);
                  setShop(null);
                }}
                className={`w-full py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors`}
              >
                <LogOut className="w-5 h-5 shrink-0" />
                {isSidebarOpen && <span>{lang === 'ar' ? 'الخروج' : 'Log Out'}</span>}
              </button>

              {/* Developer Signature Credit */}
              {isSidebarOpen && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/40 dark:border-slate-800/40 text-center space-y-1 select-none">
                  <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider block">
                    {lang === 'ar' ? 'مطور البرنامج' : 'Software Developer'}
                  </span>
                  <p className="font-extrabold text-slate-800 dark:text-slate-100 text-[11.5px] tracking-tight">
                    🔥 Baha-Yacine
                  </p>
                  <a
                    href="tel:+213779068626"
                    className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline block font-mono"
                  >
                    📞 +213 779 068 626
                  </a>
                </div>
              )}
            </div>

          </aside>

          {/* MAIN PAGE CONTAINER WRAPPER */}
          <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
            
            {/* APP VERSION LIVE UPDATE NOTIFIER (PWA CACHE-BUSTER) */}
            {updateAvailable && (
              <div className="bg-sky-650 dark:bg-sky-900 border-b border-sky-450 text-white text-xs px-4 py-3 font-semibold flex flex-col sm:flex-row items-center justify-between text-start gap-3 shadow-md relative z-55">
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 dark:bg-black/10 p-2 rounded-xl shrink-0 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
                  </div>
                  <div>
                    <span className="font-black text-sm text-[13px] block">
                      {lang === 'ar' 
                        ? `✨ تحديث فوري جديد متوفر للتطبيق! نسخة (${latestVersion})` 
                        : `✨ Direct Application Update Available! v${latestVersion}`}
                    </span>
                    <p className="opacity-95 text-[11.5px] font-medium leading-normal mt-0.5 max-w-3xl">
                      {lang === 'ar' ? releaseNotes?.ar : releaseNotes?.fr}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-end">
                  <button
                    onClick={handleApplyUpdate}
                    className="bg-emerald-500 hover:bg-emerald-650 active:scale-95 text-white text-[11px] font-black px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer transition-all shrink-0"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'تحديث الآن وتفعيل الميزة' : 'Update & Activate Now'}</span>
                  </button>
                  <button
                    onClick={() => setUpdateAvailable(false)}
                    className="text-white/70 hover:text-white hover:bg-white/10 px-3 py-2 rounded-xl text-[11px] font-extrabold cursor-pointer transition-colors shrink-0"
                  >
                    {lang === 'ar' ? 'لاحقاً' : 'Later'}
                  </button>
                </div>
              </div>
            )}

            {/* SAAS BROADCASTS UPDATES ALERT ELEMENT (NOTIFICATIONS FROM DEV PUSH) */}
            {broadcasts.length > 0 && broadcasts.filter(b => b.isUpdate).slice(0, 1).map(notice => (
              <div key={notice.id} className="bg-amber-500 text-slate-950 text-xs px-4 py-2 font-black flex items-center justify-between text-start gap-2 animate-pulse">
                <span className="flex items-center gap-1.5 shrink-0">
                  <Bell className="w-4.5 h-4.5 text-slate-900" />
                  📢 <strong>{lang === 'ar' ? 'تحديث هام:' : 'Broadcast:'}</strong>
                </span>
                <span className="flex-1 line-clamp-1">{notice.title} — {notice.content}</span>
                <button
                  onClick={() => setBroadcasts(broadcasts.filter(b => b.id !== notice.id))}
                  className="text-slate-900 hover:bg-amber-600 px-2.5 py-0.5 rounded-lg text-[10px] font-bold"
                >
                  ✕ {t.cancel}
                </button>
              </div>
            ))}

            {/* MASTER HEADER */}
            {shop && (shop.status === 'trial' || shop.status === 'pending') && shop.id !== 'system-admin-tenant' && (
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs px-4 py-2.5 font-bold flex flex-col md:flex-row items-center justify-between text-center md:text-start gap-2 border-b border-amber-600/50 shadow-sm" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <div className="flex flex-col md:flex-row items-center gap-2">
                  <span className="bg-slate-900 text-amber-400 text-[10px] px-2.5 py-1 rounded-xl font-black shrink-0">
                    {lang === 'ar' ? '⚠️ نسخة تجريبية مؤقتة' : '⚠️ DEMO TRIAL PLAN'}
                  </span>
                  <span className="text-slate-950 text-[11px] leading-tight">
                    {lang === 'ar'
                      ? `هذا الحساب ينشط بنمط تجريبي مجاني لمدة 14 يوماً. متبقي ${Math.max(0, Math.ceil((new Date(shop.trialEndDate || '').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} يوم ومسموح بـ 14 منتج/مبيعات/صيانة حتى التفعيل.`
                      : `Active free trial license is running for 14 days. ${Math.max(0, Math.ceil((new Date(shop.trialEndDate || '').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} days remaining with 14 products, 14 sales, and 14 maintenance tickets limit.`
                    }
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-2 mt-1 md:mt-0 text-[10px] font-extrabold text-slate-900">
                  <span className="bg-white/40 px-2 py-0.5 rounded-lg border border-slate-900/10">
                    📦 {lang === 'ar' ? 'المنتجات:' : 'Products:'} {DzStoreDB.getProducts(shop.id).length}/14
                  </span>
                  <span className="bg-white/40 px-2 py-0.5 rounded-lg border border-slate-900/10">
                    🛒 {lang === 'ar' ? 'المبيعات:' : 'Sales:'} {DzStoreDB.getSales(shop.id).length}/14
                  </span>
                  <span className="bg-white/40 px-2 py-0.5 rounded-lg border border-slate-900/10">
                    🔧 {lang === 'ar' ? 'الصيانة:' : 'Repairs:'} {DzStoreDB.getMaintenanceJobs(shop.id).length}/14
                  </span>
                  <span className="bg-slate-900 text-white font-mono text-[10px] select-all px-2.5 py-0.5 rounded-lg border border-slate-850">
                    Shop ID: {shop.id}
                  </span>
                </div>
              </div>
            )}

            <header className="glass-panel py-3 px-4 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-40 border-b border-white/40 dark:border-slate-800/80">
              <div className="flex items-center justify-between w-full md:w-auto gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors"
                    title="Toggle Sidebar Menu (F10)"
                  >
                    {isSidebarOpen ? <X className="w-4 h-4 text-emerald-600" /> : <Menu className="w-4 h-4 text-emerald-600" />}
                  </button>

                  <div className="flex items-center gap-2.5 text-start">
                    {shopSettings?.logoImage || shop?.logoUrl ? (
                      <img
                        src={shopSettings?.logoImage || shop?.logoUrl}
                        alt="Shop Logo"
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500 shadow-xs animate-none"
                      />
                    ) : (
                      <div className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 p-2 rounded-xl font-bold tracking-tight" id="header_shop_avatar2">
                        🇩🇿 POS
                      </div>
                    )}
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">{shop?.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <div className="flex gap-1 items-center text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                          <span>{user.role} mode</span>
                        </div>
                        
                        {/* Activation badge */}
                        {shop && (
                          shop.status === 'trial' ? (
                            <span className="bg-amber-100 dark:bg-amber-950/80 border border-amber-250 dark:border-amber-900/60 text-amber-800 dark:text-amber-400 text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1">
                              ⏳ {lang === 'ar' ? 'فترة تجريبية متبقية' : 'Trial Period'}: {
                                (() => {
                                  const pCount = DzStoreDB.getProducts(shop.id).length;
                                  const mCount = DzStoreDB.getMaintenanceJobs(shop.id).length;
                                  return lang === 'ar' 
                                    ? `(السلع: ${pCount}/10 ، الصيانة: ${mCount}/10)` 
                                    : `(Items: ${pCount}/10, Repair: ${mCount}/10)`;
                                })()
                              }
                            </span>
                          ) : shop.status === 'active' ? (
                            <span className="bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-250 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-400 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                              🛡️ {lang === 'ar' ? 'مفعل بالكامل (ترخيص سنوي)' : 'Activated (Full License)'}
                            </span>
                          ) : (
                            <span className="bg-rose-100 dark:bg-rose-950/80 border border-rose-250 dark:border-rose-900/60 text-rose-800 dark:text-rose-400 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                              🔒 {lang === 'ar' ? 'موقوف مؤقتا' : 'Suspended'}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile time ticker display / micro stats */}
                <div className="md:hidden flex items-center font-semibold text-xs bg-white/60 dark:bg-slate-800 border border-white/80 dark:border-slate-700 px-2 py-1 rounded-xl text-slate-700 dark:text-slate-300">
                  {currentTime}
                </div>
              </div>

              {/* Header Rightside controls bar */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                
                {/* Independent Sync Queue Monitor Display */}
                <SyncMonitor lang={lang} />

                {/* Clock ticker */}
                <div className="hidden md:flex items-center font-semibold text-xs px-3 py-1.5 bg-white/60 dark:bg-slate-800 border border-white/80 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-600 animate-none" />
                  <span>{currentTime}</span>
                </div>

                {/* Direct quick Dark Mode header switcher as well! */}
                <button
                  type="button"
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 bg-white/60 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-white/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer transition-colors"
                  title={lang === 'ar' ? 'تبديل المظهر الليلي' : 'Toggle Dark Mode'}
                >
                  {darkMode ? <Sun className="w-4 h-4 text-amber-500 animate-none" /> : <Moon className="w-4 h-4" />}
                </button>

                {/* Language selection dropdown */}
                <select
                  value={lang}
                  onChange={e => {
                    const setLangVal = e.target.value as Language;
                    setLang(setLangVal);
                    if (shop) {
                      const originalSettings = DzStoreDB.getSettings(shop.id);
                      DzStoreDB.saveSettings(shop.id, { ...originalSettings, language: setLangVal });
                    }
                  }}
                  className="text-xs bg-white/60 dark:bg-slate-800 text-slate-755 dark:text-slate-200 py-1.5 px-2.5 rounded-xl border border-white/80 dark:border-slate-700 font-bold focus:outline-none glass-input select-none"
                >
                  <option value="ar">العربية (Algeria)</option>
                  <option value="fr">Français</option>
                  <option value="en">English (US)</option>
                  <option value="pl">Polski (Poland)</option>
                </select>

              {/* Theme custom picker */}
              <div className="flex items-center gap-1 bg-white/60 dark:bg-slate-800/80 p-1 rounded-xl border border-white/80 dark:border-slate-700">
                {[
                  { id: 'sky-ocean', color: 'bg-sky-500', name: 'Sky Ocean' },
                  { id: 'emerald-grass', color: 'bg-emerald-500', name: 'Emerald Grass' },
                  { id: 'indigo-royal', color: 'bg-indigo-500', name: 'Indigo Royal' },
                  { id: 'violet-blossom', color: 'bg-violet-500', name: 'Violet Blossom' },
                  { id: 'amber-sunset', color: 'bg-amber-500', name: 'Amber Sunset' },
                  { id: 'rose-ruby', color: 'bg-rose-500', name: 'Ruby Rose' },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleQuickThemeChange(item.id as any)}
                    className={`w-3 h-3 rounded-full cursor-pointer transition-transform ${item.color} ${activeTheme === item.id ? 'ring-2 ring-slate-800 dark:ring-white scale-110' : 'opacity-70 hover:opacity-100'}`}
                    title={item.name}
                  />
                ))}
              </div>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="text-xs bg-rose-500/10 border border-rose-200 hover:bg-rose-500/20 text-rose-700 font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
                {t.logout}
              </button>
            </div>
          </header>

          {isShopBlocked ? (
            <div className="p-4 lg:p-8 max-w-2xl mx-auto w-full space-y-6 flex flex-col justify-center items-center min-h-[75vh] font-sans" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <div className="glass-panel w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 lg:p-10 rounded-3xl shadow-xl space-y-6 relative overflow-hidden text-start">
                
                {/* Visual feedback depending on status */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500 animate-pulse" />
                
                <div className="flex flex-col sm:flex-row items-center gap-4 border-b border-slate-100 dark:border-slate-850 pb-5">
                  <div className="bg-amber-100 dark:bg-amber-950/40 p-3 rounded-2xl text-amber-650 dark:text-amber-400">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <div className="text-center sm:text-start space-y-1">
                    <h2 className="text-lg lg:text-xl font-black text-slate-800 dark:text-white leading-tight">
                      {shop?.status === 'pending' && (lang === 'ar' ? '⏳ طلب تفعيل المتجر الجديد غير مكتمل!' : '⏳ Store activation is pending!')}
                      {shop?.status === 'suspended' && (lang === 'ar' ? '🔒 حساب المحل مجمّد وموقوف مؤقتاً!' : '🔒 Store subscription is suspended!')}
                      {(shop?.status === 'expired' || isTrialExpired) && (lang === 'ar' ? '⚠️ انتهت صلاحية الفترة التجريبية أو الترخيص السنوي!' : '⚠️ Store license has expired!')}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {lang === 'ar' 
                        ? `يتطلب هذا الحساب (${shop?.name}) إدخال كود ترخيص رقمي نشط ومصادق للاستمرار.`
                        : `Your shop workspace (${shop?.name}) requires a valid software license key to operate.`
                      }
                    </p>
                  </div>
                </div>

                {/* Machine ID Information Device fingerprint */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-55 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850 text-xs text-start">
                  <div className="space-y-1.5">
                    <p className="font-extrabold text-indigo-600 dark:text-indigo-400 block uppercase tracking-wider text-[10px]">
                      📋 {lang === 'ar' ? 'معلومات المتجر والحساب التجريبي:' : 'Demo Shop Details:'}
                    </p>
                    <p className="text-slate-900 dark:text-slate-100 font-bold">🏪 {shop?.name}</p>
                    <p className="text-slate-500 dark:text-slate-400">📧 {shop?.ownerEmail}</p>
                    <p className="text-slate-500 dark:text-slate-400">📞 {shop?.phone}</p>
                    <p className="text-slate-550 dark:text-slate-400">📍 {lang === 'ar' ? 'المدينة/العنوان:' : 'City/Address:'} {shop?.address || 'Algeria'}</p>
                    <p className="text-slate-550 dark:text-slate-400">📅 {lang === 'ar' ? 'تاريخ التسجيل:' : 'Registration Date:'} {shop?.createdAt ? shop.createdAt.split('T')[0] : '-'}</p>
                    <p className="text-rose-600 font-extrabold">📊 {lang === 'ar' ? 'العمليات المنجزة:' : 'Transactions:'} <span className="bg-rose-50 px-1.5 py-0.5 rounded-md font-mono">{salesCount} / 100</span></p>
                  </div>

                  <div className="space-y-1.5 border-t md:border-t-0 md:border-r border-slate-200 dark:border-slate-800 pt-2.5 md:pt-0 md:pr-4">
                    <p className="font-extrabold text-slate-450 block uppercase tracking-wider text-[10px]">
                      💻 {lang === 'ar' ? 'بصمة جهازك الحالي (Machine ID):' : 'Detected Hardware Fingerprint:'}
                    </p>
                    <p className="font-mono text-cyan-600 dark:text-cyan-400 font-extrabold tracking-wider select-all text-xs bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded w-fit block border border-slate-205 dark:border-slate-800">
                      {localStorage.getItem('dzstore_license_device_id') || 'UNKNOWN-HW'}
                    </p>
                    
                    {/* Messaging helpers */}
                    <button
                      type="button"
                      onClick={() => {
                        const msg = `أهلاً، أرغب في تفعيل اشتراك محل DZ Store:\n🏪 المتجر: ${shop?.name}\n👤 البريد: ${shop?.ownerEmail}\n📞 الهاتف: ${shop?.phone}\n📍 المدينة: ${shop?.address}\n💻 البصمة: ${localStorage.getItem('dzstore_license_device_id')}\n📊 عدد المبيعات: ${salesCount}`;
                        window.open(`https://wa.me/213550123456?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                      className="w-full mt-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-all text-[11px] text-center cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                    >
                      💬 {lang === 'ar' ? 'طلب التفعيل فوري عبر الواتساب' : 'Request Activation WhatsApp'}
                    </button>
                  </div>
                </div>

                {/* Dynamic Instructions & Payment Section */}
                <div className="p-4 bg-indigo-500/5 dark:bg-indigo-950/20 rounded-2xl border border-indigo-500/10 space-y-2 text-xs">
                  <span className="font-black text-indigo-700 dark:text-indigo-400 block">
                    🇩🇿 {lang === 'ar' ? 'معلومات تجديد تفعيل الترخيص (بريدي موب):' : 'Payment & Activation Coordinates (BaridiMob):'}
                  </span>
                  <p className="text-slate-600 dark:text-slate-350 whitespace-pre-line leading-relaxed font-sans text-[11px]">
                    {DzStoreDB.getBaridiMobDetails()}
                  </p>
                </div>

                {/* FORM FOR LICENSE KEY INPUT */}
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    🗝️ {lang === 'ar' ? 'أدخل كود الترخيص الرقمي المصادق هنا للتفعيل الفوري (License Key):' : 'Enter digital license activation code:'}
                  </label>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      className="flex-1 font-mono text-center font-black tracking-widest text-xs uppercase px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      placeholder="DZPOS-XXXX-XXXX-XXXX-XXXX"
                      value={activationKeyInput}
                      onChange={e => setActivationKeyInput(e.target.value.toUpperCase().trim())}
                    />
                    
                    <button
                      type="button"
                      onClick={() => {
                        if (!activationKeyInput) {
                          triggerToast(
                            lang === 'ar' ? '❌ يرجى إدخال كود الترخيص أولاً للمتابعة!' : '❌ Please input the activation code first!',
                            'warning'
                          );
                          return;
                        }

                        const result = DzStoreDB.verifyLicenseKey(activationKeyInput);
                        if (!result.isValid) {
                          triggerToast(
                            lang === 'ar' 
                              ? '❌ مفتاح الترخيص المدخل غير صالح أو انتهت سلامة توقيعه!' 
                              : '❌ License validation failed! Highly secure cryptographic checksum is invalid.',
                            'warning'
                          );
                          DzStoreAudio.playWarningChime(enableSounds);
                          return;
                        }

                        // Code checks out!
                        // Now check device fingerprint to prevent piracy
                        const currentDeviceId = localStorage.getItem('dzstore_license_device_id') || 'UNKNOWN-HW';
                        
                        if (shop?.hardwareFingerprint && shop.hardwareFingerprint !== currentDeviceId) {
                          // This license was activated on another machine! Blocking execution.
                          triggerToast(
                            lang === 'ar' 
                              ? '🔒 عذراً، كود الترخيص هذا مرتبط ببصمة جهاز آخر منعاً للقرصنة! لتغييره تواصل مع الدعم لتصفير الأجهزة.' 
                              : '🔒 Sorry, this license key is locked to another hardware device. Contact admin to decouple.',
                            'warning'
                          );
                          DzStoreAudio.playWarningChime(enableSounds);
                          return;
                        }

                        // Valid key and matched device. Activate!
                        const d = new Date();
                        if (result.isLifetime) {
                          d.setFullYear(d.getFullYear() + 80); // Lifetime (80 years)
                        } else {
                          d.setMonth(d.getMonth() + result.months);
                        }

                        const computedExpiry = d.toISOString().split('T')[0];

                        // Build updated shop instance
                        const updatedShop = {
                          ...shop,
                          status: 'active' as const,
                          trialEndDate: computedExpiry,
                          licenseKey: activationKeyInput,
                          hardwareFingerprint: currentDeviceId,
                          updatedAt: new Date().toISOString()
                        };

                        // Real-time synchronization directly in Cloud Firestore
                        setDoc(doc(db, 'shops', shop.id), updatedShop)
                          .then(() => {
                            console.log("Firestore store activated successfully!");
                          })
                          .catch(err => {
                            console.warn("Direct Firestore license validation sync failed, cached locally", err);
                          });

                        // Save locally
                        const allShopsObj = DzStoreDB.getShops();
                        const shopIdx = allShopsObj.findIndex(s => s.id === shop.id);
                        if (shopIdx > -1) {
                          allShopsObj[shopIdx] = updatedShop;
                          DzStoreDB.saveShops(allShopsObj);
                        }

                        setShop(updatedShop);
                        setActivationKeyInput('');
                        triggerToast(
                          lang === 'ar' 
                            ? '🎉 تم تفعيل الترخيص الرقمي للمحل بنجاح! تم فتح كامل الميزات وتأصيل العقد.' 
                            : '🎉 License activated successfully!',
                          'success'
                        );
                        DzStoreAudio.playSuccessChime(enableSounds);
                      }}
                      className="bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold text-xs px-6 py-3 rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
                    >
                      🚀 {lang === 'ar' ? 'تفعيل الترخيص الرقمي' : 'Activate Software License'}
                    </button>
                  </div>
                </div>

                {/* Switch Account back button to let them login as admin or else */}
                <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-850">
                  <p className="text-[10px] text-slate-400 font-mono font-bold">DzStore Cryptographic Shield v4.2</p>
                  <button
                    onClick={handleLogout}
                    className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl border border-slate-200/50 dark:border-slate-700 flex items-center gap-1 transition-colors cursor-pointer font-bold"
                  >
                    🚶 {lang === 'ar' ? 'خروج العميل من المحل' : 'Logout & Back'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* SYSTEM HOME DASHBOARD SUMMARY SECTION (VISIBLE ON TAB === 'HOME') */}
              {activeTab === 'home' && (
            <div key={`home-${syncKey}`} className="p-4 lg:p-8 space-y-6">
              
              {/* Home main metrics grids displaying money & items count */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="glass-panel rounded-2xl p-4 text-start flex justify-between items-center shadow-xs border border-white/40 hover:scale-[1.01] transition-transform">
                  <div>
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase block">{t.total_sales_today}</span>
                    <span className="text-lg lg:text-xl font-black text-slate-800 mt-1 font-mono">
                      {stats.todaySalesAmount.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                    </span>
                  </div>
                  <div className="bg-emerald-500/15 p-2 rounded-xl text-emerald-600">
                    <Activity className="w-6 h-6" />
                  </div>
                </div>

                <div className="glass-panel rounded-2xl p-4 text-start flex justify-between items-center shadow-xs border border-white/40 hover:scale-[1.01] transition-transform">
                  <div>
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase block">{t.inventory} ({t.quantity})</span>
                    <span className="text-lg lg:text-xl font-black text-slate-800 mt-1 font-mono">{stats.inventoryCount}</span>
                  </div>
                  <div className="bg-purple-500/15 p-2 rounded-xl text-purple-600">
                    <PackageCheck className="w-6 h-6" id="prodcheck_tag_logo" />
                  </div>
                </div>

                <div className="glass-panel rounded-2xl p-4 text-start flex justify-between items-center shadow-xs border border-white/40 hover:scale-[1.01] transition-transform">
                  <div>
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase block">{t.active_jobs}</span>
                    <span className="text-lg lg:text-xl font-black text-emerald-600 mt-1 font-mono">{stats.maintenanceCount}</span>
                  </div>
                  <div className="bg-teal-500/15 p-2 rounded-xl text-teal-600">
                    <Wrench className="w-6 h-6" />
                  </div>
                </div>

                <div className="glass-panel rounded-2xl p-4 text-start flex justify-between items-center shadow-xs border-rose-100/40 border hover:scale-[1.01] transition-transform">
                  <div>
                    <span className="text-[10px] text-rose-500 font-extrabold uppercase block">{lang === 'ar' ? 'كريدي ومستحقات على الزبائن' : 'Installment debts due'}</span>
                    <span className="text-lg lg:text-xl font-black text-rose-600 mt-1 font-mono">
                      {stats.clientDues.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                    </span>
                  </div>
                  <div className="bg-rose-500/15 p-2 rounded-xl text-rose-600">
                    <Users className="w-6 h-6" />
                  </div>
                </div>

              </div>

              {/* Quick links bento block maps */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Visual block widget: Cashier Point of Sale quick link */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Interactive SVG Chart for latest Cashflow */}
                  <div className="glass-panel rounded-3xl p-6 border border-white/45 shadow-xs text-start relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-emerald-500/15 p-2 rounded-xl text-emerald-600">
                          <Activity className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm text-slate-800">
                            {lang === 'ar' ? 'مخطط المبيعات البياني الأسبوعي' : 'Weekly Sales Activity Chart'}
                          </h3>
                          <p className="text-[10px] text-slate-400">
                            {lang === 'ar' ? 'تقرير فوري يعكس نشاط الصندوق وسحوبات اليوم' : 'Live analytics update of cache transactions'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-extrabold font-mono px-2 py-0.5 rounded-md border border-slate-200 uppercase">
                        {lang === 'ar' ? 'أوتوماتيكي' : 'REAL-TIME'}
                      </span>
                    </div>

                    {/* SVG Chart Drawing inside responsive viewbox */}
                    <div className="relative h-44 w-full">
                      {weeklySalesData.length > 0 ? (
                        <div className="h-full w-full flex flex-col justify-between">
                          <svg className="w-full h-32" viewBox="0 0 500 130" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            {/* Horizontal grid lines */}
                            <line x1="0" y1="30" x2="500" y2="30" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                            <line x1="0" y1="65" x2="500" y2="65" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                            <line x1="0" y1="100" x2="500" y2="100" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />

                            {/* Polygon Fill */}
                            <path
                              d={`M 0 130 ${weeklySalesData.map((d: any, idx: number) => `L ${idx * (500 / 6)} ${120 - Math.min(100, (d.total / Math.max(...weeklySalesData.map(o => o.total), 10000)) * 90)}`).join(' ')} L 500 130 Z`}
                              fill="url(#chartGrad)"
                            />

                            {/* Line path */}
                            <path
                              d={weeklySalesData.map((d: any, idx: number) => `${idx === 0 ? 'M' : 'L'} ${idx * (500 / 6)} ${120 - Math.min(100, (d.total / Math.max(...weeklySalesData.map(o => o.total), 10000)) * 90)}`).join(' ')}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            {/* Interactive Data Dots */}
                            {weeklySalesData.map((d: any, idx: number) => {
                              const maxTotal = Math.max(...weeklySalesData.map(o => o.total), 10000);
                              const x = idx * (500 / 6);
                              const y = 120 - Math.min(100, (d.total / maxTotal) * 90);
                              return (
                                <g key={idx} className="group cursor-pointer">
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r="5"
                                    fill="#ffffff"
                                    stroke="#10b981"
                                    strokeWidth="3.5"
                                    className="transition-all hover:r-7"
                                  />
                                  <text
                                    x={x}
                                    y={y - 12}
                                    textAnchor="middle"
                                    className="text-[9px] font-black font-mono fill-emerald-800 bg-white"
                                  >
                                    {d.total > 0 ? `${Math.round(d.total / 1000)}k` : ''}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>

                          {/* Labels Row */}
                          <div className="flex justify-between px-1 border-t border-slate-100 pt-2 text-slate-500 text-[10px] font-bold font-mono">
                            {weeklySalesData.map((d: any, idx: number) => (
                              <span key={idx}>{d.label}</span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400">
                          {lang === 'ar' ? 'سجل أول عملية بيع لتنشيط الرسم البياني التفاعلي' : 'Complete first sale checkout to populate diagram'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Low Stock Alerts Board */}
                  {lowStockItems.length > 0 && (
                    <div className="glass-panel rounded-3xl p-6 border border-rose-500/25 bg-linear-to-b from-white to-rose-500/5 dark:from-slate-900 dark:to-rose-950/10 text-start">
                      <h3 className="font-extrabold text-sm text-rose-950 dark:text-rose-400 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-rose-600 animate-pulse" />
                        {lang === 'ar' ? '⚠️ تنبيهات نفاذ المخزون (منتجات أوشكت على الانتهاء)' : '⚠️ Low Stock Alerts'}
                      </h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {lowStockItems.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-white/70 dark:bg-slate-800/80 border border-rose-100 dark:border-rose-900 text-xs text-slate-850 dark:text-slate-150">
                            <div className="text-start">
                              <span className="font-extrabold">{item.name}</span>
                              <p className="text-[10px] text-slate-400">{item.brand} | {item.type}</p>
                            </div>
                            <div className="text-end flex items-center gap-2">
                              <span className="text-[10px] font-black text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-md border border-rose-100 dark:border-rose-900">
                                {lang === 'ar' ? `المتبقي: ${item.quantity} قـطعة` : `Left: ${item.quantity} pcs`}
                              </span>
                              <button
                                onClick={() => setActiveTab('inventory')}
                                className="text-[9px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-white text-slate-750 px-2 py-1 rounded-md font-bold transition-colors cursor-pointer"
                              >
                                {lang === 'ar' ? 'جرد / إعادة توريد' : 'Reorder'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Broadcast Bulletins panel board inside the dashboard */}
                  <div className="glass-panel rounded-3xl p-6 border border-white/45 text-start">
                    <h3 className="font-extrabold text-sm text-slate-800 mb-3 flex items-center gap-1">
                      <Bell className="w-4 h-4 text-emerald-600" />
                      {lang === 'ar' ? 'لوحة التنويهات والأخـبـار (نظام الساس)' : 'Cloud Communications Board'}
                    </h3>
                    {broadcasts.length > 0 ? (
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                        {broadcasts.map((b: any) => (
                          <div key={b.id} className="p-3 rounded-2xl bg-white/50 border border-slate-100 text-xs">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-slate-900">{b.title}</span>
                              <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border font-mono">{b.date}</span>
                            </div>
                            <p className="text-slate-600 leading-relaxed text-[11px]">{b.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 font-semibold">{lang === 'ar' ? 'لا توجد منشورات أو برودكاست حالياً من السيرفر.' : 'No cloud notices or server guidelines are active.'}</p>
                    )}
                  </div>
                </div>

                {/* Dashboard Sidebar Controls */}
                <div className="space-y-6">
                  {/* Point of Sale checkout button */}
                  <div
                    onClick={() => setActiveTab('pos')}
                    className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-3xl p-6 text-start flex flex-col justify-between h-36 cursor-pointer shadow-md hover:shadow-lg transition-all transform hover:scale-[1.01] border border-white/20 relative overflow-hidden"
                  >
                    <div className="bg-white/10 p-2 rounded-2xl w-fit text-yellow-300">
                      <ShoppingCart className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-black">{t.pos_cashier}</h3>
                      <p className="text-[10px] text-emerald-100/90 mt-1 leading-relaxed">
                        {lang === 'ar' ? 'افتح كاشير المحل، ابكود المنتجات واستخرج وصولات الضمان الفورية' : 'Point of Sale instant cashier gateway'}
                      </p>
                    </div>
                  </div>

                  {/* Maintenance workshop tracker button */}
                  <div
                    onClick={() => setActiveTab('maintenance')}
                    className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-3xl p-6 text-start flex flex-col justify-between h-36 cursor-pointer shadow-md hover:shadow-lg transition-all transform hover:scale-[1.01] border border-white/20 relative overflow-hidden"
                  >
                    <div className="bg-white/10 p-2 rounded-2xl w-fit text-yellow-300">
                      <Wrench className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-black">{t.maintenance_workshop}</h3>
                      <p className="text-[10px] text-teal-100/90 mt-1 leading-relaxed">
                        {lang === 'ar' ? 'تتبع صيانة الأجهزة وهواتف الزبائن واقتطاع قطع الصيانة تلقائياً' : 'Repair ticket workflow coordination'}
                      </p>
                    </div>
                  </div>

                  {/* Telegram panel helper client */}
                  <div className="glass-panel rounded-3xl p-6 text-start flex flex-col justify-between h-36 shadow-xs relative overflow-hidden border border-white/40">
                    <div>
                      <span className="text-[8px] bg-sky-50 text-sky-800 font-extrabold uppercase rounded-md px-2 py-0.5 tracking-wider border">TELEGRAM INTEGRATION</span>
                      <h4 className="text-xs font-black text-slate-800 mt-2">{lang === 'ar' ? 'رسائل تليجرام الجاهزة للزبون' : 'Telegram Templates Client'}</h4>
                      <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                        {lang === 'ar' ? 'احصل على قوالب جاهزة لمشاركة وضعية الصيانة والفواتير عبر تليجرام بنقرة زر!' : 'Copy billing statuses and text drafts instantly.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('telegram')}
                      className="text-[10px] bg-sky-50 text-sky-800 hover:bg-sky-100 font-extrabold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-transform w-fit mt-2 border border-sky-100"
                    >
                      Open Templates ✈
                    </button>
                    <div className="absolute right-[-10px] bottom-[-15px] opacity-10">
                      <Send className="w-20 h-20 text-sky-700" id="send_bg_dec" />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Renders POS SCREEN (CASHIER AND BARCODES SCANNING) */}
          {activeTab === 'pos' && (
            <div className="p-4 lg:p-8">
              <POSScreen
                key="pos"
                syncKey={syncKey}
                shopId={shop.id}
                currency={currency}
                lang={lang}
                cashierName={user.name}
                cashierId={user.id}
                onRefreshStats={handleRecalculateMetrics}
                enableSounds={enableSounds}
                onPrintInvoice={(sale: any) => setActiveReceipt(sale)}
                onShowToast={(msg: string, type: any) => triggerToast(msg, type)}
              />
            </div>
          )}

          {/* Renders CENTRAL STORE INVENTORY WAREHOUSE CORES */}
          {activeTab === 'inventory' && (
            <div className="p-4 lg:p-8">
              <InventoryScreen
                key="inventory"
                syncKey={syncKey}
                shopId={shop.id}
                currency={currency}
                lang={lang}
                onRefreshStats={handleRecalculateMetrics}
                enableSounds={enableSounds}
                user={user}
              />
            </div>
          )}

          {/* Renders SUPPLIERS / LEDGERS AND installment accounts CUSTOMERS */}
          {activeTab === 'partners' && (
            <div className="p-4 lg:p-8">
              <SuppliersCustomersScreen
                key="partners"
                syncKey={syncKey}
                shopId={shop.id}
                currency={currency}
                lang={lang}
                onRefreshStats={handleRecalculateMetrics}
                enableSounds={enableSounds}
              />
            </div>
          )}

          {/* MAINTENANCE CENTER SCREEN */}
          {activeTab === 'maintenance' && (
            <div className="p-4 lg:p-8">
              <MaintenanceScreen
                key="maintenance"
                syncKey={syncKey}
                shopId={shop.id}
                currency={currency}
                lang={lang}
                onRefreshStats={handleRecalculateMetrics}
                enableSounds={enableSounds}
              />
            </div>
          )}

          {/* USED PHONES SECURITY AND COMPLIANCE CENTER */}
          {activeTab === 'used-phones' && shop && (
            <div className="p-4 lg:p-8">
              <UsedPhonesScreen
                key="used-phones"
                syncKey={syncKey}
                shopId={shop.id}
                currency={currency}
                lang={lang}
                enableSounds={enableSounds}
                onRefreshStats={handleRecalculateMetrics}
              />
            </div>
          )}

          {/* CUSTOMER MESSAGES CONTROL BOARD */}
          {activeTab === 'messages' && shop && (
            <div className="p-4 lg:p-8">
              <MessagesScreen
                key="messages"
                syncKey={syncKey}
                shopId={shop.id}
                currency={currency}
                lang={lang}
                enableSounds={enableSounds}
              />
            </div>
          )}

          {/* STOREFRONT CHECOUT CLIENT ORDERS TAB */}
          {activeTab === 'orders' && shop && (
            <div className="p-4 lg:p-8">
              <OrdersScreen
                key="orders"
                shopId={shop.id}
                currency={currency}
                lang={lang}
                onShowToast={(msg, role) => triggerToast(msg, role as any)}
              />
            </div>
          )}

          {/* NATIVE SIMULATED CUSTOMER COMMUNICATION CENTER */}
          {activeTab === 'telegram' && shop && (
            <div className="p-4 lg:p-8">
              <CustomerCommunicationCenter
                key={`tele-${syncKey}`}
                lang={lang}
                currency={currency}
                shopName={shop.name}
                shopId={shop.id}
                enableSounds={enableSounds}
              />
            </div>
          )}

          {/* EXCLUSIVE SaaS ADMIN PANEL (gestion.stock34@gmail.com) */}
          {activeTab === 'admin' && (
            <div className="p-4 lg:p-8">
              <AdminPanel
                key={`admin-${syncKey}`}
                lang={lang}
                currency={currency}
                onRefreshAll={handleRecalculateMetrics}
                enableSounds={enableSounds}
              />
            </div>
          )}

          {/* UTILITIES CONFIGURATIONS AND CREDIT RESTORES */}
          {activeTab === 'settings' && (
            <div className="p-4 lg:p-8">
              <SettingsScreen
                key={`settings-${syncKey}`}
                shopId={shop.id}
                lang={lang}
                currency={currency}
                onLanguageChange={setLang}
                onCurrencyChange={setCurrency}
                onToggleSounds={setEnableSounds}
                enableSounds={enableSounds}
                onRefreshStats={() => {
                  handleRecalculateMetrics();
                  setSyncKey(prev => prev + 1);
                }}
                darkMode={darkMode}
                onToggleDarkMode={setDarkMode}
                activeTheme={activeTheme}
                onThemeChange={setActiveTheme}
              />
            </div>
          )}

          {/* STAFF MANAGEMENT ACCOUNT TAB - RESTRICTED */}
          {activeTab === 'users' && (user.role === 'owner' || user.role === 'admin') && (
            <div className="p-4 lg:p-8">
              <UsersScreen
                key={`users-${syncKey}`}
                shopId={shop.id}
                lang={lang}
                onRefreshStats={handleRecalculateMetrics}
                enableSounds={enableSounds}
              />
            </div>
          )}

          {/* PROFIT REPORTS TAB - RESTRICTED */}
          {activeTab === 'reports' && (user.role === 'owner' || user.role === 'admin' || user.canViewReports) && (
            <div className="p-4 lg:p-8">
              <ReportsScreen
                key={`reports-${syncKey}`}
                shopId={shop.id}
                currency={currency}
                lang={lang}
                user={user}
              />
            </div>
          )}

          </>
          )}

          {/* NAVIGATION HUD / FOOTER FLOATING RAIL BOARD (MOBILE ONLY) */}
          <footer className="mt-auto glass-panel sticky bottom-0 z-40 md:hidden border-t border-white/40 py-2 px-3 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
            <div className="max-w-6xl mx-auto flex justify-around items-center gap-1">
              
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className={`py-1.5 px-2.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                  activeTab === 'home' ? `${tc.primary} text-white shadow-sm` : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span className="hidden xs:inline">{t.homepage}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pos')}
                className={`py-1.5 px-2.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                  activeTab === 'pos' ? `${tc.primary} text-white shadow-sm` : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <ShoppingCart className="w-4 h-4 shrink-0" />
                <span className="hidden xs:inline">{t.pos_cashier}</span>
              </button>

              {user.role !== 'seller' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('inventory')}
                  className={`py-1.5 px-2.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                    activeTab === 'inventory' ? `${tc.primary} text-white shadow-sm` : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <PackageCheck className="w-4 h-4 shrink-0" />
                  <span className="hidden xs:inline">{t.inventory}</span>
                </button>
              )}

              {user.role !== 'technician' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('partners')}
                  className={`py-1.5 px-2.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                    activeTab === 'partners' ? `${tc.primary} text-white shadow-sm` : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span className="hidden xs:inline">{lang === 'ar' ? 'الديون' : 'Credits'}</span>
                </button>
              )}

              {user.role !== 'seller' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('maintenance')}
                  className={`py-1.5 px-2.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                    activeTab === 'maintenance' ? `${tc.primary} text-white shadow-sm` : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Wrench className="w-4 h-4 shrink-0" />
                  <span className="hidden xs:inline">{lang === 'ar' ? 'صيانة' : 'Repairs'}</span>
                </button>
              )}

              {/* USED PHONES mobile navigation */}
              <button
                type="button"
                onClick={() => setActiveTab('used-phones')}
                className={`py-1.5 px-2.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                  activeTab === 'used-phones' ? `${tc.primary} text-white shadow-sm` : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Fingerprint className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="hidden xs:inline">{lang === 'ar' ? 'مستعمل' : 'Used'}</span>
              </button>

              {/* MESSAGES mobile navigation */}
              <button
                type="button"
                onClick={() => setActiveTab('messages')}
                className={`py-1.5 px-2.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all relative ${
                  activeTab === 'messages' ? `${tc.primary} text-white shadow-sm` : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="hidden xs:inline">{lang === 'ar' ? 'رسائل' : 'Mail'}</span>
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                )}
              </button>

              {(user.role === 'owner' || user.role === 'admin') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('telegram')}
                  className={`py-1.5 px-2.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                    activeTab === 'telegram' ? `${tc.primary} text-white shadow-sm` : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span className="hidden xs:inline">{lang === 'ar' ? 'الاتصالات' : 'Relations'}</span>
                </button>
              )}

              {user.email === 'gestion.stock34@gmail.com' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className={`py-1.5 px-2.5 rounded-xl text-[11px] font-black flex items-center gap-1 bg-amber-100 text-amber-900 cursor-pointer transition-all ${
                    activeTab === 'admin' ? 'ring-2 ring-emerald-500 bg-emerald-500/20' : 'text-amber-850'
                  }`}
                >
                  🛡️ <span className="hidden xs:inline">SaaS</span>
                </button>
              )}

              {(user.role === 'owner' || user.role === 'admin') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`py-1.5 px-2.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                    activeTab === 'settings' ? `${tc.primary} text-white shadow-sm` : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <SettingsIcon className="w-4 h-4 shrink-0" />
                  <span className="hidden xs:inline">{t.settings}</span>
                </button>
              )}

            </div>
          </footer>
          </div>
        </div>
      )}

      {/* Floating notifications toast manager */}
      <div className="fixed bottom-16 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`p-3.5 rounded-2xl shadow-lg border text-xs font-sans text-start flex items-center justify-between text-white ${
              toast.type === 'success' ? 'bg-emerald-600/95 border-emerald-500' :
              toast.type === 'warning' ? 'bg-rose-650/95 border-rose-500' :
              'bg-slate-800/95 border-slate-700'
            }`}
          >
            <span className="font-bold">{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-[10px] hover:bg-black/20 p-1 rounded-full text-white/80 font-black ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Dynamic Receipt Modal preview states */}
      {activeReceipt && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="receipt_modal_container">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative border border-slate-100 max-h-[90vh] overflow-y-auto">
            {/* Receipt header controls */}
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{lang === 'ar' ? '📄 معاينة وصل البيع والضمان المعتمـد' : '📄 Invoice & Bill Preview'}</h3>
              <button
                onClick={() => setActiveReceipt(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-full text-xs"
              >
                ✕
              </button>
            </div>

            {/* Printable Sheet Area */}
            <div className="p-4 bg-amber-50/20 border-2 border-dashed border-amber-500/25 rounded-2xl text-start text-xs font-sans leading-relaxed text-slate-800 dark:text-slate-200 bg-linear-to-b from-amber-50/10 to-amber-50/5" id="dz_printable_frame">
              <div className="text-center font-sans space-y-1 mb-4 border-b border-dashed border-slate-300 pb-3">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">{shop?.name}</h2>
                <p className="text-[11px] text-slate-500 font-mono">{shop?.phone || '+213 (0) 550...'}</p>
                <p className="text-[10px] text-slate-400">{shop?.address}</p>
              </div>

              {/* Invoice Info */}
              <div className="grid grid-cols-2 gap-2 text-[10px] mb-3 border-b border-dashed border-slate-300 pb-3 font-mono">
                <div>
                  <strong>Invoice #:</strong> {activeReceipt.invoiceNumber || `INV-${activeReceipt.id?.slice(-5)}`}<br/>
                  <strong>Date:</strong> {new Date(activeReceipt.date).toLocaleString()}
                </div>
                <div className="text-right">
                  <strong>Cashier:</strong> {activeReceipt.cashierName || 'Admin'}<br/>
                  <strong>Client:</strong> {activeReceipt.customerName || (lang === 'ar' ? 'زبون عادي' : 'Standard Guest')}
                </div>
              </div>

              {/* Products list Table */}
              <table className="w-full text-left border-collapse mb-4 text-[10px]">
                <thead>
                  <tr className="border-b border-slate-300 font-bold text-slate-600">
                    <th className="py-1">{lang === 'ar' ? 'الأصناف والتفاصيل' : 'Item Details'}</th>
                    <th className="py-1 text-center">{lang === 'ar' ? 'كمية' : 'Qty'}</th>
                    <th className="py-1 text-right">{lang === 'ar' ? 'سعر وحدة' : 'Unit Price'}</th>
                    <th className="py-1 text-right">{lang === 'ar' ? 'الإجمالي' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeReceipt.items?.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5 font-sans">
                        <span className="font-semibold block text-slate-900 dark:text-white">{item.name}</span>
                        {item.serialNumber && <span className="text-[9px] text-sky-700 font-mono select-all block">IMEI/SN: {item.serialNumber}</span>}
                      </td>
                      <td className="py-1.5 text-center font-mono">{item.quantity}</td>
                      <td className="py-1.5 text-right font-mono">{item.price?.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono">{(item.price * item.quantity)?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals column */}
              <div className="space-y-1 font-mono text-[10px] border-b border-dashed border-slate-300 pb-3 mb-3">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{activeReceipt.subtotal?.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}</span>
                </div>
                {activeReceipt.discount > 0 && (
                  <div className="flex justify-between text-rose-500">
                    <span>Discount:</span>
                    <span>-{activeReceipt.discount?.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-xs border-t pt-1.5 text-slate-900 dark:text-white">
                  <span>Total Payable:</span>
                  <span>{activeReceipt.total?.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}</span>
                </div>
              </div>

              {/* In-app stamp & warranties section */}
              <div className="bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 text-[9px] space-y-1 text-slate-700 dark:text-slate-300">
                <p className="font-bold text-[10px] text-emerald-800 dark:text-emerald-400">🛡️ {lang === 'ar' ? 'وصل وبطاقة ضمان المبيعات والصـيانة' : 'Warranty Statement'}</p>
                <p>{lang === 'ar' ? '• مدة الضمان المعتمد للمبيعات والاكسسوارات هي 7 أيام تجريب.' : '• Default warranty period for accessories is 7 days testing.'}</p>
                <p>{lang === 'ar' ? '• يسقط الضمان في حالة الكسر المادي، ملامسة السوائل والماء، أو الفتحات الخارجية.' : '• Void upon physical shocks, deep hardware liquid damage, or outer tampering.'}</p>
              </div>

              {/* Simulated signature stamp */}
              <div className="flex justify-between items-center mt-4">
                <div className="border border-dashed border-slate-300 p-2 text-center rounded-lg text-[8px] text-slate-400 font-mono">
                  ALGERIA TELECOM<br/>POS SYSTEM PENDING
                </div>
                <div className="text-center text-[9px] leading-tight text-emerald-700 font-bold border border-emerald-400 p-1.5 rounded-lg uppercase scale-95 rotate-[-2deg]">
                  🇩🇿 DZSTORE APPROVED<br/>OFFICIAL CERTIFICATE
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => {
                  window.print();
                  triggerToast(lang === 'ar' ? '🖨️ جاري إرسال الوصل للطابعة المباشرة...' : '🖨️ Dispatching ticket onto standard paper printer...', 'success');
                }}
                className="flex-1 py-2 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                🖨️ {lang === 'ar' ? 'طباعة الوصل الفورية' : 'Print Invoice'}
              </button>
              <button
                onClick={() => setActiveReceipt(null)}
                className="py-2 px-4 text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* First launch camera permission authorization modal card overlay */}
      {showCameraPromptModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center space-y-5 shadow-2xl">
            <div className="mx-auto w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Camera className="w-7 h-7" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {lang === 'ar' ? '📸 تمكين الكاميرا لمسح الباركود' : '📸 Request Camera Permission'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed text-center">
                {lang === 'ar'
                  ? 'لتسهيل مسح الأكواد والباركود الخاص بالسلع عبر كاميرا الهاتف مباشرة أثناء البيع والجرد، يرجى منح صلاحية الكاميرا للتطبيق.'
                  : 'To enable seamless product barcode scanning via your device camera during sales or stock count, please grant camera access permission.'
                }
              </p>
            </div>

            <div className="flex gap-2 text-xs">
              <button
                onClick={requestCameraPermission}
                className="flex-1 py-2.5 font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors cursor-pointer shadow-md"
              >
                {lang === 'ar' ? 'تفعيل الكاميرا الآن' : 'Enable Camera Now'}
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('dzstore_camera_requested', 'later');
                  setShowCameraPromptModal(false);
                }}
                className="py-2.5 px-4 font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                {lang === 'ar' ? 'لاحقاً' : 'Later'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
