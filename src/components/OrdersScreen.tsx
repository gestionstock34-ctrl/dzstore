import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Phone, 
  MapPin, 
  Search, 
  ArrowRight,
  Printer,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  Plus,
  Send
} from 'lucide-react';
import { DzStoreDB } from '../lib/db';
import { CustomerOrder, Product } from '../types';

interface OrdersScreenProps {
  shopId: string;
  currency: string;
  lang: 'ar' | 'fr' | 'en';
  onShowToast: (msg: string, role: string) => void;
  // Option to convert this order directly to a POS cart
  onConvertOrderToCart?: (items: any[]) => void;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  shopId,
  currency,
  lang,
  onShowToast,
  onConvertOrderToCart
}) => {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'completed' | 'cancelled'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);

  // Load orders
  const loadOrders = () => {
    setLoading(true);
    try {
      const shopOrders = DzStoreDB.getOrders(shopId);
      setOrders(shopOrders);
    } catch (err) {
      console.error("Failed to load customer orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // Refresh interval or event registers if any
  }, [shopId]);

  const handleUpdateStatus = (orderId: string, nextStatus: CustomerOrder['status']) => {
    const updated = orders.map(ord => {
      if (ord.id === orderId) {
        return {
          ...ord,
          status: nextStatus,
          updatedAt: new Date().toISOString()
        };
      }
      return ord;
    });

    try {
      DzStoreDB.saveOrders(shopId, updated);
      setOrders(updated);
      
      // Update local state copy in detail overlay
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          status: nextStatus,
          updatedAt: new Date().toISOString()
        });
      }

      const statusMsgs = {
        accepted: lang === 'ar' ? '✅ تم قبول الطلب وترتيب التجهيز' : 'Order accepted',
        completed: lang === 'ar' ? '🎉 تم إنهاء الطلبية بنجاح وتسليمها' : 'Order marked completed',
        cancelled: lang === 'ar' ? '❌ تم إلغاء الطلبية وتحديث السجل' : 'Order canceled'
      };

      onShowToast(statusMsgs[nextStatus as 'accepted' | 'completed' | 'cancelled'] || 'Status updated', 'success');
    } catch (e) {
      console.error("Failed to update order status:", e);
      onShowToast(lang === 'ar' ? '⚠️ حدث خطأ أثناء التحديث!' : 'Failed to update status', 'error');
    }
  };

  // Status visual configurations
  const getStatusBadge = (status: CustomerOrder['status']) => {
    switch (status) {
      case 'pending':
        return <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">{lang === 'ar' ? 'قيد الانتظار' : 'Pending'}</span>;
      case 'accepted':
        return <span className="bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">{lang === 'ar' ? 'مقبول' : 'Accepted'}</span>;
      case 'completed':
        return <span className="bg-emerald-100 text-emerald-950 border border-emerald-250 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">{lang === 'ar' ? 'مسلم ومكتمل' : 'Completed'}</span>;
      case 'cancelled':
        return <span className="bg-rose-100 text-rose-950 border border-rose-200 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">{lang === 'ar' ? 'ملغي' : 'Cancelled'}</span>;
    }
  };

  const filteredOrders = orders.filter(ord => {
    // Status check
    if (filter !== 'all' && ord.status !== filter) return false;
    
    // Search check
    const query = search.toLowerCase();
    if (!query) return true;
    
    return (
      ord.customerName.toLowerCase().includes(query) ||
      ord.customerPhone.includes(query) ||
      ord.customerAddress.toLowerCase().includes(query) ||
      ord.id.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Title block */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="text-start">
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-emerald-500" />
            <span>{lang === 'ar' ? 'إدارة طلبات الشراء الإلكترونية (QR Storefront)' : 'QR Storefront Client Orders'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {lang === 'ar' 
              ? 'تلقي طلبات الشراء المودعة مباشرة من صفحة المبيعات الإلكترونية ومراجعتها.'
              : 'View and process customer purchase requests placed via their portal.'
            }
          </p>
        </div>

        <button 
          onClick={loadOrders}
          className="bg-white dark:bg-slate-800 border border-slate-205 py-2 px-4 rounded-xl text-xs font-black shadow-xs hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer dark:text-slate-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{lang === 'ar' ? 'تحديث اللائحة' : 'Refresh'}</span>
        </button>
      </div>

      {/* Grid layouts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Orders list */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Filters & search line */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3.5">
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'pending', 'accepted', 'completed', 'cancelled'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black cursor-pointer transition-all uppercase ${
                    filter === st 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-200'
                  }`}
                >
                  {st === 'all' ? (lang === 'ar' ? 'الكل' : 'All') :
                   st === 'pending' ? (lang === 'ar' ? 'قيد الانتظار' : 'Pending') :
                   st === 'accepted' ? (lang === 'ar' ? 'مقبول' : 'Accepted') :
                   st === 'completed' ? (lang === 'ar' ? 'مكتمل' : 'Completed') :
                   (lang === 'ar' ? 'ملغي' : 'Cancelled')}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={lang === 'ar' ? 'ابحث باسم الزبون، هاتفه، أو كود المعاملة...' : 'Search buyer name, telephone...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border rounded-xl py-2.5 pr-9 pl-4 focus:ring-1 focus:ring-emerald-500 focus:outline-none dark:text-white"
              />
            </div>
          </div>

          {/* List display */}
          <div className="space-y-3 text-start">
            {filteredOrders.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-3xl text-slate-400">
                <ClipboardList className="w-12 h-12 mx-auto opacity-10 mb-2" />
                <p className="font-extrabold text-sm">{lang === 'ar' ? 'لا توجد طلبات شراء مسجلة حالياً.' : 'No customer orders registered.'}</p>
                <p className="text-xs pt-1">{lang === 'ar' ? 'سيتم سرد الطلبيات المرفوعة من صفحة العميل هنا تلقائياً!' : 'Storefront checkouts appear here.'}</p>
              </div>
            ) : (
              filteredOrders.map(ord => {
                const totalItemsQty = ord.items.reduce((acc, it) => acc + it.quantity, 0);
                return (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrder(ord)}
                    className={`bg-white dark:bg-slate-900 border rounded-2xl p-4.5 shadow-xs cursor-pointer hover:border-emerald-55/60 transition-all flex justify-between items-center gap-4 ${
                      selectedOrder?.id === ord.id ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] text-slate-400 font-extrabold pb-0.5">#{ord.id.split('-')[1]}</span>
                        {getStatusBadge(ord.status)}
                      </div>
                      
                      <h4 className="font-extrabold text-xs text-slate-950 dark:text-slate-100 truncate">👤 {ord.customerName}</h4>
                      
                      <p className="text-[10.5px] text-slate-450 flex items-center gap-1.5 font-medium">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono">{ord.customerPhone}</span>
                        <span>•</span>
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{ord.customerAddress}</span>
                      </p>

                      <p className="text-[10px] text-indigo-650 bg-indigo-50 dark:bg-indigo-950/20 w-fit px-2 py-0.5 rounded font-black mt-1">
                        📦 {lang === 'ar' ? `${totalItemsQty} قطع في السلة` : `${totalItemsQty} items`}
                      </p>
                    </div>

                    <div className="text-end shrink-0">
                      <strong className="text-sm font-black text-rose-600 font-mono block">
                        {ord.totalAmount.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                      </strong>
                      <span className="text-[9.5px] text-slate-400">
                        {new Date(ord.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Order detailed preview & fast actions panel */}
        <div className="space-y-4 text-start">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="font-black text-sm text-slate-800 dark:text-white border-b pb-2">🧾 {lang === 'ar' ? 'معاينة تفاصيل الطلب بنشاط:' : 'Detailed Order Information:'}</h3>

            {!selectedOrder ? (
              <div className="py-20 text-center text-slate-400 italic text-xs">
                {lang === 'ar' ? 'اضغط على أي طلبية في القائمة لمراجعتها واتخاذ القرار.' : 'Select an order from list to view.'}
              </div>
            ) : (
              <div className="space-y-5">
                
                {/* Header overview info */}
                <div className="space-y-2 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-mono text-xs text-slate-450">ID: #{selectedOrder.id}</span>
                    {getStatusBadge(selectedOrder.status)}
                  </div>

                  <div className="text-xs space-y-1.5 font-sans pt-1">
                    <p className="font-bold text-slate-900 dark:text-slate-100">👤 {selectedOrder.customerName}</p>
                    <p className="font-mono text-slate-600 dark:text-slate-300">📞 {selectedOrder.customerPhone}</p>
                    <p className="text-slate-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 shrink-0" /> {selectedOrder.customerAddress}</p>
                    {selectedOrder.notes && (
                      <p className="text-[11px] bg-white dark:bg-slate-700/50 text-slate-650 p-2 border border-dashed rounded-lg font-medium mt-1">
                        💡 {lang === 'ar' ? 'ملاحظة المشتري:' : 'Buyer Notes:'} {selectedOrder.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Items grid */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">{lang === 'ar' ? 'المنتجات المطلوبة للتوصيل:' : 'Requested Products:'}</span>
                  
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-55/10">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-105 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase text-center">
                        <tr>
                          <th className="px-3 py-2 text-start">{lang === 'ar' ? 'المنتج' : 'Item'}</th>
                          <th className="px-2 py-2 text-center">{lang === 'ar' ? 'الكمية' : 'Qty'}</th>
                          <th className="px-3 py-2 text-end">{lang === 'ar' ? 'الإجمالي' : 'Sum'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-center font-bold">
                        {selectedOrder.items.map((itm, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-start text-slate-850 dark:text-slate-100">📱 {itm.name}</td>
                            <td className="px-2 py-2 font-mono">{itm.quantity}</td>
                            <td className="px-3 py-2 font-mono text-slate-905 dark:text-slate-100 text-end">{(itm.price * itm.quantity).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center pt-2 font-black text-slate-900 dark:text-white">
                    <span>{lang === 'ar' ? 'إجمالي الطلبية ككل:' : 'Order Total:'}</span>
                    <span className="text-rose-600 font-mono text-lg">{selectedOrder.totalAmount.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}</span>
                  </div>
                </div>

                {/* Status action buttons */}
                <div className="space-y-2 border-t pt-4">
                  <span className="text-[10.5px] font-bold text-slate-400 block">{lang === 'ar' ? 'العمليات وتحديث الحالة:' : 'Operations:'}</span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {selectedOrder.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedOrder.id, 'accepted')}
                        className="py-2.5 px-4 bg-blue-600 hover:bg-blue-750 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs active:translate-y-0.2"
                      >
                        ✅ {lang === 'ar' ? 'قبول وتجهيز' : 'Accept Order'}
                      </button>
                    )}

                    {selectedOrder.status === 'accepted' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedOrder.id, 'completed')}
                        className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs active:translate-y-0.2"
                      >
                        🎉 {lang === 'ar' ? 'تسليم وإنجاز' : 'Deliver Order'}
                      </button>
                    )}

                    {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                        className="py-2.5 px-4 bg-slate-200 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-300 dark:hover:bg-rose-950 text-slate-700 rounded-xl font-bold text-xs cursor-pointer shadow-xs transition-colors"
                      >
                        ❌ {lang === 'ar' ? 'إلغاء الطلب' : 'Cancel Order'}
                      </button>
                    )}
                  </div>

                  {/* Convert to sell on POS */}
                  {onConvertOrderToCart && selectedOrder.status !== 'cancelled' && (
                    <button
                      onClick={() => {
                        if (onConvertOrderToCart) {
                          onConvertOrderToCart(selectedOrder.items);
                          onShowToast(lang === 'ar' ? '📥 تم تصدير السلة للـ POS بنجاح! افتح الكاشير لإتمام البيع.' : 'Exported items successfully to POS!', 'success');
                        }
                      }}
                      className="w-full py-2.5 px-4 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl font-black text-xs cursor-pointer shadow-md flex items-center justify-center gap-1.5 mt-3"
                    >
                      <Plus className="w-4 h-4 text-white" />
                      <span>{lang === 'ar' ? 'إرسال السلة لـ POS الكاشير' : 'Load Items into cashier POS'}</span>
                    </button>
                  )}
                </div>

              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
