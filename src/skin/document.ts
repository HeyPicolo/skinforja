import { SKIN_SIZE, type ArmModel } from './layout';

/** Cor RGBA empacotada em 32 bits na ordem da memória (little-endian: 0xAABBGGRR). */
export type Packed = number;

export interface RGBA { r: number; g: number; b: number; a: number }

const isLE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

export function pack(c: RGBA): Packed {
  return isLE
    ? ((c.a << 24) | (c.b << 16) | (c.g << 8) | c.r) >>> 0
    : ((c.r << 24) | (c.g << 16) | (c.b << 8) | c.a) >>> 0;
}

export function unpack(p: Packed): RGBA {
  return isLE
    ? { r: p & 255, g: (p >>> 8) & 255, b: (p >>> 16) & 255, a: (p >>> 24) & 255 }
    : { r: (p >>> 24) & 255, g: (p >>> 16) & 255, b: (p >>> 8) & 255, a: p & 255 };
}

export const TRANSPARENT: Packed = 0;

interface HistoryEntry {
  label: string;
  idx: Uint32Array;
  before: Uint32Array;
  after: Uint32Array;
  modelBefore: ArmModel;
  modelAfter: ArmModel;
}

/** Uma alteração em andamento (um traço do pincel, um preenchimento...). */
export class Stroke {
  readonly before = new Map<number, Packed>();
  constructor(private doc: SkinDoc, readonly label: string) {}

  set(i: number, color: Packed) {
    const px = this.doc.px;
    if (!this.before.has(i)) this.before.set(i, px[i]);
    px[i] = color;
  }

  get(i: number): Packed { return this.doc.px[i]; }

  /** Valor original do pixel antes deste traço começar. */
  original(i: number): Packed {
    const b = this.before.get(i);
    return b === undefined ? this.doc.px[i] : b;
  }

  touched(i: number) { return this.before.has(i); }

  /** Desfaz tudo que este traço pintou até agora (usado na prévia de linha/retângulo). */
  revert() {
    for (const [i, c] of this.before) this.doc.px[i] = c;
    this.before.clear();
  }
}

type Listener = () => void;

export class SkinDoc {
  readonly data = new Uint8ClampedArray(SKIN_SIZE * SKIN_SIZE * 4);
  readonly px = new Uint32Array(this.data.buffer);
  model: ArmModel = 'classic';
  rev = 0;
  /** Pixels de partida (modelo escolhido, skin importada) usados pela borracha que "volta ao original". */
  original: Uint32Array | null = null;

  setOriginal(px?: Uint32Array) { this.original = (px ?? this.px).slice(); }
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private listeners = new Set<Listener>();
  private active: Stroke | null = null;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  emit() {
    this.rev++;
    for (const l of this.listeners) l();
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  get undoLabel() { return this.undoStack[this.undoStack.length - 1]?.label; }
  get redoLabel() { return this.redoStack[this.redoStack.length - 1]?.label; }
  get historySize() { return this.undoStack.length; }

  begin(label: string): Stroke {
    if (this.active) this.commit();
    this.active = new Stroke(this, label);
    return this.active;
  }

  get current() { return this.active; }

  /** Fecha o traço e o registra no histórico (se mudou algo). */
  commit(modelAfter?: ArmModel) {
    const s = this.active;
    this.active = null;
    if (!s) return;
    const modelBefore = this.model;
    if (modelAfter) this.model = modelAfter;
    const changed: number[] = [];
    for (const [i, c] of s.before) if (this.px[i] !== c) changed.push(i);
    if (changed.length === 0 && modelBefore === this.model) { this.emit(); return; }
    const idx = new Uint32Array(changed);
    const before = new Uint32Array(changed.length);
    const after = new Uint32Array(changed.length);
    changed.forEach((i, k) => { before[k] = s.before.get(i)!; after[k] = this.px[i]; });
    this.undoStack.push({ label: s.label, idx, before, after, modelBefore, modelAfter: this.model });
    this.redoStack = [];
    this.emit();
  }

  cancel() {
    if (!this.active) return;
    this.active.revert();
    this.active = null;
    this.emit();
  }

  undo() {
    if (this.active) this.commit();
    const e = this.undoStack.pop();
    if (!e) return null;
    for (let k = 0; k < e.idx.length; k++) this.px[e.idx[k]] = e.before[k];
    this.model = e.modelBefore;
    this.redoStack.push(e);
    this.emit();
    return e.label;
  }

  redo() {
    const e = this.redoStack.pop();
    if (!e) return null;
    for (let k = 0; k < e.idx.length; k++) this.px[e.idx[k]] = e.after[k];
    this.model = e.modelAfter;
    this.undoStack.push(e);
    this.emit();
    return e.label;
  }

  /** Substitui a skin inteira como uma única ação desfazível. */
  replaceAll(pixels: Uint32Array, model: ArmModel, label: string) {
    const s = this.begin(label);
    for (let i = 0; i < pixels.length; i++) if (this.px[i] !== pixels[i]) s.set(i, pixels[i]);
    this.commit(model);
  }

  /** Carrega sem histórico (abertura de projeto). */
  load(pixels: Uint32Array, model: ArmModel) {
    this.active = null;
    this.px.set(pixels);
    this.model = model;
    this.undoStack = [];
    this.redoStack = [];
    this.emit();
  }

  snapshot(): Uint32Array { return this.px.slice(); }
}

export const doc = new SkinDoc();

// ---------- utilidades de cor ----------

export function hexToRgba(hex: string): RGBA | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 6) h += 'ff';
  if (!/^[0-9a-fA-F]{8}$/.test(h)) return null;
  const n = parseInt(h, 16);
  return { r: (n >>> 24) & 255, g: (n >>> 16) & 255, b: (n >>> 8) & 255, a: n & 255 };
}

export function rgbaToHex(c: RGBA, withAlpha = false): string {
  const h = (v: number) => v.toString(16).padStart(2, '0');
  return '#' + h(c.r) + h(c.g) + h(c.b) + (withAlpha && c.a !== 255 ? h(c.a) : '');
}

export function rgbToHsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

/** Clareia (amt>0) ou escurece (amt<0) uma cor; amt em -1..1. */
export function shade(c: RGBA, amt: number): RGBA {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return { r: f(c.r), g: f(c.g), b: f(c.b), a: c.a };
}
