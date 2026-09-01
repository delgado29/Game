// Headless smoke test for Leña: boots at iPad size, chops, buys, sells, prestiges,
// checks offline progress and save/reload, screenshots along the way.
//   node lena/smoke.mjs [outDir] [file]
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
const tapId = async (id) => { const ok = await ev((id) => { const h = window.Lena.ui.__hits().find((h) => h.id === id); if (!h) return false; h.fn(h.x + h.w / 2, h.y + h.h / 2); return true; }, id); if (!ok) throw new Error('no button ' + id); await page.waitForTimeout(80); };

await page.goto('file://' + resolve(file));
await page.waitForFunction(() => window.Lena && window.Lena.state && window.Lena.ui.__hits);
await page.waitForTimeout(400); await snap('start');
// chop with real touches at the scene centre
const sc = await ev(() => window.Lena.ui.layout.scene);
for (let i = 0; i < 14; i++) { await page.touchscreen.tap(sc.x + sc.w / 2, sc.y + sc.h * 0.6); await page.waitForTimeout(40); }
await page.waitForTimeout(300); await snap('chopping');
let st = await ev(() => { const S = window.Lena.state; return { taps: S.taps, felled: S.felled, logs: S.logs, hp: S.tree.hp, state: S.tree.state }; }); console.log('after taps:', JSON.stringify(st));
await page.waitForTimeout(1600);
// sell via the real button
await tapId('sell'); await page.waitForTimeout(300); await snap('sold');
st = await ev(() => ({ coins: window.Lena.state.coins })); console.log('sold:', JSON.stringify(st));
// buy axe and hire via buttons (grant coins)
await ev(() => { window.Lena.state.coins += 500; }); await page.waitForTimeout(150);
await tapId('buyaxe'); await tapId('tabcrew'); await tapId('buyhire'); await tapId('buyhire'); await page.waitForTimeout(200); await snap('crew');
st = await ev(() => ({ up: window.Lena.state.up, crew: window.Lena.game.d.crew, coins: window.Lena.state.coins })); console.log('bought:', JSON.stringify(st));
// trade tab: mill + merchant
await ev(() => { window.Lena.state.coins += 5000; }); await page.waitForTimeout(150);
await tapId('tabtrade'); await tapId('buymill'); await tapId('buymerchant'); await page.waitForTimeout(300); await snap('trade');
// let the crew work; simulate with fast ticks and watch the tree fall + mill convert
await ev(() => { const L = window.Lena; for (let i = 0; i < 60; i++) L.game.tick(0.5); });
await page.waitForTimeout(400); await snap('working');
st = await ev(() => { const S = window.Lena.state; return { felled: S.felled, logs: +S.logs.toFixed(1), planks: +S.planks.toFixed(1), coins: Math.floor(S.coins), tree: S.tree.state }; }); console.log('after work:', JSON.stringify(st));
// forest tab & prestige
await tapId('tabforest'); await page.waitForTimeout(150); await snap('forest');
await ev(() => { window.Lena.state.earnedRun = 4e6; }); await page.waitForTimeout(150);
await page.waitForTimeout(100); await tapId('prestige'); await page.waitForTimeout(150); await snap('prestige-confirm'); await tapId('yes'); await page.waitForTimeout(400); await snap('after-prestige');
st = await ev(() => ({ acorns: window.Lena.state.acorns, forests: window.Lena.state.forests, coins: window.Lena.state.coins, global: window.Lena.game.d.global })); console.log('prestige:', JSON.stringify(st));
// stats tab, settings modal, spanish
await tapId('tabstats'); await page.waitForTimeout(150); await snap('stats');
await tapId('settings'); await page.waitForTimeout(150); await tapId('lang'); await page.waitForTimeout(150); await snap('settings-es'); await tapId('close');
// night look
await ev(() => { window.Lena.state.playTime = 480 * 0.75; }); await page.waitForTimeout(300); await snap('night');
// big numbers: late game formatting
await ev(() => { const L = window.Lena; L.state.coins = 3.2e15; L.state.felled = 460; L.game.spawnTree('up'); L.state.up.hire = 40; L.game.derive(); }); await tapId('tabchop'); await page.waitForTimeout(300); await snap('late-game');
// offline: save with old lastSeen, reload
await ev(() => { const L = window.Lena; L.state.up.merchant = 3; L.state.felled = 3; L.game.spawnTree('up'); L.game.derive(); L.game.save(); L.game.save = () => true; const raw = JSON.parse(localStorage.getItem(L.SAVE_KEY)); raw.lastSeen = Date.now() - 3600 * 1000; localStorage.setItem(L.SAVE_KEY, JSON.stringify(raw)); });
await page.reload(); await page.waitForFunction(() => window.Lena && window.Lena.state); await page.waitForTimeout(400); await snap('offline');
st = await ev(() => ({ modal: window.Lena.ui.modal && window.Lena.ui.modal.type, data: window.Lena.ui.modal && window.Lena.ui.modal.data, felled: window.Lena.state.lifetimeFelled })); console.log('offline:', JSON.stringify(st));
// portrait
await page.setViewportSize({ width: 820, height: 1180 }); await page.waitForTimeout(400); await ev(() => { window.Lena.ui.modal = null; }); await page.waitForTimeout(200); await snap('portrait');
const perf = await ev(async () => { const t0 = performance.now(); let f = 0; await new Promise((res) => { const s = () => { f++; if (performance.now() - t0 > 2000) res(); else requestAnimationFrame(s); }; requestAnimationFrame(s); }); return { fps: Math.round(f / 2) }; }); console.log('perf:', JSON.stringify(perf));
await browser.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('smoke ok, screenshots in', outDir);
