/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Currency, Language, MaintenanceJob, SparePart } from '../types';
import { TRANSLATIONS } from '../lib/data';
import { DzStoreDB } from '../lib/db';
import { DzStoreAudio } from './AudioAlerts';
import {
  Wrench,
  Plus,
  Printer,
  Trash2,
  Cpu,
  User,
  Smartphone,
  Laptop,
  Tv,
  CheckCircle,
  FileCheck,
  AlertCircle,
  TrendingUp,
  Clock,
  CheckSquare,
  Search
} from 'lucide-react';

interface MaintenanceScreenProps {
  shopId: string;
  currency: Currency;
  lang: Language;
  onRefreshStats: () => void;
  enableSounds: boolean;
  syncKey?: number;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({
  shopId,
  currency,
  lang,
  onRefreshStats,
  enableSounds,
  syncKey,
}) => {
  const t = TRANSLATIONS[lang];

  // Database lists
  const [jobs, setJobs] = useState<MaintenanceJob[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);

  // Search queue
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState<MaintenanceJob | null>(null);

  // Form states
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [devType, setDevType] = useState<'phone' | 'computer' | 'tablet' | 'other'>('phone');
  const [devModel, setDevModel] = useState('');
  const [serialOrImei, setSerialOrImei] = useState('');
  const [issueDesc, setIssueDesc] = useState('');
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [finalCost, setFinalCost] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [jobNotes, setJobNotes] = useState('');
  const [warrantyNote, setWarrantyNote] = useState('');

  // Parts allocation helper
  const [allocatedParts, setAllocatedParts] = useState<{ partId: string; quantity: number }[]>([]);

  useEffect(() => {
    setJobs(DzStoreDB.getMaintenanceJobs(shopId));
    setSpareParts(DzStoreDB.getSpareParts(shopId));
  }, [shopId, syncKey]);

  const handleSaveJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone || !devModel || !issueDesc) return;

    // Trial limits sanity check (caps at 14 jobs for trial or pending)
    const currentShop = DzStoreDB.getShops().find(s => s.id === shopId);
    const isTrial = currentShop && (currentShop.status === 'trial' || currentShop.status === 'pending');
    if (isTrial && !editingJob) {
      if (jobs.length >= 14) {
        alert(lang === 'ar'
          ? '⚠️ نسخة تجريبية! لقد بلغت الحد الأقصى لتذاكر الصيانة في النسخة التجريبية (14 تذاكر فقط).\nيرجى تفعيل حسابك من طرف صاحب البرنامج للحصول على تذاكر غير محدودة!'
          : '⚠️ Trial Version Limit! You can only register up to 14 maintenance tickets during the trial period.\nPlease contact the platform owner to activate your full store subscription!'
        );
        return;
      }
    }

    const currentJobs = [...jobs];

    // Compute parts billing value inside total
    let partsSum = 0;
    const partsUsedPayload = allocatedParts.map(alloc => {
      const sp = spareParts.find(p => p.id === alloc.partId);
      const cost = sp ? sp.sellingPrice * alloc.quantity : 0;
      partsSum += cost;
      return {
        partId: alloc.partId,
        name: sp ? sp.name : t.cancelled,
        quantity: alloc.quantity,
        cost,
      };
    });

    // Make final cost estimation
    const resolvedFinalCost = finalCost > 0 ? finalCost : (estimatedCost + partsSum);

    if (editingJob) {
      // Edit mode
      const idx = currentJobs.findIndex(j => j.id === editingJob.id);
      if (idx > -1) {
        currentJobs[idx] = {
          ...editingJob,
          customerName: custName,
          customerPhone: custPhone,
          deviceType: devType,
          deviceModel: devModel,
          serialOrImei: serialOrImei || undefined,
          issueDescription: issueDesc,
          estimatedCost,
          finalCost: resolvedFinalCost,
          amountPaid,
          partsUsed: partsUsedPayload,
          notes: jobNotes,
          receiptWarrantyNote: warrantyNote,
          updatedAt: new Date().toISOString(),
        };
      }
    } else {
      // Add mode
      const ticketNum = `TKT-2026-${String(Math.floor(Math.random() * 900) + 100)}`;
      const newJob: MaintenanceJob = {
        id: `m-${Date.now()}`,
        shopId,
        ticketNumber: ticketNum,
        customerName: custName,
        customerPhone: custPhone,
        deviceType: devType,
        deviceModel: devModel,
        serialOrImei: serialOrImei || undefined,
        issueDescription: issueDesc,
        status: 'pending',
        estimatedCost,
        finalCost: resolvedFinalCost,
        amountPaid,
        partsUsed: partsUsedPayload,
        notes: jobNotes,
        receiptWarrantyNote: warrantyNote,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      currentJobs.push(newJob);
    }

    // Decree allocated spare parts quantity from catalog stocks
    if (allocatedParts.length > 0) {
      const updatedSpareParts = [...spareParts];
      allocatedParts.forEach(alloc => {
        const item = updatedSpareParts.find(sp => sp.id === alloc.partId);
        if (item) {
          item.quantity = Math.max(0, item.quantity - alloc.quantity);
        }
      });
      DzStoreDB.saveSpareParts(shopId, updatedSpareParts);
      setSpareParts(updatedSpareParts);
    }

    DzStoreDB.saveMaintenanceJobs(shopId, currentJobs);
    setJobs(currentJobs);
    resetJobForm();
    onRefreshStats();
    DzStoreAudio.playSuccessChime(enableSounds);
  };

