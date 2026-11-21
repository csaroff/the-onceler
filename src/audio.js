// All sound is synthesised: birdsong and a waltz (music.js) that give way to wind and a drone as `ruin` rises.
import { lerp, rand } from './terrain.js';
import { createMusic } from './music.js';

export function createAudio() {
  let ctx = null, master, music, droneGain, windGain, noiseBuffer;
  let chirpTimer = 1;

  function start() {
    if (ctx) return;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    music = createMusic(ctx, master);

    droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 180;
    droneFilter.connect(droneGain).connect(master);
    for (const freq of [55, 58.3]) { // a semitone apart, so it beats
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.connect(droneFilter);
      osc.start();
    }
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 400;
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;
    wind.connect(windFilter).connect(windGain).connect(master);
    wind.start();
  }

  // A burst of filtered hiss: thuds, chops, splats.
  function noise(freq, seconds, volume, pan = 0) {
    if (!ctx) return;
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain(), panner = ctx.createStereoPanner();
    src.buffer = noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    panner.pan.value = pan;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    src.connect(filter).connect(gain).connect(panner).connect(master);
    src.start();
    src.stop(ctx.currentTime + seconds);
  }
  // A single pitched note, optionally sliding to another pitch.
  function tone(freq, delay, seconds, volume, { type = 'triangle', to = freq, pan = 0 } = {}) {
    if (!ctx) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain(), panner = ctx.createStereoPanner(), t = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + seconds);
    panner.pan.value = pan;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain).connect(panner).connect(master);
    osc.start(t);
    osc.stop(t + seconds + 0.05);
  }

  function chirp() {
    const base = rand(1800, 3800), notes = Math.floor(rand(2, 6)), pan = rand(-1, 1);
    for (let i = 0; i < notes; i++) tone(base * rand(0.85, 1.3), i * 0.11, 0.08, 0.05, { type: 'sine', to: base * rand(0.9, 1.5), pan });
  }

  // Cash register: the drawer clunks ("ka"), then the bell ("ching").
  function kaChing(volume = 0.2) {
    noise(2600, 0.06, 0.5);
    tone(2093, 0.07, 0.7, volume);
    tone(3136, 0.07, 0.5, volume * 0.7);
    tone(4186, 0.09, 0.4, volume * 0.4);
  }

  function update(dt, ruin, birds = 1, mood = 'calm') {
    if (!ctx) return;
    music.update(ruin, mood);
    droneGain.gain.value = ruin * 0.45;
    windGain.gain.value = ruin * 0.22;
    chirpTimer -= dt;
    if (chirpTimer <= 0) {
      const lively = birds * (1 - ruin * 1.2);
      if (lively > 0.02) chirp();
      chirpTimer = rand(0.2, 0.8) / Math.max(0.05, lively * lively);
    }
  }

  return {
    start, update, kaChing,
    toggleMusic: () => music?.toggle(),
    chop: () => noise(900, 0.12, 0.8),
    crash: () => noise(220, 0.9, 0.9),
    purchase() { noise(500, 0.25, 0.9); kaChing(0.3); tone(1046, 0.2, 1.2, 0.2); },
    knit: () => tone(rand(1500, 1900), 0, 0.04, 0.08, { type: 'square' }),
    pickup: () => tone(520, 0, 0.12, 0.12, { to: 880, type: 'sine' }),
    drop: () => tone(440, 0, 0.14, 0.1, { to: 260, type: 'sine' }),
    whoosh: () => noise(600, 0.18, 0.3),
    sling: () => tone(300, 0, 0.18, 0.2, { to: 900, type: 'sawtooth' }),
    hit: () => { noise(350, 0.12, 0.9); tone(180, 0, 0.12, 0.2, { to: 90 }); },
    splat: () => noise(700, 0.25, 0.5),
    hurt: () => { noise(200, 0.25, 1); tone(220, 0, 0.3, 0.3, { to: 110, type: 'sawtooth' }); },
    squeal: (pan = 0) => tone(rand(500, 800), 0, 0.3, 0.12, { to: 200, type: 'sawtooth', pan }),
    roar: () => { tone(110, 0, 1.2, 0.5, { to: 55, type: 'sawtooth' }); noise(150, 1.2, 0.8); },
    cheer: () => { tone(660, 0, 0.12, 0.12); tone(880, 0.1, 0.2, 0.12); },
    pop: () => tone(300, 0, 0.3, 0.3, { to: 1200, type: 'sine' }),
    // The sound of being noticed. Two low horn notes from wherever he is standing. Learn it.
    omen(pan = 0) {
      for (const [freq, delay] of [[98, 0], [92.5, 0.9]]) {
        tone(freq, delay, 1.6, 0.5, { type: 'sawtooth', pan });
        tone(freq * 2, delay, 1.6, 0.18, { type: 'triangle', pan });
      }
    },
    // The order to attack: the same horn, falling.
    signal: (pan = 0) => tone(196, 0, 1.3, 0.4, { type: 'sawtooth', to: 73, pan }),
    fanfare() { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.14, 0.5, 0.2)); },
    dirge() { [220, 208, 196, 165].forEach((f, i) => tone(f, i * 0.7, 1.4, 0.25, { type: 'sine' })); },
  };
}
