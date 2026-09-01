// Bundles index.html + src/*.js into single-file builds (no dependencies).
//   dist/cafetal.html           full standalone document (open anywhere, host anywhere)
//   dist/cafetal-artifact.html  body-only fragment for hosts that wrap the page themselves
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let html = readFileSync(join(root, 'index.html'), 'utf8');

// strip PWA-only blocks
html = html.replace(/<!-- build:strip -->[\s\S]*?<!-- \/build:strip -->\n?/g, '');
// inline scripts in order
html = html.replace(/<script src="(src\/[^"]+)"><\/script>/g, (_, p) => {
  const js = readFileSync(join(root, p), 'utf8').replace(/<\/script>/gi, '<\\/script>');
  return `<script>\n${js}\n</script>`;
});

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'cafetal.html'), html);

// fragment: everything between <head> ... </body> minus html/head/body tags
const title = '<title>Cafetal</title>';
const style = html.match(/<style>[\s\S]*?<\/style>/)[0];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1].trim();
const fragment = `${title}\n<meta name="apple-mobile-web-app-capable" content="yes">\n${style}\n${body}\n`;
writeFileSync(join(root, 'dist', 'cafetal-artifact.html'), fragment);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB';
console.log('dist/cafetal.html', kb(html));
console.log('dist/cafetal-artifact.html', kb(fragment));
