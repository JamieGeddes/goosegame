export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientNode = null;
    this.radioNodes = null;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
  }

  honk() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Slight random variation each honk
    const duration = 0.38 + Math.random() * 0.12;
    const basePitch = 195 + Math.random() * 30;

    // Build the honk waveform directly into a buffer for organic irregularity
    const sampleRate = this.ctx.sampleRate;
    const len = Math.floor(sampleRate * duration);
    const buf = this.ctx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);

    // Glottal pulse parameters - simulate vocal folds opening/closing
    let phase = 0;
    let driftPhase = Math.random() * Math.PI * 2;

    for (let i = 0; i < len; i++) {
      const time = i / sampleRate;
      const norm = time / duration;

      // Amplitude envelope: quick attack, held, tapers off
      let amp;
      if (norm < 0.04) {
        amp = norm / 0.04;
      } else if (norm < 0.7) {
        amp = 1.0;
      } else {
        amp = 1.0 - ((norm - 0.7) / 0.3);
      }
      // Add amplitude jitter (irregular air pressure)
      amp *= 0.85 + 0.15 * Math.sin(i * 0.0037 + Math.sin(i * 0.00091) * 3);

      // Pitch: rises sharply then settles, with vibrato and drift
      const pitchEnv = norm < 0.06
        ? basePitch + 80 * (norm / 0.06)
        : basePitch + 80 * Math.exp(-(norm - 0.06) * 6);
      // Vibrato - irregular wobble like a real bird
      driftPhase += 0.00003 * Math.sin(i * 0.00017);
      const vibrato = Math.sin(i * 0.0004 + driftPhase) * 8
                     + Math.sin(i * 0.00097) * 4
                     + Math.sin(i * 0.00023) * 3;
      const freq = pitchEnv + vibrato;

      // Advance phase
      phase += (freq / sampleRate) * Math.PI * 2;

      // Glottal waveform: asymmetric pulse (not a simple sine/saw)
      // Models the rapid open/close cycle of vocal folds
      const p = phase % (Math.PI * 2);
      const openPhase = p / (Math.PI * 2);
      let glottal;
      if (openPhase < 0.35) {
        // Opening phase - smooth rise
        glottal = Math.sin(openPhase / 0.35 * Math.PI * 0.5);
      } else if (openPhase < 0.7) {
        // Closing phase - sharper fall
        const cp = (openPhase - 0.35) / 0.35;
        glottal = Math.cos(cp * Math.PI * 0.5) * 0.9;
      } else {
        // Closed phase - near silence with slight leak
        glottal = -0.05 * Math.sin((openPhase - 0.7) / 0.3 * Math.PI);
      }

      // Add harmonic roughness from subharmonics (characteristic of goose honk)
      const sub = 0.2 * Math.sin(phase * 0.5 + Math.sin(phase * 0.25) * 0.4);

      // Breathy noise component, stronger at the start
      const breathAmt = norm < 0.1 ? 0.4 : 0.12 * (1 - norm);
      const breath = (Math.random() * 2 - 1) * breathAmt;

      data[i] = (glottal * 0.7 + sub + breath) * amp * 0.45;
    }

    // Apply nasal formant filtering via biquad chain
    const source = this.ctx.createBufferSource();
    source.buffer = buf;

    // Formant 1 - nasal resonance
    const f1 = this.ctx.createBiquadFilter();
    f1.type = 'peaking';
    f1.frequency.value = 550 + Math.random() * 80;
    f1.gain.value = 10;
    f1.Q.value = 4;

    // Formant 2 - harsh upper resonance
    const f2 = this.ctx.createBiquadFilter();
    f2.type = 'peaking';
    f2.frequency.value = 1400 + Math.random() * 200;
    f2.gain.value = 6;
    f2.Q.value = 3;

    // Formant 3 - high presence / bite
    const f3 = this.ctx.createBiquadFilter();
    f3.type = 'peaking';
    f3.frequency.value = 2800;
    f3.gain.value = 3;
    f3.Q.value = 2;

    // Roll off below the fundamental
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 120;
    hp.Q.value = 0.7;

    // Soft waveshaper for vocal tract non-linearity
    const shaper = this.ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = Math.tanh(x * 1.8) * 0.9 + Math.tanh(x * 4) * 0.1;
    }
    shaper.curve = curve;

    const outGain = this.ctx.createGain();
    outGain.gain.value = 0.9;

    source.connect(hp);
    hp.connect(f1);
    f1.connect(f2);
    f2.connect(f3);
    f3.connect(shaper);
    shaper.connect(outGain);
    outGain.connect(this.masterGain);
    source.start(t);
  }

  footstep() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.06;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  bell() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 800;
    osc2.type = 'sine';
    osc2.frequency.value = 1200;
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.0);
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc2.start();
    osc.stop(this.ctx.currentTime + 1.2);
    osc2.stop(this.ctx.currentTime + 1.2);
  }

  splash() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.3);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  startAmbient() {
    if (!this.ctx || this.ambientNode) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.ambientNode = this.ctx.createBufferSource();
    this.ambientNode.buffer = buffer;
    this.ambientNode.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.02;
    this.ambientNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    this.ambientNode.start();
  }

  thud() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Noise burst through lowpass for muffled body-hitting-ground
    const noiseDuration = 0.2;
    const noiseLen = Math.floor(this.ctx.sampleRate * noiseDuration);
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen);
    }
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuf;
    const noiseLp = this.ctx.createBiquadFilter();
    noiseLp.type = 'lowpass';
    noiseLp.frequency.value = 300;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + noiseDuration);
    noiseSource.connect(noiseLp);
    noiseLp.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseSource.start(t);

    // Low sine tone for bass thump
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 80;
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.3, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  gateCreak() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(120, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  pickup() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  taskComplete() {
    if (!this.ctx) return;
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = this.ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  // === G1: NPC Vocal Reactions ===

  npcAlert(pitchMultiplier = 1.0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(350 * pitchMultiplier, t);
    osc.frequency.linearRampToValueAtTime(550 * pitchMultiplier, t + 0.12);
    osc.frequency.linearRampToValueAtTime(480 * pitchMultiplier, t + 0.2);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.03);
    gain.gain.setValueAtTime(0.12, t + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  npcChase(pitchMultiplier = 1.0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = 0.3;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const n = i / len;
      const env = n < 0.1 ? n / 0.1 : 1 - (n - 0.1) / 0.9;
      data[i] = (Math.random() * 2 - 1) * env * 0.3
                + Math.sin(i * 0.02 * pitchMultiplier) * env * 0.4;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400 * pitchMultiplier;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.1;
    source.connect(lp);
    lp.connect(gain);
    gain.connect(this.masterGain);
    source.start(t);
  }

  npcGiveUp(pitchMultiplier = 1.0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = 0.4;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const n = i / len;
      const env = n < 0.05 ? n / 0.05 : (1 - n) * 0.6;
      const pitch = (300 - n * 150) * pitchMultiplier;
      data[i] = (Math.random() * 2 - 1) * env * 0.5
                + Math.sin(i / this.ctx.sampleRate * pitch * Math.PI * 2) * env * 0.2;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 250 * pitchMultiplier;
    bp.Q.value = 1;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;
    source.connect(bp);
    bp.connect(gain);
    gain.connect(this.masterGain);
    source.start(t);
  }

  npcStartled(pitchMultiplier = 1.0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500 * pitchMultiplier, t);
    osc.frequency.linearRampToValueAtTime(700 * pitchMultiplier, t + 0.06);
    osc.frequency.linearRampToValueAtTime(400 * pitchMultiplier, t + 0.15);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // === C1: Bin knocked over ===

  clatter() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Metallic rattling noise burst
    const dur = 0.4;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const n = i / len;
      const env = Math.exp(-n * 6);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 800;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'peaking';
    bp.frequency.value = 2000;
    bp.gain.value = 8;
    bp.Q.value = 2;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.15;
    source.connect(hp);
    hp.connect(bp);
    bp.connect(gain);
    gain.connect(this.masterGain);
    source.start(t);

    // Metallic ring
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 600;
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.08, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  // === C2: Radio melody ===

  startRadio() {
    if (!this.ctx || this.radioNodes) return;
    // Simple procedural melody loop using oscillators
    const gain = this.ctx.createGain();
    gain.gain.value = 0.06;
    gain.connect(this.masterGain);

    const melody = [262, 294, 330, 349, 330, 294, 262, 247, 262, 294, 330, 294, 262, 262];
    let noteIndex = 0;
    const noteLength = 0.25;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = melody[0];

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;

    osc.connect(filter);
    filter.connect(gain);
    osc.start();

    const interval = setInterval(() => {
      noteIndex = (noteIndex + 1) % melody.length;
      osc.frequency.setValueAtTime(melody[noteIndex], this.ctx.currentTime);
    }, noteLength * 1000);

    this.radioNodes = { osc, gain, filter, interval };
  }

  stopRadio() {
    if (!this.radioNodes) return;
    clearInterval(this.radioNodes.interval);
    this.radioNodes.osc.stop();
    this.radioNodes = null;
  }

  // === F3: Rubber duck squeaky honk ===

  squeakyHonk() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.linearRampToValueAtTime(1200, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.25);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
    gain.gain.setValueAtTime(0.12, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  // === G3: Item-specific pickup sounds ===

  pickupItem(itemName) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    switch (itemName) {
      case 'gardenerHat': {
        // Cloth rustle
        const dur = 0.12;
        const len = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.3;
        const s = this.ctx.createBufferSource(); s.buffer = buf;
        const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 0.5;
        const g = this.ctx.createGain(); g.gain.value = 0.15;
        s.connect(f); f.connect(g); g.connect(this.masterGain); s.start(t);
        break;
      }
      case 'rake': {
        // Metallic scrape
        const dur = 0.15;
        const len = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          const n = i / len;
          d[i] = Math.sin(i * 0.08) * (1 - n) * 0.3 + (Math.random() * 2 - 1) * 0.1 * (1 - n);
        }
        const s = this.ctx.createBufferSource(); s.buffer = buf;
        const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
        const g = this.ctx.createGain(); g.gain.value = 0.12;
        s.connect(hp); hp.connect(g); g.connect(this.masterGain); s.start(t);
        break;
      }
      case 'glasses': {
        // Glass clink
        const osc = this.ctx.createOscillator(); osc.type = 'sine';
        osc.frequency.value = 2000;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.connect(g); g.connect(this.masterGain); osc.start(t); osc.stop(t + 0.2);
        break;
      }
      case 'key': {
        // Key jingle
        const freqs = [1800, 2200, 2600];
        freqs.forEach((freq, i) => {
          const osc = this.ctx.createOscillator(); osc.type = 'sine';
          osc.frequency.value = freq;
          const g = this.ctx.createGain();
          const st = t + i * 0.04;
          g.gain.setValueAtTime(0.06, st); g.gain.exponentialRampToValueAtTime(0.01, st + 0.1);
          osc.connect(g); g.connect(this.masterGain); osc.start(st); osc.stop(st + 0.12);
        });
        break;
      }
      case 'sandwich': {
        // Squish
        const dur = 0.1;
        const len = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / len * 4) * 0.4;
        const s = this.ctx.createBufferSource(); s.buffer = buf;
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
        const g = this.ctx.createGain(); g.gain.value = 0.1;
        s.connect(lp); lp.connect(g); g.connect(this.masterGain); s.start(t);
        break;
      }
      case 'apple': {
        // Pop
        const osc = this.ctx.createOscillator(); osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t); osc.frequency.exponentialRampToValueAtTime(200, t + 0.08);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.connect(g); g.connect(this.masterGain); osc.start(t); osc.stop(t + 0.12);
        break;
      }
      case 'wateringCan': {
        // Water slosh
        const dur = 0.15;
        const len = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / len * 5) * 0.3;
        const s = this.ctx.createBufferSource(); s.buffer = buf;
        const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 1;
        const g = this.ctx.createGain(); g.gain.value = 0.1;
        s.connect(bp); bp.connect(g); g.connect(this.masterGain); s.start(t);
        break;
      }
      case 'radio': {
        // Click
        const osc = this.ctx.createOscillator(); osc.type = 'square';
        osc.frequency.value = 1000;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.03);
        osc.connect(g); g.connect(this.masterGain); osc.start(t); osc.stop(t + 0.05);
        break;
      }
      case 'pumpkin': {
        // Hollow thud
        const osc = this.ctx.createOscillator(); osc.type = 'sine';
        osc.frequency.setValueAtTime(200, t); osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
        osc.connect(g); g.connect(this.masterGain); osc.start(t); osc.stop(t + 0.15);
        break;
      }
      default:
        this.pickup();
    }
  }
}
