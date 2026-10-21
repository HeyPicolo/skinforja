import type { RGBA } from '../skin/document';
import { hexToRgba, hsvToRgb, rgbaToHex } from '../skin/document';
import type { ToolId } from '../skin/tools';

export const CRAYONS: { hex: string; name: string }[] = [
  { hex: '#e5484d', name: 'Vermelho' },
  { hex: '#ff9f1c', name: 'Laranja' },
  { hex: '#ffd23f', name: 'Amarelo' },
  { hex: '#9be15d', name: 'Verde-limão' },
  { hex: '#2fa84f', name: 'Verde' },
  { hex: '#1f6f43', name: 'Verde-escuro' },
  { hex: '#6ec6ff', name: 'Azul-claro' },
  { hex: '#3a86ff', name: 'Azul' },
  { hex: '#1d3f9a', name: 'Azul-escuro' },
  { hex: '#9b5de5', name: 'Roxo' },
  { hex: '#ff7aa8', name: 'Rosa' },
  { hex: '#8b5a3c', name: 'Marrom' },
  { hex: '#f6d1b5', name: 'Pele clara' },
  { hex: '#c98c62', name: 'Pele morena' },
  { hex: '#7a4b33', name: 'Pele escura' },
  { hex: '#ffffff', name: 'Branco' },
  { hex: '#9aa3b2', name: 'Cinza' },
  { hex: '#2b2d42', name: 'Preto' },
];

/** Grade grande de cores para "mais cores": 12 matizes × 5 tons + cinzas. */
export const MORE_COLORS: string[] = (() => {
  const out: string[] = [];
  const shades: [number, number][] = [[0.25, 1], [0.5, 1], [0.85, 0.95], [0.9, 0.7], [0.85, 0.45]];
  for (const [s, v] of shades)
    for (let h = 0; h < 360; h += 30) {
      const c = hsvToRgb(h, s, v);
      out.push(rgbaToHex({ ...c, a: 255 }));
    }
  for (let i = 0; i < 12; i++) {
    const g = Math.round(255 - (i * 255) / 11);
    out.push(rgbaToHex({ r: g, g: g, b: g, a: 255 }));
  }
  return out;
})();

export function hexColor(hex: string): RGBA { return hexToRgba(hex)!; }

export const KID_TOOLS: { id: ToolId; icon: string; say: string }[] = [
  { id: 'brush', icon: 'brush', say: 'Pincel' },
  { id: 'fill', icon: 'fill', say: 'Balde de tinta' },
  { id: 'stamp', icon: 'stamp', say: 'Carimbos' },
  { id: 'noise', icon: 'sparkle', say: 'Purpurina' },
  { id: 'eraser', icon: 'eraser', say: 'Borracha' },
  { id: 'picker', icon: 'picker', say: 'Pegar cor' },
];

export const KID_SIZES: { size: number; say: string; dot: number }[] = [
  { size: 1, say: 'Pequeno', dot: 12 },
  { size: 2, say: 'Médio', dot: 22 },
  { size: 4, say: 'Grande', dot: 34 },
];
