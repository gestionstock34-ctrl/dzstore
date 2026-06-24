
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, RotateCw, AlertTriangle } from 'lucide-react';

interface BarcodeCameraScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
  lang: 'ar' | 'en';
}

export const BarcodeCameraScanner: React.FC<BarcodeCameraScannerProps> = ({
  onScanSuccess,
  onClose,
  lang,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const scannerId = "html5qr-scanner-node";
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let isMounted = true;
    let scannerInstance: Html5Qrcode | null = null;

    // Play a friendly initialization chime
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch {}

    const startCamera = async () => {
      try {
        if (!isMounted) return;
        const html5Qrcode = new Html5Qrcode(scannerId);
        scannerInstance = html5Qrcode;
        scannerRef.current = html5Qrcode;

        const config = {
          fps: 15,
          qrbox: { width: 280, height: 130 }, // Wide box suitable for physical barcode tags
          aspectRatio: 1.777777,
        };

        await html5Qrcode.start(
          { facingMode: "environment" },
          config,
          async (decodedText) => {
            if (!isMounted) return;
            // Success! Play high-pitch scan beep
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
              gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.15);
            } catch {}

            // Stop the scanner smoothly first
            try {
              if (html5Qrcode.isScanning) {
                await html5Qrcode.stop();
              }
            } catch (err) {
              console.warn("Error stopping scanner inside success callback:", err);
            }

            // Once stopped, trigger callback
            if (isMounted) {
              onScanSuccess(decodedText);
            }
          },
          () => {
            // Parsing frame error - ignore to keep scanning
          }
        );

        if (!isMounted) {
          html5Qrcode.stop().catch(console.error);
          return;
        }

        setIsActive(true);
      } catch (err: any) {
        if (isMounted) {
          console.error("Camera scanner failed to initialize:", err);
          setErrorMsg(
            lang === 'ar'
              ? '❌ تعذر فتح الكاميرا! يرجى التأكد من منح صلاحية استخدام الكاميرا وإغلاق أي تطبيق آخر يستخدمها.'
              : '❌ Failed to access device camera! Verify permissions and ensure no other application is holding it.'
          );
        }
      }
    };

    // Delay start slightly to let the DOM element mount completely
    const timer = setTimeout(() => {
      startCamera();
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerInstance) {
        if (scannerInstance.isScanning) {
          scannerInstance.stop().catch((err) => console.warn("Failed to stop scanner on unmount:", err));
        } else {
          // If start was pending but isScanning is false, stopping is handled in startCamera when it resolves
        }
      }
    };
  }, [lang]);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fade-in font-sans" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 shadow-2xl relative overflow-hidden space-y-4">
        
        {/* Top guide */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400 animate-pulse" />
            <h3 className="font-extrabold text-sm text-white">
              {lang === 'ar' ? 'مسح الكود بار المباشر بالهاتف' : 'Live Phone Laser Barcode Scanner'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info */}
        <p className="text-[11px] text-slate-400">
          {lang === 'ar' 
            ? 'قم بتوجيه كاميرا الهاتف الخلفية وجعل ملصق الباركود يتوسط المستطيل المضيء للتعرف التلقائي السريع.'
            : 'Point your camera onto the product barcode label and center it inside the rectangle.'
          }
        </p>

        {/* Viewfinder target */}
        <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
          <div id={scannerId} className="w-full h-full" />
          
          {errorMsg && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col justify-center items-center text-center p-6 space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-500" />
              <p className="text-xs text-rose-300 leading-relaxed font-bold">{errorMsg}</p>
              <button
                onClick={onClose}
                className="text-xs bg-slate-800 text-white font-bold px-4 py-2 rounded-xl border border-slate-705"
              >
                {lang === 'ar' ? 'إغلاق ومحاولة كتابته يدويا' : 'Close and Input Manually'}
              </button>
            </div>
          )}

          {isActive && !errorMsg && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              {/* Scan target guidelines overlay overlay */}
              <div className="w-[180px] h-[90px] border-3 border-emerald-400 rounded-xl relative shadow-[0_0_0_2000px_rgba(0,0,0,0.5)]">
                {/* Visual red laser line marker */}
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-rose-500 animate-[bounce_1.5s_infinite] shadow-[0_0_8px_#f43f5e]" />
              </div>
              <span className="text-[9px] text-emerald-400 font-extrabold tracking-widest uppercase mt-3 bg-slate-950/60 px-2 py-0.5 rounded-md">
                {lang === 'ar' ? 'جاري المسح المباشر...' : 'Scanning real-time...'}
              </span>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 font-extrabold rounded-xl transition-colors cursor-pointer border border-slate-700/50"
        >
          ✕ {lang === 'ar' ? 'إلغاء وإدخال يدوي' : 'Cancel and Fill Manually'}
        </button>
      </div>
    </div>
  );
};
