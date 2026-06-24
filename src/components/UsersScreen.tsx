/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Currency, Language, AppUser, UserRole } from '../types';
import { TRANSLATIONS } from '../lib/data';
import { DzStoreDB } from '../lib/db';
import { Users, Plus, Shield, CheckCircle, ShieldAlert, Trash2, Key, UserCheck, Activity, RefreshCw, Search } from 'lucide-react';

interface UsersScreenProps {
  shopId: string;
  lang: Language;
  onRefreshStats: () => void;
  enableSounds: boolean;
}

export const UsersScreen: React.FC<UsersScreenProps> = ({
  shopId,
  lang,
  onRefreshStats,
  enableSounds,
}) => {
  const t = TRANSLATIONS[lang];
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Load Audit logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logFilterAction, setLogFilterAction] = useState('all');

  const loadAuditLogs = () => {
    const logs = DzStoreDB.getAuditLogs(shopId);
    // Sort descending by timestamp or id
    const sortedLogs = [...logs].sort((a, b) => b.id.localeCompare(a.id));
    setAuditLogs(sortedLogs);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'delete_sale':
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
          label: lang === 'ar' ? 'حذف مبيعة' : 'Sale Deletion'
        };
      case 'refund_sale':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
          label: lang === 'ar' ? 'إرجاع سلع' : 'Refund Transaction'
        };
      case 'edit_price':
        return {
          bg: 'bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
          label: lang === 'ar' ? 'تعديل السعر' : 'Price Alteration'
        };
      case 'add_product':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
          label: lang === 'ar' ? 'إضافة منتج' : 'Inventory Creation'
        };
      case 'delete_product':
        return {
          bg: 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400',
          label: lang === 'ar' ? 'مسح منتج' : 'Product Deletion'
        };
      default:
        return {
          bg: 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
          label: action
        };
    }
  };

  // Form states
  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPhone, setUPhone] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uRole, setURole] = useState<UserRole>('cashier');
  const [canDeleteSales, setCanDeleteSales] = useState(false);
  const [canRefundSales, setCanRefundSales] = useState(false);
  const [canEditPrices, setCanEditPrices] = useState(false);
  const [canViewReports, setCanViewReports] = useState(false);
  const [errors, setErrors] = useState('');

  // Load shop users
  const loadUsersList = () => {
    const list = DzStoreDB.getUsers().filter(u => u.shopId === shopId);
    setUsersList(list);
  };

  useEffect(() => {
    loadUsersList();
    loadAuditLogs();
  }, [shopId]);

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors('');
    if (!uName || !uEmail || !uPhone || !uPassword) {
      setErrors(lang === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة!' : 'Please fill all required inputs!');
      return;
    }

    const allGlobalUsers = DzStoreDB.getUsers();
    // Check duplicates
    if (allGlobalUsers.some(u => u.email.toLowerCase() === uEmail.toLowerCase().trim())) {
      setErrors(lang === 'ar' ? 'هذا البريد الإلكتروني مستخدم بالفعل!' : 'Email already in use!');
      return;
    }

    const newUser: AppUser = {
      id: `u-created-${Date.now()}`,
      shopId,
      name: uName,
      email: uEmail,
      password: uPassword,
      phone: uPhone,
      role: uRole,
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0],
      permissions: uRole === 'owner' 
        ? ['pos', 'inventory', 'maintenance', 'suppliers', 'settings', 'reports', 'users']
        : uRole === 'technician' 
        ? ['maintenance'] 
        : ['pos'],
      canDeleteSales: uRole === 'owner' ? true : canDeleteSales,
      canRefundSales: uRole === 'owner' ? true : canRefundSales,
      canEditPrices: uRole === 'owner' ? true : canEditPrices,
      canViewReports: uRole === 'owner' ? true : canViewReports,
    };

    const updatedGlobal = [...allGlobalUsers, newUser];
    DzStoreDB.saveUsers(updatedGlobal);
    loadUsersList();
    setShowAddModal(false);
    resetForm();
    onRefreshStats();
  };

  const resetForm = () => {
    setUName('');
    setUEmail('');
    setUPhone('');
    setUPassword('');
    setURole('cashier');
    setCanDeleteSales(false);
    setCanRefundSales(false);
    setCanEditPrices(false);
    setCanViewReports(false);
    setErrors('');
  };

  const toggleUserStatus = (userId: string) => {
    const allGlobal = DzStoreDB.getUsers();
    const index = allGlobal.findIndex(u => u.id === userId);
    if (index > -1) {
      allGlobal[index].isActive = !allGlobal[index].isActive;
      DzStoreDB.saveUsers(allGlobal);
      loadUsersList();
    }
  };

  const deleteUser = (userId: string) => {
    // Prevent delete owner or admin accounts
    const allGlobal = DzStoreDB.getUsers();
    const userToDelete = allGlobal.find(u => u.id === userId);
    if (userToDelete?.role === 'owner') {
      alert(lang === 'ar' ? 'لا يمكن حذف حساب مالك المتجر الرئيسي!' : 'Cannot delete the primary owner account!');
      return;
    }

    if (confirm(lang === 'ar' ? 'هل تود بالتأكيد حذف هذا المستخدم التابع للمحل؟' : 'Are you sure you want to delete this user?')) {
      const updated = allGlobal.filter(u => u.id !== userId);
      DzStoreDB.saveUsers(updated);
      loadUsersList();
    }
  };

  return (
    <div className="space-y-6">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2.5 rounded-2xl">
            <Users className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="text-start">
            <h2 className="text-xl font-extrabold text-slate-900">
              {lang === 'ar' ? 'إدارة طاقم العمل والصلاحيات' : 'Staff Members & Roles'}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === 'ar' 
                ? 'إضافة حسابات خاصة بالبائع (الكاشير)، فني الصيانة وتتبع نشاطهم بالصلاحيات.'
                : 'Configure dedicated cashier and technician login PINs with permissions.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4" />
          {lang === 'ar' ? 'إضافة موظف جديد' : 'Add Staff Member'}
        </button>
      </div>

      {/* Staff lists card */}
      <div className="glass-panel rounded-3xl p-6 border border-white/45 text-start relative overflow-hidden">
        <h3 className="font-extrabold text-sm text-slate-800 mb-4 flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-emerald-600" />
          {lang === 'ar' ? 'حسابات المستخدمين النشطة في بوابتك' : 'Active User Terminals'}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase pb-2">
                <th className="py-2.5 text-start">{lang === 'ar' ? 'الاسم الكامل' : 'Full Name'}</th>
                <th className="py-2.5 text-start">{lang === 'ar' ? 'البريد الإلكتروني' : 'Email/Username'}</th>
                <th className="py-2.5 text-center">{lang === 'ar' ? 'الصفة / الدور' : 'Role Title'}</th>
                <th className="py-2.5 text-center">{lang === 'ar' ? 'الصلاحيات المخصصة' : 'Custom Rights'}</th>
                <th className="py-2.5 text-center">{lang === 'ar' ? 'رقم الهاتف' : 'Telephone'}</th>
                <th className="py-2.5 text-center">{lang === 'ar' ? 'كود الدخول PIN' : 'Security PIN'}</th>
                <th className="py-2.5 text-center">{lang === 'ar' ? 'الوضعية' : 'Status'}</th>
                <th className="py-2.5 text-right">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {usersList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400 font-semibold">
                    {lang === 'ar' ? 'لا يوجد مستخدمون إضافيون مسجلون.' : 'No additional staff configured yet.'}
                  </td>
                </tr>
              ) : (
                usersList.map(user => (
                  <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 font-semibold text-slate-900 text-start">{user.name}</td>
                    <td className="py-3 font-mono text-slate-600 text-start select-all">{user.email}</td>
                    <td className="py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                        user.role === 'owner' ? 'bg-amber-50 text-amber-800 border border-amber-200/50' :
                        user.role === 'technician' ? 'bg-indigo-50 text-indigo-800 border border-indigo-200/50' :
                        'bg-sky-50 text-sky-800 border border-sky-200/50'
                      }`}>
                        {user.role === 'owner' ? (lang === 'ar' ? 'صاحب المحل' : 'Store Owner') :
                         user.role === 'technician' ? (lang === 'ar' ? 'فني صيانة' : 'Technician') :
                         (lang === 'ar' ? 'بائع (كاشير)' : 'Cashier (Sales)')}
                      </span>
                    </td>
                    <td className="py-3 text-center text-[10px] font-mono font-semibold max-w-[150px] overflow-hidden truncate">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={user.canDeleteSales || user.role === 'owner' ? 'text-emerald-600' : 'text-slate-400 line-through'}>
                          {lang === 'ar' ? '✓ حذف مبيعات' : 'Delete Sales'}
                        </span>
                        <span className={user.canRefundSales || user.role === 'owner' ? 'text-emerald-600' : 'text-slate-400 line-through'}>
                          {lang === 'ar' ? '✓ إرجاع سلع' : 'Refund Sales'}
                        </span>
                        <span className={user.canEditPrices || user.role === 'owner' ? 'text-emerald-600' : 'text-slate-400 line-through'}>
                          {lang === 'ar' ? '✓ تعديل أسعار' : 'Edit Prices'}
                        </span>
                        <span className={user.canViewReports || user.role === 'owner' ? 'text-emerald-600' : 'text-slate-400 line-through'}>
                          {lang === 'ar' ? '✓ تقارير وأرباح' : 'View Reports'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-center font-mono text-slate-600">{user.phone}</td>
                    <td className="py-3 text-center font-mono bg-amber-500/5 font-black text-rose-700 px-1 py-0.5 rounded-lg border border-amber-500/10">
                      ••••
                    </td>
                    <td className="py-3 text-center">
                      <button
                        onClick={() => toggleUserStatus(user.id)}
                        className={`px-2 py-0.5 rounded text-[9px] font-extrabold cursor-pointer ${
                          user.isActive 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {user.isActive ? (lang === 'ar' ? '✓ نشط' : 'Active') : (lang === 'ar' ? '✕ معطل' : 'Disabled')}
                      </button>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => deleteUser(user.id)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 rounded-lg text-rose-600 cursor-pointer"
                        title={lang === 'ar' ? 'حذف الحساب' : 'Delete Member'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ROLING PERMISSIONS SUMMARY NOTES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-start">
        <div className="bg-sky-50/50 border border-sky-100 rounded-2xl p-4 text-xs leading-relaxed">
          <h4 className="font-extrabold text-sky-800 mb-1 flex items-center gap-1">
            <UserCheck className="w-4 h-4" />
            {lang === 'ar' ? 'صلاحيات البائع (الكاشير)' : 'Cashier Screen Scope'}
          </h4>
          <p className="text-slate-600">
            {lang === 'ar'
              ? '• صلاحية بيع الباركود الفوري وتوليد وصولات زبائن عاديين.'
              : '• Can process sales on POS, scan barcodes, and generate client bills.'}
          </p>
          <p className="text-slate-600 mt-1">
            {lang === 'ar'
              ? '• لا يمكنه الوصول للإعدادات، التقارير المالية، أو قوائم الدفع للموردين.'
              : '• Redirection rules keep them restricted from profit summaries and supplier cashflows.'}
          </p>
        </div>

        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 text-xs leading-relaxed">
          <h4 className="font-extrabold text-indigo-800 mb-1 flex items-center gap-1">
            <ShieldAlert className="w-4 h-4" />
            {lang === 'ar' ? 'صلاحيات فني صيانة المحل' : 'Technician Permissions Scope'}
          </h4>
          <p className="text-slate-600">
            {lang === 'ar'
              ? '• دخول منحصـر لورشة تصليح العتاد والهواتف وتعديل وضعية التذاكر.'
              : '• Exclusively handles device diagnostic tickets, states, and repair estimates.'}
          </p>
          <p className="text-slate-600 mt-1">
            {lang === 'ar'
              ? '• تستهلك القطع المستخدمة في الصيانة للزبون مباشرة من المخازن بالتحديث.'
              : '• Spent parts are deducted in real-time from the parent inventory index.'}
          </p>
        </div>

        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 text-xs leading-relaxed">
          <h4 className="font-extrabold text-amber-800 mb-1 flex items-center gap-1">
            <Shield className="w-4 h-4" />
            {lang === 'ar' ? 'تنـبـيـه حماية الصندوق والبيانات' : 'Security Best Practices'}
          </h4>
          <p className="text-slate-600">
            {lang === 'ar'
              ? '• لا تشارك أبداً الكود PIN المكون من 4 أرقام لمالك المتجر مع موظف آخر.'
              : '• Never share the owner PIN code to prevent unauthorized discount overrides.'}
          </p>
          <p className="text-slate-600 mt-1">
            {lang === 'ar'
              ? '• يمكن تعطيل أي مستخدم مؤقتاً بضغطة زر وتفعيل الحظر فوراً.'
              : '• Disable any compromised terminal account with an instant status toggle.'}
          </p>
        </div>
      </div>

      {/* AUDIT LOG CENTER FOR STORE OWNERS */}
      <div className="glass-panel rounded-3xl p-6 border border-white/45 text-start relative overflow-hidden mt-6 dark:bg-slate-900/40 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-rose-550/10 rounded-lg">
              <Activity className="w-5 h-5 text-rose-500 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">
                {lang === 'ar' ? 'سجل الرقابة الأمنية وعمليات الموظفين (Audit Logs)' : 'Live System Audit Trail & Logs'}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                {lang === 'ar' ? 'سجل معزز ومحمي بالكامل لتتبع وحماية الصندوق من السرقات والولوج غير المصرح به والتحقق من العمليات الحساسة.' : 'Immutable ledger tracking modifications, depletions, price overrides, and refunds.'}
              </p>
            </div>
          </div>

          <button
            onClick={loadAuditLogs}
            className="p-1.5 bg-slate-100 hover:bg-slate-205 text-slate-600 rounded-xl transition-all cursor-pointer border dark:bg-slate-850 dark:border-slate-800 dark:text-slate-300"
            title={lang === 'ar' ? 'تحديث السجل' : 'Reload Audit Logs'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Search and filters row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-450" />
            <input
              type="text"
              placeholder={lang === 'ar' ? 'ابحث باسم الموظف أو محتوى العملية...' : 'Query cashier name, actions, or details...'}
              value={logSearchQuery}
              onChange={e => setLogSearchQuery(e.target.value)}
              className="text-xs bg-white dark:bg-slate-850 dark:border-slate-800 dark:text-white w-full border border-slate-200 py-1.5 pl-8 pr-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <select
            value={logFilterAction}
            onChange={e => setLogFilterAction(e.target.value)}
            className="text-xs bg-white dark:bg-slate-850 dark:border-slate-800 dark:text-slate-300 border border-slate-200 py-1.5 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
          >
            <option value="all">{lang === 'ar' ? 'كل العمليات الحساسة' : 'Filter All Activities'}</option>
            <option value="delete_sale">{lang === 'ar' ? 'حذف الفواتير فقط' : 'Deletions Only'}</option>
            <option value="refund_sale">{lang === 'ar' ? 'إرجاع السلع فقط' : 'Refunds Only'}</option>
            <option value="edit_price">{lang === 'ar' ? 'تعديل الأسعار فقط' : 'Price Alterations'}</option>
            <option value="delete_product">{lang === 'ar' ? 'مسح بضاعة من المخازن' : 'Product Deletion'}</option>
          </select>
        </div>

        {/* Table list */}
        <div className="overflow-y-auto max-h-80 border border-slate-105 dark:border-slate-800 rounded-2xl">
          <table className="w-full text-xs text-left text-slate-500 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold uppercase text-[10px] text-slate-600 dark:text-slate-300 text-center">
              <tr>
                <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'التوقيت' : 'Timestamp'}</th>
                <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'المسؤول / الموظف' : 'Staff Member'}</th>
                <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'نوع العملية' : 'Trigger Action'}</th>
                <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'تفاصيل العملية الكاملة' : 'Immutable Details'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-center">
              {auditLogs
                .filter(log => {
                  const matchesQuery = 
                    (log.userName || '').toLowerCase().includes(logSearchQuery.toLowerCase()) || 
                    (log.details || '').toLowerCase().includes(logSearchQuery.toLowerCase());
                  
                  const matchesFilter = logFilterAction === 'all' || log.action === logFilterAction;
                  
                  return matchesQuery && matchesFilter;
                })
                .length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400 dark:text-slate-500 font-medium font-sans">
                    {lang === 'ar' ? '📪 لا توجد أي عمليات مسجلة تطابق فلترة البحث.' : 'No audit markers found in active ledger.'}
                  </td>
                </tr>
              ) : (
                auditLogs
                  .filter(log => {
                    const matchesQuery = 
                      (log.userName || '').toLowerCase().includes(logSearchQuery.toLowerCase()) || 
                      (log.details || '').toLowerCase().includes(logSearchQuery.toLowerCase());
                    
                    const matchesFilter = logFilterAction === 'all' || log.action === logFilterAction;
                    
                    return matchesQuery && matchesFilter;
                  })
                  .map(log => {
                    const badge = getActionBadge(log.action);
                    const dateStr = new Date(log.timestamp).toLocaleString(lang === 'ar' ? 'ar-DZ' : 'en-US');
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-2.5 text-slate-400 dark:text-slate-500 whitespace-nowrap text-start font-mono text-[10px]">{dateStr}</td>
                        <td className="px-4 py-2.5 text-slate-900 dark:text-slate-200 font-black whitespace-nowrap text-center">{log.userName}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-center">
                          <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 text-start leading-relaxed font-semibold">{log.details}</td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE STAFF MODAL OVERLAY */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative border border-slate-100">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="font-extrabold text-sm text-slate-800">
                👤 {lang === 'ar' ? 'تسجيل حساب مستخدم جديد' : 'New System User Enrollment'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 bg-slate-100 p-1 rounded-full text-xs"
              >
                ✕
              </button>
            </div>

            {errors && (
               <div className="mb-3 bg-rose-50 border border-rose-100 text-rose-700 p-2 text-xs rounded-xl text-start font-bold">
                 ⚡ {errors}
               </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 text-start text-xs font-sans">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{lang === 'ar' ? 'الاسم الكامل للموظف' : 'Full Name'} *</label>
                <input
                  type="text"
                  required
                  placeholder="بلال بائع"
                  value={uName}
                  onChange={e => setUName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border rounded-xl bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{lang === 'ar' ? 'البريد الإلكتروني للولوج' : 'Login Username / Email'} *</label>
                <input
                  type="email"
                  required
                  placeholder="bilal@gmail.com"
                  value={uEmail}
                  onChange={e => setUEmail(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border rounded-xl bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{lang === 'ar' ? 'رقم الهاتف' : 'Phone'} *</label>
                <input
                  type="text"
                  required
                  placeholder="0550112233"
                  value={uPhone}
                  onChange={e => setUPhone(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border rounded-xl bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{lang === 'ar' ? 'كلمة المرور PIN' : 'Access PinCode / Password'} *</label>
                <input
                  type="text"
                  required
                  placeholder="1234"
                  value={uPassword}
                  onChange={e => setUPassword(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border rounded-xl bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{lang === 'ar' ? 'مسؤولية وصلاحيات الموظف' : 'Assigned Title / Privilege'} *</label>
                <select
                  value={uRole}
                  onChange={e => setURole(e.target.value as UserRole)}
                  className="w-full text-xs px-3.5 py-2 border rounded-xl bg-slate-50 focus:bg-white"
                >
                  <option value="cashier">{lang === 'ar' ? 'بائع (كاشير) - بيع فقط' : 'Cashier (Terminal POS only)'}</option>
                  <option value="technician">{lang === 'ar' ? 'فني صيانة - ورشة الإصلاح فقط' : 'Hardware Tech (Repairs Workshop)'}</option>
                  <option value="owner">{lang === 'ar' ? 'شريك مالك (صلاحيات كاملة)' : 'Joint Partner Owner (Full Access)'}</option>
                </select>
              </div>

              {uRole !== 'owner' && (
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl space-y-2">
                  <span className="block font-bold text-slate-800 mb-1.5">{lang === 'ar' ? 'تخصيص الصلاحيات المتقدمة:' : 'Configure Custom Permissions:'}</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canDeleteSales}
                        onChange={e => setCanDeleteSales(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      {lang === 'ar' ? 'حذف الفواتير' : 'Delete Sales'}
                    </label>

                    <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canRefundSales}
                        onChange={e => setCanRefundSales(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      {lang === 'ar' ? 'إرجاع السلع' : 'Refund / Partial'}
                    </label>

                    <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canEditPrices}
                        onChange={e => setCanEditPrices(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      {lang === 'ar' ? 'تعديل الأسعار' : 'Edit Unit Prices'}
                    </label>

                    <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canViewReports}
                        onChange={e => setCanViewReports(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      {lang === 'ar' ? 'رؤية التقارير والربح' : 'View Core Profits'}
                    </label>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  ✓ {lang === 'ar' ? 'حفظ الحساب وتنشيطه' : 'Deploy Staff Terminal'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-2 px-4 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
