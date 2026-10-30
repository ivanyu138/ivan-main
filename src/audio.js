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

  // A cat meow: a sawtooth that rises then falls, through a moving 'vowel' filter.
  meow(f, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), bp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 0.9, t);
    o.frequency.linearRampToValueAtTime(f * 1.35, t + 0.13);
    o.frequency.linearRampToValueAtTime(f * 0.72, t + 0.5);
    bp.type = 'bandpass';
    bp.Q.value = 3;
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.linearRampToValueAtTime(2000, t + 0.15);
    bp.frequency.linearRampToValueAtTime(700, t + 0.5);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.05);
    g.gain.linearRampToValueAtTime(0.35, t + 0.32);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    o.connect(bp).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.6);
  }

  // A meow through a mouthful: lower, shorter and muffled.
  mmrf(f) {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 0.7, t);
    o.frequency.linearRampToValueAtTime(f * 0.85, t + 0.1);
    o.frequency.linearRampToValueAtTime(f * 0.6, t + 0.3);
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.linearRampToValueAtTime(750, t + 0.1);
    lp.frequency.linearRampToValueAtTime(380, t + 0.3);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.6, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.4);
  }

  hiss(dur = 0.8, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay, n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf;
    hp.type = 'highpass';
    hp.frequency.value = 2600;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.45, t + 0.06);
    g.gain.linearRampToValueAtTime(0.3, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(hp).connect(g).connect(this.master);
    s.start(t);
  }

  play(name, arg) {
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
      case 'meow': this.meow(arg || 650); break;
      case 'mmrf': this.mmrf(arg || 650); break;
      case 'meowback': this.meow(arg || 950, 0.6); break;
      case 'hiss': this.hiss(0.8); break;
      case 'scratch': for (let i = 0; i < 3; i++) this.hiss(0.05, i * 0.045); break;
      case 'bark': this.noise(0.09, 0.5, 900); this.tone(260, 0.1, 'sawtooth', 0.2, -90); this.noise(0.08, 0.4, 900); this.tone(240, 0.09, 'sawtooth', 0.18, -80, 0.16); break;
      case 'squeak': this.tone(2400, 0.07, 'sine', 0.12, 600); this.tone(2600, 0.06, 'sine', 0.1, 500, 0.09); break;
      case 'flap': for (let i = 0; i < 4; i++) this.hiss(0.04, i * 0.06); break;
      case 'yowl': this.meow((arg || 600) * 0.7); this.hiss(0.5, 0.15); break;
      case 'ragtime': [523, 659, 784, 659, 880, 784, 659, 523, 587, 698, 880, 698, 784, 659, 523, 392].forEach((f, i) => { this.tone(f, 0.13, 'triangle', 0.16, 0, i * 0.14); if (i % 2 === 0) this.tone(f / 4, 0.12, 'triangle', 0.12, 0, i * 0.14); }); break;
      case 'spray': this.noise(0.16, 0.1, 5000); break;
      case 'splash': this.noise(0.12, 0.16, 1600); this.tone(900, 0.06, 'sine', 0.06, -500); break;
      case 'pump': this.noise(0.07, 0.25, 900); this.tone(300, 0.08, 'triangle', 0.15, 200, 0.08); break;
      case 'pick': this.tone(520, 0.06, 'triangle', 0.18, 260); break;
      case 'drop': this.tone(420, 0.07, 'triangle', 0.15, -180); break;
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
