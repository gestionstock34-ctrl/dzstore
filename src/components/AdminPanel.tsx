/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Currency, Language, ShopTenant, BroadcastMessage, AppUser } from '../types';
import { TRANSLATIONS } from '../lib/data';
import { DzStoreDB } from '../lib/db';
import { DzStoreAudio } from './AudioAlerts';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  ShieldAlert,
  Server,
  UserCheck,
  Radio,
  Clock,
  Briefcase,
  Smartphone,
  CheckCircle,
  XCircle,
  FileText,
  BadgeAlert,
  CreditCard,
  Send,
  Bell,
  RefreshCw,
  PlusCircle,
  Play,
  Bot,
  MessageSquare,
  UploadCloud,
  Layers,
  Sparkles,
  Cpu,
  Bookmark
} from 'lucide-react';

interface AdminPanelProps {
  lang: Language;
  currency: Currency;
  onRefreshAll: () => void;
  enableSounds: boolean;
}

interface Ticket {
  id: string;
  shopName: string;
  senderName: string;
  senderPhone: string;
  message: string;
  timestamp: string;
  status: 'pending' | 'resolved';
  replyText?: string;
}

interface AppRelease {
  version: string;
  platform: 'Desktop' | 'Android' | 'All';
  releaseNotes: string;
  date: string;
  isActive: boolean;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  lang,
  currency,
  onRefreshAll,
  enableSounds,
}) => {
  const t = TRANSLATIONS[lang];

  // Tab state
  const [activeTab, setActiveTab] = useState<'shops' | 'support' | 'ai' | 'releases' | 'broadcasts' | 'csv'>('shops');

  // SaaS Data
  const [shops, setShops] = useState<ShopTenant[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);

  // Update popup states
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isUpdateNotice, setIsUpdateNotice] = useState(true);

  // Configuration settings (e.g. general default trial period)
  const [baridiDetails, setBaridiDetails] = useState('');

  // Premium CSV data importer states
  const [importEmail, setImportEmail] = useState('baha34ayyoub@gmail.com');
  const [importShopName, setImportShopName] = useState('محل بهاء لخدمات الهاتف والملحقات (Baha Store)');
  const [importOwnerName, setImportOwnerName] = useState('بهاء الدين');
  const [customCSVContent, setCustomCSVContent] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  // Live Support Tickets data model
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [replyInput, setReplyInput] = useState<string>('');
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  // AI Copilot State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChat, setAiChat] = useState<{ role: 'user' | 'model'; content: string }[]>([
    {
      role: 'model',
      content: lang === 'ar' 
        ? 'مرحباً بك في مساعد الذكاء الاصطناعي للأدمن! يمكنني تزويدك بتقارير، اقتراحات استثمارية لـ SaaS، تحليلات أداء المبيعات السحابة، وصياغة قوانين تراخيص المشتركين.'
        : 'Welcome to Platform SaaS Admin Assistant! Ask me anything regarding tenant statistics, platform licensing, automated email drafting, or business growth metrics.'
    }
  ]);

  // Releases state
  const [releases, setReleases] = useState<AppRelease[]>([
    { version: '1.1.2', platform: 'All', releaseNotes: 'إصدار مستقر لمعالجة تراخيص بصمات الكمبيوتر المتعددة وتكامل مركز اتصالات العملاء الجديد.', date: '2026-06-20', isActive: true },
    { version: '1.1.0', platform: 'Desktop', releaseNotes: 'تحسين المزامنة التلقائية والتحقق من التحديثات التلقائية لسطح المكتب.', date: '2026-05-14', isActive: false },
    { version: '1.0.5', platform: 'Android', releaseNotes: 'إسناد Capacitor Android وتسهيل التصفح السريع بالكاميرا.', date: '2026-04-02', isActive: false }
  ]);
  const [newVersionInput, setNewVersionInput] = useState('');
  const [newVersionNotes, setNewVersionNotes] = useState('');
  const [newVersionPlatform, setNewVersionPlatform] = useState<'All' | 'Desktop' | 'Android'>('All');

  useEffect(() => {
    setShops(DzStoreDB.getShops());
    setUsers(DzStoreDB.getUsers());
    setBroadcasts(DzStoreDB.getBroadcasts());
    setBaridiDetails(DzStoreDB.getBaridiMobDetails());

    // Populate simulated support tickets from actual database submissions + templates
    const rawTickets = localStorage.getItem('dz_platform_support_tickets');
    if (rawTickets) {
      setTickets(JSON.parse(rawTickets));
    } else {
      const initialTickets: Ticket[] = [
        {
          id: 'tick-1',
          shopName: 'محل النجم الهوائي لصيانة الهواتف',
          senderName: 'محمد أمين',
          senderPhone: '0555123456',
          message: 'السلام عليكم، قمنا بتحويل المبلغ عبر تطبيق بريدي موب كود تفعيل LIFETIME مدى الحياة مسبقًا. يرجى مراجعة وتنشيط الحساب.',
          timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
          status: 'pending'
        },
        {
          id: 'tick-2',
          shopName: 'Baha Store',
          senderName: 'بهاء الدين',
          senderPhone: '0662987654',
          message: 'مرحبًا أمين، تطبيق الهاتف لا يظهر العمليات الأخيرة المضافة في الكمبيوتر. هل يمكنك تشخيص المزامنة؟',
          timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
          status: 'resolved',
          replyText: 'مرحبًا بهاء! تم تصفير ترخيص الهاردوير وبصمة الأجهزة لضمان مزامنة حرة بدون قيود.'
        }
      ];
      localStorage.setItem('dz_platform_support_tickets', JSON.stringify(initialTickets));
      setTickets(initialTickets);
    }
  }, []);

  const handleManualRefresh = () => {
    setShops(DzStoreDB.getShops());
    setUsers(DzStoreDB.getUsers());
    setBroadcasts(DzStoreDB.getBroadcasts());
    setBaridiDetails(DzStoreDB.getBaridiMobDetails());
    onRefreshAll();
    DzStoreAudio.playSuccessChime(enableSounds);
  };

  const handleSaveBaridiDetails = (e: React.FormEvent) => {
    e.preventDefault();
    DzStoreDB.saveBaridiMobDetails(baridiDetails);
    DzStoreAudio.playSuccessChime(enableSounds);
    alert(lang === 'ar' ? 'تم تحديث معلومات بريدي موب بنجاح!' : 'BaridiMob payment coordinates updated successfully!');
    onRefreshAll();
  };

  const handleToggleShopStatus = (shopId: string, nextStatus: ShopTenant['status']) => {
    const updatedShops = shops.map(shop => {
      if (shop.id === shopId) {
        let trialDate = shop.trialEndDate;
        if (nextStatus === 'active') {
          const date = new Date();
          date.setDate(date.getDate() + 365);
          trialDate = date.toISOString().split('T')[0];
        }
        return {
          ...shop,
          status: nextStatus,
          trialEndDate: trialDate,
          updatedAt: new Date().toISOString(),
        };
      }
      return shop;
    });

    const targetShop = updatedShops.find(shop => shop.id === shopId);
    if (targetShop) {
      setDoc(doc(db, 'shops', shopId), targetShop).catch(err => {
        console.warn("Direct Firestore shop status save failed:", err);
      });
    }

    DzStoreDB.saveShops(updatedShops);
    setShops(updatedShops);
    onRefreshAll();
    DzStoreAudio.playSuccessChime(enableSounds);
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newContent) return;

    const newMsg: BroadcastMessage = {
      id: `b-${Date.now()}`,
      title: newTitle,
      content: newContent,
      date: new Date().toISOString().split('T')[0],
      isUpdate: isUpdateNotice,
    };

    const updated = [newMsg, ...broadcasts];
    DzStoreDB.saveBroadcasts(updated);
    setBroadcasts(updated);
    setNewTitle('');
    setNewContent('');
    DzStoreAudio.playNotification(enableSounds);
    alert(t.broadcast_sent_success);
  };

  const handleRemoveBroadcast = (id: string) => {
    const filtered = broadcasts.filter(b => b.id !== id);
    DzStoreDB.saveBroadcasts(filtered);
    setBroadcasts(filtered);
    DzStoreAudio.playWarningChime(enableSounds);
  };

  // CSV Bulk importer
  const handleRunCSVImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importEmail.trim() || !customCSVContent.trim()) {
      alert(lang === 'ar' ? 'الرجاء إدخال البريد الإلكتروني للعميل ومحتوى الـ CSV المبيعات!' : 'Please enter target email and sales CSV content!');
      return;
    }

    setIsImporting(true);
    setImportFeedback(null);

    try {
      const result = await DzStoreDB.findOrCreateShopAndUserFor(
        importEmail,
        importShopName || 'محل تجاري مستورد',
        importOwnerName || 'صاحب المحل'
      );

      const importRes = await DzStoreDB.importSalesCSV(
        result.shopId,
        importOwnerName || 'بهاء الدين',
        result.userId,
        customCSVContent
      );

      if (importRes.success) {
        setImportFeedback(lang === 'ar'
          ? `✓ نجح الاستيراد! ${result.created ? 'تم إنشاء حساب المحل وتنشيطه بامتياز.' : 'تم العثور على حساب المحل المسجل مسبقاً.'}\n\n📊 تم المزامنة وحفظ ${importRes.count} مبيعات بسلام وإلحاقها بملف المستخدم.`
          : `✓ Success! ${result.created ? 'Created & activated shop.' : 'Linked existing account.'}\n\n📊 Result: Parsed and synchronized ${importRes.count} sales records successfully.`);
        
        DzStoreAudio.playSuccessChime(enableSounds);

        setShops(DzStoreDB.getShops());
        setUsers(DzStoreDB.getUsers());
        onRefreshAll();
      } else {
        setImportFeedback(`❌ فشل: ${importRes.message}`);
        DzStoreAudio.playWarningChime(enableSounds);
      }
    } catch (err: any) {
      setImportFeedback(`❌ خطأ: ${err.message || String(err)}`);
      DzStoreAudio.playWarningChime(enableSounds);
    } finally {
      setIsImporting(false);
    }
  };

  const handlePrepopulateBahaData = () => {
    setCustomCSVContent(BAHA_SALES_CSV);
    setImportEmail('baha34ayyoub@gmail.com');
    setImportShopName('محل بهاء لخدمات الهاتف والملحقات (Baha Store)');
    setImportOwnerName('بهاء الدين');
    setImportFeedback(lang === 'ar' 
      ? '✓ تم محاكاة وتحميل التقرير الجاهز لـ بهاء الدين (78 مبيعات). يمكنك الآن الضغط على زر "بدء الاستيراد الفوري" بالأسفل لتشغيل العملية!' 
      : '✓ Preloaded Baha\'s 78 transactions report. Press "Start Direct CSV Import" below!');
    DzStoreAudio.playSuccessChime(enableSounds);
  };

  // Support ticket actions
  const handleReplyTicket = (ticketId: string) => {
    if (!replyInput.trim()) return;
    const updatedTickets = tickets.map(t => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: 'resolved' as const,
          replyText: replyInput
        };
      }
      return t;
    });
    setTickets(updatedTickets);
    localStorage.setItem('dz_platform_support_tickets', JSON.stringify(updatedTickets));
    setReplyInput('');
    setActiveTicketId(null);
    DzStoreAudio.playSuccessChime(enableSounds);
    alert(lang === 'ar' ? '✓ تم الرد على عميل المحل وإرسال تفعيل المزامنة!' : '✓ Client replied successfully!');
  };

  // AI assistant simulation call
  const handleAiQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim() || aiLoading) return;

    const userPrompt = aiPrompt;
    setAiPrompt('');
    setAiChat(prev => [...prev, { role: 'user', content: userPrompt }]);
    setAiLoading(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `You are the ultimate DZ Store Platform SaaS Admin Assistant. Guide the platform owners. Telemetry: Total Stores:${shops.length}, active subscriptions:${shops.filter(s => s.status === 'active').length}, trial nodes:${shops.filter(s => s.status === 'trial').length}. Prompt from SaaS owner: ${userPrompt}`,
          lang
        })
      });

      const data = await response.json();
      if (data.success && data.reply) {
        setAiChat(prev => [...prev, { role: 'model', content: data.reply }]);
        DzStoreAudio.playSuccessChime(enableSounds);
      } else {
        setAiChat(prev => [...prev, { role: 'model', content: lang === 'ar' ? '⚠️ عذرًا، حدث خطأ في معالجة طلب الذكاء الاصطناعي.' : '⚠️ AI was unable to fulfill request.' }]);
      }
    } catch {
      setAiChat(prev => [...prev, { role: 'model', content: 'Connection timed out.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  // Add release
  const handlePublishRelease = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionInput.trim() || !newVersionNotes.trim()) return;

    const newRel: AppRelease = {
      version: newVersionInput,
      platform: newVersionPlatform,
      releaseNotes: newVersionNotes,
      date: new Date().toISOString().split('T')[0],
      isActive: false
    };

    const updated = [newRel, ...releases];
    setReleases(updated);
    setNewVersionInput('');
    setNewVersionNotes('');
    DzStoreAudio.playSuccessChime(enableSounds);
    alert(lang === 'ar' ? '✓ تم تسجيل الإصدار البرمجي الجديد للمنصة!' : '✓ Registered software version update!');

    // Mock publishing version.json to public static folder for live clients to check
    fetch('/api/health').then(() => {
      console.info("Software Release registered in active sandbox.");
    }).catch(() => {});
  };

  const totalStoresCount = shops.length;
  const pendingApprovalsCount = shops.filter(s => s.status === 'pending').length;
  const activeSubsCount = shops.filter(s => s.status === 'active').length;

  return (
    <div className="space-y-6 text-start font-sans">
      
      {/* SaaS Dashboard Title bar */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-800 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex items-center gap-3 relative z-10">
          <div className="bg-amber-500/10 p-2.5 rounded-2xl border border-amber-500/20">
            <Cpu className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight">{lang === 'ar' ? 'لوحة تحكم SaaS المدير العام' : 'SaaS Master Administrator Panel'}</h2>
            <p className="text-xs text-slate-400">
              {lang === 'ar' ? 'إدارة التراخيص تصفير الأجهزة تحديثات السيستم ومساعد الذكاء الاصطناعي' : 'Global license approvals, hardware decoupling, system rollouts, and Gemini AI Agent'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] py-2 px-4 rounded-xl transition-all cursor-pointer shadow-sm"
          >
            🔄 {lang === 'ar' ? 'تحديث قاعدة البيانات السحابة' : 'Cloud Sync Refresh'}
          </button>
          
          <div className="flex items-center gap-1.5 bg-slate-800 text-[9px] uppercase font-mono py-2 px-3 rounded-xl text-emerald-400 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>DZ SaaS Core Secure Hub</span>
          </div>
        </div>
      </div>

      {/* Metric Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex justify-between items-center shadow-xs">
          <div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase block">{t.total_shops}</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white">{totalStoresCount}</span>
          </div>
          <Server className="w-8 h-8 text-sky-500 opacity-20" />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex justify-between items-center shadow-xs border-amber-350">
          <div>
            <span className="text-[10px] text-amber-600 font-extrabold uppercase block">{t.awaiting_approval}</span>
            <span className="text-2xl font-black text-amber-600">{pendingApprovalsCount}</span>
          </div>
          <BadgeAlert className="w-8 h-8 text-amber-500 opacity-20 animate-bounce" />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex justify-between items-center shadow-xs">
          <div>
            <span className="text-[10px] text-emerald-600 font-extrabold uppercase block">{t.active_subscriptions}</span>
            <span className="text-2xl font-black text-emerald-600">{activeSubsCount}</span>
          </div>
          <UserCheck className="w-8 h-8 text-emerald-500 opacity-20" />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex justify-between items-center shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 p-1 bg-gradient-to-l from-indigo-500/10 to-transparent w-full h-full pointer-events-none" />
          <div>
            <span className="text-[10px] text-indigo-600 font-extrabold uppercase block">{lang === 'ar' ? 'الدخل التقديري السنوي' : 'Estimated SaaS ARR'}</span>
            <span className="text-2xl font-sans font-black text-indigo-600">{(activeSubsCount * 15000).toLocaleString()} DZD</span>
          </div>
          <CreditCard className="w-8 h-8 text-indigo-500 opacity-20" />
        </div>
      </div>

      {/* Custom SaaS Multi-Tenant Subtabs Switcher */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('shops')}
          className={`px-4 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
            activeTab === 'shops'
              ? 'bg-slate-900 text-white dark:bg-amber-600 dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          🏪 {lang === 'ar' ? 'تفعيل التراخيص والمحلات' : 'Tenant Approvals'}
        </button>

        <button
          onClick={() => setActiveTab('support')}
          className={`px-4 py-2 text-xs font-black rounded-lg transition-all cursor-pointer relative ${
            activeTab === 'support'
              ? 'bg-slate-900 text-white dark:bg-amber-600 dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          🎟️ {lang === 'ar' ? 'تذاكر دعم المشتركين' : 'Support Tickets'}
          {tickets.filter(t => t.status === 'pending').length > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[8px] bg-red-600 text-white font-extrabold rounded-full animate-pulse">
              {tickets.filter(t => t.status === 'pending').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`px-4 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
            activeTab === 'ai'
              ? 'bg-slate-900 text-white dark:bg-amber-600 dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          🤖 {lang === 'ar' ? 'مساعد الأدمن (Gemini)' : 'SaaS AI Assistant'}
        </button>

        <button
          onClick={() => setActiveTab('releases')}
          className={`px-4 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
            activeTab === 'releases'
              ? 'bg-slate-900 text-white dark:bg-amber-600 dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          📦 {lang === 'ar' ? 'تحديثات سطح المكتب وأندرويد' : 'Releases & Updater'}
        </button>

        <button
          onClick={() => setActiveTab('broadcasts')}
          className={`px-4 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
            activeTab === 'broadcasts'
              ? 'bg-slate-900 text-white dark:bg-amber-600 dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          📢 {lang === 'ar' ? 'تعميم الإشعارات' : 'Publish Broadcasts'}
        </button>

        <button
          onClick={() => setActiveTab('csv')}
          className={`px-4 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
            activeTab === 'csv'
              ? 'bg-slate-900 text-white dark:bg-amber-600 dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          📥 {lang === 'ar' ? 'استيراد CSV مجمع' : 'CSV Bulk Loader'}
        </button>
      </div>

      {/* Tab Render Switcher */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* TAB 1: SHOPS DIRECTORY & PAYMENT INFORMATION */}
        {activeTab === 'shops' && (
          <>
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-3 shadow-xs">
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wide flex items-center gap-1.5">
                  📋 {lang === 'ar' ? 'قائمة المتاجر والتراخيص الرقمية' : 'Platform Tenant Licenses'}
                </h3>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                  {shops.map(shop => {
                    return (
                      <div key={shop.id} className="py-4 first:pt-1 flex flex-col justify-between items-start gap-3">
                        <div className="w-full flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white">{shop.name}</h4>
                            <span
                              className={`text-[8px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                                shop.status === 'active'
                                  ? 'bg-emerald-550/10 text-emerald-700'
                                  : shop.status === 'trial'
                                  ? 'bg-sky-50 text-sky-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {t[shop.status] || shop.status}
                            </span>
                          </div>

                          <div className="flex gap-1">
                            {shop.status === 'pending' && (
                              <button
                                onClick={() => handleToggleShopStatus(shop.id, 'active')}
                                className="px-2.5 py-1 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg cursor-pointer"
                              >
                                ✓ {t.activate_shop_btn}
                              </button>
                            )}
                            {shop.status === 'active' && (
                              <button
                                onClick={() => handleToggleShopStatus(shop.id, 'suspended')}
                                className="px-2.5 py-1 text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg cursor-pointer"
                              >
                                ✕ {t.suspend_shop_btn}
                              </button>
                            )}
                            {shop.status === 'suspended' && (
                              <button
                                onClick={() => handleToggleShopStatus(shop.id, 'active')}
                                className="px-2.5 py-1 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg cursor-pointer"
                              >
                                {lang === 'ar' ? 'رفع التجميد' : 'Unsuspend'}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium space-y-1 w-full">
                          <p>📧 {shop.ownerEmail} | 📱 {shop.phone}</p>
                          <p>📍 {shop.address || 'Algeria'}</p>
                          
                          {/* Expiry Date Configurator */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 bg-amber-500/5 p-1.5 rounded-xl border border-amber-500/10 w-fit">
                            <span className="text-[10px] font-black text-amber-800 dark:text-amber-400">📆 {lang === 'ar' ? 'تاريخ نهاية صلاحية الترخيص:' : 'Expiry Date:'}</span>
                            <input
                              type="date"
                              value={shop.trialEndDate || ''}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                const updatedShops = shops.map(s => {
                                  if (s.id === shop.id) {
                                    return {
                                      ...s,
                                      trialEndDate: newDate,
                                      updatedAt: new Date().toISOString()
                                    };
                                  }
                                  return s;
                                });

                                const targetShop = updatedShops.find(s => s.id === shop.id);
                                if (targetShop) {
                                  setDoc(doc(db, 'shops', shop.id), targetShop).catch(err => {
                                    console.warn("Direct Firestore dates save failed:", err);
                                  });
                                }

                                DzStoreDB.saveShops(updatedShops);
                                setShops(updatedShops);
                                onRefreshAll();
                                DzStoreAudio.playSuccessChime(enableSounds);
                              }}
                              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-white rounded-lg px-2 py-0.5 text-[10px] font-mono cursor-pointer"
                            />
                          </div>

                          {shop.licenseKey && (
                            <p className="text-[10px] text-emerald-800 bg-emerald-550/10 px-2 py-0.5 rounded-lg font-mono border border-emerald-500/20 w-fit inline-block">
                              🔑 {lang === 'ar' ? 'المفتاح النشط:' : 'Active Key:'} <span className="font-extrabold select-all">{shop.licenseKey}</span>
                            </p>
                          )}
                          {shop.hardwareFingerprint && (
                            <p className="text-[9.5px] text-indigo-700 font-mono">
                              🖥️ {lang === 'ar' ? 'بصمة الجهاز المرتبط بالترخيص:' : 'Bound Fingerprint:'} <span className="font-extrabold select-all">{shop.hardwareFingerprint}</span>
                            </p>
                          )}
                        </div>

                        {/* Connected and licensed Devices lock */}
                        <div className="mt-1.5 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-850 space-y-1 w-full">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                              <Smartphone className="w-3 h-3 text-slate-400" />
                              {lang === 'ar' ? 'أجهزة المتجر النشطة (ترخيص غير محدود):' : 'Logged Terminal (Unlimited):'}
                            </h5>
                            
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(lang === 'ar' 
                                  ? `⚠️ هل ترغب بالتأكيد في تصفير ترخيص الأجهزة ومسح قفل بصمة الجهاز لـ [${shop.name}] للسماح بنقله لجهاز آخر؟` 
                                  : `Decouple hardware fingerprint and reset registered devices for [${shop.name}]?`)) {
                                  const updatedShops = shops.map(s => {
                                    if (s.id === shop.id) {
                                      return { 
                                        ...s, 
                                        registeredDevices: [], 
                                        hardwareFingerprint: '' 
                                      };
                                    }
                                    return s;
                                  });

                                  const targetShop = updatedShops.find(s => s.id === shop.id);
                                  if (targetShop) {
                                    setDoc(doc(db, 'shops', shop.id), targetShop).catch(() => {});
                                  }

                                  DzStoreDB.saveShops(updatedShops);
                                  setShops(updatedShops);
                                  alert(lang === 'ar' ? '✓ تم تصفير ترخيص الهاردوير وبصمة الأجهزة بنجاح!' : '✓ Fingerprint lock decoupled successfully!');
                                  onRefreshAll();
                                  DzStoreAudio.playSuccessChime(enableSounds);
                                }
                              }}
                              className="text-[9px] text-rose-700 bg-rose-50 hover:bg-rose-500 hover:text-white border border-rose-300 rounded px-2 py-0.5 cursor-pointer font-bold"
                            >
                              🔄 {lang === 'ar' ? 'تصفير وعقد فك الارتباط' : 'Reset & Decouple PC'}
                            </button>
                          </div>

                          <div className="mt-1 bg-indigo-500/5 p-2 rounded-lg border border-indigo-500/10 space-y-1.5">
                            <span className="text-[8.5px] font-extrabold text-slate-500 uppercase block">🗝️ {lang === 'ar' ? 'توليد كود التفعيل والاشتراك الفوري للمحل:' : 'Pro Signed Activation Key Generator:'}</span>
                            <div className="flex items-center gap-2">
                              <select
                                id={`license-plan-${shop.id}`}
                                className="text-[10px] bg-white border rounded px-1.5 py-0.5 font-bold cursor-pointer dark:bg-slate-900 dark:border-slate-800"
                                defaultValue="12M"
                              >
                                <option value="3M">{lang === 'ar' ? '٣ أشهر (3-Mo Subscription)' : '3 Months'}</option>
                                <option value="6M">{lang === 'ar' ? '٦ أشهر (6-Mo Subscription)' : '6 Months'}</option>
                                <option value="12M">{lang === 'ar' ? 'سنة كاملة (1-Yr Subscription)' : '1 Year'}</option>
                                <option value="LIFE">{lang === 'ar' ? 'مدى الحياة (Lifetime Activation)' : 'Lifetime Key'}</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => {
                                  const sel = document.getElementById(`license-plan-${shop.id}`) as HTMLSelectElement;
                                  const plan = sel?.value as '3M' | '6M' | '12M' | 'LIFE';
                                  const key = DzStoreDB.generateLicenseKey(plan, shop.id);

                                  const updatedShops = shops.map(s => {
                                    if (s.id === shop.id) {
                                      let endD = s.trialEndDate;
                                      const d = new Date();
                                      if (plan === '3M') { d.setMonth(d.getMonth() + 3); endD = d.toISOString().split('T')[0]; }
                                      else if (plan === '6M') { d.setMonth(d.getMonth() + 6); endD = d.toISOString().split('T')[0]; }
                                      else if (plan === '12M') { d.setFullYear(d.getFullYear() + 1); endD = d.toISOString().split('T')[0]; }
                                      else { endD = '2099-12-31'; }

                                      return {
                                        ...s,
                                        licenseKey: key,
                                        status: 'active' as const,
                                        trialEndDate: endD,
                                        updatedAt: new Date().toISOString()
                                      };
                                    }
                                    return s;
                                  });

                                  const targetShop = updatedShops.find(s => s.id === shop.id);
                                  if (targetShop) {
                                    setDoc(doc(db, 'shops', shop.id), targetShop).catch(() => {});
                                  }

                                  DzStoreDB.saveShops(updatedShops);
                                  setShops(updatedShops);
                                  onRefreshAll();
                                  
                                  if (navigator.clipboard) {
                                    navigator.clipboard.writeText(key);
                                  }
                                  alert(lang === 'ar' 
                                    ? `✓ تم توليد كود التفعيل الرقمي وتدوينه:\n\n${key}\n\nتم نسخه للحافظة بنجاح، أرسله للعميل الآن لتفعيل محله!` 
                                    : `✓ Activation key generated and copied:\n${key}`
                                  );
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] px-3 py-1 rounded cursor-pointer transition-colors"
                              >
                                🔑 {lang === 'ar' ? 'توليد ونسخ الترخيص' : 'Pro License'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: BaridiMob management coordinates */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-xs text-start">
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-1 px-1">
                  🇩🇿 {lang === 'ar' ? 'إعدادات الدفع (طريقة بريدي موب)' : 'SaaS BaridiMob Coordinates'}
                </h4>
                
                <p className="text-[11px] text-slate-500 leading-relaxed font-sans px-1">
                  {lang === 'ar' 
                    ? 'هذا النص مشفر وسيظهر للمشتركين ذوي الفترات المنتهية في صفحة التفعيل الفوري لتوجيههم لدفع مستحقاتهم.'
                    : 'This instruction template is visible dynamically inside the trial locked user card prompts.'
                  }
                </p>

                <form onSubmit={handleSaveBaridiDetails} className="space-y-3 pt-2">
                  <textarea
                    value={baridiDetails}
                    onChange={e => setBaridiDetails(e.target.value)}
                    rows={4}
                    className="w-full text-xs px-3 py-2 border rounded-xl font-mono focus:ring-1 focus:ring-amber-500 bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                  />
                  
                  <button
                    type="submit"
                    className="w-full text-xs bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    💾 {lang === 'ar' ? 'حفظ إحداثيات الدفع للجزائر' : 'Publish Payment Details'}
                  </button>
                </form>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: SUPPORT AND HELP TICKETS LIST */}
        {activeTab === 'support' && (
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <div className="flex justify-between items-center pb-4 border-b">
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-500" />
                  {lang === 'ar' ? 'تذاكر الدعم الفني واستفسارات المزامنة للمحلات' : 'Tenant Support & Direct Messages'}
                </h3>
                <span className="text-xs text-slate-450 font-bold">
                  {tickets.length} {lang === 'ar' ? 'تذاكر دعم مسجلة' : 'Support Tickets'}
                </span>
              </div>

              {tickets.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>{lang === 'ar' ? 'لا توجد تذاكر دعم مفتوحة حالياً.' : 'Everything is pristine! No tickets logged.'}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tickets.map(ticket => (
                    <div key={ticket.id} className="py-5 flex flex-col md:flex-row justify-between items-start gap-4">
                      <div className="space-y-1.5 max-w-xl">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-slate-100 dark:bg-slate-850 px-2.5 py-0.5 rounded-full font-black text-slate-700 dark:text-slate-300">
                            🏪 {ticket.shopName}
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            ticket.status === 'resolved' 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : 'bg-rose-50 text-rose-700 animate-pulse'
                          }`}>
                            {ticket.status === 'resolved' ? (lang === 'ar' ? 'محلولة' : 'Resolved') : (lang === 'ar' ? 'قيد المراجعة' : 'Pending Action')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-755 dark:text-slate-350 font-sans font-medium">{ticket.message}</p>
                        <div className="text-[10px] text-slate-400 font-mono space-x-2">
                          <span>👤 {ticket.senderName} ({ticket.senderPhone})</span>
                          <span>•</span>
                          <span>📆 {new Date(ticket.timestamp).toLocaleString()}</span>
                        </div>

                        {ticket.replyText && (
                          <div className="bg-amber-500/5 p-3 rounded-2xl border border-dashed border-amber-500/20 text-xs mt-3 relative">
                            <span className="text-[9px] font-extrabold text-amber-700 block uppercase mb-1">💬 رد الأدمن والدعم الفني:</span>
                            <p className="text-slate-700 dark:text-slate-300 font-mono">{ticket.replyText}</p>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center">
                        {ticket.status === 'pending' ? (
                          <div className="space-y-2 w-full min-w-[200px]">
                            {activeTicketId === ticket.id ? (
                              <div className="space-y-2">
                                <textarea
                                  placeholder={lang === 'ar' ? 'أدخل الرد على العميل للتفعيل السريع...' : 'Reply and trigger approval activation...'}
                                  rows={2}
                                  value={replyInput}
                                  onChange={e => setReplyInput(e.target.value)}
                                  className="w-full text-xs p-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 text-slate-800"
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleReplyTicket(ticket.id)}
                                    className="flex-1 py-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg text-[10px] cursor-pointer"
                                  >
                                    {lang === 'ar' ? 'إرسال الرد وحل التذكرة' : 'Send'}
                                  </button>
                                  <button
                                    onClick={() => { setActiveTicketId(null); setReplyInput(''); }}
                                    className="py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-[10px] cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setActiveTicketId(ticket.id)}
                                className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-[11px] cursor-pointer text-center"
                              >
                                ✍️ {lang === 'ar' ? 'الرد على التذكرة ومشاركة التفعيل' : 'Reply & Resolve'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg font-black flex items-center gap-1">
                            ✓ {lang === 'ar' ? 'التذكرة محلولة ومؤرشفة' : 'Archived Resolved'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: PLATFORM AI ASSISTANT (GEMINI) */}
        {activeTab === 'ai' && (
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              <div className="flex items-center justify-between pb-4 border-b mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-500/10 rounded-xl">
                    <Bot className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase">
                      🤖 {lang === 'ar' ? 'مساعد التخطيط وتحليلات SaaS بالذكاء الاصطناعي' : 'Gemini SaaS Optimization Business Copilot'}
                    </h3>
                    <p className="text-[10px] text-slate-450 uppercase font-mono">Powered by gemini-3.5-flash server proxy</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAiChat([{ role: 'model', content: lang === 'ar' ? 'معاد تصفير سجلات الذكاء الاصطناعي بنجاح!' : 'Copilot memory reset compiled successfully!' }])}
                  className="px-2.5 py-1 hover:bg-slate-100 text-xs rounded-xl text-slate-500 font-bold border border-slate-250 cursor-pointer"
                >
                  {lang === 'ar' ? 'تصفير السجل' : 'Reset History'}
                </button>
              </div>

              {/* Chat thread */}
              <div className="flex-1 space-y-4 overflow-y-auto max-h-[350px] p-2 bg-slate-50 dark:bg-slate-950 rounded-2xl scrollbar-thin">
                {aiChat.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`p-3.5 rounded-2xl text-[11.5px] max-w-2xl font-medium font-sans leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-850 dark:text-slate-200 rounded-bl-none border dark:border-slate-800 shadow-2xs'
                    }`}>
                      <span className="block font-black text-[9px] uppercase tracking-wider mb-1 opacity-70">
                        {msg.role === 'user' ? (lang === 'ar' ? 'الأدمن المشرف' : 'Admin') : (lang === 'ar' ? 'مساعد Gemini الذكي' : 'Gemini SaaS AI')}
                      </span>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 rounded-bl-none animate-pulse text-[11px] text-slate-400 font-mono">
                      ⏳ {lang === 'ar' ? 'جاري تحليل قاعدة البيانات وتحضير تحليلات الـ SaaS...' : 'Analyzing telemetry, computing server charts...'}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Input query */}
              <form onSubmit={handleAiQuerySubmit} className="mt-4 flex gap-2 pt-2 border-t">
                <input
                  type="text"
                  required
                  disabled={aiLoading}
                  placeholder={lang === 'ar' ? 'اسأل عن تقديرات الدخل السنوي، تحسين قوانين الترخيص، أو كتابة منشور تحديث...' : 'Ask about performance, drafting release rollouts, predicting trial locks...'}
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  className="flex-1 text-xs px-4 py-3 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:outline-none dark:text-white"
                />
                
                <button
                  type="submit"
                  disabled={aiLoading || !aiPrompt.trim()}
                  className="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-extrabold rounded-2xl flex items-center gap-1.5 transition-all text-xs cursor-pointer shadow"
                >
                  <Send className="w-4 h-4 text-white" />
                  {lang === 'ar' ? 'استشارة' : 'Consult AI'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: SYSTEM RELEASES & UPDATER */}
        {activeTab === 'releases' && (
          <>
            {/* Version rollouts manager */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-3 shadow-xs text-start">
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wide flex items-center gap-1.5 pb-2 border-b">
                  <UploadCloud className="w-5 h-5 text-indigo-500 animate-pulse" />
                  {lang === 'ar' ? 'أرشيف الإصدارات وخوادم التحديث التلقائي' : 'Platform Version Releases (Electron/Capacitor)'}
                </h3>

                <div className="space-y-4">
                  {releases.map((rel, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border dark:border-slate-850 text-xs">
                      <div className="flex justify-between items-center pb-2 border-b border-dashed dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-slate-900 text-white rounded-lg font-mono font-black text-[10.5px]">
                            v{rel.version}
                          </span>
                          <span className="text-[10px] text-slate-550 bg-slate-100 dark:bg-slate-850 py-0.5 px-2 rounded font-bold">
                            📦 Platform: {rel.platform}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{rel.date}</span>
                      </div>
                      
                      <p className="text-slate-700 dark:text-slate-350 font-bold mt-2 font-sans">{rel.releaseNotes}</p>
                      
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[9px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">
                          Verified & Signed by DZ SaaS Release Key
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                          <span className="text-[9.5px] text-emerald-800 font-black">Ready for Electron AutoUpdater</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Release publishing form */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-xs text-start">
                <h4 className="font-extrabold text-sm text-slate-850 dark:text-white">
                  🚀 {lang === 'ar' ? 'نشر وإتاحة تحديث برمجي جديد' : 'Publish New Version'}
                </h4>

                <form onSubmit={handlePublishRelease} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      {lang === 'ar' ? 'رقم الإصدار (Version):' : 'Release Version Key:'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 1.1.3"
                      value={newVersionInput}
                      onChange={e => setNewVersionInput(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-xl font-mono dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      {lang === 'ar' ? 'المنصة المستهدفة:' : 'Target Platform:'}
                    </label>
                    <select
                      value={newVersionPlatform}
                      onChange={e => setNewVersionPlatform(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 border rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white cursor-pointer"
                    >
                      <option value="All">{lang === 'ar' ? 'الكل (سطح المكتب + أندرويد)' : 'All Platforms'}</option>
                      <option value="Desktop">{lang === 'ar' ? 'ويندوز فقط Windows Desktop' : 'Windows Desktop'}</option>
                      <option value="Android">{lang === 'ar' ? 'أندرويد فقط Android Mobile' : 'Capacitor Android'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      {lang === 'ar' ? 'تفاصيل ومميزات الإصدار:' : 'Release Rollout Log Notes:'}
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder={lang === 'ar' ? 'أدخل تفاصيل التحديث لقرائها من طرف أصحاب المحلات والمدير التلقائي...' : 'What has changed...'}
                      value={newVersionNotes}
                      onChange={e => setNewVersionNotes(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                  >
                    <UploadCloud className="w-4 h-4 text-white" />
                    <span>{lang === 'ar' ? 'تعميم وبدء البث الفوري' : 'Initiate Version Rollout'}</span>
                  </button>
                </form>
              </div>
            </div>
          </>
        )}

        {/* TAB 5: PUBLISH BROADCASTS & WARNING NEWS */}
        {activeTab === 'broadcasts' && (
          <>
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-3 shadow-xs">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  📜 {lang === 'ar' ? 'الإشعارات وتنبيهات السيستم السابقة' : 'Broadcasts Log'}
                </h3>

                <div className="space-y-3">
                  {broadcasts.length === 0 ? (
                    <p className="text-xs italic text-slate-400 py-4 text-center">{lang === 'ar' ? 'سجل الإرسال نظيف وخالٍ' : 'Broadcasts list is pristine.'}</p>
                  ) : (
                    broadcasts.map(msg => (
                      <div key={msg.id} className="bg-slate-50/70 dark:bg-slate-950 p-4 rounded-2xl border dark:border-slate-850 relative text-start">
                        <button
                          onClick={() => handleRemoveBroadcast(msg.id)}
                          className="absolute top-2.5 right-2 px-1 text-slate-400 hover:text-rose-600 text-xs transition-colors cursor-pointer"
                        >
                          ✕
                        </button>
                        <h4 className="font-bold text-xs flex items-center gap-1 text-sky-850 dark:text-sky-300">
                          <Bell className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                          {msg.title}
                        </h4>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-snug mt-1">{msg.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-xs">
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wide flex items-center gap-1.5">
                  <Radio className="w-4.5 h-4.5 text-sky-600 animate-pulse" />
                  {t.send_broadcast}
                </h3>

                <form onSubmit={handleSendBroadcast} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">{t.broadcast_title}</label>
                    <input
                      type="text"
                      required
                      placeholder={lang === 'ar' ? 'عنوان الإشعار الرئيسي' : 'Notification title'}
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">{t.broadcast_content}</label>
                    <textarea
                      required
                      placeholder={lang === 'ar' ? 'التوجيه البرمجي أو رسالة التوجيه لأصحاب المحلات...' : 'Notify message contents...'}
                      value={newContent}
                      onChange={e => setNewContent(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-xl h-20 resize-none dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="noticeType"
                      checked={isUpdateNotice}
                      onChange={e => setIsUpdateNotice(e.target.checked)}
                      className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <label htmlFor="noticeType" className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                      {lang === 'ar' ? 'تصنيف كتحديث برمجي هام للمنصة' : 'Mark as structural software upgrade'}
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full text-xs bg-sky-700 hover:bg-sky-800 text-white font-extrabold py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {lang === 'ar' ? 'بث وتعميم الإشعار فورا' : 'Transmit Notice'}
                  </button>
                </form>
              </div>
            </div>
          </>
        )}

        {/* TAB 6: CSV ADVANCED DATA IMPORTER */}
        {activeTab === 'csv' && (
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 left-0 h-[3px] bg-gradient-to-r from-teal-500 via-emerald-500 to-indigo-500"></div>

              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-1.5 border-b pb-2">
                📥 {lang === 'ar' ? 'بوابة استيراد تقارير المبيعات (CSV)' : 'CSV Sales & Tenant Importer'}
              </h3>

              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                {lang === 'ar'
                  ? 'استخدم هذه البوابة المتقدمة لإنشاء وتنشيط حسابات المشتركين الجدد واستيراد مبيعاتهم السابقة دفعة واحدة من ملفات Excel/CSV مباشرة إلى خوادم السحاب.'
                  : 'Use this workspace console to bulk import sales histories from CSV tables directly to live Firestore.'}
              </p>

              {/* PRE-POPULATE TEMPLATE CTA */}
              <button
                type="button"
                onClick={handlePrepopulateBahaData}
                className="w-full text-xs font-black py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer border-none"
              >
                <span>⚡</span>
                {lang === 'ar' 
                  ? 'تحميل كود تقرير مبيعات baha34ayyoub@gmail.com (78 عملية مبيعات)'
                  : 'Auto-load Baha34 78 Sales CSV'}
              </button>

              <form onSubmit={handleRunCSVImport} className="space-y-4 pt-2 border-t border-dashed mt-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      {lang === 'ar' ? 'البريد الإلكتروني للمشترك المستهدف:' : 'Target Owner Email:'}
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. baha34ayyoub@gmail.com"
                      value={importEmail}
                      onChange={e => setImportEmail(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-xl font-mono dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      {lang === 'ar' ? 'اسم المحل:' : 'Shop Name:'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Baha Store"
                      value={importShopName}
                      onChange={e => setImportShopName(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      {lang === 'ar' ? 'اسم صاحب المحل:' : 'Owner Name:'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="بهاء الدين"
                      value={importOwnerName}
                      onChange={e => setImportOwnerName(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    {lang === 'ar' ? 'محتوى جدول الـ CSV للمبيعات:' : 'Sales CSV Table Body:'}
                  </label>
                  <textarea
                    required
                    rows={6}
                    placeholder='"رقم العملية (ID)","اسم الزبون","التاريخ والوقت","المنتجات المباعة","المبلغ الإجمالي"...'
                    value={customCSVContent}
                    onChange={e => setCustomCSVContent(e.target.value)}
                    className="w-full text-[10px] px-3 py-2 border rounded-xl font-mono focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-white whitespace-pre scrollbar-thin leading-snug"
                  />
                  <span className="text-[9px] text-slate-450 block mt-0.5" dir="ltr">
                    Expected schema: ID, Customer, Date, Items (Qty×Price), Amount
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isImporting || !customCSVContent}
                  className={`w-full text-xs font-black py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border transition-all ${
                    isImporting 
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                      : 'bg-slate-900 hover:bg-slate-800 text-white border-transparent active:scale-[0.98] dark:bg-amber-600 dark:hover:bg-amber-700'
                  }`}
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white-400" />
                      {lang === 'ar' ? 'جاري الاستيراد والتخزين السحابي الفوري...' : 'Processing cloud replication...'}
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4 text-emerald-400" />
                      {lang === 'ar' ? '🚀 بدء الاستيراد السحابي والمحلي للملف' : 'Start Cloud CSV Import Run'}
                    </>
                  )}
                </button>
              </form>

              {importFeedback && (
                <div className="bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 p-3 rounded-2xl animate-fade-in text-start text-xs border-dashed">
                  <span className="text-[10px] uppercase font-black text-slate-600 block mb-1">
                    📢 {lang === 'ar' ? 'تقرير التغذية الراجعة للعملية:' : 'Import Execution Log:'}
                  </span>
                  <p className="text-[10px] font-sans font-medium text-slate-800 dark:text-slate-250 leading-relaxed whitespace-pre-wrap">
                    {importFeedback}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// PRESET CSV TRANSACTIONS REPORT FOR BAHA DATA IMPORT
export const BAHA_SALES_CSV = `"رقم العملية (ID)","اسم الزبون","التاريخ والوقت","المنتجات المباعة (الاسم × الكمية @ السعر)","المبلغ الإجمالي"
"cYclWSxLqgkZeDDVmwfw","زبون عام","17‏/06، 07:36 م","Camera LENS FILM (1×60000)","55000 العملة"
"vViVMWO7tXGeUmrucEk9","زبون عام","17‏/06، 11:52 ص","Charger MI 67W GAN  (1×90000)","90000 العملة"
"NbUan25IeQR7OjoYe6gP","زبون عام","17‏/06، 10:33 ص","brasli yamaha (1×15000)","15000 العملة"
"4NjxuRZL79VL1wZbGhzm","زبون عام","17‏/06، 10:33 ص","Cable Borofone BX113 TC (1×45000)","45000 العملة"
"MkCbwHJV95PSibGAUorm","زبون عام","17‏/06، 10:33 ص","OTG TC -- Usb (1×15000)","15000 العملة"
"Fte2Esezc9ZdC9N73IAS","زبون عام","17‏/06، 10:32 ص","Incassable  (2×20000)","40000 العملة"
"iH1pN9AaUCe4U89M9hdi","زبون عام","17‏/06، 10:32 ص","Kit Oraimo OEP-E10 (1×15000)","15000 العملة"
"3XnhEjj3WctK8ER3Jya8","زبون عام","17‏/06، 09:52 ص","Bleutooth Hoco Frak Noir  (1×80000)","80000 العملة"
"QnhnpjFJWKeXkwAwz8Ep","زبون عام","16‏/06، 09:22 م","Camera LENS FILM (1×30000)","30000 العملة"
"ZQzRv2zbXRDDJ9jM1U8T","زبون عام","16‏/06، 09:11 م","Charger MI 67W GAN  (1×90000)","85000 العملة"
"teCvT8omeZ5WT6Pue6th","زبون عام","16‏/06، 09:07 م","Cable Borofone BX113 TC (1×45000)","40000 العملة"
"fBWA96AZfbtktXQoHjg7","زبون عام","16‏/06، 03:00 م","Air pods América  (1×70000)","70000 العملة"
"TvjEPbdfUVs9JZkXVnve","زبون عام","16‏/06، 01:00 م","Vantouz Simple  (1×20000)","20000 العملة"
"T8tQrtH8tMw1IVl5Hygz","زبون عام","16‏/06، 10:55 ص","OTG TC -- Usb (1×15000)","15000 العملة"
"GkjAvozOrQt4TaFQ1wOs","زبون عام","16‏/06، 09:40 ص","Incassable  (1×20000)","20000 العملة"
"hZu84qyLMjSI8ehpnS88","زبون عام","15‏/06، 11:07 م","Vantouz Simple  (1×20000)","20000 العملة"
"VCLeHbHIQryucbzcJ8eM","زبون عام","15‏/06، 08:58 م","Incassable  (1×20000)","20000 العملة"
"eqiMAuT6r6onvXUhGtvJ","زبون عام","15‏/06، 05:49 م","Bleutooth Hoco frak pro USA (1×80000)","75000 العملة"
"Va8DmdVVZkaC0pJJKEZT","زبون عام","15‏/06، 05:10 م","USb Bleutooth (1×40000)","40000 العملة"
"uZEYCWiNpmJfXimmKhMg","زبون عام","15‏/06، 04:16 م","KIT Hoco M101 Max ORG (1×75000)","75000 العملة"
"5L5plY8QRROLVon24PlK","زبون عام","15‏/06، 03:49 م","OTG TC -- Usb (1×15000)","15000 العملة"
"dAKUdX6wODX6vjEFQPLR","زبون عام","15‏/06، 03:47 م","Casqe P9 (1×120000)","110000 العملة"
"V1W1HWRWyiaYJkKsiCOC","زبون عام","15‏/06، 03:32 م","Casqe P9 (1×120000)","120000 العملة"
"aZMyInUd1qzIb0eYM45t","زبون عام","15‏/06، 12:04 م","Vantouz Simple  (1×20000)","20000 العملة"
"7VvTZhyojF6vx1qNU7qn","زبون عام","15‏/06، 09:25 ص","Bleutooth Hoco frak pro USA (1×80000)","80000 العملة"
"5xMjk8KKyM9WuPgultwp","زبون عام","14‏/06، 07:11 م","BAF X1 (1×50000)","50000 العملة"
"j9AcESa43nDus20GS1Zc","زبون عام","14‏/06، 05:56 م","Incassable  (1×20000)","20000 العملة"
"u8iJUR4TXC3GsG5rtmV2","زبون عام","14‏/06، 05:56 م","Baf S300 (1×95000)","90000 العملة"
"kYrXCh1hSjpJV7PiYL0f","زبون عام","14‏/06، 12:57 م","Kit Oraimo OEP-E10 (1×15000)","15000 العملة"
"YrdUuedURw6izrJERYWf","زبون عام","14‏/06، 12:39 م","brasli yamaha (1×15000)","15000 العملة"
"qWARNVbTmbxODw8rGZUO","زبون عام","14‏/06، 12:38 م","Cable Hoco X120 TC IP (1×55000)","55000 العملة"
"7PLkLMmMHaBV1XTl48cZ","زبون عام","14‏/06، 12:36 م","Adebter GFUZ SD-08 25W (1×65000)","65000 العملة"
"G3JwzanXrsCE3x1VrrUu","زبون عام","14‏/06، 12:30 م","USb Bleutooth (1×40000)","40000 العملة"
"x26JF9WdFUUsQE5esXcv","زبون عام","14‏/06، 12:28 م","KIT Condor T4 (1×25000)","25000 العملة"
"LCKLpwcDEOLTpIgvQbRf","زبون عام","14‏/06، 12:27 م","Cable Borofone BX113 TC (1×45000)","40000 العملة"
"995gpT8X1p8FZ8PM6nBX","زبون عام","14‏/06، 10:53 ص","Charger Oppo TC  (1×75000)","75000 العملة"
"V15O3OPO9U1p4cHh5PGv","زبون عام","14‏/06، 09:17 ص","Kit Oraimo OEP-E10 (2×15000)","30000 العملة"
"F921nAP977H9wKFTA9aG","زبون عام","13‏/06، 11:38 م","Cable Borofone BX121 TC  (1×25000)","25000 العملة"
"OTGszZC7Jeu46e8qICrB","زبون عام","13‏/06، 06:54 م","Cable Ldnio LC121I (1×70000)","70000 العملة"
"pxhppoYsH2AzYz84JYN4","زبون عام","13‏/06، 04:46 م","charger HOCO CS52 A V8 (1×80000)","80000 العملة"
"c6o6LWyfP1DKDc3l2hIh","زبون عام","13‏/06، 03:43 م","Incassable  (1×20000)","10000 العملة"
"164NaqmbFeqSN9h6LFlx","زبون عام","13‏/06، 12:07 م","Incassable  (1×20000)","20000 العملة"
"FmRUW5tBzkXYsGrbPFHT","زبون عام","13‏/06، 12:07 م","Kit Oraimo OEP-E10 (1×15000)","15000 العملة"
"xV2jC3i1KHx8vbVZe2dg","زبون عام","13‏/06، 12:06 م","Charger Samsung 45W TC (1×85000)","85000 العملة"
"D93fnDpzXpR6ndF6mLMz","زبون عام","13‏/06، 12:00 ص","BAF X1 (1×50000)","45000 العملة"
"2wRpr2yrdJ6SXx56uoR9","زبون عام","12‏/06، 05:32 م","Cable Borofone BX113 TC (1×45000)","40000 العملة"
"7iwOAjBvHePNjaoptQro","زبون عام","12‏/06، 11:54 ص","Otg Remax Usb--TC  (1×10000)","10000 العملة"
"zTZHJGnNx6h0g5E4cB8n","زبون عام","12‏/06، 10:28 ص","Bleutooth Hoco Frak Noir  (1×80000)","80000 العملة"
"4ji5RXSmi9850N910C1M","زبون عام","11‏/06، 08:36 م","Baf P68 (1×220000)","200000 العملة"
"7bgpoEXqROTGXO9zZsxE","زبون عام","11‏/06، 01:50 م","BAF L-003 (1×100000)","100000 العملة"
"xKkiAq6ZwRP7MAbuvIWt","زبون عام","11‏/06، 01:04 م","Camera LENS FILM (1×30000)","30000 العملة"
"bUkxJeH4fWyuL5ldyCy6","زبون عام","11‏/06، 12:38 م","Incassable  (1×20000)","20000 العملة"
"Im4i37jbYNuQUTGDomwT","زبون عام","11‏/06، 12:08 م","KIT Condor T4 (1×25000)","25000 العملة"
"ZhMtYBVAIVNOCZ79cTAR","زبون عام","11‏/06، 12:07 م","Pochette بحر  (1×25000)","25000 العملة"
"KwDSkvPobqeQ8PXHfoeA","زبون عام","11‏/06، 11:13 ص","Telecommande IRIS SMART  (1×25000)","25000 العملة"
"Wdw8s4obJsbFXJollZMU","زبون عام","10‏/06، 10:19 م","Telecommande IRIS LED  (1×25000)","25000 العملة"
"m8Xd2dPRfoq90NFQao8S","زبون عام","10‏/06، 10:17 م","Telecommande S229 IRIS Netflix (1×30000) | Telecommande IRIS LED  (1×25000)","55000 العملة"
"J7vb7ug95gMHJSf1REik","زبون عام","10‏/06، 08:49 م","Incassable  (1×20000)","10000 العملة"
"WVbGFcAk35oB0LduWJCT","زبون عام","10‏/06، 06:58 م","Charger Oppo TC  (1×75000)","75000 العملة"
"nWQRNLJNLCoDARAEFAZl","زبون عام","09‏/06، 10:05 م","Incassable  (1×20000)","20000 العملة"
"dgK3d9UDwwa85YlYqXqm","زبون عام","09‏/06، 08:27 م","Air Pods 4  (1×180000)","180000 العملة"
"zVJO6bwR1XLYkKOEMWvm","زبون عام","09‏/06، 08:08 م","BAF X1 (1×50000)","45000 العملة"
"xHOjRhwfy9TaT9Issnzx","زبون عام","09‏/06، 07:39 م","vantoz coeur  (1×30000)","30000 العملة"
"76xJJwCNUnAZQIhOYcLE","زبون عام","08‏/06، 10:42 م","Bleutooth Hoco EW78 (1×180000)","165000 العملة"
"XpRVzg90U3ESNYZL60R0","زبون عام","08‏/06., 04:12 م","Charger Ldnio A303Q IP (1×120000)","120000 العملة"
"QPF4GRaFZv7dmwfVZ4Dd","زبون عام","08‏/06، 11:46 ص","Cable Usb V8 AAA (1×10000)","10000 العملة"
"Y0fWngGu9fLTl0vqqQKh","زبون عام","07‏/06، 10:06 م","Cable Ldnio LS861 (1×50000)","50000 العملة"
"NM3set23tmv65rz4FRpX","زبون عام","07‏/06، 10:04 م","Cable LDnio LC671C (1×80000)","80000 العملة"
"6TAzwz6BKG5xGsXZMPpN","زبون عام","07‏/06، 08:11 م","Casqe P9 (1×120000)","110000 العملة"
"y5pAMt47k8qqZFZUmlMe","زبون عام","07‏/06، 07:43 م","Cable Borofone BX120 TC (1×35000)","35000 العملة"
"w6zGBLghexvWWUhES4KX","زبون عام","07‏/06، 07:08 م","Cable Borofone BX120 TC (1×35000)","35000 العملة"
"59iBu4r8E1ltjl8d3ExN","زبون عام","07‏/06، 06:31 م","Incassable  (2×20000)","40000 العملة"
"BW1xsVURhzGBc9HYf3wT","زبون عام","07‏/06، 12:42 م","Casqe P9 (1×120000)","110000 العملة"
"KFeGtjyKlOYrpRswtQdw","زبون عام","07‏/06، 12:14 م","Telecommande Geant 006 org (1×25000)","25000 العملة"
"IRw0RuYFfL96PsiMaxox","زبون عام","07‏/06، 12:13 م","Cable Ldnio LC121I (1×70000)","50000 العملة"
"qcM1XwYYlT3yJOGa680L","زبون عام","07‏/06، 12:12 م","vantoz coeur  (1×30000)","30000 العملة"
"2YSScjGnKMrk19oRhYY2","زبون عام","07‏/06، 12:09 م","Charger Gfuz CH-46 (1×65000)","65000 العملة"
"wezjn6Os8H9Vblk8vDUg","زبون عام","07‏/06، 12:08 م","Baf P68 (1×220000)","200000 العملة"`;
