
import React, { useState, useEffect } from 'react';
import pkg from '../../package.json';
import { Currency, Language, ShopSettings, AppUser } from '../types';
import { TRANSLATIONS } from '../lib/data';
import { DzStoreDB } from '../lib/db';
import { DzStoreAudio } from './AudioAlerts';
import { forceManualSync } from '../lib/syncManager';
import {
  Settings as SettingsIcon,
  Save,
  Globe2,
  DollarSign,
  Volume2,
  VolumeX,
  FileText,
  KeyRound,
  Download,
  Upload,
  User,
  Heart,
  Palette,
  Moon,
  Sun,
  Printer,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  Wifi,
  Check,
  QrCode
} from 'lucide-react';
import QRCode from 'qrcode';

interface SettingsScreenProps {
  shopId: string;
  lang: Language;
  currency: Currency;
  onLanguageChange: (lang: Language) => void;
  onCurrencyChange: (currency: Currency) => void;
  onToggleSounds: (enabled: boolean) => void;
  enableSounds: boolean;
  onRefreshStats: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: (enabled: boolean) => void;
  activeTheme?: 'sky-ocean' | 'emerald-grass' | 'indigo-royal' | 'violet-blossom' | 'amber-sunset' | 'rose-ruby';
  onThemeChange?: (theme: 'sky-ocean' | 'emerald-grass' | 'indigo-royal' | 'violet-blossom' | 'amber-sunset' | 'rose-ruby') => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  shopId,
  lang,
  currency,
  onLanguageChange,
  onCurrencyChange,
  onToggleSounds,
  enableSounds,
  onRefreshStats,
  darkMode = false,
  onToggleDarkMode,
  activeTheme = 'emerald-grass',
  onThemeChange,
}) => {
  const t = TRANSLATIONS[lang];

  // Load persistence configurations mapping cleanly onto ShopSettings type
  const [settings, setSettings] = useState<ShopSettings>({
    shopName: 'DzStore Belfort',
    shopPhone: '0555 12 34 56',
    shopAddress: 'Belfort, El-Harrach, Alger',
    shopEmail: 'owner@dz.com',
    logoImage: '',
    stampImage: '',
    receiptHeader: 'العلمة تيليكوم - قطع الغيار والهواتف',
    receiptFooter: 'شكراً لزيارتكم ومحلنا يسعد بخدمتكم دائماً.',
    warrantyHeader: 'وصل ضمان القطع والهواتف',
    warrantyFooter: 'الضمان لا يشمل السوائل أو الكسر.',
    currency: 'DZD',
    language: 'ar',
    primaryColor: 'sky',
    darkMode: false,
    stickerPrinterEnabled: true,
    receiptPaperWidth: '80mm',
    barcodeScannerEnabled: true,
    cashDrawerEnabled: false,
    warrantyPolicyText: '1. شروط الضمان العام تسري لمدة ثلاثة (03) أشهر كاملة من تاريخ الشراء المدون.\n2. الضمان يغطي فقط العيوب المصنعية والأعطال الكهروميكانيكية الطارئة.\n3. يستثنى من الضمان كلياً: الكسور والشروخ بالهيكل أو الشاشة، التعرض للسوائل والرطوبة، فتح أو تصليح الجهاز خارج مركزنا المعتمد، وتلف الأرقام التسلسلية IMEI.',
  });

  // User list to update password / pin
  const [user, setUser] = useState<AppUser | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [settingsLicenseKey, setSettingsLicenseKey] = useState('');
  
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncCompleted, setSyncCompleted] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  useEffect(() => {
    const portalUrl = window.location.origin + window.location.pathname + "#store-" + shopId;
    QRCode.toDataURL(portalUrl, { width: 350, margin: 2, errorCorrectionLevel: 'H' })
      .then(url => setQrCodeDataUrl(url))
      .catch(err => console.error("Failed to generate shop QR Code", err));
  }, [shopId]);

  const handlePrintQRCode = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${lang === 'ar' ? 'طباعة رمز QR الخاص بالمحل' : 'Print Shop QR Code'}</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              text-align: center;
              padding: 40px;
              color: #1e293b;
              direction: ${lang === 'ar' ? 'rtl' : 'ltr'};
            }
            .container {
              max-width: 500px;
              margin: 0 auto;
              border: 3px solid #6366f1;
              border-radius: 24px;
              padding: 30px;
              background: #ffffff;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            }
            h1 {
              font-size: 24px;
              margin-bottom: 5px;
              color: #1e1b4b;
            }
            p.sub {
              font-size: 14px;
              color: #64748b;
              margin-top: 0;
              margin-bottom: 25px;
            }
            img.qr {
              width: 280px;
              height: 280px;
              border: 1px solid #e2e8f0;
              padding: 10px;
              border-radius: 16px;
              background: white;
            }
            .instructions {
              margin-top: 25px;
              font-size: 16px;
              font-weight: bold;
              color: #4338ca;
            }
            .footer {
              margin-top: 30px;
              font-size: 12px;
              color: #94a3b8;
              border-top: 1px dashed #e2e8f0;
              padding-top: 15px;
            }
            @media print {
              body { padding: 0; background: none; }
              .container { border: none; box-shadow: none; margin-top: 50px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🏪 ${settings.shopName || 'DzStore'}</h1>
            <p class="sub">${settings.shopAddress || ''}</p>
            
            <img class="qr" src="${qrCodeDataUrl}" alt="Shop QR Code" />
            
            <div class="instructions">
              ${lang === 'ar' 
                ? '📷 امسح رمز QR للدخول إلى متجرنا وتتبع الصيانة!' 
                : '📷 Scan QR Code to browse our products and trace repairs!'}
            </div>
            
            <p style="font-size:12px; color:#475569; margin-top:15px; font-family:monospace;">
              Code: ${shopId}
            </p>

            <div class="footer">
              Powered by DzStore Point of Sale
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Loaded presets
  useEffect(() => {
    const s = DzStoreDB.getSettings(shopId, lang);
    if (s) {
      setSettings(prev => ({
        ...prev,
        ...s,
        activeTheme: s.activeTheme || activeTheme
      }));
    }

    const activeUser = DzStoreDB.getUsers().find(u => u.shopId === shopId && u.role === 'owner');
    if (activeUser) {
      setUser(activeUser);
    }
  }, [shopId]);

  // Form handlers
  const handleSaveShopConfig = (e: React.FormEvent) => {
    e.preventDefault();

    // Persist configurations locally
    DzStoreDB.saveSettings(shopId, settings);
    onLanguageChange(settings.language);
    onCurrencyChange(settings.currency);
    if (onToggleDarkMode) {
      onToggleDarkMode(settings.darkMode);
    }
    if (onThemeChange && settings.activeTheme) {
      onThemeChange(settings.activeTheme);
    }
    onRefreshStats();
    DzStoreAudio.playSuccessChime(enableSounds);

    alert(lang === 'ar' ? 'تم حفظ إعدادات المحل بنجاح!' : 'Shop configurations updated successfully!');
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentPassword || !newPassword) return;

    if (!DzStoreDB.verifyPassword(user.password, currentPassword)) {
      DzStoreAudio.playWarningChime(enableSounds);
      alert(lang === 'ar' ? 'كلمة المرور الحالية غير صحيحة!' : 'Incorrect current password!');
      return;
    }

    const allUsers = DzStoreDB.getUsers();
    const idx = allUsers.findIndex(u => u.id === user.id);
    if (idx > -1) {
      allUsers[idx].password = newPassword; // Will be hashed inside DzStoreDB.saveUsers()
      DzStoreDB.saveUsers(allUsers);
      setUser(allUsers[idx]);
      setCurrentPassword('');
      setNewPassword('');
      DzStoreAudio.playSuccessChime(enableSounds);
      alert(lang === 'ar' ? 'تم تحديث كلمة المرور بنجاح!' : 'Password changed successfully!');
    }
  };

  const handleManualSyncNow = async () => {
    setIsManualSyncing(true);
    setSyncCompleted(false);
    try {
      await forceManualSync(shopId, () => {
        onRefreshStats();
      });
      setSyncCompleted(true);
      DzStoreAudio.playSuccessChime(enableSounds);
      setTimeout(() => setSyncCompleted(false), 5000);
    } catch (e) {
      console.error("[ManualSync] Failure:", e);
      alert(lang === 'ar' ? 'فشلت عملية المزامنة السحابية!' : 'Cloud synchronization failed!');
    } finally {
      setIsManualSyncing(false);
    }
  };

  const triggerExportStore = () => {
    const backupJson = DzStoreDB.exportDatabase(shopId);
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DzStore_Shop_${shopId}_Backup.json`;
    link.click();
    DzStoreAudio.playNotification(enableSounds);
  };

  const handleForceReloadAndClearCaches = async () => {
    if (confirm(lang === 'ar' 
      ? 'هل تريد إجبار التطبيق على تفريغ ذاكرة التخزين المؤقت (Cache) وإعادة التحميل بالكامل للحصول على آخر التحديثات فوراً؟ لن تفقد بيانات المحل أو جلسات الدخول المحفوظة.' 
      : 'Do you want to clear browser caches and force a reload to fetch the latest updates? You will not lose your local shop data.')) {
      
      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(key => caches.delete(key)));
        } catch (e) {
          console.error("Cache clear failed", e);
        }
      }

      if ('serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        } catch (e) {
          console.error("ServiceWorker unregister failed", e);
        }
      }

      const url = new URL(window.location.href);
      url.searchParams.set('reload_ts', Date.now().toString());
      window.location.href = url.toString();
    }
  };

  const handleRecoverSales = async () => {
    setIsRecovering(true);
    setRecoveryMessage(null);
    try {
      const res = await DzStoreDB.recoverSalesFromServer(shopId);
      if (res.success) {
        setRecoveryMessage(res.message);
        DzStoreAudio.playSuccessChime(enableSounds);
        onRefreshStats();
      } else {
        setRecoveryMessage(res.message);
        DzStoreAudio.playWarningChime(enableSounds);
      }
    } catch (e: any) {
      setRecoveryMessage(`خطأ أثناء عملية الاسترجاع: ${e.message || String(e)}`);
      DzStoreAudio.playWarningChime(enableSounds);
    } finally {
      setIsRecovering(false);
    }
  };

  const handleRecoverAllCollections = async () => {
    setIsRecovering(true);
    setRecoveryMessage(null);
    try {
      const collectionsToRecover = ['products', 'spare_parts', 'suppliers', 'customers', 'maintenance', 'expenses', 'used_phones'];
      let totalRestored = 0;
      let logMessages: string[] = [];

      for (const coll of collectionsToRecover) {
        const res = await DzStoreDB.recoverCollectionFromServer(shopId, coll);
        if (res.success && res.count > 0) {
          totalRestored += res.count;
          logMessages.push(`✓ تم استرجاع ${res.count} من ${coll}`);
        }
      }

      // Also run sales recovery separately
      const salesRes = await DzStoreDB.recoverSalesFromServer(shopId);
      if (salesRes.success && salesRes.count > 0) {
        totalRestored += salesRes.count;
        logMessages.push(`✓ تم استرجاع ${salesRes.count} مبيعات`);
      }

      if (totalRestored > 0) {
        setRecoveryMessage(lang === 'ar' 
          ? `نجحت عملية الفحص! تم استرجاع إجمالي ${totalRestored} من العناصر المفقودة بسلام:\n${logMessages.join('\n')}` 
          : `Recovery complete! Restored ${totalRestored} database object(s) safely:\n${logMessages.join('\n')}`);
        DzStoreAudio.playSuccessChime(enableSounds);
        onRefreshStats();
      } else {
        setRecoveryMessage(lang === 'ar' 
          ? 'عملية الفحص مكتملة: جميع البيانات في ذاكرتك المحلية متطابقة تماماً مع خوادم السحاب السريعة ولا توجد مبيعات أو بيانات مفقودة.' 
          : 'Check complete: Local cache already perfectly contains all Cloud Database data.');
        DzStoreAudio.playSuccessChime(enableSounds);
      }
    } catch (e: any) {
      setRecoveryMessage(`خطأ أثناء عملية الاستعادة الشاملة: ${e.message || String(e)}`);
      DzStoreAudio.playWarningChime(enableSounds);
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="space-y-6 text-start">
      {/* Title block */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="bg-sky-500/10 p-2.5 rounded-2xl">
          <SettingsIcon className="w-6 h-6 text-sky-600" id="settings_title_ic" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{t.settings}</h2>
          <p className="text-xs text-gray-400">
            {lang === 'ar' ? 'تعديل شعار المحل، لغة والعملة، شروط الفواتير والضمان وتنزيل الباك آب' : 'Configure store identity, receipt designs, credentials and backups'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUMN 1 & 2: STORE CORE CREDENTIALS & TICKET DESIGN */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveShopConfig} className="bg-white border rounded-3xl p-5 space-y-4 shadow-xs">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b pb-2">
              🏢 {lang === 'ar' ? 'بيانات وعنوان المحل التجاري' : 'Store Profile & Identity'}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t.shop_name} *</label>
                <input
                  type="text"
                  required
                  value={settings.shopName || ''}
                  onChange={e => setSettings({ ...settings, shopName: e.target.value })}
                  className="w-full text-xs px-3.5 py-2 border rounded-xl bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t.phone} *</label>
                <input
                  type="text"
                  required
                  value={settings.shopPhone || ''}
                  onChange={e => setSettings({ ...settings, shopPhone: e.target.value })}
                  className="w-full text-xs px-3.5 py-2 border rounded-xl bg-slate-50"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">{t.address} *</label>
                <input
                  type="text"
                  required
                  value={settings.shopAddress || ''}
                  onChange={e => setSettings({ ...settings, shopAddress: e.target.value })}
                  className="w-full text-xs px-3.5 py-2 border rounded-xl bg-slate-50"
                />
              </div>

              <div className="col-span-2 border-t pt-3 space-y-2">
                <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-emerald-600" id="store_logo_tag" />
                  {lang === 'ar' ? 'شعار المحل التجاري (Logo)' : 'Store Brand Logo'}
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-3 rounded-2xl border">
                  <img
                    src={settings.logoImage || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=100&q=80'}
                    alt="Logo Preview"
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500 shadow-xs bg-white"
                  />
                  <div className="flex-1 w-full space-y-1.5 text-start">
                    <p className="text-[10px] text-slate-400 font-bold">
                      {lang === 'ar' ? 'حدد خط المحل من القوائم السريعة، الصق رابطًا أو اختر ملفًا من الكمبيوتر:' : 'Choose predesigned, paste icon URL, or choose file from computer:'}
                    </p>
                    <div className="flex gap-2 mb-2">
                      {[
                        { url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=100&q=80', name: 'Indigo' },
                        { url: 'https://images.unsplash.com/photo-1628202926206-c63a34b1618f?w=100&q=80', name: 'Emerald' },
                        { url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=100&q=80', name: 'Aura' },
                        { url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=100&q=80', name: 'Luxury' }
                      ].map(preset => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setSettings({ ...settings, logoImage: preset.url })}
                          className={`px-2 py-1 text-[9px] rounded-lg border font-bold cursor-pointer transition-colors ${
                            settings.logoImage === preset.url ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-center">
                      <input
                        type="text"
                        value={settings.logoImage || ''}
                        onChange={e => setSettings({ ...settings, logoImage: e.target.value })}
                        placeholder="https://example.com/logo.png"
                        className="w-full text-[10px] px-3 py-1.5 border rounded-lg bg-white"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setSettings({ ...settings, logoImage: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="text-xs max-w-[120px]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* STORE OFFICIAL STAMP / SIGNATURE */}
              <div className="col-span-2 border-t pt-3 space-y-2">
                <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-sky-600" />
                  {lang === 'ar' ? 'ختم وصورة توقيع المحل لفواتير الضمان (Stamp / Signature)' : 'Official Stamp / Signature'}
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-3 rounded-2xl border">
                  {settings.stampImage ? (
                    <img
                      src={settings.stampImage}
                      alt="Stamp Preview"
                      className="w-14 h-14 object-contain border bg-white rounded-lg p-1 shadow-xs"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] text-slate-400 border font-bold">
                      {lang === 'ar' ? 'بدون ختم' : 'No Stamp'}
                    </div>
                  )}
                  <div className="flex-1 w-full space-y-1.5 text-start">
                    <p className="text-[10px] text-slate-400 font-bold">
                      {lang === 'ar' ? 'تحميل ملف ختم وتوقيع المحل التجاري من الكمبيوتر ليظهر في كعوب الفواتير المطبوعة:' : 'Upload stamp or signature image from your computer to overlay inside printout footers:'}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setSettings({ ...settings, stampImage: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="text-xs"
                      />
                      {settings.stampImage && (
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, stampImage: '' })}
                          className="text-[10px] text-rose-600 font-bold hover:underline"
                        >
                          {lang === 'ar' ? 'إزالة الختم' : 'Remove Stamp'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PREFERENCE SELECTION ACCENTS */}
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b pt-4 pb-2">
              ⚙️ {lang === 'ar' ? 'التفضيلات ولغة النظام' : 'Language & Audio Preferences'}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <Globe2 className="w-3.5 h-3.5 text-slate-400" />
                  {lang === 'ar' ? 'لغة واجهة البرنامج' : 'Application Language'}
                </label>
                <select
                  value={settings.language}
                  onChange={e => setSettings({ ...settings, language: e.target.value as Language })}
                  className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 focus:outline-none"
                >
                  <option value="ar">{lang === 'ar' ? 'العربية' : 'Arabic / العربية'}</option>
                  <option value="fr">{lang === 'ar' ? 'الفرنسية' : 'French / Français'}</option>
                  <option value="en">{lang === 'ar' ? 'الإنجليزية' : 'English'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  {lang === 'ar' ? 'العملة الرئيسية للمتجر' : 'Store Default Currency'}
                </label>
                <select
                  value={settings.currency}
                  onChange={e => setSettings({ ...settings, currency: e.target.value as Currency })}
                  className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 focus:outline-none"
                >
                  <option value="DZD">DZD - د.ج (دينار جزائري)</option>
                  <option value="EUR">EUR - € (Euro)</option>
                </select>
              </div>

              {/* Tonal sound control */}
              <div className="col-span-2 flex items-center justify-between bg-slate-50 p-3 rounded-2xl border">
                <div>
                  <span className="text-xs font-black text-slate-800 block">
                    🔊 {lang === 'ar' ? 'المؤثرات الصوتية والمسح الصوتي للكاشير' : 'Point of Sale Audio Cues'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {lang === 'ar' ? 'تشغيل رنين تلسكوبي مريح عند بيع سلعة أو إدخال كود بار' : 'Play retro synthesizer sound effects on scans and checkouts'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleSounds(!enableSounds)}
                  className={`p-2 rounded-xl border flex items-center gap-1 font-bold text-xs cursor-pointer ${
                    enableSounds ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {enableSounds ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  {enableSounds ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Theme dark mode toggle */}
              <div className="col-span-2 flex items-center justify-between bg-slate-50 p-3 rounded-2xl border">
                <div>
                  <span className="text-xs font-black text-slate-800 block">
                    🌓 {lang === 'ar' ? 'تفعيل الوضع الليلي أو المضيء للمحل' : 'Interface Theme Preference'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {lang === 'ar' ? 'التحول المريح للعينين وموازنة الطابع الداكن للمتجر' : 'Toggle dark mode design for eye comfort during night work'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, darkMode: !settings.darkMode })}
                  className={`p-2 rounded-xl border flex items-center gap-1 font-bold text-xs cursor-pointer ${
                    settings.darkMode ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {settings.darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
                  {settings.darkMode ? (lang === 'ar' ? 'ليلي' : 'DARK') : (lang === 'ar' ? 'مضيء' : 'LIGHT')}
                </button>
              </div>

              {/* Theme Color Selection Accent */}
              <div className="col-span-2 border p-4 rounded-3xl bg-slate-50 border-slate-200/60 text-start space-y-3">
                <div className="flex items-center gap-2">
                  <div className="bg-sky-500/10 p-1.5 rounded-xl">
                    <Palette className="w-5 h-5 text-sky-600" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 block">
                      🎨 {lang === 'ar' ? 'مظهر وثيم البرنامج الرئيسي (Color Theme)' : 'Application Main Theme Accent'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {lang === 'ar' ? 'تخصيص جمالي وخلفية مريحة تعبر عن الطابع البصري لهويتك' : 'Pick a premium visual accent styling custom built for your store brand'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  {[
                    { id: 'sky-ocean', color: 'bg-sky-500', nameAr: 'الأزرق السماوي 🌊', nameEn: 'Sky Ocean' },
                    { id: 'emerald-grass', color: 'bg-emerald-500', nameAr: 'الأخضر العشبي 🌿', nameEn: 'Emerald Grass' },
                    { id: 'indigo-royal', color: 'bg-indigo-500', nameAr: 'النيلي الملكي 🌌', nameEn: 'Indigo Royal' },
                    { id: 'violet-blossom', color: 'bg-violet-500', nameAr: 'البنفسجي الزهري 🌸', nameEn: 'Violet Blossom' },
                    { id: 'amber-sunset', color: 'bg-amber-500', nameAr: 'الذهبي الغروبي 🌅', nameEn: 'Amber Sunset' },
                    { id: 'rose-ruby', color: 'bg-rose-500', nameAr: 'الياقوتي الأحمر 🌺', nameEn: 'Ruby Rose' },
                  ].map(themeOpt => {
                    const isSelected = settings.activeTheme === themeOpt.id || (!settings.activeTheme && themeOpt.id === 'emerald-grass');
                    return (
                      <button
                        key={themeOpt.id}
                        type="button"
                        onClick={() => setSettings({ ...settings, activeTheme: themeOpt.id as any })}
                        className={`flex items-center gap-2 p-2 rounded-2xl border text-left cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-white border-blue-500 ring-4 ring-blue-100 shadow-sm font-black' 
                            : 'bg-white/60 hover:bg-white border-slate-200'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full shrink-0 ${themeOpt.color}`} />
                        <span className="text-[10px] font-bold text-slate-800 truncate">
                          {lang === 'ar' ? themeOpt.nameAr : themeOpt.nameEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RECEIPTS TEMPLATES CONFIGURATION PANEL */}
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b pt-4 pb-2">
              <FileText className="w-4.5 h-4.5 text-slate-600" />
              {lang === 'ar' ? 'تخصيص شروط الفاتورة وبطاقة الضمان للمحل' : 'Receipt & Warranty Customization'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t.receiptHeader}</label>
                <input
                  type="text"
                  value={settings.receiptHeader || ''}
                  onChange={e => setSettings({ ...settings, receiptHeader: e.target.value })}
                  className="w-full text-xs px-3.5 py-2 border rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'ar' ? 'عنوان شهادة الضمان للمشتري' : 'Warranty Document Title'}</label>
                <input
                  type="text"
                  value={settings.warrantyHeader || ''}
                  onChange={e => setSettings({ ...settings, warrantyHeader: e.target.value })}
                  className="w-full text-xs px-3.5 py-2 border rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t.receiptFooter}</label>
                <textarea
                  value={settings.receiptFooter || ''}
                  onChange={e => setSettings({ ...settings, receiptFooter: e.target.value })}
                  className="w-full text-xs px-3.5 py-2 border rounded-xl h-14 resize-none animate-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'ar' ? 'شروط وقوانين ورشة الضمان للزبائن' : 'Warranty Disclaimer Footer'}</label>
                <textarea
                  value={settings.warrantyFooter || ''}
                  onChange={e => setSettings({ ...settings, warrantyFooter: e.target.value })}
                  className="w-full text-xs px-3.5 py-2 border rounded-xl h-14 resize-none animate-none"
                />
              </div>
            </div>

            {/* HARDWARE PERIPHERALS CONFIGURATION */}
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b pt-4 pb-2">
              <Printer className="w-4.5 h-4.5 text-sky-600" id="hw_printer_icon" />
              {lang === 'ar' ? 'إعدادات الطابعات والملصقات والأجهزة الملحقة' : 'Hardware Peripherals & Printers'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 border rounded-2xl">
                <span className="text-xs font-bold text-slate-800">{lang === 'ar' ? 'طابعة الملصقات والباركود' : 'Label/Sticker Printer'}</span>
                <input
                  type="checkbox"
                  checked={!!settings.stickerPrinterEnabled}
                  onChange={e => setSettings({ ...settings, stickerPrinterEnabled: e.target.checked })}
                  className="w-4 h-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border rounded-2xl">
                <span className="text-xs font-bold text-slate-800">{lang === 'ar' ? 'تفعيل قارئ الباركود (الكودبار)' : 'Barcode Scanner Active'}</span>
                <input
                  type="checkbox"
                  checked={!!settings.barcodeScannerEnabled}
                  onChange={e => setSettings({ ...settings, barcodeScannerEnabled: e.target.checked })}
                  className="w-4 h-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border rounded-2xl">
                <span className="text-xs font-bold text-slate-800">{lang === 'ar' ? 'درج النقود الكهربائي (فتح تلقائي)' : 'Auto Cash Drawer Kick'}</span>
                <input
                  type="checkbox"
                  checked={!!settings.cashDrawerEnabled}
                  onChange={e => setSettings({ ...settings, cashDrawerEnabled: e.target.checked })}
                  className="w-4 h-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border rounded-2xl">
                <span className="text-xs font-bold text-slate-800">{lang === 'ar' ? 'مقاس ورق الفاتورة الحرارية' : 'Thermal Paper Width'}</span>
                <select
                  value={settings.receiptPaperWidth || '80mm'}
                  onChange={e => setSettings({ ...settings, receiptPaperWidth: e.target.value as any })}
                  className="text-xs p-1 border rounded-lg bg-white"
                >
                  <option value="58mm">58mm</option>
                  <option value="80mm">80mm</option>
                  <option value="A4">A4 standard</option>
                </select>
              </div>
            </div>

            {/* WARRANTY CUSTOM POLICY EDITOR */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                📜 {lang === 'ar' ? 'بنود وثيقة ضمان البيع بالتفصيل (يمكنك تعديلها بالكامل)' : 'Detailed Warranty Policy Terms'}
              </label>
              <textarea
                value={settings.warrantyPolicyText || ''}
                onChange={e => setSettings({...settings, warrantyPolicyText: e.target.value})}
                className="w-full text-xs px-3 py-2 border rounded-xl h-24 font-sans text-slate-700"
                placeholder={lang === 'ar' ? 'اكتب بنود الضمان التي ستظهر مطبوعة أسفل بطاقة الضمان...' : 'Enter full custom warranty policy terms that print out under invoice guarantees...'}
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full text-xs bg-sky-700 hover:bg-sky-800 text-white font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-transform"
              >
                <Save className="w-4 h-4" />
                {t.save_settings}
              </button>
            </div>
          </form>
        </div>

        {/* COLUMN 3: ACCOUNT CREDENTIALS & DATA UTILITIES */}
        <div className="space-y-6">
          <form onSubmit={handleChangePassword} className="bg-white border rounded-3xl p-5 space-y-4 shadow-xs">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b pb-2">
              <KeyRound className="w-4.5 h-4.5 text-slate-600" />
              {lang === 'ar' ? 'تعديل كلمة مرور الحساب' : 'Change Password'}
            </h3>

            <div>
              <label className="block text-[10px] font-bold text-gray-700 mb-1">{lang === 'ar' ? 'كلمة المرور الحالية' : 'Current Password'} *</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full text-xs px-3.5 py-2 border rounded-xl bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-700 mb-1">{lang === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'} *</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full text-xs px-3.5 py-2 border rounded-xl bg-slate-50"
              />
            </div>

            <button
              type="submit"
              className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 rounded-xl cursor-pointer"
            >
              {lang === 'ar' ? 'تحديث كود الدخول الحالي' : 'Update Pass'}
            </button>
          </form>

          {/* LICENSE & COMPONENT BINDING PANEL */}
          <div className="bg-white border rounded-3xl p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b pb-2">
              🗝️ {lang === 'ar' ? 'ترخيص وتفعيل ميزات البرنامج' : 'Licensing & Cryptographic Key'}
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-bold">{lang === 'ar' ? 'حالة الاشتراك:' : 'License Status:'}</span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                  DzStoreDB.getShops().find(s => s.id === shopId)?.status === 'active' ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-300' :
                  DzStoreDB.getShops().find(s => s.id === shopId)?.status === 'trial' ? 'bg-blue-500/10 text-blue-700 border border-blue-300' :
                  'bg-rose-500/10 text-rose-700 border border-rose-300'
                }`}>
                  {DzStoreDB.getShops().find(s => s.id === shopId)?.status === 'active' && (lang === 'ar' ? '✓ مرخّص بالكامل' : 'Activated (Full)')}
                  {DzStoreDB.getShops().find(s => s.id === shopId)?.status === 'trial' && (lang === 'ar' ? '⏳ فترة تجريبية متبقية' : 'Trial Period Active')}
                  {DzStoreDB.getShops().find(s => s.id === shopId)?.status === 'suspended' && (lang === 'ar' ? '🔒 معلق مؤقتاً' : 'Suspended')}
                </span>
              </div>

              {DzStoreDB.getShops().find(s => s.id === shopId)?.trialEndDate && (
                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold">{lang === 'ar' ? 'تاريخ نهاية الصلاحية:' : 'License Expiry Date:'}</span>
                  <span className="font-mono font-black text-slate-800">{DzStoreDB.getShops().find(s => s.id === shopId)?.trialEndDate}</span>
                </div>
              )}

              {DzStoreDB.getShops().find(s => s.id === shopId)?.hardwareFingerprint && (
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-slate-400 font-bold block">{lang === 'ar' ? 'بصمة الجهاز المرخص (Machine ID):' : 'Bound Machine ID:'}</span>
                  <span className="font-mono text-[10px] font-bold text-cyan-600 block truncate select-all">{DzStoreDB.getShops().find(s => s.id === shopId)?.hardwareFingerprint}</span>
                </div>
              )}

              {/* Enter license key to renew or extend */}
              <div className="border-t pt-3 space-y-2">
                <label className="block text-[11px] font-extrabold text-slate-750">{lang === 'ar' ? 'تجديد أو تمديد صلاحية المتجر:' : 'Enter key to extend license:'}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="DZPOS-XXXX-XXXX-XXXX-XXXX"
                    value={settingsLicenseKey}
                    onChange={e => setSettingsLicenseKey(e.target.value.toUpperCase().trim())}
                    className="flex-1 font-mono text-center font-bold text-[11px] bg-slate-55 p-2.5 border rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!settingsLicenseKey) {
                        alert(lang === 'ar' ? 'يرجى إدخال كود تفعيل صالح!' : 'Please enter license key!');
                        return;
                      }

                      const result = DzStoreDB.verifyLicenseKey(settingsLicenseKey);
                      if (!result.isValid) {
                        alert(lang === 'ar' ? 'كود الترخيص غير صالح للتوقيع الرقمي للمتجر!' : 'Cryptographic license verification failed!');
                        return;
                      }

                      // Match footprint
                      const currentDeviceId = localStorage.getItem('dzstore_license_device_id') || 'UNKNOWN-HW';
                      const currentShop = DzStoreDB.getShops().find(s => s.id === shopId);
                      if (currentShop?.hardwareFingerprint && currentShop.hardwareFingerprint !== currentDeviceId) {
                        alert(lang === 'ar' ? 'عذراً! هذا الترخيص مقفل على جهاز آخر مكافحة للقرصنة.' : 'Anti-piracy bind triggered: bound to another computer.');
                        return;
                      }

                      // Save
                      const d = new Date();
                      if (result.isLifetime) {
                        d.setFullYear(d.getFullYear() + 80);
                      } else {
                        d.setMonth(d.getMonth() + result.months);
                      }

                      const updatedExpiry = d.toISOString().split('T')[0];
                      const allShops = DzStoreDB.getShops();
                      const shopIdx = allShops.findIndex(s => s.id === shopId);

                      if (shopIdx > -1) {
                        allShops[shopIdx] = {
                          ...allShops[shopIdx],
                          status: 'active',
                          trialEndDate: updatedExpiry,
                          licenseKey: settingsLicenseKey,
                          hardwareFingerprint: currentDeviceId,
                          updatedAt: new Date().toISOString()
                        };
                        DzStoreDB.saveShops(allShops);
                        setSettingsLicenseKey('');
                        DzStoreAudio.playSuccessChime(enableSounds);
                        alert(lang === 'ar' ? '🎉 تم تفعيل الترخيص وتمديد الصلاحية بنجاح! يتم تحديث المتصفح الآن.' : '🎉 License successfully renewed!');
                        window.location.reload();
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    {lang === 'ar' ? 'تفعيل' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* CUSTOMER PORTAL QR CODE PANEL */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-950 text-white border border-indigo-950 rounded-3xl p-5 space-y-4 shadow-lg text-start">
            <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-1.5 border-b border-indigo-900 pb-2">
              <QrCode className="w-5 h-5 text-indigo-400" />
              <span>{lang === 'ar' ? 'رمز QR لبوابة الزبائن الذكية' : 'Smart Customer Portal QR'}</span>
            </h3>

            <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
              {lang === 'ar'
                ? 'اطبع أو شارك رمز QR هذا مع زبائنك لكي يتمكنوا من الدخول المباشر والحصري لمتجرك لطلب السلع أو الصيانة وتتبع طلباتهم بسهولة.'
                : 'Print or share this unique QR code with your customers so they can securely enter your custom storefront, browse catalog, or check repair updates.'}
            </p>

            {qrCodeDataUrl ? (
              <div className="flex flex-col items-center justify-center bg-white p-4 rounded-2xl border border-slate-800 shadow-inner my-2">
                <img 
                  src={qrCodeDataUrl} 
                  alt="Shop QR Code" 
                  className="w-48 h-48 object-contain rounded-lg border border-slate-100 p-1"
                />
                <span className="text-[10px] text-slate-500 font-mono mt-1 select-all select-none">
                  ID: {shopId}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 bg-slate-900 rounded-2xl border border-dashed border-slate-800 text-xs text-slate-400">
                {lang === 'ar' ? 'جاري توليد الرمز الفوري...' : 'Generating QR Code...'}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const portalUrl = window.location.origin + window.location.pathname + "#store-" + shopId;
                  navigator.clipboard.writeText(portalUrl);
                  alert(lang === 'ar' ? '✓ تم نسخ رابط متجرك المباشر بنجاح!' : '✓ Storefront link copied successfully!');
                }}
                className="bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold text-[10px] py-2 px-3 rounded-xl flex items-center justify-center gap-1 shadow-md transition-all cursor-pointer"
              >
                🔗 {lang === 'ar' ? 'نسخ رابط المتجر' : 'Copy URL'}
              </button>
              
              <button
                type="button"
                onClick={handlePrintQRCode}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] py-2 px-3 rounded-xl flex items-center justify-center gap-1 shadow-md transition-all cursor-pointer"
              >
                🖨️ {lang === 'ar' ? 'طباعة الرمز' : 'Print QR'}
              </button>

              <a
                href={qrCodeDataUrl}
                download={`shop-QR-${settings.shopName.replace(/\s+/g, '_')}.png`}
                className="col-span-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-extrabold text-[10px] py-2 px-3 rounded-xl flex items-center justify-center gap-1 transition-all text-center"
              >
                📥 {lang === 'ar' ? 'تحميل كصورة بجودة عالية (PNG)' : 'Download PNG Image'}
              </a>
            </div>
          </div>

          {/* REALTIME CLOUD SYNC & MANUAL REFRESH */}
          <div className="bg-white border rounded-3xl p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b pb-2">
              ☁️ {lang === 'ar' ? 'المزامنة السحابية والتحديث الفوري' : 'Realtime Cloud Sync'}
            </h3>
            <p className="text-[11px] text-slate-500 leading-snug font-medium">
              {lang === 'ar' 
                ? 'إذا لم تظهر لك المنتجات أو المبيعات الأخيرة التي تمت من هاتف آخر، استخدم هذا الزر لإجبار التطبيق على فلاش المخزن المعلق، تصفير الكاش، وسحب كامل التعديلات الأخيرة فوراً وبشكل حقيقي من السحابة.'
                : 'If you do not see the latest updates from companion devices or other browsers immediately, force the app to resolve pending queues and pull the absolute latest state on demand.'}
            </p>

            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border text-[11px]">
              <span className="text-slate-500 font-bold">{lang === 'ar' ? 'حالة الاتصال بالشبكة:' : 'Connection Status:'}</span>
              <span className={`flex items-center gap-1 font-bold ${navigator.onLine ? 'text-emerald-600' : 'text-amber-600'}`}>
                <Wifi className={`w-3.5 h-3.5 ${navigator.onLine ? 'text-emerald-500' : 'text-emerald-500'}`} />
                {navigator.onLine 
                  ? (lang === 'ar' ? 'متصل بالإنترنت ومفعل' : 'Online / Live') 
                  : (lang === 'ar' ? 'غير متصل (محلي)' : 'Offline mode')}
              </span>
            </div>

            <button
              type="button"
              onClick={handleManualSyncNow}
              disabled={isManualSyncing}
              className={`w-full text-xs font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border transition-all ${
                syncCompleted 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                  : isManualSyncing 
                    ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' 
                    : 'bg-indigo-600 hover:bg-slate-800 text-white border-transparent hover:shadow-xs active:scale-[0.98]'
              }`}
            >
              {isManualSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {lang === 'ar' ? 'جاري الاتصال وسحب التحديثات...' : 'Pushing & pulling databases...'}
                </>
              ) : syncCompleted ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                  {lang === 'ar' ? '✓ اكتمل التنزيل والتحديث الفوري!' : '✓ Updated & Sync completed!'}
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  {lang === 'ar' ? 'تحديث ومزامنة البيانات الفورية' : 'Force Manual Sync Now'}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleForceReloadAndClearCaches}
              className="w-full text-xs bg-slate-150 hover:bg-slate-200 text-slate-800 font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border border-slate-300/60 shadow-xs transition-transform transform active:scale-[0.98]"
            >
              🔄 {lang === 'ar' ? 'تحديث كاش المتصفح وتثبيت الميزات الجديدة' : 'Force Hard Reload & Apply Updates'}
            </button>
          </div>

          {/* DIAGNOSTIC & DATA RECOVERY CENTER */}
          <div className="bg-white border-2 border-slate-900 rounded-3xl p-5 space-y-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-[3px] bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500"></div>
            
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5 border-b pb-2">
              🔍 {lang === 'ar' ? 'مركز تشخيص واسترجاع البيانات المفقودة' : 'Diagnostic & Data Recovery'}
            </h3>

            <p className="text-[11px] text-slate-600 leading-snug font-medium">
              {lang === 'ar' 
                ? 'إذا واجهت اختفاءً مفاجئاً للمبيعات، قطع الغيار، الزبائن أو التصليحات بعد التحديث أو تبديل الجهاز، فإن السحابة تحتفظ بنسخة كاملة وآمنة من جميع عملياتك. استخدم هذا المركز المعتمد للفحص وإعادة سحب المبيعات بالكامل بلمسة واحدة.' 
                : 'If any sales receipts, spare parts, customers or repair jobs disappeared after software updates or browser reloads, they are securely stored on our cloud. Scan and restore them instantly into your device memory below.'}
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleRecoverSales}
                disabled={isRecovering}
                className={`w-full text-xs font-black py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border transition-all ${
                  isRecovering 
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200 active:scale-[0.98]'
                }`}
              >
                {isRecovering ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    {lang === 'ar' ? 'جاري الفحص المتقدم...' : 'Scanning databases...'}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                    {lang === 'ar' ? '⚡ استرجاع المبيعات المفقودة من السحاب' : 'Recover Missing Sales from Cloud'}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleRecoverAllCollections}
                disabled={isRecovering}
                className={`w-full text-xs font-black py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border transition-all ${
                  isRecovering 
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                    : 'bg-slate-900 hover:bg-slate-850 text-white border-transparent active:scale-[0.98]'
                }`}
              >
                {isRecovering ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    {lang === 'ar' ? 'جاري الفحص السحابي الشامل...' : 'Running comprehensive cloud repair...'}
                  </>
                ) : (
                  <>
                    <span>🛡️</span>
                    {lang === 'ar' ? 'فحص واستعادة شاملة لجميع البيانات' : 'Full Diagnostics & Comprehensive Restore'}
                  </>
                )}
              </button>
            </div>

            {recoveryMessage && (
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-start animate-fade-in">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px] mb-1">
                  <span>ℹ️</span>
                  <span>{lang === 'ar' ? 'تقرير نتيجة الفحص والاسترجاع:' : 'Diagnostic Report:'}</span>
                </div>
                <p className="text-[10.5px] text-slate-700 leading-relaxed font-sans font-medium whitespace-pre-line" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                  {recoveryMessage}
                </p>
              </div>
            )}
          </div>

          {/* BACKUP DATABASE PANEL */}
          <div className="bg-white border rounded-3xl p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b pb-2">
              📦 {lang === 'ar' ? 'النسخ الاحتياطي لكل البيانات' : 'Database Utilities'}
            </h3>

            <p className="text-[11px] text-slate-500 leading-snug font-medium">
              {lang === 'ar' ? 'قم بتنزيل نسخة كاملة من بيانات مبيعات ومخزونات المحل لحفظها في حاسوبك الخارجي والرجوع إليها عند الحاجة.' : 'Backup all store data, lists of sales, repairs and customers onto a portable offline storage file.'}
            </p>

            <button
              onClick={triggerExportStore}
              className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              {t.exportBackup}
            </button>

            {/* FACTORY RESET BOX */}
            <div className="bg-rose-50 border border-rose-200/50 p-3 rounded-2xl space-y-1.5 mt-2 text-start">
              <div className="flex items-center gap-1.5 text-rose-800">
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span className="font-extrabold text-[11px]">{lang === 'ar' ? 'وضع المصنع ومسح بيانات التجربة' : 'Factory Reset / Clean Install'}</span>
              </div>
              <p className="text-[10px] text-rose-700 leading-snug">
                {lang === 'ar' ? 'سيقوم هذا الخيار بمسح جميع الجلسات القديمة، الملفات المؤقتة والبيانات التجريبية نهائياً لتهيئة البرنامج لزبونك الجديد ليكون رسمياً وفارغاً تماماً.' : 'This permanently clears all cached memory, sales receipts and custom devices for a clean official launch.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (confirm(lang === 'ar' ? '🚨 هل أنت متأكد تماماً من رغبتك في حذف البيانات؟ سيتم مسح الذاكرة بالكامل وتسهيل تتبع الأجهزة ومسح كوكيز التجربة.' : '🚨 Are you absolutely sure? This will wipe localStorage completely.')) {
                    DzStoreDB.clear();
                    alert(lang === 'ar' ? '✓ تم مسح البيانات بنجاح! سيتم إعادة تحميل البرنامج رسمياً الآن.' : '✓ Local storage cleared! Reloading system.');
                    window.location.reload();
                  }
                }}
                className="w-full text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-1.5 rounded-lg text-center cursor-pointer transition-colors"
              >
                {lang === 'ar' ? '🧹 مسح فوري للذاكرة وإعادة تحميل فارغ' : 'Purge All and Launch Fresh'}
              </button>
            </div>
          </div>

          {/* DUAL-DEVICE REALTIME SYNC GUIDE */}
          <div className="bg-gradient-to-br from-indigo-50/70 to-sky-50/70 border border-indigo-100 rounded-2xl p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b pb-2">
              📱 {lang === 'ar' ? 'اختبار المزامنة بين جهازين حقيقيين' : 'Testing Dual-Device Live Sync'}
            </h3>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              {lang === 'ar' 
                ? 'لفحص جودة المزامنة الفورية وإرسال إشعارات التغيير بين جهازين قبل إطلاق البرنامج رسمياً للتجربة الحية:'
                : 'To test instant realtime replication across multiple browsers/devices before launch:'}
            </p>

            <ul className="text-[10px] text-slate-500 space-y-1.5 list-disc pl-3 leading-snug">
              <li>
                {lang === 'ar' 
                  ? 'افتح رابط هذا التطبيق على هاتف ذكي أو جهاز لوحي آخر في نفس الوقت.'
                  : 'Open the App URL on your companion smartphone or secondary desktop.'}
              </li>
              <li>
                {lang === 'ar' 
                  ? 'سجل الدخول باستخدام نفس البريد الإلكتروني وكلمة المرور الحالية لتتصل بنفس فرع المحل.'
                  : 'Sign in using your same core Manager credentials to bind to the same instance.'}
              </li>
              <li>
                {lang === 'ar' 
                  ? 'أضف منتجاً جديداً في المخزن أو مستند مبيعات أو صيانة من هاتفك أو حاسوبك الأول.'
                  : 'Perform an inventory edit or submit a POS check-out invoice from device A.'}
              </li>
              <li>
                {lang === 'ar' 
                  ? 'ستلاحظ حدوث المزامنة وتحديث البيانات فوراً وبسلاسة مصحوبة بصوت رنين دقيق دون الحاجة لإعادة تحميل الصفحة!'
                  : 'Watch device B receive, merge, and animate the updates dynamically in near-zero latency with subtle chime sound feedback!'}
              </li>
            </ul>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin);
                  alert(lang === 'ar' ? '✓ تم نسخ رابط التطبيق بنجاح! أرسله لهاتفك لتجربته.' : '✓ App link copied to clipboard! Share it with your mobile device to test.');
                }}
                className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-transform transform active:scale-95"
              >
                Copy Share Link / نسخ الرابط للتجربة
              </button>
            </div>
          </div>

          {/* SOFTWARE INFO AND DEVELOPER BRAND INSIGNIA */}
          <div className="bg-slate-550/10 border p-5 rounded-3xl text-center space-y-1">
            <h5 className="font-extrabold text-xs text-slate-700">DzStore Point of Sale</h5>
            <p className="text-[10px] text-slate-400">{lang === 'ar' ? 'الإصدار' : 'Version'} {pkg.version} (Updatable Platform)</p>
            <p className="text-[9px] text-slate-500 mt-2 flex items-center justify-center gap-1 font-semibold">
              Crafted for Algeria Phone Shops <Heart className="w-3 h-3 text-rose-500 fill-rose-500 animate-pulse" />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
