// Headless smoke test for SIGNAL. Boots the built game in Chromium (software WebGL) and plays it
// through the window.SIGNAL debug API: menus, the first tower with tutorial, collectibles, photo
// assignments, repair and debrief; then contracts, upgrades, the cable grab, Black Ridge's sabotage,
// quality tiers, resume and tab-hide. Screenshots land in the output folder.
//   node scripts/smoke.mjs [outDir] [touch]
// SMOKE_Q=low|medium|high picks the graphics tier (default high). Slow software renderers, such as CI
// runners, should use low: the logic under test is the same and frames are many times cheaper.
import { createRequire } from 'node:module';
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] || join(root, 'shots'); const touch = process.argv[3] === 'touch';
mkdirSync(outDir, { recursive: true });

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const u = req.url.split('?')[0]; const p = u === '/' ? '/index.html' : u;
  try { const data = await readFile(join(root, 'dist', p)); res.writeHead(200, { 'content-type': mime[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r)); const base = `http://localhost:${server.address().port}`;

const local = '/opt/pw-browsers/chromium';
const browser = await pw.chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync(local) ? local : undefined),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-networking', '--disable-sync', '--no-first-run', '--disable-component-update'],
});
const ctx = await browser.newContext(touch ? { viewport: { width: 1024, height: 700 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true } : { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
const page = await ctx.newPage(); page.setDefaultTimeout(120000);
const Q = ['low', 'medium', 'high'].includes(process.env.SMOKE_Q) ? process.env.SMOKE_Q : 'high';
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const T0 = Date.now(); const lap = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${m}`);
const ev = (fn, arg) => page.evaluate(fn, arg);
const assert = (c, m) => { if (!c) { errors.push('assert: ' + m); console.log('FAIL', m); } else console.log('ok  ', m); };
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
let shot = 0; const snap = async (n) => { await frame(); await frame(); await page.screenshot({ path: join(outDir, `${String(++shot).padStart(2, '0')}-${n}.png`) }); lap('shot ' + n); };
const sim = (s) => ev((s) => window.SIGNAL.sim(s), s);
const boot = async (query = `?q=${Q}`) => { await page.goto(base + '/' + query); await page.waitForFunction(() => window.SIGNAL && window.SIGNAL.game); await frame(); };
const tap = (a) => ev((a) => { const S = window.SIGNAL; S.press(a); S.sim(0.04); S.release(a); S.sim(0.04); }, a);
const hold = (a, s) => ev(([a, s]) => { const S = window.SIGNAL; S.press(a); S.sim(s); S.release(a); S.sim(0.05); }, [a, s]);
/** Starting a climb asks for pointer lock, which fails headless and pauses the game: undo that. */
const unpause = async () => { await page.waitForTimeout(350); await ev(() => { const S = window.SIGNAL; S.game.paused = false; S.screen('none'); }); };
const startJob = async (id, contract = null, loadout = null) => { await ev(([id, contract, loadout]) => { const S = window.SIGNAL; if (loadout) S.save.loadout = loadout; S.start(id, contract); }, [id, contract, loadout]); await unpause(); await ev(() => window.SIGNAL.calm()); };
const state = () => ev(() => { const S = window.SIGNAL, c = S.climber; return { mode: S.game.mode, state: c.state, y: c.pos.y, falls: c.falls, anchor: c.anchor, msg: c.message, prompt: c.prompt, repaired: c.repaired, prot: c.protection, stamina: c.stamina, lp: c.lastPlatform }; });
/** Hand-over-hand until the feet reach y (up or down), clipping as the lanyard runs out. */
const climbTo = async (y, { clip = true, max = 1400 } = {}) => {
  const up = y > (await ev(() => window.SIGNAL.climber.pos.y));
  for (let i = 0; i < max; i++) {
    const s = await ev(([y, clip, up]) => {
      const S = window.SIGNAL, c = S.climber; if (c.state !== 'ladder') return { stop: true, state: c.state, y: c.pos.y };
      if (up ? c.pos.y >= y : c.pos.y <= y) return { stop: true, done: true, y: c.pos.y, state: c.state };
      if (clip && !c.perks.arrester) { const a = c.anchorY; if (a === null || Math.abs(c.chest - a) > c.leash - 1.2) S.clip(); }
      S.cycle(1, up); S.sim(0.1); return { stop: false };
    }, [y, clip, up]);
    if (s.stop) return s;
  }
  return state();
};
/** Step from the ladder onto the platform at height y. */
const onto = async (y) => { await ev((y) => { const S = window.SIGNAL; S.teleport(y - 0.05); S.sim(0.2); }, y); await tap('act'); return state(); };
/** Walk (teleport) to a work point on the current platform and hold the action. */
const workPoint = async (id, seconds) => { await ev((id) => { const S = window.SIGNAL; const pt = S.tower.points.find((p) => p.id === id); S.climber.pos.set(pt.pos.x, pt.pos.y, pt.pos.z); S.sim(0.05); }, id); await hold('act', seconds); };
const toVan = async () => { await ev(() => { const S = window.SIGNAL, c = S.climber; S.teleport(0.2); S.sim(0.2); }); await tap('act'); await ev(() => { const c = window.SIGNAL.climber; c.pos.set(5.5, 0, 11); c.yaw = -0.5; window.SIGNAL.sim(0.05); }); await tap('act'); await page.waitForTimeout(250); };
const btn = (re) => page.getByRole('button', { name: re });

// ---------- boot and menus ----------
await boot(); lap('booted');
console.log('webgl:', await ev(() => window.SIGNAL.game.renderer.getContext().getParameter(0x1F02)));
await snap('van-menu');
await btn(/^Continue|^Continuar/).click(); await snap('loadout');
await page.locator('.card', { hasText: /Climbing gloves|Guantes/ }).click();
let st = await ev(() => ({ credits: window.SIGNAL.save.credits, loadout: window.SIGNAL.save.loadout.slice() }));
assert(st.loadout.includes('gloves') && st.credits === 30, 'bought gloves for 120');
assert(await page.locator('.card', { hasText: /Headlamp|Frontal/ }).locator('.state').innerText().then((s) => s.includes('🔒')), 'rank-gated gear is locked in the shop');
await ev(() => { const s = window.SIGNAL.save; s.owned.push('battery', 'drone'); s.loadout = ['harness', 'tools', 'camera', 'gloves', 'battery', 'drone']; window.SIGNAL.screen('loadout'); });
assert(await page.locator('.btn.start[disabled]').count() === 1, 'start disabled when the pack is too heavy'); await snap('loadout-heavy');
await ev(() => { const s = window.SIGNAL.save; s.loadout = ['harness', 'camera', 'gloves']; window.SIGNAL.screen('loadout'); });
assert(await page.locator('.btn.start[disabled]').count() === 1, 'start disabled without required gear');
await ev(() => { const s = window.SIGNAL.save; s.loadout = ['harness', 'tools', 'camera', 'gloves']; window.SIGNAL.screen('loadout'); });
await page.locator('.btn.start').click(); await unpause();
st = await state(); assert(st.mode === 'climb' && st.state === 'ground', 'climb started on the ground'); await sim(0.4); await snap('ground');

// ---------- first tower: tutorial, clip, fall, platform ----------
await ev(() => { const S = window.SIGNAL, c = S.climber; S.calm(); c.pos.set(0, 0, c.tower.ladderZ(0) + 0.9); c.yaw = 0; c.pitch = 0.6; S.sim(0.05); }); await tap('act');
st = await ev(() => ({ state: window.SIGNAL.climber.state, grip: window.SIGNAL.climber.gripping })); assert(st.state === 'ladder' && st.grip === 2, 'mounted the ladder with both hands');
let r = await climbTo(12); assert(r.done, `climbed to ${r.y.toFixed(1)} m clipped`); await snap('climb-12m');
st = await ev(() => ({ anchor: window.SIGNAL.climber.anchor, tut: window.SIGNAL.game.tutorial.step })); assert(st.anchor !== null, 'clipped to an anchor'); assert(st.tut >= 4, `tutorial follows the climb (step ${st.tut})`);
await ev(() => { for (const h of window.SIGNAL.climber.hands) h.rung = null; }); await sim(1.5);
st = await state(); assert(st.state === 'ladder' && st.falls === 1, `harness caught the fall (${st.state}, falls=${st.falls}, y=${st.y.toFixed(1)})`); await snap('caught');
r = await climbTo(30); assert(r.done, `reached the first platform height (${r.y.toFixed(1)})`);
await tap('act'); st = await state(); assert(st.state === 'platform' && st.lp === 0, 'stepped onto platform 1');
st = await ev(() => window.SIGNAL.save.checkpoint); assert(st && st.towerId === 'pinegrove' && st.platform === 0, 'checkpoint written on the platform');
await sim(7); st = await ev(() => ({ done: window.SIGNAL.save.tutorialDone, hint: !document.querySelector('.tut').hidden })); assert(st.done && !st.hint, 'tutorial finishes on the first platform');

// ---------- collectibles and photo assignments ----------
let xp0 = await ev(() => window.SIGNAL.save.xp);
await workPoint('pg-p1', 1.0);
st = await ev(() => ({ pages: window.SIGNAL.save.pages.slice(), xp: window.SIGNAL.save.xp, note: document.querySelector('.radio').className })); assert(st.pages.includes('pg-p1') && st.xp === xp0 + 25 && st.note.includes('note'), 'logbook page collected and shown'); await snap('page-note');
await ev(() => { const c = window.SIGNAL.climber; c.pos.set(0, c.pos.y, c.tower.platforms[0].hw + 0.4); c.yaw = Math.PI; c.pitch = -0.7; window.SIGNAL.sim(0.1); }); await snap('platform-lookdown');
await tap('rest'); await sim(0.7); st = await state(); assert(st.state === 'rest', 'rest mode'); await snap('rest-orbit');
let cr0 = await ev(() => window.SIGNAL.save.credits);
await tap('photo'); await frame(); await frame();
st = await ev(() => ({ goals: window.SIGNAL.save.photoGoals.slice(), credits: window.SIGNAL.save.credits, tag: window.SIGNAL.save.photos.at(-1)?.tag, state: window.SIGNAL.climber.state }));
assert(st.goals.includes('selfie') && st.credits === cr0 + 60 && st.tag && st.state === 'rest', `photo assignment paid (${st.tag})`);
await tap('act'); await sim(0.1);
r = await onto(60); assert(r.state === 'platform' && r.lp === 1, 'second platform');
await ev(() => { const S = window.SIGNAL; const pt = S.tower.points.find((p) => p.id === 'pg-f1'); S.climber.pos.set(pt.pos.x, pt.pos.y, pt.pos.z); S.sim(0.05); }); await hold('act', 3);
st = await ev(() => ({ prompt: window.SIGNAL.climber.prompt, frags: window.SIGNAL.save.fragments.length })); assert(st.frags === 0 && /analyzer|analizador/.test(st.prompt), 'fragment needs the analyzer');

// ---------- top, repair, descent, debrief ----------
await ev(() => { const S = window.SIGNAL; S.teleport(80); S.sim(0.1); S.clip(); });
r = await climbTo(89.4); assert(r.done, `reached the top at ${r.y.toFixed(1)} m`); await snap('near-top');
await tap('act'); st = await state(); assert(st.state === 'platform' && st.y > 89, 'on the top platform');
await ev(() => { const c = window.SIGNAL.climber; const tx = c.tower.transmitter; c.pos.set(tx.x, c.pos.y, tx.z + 1.2); c.yaw = 0; c.pitch = -0.2; window.SIGNAL.sim(0.05); }); await snap('transmitter');
await hold('act', 14); st = await state(); assert(st.repaired && st.state === 'platform', 'transmitter repaired');
await ev(() => { const c = window.SIGNAL.climber; c.yaw = -0.12; c.pitch = -0.16; c.pos.set(0, c.pos.y, -c.tower.hw(c.pos.y) - 0.6); }); await sim(3.4); await snap('town-lights-up');
st = await ev(() => ({ lit: window.SIGNAL.game.terrain.lit, storm: window.SIGNAL.weather.target.storm })); assert(st.lit > 0.2 && st.storm > 0, `town lighting up (${st.lit.toFixed(2)}), storm scripted`);
await ev(() => window.SIGNAL.setWeather({ cloud: 0.9, rain: 0.8, wind: 0.8, storm: 0.9 }, 1)); await sim(2);
await ev(() => { const c = window.SIGNAL.climber; c.pos.set(0, c.pos.y, c.tower.platforms.at(-1).hw + 1.0); window.SIGNAL.sim(0.05); }); await tap('act');
st = await state(); assert(st.state === 'ladder', 'started the descent'); await snap('storm-descent');
await ev(() => window.SIGNAL.calm()); r = await climbTo(0.3); assert(r.done, `descended to ${r.y.toFixed(1)} m`);
await tap('act'); st = await state(); assert(st.state === 'ground', 'back on the ground');
xp0 = await ev(() => window.SIGNAL.game.run.xpBefore);
await ev(() => { const c = window.SIGNAL.climber; c.pos.set(5.5, 0, 11); c.yaw = -0.5; window.SIGNAL.sim(0.05); }); await tap('act'); await page.waitForTimeout(300);
st = await ev(() => { const S = window.SIGNAL, s = S.save; return { mode: S.game.mode, done: !!s.completed.pinegrove, unlocked: s.unlocked.slice(), xp: s.xp, medals: s.medals.pinegrove, rank: S.rankOf(), cp: s.checkpoint, lines: document.querySelectorAll('.ledger .line').length }; });
assert(st.mode === 'debrief' && st.done && st.unlocked.includes('blackridge') && st.cp === null, 'debrief: tower restored, next unlocked, checkpoint cleared');
assert(st.xp - xp0 >= 90 + 150 + 25 + 40 + 40 && st.medals.includes('restored') && !st.medals.includes('clean') && st.lines >= 4, `XP ledger adds up (+${st.xp - xp0} XP, medals ${st.medals})`);
assert(st.rank >= 1 && (await page.locator('.unlocks').innerText()).match(/Headlamp|Frontal/), 'promotion unlocks the headlamp'); await page.waitForTimeout(900); await snap('debrief');

// ---------- persistence, map, contracts ----------
await boot(); st = await ev(() => ({ done: !!window.SIGNAL.save.completed.pinegrove, photos: window.SIGNAL.save.photos.length, pages: window.SIGNAL.save.pages.length, lit: window.SIGNAL.game.terrain.lit }));
assert(st.done && st.photos === 1 && st.pages === 1, 'progress persisted across reload');
await ev(() => window.SIGNAL.setDay('2026-03-14'));
st = await ev(() => { const S = window.SIGNAL; const a = S.dailyContracts(), b = S.dailyContracts(); return { n: a.length, same: JSON.stringify(a) === JSON.stringify(b), kinds: a.map((c) => c.kind) }; });
assert(st.n >= 1 && st.same, `daily contracts are deterministic (${st.kinds.join(', ')})`);
await btn(/Network|Red y/).click(); await snap('map');
assert(await page.locator('.job').count() >= 2, 'restored tower offers standing and daily contracts');
await page.locator('[data-tower="blackridge"]').click(); await snap('map-blackridge');
assert((await page.locator('.side').innerText()).match(/Black Ridge/), 'map selects a tower');
// inspection contract: three tagged points, no transmitter work
const inspect = await ev(() => { const S = window.SIGNAL; for (let d = 1; d < 60; d++) { S.setDay(`2026-04-${String(d).padStart(2, '0')}`); const c = S.dailyContracts().find((x) => x.kind === 'inspect' && x.towerId === 'pinegrove'); if (c) return c; } return null; });
assert(!!inspect, 'found an inspection contract');
cr0 = await ev(() => window.SIGNAL.save.credits);
await startJob('pinegrove', inspect, ['harness', 'tools']);
st = await ev(() => ({ pts: window.SIGNAL.tower.points.filter((p) => p.kind === 'inspect').map((p) => p.platform), tx: window.SIGNAL.climber.txSteps })); assert(st.pts.length === 3 && st.tx === null, `inspection tags on platforms ${st.pts}`);
for (let i = 0; i < 3; i++) { const y = [30, 60, 90][i]; await onto(y); await workPoint(`inspect-${i}`, 2.3); }
st = await state(); assert(st.repaired, 'all three tags checked completes the job'); await snap('inspect-done');
await toVan();
st = await ev(() => { const S = window.SIGNAL, s = S.save; return { mode: S.game.mode, credits: s.credits, done: s.contractsDone.ids.slice(), contracts: s.stats.contracts }; });
assert(st.mode === 'debrief' && st.credits === cr0 + inspect.reward && st.done.includes(inspect.id) && st.contracts === 1, `inspection paid ${inspect.reward} ¢ once`);
await btn(/Back to the van|A la furgoneta/).click(); await btn(/Network|Red y/).click(); await page.locator('[data-tower="pinegrove"]').click();
assert(await page.locator('.job.done').count() === 1, 'finished daily contract shows as done'); await btn(/Back|Volver/).click();
// express contract: late pays 40%
const express = { id: 'test:pinegrove:express', kind: 'express', towerId: 'pinegrove', daily: true, reward: 200, xp: 90, timeLimit: 480 };
cr0 = await ev(() => window.SIGNAL.save.credits);
await startJob('pinegrove', express, ['harness', 'tools']);
await ev(() => { const c = window.SIGNAL.climber; c.elapsed = 500; c.completeJob(); window.SIGNAL.sim(0.1); });
assert(await ev(() => document.querySelector('.timer').classList.contains('over')), 'express timer shows overtime'); await toVan();
st = await ev(() => window.SIGNAL.save.credits); assert(st === cr0 + 80, `late express pays 40% (${st - cr0} ¢)`);
await btn(/Back to the van|A la furgoneta/).click();

// ---------- upgrades and the cable grab ----------
await ev(() => { const S = window.SIGNAL, s = S.save; s.credits = 5000; s.loadout = ['harness', 'tools', 'gloves']; S.game.menus.job = { towerId: 'blackridge', contract: null }; S.screen('loadout'); });
cr0 = 5000; await page.locator('.card[data-gear="gloves"] .btn.up').click();
st = await ev(() => ({ lv: window.SIGNAL.save.gearLv.gloves, credits: window.SIGNAL.save.credits })); assert(st.lv === 2 && st.credits < cr0, `glove upgrade bought (${cr0 - st.credits} ¢)`);
await page.locator('.card.fixed .btn.up').first().click();
st = await ev(() => window.SIGNAL.save.gearLv.pack); assert(st === 2 && (await page.locator('.weight').innerText()).includes('/ 9 kg'), 'pack upgrade raises capacity to 9 kg'); await snap('loadout-upgrades');
await ev(() => { const s = window.SIGNAL.save; s.owned.push('arrester', 'analyzer'); });
await startJob('blackridge', null, ['harness', 'tools', 'battery', 'arrester']);
await ev(() => { window.SIGNAL.teleport(60); window.SIGNAL.sim(0.1); });
r = await climbTo(68); st = await state(); assert(r.done && st.anchor === null && st.prot === 'arrester', 'cable grab: 8 m without re-clipping');
await ev(() => { for (const h of window.SIGNAL.climber.hands) h.rung = null; }); await sim(1.2);
st = await state(); assert(st.state === 'ladder' && st.falls === 1 && st.y > 66.5, `cable grab stops a fall short (y=${st.y.toFixed(1)})`);
await ev(() => { window.SIGNAL.teleport(82); window.SIGNAL.sim(0.1); }); st = await state(); assert(st.prot === 'none', 'cable grab is useless where the cable is cut');
await ev(() => window.SIGNAL.game.endClimb(false));

// ---------- Black Ridge sabotage ----------
await startJob('blackridge', null, ['harness', 'tools', 'battery', 'drone', 'analyzer']);
st = await ev(() => ({ anchors: window.SIGNAL.tower.anchors.some((a) => a > 78 && a < 92), mul: window.SIGNAL.climber.perks.fatigueMul })); assert(!st.anchors, 'no anchors inside the cut range');
await ev(() => { const S = window.SIGNAL; S.teleport(76); const c = S.climber; c.yaw = 0; c.pitch = 0.6; S.sim(0.05); S.clip(); });
r = await climbTo(82, { clip: false, max: 60 }); st = await state(); assert(st.y < 82 && st.state === 'ladder' && st.anchor !== null, `lanyard stops the climb at ${st.y.toFixed(1)} m`); await snap('cut-cable');
await ev(() => { window.SIGNAL.climber.anchor = null; }); r = await climbTo(86, { clip: false, max: 80 }); assert(r.done, `climbed exposed to ${r.y.toFixed(1)} m`);
await ev(() => { window.SIGNAL.climber.anchor = null; for (const h of window.SIGNAL.climber.hands) h.rung = null; }); await sim(7);
st = await ev(() => ({ state: window.SIGNAL.climber.state, screen: window.SIGNAL.game.menus.screen })); assert(st.state === 'dead' && st.screen === 'dead', 'unclipped fall is fatal'); await snap('fell');
await btn(/last platform|última plataforma/).click(); await unpause(); await sim(0.1);
st = await state(); assert(st.state === 'ground' || st.state === 'platform', `respawned (${st.state})`);
await ev(() => { const S = window.SIGNAL; S.teleport(50.2); const c = S.climber; for (const h of c.hands) h.rung = null; c.hands[0].rung = [...c.tower.broken][0]; }); await sim(0.7);
st = await ev(() => window.SIGNAL.tower.snapped.size); assert(st === 1, 'sawn rung snaps under load');
await ev(() => { const S = window.SIGNAL; S.teleport(1.6); const c = S.climber; c.anchor = null; for (const h of c.hands) h.rung = null; }); await sim(2.5);
st = await state(); assert(st.state === 'ground', `short drop is a stumble (${st.state})`);
await ev(() => { const S = window.SIGNAL; S.teleport(62.6); S.climber.pitch = 0.2; S.sim(0.05); S.clip(); }); // clipped, so a shock cannot end the probe
let warned = false; for (let i = 0; i < 140 && !warned; i++) { await sim(0.05); warned = await ev(() => { const S = window.SIGNAL; const p = S.tower.arcPhase(0); return p > 0.2 && p < 1 && S.climber.arcWarn > 0 && !document.querySelector('.hazard').hidden; }); }
assert(warned, 'arc warning shows before the box arcs'); await snap('arc-warning');
// fragment with the analyzer, on the 72 m platform
await onto(72); await workPoint('br-f1', 3);
st = await ev(() => window.SIGNAL.save.fragments.slice()); assert(st.includes('br-f1'), 'signal fragment captured with the analyzer');
await ev(() => { const S = window.SIGNAL; S.teleport(150); S.climber.pitch = -0.6; }); await sim(0.5); await snap('blackridge-150m');
await ev(() => window.SIGNAL.game.endClimb(false));

// ---------- van screens ----------
await btn(/Career|Carrera/).click(); await snap('career'); await btn(/Back|Volver/).click();
await btn(/Logbook|Bitácora/).click(); await snap('logbook'); assert((await page.locator('.page:not(.missing)').count()) === 1, 'logbook shows the page found'); await btn(/Back|Volver/).click();
await btn(/Gallery|Galería/).click(); await snap('gallery'); assert(await page.locator('.goal.on').count() === 1, 'gallery ticks the finished assignment'); await btn(/Back|Volver/).click();
await btn(/Settings|Ajustes/).click(); await btn(/Field of view|Campo de visión/).click(); await btn(/Reduce motion|Reducir movimiento/).click(); await snap('settings');

// ---------- quality, resume, tab hide ----------
await ev(() => { const S = window.SIGNAL; S.save.quality = 'low'; S.persist(); });
await boot('?x=1'); st = await ev(() => { const S = window.SIGNAL; return { level: S.game.quality.level, composer: S.game.quality.composer, fov: S.save.fov, rm: S.save.reduceMotion }; });
assert(st.level === 'low' && !st.composer, 'low quality persists and renders direct'); assert(st.fov === 77 && st.rm === true, 'comfort settings persisted'); await snap('quality-low');
await ev(() => { const S = window.SIGNAL; S.save.quality = 'high'; S.game.applySettings(); S.persist(); }); await frame(); await frame();
assert(await ev(() => window.SIGNAL.game.quality.composer) === true, 'quality switches back to the composer live');
await startJob('pinegrove', { id: 'standing:pinegrove:maintenance', kind: 'maintenance', towerId: 'pinegrove', daily: false, reward: 90, xp: 30 }, ['harness', 'tools']);
st = await ev(() => window.SIGNAL.climber.comfort); assert(st.fov === 77 && st.motion < 1, 'climber uses the comfort settings');
await onto(30); st = await ev(() => window.SIGNAL.save.checkpoint); assert(st && st.platform === 0 && st.contract?.kind === 'maintenance', 'checkpoint keeps the contract');
await boot(); await snap('resume-offer');
await btn(/Resume climb|Reanudar subida/).click(); await unpause();
st = await ev(() => { const S = window.SIGNAL; return { mode: S.game.mode, state: S.climber.state, y: S.climber.pos.y, kind: S.game.run.job.contract?.kind }; });
assert(st.mode === 'climb' && st.state === 'platform' && Math.abs(st.y - 30) < 0.5 && st.kind === 'maintenance', `resumed the contract on the platform (${st.y.toFixed(1)} m)`);
await ev(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
assert(await ev(() => window.SIGNAL.game.paused) === true, 'hiding the tab pauses the climb');
await ev(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); window.SIGNAL.game.endClimb(false); });
assert(await ev(() => window.SIGNAL.save.checkpoint) === null, 'abandoning clears the checkpoint');

// ---------- touch ----------
if (touch) {
  await startJob('blackridge', null, ['harness', 'tools', 'battery']);
  await ev(() => { window.SIGNAL.teleport(20); window.SIGNAL.sim(0.1); }); await snap('touch-controls');
  const y0 = await ev(() => { const c = window.SIGNAL.climber; c.reachDir = 1; c.anchor = null; return c.pos.y; });
  for (let i = 0; i < 8; i++) await ev(() => { window.SIGNAL.cycle(1, false); window.SIGNAL.sim(0.15); }); // looking down, reaching up
  const y1 = await ev(() => window.SIGNAL.climber.pos.y); assert(y1 > y0 + 1.0, `▲ auto-reach climbs while looking down (${y0.toFixed(1)} → ${y1.toFixed(1)})`);
  await ev(() => { window.SIGNAL.climber.reachDir = -1; window.SIGNAL.game.touch.refreshDir(); });
  for (let i = 0; i < 8; i++) await ev(() => { window.SIGNAL.cycle(1, true); window.SIGNAL.sim(0.15); }); // looking up, reaching down
  const y2 = await ev(() => window.SIGNAL.climber.pos.y); assert(y2 < y1 - 1.0, `▼ auto-reach descends while looking up (${y1.toFixed(1)} → ${y2.toFixed(1)})`);
  assert((await ev(() => document.querySelector('.tbtn.dir').textContent)) === '▼', 'direction button shows ▼');
  // tap-to-move grip: taps climb, hands never let go
  await ev(() => { const S = window.SIGNAL, c = S.climber; c.tapGrip = true; c.reachDir = 1; S.teleport(20); S.sim(0.1); });
  for (let i = 0; i < 10; i++) await tap(i % 2 ? 'gripR' : 'gripL');
  st = await ev(() => ({ y: window.SIGNAL.climber.pos.y, grip: window.SIGNAL.climber.gripping, state: window.SIGNAL.climber.state })); assert(st.y > 21 && st.grip === 2 && st.state === 'ladder', `tap grip climbs with both hands on (${st.y.toFixed(1)} m)`);
  await ev(() => { window.SIGNAL.save.leftHanded = true; window.SIGNAL.game.applySettings(); }); await snap('touch-lefty');
  await ev(() => { window.SIGNAL.save.leftHanded = false; window.SIGNAL.game.applySettings(); });
}
await browser.close(); server.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('smoke ok, screenshots in', outDir);
