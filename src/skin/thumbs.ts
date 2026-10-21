// Miniaturas 3D renderizadas fora da tela (um único renderizador compartilhado).
import * as THREE from 'three';
import { buildCharacter, applyPose } from './model3d';
import { SKIN_SIZE, type ArmModel } from './layout';

let renderer: THREE.WebGLRenderer | null = null;
let failed = false;
const cache = new Map<string, string>();

function getRenderer() {
  if (renderer || failed) return renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(220, 260, false);
  } catch {
    failed = true;
  }
  return renderer;
}

export function renderThumb(key: string, px: Uint32Array, model: ArmModel, angle = 0.55): string | null {
  const hit = cache.get(key);
  if (hit) return hit;
  const r = getRenderer();
  if (!r) return null;
  const c = document.createElement('canvas');
  c.width = c.height = SKIN_SIZE;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px.slice().buffer), SKIN_SIZE, SKIN_SIZE), 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.35);
  sun.position.set(20, 40, 35);
  scene.add(sun);
  const rig = buildCharacter(tex, model);
  applyPose(rig, 'still', 0);
  rig.pivots.rightArm.rotation.x = 0.35;
  rig.pivots.leftArm.rotation.x = -0.35;
  rig.pivots.rightLeg.rotation.x = -0.3;
  rig.pivots.leftLeg.rotation.x = 0.3;
  rig.root.rotation.y = angle;
  scene.add(rig.root);
  const cam = new THREE.PerspectiveCamera(30, 220 / 260, 1, 300);
  cam.position.set(0, 20, 72);
  cam.lookAt(0, 16, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  rig.dispose();
  tex.dispose();
  cache.set(key, url);
  return url;
}
