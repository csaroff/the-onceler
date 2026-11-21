// The background music: a small waltz for music box, plucked strings and tuba, written out below note by note.
// It sours with the valley: the key slides from major to minor, it slows, drifts out of tune and drops notes.
const lerp = (a, b, t) => a + (b - a) * t;

const MAJOR = [0, 2, 4, 5, 7, 9, 11]; // semitones above the home note for each step of the scale
// One chord per bar, named by the scale step it is built on (0 is the home chord).
const CHORDS = [0, 5, 3, 4, 0, 5, 3, 4, 3, 0, 1, 4, 3, 0, 4, 0];
// The tune, bar by bar. Each note is [beat in the bar, scale step, length in beats].
// Step 0 is the home note, 7 is the same note an octave up, -1 is the note just below home.
const TUNE = [
  [[0, 4, 1], [1, 2, 1], [2, 4, 1]],
  [[0, 5, 2], [2, 4, 1]],
  [[0, 3, 1], [1, 5, 0.5], [1.5, 6, 0.5], [2, 7, 1]],
  [[0, 6, 2], [2, 4, 1]],
  [[0, 7, 1], [1, 4, 1], [2, 2, 1]],
  [[0, 5, 1], [1, 2, 1], [2, 0, 1]],
  [[0, 3, 1], [1, 1, 0.5], [1.5, 2, 0.5], [2, 3, 1]],
  [[0, 4, 3]],
  [[0, 5, 1], [1, 7, 1], [2, 5, 1]],
  [[0, 4, 2], [2, 2, 1]],
  [[0, 3, 1], [1, 5, 1], [2, 3, 1]],
  [[0, 8, 2], [2, 6, 1]],
  [[0, 7, 1], [1, 5, 0.5], [1.5, 4, 0.5], [2, 3, 1]],
  [[0, 4, 1], [1, 2, 1], [2, 0, 1]],
  [[0, 1, 1], [1, -1, 1], [2, 1, 1]],
  [[0, 0, 3]],
];

// The scale goes sour one note at a time: first the third, then the sixth, then the seventh.
function scaleFor(sourness) {
  const scale = [...MAJOR];
  if (sourness > 0.35) scale[2] = 3;
  if (sourness > 0.55) scale[5] = 8;
  if (sourness > 0.75) scale[6] = 10;
  return scale;
}
// The pitch of a scale step, with the home note at A above middle C.
const pitch = (step, scale) => 440 * 2 ** ((scale[((step % 7) + 7) % 7] + 12 * Math.floor(step / 7)) / 12);

// Moods: 'calm', 'quiet' (cutscenes), 'watched' (the Lorax is showing himself: silence), 'fight', 'hope' (after the ending).
const LOUDNESS = { calm: 1, quiet: 0.5, watched: 0, fight: 1, hope: 0.8 };

export function createMusic(ctx, destination) {
  const out = ctx.createGain(), filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 6000;
  filter.connect(out).connect(destination);
  let bar = 0, beat = 0, nextBeat = 0.1, notes = 0, muted = false;

  // One note: a quick attack, then it dies away.
  function note(freq, at, seconds, volume, { type = 'sine', slideTo } = {}) {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + seconds);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    osc.connect(gain).connect(filter);
    osc.start(at);
    osc.stop(at + seconds + 0.05);
    notes++;
  }

  function playBeat(at, beatSeconds, wear, mood) {
    const scale = scaleFor(mood === 'fight' ? 1 : wear), chord = CHORDS[bar];
    const drift = () => 2 ** ((Math.random() - 0.5) * wear * 0.5 / 12); // out of tune by up to a quarter of a semitone
    // Oom: the tuba on the first beat. Pah, pah: plucked strings on the other two.
    if (beat === 0) note(pitch(chord, scale) / 4 * drift(), at, beatSeconds * 1.6, 0.16, { type: 'triangle' });
    else for (const step of [chord + 2, chord + 4]) note(pitch(step, scale) / 2 * drift(), at, beatSeconds * 0.5, 0.045, { type: 'triangle' });
    // The tune, on a music box: the note itself and a short, bright overtone. A worn-out valley drops notes.
    const dropped = mood === 'fight' ? 0 : Math.max(0, wear - 0.45) * 1.1;
    for (const [when, step, length] of TUNE[bar]) {
      if (Math.floor(when) !== beat || Math.random() < dropped) continue;
      const start = at + (when - beat) * beatSeconds, freq = pitch(step, scale) * drift();
      note(freq, start, Math.max(0.7, length * beatSeconds * 1.4), 0.11);
      note(freq * 3, start, 0.25, 0.03);
    }
    // In a fight a drum joins in: a thump on the first beat and a tap on the others.
    if (mood === 'fight') {
      if (beat === 0) note(110, at, 0.18, 0.2, { slideTo: 50 });
      else note(220, at, 0.06, 0.06, { slideTo: 160 });
    }
  }

  // Write the music out as far ahead as `until` (in the audio clock's seconds).
  function schedule(until, ruin, mood = 'calm') {
    const now = ctx.currentTime, wear = mood === 'hope' ? 0 : ruin;
    out.gain.setTargetAtTime(muted ? 0 : LOUDNESS[mood] * lerp(1, 0.75, wear), now, 0.4);
    filter.frequency.setTargetAtTime(lerp(6000, 1100, wear), now, 0.5); // a ruined valley sounds muffled
    const beatSeconds = 60 / (mood === 'fight' ? 132 : mood === 'hope' ? 80 : lerp(108, 66, wear));
    if (nextBeat < now - 0.5) nextBeat = now + 0.05; // back from a pause: pick up from here, not from where we stopped
    while (nextBeat < until) {
      playBeat(nextBeat, beatSeconds, wear, mood);
      nextBeat += beatSeconds;
      beat = (beat + 1) % 3;
      if (beat === 0) bar = (bar + 1) % TUNE.length;
    }
  }

  return {
    schedule,
    // Called every frame: keeps a third of a second of music written ahead.
    update: (ruin, mood) => schedule(ctx.currentTime + 0.3, ruin, mood),
    toggle() { muted = !muted; return !muted; },
    notes: () => notes,
  };
}

// Plays the music into memory instead of the speakers and measures it. Used by tests/music.mjs.
export async function renderMusic(seconds, ruin, mood) {
  const ctx = new OfflineAudioContext(1, 44100 * seconds, 44100);
  const music = createMusic(ctx, ctx.destination);
  music.schedule(seconds, ruin, mood);
  const samples = (await ctx.startRendering()).getChannelData(0);
  let peak = 0, sum = 0;
  for (let i = 0; i < samples.length; i++) { peak = Math.max(peak, Math.abs(samples[i])); sum += samples[i] * samples[i]; }
  return { peak, loudness: Math.sqrt(sum / samples.length), notes: music.notes() };
}
