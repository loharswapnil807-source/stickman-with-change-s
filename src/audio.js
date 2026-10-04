// All audio is synthesized locally. No samples, downloads, or audio permissions.
export class Audio {
  constructor() { this.context = null; this.volume = .45; this.enabled = true; }
  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.context.createGain(); this.master.gain.value = this.volume * .3; this.master.connect(this.context.destination);
        this.noise = this.context.createBuffer(1, this.context.sampleRate * .35, this.context.sampleRate);
        const samples = this.noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    } catch { this.enabled = false; }
  }
  setVolume(value) { this.volume = value; if (this.master) this.master.gain.value = value * .3; }
  tone(freq, duration = .08, type = 'sine', volume = .2, end = freq, delay = 0) {
    if (!this.context || !this.enabled || !this.volume) return;
    const now = this.context.currentTime + delay, osc = this.context.createOscillator(), gain = this.context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, now); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(now); osc.stop(now + duration + .02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  hiss(duration = .12, volume = .4, cutoff = 2000) {
    if (!this.context || !this.enabled || !this.volume) return;
    const now = this.context.currentTime, source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), gain = this.context.createGain();
    source.buffer = this.noise; filter.type = 'lowpass'; filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(now); source.stop(now + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  play(event) {
    if (event.type === 'letter') this.tone(440 + event.progress * 80, .035, 'triangle', .1, 220);
    if (event.type === 'select') this.tone(650, .05, 'sine', .14, 900);
    if (event.type === 'typo' || event.type === 'invalid') this.tone(125, .085, 'triangle', .18, 80);
    if (event.type === 'hit') {
      const heavy = ['slam', 'heavy'].includes(event.move);
      this.hiss(heavy ? .2 : .10, heavy ? .9 : .6, heavy ? 1300 : 2800);
      this.tone(heavy ? 120 : 210, heavy ? .23 : .12, 'sine', .8, 38);
      if (event.air) this.tone(720, .11, 'triangle', .12, 300);
    }
    if (event.type === 'dodge') { this.hiss(.16, .15, 4000); this.tone(420, .15, 'sine', .12, 110); }
    if (event.type === 'block') { this.hiss(.06, .3, 5400); this.tone(880, .13, 'triangle', .3, 560); }
    if (event.type === 'hurt') { this.hiss(.19, .65, 1500); this.tone(85, .24, 'sawtooth', .17, 36); }
    if (event.type === 'land') { this.hiss(.22, .6, 800); this.tone(70, .3, 'sine', .8, 25); }
    if (event.type === 'warning') this.tone(680, .10, 'sine', .13, 570);
    if (['wave', 'clear', 'lesson', 'finish'].includes(event.type)) [262, 330, 392, 523].forEach((f, i) => this.tone(f, .18, 'triangle', .14, f, i * .09));
  }
}
