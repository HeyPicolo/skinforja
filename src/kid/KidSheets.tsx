import { useEffect, useMemo, useRef, useState } from 'react';
import { TEMPLATES, STARTERS, type Category, type Template } from '../skin/templates';
import { applyTemplate, Thumb } from '../components/Gallery';
import { listProjects, openProject, type Project } from '../projects';
import { importSkinDataURL } from '../skin/io';
import { renderThumb } from '../skin/thumbs';
import { doc } from '../skin/document';
import { useApp } from '../store';
import { importFile } from '../App';
import { setModel } from '../components/LayersPanel';
import { KidIcon } from './KidIcon';
import { sfx, say } from './sound';
import { MORE_COLORS, hexColor } from './kidData';
import { KBtn } from './KidApp';

function Sheet({ children, label, onClose }: { children: React.ReactNode; label: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="k-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="k-sheet" role="dialog" aria-modal="true" aria-label={label} ref={ref}>
        <KBtn label="Fechar" className="k-close small" onPress={onClose}><KidIcon name="close" size={30} /></KBtn>
        {children}
      </div>
    </div>
  );
}

function ProjectThumb({ p }: { p: Project }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    importSkinDataURL(p.png).then((r) => { if (alive) setUrl(renderThumb('prj:' + p.id + p.updatedAt, r.pixels, p.model)); }).catch(() => {});
    return () => { alive = false; };
  }, [p]);
  return url ? <img src={url} alt="" className="k-thumb-img" /> : <span className="thumb-wait" />;
}

type Tab = Category | 'minhas';
const TABS: { id: Tab; icon: string; say: string }[] = [
  { id: 'animais', icon: 'paw', say: 'Animais' },
  { id: 'mobs', icon: 'monster', say: 'Monstros' },
  { id: 'personagens', icon: 'person', say: 'Pessoas' },
  { id: 'minhas', icon: 'heart', say: 'Minhas skins' },
  { id: 'basico', icon: 'blank', say: 'Começar do zero' },
];

export function KidGallery() {
  const set = useApp((s) => s.set);
  const close = () => set({ modal: null });
  const [tab, setTab] = useState<Tab>(() => (listProjects().length ? 'minhas' : 'animais'));
  const projects = useMemo(listProjects, []);
  const items: Template[] = tab === 'basico' ? STARTERS : TEMPLATES.filter((t) => t.category === tab);

  const pickTemplate = (t: Template) => {
    sfx.magic();
    say(t.name);
    applyTemplate(t);
    set({ painted: true });
  };

  return (
    <Sheet label="Personagens" onClose={close}>
      <div className="k-tabs" role="tablist">
        {TABS.map((t) => (
          <KBtn key={t.id} label={t.say} pressed={tab === t.id} sound="select" onPress={() => setTab(t.id)}>
            <KidIcon name={t.icon} size={44} />
          </KBtn>
        ))}
      </div>
      <div className="k-cards">
        {tab === 'minhas'
          ? (projects.length
            ? projects.map((p) => (
              <KBtn key={p.id} label={p.name} className="k-card" sound="magic" onPress={async () => { await openProject(p); close(); }}>
                <ProjectThumb p={p} />
              </KBtn>
            ))
            : <div className="k-empty"><KidIcon name="heart" size={72} /><KidIcon name="save" size={56} /></div>)
          : items.map((t) => (
            <KBtn key={t.id} label={t.name} className="k-card" sound={null} speak={false} onPress={() => pickTemplate(t)}>
              <Thumb t={t} />
            </KBtn>
          ))}
      </div>
    </Sheet>
  );
}

