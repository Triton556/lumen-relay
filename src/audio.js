const AMBIENT_CHORDS = [
  [130.81, 196, 261.63, 329.63],
  [146.83, 220, 293.66, 349.23],
  [110, 164.81, 220, 277.18],
  [130.81, 196, 261.63, 392],
  [146.83, 196, 293.66, 392],
  [130.81, 196, 329.63, 523.25],
];
export class Sound {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.master = null;
    this.ambient = null;
    this.voices = [];
    this.biome = 0;
  }
  async unlock() {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        this.ctx = new Audio();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.16;
        this.master.connect(this.ctx.destination);
        this.ambient = this.ctx.createGain();
        this.ambient.gain.value = 0.12;
        this.ambient.connect(this.master);
        for (const f of this.chord()) {
          const o = this.ctx.createOscillator(),
            g = this.ctx.createGain();
          o.type = 'sine';
          o.frequency.value = f;
          g.gain.value = 0.12;
          o.connect(g);
          g.connect(this.ambient);
          o.start();
          this.voices.push(o);
        }
      }
      await this.ctx.resume();
    } catch {}
  }
  chord() {
    return AMBIENT_CHORDS[this.biome];
  }
  setBiome(index) {
    this.biome = Math.max(0, Math.min(AMBIENT_CHORDS.length - 1, index));
    if (this.ctx)
      this.voices.forEach((o, i) =>
        o.frequency.setTargetAtTime(this.chord()[i], this.ctx.currentTime, 1.5),
      );
  }
  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.15);
  }
  suspend() {
    if (this.ctx) this.ctx.suspend().catch(() => {});
  }
  tone(freq, time = 0.3, delay = 0, type = 'sine', vol = 0.6) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime + delay,
      o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + time);
    o.connect(g);
    g.connect(this.master);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
    o.start(now);
    o.stop(now + time + 0.02);
  }
  play(event) {
    const notes = {
      pickup: [523.25, 783.99],
      chime: [523.25, 659.25],
      duet: [523.25, 659.25, 783.99, 1046.5],
      bloom: [659.25, 880, 1318.51],
      relay: [261.63, 392, 523.25, 783.99],
      wisp: [880, 1174.66],
      rotate: [392],
      aligned: [392, 587.33, 783.99],
      dash: [196, 293.66],
      hurt: [146.83, 110],
      recall: [329.63, 261.63],
      complete: [261.63, 329.63, 392, 523.25, 659.25, 783.99],
    };
    (notes[event] || []).forEach((f, i) =>
      this.tone(
        f * [1, 1.12246, 0.8409, 1.4983, 1.12246, 1][this.biome],
        event === 'complete' ? 1 : 0.45,
        i * (event === 'complete' ? 0.14 : 0.07),
        'sine',
        event === 'dash' ? 0.18 : 0.55,
      ),
    );
  }
}
