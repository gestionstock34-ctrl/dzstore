/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Currency, Language, Product, SparePart, Supplier, AppUser } from '../types';
import { TRANSLATIONS } from '../lib/data';
import { DzStoreDB } from '../lib/db';
import { BarcodeGenerator } from './BarcodeGenerator';
import { BarcodeSticker } from './BarcodeSticker';
import { DzStoreAudio } from './AudioAlerts';
import {
  Plus,
  Edit2,
  Trash2,
  Barcode,
  Search,
  Download,
  Upload,
  AlertTriangle,
  Layers,
  Wrench,
  Package,
  Cpu,
  Bookmark,
  Printer,
  Camera
} from 'lucide-react';
import { BarcodeCameraScanner } from './BarcodeCameraScanner';

interface InventoryScreenProps {
  shopId: string;
  currency: Currency;
  lang: Language;
  onRefreshStats: () => void;
  enableSounds: boolean;
  user?: AppUser;
  syncKey?: number;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({
  shopId,
  currency,
  lang,
  onRefreshStats,
  enableSounds,
  user,
  syncKey,
}) => {
  const t = TRANSLATIONS[lang];

  // Active Tab: 'products' | 'parts'
  const [activeSegment, setActiveSegment] = useState<'products' | 'parts'>('products');

  // Database resources
  const [products, setProducts] = useState<Product[]>([]);
  const [parts, setParts] = useState<SparePart[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Modals for Adding / Editing Products
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Forms states (Product)
  const [pName, setPName] = useState('');
  const [pBrand, setPBrand] = useState('');
  const [pType, setPType] = useState('Phone');
  const [pBarcode, setPBarcode] = useState('');
  const [pQuantity, setPQuantity] = useState(1);
  const [pMinQuantity, setPMinQuantity] = useState(2);
  const [pPurchasePrice, setPPurchasePrice] = useState(0);
  const [pSellingPrice, setPSellingPrice] = useState(0);
  const [pSerialNumbers, setPSerialNumbers] = useState('');
  const [pNotes, setPNotes] = useState('');
  const [pImageUrl, setPImageUrl] = useState('');
  const [pSupplierId, setPSupplierId] = useState('');

  // Modals for Spare Parts
  const [showPartModal, setShowPartModal] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);

  // Forms states (Spare Part)
  const [spName, setSpName] = useState('');
  const [spModel, setSpModel] = useState('');
  const [spPurchasePrice, setSpPurchasePrice] = useState(0);
  const [spSellingPrice, setSpSellingPrice] = useState(0);
  const [spSupplierId, setSpSupplierId] = useState('');
  const [spQuantity, setSpQuantity] = useState(1);
  const [spMinQuantity, setSpMinQuantity] = useState(1);
  const [spNotes, setSpNotes] = useState('');

  // Printable label state hook
  const [labelStickerData, setLabelStickerData] = useState<{
    name: string;
    brand: string;
    price: number;
    barcode: string;
  } | null>(null);

  // Selection state for multi-delete
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Clear selection on tab change or when products modify
  useEffect(() => {
    setSelectedProductIds([]);
  }, [activeSegment, products]);

  // Load Inventory data on init/sync
  useEffect(() => {
    setProducts(DzStoreDB.getProducts(shopId));
    setParts(DzStoreDB.getSpareParts(shopId));
    setSuppliers(DzStoreDB.getSuppliers(shopId));
  }, [shopId, syncKey]);

  // Handle Export Inventory backup
  const handleExportBackup = () => {
    const backupJson = DzStoreDB.exportDatabase(shopId);
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DzStore_Inventory_Backup_Shop_${shopId}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    DzStoreAudio.playNotification(enableSounds);
  };

  // Handle Import Inventory backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = DzStoreDB.importDatabase(shopId, content);
      if (success) {
        setProducts(DzStoreDB.getProducts(shopId));
        setParts(DzStoreDB.getSpareParts(shopId));
        onRefreshStats();
        DzStoreAudio.playSuccessChime(enableSounds);
        alert(lang === 'ar' ? 'تم استيراد نسخة قاعدة المخزون بنجاح!' : 'Inventory database restored successfully!');
      } else {
        DzStoreAudio.playWarningChime(enableSounds);
        alert(lang === 'ar' ? 'خطأ في الاستيراد، يرجى التحقق من بنية الملف!' : 'Restore failed, invalid file schema!');
      }
    };
    reader.readAsText(file);
  };

  // Handle Excel (.xlsx) export for products
  const handleExportCSV = () => {
    if (products.length === 0) {
      alert(lang === 'ar' ? 'لا توجد منتجات لتصديرها!' : 'No products to export!');
      return;
    }

    const headers = lang === 'ar' 
      ? ['اسم المنتج', 'الماركة', 'النوع', 'الكود بار', 'الكمية', 'الحد الأدنى', 'سعر الشراء', 'سعر البيع', 'الأرقام التسلسلية', 'ملاحظات']
      : ['Product Name', 'Brand', 'Type', 'Barcode', 'Quantity', 'Min Quantity', 'Purchase Price', 'Selling Price', 'IMEI Serial Numbers', 'Notes'];

    const dataRows = [headers];

    products.forEach(p => {
      const serialsStr = p.serialNumbers ? p.serialNumbers.join('; ') : '';
      dataRows.push([
        p.name,
        p.brand,
        p.type,
        p.barcode,
        p.quantity,
        p.minQuantity,
        p.purchasePrice,
        p.sellingPrice,
        serialsStr,
        p.notes || ''
      ]);
    });

    try {
      const worksheet = XLSX.utils.aoa_to_sheet(dataRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, lang === 'ar' ? 'المخزن' : 'Inventory');
      XLSX.writeFile(workbook, `DzStore_Excel_Inventory_${shopId}_${new Date().toISOString().split('T')[0]}.xlsx`);
      DzStoreAudio.playNotification(enableSounds);
    } catch (err: any) {
      alert((lang === 'ar' ? 'خطأ أثناء تصدير ملف Excel: ' : 'Error exporting Excel sheet: ') + err.message);
    }
  };

  // Handle Excel (.xlsx, .xls, .csv) Import for products
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        if (!arrayBuffer) return;

        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to array of arrays (header: 1 forces array of arrays)
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        if (rows.length <= 1) {
          alert(lang === 'ar' ? 'الملف فارغ أو لا يحتوي على أسطر صالحة!' : 'The uploaded sheet has no rows!');
          return;
        }

        const firstRow = rows[0] as any[];
        if (!firstRow) {
          alert(lang === 'ar' ? 'الملف فارغ!' : 'The sheet is empty!');
          return;
        }

        // Intelligently map columns based on headers in firstRow
        let nameIdx = -1;
        let brandIdx = -1;
        let typeIdx = -1;
        let barcodeIdx = -1;
        let qtyIdx = -1;
        let minQtyIdx = -1;
        let purchaseIdx = -1;
        let sellingIdx = -1;
        let serialIdx = -1;
        let notesIdx = -1;

        for (let col = 0; col < firstRow.length; col++) {
          const cellVal = String(firstRow[col] || '').toLowerCase().trim();
          if (cellVal.includes('اسم') || cellVal.includes('product') || cellVal.includes('name') || cellVal.includes('المنتج')) {
            nameIdx = col;
          } else if (cellVal.includes('ماركة') || cellVal.includes('brand') || cellVal.includes('الماركة') || cellVal.includes('البراند')) {
            brandIdx = col;
          } else if (cellVal.includes('نوع') || cellVal.includes('type') || cellVal.includes('النوع')) {
            typeIdx = col;
          } else if (cellVal.includes('كود') || cellVal.includes('barcode') || cellVal.includes('بار') || cellVal.includes('الرمز')) {
            barcodeIdx = col;
          } else if (cellVal.includes('كمية') || cellVal.includes('quantity') || cellVal.includes('الكمية') || cellVal.includes('العدد')) {
            qtyIdx = col;
          } else if (cellVal.includes('حد') || cellVal.includes('min') || cellVal.includes('الحد')) {
            minQtyIdx = col;
          } else if (cellVal.includes('شراء') || cellVal.includes('purchase') || cellVal.includes('الشراء') || cellVal.includes('سعر_الشراء')) {
            purchaseIdx = col;
          } else if (cellVal.includes('بيع') || cellVal.includes('selling') || cellVal.includes('sales') || cellVal.includes('البيع') || cellVal.includes('سعر_البيع')) {
            sellingIdx = col;
          } else if (cellVal.includes('تسل') || cellVal.includes('serial') || cellVal.includes('imei') || cellVal.includes('الأرقام')) {
            serialIdx = col;
          } else if (cellVal.includes('ملاحظ') || cellVal.includes('note') || cellVal.includes('الملاحظات')) {
            notesIdx = col;
          }
        }

        // Fallback to defaults if headers were not auto-detected
        if (nameIdx === -1) nameIdx = 0;
        if (brandIdx === -1 && firstRow.length > 1) brandIdx = 1;
        if (typeIdx === -1 && firstRow.length > 2) typeIdx = 2;
        if (barcodeIdx === -1 && firstRow.length > 3) barcodeIdx = 3;
        if (qtyIdx === -1 && firstRow.length > 4) qtyIdx = 4;
        if (minQtyIdx === -1 && firstRow.length > 5) minQtyIdx = 5;
        if (purchaseIdx === -1 && firstRow.length > 6) purchaseIdx = 6;
        if (sellingIdx === -1 && firstRow.length > 7) sellingIdx = 7;
        if (serialIdx === -1 && firstRow.length > 8) serialIdx = 8;
        if (notesIdx === -1 && firstRow.length > 9) notesIdx = 9;

        const parsedProducts: Product[] = [];
        // Process rows starting from index 1 (skip header row)
        for (let i = 1; i < rows.length; i++) {
          const columns = rows[i] as any[];
          if (!columns || columns.length === 0) continue;

          const name = nameIdx !== -1 && columns[nameIdx] !== undefined ? String(columns[nameIdx]).trim() : '';
          if (!name) continue; // Skip rows where name is empty

          const brand = brandIdx !== -1 && columns[brandIdx] !== undefined ? String(columns[brandIdx]).trim() : 'Generic';
          const type = typeIdx !== -1 && columns[typeIdx] !== undefined ? String(columns[typeIdx]).trim() : 'Accessory';
          const barcode = barcodeIdx !== -1 && columns[barcodeIdx] !== undefined ? String(columns[barcodeIdx]).trim() : String(Math.floor(Math.random() * 900000000000) + 100000000000);
          const quantity = qtyIdx !== -1 && columns[qtyIdx] !== undefined ? Number(columns[qtyIdx]) || 0 : 1;
          const minQuantity = minQtyIdx !== -1 && columns[minQtyIdx] !== undefined ? Number(columns[minQtyIdx]) || 0 : 2;
          const purchasePrice = purchaseIdx !== -1 && columns[purchaseIdx] !== undefined ? Number(columns[purchaseIdx]) || 0 : 0;
          const sellingPrice = sellingIdx !== -1 && columns[sellingIdx] !== undefined ? Number(columns[sellingIdx]) || 0 : 0;
          const serialsRaw = serialIdx !== -1 && columns[serialIdx] !== undefined ? String(columns[serialIdx]).trim() : '';
          const serialNumbers = serialsRaw ? serialsRaw.split(/[\s,;]+/).map(s => s.trim()).filter(s => s.length > 0) : [];
          const notes = notesIdx !== -1 && columns[notesIdx] !== undefined ? String(columns[notesIdx]).trim() : '';

          parsedProducts.push({
            id: `p-import-${Date.now()}-${i}`,
            shopId,
            name,
            brand,
            type,
            barcode,
            quantity,
            minQuantity,
            purchasePrice,
            sellingPrice,
            serialNumbers,
            dateAdded: new Date().toISOString().split('T')[0],
            notes,
            updatedAt: new Date().toISOString()
          });
        }

        if (parsedProducts.length === 0) {
          alert(lang === 'ar' ? 'لم نجد أي منتجات صالحة في ملف Excel!' : 'No valid product rows parsed from Excel!');
          return;
        }

        const mode = confirm(lang === 'ar' 
          ? `✓ تم تحميل ${parsedProducts.length} منتج من ملف Excel بنجاح!\n\nاضغط [موافق / OK] لـ "إضافة" المنتجات للمخزون الحالي.\nاضغط [إلغاء / Cancel] لـ "استبدال" ومسح المخزون القديم بالكامل.`
          : `✓ Successfully loaded ${parsedProducts.length} products!\n\nClick [OK] to append to current stock.\nClick [Cancel] to completely replace the inventory database.`
        );

        let finalProducts = [...products];
        if (mode) {
          // Append mode
          finalProducts = [...finalProducts, ...parsedProducts];
        } else {
          // Overwrite mode
          finalProducts = parsedProducts;
        }

        DzStoreDB.saveProducts(shopId, finalProducts);
        setProducts(finalProducts);
        onRefreshStats();
        DzStoreAudio.playSuccessChime(enableSounds);
        alert(lang === 'ar' ? '✓ تم تحديث واستيراد المخزن ومطابقته للـ Excel بنجاح!' : '✓ Inventory updated with Excel sheets successfully!');
      } catch (err: any) {
        alert((lang === 'ar' ? 'خطأ أثناء تحليل ملف Excel: ' : 'Error parsing Excel sheet: ') + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Product Auto Barcode Generator
  const handleAutoGenerateBarcode = () => {
    const randomCode = String(Math.floor(Math.random() * 900000000000) + 100000000000);
    setPBarcode(randomCode);
    DzStoreAudio.playScanBeep(enableSounds);
  };

  // Product CRUD
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName || !pBrand || !pBarcode) return;

    // Validate custom price editing permission
    const isOwnerOrAdmin = !user || user.role === 'owner' || user.role === 'admin';
    const canChangePrices = isOwnerOrAdmin || user.canEditPrices === true;

    if (!canChangePrices) {
      if (!editingProduct) {
        if (pPurchasePrice > 0 || pSellingPrice > 0) {
          alert(lang === 'ar'
            ? '⚠️ عذراً! ليس لديك صلاحية تعديل وتسعير المنتجات المضافة (canEditPrices).'
            : '⚠️ Access Denied! You do not have permissions to modify or set stock prices (canEditPrices).'
          );
          return;
        }
      } else {
        if (pPurchasePrice !== editingProduct.purchasePrice || pSellingPrice !== editingProduct.sellingPrice) {
          alert(lang === 'ar'
            ? '⚠️ عذراً! ليس لديك صلاحية تعديل أسعار الشراء أو البيع (canEditPrices).'
            : '⚠️ Access Denied! You do not have permissions to edit product buying or selling prices (canEditPrices).'
          );
          setPPurchasePrice(editingProduct.purchasePrice);
          setPSellingPrice(editingProduct.sellingPrice);
          return;
        }
      }
    }

    // Split input IMEIs by commas or spaces
    const imeis = pSerialNumbers
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const currentProducts = [...products];
    const gpSupplier = suppliers.find(s => s.id === pSupplierId);
    const supplierName = gpSupplier ? gpSupplier.name : undefined;

    if (editingProduct) {
      // Edit mode
      const index = currentProducts.findIndex(p => p.id === editingProduct.id);
      if (index > -1) {
        currentProducts[index] = {
          ...editingProduct,
          name: pName,
          brand: pBrand,
          type: pType,
          barcode: pBarcode,
          quantity: pQuantity,
          minQuantity: pMinQuantity,
          purchasePrice: pPurchasePrice,
          sellingPrice: pSellingPrice,
          serialNumbers: imeis,
          notes: pNotes,
          imageUrl: pImageUrl || undefined,
          supplierId: pSupplierId || undefined,
          supplierName: supplierName || undefined,
        };
      }
    } else {
      // Add mode - check trial limits (supports both trial and pending status up to 14 products)
      const currentShop = DzStoreDB.getShops().find(s => s.id === shopId);
      const isTrial = currentShop && (currentShop.status === 'trial' || currentShop.status === 'pending');
      if (isTrial && products.length >= 14) {
        alert(lang === 'ar'
          ? '⚠️ نسخة تجريبية! لقد بلغت الحد الأقصى للمنتجات المسموح بها في النسخة التجريبية (14 منتجاً فقط).\nيرجى تفعيل حسابك من طرف صاحب البرنامج للحصول على وصول غير محدود!'
          : '⚠️ Trial Version Limit! You can only add up to 14 products in your inventory during this trial period.\nPlease contact the platform owner to activate your store subscription!'
        );
        return;
      }

      const newProd: Product = {
        id: `p-${Date.now()}`,
        shopId,
        name: pName,
        brand: pBrand,
        type: pType,
        barcode: pBarcode,
        quantity: pQuantity,
        minQuantity: pMinQuantity,
        purchasePrice: pPurchasePrice,
        sellingPrice: pSellingPrice,
        serialNumbers: imeis,
        dateAdded: new Date().toISOString().split('T')[0],
        notes: pNotes,
        imageUrl: pImageUrl || undefined,
        supplierId: pSupplierId || undefined,
        supplierName: supplierName || undefined,
      };
      currentProducts.push(newProd);
    }

    // Trigger Audit Log
    try {
      const activeStaffId = user?.id || 'owner';
      const activeStaffName = user?.name || 'Owner';
      if (editingProduct) {
        DzStoreDB.logAction(
          shopId,
          activeStaffId,
          activeStaffName,
          'edit_product',
          lang === 'ar'
            ? `تعديل تفاصيل المنتج بالمخزن: ${pName} (${pBrand}) - سعر البيع الجديد: ${pSellingPrice} د.ج`
            : `Modified inventory product properties: ${pName} (${pBrand}) - New price: ${pSellingPrice}`
        );
      } else {
        DzStoreDB.logAction(
          shopId,
          activeStaffId,
          activeStaffName,
          'add_product',
          lang === 'ar'
            ? `إضافة منتج جديد للمخزن: ${pName} (${pBrand}) بسعر بيع ${pSellingPrice} د.ج`
            : `Created new inventory product: ${pName} (${pBrand}) at price ${pSellingPrice}`
        );
      }
    } catch (e) {
      console.warn("Audit logging failed", e);
    }

    DzStoreDB.saveProducts(shopId, currentProducts);
    setProducts(currentProducts);
    resetProductForm();
    onRefreshStats();
    DzStoreAudio.playSuccessChime(enableSounds);
  };

  const deleteProduct = (pId: string) => {
    if (!confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا المنتج نهائياً من المخزون؟' : 'Are you sure you want to delete this product?')) return;
    const filtered = products.filter(p => p.id !== pId);

    // Trigger Audit Log
    try {
      const activeStaffId = user?.id || 'owner';
      const activeStaffName = user?.name || 'Owner';
      const targeted = products.find(p => p.id === pId);
      if (targeted) {
        DzStoreDB.logAction(
          shopId,
          activeStaffId,
          activeStaffName,
          'delete_product',
          lang === 'ar'
            ? `حذف المنتج نهائياً من المخزن والرفوف: ${targeted.name} (${targeted.brand})`
            : `Permanently deleted product from active stock rails: ${targeted.name} (${targeted.brand})`
        );
      }
    } catch (e) {
      console.warn("Audit logging failed", e);
    }

    DzStoreDB.saveProducts(shopId, filtered);
    setProducts(filtered);
    onRefreshStats();
    DzStoreAudio.playWarningChime(enableSounds);
  };

  const deleteSelectedProducts = () => {
    if (selectedProductIds.length === 0) return;
    const confirmMessage = lang === 'ar'
      ? `هل أنت متأكد من عملية الحذف المتعدد لـ ${selectedProductIds.length} منتج نهائياً من المخزون؟`
      : `Are you sure you want to delete ${selectedProductIds.length} selected products?`;
    if (!confirm(confirmMessage)) return;

    const filtered = products.filter(p => !selectedProductIds.includes(p.id));
    DzStoreDB.saveProducts(shopId, filtered);
    setProducts(filtered);
    setSelectedProductIds([]);
    onRefreshStats();
    DzStoreAudio.playWarningChime(enableSounds);
  };

  const openEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setPName(prod.name);
    setPBrand(prod.brand);
    setPType(prod.type);
    setPBarcode(prod.barcode);
    setPQuantity(prod.quantity);
    setPMinQuantity(prod.minQuantity);
    setPPurchasePrice(prod.purchasePrice);
    setPSellingPrice(prod.sellingPrice);
    setPSerialNumbers(prod.serialNumbers.join(', '));
    setPNotes(prod.notes || '');
    setPImageUrl(prod.imageUrl || '');
    setPSupplierId(prod.supplierId || '');
    setShowProductModal(true);
  };

  const resetProductForm = () => {
    setEditingProduct(null);
    setPName('');
    setPBrand('');
    setPType('Phone');
    setPBarcode('');
    setPQuantity(1);
    setPMinQuantity(2);
    setPPurchasePrice(0);
    setPSellingPrice(0);
    setPSerialNumbers('');
    setPNotes('');
    setPImageUrl('');
    setPSupplierId('');
    setShowProductModal(false);
  };

  // Spare Parts CRUD
  const handleSavePart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!spName || !spModel || spPurchasePrice <= 0) return;

    const matchedSupplier = suppliers.find(s => s.id === spSupplierId);
    const supplierName = matchedSupplier ? matchedSupplier.name : t.cancelled;

    const currentParts = [...parts];

    if (editingPart) {
      // Edit
      const index = currentParts.findIndex(p => p.id === editingPart.id);
      if (index > -1) {
        currentParts[index] = {
          ...editingPart,
          name: spName,
          model: spModel,
          purchasePrice: spPurchasePrice,
          sellingPrice: spSellingPrice,
          supplierId: spSupplierId,
          supplierName,
          quantity: spQuantity,
          minQuantity: spMinQuantity,
          notes: spNotes,
        };
      }
    } else {
      // Add
      const newPart: SparePart = {
        id: `sp-${Date.now()}`,
        shopId,
        name: spName,
        model: spModel,
        purchasePrice: spPurchasePrice,
        sellingPrice: spSellingPrice,
        supplierId: spSupplierId,
        supplierName,
        quantity: spQuantity,
        minQuantity: spMinQuantity,
        dateAdded: new Date().toISOString().split('T')[0],
        notes: spNotes,
      };
      currentParts.push(newPart);
    }

    DzStoreDB.saveSpareParts(shopId, currentParts);
    setParts(currentParts);
    resetPartForm();
    onRefreshStats();
    DzStoreAudio.playSuccessChime(enableSounds);
  };

  const deletePart = (spId: string) => {
    if (!confirm(lang === 'ar' ? 'هل أنت متأكد من حذف قطعة الغيار هذه نهائياً؟' : 'Are you sure you want to delete this spare part?')) return;
    const filtered = parts.filter(p => p.id !== spId);
    DzStoreDB.saveSpareParts(shopId, filtered);
    setParts(filtered);
    onRefreshStats();
    DzStoreAudio.playWarningChime(enableSounds);
  };

  const openEditPart = (sp: SparePart) => {
    setEditingPart(sp);
    setSpName(sp.name);
    setSpModel(sp.model);
    setSpPurchasePrice(sp.purchasePrice);
    setSpSellingPrice(sp.sellingPrice);
    setSpSupplierId(sp.supplierId);
    setSpQuantity(sp.quantity);
    setSpMinQuantity(sp.minQuantity);
    setSpNotes(sp.notes || '');
    setShowPartModal(true);
  };

  const resetPartForm = () => {
    setEditingPart(null);
    setSpName('');
    setSpModel('');
    setSpPurchasePrice(0);
    setSpSellingPrice(0);
    setSpSupplierId(suppliers[0]?.id || '');
    setSpQuantity(1);
    setSpMinQuantity(1);
    setSpNotes('');
    setShowPartModal(false);
  };

  // Searching filter matching
  const filteredProducts = products.filter(
    p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery)
  );

  const filteredParts = parts.filter(
    p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Aggregate low stock items for visual warning badge banner
  const lowStockProducts = products.filter(p => p.quantity <= p.minQuantity);
  const lowStockParts = parts.filter(p => p.quantity <= p.minQuantity);
  const hasLowStockAlert = lowStockProducts.length > 0 || lowStockParts.length > 0;

  return (
    <div className="space-y-6">
      {/* Title & upper Actions toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between pb-4 border-b border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-sky-500/10 p-2.5 rounded-2xl">
            <Package className="w-6 h-6 text-sky-600" id="inv_package_tag_icon" />
          </div>
          <div className="text-start">
            <h2 className="text-xl font-bold text-gray-900">{t.inventory}</h2>
            <p className="text-xs text-gray-400">
              {lang === 'ar' ? 'تتبع الهواتف، الإكسسوارات، وقطع الغيار وصنع الكود بار' : 'Manage phones, accessories, spare parts and barcodes'}
            </p>
          </div>
        </div>

        {/* Action Panel items */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Backup & Import widgets */}
          <button
            onClick={handleExportBackup}
            className="text-xs bg-white border border-gray-200 text-gray-700 font-bold px-3 py-2 rounded-xl hover:bg-gray-50 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {t.exportBackup}
          </button>
          <label className="text-xs bg-white border border-gray-200 text-gray-700 font-bold px-3 py-2 rounded-xl hover:bg-gray-50 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            {t.importBackup}
            <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          </label>

          {/* Excel Import & Export widgets */}
          {activeSegment === 'products' && (
            <>
              <button
                onClick={handleExportCSV}
                className="text-xs bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-850 font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title={lang === 'ar' ? 'تصدير المخزون لجدول إكسل Excel' : 'Export products stock to Excel sheet'}
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lang === 'ar' ? 'تصدير Excel' : 'Excel Export'}</span>
              </button>
              <label 
                className="text-xs bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-850 font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title={lang === 'ar' ? 'استيراد سجل المنتجات من جدول إكسل Excel' : 'Import products from Excel sheet'}
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lang === 'ar' ? 'استيراد Excel' : 'Excel Import'}</span>
                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImportCSV} className="hidden" />
              </label>
            </>
          )}

          {/* Sizing addition button */}
          {activeSegment === 'products' ? (
            <button
              onClick={() => {
                resetProductForm();
                setShowProductModal(true);
              }}
              className="text-xs bg-sky-700 hover:bg-sky-800 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {t.add_product}
            </button>
          ) : (
            <button
              onClick={() => {
                resetPartForm();
                setShowPartModal(true);
              }}
              className="text-xs bg-sky-700 hover:bg-sky-800 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {t.add_part}
            </button>
          )}
        </div>
      </div>

      {/* Warning low inventory banner if any items are critical */}
      {hasLowStockAlert && (
        <div className="bg-rose-50 border border-rose-200/40 rounded-2xl p-3 flex items-start gap-3 text-start">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-xs text-rose-900">{t.low_stock_alert} ({lowStockProducts.length + lowStockParts.length})</h4>
            <p className="text-[10px] text-rose-700 mt-0.5">
              {lang === 'ar' ? 'يرجى مراجعة وتوفير السلع المنتهية لتفادي توقف مبيعات الكاشير.' : 'Restock these items to maintain sales stream.'}
            </p>
          </div>
        </div>
      )}

      {/* Segment Switch Tabs & Live Barcode search input */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 border border-slate-100 p-3 rounded-2xl gap-3">
        {/* Toggle Segments */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => {
              setActiveSegment('products');
              setSearchQuery('');
            }}
            className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-black rounded-lg transition-transform cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSegment === 'products' ? 'bg-white shadow-xs text-slate-800' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            {t.phone_or_accessory}
          </button>
          <button
            onClick={() => {
              setActiveSegment('parts');
              setSearchQuery('');
            }}
            className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-black rounded-lg transition-transform cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSegment === 'parts' ? 'bg-white shadow-xs text-slate-800' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            {t.spare_parts_section}
          </button>
        </div>

        {/* Searching viewport */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" id="search_inv_layout" />
          <input
            type="text"
            placeholder={t.search}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50 focus:bg-white"
          />
        </div>
      </div>

      {/* Renders Tab Panels lists */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 rounded-3xl shadow-xs overflow-hidden">
        {/* Bulk Actions Banner */}
        {activeSegment === 'products' && selectedProductIds.length > 0 && (
          <div className="bg-rose-50/90 dark:bg-rose-950/40 border-b border-rose-100 dark:border-rose-900/55 py-3 px-4 flex items-center justify-between gap-4 transition-all">
            <div className="flex items-center gap-2">
              <div className="bg-rose-100 dark:bg-rose-900 p-1 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-rose-650 dark:text-rose-400" />
              </div>
              <span className="text-xs font-bold text-rose-900 dark:text-rose-200">
                {lang === 'ar'
                  ? `✓ تم تحديد ${selectedProductIds.length} من المنتجات.`
                  : `✓ ${selectedProductIds.length} products selected.`}
              </span>
            </div>
            <button
              onClick={deleteSelectedProducts}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'حذف المحدد' : 'Delete Selected'}</span>
            </button>
          </div>
        )}

        {activeSegment === 'products' ? (
          /* SECTION A: PRODUCTS FOR CLINIC PHONE SHOP */
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-600">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-center w-12">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer w-4 h-4"
                      checked={filteredProducts.length > 0 && filteredProducts.every(p => selectedProductIds.includes(p.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const allFilteredIds = filteredProducts.map(p => p.id);
                          setSelectedProductIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
                        } else {
                          const allFilteredIds = new Set(filteredProducts.map(p => p.id));
                          setSelectedProductIds(prev => prev.filter(id => !allFilteredIds.has(id)));
                        }
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 text-start">{t.product_name}</th>
                  <th className="px-4 py-3 text-start">{t.brand}</th>
                  <th className="px-4 py-3 text-start">{t.barcode}</th>
                  <th className="px-4 py-3 text-center">{t.quantity}</th>
                  <th className="px-4 py-3 text-end">{t.purchase_price}</th>
                  <th className="px-4 py-3 text-end">{t.selling_price}</th>
                  <th className="px-4 py-3 text-center">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400 text-xs">
                      {t.no_results}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(prod => {
                    const criticalLevel = prod.quantity <= prod.minQuantity;

                    return (
                      <tr key={prod.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-slate-350 text-sky-600 focus:ring-sky-500 cursor-pointer w-4 h-4"
                            checked={selectedProductIds.includes(prod.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProductIds(prev => [...prev, prod.id]);
                              } else {
                                setSelectedProductIds(prev => prev.filter(id => id !== prod.id));
                              }
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 text-start font-semibold text-slate-950">
                          <div>{prod.name}</div>
                          {prod.supplierName && (
                            <div className="inline-block mt-0.5 text-[9px] text-sky-700 bg-sky-50 font-bold px-1.5 py-0.5 rounded border border-sky-100/40">
                              🏢 {prod.supplierName}
                            </div>
                          )}
                          {prod.serialNumbers.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {prod.serialNumbers.map((sn, idn) => (
                                <span
                                  key={idn}
                                  className="text-[9px] bg-slate-100 text-slate-700 px-1 py-0.2 rounded-md font-mono"
                                >
                                  {sn}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-start">
                          <span className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md">
                            {prod.brand}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-start font-mono text-[11px] text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-sky-50 text-sky-800 p-1 rounded-md" title={t.printBarcodeTag}>
                              <Barcode className="w-3.5 h-3.5" />
                            </span>
                            <span>{prod.barcode}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              prod.quantity === 0
                                ? 'bg-rose-50 text-rose-600'
                                : criticalLevel
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-50 text-emerald-600'
                            }`}
                          >
                            {prod.quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end font-mono font-bold text-slate-700">
                          {prod.purchasePrice.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                        </td>
                        <td className="px-4 py-3 text-end font-mono font-black text-slate-900">
                          {prod.sellingPrice.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center items-center gap-1.5">
                            {/* Sticker label printing launcher */}
                            <button
                              onClick={() =>
                                setLabelStickerData({
                                  name: prod.name,
                                  brand: prod.brand,
                                  price: prod.sellingPrice,
                                  barcode: prod.barcode,
                                })
                              }
                              className="p-1.5 hover:bg-teal-50 text-teal-600 rounded-lg transition-colors cursor-pointer"
                              title={t.printBarcodeTag}
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditProduct(prod)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteProduct(prod.id)}
                              className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
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
        ) : (
          /* SECTION B: SPARE PARTS TABLE LIST */
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-600">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-start">{t.product_name}</th>
                  <th className="px-4 py-3 text-start">{t.part_model}</th>
                  <th className="px-4 py-3 text-start">{t.suppliers}</th>
                  <th className="px-4 py-3 text-center">{t.quantity}</th>
                  <th className="px-4 py-3 text-end">{t.purchase_price}</th>
                  <th className="px-4 py-3 text-end">{t.selling_price}</th>
                  <th className="px-4 py-3 text-center">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredParts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                      {t.no_results}
                    </td>
                  </tr>
                ) : (
                  filteredParts.map(sp => {
                    const criticalLevel = sp.quantity <= sp.minQuantity;

                    return (
                      <tr key={sp.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-start font-semibold text-slate-950">{sp.name}</td>
                        <td className="px-4 py-3 text-start">
                          <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-lg">
                            {sp.model}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-start text-xs text-slate-500 font-medium">
                          {sp.supplierName}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              sp.quantity === 0
                                ? 'bg-rose-50 text-rose-600'
                                : criticalLevel
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-50 text-emerald-600'
                            }`}
                          >
                            {sp.quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end font-mono font-bold text-slate-700">
                          {sp.purchasePrice.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                        </td>
                        <td className="px-4 py-3 text-end font-mono font-black text-slate-900">
                          {sp.sellingPrice.toLocaleString()} {currency === 'DZD' ? 'د.ج' : '€'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center items-center gap-1.5">
                            <button
                              onClick={() => openEditPart(sp)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deletePart(sp.id)}
                              className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
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
        )}
      </div>

      {/* Render Phone Barcode Camera Scanner Modal */}
      {showCameraScanner && (
        <BarcodeCameraScanner
          lang={lang === 'ar' ? 'ar' : 'en'}
          onScanSuccess={(code) => {
            setPBarcode(code);
            setShowCameraScanner(false);
          }}
          onClose={() => setShowCameraScanner(false)}
        />
      )}

      {/* DIALOG 1: ADD OR EDIT PRODUCT MODAL OVERLAY */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[calc(100vh-2rem)] shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
            <div className="bg-sky-700 text-white p-4 flex justify-between items-center">
              <h3 className="font-extrabold text-lg flex items-center gap-1.5">
                <Bookmark className="w-5 h-5 text-sky-200" />
                {editingProduct ? (lang === 'ar' ? 'تعديل بيانات المنتج' : 'Modify Product Item') : t.add_product}
              </h3>
              <button onClick={resetProductForm} className="text-white hover:bg-sky-800 p-1 rounded-full transition-colors">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.product_name} *</label>
                  <input
                    type="text"
                    required
                    value={pName}
                    onChange={e => setPName(e.target.value)}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.brand} *</label>
                  <input
                    type="text"
                    required
                    placeholder="Apple, Samsung, Xiaomi..."
                    value={pBrand}
                    onChange={e => setPBrand(e.target.value)}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.type}</label>
                  <select
                    value={pType}
                    onChange={e => setPType(e.target.value)}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                  >
                    <option value="Phone">{lang === 'ar' ? 'هاتف نقال' : 'Smart Phone'}</option>
                    <option value="Accessory">{lang === 'ar' ? 'إكسسوار ملحق' : 'Accessory'}</option>
                    <option value="Tablet">{lang === 'ar' ? 'لوحة إلكترونية' : 'Tablet'}</option>
                    <option value="Hardware">{lang === 'ar' ? 'حاسوب / شاشة مجزأة' : 'Computer/Hardware'}</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-700 mb-1">{t.barcode} *</label>
                    <input
                      type="text"
                      required
                      value={pBarcode}
                      onChange={e => setPBarcode(e.target.value)}
                      className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoGenerateBarcode}
                    className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Barcode className="w-4 h-4" />
                    {t.generateBarcode}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCameraScanner(true)}
                    className="text-xs bg-slate-800 hover:bg-slate-750 text-slate-100 font-bold px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700/60"
                  >
                    <Camera className="w-4 h-4 text-emerald-450" />
                    {lang === 'ar' ? 'مسح بالهاتف 📸' : 'Scan with Phone 📸'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.purchase_price} *</label>
                  <input
                    type="number"
                    required
                    value={pPurchasePrice || ''}
                    onChange={e => setPPurchasePrice(Number(e.target.value))}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.selling_price} *</label>
                  <input
                    type="number"
                    required
                    value={pSellingPrice || ''}
                    onChange={e => setPSellingPrice(Number(e.target.value))}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.quantity} *</label>
                  <input
                    type="number"
                    required
                    value={pQuantity || ''}
                    onChange={e => setPQuantity(Number(e.target.value))}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.low_stock_warning} *</label>
                  <input
                    type="number"
                    required
                    value={pMinQuantity || ''}
                    onChange={e => setPMinQuantity(Number(e.target.value))}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                  />
                </div>
              </div>

              {pType === 'Phone' && (
                <div className="border-t border-slate-100 pt-3">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    📱 {t.serial_numbers_list}
                  </label>
                  <textarea
                    placeholder={t.imei_comma}
                    value={pSerialNumbers}
                    onChange={e => setPSerialNumbers(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 h-16 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">🏢 {lang === 'ar' ? 'مورد المنتج (الشركة الموردة)' : 'Wholesale Supplier'}</label>
                <select
                  value={pSupplierId}
                  onChange={e => setPSupplierId(e.target.value)}
                  className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50 mb-2"
                >
                  <option value="">{lang === 'ar' ? 'شراء كاش / بدون تحديد مورد' : 'Direct Cash Buy / No Supplier Specified'}</option>
                  {suppliers.map(sup => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} ({sup.type === 'phones_accessories' ? (lang === 'ar' ? 'هواتف وإكسسوارات' : 'Phones/Acc') : (lang === 'ar' ? 'قطع غيار' : 'Spare Parts')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">📜 {lang === 'ar' ? 'ملاحظات وتفاصيل' : 'Descriptions'}</label>
                <textarea
                  value={pNotes}
                  onChange={e => setPNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 h-12 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="border-t border-slate-100 pt-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">📸 {lang === 'ar' ? 'صورة المنتج' : 'Product Photo'}</label>
                <div className="flex gap-3 items-center mt-1">
                  {pImageUrl ? (
                    <img
                      src={pImageUrl}
                      alt="Preview"
                      className="w-12 h-12 rounded-xl object-cover border"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-slate-150 rounded-xl flex items-center justify-center text-[10px] text-slate-450 border border-dashed font-bold">
                      {lang === 'ar' ? 'لا توجد' : 'No Img'}
                    </div>
                  )}
                  <div className="flex flex-col gap-2 flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setPImageUrl(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full text-xs"
                    />

                    {/* Direct phone camera capture input */}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      id="inventory-camera-photo-capture"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setPImageUrl(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => document.getElementById('inventory-camera-photo-capture')?.click()}
                      className="text-[10px] w-fit bg-slate-100 hover:bg-slate-205 text-slate-800 font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-600" />
                      {lang === 'ar' ? 'التقاط صورة بكاميرا الهاتف 📷' : 'Snap Photo from Phone 📷'}
                    </button>
                  </div>
                  {pImageUrl && (
                    <button
                      type="button"
                      onClick={() => setPImageUrl('')}
                      className="text-xs text-rose-600 hover:underline font-bold"
                    >
                      {lang === 'ar' ? 'حذف' : 'Remove'}
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-100 flex gap-2 -mx-5 -mb-5">
                <button
                  type="button"
                  onClick={resetProductForm}
                  className="flex-1 text-sm bg-white border text-gray-700 py-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 text-sm bg-sky-700 hover:bg-sky-800 text-white font-bold py-2 rounded-xl transition-colors cursor-pointer"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG 2: ADD OR EDIT SPARE PART OVERLAY MODAL */}
      {showPartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[calc(100vh-2rem)] shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
            <div className="bg-sky-700 text-white p-4 flex justify-between items-center">
              <h3 className="font-extrabold text-lg flex items-center gap-1.5">
                <Wrench className="w-5 h-5 text-sky-200" id="tool_wrench_icon" />
                {editingPart ? (lang === 'ar' ? 'تعديل قطعة غيار' : 'Edit Spare Part') : t.add_part}
              </h3>
              <button onClick={resetPartForm} className="text-white hover:bg-sky-800 p-1 rounded-full transition-colors">
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePart} className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'ar' ? 'اسم قطعة الغيار (مثال: شاشة ايفون 13 الأصلية)' : 'Spare Part Label'} *</label>
                  <input
                    type="text"
                    required
                    value={spName}
                    onChange={e => setSpName(e.target.value)}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.part_model} *</label>
                  <input
                    type="text"
                    required
                    placeholder="iPhone 13, iPad 8, Lenovo..."
                    value={spModel}
                    onChange={e => setSpModel(e.target.value)}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.supplier_select}</label>
                  <select
                    value={spSupplierId}
                    onChange={e => setSpSupplierId(e.target.value)}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                  >
                    <option value="">{lang === 'ar' ? 'شراء مجهول / كاش' : 'Direct Cash Buy'}</option>
                    {suppliers.filter(s => s.type === 'spare_parts').map(sup => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.purchase_price} *</label>
                  <input
                    type="number"
                    required
                    value={spPurchasePrice || ''}
                    onChange={e => setSpPurchasePrice(Number(e.target.value))}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.selling_price} *</label>
                  <input
                    type="number"
                    required
                    value={spSellingPrice || ''}
                    onChange={e => setSpSellingPrice(Number(e.target.value))}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.quantity} *</label>
                  <input
                    type="number"
                    required
                    value={spQuantity || ''}
                    onChange={e => setSpQuantity(Number(e.target.value))}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.low_stock_warning} *</label>
                  <input
                    type="number"
                    required
                    value={spMinQuantity || ''}
                    onChange={e => setSpMinQuantity(Number(e.target.value))}
                    className="w-full text-sm px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">📜 {lang === 'ar' ? 'ملاحظات قطعة الغيار' : 'Details'}</label>
                <textarea
                  value={spNotes}
                  onChange={e => setSpNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-xl bg-slate-50 h-16 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-100 flex gap-2 -mx-5 -mb-5">
                <button
                  type="button"
                  onClick={resetPartForm}
                  className="flex-1 text-sm bg-white border text-gray-700 py-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 text-sm bg-sky-700 hover:bg-sky-800 text-white font-bold py-2 rounded-xl transition-colors cursor-pointer"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RETAIL STICKER PRINT MODAL OVERLAY */}
      {labelStickerData && (
        <BarcodeSticker
          initialName={labelStickerData.name}
          initialBrand={labelStickerData.brand}
          initialPrice={labelStickerData.price}
          initialBarcode={labelStickerData.barcode}
          currency={currency}
          lang={lang}
          onClose={() => setLabelStickerData(null)}
          shopId={shopId}
        />
      )}
    </div>
  );
};
