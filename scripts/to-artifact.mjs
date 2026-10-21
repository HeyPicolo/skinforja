// Converte o build de arquivo único (dist-single/index.html) no formato de página do Artifact:
// sem <!doctype>/<html>/<head>/<body>, com <title> e estilos no topo.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist-single/index.html', 'utf8');
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]);

const title = pick(/<title>[\s\S]*?<\/title>/g)[0] ?? '<title>SkinForja</title>';
const metas = pick(/<meta name="(claude:viewport-fit-sides|description)"[^>]*>/g);
const links = pick(/<link rel="(preconnect|stylesheet)"[^>]*>/g);
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = pick(/<script type="module"[^>]*>[\s\S]*?<\/script>/g);

const out = [title, ...metas, ...links, ...styles, '<div id="root"></div>', ...scripts].join('\n');
writeFileSync('dist-single/skinforja.html', out);
console.log(`dist-single/skinforja.html: ${(out.length / 1024).toFixed(0)} KB`);
