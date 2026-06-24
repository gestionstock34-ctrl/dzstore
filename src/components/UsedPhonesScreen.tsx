/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, 
  ShieldCheck, 
  FileText, 
  Printer, 
  Search, 
  PlusCircle, 
  Trash2, 
  Fingerprint, 
  Check, 
  RotateCcw, 
  AlertTriangle, 
  HeartHandshake, 
  X, 
  Calendar, 
  User, 
  CreditCard, 
  MapPin, 
  PackageCheck,
  ChevronDown,
  Info,
  Camera,
  Upload,
  Image as ImageIcon,
  PenTool
} from 'lucide-react';
import { UsedPhoneTransaction, Language, Currency } from '../types';
import { DzStoreDB } from '../lib/db';
import { DzStoreAudio } from './AudioAlerts';

interface UsedPhonesScreenProps {
  shopId: string;
  currency: Currency;
  lang: Language;
  enableSounds: boolean;
  onRefreshStats?: () => void;
  syncKey?: number;
}

export const UsedPhonesScreen: React.FC<UsedPhonesScreenProps> = ({
  shopId,
  currency,
  lang,
  enableSounds,
  onRefreshStats,
  syncKey
}) => {
  // Tabs: 'list' (History), 'new-buy' (Receipt from citizen), 'new-sell' (Sale to citizen)
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'new-buy' | 'new-sell'>('list');
  const [transactions, setTransactions] = useState<UsedPhoneTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'sell'>('all');
  const [selectedTx, setSelectedTx] = useState<UsedPhoneTransaction | null>(null);
  
  // Signature and Fingerprint references
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const fingerprintCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingSig, setIsDrawingSig] = useState(false);
  const [isDrawingFinger, setIsDrawingFinger] = useState(false);

  // Auto fingerprint stamp visual seed
  const [fingerprintStampData, setFingerprintStampData] = useState<string | null>(null);

  // Double-sided ID card images (Base64 data URLs)
  const [buyIdFront, setBuyIdFront] = useState<string>('');
  const [buyIdBack, setBuyIdBack] = useState<string>('');
  const [sellIdFront, setSellIdFront] = useState<string>('');
  const [sellIdBack, setSellIdBack] = useState<string>('');

  // Live Camera/Webcam capture state managers
  const [activeCameraTarget, setActiveCameraTarget] = useState<'buyFront' | 'buyBack' | 'sellFront' | 'sellBack' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setter(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async (target: 'buyFront' | 'buyBack' | 'sellFront' | 'sellBack') => {
    setActiveCameraTarget(target);
    setCameraError('');
    try {
      // Prompt user environment (rear camera if on mobile)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setCameraStream(stream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (e: any) {
      console.warn("Direct back camera request failed, attempting default capture:", e);
      try {
        const streamFallback = await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraStream(streamFallback);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = streamFallback;
          }
        }, 100);
      } catch (fallbackError: any) {
        setCameraError(
          lang === 'ar'
            ? 'لا توجد كاميرا مفعلة أو الصلاحية مرفوضة. يرجى تفعيل أذونات الكاميرا في المتصفح أو رفع ملف مباشرة.'
            : 'Camera access denied or device is busy. Please allow camera permissions in browser options or upload file instead.'
        );
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setActiveCameraTarget(null);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      
      if (activeCameraTarget === 'buyFront') setBuyIdFront(dataUrl);
      if (activeCameraTarget === 'buyBack') setBuyIdBack(dataUrl);
      if (activeCameraTarget === 'sellFront') setSellIdFront(dataUrl);
      if (activeCameraTarget === 'sellBack') setSellIdBack(dataUrl);
    }
    stopCamera();
    DzStoreAudio.playScanBeep(enableSounds);
  };

  // Form States
  // BUYING FORM
  const [buyForm, setBuyForm] = useState({
    brand: '',
    model: '',
    imei: '',
    imei2: '',
    serialNumber: '',
    color: '',
    storage: '',
    condition: 'excellent' as 'new' | 'excellent' | 'good' | 'fair' | 'broken',
    price: '',
    notes: '',
    citizenName: '',
    citizenPhone: '',
    citizenIdType: 'national_card' as 'national_card' | 'passport' | 'driver_license' | 'other',
    citizenIdNumber: '',
    citizenIdIssueDate: '',
    citizenAddress: '',
    legalDeclaration: false
  });

  // SELLING FORM
  const [sellForm, setSellForm] = useState({
    selectedBoughtPhoneId: '', // Select from previously bought phones that are 'available'
    customBrand: '',
    customModel: '',
    customImei: '',
    customImei2: '',
    customSerialNumber: '',
    customColor: '',
    customStorage: '',
    customCondition: 'excellent' as 'new' | 'excellent' | 'good' | 'fair' | 'broken',
    sellPrice: '',
    warrantyPeriod: '30_days',
    notes: '',
    citizenName: '',
    citizenPhone: '',
    citizenIdType: 'national_card' as 'national_card' | 'passport' | 'driver_license' | 'other',
    citizenIdNumber: '',
    citizenIdIssueDate: '',
    citizenAddress: '',
    legalDeclaration: false
  });

  // Load transactions on mount & watch shop/sync changes
  useEffect(() => {
    loadTransactions();
  }, [shopId, syncKey]);

  const loadTransactions = () => {
    const list = DzStoreDB.getUsedPhones(shopId);
    // Sort transactions by date descending (newest first)
    list.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
    setTransactions(list);
  };

  // Canvas drawing handlers (Signature)
  const startDrawingSignature = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#2563eb'; // blue ink
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawingSig(true);
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingSig) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    e.preventDefault();
  };

  const stopDrawingSignature = () => {
    setIsDrawingSig(false);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Canvas drawing handlers (Fingerprint ink-pad drawing)
  const startDrawingFingerprint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = fingerprintCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#047857'; // Green finger-stamp ink
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawingFinger(true);
    setFingerprintStampData(null); // Clear manual stamp if they draw instead
  };

  const drawFingerprint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingFinger) return;
    const canvas = fingerprintCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    e.preventDefault();
  };

  const stopDrawingFingerprint = () => {
    setIsDrawingFinger(false);
  };

  const clearFingerprint = () => {
    const canvas = fingerprintCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFingerprintStampData(null);
  };

  // Generate a premium vector fingerprint based on information
  const handleStampDigitalFingerprint = () => {
    const canvas = fingerprintCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and draw a gorgeous procedural whorl pattern that looks like a high-tech imprint of a finger
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0d9488'; // Clean signature green/teal ink
    ctx.lineCap = 'round';
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Draw fingerprint ridges (nested ovals with custom sin-wave distortions)
    for (let radius = 10; radius < 75; radius += 6) {
      ctx.lineWidth = radius < 25 ? 2.5 : 3.5;
      ctx.beginPath();
      
      const segments = 100;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        // Introduce tiny microscopic finger ridges noise
        const noise = Math.sin(theta * 12) * 1.8 + Math.cos(radius * 0.4) * 1.2;
        const currentRadiusX = radius * 0.75 + noise;
        const currentRadiusY = radius * 1.1 + noise;
        
        const x = centerX + Math.cos(theta) * currentRadiusX;
        const y = centerY + Math.sin(theta) * currentRadiusY;
        
        // Open loop shape typical to fingerprints (loop/whorl style)
        if (i === 0) {
          ctx.moveTo(x, y);
        } else if (theta < Math.PI * 1.9 || radius < 25) {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // Add smaller decorative biometric dots
    ctx.fillStyle = '#0d9488';
    ctx.beginPath();
    ctx.arc(centerX + 15, centerY - 25, 3, 0, Math.PI * 2);
    ctx.arc(centerX - 25, centerY + 15, 2.5, 0, Math.PI * 2);
    ctx.fill();

    DzStoreAudio.playScanBeep(enableSounds);
  };

  const handleBuySubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!buyForm.brand || !buyForm.model || !buyForm.imei || !buyForm.price || !buyForm.citizenName || !buyForm.citizenPhone || !buyForm.citizenIdNumber) {
      alert(lang === 'ar' ? 'الرجاء ملء جميع الحقول الإلزامية!' : 'Please fill in all mandatory fields!');
      DzStoreAudio.playWarningChime(enableSounds);
      return;
    }

    if (!buyForm.legalDeclaration) {
      alert(lang === 'ar' 
        ? 'يجب قراءة وتفعيل التعهد والمصادقة القانونية لحماية المحل!' 
        : 'You must read and accept the legal declaration to authorize this transaction!'
      );
      DzStoreAudio.playWarningChime(enableSounds);
      return;
    }

    // Capture Signature & Fingerprint
    let signatureData = '';
    const sigCanvas = signatureCanvasRef.current;
    if (sigCanvas) {
      // Check if signature contains marks
      signatureData = sigCanvas.toDataURL('image/png');
    }

    let fingerprintData = '';
    const fingerCanvas = fingerprintCanvasRef.current;
    if (fingerCanvas) {
      fingerprintData = fingerCanvas.toDataURL('image/png');
    }

    const newTx: UsedPhoneTransaction = {
      id: 'up-buy-' + Date.now(),
      shopId: shopId,
      type: 'buy',
      dateTime: new Date().toISOString(),
      brand: buyForm.brand,
      model: buyForm.model,
      imei: buyForm.imei,
      imei2: buyForm.imei2,
      serialNumber: buyForm.serialNumber,
      color: buyForm.color,
      storage: buyForm.storage,
      condition: buyForm.condition,
      price: Number(buyForm.price),
      notes: buyForm.notes,
      status: 'available', // Ready to be sold by the shop
      
      citizenName: buyForm.citizenName,
      citizenPhone: buyForm.citizenPhone,
      citizenIdType: buyForm.citizenIdType,
      citizenIdNumber: buyForm.citizenIdNumber,
      citizenIdIssueDate: buyForm.citizenIdIssueDate,
      citizenAddress: buyForm.citizenAddress,
      
      legalDeclaration: true,
      signatureData,
      fingerprintData,
      idCardFrontData: buyIdFront || undefined,
      idCardBackData: buyIdBack || undefined,
      
      cashierId: 'current-user',
      cashierName: lang === 'ar' ? 'أدمن المحل' : 'Shop Cashier',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const currentList = DzStoreDB.getUsedPhones(shopId);
    currentList.push(newTx);
    DzStoreDB.saveUsedPhones(shopId, currentList);

    DzStoreAudio.playSuccessChime(enableSounds);
    
    // Clear Form & reset state
    setBuyForm({
      brand: '',
      model: '',
      imei: '',
      imei2: '',
      serialNumber: '',
      color: '',
      storage: '',
      condition: 'excellent',
      price: '',
      notes: '',
      citizenName: '',
      citizenPhone: '',
      citizenIdType: 'national_card',
      citizenIdNumber: '',
      citizenIdIssueDate: '',
      citizenAddress: '',
      legalDeclaration: false
    });
    
    clearSignature();
    clearFingerprint();
    setBuyIdFront('');
    setBuyIdBack('');
    loadTransactions();
    setActiveSubTab('list');
    setSelectedTx(newTx); // Auto open receipt so they can print it immediately

    if (onRefreshStats) onRefreshStats();
  };

  const handleSellSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isUsingInventoryPhone = sellForm.selectedBoughtPhoneId !== 'custom';
    let brand = '';
    let model = '';
    let imei = '';
    let imei2 = '';
    let serialNumber = '';
    let color = '';
    let storage = '';
    let condition: 'new' | 'excellent' | 'good' | 'fair' | 'broken' = 'excellent';

    if (isUsingInventoryPhone) {
      const selectedPhone = transactions.find(t => t.id === sellForm.selectedBoughtPhoneId);
      if (!selectedPhone) {
        alert(lang === 'ar' ? 'الرجاء اختيار الهاتف المستعمل من المخزون أولاً!' : 'Please select a used phone from inventory!');
        DzStoreAudio.playWarningChime(enableSounds);
        return;
      }
      brand = selectedPhone.brand;
      model = selectedPhone.model;
      imei = selectedPhone.imei;
      imei2 = selectedPhone.imei2 || '';
      serialNumber = selectedPhone.serialNumber || '';
      color = selectedPhone.color || '';
      storage = selectedPhone.storage || '';
      condition = selectedPhone.condition;
    } else {
      brand = sellForm.customBrand;
      model = sellForm.customModel;
      imei = sellForm.customImei;
      imei2 = sellForm.customImei2;
      serialNumber = sellForm.customSerialNumber;
      color = sellForm.customColor;
      storage = sellForm.customStorage;
      condition = sellForm.customCondition;

      if (!brand || !model || !imei) {
        alert(lang === 'ar' ? 'الرجاء كتابة بيانات الهاتف المستعمل بدقة!' : 'Please write down custom phone specs correctly!');
        DzStoreAudio.playWarningChime(enableSounds);
        return;
      }
    }

    if (!sellForm.sellPrice || !sellForm.citizenName || !sellForm.citizenPhone || !sellForm.citizenIdNumber) {
      alert(lang === 'ar' ? 'الرجاء ملء جميع معلومات المشتري وسعر البيع!' : 'Please fill in all buyer information and sale price!');
      DzStoreAudio.playWarningChime(enableSounds);
      return;
    }

    if (!sellForm.legalDeclaration) {
      alert(lang === 'ar' ? 'يجب تعبئة وقبول تعهد ضمان المحل وصحة المعاملة!' : 'You must accept the warranty setup declaration!');
      DzStoreAudio.playWarningChime(enableSounds);
      return;
    }

    // Capture Signature & Fingerprint
    let signatureData = '';
    const sigCanvas = signatureCanvasRef.current;
    if (sigCanvas) {
      signatureData = sigCanvas.toDataURL('image/png');
    }

    let fingerprintData = '';
    const fingerCanvas = fingerprintCanvasRef.current;
    if (fingerCanvas) {
      fingerprintData = fingerCanvas.toDataURL('image/png');
    }

    const newTx: UsedPhoneTransaction = {
      id: 'up-sell-' + Date.now(),
      shopId: shopId,
      type: 'sell',
      dateTime: new Date().toISOString(),
      brand,
      model,
      imei,
      imei2,
      serialNumber,
      color,
      storage,
      condition,
      price: Number(sellForm.sellPrice),
      warrantyPeriod: sellForm.warrantyPeriod,
      notes: sellForm.notes,
      status: 'sold',
      
      citizenName: sellForm.citizenName,
      citizenPhone: sellForm.citizenPhone,
      citizenIdType: sellForm.citizenIdType,
      citizenIdNumber: sellForm.citizenIdNumber,
      citizenIdIssueDate: sellForm.citizenIdIssueDate,
      citizenAddress: sellForm.citizenAddress,
      
      legalDeclaration: true,
      signatureData,
      fingerprintData,
      idCardFrontData: sellIdFront || undefined,
      idCardBackData: sellIdBack || undefined,
      
      cashierId: 'current-user',
      cashierName: lang === 'ar' ? 'أدمن المحل' : 'Shop Cashier',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const currentList = DzStoreDB.getUsedPhones(shopId);

    // Update status of the bought phone to sold if selected from stock
    if (isUsingInventoryPhone) {
      const idx = currentList.findIndex(t => t.id === sellForm.selectedBoughtPhoneId);
      if (idx !== -1) {
        currentList[idx].status = 'sold';
        currentList[idx].updatedAt = new Date().toISOString();
      }
    }

    currentList.push(newTx);
    DzStoreDB.saveUsedPhones(shopId, currentList);

    DzStoreAudio.playSuccessChime(enableSounds);

    // Clear Form & reset state
    setSellForm({
      selectedBoughtPhoneId: '',
      customBrand: '',
      customModel: '',
      customImei: '',
      customImei2: '',
      customSerialNumber: '',
      customColor: '',
      customStorage: '',
      customCondition: 'excellent',
      sellPrice: '',
      warrantyPeriod: '30_days',
      notes: '',
      citizenName: '',
      citizenPhone: '',
      citizenIdType: 'national_card',
      citizenIdNumber: '',
      citizenIdIssueDate: '',
      citizenAddress: '',
      legalDeclaration: false
    });

    clearSignature();
    clearFingerprint();
    setSellIdFront('');
    setSellIdBack('');
    loadTransactions();
    setActiveSubTab('list');
    setSelectedTx(newTx); // Auto open invoice modal for instant high-quality printout

    if (onRefreshStats) onRefreshStats();
  };

  const handleDeleteTransaction = (id: string) => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذا الوصل؟' : 'Are you sure you want to delete this log?')) {
      return;
    }
    const filtered = transactions.filter(t => t.id !== id);
    DzStoreDB.saveUsedPhones(shopId, filtered);
    DzStoreAudio.playWarningChime(enableSounds);
    loadTransactions();

    if (onRefreshStats) onRefreshStats();
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter transaction records
  const filteredTx = transactions.filter(tx => {
    const term = searchQuery.toLowerCase();
    const typeMatches = filterType === 'all' || tx.type === filterType;
    const wordMatches = 
      tx.brand.toLowerCase().includes(term) ||
      tx.model.toLowerCase().includes(term) ||
      tx.imei.includes(term) ||
      tx.citizenName.toLowerCase().includes(term) ||
      tx.citizenIdNumber.includes(term) ||
      tx.citizenPhone.includes(term);

    return typeMatches && wordMatches;
  });

  // Get bought phones that are 'available' in stock to sell
  const availablePhones = transactions.filter(t => t.type === 'buy' && t.status === 'available');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* ⚠️ PRINT WRAPPER FOR CSS MEDIA PRINT PRINTING */}
      {selectedTx && (
        <div className="hidden print:block fixed inset-0 bg-white text-black p-8 text-sm leading-relaxed" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <div className="text-center pb-6 border-b-2 border-slate-900">
            <h1 className="text-xl font-bold tracking-tight">
              {lang === 'ar' ? 'وصل بيع وشراء الهواتف المستعملة والتعهد القانوني' : 'Used Phone Trading & Legal Pledge Receipt'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              DzStore Verification Network • #{selectedTx.id}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 my-6 border-b pb-6 text-xs">
            <div>
              <p className="font-bold mb-2 text-slate-700">{lang === 'ar' ? 'تفاصيل المعاملة والطاقم' : 'Transaction & Staff'}</p>
              <p><span className="opacity-75">{lang === 'ar' ? 'نوع العملية:' : 'Operation Type:'}</span> <strong className="text-sm">{selectedTx.type === 'buy' ? (lang === 'ar' ? 'شراء هاتف من مواطن' : 'Aquired From Citizen') : (lang === 'ar' ? 'بيع هاتف مستعمل وضمان' : 'Sold Used Phone with Warranty')}</strong></p>
              <p><span className="opacity-75">{lang === 'ar' ? 'التوقيت:' : 'Timestamp:'}</span> {new Date(selectedTx.dateTime).toLocaleString(lang === 'ar' ? 'ar-DZ' : 'en-US')}</p>
              <p><span className="opacity-75">{lang === 'ar' ? 'القائم بالعملية:' : 'Staff Operator:'}</span> {selectedTx.cashierName}</p>
              <p><span className="opacity-75">{lang === 'ar' ? 'القيمة المتفق عليها:' : 'Settled Price:'}</span> <strong className="text-sm">{selectedTx.price} {currency === 'DZD' ? (lang === 'ar' ? 'د.ج' : 'DZD') : 'EUR'}</strong></p>
              {selectedTx.type === 'sell' && (
                <p><span className="opacity-75">{lang === 'ar' ? 'مدة الضمان:' : 'Warranty Period:'}</span> {selectedTx.warrantyPeriod === '30_days' ? (lang === 'ar' ? '30 يوم ضمان المحل' : '30 Days Store Warranty') : selectedTx.warrantyPeriod === '90_days' ? (lang === 'ar' ? '90 يوم ضمان كامل' : '90 Days Full Warranty') : (lang === 'ar' ? 'بدون ضمان' : 'No Warranty')}</p>
              )}
            </div>
            
            <div>
              <p className="font-bold mb-2 text-slate-700">{lang === 'ar' ? 'هوية الطرف المتعاقد (المواطن)' : 'Identity of Contracting Citizen'}</p>
              <p><span className="opacity-75">{lang === 'ar' ? 'الاسم واللقب:' : 'Full Name:'}</span> <strong>{selectedTx.citizenName}</strong></p>
              <p><span className="opacity-75">{lang === 'ar' ? 'رقم الهاتف:' : 'Phone Number:'}</span> {selectedTx.citizenPhone}</p>
              <p><span className="opacity-75">{lang === 'ar' ? 'نوع بطاقة التعريف:' : 'ID documentType:'}</span> {selectedTx.citizenIdType === 'national_card' ? (lang === 'ar' ? 'بطاقة التعريف الوطنية البيومترية' : 'National biometric ID') : selectedTx.citizenIdType === 'passport' ? (lang === 'ar' ? 'جواز سفر بيومتري' : 'Passport') : (lang === 'ar' ? 'رخصة سياقة' : 'Driver License')}</p>
              <p><span className="opacity-75">{lang === 'ar' ? 'رقم البطاقة/الوثيقة:' : 'Document ID Number:'}</span> <strong>{selectedTx.citizenIdNumber}</strong></p>
              {selectedTx.citizenAddress && <p><span className="opacity-75">{lang === 'ar' ? 'عنوان السكن:' : 'Current Address:'}</span> {selectedTx.citizenAddress}</p>}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 my-6 text-xs">
            <h3 className="font-bold mb-2 text-slate-800">{lang === 'ar' ? 'خصائص الهاتف الفنية والرقم التسلسلي' : 'Phone Hardware Integrity specs'}</h3>
            <div className="grid grid-cols-3 gap-4">
              <p><span>{lang === 'ar' ? 'العلامة والطراز:' : 'Brand & Model:'}</span> <strong className="block text-sm">{selectedTx.brand} {selectedTx.model}</strong></p>
              <p><span>{lang === 'ar' ? 'المعرف الرقمي الأول (IMEI1):' : 'IMEI 1 identifier:'}</span> <strong className="block text-sm tracking-widest">{selectedTx.imei}</strong></p>
              {selectedTx.imei2 && <p><span>{lang === 'ar' ? 'المعرف الرقمي الثاني (IMEI2):' : 'IMEI 2 identifier:'}</span> <strong className="block tracking-widest">{selectedTx.imei2}</strong></p>}
              {selectedTx.serialNumber && <p><span>{lang === 'ar' ? 'الرقم التسلسلي (S/N):' : 'Serial Number (S/N):'}</span> <strong className="block font-mono">{selectedTx.serialNumber}</strong></p>}
              <p><span>{lang === 'ar' ? 'الحالة والذاكرة:' : 'Condition & Storage:'}</span> <strong className="block">{selectedTx.storage || 'N/A'} • {selectedTx.color || 'N/A'} • {selectedTx.condition.toUpperCase()}</strong></p>
            </div>
          </div>

          {/* 🛡️ Strict anti-theft legal disclaimers */}
          <div className="my-6 border border-slate-800 p-4 rounded-xl space-y-3">
            <h4 className="font-bold flex items-center gap-1.5 text-xs text-red-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              {lang === 'ar' ? 'تعهد قانوني وإعلان الشرف لحماية الحقوق (رسمي)' : 'Legally Binding Declaration of Honor & Non-Stolen Guarantee'}
            </h4>
            <p className="text-[11px] leading-relaxed text-slate-700">
              {lang === 'ar' 
                ? `تعهد شرفي رسمي: أنا الموقع أسفله بصفة الطرف المتعاقد أولاً (${selectedTx.citizenName})، وبصفتي الحائز والمالك الفعلي والشرعي والوحيد للجهاز الموصوف أعلاه والمعادلات الـ IMEI المرفقة، أقر بشرفي وذمتي القانونية أن هذا الهاتف ملك لي وليس مسروقاً، كما أنه ليس محلاً لأي متابعة وطنية أو أمنية، ولم يجري عليه أي تزوير للخصائص. وأتحمل مطلق المسؤولية المدنية والجزائية والجنائية أمام الجهات القضائية والمصالح الأمنية في حال ثبت خلاف ذلك، مبرئاً ذمة صاحب المحل و DzStore تماماً.` 
                : `Solemn Pledge of Ownership: I, the undersigned citizen (${selectedTx.citizenName}), as the true owner of the registered mobile hardware, declare under penalty of perjury that this mobile device is my exclusive legal property. I verify that this device has not been stolen, altered, reported lost, or affiliated with any legal dispute. I assume full civil and criminal liability before the court and judicial authorities in case this device is found to be stolen, fully exonerating the shop management.`
              }
            </p>
          </div>

          {/* Signatures & ID Verification visualization */}
          <div className="grid grid-cols-2 gap-8 mt-10 text-center text-xs">
            <div className="space-y-4">
              <p className="font-bold text-slate-755 border-b pb-2">
                {lang === 'ar' ? 'وثائق ومصادقة المواطن المتعاقد' : 'Citizen Consent & Identity Documents'}
              </p>
              
              <div className="space-y-3 pt-1">
                {/* Signature Display */}
                <div className="flex justify-center items-center gap-3">
                  {selectedTx.signatureData ? (
                    <div className="text-center">
                      <img src={selectedTx.signatureData} alt="Sig" className="max-h-14 max-w-[140px] inline-block border bg-slate-50 p-1 rounded" />
                      <span className="block text-[9px] text-slate-400 mt-0.5">{lang === 'ar' ? 'توقيع العميل' : 'Customer sig'}</span>
                    </div>
                  ) : (
                    <div className="h-12 w-28 border border-dashed flex items-center justify-center text-[9px] text-slate-300">
                      {lang === 'ar' ? 'لا يوجد توقيع' : 'No Signature'}
                    </div>
                  )}
                </div>

                {/* ID Cards Front & Back Displays side-by-side */}
                <div className="flex justify-center items-center gap-4">
                  {selectedTx.idCardFrontData ? (
                    <div className="text-center">
                      <img src={selectedTx.idCardFrontData} alt="ID Front" className="max-h-14 max-w-[120px] inline-block border bg-slate-50 p-1 rounded" />
                      <span className="block text-[8px] text-slate-400 mt-0.5">{lang === 'ar' ? 'بطاقة التعريف (وجه 1)' : 'ID Front'}</span>
                    </div>
                  ) : (
                    <div className="h-12 w-20 border border-dashed flex items-center justify-center text-[8px] text-slate-300">
                      {lang === 'ar' ? 'بلا وجه أمامي' : 'No ID Front'}
                    </div>
                  )}

                  {selectedTx.idCardBackData ? (
                    <div className="text-center">
                      <img src={selectedTx.idCardBackData} alt="ID Back" className="max-h-14 max-w-[120px] inline-block border bg-slate-50 p-1 rounded" />
                      <span className="block text-[8px] text-slate-400 mt-0.5">{lang === 'ar' ? 'بطاقة التعريف (وجه 2)' : 'ID Back'}</span>
                    </div>
                  ) : (
                    <div className="h-12 w-20 border border-dashed flex items-center justify-center text-[8px] text-slate-300">
                      {lang === 'ar' ? 'بلا وجه خلفي' : 'No ID Back'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="font-bold text-slate-755 border-b pb-2">{lang === 'ar' ? 'ختم و إمضاء مسير المحل' : 'Shop Stamp & Signature'}</p>
              <div className="pt-8 text-slate-350">
                <div className="inline-block px-12 py-6 border-2 border-dashed border-slate-300 rounded font-bold text-sm tracking-widest text-slate-300 transform rotate-12">
                  {lang === 'ar' ? 'محل معتمد وطاهي' : 'OFFICIAL STORE STAMP'}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-6 left-8 right-8 text-center text-[9px] border-t pt-4 text-slate-400">
            {lang === 'ar' 
              ? 'إن هذه الوثيقة تم تصميمها ونظمت في إطار الحماية القانونية للممتلكات من التجارة في الأجهزة المزورة والمسروقة.' 
              : 'This legal verification protocol is registered in compliance with anti-theft electronics commerce protection framework.'
            }
          </div>
        </div>
      )}

      {/* 📱 SCREEN CONTAINER (DISPLAYS IN BROWSER) */}
      <div className="print:hidden space-y-6">
        
        {/* Banner with visual theme */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 dark:from-emerald-700 dark:to-teal-900 rounded-3xl p-6 lg:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center">
            <Smartphone className="w-72 h-72 transform translate-x-20 rotate-12" />
          </div>
          <div className="relative z-10 max-w-3xl space-y-3">
            <span className="inline-flex items-center gap-1.5 py-1 px-3 bg-white/20 rounded-full text-xs font-black backdrop-blur-md">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              {lang === 'ar' ? 'شبكة الأمان والحماية القانونية' : 'Legal Safety Protocol'}
            </span>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight" id="used-phones-screen-title">
              {lang === 'ar' ? 'سجل بيع وشراء الهواتف المستعملة' : 'Used Phone Trading Desk'}
            </h1>
            <p className="text-white/80 text-xs leading-relaxed">
              {lang === 'ar' 
                ? 'لوحة أمان متكاملة لتجارة الهواتف المستعملة بضمان معتمد، وتوثيقات قانونية وبصمة الإصبع الرقمية للبائع لحماية المحل من المساءلات الأمنية في حال ثبوت سرقة الهاتف.' 
                : 'A comprehensive panel to log secure used phone sales and acquisitions, featuring honor pledges, customer identification, digital signatures and thumb markings to legally protect the shop.'
              }
            </p>
          </div>
        </div>

        {/* Tab Selection Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('list')}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'list'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-650 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              {lang === 'ar' ? 'سجل المعاملات السابقة' : 'Trading & Lock History'}
            </button>
            
            <button
              onClick={() => setActiveSubTab('new-buy')}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'new-buy'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-650 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              {lang === 'ar' ? 'شراء هاتف من مواطن (F3)' : 'Aquire Phone from Citizen'}
            </button>

            <button
              onClick={() => setActiveSubTab('new-sell')}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'new-sell'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-650 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              {lang === 'ar' ? 'بيع هاتف مستعمل وضمان' : 'Sell Phone & Warranty'}
            </button>
          </div>

          <div className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-emerald-500" />
            {lang === 'ar' ? 'الهواتف الجاهزة للبيع:' : 'In-Stock Used Phones:'}
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{availablePhones.length}</span>
          </div>
        </div>

        {/* 1. TRANSACTION LIST (HISTORY) SUBTAB */}
        {activeSubTab === 'list' && (
          <div className="space-y-4">
            
            {/* Filter/Search Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'ابحث بالطراز، الـ IMEI، اسم العميل...' : 'Search by model, IMEI, customer name...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-white dark:bg-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setFilterType('all')}
                  className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all ${
                    filterType === 'all' 
                      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' 
                      : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {lang === 'ar' ? 'الكل' : 'All'}
                </button>
                <button
                  onClick={() => setFilterType('buy')}
                  className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all ${
                    filterType === 'buy'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {lang === 'ar' ? 'الشراء من المواطنين' : 'Purchased/Stocked'}
                </button>
                <button
                  onClick={() => setFilterType('sell')}
                  className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all ${
                    filterType === 'sell'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {lang === 'ar' ? 'المبيعات' : 'Sales with Warranty'}
                </button>
              </div>
            </div>

            {/* List Output Table */}
            {filteredTx.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4">
                <Smartphone className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-bold">
                  {lang === 'ar' ? 'لا توجد عمليات مسجلة متطابقة مع البحث الخاص بك' : 'No recorded transactions match your search'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredTx.map(tx => (
                  <div 
                    key={tx.id}
                    className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-emerald-500/50 transition-all shadow-sm"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          tx.type === 'buy' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' 
                            : 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
                        }`}>
                          {tx.type === 'buy' ? (lang === 'ar' ? 'شراء' : 'BUY/AQUIRED') : (lang === 'ar' ? 'بيع وضمان' : 'SALE/WARRANTY')}
                        </span>
                        
                        {tx.type === 'buy' && (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            tx.status === 'available' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {tx.status === 'available' ? (lang === 'ar' ? 'في المخزن' : 'In Stock') : (lang === 'ar' ? 'بيعت' : 'Sold Out')}
                          </span>
                        )}

                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(tx.dateTime).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                        {tx.brand} {tx.model} <span className="text-xs text-slate-400 font-mono font-normal">({tx.storage})</span>
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 text-slate-500 dark:text-slate-450 text-[11px]">
                        <p className="font-mono">IMEI: <strong className="text-slate-700 dark:text-slate-350">{tx.imei}</strong></p>
                        <p>{tx.type === 'buy' ? (lang === 'ar' ? 'البائع:' : 'Seller:') : (lang === 'ar' ? 'المشتري:' : 'Buyer:')} <strong className="text-slate-700 dark:text-slate-350">{tx.citizenName}</strong></p>
                        <p>ID: <strong className="text-slate-700 dark:text-slate-350 font-mono">{tx.citizenIdNumber}</strong></p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center">
                      <div className="text-right">
                        <span className="block text-slate-400 text-[10px]">{lang === 'ar' ? 'المبلغ الكلي' : 'Total Value'}</span>
                        <span className="text-sm font-black text-slate-850 dark:text-emerald-400">
                          {tx.price.toLocaleString()} {currency === 'DZD' ? (lang === 'ar' ? 'د.ج' : 'DZD') : 'EUR'}
                        </span>
                      </div>

                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-755 text-slate-700 dark:text-slate-200 rounded-xl transition-all cursor-pointer"
                        title={lang === 'ar' ? 'عرض الوصل والتعهد' : 'View receipt & Pledge'}
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteTransaction(tx.id)}
                        className="p-2.5 bg-red-50 hover:bg-red-100 text-red-650 dark:bg-red-950/20 dark:hover:bg-red-900/30 rounded-xl transition-all cursor-pointer"
                        title={lang === 'ar' ? 'حذف من السجل' : 'Delete log'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. ACQUIRE / BUY PHONE FROM CITIZEN FORM */}
        {activeSubTab === 'new-buy' && (
          <form onSubmit={handleBuySubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Phone specs column */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2 border-b dark:border-slate-800 pb-3">
                  <Smartphone className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-sm font-black text-slate-800 dark:text-white">
                    {lang === 'ar' ? '1. معلومات الهاتف الفنية' : '1. Phone Hardware Specs'}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'العلامة التجارية *' : 'Brand Name *'}</label>
                    <input
                      type="text"
                      placeholder="e.g. Apple, Samsung, Xiaomi"
                      value={buyForm.brand}
                      onChange={(e) => setBuyForm({...buyForm, brand: e.target.value})}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'طراز الهاتف *' : 'Model *'}</label>
                    <input
                      type="text"
                      placeholder="e.g. iPhone 15 Pro Max, S24 Ultra"
                      value={buyForm.model}
                      onChange={(e) => setBuyForm({...buyForm, model: e.target.value})}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'المعرف الرقمي الأول (IMEI 1) *' : 'IMEI 1 *'}</label>
                    <input
                      type="text"
                      placeholder="15 digits unique hardware ID"
                      value={buyForm.imei}
                      onChange={(e) => setBuyForm({...buyForm, imei: e.target.value})}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500 font-mono tracking-wider"
                      maxLength={15}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'المعرف الرقمي الثاني (IMEI 2)' : 'IMEI 2 (Optional)'}</label>
                    <input
                      type="text"
                      placeholder="Optional secondary slot"
                      value={buyForm.imei2}
                      onChange={(e) => setBuyForm({...buyForm, imei2: e.target.value})}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500 font-mono tracking-wider"
                      maxLength={15}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'سعة التخزين' : 'Storage Capacity'}</label>
                      <input
                        type="text"
                        placeholder="e.g. 128GB, 256GB"
                        value={buyForm.storage}
                        onChange={(e) => setBuyForm({...buyForm, storage: e.target.value})}
                        className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'لون الهاتف' : 'Color'}</label>
                      <input
                        type="text"
                        placeholder="e.g. Titanium Grey, Gold"
                        value={buyForm.color}
                        onChange={(e) => setBuyForm({...buyForm, color: e.target.value})}
                        className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'حالة الهاتف المادية *' : 'Condition *'}</label>
                    <select
                      value={buyForm.condition}
                      onChange={(e) => setBuyForm({...buyForm, condition: e.target.value as any})}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="new">{lang === 'ar' ? 'جديد ومختوم' : 'Brand New & Sealed'}</option>
                      <option value="excellent">{lang === 'ar' ? 'شبه جديد (ممتاز)' : 'Excellent'}</option>
                      <option value="good">{lang === 'ar' ? 'مستعمل حالة جيدة' : 'Good'}</option>
                      <option value="fair">{lang === 'ar' ? 'خدوش ظاهرة' : 'Fair'}</option>
                      <option value="broken">{lang === 'ar' ? 'به كسر / أعطال' : 'Broken / Parts'}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-650 dark:text-slate-350">
                      {lang === 'ar' ? 'سعر الشراء المتفق عليه *' : 'Settled Purchase Price *'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Value in DZD / Euro"
                        value={buyForm.price}
                        onChange={(e) => setBuyForm({...buyForm, price: e.target.value})}
                        className="w-full p-2.5 pr-12 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500 font-extrabold text-emerald-600"
                        required
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 font-bold">
                        {currency === 'DZD' ? (lang === 'ar' ? 'د.ج' : 'DZD') : 'EUR'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Citizen Personal details card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2 border-b dark:border-slate-800 pb-3">
                  <User className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-sm font-black text-slate-800 dark:text-white">
                    {lang === 'ar' ? '2. هوية وبيانات البائع (المواطن)' : '2. Seller (Citizen) Identity Details'}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'الاسم الكامل للبائع *' : 'Seller Full Name *'}</label>
                    <input
                      type="text"
                      placeholder="e.g. محمد أحمد"
                      value={buyForm.citizenName}
                      onChange={(e) => setBuyForm({...buyForm, citizenName: e.target.value})}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'رقم الهاتف الفعال *' : 'Active Phone Number *'}</label>
                    <input
                      type="tel"
                      placeholder="e.g. 0551234567"
                      value={buyForm.citizenPhone}
                      onChange={(e) => setBuyForm({...buyForm, citizenPhone: e.target.value})}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'نوع الوثيقة التعريفية *' : 'Identification Document *'}</label>
                    <select
                      value={buyForm.citizenIdType}
                      onChange={(e) => setBuyForm({...buyForm, citizenIdType: e.target.value as any})}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="national_card">{lang === 'ar' ? 'بطاقة التعريف الوطنية البيومترية' : 'National Biometric ID'}</option>
                      <option value="passport">{lang === 'ar' ? 'جواز السفر' : 'Biometric Passport'}</option>
                      <option value="driver_license">{lang === 'ar' ? 'رخصة السياقة' : 'Drivers License'}</option>
                      <option value="other">{lang === 'ar' ? 'وثيقة رسمية أخرى' : 'Other official ID'}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'رقم وثيقة التعريف *' : 'Document ID Number *'}</label>
                    <input
                      type="text"
                      placeholder="e.g. 1024589635"
                      value={buyForm.citizenIdNumber}
                      onChange={(e) => setBuyForm({...buyForm, citizenIdNumber: e.target.value})}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                      required
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'عنوان سكن البائع' : 'Seller Current Address'}</label>
                    <input
                      type="text"
                      placeholder="Full residential address"
                      value={buyForm.citizenAddress}
                      onChange={(e) => setBuyForm({...buyForm, citizenAddress: e.target.value})}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Verification and Legal sidebar panel */}
            <div className="space-y-6">
              
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2 border-b dark:border-slate-800 pb-3">
                  <PenTool className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-sm font-black text-slate-800 dark:text-white">
                    {lang === 'ar' ? '3. التوقيع وبطاقة التعريف الوطنية / رخصة السياقة' : '3. Signature & ID/Driver\'s License'}
                  </h2>
                </div>

                {/* Drawn Signature Pad */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-650 dark:text-slate-350">
                      {lang === 'ar' ? 'توقيع الطرف المتعاقد أولاً (شاشات لمس/فأرة)' : 'Contractor Draw Signature'}
                    </span>
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-[10px] text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {lang === 'ar' ? 'مسح' : 'Clear'}
                    </button>
                  </div>
                  <canvas
                    ref={signatureCanvasRef}
                    onMouseDown={startDrawingSignature}
                    onMouseMove={drawSignature}
                    onMouseUp={stopDrawingSignature}
                    onMouseLeave={stopDrawingSignature}
                    onTouchStart={startDrawingSignature}
                    onTouchMove={drawSignature}
                    onTouchEnd={stopDrawingSignature}
                    width={320}
                    height={110}
                    className="w-full bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-250 dark:border-slate-800 touch-none cursor-crosshair"
                  />
                </div>

                {/* Double-sided ID Card / Driver License upload and camera component */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl bg-slate-50/55 dark:bg-slate-950/20">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      🪪 {lang === 'ar' ? 'صورة بطاقة التعريف (الوجه 1)' : 'ID Card Photo (Front)'}
                    </label>
                    <div className="relative group border-2 border-dashed border-slate-250 dark:border-slate-800 rounded-xl h-28 flex flex-col items-center justify-center overflow-hidden bg-white dark:bg-slate-900">
                      {buyIdFront ? (
                        <>
                          <img src={buyIdFront} alt="ID Front" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setBuyIdFront('')}
                            className="absolute top-1 right-1 bg-red-650 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs shadow-md cursor-pointer z-10"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-2 text-slate-400">
                          <ImageIcon className="w-5 h-5 mx-auto mb-1 text-slate-350" />
                          <span className="block text-[9.5px] text-slate-450 mb-1 leading-normal">
                            {lang === 'ar' ? 'ارفع أو التقط الوجه الأمامي' : 'Upload or snap front'}
                          </span>
                          <div className="flex justify-center gap-1.5 mt-1">
                            <button
                              type="button"
                              onClick={() => startCamera('buyFront')}
                              className="text-[9px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-750 dark:text-slate-300 px-1.5 py-0.5 rounded font-extrabold cursor-pointer border dark:border-slate-700"
                            >
                              📸 {lang === 'ar' ? 'كاميرا' : 'Camera'}
                            </button>
                            <label className="text-[9px] bg-slate-150 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-705 text-slate-750 dark:text-slate-350 px-1.5 py-0.5 rounded font-extrabold cursor-pointer border dark:border-slate-700">
                              ☁️ {lang === 'ar' ? 'ملف' : 'File'}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, setBuyIdFront)}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      🪪 {lang === 'ar' ? 'صورة بطاقة التعريف (الوجه 2)' : 'ID Card Photo (Back)'}
                    </label>
                    <div className="relative group border-2 border-dashed border-slate-250 dark:border-slate-800 rounded-xl h-28 flex flex-col items-center justify-center overflow-hidden bg-white dark:bg-slate-900">
                      {buyIdBack ? (
                        <>
                          <img src={buyIdBack} alt="ID Back" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setBuyIdBack('')}
                            className="absolute top-1 right-1 bg-red-650 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs shadow-md cursor-pointer z-10"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-2 text-slate-400">
                          <ImageIcon className="w-5 h-5 mx-auto mb-1 text-slate-350" />
                          <span className="block text-[9.5px] text-slate-450 mb-1 leading-normal">
                            {lang === 'ar' ? 'ارفع أو التقط الوجه الخلفي' : 'Upload or snap back'}
                          </span>
                          <div className="flex justify-center gap-1.5 mt-1">
                            <button
                              type="button"
                              onClick={() => startCamera('buyBack')}
                              className="text-[9px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-755 dark:text-slate-300 px-1.5 py-0.5 rounded font-extrabold cursor-pointer border dark:border-slate-700"
                            >
                              📸 {lang === 'ar' ? 'كاميرا' : 'Camera'}
                            </button>
                            <label className="text-[9px] bg-slate-150 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-705 text-slate-755 dark:text-slate-350 px-1.5 py-0.5 rounded font-extrabold cursor-pointer border dark:border-slate-700">
                              ☁️ {lang === 'ar' ? 'ملف' : 'File'}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, setBuyIdBack)}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Secure Checkboxes protection declaration */}
                <div className="p-4 bg-red-50/50 dark:bg-red-950/15 rounded-2xl border border-red-100 dark:border-red-900/30 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="legalDeclaration"
                      checked={buyForm.legalDeclaration}
                      onChange={(e) => setBuyForm({...buyForm, legalDeclaration: e.target.checked})}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      required
                    />
                    <label htmlFor="legalDeclaration" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-relaxed cursor-pointer select-none">
                      {lang === 'ar' 
                        ? 'تعهد شرفي رسمي بمصادقة البيع وأتحمل مطلق المسألة المدنية والجزائية أمام النواب ومصالح الشرطة في حال ثبوت عدم شرعية مصدر الجهاز أو الإبلاغ عن سرقته.' 
                        : 'Solemn declaration of authentic legal ownership. I declare on my honor that this device is not stolen, and authorize shop to dispatch this protocol to criminal intelligence if inspected.'
                      }
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/20 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {lang === 'ar' ? 'تأكيد وحفظ الشراء القانوني المضمون' : 'Save Secure Purchase & Lock'}
                </button>
              </div>

            </div>
          </form>
        )}

        {/* 3. SALES / WARANTY TRANSACTION FORM */}
        {activeSubTab === 'new-sell' && (
          <form onSubmit={handleSellSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Sales Phone details */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2 border-b dark:border-slate-800 pb-3">
                  <Smartphone className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-sm font-black text-slate-800 dark:text-white">
                    {lang === 'ar' ? '1. الهاتف المستعمل المراد بيعه' : '1. Select Used Phone to Sell'}
                  </h2>
                </div>

                {/* Selective Dropdown mechanism */}
                <div className="space-y-1 text-xs">
                  <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'مصدر الهاتف المستعمل *' : 'Selection Mode *'}</label>
                  <select
                    value={sellForm.selectedBoughtPhoneId}
                    onChange={(e) => setSellForm({...sellForm, selectedBoughtPhoneId: e.target.value})}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    required
                  >
                    <option value="">{lang === 'ar' ? '-- اختر من الهواتف التي اشتراها المحل من قبل --' : '-- Choose from bought used phones in stock --'}</option>
                    {availablePhones.map(p => (
                      <option key={p.id} value={p.id} className="font-mono">
                        {p.brand} {p.model} (IMEI: {p.imei}) - [{p.price} DZD]
                      </option>
                    ))}
                    <option value="custom">✍️ {lang === 'ar' ? 'إدخال هاتف يدوي (ليس مسجل من قبل)' : 'Write Custom phone specs (on the fly)'}</option>
                  </select>
                </div>

                {/* ONLY SHOW CUSTOM FORM INPUTS IF WE CHOSE CUSTOM */}
                {sellForm.selectedBoughtPhoneId === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'العلامة التجارية *' : 'Brand Name *'}</label>
                      <input
                        type="text"
                        placeholder="Apple, Samsung"
                        value={sellForm.customBrand}
                        onChange={(e) => setSellForm({...sellForm, customBrand: e.target.value})}
                        className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'طراز الهاتف *' : 'Model *'}</label>
                      <input
                        type="text"
                        placeholder="iPhone 13"
                        value={sellForm.customModel}
                        onChange={(e) => setSellForm({...sellForm, customModel: e.target.value})}
                        className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'المعرف الرقمي IMEI *' : 'IMEI *'}</label>
                      <input
                        type="text"
                        placeholder="15 digits unique key"
                        value={sellForm.customImei}
                        onChange={(e) => setSellForm({...sellForm, customImei: e.target.value})}
                        className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500 font-mono tracking-wider font-bold"
                        maxLength={15}
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'سعة التخزين واللون' : 'Storage & Color'}</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="e.g. 128GB"
                          value={sellForm.customStorage}
                          onChange={(e) => setSellForm({...sellForm, customStorage: e.target.value})}
                          className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="e.g. Black"
                          value={sellForm.customColor}
                          onChange={(e) => setSellForm({...sellForm, customColor: e.target.value})}
                          className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* SHOW CONFIRMED CHOSEN STOCK PHONE SPECS DISPLAY (IF SELECTED) */}
                {sellForm.selectedBoughtPhoneId && sellForm.selectedBoughtPhoneId !== 'custom' && (() => {
                  const p = transactions.find(t => t.id === sellForm.selectedBoughtPhoneId);
                  if (!p) return null;
                  return (
                    <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-2xl border border-emerald-150 border-dashed text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                        <Check className="w-4 h-4" />
                        {lang === 'ar' ? 'تم استدعاء بيانات الهاتف ومصدر المعاملة بأمان' : 'Hardware asset fetched successfully from secure buys logs'}
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <p className="opacity-75">{lang === 'ar' ? 'العلامة والطراز:' : 'Device Model:'} <strong className="text-slate-800 dark:text-white">{p.brand} {p.model}</strong></p>
                        <p className="opacity-75">{lang === 'ar' ? 'المعرف IMEI:' : 'IMEI Identifier.'} <strong className="text-slate-800 dark:text-white font-mono">{p.imei}</strong></p>
                        <p className="opacity-75">{lang === 'ar' ? 'كلفة الشراء السابقة:' : 'Original buy cost:'} <strong className="text-slate-800 dark:text-white">{p.price} DZD</strong></p>
                        <p className="opacity-75">{lang === 'ar' ? 'حالة الجهاز المستوردة:' : 'Imported Condition:'} <strong className="text-emerald-600 font-bold">{p.condition.toUpperCase()}</strong></p>
                      </div>
                    </div>
                  );
                })()}

                {/* Pricing & Warranty specs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'سعر البيع المتفق عليه مع الزبون *' : 'Selling Price to Customer *'}</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Amount settled"
                        value={sellForm.sellPrice}
                        onChange={(e) => setSellForm({...sellForm, sellPrice: e.target.value})}
                        className="w-full p-2.5 pr-12 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500 font-extrabold text-blue-600"
                        required
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 font-bold">
                        {currency === 'DZD' ? (lang === 'ar' ? 'د.ج' : 'DZD') : 'EUR'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'ضمان المحل الممنوح *' : 'Shop Warranty Granted *'}</label>
                    <select
                      value={sellForm.warrantyPeriod}
                      onChange={(e) => setSellForm({...sellForm, warrantyPeriod: e.target.value})}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-700"
                    >
                      <option value="no_warranty">{lang === 'ar' ? 'بدون ضمان استبدال' : 'No warranty'}</option>
                      <option value="30_days">{lang === 'ar' ? '30 يوم ضمان المحل' : '30 Days store warranty'}</option>
                      <option value="90_days">{lang === 'ar' ? '90 يوم (ثلاثة أشهر)' : '90 Days Full store protection'}</option>
                      <option value="180_days">{lang === 'ar' ? '180 يوم (6 أشهر) ضمان ممتد' : '180 Days Extended coverage'}</option>
                    </select>
                  </div>
                </div>

              </div>

              {/* BUYER INFORMATION DETAILS */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2 border-b dark:border-slate-800 pb-3">
                  <User className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-sm font-black text-slate-800 dark:text-white">
                    {lang === 'ar' ? '2. هوية وبيانات المشتري (الزبون)' : '2. Buyer (Customer) Identity details'}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'الاسم الكامل للمشتري *' : 'Buyer Full Name *'}</label>
                    <input
                      type="text"
                      placeholder="e.g. كمال بن زهرة"
                      value={sellForm.citizenName}
                      onChange={(e) => setSellForm({...sellForm, citizenName: e.target.value})}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'رقم الهاتف *' : 'Phone Number *'}</label>
                    <input
                      type="tel"
                      placeholder="e.g. 0551000000"
                      value={sellForm.citizenPhone}
                      onChange={(e) => setSellForm({...sellForm, citizenPhone: e.target.value})}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'نوع الوثيقة التعريفية *' : 'Identification Document *'}</label>
                    <select
                      value={sellForm.citizenIdType}
                      onChange={(e) => setSellForm({...sellForm, citizenIdType: e.target.value as any})}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none"
                    >
                      <option value="national_card">{lang === 'ar' ? 'بطاقة التعريف الوطنية البيومترية' : 'National Biometric ID'}</option>
                      <option value="passport">{lang === 'ar' ? 'جواز السفر' : 'Biometric Passport'}</option>
                      <option value="driver_license">{lang === 'ar' ? 'رخصة السياقة' : 'Drivers License'}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'رقم وثيقة التعريف *' : 'Document ID Number *'}</label>
                    <input
                      type="text"
                      placeholder="Card ID value"
                      value={sellForm.citizenIdNumber}
                      onChange={(e) => setSellForm({...sellForm, citizenIdNumber: e.target.value})}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none font-mono font-bold"
                      required
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-bold text-slate-650 dark:text-slate-350">{lang === 'ar' ? 'عنوان سكن المشتري' : 'Buyer Address'}</label>
                    <input
                      type="text"
                      placeholder="Home details"
                      value={sellForm.citizenAddress}
                      onChange={(e) => setSellForm({...sellForm, citizenAddress: e.target.value})}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 outline-none"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Buyer signatures panels */}
            <div className="space-y-6">
              
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2 border-b dark:border-slate-800 pb-3">
                  <PenTool className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-sm font-black text-slate-800 dark:text-white">
                    {lang === 'ar' ? '3. التوقيع وبطاقة التعريف الوطنية / رخصة السياقة' : '3. Signature & ID/Driver\'s License'}
                  </h2>
                </div>

                {/* Drawn Signature Pad */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-650 dark:text-slate-350">
                      {lang === 'ar' ? 'توقيع العميل المشتري' : 'Buyer Customer Signature'}
                    </span>
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-[10px] text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {lang === 'ar' ? 'مسح' : 'Clear'}
                    </button>
                  </div>
                  <canvas
                    ref={signatureCanvasRef}
                    onMouseDown={startDrawingSignature}
                    onMouseMove={drawSignature}
                    onMouseUp={stopDrawingSignature}
                    onMouseLeave={stopDrawingSignature}
                    onTouchStart={startDrawingSignature}
                    onTouchMove={drawSignature}
                    onTouchEnd={stopDrawingSignature}
                    width={320}
                    height={110}
                    className="w-full bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-250 dark:border-slate-800 touch-none cursor-crosshair"
                  />
                </div>

                {/* Double-sided ID Card / Driver License upload and camera component for Selling */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl bg-slate-50/55 dark:bg-slate-950/20">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      🪪 {lang === 'ar' ? 'صورة بطاقة التعريف (الوجه 1)' : 'ID Card Photo (Front)'}
                    </label>
                    <div className="relative group border-2 border-dashed border-slate-250 dark:border-slate-800 rounded-xl h-28 flex flex-col items-center justify-center overflow-hidden bg-white dark:bg-slate-900">
                      {sellIdFront ? (
                        <>
                          <img src={sellIdFront} alt="ID Front" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setSellIdFront('')}
                            className="absolute top-1 right-1 bg-red-650 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs shadow-md cursor-pointer z-10"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-2 text-slate-400">
                          <ImageIcon className="w-5 h-5 mx-auto mb-1 text-slate-350" />
                          <span className="block text-[9.5px] text-slate-450 mb-1 leading-normal">
                            {lang === 'ar' ? 'ارفع أو التقط الوجه الأمامي' : 'Upload or snap front'}
                          </span>
                          <div className="flex justify-center gap-1.5 mt-1">
                            <button
                              type="button"
                              onClick={() => startCamera('sellFront')}
                              className="text-[9px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-750 dark:text-slate-300 px-1.5 py-0.5 rounded font-extrabold cursor-pointer border dark:border-slate-700"
                            >
                              📸 {lang === 'ar' ? 'كاميرا' : 'Camera'}
                            </button>
                            <label className="text-[9px] bg-slate-150 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-705 text-slate-750 dark:text-slate-350 px-1.5 py-0.5 rounded font-extrabold cursor-pointer border dark:border-slate-700">
                              ☁️ {lang === 'ar' ? 'ملف' : 'File'}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, setSellIdFront)}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      🪪 {lang === 'ar' ? 'صورة بطاقة التعريف (الوجه 2)' : 'ID Card Photo (Back)'}
                    </label>
                    <div className="relative group border-2 border-dashed border-slate-250 dark:border-slate-800 rounded-xl h-28 flex flex-col items-center justify-center overflow-hidden bg-white dark:bg-slate-900">
                      {sellIdBack ? (
                        <>
                          <img src={sellIdBack} alt="ID Back" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setSellIdBack('')}
                            className="absolute top-1 right-1 bg-red-650 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs shadow-md cursor-pointer z-10"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-2 text-slate-400">
                          <ImageIcon className="w-5 h-5 mx-auto mb-1 text-slate-350" />
                          <span className="block text-[9.5px] text-slate-450 mb-1 leading-normal">
                            {lang === 'ar' ? 'ارفع أو التقط الوجه الخلفي' : 'Upload or snap back'}
                          </span>
                          <div className="flex justify-center gap-1.5 mt-1">
                            <button
                              type="button"
                              onClick={() => startCamera('sellBack')}
                              className="text-[9px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-755 dark:text-slate-300 px-1.5 py-0.5 rounded font-extrabold cursor-pointer border dark:border-slate-700"
                            >
                              📸 {lang === 'ar' ? 'كاميرا' : 'Camera'}
                            </button>
                            <label className="text-[9px] bg-slate-150 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-705 text-slate-755 dark:text-slate-350 px-1.5 py-0.5 rounded font-extrabold cursor-pointer border dark:border-slate-700">
                              ☁️ {lang === 'ar' ? 'ملف' : 'File'}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, setSellIdBack)}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Declaration pledge logic */}
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/15 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="sellLegalDeclaration"
                      checked={sellForm.legalDeclaration}
                      onChange={(e) => setSellForm({...sellForm, legalDeclaration: e.target.checked})}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      required
                    />
                    <label htmlFor="sellLegalDeclaration" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-relaxed cursor-pointer select-none">
                      {lang === 'ar' 
                        ? 'تأكيد حيازة العقد وتسليم الهاتف المستعمل وملحقاته للزبون بالمواصفات المتفق عليها وتفعيل ضمان المحل بالبصمة لتأمين الاستلام.' 
                        : 'Confirm secure delivery, setup warranty program, stamp receipt and generate PDF proof for verification.'
                      }
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/20 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {lang === 'ar' ? 'تأكيد عملية البيع وطباعة الضمان' : 'Complete Sale & Print warranty'}
                </button>
              </div>

            </div>
          </form>
        )}

      </div>

      {/* 🔮 RECEIPT PREVIEW / PRINTING MODAL OVERLAY */}
      {selectedTx && (
        <div className="print:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border dark:border-slate-800 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <h2 className="text-sm font-black">
                  {selectedTx.type === 'buy' ? (lang === 'ar' ? 'تفاصيل وصل شراء هاتف مستعمل' : 'Used Purchase Verification Log') : (lang === 'ar' ? 'تفاصيل وصل بيع هاتف مستعمل مع الضمان' : 'Used Sale & Warranty Lock')}
                </h2>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-all cursor-pointer text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Contents */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-650 dark:text-slate-350" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              
              <div className="flex items-center gap-2 justify-center text-center p-3 bg-teal-50 dark:bg-teal-950/20 text-teal-800 dark:text-teal-400 rounded-xl font-bold">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                {lang === 'ar' ? 'معاملة آمنة وموثقة قانونياً ببصمة اليد والتعهد الشرفي للبائع' : 'Authenticated Log: Secured with Honor pledge & Biometrics'}
              </div>

              {/* Grid detail summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-4 border-b dark:border-slate-800">
                <div className="space-y-2">
                  <p className="font-extrabold border-b pb-1 text-slate-800 dark:text-slate-205">{lang === 'ar' ? 'خصائص وتفاصيل الهاتف:' : 'Phone Hardware Integrity specs:'}</p>
                  <p><span className="opacity-75">{lang === 'ar' ? 'العلامة والطراز:' : 'Brand & Model:'}</span> <strong className="text-slate-800 dark:text-white">{selectedTx.brand} {selectedTx.model}</strong></p>
                  <p><span className="opacity-75">IMEI 1:</span> <strong className="font-mono text-slate-800 dark:text-white tracking-wide">{selectedTx.imei}</strong></p>
                  {selectedTx.imei2 && <p><span className="opacity-75">IMEI 2:</span> <strong className="font-mono text-slate-800 dark:text-white tracking-wide">{selectedTx.imei2}</strong></p>}
                  {selectedTx.serialNumber && <p><span className="opacity-75">S/N:</span> <strong className="font-mono text-slate-800 dark:text-white">{selectedTx.serialNumber}</strong></p>}
                  <p><span className="opacity-75">{lang === 'ar' ? 'مواصفات إضافية:' : 'Color & Storage:'}</span> {selectedTx.storage} • {selectedTx.color}</p>
                  <p><span className="opacity-75">{lang === 'ar' ? 'حالة مادية عند الاستلام:' : 'Physical Condition:'}</span> <strong className="uppercase text-emerald-600">{selectedTx.condition}</strong></p>
                </div>

                <div className="space-y-2">
                  <p className="font-extrabold border-b pb-1 text-slate-800 dark:text-slate-205">{txDetailsTitle(selectedTx.type)}</p>
                  <p><span className="opacity-75">{lang === 'ar' ? 'الاسم واللقب:' : 'Full Name:'}</span> <strong className="text-slate-800 dark:text-white">{selectedTx.citizenName}</strong></p>
                  <p><span className="opacity-75">{lang === 'ar' ? 'رقم الهاتف:' : 'Phone Number:'}</span> {selectedTx.citizenPhone}</p>
                  <p><span className="opacity-75">{lang === 'ar' ? 'الوثيقة وهوية الرسمية:' : 'Document ID Type:'}</span> {selectedTx.citizenIdType.toUpperCase()} ({selectedTx.citizenIdNumber})</p>
                  {selectedTx.citizenAddress && <p><span className="opacity-75">{lang === 'ar' ? 'عنوان الإقامة المأخوذ:' : 'Address:'}</span> {selectedTx.citizenAddress}</p>}
                  <p className="pt-1 border-t dark:border-slate-800"><span className="opacity-75">{lang === 'ar' ? 'كلفة المعاملة:' : 'Transaction Cash:'}</span> <strong className="text-sm text-emerald-600 dark:text-emerald-400">{selectedTx.price.toLocaleString()} {currency === 'DZD' ? (lang === 'ar' ? 'د.ج' : 'DZD') : 'EUR'}</strong></p>
                </div>
              </div>

              {/* Standard Anti-Theft Protection declaration display */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 border dark:border-slate-800 rounded-2xl space-y-2">
                <h4 className="font-extrabold flex items-center gap-1.5 text-xs text-red-500">
                  <AlertTriangle className="w-4 h-4 text-emerald-500 shrink-0" />
                  {lang === 'ar' ? 'التعهد الشرفي وإخلاء طرف المحل (رسمي)' : 'Solemn Verification Pledge of Honor (Shop Exoneration)'}
                </h4>
                <p className="text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-400">
                  {lang === 'ar'
                    ? `بموجب كبس التعهد، يصرح الطرف بصفته المالك الفردي والشرعي والوحيد للجهاز الموصوف أعلاه ولهذا المعرف الرقمي IMEI، ويتحمل مطلق المسؤولية الجزائية والجنائية أمام الجهات القضائية والمصالح الأمنية في حال ثبت خلاف ذلك، مبرئاً ذمة صاحب المحل تماماً وبشكل مطلق وبات.`
                    : `In accord with transaction seal, contractor verifies device IMEI is legal property. Contractor assumes complete civil and criminal penalties before police investigations and court cases, fully freeing shop management of liabilities.`
                  }
                </p>
              </div>

              {/* Signatures & ID Verification panel display */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border dark:border-slate-800 space-y-2 text-center">
                  <span className="block font-bold text-xs">{lang === 'ar' ? 'توقيع العميل' : 'Customer Signature'}</span>
                  {selectedTx.signatureData ? (
                    <img src={selectedTx.signatureData} alt="Sig" className="max-h-20 mx-auto object-contain border bg-white rounded p-1 dark:bg-slate-900 dark:border-slate-800" />
                  ) : (
                    <span className="text-slate-400 block py-6 text-xs">{lang === 'ar' ? 'لا يوجد' : 'None'}</span>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border dark:border-slate-800 space-y-2 text-center">
                  <span className="block font-bold text-xs">{lang === 'ar' ? 'بطاقة التعريف (الوجه 1)' : 'ID Card Front'}</span>
                  {selectedTx.idCardFrontData ? (
                    <img src={selectedTx.idCardFrontData} alt="ID Front" className="max-h-20 mx-auto object-contain border bg-white rounded p-1 dark:bg-slate-900 dark:border-slate-800" />
                  ) : (
                    <span className="text-slate-400 block py-6 text-xs">{lang === 'ar' ? 'لا يوجد' : 'None'}</span>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border dark:border-slate-800 space-y-2 text-center">
                  <span className="block font-bold text-xs">{lang === 'ar' ? 'بطاقة التعريف (الوجه 2)' : 'ID Card Back'}</span>
                  {selectedTx.idCardBackData ? (
                    <img src={selectedTx.idCardBackData} alt="ID Back" className="max-h-20 mx-auto object-contain border bg-white rounded p-1 dark:bg-slate-900 dark:border-slate-800" />
                  ) : (
                    <span className="text-slate-400 block py-6 text-xs">{lang === 'ar' ? 'لا يوجد' : 'None'}</span>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-5 border-t dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <p className="text-[10px] text-slate-400">
                {lang === 'ar' ? 'الوصل جاهز للطباعة على طابعات البكرات أو الورق المكتبي.' : 'Invoice is ready to be parsed by spoolers/A4 prints.'}
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-755 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  {lang === 'ar' ? 'إغلاق' : 'Close'}
                </button>
                <button
                  onClick={handlePrint}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  {lang === 'ar' ? 'بدء الطباعة الآن' : 'Start Spool & Print'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Real-time Video Camera Snapper Overlay */}
      {activeCameraTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 text-white text-center shadow-2xl relative overflow-hidden">
            <button
              onClick={stopCamera}
              className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-white rounded-full p-2 leading-none transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-black text-sm tracking-tight text-slate-100 flex items-center justify-center gap-2">
              <Camera className="w-5 h-5 text-emerald-500 animate-pulse" />
              {lang === 'ar' ? 'التقاط صورة الهوية البيومترية' : 'Capture ID Document Frame'}
            </h3>

            {cameraError ? (
              <div className="p-4 bg-rose-950/40 border border-rose-900/50 rounded-2xl text-[11px] text-rose-350 leading-relaxed text-center space-y-3">
                <p>{cameraError}</p>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-1.5 bg-rose-650 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إغلاق ومتابعة برفع ملف' : 'Close & Upload Local File'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative aspect-video rounded-2xl bg-black border border-slate-800 overflow-hidden flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {/* Visual framing line guide of a standard card */}
                  <div className="absolute inset-4 border-2 border-dashed border-emerald-500/60 rounded-xl pointer-events-none flex items-center justify-center">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-extrabold bg-black/70 px-2 py-0.5 rounded-md animate-pulse">
                      {lang === 'ar' ? 'ضع البطاقة هنا' : 'Align Card Inside Frame'}
                    </div>
                  </div>
                </div>

                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-705 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" />
                    {lang === 'ar' ? 'التقاط الصورة' : 'Snap Picture'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );

  function txDetailsTitle(type: 'buy' | 'sell') {
    if (type === 'buy') {
      return lang === 'ar' ? 'هوية وعنوان البائع (المواطن):' : 'Aquired from (Seller details):';
    }
    return lang === 'ar' ? 'هوية وعنوان المشتري (الزبون):' : 'Acquisitor (Buyer details):';
  }
}
