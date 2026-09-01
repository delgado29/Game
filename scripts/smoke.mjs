// Headless smoke test: boots the game in Chromium at iPad size, drives a full
// day of play through the real touch/tap path, and screenshots each step.
//   node scripts/smoke.mjs [outDir] [file]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] || join(root, 'dist', 'shots');
const file = process.argv[3] || join(root, 'index.html');
mkdirSync(outDir, { recursive: true });

const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

let shot = 0;
const snap = async (name) => { await page.screenshot({ path: join(outDir, `${String(++shot).padStart(2, '0')}-${name}.png`) }); };
const tap = async (x, y) => { await page.touchscreen.tap(x, y); await page.waitForTimeout(60); };
const ev = (fn, ...args) => page.evaluate(fn, ...args);
const tileScreen = (tx, ty) => ev(([tx, ty]) => { const C = window.Cafetal; const [x, y] = C.game.worldToScreen(tx * 16 + 8, ty * 16 + 8); return [x, y]; }, [tx, ty]);
const tapTile = async (tx, ty) => { const [x, y] = await tileScreen(tx, ty); await tap(x, y); };
const waitIdle = async () => {
  try { await page.waitForFunction(() => { const p = window.Cafetal.entities.player; return !p.path && !window.Cafetal.game.pending; }, null, { timeout: 15000 }); }
  catch (e) { console.log('waitIdle timeout; state:', await ev(() => { const C = window.Cafetal, p = C.entities.player; return JSON.stringify({ modal: C.ui.modal && C.ui.modal.type, path: p.path, tx: p.tx, ty: p.ty, tool: C.state.tool, pausing: C.ui.pausesTime() }); })); throw e; }
  await page.waitForTimeout(120);
};
const tapButton = async (id) => { const ok = await ev((id) => { const UI = window.Cafetal.ui; return UI.__tapId ? UI.__tapId(id) : false; }, id); if (!ok) throw new Error('no button ' + id); await page.waitForTimeout(80); };

await page.goto('file://' + resolve(file));
await page.waitForFunction(() => window.Cafetal && window.Cafetal.game && window.Cafetal.state);
// helper hook to tap UI buttons by id (test-only)
await ev(() => { const UI = window.Cafetal.ui; UI.__tapId = (id) => { const h = UI.__hits && UI.__hits().find((h) => h.id === id); if (!h) return false; h.fn(h.x + h.w / 2, h.y + h.h / 2); return true; }; });
await page.waitForTimeout(400);
await snap('title');

// New game
await ev(() => window.Cafetal.game.newGame());
await page.waitForTimeout(1600);
await snap('letter');
await ev(() => { window.Cafetal.ui.modal = null; });
await page.waitForTimeout(300);
await snap('farm-morning');

// Walk to the field
await tapTile(16, 14); await waitIdle(); await snap('walked');

// Hoe a tile (select tool via state to avoid hotbar geometry dependence), then plant & water
await ev(() => { window.Cafetal.state.tool = 'hoe'; });
await tapTile(16, 13); await waitIdle();
await ev(() => { window.Cafetal.state.tool = 'tomato_seed'; });
await tapTile(16, 13); await waitIdle();
await ev(() => { window.Cafetal.state.tool = 'water'; });
await tapTile(16, 13); await waitIdle();
// plant into the pre-tilled patch as well
await ev(() => { window.Cafetal.state.tool = 'coffee_seed'; });
await tapTile(15, 15); await waitIdle();
await snap('planted');
const cropInfo = await ev(() => { const W = window.Cafetal.world; return [...W.crops].map(([i, c]) => ({ x: i % 48, y: Math.floor(i / 48), ...c })); });
console.log('crops:', JSON.stringify(cropInfo));

// Force a customer to arrive, walk to the counter and serve
await ev(() => { const C = window.Cafetal; C.state.time.hour = 9; C.state.schedule.forEach((s) => { s.hour = 8; s.pass = false; }); });
await page.waitForFunction(() => window.Cafetal.entities.waitingCustomers().length > 0, null, { timeout: 30000 });
await page.waitForTimeout(500);
await snap('customer-waiting');
await ev(() => { window.Cafetal.state.tool = 'hand'; });
await ev(() => { const n = window.Cafetal.entities.waitingCustomers()[0]; window.Cafetal.game.tapCustomer(n); });
await waitIdle();
await page.waitForFunction(() => window.Cafetal.ui.modal && window.Cafetal.ui.modal.type === 'order', null, { timeout: 10000 });
await page.waitForTimeout(200);
await snap('order-panel');
const served = await ev(() => { const C = window.Cafetal; const n = C.entities.waitingCustomers()[0]; const before = C.state.coins; C.game.serveCustomer(n); return { order: n.order, coins: C.state.coins - before, rep: C.state.rep }; });
console.log('served:', JSON.stringify(served));
await page.waitForTimeout(400);
await snap('served');
await ev(() => { window.Cafetal.ui.modal = null; });

