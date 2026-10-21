// Mapa UV de uma skin de Minecraft (formato 64x64).
// Cada parte do corpo é uma caixa (largura w, altura h, profundidade d) com uma origem
// de textura (u, v). As seis faces ficam dispostas sempre no mesmo padrão a partir da origem.

export const SKIN_SIZE = 64;

export type ArmModel = 'classic' | 'slim';
export type Layer = 'base' | 'overlay';
export type PartId = 'head' | 'body' | 'rightArm' | 'leftArm' | 'rightLeg' | 'leftLeg';
export type FaceId = 'top' | 'bottom' | 'right' | 'front' | 'left' | 'back';

export const PART_IDS: PartId[] = ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'];
export const FACE_IDS: FaceId[] = ['top', 'bottom', 'right', 'front', 'left', 'back'];
export const SIDE_FACES: FaceId[] = ['front', 'right', 'back', 'left'];

export const PART_LABEL: Record<PartId, string> = {
  head: 'Cabeça',
  body: 'Tronco',
  rightArm: 'Braço direito',
  leftArm: 'Braço esquerdo',
  rightLeg: 'Perna direita',
  leftLeg: 'Perna esquerda',
};

export const FACE_LABEL: Record<FaceId, string> = {
  top: 'Topo',
  bottom: 'Base',
  right: 'Lado direito',
  front: 'Frente',
  left: 'Lado esquerdo',
  back: 'Costas',
};

export const LAYER_LABEL: Record<Layer, string> = { base: 'Base', overlay: 'Externa' };

export interface Rect { x: number; y: number; w: number; h: number }

export interface BoxDef { w: number; h: number; d: number; u: number; v: number }

/** Retângulo de cada face dentro da textura, dado o box. */
export function faceRects(b: BoxDef): Record<FaceId, Rect> {
  const { u, v, w, h, d } = b;
  return {
    top: { x: u + d, y: v, w, h: d },
    bottom: { x: u + d + w, y: v, w, h: d },
    right: { x: u, y: v + d, w: d, h },
    front: { x: u + d, y: v + d, w, h },
    left: { x: u + d + w, y: v + d, w: d, h },
    back: { x: u + d + w + d, y: v + d, w, h },
  };
}

const ORIGINS: Record<PartId, { base: [number, number]; overlay: [number, number] }> = {
  head: { base: [0, 0], overlay: [32, 0] },
  body: { base: [16, 16], overlay: [16, 32] },
  rightArm: { base: [40, 16], overlay: [40, 32] },
  leftArm: { base: [32, 48], overlay: [48, 48] },
  rightLeg: { base: [0, 16], overlay: [0, 32] },
  leftLeg: { base: [16, 48], overlay: [0, 48] },
};

export function partSize(part: PartId, model: ArmModel): { w: number; h: number; d: number } {
  switch (part) {
    case 'head': return { w: 8, h: 8, d: 8 };
    case 'body': return { w: 8, h: 12, d: 4 };
    case 'rightArm':
    case 'leftArm': return { w: model === 'slim' ? 3 : 4, h: 12, d: 4 };
    default: return { w: 4, h: 12, d: 4 };
  }
}

export function boxOf(part: PartId, layer: Layer, model: ArmModel): BoxDef {
  const [u, v] = ORIGINS[part][layer];
  return { ...partSize(part, model), u, v };
}

/** Parte espelhada (lado oposto do corpo). */
export const MIRROR_PART: Record<PartId, PartId> = {
  head: 'head', body: 'body',
  rightArm: 'leftArm', leftArm: 'rightArm',
  rightLeg: 'leftLeg', leftLeg: 'rightLeg',
};

const MIRROR_FACE: Record<FaceId, FaceId> = {
  top: 'top', bottom: 'bottom', front: 'front', back: 'back', right: 'left', left: 'right',
};

export interface PixelInfo { part: PartId; layer: Layer; face: FaceId; lx: number; ly: number; rect: Rect }

interface LayoutData {
  /** Para cada pixel: índice na lista `infos` ou -1 se não usado. */
  owner: Int16Array;
  infos: { part: PartId; layer: Layer; face: FaceId; rect: Rect }[];
  /** Pixel espelhado correspondente (-1 se nenhum). */
  mirror: Int32Array;
}

const cache = new Map<ArmModel, LayoutData>();

export function layout(model: ArmModel): LayoutData {
  const hit = cache.get(model);
  if (hit) return hit;
  const owner = new Int16Array(SKIN_SIZE * SKIN_SIZE).fill(-1);
  const infos: LayoutData['infos'] = [];
  for (const part of PART_IDS) {
    for (const layer of ['base', 'overlay'] as Layer[]) {
      const rects = faceRects(boxOf(part, layer, model));
      for (const face of FACE_IDS) {
        const r = rects[face];
        const id = infos.length;
        infos.push({ part, layer, face, rect: r });
        for (let y = r.y; y < r.y + r.h; y++)
          for (let x = r.x; x < r.x + r.w; x++) owner[y * SKIN_SIZE + x] = id;
      }
    }
  }
  const mirror = new Int32Array(SKIN_SIZE * SKIN_SIZE).fill(-1);
  for (let i = 0; i < owner.length; i++) {
    const o = owner[i];
    if (o < 0) continue;
    const info = infos[o];
    const x = i % SKIN_SIZE, y = Math.floor(i / SKIN_SIZE);
    const lx = x - info.rect.x, ly = y - info.rect.y;
    const mPart = MIRROR_PART[info.part];
    const mFace = MIRROR_FACE[info.face];
    const mr = faceRects(boxOf(mPart, info.layer, model))[mFace];
    const mx = mr.x + (mr.w - 1 - lx);
    const my = mr.y + ly;
    mirror[i] = my * SKIN_SIZE + mx;
  }
  const data = { owner, infos, mirror };
  cache.set(model, data);
  return data;
}

export function pixelInfo(model: ArmModel, x: number, y: number): PixelInfo | null {
  if (x < 0 || y < 0 || x >= SKIN_SIZE || y >= SKIN_SIZE) return null;
  const L = layout(model);
  const o = L.owner[y * SKIN_SIZE + x];
  if (o < 0) return null;
  const info = L.infos[o];
  return { ...info, lx: x - info.rect.x, ly: y - info.rect.y };
}

export function isUsed(model: ArmModel, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= SKIN_SIZE || y >= SKIN_SIZE) return false;
  return layout(model).owner[y * SKIN_SIZE + x] >= 0;
}

export function mirrorIndex(model: ArmModel, idx: number): number {
  return layout(model).mirror[idx];
}