export function MoreColors() {
  const set = useApp((s) => s.set);
  const setColor = useApp((s) => s.setColor);
  const tool = useApp((s) => s.tool);
  const setTool = useApp((s) => s.setTool);
  return (
    <Sheet label="Mais cores" onClose={() => set({ modal: null })}>
      <div className="k-morecolors">
        {MORE_COLORS.map((h) => (
          <button
            key={h} type="button" className="k-swatch" style={{ background: h }} aria-label={h}
            onClick={() => {
              sfx.select();
              setColor(hexColor(h), true);
              if (tool === 'eraser' || tool === 'picker') setTool('brush');
              set({ modal: null });
            }}
          />
        ))}
      </div>
    </Sheet>
  );
}

/** Área para adultos: textos normais, exportação e configurações. */
export function ParentArea() {
  const set = useApp((s) => s.set);
  const sound = useApp((s) => s.sound);
  const voice = useApp((s) => s.voice);
  const fileRef = useRef<HTMLInputElement>(null);
  const [model, setM] = useState(doc.model);
  const close = () => set({ modal: null });

  return (
    <div className="backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="dialog parent-area" role="dialog" aria-modal="true" aria-labelledby="adultos-titulo">
        <header className="dialog-head">
          <h2 id="adultos-titulo">Área dos adultos</h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Fechar"><span aria-hidden="true" style={{ fontSize: 20 }}>✕</span></button>
        </header>
        <div className="dialog-body">
          <p className="dialog-lead">
            A criança pinta tocando no boneco, escolhe cores à direita e ferramentas à esquerda. Cada botão fala o próprio nome em inglês. Tocar de novo na ferramenta escolhida tira a seleção (aí o toque no boneco só gira).
            Para chegar aqui, segure o cadeado por 2 segundos.
          </p>
          <div className="pa-grid">
            <button type="button" className="btn primary" onClick={() => set({ modal: 'export' })}>Exportar para o Minecraft</button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Importar skin (PNG)</button>
            <button type="button" className="btn" onClick={() => set({ modal: 'projects' })}>Gerenciar skins guardadas</button>
          </div>
          <input
            ref={fileRef} type="file" accept="image/png" hidden id="kid-importar"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f).then(() => set({ modal: null })); e.target.value = ''; }}
          />
          <div className="pa-settings">
            <label className="pa-row"><input id="pa-som" type="checkbox" checked={sound} onChange={(e) => set({ sound: e.target.checked })} /> Sons</label>
            <label className="pa-row"><input id="pa-voz" type="checkbox" checked={voice} onChange={(e) => set({ voice: e.target.checked })} /> Voz que fala o nome dos botões (em inglês)</label>
            <div className="pa-row">
              <span>Braços do personagem</span>
              <div className="segmented small" role="radiogroup" aria-label="Modelo do braço">
                {(['classic', 'slim'] as const).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={model === m} className={model === m ? 'on' : ''} onClick={() => { setModel(m); setM(m); }}>
                    <b>{m === 'classic' ? 'Clássico (4 px)' : 'Slim (3 px)'}</b>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="pa-foot">
            <button type="button" className="btn ghost" onClick={() => set({ mode: 'pro', modal: null, tool: 'pencil' })}>
              Abrir o editor avançado
            </button>
            <span className="muted small">Tem mapa 2D, camadas, linha, retângulo e atalhos de teclado.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ['#e5484d', '#ff9f1c', '#ffd23f', '#2fa84f', '#3a86ff', '#9b5de5', '#ff7aa8'];

export function Confetti() {
  const [on, setOn] = useState(true);
  const pieces = useMemo(() => Array.from({ length: 48 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    dur: 1.2 + Math.random() * 0.9,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 8 + Math.round(Math.random() * 8),
    drift: (Math.random() * 2 - 1) * 80,
  })), []);
  useEffect(() => { const t = setTimeout(() => setOn(false), 2600); return () => clearTimeout(t); }, []);
  if (!on) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} style={{
          left: p.left + '%', width: p.size, height: p.size, background: p.color,
          animationDelay: p.delay + 's', animationDuration: p.dur + 's', ['--drift' as string]: p.drift + 'px',
        }} />
      ))}
    </div>
  );
}
