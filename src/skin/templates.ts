// Coleção de modelos ORIGINAIS, desenhados pixel a pixel por código.
import { SKIN_SIZE, FACE_IDS, SIDE_FACES, boxOf, faceRects, type ArmModel, type FaceId, type Layer, type PartId } from './layout';
import { pack, hexToRgba, shade, type Packed } from './document';

export type Category = 'animais' | 'mobs' | 'personagens' | 'basico';

export const CATEGORY_LABEL: Record<Category, string> = {
  animais: 'Animais',
  mobs: 'Mobs',
  personagens: 'Personagens',
  basico: 'Começar do zero',
};

/** Um "pincel" de modelo: cor fixa ou função por pixel local (null = não pinta). */
type Pen = string | ((x: number, y: number, w: number, h: number, face: FaceId) => string | null);

const ARMS: PartId[] = ['rightArm', 'leftArm'];
const LEGS: PartId[] = ['rightLeg', 'leftLeg'];
const LIMBS: PartId[] = [...ARMS, ...LEGS];
const ALL: PartId[] = ['head', 'body', ...LIMBS];

class Painter {
  readonly px = new Uint32Array(SKIN_SIZE * SKIN_SIZE);
  private seed: number;
  private cache = new Map<string, Packed>();

  constructor(readonly model: ArmModel, seed = 7) { this.seed = seed; }

  rnd() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Cor com variação sutil de tom (para pelos, tecidos, metais). */
  tex(hex: string, amt = 0.06): Pen {
    const base = hexToRgba(hex)!;
    return () => {
      const c = shade(base, (this.rnd() * 2 - 1) * amt);
      return '#' + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('');
    };
  }

  private color(hex: string): Packed {
    let p = this.cache.get(hex);
    if (p === undefined) { p = pack(hexToRgba(hex)!); this.cache.set(hex, p); }
    return p;
  }

  private paint(part: PartId, face: FaceId, layer: Layer, pen: Pen, x0 = 0, y0 = 0, w?: number, h?: number) {
    const r = faceRects(boxOf(part, layer, this.model))[face];
    const ww = w ?? r.w, hh = h ?? r.h;
    for (let y = y0; y < y0 + hh; y++)
      for (let x = x0; x < x0 + ww; x++) {
        if (x < 0 || y < 0 || x >= r.w || y >= r.h) continue;
        const c = typeof pen === 'string' ? pen : pen(x, y, r.w, r.h, face);
        if (c) this.px[(r.y + y) * SKIN_SIZE + r.x + x] = this.color(c);
      }
  }

  /** Pinta todas as faces das partes. */
  fill(parts: PartId | PartId[], pen: Pen, layer: Layer = 'base', faces: FaceId[] = FACE_IDS) {
    for (const p of ([] as PartId[]).concat(parts)) for (const f of faces) this.paint(p, f, layer, pen);
  }

  /** Faixa ao redor da parte (frente, lados e costas), das linhas y0 até y1. */
  wrap(parts: PartId | PartId[], y0: number, y1: number, pen: Pen, layer: Layer = 'base') {
    for (const p of ([] as PartId[]).concat(parts))
      for (const f of SIDE_FACES) this.paint(p, f, layer, pen, 0, y0, 99, y1 - y0 + 1);
  }

  /** Retângulo numa face específica. */
  rect(part: PartId, face: FaceId, x: number, y: number, w: number, h: number, pen: Pen, layer: Layer = 'base') {
    this.paint(part, face, layer, pen, x, y, w, h);
  }

  dot(part: PartId, face: FaceId, x: number, y: number, hex: string, layer: Layer = 'base') {
    this.paint(part, face, layer, hex, x, y, 1, 1);
  }

  /** Desenha a partir de um mapa de caracteres (cada letra = cor da legenda, '.' = pula). */
  map(part: PartId, face: FaceId, rows: string[], legend: Record<string, Pen>, layer: Layer = 'base', ox = 0, oy = 0) {
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const pen = legend[ch];
        if (pen) this.paint(part, face, layer, pen, ox + x, oy + y, 1, 1);
      }));
  }

  /** Mesmo mapa nos dois lados (direito/esquerdo) de pares de partes. */
  both(parts: PartId[], fn: (p: PartId) => void) { parts.forEach(fn); }
}

