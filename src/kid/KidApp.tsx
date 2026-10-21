import { useEffect, useRef, useState, type ReactNode } from 'react';
import { doc } from '../skin/document';
import { STAMPS, SIZE_TOOLS } from '../skin/tools';
import { onPaintEvent } from '../skin/paint';
import { useApp, rgbaKey } from '../store';
import { listProjects, saveCurrentAsProject } from '../projects';
import { Viewer3D, viewerControls } from '../components/Viewer3D';
import { Editor2D } from '../components/Editor2D';
import { useDocRev } from '../components/LayersPanel';
import { KidIcon } from './KidIcon';
import { sfx, say, unlockAudio } from './sound';
import { CRAYONS, KID_SIZES, KID_TOOLS, hexColor } from './kidData';
import { KidGallery, MoreColors, ParentArea, Confetti } from './KidSheets';
import { ExportDialog } from '../components/ExportDialog';
import { ProjectsDialog } from '../components/ProjectsDialog';

/** Botão grande do modo infantil: toca um som e fala o nome. */
export function KBtn({ label, onPress, children, className = '', pressed, sound = 'tap', speak = true, speakAs, style }: {
  label: string; onPress?: () => void; children: ReactNode; className?: string; pressed?: boolean;
  sound?: keyof typeof sfx | null; speak?: boolean; speakAs?: string; style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      className={'kbtn ' + className + (pressed ? ' on' : '')}
      aria-label={label}
      aria-pressed={pressed}
      style={style}
      onClick={() => {
        if (sound) sfx[sound]();
        if (speak) say(speakAs ?? label);
        onPress?.();
      }}
    >
      {children}
    </button>
  );
}

function StampPreview({ id, color }: { id: string; color: string }) {
  const def = STAMPS.find((s) => s.id === id)!;
  const h = def.rows.length, w = def.rows[0].length;
  const n = Math.max(w, h);
  return (
    <svg width="44" height="44" viewBox={`${-(n - w) / 2 - 0.5} ${-(n - h) / 2 - 0.5} ${n + 1} ${n + 1}`} shapeRendering="crispEdges" aria-hidden="true">
      {def.rows.flatMap((row, y) => [...row].map((ch, x) => ch === '.' ? null : (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={ch === 'c' ? color : def.legend[ch]} />
      )))}
    </svg>
  );
}

function ToolTray() {
  const tool = useApp((s) => s.tool);
  const size = useApp((s) => s.size);
  const stamp = useApp((s) => s.stamp);
  const color = useApp((s) => s.color);
  const set = useApp((s) => s.set);
  const hex = rgbaKey(color);
  if (tool === 'stamp') {
    return (
      <div className="k-tray stamps" role="group" aria-label="Escolher carimbo">
        {STAMPS.map((s) => (
          <KBtn key={s.id} label={s.label} pressed={stamp === s.id} className="small" sound="select" onPress={() => set({ stamp: s.id })}>
            <StampPreview id={s.id} color={hex} />
          </KBtn>
        ))}
      </div>
    );
  }
  if (SIZE_TOOLS.includes(tool)) {
    return (
      <div className="k-tray sizes" role="group" aria-label="Tamanho">
        {KID_SIZES.map((z) => (
          <KBtn key={z.size} label={z.say} pressed={size === z.size} className="small" sound="select" onPress={() => set({ size: z.size })}>
            <span className="size-dot" style={{ width: z.dot, height: z.dot, background: tool === 'eraser' ? '#ffffff' : hex }} />
          </KBtn>
        ))}
      </div>
    );
  }
  return null;
}

function HoldLock() {
  const set = useApp((s) => s.set);
  const [holding, setHolding] = useState(false);
  const timer = useRef(0);
  const start = () => {
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = 0;
      setHolding(false);
      sfx.magic();
      set({ modal: 'parents' });
    }, 2000);
  };
  const stop = (short: boolean) => {
    if (!timer.current) return;
    window.clearTimeout(timer.current);
    timer.current = 0;
    if (holding && short) say('Peça ajuda a um adulto');
    setHolding(false);
  };
  return (
    <button
      type="button" className={'kbtn lock' + (holding ? ' holding' : '')}
      aria-label="Área dos adultos: segure por 2 segundos"
      onPointerDown={start} onPointerUp={() => stop(true)} onPointerLeave={() => stop(false)} onPointerCancel={() => stop(false)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set({ modal: 'parents' }); } }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg className="hold-ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" /></svg>
      <KidIcon name="lock" size={36} />
    </button>
  );
}

