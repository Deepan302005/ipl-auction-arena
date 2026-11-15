// Web Audio API Synthesizer for IPL Auction Arena
// Generates authentic acoustic gavel knocks, bid chimes, and timer pings without external MP3 files

let audioCtx = null;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

export const playSound = (type = 'bid', muted = false) => {
  if (muted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'bid') {
      // Crisp metallic chime for a newly placed bid
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12); // A5
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'sold') {
      // Authoritative wooden gavel strike followed by celebration chime
      // 1. Gavel thud (low frequency punch)
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = 'sine';
      thudOsc.frequency.setValueAtTime(140, now);
      thudOsc.frequency.exponentialRampToValueAtTime(35, now + 0.18);
      thudGain.gain.setValueAtTime(0.6, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      thudOsc.connect(thudGain);
      thudGain.connect(ctx.destination);
      thudOsc.start(now);
      thudOsc.stop(now + 0.25);

      // 2. Resonant wooden knock click
      const knockOsc = ctx.createOscillator();
      const knockGain = ctx.createGain();
      knockOsc.type = 'triangle';
      knockOsc.frequency.setValueAtTime(420, now);
      knockOsc.frequency.exponentialRampToValueAtTime(120, now + 0.1);
      knockGain.gain.setValueAtTime(0.4, now);
      knockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      knockOsc.connect(knockGain);
      knockGain.connect(ctx.destination);
      knockOsc.start(now);
      knockOsc.stop(now + 0.15);

      // 3. Victorious celebration chord at +0.2s
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const chordOsc = ctx.createOscillator();
        const chordGain = ctx.createGain();
        chordOsc.type = 'sine';
        chordOsc.frequency.setValueAtTime(freq, now + 0.2 + i * 0.04);
        chordGain.gain.setValueAtTime(0.18, now + 0.2 + i * 0.04);
        chordGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75 + i * 0.04);
        chordOsc.connect(chordGain);
        chordGain.connect(ctx.destination);
        chordOsc.start(now + 0.2 + i * 0.04);
        chordOsc.stop(now + 0.75 + i * 0.04);
      });
    } else if (type === 'unsold') {
      // Descending muted tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.4);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === 'tick') {
      // Subtle urgent countdown tick
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (err) {
    // Audio Context might be blocked until user gesture, safely ignore
  }
};
