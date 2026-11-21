// All sound is synthesised with WebAudio: no audio files, no network.
// Every call is guarded, so a browser without audio (or a headless run)
// never breaks the game.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicOn = true;
  let step = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.14;
      musicGain.connect(master);
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineOsc.connect(engineGain);
      engineOsc.start();
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenGain.connect(master);
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenOsc.connect(sirenGain);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + dur + 0.02);
    } catch {
      // Audio is decoration; never let it stop the game.
    }
  }

  function noise(dur, vol, low) {
    if (!ensure()) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = low || 1200;
      const g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start();
    } catch {
      // Ignore audio errors.
    }
  }

  // A lazy bass-and-hats groove: eight steps a bar, root notes of a
  // warm minor progression, scheduled a bar at a time.
  const BASS = [55, 55, 65.41, 49];
  function scheduleMusic() {
    if (!ctx || !musicOn) return;
    const barLen = 1.9;
    const start = ctx.currentTime + 0.05;
    for (let s = 0; s < 8; s += 1) {
      const t = start + (s / 8) * barLen;
      const root = BASS[Math.floor(step / 8) % BASS.length];
      if (s % 2 === 0) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = root * (s === 6 ? 1.5 : 1);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.connect(g);
        g.connect(musicGain);
        o.start(t);
        o.stop(t + 0.25);
      }
      if (s % 2 === 1) {
        const len = Math.floor(ctx.sampleRate * 0.03);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 6000;
        const g = ctx.createGain();
        g.gain.value = 0.25;
        src.connect(f);
        f.connect(g);
        g.connect(musicGain);
        src.start(t);
      }
    }
    step += 8;
    musicTimer = window.setTimeout(scheduleMusic, barLen * 1000);
  }

  return {
    resume,
    unlock() {
      resume();
      if (!musicTimer) scheduleMusic();
    },
    toggleMusic() {
      musicOn = !musicOn;
      if (musicGain) musicGain.gain.value = musicOn ? 0.14 : 0;
      return musicOn;
    },
    shot() { noise(0.12, 0.35, 3000); blip(180, 0.08, 'square', 0.15, 60); },
    punch() { noise(0.08, 0.3, 500); },
    pickup() { blip(660, 0.09, 'sine', 0.25); blip(990, 0.12, 'sine', 0.22); },
    cash() { blip(880, 0.08, 'sine', 0.22); blip(1320, 0.14, 'sine', 0.2); },
    crash() { noise(0.25, 0.4, 400); },
    click() { blip(520, 0.05, 'square', 0.12); },
    denied() { blip(160, 0.15, 'square', 0.18, 110); },
    jingle() {
      [523, 659, 784, 1047].forEach((f, i) => {
        window.setTimeout(() => blip(f, 0.16, 'triangle', 0.25), i * 110);
      });
    },
    fail() {
      [392, 330, 262].forEach((f, i) => {
        window.setTimeout(() => blip(f, 0.2, 'sawtooth', 0.16), i * 140);
      });
    },
    /** Engine hum follows speed 0..1; call every frame while driving. */
    engine(speed01, on) {
      if (!ensure()) return;
      try {
        engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
      } catch {
        // Ignore.
      }
    },
    /** Siren loudness follows the nearest police distance, 0..1. */
    siren(near01) {
      if (!ensure()) return;
      try {
        sirenGain.gain.setTargetAtTime(near01 * 0.05, ctx.currentTime, 0.2);
        const t = ctx.currentTime;
        sirenOsc.frequency.setValueAtTime(700, t);
        sirenOsc.frequency.linearRampToValueAtTime(950, t + 0.4);
        sirenOsc.frequency.linearRampToValueAtTime(700, t + 0.8);
      } catch {
        // Ignore.
      }
    },
  };
}
