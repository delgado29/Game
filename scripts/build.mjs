// Bundles <game>/index.html + its src/*.js into single-file builds (no dependencies).
//   node scripts/build.mjs cafetal     -> cafetal/dist/cafetal.html + cafetal/dist/cafetal-artifact.html
//   node scripts/build.mjs             -> builds every game folder that has an index.html + src/
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const games = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(repo).filter((d) => existsSync(join(repo, d, 'index.html')) && existsSync(join(repo, d, 'src')));

for (const game of games) {
  const root = join(repo, game);
  let html = readFileSync(join(root, 'index.html'), 'utf8');
  html = html.replace(/<!-- build:strip -->[\s\S]*?<!-- \/build:strip -->\n?/g, '');
  html = html.replace(/<script src="(src\/[^"]+)"><\/script>/g, (_, p) => `<script>\n${readFileSync(join(root, p), 'utf8').replace(/<\/script>/gi, '<\\/script>')}\n</script>`);
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(join(root, 'dist', `${game}.html`), html);
  const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
  const style = html.match(/<style>[\s\S]*?<\/style>/)[0];
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1].trim();
  const fragment = `${title}\n<meta name="apple-mobile-web-app-capable" content="yes">\n${style}\n${body}\n`;
  writeFileSync(join(root, 'dist', `${game}-artifact.html`), fragment);
  const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB';
  console.log(`${game}/dist/${game}.html ${kb(html)}  ·  ${game}/dist/${game}-artifact.html ${kb(fragment)}`);
}
