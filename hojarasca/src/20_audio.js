/* Hojarasca — 20_audio.js  WebAudio: warm acoustic loop, wind/crows ambience, blower & rake loops, effects. */
(function () {
  'use strict';
  const H = window.Hojarasca;
  const A = (H.audio = {});
  let ctx = null, master, musicBus, sfxBus, ambBus, noiseBuf, delay, delayGain, blowGain, blowFilter, rakeGain, ventGain, windGain;
  let musicOn = true, soundOn = true, unlocked = false;
  A.env = { blower: 0, blowerPower: 1, rake: 0, vent: 0, night: 0 };
  A.ready = () => unlocked;
  function makeNoise() { const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; return b; }
  A.init = function () {
    if (unlocked) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); unlocked = true; noiseBuf = makeNoise();
    master = ctx.createGain(); master.gain.value = 0.9; const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.45 : 0; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4000; musicBus.connect(lp); lp.connect(master);
    delay = ctx.createDelay(1); delay.delayTime.value = (60 / BPM) * 0.75; delayGain = ctx.createGain(); delayGain.gain.value = 0.25; const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1800; delay.connect(dlp); dlp.connect(delayGain); delayGain.connect(delay); delayGain.connect(musicBus);
    sfxBus = ctx.createGain(); sfxBus.gain.value = soundOn ? 0.85 : 0; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = soundOn ? 0.7 : 0; ambBus.connect(master);
    const loopNoise = (filterType, f, q, gain, bus) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(bus); s.start(); return [g, fl]; };
    [windGain] = loopNoise('lowpass', 380, 0.5, 0, ambBus); windGain.gain.value = 0.045;
    const wlfo = ctx.createOscillator(); wlfo.frequency.value = 0.09; const wlg = ctx.createGain(); wlg.gain.value = 0.03; wlfo.connect(wlg); wlg.connect(windGain.gain); wlfo.start();
    [blowGain, blowFilter] = loopNoise('bandpass', 500, 1.2, 0, sfxBus);
    const blowLp = ctx.createBiquadFilter(); // second stage handled inside loopNoise chain is enough
    [rakeGain] = loopNoise('highpass', 2200, 0.7, 0, sfxBus);
    [ventGain] = loopNoise('lowpass', 240, 2, 0, sfxBus);
    const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start();
    if (ctx.state === 'suspended') ctx.resume();
    nextNoteTime = ctx.currentTime + 0.1; setInterval(scheduler, 40);
  };
  A.setMusic = (on) => { musicOn = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.45 : 0, ctx.currentTime, 0.3); };
  A.setSound = (on) => { soundOn = on; if (sfxBus) { sfxBus.gain.setTargetAtTime(on ? 0.85 : 0, ctx.currentTime, 0.1); ambBus.gain.setTargetAtTime(on ? 0.7 : 0, ctx.currentTime, 0.3); } };
  A.suspend = () => { if (ctx && ctx.state === 'running') ctx.suspend(); };
  A.resume = () => { if (ctx && ctx.state === 'suspended') ctx.resume(); };
  let crowT = 6, dogT = 40;
  A.update = function (dt) {
    if (!unlocked) return; const t = ctx.currentTime, e = A.env;
    blowGain.gain.setTargetAtTime(e.blower * 0.35, t, 0.06); blowFilter.frequency.setTargetAtTime(420 + e.blowerPower * 260, t, 0.1);
    rakeGain.gain.setTargetAtTime(e.rake * 0.12, t, 0.05);
    ventGain.gain.setTargetAtTime(e.vent * 0.08, t, 0.2);
    crowT -= dt; if (crowT <= 0) { crowT = 8 + Math.random() * 16; if (soundOn && e.night < 0.6) crow(); }
    dogT -= dt; if (dogT <= 0) { dogT = 60 + Math.random() * 90; if (soundOn) dog(); }
  };
  function crow() { const t = ctx.currentTime, n = 1 + (Math.random() * 2 | 0); for (let i = 0; i < n; i++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; const st = t + i * 0.32; o.frequency.setValueAtTime(320, st); o.frequency.exponentialRampToValueAtTime(220, st + 0.18); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 3; g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.05, st + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, st + 0.22); o.connect(f); f.connect(g); g.connect(ambBus); o.start(st); o.stop(st + 0.25); } }
  function dog() { const t = ctx.currentTime; for (let i = 0; i < 2; i++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; const st = t + i * 0.28; o.frequency.setValueAtTime(180, st); o.frequency.exponentialRampToValueAtTime(120, st + 0.12); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.02, st + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, st + 0.15); o.connect(f); f.connect(g); g.connect(ambBus); o.start(st); o.stop(st + 0.2); } }

  // ---- music: Am7 Fmaj7 Cmaj7 G6 -----------------------------------------------------------------
  const BPM = 80, SPB = 60 / BPM, A3 = 220;
  const CH = [[0, 3, 7, 10], [-4, 0, 3, 7], [3, 7, 10, 14], [-2, 2, 5, 9], [0, 3, 7, 10], [-4, 0, 3, 7], [-9, -5, -2, 2], [-2, 2, 5, 9]];
  const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22];
  const freq = (semi, oct) => A3 * Math.pow(2, semi / 12 + (oct || 0));
  let nextNoteTime = 0, step = 0, mel = [], melSeed = 5;
  function makeMel() { const r = H.rng(melSeed++ * 4241); mel = []; let n = 3; for (let i = 0; i < 32; i++) { if (r.chance(0.3)) { n = H.math.clamp(n + r.int(5) - 2, 0, PENTA.length - 1); mel.push(n); } else mel.push(-1); } }
  makeMel();
  function scheduler() { if (!ctx || !musicOn) { if (ctx) nextNoteTime = ctx.currentTime + 0.1; return; } while (nextNoteTime < ctx.currentTime + 0.25) { playStep(step, nextNoteTime); nextNoteTime += SPB / 4 + (step % 2 === 0 ? 0.05 * SPB : -0.05 * SPB); step = (step + 1) % 128; if (step === 0 && Math.random() < 0.6) makeMel(); } }
  function playStep(s, t) {
    const bar = Math.floor(s / 16), b16 = s % 16, ch = CH[bar % CH.length];
    if (b16 === 0) chord(ch, t, 0.5); if (b16 === 10) chord(ch, t, 0.3);
    if (b16 === 0 || b16 === 8) bass(freq(ch[0], -1), t);
    if (b16 % 4 === 2) shaker(t, 0.05); if (b16 === 12) shaker(t, 0.08);
    const n = mel[s % 32]; if (n >= 0 && bar >= 2) pluck(freq(PENTA[n], 1), t, 0.12, true);
  }
  function chord(notes, t, vel) { notes.forEach((n, i) => pluck(freq(n, 0), t + i * 0.03, vel * 0.16, false)); }
  function pluck(f, t, vol, echo) { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 2; const g2 = ctx.createGain(); g2.gain.value = 0.2; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(800, t + 0.5); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + 1.4); o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(musicBus); if (echo) g.connect(delay); o.start(t); o2.start(t); o.stop(t + 1.5); o2.stop(t + 1.5); }
  function bass(f, t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.26, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 1.0); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 1.1); }
  function shaker(t, vel) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500; const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07); s.connect(hp); hp.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.08); }

  // ---- sfx ------------------------------------------------------------------------------------------
  function tone(type, f0, f1, dur, vol, t0) { const t = t0 || ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.02); }
  function noise(dur, vol, filt, f0, f1, t0) { const t = t0 || ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noiseBuf; const fl = ctx.createBiquadFilter(); fl.type = filt; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(fl); fl.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.02); }
  let rustleT = 0;
  const SFX = {
    rustle: () => { const n = ctx.currentTime; if (n - rustleT < 0.05) return; rustleT = n; noise(0.07, 0.08, 'highpass', 3000 + Math.random() * 2000); },
    dump: () => { const t = ctx.currentTime; noise(0.5, 0.2, 'lowpass', 2500, 500, t); for (let i = 0; i < 6; i++) tone('sine', 900 + i * 150, 0, 0.1, 0.06, t + 0.1 + i * 0.05); },
    coin: () => { const t = ctx.currentTime; tone('sine', 1100, 0, 0.08, 0.1, t); tone('sine', 1500, 0, 0.16, 0.1, t + 0.07); },
    buy: () => { const t = ctx.currentTime;[523, 659, 784].forEach((f, i) => tone('triangle', f, 0, 0.18, 0.09, t + i * 0.06)); },
    gate: () => { const t = ctx.currentTime; tone('sawtooth', 220, 140, 0.5, 0.05, t); noise(0.4, 0.15, 'bandpass', 700, 300, t); tone('sine', 90, 60, 0.2, 0.15, t + 0.45); },
    zone: () => { const t = ctx.currentTime;[523, 659, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, 0, 0.5, 0.09, t + i * 0.09)); },
    ending: () => { const t = ctx.currentTime;[262, 330, 392, 523, 659, 784, 1046].forEach((f, i) => tone('sine', f, 0, 1.6, 0.08, t + i * 0.12)); },
    tap: () => tone('square', 700, 900, 0.04, 0.04), back: () => tone('sine', 700, 400, 0.08, 0.05), error: () => tone('sawtooth', 160, 120, 0.15, 0.06),
    full: () => { tone('square', 300, 250, 0.1, 0.05); tone('square', 250, 200, 0.12, 0.05, ctx.currentTime + 0.12); },
    hatch: () => { noise(0.6, 0.2, 'lowpass', 900, 200); tone('sine', 80, 50, 0.4, 0.2); },
    gust: () => noise(1.6, 0.12, 'lowpass', 600, 250),
    step: () => noise(0.05, 0.03, 'lowpass', 900),
    ventIn: () => tone('sine', 500, 900, 0.08, 0.03),
  };
  A.sfx = (n) => { if (!unlocked || !soundOn) return; const f = SFX[n]; if (f) f(); };
})();