export interface Template {
  id: string;
  name: string;
  category: Category;
  model: ArmModel;
  description: string;
  draw: () => Uint32Array;
}

// ---------------------------------------------------------------------------
// Animais
// ---------------------------------------------------------------------------

function fox(): Uint32Array {
  const P = new Painter('classic', 11);
  const fur = P.tex('#d9752b', 0.07), white = P.tex('#f3ece1', 0.04), dark = P.tex('#3a2a22', 0.06);
  P.fill(ALL, fur);
  // peito e barriga claros
  P.rect('body', 'front', 2, 0, 4, 12, white);
  P.rect('body', 'front', 1, 0, 6, 3, white);
  // patas escuras
  P.wrap(LEGS, 8, 11, dark); P.fill(LEGS, dark, 'base', ['bottom']);
  P.wrap(ARMS, 9, 11, dark); P.fill(ARMS, dark, 'base', ['bottom']);
  // rosto
  P.map('head', 'front', [
    '........',
    '........',
    '........',
    '.EE..EE.',
    '.Ek..kE.',
    'WWWWWWWW',
    '.WWNNWW.',
    '..WWWW..',
  ], { E: '#f2c14e', k: '#1d1410', W: white, N: '#1d1410' });
  P.rect('head', 'bottom', 0, 0, 8, 4, white);
  P.rect('head', 'right', 0, 5, 3, 3, white); P.rect('head', 'left', 5, 5, 3, 3, white);
  // orelhas (camada externa)
  P.map('head', 'front', [
    'OO....OO',
    'Od....dO',
  ], { O: '#c4621f', d: '#2f201a' }, 'overlay');
  P.map('head', 'top', ['OO....OO', 'OO....OO'], { O: '#c4621f' }, 'overlay', 0, 6);
  // cauda (no tronco, costas)
  P.rect('body', 'back', 2, 7, 4, 5, P.tex('#c4621f', 0.06));
  P.rect('body', 'back', 3, 10, 2, 2, white);
  // pelo felpudo nas bordas do peito (camada externa)
  P.rect('body', 'front', 2, 0, 4, 2, white, 'overlay');
  return P.px;
}

function cat(): Uint32Array {
  const P = new Painter('slim', 23);
  const grey = '#8c8f96', stripe = '#55585f';
  const fur: Pen = (x, y, _w, _h, face) => {
    // listras horizontais irregulares
    if ((face === 'top' && x % 3 === 0) || (face !== 'top' && face !== 'bottom' && (y % 4 === 1 || (y % 4 === 2 && x % 3 === 0))))
      return stripe;
    return null;
  };
  P.fill(ALL, P.tex(grey, 0.05));
  P.fill(['body', ...LIMBS], fur);
  P.fill('head', fur, 'base', ['top', 'back', 'left', 'right']);
  P.rect('body', 'front', 2, 1, 4, 8, P.tex('#e8e3dc', 0.03));
  P.wrap(LIMBS, 10, 11, '#e8e3dc'); P.fill(LIMBS, '#e8e3dc', 'base', ['bottom']);
  P.map('head', 'front', [
    'S.S..S.S',
    '........',
    '........',
    '.GG..GG.',
    '.Gk..kG.',
    '...pp...',
    '.w.mm.w.',
    '........',
  ], { S: stripe, G: '#7cc46a', k: '#141414', p: '#e79aa3', m: '#d9d4cc', w: '#f4f4f4' });
  P.map('head', 'front', ['OO....OO', 'Op....pO'], { O: '#7b7e85', p: '#e79aa3' }, 'overlay');
  // bigodes saindo do rosto
  P.dot('head', 'front', 0, 6, '#f4f4f4', 'overlay'); P.dot('head', 'front', 7, 6, '#f4f4f4', 'overlay');
  // coleira com sininho
  P.wrap('body', 0, 0, '#c8323c');
  P.dot('body', 'front', 3, 1, '#f2c14e'); P.dot('body', 'front', 4, 1, '#f2c14e');
  return P.px;
}

