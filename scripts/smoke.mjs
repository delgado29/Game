// Headless smoke test for SIGNAL: boots the built game in Chromium (SwiftShader WebGL), walks the
// menus, climbs Pinegrove with the debug API, repairs, descends, checks progress persists, then
// probes Black Ridge's cut cable with clipped vs unclipped falls. Screenshots along the way.
//   node scripts/smoke.mjs [outDir] [touch]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] || join(root, 'dist', 'shots'); const touch = process.argv[3] === 'touch';
mkdirSync(outDir, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => { const p = req.url === '/' ? '/index.html' : req.url.split('?')[0]; try { const data = await readFile(join(root, 'dist', p)); res.writeHead(200, { 'content-type': mime[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream' }); res.end(data); } catch { res.writeHead(404); res.end(); } });
await new Promise((r) => server.listen(0, r)); const port = server.address().port;

const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-networking', '--disable-sync', '--no-first-run', '--disable-component-update'] });
const ctx = await browser.newContext(touch ? { viewport: { width: 1024, height: 700 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true } : { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let shot = 0; const snap = async (n) => { await frame(); await frame(); await page.screenshot({ path: join(outDir, `${String(++shot).padStart(2, '0')}-${n}.png`) }); lap('shot ' + n); };
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const assert = (c, m) => { if (!c) { errors.push('assert: ' + m); console.log('FAIL', m); } else console.log('ok  ', m); };
const step = async (n = 1) => { await page.evaluate((n) => window.SIGNAL.sim(n / 60), n); };
const frame = async () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
const climbTo = async (y, maxCycles = 900) => {
  for (let i = 0; i < maxCycles; i++) {
    const s = await ev((y) => { const S = window.SIGNAL; const c = S.climber; if (c.state !== 'ladder') return { done: false, state: c.state, y: c.pos.y }; if (c.pos.y >= y) return { done: true, y: c.pos.y }; const near = c.anchorY; if (near === null || Math.abs(c.chest - near) > c.leash - 1.2) S.clip(); S.cycle(1, true); return { done: false, state: c.state, y: c.pos.y, anchor: c.anchor }; }, y);
    if (s.done) return s; if (s.state !== 'ladder') return s; await step(6);
  }
  return ev(() => ({ done: false, y: window.SIGNAL.climber.pos.y, state: window.SIGNAL.climber.state }));
};
const descendTo = async (y, maxCycles = 900) => {
  for (let i = 0; i < maxCycles; i++) {
    const s = await ev((y) => { const S = window.SIGNAL; const c = S.climber; if (c.state !== 'ladder') return { done: false, state: c.state, y: c.pos.y }; if (c.pos.y <= y) return { done: true, y: c.pos.y }; const near = c.anchorY; if (near === null || Math.abs(c.chest - near) > c.leash - 1.2) S.clip(); S.cycle(1, false); return { done: false, state: c.state, y: c.pos.y }; }, y);
    if (s.done) return s; if (s.state !== 'ladder') return s; await step(6);
  }
  return ev(() => ({ done: false, y: window.SIGNAL.climber.pos.y, state: window.SIGNAL.climber.state }));
};
const tap = async (a) => { await ev((a) => window.SIGNAL.press(a), a); await step(2); await ev((a) => window.SIGNAL.release(a), a); await step(2); };
const hold = async (a, frames) => { await ev((a) => window.SIGNAL.press(a), a); await step(frames); await ev((a) => window.SIGNAL.release(a), a); await step(2); };

const T0 = Date.now(); const lap = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${m}`);
await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => window.SIGNAL && window.SIGNAL.game); await frame(); lap('booted');
console.log('webgl:', await ev(() => window.SIGNAL.game.renderer.getContext().getParameter(0x1F02)));
await snap('van-menu');
// menus
await page.getByRole('button', { name: /Towers|Torres/ }).click(); await snap('towers');
await page.locator('.card.tower').first().click(); await snap('loadout');
// loadout: over-capacity is rejected; buy gloves with starting credits
let st = await ev(() => { const s = window.SIGNAL.save; return { credits: s.credits, loadout: s.loadout.slice() }; }); console.log('save:', JSON.stringify(st));
await page.locator('.card', { hasText: /Climbing gloves|Guantes/ }).click(); await page.waitForTimeout(100);
st = await ev(() => ({ credits: window.SIGNAL.save.credits, loadout: window.SIGNAL.save.loadout.slice() })); assert(st.loadout.includes('gloves') && st.credits === 30, 'bought gloves for 120');
await ev(() => { const s = window.SIGNAL.save; s.credits = 5000; s.owned = ['harness', 'tools', 'camera', 'gloves', 'battery', 'drone', 'analyzer']; s.loadout = ['harness', 'tools', 'camera', 'gloves', 'battery', 'drone']; window.SIGNAL.screen('loadout'); }); await page.waitForTimeout(100);
assert(await page.locator('.btn.primary[disabled]').count() === 1, 'start disabled when pack too heavy'); await snap('loadout-heavy');
await ev(() => { const s = window.SIGNAL.save; s.loadout = ['harness', 'tools', 'camera', 'gloves']; window.SIGNAL.screen('loadout'); }); await page.waitForTimeout(100);
await page.locator('.btn.primary').click(); await page.waitForTimeout(400);
st = await ev(() => ({ mode: window.SIGNAL.game.mode, state: window.SIGNAL.climber.state })); assert(st.mode === 'climb' && st.state === 'ground', 'climb started on the ground');
// desktop: dismiss lock overlay (no pointer lock headless -> pause shown); resume via debug
await ev(() => { window.SIGNAL.game.paused = false; window.SIGNAL.screen('none'); }); await step(20); await snap('ground-lookup');
// walk to the ladder and grab it
await ev(() => { const c = window.SIGNAL.climber; c.pos.set(0, 0, c.tower.ladderZ(0) + 0.9); c.yaw = 0; c.pitch = 0.6; }); await step(3); await tap('act');
st = await ev(() => ({ state: window.SIGNAL.climber.state, grip: window.SIGNAL.climber.gripping })); assert(st.state === 'ladder' && st.grip === 2, 'mounted the ladder with both hands');
// hand-over-hand: release both hands -> fall to the ground = death when unclipped low
let r = await climbTo(12); assert(r.done && r.y >= 12, `climbed to ${r.y?.toFixed(1)} m clipped`); await snap('climb-12m');
st = await ev(() => ({ anchor: window.SIGNAL.climber.anchor, stamina: window.SIGNAL.climber.stamina })); assert(st.anchor !== null, 'clipped to an anchor'); console.log('stamina', st.stamina.toFixed(1));
// clipped fall: release both hands, expect the harness to catch
await ev(() => { const c = window.SIGNAL.climber; for (const h of c.hands) h.rung = null; }); await step(90);
st = await ev(() => ({ state: window.SIGNAL.climber.state, falls: window.SIGNAL.climber.falls, y: window.SIGNAL.climber.pos.y, msg: window.SIGNAL.climber.message })); assert(st.state === 'ladder' && st.falls === 1, `harness caught the fall (state=${st.state}, falls=${st.falls}, y=${st.y.toFixed(1)})`); await snap('caught');
r = await climbTo(30); assert(r.done, `reached first platform height ${r.y?.toFixed(1)}`);
await tap('act'); st = await ev(() => ({ state: window.SIGNAL.climber.state, lp: window.SIGNAL.climber.lastPlatform })); assert(st.state === 'platform' && st.lp === 0, 'stepped onto platform 1');
await ev(() => { const c = window.SIGNAL.climber; c.yaw = Math.PI; c.pitch = -0.7; }); await step(5); await snap('platform-lookdown');
await tap('rest'); await step(40); st = await ev(() => window.SIGNAL.climber.state); assert(st === 'rest', 'rest mode'); await snap('rest-orbit'); await tap('act'); await step(3);
await ev(() => { const c = window.SIGNAL.climber; c.yaw = 0.2; c.pitch = 0.3; }); await tap('photo'); await frame(); await frame();
st = await ev(() => window.SIGNAL.save.photos.length); assert(st === 1, 'photo saved to gallery');
// back to the ladder, climb to the top
await ev(() => { const c = window.SIGNAL.climber; c.pos.set(0, c.pos.y, c.tower.platforms[0].hw + 1.0); }); await step(2); await tap('act');
st = await ev(() => window.SIGNAL.climber.state); assert(st === 'ladder', 'remounted ladder from platform');
await ev(() => window.SIGNAL.setWeather({ cloud: 0.3, rain: 0, wind: 0.4, storm: 0 }, 1));
r = await climbTo(89.4); assert(r.done, `reached the top at ${r.y?.toFixed(1)} m (${r.state ?? 'ladder'})`); await snap('near-top');
await tap('act'); st = await ev(() => ({ state: window.SIGNAL.climber.state, y: window.SIGNAL.climber.pos.y })); assert(st.state === 'platform' && st.y > 89, 'on the top platform');
// repair: walk to the cabinet and hold F through the four steps
await ev(() => { const c = window.SIGNAL.climber; const tx = c.tower.transmitter; c.pos.set(tx.x, c.pos.y, tx.z + 1.2); c.yaw = 0; c.pitch = -0.2; }); await step(3); await snap('transmitter');
await hold('act', 60 * 14);
st = await ev(() => ({ repaired: window.SIGNAL.climber.repaired, state: window.SIGNAL.climber.state, step: window.SIGNAL.climber.repairStep })); assert(st.repaired, `transmitter repaired (state=${st.state}, step=${st.step})`);
await ev(() => { const c = window.SIGNAL.climber; c.yaw = -0.12; c.pitch = -0.16; c.pos.set(0, c.pos.y, -c.tower.hw(c.pos.y) - 0.6); }); await step(200); await snap('town-lights-up');
st = await ev(() => ({ lit: window.SIGNAL.game.terrain.lit, storm: window.SIGNAL.weather.target.storm })); assert(st.lit > 0.2, `town lighting up (${st.lit.toFixed(2)})`); assert(st.storm > 0, 'storm scripted after repair');
// descend in the rain
await ev(() => window.SIGNAL.setWeather({ cloud: 0.9, rain: 0.8, wind: 0.8, storm: 0.9 }, 1)); await step(120);
await ev(() => { const c = window.SIGNAL.climber; c.pos.set(0, c.pos.y, c.tower.platforms.at(-1).hw + 1.0); }); await tap('act');
st = await ev(() => window.SIGNAL.climber.state); assert(st === 'ladder', 'started the descent'); await snap('storm-descent');
r = await descendTo(0.3, 1200); assert(r.done || r.state !== 'ladder', `descended to ${r.y?.toFixed(1)} (${r.state ?? 'ladder'})`);
if (r.done) await tap('act');
st = await ev(() => ({ state: window.SIGNAL.climber.state, y: window.SIGNAL.climber.pos.y })); assert(st.state === 'ground', `back on the ground (${st.state}, y=${st.y.toFixed(2)})`);
await ev(() => { const c = window.SIGNAL.climber; c.pos.set(5.5, 0, 11); c.yaw = -0.5; }); await step(3); await tap('act'); await page.waitForTimeout(300); await snap('debrief');
st = await ev(() => ({ mode: window.SIGNAL.game.mode, credits: window.SIGNAL.save.credits, done: !!window.SIGNAL.save.completed.pinegrove, unlocked: window.SIGNAL.save.unlocked.slice() }));
assert(st.mode === 'debrief' && st.done && st.unlocked.includes('blackridge'), `debrief: credits=${st.credits} unlocked=${st.unlocked}`);
// persistence
await page.reload(); await page.waitForFunction(() => window.SIGNAL && window.SIGNAL.game); await page.waitForTimeout(500);
st = await ev(() => ({ done: !!window.SIGNAL.save.completed.pinegrove, photos: window.SIGNAL.save.photos.length, lit: window.SIGNAL.game.terrain.litApplied })); assert(st.done && st.photos === 1, 'progress persisted across reload');
await page.getByRole('button', { name: /Gallery|Galería/ }).click(); await snap('gallery'); await page.getByRole('button', { name: /Back|Volver/ }).click();
// comfort settings persist and reach the climber camera
await page.getByRole('button', { name: /Settings|Ajustes/ }).click(); await page.getByRole('button', { name: /Field of view|Campo de visión/ }).click(); await page.getByRole('button', { name: /Reduce motion|Reducir movimiento/ }).click(); await snap('settings');
await page.reload(); await page.waitForFunction(() => window.SIGNAL && window.SIGNAL.game); await page.waitForTimeout(400);
st = await ev(() => ({ fov: window.SIGNAL.save.fov, rm: window.SIGNAL.save.reduceMotion })); assert(st.fov === 77 && st.rm === true, `settings persisted (fov=${st.fov}, reduceMotion=${st.rm})`);
// Black Ridge: sabotage probes
await ev(() => { const s = window.SIGNAL.save; s.loadout = ['harness', 'tools', 'battery', 'drone']; window.SIGNAL.start('blackridge'); }); await page.waitForTimeout(400); await ev(() => { window.SIGNAL.game.paused = false; window.SIGNAL.screen('none'); }); await step(10);
st = await ev(() => window.SIGNAL.climber.comfort); assert(st.fov === 77 && st.motion < 1, `climber uses comfort settings (${JSON.stringify(st)})`);
st = await ev(() => ({ anchors: window.SIGNAL.tower.anchors.length, broken: window.SIGNAL.tower.broken.size, cuts: window.SIGNAL.tower.spec.cutAnchors })); console.log('blackridge:', JSON.stringify(st));
assert(!(await ev(() => window.SIGNAL.tower.anchors.some((a) => a > 78 && a < 92))), 'no anchors inside the cut range');
await ev(() => { window.SIGNAL.calm(); window.SIGNAL.teleport(76); const c = window.SIGNAL.climber; c.yaw = 0; c.pitch = 0.6; }); await step(3); await ev(() => window.SIGNAL.clip());
st = await ev(() => window.SIGNAL.climber.anchor); assert(st !== null, 'clipped below the cut');
r = await climbTo(82, 60); st = await ev(() => ({ y: window.SIGNAL.climber.pos.y, msg: window.SIGNAL.climber.message, state: window.SIGNAL.climber.state })); assert(st.y < 82 && st.state === 'ladder', `leash stopped the climb at ${st.y.toFixed(1)} m (${st.msg}, ${st.state})`); await snap('cut-cable');
// unclip (anchor=null) and climb exposed, then let go: an unclipped fall kills
await ev(() => { window.SIGNAL.climber.anchor = null; }); r = await climbTo(86, 60); assert(r.done, `climbed exposed to ${r.y?.toFixed(1)}`);
await ev(() => { window.SIGNAL.climber.anchor = null; for (const h of window.SIGNAL.climber.hands) h.rung = null; }); await step(420);
st = await ev(() => ({ state: window.SIGNAL.climber.state, screen: window.SIGNAL.game.menus.screen })); assert(st.state === 'dead' && st.screen === 'dead', `unclipped fall is fatal (${st.state}/${st.screen})`); await snap('fell');
await page.getByRole('button', { name: /last platform|última plataforma/ }).click(); await page.waitForTimeout(350); await ev(() => { window.SIGNAL.game.paused = false; window.SIGNAL.screen('none'); }); await step(5);
st = await ev(() => ({ state: window.SIGNAL.climber.state, y: window.SIGNAL.climber.pos.y })); assert(st.state === 'ground' || st.state === 'platform', `respawned (${st.state} at ${st.y.toFixed(0)} m)`);
// broken rung snaps, electrical box arcs
await ev(() => { window.SIGNAL.teleport(50.2); const c = window.SIGNAL.climber; c.pitch = 0.5; for (const h of c.hands) h.rung = null; const i = [...c.tower.broken][0]; c.hands[0].rung = i; }); await step(40);
st = await ev(() => ({ snapped: window.SIGNAL.tower.snapped.size, msg: window.SIGNAL.climber.message })); assert(st.snapped === 1, `broken rung snapped (${st.msg})`);
// short unclipped drop near the ground: a stumble, not a death
await ev(() => { window.SIGNAL.teleport(1.6); const c = window.SIGNAL.climber; c.anchor = null; for (const h of c.hands) h.rung = null; }); await step(150);
st = await ev(() => ({ state: window.SIGNAL.climber.state, msg: window.SIGNAL.climber.message, falls: window.SIGNAL.climber.falls })); assert(st.state === 'ground', `short drop is a stumble (${st.state}, ${st.msg}, falls=${st.falls})`);
// live junction box at 63 m: the HUD warns before the arc
await ev(() => { window.SIGNAL.teleport(62.6); const c = window.SIGNAL.climber; c.yaw = 0; c.pitch = 0.2; });
let warned = false; for (let i = 0; i < 120 && !warned; i++) { await step(3); warned = await ev(() => { const S = window.SIGNAL; const p = S.tower.arcPhase(0); return p > 0.2 && p < 1 && S.climber.arcWarn > 0 && !document.querySelector('.hazard').hidden; }); }
assert(warned, 'arc warning shows on the HUD before the box arcs'); await snap('arc-warning');
await ev(() => { window.SIGNAL.teleport(150); const c = window.SIGNAL.climber; c.yaw = 0; c.pitch = -0.6; }); await step(30); await snap('blackridge-150m');
st = await ev(() => window.SIGNAL.game.storyQueue?.length ?? -1); console.log('story queue', st);
const perf = await ev(async () => { const t0 = performance.now(); let f = 0; await new Promise((res) => { const s = () => { f++; if (performance.now() - t0 > 2000) res(); else requestAnimationFrame(s); }; requestAnimationFrame(s); }); return { fps: Math.round(f / 2) }; }); console.log('perf (swiftshader):', JSON.stringify(perf));
if (touch) {
  await ev(() => { window.SIGNAL.calm(); window.SIGNAL.teleport(20); }); await step(5); await snap('touch-controls');
  // auto-reach: with ▲ the grabs go up even while looking down, with ▼ they go down while looking up
  let y0 = await ev(() => { const c = window.SIGNAL.climber; c.reachDir = 1; c.anchor = null; return c.pos.y; });
  for (let i = 0; i < 8; i++) await ev(() => { window.SIGNAL.cycle(1, false); window.SIGNAL.sim(0.15); }); // pitch down, reach mode up
  let y1 = await ev(() => window.SIGNAL.climber.pos.y); assert(y1 > y0 + 1.0, `▲ auto-reach climbs while looking down (${y0.toFixed(1)} → ${y1.toFixed(1)})`);
  await ev(() => { window.SIGNAL.climber.reachDir = -1; window.SIGNAL.game.touch.refreshDir(); });
  for (let i = 0; i < 8; i++) await ev(() => { window.SIGNAL.cycle(1, true); window.SIGNAL.sim(0.15); }); // pitch up, reach mode down
  const y2 = await ev(() => window.SIGNAL.climber.pos.y); assert(y2 < y1 - 1.0, `▼ auto-reach descends while looking up (${y1.toFixed(1)} → ${y2.toFixed(1)})`);
  assert((await ev(() => document.querySelector('.tbtn.dir').textContent)) === '▼', 'direction button shows ▼');
  await ev(() => { window.SIGNAL.save.leftHanded = true; window.SIGNAL.game.applySettings(); }); await snap('touch-lefty'); await ev(() => { window.SIGNAL.save.leftHanded = false; window.SIGNAL.game.applySettings(); });
}
await browser.close(); server.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('smoke ok, screenshots in', outDir);
