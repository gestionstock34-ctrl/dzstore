/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Currency, Language, Supplier, Customer, Product, SparePart } from '../types';
import { TRANSLATIONS } from '../lib/data';
import { DzStoreDB } from '../lib/db';
import { DzStoreAudio } from './AudioAlerts';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Phone,
  FileText,
  UserPlus,
  Award,
  BookOpen,
  Calendar,
  CheckCircle,
  Truck,
  History,
  TrendingDown,
  RotateCcw,
  Info
} from 'lucide-react';

interface SuppliersCustomersScreenProps {
  shopId: string;
  currency: Currency;
  lang: Language;
  onRefreshStats: () => void;
  enableSounds: boolean;
  syncKey?: number;
}

export const SuppliersCustomersScreen: React.FC<SuppliersCustomersScreenProps> = ({
  shopId,
  currency,
  lang,
  onRefreshStats,
  enableSounds,
  syncKey,
}) => {
  const t = TRANSLATIONS[lang];

  // Tab state: 'suppliers' | 'customers'
  const [activeTab, setActiveTab] = useState<'suppliers' | 'customers'>('suppliers');

  // Supplier filter: 'all' | 'phones_accessories' | 'spare_parts'
  const [supplierTypeFilter, setSupplierTypeFilter] = useState<'all' | 'phones_accessories' | 'spare_parts'>('all');

  // Database resources
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [parts, setSpareParts] = useState<SparePart[]>([]);

  // Detailed Wholesaler/Supplier Profiler Hooks
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [supplierDetailTab, setSupplierDetailTab] = useState<'payments' | 'goods' | 'returns'>('payments');
  
  // Return forms states
  const [returnItemKey, setReturnItemKey] = useState(''); // "product:id" or "part:id"
  const [returnQty, setReturnQty] = useState(1);
  const [returnActionType, setReturnActionType] = useState<'deduct_credit' | 'cash'>('deduct_credit');

  // Modals controllers
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Settle supplier debt dialog
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [paymentNote, setPaymentNote] = useState('');

  // Settle customer debt dialog
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const [customerPaidAmount, setCustomerPaidAmount] = useState(0);

  // Supplier Form state elements
  const [supName, setSupName] = useState('');
  const [supType, setSupType] = useState<'phones_accessories' | 'spare_parts'>('phones_accessories');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supInitialDue, setSupInitialDue] = useState(0);

  // Customer Form state elements
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custAddress, setCustAddress] = useState('');

  // Initial load/sync
  useEffect(() => {
    setSuppliers(DzStoreDB.getSuppliers(shopId));
    setCustomers(DzStoreDB.getCustomers(shopId));
    setProducts(DzStoreDB.getProducts(shopId));
    setSpareParts(DzStoreDB.getSpareParts(shopId));
  }, [shopId, syncKey]);

  // SUPPLIERS CRUDS
  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName || !supPhone) return;

    const currentSuppliers = [...suppliers];

    if (editingSupplier) {
      const idx = currentSuppliers.findIndex(s => s.id === editingSupplier.id);
      if (idx > -1) {
        currentSuppliers[idx] = {
          ...editingSupplier,
          name: supName,
          type: supType,
          phone: supPhone,
          email: supEmail || undefined,
          address: supAddress || undefined,
        };
      }
    } else {
      const newSupplier: Supplier = {
        id: `sup-${Date.now()}`,
        shopId,
        name: supName,
        type: supType,
        phone: supPhone,
        email: supEmail || undefined,
        address: supAddress || undefined,
        totalDue: supInitialDue,
        totalPaid: 0,
        paymentHistory: [],
        createdAt: new Date().toISOString().split('T')[0],
      };
      currentSuppliers.push(newSupplier);
    }

    DzStoreDB.saveSuppliers(shopId, currentSuppliers);
    setSuppliers(currentSuppliers);
    resetSupplierForm();
    DzStoreAudio.playSuccessChime(enableSounds);
  };

  const deleteSupplier = (sId: string) => {
    if (!confirm(lang === 'ar' ? 'هل تريد حذف هذا المورد؟' : 'Delete this supplier profile?')) return;
    const filtered = suppliers.filter(s => s.id !== sId);
    DzStoreDB.saveSuppliers(shopId, filtered);
    setSuppliers(filtered);
    DzStoreAudio.playWarningChime(enableSounds);
  };

  const openEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setSupName(sup.name);
    setSupType(sup.type);
    setSupPhone(sup.phone);
    setSupEmail(sup.email || '');
    setSupAddress(sup.address || '');
    setSupInitialDue(sup.totalDue);
    setShowSupplierModal(true);
  };

  const resetSupplierForm = () => {
    setEditingSupplier(null);
    setSupName('');
    setSupType('phones_accessories');
    setSupPhone('');
    setSupEmail('');
    setSupAddress('');
    setSupInitialDue(0);
    setShowSupplierModal(false);
  };

  const handlePaySupplierDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier || payAmount <= 0) return;

    const currentSuppliers = [...suppliers];
    const idx = currentSuppliers.findIndex(s => s.id === payingSupplier.id);
    if (idx > -1) {
      const sup = currentSuppliers[idx];
      sup.totalDue = Math.max(0, sup.totalDue - payAmount);
      sup.totalPaid += payAmount;
      sup.paymentHistory.push({
        amount: payAmount,
        date: new Date().toISOString().split('T')[0],
        note: paymentNote || 'Direct supplier payout installment',
      });

      DzStoreDB.saveSuppliers(shopId, currentSuppliers);
      setSuppliers(currentSuppliers);
      setPayingSupplier(null);
      setPayAmount(0);
      setPaymentNote('');
      onRefreshStats();
      DzStoreAudio.playSuccessChime(enableSounds);
    }
  };

  const handleReturnToSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingSupplier || !returnItemKey || returnQty <= 0) return;

    const [type, id] = returnItemKey.split(':');
    let itemName = '';
    let refundVal = 0;

    const currentSuppliers = [...suppliers];
    const supIdx = currentSuppliers.findIndex(s => s.id === viewingSupplier.id);
    if (supIdx === -1) return;
    const supObj = currentSuppliers[supIdx];

    if (type === 'product') {
      const currentProducts = [...products];
      const prodIdx = currentProducts.findIndex(p => p.id === id);
      if (prodIdx > -1) {
        const prod = currentProducts[prodIdx];
        if (prod.quantity < returnQty) {
          alert(lang === 'ar' ? '⚠️ الكمية المرجعة أكبر من المخزون المتوفر لهذا المنتج!' : '⚠️ Returned quantity exceeds currently available stock for this product!');
          return;
        }
        prod.quantity -= returnQty;
        itemName = prod.name;
        refundVal = returnQty * prod.purchasePrice;

        if (returnActionType === 'deduct_credit') {
          supObj.totalDue = Math.max(0, supObj.totalDue - refundVal);
        }

        if (!supObj.returnHistory) supObj.returnHistory = [];
        supObj.returnHistory.push({
          id: `ret-${Date.now()}`,
          itemName,
          itemType: 'product',
          quantity: returnQty,
          refundAmount: refundVal,
          date: new Date().toISOString().split('T')[0],
        });

        DzStoreDB.saveProducts(shopId, currentProducts);
        setProducts(currentProducts);
      }
    } else if (type === 'part') {
      const currentParts = [...parts];
      const partIdx = currentParts.findIndex(p => p.id === id);
      if (partIdx > -1) {
        const part = currentParts[partIdx];
        if (part.quantity < returnQty) {
          alert(lang === 'ar' ? '⚠️ الكمية المرجعة أكبر من المخزون المتوفر لقطعة الغيار!' : '⚠️ Returned quantity exceeds currently available stock for this spare part!');
          return;
        }
        part.quantity -= returnQty;
        itemName = part.name;
        refundVal = returnQty * part.purchasePrice;

        if (returnActionType === 'deduct_credit') {
          supObj.totalDue = Math.max(0, supObj.totalDue - refundVal);
        }

        if (!supObj.returnHistory) supObj.returnHistory = [];
        supObj.returnHistory.push({
          id: `ret-${Date.now()}`,
          itemName,
          itemType: 'part',
          quantity: returnQty,
          refundAmount: refundVal,
          date: new Date().toISOString().split('T')[0],
        });

        DzStoreDB.saveSpareParts(shopId, currentParts);
        setSpareParts(currentParts);
      }
    }

    DzStoreDB.saveSuppliers(shopId, currentSuppliers);
    setSuppliers(currentSuppliers);
    setViewingSupplier({ ...supObj });
    setReturnItemKey('');
    setReturnQty(1);
    onRefreshStats();
    DzStoreAudio.playSuccessChime(enableSounds);
  };

  // CUSTOMERS CRUDS
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone) return;

    const currentCustomers = [...customers];

    if (editingCustomer) {
      const idx = currentCustomers.findIndex(c => c.id === editingCustomer.id);
      if (idx > -1) {
        currentCustomers[idx] = {
          ...editingCustomer,
          name: custName,
          phone: custPhone,
          email: custEmail || undefined,
          address: custAddress || undefined,
        };
      }
    } else {
      const newCustomer: Customer = {
        id: `c-${Date.now()}`,
        shopId,
        name: custName,
        phone: custPhone,
        email: custEmail || undefined,
        address: custAddress || undefined,
        totalDebt: 0,
        installments: [],
        createdAt: new Date().toISOString().split('T')[0],
      };
      currentCustomers.push(newCustomer);
    }

    DzStoreDB.saveCustomers(shopId, currentCustomers);
    setCustomers(currentCustomers);
    resetCustomerForm();
    DzStoreAudio.playSuccessChime(enableSounds);
  };

  const deleteCustomer = (cId: string) => {
    if (!confirm(lang === 'ar' ? 'هل تريد بالتأكيد حذف حساب العميل؟' : 'Remove this customer account?')) return;
    const filtered = customers.filter(c => c.id !== cId);
    DzStoreDB.saveCustomers(shopId, filtered);
    setCustomers(filtered);
    DzStoreAudio.playWarningChime(enableSounds);
  };

  const openEditCustomer = (cust: Customer) => {
    setEditingCustomer(cust);
    setCustName(cust.name);
    setCustPhone(cust.phone);
    setCustEmail(cust.email || '');
    setCustAddress(cust.address || '');
    setShowCustomerModal(true);
  };

  const resetCustomerForm = () => {
    setEditingCustomer(null);
    setCustName('');
    setCustPhone('');
    setCustEmail('');
    setCustAddress('');
    setShowCustomerModal(false);
  };

  const handleSettleCustomerDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCustomer || customerPaidAmount <= 0) return;

    const currentCustomers = [...customers];
    const idx = currentCustomers.findIndex(c => c.id === payingCustomer.id);
    if (idx > -1) {
      const cust = currentCustomers[idx];
      let amountLeftToApply = customerPaidAmount;

      // Apply payout systematically to outstanding installments
      const updatedInstallments = cust.installments.map(inst => {
        if (inst.status !== 'paid' && amountLeftToApply > 0) {
          const installmentRemaining = inst.totalAmount - inst.paidAmount;
          const apply = Math.min(amountLeftToApply, installmentRemaining);
          inst.paidAmount += apply;
          amountLeftToApply -= apply;

          inst.paidHistory.push({
            amount: apply,
            date: new Date().toISOString().split('T')[0],
          });

          if (inst.paidAmount >= inst.totalAmount) {
            inst.status = 'paid' as const;
          }
        }
        return inst;
      });

      cust.installments = updatedInstallments;
      cust.totalDebt = Math.max(0, cust.totalDebt - customerPaidAmount);

      DzStoreDB.saveCustomers(shopId, currentCustomers);
      setCustomers(currentCustomers);
      setPayingCustomer(null);
      setCustomerPaidAmount(0);
      onRefreshStats();
      DzStoreAudio.playSuccessChime(enableSounds);
    }
  };

  const handleShareDebt = (cust: Customer, platform: 'whatsapp' | 'viber') => {
    const textAr = `📊 كشف حساب الديون (الكريدي) من متين متجرنا 🛍️
الزبون المحترم: ${cust.name}
إجمالي الديون المتبقية المترتبة عليكم: ${cust.totalDebt.toLocaleString()} ${currency === 'DZD' ? 'د.ج' : '€'}
${cust.installments.filter(i => i.status !== 'paid').length > 0 ? `الأقساط المتبقية: ${cust.installments.filter(i => i.status !== 'paid').length} أقساط.` : ''}

يرجى تسديد المبلغ المترتب عليكم في أقرب فرصة. شكراً جزيلاً لتعاملكم الراقي وثقتكم المتبادلة! 🤝`;

    const textFr = `📊 Relevé de compte Crédit client 🛍️
Client : ${cust.name}
Total dette restante à régler : ${cust.totalDebt.toLocaleString()} ${currency === 'DZD' ? 'DZD' : '€'}
${cust.installments.filter(i => i.status !== 'paid').length > 0 ? `Traites actives : ${cust.installments.filter(i => i.status !== 'paid').length} échéance(s).` : ''}

Nous vous prions de régulariser votre solde dès que possible. Merci pour votre fidélité et votre confiance ! 🤝`;

    const message = lang === 'ar' ? textAr : textFr;
    const cleanPhone = cust.phone.replace(/[+\s-]/g, '');

    if (platform === 'whatsapp') {
      const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    } else {
      // Viber share link logic
      const url = `viber://forward?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }
  };

  // Searching filter matching
  const filteredSuppliers = suppliers.filter(
    s =>
      supplierTypeFilter === 'all' || s.type === supplierTypeFilter
  );

  return (
    <div className="space-y-6">
      {/* Upper Navigation Tabs and page title */}
      <div className="flex flex-col sm:flex-row justify-between items-center pb-4 border-b border-gray-100 gap-4">
        <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`flex-1 sm:flex-initial px-6 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'suppliers' ? 'bg-white shadow-xs text-slate-800' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Truck className="w-4 h-4 text-sky-600" />
            {lang === 'ar' ? 'إدارة الموردين' : 'Supplier Accounts'}
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex-1 sm:flex-initial px-6 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'customers' ? 'bg-white shadow-xs text-slate-800' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-600" />
            {lang === 'ar' ? 'العملاء والديون' : 'Customers Directory'}
          </button>
        </div>

        {/* Dynamic add entity button based on active layout */}
        {activeTab === 'suppliers' ? (
          <button
            onClick={() => {
              resetSupplierForm();
              setShowSupplierModal(true);
            }}
            className="text-xs bg-sky-700 hover:bg-sky-800 text-white font-extrabold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            {t.add_supplier}
          </button>
        ) : (
          <button
            onClick={() => {
              resetCustomerForm();
              setShowCustomerModal(true);
            }}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <UserPlus className="w-4 h-4" />
            {t.add_customer}
          </button>
        )}
      </div>

      {activeTab === 'suppliers' ? (
        /* ======================== TAB PANEL 1: SUPPLIERS CATALOG ======================== */
        <div className="space-y-4">
          {/* Wholesaler filter header segments */}
          <div className="flex bg-slate-50 border rounded-2xl p-1 justify-start gap-1 w-fit max-w-full">
            <button
              onClick={() => setSupplierTypeFilter('all')}
              className={`px-3 py-1 text-[10px] uppercase font-bold rounded-lg transition-colors cursor-pointer ${
                supplierTypeFilter === 'all' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
              }`}
            >
              {lang === 'ar' ? 'الكل' : 'All Wholesale'}
            </button>
            <button
              onClick={() => setSupplierTypeFilter('phones_accessories')}
              className={`px-3 py-1 text-[10px] uppercase font-bold rounded-lg transition-colors cursor-pointer ${
                supplierTypeFilter === 'phones_accessories' ? 'bg-white shadow-xs text-slate-900 font-semibold' : 'text-slate-500'
              }`}
            >
              {t.phone_accessory_supplier}
            </button>
            <button
              onClick={() => setSupplierTypeFilter('spare_parts')}
              className={`px-3 py-1 text-[10px] uppercase font-bold rounded-lg transition-colors cursor-pointer ${
                supplierTypeFilter === 'spare_parts' ? 'bg-white shadow-xs text-slate-900 font-semibold' : 'text-slate-500'
              }`}
            >
              {t.spare_parts_supplier}
            </button>
          </div>

          {/* Suppliers Table Panel Grid */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-slate-600">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-start">{lang === 'ar' ? 'الاسم والشركة' : 'Business Name'}</th>
                    <th className="px-4 py-3 text-start">{t.type}</th>
                    <th className="px-4 py-3 text-start">{t.phone}</th>
                    <th className="px-4 py-3 text-end">{lang === 'ar' ? 'ديوننا له (متبقي)' : 'Our Due Credit'}</th>
                    <th className="px-4 py-3 text-end">{lang === 'ar' ? 'المدفوع الإجمالي' : 'Total Paid'}</th>
                    <th className="px-4 py-3 text-center">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                        {t.no_results}
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map(sup => (
                      <tr key={sup.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-start">
                          <div className="font-extrabold text-slate-950">{sup.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{sup.address || 'Algeria'}</div>
                        </td>
                        <td className="px-4 py-3 text-start">
                          <span
                            className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md ${
                              sup.type === 'phones_accessories'
                                ? 'bg-sky-50 text-sky-800 border border-sky-100/30'
                                : 'bg-purple-50 text-purple-800 border border-purple-100/30'
                            }`}
                          >
                            {sup.type === 'phones_accessories' ? t.phone_accessory_supplier : t.spare_parts_supplier}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-start font-mono text-xs">{sup.phone}</td>
                        <td className="px-4 py-3 text-end font-mono font-bold text-rose-600">
                          {sup.totalDue.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                        </td>
                        <td className="px-4 py-3 text-end font-mono text-slate-500 text-xs">
                          {sup.totalPaid.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center items-center gap-1.5">
                            {/* open rich statement / reports panel */}
                            <button
                              onClick={() => {
                                setViewingSupplier(sup);
                                setSupplierDetailTab('payments');
                              }}
                              className="p-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-extrabold rounded-lg transition-transform cursor-pointer"
                              title={lang === 'ar' ? 'عرض كشف الحساب بالتفصيل والتقارير' : 'View Rich Supplier Statement'}
                            >
                              📊 {lang === 'ar' ? 'كشف الحساب' : 'Statement'}
                            </button>

                            {/* pay installments to supplier dues */}
                            {sup.totalDue > 0 && (
                              <button
                                onClick={() => {
                                  setPayingSupplier(sup);
                                  setPayAmount(Math.min(50000, sup.totalDue));
                                }}
                                className="p-1 px-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-[10px] font-extrabold rounded-lg transition-transform cursor-pointer"
                                title={t.add_debt}
                              >
                                {lang === 'ar' ? 'دفع جزء' : 'Pay Off'}
                              </button>
                            )}
                            <button
                              onClick={() => openEditSupplier(sup)}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteSupplier(sup.id)}
                              className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ======================== TAB PANEL 2: CUSTOMERS REGISTER ======================== */
        <div className="bg-white dark:bg-slate-900 border border-slate-100 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-600">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-start">{lang === 'ar' ? 'الاسم والهاتف' : 'Customer Info'}</th>
                  <th className="px-4 py-3 text-start">{t.address}</th>
                  <th className="px-4 py-3 text-center">{lang === 'ar' ? 'الأقساط القائمة' : 'Active Installments'}</th>
                  <th className="px-4 py-3 text-end">{lang === 'ar' ? 'الديون المتبقية' : 'Debts Balance'}</th>
                  <th className="px-4 py-3 text-center">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 text-xs">
                      {t.no_results}
                    </td>
                  </tr>
                ) : (
                  customers.map(cust => (
                    <tr key={cust.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-start">
                        <div className="font-extrabold text-slate-950">{cust.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">📱 {cust.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-start text-xs font-semibold text-slate-500">
                        {cust.address || 'Algiers, Algeria'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-slate-100 text-slate-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                          {cust.installments.filter(i => i.status !== 'paid').length} {lang === 'ar' ? 'قسط نشط' : 'active'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end font-mono font-black text-rose-500">
                        {cust.totalDebt.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center items-center gap-1.5">
                          {cust.totalDebt > 0 && (
                            <>
                              <button
                                onClick={() => {
                                  setPayingCustomer(cust);
                                  setCustomerPaidAmount(cust.totalDebt);
                                }}
                                className="p-1 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-extrabold rounded-lg transition-transform cursor-pointer"
                              >
                                🪙 {lang === 'ar' ? 'سداد الكريدي' : 'Settle'}
                              </button>
                              <button
                                onClick={() => handleShareDebt(cust, 'whatsapp')}
                                className="p-1 px-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-[10px] font-bold cursor-pointer"
                                title={lang === 'ar' ? 'إرسال تذكير واتساب' : 'WhatsApp'}
                              >
                                🟢 WA
                              </button>
                              <button
                                onClick={() => handleShareDebt(cust, 'viber')}
                                className="p-1 px-1.5 bg-purple-50 text-purple-650 hover:bg-purple-100 rounded-lg text-[10px] font-bold cursor-pointer"
                                title={lang === 'ar' ? 'إرسال تذكير فايبر' : 'Viber'}
                              >
                                🟣 VB
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openEditCustomer(cust)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteCustomer(cust.id)}
                            className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT SUPPLIER INVENTORY WHOLESALER */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[calc(100vh-2rem)] shadow-2xl overflow-hidden border border-slate-100 flex flex-col text-slate-800">
            <div className="bg-sky-700 text-white p-4 flex justify-between items-center">
              <h3 className="font-extrabold text-base flex items-center gap-1.5">
                <Truck className="w-5 h-5 text-sky-200" />
                {editingSupplier ? (lang === 'ar' ? 'تعديل بيانات المورد' : 'Modify Supplier Portal') : t.add_supplier}
              </h3>
              <button onClick={resetSupplierForm} className="text-white hover:bg-sky-800 p-1 rounded-full transition-colors">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'ar' ? 'اسم المورد / الشركة' : 'Supplier Business Name'} *</label>
                <input
                  type="text"
                  required
                  placeholder="Dz Comm Wholesale, Belcourt Repair Parts..."
                  value={supName}
                  onChange={e => setSupName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t.type} *</label>
                <select
                  value={supType}
                  onChange={e => setSupType(e.target.value as any)}
                  className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none bg-slate-50"
                >
                  <option value="phones_accessories">{t.phone_accessory_supplier}</option>
                  <option value="spare_parts">{t.spare_parts_supplier}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.phone} *</label>
                  <input
                    type="text"
                    required
                    value={supPhone}
                    onChange={e => setSupPhone(e.target.value)}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.email}</label>
                  <input
                    type="email"
                    value={supEmail}
                    onChange={e => setSupEmail(e.target.value)}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t.address}</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={e => setSupAddress(e.target.value)}
                  className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none bg-slate-50"
                />
              </div>

              {!editingSupplier && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    💰 {lang === 'ar' ? 'كريدي متبقي أولي علينا له (د.ج)' : 'Initial Balance due to this supplier'}
                  </label>
                  <input
                    type="number"
                    value={supInitialDue || ''}
                    onChange={e => setSupInitialDue(Number(e.target.value))}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none bg-slate-50"
                  />
                </div>
              )}

              <div className="bg-slate-50 p-4 border-t border-slate-100 flex gap-2 -mx-5 -mb-5">
                <button
                  type="button"
                  onClick={resetSupplierForm}
                  className="flex-1 text-sm bg-white border text-gray-700 py-2 rounded-xl"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 text-sm bg-sky-700 hover:bg-sky-800 text-white font-bold py-2 rounded-xl"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT CUSTOMER */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[calc(100vh-2rem)] shadow-2xl overflow-hidden border border-slate-100 flex flex-col text-slate-800">
            <div className="bg-emerald-700 text-white p-4 flex justify-between items-center">
              <h3 className="font-extrabold text-base flex items-center gap-1.5">
                <Users className="w-5 h-5 text-emerald-200" />
                {editingCustomer ? (lang === 'ar' ? 'تعديل بيانات العميل' : 'Modify Customer Profile') : t.add_customer}
              </h3>
              <button onClick={resetCustomerForm} className="text-white hover:bg-emerald-800 p-1 rounded-full transition-colors">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'ar' ? 'اسم العميل ثلاثي' : 'Customer Name'} *</label>
                <input
                  type="text"
                  required
                  placeholder="Kamel Benzahra, Sofiane, etc..."
                  value={custName}
                  onChange={e => setCustName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t.phone} *</label>
                <input
                  type="text"
                  required
                  placeholder="05 / 06 / 07 ..."
                  value={custPhone}
                  onChange={e => setCustPhone(e.target.value)}
                  className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t.email}</label>
                <input
                  type="email"
                  value={custEmail}
                  onChange={e => setCustEmail(e.target.value)}
                  className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t.address}</label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={e => setCustAddress(e.target.value)}
                  className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none bg-slate-50"
                />
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-100 flex gap-2 -mx-5 -mb-5">
                <button
                  type="button"
                  onClick={resetCustomerForm}
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

      {/* DIALOG 3: PAY SUPPLIER PORTION DEBT */}
      {payingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm max-h-[calc(100vh-2rem)] shadow-2xl overflow-hidden border border-slate-100 flex flex-col text-slate-800">
            <div className="bg-sky-700 text-white p-4">
              <h4 className="font-extrabold text-sm">{lang === 'ar' ? 'سداد دفعة للمورد' : 'Pay Off Wholesaler'}</h4>
              <p className="text-[10px] text-sky-200 mt-1">{payingSupplier.name}</p>
            </div>

            <form onSubmit={handlePaySupplierDebt} className="p-5 space-y-4 text-start flex-1 overflow-y-auto">
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200/40 text-xs text-amber-800">
                {lang === 'ar' ? 'الكريدي المتبقي الحالي:' : 'Total due remains:'}{' '}
                <strong className="font-mono">{payingSupplier.totalDue.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}</strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{lang === 'ar' ? 'المبلغ المسدد الآن' : 'Amount to pay now'} *</label>
                <input
                  type="number"
                  required
                  max={payingSupplier.totalDue}
                  value={payAmount || ''}
                  onChange={e => setPayAmount(Number(e.target.value))}
                  className="w-full text-base font-bold text-emerald-700 px-3 py-2 border rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{lang === 'ar' ? 'ملاحظة (رقم الوصل أو شيك)' : 'Receipt ref notes'}</label>
                <input
                  type="text"
                  placeholder="مثال: تحويل بريدي موب، شيك بنكي"
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingSupplier(null)}
                  className="flex-1 text-sm bg-white border py-2 rounded-xl text-slate-700"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 text-sm bg-sky-700 hover:bg-sky-800 text-white font-bold py-2 rounded-xl"
                >
                  {lang === 'ar' ? 'تأكيد الـدفع' : 'Submit Pay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG 4: DEFT SETTLEMENT FOR CUSTOMER DEBT */}
      {payingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm max-h-[calc(100vh-2rem)] shadow-2xl overflow-hidden border border-slate-100 flex flex-col text-slate-800">
            <div className="bg-emerald-700 text-white p-4">
              <h4 className="font-extrabold text-sm">{lang === 'ar' ? 'تحصيل قسط مالي من العميل' : 'Settle Customer Installment'}</h4>
              <p className="text-[10px] text-emerald-200 mt-1">{payingCustomer.name}</p>
            </div>

            <form onSubmit={handleSettleCustomerDebt} className="p-5 space-y-4 text-start flex-1 overflow-y-auto">
              <div className="bg-rose-50 p-3 rounded-xl border border-rose-200/40 text-xs text-rose-800">
                {lang === 'ar' ? 'إجمالي الديون والديات القائمة:' : 'Total Debt remains:'}{' '}
                <strong className="font-mono">{payingCustomer.totalDebt.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}</strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{lang === 'ar' ? 'المبلغ المستلم نقداً (د.ج)' : 'Received Amount Cash'} *</label>
                <input
                  type="number"
                  required
                  max={payingCustomer.totalDebt}
                  value={customerPaidAmount || ''}
                  onChange={e => setCustomerPaidAmount(Number(e.target.value))}
                  className="w-full text-base font-bold text-emerald-700 px-3 py-2 border rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingCustomer(null)}
                  className="flex-1 text-sm bg-white border py-2 rounded-xl text-slate-700"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl"
                >
                  {lang === 'ar' ? 'قبض الدفعة المالي' : 'Confirm Cash Accept'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📊 RICH MODAL/PANEL: DETAILED SUPPLIER STATEMENT (KASHF HISSAB) */}
      {viewingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[calc(100vh-2rem)] shadow-2xl overflow-hidden border border-slate-100 flex flex-col text-slate-805 my-8">
            <div className="bg-indigo-900 text-white p-5 flex justify-between items-center">
              <div className="text-start">
                <span className="text-[10px] uppercase font-bold tracking-widest bg-white/20 text-indigo-100 px-2.5 py-0.5 rounded-full">
                  {lang === 'ar' ? '📊 كشف حساب المورد التفصيلي' : 'Supplier Account Statement'}
                </span>
                <h3 className="font-black text-xl mt-1 tracking-tight flex items-center gap-2">
                  <Truck className="w-5 h-5 text-indigo-300" />
                  {viewingSupplier.name}
                </h3>
                <p className="text-xs text-indigo-200 mt-1">
                  📞 {viewingSupplier.phone} | 📍 {viewingSupplier.address || (lang === 'ar' ? 'غير مسجل' : 'Not recorded')}
                </p>
              </div>
              <button 
                onClick={() => setViewingSupplier(null)} 
                className="text-white hover:bg-white/20 p-2 rounded-full transition-colors font-extrabold text-base"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Financial Metrics Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex flex-col justify-between text-start">
                  <span className="text-xs font-black text-rose-800 flex items-center gap-1">
                     💰 {lang === 'ar' ? 'الكريدي المتبقي (الباقي)' : 'Remaining Balance Due'}
                  </span>
                  <span className="text-2xl font-black text-rose-600 mt-2 font-mono">
                    {viewingSupplier.totalDue.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col justify-between text-start">
                  <span className="text-xs font-black text-emerald-800 flex items-center gap-1">
                     💳 {lang === 'ar' ? 'إجمالي المدفوعات المسددة' : 'Total Paid Dues'}
                  </span>
                  <span className="text-2xl font-black text-emerald-600 mt-2 font-mono">
                    {viewingSupplier.totalPaid.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                  </span>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl flex flex-col justify-between text-start">
                  <span className="text-xs font-black text-indigo-800 flex items-center gap-1">
                     📦 {lang === 'ar' ? 'نوع السلع الموردة' : 'Supplier Business segment'}
                  </span>
                  <span className="text-sm font-black text-indigo-900 mt-2">
                    {viewingSupplier.type === 'phones_accessories' 
                      ? (lang === 'ar' ? 'الهواتف والإكسسوارات' : 'Phones & Accessories') 
                      : (lang === 'ar' ? 'قطع الغيار وملحقات الصيانة' : 'Maintenance Spare Parts')}
                  </span>
                </div>
              </div>

              {/* Navigation Tabs for Statement */}
              <div className="flex border-b border-gray-205 gap-1 overflow-x-auto pb-1 text-slate-505 font-bold text-xs justify-start">
                <button
                  onClick={() => setSupplierDetailTab('payments')}
                  className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                    supplierDetailTab === 'payments' ? 'bg-indigo-50 text-indigo-900 font-extrabold' : 'hover:bg-slate-50'
                  }`}
                >
                  <DollarSign className="w-4 h-4 text-indigo-600" />
                  {lang === 'ar' ? 'كشف الدفعات والأقساط' : 'Payments & Installments'}
                </button>
                <button
                  onClick={() => setSupplierDetailTab('goods')}
                  className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                    supplierDetailTab === 'goods' ? 'bg-indigo-50 text-indigo-900 font-extrabold' : 'hover:bg-slate-50'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  {lang === 'ar' ? 'السلع المأخوذة وتاريخها' : 'Taken Goods History'}
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                    {products.filter(p => p.supplierId === viewingSupplier.id).length + parts.filter(p => p.supplierId === viewingSupplier.id).length}
                  </span>
                </button>
                <button
                  onClick={() => setSupplierDetailTab('returns')}
                  className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                    supplierDetailTab === 'returns' ? 'bg-indigo-50 text-indigo-900 font-extrabold' : 'hover:bg-slate-50'
                  }`}
                >
                  <RotateCcw className="w-4 h-4 text-indigo-600" />
                  {lang === 'ar' ? 'إرجاع سلع وقطع غيار (خصم الكريدي)' : 'Returns & Credit Deduction'}
                  {viewingSupplier.returnHistory && viewingSupplier.returnHistory.length > 0 && (
                    <span className="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                      {viewingSupplier.returnHistory.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab Contents */}
              {supplierDetailTab === 'payments' && (
                <div className="space-y-4 text-start">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add installment inline form */}
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl h-fit">
                      <h4 className="font-extrabold text-xs text-slate-800 mb-3 flex items-center gap-1.5">
                        ➕ {lang === 'ar' ? 'تسجيل دفعة كريدي جديدة' : 'Add New Installment'}
                      </h4>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        if (payAmount <= 0) return;
                        
                        const currentSuppliers = [...suppliers];
                        const idx = currentSuppliers.findIndex(s => s.id === viewingSupplier.id);
                        if (idx > -1) {
                          const sup = currentSuppliers[idx];
                          if (payAmount > sup.totalDue) {
                            alert(lang === 'ar' ? '⚠️ لا يمكن دفع مبلغ أكبر من الكريدي المتبقي!' : '⚠️ Cannot pay more than remaining balance!');
                            return;
                          }
                          sup.totalDue = Math.max(0, sup.totalDue - payAmount);
                          sup.totalPaid += payAmount;
                          sup.paymentHistory.push({
                            amount: payAmount,
                            date: new Date().toISOString().split('T')[0],
                            note: paymentNote || (lang === 'ar' ? 'دفعة كريدي مسددة' : 'Installment payment'),
                          });

                          DzStoreDB.saveSuppliers(shopId, currentSuppliers);
                          setSuppliers(currentSuppliers);
                          setViewingSupplier({ ...sup });
                          setPayAmount(0);
                          setPaymentNote('');
                          onRefreshStats();
                          DzStoreAudio.playSuccessChime(enableSounds);
                        }
                      }} className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">{lang === 'ar' ? 'المبلغ المدفوع (د.ج)' : 'Amount (DZD)'} *</label>
                          <input
                            type="number"
                            required
                            max={viewingSupplier.totalDue}
                            placeholder="5000"
                            value={payAmount || ''}
                            onChange={e => setPayAmount(Number(e.target.value))}
                            className="w-full text-sm px-3 py-2 border rounded-xl bg-white text-slate-900 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">{lang === 'ar' ? 'ملاحظة أو مرجع (رقم الوصل)' : 'Notes / Reference'}</label>
                          <input
                            type="text"
                            placeholder={lang === 'ar' ? 'مثال: تسديد دفعة بريدي موب' : 'BaridiMob, bank check, cash'}
                            value={paymentNote}
                            onChange={e => setPaymentNote(e.target.value)}
                            className="w-full text-xs px-3 py-2 border rounded-xl bg-white text-slate-900 focus:outline-none"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={viewingSupplier.totalDue <= 0}
                          className="w-full text-xs bg-indigo-700 hover:bg-indigo-805 disabled:bg-slate-300 text-white font-extrabold py-2.5 rounded-xl transition-all cursor-pointer shadow-sm"
                        >
                          💸 {lang === 'ar' ? 'تأكيد ودفع القسط' : 'Post Payment'}
                        </button>
                      </form>
                    </div>

                    {/* Left history report ledger */}
                    <div className="lg:col-span-2 space-y-3">
                      <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1">
                        🗓️ {lang === 'ar' ? 'سجل دفعات الكريدي التاريخية لكشف الحساب' : 'Historical Installment Payments Ledger'}
                      </h4>
                      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-xs">
                        <table className="w-full text-left text-xs text-slate-600">
                          <thead className="bg-slate-50 text-[10px] font-bold text-slate-505 uppercase tracking-wider border-b border-slate-100">
                            <tr>
                              <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'تاريخ الدفع' : 'Payment Date'}</th>
                              <th className="px-4 py-2.5 text-start">{lang === 'ar' ? ' التفاصيل والملاحظة' : 'Details / Notes'}</th>
                              <th className="px-4 py-2.5 text-end">{lang === 'ar' ? 'المبلغ المدفوع' : 'Amount Paid'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {viewingSupplier.paymentHistory.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="text-center py-8 text-xs text-slate-400">
                                  {lang === 'ar' ? 'لم يتم دفع أي دفعات حتى الآن.' : 'No installment payment transactions yet.'}
                                </td>
                              </tr>
                            ) : (
                              viewingSupplier.paymentHistory.slice().reverse().map((pay, pIdx) => (
                                <tr key={pIdx} className="hover:bg-slate-50/40 font-semibold">
                                  <td className="px-4 py-2.5 font-bold font-mono text-slate-900 text-start">{pay.date}</td>
                                  <td className="px-4 py-2.5 text-slate-500 text-start">{pay.note || '-'}</td>
                                  <td className="px-4 py-2.5 font-black font-mono text-emerald-600 text-end">
                                    +{pay.amount.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {supplierDetailTab === 'goods' && (
                <div className="space-y-4 text-start">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-indigo-600" />
                      {lang === 'ar' ? 'قائمة المنتجات وقطع الصيانة الموردة من طرف هذا المورد وتاريخ أخذها وكمياتها المتبقية:' : 'List of products & spare parts obtained from this supplier with take-in dates & currently available stock:'}
                    </span>
                  </div>

                  <div className="border border-slate-100 rounded-3xl overflow-hidden bg-white shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-slate-600">
                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                          <tr>
                            <th className="px-4 py-3 text-start">{lang === 'ar' ? 'اسم السلعة والبراند' : 'Item Description'}</th>
                            <th className="px-4 py-3 text-start">{lang === 'ar' ? 'الـنوع' : 'Category'}</th>
                            <th className="px-4 py-3 text-center">{lang === 'ar' ? 'الكمية الحالية' : 'Current Stock'}</th>
                            <th className="px-4 py-3 text-end">{lang === 'ar' ? 'سعر الشراء' : 'Purchase Cost'}</th>
                            <th className="px-4 py-3 text-end">{lang === 'ar' ? 'سعر البيع' : 'Retail Price'}</th>
                            <th className="px-4 py-3 text-center">{lang === 'ar' ? 'تاريخ أخذ السلع' : 'Date Received'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                          {/* List products owned by this supplier */}
                          {products.filter(p => p.supplierId === viewingSupplier.id).map(prod => (
                            <tr key={prod.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-start">
                                <div className="font-extrabold text-slate-950">{prod.name}</div>
                                <div className="text-[10px] font-mono text-slate-450">🏷️ {prod.brand || 'No brand'}</div>
                              </td>
                              <td className="px-4 py-3 text-start">
                                <span className="bg-sky-50 text-sky-850 text-[9px] font-black px-2 py-0.5 rounded-md border border-sky-100/30">
                                  📱 {lang === 'ar' ? 'منتج / هاتف' : 'Product / Phone'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center font-black font-mono">
                                <span className={prod.quantity === 0 ? 'text-red-500' : 'text-slate-800'}>
                                  {prod.quantity}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-end font-mono text-slate-950">
                                {prod.purchasePrice.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                              </td>
                              <td className="px-4 py-3 text-end font-mono text-slate-500">
                                {prod.sellingPrice.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                              </td>
                              <td className="px-4 py-3 text-center font-mono text-slate-500 text-[11px]">
                                {prod.dateAdded || '-'}
                              </td>
                            </tr>
                          ))}

                          {/* List parts owned by this supplier */}
                          {parts.filter(p => p.supplierId === viewingSupplier.id).map(part => (
                            <tr key={part.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-start">
                                <div className="font-extrabold text-slate-950">{part.name}</div>
                                <div className="text-[10px] font-mono text-slate-450">🔧 {part.model || 'Universal'}</div>
                              </td>
                              <td className="px-4 py-3 text-start">
                                <span className="bg-purple-50 text-purple-850 text-[9px] font-black px-2 py-0.5 rounded-md border border-purple-100/30">
                                  ⚙️ {lang === 'ar' ? 'قطعة غيار' : 'Spare Part'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center font-black font-mono">
                                <span className={part.quantity === 0 ? 'text-red-505' : 'text-slate-800'}>
                                  {part.quantity}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-end font-mono text-slate-950">
                                {part.purchasePrice.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                              </td>
                              <td className="px-4 py-3 text-end font-mono text-slate-505">
                                {part.sellingPrice.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                              </td>
                              <td className="px-4 py-3 text-center font-mono text-slate-505 text-[11px]">
                                {part.dateAdded || viewingSupplier.createdAt}
                              </td>
                            </tr>
                          ))}

                          {products.filter(p => p.supplierId === viewingSupplier.id).length === 0 &&
                           parts.filter(p => p.supplierId === viewingSupplier.id).length === 0 && (
                            <tr>
                              <td colSpan={6} className="text-center py-12 text-slate-400 text-xs font-semibold">
                                {lang === 'ar' ? 'لم تقم بتسجيل أو أخذ أي سلع مضافة لهذه الشركة حتى الآن.' : 'No items / batches currently registered for this supplier.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {supplierDetailTab === 'returns' && (
                <div className="space-y-4 text-start">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add Return inline form */}
                    <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl h-fit">
                      <h4 className="font-extrabold text-xs text-rose-805 mb-3 flex items-center gap-1.5">
                        🔄 {lang === 'ar' ? 'إجراء إرجاع سلعة للمورد' : 'Initiate Wholesaler Return'}
                      </h4>
                      <form onSubmit={handleReturnToSupplier} className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">{lang === 'ar' ? 'اختر السلعة المراد إرجاعها' : 'Select Item'} *</label>
                          <select
                            required
                            value={returnItemKey}
                            onChange={(e) => {
                              setReturnItemKey(e.target.value);
                              setReturnQty(1);
                            }}
                            className="w-full text-xs px-3 py-2 border rounded-xl bg-white text-slate-900 focus:outline-none font-semibold"
                          >
                            <option value="">{lang === 'ar' ? '-- اختر السلعة --' : '-- Choose item to return --'}</option>
                            <optgroup label={lang === 'ar' ? '📱 الهواتف والمنتجات' : 'Phones & Products'}>
                              {products.filter(p => p.supplierId === viewingSupplier.id && p.quantity > 0).map(p => (
                                <option key={p.id} value={`product:${p.id}`}>
                                  {p.name} ({lang === 'ar' ? 'متوفر' : 'Stock'}: {p.quantity} - {p.purchasePrice} د.ج)
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label={lang === 'ar' ? '⚙️ قطع الغيار والملحقات' : 'Spare Parts'}>
                              {parts.filter(p => p.supplierId === viewingSupplier.id && p.quantity > 0).map(p => (
                                <option key={p.id} value={`part:${p.id}`}>
                                  {p.name} ({lang === 'ar' ? 'متوفر' : 'Stock'}: {p.quantity} - {p.purchasePrice} د.ج)
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">{lang === 'ar' ? 'الكمية المراد إرجاعها للمورد' : 'Quantity'}</label>
                          <input
                            type="number"
                            required
                            min={1}
                            value={returnQty || ''}
                            onChange={e => setReturnQty(Math.max(1, Number(e.target.value)))}
                            className="w-full text-xs px-3 py-2 border rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-1 text-slate-900 font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">{lang === 'ar' ? 'طريقة معالجة السعر المرتجع' : 'Financial Action'}</label>
                          <div className="space-y-2 mt-1">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-750 cursor-pointer">
                              <input
                                type="radio"
                                name="returnActionType"
                                checked={returnActionType === 'deduct_credit'}
                                onChange={() => setReturnActionType('deduct_credit')}
                                className="accent-indigo-900 font-bold"
                              />
                              {lang === 'ar' ? '💸 خصم قيمة السلع من كريدي هذا المورد' : 'Deduct refund value from supplier credit (crédit)'}
                            </label>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-750 cursor-pointer">
                              <input
                                type="radio"
                                name="returnActionType"
                                checked={returnActionType === 'cash'}
                                onChange={() => setReturnActionType('cash')}
                                className="accent-indigo-900 font-bold"
                              />
                              {lang === 'ar' ? '🪙 استرداد المبلغ كاش (نقداً) من المورد' : 'Receive instant Cash Refund from supplier'}
                            </label>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={!returnItemKey}
                          className="w-full text-xs bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-extrabold py-2.5 rounded-xl transition-all cursor-pointer shadow-md"
                        >
                          🔄 {lang === 'ar' ? 'تأكيد الإرجاع للمستودع' : 'Process Return Dues'}
                        </button>
                      </form>
                    </div>

                    {/* Left returns ledger of this supplier */}
                    <div className="lg:col-span-2 space-y-3">
                      <h4 className="font-extrabold text-xs text-rose-800 flex items-center gap-1">
                        📦 {lang === 'ar' ? 'سجل السلع المرتجعة المخصومة من الكريدي' : 'Returned Items History Statement'}
                      </h4>
                      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-xs">
                        <table className="w-full text-left text-xs text-slate-600">
                          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                            <tr>
                              <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                              <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'الاسم' : 'Item Name'}</th>
                              <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'الكمية' : 'Qty'}</th>
                              <th className="px-4 py-2.5 text-end">{lang === 'ar' ? 'القيمة المخصومة' : 'Credit Refund'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {!viewingSupplier.returnHistory || viewingSupplier.returnHistory.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="text-center py-8 text-xs text-slate-450 font-semibold">
                                  {lang === 'ar' ? 'لم يتم تسجيل أي عمليات إرجاع سلع حتى الآن.' : 'No returned items logged yet.'}
                                </td>
                              </tr>
                            ) : (
                              viewingSupplier.returnHistory.slice().reverse().map((ret, rIdx) => (
                                <tr key={rIdx} className="hover:bg-slate-50/40 font-semibold">
                                  <td className="px-4 py-2.5 font-bold font-mono text-slate-950 text-start">{ret.date}</td>
                                  <td className="px-4 py-2.5 text-start">
                                    <div className="font-extrabold text-slate-905">{ret.itemName}</div>
                                    <div className="text-[9px] uppercase font-bold text-slate-400">
                                      {ret.itemType === 'product' ? (lang === 'ar' ? 'منتج / هاتف' : 'Product') : (lang === 'ar' ? 'قطعة غيار' : 'Spare Part')}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-700">{ret.quantity}</td>
                                  <td className="px-4 py-2.5 font-black font-mono text-rose-600 text-end">
                                    -{ret.refundAmount.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setViewingSupplier(null)}
                className="px-6 py-2 bg-indigo-900 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer hover:bg-slate-950 transition-colors"
              >
                {lang === 'ar' ? 'إغلاق كشف الحساب' : 'Close Statement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
