import * as THREE from 'three';
import { PART_IDS, SKIN_SIZE, boxOf, faceRects, type ArmModel, type FaceId, type Layer, type PartId, type Rect } from './layout';

// Ordem das faces do BoxGeometry do Three: +x, -x, +y, -y, +z, -z.
// O personagem olha para +z; o lado direito dele fica em -x.
const BOX_FACE_ORDER: FaceId[] = ['left', 'right', 'top', 'bottom', 'front', 'back'];

export interface PartMesh {
  mesh: THREE.Mesh;
  part: PartId;
  layer: Layer;
  rects: Record<FaceId, Rect>;
}

export interface CharacterRig {
  root: THREE.Group;
  pivots: Record<PartId, THREE.Group>;
  meshes: PartMesh[];
  model: ArmModel;
  dispose(): void;
}

function setBoxUVs(geo: THREE.BoxGeometry, rects: Record<FaceId, Rect>) {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  // pequeno recuo para evitar "vazamento" de pixels vizinhos nas bordas
  const e = 0.001;
  for (let f = 0; f < 6; f++) {
    const r = rects[BOX_FACE_ORDER[f]];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      const s = uv.getX(i), t = uv.getY(i);
      const x = r.x + e + s * (r.w - 2 * e);
      const y = r.y + e + (1 - t) * (r.h - 2 * e);
      uv.setXY(i, x / SKIN_SIZE, 1 - y / SKIN_SIZE);
    }
  }
  uv.needsUpdate = true;
}

/** Posição (centro) de cada parte, em pixels, com os pés em y=0. */
function partLayout(part: PartId, model: ArmModel) {
  const armX = model === 'slim' ? 5.5 : 6;
  switch (part) {
    case 'head': return { pivot: [0, 24, 0], offset: [0, 4, 0] };
    case 'body': return { pivot: [0, 24, 0], offset: [0, -6, 0] };
    case 'rightArm': return { pivot: [-(armX - 0), 22, 0], offset: [0, -4, 0], shoulder: true };
    case 'leftArm': return { pivot: [armX, 22, 0], offset: [0, -4, 0], shoulder: true };
    case 'rightLeg': return { pivot: [-2, 12, 0], offset: [0, -6, 0] };
    case 'leftLeg': return { pivot: [2, 12, 0], offset: [0, -6, 0] };
  }
}

export function buildCharacter(texture: THREE.Texture, model: ArmModel): CharacterRig {
  const root = new THREE.Group();
  const pivots = {} as Record<PartId, THREE.Group>;
  const meshes: PartMesh[] = [];
  const baseMat = new THREE.MeshLambertMaterial({ map: texture });
  const overMat = new THREE.MeshLambertMaterial({
    map: texture, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, depthWrite: true,
  });
  const geos: THREE.BufferGeometry[] = [];

  for (const part of PART_IDS) {
    const L = partLayout(part, model);
    const pivot = new THREE.Group();
    pivot.position.set(L.pivot[0], L.pivot[1], L.pivot[2]);
    root.add(pivot);
    pivots[part] = pivot;
    for (const layer of ['base', 'overlay'] as Layer[]) {
      const box = boxOf(part, layer, model);
      const grow = layer === 'overlay' ? (part === 'head' ? 1 : 0.5) : 0;
      const geo = new THREE.BoxGeometry(box.w + grow, box.h + grow, box.d + grow);
      const rects = faceRects(box);
      setBoxUVs(geo, rects);
      geos.push(geo);
      const mesh = new THREE.Mesh(geo, layer === 'base' ? baseMat : overMat);
      mesh.position.set(L.offset[0], L.offset[1], L.offset[2]);
      if (layer === 'overlay') mesh.renderOrder = 1;
      mesh.userData = { part, layer };
      pivot.add(mesh);
      meshes.push({ mesh, part, layer, rects });
    }
  }
  return {
    root, pivots, meshes, model,
    dispose() {
      geos.forEach((g) => g.dispose());
      baseMat.dispose();
      overMat.dispose();
    },
  };
}

export type Pose = 'idle' | 'walk' | 'still' | 'dance';

/** Anima a pose no tempo t (segundos). */
export function applyPose(rig: CharacterRig, pose: Pose, t: number) {
  const p = rig.pivots;
  for (const part of PART_IDS) p[part].rotation.set(0, 0, 0);
  if (pose === 'still') return;
  if (pose === 'idle') {
    const s = Math.sin(t * 1.6) * 0.05;
    p.rightArm.rotation.z = -0.05 - s;
    p.leftArm.rotation.z = 0.05 + s;
    p.head.rotation.y = Math.sin(t * 0.5) * 0.12;
    return;
  }
  if (pose === 'dance') {
    const b = Math.sin(t * 7);
    p.rightArm.rotation.z = -2.4 - b * 0.5;
    p.leftArm.rotation.z = 2.4 - b * 0.5;
    p.rightArm.rotation.x = Math.sin(t * 3.5) * 0.3;
    p.leftArm.rotation.x = -Math.sin(t * 3.5) * 0.3;
    p.head.rotation.z = b * 0.15;
    p.rightLeg.rotation.x = Math.max(0, b) * 0.5;
    p.leftLeg.rotation.x = Math.max(0, -b) * 0.5;
    return;
  }
  const w = Math.sin(t * 5.5) * 0.65;
  p.rightArm.rotation.x = w;
  p.leftArm.rotation.x = -w;
  p.rightLeg.rotation.x = -w;
  p.leftLeg.rotation.x = w;
  p.head.rotation.y = Math.sin(t * 2.75) * 0.08;
}

/** Converte um ponto de interseção (uv + índice do triângulo) em pixel da textura e retângulo da face. */
export function hitToPixel(pm: PartMesh, uv: THREE.Vector2, faceIndex: number) {
  const face = BOX_FACE_ORDER[Math.floor(faceIndex / 2)];
  const r = pm.rects[face];
  let x = Math.floor(uv.x * SKIN_SIZE);
  let y = Math.floor((1 - uv.y) * SKIN_SIZE);
  x = Math.max(r.x, Math.min(r.x + r.w - 1, x));
  y = Math.max(r.y, Math.min(r.y + r.h - 1, y));
  return { x, y, rect: r, face };
}
