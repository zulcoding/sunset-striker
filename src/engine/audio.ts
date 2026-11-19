import type { SimulationEvent } from '../game/types';

export class RetroFlightAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOscA: OscillatorNode | null = null;
  private engineOscB: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private active = false;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.36;
    this.masterGain.connect(this.ctx.destination);

    // Pre-bake 1.5s white noise buffer for explosions, rockets, and cannon punch
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.floor(sr * 1.5), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;

    // Continuous twin-turbine hum (muted until playing)
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;

    this.engineOscA = this.ctx.createOscillator();
    this.engineOscA.type = 'sawtooth';
    this.engineOscA.frequency.value = 68;

    this.engineOscB = this.ctx.createOscillator();
    this.engineOscB.type = 'triangle';
    this.engineOscB.frequency.value = 102;

    this.engineOscA.connect(filter);
    this.engineOscB.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOscA.start();
    this.engineOscB.start();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.36, this.ctx.currentTime, 0.04);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  updateEngine(playing: boolean, throttle: number, speedNorm: number): void {
    this.active = playing;
    if (!this.ctx || !this.engineGain || !this.engineOscA || !this.engineOscB) return;
    const now = this.ctx.currentTime;
    const targetGain = playing && !this.muted ? 0.08 + throttle * 0.07 : 0;
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.08);
    this.engineOscA.frequency.setTargetAtTime(58 + throttle * 46 + speedNorm * 18, now, 0.08);
    this.engineOscB.frequency.setTargetAtTime(88 + throttle * 74 + speedNorm * 24, now, 0.08);
  }

  playEvents(events: readonly SimulationEvent[]): void {
    if (!this.ctx || !this.masterGain || this.muted || !this.active) return;
    for (let i = 0; i < events.length; i++) {
      this.playEvent(events[i]);
    }
  }

  private playEvent(ev: SimulationEvent): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const pitchJitter = 0.92 + Math.random() * 0.16;

    switch (ev.type) {
      case 'cannon': {
        // Punchy 30mm GAU-8 rotary burst click + low thump
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(165 * pitchJitter, now);
        osc.frequency.exponentialRampToValueAtTime(48, now + 0.065);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.075);
        break;
      }
      case 'rocket': {
        this.playNoiseBurst(0.28, 1200, 320, 0.24);
        break;
      }
      case 'flare': {
        this.playNoiseBurst(0.14, 2800, 900, 0.16);
        this.playTone('triangle', 880 * pitchJitter, 420, 0.11, 0.14);
        break;
      }
      case 'afterburner': {
        this.playNoiseBurst(0.35, 1600, 480, 0.22);
        this.playTone('sawtooth', 140, 290, 0.22, 0.14);
        break;
      }
      case 'pickup': {
        this.playTone('square', 587, 587, 0.08, 0.13, 0);
        this.playTone('square', 880, 880, 0.12, 0.14, 0.08);
        break;
      }
      case 'sam_lock': {
        // High-priority rising radar lock telegraph
        this.playTone('square', 920, 1260, 0.16, 0.15);
        break;
      }
      case 'sam_launch': {
        this.playNoiseBurst(0.32, 900, 260, 0.18);
        break;
      }
      case 'hit_enemy': {
        this.playTone('triangle', 680 * pitchJitter, 980, 0.07, 0.16);
        break;
      }
      case 'kill_enemy':
      case 'explosion_big': {
        this.playNoiseBurst(0.52, 520, 90, 0.34);
        this.playTone('sawtooth', 120 * pitchJitter, 34, 0.36, 0.24);
        break;
      }
      case 'player_hit': {
        this.playNoiseBurst(0.38, 640, 110, 0.38);
        this.playTone('sawtooth', 190, 58, 0.26, 0.28);
        break;
      }
      case 'wave_clear':
      case 'victory': {
        const notes = ev.type === 'victory' ? [440, 554, 659, 880] : [440, 554, 659];
        notes.forEach((freq, idx) => {
          this.playTone('square', freq, freq, 0.14, 0.14, idx * 0.11);
        });
        break;
      }
      case 'defeat': {
        this.playNoiseBurst(0.8, 420, 60, 0.42);
        this.playTone('sawtooth', 220, 62, 0.65, 0.26);
        break;
      }
    }
  }

  private playTone(
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    duration: number,
    volume: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, t0);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
    }
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.01);
  }

  private playNoiseBurst(
    duration: number,
    startCutoff: number,
    endCutoff: number,
    volume: number,
  ): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(startCutoff, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, endCutoff), now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  dispose(): void {
    if (this.engineOscA) {
      try {
        this.engineOscA.stop();
      } catch {
        // ignore
      }
    }
    if (this.engineOscB) {
      try {
        this.engineOscB.stop();
      } catch {
        // ignore
      }
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
