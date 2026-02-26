export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientNode = null;
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
}
