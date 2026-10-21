import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { doc, pack, unpack } from '../skin/document';
import { buildCharacter, applyPose, hitToPixel, type CharacterRig, type PartMesh } from '../skin/model3d';
import { beginPaint, movePaint, endPaint, isPainting } from '../skin/paint';
import { footprint } from '../skin/preview';
import { SKIN_SIZE, type Rect } from '../skin/layout';
import { useApp } from '../store';
import { Icon } from './Icon';

const TARGET = new THREE.Vector3(0, 16, 0);

export function Viewer3D() {
  const hostRef = useRef<HTMLDivElement>(null);
  const api = useRef<{ front: () => void; back: () => void; spin: (v: boolean) => void } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [coarse] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  const pose = useApp((s) => s.pose);
  const paint3d = useApp((s) => s.paint3d);
  const set = useApp((s) => s.set);

  useEffect(() => {
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.className = 'viewer-canvas';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 500);
    camera.position.set(28, 30, 52);
    scene.add(new THREE.AmbientLight(0xffffff, 1.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.35);
    sun.position.set(20, 40, 35);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(-25, 10, -30);
    scene.add(rim);

    // sombra no chão
    const shadowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
      grd.addColorStop(0, 'rgba(0,0,0,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.05;
    scene.add(shadow);

    const texCanvas = document.createElement('canvas');
    texCanvas.width = texCanvas.height = SKIN_SIZE;
    const texCtx = texCanvas.getContext('2d')!;
    const texture = new THREE.CanvasTexture(texCanvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;

    let rig: CharacterRig | null = null;
    const buildRig = () => {
      if (rig) { scene.remove(rig.root); rig.dispose(); }
      rig = buildCharacter(texture, doc.model);
      scene.add(rig.root);
      applyVisibility();
    };
    const applyVisibility = () => {
      if (!rig) return;
      const s = useApp.getState();
      for (const m of rig.meshes) m.mesh.visible = s.showLayer[m.layer] && s.showPart[m.part];
    };

    // envia os pixels (com a prévia da ferramenta) para a textura
    const work = new Uint32Array(SKIN_SIZE * SKIN_SIZE);
    const img = new ImageData(new Uint8ClampedArray(work.buffer), SKIN_SIZE, SKIN_SIZE);
    const upload = () => {
      work.set(doc.px);
      const s = useApp.getState();
      const h = s.hover;
      if (h && !isPainting() && s.tool !== 'fill') {
        const tint = s.tool === 'eraser' || s.tool === 'lighten' || s.tool === 'picker' ? { r: 255, g: 255, b: 255 }
          : s.tool === 'darken' ? { r: 0, g: 0, b: 0 } : s.color;
        for (const i of footprint(s.tool, s.size, s.mirror, doc.model, h.x, h.y, h.clip)) {
          const c = unpack(work[i]);
          const k = c.a === 0 ? 1 : 0.6;
          work[i] = pack({
            r: Math.round(c.r + (tint.r - c.r) * k), g: Math.round(c.g + (tint.g - c.g) * k),
            b: Math.round(c.b + (tint.b - c.b) * k), a: c.a === 0 ? 170 : 255,
          });
        }
      }
      texCtx.putImageData(img, 0, 0);
      texture.needsUpdate = true;
    };

    let lastModel = doc.model;
    buildRig();
    upload();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(TARGET);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.minDistance = 22;
    controls.maxDistance = 120;
    controls.enablePan = false;
    controls.rotateSpeed = 0.8;
    controls.update();

    // ---------- pintura por raycast ----------
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const castAt = (e: PointerEvent): { x: number; y: number; rect: Rect } | null => {
      if (!rig) return null;
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const s = useApp.getState();
      const targets = rig.meshes.filter((m) => m.mesh.visible && m.layer === s.activeLayer);
      const hits = ray.intersectObjects(targets.map((m) => m.mesh), false);
      const hit = hits.find((h) => h.uv && h.faceIndex != null);
      if (!hit) return null;
      const pm = targets.find((m) => m.mesh === hit.object) as PartMesh;
      return hitToPixel(pm, hit.uv!, hit.faceIndex!);
    };

    let paintingPointer: number | null = null;
    const pointers = new Set<number>();
    const onDown = (e: PointerEvent) => {
      pointers.add(e.pointerId);
      if (pointers.size > 1 && paintingPointer !== null) {
        // segundo dedo: encerra o traço e deixa girar/zoom
        endPaint(); paintingPointer = null; controls.enabled = true;
        return;
      }
      const s = useApp.getState();
      if (e.button !== 0 || !s.paint3d) return;
      const hit = castAt(e);
      if (!hit) return;
      controls.enabled = false;
      paintingPointer = e.pointerId;
      renderer.domElement.setPointerCapture(e.pointerId);
      set({ hover: null });
      beginPaint(hit.x, hit.y, hit.rect, { alt: e.altKey, shift: e.shiftKey });
      if (!isPainting()) { paintingPointer = null; controls.enabled = true; }
    };
    const onMove = (e: PointerEvent) => {
      if (paintingPointer === e.pointerId) {
        const hit = castAt(e);
        if (hit) movePaint(hit.x, hit.y, hit.rect);
        return;
      }
      if (e.pointerType !== 'mouse' || e.buttons !== 0) return;
      const s = useApp.getState();
      if (!s.paint3d) { if (s.hover?.src === '3d') set({ hover: null }); return; }
      const hit = castAt(e);
      const cur = s.hover;
      if (!hit) { if (cur?.src === '3d') set({ hover: null }); return; }
      if (!cur || cur.x !== hit.x || cur.y !== hit.y || cur.src !== '3d') set({ hover: { x: hit.x, y: hit.y, clip: hit.rect, src: '3d' } });
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (paintingPointer === e.pointerId) {
        endPaint();
        paintingPointer = null;
        controls.enabled = true;
      }
    };
    const onLeave = () => { if (useApp.getState().hover?.src === '3d') set({ hover: null }); };
    const el = renderer.domElement;
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    const unsubDoc = doc.subscribe(() => {
      if (doc.model !== lastModel) { lastModel = doc.model; buildRig(); }
      upload();
    });
    const unsubApp = useApp.subscribe((s, p) => {
      if (s.showLayer !== p.showLayer || s.showPart !== p.showPart) applyVisibility();
      if (s.hover !== p.hover || s.tool !== p.tool || s.size !== p.size || s.mirror !== p.mirror || s.color !== p.color) upload();
    });

    // ---------- tamanho e laço de renderização ----------
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // afasta a câmera em telas estreitas para o personagem caber
      camera.fov = w / h < 0.8 ? 48 : 38;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let spin = false;
    let last = performance.now();
    let t = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!isPainting()) t += dt;
      if (rig) applyPose(rig, reduce ? 'still' : useApp.getState().pose, t);
      if (spin && !isPainting()) {
        const off = camera.position.clone().sub(TARGET);
        off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.6);
        camera.position.copy(TARGET).add(off);
      }
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    const placeCamera = (z: number) => {
      camera.position.set(0, 22, z);
      controls.target.copy(TARGET);
      controls.update();
    };
    api.current = {
      front: () => placeCamera(58),
      back: () => placeCamera(-58),
      spin: (v) => { spin = v; },
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      unsubDoc(); unsubApp();
      controls.dispose();
      rig?.dispose();
      texture.dispose();
      renderer.dispose();
      el.remove();
    };
  }, [set]);

  return (
    <div className="viewer3d" ref={hostRef} data-paint={paint3d ? 'on' : 'off'}>
      <div className="viewer-tools" role="toolbar" aria-label="Controles da visualização 3D">
        <button type="button" className="chip" onClick={() => api.current?.front()} title="Ver de frente">Frente</button>
        <button type="button" className="chip" onClick={() => api.current?.back()} title="Ver de costas">Costas</button>
        <button
          type="button" className={'chip' + (spinning ? ' on' : '')} aria-pressed={spinning}
          onClick={() => { const v = !spinning; setSpinning(v); api.current?.spin(v); }} title="Girar automaticamente"
        ><Icon name="spin" /> Girar</button>
        <span className="sep" />
        <button
          type="button" className={'chip' + (pose === 'walk' ? ' on' : '')} aria-pressed={pose === 'walk'}
          onClick={() => set({ pose: pose === 'walk' ? 'idle' : 'walk' })} title="Prévia andando"
        ><Icon name="walk" /> {pose === 'walk' ? 'Andando' : 'Parado'}</button>
      </div>
      <p className="viewer-hint">
        {coarse
          ? (paint3d ? 'Toque no boneco para pintar · arraste no fundo para girar · pinça para aproximar' : 'Arraste para girar · pinça para aproximar')
          : (paint3d ? 'Clique no boneco para pintar · arraste no fundo para girar · role para aproximar' : 'Arraste para girar · role para aproximar')}
      </p>
    </div>
  );
}
