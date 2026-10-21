// Calcula os pixels que a ferramenta vai afetar sob o cursor (para a prévia nas duas vistas).
import { SKIN_SIZE, isUsed, mirrorIndex, type ArmModel, type Rect } from './layout';
import { SIZE_TOOLS, type ToolId } from './tools';

export function footprint(tool: ToolId, size: number, mirror: boolean, model: ArmModel, x: number, y: number, clip: Rect | null): number[] {
  const n = SIZE_TOOLS.includes(tool) ? size : 1;
  const start = -Math.floor((n - 1) / 2);
  const out: number[] = [];
  for (let dy = 0; dy < n; dy++)
    for (let dx = 0; dx < n; dx++) {
      const px = x + start + dx, py = y + start + dy;
      if (clip && (px < clip.x || py < clip.y || px >= clip.x + clip.w || py >= clip.y + clip.h)) continue;
      if (!isUsed(model, px, py)) continue;
      const i = py * SKIN_SIZE + px;
      out.push(i);
      if (mirror && tool !== 'picker') {
        const m = mirrorIndex(model, i);
        if (m >= 0 && m !== i) out.push(m);
      }
    }
  return out;
}