  const triggerWhatsAppAlert = (job: MaintenanceJob, customStatus?: MaintenanceJob['status']) => {
    const settings = DzStoreDB.getSettings(shopId, lang);
    let rawPhone = job.customerPhone.trim();
    let cleanPhone = rawPhone.replace(/\s+/g, '').replace(/[+\-]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '213' + cleanPhone.substring(1);
    }
    
    const targetStatus = customStatus || job.status;
    let messageTemplate = '';

    if (lang === 'ar') {
      switch (targetStatus) {
        case 'pending':
          messageTemplate = `السلام عليكم يا ${job.customerName}. تم استقبال جهازك [${job.deviceModel}] بنجاح في مركز صيانة ${settings.shopName}. سنقوم بفحصه وإعلامك قريباً بالتشخيص وعرض الأسعار.`;
          break;
        case 'repairing':
          messageTemplate = `السلام عليكم يا ${job.customerName}. نبشرك بأن جهازك [${job.deviceModel}] هو الآن قيد الصيانة والعمل الدقيق عليه في ورشة ${settings.shopName}.`;
          break;
        case 'ready_for_pickup':
          messageTemplate = `السلام عليكم يا ${job.customerName}، يسعدنا إعلامك بأن جهازك [${job.deviceModel}] قد تم صيانته بنجاح وهو جاهز للتسليم الآن في محل ${settings.shopName}! تكلفة الصيانة: ${job.finalCost || job.estimatedCost} د.ج. شكراً لثقتكم.`;
          break;
        case 'delivered':
          messageTemplate = `السلام عليكم يا ${job.customerName}. تم تسليم جهازك [${job.deviceModel}] لك بنجاح. تكلفة الصيانة الإجمالية: ${job.finalCost || job.estimatedCost} د.ج. شكراً لتعاملك مع محل ${settings.shopName}!`;
          break;
        case 'cancelled':
          messageTemplate = `السلام عليكم يا ${job.customerName}. نأسف لإعلامك بتعذر إصلاح جهازك [${job.deviceModel}] في ورشة ${settings.shopName}. يرجى المرور لاستلامه مجاناً في أي وقت.`;
          break;
        default:
          messageTemplate = `السلام عليكم يا ${job.customerName}. تفاصيل الصيانة لجهازك [${job.deviceModel}] تابعة لمحل ${settings.shopName}.`;
      }
    } else {
      switch (targetStatus) {
        case 'pending':
          messageTemplate = `Bonjour ${job.customerName}, votre appareil [${job.deviceModel}] a été enregistré avec succès pour réparation chez ${settings.shopName}.`;
          break;
        case 'repairing':
          messageTemplate = `Bonjour ${job.customerName}, votre appareil [${job.deviceModel}] est en cours de réparation chez ${settings.shopName}.`;
          break;
        case 'ready_for_pickup':
          messageTemplate = `Bonjour ${job.customerName}, nous vous informons que votre appareil [${job.deviceModel}] est réparé et prêt à être récupéré chez ${settings.shopName}. Coût final: ${job.finalCost || job.estimatedCost} DZD.`;
          break;
        case 'delivered':
          messageTemplate = `Bonjour ${job.customerName}, votre appareil [${job.deviceModel}] vous a été livré de chez ${settings.shopName}. Merci pour votre confiance !`;
          break;
        case 'cancelled':
          messageTemplate = `Bonjour ${job.customerName}, nous regrettons de vous informer que la réparation de votre appareil [${job.deviceModel}] n'a pas pu aboutir chez ${settings.shopName}. Vous pouvez le récupérer gratuitement.`;
          break;
        default:
          messageTemplate = `Bonjour ${job.customerName}, mise à jour réparation pour votre [${job.deviceModel}] chez ${settings.shopName}.`;
      }
    }

    const whatsAppLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messageTemplate)}`;
    window.open(whatsAppLink, '_blank');
  };

  const handleUpdateStatus = (jobId: string, nextStatus: MaintenanceJob['status']) => {
    const currentJobs = [...jobs];
    const idx = currentJobs.findIndex(j => j.id === jobId);
    if (idx > -1) {
      const job = currentJobs[idx];
      job.status = nextStatus;
      job.updatedAt = new Date().toISOString();
      DzStoreDB.saveMaintenanceJobs(shopId, currentJobs);
      setJobs(currentJobs);
      onRefreshStats();
      DzStoreAudio.playScanBeep(enableSounds);

      const confirmSend = confirm(lang === 'ar'
        ? `✓ تم تغيير حالة تذكرة الصيانة بنجاح إلى [${nextStatus === 'repairing' ? 'قيد التصليح' : nextStatus === 'ready_for_pickup' ? 'جاهز للاستلام' : nextStatus === 'delivered' ? 'تم التسليم' : nextStatus === 'cancelled' ? 'ملغى' : 'قيد الفحص'}]!\nهل ترغب في إرسال رسالة تذكير فورية للزبون عبر تطبيق واتساب؟`
        : `✓ Maintenance ticket updated to [${nextStatus}]!\nWould you like to open WhatsApp to send an alert to the customer?`
      );
      if (confirmSend) {
        triggerWhatsAppAlert(job, nextStatus);
      }
    }
  };

  const deleteJob = (jobId: string) => {
    if (!confirm(lang === 'ar' ? 'هل تود بالتأكيد حذف تذكرة الصيانة هذه؟' : 'Delete this maintenance ticket?')) return;
    const filtered = jobs.filter(j => j.id !== jobId);
    DzStoreDB.saveMaintenanceJobs(shopId, filtered);
    setJobs(filtered);
    onRefreshStats();
    DzStoreAudio.playWarningChime(enableSounds);
  };

  const openEditJob = (job: MaintenanceJob) => {
    setEditingJob(job);
    setCustName(job.customerName);
    setCustPhone(job.customerPhone);
    setDevType(job.deviceType);
    setDevModel(job.deviceModel);
    setSerialOrImei(job.serialOrImei || '');
    setIssueDesc(job.issueDescription);
    setEstimatedCost(job.estimatedCost);
    setFinalCost(job.finalCost);
    setAmountPaid(job.amountPaid);
    setJobNotes(job.notes || '');
    setWarrantyNote(job.receiptWarrantyNote || '');
    setAllocatedParts(job.partsUsed.map(p => ({ partId: p.partId, quantity: p.quantity })));
    setShowAddJobModal(true);
  };

  const resetJobForm = () => {
    setEditingJob(null);
    setCustName('');
    setCustPhone('');
    setDevType('phone');
    setDevModel('');
    setSerialOrImei('');
    setIssueDesc('');
    setEstimatedCost(0);
    setFinalCost(0);
    setAmountPaid(0);
    setJobNotes('');
    setWarrantyNote('');
    setAllocatedParts([]);
    setShowAddJobModal(false);
  };

  // Printing diagnostic ticket for intake signature
  const printClaimTicket = (job: MaintenanceJob) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const settings = DzStoreDB.getSettings(shopId, lang);
    const currentOrigin = window.location.origin;
    const trackingUrl = `${currentOrigin}/#ticket-${job.ticketNumber}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(trackingUrl)}&bgcolor=ffffff&color=202b3c`;

    printWindow.document.write(`
      <html>
        <head>
          <title>${job.ticketNumber}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 25px; direction: ${lang === 'ar' ? 'rtl' : 'ltr'}; }
            .ticket-card { border: 2px dashed #444; border-radius: 12px; padding: 20px; max-width: 500px; margin: auto; }
            .title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 5px; }
            .subtitle { text-align: center; font-size: 11px; color: #555; margin-bottom: 20px; }
            .grid-spec { display: grid; grid-template-cols: 1fr 1fr; gap: 10px; font-size: 13px; margin-bottom: 15px; }
            .row-elem { border-bottom: 1px dotted #ccc; padding-bottom: 4px; }
            .receipt-notes { background-color: #f9f9f9; padding: 10px; border-radius: 8px; font-size: 12px; margin-top: 15px; }
            .bar-line { display: flex; justify-content: center; margin-top: 15px; }
            .sign-pads { display: flex; justify-content: space-between; margin-top: 30px; font-size: 12px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="ticket-card">
            <div class="title">📋 ${settings.shopName}</div>
            <div class="subtitle">${lang === 'ar' ? 'وصــل استــلام صيانـة' : 'Hardware Maintenance Claim Receipt'}</div>

            <div class="grid-spec">
              <div class="row-elem"><strong>تذكرة #:</strong> ${job.ticketNumber}</div>
              <div class="row-elem"><strong>التاريخ:</strong> ${new Date(job.createdAt).toLocaleDateString()}</div>
              <div class="row-elem"><strong>الزبون:</strong> ${job.customerName}</div>
              <div class="row-elem"><strong>الهاتف:</strong> ${job.customerPhone}</div>
              <div class="row-elem"><strong>الجهاز:</strong> [${job.deviceType.toUpperCase()}] - ${job.deviceModel}</div>
              <div class="row-elem"><strong>الرقم التسلسلي:</strong> ${job.serialOrImei || 'N/A'}</div>
            </div>

            <div class="receipt-notes">
              <strong>🛠️ العطل المذكور:</strong><br/>
              ${job.issueDescription}
            </div>

            <div class="receipt-notes">
              <strong>💶 التكلفة المقدرة:</strong> ${job.estimatedCost.toLocaleString()} د.ج<br/>
              <strong>المدفوع مسبقاً (تسبيق):</strong> ${job.amountPaid.toLocaleString()} د.ج
            </div>

            <div style="text-align: center; margin: 20px 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <img src="${qrImageUrl}" alt="Tracking QR" style="border: 1px solid #ccc; padding: 4px; border-radius: 8px; width: 100px; height: 100px;" />
              <div style="font-size: 10px; color: #555; margin-top: 5px; font-weight: bold;">
                ${lang === 'ar' ? 'امسح الرمز لتتبع حالة الصيانة من هاتفك' : 'Scan to check Live Repair status'}
              </div>
            </div>

            <div class="sign-pads">
              <div>توقيع الزبون</div>
              <div>توقيع واستلام التقني</div>
            </div>

            <div class="subtitle" style="margin-top: 25px; border-top: 1px solid #ddd; padding-top: 10px;">
              ${settings.receiptFooter}
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredJobs = jobs.filter(
    j =>
      j.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.deviceModel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Upper header segment and search controller */}
      <div className="flex flex-col md:flex-row items-center justify-between pb-4 border-b border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2.5 rounded-2xl">
            <Wrench className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="text-start">
            <h2 className="text-xl font-bold text-gray-900">{t.maintenance}</h2>
            <p className="text-xs text-gray-400">
              {lang === 'ar' ? 'تشخيص وتتبع أعطال الهواتف والحواسب وطباعة وصول الاستلام' : 'Diagnose devices, map spent parts and print pick tags'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Searching queue input */}
          <div className="relative flex-1 md:w-48">
            <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" id="search_tech_icon" />
            <input
              type="text"
              placeholder={t.search}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50 focus:bg-white"
            />
          </div>

          <button
            onClick={() => {
              resetJobForm();
              setShowAddJobModal(true);
            }}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            {t.add_job}
          </button>
        </div>
      </div>

      {/* Grid of Maintenance Tickets pending repair status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredJobs.length === 0 ? (
          <div className="col-span-full py-16 bg-white border rounded-3xl text-center text-slate-400 text-xs">
            {t.no_results}
          </div>
        ) : (
          filteredJobs.map(job => {
            const hasPaidBalance = job.amountPaid > 0;
            const remainsBill = job.finalCost > 0 ? (job.finalCost - job.amountPaid) : (job.estimatedCost - job.amountPaid);

            return (
              <div
                key={job.id}
                className="bg-white dark:bg-slate-900 border border-slate-100 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Card head: ticket num & badge status toggle */}
                  <div className="flex justify-between items-start">
                    <div className="text-start">
                      <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border">
                        {job.ticketNumber}
                      </span>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
                        {job.deviceType === 'phone' ? (
                          <Smartphone className="w-4 h-4 text-sky-600" />
                        ) : job.deviceType === 'receiver' ? (
                          <Tv className="w-4 h-4 text-rose-500" />
                        ) : (
                          <Laptop className="w-4 h-4 text-emerald-600" />
                        )}
                        {job.deviceModel}
                      </h4>
                    </div>

                    {/* Step selection dropdown trigger */}
                    <select
                      value={job.status}
                      onChange={e => handleUpdateStatus(job.id, e.target.value as any)}
                      className={`text-[10px] font-black px-2 py-1 rounded-lg border focus:outline-none ${
                        job.status === 'pending'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : job.status === 'inspecting'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : job.status === 'repairing'
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : job.status === 'ready_for_pickup'
                          ? 'bg-teal-50 text-teal-800 border-teal-200'
                          : job.status === 'delivered'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      <option value="pending">{lang === 'ar' ? 'بانتظار الفحص' : 'Pending Diagnosis'}</option>
                      <option value="inspecting">{t.inspecting}</option>
                      <option value="repairing">{t.repairing}</option>
                      <option value="ready_for_pickup">{t.ready_for_pickup}</option>
                      <option value="delivered">{t.delivered}</option>
                      <option value="cancelled">{t.cancelled}</option>
                    </select>
                  </div>

                  {/* Problem & description */}
                  <div className="text-start text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3 my-3">
                    <p className="font-semibold text-slate-800 mb-1">🔧 {t.issue_desc}:</p>
                    <p className="line-clamp-2">{job.issueDescription}</p>
                  </div>

                  {/* Customer details info */}
                  <div className="flex justify-between text-[11px] text-slate-500 font-bold border-b border-dashed border-slate-100 pb-2">
                    <span className="flex items-center gap-1">👤 {job.customerName}</span>
                    <span className="font-mono">📱 {job.customerPhone}</span>
                  </div>

                  {/* Allocation parts list and bill estimation */}
                  {job.partsUsed.length > 0 && (
                    <div className="mt-2.5 text-start">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        🛠️ {lang === 'ar' ? 'القطع المركبة بالفاتورة' : 'Allocated Spare Parts'}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {job.partsUsed.map((p, idx) => (
                          <span
                            key={idx}
                            className="bg-blue-50 border border-blue-100 text-blue-800 text-[9px] font-semibold px-2 py-0.5 rounded-md"
                          >
                            {p.name} (×{p.quantity})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card footer details, totals & claim print button */}
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center bg-sky-50/20 -mx-5 -mb-5 p-4 rounded-b-3xl">
                  <div className="text-start">
                    <span className="text-[9px] text-slate-400 block uppercase font-bold font-mono tracking-wider">
                      {lang === 'ar' ? 'الحساب المالي (المتبقي)' : 'Balance Due'}
                    </span>
                    <span className="text-sm font-black text-slate-800">
                      {remainsBill.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                    </span>
                    {hasPaidBalance && (
                      <span className="block text-[8px] text-emerald-600 font-bold">
                        ({lang === 'ar' ? `تسبيق مقبوض: ${job.amountPaid}` : `Pre-paid: ${job.amountPaid}`})
                      </span>
                    )}
                  </div>

                  {/* Print and edit triggers */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => printClaimTicket(job)}
                      className="p-1 px-2.5 bg-white border hover:bg-slate-50 text-slate-700 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-transform"
                    >
                      <Printer className="w-3 text-sky-700" />
                      {t.print}
                    </button>
                    <button
                      onClick={() => openEditJob(job)}
                      className="p-2 bg-white border hover:bg-slate-50 text-slate-600 rounded-lg cursor-pointer"
                    >
                      ⚙️
                    </button>
                    <button
                      onClick={() => deleteJob(job.id)}
                      className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg cursor-pointer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DIALOG JOB MODAL ADD / EDIT TICKET */}
      {showAddJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[calc(100vh-2rem)] shadow-2xl overflow-hidden border border-slate-100 flex flex-col text-slate-800">
            <div className="bg-emerald-700 text-white p-4 flex justify-between items-center">
              <h3 className="font-extrabold text-base flex items-center gap-1.5">
                <Wrench className="w-5 h-5 text-emerald-200" />
                {editingJob ? (lang === 'ar' ? 'تعديل بيانات التذكرة' : 'Update Ticket Parameters') : t.add_job}
              </h3>
              <button onClick={resetJobForm} className="text-white hover:bg-emerald-800 p-1 rounded-full transition-colors">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveJob} className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-start">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'ar' ? 'اسم زبون الصيانة' : 'Customer Name'} *</label>
                  <input
                    type="text"
                    required
                    value={custName}
                    onChange={e => setCustName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.phone} *</label>
                  <input
                    type="text"
                    required
                    value={custPhone}
                    onChange={e => setCustPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.device_type}</label>
                  <select
                    value={devType}
                    onChange={e => setDevType(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50"
                  >
                    <option value="phone">{lang === 'ar' ? 'هاتف ذكي' : 'Phone'}</option>
                    <option value="computer">{lang === 'ar' ? 'حاسوب محمول/مكتبي' : 'Computer'}</option>
                    <option value="tablet">{lang === 'ar' ? 'لوحة إلكترونية' : 'Tablet'}</option>
                    <option value="receiver">{lang === 'ar' ? 'أجهزة الاستقبال والريسيفر' : 'Satellite Receiver'}</option>
                    <option value="other">{lang === 'ar' ? 'أجهزة أخرى' : 'Other'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.device_model} *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ThinkPad L14, iPhone 11"
                    value={devModel}
                    onChange={e => setDevModel(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'ar' ? 'الرقم التسلسلي أو كود IMEI للقطع المفقودة' : 'IMEI / Serial'}</label>
                  <input
                    type="text"
                    placeholder="e.g. S/N or IMEI code"
                    value={serialOrImei}
                    onChange={e => setSerialOrImei(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50"
                  />
                </div>
              </div>

              <div className="text-start">
                <label className="block text-xs font-bold text-gray-700 mb-1">{t.issue_desc} *</label>
                <textarea
                  required
                  placeholder="وصف المشكل بدقة لتسهيل التشخيص للمهندس والتقني..."
                  value={issueDesc}
                  onChange={e => setIssueDesc(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 h-16"
                />
              </div>

              {/* Spare parts allocation picker block */}
              <div className="border-t border-slate-100 pt-3 text-start">
                <label className="block text-xs font-bold text-indigo-700 mb-1 flex items-center gap-1">
                  <Cpu className="w-4 h-4" /> {t.parts_replaced} (مخزون قطع الصيانة)
                </label>
                <div className="flex flex-wrap gap-1.5 mt-2 max-h-16 overflow-y-auto">
                  {spareParts.map(part => {
                    const isAllocated = allocatedParts.some(a => a.partId === part.id);
                    return (
                      <button
                        type="button"
                        key={part.id}
                        onClick={() => {
                          if (isAllocated) {
                            setAllocatedParts(allocatedParts.filter(a => a.partId !== part.id));
                          } else {
                            if (part.quantity > 0) {
                              setAllocatedParts([...allocatedParts, { partId: part.id, quantity: 1 }]);
                            } else {
                              alert(lang === 'ar' ? 'هذه القطعة نفذت من المخزون!' : 'Out of stock!');
                            }
                          }
                        }}
                        className={`text-[9px] font-bold px-2 py-1 rounded-lg border transition-all ${
                          isAllocated
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        {part.name} ({part.sellingPrice.toLocaleString()} د.ج)
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Billing totals structure values */}
              <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-start font-sans">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'ar' ? 'سعر اليد العاملة' : 'Labor Cost'} *</label>
                  <input
                    type="number"
                    required
                    value={estimatedCost || ''}
                    onChange={e => setEstimatedCost(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border rounded-xl focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{lang === 'ar' ? 'التكلفة النهائية الإجمالية' : 'Final Total price'}</label>
                  <input
                    type="number"
                    placeholder="قطع + يد عاملة"
                    value={finalCost || ''}
                    onChange={e => setFinalCost(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{lang === 'ar' ? 'تسبيق (دفعة أولى)' : 'Downpayment value'}</label>
                  <input
                    type="number"
                    value={amountPaid || ''}
                    onChange={e => setAmountPaid(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border rounded-xl focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="text-start">
                <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'ar' ? 'شروط خاصة بقطع الصيانة أو الضمان للزبون' : 'Warranty details Note'}</label>
                <input
                  type="text"
                  placeholder="مثال: يمنح المحل ضماناً مدته 3 أشهر على جودة لاصق الشاشة."
                  value={warrantyNote}
                  onChange={e => setWarrantyNote(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50"
                />
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-100 flex gap-2 -mx-5 -mb-5">
                <button
                  type="button"
                  onClick={resetJobForm}
                  className="flex-1 text-sm bg-white border text-gray-700 py-2 rounded-xl"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
