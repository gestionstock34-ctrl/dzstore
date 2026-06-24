/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Currency, Language, CustomerMessage } from '../types';
import { TRANSLATIONS } from '../lib/data';
import { DzStoreDB } from '../lib/db';
import { DzStoreAudio } from './AudioAlerts';
import {
  MessageSquare,
  Send,
  MessageCircle,
  Copy,
  Plus,
  Trash2,
  CheckCircle,
  ExternalLink,
  Bot,
  User,
  History,
  Settings,
  AlertCircle
} from 'lucide-react';

interface CustomerCommunicationCenterProps {
  lang: Language;
  currency: Currency;
  shopName: string;
  shopId: string;
  enableSounds: boolean;
}

export const CustomerCommunicationCenter: React.FC<CustomerCommunicationCenterProps> = ({
  lang,
  currency,
  shopName,
  shopId,
  enableSounds,
}) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];

  // Keys for database state
  const KEY_WHATSAPP_PHONE = `dzstore_whatsapp_phone_${shopId}`;
  const KEY_WHATSAPP_TEMPLATES = `dzstore_whatsapp_templates_${shopId}`;
  const KEY_BOT_TOKEN = `dzstore_telegram_bot_token_${shopId}`;
  const KEY_CHAT_ID = `dzstore_telegram_chat_id_${shopId}`;

  // 1. WhatsApp Configuration States
  const [waPhone, setWaPhone] = useState('');
  const [repairTemplate, setRepairTemplate] = useState('');
  const [orderTemplate, setOrderTemplate] = useState('');

  // 2. Telegram Configuration States
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');

  // 3. Customer messages list
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [replyText, setReplyText] = useState<{ [msgId: string]: string }>({});

  // 4. Tab selection: 'chats' | 'whatsapp' | 'telegram' | 'history'
  const [subTab, setSubTab] = useState<'chats' | 'whatsapp' | 'telegram' | 'history'>('chats');

  // Load configuration and data
  useEffect(() => {
    setWaPhone(DzStoreDB.getItem(KEY_WHATSAPP_PHONE) || '');
    setBotToken(DzStoreDB.getItem(KEY_BOT_TOKEN) || '');
    setChatId(DzStoreDB.getItem(KEY_CHAT_ID) || '');

    // Default template builders
    const savedTemplates = DzStoreDB.getItem(KEY_WHATSAPP_TEMPLATES);
    if (savedTemplates) {
      try {
        const parsed = JSON.parse(savedTemplates);
        setRepairTemplate(parsed.repair || '');
        setOrderTemplate(parsed.order || '');
      } catch (e) {
        console.warn("Failed to parse WhatsApp templates", e);
      }
    } else {
      setRepairTemplate(
        lang === 'ar'
          ? "أهلاً {customer}، يسعدنا إخبارك بأن جهازك {device} جاهز للاستلام كوده: {ticket}.\nالمجموع: {cost} د.ج.\nمرحباً بك في {shop}."
          : "Hello {customer}, we are happy to inform you that your device {device} is ready for pickup! Ticket ID: {ticket}.\nTotal Cost: {cost}.\nWelcome to {shop}."
      );
      setOrderTemplate(
        lang === 'ar'
          ? "مرحباً {customer}، لقد تلقينا طلبك لشراء {product} بنجاح وسنتصل بك قريباً.\nشكرًا لثقتك بـ {shop}."
          : "Hi {customer}, we have successfully received your order for {product} and will contact you shortly.\nThank you for choosing {shop}!"
      );
    }

    // Load customer portal chats
    setMessages(DzStoreDB.getMessages(shopId));
  }, [shopId, lang]);

  // Saves WhatsApp Configuration
  const handleSaveWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    DzStoreDB.setItem(KEY_WHATSAPP_PHONE, waPhone.trim());
    DzStoreDB.setItem(
      KEY_WHATSAPP_TEMPLATES,
      JSON.stringify({ repair: repairTemplate, order: orderTemplate })
    );
    DzStoreAudio.playSuccessChime(enableSounds);
    alert(lang === 'ar' ? '✓ تم حفظ إعدادات الواتساب وقوالب الرد الآلي!' : '✓ WhatsApp settings and reply templates updated successfully!');
  };

  // Saves Telegram Bot Configuration
  const handleSaveTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    DzStoreDB.setItem(KEY_BOT_TOKEN, botToken.trim());
    DzStoreDB.setItem(KEY_CHAT_ID, chatId.trim());
    DzStoreAudio.playSuccessChime(enableSounds);
    alert(lang === 'ar' ? '✓ تم حفظ إعدادات بوت التيليجرام المشفر بنجاح!' : '✓ Telegram bot credentials stored safely!');
  };

  // Mark message as read/resolved
  const handleToggleRead = (msgId: string) => {
    const updated = messages.map(m => (m.id === msgId ? { ...m, isRead: !m.isRead } : m));
    DzStoreDB.saveMessages(shopId, updated);
    setMessages(updated);
    DzStoreAudio.playSuccessChime(enableSounds);
  };

  // Delete message
  const handleDeleteMessage = (msgId: string) => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذه الرسالة؟' : 'Are you sure you want to permanently delete this message?')) return;
    const updated = messages.filter(m => m.id !== msgId);
    DzStoreDB.saveMessages(shopId, updated);
    setMessages(updated);
    DzStoreAudio.playWarningChime(enableSounds);
  };

  // Send WhatsApp Direct Text
  const handleSendWhatsAppChat = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone.startsWith('213') || cleanPhone.length > 9 ? cleanPhone : '213' + cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Send reply message
  const handleReplySubmit = (msgId: string, replyTextStr: string, customerPhone: string) => {
    if (!replyTextStr.trim()) return;

    // Direct redirection via WhatsApp to customer phone
    handleSendWhatsAppChat(customerPhone, replyTextStr);

    // Update locally to indicate we read and commented
    const updated = messages.map(m => {
      if (m.id === msgId) {
        return {
          ...m,
          isRead: true,
          content: m.content + ` \n\n[REPLAYED]: ${replyTextStr}`
        };
      }
      return m;
    });

    DzStoreDB.saveMessages(shopId, updated);
    setMessages(updated);
    setReplyText(prev => ({ ...prev, [msgId]: '' }));
    DzStoreAudio.playSuccessChime(enableSounds);
  };

  // Filter messages for active vs read history
  const activeChats = messages.filter(m => !m.isRead);
  const historicChats = messages.filter(m => m.isRead);

  return (
    <div className="space-y-6 text-start font-sans">
      {/* HEADER HERO ROW */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-500/20">
            <MessageSquare className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">
              {lang === 'ar' ? '💬 مركز الاتصال وعلاقات الزبائن' : '💬 Customer Communication Center'}
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">
              {lang === 'ar'
                ? 'استقبل استفسارات وبلاغات تتبع الصيانة والطلبات من زوار متجرك وقم بالرد الفوري عبر واتساب وبوت تيليغرام المدمج.'
                : 'Direct channels setup, template automations, and live incoming customer portal messages feed.'}
            </p>
          </div>
        </div>

        {/* Dynamic statistics pill */}
        <div className="flex items-center gap-2 bg-slate-800 text-[10px] uppercase font-mono py-1.5 px-3 rounded-xl border border-slate-700 font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>{activeChats.length} {lang === 'ar' ? 'رسائل جديدة معلقة' : 'Pending Incoming'}</span>
        </div>
      </div>

      {/* TABS CONTROL */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200/50 pb-1.5">
        <button
          onClick={() => setSubTab('chats')}
          className={`py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            subTab === 'chats'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/50'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          {lang === 'ar' ? 'دردشات وحجوزات البوابة' : 'Incoming Inquiries'}
          {activeChats.length > 0 && (
            <span className="bg-rose-500 text-white font-mono text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
              {activeChats.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubTab('whatsapp')}
          className={`py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            subTab === 'whatsapp'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/50'
          }`}
        >
          <Send className="w-4 h-4" />
          {lang === 'ar' ? 'ربط وأتمتة الواتساب' : 'WhatsApp Automation'}
        </button>

        <button
          onClick={() => setSubTab('telegram')}
          className={`py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            subTab === 'telegram'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/50'
          }`}
        >
          <Bot className="w-4 h-4" />
          {lang === 'ar' ? 'إشعارات بوت تيليغرام' : 'Telegram Bot API'}
        </button>

        <button
          onClick={() => setSubTab('history')}
          className={`py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            subTab === 'history'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/50'
          }`}
        >
          <History className="w-4 h-4" />
          {lang === 'ar' ? 'سجل الرسائل المستلمة' : 'Messages History'}
        </button>
      </div>

      {/* SUBTAB: CHATS FEED */}
      {subTab === 'chats' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              📥 {lang === 'ar' ? 'محادثات زوار البوابة العامة المعلقة' : 'Active Inquiries & Feedback Queue'}
            </h3>
            <p className="text-[11.5px] text-slate-500 font-medium">
              {lang === 'ar'
                ? 'الرسائل الواردة من العملاء الذين قاموا بزيارة رابط متجرك للتتبع أو لتقديم طلبات صيانة وطلبات مباشرة عبر الويب.'
                : 'Whenever your guests check their ticket status or order items via the public QR page, they can report feedback.'}
            </p>

            {activeChats.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-150 rounded-2xl bg-slate-50/50">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium font-mono">{lang === 'ar' ? 'لا توجد دردشات أو بلاغات غير مقروءة حالياً.' : 'No pending customer portal inquiries yet.'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeChats.map(msg => (
                  <div key={msg.id} className="border border-slate-100 bg-slate-50/40 p-4 rounded-2xl space-y-3 shadow-xs">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-800 text-xs">
                          {msg.senderName?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-slate-900">{msg.senderName}</h4>
                          <span className="text-[9.5px] font-bold text-emerald-600 tracking-wider font-mono">{msg.senderPhone}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono font-bold text-slate-400">{msg.createdAt?.split('T')[0]}</span>
                        {msg.ticketRelated && (
                          <span className="bg-amber-100 text-amber-800 text-[9.5px] px-2 py-0.5 rounded-lg border border-amber-200 font-extrabold">
                            🛠️ {msg.ticketRelated}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-slate-750 bg-white p-3 rounded-xl border border-slate-100">
                      <p className="font-extrabold text-slate-800 mb-1">📢 {msg.subject}</p>
                      <p className="whitespace-pre-line leading-relaxed font-sans">{msg.content}</p>
                    </div>

                    {/* REPLY FIELD ACTIONS */}
                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                      <div className="w-full relative flex-1">
                        <input
                          type="text"
                          placeholder={lang === 'ar' ? 'اكتب ردك المخصص هنا لتوجيهه في واتساب...' : 'Compose custom response text for WhatsApp reply...'}
                          value={replyText[msg.id] || ''}
                          onChange={(e) => setReplyText(prev => ({ ...prev, [msg.id]: e.target.value }))}
                          className="w-full text-xs bg-white border border-slate-300 rounded-xl py-2 px-3 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold text-slate-900"
                        />
                      </div>
                      <div className="flex gap-1.5 w-full sm:w-auto shrink-0 justify-end">
                        <button
                          type="button"
                          onClick={() => handleReplySubmit(msg.id, replyText[msg.id] || '', msg.senderPhone)}
                          className="px-3.5 py-2 font-black text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          💬 {lang === 'ar' ? 'إرسال رد واتساب' : 'Reply wa.me'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleRead(msg.id)}
                          className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl border border-slate-200/60 cursor-pointer"
                          title={lang === 'ar' ? 'تحديد كمقروء ومؤرشف' : 'Archive Inquiry'}
                        >
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                          title={lang === 'ar' ? 'حذف البلاغ' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB: WHATSAPP CONFIG */}
      {subTab === 'whatsapp' && (
        <form onSubmit={handleSaveWhatsApp} className="bg-white border rounded-3xl p-5 space-y-4">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
            🟢 {lang === 'ar' ? 'إعدادات ربط وأتمتة الواتساب' : 'WhatsApp Business URL & Templates'}
          </h3>
          <p className="text-[11.5px] text-slate-500 font-medium">
            {lang === 'ar'
              ? 'الربط المباشر بواتساب لا يحتاج لموافقة معقدة أو تكاليف API، يتم تحضير النصوص بنقرة واحدة وتمريرها فوراً.'
              : 'By completing your phone coordinates, DzStore generates live clicking prompts that opens wa.me with custom variables.'}
          </p>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                📞 {lang === 'ar' ? 'رقم الهاتف الخاص بالمحل (ومقدمة البلد مثلاً: 213554000000)' : 'WhatsApp Store Phone Number (include country prefix like 213)'}
              </label>
              <input
                type="text"
                placeholder="213550123456"
                value={waPhone}
                onChange={(e) => setWaPhone(e.target.value)}
                className="w-full text-xs font-bold border border-slate-350 bg-white rounded-xl py-2.5 px-3.5 text-slate-900"
              />
              <span className="text-[10px] text-slate-400 font-medium font-mono">
                {lang === 'ar' ? 'يستخدم للتحويل والتواصل التلقائي عند نقر العميل على زر المراسلة بالبوابة العامة.' : 'Guests will redirection directly to this contact WhatsApp from the public profile.'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-755">
                  🛠️ {lang === 'ar' ? 'قالب رسالة جاهزية الصيانة:' : 'Maintenance Finished Alert Template:'}
                </label>
                <textarea
                  rows={4}
                  value={repairTemplate}
                  onChange={(e) => setRepairTemplate(e.target.value)}
                  className="w-full text-xs font-sans border border-slate-350 bg-white rounded-xl p-3 text-slate-900"
                ></textarea>
                <p className="text-[9.5px] text-slate-400 font-mono">
                  {lang === 'ar' ? 'المتغيرات المستعملة: {customer} ، {device} ، {ticket} ، {cost} ، {shop}' : 'Variables: {customer}, {device}, {ticket}, {cost}, {shop}'}
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-755">
                  📦 {lang === 'ar' ? 'قالب رسالة تأكيد الحجوزات والطلبات:' : 'Pre-order Submition Confirmation Template:'}
                </label>
                <textarea
                  rows={4}
                  value={orderTemplate}
                  onChange={(e) => setOrderTemplate(e.target.value)}
                  className="w-full text-xs font-sans border border-slate-350 bg-white rounded-xl p-3 text-slate-900"
                ></textarea>
                <p className="text-[9.5px] text-slate-400 font-mono">
                  {lang === 'ar' ? 'المتغيرات المستعملة: {customer} ، {product} ، {shop}' : 'Variables: {customer}, {product}, {shop}'}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <button
              type="submit"
              className="px-5 py-2.5 font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
            >
              💾 {lang === 'ar' ? 'حفظ قوالب ومظهر الواتساب' : 'Store Settings & Models'}
            </button>
          </div>
        </form>
      )}

      {/* SUBTAB: TELEGRAM CONFIG */}
      {subTab === 'telegram' && (
        <form onSubmit={handleSaveTelegram} className="bg-white border rounded-3xl p-5 space-y-4">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
            🤖 {lang === 'ar' ? 'ربط وإرسال إشعارات بوت تيليغرام' : 'Telegram Bot API Credentials & Alerts'}
          </h3>
          <p className="text-[11.5px] text-slate-500 font-medium">
            {lang === 'ar'
              ? 'تلقي تنبيه فوري ومجاني ومباشر على هاتفك في قناة أو مجموعة أو محادثة خاصة فور تسجيل طلب جديد من زائر في البوابة العامة.'
              : 'Allows real-time notifications straight to your Telegram messenger chat whenever a customer registers an online order.'}
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                🔑 {lang === 'ar' ? 'توكن بوت تيليغرام الخاص بك (Telegram Bot Token):' : 'Telegram Bot API Token (from @BotFather):'}
              </label>
              <input
                type="text"
                placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="w-full text-xs font-mono border border-slate-350 bg-white rounded-xl py-2.5 px-3 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                🆔 {lang === 'ar' ? 'رقم المحادثة المستهدفة (Target Chat/Channel ID):' : 'Telegram Target Chat ID (or Channel ID):'}
              </label>
              <input
                type="text"
                placeholder="-100123456789"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="w-full text-xs font-mono border border-slate-350 bg-white rounded-xl py-2.5 px-3 text-slate-900"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <button
              type="submit"
              className="px-5 py-2.5 font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
            >
              🤖 {lang === 'ar' ? 'حفظ وحماية تفعيل البوت' : 'Active and Encrypt Token'}
            </button>
          </div>
        </form>
      )}

      {/* SUBTAB: HISTORY */}
      {subTab === 'history' && (
        <div className="bg-white border rounded-3xl p-5 space-y-4">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
            📜 {lang === 'ar' ? 'سجل المحادثات المؤرشف والمقروء' : 'Archived Customer Inquiries'}
          </h3>

          {historicChats.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-slate-150 rounded-2xl bg-slate-50/50">
              <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-medium font-mono">{lang === 'ar' ? 'السجل المؤرشف فارغ حالياً.' : 'Your communication log history has zero entries.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historicChats.map(msg => (
                <div key={msg.id} className="border border-slate-100 bg-white p-3.5 rounded-xl space-y-2 opacity-75 hover:opacity-100 transition-opacity">
                  <div className="flex justify-between items-center text-[10.5px] text-slate-400 border-b pb-1">
                    <span className="font-bold text-slate-700">{msg.senderName} ({msg.senderPhone})</span>
                    <span>{msg.createdAt?.split('T')[0]}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800">📢 {msg.subject}</p>
                  <p className="text-xs text-slate-600 whitespace-pre-line font-mono font-medium">{msg.content}</p>

                  <div className="flex justify-end gap-2 pt-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleRead(msg.id)}
                      className="text-[9.5px] font-bold text-sky-600 hover:underline cursor-pointer"
                    >
                      🔄 {lang === 'ar' ? 'إعادة فتح وبث للمستلم' : 'Mark Active'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="text-[9.5px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      ❌ {lang === 'ar' ? 'حذف من الأرشيف' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
