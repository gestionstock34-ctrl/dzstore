/**
 * DZ Store V2 Enterprise SaaS Device Fingerprinter
 * Generates highly consistent hardware signature hashes on the local machine
 * to prevent unauthorized license sharing.
 */

export class DeviceFingerprint {
  static async getSignature(): Promise<string> {
    const pieces: string[] = [];

    // 1. Screen resolution & color depth
    pieces.push(`${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`);

    // 2. Browser user agent
    pieces.push(window.navigator.userAgent);

    // 3. System Language
    pieces.push(window.navigator.language || 'en');

    // 4. Hardware concurrency (CPU cores)
    if (window.navigator.hardwareConcurrency) {
      pieces.push(`cores-${window.navigator.hardwareConcurrency}`);
    }

    // 5. Canvas Fingerprint (Generates silent graphics card rendering details)
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 200;
        canvas.height = 40;
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(8, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('DzStore, v2! 😃', 2, 2);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('🚀 SaaS-Enterprise-Device-Lock', 4, 17);
        pieces.push(canvas.toDataURL());
      }
    } catch (e) {
      pieces.push('no-canvas');
    }

    // 6. Audio Context Fingerprint (Silent audio node synthesis curve check)
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const analyser = audioCtx.createAnalyser();
      oscillator.connect(analyser);
      pieces.push(`osc-${oscillator.type}-${analyser.fftSize}`);
      audioCtx.close();
    } catch {
      pieces.push('no-audio');
    }

    const rawString = pieces.join('|||');
    return this.hashString(rawString);
  }

  private static hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return '00000000';
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).toUpperCase();
  }

  static getDeviceType(): 'computer' | 'phone' {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android|blackberry|mini|windows\sphone|iemobile/i.test(userAgent);
    return isMobile ? 'phone' : 'computer';
  }
}
