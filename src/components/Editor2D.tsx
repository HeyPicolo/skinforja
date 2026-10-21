import { useEffect, useRef } from 'react';
import { doc } from '../skin/document';
import { SKIN_SIZE, layout, pixelInfo } from '../skin/layout';
import { beginPaint, movePaint, endPaint, isPainting } from '../skin/paint';
import { footprint } from '../skin/preview';
import { useApp } from '../store';
import { Icon } from './Icon';

interface View { scale: number; ox: number; oy: number; fitted: boolean }

function cssVar(el: Element, name: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || '#888';
}

export function Editor2D() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<{ zoom: (f: number) => void; fit: () => void } | null>(null);
  const grid = useApp((s) => s.grid);
  const set = useApp((s) => s.set);

  useEffect(() => {
    const host = hostRef.current!, canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const view: View = { scale: 8, ox: 0, oy: 0, fitted: true };
    let dpr = 1, W = 0, H = 0;

    const src = document.createElement('canvas');
    src.width = src.height = SKIN_SIZE;
    const sctx = src.getContext('2d')!;
    const img = new ImageData(new Uint8ClampedArray(doc.data.buffer.slice(0)), SKIN_SIZE, SKIN_SIZE);

    // camada estática: padrão xadrez nas áreas usadas, fundo nas não usadas
    const checker = document.createElement('canvas');
    checker.width = checker.height = SKIN_SIZE * 2;
    let colors = { bg: '', unused: '', c1: '', c2: '', line: '', edge: '', hover: '', dim: '', accent: '' };
    const readColors = () => {
      colors = {
        bg: cssVar(host, '--canvas-bg'), unused: cssVar(host, '--canvas-unused'),
        c1: cssVar(host, '--check-1'), c2: cssVar(host, '--check-2'), line: cssVar(host, '--grid-line'),
        edge: cssVar(host, '--face-edge'), hover: cssVar(host, '--hover-ring'), dim: cssVar(host, '--canvas-dim'),
        accent: cssVar(host, '--accent'),
      };
    };
    let checkerModel = '';
    const buildChecker = () => {
      const c = checker.getContext('2d')!;
      c.clearRect(0, 0, checker.width, checker.height);
      const L = layout(doc.model);
      for (let y = 0; y < SKIN_SIZE; y++)
        for (let x = 0; x < SKIN_SIZE; x++) {
          const used = L.owner[y * SKIN_SIZE + x] >= 0;
          for (let sy = 0; sy < 2; sy++)
            for (let sx = 0; sx < 2; sx++) {
              c.fillStyle = !used ? colors.unused : (sx + sy) % 2 ? colors.c1 : colors.c2;
              c.fillRect(x * 2 + sx, y * 2 + sy, 1, 1);
            }
        }
      checkerModel = doc.model + colors.c1 + colors.unused;
    };

    const fit = () => {
      const s = Math.max(1, Math.floor(Math.min(W, H) / SKIN_SIZE * 0.96 * 100) / 100);
      view.scale = s;
      view.ox = Math.round((W - SKIN_SIZE * s) / 2);
      view.oy = Math.round((H - SKIN_SIZE * s) / 2);
      view.fitted = true;
    };

    const draw = () => {
      if (!W || !H) return;
      if (checkerModel !== doc.model + colors.c1 + colors.unused) buildChecker();
      const st = useApp.getState();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, W, H);
      const { scale: s, ox, oy } = view;
      const size = SKIN_SIZE * s;
      ctx.drawImage(checker, ox, oy, size, size);
      img.data.set(doc.data);
      sctx.putImageData(img, 0, 0);
      ctx.drawImage(src, ox, oy, size, size);

      // áreas escondidas ficam esmaecidas
      const L = layout(doc.model);
      ctx.fillStyle = colors.dim;
      for (const info of L.infos) {
        if (st.showLayer[info.layer] && st.showPart[info.part]) continue;
        const r = info.rect;
        ctx.fillRect(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s);
      }

      // grade de pixels
      if (st.grid && s >= 6) {
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= SKIN_SIZE; i++) {
          const p = Math.round(ox + i * s) + 0.5;
          ctx.moveTo(p, oy); ctx.lineTo(p, oy + size);
          const q = Math.round(oy + i * s) + 0.5;
          ctx.moveTo(ox, q); ctx.lineTo(ox + size, q);
        }
        ctx.stroke();
      }
      // contorno de cada face
      ctx.strokeStyle = colors.edge;
      ctx.lineWidth = s >= 6 ? 1.5 : 1;
      for (const info of L.infos) {
        const r = info.rect;
        ctx.strokeRect(Math.round(ox + r.x * s) + 0.5, Math.round(oy + r.y * s) + 0.5, Math.round(r.w * s) - 1, Math.round(r.h * s) - 1);
      }

      // prévia da ferramenta
      const h = st.hover;
      if (h && !isPainting()) {
        const pts = st.tool === 'fill' ? [h.y * SKIN_SIZE + h.x] : footprint(st.tool, st.size, st.mirror, doc.model, h.x, h.y, h.src === '3d' ? h.clip : null);
        ctx.lineWidth = 2;
        pts.forEach((i, k) => {
          const x = i % SKIN_SIZE, y = Math.floor(i / SKIN_SIZE);
          ctx.strokeStyle = k === 0 || st.tool !== 'pencil' ? colors.hover : colors.accent;
          ctx.strokeRect(ox + x * s + 1, oy + y * s + 1, s - 2, s - 2);
        });
      }
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = host.clientWidth; H = host.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      if (view.fitted) fit();
      draw();
    };

    const zoomAt = (f: number, cx: number, cy: number) => {
      const ns = Math.max(2, Math.min(64, view.scale * f));
      const k = ns / view.scale;
      view.ox = cx - (cx - view.ox) * k;
      view.oy = cy - (cy - view.oy) * k;
      view.scale = ns;
      view.fitted = false;
      draw();
    };
    apiRef.current = { zoom: (f) => zoomAt(f, W / 2, H / 2), fit: () => { fit(); draw(); } };

    const toPixel = (e: { clientX: number; clientY: number }) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: Math.floor((e.clientX - r.left - view.ox) / view.scale),
        y: Math.floor((e.clientY - r.top - view.oy) / view.scale),
        cx: e.clientX - r.left, cy: e.clientY - r.top,
      };
    };

    // ---------- ponteiro: pintar, mover (botão do meio/direito ou espaço) e pinça ----------
    const pointers = new Map<number, { x: number; y: number }>();
    let mode: 'none' | 'paint' | 'pan' | 'pinch' = 'none';
    let panStart = { x: 0, y: 0, ox: 0, oy: 0 };
    let pinchStart = { d: 0, s: 0, cx: 0, cy: 0, ox: 0, oy: 0 };
    let spaceDown = false;

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const p = toPixel(e);
      pointers.set(e.pointerId, { x: p.cx, y: p.cy });
      if (pointers.size === 2) {
        if (mode === 'paint') endPaint();
        const [a, b] = [...pointers.values()];
        pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.scale, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, ox: view.ox, oy: view.oy };
        mode = 'pinch';
        return;
      }
      if (e.button === 1 || e.button === 2 || spaceDown) {
        mode = 'pan';
        panStart = { x: p.cx, y: p.cy, ox: view.ox, oy: view.oy };
        canvas.classList.add('panning');
        return;
      }
      if (e.button !== 0) return;
      mode = 'paint';
      set({ hover: null });
      beginPaint(p.x, p.y, null, { alt: e.altKey, shift: e.shiftKey });
    };
    const onMove = (e: PointerEvent) => {
      const p = toPixel(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: p.cx, y: p.cy });
      if (mode === 'pinch' && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const ns = Math.max(2, Math.min(64, pinchStart.s * (d / (pinchStart.d || 1))));
        const k = ns / pinchStart.s;
        view.scale = ns;
        view.ox = cx - (pinchStart.cx - pinchStart.ox) * k;
        view.oy = cy - (pinchStart.cy - pinchStart.oy) * k;
        view.fitted = false;
        draw();
        return;
      }
      if (mode === 'pan') {
        view.ox = panStart.ox + (p.cx - panStart.x);
        view.oy = panStart.oy + (p.cy - panStart.y);
        view.fitted = false;
        draw();
        return;
      }
      if (mode === 'paint') {
        movePaint(p.x, p.y);
        return;
      }
      if (e.pointerType === 'mouse') {
        const info = pixelInfo(doc.model, p.x, p.y);
        const cur = useApp.getState().hover;
        if (!info) { if (cur) set({ hover: null }); return; }
        if (!cur || cur.x !== p.x || cur.y !== p.y || cur.src !== '2d') set({ hover: { x: p.x, y: p.y, clip: null, src: '2d' } });
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (mode === 'paint') endPaint();
      if (pointers.size === 0) { mode = 'none'; canvas.classList.remove('panning'); }
      else if (mode === 'pinch' && pointers.size === 1) mode = 'none';
    };
    const onLeave = () => { if (useApp.getState().hover?.src === '2d') set({ hover: null }); };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toPixel(e);
      if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), p.cx, p.cy);
      else { view.ox -= e.deltaX; view.fitted = false; draw(); }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
        spaceDown = e.type === 'keydown';
        canvas.classList.toggle('pan-ready', spaceDown);
      }
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    readColors();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; draw(); });
    };
    const unsubDoc = doc.subscribe(schedule);
    const unsubApp = useApp.subscribe((s, p) => {
      if (s.hover !== p.hover || s.grid !== p.grid || s.showLayer !== p.showLayer || s.showPart !== p.showPart ||
          s.tool !== p.tool || s.size !== p.size || s.mirror !== p.mirror) schedule();
      if (s.theme !== p.theme) requestAnimationFrame(() => { readColors(); checkerModel = ''; draw(); });
    });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => { readColors(); checkerModel = ''; draw(); };
    mq.addEventListener('change', onScheme);

    return () => {
      ro.disconnect();
      unsubDoc(); unsubApp();
      mq.removeEventListener('change', onScheme);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [set]);

  return (
    <div className="editor2d" ref={hostRef}>
      <canvas ref={canvasRef} className="editor-canvas" aria-label="Textura da skin, 64 por 64 pixels" />
      <div className="viewer-tools" role="toolbar" aria-label="Controles do editor 2D">
        <button type="button" className="chip icon-only" onClick={() => apiRef.current?.zoom(1 / 1.25)} title="Afastar" aria-label="Afastar">−</button>
        <button type="button" className="chip" onClick={() => apiRef.current?.fit()} title="Encaixar na tela">Encaixar</button>
        <button type="button" className="chip icon-only" onClick={() => apiRef.current?.zoom(1.25)} title="Aproximar" aria-label="Aproximar">+</button>
        <span className="sep" />
        <button type="button" className={'chip' + (grid ? ' on' : '')} aria-pressed={grid} onClick={() => set({ grid: !grid })} title="Mostrar grade de pixels">
          <Icon name="grid" /> Grade
        </button>
      </div>
    </div>
  );
}