function Header() {
  useDocRev();
  const set = useApp((s) => s.set);
  const sound = useApp((s) => s.sound);
  const projectId = useApp((s) => s.projectId);
  const save = () => {
    const app = useApp.getState();
    if (!projectId) {
      const n = listProjects().length + 1;
      app.set({ skinName: `Minha skin ${n}` });
    }
    const p = saveCurrentAsProject();
    if (p) { sfx.save(); say('Guardado!'); set({ celebrate: Date.now() }); }
    else { sfx.miss(); }
  };
  return (
    <header className="k-top">
      <div className="k-group">
        <KBtn label="Personagens" sound="select" onPress={() => set({ modal: 'gallery' })}><KidIcon name="models" size={40} /></KBtn>
        <KBtn label="Guardar" sound={null} onPress={save}><KidIcon name="save" size={40} /></KBtn>
      </div>
      <div className="k-group">
        <KBtn label="Desfazer" sound="undo" className={doc.canUndo ? '' : 'dim'} onPress={() => doc.undo()}><KidIcon name="undo" size={40} /></KBtn>
        <KBtn label="Refazer" sound="redo" className={doc.canRedo ? '' : 'dim'} onPress={() => doc.redo()}><KidIcon name="redo" size={40} /></KBtn>
      </div>
      <div className="k-group">
        <KBtn label={sound ? 'Som desligado' : 'Som ligado'} sound={null} speak={false} onPress={() => { set({ sound: !sound }); if (!sound) setTimeout(() => sfx.select(), 30); }}>
          <KidIcon name={sound ? 'soundOn' : 'soundOff'} size={40} />
        </KBtn>
        <HoldLock />
      </div>
    </header>
  );
}

function Tools() {
  const tool = useApp((s) => s.tool);
  const mirror = useApp((s) => s.mirror);
  const color = useApp((s) => s.color);
  const setTool = useApp((s) => s.setTool);
  const set = useApp((s) => s.set);
  const hex = rgbaKey(color);
  return (
    <nav className="k-tools" aria-label="Ferramentas">
      <div className="k-toollist">
        {KID_TOOLS.map((t) => (
          <KBtn
            key={t.id} label={t.say} pressed={tool === t.id} sound={tool === t.id ? 'tap' : 'select'}
            speakAs={tool === t.id ? 'Sem ferramenta' : t.say}
            onPress={() => setTool(tool === t.id ? 'none' : t.id)}
          >
            <KidIcon name={t.icon} size={44} color={hex} />
          </KBtn>
        ))}
        <KBtn label={mirror ? 'Espelho desligado' : 'Espelho ligado'} pressed={mirror} className="mirror" sound="select" onPress={() => set({ mirror: !mirror })}>
          <KidIcon name="mirror" size={44} />
        </KBtn>
      </div>
      <ToolTray />
    </nav>
  );
}

function Crayons() {
  const color = useApp((s) => s.color);
  const setColor = useApp((s) => s.setColor);
  const set = useApp((s) => s.set);
  const tool = useApp((s) => s.tool);
  const setTool = useApp((s) => s.setTool);
  const recent = useApp((s) => s.recent);
  const cur = rgbaKey(color);
  const inPalette = CRAYONS.some((c) => c.hex === cur);
  const choose = (hex: string) => {
    setColor(hexColor(hex), true);
    if (tool === 'eraser' || tool === 'picker' || tool === 'none') setTool('brush');
  };
  const nameOf = (hex: string) => CRAYONS.find((c) => c.hex === hex)?.name ?? 'Cor';
  return (
    <aside className="k-colors" aria-label="Cores">
      {CRAYONS.map((c) => (
        <KBtn
          key={c.hex} label={c.name} pressed={cur === c.hex} className="crayon" sound="select"
          style={{ ['--c' as string]: c.hex }}
          onPress={() => choose(c.hex)}
        >
          <span className="blob" />
        </KBtn>
      ))}
      {!inPalette && (
        <span className="kbtn crayon on custom" style={{ ['--c' as string]: cur }} aria-label="Cor escolhida"><span className="blob" /></span>
      )}
      <KBtn label="Mais cores" className="crayon more" sound="select" onPress={() => set({ modal: 'colors' })}>
        <KidIcon name="rainbow" size={40} />
      </KBtn>
      <div className="k-recent-head" role="presentation" aria-label="Cores recentes">
        <span className="k-recent-line" /><KidIcon name="clock" size={26} /><span className="k-recent-line" />
      </div>
      {recent.slice(0, 6).map((h) => (
        <KBtn
          key={'r' + h} label={nameOf(h)} pressed={cur === h} className="crayon recent" sound="select"
          style={{ ['--c' as string]: h }} onPress={() => choose(h)}
        >
          <span className="blob" />
        </KBtn>
      ))}
      {Array.from({ length: Math.max(0, 3 - recent.length) }, (_, i) => (
        <span key={'e' + i} className="crayon-slot" aria-hidden="true" />
      ))}
    </aside>
  );
}

