// Testes da lógica central (sem navegador). Rode com: npm test
import { unzipSync, strFromU8 } from 'fflate';
import { SKIN_SIZE, layout, mirrorIndex, type ArmModel } from '../src/skin/layout';
import { SkinDoc, pack } from '../src/skin/document';
import { dab, floodFill, drawShape, type PaintOptions } from '../src/skin/tools';
import { TEMPLATES, STARTERS } from '../src/skin/templates';
import { buildMcpack, slugId } from '../src/skin/io';

let failed = 0;
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? 'ok  ' : 'FALHOU'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failed++;
}

for (const model of ['classic', 'slim'] as ArmModel[]) {
  const L = layout(model);
  let used = 0, involution = true;
  for (let i = 0; i < SKIN_SIZE * SKIN_SIZE; i++) {
    if (L.owner[i] < 0) continue;
    used++;
    const m = mirrorIndex(model, i);
    if (m < 0 || mirrorIndex(model, m) !== i || L.owner[m] < 0) involution = false;
  }
  check(`[${model}] espelho é simétrico (A→B→A)`, involution);
  check(`[${model}] pixels usados`, used > 2000, `${used}`);
}

const opaqueBase = (px: Uint32Array, model: ArmModel) => {
  const L = layout(model);
  for (let i = 0; i < px.length; i++) {
    const o = L.owner[i];
    if (o >= 0 && L.infos[o].layer === 'base' && px[i] >>> 24 === 0) return false;
  }
  return true;
};
check('10 modelos na galeria', TEMPLATES.length === 10);
for (const t of [...TEMPLATES, ...STARTERS]) {
  const px = t.draw();
  check(`modelo "${t.name}" tem base totalmente opaca`, opaqueBase(px, t.model));
}
const cats = new Set(TEMPLATES.map((t) => t.category));
check('categorias Animais, Mobs e Personagens', cats.has('animais') && cats.has('mobs') && cats.has('personagens'));

// histórico
const d = new SkinDoc();
const red = { r: 255, g: 0, b: 0, a: 255 };
const opts: PaintOptions = { tool: 'brush', color: red, size: 3, mirror: false, model: 'classic', noise: 0.1 };
let s = d.begin('Pincel');
dab(s, opts, 12, 12, null);
d.commit();
check('pincel 3×3 pinta 9 pixels', [...d.px].filter((v) => v === pack(red)).length === 9);
d.undo();
check('desfazer volta ao vazio', d.px.every((v) => v === 0));
d.redo();
check('refazer reaplica', [...d.px].filter((v) => v === pack(red)).length === 9);

// espelho: frente da cabeça x=9 (local 1) ↔ x=14 (local 6)
const d2 = new SkinDoc();
s = d2.begin('Lápis');
dab(s, { ...opts, tool: 'pencil', mirror: true }, 9, 10, null);
d2.commit();
check('espelho na cabeça', d2.px[10 * 64 + 14] === pack(red));
// braço direito frente (44,20) ↔ braço esquerdo frente (36+3=39? ) local x0 -> 3
s = d2.begin('Lápis');
dab(s, { ...opts, tool: 'pencil', mirror: true }, 44, 20, null);
d2.commit();
check('espelho entre braços', d2.px[52 * 64 + 39] === pack(red));

// balde fica dentro da face
const d3 = new SkinDoc();
s = d3.begin('Balde');
floodFill(s, { ...opts, tool: 'fill' }, 10, 10, );
d3.commit();
check('balde preenche só a face da frente da cabeça (64 px)', [...d3.px].filter((v) => v !== 0).length === 64);

// retângulo com prévia
const d4 = new SkinDoc();
s = d4.begin('Retângulo');
drawShape(s, { ...opts, tool: 'rect' }, 20, 20, 30, 30, null);
drawShape(s, { ...opts, tool: 'rect' }, 20, 20, 22, 22, null);
d4.commit();
check('retângulo refaz a prévia (só o contorno final)', [...d4.px].filter((v) => v !== 0).length === 8);

// troca de modelo é desfazível
d4.begin('Slim'); d4.commit('slim');
check('modelo muda para slim', d4.model === 'slim');
d4.undo();
check('desfazer volta para clássico', d4.model === 'classic');

// .mcpack
check('id sem acentos e espaços', slugId('Minhas Skins Ação!') === 'MinhasSkinsAcao');
const zip = buildMcpack({ packName: 'Pacote', skinName: 'Skin', model: 'slim', png: new Uint8Array([137, 80, 78, 71]) });
const files = unzipSync(zip);
check('.mcpack tem manifest, skins.json, png e idiomas',
  ['manifest.json', 'skins.json', 'skin.png', 'texts/en_US.lang', 'texts/languages.json'].every((f) => f in files));
const manifest = JSON.parse(strFromU8(files['manifest.json']));
check('manifest com UUIDs diferentes', manifest.header.uuid !== manifest.modules[0].uuid && manifest.modules[0].type === 'skin_pack');
check('geometria slim', JSON.parse(strFromU8(files['skins.json'])).skins[0].geometry === 'geometry.humanoid.customSlim');

console.log(failed ? `\n${failed} teste(s) falharam` : '\nTodos os testes passaram');
if (failed) process.exit(1);