function panda(): Uint32Array {
  const P = new Painter('classic', 5);
  const w = P.tex('#f1f1ee', 0.035), k = P.tex('#26262b', 0.05);
  P.fill(['head', 'body'], w);
  P.fill(LIMBS, k);
  P.wrap('body', 0, 3, k); // faixa preta nos ombros
  P.rect('body', 'front', 2, 0, 4, 3, w);
  P.map('head', 'front', [
    '........',
    '........',
    '.KK..KK.',
    'KKe..eKK',
    '.KK..KK.',
    '...NN...',
    '...mm...',
    '........',
  ], { K: '#26262b', e: '#ffffff', N: '#26262b', m: '#c99' });
  P.map('head', 'front', ['KK....KK', 'KK....KK'], { K: '#26262b' }, 'overlay');
  P.map('head', 'top', ['KK....KK', 'KK....KK'], { K: '#26262b' }, 'overlay', 0, 6);
  // bambu na mão direita
  P.rect('rightArm', 'front', 0, 9, 4, 1, '#6aa84f');
  P.rect('rightArm', 'front', 1, 8, 1, 4, '#8ccf6b', 'overlay');
  return P.px;
}

// ---------------------------------------------------------------------------
// Mobs (versões estilizadas e originais)
// ---------------------------------------------------------------------------

function zombie(): Uint32Array {
  const P = new Painter('classic', 41);
  const skin = P.tex('#6f9a68', 0.08), shirt = P.tex('#6b4c7a', 0.08), pants = P.tex('#5a4636', 0.07);
  P.fill(ALL, skin);
  P.wrap('body', 0, 11, shirt); P.fill('body', shirt, 'base', ['top', 'bottom']);
  P.wrap(ARMS, 0, 4, shirt); P.fill(ARMS, shirt, 'base', ['top']);
  // camisa rasgada (pele aparecendo)
  P.rect('body', 'front', 1, 8, 2, 2, skin); P.rect('body', 'front', 5, 10, 2, 2, skin);
  P.rect('body', 'back', 3, 6, 2, 3, skin);
  P.wrap(LEGS, 0, 11, pants); P.fill(LEGS, pants, 'base', ['top']);
  P.wrap(LEGS, 11, 11, '#2c2420'); P.fill(LEGS, '#2c2420', 'base', ['bottom']);
  P.rect('rightLeg', 'front', 1, 5, 2, 2, skin);
  // rosto
  P.map('head', 'front', [
    'hhhhhhhh',
    'h......h',
    '........',
    '.YY..YY.',
    '.dd..dd.',
    '...dd...',
    '.d.dd.d.',
    '..dddd..',
  ], { h: '#3f5a3a', Y: '#e8e05a', d: '#3e5638' });
  P.fill('head', P.tex('#3f5a3a', 0.06), 'base', ['top']);
  // remendos e pontos (camada externa)
  P.map('head', 'right', ['......', '.x.x..', '..x...'], { x: '#2a2a2a' }, 'overlay', 1, 4);
  P.rect('leftArm', 'front', 0, 7, 4, 1, '#d8d0bd', 'overlay');
  return P.px;
}

