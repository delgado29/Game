// Headless smoke test for Hojarasca: boots at iPad size, walks with the virtual stick, picks up leaves,
// dumps at the bin, buys tools, blows leaves, opens a gate, forces a zone to completion, reloads.
//   node hojarasca/smoke.mjs [outDir] [file]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] || join(root, 'dist', 'shots');
const file = process.argv[3] || join(root, 'index.html');
mkdirSync(outDir, { recursive: true });
const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let shot = 0; const snap = async (n) => page.screenshot({ path: join(outDir, `${String(++shot).padStart(2, '0')}-${n}.png`) });
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const tapId = async (id) => { const ok = await ev((id) => { const h = window.Hojarasca.ui.__hits().find((h) => h.id === id); if (!h) return false; h.fn(h.x + h.w / 2, h.y + h.h / 2); return true; }, id); if (!ok) throw new Error('no button ' + id); await page.waitForTimeout(100); };
// drive the virtual left stick with a real touch drag
const walk = async (dx, dy, ms) => { const cdp = await ctx.newCDPSession(page); const x = 200, y = 500; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y: y + dy, id: 1 }] }); await page.waitForTimeout(ms); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); await page.waitForTimeout(80); };

await page.goto('file://' + resolve(file));
await page.waitForFunction(() => window.Hojarasca && window.Hojarasca.state && window.Hojarasca.ui.__hits);
await page.waitForTimeout(500); await snap('title');
await ev(() => window.Hojarasca.main.newGame()); await page.waitForTimeout(400); await snap('start');
let st = await ev(() => { const H = window.Hojarasca; return { leaves: H.leaves.countAlive(), zones: Object.fromEntries(Object.entries(H.state.zones).map(([k, v]) => [k, v.total])) }; }); console.log('spawned:', JSON.stringify(st));
// walk around the front yard with the stick and pick leaves up
await walk(40, 0, 900); await walk(-40, 20, 900); await walk(0, -40, 700); await walk(30, 30, 900);
st = await ev(() => { const H = window.Hojarasca; return { bag: H.state.bag, coins: H.state.coins, px: H.main.player.x | 0, py: H.main.player.y | 0 }; }); console.log('after walking:', JSON.stringify(st));
await snap('walking');
// teleport next to the bin and dump by tapping (interact)
await ev(() => { const H = window.Hojarasca; H.main.player.x = 24 * 16 + 8; H.main.player.y = 30 * 16; H.main.interact('right'); });
await page.waitForTimeout(300); await snap('shop');
st = await ev(() => ({ coins: window.Hojarasca.state.coins, bag: window.Hojarasca.state.bag, modal: window.Hojarasca.ui.modal && window.Hojarasca.ui.modal.type })); console.log('dumped:', JSON.stringify(st));
// buy rake and blower with granted coins via the shop buttons
await ev(() => { window.Hojarasca.state.coins += 400; }); await page.waitForTimeout(150);
await tapId('buyrake'); await tapId('buyblower'); await page.waitForTimeout(150); await snap('bought');
st = await ev(() => ({ up: window.Hojarasca.state.up, tool: window.Hojarasca.state.tool })); console.log('bought:', JSON.stringify(st));
await ev(() => { window.Hojarasca.ui.modal = null; });
// blower: aim right with the right stick over leaves; verify leaves moved & some got sold at the bin
await ev(() => { const H = window.Hojarasca; H.state.tool = 'blower'; H.main.player.x = 12 * 16; H.main.player.y = 33 * 16; });
const before = await ev(() => { const H = window.Hojarasca; let s = 0; for (let i = 0; i < H.leaves.n; i++) if (H.leaves.ALIVE[i]) s += H.leaves.X[i]; return s; });
const cdp = await ctx.newCDPSession(page); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 800, y: 500, id: 2 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 846, y: 500, id: 2 }] }); await page.waitForTimeout(900); await snap('blowing'); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
const after = await ev(() => { const H = window.Hojarasca; let s = 0; for (let i = 0; i < H.leaves.n; i++) if (H.leaves.ALIVE[i]) s += H.leaves.X[i]; return { sum: s, blown: H.leaves.blownCount }; });
console.log('blow moved leaves right:', after.sum > before, 'blown:', after.blown);
// gate: walk into the driveway gate -> prompt
await ev(() => { const H = window.Hojarasca; H.state.coins += 1000; H.main.player.x = 39 * 16 + 8; H.main.player.y = 35 * 16 + 8; });
await walk(40, 0, 500); await page.waitForTimeout(200); await snap('gate-prompt');
st = await ev(() => ({ modal: window.Hojarasca.ui.modal && window.Hojarasca.ui.modal.type })); console.log('gate prompt:', JSON.stringify(st));
await tapId('yes'); await page.waitForTimeout(200);
st = await ev(() => ({ gates: window.Hojarasca.state.gates })); console.log('gates:', JSON.stringify(st));
// vents: buy one and let it collect
await ev(() => { const H = window.Hojarasca; H.state.coins += 500; H.game.buyVent('v_front1'); for (let i = 0; i < 120; i++) H.leaves.update(1 / 30, { px: 0, py: 0, tool: 'hand', aim: 0, active: false, mvx: 0, mvy: 0, blower: { power: 0, range: 0, cone: 0 }, rake: { w: 0 }, vents: H.game.activeVents(), bins: [], wind: { x: 0, y: 0 } }); });
st = await ev(() => ({ coins: Math.floor(window.Hojarasca.state.coins), frontLeft: window.Hojarasca.leaves.countAlive(0) })); console.log('vent:', JSON.stringify(st));
await ev(() => { window.Hojarasca.main.player.x = 10 * 16; window.Hojarasca.main.player.y = 33 * 16; }); await page.waitForTimeout(300); await snap('vent');
// force front zone complete -> bonus modal
await ev(() => { const H = window.Hojarasca; for (let i = 0; i < H.leaves.n; i++) if (H.leaves.ALIVE[i] && H.leaves.ZONE[i] === 0) H.leaves.collect(i, 'vent'); });
await page.waitForTimeout(300); await snap('zone-done');
st = await ev(() => ({ modal: window.Hojarasca.ui.modal && window.Hojarasca.ui.modal.type, front: window.Hojarasca.state.zones.front.done, mult: window.Hojarasca.game.d.valueMult })); console.log('zone:', JSON.stringify(st));
await ev(() => { window.Hojarasca.ui.modal = null; });
// cellar: open everything, teleport, screenshot the secret room at night
await ev(() => { const H = window.Hojarasca; for (const gt of H.world.GATES) H.state.gates[gt.id] = true; H.main.teleport(H.world.CELLAR_IN.tx, H.world.CELLAR_IN.ty, true); });
await page.waitForTimeout(400); await snap('cellar');
// pool at dusk
await ev(() => { const H = window.Hojarasca; H.main.teleport(50, 11, false); H.state.stats.time = 1200 * 0.62; }); await page.waitForTimeout(400); await snap('pool-dusk');
await ev(() => { const H = window.Hojarasca; H.main.teleport(10, 8, false); H.state.stats.time = 10; }); await page.waitForTimeout(400); await snap('greenhouse');
// save/reload round trip
const pre = await ev(() => { const H = window.Hojarasca; H.game.save(); return { coins: Math.floor(H.state.coins), alive: H.leaves.countAlive() }; });
await page.reload(); await page.waitForFunction(() => window.Hojarasca && window.Hojarasca.state); await page.waitForTimeout(300);
const post = await ev(() => ({ coins: Math.floor(window.Hojarasca.state.coins), alive: window.Hojarasca.leaves.countAlive() })); console.log('reload:', JSON.stringify(pre), '->', JSON.stringify(post));
await ev(() => window.Hojarasca.main.continueGame()); await page.setViewportSize({ width: 820, height: 1180 }); await page.waitForTimeout(400); await snap('portrait');
const perf = await ev(async () => { const t0 = performance.now(); let f = 0; await new Promise((res) => { const s = () => { f++; if (performance.now() - t0 > 2000) res(); else requestAnimationFrame(s); }; requestAnimationFrame(s); }); return { fps: Math.round(f / 2), leaves: window.Hojarasca.leaves.countAlive() }; }); console.log('perf:', JSON.stringify(perf));
await browser.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('smoke ok, screenshots in', outDir);
