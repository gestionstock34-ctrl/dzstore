/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BarcodeGenerator } from './BarcodeGenerator';
import { Currency, Language } from '../types';
import { TRANSLATIONS } from '../lib/data';
import { DzStoreDB } from '../lib/db';
import { Printer, X, CheckSquare, Square, Plus, Minus, Settings2 } from 'lucide-react';

interface BarcodeStickerProps {
  initialName?: string;
  initialPrice?: number;
  initialBarcode?: string;
  initialBrand?: string;
  currency: Currency;
  lang: Language;
  onClose: () => void;
  shopId?: string;
}

export const BarcodeSticker: React.FC<BarcodeStickerProps> = ({
  initialName = 'iPhone 15 Pro Max',
  initialPrice = 195000,
  initialBarcode = '195949033324',
  initialBrand = 'Apple',
  currency,
  lang,
  onClose,
  shopId,
}) => {
  const t = TRANSLATIONS[lang];

  // Load dynamically shop name
  const [shopName, setShopName] = useState(() => {
    try {
      const shops = DzStoreDB.getShops();
      const s = shops.find(item => item.id === shopId);
      return s ? s.name : 'DZ TELECOM';
    } catch {
      return 'DZ TELECOM';
    }
  });

  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState(initialPrice);
  const [barcode, setBarcode] = useState(initialBarcode);
  const [brand, setBrand] = useState(initialBrand);
  const [quantity, setQuantity] = useState(1);

  // Field toggles
  const [showShopName, setShowShopName] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);

  // Sticker size settings
  // '50x30' (Standard Single thermal roll), '40x30' (Compact Single thermal roll), '40x20' (Extra compact label), 'grid_a4' (Multi-column list sheet)
  const [paperFormat, setPaperFormat] = useState<'50x30' | '40x30' | '40x20' | 'grid_a4'>('50x30');

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Generate stickers html blocks
    const stickerBlocks = Array.from({ length: quantity })
      .map((_, i) => {
        return `
          <div class="sticker-card">
            ${showShopName ? `<div class="sticker-shop-name">${shopName.toUpperCase()}</div>` : ''}
            ${showBrand && brand ? `<div class="sticker-brand">${brand.toUpperCase()}</div>` : ''}
            ${showName ? `<div class="sticker-title">${name}</div>` : ''}
            
            ${showBarcode && barcode ? `
              <div class="sticker-barcode-box">
                <div class="sticker-bars">
                  ${barcode.split('').map((char) => {
                    const width = (parseInt(char, 10) % 3) + 1;
                    return `<div class="sticker-bar-line" style="width: ${width}px; background: #000; height: 32px; margin-right: 1.5px;"></div>`;
                  }).join('')}
                </div>
                <div class="sticker-barcode-text">${barcode}</div>
              </div>
            ` : ''}

            ${showPrice ? `
              <div class="sticker-price">
                ${price.toLocaleString()} ${currency === 'DZD' ? (lang === 'ar' ? 'د.ج' : 'DZD') : '€'}
              </div>
            ` : ''}
          </div>
        `;
      })
      .join('');

    // Determine sizes and styling
    const sizeCss = paperFormat === 'grid_a4' 
      ? `
        @media print {
          body { margin: 10mm; background-color: #fff; }
          @page { size: A4; margin: 10mm; }
        }
        body {
          font-family: Arial, sans-serif;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          background-color: #fff;
          padding: 10px;
        }
        .sticker-card {
          border: 1px dotted #ccc;
          padding: 8px;
          page-break-inside: avoid;
        }
      `
      : `
        @media print {
          @page { 
            size: ${paperFormat === '50x30' ? '50mm 30mm' : paperFormat === '40x20' ? '40mm 20mm' : '40mm 30mm'}; 
            margin: 0; 
          }
          body { margin: 0; padding: 0; background-color: #fff; }
        }
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #fff;
          display: flex;
          flex-direction: column;
        }
        .sticker-card {
          width: ${paperFormat === '50x30' ? '50mm' : '40mm'};
          height: ${paperFormat === '40x20' ? '20mm' : '30mm'};
          box-sizing: border-box;
          padding: ${paperFormat === '40x20' ? '0.6mm 1.5mm' : '1.2mm 2mm'};
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          text-align: center;
          page-break-after: always;
          page-break-inside: avoid;
          overflow: hidden;
        }
      `;

    printWindow.document.write(`
      <html>
        <head>
          <title>DzStore Xprinter Label Sheet</title>
          <style>
            ${sizeCss}
            .sticker-card {
              font-family: 'SF Pro Display', -apple-system, sans-serif;
              background: #fff;
              color: #000;
              border: 1px solid #111; /* subtle line for guide cut-off if not thermal */
            }
            @media print {
              .sticker-card {
                border: none !important;
              }
            }
            .sticker-shop-name {
              font-size: 7px;
              font-weight: 900;
              letter-spacing: 1px;
              border-bottom: 0.5px solid #111;
              width: 100%;
              padding-bottom: 1px;
              margin-bottom: 1px;
              white-space: nowrap;
              overflow: hidden;
            }
            .sticker-brand {
              font-size: ${paperFormat === '40x20' ? '6.5px' : '7px'};
              color: #333;
              font-weight: bold;
              margin-top: 1px;
              text-transform: uppercase;
            }
            .sticker-title {
              font-size: ${paperFormat === '40x20' ? '7.5px' : paperFormat === '40x30' ? '8px' : '9px'};
              font-weight: 800;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 100%;
              margin: ${paperFormat === '40x20' ? '0.5px 0px' : '1px 0px'};
            }
            .sticker-barcode-box {
              display: flex;
              flex-direction: column;
              align-items: center;
              margin: ${paperFormat === '40x20' ? '0px' : '1px 0'};
              width: 100%;
            }
            .sticker-bars {
              display: flex;
              justify-content: center;
              align-items: flex-end;
              height: ${paperFormat === '40x20' ? '16px' : paperFormat === '40x30' ? '24px' : '28px'};
            }
            .sticker-bar-line {
              background: #000;
              height: ${paperFormat === '40x20' ? '16px' : paperFormat === '40x30' ? '24px' : '32px'} !important;
            }
            .sticker-barcode-text {
              font-size: ${paperFormat === '40x20' ? '6px' : '7px'};
              letter-spacing: 1.2px;
              font-family: monospace;
              margin-top: 1px;
            }
            .sticker-price {
              font-size: ${paperFormat === '40x20' ? '9px' : paperFormat === '40x30' ? '10px' : '11px'};
              font-weight: 900;
              border-top: 0.5px solid #000;
              width: 100%;
              padding-top: 1px;
              margin-top: 1px;
              color: #000;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${stickerBlocks}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row max-h-[90vh]">
        
        {/* LEFT COLUMN: PREVIEW PANEL */}
        <div className="p-6 bg-slate-50 dark:bg-slate-950/55 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-850 w-full md:w-[280px] select-none">
          <span className="text-[10px] text-sky-800 dark:text-sky-400 font-black mb-4 uppercase tracking-widest bg-sky-50 dark:bg-sky-950/40 px-3 py-1 rounded-full border border-sky-100/40">
            {lang === 'ar' ? '🔍 معايـنة ملصـق Xprinter المباشر' : '🔍 Live Thermic Preview'}
          </span>
          
          {/* Dynamic Sticker Card layout display */}
          <div className="relative shadow-xl hover:scale-102 transition-transform duration-300">
            {/* Visual guidelines indicating size borders of single rolling tag */}
            <div 
              style={{
                width: (paperFormat === '40x30' || paperFormat === '40x20') ? '160px' : '200px',
                height: paperFormat === '40x20' ? '100px' : '140px'
              }}
              className="bg-white text-black border-2 border-dashed border-sky-400 p-2 flex flex-col items-center justify-between text-center rounded-lg"
            >
              {/* Shop Title */}
              {showShopName && (
                <div className="text-[7.5px] font-black tracking-widest text-slate-800 border-b border-slate-200 w-full pb-0.5 uppercase truncate">
                  {shopName}
                </div>
              )}

              {/* Brand Name */}
              {showBrand && brand && (
                <div className="text-[7.5px] font-bold text-gray-500 uppercase tracking-widest">{brand}</div>
              )}

              {/* Product Model Name */}
              {showName && (
                <div className="text-[10px] font-black text-slate-900 w-full truncate px-1">
                  {name || 'Model Name'}
                </div>
              )}

              {/* Barcode graphic visualization */}
              {showBarcode && barcode && (
                <div className="flex flex-col items-center w-full my-0.5">
                  <BarcodeGenerator value={barcode} width={130} height={paperFormat === '40x20' ? 16 : 26} showText={false} />
                  <div className="text-[7.5px] font-mono tracking-widest text-slate-500 mt-1">{barcode}</div>
                </div>
              )}

              {/* Price text indicator */}
              {showPrice && (
                <div className="text-[11px] font-black border-t border-slate-900 w-full pt-1 text-slate-950">
                  {price.toLocaleString()} {currency === 'DZD' ? (lang === 'ar' ? 'د.ج' : 'DZD') : '€'}
                </div>
              )}
            </div>
          </div>
          
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-4 leading-normal font-sans">
            {lang === 'ar' 
              ? 'الحدود الزرقاء المتقطعة مخصصة للمعينة والمحاكاة فقط لن تظهر عند الطباعة الفعلية.' 
              : 'The blue dashed outline is only simulated for precision sizing and won’t print.'}
          </p>
        </div>

        {/* RIGHT COLUMN: CONTROLS & TOGGLES */}
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Main header block */}
          <div className="bg-sky-800 text-white p-5 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <div className="bg-white/15 p-1.5 rounded-lg">
                <Settings2 className="w-5 h-5" />
              </div>
              <div className="text-start">
                <h3 className="font-extrabold text-base">{lang === 'ar' ? 'إعدادات طباعة ملصق الهواتف (Xprinter)' : 'Xprinter Sticker Print Layout'}</h3>
                <p className="text-[10px] text-sky-100">{lang === 'ar' ? 'تحكم كامل في اختيار العناصر المطبوعة للمخزن' : 'Direct barcode config'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form scroll wrapper */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1 text-start dark:text-slate-300">
            
             {/* 1. Printer Select Styles */}
             <div>
               <span className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2.5">
                 {lang === 'ar' ? '📏 مقاس الورق / قالب Xprinter' : '📏 Printer Format & Roll Size'}
               </span>
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                 <button
                   type="button"
                   onClick={() => setPaperFormat('50x30')}
                   className={`p-2.5 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                     paperFormat === '50x30'
                       ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-500 text-sky-700 dark:text-sky-300 shadow-xs'
                       : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                   }`}
                 >
                   <span className="text-[11px] md:text-xs">50 × 30 mm</span>
                   <span className="text-[9px] text-slate-400 font-medium">{lang === 'ar' ? 'القياسي' : 'Default'}</span>
                 </button>
 
                 <button
                   type="button"
                   onClick={() => setPaperFormat('40x30')}
                   className={`p-2.5 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                     paperFormat === '40x30'
                       ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-500 text-sky-700 dark:text-sky-300 shadow-xs'
                       : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                   }`}
                 >
                   <span className="text-[11px] md:text-xs">40 × 30 mm</span>
                   <span className="text-[9px] text-slate-400 font-medium">{lang === 'ar' ? 'مضغوط' : 'Compact'}</span>
                 </button>

                 <button
                   type="button"
                   onClick={() => setPaperFormat('40x20')}
                   className={`p-2.5 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                     paperFormat === '40x20'
                       ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-500 text-sky-700 dark:text-sky-300 shadow-xs'
                       : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                   }`}
                 >
                   <span className="text-[11px] md:text-xs">40 × 20 mm</span>
                   <span className="text-[9px] text-slate-400 font-medium">{lang === 'ar' ? 'مصغر جداً' : 'Mini label'}</span>
                 </button>
 
                 <button
                   type="button"
                   onClick={() => setPaperFormat('grid_a4')}
                   className={`p-2.5 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                     paperFormat === 'grid_a4'
                       ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-500 text-sky-700 dark:text-sky-300 shadow-xs'
                       : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                   }`}
                 >
                   <span className="text-[11px] md:text-xs">A4 Sheet List</span>
                   <span className="text-[9px] text-slate-400 font-medium">{lang === 'ar' ? 'شبكة مكررة' : 'Sheet Grid'}</span>
                 </button>
               </div>
             </div>

            {/* 2. Textual overrides */}
            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{lang === 'ar' ? 'اسم المحل' : 'Shop Header'}</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-sky-500 bg-slate-50 dark:bg-slate-850 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{lang === 'ar' ? 'إسم المنتج' : 'Product Title'}</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-sky-500 bg-slate-50 dark:bg-slate-850 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{lang === 'ar' ? 'الماركة' : 'Brand name'}</label>
                <input
                  type="text"
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-sky-500 bg-slate-50 dark:bg-slate-850 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{lang === 'ar' ? 'سعر البيع المطبوع' : 'Sale Price to Print'}</label>
                <input
                  type="number"
                  value={price}
                  onChange={e => setPrice(Number(e.target.value))}
                  className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-sky-500 bg-slate-50 dark:bg-slate-850 font-bold font-mono"
                />
              </div>
            </div>

            {/* 3. Printing Item configuration checklist */}
            <div>
              <span className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">
                {lang === 'ar' ? '👁️ تحديد الحقول والمستندات المراد طباعتها' : '👁️ Choose sticker fields to show'}
              </span>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowShopName(!showShopName)}
                  className="flex items-center gap-2.5 p-2 px-3 rounded-xl border border-slate-100 hover:bg-slate-50 text-left cursor-pointer"
                >
                  {showShopName ? <CheckSquare className="w-4 h-4 text-sky-600 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                  <span>{lang === 'ar' ? 'طباعة ترويسة اسم المحل' : 'Print shop title'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBrand(!showBrand)}
                  className="flex items-center gap-2.5 p-2 px-3 rounded-xl border border-slate-100 hover:bg-slate-50 text-left cursor-pointer"
                >
                  {showBrand ? <CheckSquare className="w-4 h-4 text-sky-600 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                  <span>{lang === 'ar' ? 'طباعة علامة الماركة' : 'Print brand label'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowName(!showName)}
                  className="flex items-center gap-2.5 p-2 px-3 rounded-xl border border-slate-100 hover:bg-slate-50 text-left cursor-pointer"
                >
                  {showName ? <CheckSquare className="w-4 h-4 text-sky-600 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                  <span>{lang === 'ar' ? 'طباعة اسم المنتج' : 'Print product name'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrice(!showPrice)}
                  className="flex items-center gap-2.5 p-2 px-3 rounded-xl border border-slate-100 hover:bg-slate-50 text-left cursor-pointer"
                >
                  {showPrice ? <CheckSquare className="w-4 h-4 text-sky-600 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                  <span>{lang === 'ar' ? 'طباعة السعر المالي' : 'Print retail price'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBarcode(!showBarcode)}
                  className="flex items-center gap-2.5 p-2 px-3 rounded-xl border border-slate-100 hover:bg-slate-50 text-left cursor-pointer"
                >
                  {showBarcode ? <CheckSquare className="w-4 h-4 text-sky-600 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                  <span>{lang === 'ar' ? 'توليد وطباعة الكودبار' : 'Print barcode block'}</span>
                </button>
              </div>
            </div>

            {/* 4. Quantity counts */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="text-start">
                <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  {lang === 'ar' ? 'عدد الملصقات لتكرار طباعتها' : 'Quantity / Copies to print'}
                </span>
                <p className="text-[10px] text-slate-400">{lang === 'ar' ? 'حدد عدد النسخ المطلوبة من ملصق هذا المنتج' : 'Specify total copies'}</p>
              </div>
              <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-850 p-1 px-2.5 rounded-2xl border dark:border-slate-850">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-1 px-1.5 rounded-lg border bg-white text-gray-600 hover:bg-slate-100 cursor-pointer text-xs"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-10 bg-transparent text-center font-black text-sm text-slate-900 dark:text-white border-none focus:outline-none focus:ring-0 p-0"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-1 px-1.5 rounded-lg border bg-white text-gray-600 hover:bg-slate-100 cursor-pointer text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>

          {/* Action buttons footer */}
          <div className="bg-slate-50 dark:bg-slate-950/70 p-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 text-xs font-black bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 text-xs bg-sky-700 hover:bg-sky-800 focus:bg-sky-900 text-white font-extrabold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Printer className="w-4 h-4" />
              {lang === 'ar' ? `بدء الطباعة على Xprinter (${quantity} ملصق)` : `Print labels (${quantity} copies)`}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
