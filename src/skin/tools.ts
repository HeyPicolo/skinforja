import { SKIN_SIZE, isUsed, mirrorIndex, layout, type ArmModel, type Rect } from './layout';
import { pack, unpack, shade, TRANSPARENT, type RGBA, type Stroke, type Packed } from './document';

export type ToolId =
  | 'pencil' | 'brush' | 'eraser' | 'fill' | 'picker'
  | 'noise' | 'lighten' | 'darken' | 'line' | 'rect';

export interface ToolDef { id: ToolId; label: string; key: string; hint: string }

export const TOOLS: ToolDef[] = [
  { id: 'pencil', label: 'Lápis', key: 'P', hint: 'Pinta um pixel por vez' },
  { id: 'brush', label: 'Pincel', key: 'B', hint: 'Pinta com o tamanho escolhido' },
  { id: 'eraser', label: 'Borracha', key: 'E', hint: 'Apaga para transparente' },
  { id: 'fill', label: 'Balde', key: 'G', hint: 'Preenche a área da mesma cor' },
  { id: 'picker', label: 'Conta-gotas', key: 'I', hint: 'Pega uma cor da skin (ou segure Alt)' },
  { id: 'noise', label: 'Textura', key: 'N', hint: 'Pinta com variação sutil de tom' },
  { id: 'lighten', label: 'Clarear', key: 'L', hint: 'Deixa os pixels mais claros' },
  { id: 'darken', label: 'Escurecer', key: 'D', hint: 'Deixa os pixels mais escuros' },
  { id: 'line', label: 'Linha', key: 'U', hint: 'Arraste para traçar uma linha' },
  { id: 'rect', label: 'Retângulo', key: 'R', hint: 'Arraste para desenhar um retângulo (Shift: preenchido)' },
];

export const SIZE_TOOLS: ToolId[] = ['brush', 'eraser', 'noise', 'lighten', 'darken'];
export const SHAPE_TOOLS: ToolId[] = ['line', 'rect'];

export interface PaintOptions {
  tool: ToolId;
  color: RGBA;
  size: number;
  mirror: boolean;
  model: ArmModel;
  noise: number; // 0..0.4
  filledRect?: boolean;
}

const idx = (x: number, y: number) => y * SKIN_SIZE + x;

function inside(r: Rect | null, x: number, y: number) {
  return !r || (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);
}

/** Calcula a cor final de um pixel para a ferramenta, a partir do valor original. */
function colorFor(o: PaintOptions, original: Packed): Packed | null {
  switch (o.tool) {
    case 'eraser': return TRANSPARENT;
    case 'lighten':
    case 'darken': {
      const c = unpack(original);
      if (c.a === 0) return null;
      return pack(shade(c, o.tool === 'lighten' ? 0.14 : -0.14));
    }
    case 'noise': {
      const amt = (Math.random() * 2 - 1) * o.noise;
      return pack(shade(o.color, amt));
    }
    default: return pack(o.color);
  }
}

/** Pinta um pixel (e seu espelho, se ativo). */
export function plot(s: Stroke, o: PaintOptions, x: number, y: number, fixed?: Packed) {
  if (!isUsed(o.model, x, y)) return;
  const once = o.tool === 'lighten' || o.tool === 'darken' || o.tool === 'noise';
  const apply = (i: number, color?: Packed | null) => {
    if (once && s.touched(i)) return;
    const c = color !== undefined ? color : colorFor(o, s.original(i));
    if (c === null || c === undefined) return;
    s.set(i, c);
  };
  const i = idx(x, y);
  const c = fixed !== undefined ? fixed : colorFor(o, s.original(i));
  if (!(once && s.touched(i)) && c !== null) s.set(i, c);
  if (o.mirror) {
    const m = mirrorIndex(o.model, i);
    if (m >= 0 && m !== i) {
      // textura usa a mesma cor sorteada para ficar simétrica; clarear/escurecer calcula do original
      apply(m, o.tool === 'noise' ? c : undefined);
    }
  }
}

/** Aplica o pincel (quadrado do tamanho escolhido) centrado em x,y. */
export function dab(s: Stroke, o: PaintOptions, x: number, y: number, clip: Rect | null) {
  const size = o.tool === 'pencil' ? 1 : SIZE_TOOLS.includes(o.tool) ? o.size : 1;
  const start = -Math.floor((size - 1) / 2);
  for (let dy = 0; dy < size; dy++)
    for (let dx = 0; dx < size; dx++) {
      const px = x + start + dx, py = y + start + dy;
      if (inside(clip, px, py)) plot(s, o, px, py);
    }
}

/** Linha de Bresenham chamando fn em cada ponto. */
export function bresenham(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => void) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    fn(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function strokeSegment(s: Stroke, o: PaintOptions, x0: number, y0: number, x1: number, y1: number, clip: Rect | null) {
  bresenham(x0, y0, x1, y1, (x, y) => dab(s, o, x, y, clip));
}

/** Desenha a forma (linha ou retângulo) do ponto inicial ao atual, refazendo a prévia. */
export function drawShape(s: Stroke, o: PaintOptions, x0: number, y0: number, x1: number, y1: number, clip: Rect | null) {
  s.revert();
  if (clip) {
    x1 = Math.max(clip.x, Math.min(clip.x + clip.w - 1, x1));
    y1 = Math.max(clip.y, Math.min(clip.y + clip.h - 1, y1));
  }
  const color = pack(o.color);
  const put = (x: number, y: number) => { if (inside(clip, x, y)) plot(s, o, x, y, color); };
  if (o.tool === 'line') {
    bresenham(x0, y0, x1, y1, put);
    return;
  }
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1);
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++)
      if (o.filledRect || x === xa || x === xb || y === ya || y === yb) put(x, y);
}

/** Balde: preenche a região contígua da mesma cor, sem sair da face clicada. */
export function floodFill(s: Stroke, o: PaintOptions, x: number, y: number) {
  const L = layout(o.model);
  const owner = L.owner[idx(x, y)];
  if (owner < 0) return;
  const rect = L.infos[owner].rect;
  const target = s.get(idx(x, y));
  const color = pack(o.color);
  if (target === color && !o.mirror) return;
  const seen = new Uint8Array(SKIN_SIZE * SKIN_SIZE);
  const stack = [x, y];
  const pts: number[] = [];
  while (stack.length) {
    const py = stack.pop()!, px = stack.pop()!;
    if (!inside(rect, px, py)) continue;
    const i = idx(px, py);
    if (seen[i] || s.get(i) !== target) continue;
    seen[i] = 1;
    pts.push(px, py);
    stack.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1);
  }
  for (let k = 0; k < pts.length; k += 2) plot(s, o, pts[k], pts[k + 1], color);
}

export function pickColor(px: Uint32Array, x: number, y: number): RGBA | null {
  if (x < 0 || y < 0 || x >= SKIN_SIZE || y >= SKIN_SIZE) return null;
  const c = unpack(px[idx(x, y)]);
  return c.a === 0 ? null : c;
}
