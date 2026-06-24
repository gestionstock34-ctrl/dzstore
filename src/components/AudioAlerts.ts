/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Custom Synthesized Audio Cues utilizing Web Audio API
export class DzStoreAudio {
  private static ctx: AudioContext | null = null;

  private static getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Laser scanner simulator sound
  static playScanBeep(enabled: boolean = true) {
    if (!enabled) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime); // laser frequency (high pitch short beep)
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch (e) {
      console.warn('Audio check skipped:', e);
    }
  }

  // POS payment success sound
  static playSuccessChime(enabled: boolean = true) {
    if (!enabled) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      // Two-note ascending chime
      const notes = [587.33, 880]; // D5 then A5
      const times = [0.15, 0.3];

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.08, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.08 + times[idx]);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + times[idx]);
      });
    } catch (e) {
      console.warn('Audio check skipped:', e);
    }
  }

  // Warning Sound
  static playWarningChime(enabled: boolean = true) {
    if (!enabled) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime); // buzzer lower frequency
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn('Audio check skipped:', e);
    }
  }

  // System notification bubble chime
  static playNotification(enabled: boolean = true) {
    if (!enabled) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // slide up
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      console.warn('Audio check skipped:', e);
    }
  }
}
