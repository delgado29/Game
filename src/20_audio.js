/* Cafetal — 20_audio.js
   Procedural WebAudio: a lo-fi loop (Rhodes-ish chords, bass, brushed drums,
   vinyl crackle), weather/time ambience, and small sound effects. */
(function () {
  'use strict';
  const C = window.Cafetal;
  const A = (C.audio = {});
  const { clamp, lerp } = C.math;

  let ctx = null, master, musicBus, sfxBus, ambBus, noiseBuf, delay, delayGain;
  let musicOn = true, soundOn = true, unlocked = false;
  A.ready = () => unlocked;

  // Ambience state (set from the game each frame)
  A.env = { rain: 0, night: 0, snow: 0, indoors: 0 };
  let rainGain, cricketGain, rainSrc;

  function makeNoise() {
    const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  A.init = function () {
    if (unlocked) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    unlocked = true;
    noiseBuf = makeNoise();
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);

    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.55 : 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800; lp.Q.value = 0.5;
    musicBus.connect(lp); lp.connect(master);
    // echo for melody
    delay = ctx.createDelay(1.0); delay.delayTime.value = 60 / BPM * 0.75;
    delayGain = ctx.createGain(); delayGain.gain.value = 0.28;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1800;
    delay.connect(dlp); dlp.connect(delayGain); delayGain.connect(delay); delayGain.connect(musicBus);

    sfxBus = ctx.createGain(); sfxBus.gain.value = soundOn ? 0.8 : 0; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = soundOn ? 0.7 : 0; ambBus.connect(master);

    // rain: looping filtered noise
    rainSrc = ctx.createBufferSource(); rainSrc.buffer = noiseBuf; rainSrc.loop = true;
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 900;
    const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 200;
    rainGain = ctx.createGain(); rainGain.gain.value = 0;
    rainSrc.connect(rhp); rhp.connect(rlp); rlp.connect(rainGain); rainGain.connect(ambBus); rainSrc.start();

    // crickets: pulsed high tone
    const cr = ctx.createOscillator(); cr.type = 'sine'; cr.frequency.value = 4300;
    const crLfo = ctx.createOscillator(); crLfo.type = 'square'; crLfo.frequency.value = 14;
    const crLfoG = ctx.createGain(); crLfoG.gain.value = 0.5;
    const crAm = ctx.createGain(); crAm.gain.value = 0.5;
    crLfo.connect(crLfoG); crLfoG.connect(crAm.gain);
    cricketGain = ctx.createGain(); cricketGain.gain.value = 0;
    cr.connect(crAm); crAm.connect(cricketGain); cricketGain.connect(ambBus); cr.start(); crLfo.start();

    // vinyl crackle bed
    startCrackle();
    // silent unlock buffer for iOS
    const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start();
    if (ctx.state === 'suspended') ctx.resume();
    nextNoteTime = ctx.currentTime + 0.1;
    schedulerTimer = setInterval(scheduler, 40);
  };

  A.setMusic = (on) => { musicOn = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.3); };
  A.setSound = (on) => { soundOn = on; if (sfxBus) { sfxBus.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.1); ambBus.gain.setTargetAtTime(on ? 0.7 : 0, ctx.currentTime, 0.3); } };
  A.suspend = () => { if (ctx && ctx.state === 'running') ctx.suspend(); };
  A.resume = () => { if (ctx && ctx.state === 'suspended') ctx.resume(); };

  // ---- ambience update -------------------------------------------------------------
  let birdTimer = 2, mood = 'day';
  A.update = function (dt) {
    if (!unlocked) return;
    const e = A.env;
    const t = ctx.currentTime;
    rainGain.gain.setTargetAtTime(e.rain * 0.35, t, 0.8);
    cricketGain.gain.setTargetAtTime(e.night * (1 - e.rain) * 0.012 * (1 - e.snow), t, 1.0);
    // birds in daytime
    birdTimer -= dt;
    if (birdTimer <= 0) {
      birdTimer = 2 + Math.random() * 6;
      if (e.night < 0.4 && e.rain < 0.5 && e.snow < 0.5 && soundOn) bird();
    }
    mood = e.night > 0.6 ? 'night' : 'day';
  };

  function bird() {
    const t = ctx.currentTime, n = 2 + (Math.random() * 3 | 0), base = 2200 + Math.random() * 1200;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      const st = t + i * (0.09 + Math.random() * 0.06);
      o.frequency.setValueAtTime(base, st); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.3), st + 0.05); o.frequency.exponentialRampToValueAtTime(base * 0.9, st + 0.1);
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.03, st + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, st + 0.12);
      o.connect(g); g.connect(ambBus); o.start(st); o.stop(st + 0.14);
    }
  }

  function startCrackle() {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
    const g = ctx.createGain(); g.gain.value = 0.012;
    src.connect(hp); hp.connect(g); g.connect(musicBus); src.start();
    // random clicks
    const tick = () => {
      if (!ctx) return;
      const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const gg = ctx.createGain(); gg.gain.setValueAtTime(0.06 + Math.random() * 0.05, t); gg.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
      s.connect(gg); gg.connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.02);
      setTimeout(tick, 150 + Math.random() * 900);
    };
    setTimeout(tick, 500);
  }

  // ---- music sequencer ---------------------------------------------------------------
  const BPM = 74;
  const SPB = 60 / BPM; // seconds per beat
  // chords as semitone offsets from F3 (F=0). Progression over 8 bars.
  // Fmaj7 Am7 Dm7 Bbmaj7 | Fmaj7 Gm7 C9 Bbmaj7
  const F3 = 174.61;
  const CHORDS = [
    { root: 0, notes: [0, 4, 7, 11] },   // Fmaj7
    { root: 4, notes: [4, 7, 11, 14] },  // Am7
    { root: -3, notes: [-3, 0, 4, 7] },  // Dm7
    { root: -7, notes: [-7, -3, 0, 4] }, // Bbmaj7
    { root: 0, notes: [0, 4, 7, 11] },
    { root: 2, notes: [2, 5, 9, 12] },   // Gm7
    { root: 7, notes: [7, 11, 14, 17] }, // C7
    { root: -7, notes: [-7, -3, 0, 4, 9] }, // Bbmaj9
  ];
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]; // F major pentatonic
  const freq = (semi, oct = 0) => F3 * Math.pow(2, semi / 12 + oct);

  let nextNoteTime = 0, step = 0, schedulerTimer = null; // 16th steps
  let melodySeed = 1, melodyR = C.rng(1), melodyPattern = [];
  function makeMelody() { melodyR = C.rng(melodySeed++ * 7919); melodyPattern = []; let n = 4; for (let i = 0; i < 32; i++) { if (melodyR.chance(0.28)) { n = clamp(n + melodyR.int(5) - 2, 0, PENTA.length - 1); melodyPattern.push(n); } else melodyPattern.push(-1); } }
  makeMelody();

  function scheduler() {
    if (!ctx || !musicOn) { if (ctx) nextNoteTime = ctx.currentTime + 0.1; return; }
    while (nextNoteTime < ctx.currentTime + 0.25) {
      playStep(step, nextNoteTime);
      // swing: odd 16ths late
      const swing = step % 2 === 1 ? 0.06 * SPB : -0.06 * SPB;
      nextNoteTime += SPB / 4 + (step % 2 === 0 ? 0.06 * SPB : -0.06 * SPB);
      step = (step + 1) % 128; // 8 bars * 16
      if (step === 0 && Math.random() < 0.5) makeMelody();
    }
  }

  function playStep(s, t) {
    const bar = Math.floor(s / 16), beat16 = s % 16, chord = CHORDS[bar % CHORDS.length];
    const night = mood === 'night';
    // chords: on beat 1, "and" of 2, beat 4 (sparser at night)
    if (beat16 === 0 || beat16 === 6 || (beat16 === 12 && !night)) rhodesChord(chord.notes, t, beat16 === 0 ? 0.5 : 0.35);
    // bass
    if (beat16 === 0 || beat16 === 10) bass(freq(chord.root, -1), t, beat16 === 0 ? 1.2 : 0.7);
    // drums (softer at night)
    if (!night || bar % 2 === 0) {
      if (beat16 === 0 || beat16 === 8 || (beat16 === 14 && bar % 2 === 1)) kick(t);
      if (beat16 === 4 || beat16 === 12) rim(t);
      if (beat16 % 2 === 0 && !night) hat(t, beat16 % 4 === 0 ? 0.22 : 0.12);
      if (beat16 % 2 === 1 && Math.random() < 0.25 && !night) hat(t, 0.06);
    }
    // melody (every other 8 bars mostly)
    const mi = s % 32; const n = melodyPattern[mi];
    if (n >= 0 && (bar >= 2 || night)) lead(freq(PENTA[n], 1), t);
  }

  function rhodesChord(notes, t, vel) {
    for (let i = 0; i < notes.length; i++) {
      const f = freq(notes[i], 0);
      const g = ctx.createGain();
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'sine'; o2.type = 'triangle'; o1.frequency.value = f; o2.frequency.value = f * 2.001; o2.detune.value = 6;
      const g2 = ctx.createGain(); g2.gain.value = 0.18;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 1.2);
      const st = t + i * 0.012;
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(vel * 0.16, st + 0.02); g.gain.exponentialRampToValueAtTime(vel * 0.05, st + 0.9); g.gain.exponentialRampToValueAtTime(0.0008, st + 2.4);
      o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(musicBus);
      o1.start(st); o2.start(st); o1.stop(st + 2.5); o2.stop(st + 2.5);
    }
  }
  function bass(f, t, len) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f; const g2 = ctx.createGain(); g2.gain.value = 0.15;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(musicBus); o.start(t); o2.start(t); o.stop(t + len + 0.05); o2.stop(t + len + 0.05);
  }
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.3);
  }
  function hat(t, vel) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(hp); hp.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.06);
  }
  function rim(t) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    s.connect(bp); bp.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.1);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 820; const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.12, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.04); o.connect(g2); g2.connect(musicBus); o.start(t); o.stop(t + 0.05);
  }
  function lead(f, t) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11, t + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(lp); lp.connect(g); g.connect(musicBus); g.connect(delay); o.start(t); o.stop(t + 0.55);
  }

  // ---- sound effects ----------------------------------------------------------------
  function tone(type, f0, f1, dur, vol, t0) {
    const t = t0 || ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, filt, f0, f1, t0) {
    const t = t0 || ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = filt; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  const SFX = {
    tap: () => tone('square', 700, 900, 0.05, 0.05),
    blip: () => tone('sine', 900, 1300, 0.07, 0.08),
    back: () => tone('sine', 700, 400, 0.08, 0.06),
    plant: () => { tone('triangle', 320, 240, 0.12, 0.12); noise(0.08, 0.1, 'lowpass', 600); },
    hoe: () => { noise(0.14, 0.25, 'lowpass', 900, 300); tone('sine', 120, 60, 0.1, 0.2); },
    water: () => noise(0.35, 0.18, 'bandpass', 1400, 600),
    harvest: () => { const t = ctx.currentTime; tone('triangle', 520, 0, 0.1, 0.1, t); tone('triangle', 660, 0, 0.1, 0.1, t + 0.07); tone('triangle', 880, 0, 0.16, 0.1, t + 0.14); },
    coin: () => { const t = ctx.currentTime; tone('sine', 1100, 0, 0.08, 0.12, t); tone('sine', 1500, 0, 0.16, 0.12, t + 0.07); },
    pour: () => { noise(0.6, 0.16, 'lowpass', 400, 1800); },
    steam: () => noise(0.5, 0.1, 'highpass', 2500),
    pop: () => { tone('square', 200 + Math.random() * 300, 80, 0.03, 0.07); },
    error: () => tone('sawtooth', 160, 120, 0.15, 0.07),
    sleep: () => { const t = ctx.currentTime; tone('sine', 660, 0, 0.3, 0.1, t); tone('sine', 520, 0, 0.3, 0.1, t + 0.25); tone('sine', 390, 0, 0.6, 0.1, t + 0.5); },
    letter: () => { const t = ctx.currentTime; tone('sine', 1046, 0, 0.3, 0.08, t); tone('sine', 1318, 0, 0.3, 0.08, t + 0.12); tone('sine', 1568, 0, 0.5, 0.08, t + 0.24); },
    splash: () => { noise(0.25, 0.25, 'lowpass', 1200, 300); tone('sine', 300, 120, 0.15, 0.1); },
    reel: () => { for (let i = 0; i < 5; i++) tone('square', 1200, 900, 0.02, 0.03, ctx.currentTime + i * 0.05); },
    grind: () => noise(0.5, 0.15, 'bandpass', 500, 900),
    crank: () => { for (let i = 0; i < 4; i++) noise(0.06, 0.15, 'bandpass', 700, 400, ctx.currentTime + i * 0.12); },
    cluck: () => { tone('square', 500, 380, 0.08, 0.04); },
    meow: () => { tone('triangle', 600, 900, 0.18, 0.06); },
    unlock: () => { const t = ctx.currentTime;[523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, 0, 0.35, 0.09, t + i * 0.09)); },
    bell: () => { tone('sine', 1760, 1700, 0.5, 0.1); tone('sine', 2637, 2600, 0.3, 0.04); },
  };
  A.sfx = function (name) { if (!unlocked || !soundOn) return; const f = SFX[name]; if (f) f(); };
})();
