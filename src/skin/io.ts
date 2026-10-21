import { zipSync, strToU8 } from 'fflate';
import { SKIN_SIZE, FACE_IDS, faceRects, type ArmModel, type BoxDef, type FaceId } from './layout';

export class ImportError extends Error {}

/** Desenha os pixels num canvas 64x64. */
export function pixelsToCanvas(px: Uint32Array, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  c.width = SKIN_SIZE; c.height = SKIN_SIZE;
  const ctx = c.getContext('2d')!;
  const img = new ImageData(new Uint8ClampedArray(px.slice().buffer), SKIN_SIZE, SKIN_SIZE);
  ctx.putImageData(img, 0, 0);
  return c;
}

export function pixelsToBlob(px: Uint32Array): Promise<Blob> {
  return new Promise((res, rej) =>
    pixelsToCanvas(px).toBlob((b) => (b ? res(b) : rej(new Error('Falha ao gerar o PNG'))), 'image/png'));
}

export function pixelsToDataURL(px: Uint32Array): string {
  return pixelsToCanvas(px).toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new ImportError('Não foi possível ler esta imagem. Use um arquivo PNG.'));
    img.src = src;
  });
}

function imageToRaw(img: HTMLImageElement): { data: Uint8ClampedArray; w: number; h: number } {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return { data: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
}

/** Copia uma caixa espelhada (usado para converter skins antigas 64x32). */
function copyMirroredBox(px: Uint32Array, src: BoxDef, dst: BoxDef) {
  const swap: Record<FaceId, FaceId> = { top: 'top', bottom: 'bottom', front: 'front', back: 'back', right: 'left', left: 'right' };
  const sr = faceRects(src), dr = faceRects(dst);
  for (const f of FACE_IDS) {
    const a = sr[f], b = dr[swap[f]];
    for (let y = 0; y < a.h; y++)
      for (let x = 0; x < a.w; x++)
        px[(b.y + y) * SKIN_SIZE + b.x + (a.w - 1 - x)] = px[(a.y + y) * SKIN_SIZE + a.x + x];
  }
}

/** Detecta modelo slim: no slim, a última coluna dos braços fica vazia. */
export function detectModel(px: Uint32Array): ArmModel {
  const alphaAt = (x: number, y: number) => px[y * SKIN_SIZE + x] >>> 24 === 0 ? 0 : 1; // little-endian
  let opaque = 0;
  for (let y = 20; y < 32; y++) opaque += alphaAt(54, y) + alphaAt(55, y);
  for (let y = 16; y < 20; y++) opaque += alphaAt(50, y) + alphaAt(51, y);
  return opaque === 0 ? 'slim' : 'classic';
}

export interface ImportResult { pixels: Uint32Array; model: ArmModel; converted: boolean }

export async function importSkinFile(file: File): Promise<ImportResult> {
  if (file.type && !/^image\/(png|x-png)$/.test(file.type)) {
    throw new ImportError(`"${file.name}" não é um PNG. Skins do Minecraft são imagens PNG de 64×64 pixels.`);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return rawToSkin(imageToRaw(img));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function importSkinDataURL(src: string): Promise<ImportResult> {
  return rawToSkin(imageToRaw(await loadImage(src)));
}

function rawToSkin(raw: { data: Uint8ClampedArray; w: number; h: number }): ImportResult {
  const { w, h } = raw;
  if (!(w === 64 && (h === 64 || h === 32))) {
    throw new ImportError(
      `A imagem tem ${w}×${h} pixels. Use uma skin de 64×64 (ou 64×32, formato antigo, que é convertida automaticamente).`,
    );
  }
  const px = new Uint32Array(SKIN_SIZE * SKIN_SIZE);
  px.set(new Uint32Array(raw.data.buffer.slice(0), 0, w * h));
  const converted = h === 32;
  if (converted) {
    // perna e braço esquerdos não existiam: espelha os direitos
    copyMirroredBox(px, { w: 4, h: 12, d: 4, u: 0, v: 16 }, { w: 4, h: 12, d: 4, u: 16, v: 48 });
    copyMirroredBox(px, { w: 4, h: 12, d: 4, u: 40, v: 16 }, { w: 4, h: 12, d: 4, u: 32, v: 48 });
  }
  return { pixels: px, model: converted ? 'classic' : detectModel(px), converted };
}

// ---------- pacote .mcpack (Bedrock) ----------

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  (globalThis.crypto as Crypto).getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Identificador sem espaços nem acentos (exigido pelo Bedrock). */
export function slugId(name: string): string {
  const s = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '');
  return (s || 'MinhaSkin').slice(0, 40);
}

export function safeFileName(name: string): string {
  const s = name.normalize('NFC').replace(/[\\/:*?"<>|]+/g, '').trim();
  return s || 'minha-skin';
}

export interface McpackOptions { packName: string; skinName: string; model: ArmModel; png: Uint8Array }

export function buildMcpack(o: McpackOptions): Uint8Array {
  const id = slugId(o.packName);
  const manifest = {
    format_version: 1,
    header: { name: o.packName, uuid: uuid(), version: [1, 0, 0] },
    modules: [{ type: 'skin_pack', uuid: uuid(), version: [1, 0, 0] }],
  };
  const skins = {
    skins: [{
      localization_name: 'skin1',
      geometry: o.model === 'slim' ? 'geometry.humanoid.customSlim' : 'geometry.humanoid.custom',
      texture: 'skin.png',
      type: 'free',
    }],
    serialize_name: id,
    localization_name: id,
  };
  const lang = `skinpack.${id}=${o.packName}\nskin.${id}.skin1=${o.skinName}\n`;
  return zipSync({
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'skins.json': strToU8(JSON.stringify(skins, null, 2)),
    'skin.png': o.png,
    'texts/languages.json': strToU8(JSON.stringify(['en_US', 'pt_BR'])),
    'texts/en_US.lang': strToU8(lang),
    'texts/pt_BR.lang': strToU8(lang),
  });
}