function skeleton(): Uint32Array {
  const P = new Painter('slim', 3);
  const bone = P.tex('#e6e1d3', 0.04), boneDk = '#b9b3a3', gap = '#3a3530';
  P.fill(ALL, bone);
  // costelas
  P.map('body', 'front', [
    '...bb...',
    '.gggggg.',
    '...bb...',
    '.gggggg.',
    '...bb...',
    '.gggggg.',
    '...bb...',
    'gggbbggg',
    'gggbbggg',
    '.bbbbbb.',
    '.bbbbbb.',
    'b......b',
  ], { b: boneDk, g: gap });
  P.map('body', 'back', ['...bb...', '...bb...', '...bb...', '...bb...', '...bb...', '...bb...', '...bb...'], { b: boneDk });
  // ossos finos dos membros (laterais escuras)
  P.fill(LIMBS, (x, _y, w, _h, face) => (face !== 'top' && face !== 'bottom' && (x === 0 || x === w - 1) ? '#8f897b' : null));
  P.wrap(LIMBS, 5, 6, boneDk);
  P.map('head', 'front', [
    '........',
    '........',
    '.KKK.KKK',
    '.KrK.KrK',
    '.KKK.KKK',
    '....KK..',
    '.TTTTTT.',
    '.T.T.T..',
  ], { K: '#141210', r: '#d23a2e', T: '#8f897b' });
  // bandana de pirata (camada externa)
  const red = P.tex('#b5302a', 0.06);
  P.fill('head', red, 'overlay', ['top']);
  P.wrap('head', 0, 2, red, 'overlay');
  P.map('head', 'front', ['.w..w..w', '..w..w..'], { w: '#f1e8d6' }, 'overlay');
  P.map('head', 'back', ['RR', 'RR', 'RR', '.R'], { R: '#9b2722' }, 'overlay', 3, 3);
  return P.px;
}

function robot(): Uint32Array {
  const P = new Painter('classic', 17);
  const metal = P.tex('#8a96a6', 0.05), dark = P.tex('#4b5563', 0.05), orange = '#f08a24';
  P.fill(ALL, metal);
  // juntas escuras
  P.wrap(LIMBS, 5, 6, dark); P.wrap(LEGS, 0, 0, dark); P.wrap('body', 11, 11, dark);
  P.fill(LIMBS, dark, 'base', ['bottom']);
  // visor
  P.map('head', 'front', [
    'oooooooo',
    'm......m',
    'm......m',
    'VVVVVVVV',
    'VcVVVVcV',
    'm......m',
    'm.gggg.m',
    'mmmmmmmm',
  ], { o: orange, m: '#6b7685', V: '#123c48', c: '#5ff2ff', g: '#2a2f38' });
  P.rect('head', 'right', 2, 2, 4, 4, dark); P.dot('head', 'right', 3, 3, orange);
  P.rect('head', 'left', 2, 2, 4, 4, dark); P.dot('head', 'left', 4, 3, orange);
  // painel do peito
  P.map('body', 'front', [
    '........',
    '.dddddd.',
    '.dGdRdd.',
    '.dddddd.',
    '.dOOOOd.',
    '.dddddd.',
    '........',
    '..r..r..',
    '........',
  ], { d: '#2a2f38', G: '#4ade80', R: '#f87171', O: orange, r: '#6b7685' });
  // antena e ombreiras (camada externa)
  P.dot('head', 'top', 3, 3, '#2a2f38', 'overlay'); P.dot('head', 'top', 4, 3, orange, 'overlay');
  P.wrap(ARMS, 0, 1, orange, 'overlay'); P.fill(ARMS, orange, 'overlay', ['top']);
  P.wrap(LEGS, 10, 11, '#4b5563', 'overlay');
  return P.px;
}

// ---------------------------------------------------------------------------
// Personagens
// ---------------------------------------------------------------------------

const SKIN_LIGHT = '#e9b68e';
const SKIN_TAN = '#c98c62';

function face(P: Painter, eye: string, skin: string, mouth = '#a0604a') {
  P.map('head', 'front', [
    '........',
    '........',
    '........',
    '.wE..Ew.',
    '........',
    '........',
    '..mmmm..',
    '........',
  ], { w: '#ffffff', E: eye, m: mouth });
  P.dot('head', 'front', 3, 5, shadeHex(skin, -0.12)); P.dot('head', 'front', 4, 5, shadeHex(skin, -0.12));
}

