// Bundles src/main.ts with esbuild into dist/ and copies the static shell.
//   node scripts/build.mjs            -> production build in dist/
//   node scripts/build.mjs --serve    -> watch + dev server on http://localhost:8000
import { build, context } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(repo, 'dist');
const serve = process.argv.includes('--serve');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(repo, 'public'), dist, { recursive: true });
let html = readFileSync(join(repo, 'index.html'), 'utf8');
if (!serve) html = html.replace('<!-- build:stamp -->', `<!-- built ${new Date().toISOString()} -->`);
writeFileSync(join(dist, 'index.html'), html);

const opts = {
  entryPoints: [join(repo, 'src/main.ts')],
  bundle: true,
  format: 'esm',
  target: ['es2022', 'safari16', 'chrome110'],
  outfile: join(dist, 'signal.js'),
  sourcemap: true,
  minify: !serve,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': serve ? '"development"' : '"production"' },
  loader: { '.css': 'text' },
  logLevel: 'info',
};

if (serve) {
  const ctx = await context(opts);
  await ctx.watch();
  const { hosts, port } = await ctx.serve({ servedir: dist, port: 8000 });
  console.log(`SIGNAL dev server: http://${hosts[0]}:${port}/`);
} else {
  const result = await build({ ...opts, metafile: true });
  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  const out = Object.entries(result.metafile.outputs).filter(([f]) => f.endsWith('.js'));
  for (const [f, o] of out) console.log(`${f} ${kb(o.bytes)}`);
  if (!existsSync(join(dist, 'icons', 'icon-192.png'))) console.warn('warning: icons missing, run node scripts/icons.mjs');
}