function StageControls() {
  const pose = useApp((s) => s.pose);
  const view = useApp((s) => s.view);
  const set = useApp((s) => s.set);
  return (
    <>
      <div className="k-stage-bottom">
        <KBtn label="Girar" className="small" onPress={() => viewerControls.rotate(-1)}><KidIcon name="rotL" size={36} /></KBtn>
        <KBtn label={pose === 'dance' ? 'Parar' : 'Dançar'} pressed={pose === 'dance'} className="small" sound="magic" onPress={() => set({ pose: pose === 'dance' ? 'idle' : 'dance' })}>
          <KidIcon name="dance" size={36} />
        </KBtn>
        <KBtn label="Girar" className="small" onPress={() => viewerControls.rotate(1)}><KidIcon name="rotR" size={36} /></KBtn>
      </div>
      <div className="k-stage-side">
        <KBtn label="Aproximar" className="small" onPress={() => viewerControls.zoom(0.8)}><KidIcon name="zoomIn" size={34} /></KBtn>
        <KBtn label="Afastar" className="small" onPress={() => viewerControls.zoom(1.25)}><KidIcon name="zoomOut" size={34} /></KBtn>
        <KBtn label="Mapa da skin" pressed={view === 'both'} className="small" onPress={() => set({ view: view === 'both' ? '3d' : 'both' })}>
          <KidIcon name="map" size={34} />
        </KBtn>
      </div>
    </>
  );
}

function HandHint() {
  const painted = useApp((s) => s.painted);
  const modal = useApp((s) => s.modal);
  if (painted || modal) return null;
  return (
    <div className="k-hand" aria-hidden="true">
      <svg viewBox="0 0 12 14" width="72" height="84" shapeRendering="crispEdges">
        <path d="M4 0h2v6h1V4h2v3h1V5h2v6l-1 1v2H3v-2L1 10V7h2v1h1z" fill="#fff" stroke="#2b2d42" strokeWidth="0.6" />
      </svg>
    </div>
  );
}

export function KidApp() {
  const modal = useApp((s) => s.modal);
  const view = useApp((s) => s.view);
  const celebrate = useApp((s) => s.celebrate);
  const set = useApp((s) => s.set);

  useEffect(() => {
    const once = () => { unlockAudio(); window.removeEventListener('pointerdown', once); };
    window.addEventListener('pointerdown', once);
    const off = onPaintEvent((e) => {
      if (e === 'begin' || e === 'move') sfx.paint();
      else if (e === 'fill') sfx.fill();
      else if (e === 'stamp') sfx.stamp();
      else if (e === 'pick') { sfx.pick(); say('Peguei a cor!'); }
      else if (e === 'miss') sfx.miss();
      if (e === 'begin' || e === 'fill' || e === 'stamp') {
        if (!useApp.getState().painted) set({ painted: true });
      }
    });
    const st = useApp.getState();
    if (st.pose === 'walk') set({ pose: 'idle' });
    if (!CRAYONS.some((c) => c.hex === rgbaKey(st.color))) st.setColor(hexColor('#e5484d'));
    if (!KID_TOOLS.some((t) => t.id === st.tool)) set({ tool: 'brush' });
    return () => { off(); window.removeEventListener('pointerdown', once); };
  }, [set]);

  return (
    <div className="kid" data-view={view}>
      <div className="k-sky" aria-hidden="true"><span className="cloud c1" /><span className="cloud c2" /><span className="cloud c3" /></div>
      <Header />
      <Tools />
      <main className="k-stage" aria-label="Personagem">
        <div className="k-views">
          <section className="k-pane k-3d"><Viewer3D kid /><HandHint /></section>
          {view === 'both' && <section className="k-pane k-2d"><Editor2D /></section>}
        </div>
        <StageControls />
      </main>
      <Crayons />
      {modal === 'gallery' && <KidGallery />}
      {modal === 'colors' && <MoreColors />}
      {modal === 'parents' && <ParentArea />}
      {modal === 'export' && <ExportDialog />}
      {modal === 'projects' && <ProjectsDialog />}
      {celebrate > 0 && <Confetti key={celebrate} />}
    </div>
  );
}
