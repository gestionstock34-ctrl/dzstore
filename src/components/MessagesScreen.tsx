/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Trash2, 
  CheckCheck, 
  Search, 
  Phone, 
  Calendar, 
  User, 
  MessageSquare,
  Bookmark,
  Reply,
  ExternalLink,
  Info
} from 'lucide-react';
import { CustomerMessage, Language, Currency } from '../types';
import { DzStoreDB } from '../lib/db';
import { DzStoreAudio } from './AudioAlerts';

interface MessagesScreenProps {
  shopId: string;
  lang: Language;
  currency: Currency;
  enableSounds: boolean;
  syncKey?: number;
}

export const MessagesScreen: React.FC<MessagesScreenProps> = ({ shopId, lang, currency, enableSounds, syncKey }) => {
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedMessage, setSelectedMessage] = useState<CustomerMessage | null>(null);

  useEffect(() => {
    loadMessages();
  }, [shopId, syncKey]);

  const loadMessages = () => {
    const list = DzStoreDB.getMessages(shopId);
    setMessages(list);
  };

  const markAllAsRead = () => {
    const updated = messages.map(m => ({ ...m, isRead: true }));
    DzStoreDB.saveMessages(shopId, updated);
    setMessages(updated);
    if (selectedMessage) {
      setSelectedMessage({ ...selectedMessage, isRead: true });
    }
    DzStoreAudio.playSuccessChime(enableSounds);
  };

  const toggleReadStatus = (msgId: string) => {
    const updated = messages.map(m => {
      if (m.id === msgId) {
        return { ...m, isRead: !m.isRead };
      }
      return m;
    });
    DzStoreDB.saveMessages(shopId, updated);
    setMessages(updated);
    
    if (selectedMessage && selectedMessage.id === msgId) {
      setSelectedMessage({ ...selectedMessage, isRead: !selectedMessage.isRead });
    }
  };

  const deleteMessage = (msgId: string) => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذه الرسالة نهائياً؟' : 'Are you sure you want to delete this message?')) {
      return;
    }
    const updated = messages.filter(m => m.id !== msgId);
    DzStoreDB.saveMessages(shopId, updated);
    setMessages(updated);
    
    if (selectedMessage && selectedMessage.id === msgId) {
      setSelectedMessage(null);
    }
    DzStoreAudio.playWarningChime(enableSounds);
  };

  // Filter & Search computation
  const filteredMessages = messages.filter(msg => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      msg.senderName.toLowerCase().includes(q) ||
      msg.senderPhone.includes(q) ||
      msg.subject.toLowerCase().includes(q) ||
      msg.content.toLowerCase().includes(q) ||
      (msg.ticketRelated && msg.ticketRelated.toLowerCase().includes(q));

    const matchesStatus = 
      filterType === 'all' ? true :
      filterType === 'unread' ? !msg.isRead : msg.isRead;

    return matchesSearch && matchesStatus;
  });

  const unreadCount = messages.filter(m => !m.isRead).length;

  const getWhatsAppLink = (phone: string, clientName: string, subject: string) => {
    const textStr = encodeURIComponent(
      lang === 'ar' 
        ? `السلام عليكم ${clientName}، نحن نتواصل معك بخصوص استفسارك حول موضوع (${subject}) على منصة DzStore...` 
        : `Hello ${clientName}, we are reaching out in response to your query regarding (${subject}) on DzStore...`
    );
    // Sanitize phone number digits only
    const digits = phone.replace(/\D/g, '');
    const cleanPhone = digits.startsWith('0') ? '213' + digits.slice(1) : digits;
    return `https://wa.me/${cleanPhone}?text=${textStr}`;
  };

  return (
    <div className="space-y-6 text-xs text-slate-800 dark:text-slate-105 animate-glass-in">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
        <div className="flex items-center gap-3.5 text-start">
          <div className="p-3 bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 rounded-2xl">
            <Mail className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <span>{lang === 'ar' ? 'صندوق رسائل الزبائن' : 'Customer Inbox Board'}</span>
              {unreadCount > 0 && (
                <span className="bg-red-550 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full ring-2 ring-red-200 dark:ring-red-900/30">
                  {unreadCount} {lang === 'ar' ? 'جديد' : 'New'}
                </span>
              )}
            </h1>
            <p className="text-[11px] text-slate-500 max-w-xl">
              {lang === 'ar' ? 'استقبل المراسلات والشكاوى والاستفسارات الموجهة لمحلك من فضاء الزبائن، بادر بالتواصل لحل مشاكل زبائنك لزيادة المبيعات والتقييم.' :
               'Answer client tickets, technical inquiries, complaints, and warranty requests logged from direct Customer Portals.'}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="w-full sm:w-auto py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <CheckCheck className="w-4 h-4 text-emerald-500" />
            <span>{lang === 'ar' ? 'تعليم الكل كمقروء' : 'Mark all as Read'}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Messages List Area */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Controls Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-3xs text-start">
            
            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="w-4 h-4 text-slate-400" />
              </span>
              <input
                type="text"
                placeholder={lang === 'ar' ? 'ابحث باسم المرسل، الهاتف، الموضوع...' : 'Filter messages...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full py-2 pl-9 pr-3 bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-bold"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl">
              <button
                onClick={() => setFilterType('all')}
                className={`flex-1 py-1.5 rounded-lg text-center font-bold text-[10px] cursor-pointer transition-all ${
                  filterType === 'all' 
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' 
                    : 'text-slate-550 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                {lang === 'ar' ? 'الكل' : 'All'} ({messages.length})
              </button>
              <button
                onClick={() => setFilterType('unread')}
                className={`flex-1 py-1.5 rounded-lg text-center font-bold text-[10px] cursor-pointer transition-all ${
                  filterType === 'unread' 
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' 
                    : 'text-slate-550 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                {lang === 'ar' ? 'غير مقروءه' : 'Unread'} ({messages.filter(m=>!m.isRead).length})
              </button>
              <button
                onClick={() => setFilterType('read')}
                className={`flex-1 py-1.5 rounded-lg text-center font-bold text-[10px] cursor-pointer transition-all ${
                  filterType === 'read' 
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' 
                    : 'text-slate-550 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                {lang === 'ar' ? 'المقروءة' : 'Read'} ({messages.filter(m=>m.isRead).length})
              </button>
            </div>

          </div>

          {/* List items scroll container */}
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredMessages.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-450 dark:text-slate-500">
                <MessageSquare className="w-10 h-10 mx-auto text-slate-350 dark:text-slate-600 mb-2.5" />
                <p className="font-extrabold">{lang === 'ar' ? 'لا توجد رسائل مطابقة' : 'No incoming messages'}</p>
                <p className="text-[10px] opacity-75 mt-0.5">{lang === 'ar' ? 'كل شيء نظيف ومراجع في صندوق الوارد!' : 'Inbox is up to date.'}</p>
              </div>
            ) : (
              filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => {
                    setSelectedMessage(msg);
                    if (!msg.isRead) {
                      toggleReadStatus(msg.id);
                    }
                  }}
                  className={`p-4 border rounded-2xl text-start transition-all cursor-pointer relative overflow-hidden ${
                    selectedMessage?.id === msg.id 
                      ? 'bg-emerald-50/70 border-emerald-300 dark:bg-slate-850 dark:border-slate-700 shadow-3xs' 
                      : 'bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {!msg.isRead && (
                    <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-bl-xl" />
                  )}

                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-extrabold text-[12px] truncate text-slate-900 dark:text-white">📱 {msg.senderName}</h4>
                    <span className="text-[9px] text-slate-450 whitespace-nowrap font-mono">{new Date(msg.createdAt).toLocaleDateString()}</span>
                  </div>

                  <p className="font-extrabold text-[11px] mt-1 text-slate-750 dark:text-slate-300 truncate">
                    {msg.subject}
                  </p>
                  
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 lines-clamp-2 truncate">
                    {msg.content}
                  </p>

                  <div className="flex justify-between items-center pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800/60 text-[9.5px]">
                    <span className="bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded-md font-mono text-cyan-600 dark:text-cyan-400">
                      {msg.senderPhone}
                    </span>
                    {msg.ticketRelated ? (
                      <span className="font-black text-rose-500">🎫 {msg.ticketRelated}</span>
                    ) : (
                      <span className="text-slate-400 font-bold">{lang === 'ar' ? 'عام' : 'General'}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

        {/* Detailed Message Inspector */}
        <div className="lg:col-span-7">
          {selectedMessage ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5 text-start animate-fade-in">
              
              {/* Box Title */}
              <div className="flex justify-between items-center border-b dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-emerald-500" />
                  <span className="font-black text-[13px]">{lang === 'ar' ? 'تفاصيل الرسالة الواردة' : 'Message Coordinates'}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleReadStatus(selectedMessage.id)}
                    className="p-1 px-2.5 border dark:border-slate-800 rounded-lg text-[9px] hover:bg-slate-100 dark:hover:bg-slate-800 font-black cursor-pointer transition-colors"
                  >
                    {selectedMessage.isRead ? (lang === 'ar' ? 'تحديد كغير مقروءة' : 'Mark Unread') : (lang === 'ar' ? 'تحديد كمقروءة' : 'Mark Read')}
                  </button>
                  <button
                    onClick={() => deleteMessage(selectedMessage.id)}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer transition-colors"
                    title="Delete Message"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Sender Credentials Grid Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-4 border dark:border-slate-850 rounded-2xl relative overflow-hidden">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <User className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'مرسل الرسالة العميل:' : 'Customer Name:'}</span>
                  </div>
                  <p className="font-black text-slate-800 dark:text-white text-[13px]">{selectedMessage.senderName}</p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'رقم الهاتف المعتمد:' : 'Phone Contact:'}</span>
                  </div>
                  <p className="font-black text-slate-800 dark:text-white text-[13px] font-mono">{selectedMessage.senderPhone}</p>
                </div>

                <div className="space-y-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800 sm:col-span-2 flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(selectedMessage.createdAt).toLocaleString()}
                  </span>

                  {selectedMessage.ticketRelated && (
                    <span className="font-black text-rose-550 border border-rose-200/50 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-lg">
                      🎫 {lang === 'ar' ? 'التذكرة المرفقة:' : 'Related Ticket:'} {selectedMessage.ticketRelated}
                    </span>
                  )}
                </div>
              </div>

              {/* Message content block */}
              <div className="space-y-2">
                <span className="opacity-70 font-extrabold text-slate-500 block uppercase tracking-wider">{lang === 'ar' ? 'موضوع الرسالة:' : 'Subject:'}</span>
                <strong className="block text-slate-900 dark:text-white font-extrabold text-[14px] leading-tight">
                  {selectedMessage.subject}
                </strong>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border dark:border-slate-850 min-h-[140px] whitespace-pre-wrap font-bold leading-relaxed text-slate-700 dark:text-slate-350 text-[11.5px]">
                {selectedMessage.content}
              </div>

              {/* Direct Reply Command Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href={getWhatsAppLink(selectedMessage.senderPhone, selectedMessage.senderName, selectedMessage.subject)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-3 px-4 bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl font-black text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-700/10 hover:scale-101 transition-all"
                >
                  <Reply className="w-4 h-4 scale-x-[-1]" />
                  <span>{lang === 'ar' ? 'الرد الفوري عبر واتساب' : 'Direct Reply with WhatsApp'}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-white/70" />
                </a>

                <a
                  href={`tel:${selectedMessage.senderPhone}`}
                  className="py-3 px-5 border dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-black text-slate-700 dark:text-slate-200 text-center flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <Phone className="w-4 h-4 text-emerald-500" />
                  <span>{lang === 'ar' ? 'اتصال مباشر' : 'Call Voice'}</span>
                </a>
              </div>

            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-250 dark:border-slate-800 rounded-3xl p-16 text-center text-slate-400 dark:text-slate-550 flex flex-col justify-center items-center min-h-[380px]">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl mb-4 text-slate-350 dark:text-slate-600">
                <Mail className="w-10 h-10" />
              </div>
              <p className="font-extrabold text-[13px] text-slate-800 dark:text-slate-250">{lang === 'ar' ? 'يرجى اختيار رسالة لقراءة تفاصيلها' : 'Pick a message to inspect details'}</p>
              <p className="text-[11px] opacity-75 max-w-xs mt-1 leading-relaxed">
                {lang === 'ar' ? 'حدد أي كارد رسالة من القائمة الجانبية لقراءتها والبدء بالتواصل والرد على الزبون مباشرة.' :
                 'Click on any inbox item from list panel to review data, check ticket linkages, and trigger instant caller reply channels.'}
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
