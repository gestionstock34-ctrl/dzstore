
import React, { useState, useEffect } from 'react';
import { Currency, Language, Sale, Product, SparePart, Customer, AppUser, BookingRequest, AuditReport, UsedPhoneAssessment, AccountingExpense } from '../types';
import { DzStoreDB } from '../lib/db';
import { TRANSLATIONS } from '../lib/data';
import { DzStoreAudio } from './AudioAlerts';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Wrench, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers,
  Award,
  Wallet,
  Activity,
  Calendar,
  RotateCcw,
  Search,
  Eye,
  Check,
  X,
  AlertCircle,
  Undo2,
  Undo,
  Trash2,
  Plus,
  Phone,
  ShieldAlert,
  Percent,
  Briefcase,
  MessageSquare,
  CheckSquare,
  Camera,
  Coins,
  Building,
  Smartphone,
  Send,
  UserCheck,
  SmartphoneIcon
} from 'lucide-react';

interface ReportsScreenProps {
  shopId: string;
  currency: Currency;
  lang: Language;
  user?: AppUser;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({
  shopId,
  currency,
  lang,
  user,
}) => {
  const t = TRANSLATIONS[lang];

  // Database resources
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [parts, setParts] = useState<SparePart[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Support lists for new modules
  const [subTab, setSubTab] = useState<'finance' | 'expenses' | 'warranty' | 'bookings' | 'audits' | 'assessments' | 'employees' | 'ai-chat'>('finance');
  const [expenses, setExpenses] = useState<AccountingExpense[]>([]);
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [audits, setAudits] = useState<AuditReport[]>([]);
  const [assessments, setAssessments] = useState<UsedPhoneAssessment[]>([]);

  // Expenses Form State
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expCategory, setExpCategory] = useState<'rent' | 'electricity' | 'internet' | 'salary' | 'supplier_payment' | 'other'>('other');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expNotes, setExpNotes] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);

  // Bookings Form State
  const [showAddBookingModal, setShowAddBookingModal] = useState(false);
  const [bookCustName, setBookCustName] = useState('');
  const [bookCustPhone, setBookCustPhone] = useState('');
  const [bookProduct, setBookProduct] = useState('');
  const [bookNotes, setBookNotes] = useState('');

  // Audits Form State
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedAuditProdId, setSelectedAuditProdId] = useState('');
  const [auditActualQty, setAuditActualQty] = useState<number>(0);
  const [draftAuditFindings, setDraftAuditFindings] = useState<{ productId: string, barcode: string, name: string, expectedQty: number, actualQty: number, difference: number }[]>([]);

  // Assessments Form State
  const [showAssessModal, setShowAssessModal] = useState(false);
  const [assessModel, setAssessModel] = useState('');
  const [assessImei, setAssessImei] = useState('');
  const [assessFaceTouch, setAssessFaceTouch] = useState<'pass' | 'fail' | 'na'>('pass');
  const [assessBattery, setAssessBattery] = useState<number>(85);
  const [assessScreen, setAssessScreen] = useState<'yes' | 'no' | 'replaced_high_quality'>('yes');
  const [assessCamera, setAssessCamera] = useState<'yes' | 'no' | 'issues'>('yes');
  const [assessWifi, setAssessWifi] = useState<'yes' | 'no'>('yes');
  const [assessBody, setAssessBody] = useState<'excellent' | 'good' | 'fair' | 'scratched'>('excellent');
  const [assessCharging, setAssessCharging] = useState<'yes' | 'no'>('yes');
  const [assessStatus, setAssessStatus] = useState<'excellent' | 'good' | 'fair' | 'faulty'>('good');
  const [assessNotes, setAssessNotes] = useState('');

  // AI Assistant Chat State
  const [aiQuery, setAiQuery] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Search state for detailed sales log
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTimeline, setSelectedTimeline] = useState<'all' | 'today' | 'month'>('all');
  const [warrantySearchQuery, setWarrantySearchQuery] = useState('');

  // Refund dialog state
  const [selectedRefundSale, setSelectedRefundSale] = useState<Sale | null>(null);
  const [returnCounts, setReturnCounts] = useState<Record<number, number>>({});
  const [deductFromDebt, setDeductFromDebt] = useState(true);

  // Trigger state update
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [metrics, setMetrics] = useState({
    totalSales: 0,
    costOfGoodsSold: 0,
    grossProfit: 0,
    repairIncome: 0,
    totalExpensesSum: 0,
    totalRevenue: 0,
    netProfit: 0,
    totalCustomerDebt: 0,
    totalSupplierDebt: 0,
    salesCount: 0,
    repairCount: 0,
  });

  // Load backend list data
  useEffect(() => {
    const loadedSales = DzStoreDB.getSales(shopId);
    const loadedProds = DzStoreDB.getProducts(shopId);
    const loadedParts = DzStoreDB.getSpareParts(shopId);
    const loadedCusts = DzStoreDB.getCustomers(shopId);
    const loadedExpenses = DzStoreDB.getExpenses(shopId);
    const loadedBookings = DzStoreDB.getBookings(shopId);
    const loadedAudits = DzStoreDB.getAudits(shopId);
    const loadedAssessments = DzStoreDB.getAssessments(shopId);

    setSales(loadedSales);
    setProducts(loadedProds);
    setParts(loadedParts);
    setCustomers(loadedCusts);
    setExpenses(loadedExpenses);
    setBookings(loadedBookings);
    setAudits(loadedAudits);
    setAssessments(loadedAssessments);
  }, [shopId, refreshTrigger]);

  // Recalculate metrics based on timeline & loaded datasets
  useEffect(() => {
    if (sales.length === 0 && metrics.totalSales > 0) return; // guard state syncing latency

    const jobs = DzStoreDB.getMaintenanceJobs(shopId);
    const suppliers = DzStoreDB.getSuppliers(shopId);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const filteredSales = sales.filter(s => {
      if (selectedTimeline === 'today') {
        return s.date.startsWith(todayStr);
      }
      if (selectedTimeline === 'month') {
        const d = new Date(s.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }
      return true;
    });

    const filteredJobs = jobs.filter(j => {
      if (selectedTimeline === 'today') {
        return j.createdAt.startsWith(todayStr);
      }
      if (selectedTimeline === 'month') {
        const d = new Date(j.createdAt);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }
      return true;
    });

    // POS sales calculations incorporating returns
    let totalSales = 0;
    let costOfGoodsSold = 0;
    
    filteredSales.forEach(s => {
      // Do not count fully returned invoices towards gross checkouts
      if (s.status === 'returned') return;

      totalSales += s.total;

      s.items.forEach(itm => {
        const soldQty = itm.quantity - (itm.returnedQuantity || 0);
        if (soldQty <= 0) return;

        const prodId = itm.productId || itm.partId || '';
        const originalProduct = products.find(p => p.id === prodId);
        
        if (itm.cost !== undefined && itm.cost > 0) {
          costOfGoodsSold += (itm.cost * soldQty);
        } else if (originalProduct) {
          costOfGoodsSold += (originalProduct.purchasePrice * soldQty);
        } else {
          costOfGoodsSold += ((itm.price * 0.8) * soldQty);
        }
      });
    });

    // Operating expenses calculations
    const filteredExpenses = expenses.filter(e => {
      if (selectedTimeline === 'today') {
        return e.date.startsWith(todayStr);
      }
      if (selectedTimeline === 'month') {
        const d = new Date(e.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }
      return true;
    });
    const totalExpensesSum = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Repair incomes calculations
    let repairIncome = 0;
    let completedRepairsCount = 0;
    filteredJobs.forEach(j => {
      if (j.status === 'delivered') {
        repairIncome += j.finalCost || j.estimatedCost;
        completedRepairsCount++;
      }
    });

    // Debts sums
    const totalCustomerDebt = customers.reduce((acc, c) => acc + (c.totalDebt || 0), 0);
    const totalSupplierDebt = suppliers.reduce((acc, s) => acc + (s.totalDue || 0), 0);

    const grossProfit = Math.max(0, totalSales - costOfGoodsSold);
    const totalRevenue = totalSales + repairIncome;
    const netProfit = grossProfit + repairIncome - totalExpensesSum;

    setMetrics({
      totalSales,
      costOfGoodsSold,
      grossProfit,
      repairIncome,
      totalExpensesSum,
      totalRevenue,
      netProfit,
      totalCustomerDebt,
      totalSupplierDebt,
      salesCount: filteredSales.filter(s => s.status !== 'returned').length,
      repairCount: completedRepairsCount,
    });

  }, [sales, products, customers, expenses, selectedTimeline, refreshTrigger]);

  // Open the return modal and reset input states
  const openReturnModal = (sale: Sale) => {
    setSelectedRefundSale(sale);
    const initialCounts: Record<number, number> = {};
    sale.items.forEach((_, idx) => {
      initialCounts[idx] = 0;
    });
    setReturnCounts(initialCounts);
    setDeductFromDebt(true);
  };

  // Process the return confirmation
  const handleConfirmReturn = () => {
    if (!selectedRefundSale) return;

    // Check permission
    const canRefund = !user || user.role === 'owner' || user.role === 'admin' || user.canRefundSales === true;
    if (!canRefund) {
      alert(lang === 'ar' 
        ? '⚠️ عذراً! ليس لديك صلاحية إرجاع السلع وإصدار المسترد النقدي. يرجى التواصل مع صاحب المتجر للتفعيل.'
        : '⚠️ Access Denied! You do not have the required permissions to perform product returns and refunds. Please contact the shop owner.'
      );
      return;
    }

    // 1. Calculate the total return items and validation checks
    let refundSum = 0;
    let totalItemsReturnedThisSession = 0;

    const itemsClone = selectedRefundSale.items.map((item, idx) => {
      const returnQty = returnCounts[idx] || 0;
      if (returnQty > 0) {
        totalItemsReturnedThisSession += returnQty;
        // Refund amount is original final item price
        refundSum += returnQty * item.price;
      }
      
      const newReturnedQty = (item.returnedQuantity || 0) + returnQty;
      return {
        ...item,
        returnedQuantity: newReturnedQty,
      };
    });

    if (totalItemsReturnedThisSession === 0) {
      alert(lang === 'ar' ? '⚠️ يرجى تحديد كمية قطعة واحدة على الأقل لإرجاعها!' : '⚠️ Specify at least 1 item to return!');
      return;
    }

    // 2. Put stock back to products and parts lists
    const productsList = [...products];
    const partsList = [...parts];

    selectedRefundSale.items.forEach((item, idx) => {
      const qtyReturned = returnCounts[idx] || 0;
      if (qtyReturned <= 0) return;

      if (item.type === 'product' && item.productId) {
        const prod = productsList.find(p => p.id === item.productId);
        if (prod) {
          prod.quantity += qtyReturned;
          // Put serial number / IMEI back to list if serialized during checkout sale
          if (item.serialNumber && !prod.serialNumbers.includes(item.serialNumber)) {
            prod.serialNumbers.push(item.serialNumber);
          }
        }
      } else if (item.type === 'part' && item.partId) {
        const sp = partsList.find(p => p.id === item.partId);
        if (sp) {
          sp.quantity += qtyReturned;
        }
      }
    });

    // 3. Mark invoice and compute new outstanding totals
    const nextTotal = Math.max(0, selectedRefundSale.total - refundSum);
    const nextSubtotal = Math.max(0, selectedRefundSale.subtotal - refundSum);
    const nextReturnedAmount = (selectedRefundSale.returnedAmount || 0) + refundSum;

    // Verify if all items are fully returned
    let areAllFullyReturned = true;
    itemsClone.forEach(item => {
      if (item.returnedQuantity && item.returnedQuantity < item.quantity) {
        areAllFullyReturned = false;
      } else if (!item.returnedQuantity) {
        areAllFullyReturned = false;
      }
    });

    const nextStatus = areAllFullyReturned ? 'returned' : 'partially_returned';

    // Update sales list
    const updatedSales = sales.map(s => {
      if (s.id === selectedRefundSale.id) {
        return {
          ...s,
          items: itemsClone,
          total: nextTotal,
          subtotal: nextSubtotal,
          returnedAmount: nextReturnedAmount,
          status: nextStatus as 'returned' | 'partially_returned',
          updatedAt: new Date().toISOString(),
        };
      }
      return s;
    });

    // 4. Adjust Customers debt if installments and chosen
    const customersClone = [...customers];
    if (selectedRefundSale.paymentMethod === 'installments' && selectedRefundSale.customerId && deductFromDebt) {
      const custIdx = customersClone.findIndex(c => c.id === selectedRefundSale.customerId);
      if (custIdx > -1) {
        const cust = customersClone[custIdx];
        
        // Find matching installment
        const instIdx = cust.installments.findIndex(i => i.saleId === selectedRefundSale.id);
        if (instIdx > -1) {
          const inst = cust.installments[instIdx];
          const remainingDebtOnInstallment = inst.totalAmount - inst.paidAmount;
          
          // Reduce the remaining debt by the refund value
          const debtReduction = Math.min(refundSum, remainingDebtOnInstallment);
          inst.totalAmount = Math.max(0, inst.totalAmount - debtReduction);
          cust.totalDebt = Math.max(0, cust.totalDebt - debtReduction);

          // If the debt is fully settled, mark installment as paid
          if (inst.totalAmount <= inst.paidAmount) {
            inst.status = 'paid';
          }
        }
      }
    }

    // 5. Commit all lists back to state & DB indexes
    DzStoreDB.saveProducts(shopId, productsList);
    DzStoreDB.saveSpareParts(shopId, partsList);
    DzStoreDB.saveSales(shopId, updatedSales);
    DzStoreDB.saveCustomers(shopId, customersClone);

    // Logging the highly sensitive refund/return action in the Immutable Security Audit Trail
    DzStoreDB.logAction(
      shopId,
      user?.id || 'cashier',
      user?.name || 'Cashier',
      'refund_sale',
      lang === 'ar'
        ? `قام بإرجاع عدد (${totalItemsReturnedThisSession} قطع) من الفاتورة رقم ${selectedRefundSale.invoiceNumber} بقيمة مسترد نقدي ${refundSum.toLocaleString()} د.ج`
        : `Processed refund of ${totalItemsReturnedThisSession} item(s) for invoice number ${selectedRefundSale.invoiceNumber} with total refund sum of ${refundSum.toLocaleString()}`
    );

    // Refresh components state
    setRefreshTrigger(prev => prev + 1);
    setSelectedRefundSale(null);

    DzStoreAudio.playSuccessChime(true);
    alert(
      lang === 'ar' 
        ? `✅ تم إرجاع المنتجات (${totalItemsReturnedThisSession} قـطعة) وتحديث المتجر وترصيد المخزون بنجاح!`
        : `✅ Successfully refunded ${totalItemsReturnedThisSession} item(s) and restocked inventory!`
    );
  };

  const handleDeleteSale = (sale: Sale) => {
    // Check if user has permission
    const canDelete = !user || user.role === 'owner' || user.role === 'admin' || user.canDeleteSales === true;
    if (!canDelete) {
      alert(lang === 'ar' 
        ? '⚠️ عذراً! ليس لديك صلاحية حذف المبيعات والفواتير. يرجى التواصل مع صاحب المتجر للتفعيل.'
        : '⚠️ Access Denied! You do not have the required permissions to delete sales or invoices. Please ask the shop owner.'
      );
      return;
    }

    if (!window.confirm(lang === 'ar' 
      ? `هل أنت متأكد من رغبتك في حذف الفاتورة رقم ${sale.invoiceNumber} كلياً؟ لا يمكن التراجع عن هذا الإجراء الحساس!`
      : `Are you sure you want to permanently delete invoice ${sale.invoiceNumber}? This action is highly sensitive and irreversible!`
    )) {
      return;
    }

    // Filter out the sale and commit back to DB
    const updatedSales = sales.filter(s => s.id !== sale.id);
    DzStoreDB.saveSales(shopId, updatedSales);
    setSales(updatedSales);

    // Filter payments out of installments if connected to a customer
    if (sale.customerId && sale.paymentMethod === 'installments') {
      const customersClone = [...customers];
      const custIdx = customersClone.findIndex(c => c.id === sale.customerId);
      if (custIdx > -1) {
        const cust = customersClone[custIdx];
        cust.installments = cust.installments.filter(i => i.saleId !== sale.id);
        cust.totalDebt = Math.max(0, cust.totalDebt - sale.total);
        DzStoreDB.saveCustomers(shopId, customersClone);
        setCustomers(customersClone);
      }
    }

    // Log the action in Audit Log
    DzStoreDB.logAction(
      shopId,
      user?.id || 'cashier',
      user?.name || 'Cashier',
      'delete_sale',
      lang === 'ar'
        ? `قام بحذف الفاتورة رقم ${sale.invoiceNumber} بقيمة إجمالية ${sale.total.toLocaleString()} د.ج`
        : `Permanently deleted invoice number ${sale.invoiceNumber} with grand total of ${sale.total.toLocaleString()}`
    );

    // Reload list and metrics
    setRefreshTrigger(prev => prev + 1);
    DzStoreAudio.playWarningChime(true);
    alert(lang === 'ar' ? '✅ تم حذف الفاتورة بنجاح وسجل العمليات يشهد بذلك!' : '✅ Invoice deleted successfully and action has been logged!');
  };

  // ----------------------------------------------------
  // INTEGRATED SUBTABS OPERATIONS HANDLERS
  // ----------------------------------------------------

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expNotes.trim()) {
      alert(lang === 'ar' ? '⚠️ يرجى إدخال وصف أو معلومات الفاتورة!' : '⚠️ Please enter a title or description for the expense!');
      return;
    }
    if (expAmount <= 0) {
      alert(lang === 'ar' ? '⚠️ يرجى إدخال مبلغ صحيح أكبر من الصفر!' : '⚠️ Please enter a valid expense amount greater than zero!');
      return;
    }

    const newExpense: AccountingExpense = {
      id: 'exp_' + Date.now(),
      shopId,
      title: expNotes,
      amount: expAmount,
      category: expCategory as any,
      date: expDate,
      notes: expNotes,
    };

    const updated = [...expenses, newExpense];
    DzStoreDB.saveExpenses(shopId, updated);
    setExpenses(updated);
    
    DzStoreDB.logAction(
      shopId,
      user?.id || 'cashier',
      user?.name || 'Cashier',
      'add_expense',
      lang === 'ar'
        ? `قام بإضافة مصروف بقيمة ${expAmount.toLocaleString()} د.ج تحت فئة: ${expCategory}`
        : `Added expense of ${expAmount.toLocaleString()} DZD under category: ${expCategory}`
    );

    setExpAmount(0);
    setExpNotes('');
    setShowAddExpenseModal(false);
    setRefreshTrigger(prev => prev + 1);
    DzStoreAudio.playSuccessChime(true);
  };

  const handleDeleteExpense = (id: string, amount: number) => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا المصروف؟' : 'Are you sure you want to delete this expense?')) return;
    const updated = expenses.filter(e => e.id !== id);
    DzStoreDB.saveExpenses(shopId, updated);
    setExpenses(updated);
    
    DzStoreDB.logAction(
      shopId,
      user?.id || 'cashier',
      user?.name || 'Cashier',
      'delete_expense',
      lang === 'ar'
        ? `قام بحذف مصروف بقيمة ${amount.toLocaleString()} د.ج`
        : `Deleted expense record totaling ${amount.toLocaleString()}`
    );

    setRefreshTrigger(prev => prev + 1);
    DzStoreAudio.playWarningChime(true);
  };

  const handleAddBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookCustName.trim() || !bookCustPhone.trim() || !bookProduct.trim()) {
      alert(lang === 'ar' ? '⚠️ يرجى ملء حقول الاسم والهاتف والمنتج المطلوبة!' : '⚠️ Please fill customer name, phone, and product details!');
      return;
    }

    const newBooking: BookingRequest = {
      id: 'book_' + Date.now(),
      shopId,
      customerName: bookCustName,
      customerPhone: bookCustPhone,
      productName: bookProduct,
      notes: bookNotes,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const updated = [...bookings, newBooking];
    DzStoreDB.saveBookings(shopId, updated);
    setBookings(updated);

    DzStoreDB.logAction(
      shopId,
      user?.id || 'cashier',
      user?.name || 'Cashier',
      'add_booking',
      lang === 'ar'
        ? `سجل حجزاً مسبقاً لاسم: ${bookCustName} للمنتج: ${bookProduct}`
        : `Registered a pre-order booking for customer: ${bookCustName} - product: ${bookProduct}`
    );

    setBookCustName('');
    setBookCustPhone('');
    setBookProduct('');
    setBookNotes('');
    setShowAddBookingModal(false);
    setRefreshTrigger(prev => prev + 1);
    DzStoreAudio.playSuccessChime(true);
  };

  const handleUpdateBookingStatus = (id: string, newStatus: 'pending' | 'available' | 'notified' | 'cancelled') => {
    const updated = bookings.map(b => {
      if (b.id === id) {
        return { ...b, status: newStatus };
      }
      return b;
    });
    DzStoreDB.saveBookings(shopId, updated);
    setBookings(updated);
    setRefreshTrigger(prev => prev + 1);
    DzStoreAudio.playSuccessChime(true);
  };

  const handleDeleteBooking = (id: string) => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا الحجز؟' : 'Are you sure you want to delete this booking?')) return;
    const updated = bookings.filter(b => b.id !== id);
    DzStoreDB.saveBookings(shopId, updated);
    setBookings(updated);
    setRefreshTrigger(prev => prev + 1);
    DzStoreAudio.playWarningChime(true);
  };

  const handleAddAudit = () => {
    if (draftAuditFindings.length === 0) {
      alert(lang === 'ar' ? '⚠️ يرجى إضافة سلعة جرد واحدة على الأقل لفحص المبررات!' : '⚠️ Add at least one audited product to submit!');
      return;
    }

    const newAudit: AuditReport = {
      id: 'audit_' + Date.now(),
      shopId,
      date: new Date().toISOString().split('T')[0],
      findings: draftAuditFindings,
      checkedBy: user?.name || 'Auditor',
      createdAt: new Date().toISOString()
    };

    const updated = [...audits, newAudit];
    DzStoreDB.saveAudits(shopId, updated);
    setAudits(updated);

    DzStoreDB.logAction(
      shopId,
      user?.id || 'cashier',
      user?.name || 'Cashier',
      'conduct_audit',
      lang === 'ar'
        ? `قام بإجراء جرد مخزون وثق الفروقات لـ ${draftAuditFindings.length} سلعة`
        : `Completed inventory stock audit checklist for ${draftAuditFindings.length} products`
    );

    setDraftAuditFindings([]);
    setSelectedAuditProdId('');
    setAuditActualQty(0);
    setShowAuditModal(false);
    setRefreshTrigger(prev => prev + 1);
    DzStoreAudio.playSuccessChime(true);
    alert(lang === 'ar' ? '✅ تم حفظ تقرير الجرد والمقارنة بنجاح!' : '✅ Stock audit verification report saved successfully!');
  };

  const handleAddAuditFindingDraft = () => {
    if (!selectedAuditProdId) {
      alert(lang === 'ar' ? '⚠️ الرجاء اختيار سلعة أولاً!' : '⚠️ Select a product first!');
      return;
    }

    const p = products.find(prod => prod.id === selectedAuditProdId);
    if (!p) return;

    if (draftAuditFindings.some(f => f.productId === p.id)) {
      alert(lang === 'ar' ? '⚠️ هذه السلعة مضافة مسبقاً في مسودة الجرد الحالي!' : '⚠️ This product is already listed in the current audit draft!');
      return;
    }

    const exp = p.quantity;
    const act = auditActualQty;
    const diff = act - exp;

    const finding = {
      productId: p.id,
      barcode: p.barcode || 'N/A',
      name: p.name,
      expectedQty: exp,
      actualQty: act,
      difference: diff
    };

    setDraftAuditFindings([...draftAuditFindings, finding]);
    setAuditActualQty(0);
  };

  const handleDeleteAudit = (id: string) => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف تقرير الجرد هذا؟' : 'Are you sure you want to delete this audit report?')) return;
    const updated = audits.filter(a => a.id !== id);
    DzStoreDB.saveAudits(shopId, updated);
    setAudits(updated);
    setRefreshTrigger(prev => prev + 1);
    DzStoreAudio.playWarningChime(true);
  };

  const handleAddAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessModel.trim() || !assessImei.trim()) {
      alert(lang === 'ar' ? '⚠️ يرجى كتابة موديل الهاتف والرقم التسلسلي (IMEI)' : '⚠️ Please type model and IMEI numbers!');
      return;
    }

    const newAssessment: UsedPhoneAssessment = {
      id: 'assess_' + Date.now(),
      shopId,
      model: assessModel,
      imei: assessImei,
      checks: {
        faceIdOrTouchId: assessFaceTouch,
        batteryHealth: assessBattery,
        screenOriginal: assessScreen,
        cameraWorking: assessCamera,
        wifiBluetooth: assessWifi,
        bodyCondition: assessBody,
        chargingPort: assessCharging,
        overallStatus: assessStatus
      },
      technicianNotes: assessNotes,
      technicianName: user?.name || 'Technician',
      createdAt: new Date().toISOString()
    };

    const updated = [...assessments, newAssessment];
    DzStoreDB.saveAssessments(shopId, updated);
    setAssessments(updated);

    DzStoreDB.logAction(
      shopId,
      user?.id || 'cashier',
      user?.name || 'Cashier',
      'used_phone_assessment',
      lang === 'ar'
        ? `أجرى فحص وتقييم فني لهاتف مستعمل: ${assessModel} (IMEI: ${assessImei})`
        : `Performed hardware diagnostic assessment for used handset: ${assessModel} (IMEI: ${assessImei})`
    );

    setAssessModel('');
    setAssessImei('');
    setAssessFaceTouch('pass');
    setAssessBattery(85);
    setAssessScreen('yes');
    setAssessCamera('yes');
    setAssessWifi('yes');
    setAssessBody('excellent');
    setAssessCharging('yes');
    setAssessStatus('good');
    setAssessNotes('');
    setShowAssessModal(false);
    setRefreshTrigger(prev => prev + 1);
    DzStoreAudio.playSuccessChime(true);
    alert(lang === 'ar' ? '✅ تم تسجيل تقرير الفحص والتشخص الفني للهاتف بنجاح!' : '✅ Hardware diagnostic check saved successfully!');
  };

  const handleDeleteAssessment = (id: string) => {
    if (!window.confirm(lang === 'ar' ? 'هل تريد حذف هذا الفحص الفني بالفعل؟' : 'Are you sure you want to delete this assessment sheet?')) return;
    const updated = assessments.filter(ast => ast.id !== id);
    DzStoreDB.saveAssessments(shopId, updated);
    setAssessments(updated);
    setRefreshTrigger(prev => prev + 1);
    DzStoreAudio.playWarningChime(true);
  };

  const handleSendAiChatQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;

    const userMsg = aiQuery;
    setAiQuery('');
    setAiChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setAiLoading(true);

    try {
      const response = await fetch('/api/gemini/chat', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           message: userMsg,
           products,
           sales,
           expenses,
           spareParts: parts,
           maintenanceJobs: DzStoreDB.getMaintenanceJobs(shopId),
           bookings,
           lang
         })
      });

      const resData = await response.json();
      if (resData.success && resData.reply) {
         setAiChatHistory(prev => [...prev, { role: 'assistant', content: resData.reply }]);
         DzStoreAudio.playSuccessChime(true);
      } else if (resData.error && resData.message) {
         const errMsg = typeof resData.message === 'object' ? (resData.message[lang] || resData.message['en']) : resData.message;
         setAiChatHistory(prev => [...prev, { role: 'assistant', content: errMsg }]);
         DzStoreAudio.playWarningChime(true);
      } else {
         setAiChatHistory(prev => [...prev, { role: 'assistant', content: 'Could not contact Gemini API server. Please retry.' }]);
      }
    } catch (err: any) {
       console.error("Chat request failed:", err);
       setAiChatHistory(prev => [...prev, { role: 'assistant', content: 'Connection timed out or lost. Please retry!' }]);
    } finally {
       setAiLoading(false);
    }
  };

  // Filter detailed sales log table
  const filteredSalesTableList = sales.filter(s => {
    // 1. Timeline filter
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (selectedTimeline === 'today' && !s.date.startsWith(todayStr)) return false;
    if (selectedTimeline === 'month') {
      const d = new Date(s.date);
      if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) return false;
    }

    // 2. Query search
    if (searchQuery.trim() === '') return true;

    const query = searchQuery.toLowerCase();
    const hasInvoice = s.invoiceNumber.toLowerCase().includes(query);
    const hasCustomer = s.customerName && s.customerName.toLowerCase().includes(query);
    const hasCashier = s.cashierName.toLowerCase().includes(query);
    const hasProduct = s.items.some(item => item.name.toLowerCase().includes(query));

    return hasInvoice || hasCustomer || hasCashier || hasProduct;
  });

  // Find top sold products and profits
  const getProductStats = () => {
    const soldCounts: Record<string, { id: string; name: string; quantity: number; revenue: number; profit: number }> = {};
    
    sales.forEach(s => {
      if (s.status === 'returned') return;
      s.items.forEach(itm => {
        const id = itm.productId || itm.partId || itm.name;
        const soldQty = itm.quantity - (itm.returnedQuantity || 0);
        if (soldQty <= 0) return;

        const originalProduct = products.find(p => p.id === id);
        const buyPrice = originalProduct ? originalProduct.purchasePrice : (itm.price * 0.8);
        const itemProfit = (itm.price - buyPrice) * soldQty;
        const itemRevenue = itm.price * soldQty;

        if (!soldCounts[id]) {
          soldCounts[id] = {
            id,
            name: itm.name,
            quantity: 0,
            revenue: 0,
            profit: 0
          };
        }
        soldCounts[id].quantity += soldQty;
        soldCounts[id].revenue += itemRevenue;
        soldCounts[id].profit += itemProfit;
      });
    });

    const statsArray = Object.values(soldCounts);
    const topByQuantity = [...statsArray].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    const topByProfit = [...statsArray].sort((a, b) => b.profit - a.profit).slice(0, 5);

    return { topByQuantity, topByProfit };
  };

  const getWarrantyInfo = (saleDate: string, periodString: string) => {
    const start = new Date(saleDate);
    let days = 90; // Default to 90 days (3 months)
    
    const pLower = (periodString || '').toLowerCase().trim();
    if (pLower.includes('no warranty') || pLower.includes('بدون') || pLower.includes('لا يوجد')) {
      return null; // No warranty
    } else if (pLower.includes('1 month') || pLower.includes('شهر واحد') || pLower.includes('1 ش')) {
      days = 30;
    } else if (pLower.includes('3 month') || pLower.includes('3 أشهر') || pLower.includes('3 ش')) {
      days = 90;
    } else if (pLower.includes('15 day') || pLower.includes('15 يوم')) {
      days = 15;
    } else if (pLower.includes('6 month') || pLower.includes('6 أشهر') || pLower.includes('6 ش')) {
      days = 180;
    } else if (pLower.includes('12 month') || pLower.includes('1 year') || pLower.includes('عام') || pLower.includes('سنة')) {
      days = 365;
    } else {
      // Try to extract number using regex
      const match = pLower.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (pLower.includes('day') || pLower.includes('يوم')) {
          days = num;
        } else {
          days = num * 30; // Assume months
        }
      }
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

  const { topByQuantity, topByProfit } = getProductStats();

  return (
    <div className="space-y-6">
      {/* Upper Title segment */}
      <div className="flex flex-col md:flex-row items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2.5 rounded-2xl">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="text-start">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {lang === 'ar' ? 'التقارير والمداخيل والربحية المباشرة' : 'Revenue & Live Audits'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'ar'
                ? 'تحليل إجمالي المبيعات، تكاليف السلع المشتراة، وصافي دخل الصيانة والديون المستحقة.'
                : 'Complete double-entry accounting overview for cash register, hardware repairs and margins.'}
            </p>
          </div>
        </div>

        {/* Timeline selector */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
          <button
            onClick={() => setSelectedTimeline('all')}
            className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-colors ${
              selectedTimeline === 'all' ? 'bg-white dark:bg-slate-705 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {lang === 'ar' ? 'الكل' : 'All Time'}
          </button>
          <button
            onClick={() => setSelectedTimeline('today')}
            className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-colors ${
              selectedTimeline === 'today' ? 'bg-white dark:bg-slate-705 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {lang === 'ar' ? 'اليوم' : 'Today'}
          </button>
          <button
            onClick={() => setSelectedTimeline('month')}
            className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-colors ${
              selectedTimeline === 'month' ? 'bg-white dark:bg-slate-705 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {lang === 'ar' ? 'الشهر الحالي' : 'This Month'}
          </button>
        </div>
      </div>

      {/* SUB-TABS SELECTOR FOR ULTIMATE INTEGRATED MODULES */}
      <div className="flex border-b border-slate-100 dark:border-slate-800 pb-px gap-2 flex-wrap text-start">
        <button
          onClick={() => setSubTab('finance')}
          className={`px-3 py-2 text-xs font-black cursor-pointer border-b-2 transition-all flex items-center gap-1.5 ${
            subTab === 'finance'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'التقارير المالية والمبيعات' : 'Accounts Ledger'}</span>
        </button>

        <button
          onClick={() => setSubTab('expenses')}
          className={`px-3 py-2 text-xs font-black cursor-pointer border-b-2 transition-all flex items-center gap-1.5 ${
            subTab === 'expenses'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'مصاريف المحل' : 'Shop Expenses'}</span>
          {expenses.length > 0 && (
            <span className="bg-rose-50 text-rose-600 font-extrabold px-1.5 py-0.2 rounded-full text-[9px] border border-rose-100">
              {expenses.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubTab('warranty')}
          className={`px-3 py-2 text-xs font-black cursor-pointer border-b-2 transition-all flex items-center gap-1.5 ${
            subTab === 'warranty'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'الضمان وتتبع IMEI' : 'Warranty & IMEI'}</span>
        </button>

        <button
          onClick={() => setSubTab('bookings')}
          className={`px-3 py-2 text-xs font-black cursor-pointer border-b-2 transition-all flex items-center gap-1.5 ${
            subTab === 'bookings'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'الحجوزات المسبقة' : 'Pre-order Bookings'}</span>
          {bookings.filter(b => b.status === 'pending').length > 0 && (
            <span className="bg-amber-50 text-amber-700 font-mono font-extrabold px-1.5 py-0.2 rounded-full text-[9px] border border-amber-200">
              {bookings.filter(b => b.status === 'pending').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubTab('audits')}
          className={`px-3 py-2 text-xs font-black cursor-pointer border-b-2 transition-all flex items-center gap-1.5 ${
            subTab === 'audits'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'جرد المخزون والباركود' : 'Stock Audits'}</span>
        </button>

        <button
          onClick={() => setSubTab('assessments')}
          className={`px-3 py-2 text-xs font-black cursor-pointer border-b-2 transition-all flex items-center gap-1.5 ${
            subTab === 'assessments'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'فحص الهواتف المستعملة' : 'Used Phone Assessment'}</span>
        </button>

        <button
          onClick={() => setSubTab('employees')}
          className={`px-3 py-2 text-xs font-black cursor-pointer border-b-2 transition-all flex items-center gap-1.5 ${
            subTab === 'employees'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'الموظفين والعمولات' : 'Employees & Commissions'}</span>
        </button>

        <button
          onClick={() => setSubTab('ai-chat')}
          className={`px-3 py-2 text-xs font-black cursor-pointer border-b border-emerald-300 transition-all flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-emerald-800 ${
            subTab === 'ai-chat'
              ? 'bg-emerald-600 text-white font-black hover:bg-emerald-700'
              : ''
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 animate-pulse" />
          <span>{lang === 'ar' ? '🤖 ذكاء اصطناعي للمحل' : '🤖 AI Advisor'}</span>
        </button>
      </div>

      {subTab === 'finance' && (
        <>
          {/* Grid statistics boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-start">
        {/* Total Revenues */}
        <div className="glass-panel p-5 rounded-3xl border border-white/50 dark:border-slate-800 relative overflow-hidden shadow-xs hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">
                {lang === 'ar' ? 'إجمالي المبيعات ودخل المحل (Revenue)' : 'Total Sales Gross'}
              </span>
              <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1 inline-block">
                {metrics.totalSales.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
              </span>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-750 dark:text-emerald-450 rounded-2xl border border-emerald-100 dark:border-emerald-900">
              <ShoppingCart className="w-5 h-5" id="stats_revenue_icon" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3.5 text-[9px] text-emerald-600 dark:text-emerald-400 font-extrabold font-mono bg-emerald-50 dark:bg-emerald-950/30 w-fit px-2 py-0.5 rounded-lg border dark:border-emerald-900">
            <ArrowUpRight className="w-3 h-3" />
            {metrics.salesCount} {lang === 'ar' ? 'عملية دفع ناجحة' : 'Successful checkout sales'}
          </div>
        </div>

        {/* Repair profits */}
        <div className="glass-panel p-5 rounded-3xl border border-white/50 dark:border-slate-800 relative overflow-hidden shadow-xs hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">
                {lang === 'ar' ? 'أرباح ومقابيض ورشة الصيانة' : 'Repairs Center Income'}
              </span>
              <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1 inline-block">
                {metrics.repairIncome.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
              </span>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-750 dark:text-blue-450 rounded-2xl border border-blue-100 dark:border-blue-900">
              <Wrench className="w-5 h-5" id="stats_wrench_icon" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3.5 text-[9px] text-blue-600 dark:text-blue-400 font-extrabold font-mono bg-blue-50 dark:bg-blue-950/30 w-fit px-2 py-0.5 rounded-lg border dark:border-blue-900">
            <Activity className="w-3 h-3" />
            {metrics.repairCount} {lang === 'ar' ? 'جهاز تم تسليمه وقبضه' : 'Repaired devices delivered'}
          </div>
        </div>

        {/* Cost of Goods Sold */}
        <div className="glass-panel p-5 rounded-3xl border border-white/50 dark:border-slate-800 relative overflow-hidden shadow-xs hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">
                {lang === 'ar' ? 'تكاليف السلع المباعة (COGS)' : 'Cost of Goods Sold'}
              </span>
              <span className="text-xl font-extrabold text-slate-950/80 dark:text-slate-350 tracking-tight mt-1 inline-block">
                {metrics.costOfGoodsSold.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
              </span>
            </div>
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-750 dark:text-rose-450 rounded-2xl border border-rose-100 dark:border-rose-900">
              <Layers className="w-5 h-5" id="stats_layers_icon" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3.5 text-[9px] text-rose-600 dark:text-rose-400 font-extrabold font-mono bg-rose-50 dark:bg-rose-950/30 w-fit px-2 py-0.5 rounded-lg border dark:border-rose-900">
            <ArrowDownRight className="w-3 h-3" />
            {lang === 'ar' ? 'تكلفة شراء رأس مال البضائع' : 'Buying value of the checkout inventory'}
          </div>
        </div>

        {/* Net Profit */}
        <div className="glass-panel p-5 rounded-3xl border border-emerald-500/25 relative overflow-hidden shadow-md bg-linear-to-b from-white to-emerald-500/5 dark:from-slate-900 dark:to-emerald-950/15">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-emerald-800 dark:text-emerald-400 block font-black uppercase tracking-wider">
                {lang === 'ar' ? '💵 صافي أرباح المحل الخالصة' : '💵 True Margins & Net Profit'}
              </span>
              <span className="text-2xl font-black text-emerald-800 dark:text-emerald-300 tracking-tight mt-1 inline-block">
                {metrics.netProfit.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
              </span>
            </div>
            <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-sm">
              <DollarSign className="w-5 h-5" id="stats_profit_icon" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-[9px] text-emerald-800 dark:text-emerald-300 font-extrabold font-mono bg-emerald-100/50 dark:bg-emerald-950/30 w-fit px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <Award className="w-3.5 h-3.5 text-yellow-600" />
            {lang === 'ar' ? 'الربح الصافي في جيبك' : 'Calculated true pocket margins'}
          </div>
        </div>
      </div>

      {/* Credit & Debt Board */}
      <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 text-start mt-6 flex items-center gap-1.5">
        <Wallet className="w-4 h-4 text-emerald-600" />
        {lang === 'ar' ? 'خلاصة وضع ديون وكريدي المحل والمستحقات والالتزامات' : 'Credit Risk & Debt Outstanding Ledger'}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-start">
        {/* Customer credit */}
        <div className="glass-panel p-6 rounded-3xl border border-amber-600/10 bg-linear-to-b from-white to-amber-500/5 dark:from-slate-900 dark:to-amber-950/10">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-black text-amber-900 dark:text-amber-400">{lang === 'ar' ? '💳 كريدي مستحق للزبائن للقبض (التقسيط)' : 'Customer Debt Portfolio'}</span>
            <span className="text-base font-black text-amber-700 dark:text-amber-300 font-mono">
              +{metrics.totalCustomerDebt.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {lang === 'ar' 
              ? 'مجموع ديون أجهزة الهواتف المبيعة بالتقسيط أو بالكريدي للزبائن والتي يحق للمحل قبضها لاحقاً.'
              : 'Accumulated pending receivables to collect from installment clients who purchased products.'}
          </p>
        </div>

        {/* Supplier debit */}
        <div className="glass-panel p-6 rounded-3xl border border-rose-600/15 bg-linear-to-b from-white to-rose-500/5 dark:from-slate-900 dark:to-rose-950/10">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-black text-rose-950 dark:text-rose-400">{lang === 'ar' ? '💸 ديون المحل المطلوبة للموردين (سلع بالكريدي)' : 'Supplier Payables Balance'}</span>
            <span className="text-base font-black text-rose-600 dark:text-rose-300 font-mono">
              -{metrics.totalSupplierDebt.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {lang === 'ar' 
              ? 'الكريدي المتبقي للموردين والمستوردين للقطع والهواتف الفورية والتي يتوجب على المحل سدادها لاحقاً.'
              : 'Total outstanding funds that your store must pay back to wholesale electronics vendors.'}
          </p>
        </div>
      </div>

      {/* DETAILED SOLD ITEMS LOG PANEL & REFUND CONTROLLER */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-100 dark:border-slate-800 text-start space-y-4">
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-start">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShoppingCart className="w-4.5 h-4.5 text-sky-600 animate-pulse" />
              {lang === 'ar' ? 'سجل المبيعات والسلع المباعة وتتبع المرتجعات' : 'Delivered Items Journal & Customer Returns'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {lang === 'ar' ? 'تفاصيل كل الفواتير المخرجة من الكاشير وإمكانية السداد أو الإرجاع التلقائي' : 'Complete checkout log with modular inventory returns.'}
            </p>
          </div>

          {/* Table search filter */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder={lang === 'ar' ? 'البحث بالزبون، السلعة أو رقم الفاتورة...' : 'Filter by customer, item, invoice...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs pr-8 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent dark:text-slate-200 font-medium"
            />
            <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400" />
          </div>
        </div>

        {/* Sales record history table list */}
        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
          <table className="w-full text-xs text-left text-slate-500 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-center">
              <tr>
                <th className="px-4 py-3">{lang === 'ar' ? 'رقم الفاتورة' : 'Invoice'}</th>
                <th className="px-4 py-3">{lang === 'ar' ? 'تاريخ العملية' : 'Transaction Date'}</th>
                <th className="px-4 py-3">{lang === 'ar' ? 'العميل والكاشير' : 'Client & Staff'}</th>
                <th className="px-4 py-3">{lang === 'ar' ? 'تفاصيل البضائع المباعة' : 'Sold Products Details'}</th>
                <th className="px-4 py-3">{lang === 'ar' ? 'طريقة الدفع' : 'Pay Method'}</th>
                <th className="px-4 py-3">{lang === 'ar' ? 'القيمة الإجمالية' : 'Total Net'}</th>
                <th className="px-4 py-3">{lang === 'ar' ? 'حالة المرتجع' : 'Status'}</th>
                <th className="px-4 py-3">{lang === 'ar' ? 'إجراء الإرجاع' : 'Refund Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-center">
              {filteredSalesTableList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 font-medium font-sans">
                    {lang === 'ar' ? '📪 لا توجد مبيعات مطابقة لمعايير البحث في هذا التاريخ!' : '📪 No checkout matches found in database.'}
                  </td>
                </tr>
              ) : (
                filteredSalesTableList.map((sale) => {
                  const timestampStr = new Date(sale.date).toLocaleString(lang === 'ar' ? 'ar-DZ' : 'fr-FR');
                  
                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      {/* Invoice identification */}
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-200">
                        <span className="bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-355 px-2 py-1 rounded-lg border dark:border-slate-700 font-mono">
                          {sale.invoiceNumber}
                        </span>
                      </td>

                      {/* Created date/time */}
                      <td className="px-4 py-3 text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1 justify-center">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>{timestampStr}</span>
                        </div>
                      </td>

                      {/* Cashier and related customer client */}
                      <td className="px-4 py-3 text-start">
                        <p className="font-extrabold text-slate-800 dark:text-slate-200">{sale.customerName || (lang === 'ar' ? 'زبون عابر' : 'Walk-in Client')}</p>
                        <p className="text-[9px] text-slate-400 font-medium truncate">{lang === 'ar' ? 'البائع:' : 'Cashier:'} {sale.cashierName}</p>
                      </td>

                      {/* Detailed item descriptors bubble tags */}
                      <td className="px-4 py-3 text-start max-w-[280px]">
                        <div className="space-y-1">
                          {sale.items.map((itm, iidx) => {
                            const isItemReturned = itm.returnedQuantity && itm.returnedQuantity >= itm.quantity;
                            const isPartiallyReturned = itm.returnedQuantity && itm.returnedQuantity < itm.quantity;
                            
                            return (
                              <div 
                                key={iidx} 
                                className={`p-1.5 rounded-lg border text-[11px] leading-tight flex justify-between items-center ${
                                  isItemReturned 
                                    ? 'bg-rose-50/70 border-rose-100 text-rose-700 line-through dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400' 
                                    : isPartiallyReturned
                                    ? 'bg-amber-50/60 border-amber-100 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-300'
                                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/50 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <div>
                                  <span className="font-bold">{itm.name}</span>
                                  {itm.serialNumber && (
                                    <span className="block text-[8px] text-slate-400 font-mono">IMEI: {itm.serialNumber}</span>
                                  )}
                                </div>
                                <span className="font-bold shrink-0 ml-2">
                                  {itm.quantity} × {itm.price.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                                  {itm.returnedQuantity ? (
                                    <span className="block text-[9px] text-red-600 dark:text-red-400 font-black">
                                      ({lang === 'ar' ? `مرتجع: ${itm.returnedQuantity}` : `Ret: ${itm.returnedQuantity}`})
                                    </span>
                                  ) : null}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Payment method */}
                      <td className="px-4 py-3 font-semibold text-[10px] whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full ${
                          sale.paymentMethod === 'cash' 
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' 
                            : sale.paymentMethod === 'card' 
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' 
                            : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                        }`}>
                          {sale.paymentMethod === 'cash' 
                            ? (lang === 'ar' ? 'نقدي (كاش)' : 'Cash') 
                            : sale.paymentMethod === 'card' 
                            ? (lang === 'ar' ? 'بطاقة بنكية' : 'Card') 
                            : (lang === 'ar' ? 'بالتقسيط' : 'Installments')}
                        </span>
                      </td>

                      {/* Grand sum values */}
                      <td className="px-4 py-3 font-extrabold text-slate-900 dark:text-white font-mono whitespace-nowrap text-right">
                        <div>
                          <p>{sale.total.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}</p>
                          {sale.returnedAmount ? (
                            <p className="text-[9px] text-rose-500 font-bold">
                              ({lang === 'ar' ? `مسترجع: ${sale.returnedAmount.toLocaleString()}` : `Ref: ${sale.returnedAmount.toLocaleString()}`})
                            </p>
                          ) : null}
                        </div>
                      </td>

                      {/* Current Return Status badge indicators */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {sale.status === 'returned' ? (
                          <span className="bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 text-[10px] font-black px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-900/30">
                            ✕ {lang === 'ar' ? 'مرتجع بالكامل' : 'Returned'}
                          </span>
                        ) : sale.status === 'partially_returned' ? (
                          <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-black px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-900/30 font-sans">
                            🔄 {lang === 'ar' ? 'مرتجع جزئياً' : 'Part Refunded'}
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-900/30">
                            ✓ {lang === 'ar' ? 'مبيعة مكتملة' : 'Completed'}
                          </span>
                        )}
                      </td>

                      {/* Refund modal launcher buttons */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            disabled={sale.status === 'returned'}
                            onClick={() => openReturnModal(sale)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${
                              sale.status === 'returned'
                                ? 'bg-slate-100 text-slate-400 opacity-55 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-450 border border-rose-200/40'
                            }`}
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'مسترجع مبيعة' : 'Return'}</span>
                          </button>

                          <button
                            onClick={() => handleDeleteSale(sale)}
                            className="bg-red-50 hover:bg-red-100 dark:bg-rose-955/20 dark:hover:bg-rose-900/40 text-rose-600 p-1.5 rounded-xl border border-red-200/40 hover:scale-105 transition-transform"
                            title={lang === 'ar' ? 'حذف الفاتورة كلياً' : 'Delete Invoice'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {subTab === 'warranty' && (
        <div className="space-y-6 text-start">
          {/* Active Expiring Warranties warning alerts */}
          {(() => {
            const activeSalesWithWarranty = sales.filter(s => {
              const info = getWarrantyInfo(s.date, s.warrantyPeriod || '');
              return info && info.status === 'expiring';
            });
            
            if (activeSalesWithWarranty.length === 0) return null;

            return (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-3xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-extrabold text-xs text-amber-900 dark:text-amber-400">
                    {lang === 'ar' ? 'تنبيه هائل: أجهزة وصلاحيات كفالة تنتهي هذا الأسبوع (أقل من 7 أيام)' : 'Operational Attention: Warranties Expiring This Week'}
                  </h4>
                  <p className="text-[10.5px] text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                    {lang === 'ar'
                      ? `هناك عدد (${activeSalesWithWarranty.length}) هاتف/سلعة تنتهي الكفالة الخاصة بهما قريباً. ننصح بمراجعة أرقام IMEI لتفادي الخلافات.`
                      : `Found ${activeSalesWithWarranty.length} protected item(s) facing warranty expiration within 7 calendar days.`}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Core Analytics cards for Warranties */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-start">
            <div className="glass-panel p-5 rounded-3xl border border-white/50 dark:border-slate-850 relative overflow-hidden shadow-xs hover:shadow-md transition-shadow">
              <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">{lang === 'ar' ? 'إجمالي الكفالات النشطة والآمنة' : 'Total Active Warranties'}</span>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {sales.filter(s => {
                  const info = getWarrantyInfo(s.date, s.warrantyPeriod || '');
                  return info && info.status !== 'expired';
                }).length} <span className="text-xs font-semibold text-slate-400">/ {sales.length}</span>
              </h3>
            </div>
            <div className="glass-panel p-5 rounded-3xl border border-white/50 dark:border-slate-850 relative overflow-hidden shadow-xs hover:shadow-md transition-shadow">
              <span className="text-[10px] text-slate-550 block font-bold uppercase tracking-wider">{lang === 'ar' ? 'كفالات متبقي لها أقل من أسبوع' : 'Expiring Handsets Guard'}</span>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
                {sales.filter(s => {
                  const info = getWarrantyInfo(s.date, s.warrantyPeriod || '');
                  return info && info.status === 'expiring';
                }).length}
              </h3>
            </div>
            <div className="glass-panel p-5 rounded-3xl border border-white/50 dark:border-slate-850 relative overflow-hidden shadow-xs hover:shadow-md transition-shadow">
              <span className="text-[10px] text-slate-550 block font-bold uppercase tracking-wider">{lang === 'ar' ? 'كفالات منتهية الصلاحية كلياً' : 'Total Expired Guarantees'}</span>
              <h3 className="text-2xl font-black text-slate-550 mt-1 font-mono">
                {sales.filter(s => {
                  const info = getWarrantyInfo(s.date, s.warrantyPeriod || '');
                  return info && info.status === 'expired';
                }).length}
              </h3>
            </div>
          </div>

          {/* Warranty Inspection List */}
          <div className="glass-panel rounded-3xl p-6 border border-white/45 relative overflow-hidden dark:bg-slate-900/40 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 gap-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">
                  {lang === 'ar' ? 'سجل وكاشف الضمانات الذكي بالأرقام التسلسلية (IMEI / Warranties)' : 'IMEI Warranties Live Directory'}
                </h3>
                <p className="text-[10.5px] text-slate-505 dark:text-slate-400 leading-normal">
                  {lang === 'ar' ? 'ابحث عن أي هاتف أو إيصال بـ IMEI للتحقق من تاريخ البداية والنهاية والأيام المتبقية تلقائياً.' : 'Query database via IMEI, Customer details or brand to inspect warranty countdowns.'}
                </p>
              </div>
            </div>

            {/* Query bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={lang === 'ar' ? 'ابحث بالرقم التسلسلي IMEI، اسم العميل، اسم الهاتف...' : 'Query barcode, serial, brand, client label ...'}
                value={warrantySearchQuery}
                onChange={e => setWarrantySearchQuery(e.target.value)}
                className="text-xs bg-white dark:bg-slate-850 dark:border-slate-800 dark:text-white w-full border border-slate-200 py-2.5 pl-9 pr-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
              />
            </div>

            {/* List */}
            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
              <table className="w-full text-xs text-left text-slate-550 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-800/50 uppercase text-[10px] text-slate-600 dark:text-slate-300 font-bold text-center">
                  <tr>
                    <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'رمز الفاتورة' : 'Invoice ID'}</th>
                    <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'اسم العميل' : 'Client Profile'}</th>
                    <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'الهواتف والسلع' : 'Protected Goods'}</th>
                    <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'رقم الكود IMEI / سيريال' : 'IMEI / Serial'}</th>
                    <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'صلاحية الكفالة' : 'Warranty Type'}</th>
                    <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'فترة التغطية المحددة' : 'Coverage Period'}</th>
                    <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'الوضعية والحالة' : 'Status Alerts'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-center">
                  {sales
                    .filter(s => {
                      // Only show sales where a product has a serial/IMEI or warranty period is specified
                      const hasWarranty = s.warrantyPeriod && s.warrantyPeriod !== 'no_warranty' && s.warrantyPeriod !== 'بدون' && s.warrantyPeriod !== 'لا يوجد ضـمان';
                      const hasSerial = s.items.some(i => i.serialNumber && i.serialNumber.trim() !== '');
                      return hasWarranty || hasSerial;
                    })
                    .filter(s => {
                      if (!warrantySearchQuery) return true;
                      const q = warrantySearchQuery.toLowerCase();
                      const matchInvoice = s.invoiceNumber.toLowerCase().includes(q);
                      const matchCustomer = (s.customerName || '').toLowerCase().includes(q);
                      const matchItemName = s.items.some(i => i.name.toLowerCase().includes(q) || (i.serialNumber || '').toLowerCase().includes(q));
                      return matchInvoice || matchCustomer || matchItemName;
                    })
                    .length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-bold font-sans">
                        {lang === 'ar' ? '📪 لا توجد مبيعات متطابقة تحتوي على كود IMEI أو أجهزة نشطة تحت الضمان.' : 'No warrantied hardware signatures registered yet.'}
                      </td>
                    </tr>
                  ) : (
                    sales
                      .filter(s => {
                        const hasWarranty = s.warrantyPeriod && s.warrantyPeriod !== 'no_warranty' && s.warrantyPeriod !== 'بدون' && s.warrantyPeriod !== 'لا يوجد ضـمان';
                        const hasSerial = s.items.some(i => i.serialNumber && i.serialNumber.trim() !== '');
                        return hasWarranty || hasSerial;
                      })
                      .filter(s => {
                        if (!warrantySearchQuery) return true;
                        const q = warrantySearchQuery.toLowerCase();
                        const matchInvoice = s.invoiceNumber.toLowerCase().includes(q);
                        const matchCustomer = (s.customerName || '').toLowerCase().includes(q);
                        const matchItemName = s.items.some(i => i.name.toLowerCase().includes(q) || (i.serialNumber || '').toLowerCase().includes(q));
                        return matchInvoice || matchCustomer || matchItemName;
                      })
                      .map(s => {
                        const info = getWarrantyInfo(s.date, s.warrantyPeriod || '');
                        if (!info) return null;

                        return (
                          <tr key={s.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-3 font-bold font-mono text-[10px] text-slate-900 dark:text-white text-start">#{s.invoiceNumber}</td>
                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-350 text-start">{s.customerName || (lang === 'ar' ? 'زبون عابر (نقدي)' : 'Retail Client')}</td>
                            <td className="px-4 py-3 text-start whitespace-nowrap">
                              {s.items.map((i, idx) => (
                                <div key={idx} className="font-extrabold text-slate-800 dark:text-slate-200">📱 {i.name}</div>
                              ))}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs font-black text-rose-600 text-center whitespace-nowrap">
                              {s.items.map((i, idx) => (
                                <div key={idx} className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100/50 px-2 py-0.5 rounded-lg inline-block">{i.serialNumber || (lang === 'ar' ? 'لا يوجد سيريال' : 'N/A')}</div>
                              ))}
                            </td>
                            <td className="px-4 py-3 text-slate-650 dark:text-slate-300 font-extrabold text-center">{s.warrantyPeriod}</td>
                            <td className="px-4 py-3 text-center whitespace-nowrap font-mono">
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold">{info.startDateStr}</span>
                              <span className="mx-1 text-slate-300">→</span>
                              <span className="text-[10px] text-red-500 font-extrabold">{info.endDateStr}</span>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              {info.status === 'active' ? (
                                <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-150 px-2 py-1 rounded-xl text-[9px] font-black">
                                  ✓ {lang === 'ar' ? `نشط (${info.remainingDays} يـوم)` : `Active (${info.remainingDays} d)`}
                                </span>
                              ) : info.status === 'expiring' ? (
                                <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-150 px-2 py-1 rounded-xl text-[9px] font-black animate-pulse">
                                  ⚠️ {lang === 'ar' ? `يوشك على الانتهاء (${info.remainingDays} يـوم)` : `Expiring (${info.remainingDays} d)`}
                                </span>
                              ) : (
                                <span className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 px-2 py-1 rounded-xl text-[9px] font-black">
                                  ✕ {lang === 'ar' ? 'منتهي الصلاحية' : 'Warranty Expired'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: EXPENSES TRACKER */}
      {subTab === 'expenses' && (
        <div className="space-y-6 text-start">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">
                {lang === 'ar' ? 'مصاريف المحل والتشغيل' : 'Business Expense Tracker'}
              </h3>
              <p className="text-[10.5px] text-slate-505">
                {lang === 'ar' ? 'تتبع الإيجارات، الفواتير، الأجور لضبط صافي الأرباح.' : 'Log operational costs to automatically offset gross margins.'}
              </p>
            </div>
            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-1 shadow-md hover:scale-102 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'إضافة مصروف جديد' : 'New Expense'}</span>
            </button>
          </div>

          <div className="glass-panel p-6 rounded-3xl border">
            <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-xs text-left text-slate-500">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-600 font-bold uppercase text-center">
                  <tr>
                    <th className="px-4 py-3 text-start">{lang === 'ar' ? 'التفاصيل / البيان' : 'Expense Title'}</th>
                    <th className="px-4 py-3 text-center">{lang === 'ar' ? 'الفئة' : 'Category'}</th>
                    <th className="px-4 py-3 text-center">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                    <th className="px-4 py-3 text-end">{lang === 'ar' ? 'المبلغ د.ج' : 'Amount'}</th>
                    <th className="px-4 py-3 text-center">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-center text-slate-705 dark:text-slate-300">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                        {lang === 'ar' ? '📪 لا توجد مصاريف مسجلة حتى الآن.' : 'No recorded operational business costs.'}
                      </td>
                    </tr>
                  ) : (
                    expenses.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="px-4 py-3 text-start font-bold">{e.title}</td>
                        <td className="px-4 py-3 text-center text-[10px]">
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md font-mono uppercase font-black text-slate-605 dark:text-slate-350">
                            {e.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono opacity-80">{e.date}</td>
                        <td className="px-4 py-3 text-end font-black text-rose-600 font-mono">
                          -{e.amount.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteExpense(e.id, e.amount)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-650 dark:bg-rose-950/20 p-1.5 rounded-xl border border-rose-200/20 cursor-pointer"
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
        </div>
      )}

      {/* SUBTAB: PRE-ORDER BOOKINGS */}
      {subTab === 'bookings' && (
        <div className="space-y-6 text-start">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">
                {lang === 'ar' ? 'طلبات الحجز المسبق والهواتف المطلوبة' : 'Client Pre-order Bookings'}
              </h3>
              <p className="text-[10.5px] text-slate-505">
                {lang === 'ar' ? 'سجل الهواتف التي يطلبها الزبائن وتتبع توفرها للاتصال بهم.' : 'Track hardware bookings requested by recurring customers.'}
              </p>
            </div>
            <button
              onClick={() => setShowAddBookingModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-1 shadow-md hover:scale-102 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'تسجيل حجز جديد' : 'New Pre-order'}</span>
            </button>
          </div>

          <div className="glass-panel p-6 rounded-3xl border">
            <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-xs text-left text-slate-500">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-600 font-bold uppercase text-center">
                  <tr>
                    <th className="px-4 py-3 text-start">{lang === 'ar' ? 'اسم العميل' : 'Customer'}</th>
                    <th className="px-4 py-3 text-start">{lang === 'ar' ? 'رقم الهاتف' : 'Phone'}</th>
                    <th className="px-4 py-3 text-center">{lang === 'ar' ? 'المنتج / موديل الجهاز' : 'Requested Handset'}</th>
                    <th className="px-4 py-3 text-center">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                    <th className="px-4 py-3 text-center">{lang === 'ar' ? 'إجراءات وتحديث الحالة' : 'Actions & Status Update'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-center text-slate-705 dark:text-slate-300">
                  {bookings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                        {lang === 'ar' ? '📪 لا توجد حجوزات مسجلة حالياً.' : 'No customer pre-order requests logged.'}
                      </td>
                    </tr>
                  ) : (
                    bookings.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="px-4 py-3 text-start font-bold">{b.customerName}</td>
                        <td className="px-4 py-3 text-start font-mono font-bold text-slate-605 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-cyan-600" />
                            {b.customerPhone}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-extrabold text-emerald-600">📱 {b.productName}</td>
                        <td className="px-4 py-3 text-center">
                          {b.status === 'pending' ? (
                            <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/55 px-2 py-0.5 rounded-lg text-[9px] font-black">
                              {lang === 'ar' ? 'قيد الانتظار' : 'Pending'}
                            </span>
                          ) : b.status === 'available' ? (
                            <span className="bg-cyan-50 text-cyan-705 dark:bg-cyan-950/30 dark:text-cyan-400 border border-cyan-200/55 px-2 py-0.5 rounded-lg text-[9px] font-black animate-pulse">
                              {lang === 'ar' ? 'متوفر بالمخزن' : 'In Stock'}
                            </span>
                          ) : b.status === 'notified' ? (
                            <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/55 px-2 py-0.5 rounded-lg text-[9px] font-black">
                              {lang === 'ar' ? 'تم إعلام الزبون' : 'Customer Notified'}
                            </span>
                          ) : (
                            <span className="bg-slate-105 text-slate-500 dark:bg-slate-800 px-2 py-0.5 rounded-lg text-[9px] font-bold">
                              {lang === 'ar' ? 'ملغي' : 'Cancelled'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleUpdateBookingStatus(b.id, 'available')}
                              className="text-[9px] bg-cyan-50 hover:bg-cyan-100 text-cyan-705 dark:bg-cyan-950/20 px-2 py-1 rounded-lg border font-bold cursor-pointer"
                              title={lang === 'ar' ? 'تحديد كـ متوفر للبيع' : 'Set Available'}
                            >
                              {lang === 'ar' ? 'توفر' : 'Available'}
                            </button>
                            <button
                              onClick={() => handleUpdateBookingStatus(b.id, 'notified')}
                              className="text-[9px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 px-2 py-1 rounded-lg border font-bold cursor-pointer"
                              title={lang === 'ar' ? 'تحديد كـ تم الإعلام' : 'Set Notified'}
                            >
                              {lang === 'ar' ? 'علمت' : 'Notified'}
                            </button>
                            <button
                              onClick={() => handleDeleteBooking(b.id)}
                              className="bg-red-50 hover:bg-red-100 text-red-655 p-1.5 rounded-lg border border-red-200/20 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
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
      )}

      {/* SUBTAB: BARCODE STOCK AUDITS */}
      {subTab === 'audits' && (
        <div className="space-y-6 text-start">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">
                {lang === 'ar' ? 'سجل وإدارة جرد المخازن والباركود' : 'Inventory Stock Audits'}
              </h3>
              <p className="text-[10.5px] text-slate-505">
                {lang === 'ar' ? 'قارن الكميات المتوفرة على الرف فجأة بالكميات في السيرفر وتدارك السرقة أو التلف.' : 'Run physical ledger comparisons to verify missing stock units.'}
              </p>
            </div>
            <button
              onClick={() => {
                setDraftAuditFindings([]);
                setShowAuditModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-1 shadow-md hover:scale-102 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'بدء عملية جرد جديدة' : 'Conduct Audit'}</span>
            </button>
          </div>

          <div className="glass-panel p-6 rounded-3xl border">
            <h4 className="font-black text-slate-800 dark:text-slate-100 text-xs mb-4 uppercase tracking-wider">{lang === 'ar' ? '📋 التقارير السابقة المعتمدة للجرد' : '📋 Past Stock Audit Manifests'}</h4>
            
            <div className="space-y-4">
              {audits.length === 0 ? (
                <div className="py-8 text-center text-slate-400 font-bold border border-dashed rounded-2xl">
                  {lang === 'ar' ? '📪 لم يتم تقييد أو تسجيل تقارير جرد سابقة.' : 'No historic audit records registered.'}
                </div>
              ) : (
                audits.map(a => (
                  <div key={a.id} className="p-4 border dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-905 space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div>
                        <span className="text-[10px] text-slate-450 font-mono">ID: {a.id}</span>
                        <h5 className="font-black text-xs text-slate-800 dark:text-white mt-0.5">
                          {lang === 'ar' ? `جرد بواسطة: ${a.checkedBy}` : `Inspected by: ${a.checkedBy}`}
                        </h5>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-705 dark:text-slate-300 px-2 py-0.5 rounded">
                          {a.date}
                        </span>
                        <button
                          onClick={() => handleDeleteAudit(a.id)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1 rounded-lg border cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] text-left">
                        <thead>
                          <tr className="text-slate-500 font-extrabold border-b">
                            <th className="py-1 text-start">{lang === 'ar' ? 'السلعة' : 'Product'}</th>
                            <th className="py-1 text-center">{lang === 'ar' ? 'الباركود' : 'Barcode'}</th>
                            <th className="py-1 text-center">{lang === 'ar' ? 'المتوقع بالنظام' : 'Expected Qty'}</th>
                            <th className="py-1 text-center">{lang === 'ar' ? 'الفعلي الرف' : 'Shelf Qty'}</th>
                            <th className="py-1 text-end">{lang === 'ar' ? 'الفارق' : 'Difference'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                          {a.findings.map((f, i) => (
                            <tr key={i} className="text-slate-700 dark:text-slate-300">
                              <td className="py-1.5 text-start font-bold text-slate-850 dark:text-slate-100">{f.name}</td>
                              <td className="py-1.5 text-center font-mono text-slate-500">{f.barcode}</td>
                              <td className="py-1.5 text-center font-black font-mono">{f.expectedQty}</td>
                              <td className="py-1.5 text-center font-black font-mono text-emerald-600">{f.actualQty}</td>
                              <td className={`py-1.5 text-end font-black font-mono ${f.difference < 0 ? 'text-red-500 font-bold' : f.difference > 0 ? 'text-blue-500' : 'text-slate-400'}`}>
                                {f.difference === 0 ? '0' : f.difference > 0 ? `+${f.difference}` : f.difference}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: DIAGNOSTIC USED PHONE ASSESSMENTS */}
      {subTab === 'assessments' && (
        <div className="space-y-6 text-start">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">
                {lang === 'ar' ? 'فحص جودة وتقييم الهواتف المستعملة' : 'Used Phone Diagnostics Desk'}
              </h3>
              <p className="text-[10.5px] text-slate-505">
                {lang === 'ar' ? 'قم بالفحص الأوتوماتيكي للحساسات والشاشات قبل شراء هاتف مستعمل من مواطن.' : 'Assess dynamic hardware specs for used devices safely.'}
              </p>
            </div>
            <button
              onClick={() => setShowAssessModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-1 shadow-md hover:scale-102 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'إنشاء ورقة فحص جديدة' : 'New Diagnostics'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assessments.length === 0 ? (
              <div className="col-span-1 md:col-span-2 py-8 text-center text-slate-400 font-bold border border-dashed rounded-3xl">
                {lang === 'ar' ? '📪 لا توجد أدلة فنية لتقييمات مستعملة.' : 'No diagnostic assessment cards logged.'}
              </div>
            ) : (
              assessments.map(ast => (
                <div key={ast.id} className="p-5 border dark:border-slate-800 bg-white dark:bg-slate-905 rounded-3xl space-y-4 hover:shadow-md transition-shadow relative overflow-hidden">
                  <div className="absolute right-3 top-3 flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase ${
                      ast.checks.overallStatus === 'excellent' ? 'bg-emerald-50 text-emerald-750 dark:bg-emerald-950/30 dark:text-emerald-450' :
                      ast.checks.overallStatus === 'good' ? 'bg-cyan-50 text-cyan-705 dark:bg-cyan-950/30' :
                      ast.checks.overallStatus === 'fair' ? 'bg-amber-50 text-amber-705' : 'bg-rose-50 text-rose-705'
                    }`}>
                      {ast.checks.overallStatus}
                    </span>
                    <button
                      onClick={() => handleDeleteAssessment(ast.id)}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-650 p-1.5 rounded-xl border border-rose-200/20 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="border-b dark:border-slate-800 pb-2">
                    <h4 className="font-extrabold text-base text-slate-850 dark:text-slate-100">📱 {ast.model}</h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">IMEI: {ast.imei} • {new Date(ast.createdAt).toLocaleDateString()}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] font-sans">
                    <div className="flex justify-between items-center border-b pb-1 dark:border-slate-800/50">
                      <span className="text-slate-500">{lang === 'ar' ? 'بصمة الوجه / الإصبع' : 'Fingerprint / Face ID'}</span>
                      <span className={`font-bold uppercase ${ast.checks.faceIdOrTouchId === 'pass' ? 'text-emerald-600' : 'text-rose-500'}`}>{ast.checks.faceIdOrTouchId}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-1 dark:border-slate-800/50">
                      <span className="text-slate-500">{lang === 'ar' ? 'صحة البطارية' : 'Battery Health'}</span>
                      <span className="font-mono font-black text-cyan-600">{ast.checks.batteryHealth}%</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-1 dark:border-slate-800/50">
                      <span className="text-slate-500">{lang === 'ar' ? 'الشاشة أصلية' : 'Screen Original'}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-205">{ast.checks.screenOriginal === 'yes' ? 'Original' : 'Replaced'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-1 dark:border-slate-800/50">
                      <span className="text-slate-500">{lang === 'ar' ? 'منفذ الشحن' : 'Charging Port'}</span>
                      <span className={`font-bold ${ast.checks.chargingPort === 'yes' ? 'text-emerald-600' : 'text-rose-500'}`}>{ast.checks.chargingPort === 'yes' ? 'Pass' : 'Error'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-1 dark:border-slate-800/50">
                      <span className="text-slate-500">{lang === 'ar' ? 'الكاميرا والعدسات' : 'Cameras Working'}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-205">{ast.checks.cameraWorking}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-1 dark:border-slate-800/50">
                      <span className="text-slate-500">{lang === 'ar' ? 'حالة الهيكل الخارجي' : 'Body Shell'}</span>
                      <span className="font-bold text-amber-600 uppercase">{ast.checks.bodyCondition}</span>
                    </div>
                  </div>

                  {ast.technicianNotes && (
                    <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-2xl border dark:border-slate-800 text-[10.5px] italic text-slate-600 dark:text-slate-350 leading-relaxed">
                      💡 {ast.technicianNotes}
                    </div>
                  )}

                  <div className="text-[9.5px] text-slate-420 text-end">
                    {lang === 'ar' ? `فحص بواسطة الفني: ${ast.technicianName}` : `Certified Tech: ${ast.technicianName}`}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUBTAB: TEAM COMMISSIONS LEDGER */}
      {subTab === 'employees' && (
        <div className="space-y-6 text-start">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">
              {lang === 'ar' ? 'فريق العمل، المبيعات والعمولات المسجلة' : 'Employees Performance & Commissions Ledger'}
            </h3>
            <p className="text-[10.5px] text-slate-505 mt-1">
              {lang === 'ar' ? 'حساب الحوافز تلقائياً لكل كاشير أو فني بناءً على حركة فواتيره وقيمتها لزيادة المردودية.' : 'Calculate incentive commissions based on sales volumes.'}
            </p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {(() => {
                const staffMap: Record<string, { name: string, salesCount: number, salesVolume: number, repairsCount: number, commission: number }> = {};
                
                sales.forEach(s => {
                  if (s.status === 'returned') return;
                  const cId = s.cashierId || 'retail_cashier';
                  const cName = s.cashierName || 'Cashier User';
                  if (!staffMap[cId]) {
                    staffMap[cId] = { name: cName, salesCount: 0, salesVolume: 0, repairsCount: 0, commission: 0 };
                  }
                  staffMap[cId].salesCount++;
                  staffMap[cId].salesVolume += s.total;
                  staffMap[cId].commission += s.total * 0.01;
                });

                const jobs = DzStoreDB.getMaintenanceJobs(shopId);
                jobs.forEach(j => {
                  if (j.status !== 'delivered') return;
                  const tId = j.technicianId || 'retail_tech';
                  const tName = j.technicianName || 'Repair Tech';
                  if (!staffMap[tId]) {
                    staffMap[tId] = { name: tName, salesCount: 0, salesVolume: 0, repairsCount: 0, commission: 0 };
                  }
                  staffMap[tId].repairsCount++;
                  staffMap[tId].commission += (j.finalCost - j.amountPaid) * 0.1;
                });

                const staffList = Object.values(staffMap);

                if (staffList.length === 0) {
                  return (
                    <div className="col-span-3 py-8 text-center text-slate-400 font-bold border rounded-2xl">
                      {lang === 'ar' ? '📪 لا توجد بيانات أداء للموظفين بعد.' : 'No active staff metrics indexed.'}
                    </div>
                  );
                }

                return staffList.map((st, i) => (
                  <div key={i} className="p-5 border bg-white dark:bg-slate-905 rounded-3xl space-y-4 hover:scale-102 transition-transform shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold font-mono">
                        {(st.name || 'U').slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs text-slate-805 dark:text-white capitalize">{st.name}</h4>
                        <span className="text-[10px] text-slate-400">{lang === 'ar' ? 'فريق العمل الفني' : 'Registered Staff Member'}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center text-slate-500">
                        <span>{lang === 'ar' ? 'عمليات مبيعات الكاش' : 'Cash Sales Done'}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-105">{st.salesCount}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span>{lang === 'ar' ? 'مجموع إيرادات المبيعات' : 'Sales Volume Generated'}</span>
                        <span className="font-bold font-mono text-emerald-600">{st.salesVolume.toLocaleString()} DZD</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span>{lang === 'ar' ? 'أجهزة صيانة تم تسليمها' : 'Repairs Delivered'}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-150">{st.repairsCount}</span>
                      </div>
                      <div className="border-t pt-2 mt-2 flex justify-between items-center font-bold">
                        <span className="text-slate-800 dark:text-slate-205">{lang === 'ar' ? 'الحوافز المكتسبة (الكوميسيون)' : 'Earned Commission'}</span>
                        <span className="text-emerald-600 font-black font-mono text-sm">
                          +{Math.round(st.commission).toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                        </span>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: INTELLIGENT AI STORE COPILOT */}
      {subTab === 'ai-chat' && (
        <div className="space-y-6 text-start">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-sm text-slate-805 dark:text-white flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-600 animate-pulse" />
                {lang === 'ar' ? 'جيميناي مستشارك التجاري الذكي (AI Advisor)' : 'Gemini AI Intelligent Business Advisor'}
              </h3>
              <p className="text-[10.5px] text-slate-505 mt-1">
                {lang === 'ar' ? 'اطرح أي أسئلة على المستشار الذكي حول جودة المبيعات، توجيه الأرباح أو السلع المنتهية.' : 'Ask Gemini anything about inventories, net balance margins, or sales forecasts.'}
              </p>
            </div>
            
            <button
              onClick={async () => {
                setAiLoading(true);
                setAiChatHistory(prev => [...prev, { role: 'user', content: lang === 'ar' ? 'أعطني تحليلاً مالياً وتخمينات جرد شاملة للمحل' : 'Please provide a complete accounts diagnostic analysis of my shop' }]);
                try {
                  const r = await fetch('/api/gemini/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ products, sales, expenses, lang })
                  });
                  const rD = await r.json();
                  if (rD.success && rD.analysis) {
                    setAiChatHistory(prev => [...prev, { role: 'assistant', content: rD.analysis }]);
                    DzStoreAudio.playSuccessChime(true);
                  } else {
                    const errTxt = typeof rD.message === 'object' ? (rD.message[lang] || rD.message['en']) : rD.message;
                    setAiChatHistory(prev => [...prev, { role: 'assistant', content: errTxt || 'Network error' }]);
                  }
                } catch {
                  setAiChatHistory(prev => [...prev, { role: 'assistant', content: 'Could not fetch deep analysis. Retrying soon.' }]);
                } finally {
                  setAiLoading(false);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10.5px] px-3.5 py-2.5 rounded-2xl cursor-pointer transition-transform hover:scale-102 shadow"
            >
              📊 {lang === 'ar' ? 'تحليل شامل فوري للمحل' : 'Run Full Shop Diagnostic'}
            </button>
          </div>

          <div className="glass-panel p-6 rounded-3xl border flex flex-col h-[520px] dark:bg-slate-900/80">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 scrollbar-thin scrollbar-thumb-slate-250">
              {aiChatHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6 space-y-3">
                  <div className="bg-emerald-500/10 text-emerald-600 p-3 h-12 w-12 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="font-extrabold text-xs text-slate-700 dark:text-slate-300">
                      {lang === 'ar' ? 'أنا المستشار الذكي المتصل الحاصل على معلومات محلك!' : 'I am Gemini, your connected Store Advisor!'}
                    </h5>
                    <p className="text-[10px] text-slate-450 dark:text-slate-450 max-w-sm mt-1 leading-relaxed">
                      {lang === 'ar'
                        ? 'اطرح أسئلة مثل: "ما هي الهواتف الأكثر ربحاً؟"، "قارن مصاريفي بأرباحي"، أو اضغط على زر التحليل لمطالعة تقرير مفصل.'
                        : 'Query lists: "What is my net profits this month?", or click that top action to inspect automated supplier stock restocking drafts!'}
                    </p>
                  </div>
                </div>
              ) : (
                aiChatHistory.map((ch, idx) => (
                  <div key={idx} className={`flex ${ch.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-4 rounded-3xl max-w-xl text-xs leading-relaxed shadow-xs text-start ${
                      ch.role === 'user'
                        ? 'bg-emerald-600 text-white font-bold rounded-tr-none'
                        : 'bg-slate-50 dark:bg-slate-850 dark:border-slate-800 border text-slate-800 dark:text-slate-200 rounded-tl-none whitespace-pre-line'
                    }`}>
                      {ch.content}
                    </div>
                  </div>
                ))
              )}

              {aiLoading && (
                <div className="flex justify-start">
                  <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-850 dark:border-slate-800 border flex items-center gap-2 rounded-tl-none text-xs text-slate-500 dark:text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce delay-100"></div>
                    <div className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce delay-200"></div>
                    <span className="font-bold">{lang === 'ar' ? 'جاري الاستشارة وصياغة التقرير...' : 'Consulting store datasets...'}</span>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSendAiChatQuery} className="flex gap-2 shrink-0">
              <input
                type="text"
                placeholder={lang === 'ar' ? 'اكتب سؤالك هنا كتاجر... (مثلاً: ما هي السلعة الأكثر مبيعاً؟)' : 'Ask shop stats advisor here ...'}
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
                disabled={aiLoading}
                className="text-xs flex-1 bg-white dark:bg-slate-850 border dark:border-slate-800 dark:text-white px-4 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
              />
              <button
                type="submit"
                disabled={aiLoading || !aiQuery.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white p-3 rounded-2xl shadow-md cursor-pointer transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RETAIL REFUND POPUP PANEL MODAL */}
      {selectedRefundSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-rose-750 text-white p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="bg-white/10 p-2 rounded-xl">
                  <Undo className="w-5 h-5 text-rose-100" />
                </div>
                <div className="text-start">
                  <h3 className="font-extrabold text-base">{lang === 'ar' ? 'إدارة إرجاع منتجات وتوليد مرتجع' : 'Product Return Desk'}</h3>
                  <p className="text-[10px] text-rose-100">{lang === 'ar' ? `فاتورة رقم: ${selectedRefundSale.invoiceNumber}` : `Invoice ref: ${selectedRefundSale.invoiceNumber}`}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRefundSale(null)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scroll Content */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-start dark:text-slate-300">
              
              <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100/40 rounded-2xl flex items-start gap-2 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-rose-900 dark:text-rose-400">{lang === 'ar' ? 'يرجى توخي الحذر عند إرجاع السلع:' : 'Restocking instructions:'}</p>
                  <p className="text-[10.5px] text-slate-500 mt-0.5 leading-relaxed">
                    {lang === 'ar' 
                      ? 'تأكيد العملية سيعيد المقادير والقطع تلقائياً إلى حجم المخزون النشط، كما سيتم إعادة الأرقام التسلسلية (IMEI) للهواتف إلى المخزن لحمايتها.' 
                      : 'This returns selected products and serial numbers instantly to warehouse active stocks.'}
                  </p>
                </div>
              </div>

              {/* Items in Sale Selection List */}
              <div className="space-y-2.5">
                <span className="block text-xs font-black text-slate-400 uppercase tracking-wider">
                  {lang === 'ar' ? '🛒 اختر الكمية المراد استرجاعها من البضاعة' : '🛒 Adjust refund quantities for items'}
                </span>

                {selectedRefundSale.items.map((item, idx) => {
                  const alreadyReturned = item.returnedQuantity || 0;
                  const availableToReturn = item.quantity - alreadyReturned;
                  const currentReturnCount = returnCounts[idx] || 0;

                  return (
                    <div 
                      key={idx} 
                      className={`p-4 border rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-colors ${
                        availableToReturn === 0 
                          ? 'bg-slate-50 dark:bg-slate-800/10 border-slate-100 dark:border-slate-800' 
                          : 'bg-white dark:bg-slate-850 hover:bg-slate-50/20 dark:hover:bg-slate-800/20 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="text-start">
                        <p className="font-bold text-slate-900 dark:text-white text-xs">{item.name}</p>
                        <p className="text-[10.5px] text-slate-400 mt-0.5">
                          {lang === 'ar' ? 'تم شراؤها:' : 'Purchased:'} <span className="font-bold text-slate-700 dark:text-slate-300">{item.quantity} {lang === 'ar' ? 'قطع' : 'pcs'}</span>
                          {alreadyReturned > 0 && (
                            <span className="text-rose-600 font-bold ml-2">({lang === 'ar' ? `مرتجع مسبقاً: ${alreadyReturned}` : `Returned: ${alreadyReturned}`})</span>
                          )}
                        </p>
                        {item.serialNumber && (
                          <span className="block text-[9px] font-mono text-cyan-600 font-bold bg-cyan-50 dark:bg-cyan-950/30 px-1.5 py-0.5 rounded-md mt-1 w-fit">IMEI: {item.serialNumber}</span>
                        )}
                      </div>

                      {/* Quantity refund Selector buttons */}
                      {availableToReturn <= 0 ? (
                        <span className="text-[10px] uppercase font-black text-rose-600 bg-rose-50 dark:bg-rose-950/30 px-2 py-1 rounded-lg">
                          {lang === 'ar' ? 'تم الإرجاع بالكامل' : 'Fully Returned'}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 self-start sm:self-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => setReturnCounts(prev => ({
                              ...prev,
                              [idx]: Math.max(0, currentReturnCount - 1)
                            }))}
                            className="p-1 px-2 text-xs rounded-lg bg-white dark:bg-slate-700 dark:text-white font-black hover:bg-slate-100 cursor-pointer shadow-xs"
                          >
                            -
                          </button>
                          <span className="text-sm font-black w-8 text-center text-slate-900 dark:text-white">
                            {currentReturnCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => setReturnCounts(prev => ({
                              ...prev,
                              [idx]: Math.min(availableToReturn, currentReturnCount + 1)
                            }))}
                            className="p-1 px-2 text-xs rounded-lg bg-white dark:bg-slate-700 dark:text-white font-black hover:bg-slate-100 cursor-pointer shadow-xs"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Installments specific refund adjust policy */}
              {selectedRefundSale.paymentMethod === 'installments' && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1 text-xs">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="adj_debt_chk"
                      checked={deductFromDebt}
                      onChange={e => setDeductFromDebt(e.target.checked)}
                      className="w-4.5 h-4.5 text-amber-600 border-gray-300 rounded-md focus:ring-amber-500 focus:outline-none"
                    />
                    <label htmlFor="adj_debt_chk" className="font-extrabold text-amber-900 dark:text-amber-300">
                      {lang === 'ar' ? 'خصم قيمة البضائع المرتجعة من ديون الزبون بقائمة التقسيط' : 'Deduct value from installment credit portfolio'}
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 pl-7 leading-normal">
                    {lang === 'ar' 
                      ? 'عند تفعيل الخيار، سيتم حذف الكريدي المطالب به للزبون تلقائياً، وإعادة تعديل قيمة الأقساط المتبقية للزبون.' 
                      : 'Lowers outstanding receivables bound to installment billing files automatically.'}
                  </p>
                </div>
              )}

              {/* Instant math refund estimate */}
              <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border flex justify-between items-center text-sm font-bold">
                <span>{lang === 'ar' ? 'إجمالي قيمة المسترد النقدي (للزبون):' : 'Estimated refund sum:'}</span>
                <span className="text-base text-rose-600 font-mono font-black animate-pulse">
                  {selectedRefundSale.items.reduce((acc, item, idx) => {
                    const count = returnCounts[idx] || 0;
                    return acc + (count * item.price);
                  }, 0).toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                </span>
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className="bg-slate-50 dark:bg-slate-950/70 p-4 border-t border-slate-100 dark:border-slate-850 flex gap-3 shrink-0">
              <button
                onClick={() => setSelectedRefundSale(null)}
                className="flex-1 text-xs font-black bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-705 text-slate-705 dark:text-slate-305 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleConfirmReturn}
                className="flex-1 text-xs bg-rose-600 hover:bg-rose-700 focus:bg-rose-800 text-white font-extrabold py-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <Undo2 className="w-4 h-4" />
                {lang === 'ar' ? 'تأكيد إرجاع السلع' : 'Confirm Return'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: ADD EXPENSE */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleAddExpense} className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="bg-emerald-600 text-white p-5 flex justify-between items-center shrink-0">
              <h3 className="font-extrabold text-base">{lang === 'ar' ? 'إضافة مصروف تشغيلي جديد' : 'New Operational Cost'}</h3>
              <button type="button" onClick={() => setShowAddExpenseModal(false)} className="text-white hover:bg-white/10 p-1.5 rounded-full cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 text-start">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'الوصف / البيان' : 'Expense Detail Description'}</label>
                <input
                  type="text"
                  required
                  placeholder={lang === 'ar' ? 'إيجار المحل لشهر ماي، فاتورة الكهرباء...' : 'e.g., May Rent Payment, Supplier invoice...'}
                  value={expNotes}
                  onChange={e => setExpNotes(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-850 dark:text-white border px-4 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'قيمة المصروف (د.ج)' : 'Amount'}</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={expAmount || ''}
                    onChange={e => setExpAmount(Number(e.target.value))}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-850 dark:text-white border px-4 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'التاريخ' : 'Date'}</label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={e => setExpDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-850 dark:text-white border px-4 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'الفئة' : 'Category'}</label>
                <select
                  value={expCategory}
                  onChange={e => setExpCategory(e.target.value as any)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-850 dark:text-white border px-4 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                >
                  <option value="rent">{lang === 'ar' ? 'الإيجار / المقر' : 'Rent'}</option>
                  <option value="electricity">{lang === 'ar' ? 'الكهرباء والغاز' : 'Electricity'}</option>
                  <option value="internet">{lang === 'ar' ? 'الانترنت والهاتف' : 'Internet'}</option>
                  <option value="salary">{lang === 'ar' ? 'أجور العمال' : 'Salaries'}</option>
                  <option value="supplier_payment">{lang === 'ar' ? 'دفعات الموردين' : 'Supplier Payment'}</option>
                  <option value="other">{lang === 'ar' ? 'أخرى' : 'Other'}</option>
                </select>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/70 p-4 border-t border-slate-100 dark:border-slate-855 flex gap-3 shrink-0">
              <button type="button" onClick={() => setShowAddExpenseModal(false)} className="flex-1 text-xs font-black bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-705 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">{t.cancel}</button>
              <button type="submit" className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-2xl transition-all shadow-md cursor-pointer">{lang === 'ar' ? 'إضافة المصروف' : 'Add Cost'}</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD PRE-ORDER BOOKING */}
      {showAddBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleAddBooking} className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="bg-emerald-600 text-white p-5 flex justify-between items-center shrink-0">
              <h3 className="font-extrabold text-base">{lang === 'ar' ? 'تسجيل حجز مسبق جديد لزبون' : 'New Customer Pre-order'}</h3>
              <button type="button" onClick={() => setShowAddBookingModal(false)} className="text-white hover:bg-white/10 p-1.5 rounded-full cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 text-start">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'اسم العميل المطلب' : 'Customer Full Name'}</label>
                <input
                  type="text"
                  required
                  placeholder={lang === 'ar' ? 'أحمد بن علي...' : 'e.g., John Doe'}
                  value={bookCustName}
                  onChange={e => setBookCustName(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-850 dark:text-white border px-4 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'رقم الهاتف للاتصال' : 'Phone Number'}</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 0550000000"
                    value={bookCustPhone}
                    onChange={e => setBookCustPhone(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-850 dark:text-white border px-4 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'الجهاز / الهاتف المطلوب' : 'Handset required'}</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., iPhone 15 Pro Max 256GB"
                    value={bookProduct}
                    onChange={e => setBookProduct(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-850 dark:text-white border px-4 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'ملاحظات إضافية (اللون، السعر المستهدف...)' : 'Additional requirements'}</label>
                <textarea
                  placeholder={lang === 'ar' ? 'تفضيل لون تيتانيوم طبيعي، بطارية فوق 90%...' : 'Color dark gray, clean condition preferred...'}
                  value={bookNotes}
                  onChange={e => setBookNotes(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-850 dark:text-white border px-4 py-3 rounded-2xl h-16 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                />
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/70 p-4 border-t border-slate-100 dark:border-slate-855 flex gap-3 shrink-0">
              <button type="button" onClick={() => setShowAddBookingModal(false)} className="flex-1 text-xs font-black bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-705 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">{t.cancel}</button>
              <button type="submit" className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-2xl transition-all shadow-md cursor-pointer">{lang === 'ar' ? 'تأكيد الحجز' : 'Log Pre-order'}</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CORE STOCK BARCODE AUDIT FINDINGS */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="bg-emerald-600 text-white p-5 flex justify-between items-center shrink-0">
              <h3 className="font-extrabold text-base">{lang === 'ar' ? 'فحص ومقارنة جرد الرفوف الأوتوماتيكي (Barcode Audit)' : 'Physical Inventory Audit Desk'}</h3>
              <button type="button" onClick={() => setShowAuditModal(false)} className="text-white hover:bg-white/10 p-1.5 rounded-full cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 text-start flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'اختر المنتج المراد جرده' : 'Select Audited Item'}</label>
                  <select
                    value={selectedAuditProdId}
                    onChange={e => setSelectedAuditProdId(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-850 dark:text-white border px-3 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                  >
                    <option value="">{lang === 'ar' ? '-- اختر من المخزن --' : '-- Choose Product --'}</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({lang === 'ar' ? `المقيد: ${p.quantity}` : `Stored: ${p.quantity}`})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'الكمية الفعلية الموجودة على الرف فجأة' : 'Qty Found on Shelf'}</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required
                      min="0"
                      value={auditActualQty || ''}
                      onChange={e => setAuditActualQty(Math.max(0, Number(e.target.value)))}
                      className="w-full text-xs bg-slate-50 dark:bg-slate-850 dark:text-white border px-3 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleAddAuditFindingDraft}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 text-xs rounded-2xl cursor-pointer"
                    >
                      {lang === 'ar' ? 'أضف' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="border border-slate-105 dark:border-slate-800 rounded-2xl overflow-hidden mt-4">
                <div className="bg-slate-50 dark:bg-slate-800 px-3 py-2 border-b dark:border-slate-800 text-[10.5px] font-black text-slate-600">
                  {lang === 'ar' ? 'مسودة الجداول والفروقات الحالية قبل الحفظ المعتمد' : 'Draft Variance Ledger'}
                </div>
                <div className="p-2 space-y-2 max-h-48 overflow-y-auto">
                  {draftAuditFindings.length === 0 ? (
                    <p className="text-center py-6 text-xs text-slate-400 font-bold">{lang === 'ar' ? '📪 لم تضف أي سلع في الفحص الفجائي بعد.' : 'No variance lines added yet.'}</p>
                  ) : (
                    draftAuditFindings.map((f, i) => (
                      <div key={i} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 dark:bg-slate-850/50 rounded-xl">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-100">{f.name}</p>
                          <span className="text-[10px] font-mono text-slate-400">{lang === 'ar' ? 'متوقع' : 'System'}: {f.expectedQty} | {lang === 'ar' ? 'رف' : 'Real'}: {f.actualQty}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-black ${f.difference < 0 ? 'text-red-500 font-extrabold' : f.difference > 0 ? 'text-blue-500' : 'text-slate-400'}`}>
                            {f.difference === 0 ? 'OK' : f.difference > 0 ? `+${f.difference}` : f.difference}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDraftAuditFindings(prev => prev.filter(item => item.productId !== f.productId))}
                            className="text-rose-500 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/70 p-4 border-t border-slate-100 dark:border-slate-855 flex gap-3 shrink-0">
              <button type="button" onClick={() => setShowAuditModal(false)} className="flex-1 text-xs font-black bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-705 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">{t.cancel}</button>
              <button type="button" onClick={handleAddAudit} className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-2xl transition-all shadow-md cursor-pointer">{lang === 'ar' ? 'تأكيد وحفظ الجرد' : 'Commit Audit Report'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DIAGNOSTICS USED PHONE ASSESSMENT FORM */}
      {showAssessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleAddAssessment} className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="bg-emerald-600 text-white p-5 flex justify-between items-center shrink-0">
              <h3 className="font-extrabold text-base">{lang === 'ar' ? 'ورقة تشخيص وتقييم جودة هاتف مستعمل' : 'Quality Assessment Handset Form'}</h3>
              <button type="button" onClick={() => setShowAssessModal(false)} className="text-white hover:bg-white/10 p-1.5 rounded-full cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 text-start flex-1 overflow-y-auto text-xs font-bold text-slate-500">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">{lang === 'ar' ? 'موديل الجهاز وتفاصيله' : 'Handset Device Model'}</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Samsung Galaxy S23 Ultra"
                    value={assessModel}
                    onChange={e => setAssessModel(e.target.value)}
                    className="w-full text-xs font-sans bg-slate-50 dark:bg-slate-850 dark:text-white border px-3 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block mb-1">IMEI/Serial Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 356821102948751"
                    value={assessImei}
                    onChange={e => setAssessImei(e.target.value)}
                    className="w-full font-sans text-xs bg-slate-50 dark:bg-slate-850 dark:text-white border px-3 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>

              <div className="border border-slate-100 dark:border-slate-800 rounded-2xl p-4 bg-slate-50 dark:bg-slate-850 space-y-3">
                <span className="text-[10px] uppercase text-emerald-650 block tracking-wider">{lang === 'ar' ? 'قائمة الفحص والتشخيص الفني للهاردوير' : 'Core Hardware Checklist Details'}</span>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-0.5">{lang === 'ar' ? 'بصمة الإصبع و معرف الوجه?' : 'Face ID / Touch ID'}</label>
                    <select
                      value={assessFaceTouch}
                      onChange={e => setAssessFaceTouch(e.target.value as any)}
                      className="w-full text-xs bg-white dark:bg-slate-900 border px-2 py-2 rounded-xl focus:outline-none font-bold cursor-pointer"
                    >
                      <option value="pass">{lang === 'ar' ? 'مقبول / شغال (Pass)' : 'Pass'}</option>
                      <option value="fail">{lang === 'ar' ? 'معطل / غير شغال (Fail)' : 'Fail'}</option>
                      <option value="na">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-0.5">{lang === 'ar' ? 'صحة البطارية (%)' : 'Battery Capacity (%)'}</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="100"
                      value={assessBattery || ''}
                      onChange={e => setAssessBattery(Math.min(100, Math.max(1, Number(e.target.value))))}
                      className="w-full text-xs bg-white dark:bg-slate-900 border px-2 py-2 rounded-xl focus:outline-none font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block mb-0.5">{lang === 'ar' ? 'هل الشاشة أصلية؟' : 'Is screen original?'}</label>
                    <select
                      value={assessScreen}
                      onChange={e => setAssessScreen(e.target.value as any)}
                      className="w-full text-xs bg-white dark:bg-slate-900 border px-2 py-2 rounded-xl focus:outline-none font-bold cursor-pointer"
                    >
                      <option value="yes">{lang === 'ar' ? 'نعم، أصلية (Original)' : 'Screen Original'}</option>
                      <option value="no">{lang === 'ar' ? 'مستبدلة تجارية (LCD)' : 'Commercial screen LCD'}</option>
                      <option value="replaced_high_quality">{lang === 'ar' ? 'مستبدلة شاشة أصلية' : 'Replaced high quality'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-0.5">{lang === 'ar' ? 'منفذ الشحن و السبيكر' : 'Charging port & Speaker'}</label>
                    <select
                      value={assessCharging}
                      onChange={e => setAssessCharging(e.target.value as any)}
                      className="w-full text-xs bg-white dark:bg-slate-900 border px-2 py-2 rounded-xl focus:outline-none font-bold cursor-pointer"
                    >
                      <option value="yes">{lang === 'ar' ? 'شغال تماماً (Pass)' : 'Pass'}</option>
                      <option value="no">{lang === 'ar' ? 'يحتاج صيانة ثانوية' : 'Has issue'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-0.5">{lang === 'ar' ? 'حالة الهيكل والخدوش' : 'External Body shell scratches'}</label>
                    <select
                      value={assessBody}
                      onChange={e => setAssessBody(e.target.value as any)}
                      className="w-full text-xs bg-white dark:bg-slate-900 border px-2 py-2 rounded-xl focus:outline-none font-bold cursor-pointer"
                    >
                      <option value="excellent">{lang === 'ar' ? 'ممتاز (Excellent)' : 'Excellent'}</option>
                      <option value="good">{lang === 'ar' ? 'جيد جداً (Clean)' : 'Good'}</option>
                      <option value="fair">{lang === 'ar' ? 'مقبول (Scratches)' : 'Fair'}</option>
                      <option value="scratched">{lang === 'ar' ? 'مخدوش أو به كسر' : 'Scratched/Broken'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-0.5">{lang === 'ar' ? 'التقييم الشامل للجهاز' : 'Global Assessment Level'}</label>
                    <select
                      value={assessStatus}
                      onChange={e => setAssessStatus(e.target.value as any)}
                      className="w-full text-xs bg-white dark:bg-slate-900 border px-2 py-2 rounded-xl focus:outline-none font-bold cursor-pointer"
                    >
                      <option value="excellent">{lang === 'ar' ? 'ممتاز (Excellent)' : 'Excellent'}</option>
                      <option value="good">{lang === 'ar' ? 'جيد جداً (Good)' : 'Good'}</option>
                      <option value="fair">{lang === 'ar' ? 'مقبول (Fair)' : 'Fair'}</option>
                      <option value="faulty">{lang === 'ar' ? 'به أعطال (Faulty)' : 'Faulty'}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block mb-1">{lang === 'ar' ? 'ملاحظات وتفاصيل الفحص الفني' : 'Technical diagnostic notes'}</label>
                <textarea
                  placeholder={lang === 'ar' ? 'الكاميرا فيها اهتزاز طفيف، الواي فاي يعمل بامتياز...' : 'Camera has micro-scratches... WiFi runs okay.'}
                  value={assessNotes}
                  onChange={e => setAssessNotes(e.target.value)}
                  className="w-full font-serif text-xs bg-slate-50 dark:bg-slate-850 dark:text-white border px-3 py-3 rounded-2xl h-12 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                />
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/70 p-4 border-t border-slate-100 dark:border-slate-855 flex gap-3 shrink-0">
              <button type="button" onClick={() => setShowAssessModal(false)} className="flex-1 text-xs font-black bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-705 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">{t.cancel}</button>
              <button type="submit" className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-2xl transition-all shadow-md cursor-pointer">{lang === 'ar' ? 'حفظ الفحص وتقييم الهاتف' : 'Save Diagnostics Document'}</button>
            </div>
          </form>
        </div>
      )}

      {/* SVG visual progress charts */}
      <div className="glass-panel p-6 rounded-3xl border border-white/45 dark:border-slate-800 text-start relative">
        <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-emerald-600" />
          {lang === 'ar' ? 'الشريحة النسبية لتحليل أرباح الكاشير ضد صيانة الأجهزة' : 'Visual breakdown split ratio'}
        </h3>

        <div className="flex flex-col sm:flex-row items-center justify-around gap-6 mt-2">
          {/* Circular SVG split chart representing ratio */}
          <div className="relative w-36 h-36">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100 dark:text-slate-800"
                strokeWidth="4"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Gross profit split arc */}
              {metrics.totalRevenue > 0 && (
                <path
                  className="text-emerald-500"
                  strokeWidth="4.2"
                  strokeDasharray={`${(metrics.grossProfit / metrics.totalRevenue) * 100}, 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col justify-center items-center">
              <span className="text-lg font-black text-slate-900 dark:text-white animate-pulse">
                {metrics.totalRevenue > 0 ? `${Math.round((metrics.netProfit / metrics.totalRevenue) * 100)}%` : '0%'}
              </span>
              <span className="text-[8px] text-slate-400 font-extrabold block uppercase tracking-wider">{lang === 'ar' ? 'هامش الصافي' : 'Net Margin'}</span>
            </div>
          </div>

          {/* Ledger Labels split */}
          <div className="space-y-3.5 text-xs font-sans flex-1">
            <div className="flex items-center justify-between border-b pb-1.5 border-slate-50 dark:border-slate-850">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-bold">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                {lang === 'ar' ? 'أرباح هامش الهواتف والإكسسوارات' : 'Inventory Sales Margin'}
              </span>
              <span className="font-mono font-black text-slate-800 dark:text-slate-205">
                {metrics.grossProfit.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
              </span>
            </div>

            <div className="flex items-center justify-between border-b pb-1.5 border-slate-50 dark:border-slate-850">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-bold">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
                {lang === 'ar' ? 'أرباح صيانة الحواسب والأجهزة' : 'Hardware Repairs Margins'}
              </span>
              <span className="font-mono font-black text-slate-800 dark:text-slate-205">
                {metrics.repairIncome.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl font-bold">
              <span className="dark:text-slate-300">{lang === 'ar' ? 'الناتج الصافي الموحد' : 'Consolidated Total Earnings'}</span>
              <span className="font-black text-emerald-700 dark:text-emerald-450 font-mono text-sm">
                {metrics.netProfit.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* DUAL CARD GRID: BEST SELLERS & MOST PROFITABLE PRODUCTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-start">
        {/* Card 1: Top sold by Quantity */}
        <div className="glass-panel p-6 rounded-3xl border border-sky-500/10">
          <h4 className="font-black text-sm text-slate-805 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500 animate-bounce" />
            {lang === 'ar' ? '🔥 المنتجات الأكثر مبيعاً (بالكمية)' : '🔥 Top Selling Products (By Qty)'}
          </h4>
          <div className="space-y-3">
            {topByQuantity.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">{lang === 'ar' ? 'لم يتم تسجيل أي مبيعات بعد.' : 'No sales registered yet.'}</p>
            ) : (
              topByQuantity.map((item, idx) => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border dark:border-slate-800 transition-colors hover:bg-sky-50/20">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black text-slate-400 bg-slate-100 dark:bg-slate-700 w-6 h-6 rounded-lg flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-150">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-[10px] font-extrabold px-2.5 py-1 rounded-lg border dark:border-sky-900">
                      {item.quantity} {lang === 'ar' ? 'مبيعات' : 'units'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card 2: Top by Net Profit generated */}
        <div className="glass-panel p-6 rounded-3xl border border-emerald-500/10">
          <h4 className="font-black text-sm text-slate-805 dark:text-slate-200 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500 animate-pulse" />
            {lang === 'ar' ? '💰 المنتجات الأكثر ربحية (صافي الربح)' : '💰 Most Profitable Products (Net Profit)'}
          </h4>
          <div className="space-y-3">
            {topByProfit.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">{lang === 'ar' ? 'لم يتم تسجيل أي أرباح بعد.' : 'No profits registered yet.'}</p>
            ) : (
              topByProfit.map((item, idx) => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border dark:border-slate-800 transition-colors hover:bg-emerald-50/20">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black text-slate-400 bg-slate-100 dark:bg-slate-700 w-6 h-6 rounded-lg flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-150">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-black px-2.5 py-1 rounded-lg border dark:border-emerald-900">
                      +{Math.round(item.profit).toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
