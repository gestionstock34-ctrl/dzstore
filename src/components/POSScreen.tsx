
import React, { useState, useEffect, useRef } from 'react';
import { Currency, Language, Product, Customer, PaymentMethod, SaleItem, Sale } from '../types';
import { TRANSLATIONS } from '../lib/data';
import { DzStoreDB } from '../lib/db';
import { DzStoreAudio } from './AudioAlerts';
import { BarcodeGenerator } from './BarcodeGenerator';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CreditCard,
  Banknote,
  Percent,
  Sparkles,
  Barcode,
  CheckCircle,
  FileText,
  User,
  ShoppingBag,
  Camera
} from 'lucide-react';
import { BarcodeCameraScanner } from './BarcodeCameraScanner';

interface POSScreenProps {
  shopId: string;
  currency: Currency;
  lang: Language;
  cashierName: string;
  cashierId: string;
  onRefreshStats: () => void;
  enableSounds: boolean;
  onPrintInvoice?: (sale: any) => void;
  onShowToast?: (msg: string, type?: 'success' | 'warning' | 'info') => void;
  syncKey?: number;
}

export const POSScreen: React.FC<POSScreenProps> = ({
  shopId,
  currency,
  lang,
  cashierName,
  cashierId,
  onRefreshStats,
  enableSounds,
  onPrintInvoice,
  onShowToast,
  syncKey,
}) => {
  const t = TRANSLATIONS[lang];

  // Lists loaded from DB
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Cart and Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [warrantyPeriod, setWarrantyPeriod] = useState('3 months');
  const [warrantyNotes, setWarrantyNotes] = useState('');

  // Manual Custom item form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState(0);

  // Completed Invoice Popup
  const [lastCompletedInvoice, setLastCompletedInvoice] = useState<Sale | null>(null);
  const [showInvoicePrint, setShowInvoicePrint] = useState(false);

  // Quick Add Product Form States
  const [showQuickProductModal, setShowQuickProductModal] = useState(false);
  const [qpName, setQpName] = useState('');
  const [qpBrand, setQpBrand] = useState('');
  const [qpType, setQpType] = useState('Phone');
  const [qpBarcode, setQpBarcode] = useState('');
  const [qpPurchasePrice, setQpPurchasePrice] = useState(0);
  const [qpSellingPrice, setQpSellingPrice] = useState(0);
  const [qpQuantity, setQpQuantity] = useState(1);
  const [qpIMEIs, setQpIMEIs] = useState('');
  const [qpImageUrl, setQpImageUrl] = useState('');

  // Quick Add Customer Form States
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
  const [qcName, setQcName] = useState('');
  const [qcPhone, setQcPhone] = useState('');
  const [qcAddress, setQcAddress] = useState('');

  // Mobile layout view selector (Products grid vs Checkout cart)
  const [mobileViewTab, setMobileViewTab] = useState<'products' | 'cart'>('products');

  // Refs for scan imitation
  const [manualBarcode, setManualBarcode] = useState('');
  const [showPOSScanner, setShowPOSScanner] = useState(false);

  useEffect(() => {
    setProducts(DzStoreDB.getProducts(shopId));
    setCustomers(DzStoreDB.getCustomers(shopId));
  }, [shopId, syncKey]);

  // Calculations
  const cartSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalDiscount = (cartSubtotal * discountPercent) / 100;
  const cartTotal = cartSubtotal - totalDiscount;

  // Add Item to sale cart
  const addToCart = (product: Product, serialNum?: string) => {
    // If the product requires an IMEI and none is specified, choose the first available
    let chosenSerial = serialNum;
    if (product.serialNumbers.length > 0 && !chosenSerial) {
      chosenSerial = product.serialNumbers[0];
    }

    // Check if item is already in cart
    const existingIndex = cart.findIndex(
      item => item.productId === product.id && item.serialNumber === chosenSerial
    );

    if (existingIndex > -1) {
      if (product.quantity > cart[existingIndex].quantity) {
        const newCart = [...cart];
        newCart[existingIndex].quantity += 1;
        setCart(newCart);
        DzStoreAudio.playScanBeep(enableSounds);
      } else {
        DzStoreAudio.playWarningChime(enableSounds);
        alert(lang === 'ar' ? 'الكمية المطلوبة تتجاوز الكمية المتوفرة في المخزون!' : 'Stock limit exceeded!');
      }
    } else {
      // New item addition
      if (product.quantity > 0) {
        const newItem: SaleItem = {
          productId: product.id,
          name: product.name,
          type: 'product',
          quantity: 1,
          price: product.sellingPrice,
          originalPrice: product.sellingPrice,
          discount: 0,
          serialNumber: chosenSerial,
          cost: product.purchasePrice || 0,
        };
        setCart([...cart, newItem]);
        DzStoreAudio.playScanBeep(enableSounds);
      } else {
        DzStoreAudio.playWarningChime(enableSounds);
        alert(lang === 'ar' ? 'المنتج غير متوفر في المخزون!' : 'Out of stock!');
      }
    }
  };

  // Add manual accessory or repair
  const addCustomItemToCart = () => {
    if (!customName || customPrice <= 0) return;
    const newItem: SaleItem = {
      name: customName,
      type: 'service',
      quantity: 1,
      price: customPrice,
      originalPrice: customPrice,
      discount: 0,
    };
    setCart([...cart, newItem]);
    setCustomName('');
    setCustomPrice(0);
    setShowCustomForm(false);
    DzStoreAudio.playScanBeep(enableSounds);
  };

  const updateQuantity = (index: number, val: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    if (item.productId) {
      const origProd = products.find(p => p.id === item.productId);
      if (origProd) {
        const nextQty = item.quantity + val;
        if (nextQty <= 0) {
          removeFromCart(index);
          return;
        }
        if (nextQty <= origProd.quantity) {
          item.quantity = nextQty;
          setCart(newCart);
        } else {
          DzStoreAudio.playWarningChime(enableSounds);
          alert(lang === 'ar' ? 'عفواً، الكمية المتوفرة غير كافية!' : 'Insufficient stock!');
        }
      }
    } else {
      // Custom generic item
      const nextQty = item.quantity + val;
      if (nextQty <= 0) {
        removeFromCart(index);
        return;
      }
      item.quantity = nextQty;
      setCart(newCart);
    }
  };

  const removeFromCart = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
    DzStoreAudio.playWarningChime(enableSounds);
  };

  // Simulate laser scan trigger
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBarcode) return;
    const foundProduct = products.find(p => p.barcode === manualBarcode);
    if (foundProduct) {
      addToCart(foundProduct);
      setSearchQuery('');
    } else {
      DzStoreAudio.playWarningChime(enableSounds);
      alert(lang === 'ar' ? 'لم يتم العثور على أي منتج بهذا الكود بار!' : 'No product found with this barcode!');
    }
    setManualBarcode('');
  };

  // Complete/Finalize checkout
  const handleFinalizeSale = () => {
    if (cart.length === 0) {
      alert(lang === 'ar' ? 'السلة فارغة!' : 'Basket is empty!');
      return;
    }

    // Check trial or pending sales limits (max 14 transactions)
    const currentShop = DzStoreDB.getShops().find(s => s.id === shopId);
    const isTrial = currentShop && (currentShop.status === 'trial' || currentShop.status === 'pending');
    if (isTrial) {
      const dbSales = DzStoreDB.getSales(shopId);
      if (dbSales.length >= 14) {
        alert(lang === 'ar'
          ? '⚠️ نسخة تجريبية! لقد بلغت الحد الأقصى للمبيعات المسموح بها في النسخة التجريبية (14 مبيعات فقط).\nيرجى تفعيل حسابك من طرف صاحب البرنامج للبيع بدون قيود!'
          : '⚠️ Trial Version Limit! You have reached the maximum allowed transactions (14 sales) for the trial plan.\nPlease request full activation from the platform administrator!'
        );
        return;
      }
    }

    // Prepare Customer object if installments or selected customer
    let linkedCust = customers.find(c => c.id === selectedCustomerId);

    const invoiceNum = `INV-2026-${String(Math.floor(Math.random() * 900000) + 100000)}`;

    const newSale: Sale = {
      id: `s-${Date.now()}`,
      shopId,
      invoiceNumber: invoiceNum,
      items: cart,
      subtotal: cartSubtotal,
      discount: totalDiscount,
      total: cartTotal,
      paymentMethod,
      cashierId,
      cashierName,
      customerId: selectedCustomerId || undefined,
      customerName: linkedCust?.name || undefined,
      warrantyPeriod,
      warrantyNotes: warrantyNotes || undefined,
      date: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update real products count in Local Storage DB
    const currentProducts = [...products];
    cart.forEach(cartItem => {
      if (cartItem.productId) {
        const prod = currentProducts.find(p => p.id === cartItem.productId);
        if (prod) {
          prod.quantity = Math.max(0, prod.quantity - cartItem.quantity);
          // Remove sold Serial Numbers / IMEIs
          if (cartItem.serialNumber) {
            prod.serialNumbers = prod.serialNumbers.filter(sn => sn !== cartItem.serialNumber);
          }
        }
      }
    });

    // Update customer debt if installments chosen
    if (paymentMethod === 'installments' && selectedCustomerId) {
      const currentCustomers = [...customers];
      const custIndex = currentCustomers.findIndex(c => c.id === selectedCustomerId);
      if (custIndex > -1) {
        currentCustomers[custIndex].totalDebt += cartTotal;
        currentCustomers[custIndex].installments.push({
          id: `inst-${Date.now()}`,
          saleId: newSale.id,
          totalAmount: cartTotal,
          paidAmount: 0,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days default due date
          paidHistory: [],
          status: 'pending',
        });
        DzStoreDB.saveCustomers(shopId, currentCustomers);
        setCustomers(currentCustomers);
      }
    }

    // Save transaction and updated warehouse stock
    const dbSales = DzStoreDB.getSales(shopId);
    DzStoreDB.saveSales(shopId, [newSale, ...dbSales]);
    DzStoreDB.saveProducts(shopId, currentProducts);

    // Refresh loaded inventory lists
    setProducts(currentProducts);
    setLastCompletedInvoice(newSale);
    setShowInvoicePrint(true); // Pop up receipt dialog immediately for instant printing
    setCart([]);
    setDiscountPercent(0);
    setSelectedCustomerId('');
    setWarrantyNotes('');

    onRefreshStats();

    // Trigger parent premium overlays
    if (onPrintInvoice) {
      onPrintInvoice(newSale);
    }
    if (onShowToast) {
      onShowToast(
        lang === 'ar' 
          ? '🎉 تم تسجيل الفاتورة بنجاح وتوليد بطاقة الضمان!' 
          : '🎉 Checkout processed! Invoice and guarantees generated.', 
        'success'
      );
    } else {
      DzStoreAudio.playSuccessChime(enableSounds);
    }
  };

  const handleSaveQuickProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qpName) {
      alert(lang === 'ar' ? '⚠️ يرجى إدخال اسم المنتج!' : '⚠️ Product name is required!');
      return;
    }
    if (qpSellingPrice <= 0) {
      alert(lang === 'ar' ? '⚠️ يرجى إدخال سعر بيع صحيح أكبر من الصفر!' : '⚠️ Please enter a valid selling price greater than 0!');
      return;
    }

    const finalBrand = qpBrand.trim() || (lang === 'ar' ? 'عام' : 'General');
    const finalBarcode = qpBarcode.trim() || String(Math.floor(Math.random() * 900000000000) + 100000000000);

    const imeis = qpIMEIs
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const newProd: Product = {
      id: `qp-${Date.now()}`,
      shopId,
      name: qpName,
      brand: finalBrand,
      type: qpType,
      barcode: finalBarcode,
      quantity: qpQuantity,
      minQuantity: 2,
      purchasePrice: qpPurchasePrice,
      sellingPrice: qpSellingPrice,
      serialNumbers: imeis,
      dateAdded: new Date().toISOString().split('T')[0],
      imageUrl: qpImageUrl || undefined,
    };
    
    // Check trial limits
    const currentShop = DzStoreDB.getShops().find(s => s.id === shopId);
    const currentProds = DzStoreDB.getProducts(shopId);
    const isTrial = currentShop && (currentShop.status === 'trial' || currentShop.status === 'pending');
    if (isTrial && currentProds.length >= 14) {
      alert(lang === 'ar'
        ? '⚠️ نسخة تجريبية! لقد بلغت الحد الأقصى للمنتجات المسموح بها في النسخة التجريبية (14 منتجاً فقط).\nيرجى تفعيل حسابك من طرف صاحب البرنامج لإضافة المزيد!'
        : '⚠️ Trial Version Limit! You can only add up to 14 products in stock during this trial period.\nPlease request full activation from the platform administrator!'
      );
      return;
    }

    const updatedProds = [newProd, ...currentProds];
    DzStoreDB.saveProducts(shopId, updatedProds);
    setProducts(updatedProds);

    // Automatically add it to the active sale cart!
    addToCart(newProd);

    // Reset Form
    setQpName('');
    setQpBrand('');
    setQpType('Phone');
    setQpBarcode('');
    setQpPurchasePrice(0);
    setQpSellingPrice(0);
    setQpQuantity(1);
    setQpIMEIs('');
    setQpImageUrl('');
    setShowQuickProductModal(false);

    if (onShowToast) {
      onShowToast(lang === 'ar' ? '✅ تم إضافة المنتج والمباشرة في بيعه!' : '✅ Product quick-added and loaded into register!', 'success');
    }
    onRefreshStats();
  };

  const handleSaveQuickCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qcName || !qcPhone) return;

    const newCust: Customer = {
      id: `qc-${Date.now()}`,
      shopId,
      name: qcName,
      phone: qcPhone,
      address: qcAddress || undefined,
      totalDebt: 0,
      installments: [],
      createdAt: new Date().toISOString(),
    };

    const currentCusts = DzStoreDB.getCustomers(shopId);
    const updatedCusts = [newCust, ...currentCusts];
    DzStoreDB.saveCustomers(shopId, updatedCusts);
    setCustomers(updatedCusts);

    // Automatically select the customer
    setSelectedCustomerId(newCust.id);

    // Reset Form
    setQcName('');
    setQcPhone('');
    setQcAddress('');
    setShowQuickCustomerModal(false);

    if (onShowToast) {
      onShowToast(lang === 'ar' ? '✅ تم تسجيل العميل الجديد وتحديده!' : '✅ Customer registered and linked!', 'success');
    }
    onRefreshStats();
  };

  const filteredProducts = products.filter(
    p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery)
  );

  // Trigger print view manually
  const printDocument = () => {
    if (!lastCompletedInvoice) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const invoiceItems = lastCompletedInvoice.items
      .map(
        item => `
      <tr>
        <td>${item.name} ${item.serialNumber ? `(IMEI: ${item.serialNumber})` : ''}</td>
        <td style="text-align: center;">${item.quantity}</td>
        <td style="text-align: right;">${item.price.toLocaleString()}</td>
        <td style="text-align: right;">${(item.price * item.quantity).toLocaleString()}</td>
      </tr>
    `
      )
      .join('');

    const settings = DzStoreDB.getSettings(shopId, lang);

    printWindow.document.write(`
      <html>
        <head>
          <title>${lastCompletedInvoice.invoiceNumber}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 20px; direction: ${lang === 'ar' ? 'rtl' : 'ltr'}; }
            .header { text-align: center; border-bottom: 2px solid #ddd; padding-bottom: 15px; margin-bottom: 20px; }
            .shop-title { font-size: 22px; font-weight: bold; margin: 0; }
            .subtitle { font-size: 13px; color: #555; margin: 5px 0 0 0; }
            .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background-color: #f3f4f6; border: 1px solid #ddd; padding: 10px; text-align: start; }
            td { border: 1px solid #ddd; padding: 10px; }
            .totals { float: ${lang === 'ar' ? 'left' : 'right'}; width: 250px; font-size: 14px; line-height: 1.8; }
            .totals div { display: flex; justify-content: space-between; }
            .totals .grand-total { font-weight: bold; font-size: 16px; border-top: 1px solid #111; margin-top: 5px; padding-top: 5px; }
            .footer { border-top: 1px solid #ddd; padding-top: 15px; margin-top: 50px; text-align: center; font-size: 12px; color: #660; }
            .warranty-section { background-color: #fdfbe8; border: 1px dashed #ca8a04; border-radius: 8px; padding: 12px; margin-top: 30px; font-size: 13px; }
            .stamp-box { float: ${lang === 'ar' ? 'right' : 'left'}; margin-top: 40px; border: 2px dashed #999; padding: 15px 30px; border-radius: 6px; color: #999; font-size: 12px; display: inline-block; text-align: center;}
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="header">
            <h1 class="shop-title">${settings.shopName}</h1>
            <p class="subtitle">${settings.shopPhone} | ${settings.shopAddress}</p>
            <p style="font-size: 12px; color: #777; margin: 5px 0 0 0;">${settings.receiptHeader}</p>
          </div>

          <div class="invoice-details">
            <div>
              <strong>${lang === 'ar' ? 'رقم الفاتورة:' : 'Invoice No:'}</strong> ${lastCompletedInvoice.invoiceNumber}<br/>
              <strong>${lang === 'ar' ? 'التاريخ:' : 'Date:'}</strong> ${new Date(lastCompletedInvoice.date).toLocaleString()}
            </div>
            <div>
              <strong>${lang === 'ar' ? 'البائع:' : 'Cashier:'}</strong> ${lastCompletedInvoice.cashierName}<br/>
              <strong>${lang === 'ar' ? 'العميل:' : 'Customer:'}</strong> ${lastCompletedInvoice.customerName || (lang === 'ar' ? 'زبون عادي' : 'Standard Guest')}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>${lang === 'ar' ? 'البيان' : 'Item Description'}</th>
                <th style="text-align: center;">${lang === 'ar' ? 'الكمية' : 'Qty'}</th>
                <th style="text-align: right;">${lang === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</th>
                <th style="text-align: right;">${lang === 'ar' ? 'المجموع' : 'Total'}</th>
              </tr>
            </thead>
            <tbody>
              ${invoiceItems}
            </tbody>
          </table>

          <div style="overflow: hidden; margin-top: 20px;">
            <div class="totals">
              <div>
                <span>${lang === 'ar' ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                <span>${lastCompletedInvoice.subtotal.toLocaleString()} ${currency === 'DZD' ? 'د.ج' : '€'}</span>
              </div>
              <div>
                <span>${lang === 'ar' ? 'الخصم المطبق:' : 'Discount:'}</span>
                <span>${lastCompletedInvoice.discount.toLocaleString()} ${currency === 'DZD' ? 'د.ج' : '€'}</span>
              </div>
              <div class="grand-total">
                <span>${lang === 'ar' ? 'الإجمالي الصافي:' : 'Grand Total:'}</span>
                <span>${lastCompletedInvoice.total.toLocaleString()} ${currency === 'DZD' ? 'د.ج' : '€'}</span>
              </div>
              <div style="font-size: 11px; margin-top: 5px; color: #444;">
                <span>${lang === 'ar' ? 'طريقة الدفع:' : 'Paid via:'}</span>
                <span>${t[lastCompletedInvoice.paymentMethod]}</span>
              </div>
            </div>

            <div class="stamp-box" style="${settings.stampImage ? 'border: none; padding: 0;' : ''}">
              ${settings.stampImage ? `
                <img src="${settings.stampImage}" style="max-height: 70px; max-width: 140px; display: block; margin: auto;" />
              ` : `
                ${lang === 'ar' ? 'ختم المحل والتوقيع' : 'Official Stamp & Sign'}
                <div style="height: 40px; margin-top: 10px; width: 100px; border-bottom: 1px double #ddd; margin-left: auto; margin-right: auto;"></div>
              `}
            </div>
          </div>

          <div class="warranty-section">
            <h4 style="margin: 0 0 5px 0; color: #854d0e;">🛡️ ${t.printWarranty} (${lastCompletedInvoice.warrantyPeriod})</h4>
            <div style="margin: 0; line-height: 1.4; color: #713f12; text-align: ${lang === 'ar' ? 'right' : 'left'}; whitespace: pre-line;">
              <strong>${settings.warrantyHeader}</strong><br/>
              ${settings.warrantyPolicyText ? `<div style="font-size: 10px; border-top: 1px dashed #eab308; margin-top: 5px; padding-top: 5px; white-space: pre-line;">${settings.warrantyPolicyText}</div>` : ''}
              ${lastCompletedInvoice.warrantyNotes ? `<p style="margin: 5px 0 0 0;"><strong>📜 ملاحظات إضافية:</strong> ${lastCompletedInvoice.warrantyNotes}</p>` : ''}
              <p style="margin-top: 5px; font-style: italic;">${settings.warrantyFooter}</p>
            </div>
          </div>

          <div class="footer">
            <p>${settings.receiptFooter}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col gap-4 min-h-[85vh] p-1 w-full">
      {/* 📱 Mobile view selector tabs - ONLY visible on mobile screens */}
      <div className="flex lg:hidden bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1.5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 select-none">
        <button
          onClick={() => setMobileViewTab('products')}
          className={`flex-1 py-3 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileViewTab === 'products'
              ? 'bg-sky-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
          }`}
        >
          📱 {lang === 'ar' ? 'المنتجات والأصناف' : 'Products Grid'}
        </button>
        <button
          onClick={() => setMobileViewTab('cart')}
          className={`flex-1 py-3 text-xs font-black rounded-xl transition-all cursor-pointer relative flex items-center justify-center gap-1.5 ${
            mobileViewTab === 'cart'
              ? 'bg-sky-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
          }`}
        >
          🛒 {lang === 'ar' ? 'سلة المبيعات والسداد' : 'Cart & Billing'}
          {cart.length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full font-mono">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Products & Search Section */}
        <div className={`flex-1 ${mobileViewTab === 'products' ? 'flex' : 'hidden lg:flex'} flex-col min-w-0 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden`}>
        {/* Register upper parameters */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <ShoppingBag className="w-5 h-5 text-sky-700" id="shopping_bag_icon" />
              <span className="text-base">{lang === 'ar' ? 'قائمة الأصناف المتاحة' : 'Products Grid'}</span>
            </div>
            <button
              onClick={() => setShowQuickProductModal(true)}
              className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer"
              title={lang === 'ar' ? 'إضافة منتج سريع للمخزن والكاشير' : 'Quick Add Product to DB'}
            >
              <Plus className="w-3.5 h-3.5" />
              {lang === 'ar' ? 'منتج سريع +' : 'Quick Prod +'}
            </button>
          </div>

          {/* Barcode Laser Simulator */}
          <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-1.5 w-full md:w-auto">
            <div className="relative flex-1 md:w-40">
              <Barcode className="absolute left-2.5 top-2.5 w-4 h-4 text-sky-600" id="laser_barcode_tag" />
              <input
                type="text"
                placeholder={lang === 'ar' ? 'البحث بالرمز...' : 'Scan code...'}
                value={manualBarcode}
                onChange={e => setManualBarcode(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
              />
            </div>
            <button
              type="submit"
              className="text-xs font-semibold bg-sky-700 hover:bg-sky-800 text-white px-3 py-2 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              🚀
            </button>
            <button
              type="button"
              onClick={() => setShowPOSScanner(true)}
              className="text-xs bg-slate-800 hover:bg-slate-75"
              style={{ padding: '8px 10px', borderRadius: '8px', color: '#fff', border: '1px solid #475569', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              title={lang === 'ar' ? 'تشغيل كاميرا الهاتف لمسح الباركود' : 'Open phone scanner'}
            >
              <Camera className="w-3.5 h-3.5 text-emerald-450 animate-pulse" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'كاميرا' : 'Cam'}</span>
            </button>
          </form>
        </div>

        {/* Search query box */}
        <div className="p-4 border-b border-slate-100 relative">
          <Search className="absolute left-7 top-7 text-slate-400 w-4 h-4" id="search_pos_icon" />
          <input
            type="text"
            placeholder={t.barcode_or_name}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 bg-slate-50 focus:bg-white text-sm focus:outline-none"
          />
        </div>

        {/* Products lists display (Scrolling) */}
        <div className="p-4 flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full py-16 flex flex-col items-center text-slate-400">
              <Search className="w-10 h-10 mb-2 stroke-1" />
              <span className="text-xs">{t.no_results}</span>
            </div>
          ) : (
            filteredProducts.map(prod => {
              const inStock = prod.quantity > 0;
              const lowStock = prod.quantity <= prod.minQuantity;

              return (
                <div
                  key={prod.id}
                  onClick={() => inStock && addToCart(prod)}
                  className={`border rounded-2xl p-3 flex flex-col justify-between transition-all group ${
                    inStock
                      ? 'border-slate-100 hover:border-sky-500/40 hover:shadow-md cursor-pointer bg-slate-50/50'
                      : 'border-slate-200 bg-slate-100/50 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="relative">
                    {prod.imageUrl ? (
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-24 object-cover rounded-xl mb-2.5 transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-24 bg-sky-100/30 rounded-xl flex items-center justify-center mb-2.5">
                        <ShoppingBag className="w-6 h-6 text-sky-600/50" />
                      </div>
                    )}
                    <span className="absolute top-1.5 right-1.5 bg-slate-900/75 text-white font-semibold text-[9px] px-1.5 py-0.5 rounded-full backdrop-blur-xs">
                      {prod.brand}
                    </span>
                  </div>

                  <div>
                    <h5 className="font-bold text-xs text-slate-800 line-clamp-2 leading-snug mb-1 text-start">
                      {prod.name}
                    </h5>
                    <div className="flex justify-between items-center mt-2 pt-1 border-t border-slate-100">
                      <span className="text-xs font-black text-slate-900">
                        {prod.sellingPrice.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                          !inStock
                            ? 'bg-rose-50 text-rose-600'
                            : lowStock
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        {inStock ? `${prod.quantity} ${lang === 'ar' ? 'قطع' : 'pcs'}` : t.cancelled}
                      </span>
                    </div>

                    {/* Show Serial numbers options triggers if available */}
                    {prod.serialNumbers.length > 0 && (
                      <div className="mt-1.5 pt-1.5 border-t border-dashed border-slate-100 flex flex-wrap gap-1">
                        {prod.serialNumbers.slice(0, 2).map((sn, idx) => (
                          <span
                            key={idx}
                            onClick={e => {
                              e.stopPropagation();
                              addToCart(prod, sn);
                            }}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-800 text-[8px] font-semibold px-1.5 py-0.5 rounded-md transition-all truncate max-w-[65px]"
                            title={sn}
                          >
                            {sn.slice(-6)}
                          </span>
                        ))}
                        {prod.serialNumbers.length > 2 && (
                          <span className="text-[8px] text-slate-400 font-bold self-center">
                            +{prod.serialNumbers.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Generic custom item insertion bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-100">
          {!showCustomForm ? (
            <button
              onClick={() => setShowCustomForm(true)}
              className="w-full py-1.5 text-xs text-sky-700 hover:text-sky-800 font-bold bg-sky-50 rounded-lg flex items-center justify-center gap-1.5 hover:bg-sky-100/80 transition-transform cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {t.add_custom_item}
            </button>
          ) : (
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
              <h6 className="text-xs font-bold text-slate-700">{t.add_custom_item}</h6>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'اسم البند (مثال: شحن رصيد، لاصقة شاشة)' : 'Generic label name'}
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                />
                <input
                  type="number"
                  placeholder={lang === 'ar' ? 'سعر البيع المقترح' : 'Custom price'}
                  value={customPrice || ''}
                  onChange={e => setCustomPrice(Number(e.target.value))}
                  className="px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCustomForm(false)}
                  className="px-3 py-1.5 text-xs border bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={addCustomItemToCart}
                  className="px-6 py-1.5 text-xs bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  {t.add}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cashier Sidebar Drawer (Active Cart) */}
      <div className={`w-full lg:w-[380px] ${mobileViewTab === 'cart' ? 'flex' : 'hidden lg:flex'} bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-lg flex flex-col h-full overflow-hidden`}>
        {/* Real-time price display panel screen for transparency */}
        <div className="p-4 bg-slate-950 text-emerald-400 font-mono text-center relative border-b border-slate-800">
          <div className="absolute top-1 left-2 text-[8px] text-slate-500 uppercase tracking-widest">
            {t.price_screen}
          </div>
          <div className="text-[26px] font-black tracking-wider leading-none">
            {cartTotal.toLocaleString()}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-1">
            {currency === 'DZD' ? 'ALGERIAN DINAR (د.ج)' : 'EURO (€)'}
          </div>
        </div>

        {/* Live checkout list */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1">
              {lang === 'ar' ? 'سلة المبيعات الحالية' : 'Cashier Checkout Drawer'}:{' '}
              <span className="bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded-full text-[10px]">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            </span>
            <button
              onClick={() => setShowQuickProductModal(true)}
              className="text-[9px] bg-emerald-600 hover:bg-emerald-700 text-white font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 transition-all cursor-pointer"
              title={lang === 'ar' ? 'إضافة منتج سريع للمخزن والكاشير' : 'Quick Add Product to DB'}
            >
              <Plus className="w-2.5 h-2.5" />
              <span>{lang === 'ar' ? 'منتج +' : 'Prod +'}</span>
            </button>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => {
                setCart([]);
                DzStoreAudio.playWarningChime(enableSounds);
              }}
              className="p-1 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors cursor-pointer"
              title={t.clear_cart}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Checkout List viewport */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
              <ShoppingBag className="w-12 h-12 mb-3 text-slate-300 stroke-1" />
              <p className="text-xs">{lang === 'ar' ? 'السلة خالية، ابدأ بالتصوير أو الضغط على السلعة' : 'Register is empty'}</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={idx} className="bg-slate-50/70 border border-slate-100 rounded-2xl p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <div className="text-start">
                    <h6 className="text-xs font-bold text-slate-800 line-clamp-1 leading-snug">{item.name}</h6>
                    {item.serialNumber && (
                      <span className="inline-block bg-blue-100/50 text-blue-900 border border-blue-200/50 text-[9px] font-mono px-1.5 py-0.2 rounded-md mt-0.5">
                        IMEI: {item.serialNumber}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeFromCart(idx)}
                    className="p-0.5 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-200/40">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1 text-start">
                      <span className="text-[10px] text-slate-500 font-bold">{lang === 'ar' ? 'السعر د.ج:' : 'Price [DZD]:'}</span>
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const newCart = [...cart];
                          newCart[idx].price = val;
                          setCart(newCart);
                        }}
                        className="w-20 text-xs px-1.5 py-0.5 border border-slate-200 focus:border-emerald-500 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold text-slate-900 font-mono"
                      />
                      <span className="text-[10px] text-slate-400 font-bold">{currency === 'DZD' ? 'د.ج' : '€'}</span>
                    </div>
                    
                    <span className="text-[11px] text-slate-400">
                      {lang === 'ar' ? 'الإجمالي:' : 'Subtotal:'}{' '}
                      <strong className="text-slate-900 font-black">
                        {(item.price * item.quantity).toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                      </strong>
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[9.5px] text-slate-400 text-start">
                      {lang === 'ar' ? 'تعديل الكمية:' : 'Qty:'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateQuantity(idx, -1)}
                        className="p-1 border bg-white rounded-lg hover:bg-slate-100 cursor-pointer text-slate-600"
                        id={`pos-minus-qty-${idx}`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(idx, 1)}
                        className="p-1 border bg-white rounded-lg hover:bg-slate-100 cursor-pointer text-slate-600"
                        id={`pos-plus-qty-${idx}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Parameters checkout modifiers */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-3">
          {/* Linked Customer */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                👤 {t.customer_select}
              </label>
              <button
                type="button"
                onClick={() => setShowQuickCustomerModal(true)}
                className="text-[9px] text-sky-700 hover:text-sky-800 hover:underline font-black flex items-center gap-0.5 transition-colors cursor-pointer"
              >
                <Plus className="w-2.5 h-2.5" />
                {lang === 'ar' ? 'تسجيل عميل جديد' : 'New Customer'}
              </button>
            </div>
            <select
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="">{lang === 'ar' ? 'حدد العميل (اختياري للبيع العام)' : 'Select Customer (Optional)'}</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Discount Factor */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-0.5">
                <Percent className="w-3 h-3 text-amber-500" /> {t.discount}
              </label>
              <select
                value={discountPercent}
                onChange={e => setDiscountPercent(Number(e.target.value))}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value={0}>0%</option>
                <option value={2}>2%</option>
                <option value={5}>5%</option>
                <option value={10}>10%</option>
                <option value={15}>15%</option>
                <option value={20}>20%</option>
              </select>
            </div>

            {/* Warranty Picker */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                🛡️ {t.warranty_period}
              </label>
              <select
                value={warrantyPeriod}
                onChange={e => setWarrantyPeriod(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="no warranty">{t.warranty_none}</option>
                <option value="3 months">{t.warranty_3m}</option>
                <option value="6 months">{t.warranty_6m}</option>
                <option value="1 year">{t.warranty_1y}</option>
              </select>
            </div>
          </div>

          {/* Warranty comment input */}
          <div>
            <textarea
              placeholder={lang === 'ar' ? 'شروط خاصة بالضمان أو السيريال...' : 'Custom warranty instructions...'}
              value={warrantyNotes}
              onChange={e => setWarrantyNotes(e.target.value)}
              className="w-full px-2.5 py-1 text-xs border border-slate-200 bg-white rounded-lg resize-none h-10 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Payment Gateway Toggle */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              💳 {t.payment_method}
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-200/55 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-1 text-[10px] font-black rounded-lg text-center transition-colors cursor-pointer ${
                  paymentMethod === 'cash' ? 'bg-white shadow-xs text-slate-900 border border-slate-100' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t.cash}
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`py-1 text-[10px] font-black rounded-lg text-center transition-colors cursor-pointer ${
                  paymentMethod === 'card' ? 'bg-white shadow-xs text-slate-900 border border-slate-100' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t.card}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!selectedCustomerId) {
                    alert(lang === 'ar' ? 'يرجى ربط البيع بالتقسيط لزبون مسجل أولاً!' : 'Please lock customer profile first!');
                    return;
                  }
                  setPaymentMethod('installments');
                }}
                className={`py-1 text-[10px] font-black rounded-lg text-center transition-colors cursor-pointer ${
                  paymentMethod === 'installments'
                    ? 'bg-amber-500 shadow-xs text-white border border-amber-600'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t.installments}
              </button>
            </div>
          </div>

          {/* Transaction Summary checkout */}
          <div className="pt-2 border-t border-slate-200 text-xs space-y-1">
            <div className="flex justify-between text-slate-500">
              <span>{t.subtotal}:</span>
              <span>
                {cartSubtotal.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
              </span>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between text-rose-500 font-bold">
                <span>{t.discount} ({discountPercent}%):</span>
                <span>
                  -{totalDiscount.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                </span>
              </div>
            )}
            <div className="flex justify-between font-black text-slate-900 text-sm">
              <span>{t.total}:</span>
              <span>
                {cartTotal.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
              </span>
            </div>
          </div>

          {/* Finalize Action */}
          <button
            onClick={handleFinalizeSale}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm py-2.5 rounded-xl transition-all shadow-md active:scale-[98%] hover:shadow-emerald-100 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            {t.pay_btn}
          </button>
        </div>
      </div>
    </div>

      {/* COMPLETED SUCCESS INVOICE MODAL POPUP */}
      {showInvoicePrint && lastCompletedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 text-slate-800">
            {/* Ticket header */}
            <div className="bg-emerald-700 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-300" />
                <h4 className="font-extrabold text-lg">
                  {lang === 'ar' ? 'تمت عملية البيع وحفظ الفاتورة !' : 'Receipt generated!'}
                </h4>
              </div>
              <button
                onClick={() => {
                  setShowInvoicePrint(false);
                  setLastCompletedInvoice(null);
                }}
                className="text-white hover:bg-emerald-800 p-1 rounded-full transition-all"
              >
                ✕
              </button>
            </div>

            {/* Quick Preview summary */}
            <div className="p-6 space-y-4 max-h-[350px] overflow-y-auto font-sans">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2 text-start">
                <div className="flex justify-between text-xs text-slate-500 font-bold">
                  <span>{t.ticket_num}: {lastCompletedInvoice.invoiceNumber}</span>
                  <span>{new Date(lastCompletedInvoice.date).toLocaleDateString()}</span>
                </div>
                <div className="text-xs text-slate-700 space-y-1">
                  <p>
                    <strong>👤 {t.customers}:</strong>{' '}
                    {lastCompletedInvoice.customerName || (lang === 'ar' ? 'زبون عابر' : 'Guest Customer')}
                  </p>
                  <p>
                    <strong>💳 {t.payment_method}:</strong> {t[lastCompletedInvoice.paymentMethod]}
                  </p>
                  <p>
                    <strong>🛡️ {t.warranty_period}:</strong> {lastCompletedInvoice.warrantyPeriod}
                  </p>
                </div>
              </div>

              {/* Items listing preview */}
              <div className="border border-slate-100 rounded-2xl overflow-hidden text-start">
                <div className="bg-slate-50/70 p-3 text-xs font-bold border-b border-slate-100 flex justify-between text-slate-600">
                  <span>{t.product_name}</span>
                  <span>{t.price}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {lastCompletedInvoice.items.map((it, i) => (
                    <div key={i} className="p-3 text-xs flex justify-between">
                      <div>
                        <span className="font-semibold">{it.name}</span>
                        {it.serialNumber && (
                          <span className="block text-[10px] text-blue-700 font-mono">IMEI: {it.serialNumber}</span>
                        )}
                        <span className="text-[10px] text-slate-400 block">
                          {it.quantity} × {it.price.toLocaleString()}
                        </span>
                      </div>
                      <span className="font-extrabold text-slate-900">
                        {(it.price * it.quantity).toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Balance Summary block */}
              <div className="border-t border-slate-200/60 pt-3 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-600">{lang === 'ar' ? 'إجمالي المقبوض' : 'Total Invoice Sum'}:</span>
                <span className="text-xl font-black text-emerald-700">
                  {lastCompletedInvoice.total.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                </span>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => {
                  setShowInvoicePrint(false);
                  setLastCompletedInvoice(null);
                }}
                className="flex-1 text-sm bg-white border text-slate-700 py-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={printDocument}
                className="flex-1 text-sm bg-sky-700 hover:bg-sky-800 text-white font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                {lang === 'ar' ? 'طباعة الوصل والضمان' : 'Print Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Render Phone Barcode Camera Scanner Modal */}
      {showPOSScanner && (
        <BarcodeCameraScanner
          lang={lang === 'ar' ? 'ar' : 'en'}
          onScanSuccess={(code) => {
            const foundProduct = products.find(p => p.barcode === code);
            if (foundProduct) {
              addToCart(foundProduct);
              if (onShowToast) {
                onShowToast(lang === 'ar' ? '✅ تم التعرف على السلعة وإضافتها للثلة!' : '✅ Swiped barcode and added item to cart!', 'success');
              }
            } else {
              alert((lang === 'ar' ? '⚠️ لم يتم التعرف على المنتج: ' : '⚠️ Unrecognized barcode: ') + code);
            }
            setShowPOSScanner(false);
          }}
          onClose={() => setShowPOSScanner(false)}
        />
      )}

      {/* QUICK ADD PRODUCT MODAL OVERLAY */}
      {showQuickProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[calc(100vh-2rem)] shadow-2xl overflow-hidden border border-slate-100 flex flex-col text-slate-800">
            <div className="bg-emerald-700 text-white p-4 flex justify-between items-center">
              <h3 className="font-extrabold text-base flex items-center gap-1.5">
                <ShoppingBag className="w-5 h-5 text-emerald-200" />
                {lang === 'ar' ? 'إضافة منتج سريع للمخزن' : 'Quick Add Product'}
              </h3>
              <button onClick={() => setShowQuickProductModal(false)} className="text-white hover:bg-emerald-800 p-1 rounded-full transition-colors">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuickProduct} className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.product_name} *</label>
                  <input
                    type="text"
                    required
                    value={qpName}
                    onChange={e => setQpName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">{t.brand} *</label>
                    <input
                      type="text"
                      required
                      placeholder="Apple, Samsung..."
                      value={qpBrand}
                      onChange={e => setQpBrand(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">{t.type}</label>
                    <select
                      value={qpType}
                      onChange={e => setQpType(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 focus:outline-none"
                    >
                      <option value="Phone">{lang === 'ar' ? 'هاتف نقال' : 'Smart Phone'}</option>
                      <option value="Accessory">{lang === 'ar' ? 'إكسسوار ملحق' : 'Accessory'}</option>
                      <option value="Tablet">{lang === 'ar' ? 'لوحة إلكترونية' : 'Tablet'}</option>
                      <option value="Hardware">{lang === 'ar' ? 'حاسوب / شاشة مجزأة' : 'Computer'}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'ar' ? 'سعر الشراء' : 'Purchase Price'} *</label>
                    <input
                      type="number"
                      required
                      value={qpPurchasePrice || ''}
                      onChange={e => setQpPurchasePrice(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'ar' ? 'سعر البيع' : 'Selling Price'} *</label>
                    <input
                      type="number"
                      required
                      value={qpSellingPrice || ''}
                      onChange={e => setQpSellingPrice(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-gray-700">{t.barcode} *</label>
                      <button
                        type="button"
                        onClick={() => setQpBarcode(String(Math.floor(Math.random() * 900000000000) + 100000000000))}
                        className="text-[9px] text-amber-600 font-bold hover:underline"
                      >
                        {lang === 'ar' ? 'توليد تلقائي' : 'Auto'}
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={qpBarcode}
                      onChange={e => setQpBarcode(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">{t.quantity} *</label>
                    <input
                      type="number"
                      required
                      value={qpQuantity || ''}
                      onChange={e => setQpQuantity(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 focus:outline-none"
                    />
                  </div>
                </div>

                {qpType === 'Phone' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">📱 IMEIs / SNs (فاصلة)</label>
                    <input
                      type="text"
                      placeholder="e.g. 35829391029192, ..."
                      value={qpIMEIs}
                      onChange={e => setQpIMEIs(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 focus:outline-none font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">📸 {lang === 'ar' ? 'تحميل صورة المنتج من الكمبيوتر' : 'Upload Product Photo'}</label>
                  <div className="flex gap-2 items-center">
                    {qpImageUrl ? (
                      <img
                        src={qpImageUrl}
                        alt="Preview"
                        className="w-10 h-10 rounded-lg object-cover border"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-[8px] text-slate-400 border font-bold">
                        No Img
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setQpImageUrl(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="text-xs flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-3 pt-4 border-t border-slate-100 flex gap-2 -mx-4 -mb-4 justify-end">
                <button
                  type="button"
                  onClick={() => setShowQuickProductModal(false)}
                  className="px-4 py-2 text-xs bg-white border text-gray-700 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ADD CUSTOMER MODAL OVERLAY */}
      {showQuickCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm max-h-[calc(100vh-2rem)] shadow-2xl overflow-hidden border border-slate-100 flex flex-col text-slate-800">
            <div className="bg-sky-700 text-white p-4 flex justify-between items-center">
              <h3 className="font-extrabold text-base flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-sky-200" />
                {lang === 'ar' ? 'تسجيل عميل جديد' : 'New Customer'}
              </h3>
              <button onClick={() => setShowQuickCustomerModal(false)} className="text-white hover:bg-sky-800 p-1 rounded-full transition-colors">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuickCustomer} className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t.customer_name} *</label>
                <input
                  type="text"
                  required
                  value={qcName}
                  onChange={e => setQcName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'ar' ? 'رقم الهاتف' : 'Phone'} *</label>
                <input
                  type="text"
                  required
                  value={qcPhone}
                  onChange={e => setQcPhone(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t.address}</label>
                <input
                  type="text"
                  value={qcAddress}
                  onChange={e => setQcAddress(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 focus:outline-none"
                />
              </div>

              <div className="bg-slate-50 p-3 pt-4 border-t border-slate-100 flex gap-2 -mx-4 -mb-4 justify-end">
                <button
                  type="button"
                  onClick={() => setShowQuickCustomerModal(false)}
                  className="px-4 py-2 text-xs bg-white border text-gray-700 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl transition-colors cursor-pointer"
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
