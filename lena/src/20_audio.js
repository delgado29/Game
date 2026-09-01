/* Leña — 20_audio.js
   WebAudio: campfire-folk plucked loop, wind & birds, chop/fall/coin/saw effects. */
(function () {
  'use strict';
  const L = window.Lena;
  const A = (L.audio = {});
  let ctx = null, master, musicBus, sfxBus, ambBus, noiseBuf, delay, delayGain, windGain, sawGain, sawOsc;
  let musicOn = true, soundOn = true, unlocked = false;
  A.env = { night: 0, saw: 0 };
  A.ready = () => unlocked;

  function makeNoise() { const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; return b; }

  A.init = function () {
    if (unlocked) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); unlocked = true; noiseBuf = makeNoise();
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.5 : 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200; musicBus.connect(lp); lp.connect(master);
    delay = ctx.createDelay(1); delay.delayTime.value = (60 / BPM) * 0.5; delayGain = ctx.createGain(); delayGain.gain.value = 0.22;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2000; delay.connect(dlp); dlp.connect(delayGain); delayGain.connect(delay); delayGain.connect(musicBus);
    sfxBus = ctx.createGain(); sfxBus.gain.value = soundOn ? 0.85 : 0; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = soundOn ? 0.6 : 0; ambBus.connect(master);
    // wind
    const ws = ctx.createBufferSource(); ws.buffer = noiseBuf; ws.loop = true;
    const wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 420; const wlfo = ctx.createOscillator(); wlfo.frequency.value = 0.07; const wlg = ctx.createGain(); wlg.gain.value = 200; wlfo.connect(wlg); wlg.connect(wlp.frequency); wlfo.start();
    windGain = ctx.createGain(); windGain.gain.value = 0.05; ws.connect(wlp); wlp.connect(windGain); windGain.connect(ambBus); ws.start();
    // saw hum
    sawOsc = ctx.createOscillator(); sawOsc.type = 'sawtooth'; sawOsc.frequency.value = 55; const slp = ctx.createBiquadFilter(); slp.type = 'lowpass'; slp.frequency.value = 500;
    const sn = ctx.createBufferSource(); sn.buffer = noiseBuf; sn.loop = true; const snbp = ctx.createBiquadFilter(); snbp.type = 'bandpass'; snbp.frequency.value = 2400; snbp.Q.value = 2; const sng = ctx.createGain(); sng.gain.value = 0.3;
    sawGain = ctx.createGain(); sawGain.gain.value = 0; sawOsc.connect(slp); slp.connect(sawGain); sn.connect(snbp); snbp.connect(sng); sng.connect(sawGain); sawGain.connect(ambBus); sawOsc.start(); sn.start();
    const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start();
    if (ctx.state === 'suspended') ctx.resume();
    nextNoteTime = ctx.currentTime + 0.1; setInterval(scheduler, 40);
  };
  A.setMusic = (on) => { musicOn = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.3); };
  A.setSound = (on) => { soundOn = on; if (sfxBus) { sfxBus.gain.setTargetAtTime(on ? 0.85 : 0, ctx.currentTime, 0.1); ambBus.gain.setTargetAtTime(on ? 0.6 : 0, ctx.currentTime, 0.3); } };
  A.suspend = () => { if (ctx && ctx.state === 'running') ctx.suspend(); };
  A.resume = () => { if (ctx && ctx.state === 'suspended') ctx.resume(); };

  let birdT = 3;
  A.update = function (dt) {
    if (!unlocked) return;
    const t = ctx.currentTime;
    sawGain.gain.setTargetAtTime(A.env.saw * 0.07, t, 0.4);
    birdT -= dt; if (birdT <= 0) { birdT = 3 + Math.random() * 7; if (A.env.night < 0.5 && soundOn) bird(); }
  };
  function bird() { const t = ctx.currentTime, n = 2 + (Math.random() * 3 | 0), base = 2000 + Math.random() * 1400; for (let i = 0; i < n; i++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; const st = t + i * 0.11; o.frequency.setValueAtTime(base, st); o.frequency.exponentialRampToValueAtTime(base * 1.3, st + 0.05); o.frequency.exponentialRampToValueAtTime(base * 0.85, st + 0.1); g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.025, st + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, st + 0.12); o.connect(g); g.connect(ambBus); o.start(st); o.stop(st + 0.14); } }

  // ---- music: D major pentatonic pluck loop ------------------------------------------------
  const BPM = 92, SPB = 60 / BPM, D3 = 146.83;
  const CH = [[0, 4, 7], [9, 12, 16], [7, 11, 14], [5, 9, 12], [0, 4, 7], [-3, 0, 4], [7, 11, 14], [5, 9, 12]]; // D, Bm, A, G, D, Bm(low), A, G
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
  const freq = (semi, oct) => D3 * Math.pow(2, semi / 12 + (oct || 0));
  let nextNoteTime = 0, step = 0, mel = [], melSeed = 3;
  function makeMel() { const r = L.rng(melSeed++ * 6113); mel = []; let n = 3; for (let i = 0; i < 32; i++) { if (r.chance(0.42)) { n = L.math.clamp(n + r.int(5) - 2, 0, PENTA.length - 1); mel.push(n); } else mel.push(-1); } }
  makeMel();
  function scheduler() {
    if (!ctx || !musicOn) { if (ctx) nextNoteTime = ctx.currentTime + 0.1; return; }
    while (nextNoteTime < ctx.currentTime + 0.25) { playStep(step, nextNoteTime); nextNoteTime += SPB / 4; step = (step + 1) % 128; if (step === 0 && Math.random() < 0.6) makeMel(); }
  }
  function playStep(s, t) {
    const bar = Math.floor(s / 16), b16 = s % 16, ch = CH[bar % CH.length];
    // arpeggio pluck on 8ths
    if (b16 % 2 === 0) pluck(freq(ch[(b16 / 2) % 3], 0), t, 0.09);
    if (b16 === 0 || b16 === 8) bass(freq(ch[0], -1), t);
    if (b16 % 4 === 2) shaker(t, 0.05);
    if (b16 % 8 === 4) shaker(t, 0.03);
    const n = mel[s % 32]; if (n >= 0 && bar >= 1) pluck(freq(PENTA[n], 1), t, 0.13, true);
  }
  function pluck(f, t, vol, echo) { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 2; const g2 = ctx.createGain(); g2.gain.value = 0.25; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3500, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.4); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + 1.1); o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(musicBus); if (echo) g.connect(delay); o.start(t); o2.start(t); o.stop(t + 1.2); o2.stop(t + 1.2); }
  function bass(f, t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.28, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 1); }
  function shaker(t, vel) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000; const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07); s.connect(hp); hp.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.08); }

  // ---- sfx ------------------------------------------------------------------------------------
  function tone(type, f0, f1, dur, vol, t0) { const t = t0 || ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.02); }
  function noise(dur, vol, filt, f0, f1, t0) { const t = t0 || ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noiseBuf; const fl = ctx.createBiquadFilter(); fl.type = filt; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(fl); fl.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.02); }
  const SFX = {
    chop: () => { noise(0.09, 0.35, 'lowpass', 1200, 300); tone('sine', 110 + Math.random() * 30, 60, 0.09, 0.25); },
    crit: () => { noise(0.14, 0.45, 'bandpass', 1800, 500); tone('square', 220, 80, 0.12, 0.12); tone('sine', 880, 1320, 0.15, 0.08); },
    crack: () => { for (let i = 0; i < 6; i++) noise(0.04, 0.3, 'bandpass', 900 + Math.random() * 800, 0, ctx.currentTime + i * 0.07); },
    thud: () => { tone('sine', 90, 35, 0.35, 0.5); noise(0.3, 0.35, 'lowpass', 500, 120); },
    coin: () => { const t = ctx.currentTime; tone('sine', 1100, 0, 0.08, 0.1, t); tone('sine', 1500, 0, 0.16, 0.1, t + 0.07); },
    sell: () => { const t = ctx.currentTime; for (let i = 0; i < 5; i++) tone('sine', 900 + i * 180, 0, 0.12, 0.07, t + i * 0.05); },
    buy: () => { const t = ctx.currentTime;[523, 659, 784].forEach((f, i) => tone('triangle', f, 0, 0.18, 0.09, t + i * 0.06)); },
    hire: () => { const t = ctx.currentTime; tone('triangle', 392, 0, 0.15, 0.1, t); tone('triangle', 523, 0, 0.25, 0.1, t + 0.1); },
    tap: () => tone('square', 700, 900, 0.04, 0.04),
    back: () => tone('sine', 700, 400, 0.08, 0.05),
    error: () => tone('sawtooth', 160, 120, 0.15, 0.06),
    ach: () => { const t = ctx.currentTime;[784, 988, 1175, 1568].forEach((f, i) => tone('sine', f, 0, 0.4, 0.09, t + i * 0.08)); },
    prestige: () => { const t = ctx.currentTime;[294, 370, 440, 587, 740, 880].forEach((f, i) => tone('triangle', f, 0, 1.2, 0.08, t + i * 0.1)); noise(1.5, 0.1, 'lowpass', 2000, 200); },
    grow: () => { tone('sine', 400, 900, 0.25, 0.05); },
    newtree: () => { const t = ctx.currentTime;[659, 784, 1046].forEach((f, i) => tone('sine', f, 0, 0.3, 0.07, t + i * 0.07)); },
    wagon: () => { for (let i = 0; i < 4; i++) noise(0.1, 0.12, 'lowpass', 600, 200, ctx.currentTime + i * 0.2); },
  };
  A.sfx = (n) => { if (!unlocked || !soundOn) return; const f = SFX[n]; if (f) f(); };
})();
