// Controlador de pintura compartilhado pelo editor 2D e pela visualização 3D.
import { doc, type Stroke } from './document';
import { TOOLS, SHAPE_TOOLS, dab, drawShape, floodFill, pickColor, strokeSegment, type PaintOptions, type ToolId } from './tools';
import { isUsed, type Rect } from './layout';
import { useApp, rgbaKey } from '../store';

interface Session {
  stroke: Stroke | null;
  tool: ToolId;
  x0: number; y0: number;
  lx: number; ly: number;
  clip: Rect | null;
  opts: PaintOptions;
}

let session: Session | null = null;

function options(tool: ToolId, filledRect: boolean): PaintOptions {
  const s = useApp.getState();
  return { tool, color: s.color, size: s.size, mirror: s.mirror, model: doc.model, noise: s.noise, filledRect };
}

function labelFor(tool: ToolId) {
  return TOOLS.find((t) => t.id === tool)?.label ?? 'Edição';
}

export function pick(x: number, y: number) {
  const c = pickColor(doc.px, x, y);
  const app = useApp.getState();
  if (c) {
    app.setColor(c, true);
  } else {
    app.showToast('Pixel transparente: escolha outro ponto.');
  }
}

/** Começa uma ação. `alt` força o conta-gotas; `shift` deixa o retângulo preenchido. */
export function beginPaint(x: number, y: number, clip: Rect | null, mods: { alt?: boolean; shift?: boolean } = {}) {
  const app = useApp.getState();
  let tool = app.tool;
  if (mods.alt) tool = 'picker';
  if (tool === 'picker') {
    pick(x, y);
    if (!mods.alt) app.setTool(app.prevTool === 'picker' ? 'pencil' : app.prevTool);
    session = null;
    return;
  }
  if (!isUsed(doc.model, x, y)) return;
  const opts = options(tool, !!mods.shift);
  const stroke = doc.begin(labelFor(tool));
  session = { stroke, tool, x0: x, y0: y, lx: x, ly: y, clip, opts };
  if (tool === 'fill') {
    floodFill(stroke, opts, x, y);
    endPaint();
    return;
  }
  if (SHAPE_TOOLS.includes(tool)) drawShape(stroke, opts, x, y, x, y, clip);
  else dab(stroke, opts, x, y, clip);
  doc.emit();
}

export function movePaint(x: number, y: number, clipOverride?: Rect | null) {
  const s = session;
  if (!s || !s.stroke) return;
  if (x === s.lx && y === s.ly) return;
  if (SHAPE_TOOLS.includes(s.tool)) {
    drawShape(s.stroke, s.opts, s.x0, s.y0, x, y, s.clip);
  } else {
    // no 3D, ao passar para outra face o traço continua dentro da nova face
    const clip = clipOverride !== undefined ? clipOverride : s.clip;
    if (clip !== s.clip) { dab(s.stroke, s.opts, x, y, clip); s.clip = clip; }
    else strokeSegment(s.stroke, s.opts, s.lx, s.ly, x, y, clip);
  }
  s.lx = x; s.ly = y;
  doc.emit();
}

export function endPaint() {
  const s = session;
  session = null;
  if (!s || !s.stroke) return;
  doc.commit();
  if (s.tool !== 'eraser' && s.tool !== 'lighten' && s.tool !== 'darken') {
    useApp.getState().pushRecent(rgbaKey(s.opts.color));
  }
}

export function isPainting() { return session !== null; }
