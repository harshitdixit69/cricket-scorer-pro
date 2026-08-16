/**
 * Web Audio API Sound Synthesizer for Cricket Scorer
 * Zero external audio assets required — pure synthesized audio.
 */

class CricketAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('cric_sound_enabled') !== 'false';
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('cric_sound_enabled', String(this.enabled));
    if (this.enabled) {
      this.playDot();
    }
    return this.enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  // ── Dot Ball: Crisp wooden bat knock ─────────────────────────────
  playDot() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.08);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.08);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // ── Normal Runs: Ascending double chime ──────────────────────────
  playRun(runs = 1) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const notes = runs >= 3 ? [523.25, 659.25, 783.99] : [523.25, 659.25];

      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteTime = t + i * 0.07;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.25, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.15);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // ── Boundary FOUR: Energetic boundary horn & chords ──────────────
  playFour() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const chord = [523.25, 659.25, 783.99, 1046.50];

      chord.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteTime = t + i * 0.08;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.2, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.35);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // ── Maximum SIX: Stadium crowd surge & massive blast ──────────────
  playSix() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;

      // Sub-bass thump
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(150, t);
      subOsc.frequency.exponentialRampToValueAtTime(40, t + 0.5);
      subGain.gain.setValueAtTime(0.5, t);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start(t);
      subOsc.stop(t + 0.5);

      // Hero fanfare chords
      const fanfare = [392.00, 523.25, 659.25, 783.99, 1046.50, 1318.51];
      fanfare.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteTime = t + idx * 0.06;

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.18, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.45);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // ── Wicket: Dramatic appeal & drop whistle ────────────────────────
  playWicket() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, t);
      osc.frequency.exponentialRampToValueAtTime(220, t + 0.4);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.45);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // ── Wide / No-Ball Buzzer ─────────────────────────────────────────
  playBuzzer() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.setValueAtTime(230, t + 0.1);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.25);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // ── Milestone Celebration (50 / 100 / Match Win) ──────────────────
  playMilestone() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const notes = [
        { f: 523.25, d: 0.15 },
        { f: 523.25, d: 0.15 },
        { f: 523.25, d: 0.15 },
        { f: 659.25, d: 0.35 },
        { f: 783.99, d: 0.45 },
        { f: 1046.50, d: 0.70 }
      ];

      let cursor = t;
      notes.forEach(n => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.f, cursor);

        gain.gain.setValueAtTime(0.3, cursor);
        gain.gain.exponentialRampToValueAtTime(0.001, cursor + n.d);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(cursor);
        osc.stop(cursor + n.d);

        cursor += n.d * 0.75;
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }
}

export const sound = new CricketAudioEngine();
