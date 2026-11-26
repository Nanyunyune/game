export type HitMaterial = 'stone' | 'wood' | 'bronze' | 'boss';

class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  public enabled = true;

  public unlock(): void {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 6;
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.72;
        this.master.connect(comp);
        comp.connect(this.ctx.destination);

        const len = Math.floor(this.ctx.sampleRate * 0.6);
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
    } catch {
      // Ignore Web Audio restriction errors
    }
  }

  private ready(): boolean {
    if (!this.enabled || !this.ctx || !this.master || !this.noiseBuf) return false;
    if (this.ctx.state === 'suspended') {
      try {
        void this.ctx.resume();
      } catch {
        // Ignore
      }
    }
    return true;
  }

  public playSlash(step: 1 | 2 | 3): void {
    if (!this.ready() || !this.ctx || !this.master || !this.noiseBuf) return;
    const c = this.ctx;
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = step === 3 ? 1.8 : 2.6;
    const f0 = step === 1 ? 1750 : step === 2 ? 2200 : 1200;
    const f1 = step === 1 ? 460 : step === 2 ? 620 : 240;
    const dur = step === 3 ? 0.22 : 0.13;
    bp.frequency.setValueAtTime(f0, now);
    bp.frequency.exponentialRampToValueAtTime(f1, now + dur);

    const g = c.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(step === 3 ? 0.42 : 0.26, now + 0.018);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  public playHit(isHeavy: boolean, mat: HitMaterial = 'stone'): void {
    if (!this.ready() || !this.ctx || !this.master || !this.noiseBuf) return;
    const c = this.ctx;
    const now = c.currentTime;

    // 1. Low-end impact thud
    const osc = c.createOscillator();
    osc.type = isHeavy ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isHeavy ? 158 : 195, now);
    osc.frequency.exponentialRampToValueAtTime(isHeavy ? 32 : 56, now + (isHeavy ? 0.25 : 0.13));
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = isHeavy ? 340 : 500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(isHeavy ? 0.58 : 0.36, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, now + (isHeavy ? 0.27 : 0.15));
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.29);

    // 2. Material-specific shatter pulses
    const pulses = isHeavy ? 4 : 2;
    for (let i = 0; i < pulses; i++) {
      const t = now + i * 0.02;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = mat === 'wood' ? 1.8 : mat === 'bronze' || mat === 'boss' ? 4.4 : 3.2;
      const baseFreq = mat === 'wood' ? 880 : mat === 'bronze' ? 2100 : mat === 'boss' ? 1650 : 1450;
      bp.frequency.value = baseFreq + Math.random() * 620;
      const ng = c.createGain();
      ng.gain.setValueAtTime(0.001, t);
      ng.gain.linearRampToValueAtTime((isHeavy ? 0.3 : 0.19) / (1 + i * 0.28), t + 0.004);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(this.master);
      src.start(t);
      src.stop(t + 0.095);
    }

    // 3. Bronze bell harmonic ring for Wisp / Boss hits
    if (mat === 'bronze' || mat === 'boss') {
      const freqs = mat === 'boss' ? [330, 512, 845] : [620, 980, 1520];
      freqs.forEach((f, idx) => {
        const bell = c.createOscillator();
        bell.type = 'sine';
        bell.frequency.setValueAtTime(f * (0.98 + Math.random() * 0.04), now);
        bell.frequency.exponentialRampToValueAtTime(f * 0.94, now + (isHeavy ? 0.34 : 0.2));
        const bg = c.createGain();
        bg.gain.setValueAtTime(0.001, now);
        bg.gain.linearRampToValueAtTime((isHeavy ? 0.14 : 0.09) / (idx + 1), now + 0.005);
        bg.gain.exponentialRampToValueAtTime(0.001, now + (isHeavy ? 0.36 : 0.22));
        bell.connect(bg);
        bg.connect(this.master!);
        bell.start(now);
        bell.stop(now + 0.38);
      });
    }

    // 4. Crisp high-frequency blade-bite sparkle on heavy Combo 3 hits
    if (isHeavy) {
      const glint = c.createOscillator();
      glint.type = 'triangle';
      glint.frequency.setValueAtTime(1480, now);
      glint.frequency.exponentialRampToValueAtTime(740, now + 0.14);
      const gg = c.createGain();
      gg.gain.setValueAtTime(0.001, now);
      gg.gain.linearRampToValueAtTime(0.16, now + 0.005);
      gg.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      glint.connect(gg);
      gg.connect(this.master);
      glint.start(now);
      glint.stop(now + 0.17);
    }
  }

  public playMonsterKill(isBoss = false): void {
    if (!this.ready() || !this.ctx || !this.master) return;
    const c = this.ctx;
    const now = c.currentTime;
    const freqs = isBoss ? [220, 330, 440, 660, 880] : [420, 630, 945];
    freqs.forEach((f, i) => {
      const osc = c.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.025);
      osc.frequency.exponentialRampToValueAtTime(f * 1.12, now + i * 0.025 + 0.26);
      const g = c.createGain();
      g.gain.setValueAtTime(0.001, now + i * 0.025);
      g.gain.linearRampToValueAtTime((isBoss ? 0.2 : 0.12) / (1 + i * 0.35), now + i * 0.025 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.025 + (isBoss ? 0.65 : 0.32));
      osc.connect(g);
      g.connect(this.master!);
      osc.start(now + i * 0.025);
      osc.stop(now + i * 0.025 + (isBoss ? 0.68 : 0.35));
    });
  }

  public playJump(): void {
    if (!this.ready() || !this.ctx || !this.master) return;
    const c = this.ctx;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.09);
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playDash(): void {
    if (!this.ready() || !this.ctx || !this.master || !this.noiseBuf) return;
    const c = this.ctx;
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(1600, now);
    bp.frequency.exponentialRampToValueAtTime(320, now + 0.16);
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.28, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now);
    src.stop(now + 0.18);
  }

  public playHurt(): void {
    if (!this.ready() || !this.ctx || !this.master) return;
    const c = this.ctx;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.22);
    const g = c.createGain();
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playCoin(comboIdx = 0): void {
    if (!this.ready() || !this.ctx || !this.master) return;
    const c = this.ctx;
    const now = c.currentTime;
    const base = 780 * Math.pow(1.06, Math.min(comboIdx, 12));
    [base, base * 1.5].forEach((freq, i) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.025);
      const g = c.createGain();
      g.gain.setValueAtTime(0.001, now + i * 0.025);
      g.gain.linearRampToValueAtTime(0.14 / (i + 1), now + i * 0.025 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.025 + 0.18);
      osc.connect(g);
      g.connect(this.master!);
      osc.start(now + i * 0.025);
      osc.stop(now + i * 0.025 + 0.2);
    });
  }

  public playHeal(): void {
    if (!this.ready() || !this.ctx || !this.master) return;
    const c = this.ctx;
    const now = c.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.04);
      const g = c.createGain();
      g.gain.setValueAtTime(0.001, now + i * 0.04);
      g.gain.linearRampToValueAtTime(0.09, now + i * 0.04 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.25);
      osc.connect(g);
      g.connect(this.master!);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.26);
    });
  }

  public playHeartbeat(): void {
    if (!this.ready() || !this.ctx || !this.master) return;
    const c = this.ctx;
    const now = c.currentTime;
    [0, 0.18].forEach((off, idx) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 72 : 58, now + off);
      osc.frequency.exponentialRampToValueAtTime(32, now + off + 0.12);
      const g = c.createGain();
      g.gain.setValueAtTime(0.001, now + off);
      g.gain.linearRampToValueAtTime(idx === 0 ? 0.22 : 0.15, now + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + off + 0.14);
      osc.connect(g);
      g.connect(this.master!);
      osc.start(now + off);
      osc.stop(now + off + 0.16);
    });
  }

  public playBossBell(): void {
    if (!this.ready() || !this.ctx || !this.master) return;
    const c = this.ctx;
    const now = c.currentTime;
    [165, 248, 392, 520].forEach((f, i) => {
      const osc = c.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, now);
      const g = c.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.24 / (i + 1), now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.3 - i * 0.2);
      osc.connect(g);
      g.connect(this.master!);
      osc.start(now);
      osc.stop(now + 1.35);
    });
  }

  public playBossSlam(): void {
    if (!this.ready() || !this.ctx || !this.master) return;
    const c = this.ctx;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 0.42);
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.62, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.48);
    this.playHit(true, 'stone');
  }

  public playParry(): void {
    if (!this.ready() || !this.ctx || !this.master || !this.noiseBuf) return;
    const c = this.ctx;
    const now = c.currentTime;
    [1180, 1770, 2640].forEach((freq, i) => {
      const osc = c.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.18, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.96, now + 0.24);
      const g = c.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.26 / (i + 1), now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.25 - i * 0.04);
      osc.connect(g);
      g.connect(this.master!);
      osc.start(now);
      osc.stop(now + 0.27);
    });
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3.0;
    bp.frequency.setValueAtTime(3400, now);
    bp.frequency.exponentialRampToValueAtTime(1400, now + 0.09);
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(0.32, now + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.master);
    src.start(now);
    src.stop(now + 0.11);
  }
}

export const AudioSys = new AudioSystem();
