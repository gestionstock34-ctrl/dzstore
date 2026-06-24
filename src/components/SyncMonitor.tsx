/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { subscribeToSyncQueue, processSyncQueue, SyncOperation } from '../lib/syncQueue';
import { Wifi, WifiOff, RotateCw, Database, AlertCircle, CheckCircle2, ChevronDown, Trash2 } from 'lucide-react';
import { DzStoreAudio } from './AudioAlerts';

interface SyncMonitorProps {
  lang: 'ar' | 'fr' | 'en';
}

export const SyncMonitor: React.FC<SyncMonitorProps> = ({ lang }) => {
  const [queue, setQueue] = useState<SyncOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isOpen, setIsOpen] = useState(false);

  // Auto monitor connection status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Subscribe to persistent SyncQueue state
  useEffect(() => {
    const unsubscribe = subscribeToSyncQueue((updatedQueue, syncing) => {
      setQueue(updatedQueue);
      setIsSyncing(syncing);
    });
    return unsubscribe;
  }, []);

  const handleForceSync = async () => {
    if (!isOnline) {
      alert(lang === 'ar' ? '⚠️ يتعذر بدء المزامنة لأن الجهاز غير متصل بالإنترنت حالياً!' : '⚠️ Sync aborted because your device is offline!');
      return;
    }
    setIsSyncing(true);
    const success = await processSyncQueue();
    setIsSyncing(false);
    
    // Play sweet success sound
    DzStoreAudio.playSuccessChime(true);
    
    if (success) {
      alert(lang === 'ar' ? '✓ تم إكمال مزامنة جميع العمليات المعلقة بنجاح!' : '✓ All pending local mutations synchronized successfully!');
    }
  };

  const getCollectionLabel = (path: string): string => {
    if (path.includes('/products')) return lang === 'ar' ? 'سلعة' : lang === 'fr' ? 'Produit' : 'Product';
    if (path.includes('/spare_parts')) return lang === 'ar' ? 'قطعة غيار' : lang === 'fr' ? 'Pièce détachée' : 'Spare Part';
    if (path.includes('/suppliers')) return lang === 'ar' ? 'مورد' : lang === 'fr' ? 'Fournisseur' : 'Supplier';
    if (path.includes('/customers')) return lang === 'ar' ? 'زبون' : lang === 'fr' ? 'Client' : 'Customer';
    if (path.includes('/maintenance')) return lang === 'ar' ? 'بطاقة صيانة' : lang === 'fr' ? 'Fiche maintenance' : 'Repair Job';
    if (path.includes('/sales')) return lang === 'ar' ? 'فاتورة بيع' : lang === 'fr' ? 'Vente/POS' : 'Invoice';
    if (path.includes('/settings')) return lang === 'ar' ? 'إعدادات المحل' : lang === 'fr' ? 'Paramètres' : 'Settings';
    if (path.includes('users')) return lang === 'ar' ? 'مستعمل' : lang === 'fr' ? 'Utilisateur' : 'User';
    return lang === 'ar' ? 'مستند' : 'Document';
  };

  return (
    <div className="relative select-none" id="sync_monitor_widget">
      {/* Trigger Button bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
          queue.length > 0
            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border-amber-500/30'
            : isOnline
            ? 'bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
            : 'bg-rose-500/5 hover:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
        }`}
      >
        {isOnline ? (
          <Wifi className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/20 shrink-0" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-rose-500 shrink-0 animate-pulse" />
        )}

        <span>
          {queue.length > 0
            ? (lang === 'ar' ? `${queue.length} مزامنة معلقة` : lang === 'fr' ? `${queue.length} en attente` : `${queue.length} pending`)
            : (isOnline ? (lang === 'ar' ? 'متصل' : 'Online') : (lang === 'ar' ? 'أوفلاين' : 'Offline'))
          }
        </span>

        {queue.length > 0 && (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
        )}
        <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div 
          className={`absolute mt-2 w-80 glass-panel bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-4 text-start font-sans ${
            lang === 'ar' ? 'left-0 md:right-0 md:left-auto origin-top-left' : 'right-0 origin-top-right'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-500" />
              <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                {lang === 'ar' ? 'مراقب مزامنة البيانات' : lang === 'fr' ? 'Moniteur de Sync' : 'Replication Monitor'}
              </h4>
            </div>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
              isOnline ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
            }`}>
              {isOnline ? (lang === 'ar' ? 'نشط ● متصل' : 'Connected') : (lang === 'ar' ? 'أوفلاين ● مستقل' : 'Offline Mode')}
            </span>
          </div>

          {/* Body stats */}
          <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
            {lang === 'ar' 
              ? 'يقوم النظام بحفظ كافة المبيعات والتغييرات محلياً في IndexedDB فوراً ثم يزامنها مع السيرفر السحابي فور توفر شبكة الإنترنت لضمان استقرار العمل.'
              : 'The system saves metadata locally to IndexedDB and executes transactional sync to Cloud Run when the internet becomes available.'}
          </p>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100/60 dark:border-slate-800">
              <span className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                {lang === 'ar' ? 'العمليات المحلية المعلقة:' : 'Queued Mutations:'}
              </span>
              <span className={`text-xs font-black ${queue.length > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                {queue.length}
              </span>
            </div>
          </div>

          {/* Pending items list */}
          {queue.length > 0 ? (
            <div className="mb-4">
              <h5 className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-2">
                {lang === 'ar' ? 'قائمة الانتظار (FIFO)' : 'Pending Operations Queue'}
              </h5>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 select-all font-mono text-[10px]">
                {queue.map((op) => (
                  <div 
                    key={op.id} 
                    className="flex items-center justify-between p-1.5 rounded-lg border border-slate-100/50 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900"
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className={`text-[9px] font-black px-1 rounded ${
                        op.type === 'delete' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {op.type === 'delete' ? 'DEL' : 'SET'}
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-350 truncate">
                        {getCollectionLabel(op.docPath)}
                      </span>
                    </div>
                    <span className="text-slate-450 text-[9px]">
                      {new Date(op.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                {lang === 'ar' ? '✓ كافة البيانات متصلة ومتزامنة بالكامل!' : '✓ Database fully synchronized!'}
              </p>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleForceSync}
              disabled={queue.length === 0 || isSyncing}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-transform cursor-pointer ${
                queue.length > 0 && isOnline && !isSyncing
                  ? 'bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800'
              }`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{lang === 'ar' ? 'مزامنة الآن' : 'Force Sync Now'}</span>
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="py-2 px-3 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
            >
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
