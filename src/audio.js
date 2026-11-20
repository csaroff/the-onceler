// All sound is synthesised: birdsong and a warm chord that curdle into wind and a drone as `ruin` rises.
import { lerp, rand } from './world.js';

export function createAudio() {
  let ctx = null, master, padThird, padGain, droneGain, windGain, noiseBuffer;
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

    // A major chord. The third is the note that goes sour.
    padGain = ctx.createGain();
    padGain.gain.value = 0.05;
    padGain.connect(master);
    for (const freq of [220, 277.18, 329.63, 440]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(padGain);
      osc.start();
      if (freq === 277.18) padThird = osc;
    }

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

  function chirp() {
    const osc = ctx.createOscillator(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
    pan.pan.value = rand(-1, 1);
    osc.connect(gain).connect(pan).connect(master);
    let t = ctx.currentTime;
    const base = rand(1800, 3800), notes = Math.floor(rand(2, 6));
    gain.gain.setValueAtTime(0, t);
    for (let i = 0; i < notes; i++) {
      osc.frequency.setValueAtTime(base * rand(0.85, 1.3), t);
      osc.frequency.exponentialRampToValueAtTime(base * rand(0.9, 1.5), t + 0.07);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.015);
      gain.gain.linearRampToValueAtTime(0, t + 0.08);
      t += 0.11;
    }
    osc.start();
    osc.stop(t);
  }

  function noiseHit(freq, seconds, volume) {
    if (!ctx) return;
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    src.connect(filter).connect(gain).connect(master);
    src.start();
    src.stop(ctx.currentTime + seconds);
  }

  function bell(freq, delay, seconds, volume) {
    const osc = ctx.createOscillator(), gain = ctx.createGain(), t = ctx.currentTime + delay;
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + seconds);
  }

  // Cash register: the drawer clunks ("ka"), then the bell ("ching").
  function kaChing(volume = 0.2) {
    if (!ctx) return;
    noiseHit(2600, 0.06, 0.5);
    bell(2093, 0.07, 0.7, volume);
    bell(3136, 0.07, 0.5, volume * 0.7);
    bell(4186, 0.09, 0.4, volume * 0.4);
  }

  function update(dt, ruin) {
    if (!ctx) return;
    padThird.frequency.value = lerp(277.18, 255, ruin); // major -> flat of minor
    padGain.gain.value = lerp(0.05, 0.02, ruin);
    droneGain.gain.value = ruin * 0.5;
    windGain.gain.value = ruin * 0.25;

    chirpTimer -= dt;
    if (chirpTimer <= 0) {
      const quiet = 1 - ruin * 1.25; // the birds are gone well before the trees are
      if (quiet > 0) chirp();
      chirpTimer = rand(0.15, 0.7) / Math.max(0.05, quiet * quiet);
    }
  }

  return {
    start, update,
    chop: () => noiseHit(900, 0.12, 0.8),
    crash: () => noiseHit(220, 0.9, 0.9),
    kaChing,
    // Spending is a heavier drawer and a bigger bell.
    purchase() { noiseHit(500, 0.25, 0.9); kaChing(0.3); if (ctx) bell(1046, 0.2, 1.2, 0.2); },
  };
}