function shadeHex(hex: string, amt: number) {
  const c = shade(hexToRgba(hex)!, amt);
  return '#' + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function knight(): Uint32Array {
  const P = new Painter('classic', 29);
  const steel = P.tex('#a9b1bb', 0.05), steelDk = '#6c7480', blue = P.tex('#2f4fa8', 0.05), gold = '#e0b43a';
  P.fill(ALL, steel);
  // malha de ferro nos braços e pernas
  P.fill(LIMBS, (x, y) => ((x + y) % 2 === 0 ? '#8d95a0' : null), 'base', SIDE_FACES);
  // capacete com fenda do visor
  P.map('head', 'front', [
    'ssssssss',
    's......s',
    's......s',
    'kkkkkkkk',
    'sk.kk.ks',
    's......s',
    's.h..h.s',
    'ssssssss',
  ], { s: steelDk, k: '#1c1f24', h: '#3b414a' });
  // túnica azul com cruz dourada (camada externa)
  P.wrap('body', 0, 11, blue, 'overlay');
  P.map('body', 'front', ['...YY...', '...YY...', '.YYYYYY.', '...YY...', '...YY...', '...YY...'], { Y: gold }, 'overlay', 0, 2);
  P.wrap('body', 9, 9, '#5b3a22', 'overlay'); P.dot('body', 'front', 3, 9, gold, 'overlay'); P.dot('body', 'front', 4, 9, gold, 'overlay');
  // pluma vermelha
  P.map('head', 'top', ['...RR...', '...RR...', '...RR...', '...RR...'], { R: '#c8323c' }, 'overlay', 0, 2);
  P.map('head', 'back', ['...RR...', '...RR...', '...rr...'], { R: '#c8323c', r: '#9b2722' }, 'overlay');
  // manoplas e botas
  P.wrap(ARMS, 10, 11, steelDk); P.wrap(LEGS, 10, 11, steelDk);
  P.wrap(ARMS, 0, 2, '#c4ccd6', 'overlay'); P.fill(ARMS, '#c4ccd6', 'overlay', ['top']);
  return P.px;
}

function wizard(): Uint32Array {
  const P = new Painter('classic', 13);
  const robe = P.tex('#5b3c99', 0.06), star = '#f6d860', beard = P.tex('#e9e6e0', 0.04);
  P.fill(ALL, robe);
  P.fill('head', P.tex(SKIN_LIGHT, 0.03));
  face(P, '#3060a0', SKIN_LIGHT);
  // barba longa
  P.map('head', 'front', ['........', '........', '........', '........', '........', 'BB....BB', 'BBBBBBBB', '.BBBBBB.'], { B: beard });
  P.map('body', 'front', ['.BBBBBB.', '..BBBB..', '..BBBB..', '...BB...'], { B: beard }, 'overlay');
  P.map('head', 'front', ['BBB..BBB'], { B: beard }, 'overlay', 0, 5);
  P.map('head', 'front', ['........', '.BB..BB.'], { B: '#cfcac0' }, 'overlay', 0, 2);
  // estrelas no manto
  P.fill(['body', ...LIMBS], (x, y, _w, _h, face) => ((x * 7 + y * 3 + face.length) % 11 === 0 ? star : null), 'base', SIDE_FACES);
  P.wrap('body', 8, 8, '#d9a441');
  P.wrap(ARMS, 9, 11, P.tex(SKIN_LIGHT, 0.03)); P.fill(ARMS, SKIN_LIGHT, 'base', ['bottom']);
  P.wrap(ARMS, 7, 8, '#7a55c4', 'overlay');
  P.wrap(LEGS, 11, 11, '#3b2a20'); P.fill(LEGS, '#3b2a20', 'base', ['bottom']);
  // chapéu pontudo (camada externa)
  const hat = P.tex('#4a2f85', 0.05);
  P.fill('head', hat, 'overlay', ['top']);
  P.wrap('head', 0, 1, hat, 'overlay');
  P.wrap('head', 2, 2, star, 'overlay');
  P.fill('head', '#3e2c22', 'base', ['top']);
  P.map('head', 'top', ['........', '...SS...', '..S..S..', '........'], { S: star }, 'overlay', 0, 2);
  return P.px;
}

function astronaut(): Uint32Array {
  const P = new Painter('classic', 37);
  const suit = P.tex('#eef0f2', 0.03), grey = '#b9bec6', orange = '#f08a24';
  P.fill(ALL, suit);
  P.fill('head', P.tex(SKIN_TAN, 0.03));
  P.fill('head', '#2b1d16', 'base', ['top', 'back']);
  P.wrap('head', 0, 1, '#2b1d16');
  face(P, '#3b2a20', SKIN_TAN);
  // capacete com visor dourado (camada externa)
  P.fill('head', '#f4f5f7', 'overlay', ['top', 'back', 'left', 'right', 'bottom']);
  P.map('head', 'front', [
    'WWWWWWWW',
    'WGGGGGGW',
    'GGgGGGGG',
    'GgGGGGGG',
    'GGGGGGGG',
    'GGGGGGgG',
    'WGGGGGGW',
    'WWWWWWWW',
  ], { W: '#f4f5f7', G: '#d4a63a', g: '#f6e4a8' }, 'overlay');
  // listras e detalhes do traje
  P.wrap(ARMS, 3, 3, orange); P.wrap(LEGS, 6, 6, orange);
  P.wrap(LIMBS, 10, 11, grey); P.fill(LIMBS, grey, 'base', ['bottom']);
  P.map('body', 'front', ['........', '.RBGY...', '........', '..dddd..', '..dWWd..', '..dddd..'], { R: '#ef4444', B: '#3b82f6', G: '#22c55e', Y: '#facc15', d: grey, W: '#64748b' }, 'base', 0, 2);
  P.wrap('body', 10, 11, grey);
  // mochila de oxigênio (camada externa nas costas)
  P.rect('body', 'back', 1, 1, 6, 9, '#cfd3d9', 'overlay');
  P.rect('body', 'back', 2, 2, 1, 7, grey, 'overlay'); P.rect('body', 'back', 5, 2, 1, 7, grey, 'overlay');
  P.dot('body', 'back', 3, 3, orange, 'overlay'); P.dot('body', 'back', 4, 3, orange, 'overlay');
  P.wrap(ARMS, 0, 1, '#f4f5f7', 'overlay');
  return P.px;
}

function adventurer(): Uint32Array {
  const P = new Painter('classic', 19);
  const tunic = P.tex('#3f7d4e', 0.06), leather = '#6b4428', hair = P.tex('#5a3a22', 0.07);
  P.fill(ALL, P.tex(SKIN_TAN, 0.03));
  face(P, '#2f6b3a', SKIN_TAN);
  P.fill('head', hair, 'base', ['top', 'back']);
  P.wrap('head', 0, 1, hair);
  P.rect('head', 'front', 0, 2, 1, 2, hair); P.rect('head', 'front', 7, 2, 1, 2, hair);
  P.rect('head', 'right', 0, 2, 8, 3, hair); P.rect('head', 'left', 0, 2, 8, 3, hair);
  P.rect('head', 'right', 5, 2, 3, 1, P.tex(SKIN_TAN, 0.02)); P.rect('head', 'left', 0, 2, 3, 1, P.tex(SKIN_TAN, 0.02));
  // franja (camada externa)
  P.map('head', 'front', ['HHHHHHHH', 'HH.HHH.H'], { H: '#4a2f1b' }, 'overlay', 0, 0);
  P.fill('head', '#4a2f1b', 'overlay', ['top']);
  // túnica, cinto e bolsa transversal
  P.wrap('body', 0, 11, tunic); P.fill('body', tunic, 'base', ['top', 'bottom']);
  P.wrap(ARMS, 0, 5, tunic); P.fill(ARMS, tunic, 'base', ['top']);
  P.wrap('body', 8, 8, leather); P.dot('body', 'front', 3, 8, '#d9b74a'); P.dot('body', 'front', 4, 8, '#d9b74a');
  for (let i = 0; i < 8; i++) P.dot('body', 'front', i, i, '#8a5a34', 'overlay');
  P.rect('body', 'back', 1, 6, 4, 3, '#8a5a34', 'overlay');
  // calça e botas
  P.wrap(LEGS, 0, 11, P.tex('#7a6a52', 0.05)); P.fill(LEGS, '#7a6a52', 'base', ['top']);
  P.wrap(LEGS, 8, 11, P.tex(leather, 0.05)); P.fill(LEGS, leather, 'base', ['bottom']);
  P.wrap(LEGS, 8, 8, '#8a5a34', 'overlay');
  // braçadeiras
  P.wrap(ARMS, 9, 10, leather);
  return P.px;
}

// ---------------------------------------------------------------------------
// Começar do zero
// ---------------------------------------------------------------------------

function neutral(): Uint32Array {
  const P = new Painter('classic', 2);
  P.fill(ALL, P.tex('#d9b99b', 0.02));
  face(P, '#4b5563', '#d9b99b');
  P.fill('head', '#4b3a2f', 'base', ['top']);
  P.wrap('head', 0, 0, '#4b3a2f');
  P.wrap('body', 0, 11, '#f2f2f2'); P.fill('body', '#f2f2f2', 'base', ['top', 'bottom']);
  P.wrap(ARMS, 0, 3, '#f2f2f2'); P.fill(ARMS, '#f2f2f2', 'base', ['top']);
  P.wrap(LEGS, 0, 7, '#6b7280'); P.fill(LEGS, '#6b7280', 'base', ['top']);
  P.wrap(LEGS, 10, 11, '#374151'); P.fill(LEGS, '#374151', 'base', ['bottom']);
  return P.px;
}

function blank(): Uint32Array {
  const P = new Painter('classic', 1);
  P.fill(ALL, '#e5e7eb');
  return P.px;
}

export const TEMPLATES: Template[] = [
  { id: 'raposa', name: 'Raposa', category: 'animais', model: 'classic', description: 'Pelo laranja, peito claro e patas escuras.', draw: fox },
  { id: 'gato', name: 'Gato listrado', category: 'animais', model: 'slim', description: 'Gato cinza com listras e coleira.', draw: cat },
  { id: 'panda', name: 'Panda', category: 'animais', model: 'classic', description: 'Preto e branco, com um broto de bambu.', draw: panda },
  { id: 'zumbi', name: 'Zumbi', category: 'mobs', model: 'classic', description: 'Roupa rasgada e olhos amarelos.', draw: zombie },
  { id: 'esqueleto', name: 'Esqueleto pirata', category: 'mobs', model: 'slim', description: 'Ossos finos e bandana vermelha.', draw: skeleton },
  { id: 'robo', name: 'Robô sentinela', category: 'mobs', model: 'classic', description: 'Placas de metal e visor luminoso.', draw: robot },
  { id: 'cavaleiro', name: 'Cavaleiro', category: 'personagens', model: 'classic', description: 'Armadura, túnica azul e pluma.', draw: knight },
  { id: 'mago', name: 'Mago', category: 'personagens', model: 'classic', description: 'Manto estrelado, chapéu e barba.', draw: wizard },
  { id: 'astronauta', name: 'Astronauta', category: 'personagens', model: 'classic', description: 'Traje branco e visor dourado.', draw: astronaut },
  { id: 'aventureiro', name: 'Aventureiro', category: 'personagens', model: 'classic', description: 'Túnica verde, cinto e botas.', draw: adventurer },
];

export const STARTERS: Template[] = [
  { id: 'neutra', name: 'Base neutra', category: 'basico', model: 'classic', description: 'Corpo simples com camiseta e bermuda.', draw: neutral },
  { id: 'branco', name: 'Em branco', category: 'basico', model: 'classic', description: 'Tudo cinza claro, camada externa vazia.', draw: blank },
];

export function templateById(id: string) {
  return [...TEMPLATES, ...STARTERS].find((t) => t.id === id);
}
