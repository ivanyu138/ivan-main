// Tiny synthesized sound effects; no audio files needed.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.engine = null;
    this.muted = false;
  }

  unlock() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.3, freq = 1200) {
    const c = this.ctx, n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf;
    f.type = 'lowpass';
    f.frequency.value = freq;
    g.gain.value = vol;
    s.connect(f).connect(g).connect(this.master);
    s.start();
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'swing': this.noise(0.08, 0.12, 2500); break;
      case 'punch': this.noise(0.12, 0.5, 700); this.tone(90, 0.1, 'sine', 0.4, -40); break;
      case 'coin': this.tone(988, 0.07, 'square', 0.15); this.tone(1319, 0.15, 'square', 0.15, 0, 0.07); break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'square', 0.14, 0, i * 0.08)); break;
      case 'quest': this.tone(660, 0.1, 'triangle', 0.25); this.tone(880, 0.2, 'triangle', 0.25, 0, 0.1); break;
      case 'fail': this.tone(300, 0.25, 'sawtooth', 0.15, -150); break;
      case 'use': this.tone(500, 0.08, 'sine', 0.25, 300); break;
      case 'horn': this.tone(370, 0.35, 'square', 0.12); this.tone(466, 0.35, 'square', 0.1); break;
      case 'crash': this.noise(0.35, 0.6, 500); break;
      case 'door': this.tone(220, 0.08, 'square', 0.15); this.tone(160, 0.1, 'square', 0.15, 0, 0.08); break;
      case 'meow': this.tone(700, 0.35, 'sine', 0.2, 300); break;
      case 'buy': this.tone(1200, 0.05, 'square', 0.12); this.tone(1600, 0.1, 'square', 0.12, 0, 0.05); break;
      case 'deny': this.tone(140, 0.18, 'square', 0.15); break;
    }
  }

  setEngine(on, speed) {
    if (!this.ctx) return;
    if (!this.engine) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
      o.type = 'sawtooth';
      f.type = 'lowpass';
      f.frequency.value = 400;
      g.gain.value = 0;
      o.connect(f).connect(g).connect(this.master);
      o.start();
      this.engine = { o, g };
    }
    const t = this.ctx.currentTime;
    this.engine.g.gain.setTargetAtTime(on && !this.muted ? 0.09 : 0, t, 0.1);
    this.engine.o.frequency.setTargetAtTime(45 + Math.abs(speed) * 4.5, t, 0.1);
  }
}