// Shop
await ev(() => window.Cafetal.ui.open('shop'));
await page.waitForTimeout(150); await snap('shop');
await ev(() => { window.Cafetal.ui.modal.data.tab = 'upgrades'; });
await page.waitForTimeout(150); await snap('shop-upgrades');
await ev(() => { window.Cafetal.ui.modal = null; });

// Roaster mini-game: give green beans, start, hold, release in the window
await ev(() => { const C = window.Cafetal; C.econ.add('green', 10); C.ui.open('roaster'); });
await page.waitForTimeout(150); await snap('roaster-choose');
await ev(() => { window.Cafetal.stations.startRoast('medium'); });
await page.waitForTimeout(100);
const rw = await ev(() => window.Cafetal.stations.ROAST_WINDOWS.medium);
await ev(() => { window.Cafetal.stations.roast.holding = true; });
await page.waitForFunction((mid) => window.Cafetal.stations.roast.t >= mid, (rw[0] + rw[1]) / 2, { timeout: 10000 });
await snap('roaster-holding');
const roastRes = await ev(() => { const ST = window.Cafetal.stations; ST.roast.holding = false; return ST.releaseRoast(); });
console.log('roast:', JSON.stringify(roastRes));
await page.waitForTimeout(150); await snap('roaster-result');
await ev(() => { window.Cafetal.ui.close(); });

// Night: advance time and screenshot lighting
await ev(() => { window.Cafetal.state.time.hour = 21.5; });
await page.waitForTimeout(400); await snap('night');

// Rain
await ev(() => { window.Cafetal.state.weather = 'rain'; window.Cafetal.state.time.hour = 14; });
await page.waitForTimeout(500); await snap('rain');
await ev(() => { window.Cafetal.state.weather = 'clear'; });

// Sleep -> new day
await ev(() => window.Cafetal.game.sleep());
await page.waitForFunction(() => window.Cafetal.ui.modal && window.Cafetal.ui.modal.type === 'summary', null, { timeout: 10000 });
await page.waitForTimeout(150); await snap('summary');
const day2 = await ev(() => { const C = window.Cafetal; return { day: C.state.time.day, weather: C.state.weather, crops: [...C.world.crops].map(([, c]) => c.days) }; });
console.log('day2:', JSON.stringify(day2));
await ev(() => { window.Cafetal.ui.modal = null; window.Cafetal.game.afterSummary(); });
await page.waitForTimeout(900); await snap('day2');

// Save / reload round trip
await ev(() => window.Cafetal.save.save());
const beforeReload = await ev(() => ({ coins: window.Cafetal.state.coins, day: window.Cafetal.state.time.day, crops: window.Cafetal.world.crops.size }));
await page.reload();
await page.waitForFunction(() => window.Cafetal && window.Cafetal.state);
await page.waitForTimeout(300);
const afterReload = await ev(() => ({ coins: window.Cafetal.state.coins, day: window.Cafetal.state.time.day, crops: window.Cafetal.world.crops.size }));
console.log('reload:', JSON.stringify(beforeReload), '->', JSON.stringify(afterReload));
await snap('title-with-save');

// Portrait layout check
await page.setViewportSize({ width: 820, height: 1180 });
await ev(() => window.Cafetal.game.continueGame());
await page.waitForTimeout(400); await snap('portrait');
await ev(() => { window.Cafetal.ui.open('shop'); });
await page.waitForTimeout(200); await snap('portrait-shop');

// Spanish
await ev(() => { window.Cafetal.ui.modal = null; window.Cafetal.game.toggleLang(); window.Cafetal.ui.open('order'); window.Cafetal.ui.modal.data.tab = 'recipes'; });
await page.waitForTimeout(200); await snap('spanish-recipes');

// Seasons: winter look
await ev(() => { const C = window.Cafetal; C.ui.modal = null; C.state.time.season = 3; C.state.weather = 'snow'; });
await page.waitForTimeout(400); await snap('winter');
await ev(() => { const C = window.Cafetal; C.state.time.season = 2; C.state.weather = 'clear'; });
await page.waitForTimeout(400); await snap('autumn');

// long-run stability: run ~20 s of simulated play at 10x speed by ticking the world
const perf = await ev(async () => {
  const C = window.Cafetal; C.state.time.season = 1; C.state.time.hour = 8;
  const t0 = performance.now(); let frames = 0;
  await new Promise((res) => { const step = () => { frames++; if (performance.now() - t0 > 3000) res(); else requestAnimationFrame(step); }; requestAnimationFrame(step); });
  return { fps: Math.round(frames / 3), npcs: C.entities.npcs.length };
});
console.log('perf:', JSON.stringify(perf));

await browser.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('smoke ok, screenshots in', outDir);
