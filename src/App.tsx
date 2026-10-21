import { useCallback, useEffect, useRef, useState } from 'react';
import { doc } from './skin/document';
import { FACE_LABEL, LAYER_LABEL, PART_LABEL, pixelInfo } from './skin/layout';
import { TOOLS } from './skin/tools';
import { importSkinFile, ImportError } from './skin/io';
import { useApp, type Theme, type ViewMode } from './store';
import { lsGet } from './storage';
import { restoreAutosave, saveCurrentAsProject, startAutosave } from './projects';
import { templateById } from './skin/templates';
import { prefetchDownloads } from './download';
import { Icon } from './components/Icon';
import { Viewer3D } from './components/Viewer3D';
import { Editor2D } from './components/Editor2D';
import { Toolbar } from './components/Toolbar';
import { ColorPicker } from './components/ColorPicker';
import { LayersPanel, ModelPanel, useDocRev } from './components/LayersPanel';
import { Gallery, applyTemplate } from './components/Gallery';
import { ExportDialog } from './components/ExportDialog';
import { ProjectsDialog } from './components/ProjectsDialog';
import { HelpDialog, Onboarding } from './components/HelpDialogs';
import { KidApp } from './kid/KidApp';

function useTheme() {
  const theme = useApp((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);
  return theme;
}

const THEME_NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_LABEL: Record<Theme, string> = { system: 'Tema do sistema', light: 'Tema claro', dark: 'Tema escuro' };

export async function importFile(file: File) {
  const app = useApp.getState();
  try {
    const r = await importSkinFile(file);
    doc.replaceAll(r.pixels, r.model, 'Importar skin');
    doc.setOriginal();
    const name = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Skin importada';
    app.set({ skinName: name, projectId: null, modal: null });
    const extra = r.converted ? ' Formato antigo 64×32 convertido para 64×64.' : r.model === 'slim' ? ' Braços slim detectados.' : '';
    app.showToast(`"${name}" importada.${extra}`, { label: 'Desfazer', run: () => doc.undo() });
  } catch (e) {
    app.showToast(e instanceof ImportError ? e.message : 'Não foi possível abrir este arquivo. Use um PNG de skin.');
  }
}

function Header({ onImport }: { onImport: () => void }) {
  useDocRev();
  const set = useApp((s) => s.set);
  const skinName = useApp((s) => s.skinName);
  const theme = useTheme();
  return (
    <header className="topbar">
      <div className="brand">
        <svg className="logo" viewBox="0 0 8 8" aria-hidden="true" shapeRendering="crispEdges">
          <rect width="8" height="8" fill="var(--logo-1)" />
          <rect y="0" width="8" height="2" fill="var(--logo-2)" />
          <rect x="1" y="4" width="2" height="1" fill="var(--logo-3)" />
          <rect x="5" y="4" width="2" height="1" fill="var(--logo-3)" />
          <rect x="3" y="6" width="2" height="1" fill="var(--logo-2)" />
        </svg>
        <span className="brand-name">SkinForja</span>
      </div>
      <label className="name-field">
        <span className="sr-only">Nome da skin</span>
        <input id="nome-skin" value={skinName} maxLength={40} onChange={(e) => set({ skinName: e.target.value })} spellCheck={false} />
      </label>
      <div className="history" role="group" aria-label="Histórico">
        <button type="button" className="icon-btn" disabled={!doc.canUndo} onClick={() => doc.undo()}
          aria-label="Desfazer (Ctrl+Z)" data-tip={doc.canUndo ? `Desfazer: ${doc.undoLabel} · Ctrl+Z` : 'Nada para desfazer'}>
          <Icon name="undo" />
        </button>
        <button type="button" className="icon-btn" disabled={!doc.canRedo} onClick={() => doc.redo()}
          aria-label="Refazer (Ctrl+Y)" data-tip={doc.canRedo ? `Refazer: ${doc.redoLabel} · Ctrl+Y` : 'Nada para refazer'}>
          <Icon name="redo" />
        </button>
      </div>
      <nav className="actions" aria-label="Arquivo">
        <button type="button" className="btn kid-switch" onClick={() => set({ mode: 'kid', tool: 'brush', size: 2 })}><Icon name="walk" /><span>Modo infantil</span></button>
        <button type="button" className="btn" onClick={() => set({ modal: 'gallery' })}><Icon name="gallery" /><span>Modelos</span></button>
        <button type="button" className="btn" onClick={() => set({ modal: 'projects' })}><Icon name="folder" /><span>Minhas skins</span></button>
        <button type="button" className="btn" onClick={onImport}><Icon name="upload" /><span>Importar</span></button>
        <button type="button" className="btn primary" onClick={() => set({ modal: 'export' })}><Icon name="download" /><span>Exportar</span></button>
        <button type="button" className="icon-btn" onClick={() => set({ theme: THEME_NEXT[theme] })} aria-label={`${THEME_LABEL[theme]}: trocar`} data-tip={THEME_LABEL[theme]}>
          <Icon name={theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'contrast'} />
        </button>
        <button type="button" className="icon-btn" onClick={() => set({ modal: 'help' })} aria-label="Atalhos e ajuda" data-tip="Atalhos e ajuda">
          <Icon name="help" />
        </button>
      </nav>
    </header>
  );
}

function StatusBar() {
  const rev = useDocRev();
  const hover = useApp((s) => s.hover);
  const tool = useApp((s) => s.tool);
  const mirror = useApp((s) => s.mirror);
  const savedAt = useApp((s) => s.savedAt);
  const info = hover ? pixelInfo(doc.model, hover.x, hover.y) : null;
  return (
    <div className="statusbar" aria-live="off">
      <span className="st-where">
        {info ? (
          <>
            <b>{PART_LABEL[info.part]}</b> › {FACE_LABEL[info.face]} <span className={'layer-chip mini ' + info.layer} aria-hidden="true" /> {LAYER_LABEL[info.layer]}
            <span className="coord">x {hover!.x} · y {hover!.y}</span>
          </>
        ) : (
          <span className="muted">Passe o cursor sobre a skin para ver a parte e a face</span>
        )}
      </span>
      <span className="st-meta">
        <span>{TOOLS.find((t) => t.id === tool)?.label}{mirror ? ' · espelho' : ''}</span>
        <span>{doc.model === 'slim' ? 'Slim' : 'Clássico'} · 64×64</span>
        <span data-rev={rev}>{doc.historySize} {doc.historySize === 1 ? 'ação' : 'ações'}</span>
        <span>{savedAt ? 'Salvo neste navegador' : 'Salvamento automático ativo'}</span>
      </span>
    </div>
  );
}

function Toast() {
  const toast = useApp((s) => s.toast);
  const set = useApp((s) => s.set);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => set({ toast: null }), toast.action ? 6000 : 3800);
    return () => window.clearTimeout(id);
  }, [toast, set]);
  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.id}>
      <span>{toast.text}</span>
      {toast.action && (
        <button type="button" className="link-btn" onClick={() => { toast.action!.run(); set({ toast: null }); }}>{toast.action.label}</button>
      )}
    </div>
  );
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t?.isContentEditable;
      const app = useApp.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) doc.redo(); else doc.undo(); return; }
      if (mod && k === 'y' && !typing) { e.preventDefault(); doc.redo(); return; }
      if (mod && k === 's') {
        e.preventDefault();
        const p = saveCurrentAsProject();
        app.showToast(p ? `"${p.name}" salva em Minhas skins.` : 'Não foi possível salvar neste navegador.');
        return;
      }
      if (mod && k === 'e') { e.preventDefault(); app.set({ modal: 'export' }); return; }
      if (typing || mod || e.altKey || app.modal) return;
      const tool = TOOLS.find((x) => x.key.toLowerCase() === k);
      if (tool) { app.setTool(tool.id); return; }
      if (k === 'm') app.set({ mirror: !app.mirror });
      else if (k === 't') app.set({ paint3d: !app.paint3d });
      else if (k === 'x') app.set({ activeLayer: app.activeLayer === 'base' ? 'overlay' : 'base' });
      else if (e.key === '[') app.set({ size: Math.max(1, app.size - 1) });
      else if (e.key === ']') app.set({ size: Math.min(8, app.size + 1) });
      else if (e.key === '?') app.set({ modal: 'help' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

const VIEW_OPTS: { id: ViewMode; label: string; icon: string }[] = [
  { id: '3d', label: '3D', icon: 'cube' },
  { id: '2d', label: 'Textura', icon: 'flat' },
  { id: 'both', label: 'Ambos', icon: 'split' },
];

/** Raiz: carrega o trabalho salvo e escolhe entre o modo infantil e o editor avançado. */
export function App() {
  const mode = useApp((s) => s.mode);
  const set = useApp((s) => s.set);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    prefetchDownloads();
    (async () => {
      const restored = await restoreAutosave();
      if (!restored) {
        const t = templateById(useApp.getState().mode === 'kid' ? 'raposa' : 'aventureiro')!;
        doc.load(t.draw(), t.model);
        doc.setOriginal();
        set({ skinName: t.name + ' (meu)' });
      }
      startAutosave();
      setReady(true);
    })();
  }, [set]);

  // o modo infantil começa só com o 3D; o avançado mostra os dois lados em telas largas
  useEffect(() => {
    set({ view: mode === 'kid' || window.matchMedia('(max-width: 760px)').matches ? '3d' : 'both', modal: null, hover: null });
    if (mode === 'pro' && !lsGet('onboarded', false)) set({ modal: 'onboarding' });
  }, [mode, set]);

  if (!ready) return <div className="boot" aria-busy="true" />;
  return mode === 'kid' ? <KidApp /> : <ProApp />;
}

function ProApp() {
  const modal = useApp((s) => s.modal);
  const view = useApp((s) => s.view);
  const panelOpen = useApp((s) => s.panelOpen);
  const set = useApp((s) => s.set);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const ready = true;

  useShortcuts();

  const openImport = useCallback(() => fileRef.current?.click(), []);

  useEffect(() => {
    let depth = 0;
    const hasFile = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');
    const enter = (e: DragEvent) => { if (!hasFile(e)) return; e.preventDefault(); depth++; setDragging(true); };
    const over = (e: DragEvent) => { if (hasFile(e)) e.preventDefault(); };
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) setDragging(false); };
    const drop = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault(); depth = 0; setDragging(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) void importFile(f);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  return (
    <div className="app" data-view={view} data-panel={panelOpen ? 'open' : 'closed'}>
      <Header onImport={openImport} />
      <input
        ref={fileRef} id="arquivo-importar" type="file" accept="image/png" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }}
      />
      <Toolbar />
      <main className="stage" aria-label="Área de edição">
        <div className="view-switch segmented small" role="radiogroup" aria-label="Visualização">
          {VIEW_OPTS.map((v) => (
            <button key={v.id} type="button" role="radio" aria-checked={view === v.id} className={view === v.id ? 'on' : ''} onClick={() => set({ view: v.id })}>
              <Icon name={v.icon} size={14} /> <b>{v.label}</b>
            </button>
          ))}
        </div>
        <div className="views">
          {ready && view !== '2d' && <section className="pane pane-3d" aria-label="Personagem 3D"><Viewer3D /></section>}
          {ready && view !== '3d' && <section className="pane pane-2d" aria-label="Textura 2D"><Editor2D /></section>}
        </div>
        <StatusBar />
      </main>
      <aside className="sidepanel" aria-label="Cores e camadas">
        <button type="button" className="sheet-handle" onClick={() => set({ panelOpen: !panelOpen })} aria-expanded={panelOpen}>
          <Icon name="palette" /> <span>Cores e camadas</span>
          <CurrentColorDot />
        </button>
        <div className="sidepanel-scroll">
          <ColorPicker />
          <LayersPanel />
          <ModelPanel />
          <section className="panel-block quick">
            <button type="button" className="link-btn" onClick={() => applyTemplate(templateById('branco')!)}>Limpar tudo (começar em branco)</button>
          </section>
        </div>
      </aside>
      <Toast />
      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div><Icon name="upload" size={48} /><p>Solte o PNG da skin para abrir</p></div>
        </div>
      )}
      {modal === 'gallery' && <Gallery />}
      {modal === 'export' && <ExportDialog />}
      {modal === 'projects' && <ProjectsDialog />}
      {modal === 'help' && <HelpDialog />}
      {modal === 'onboarding' && <Onboarding />}
    </div>
  );
}

function CurrentColorDot() {
  const c = useApp((s) => s.color);
  return <span className="current-swatch small" style={{ ['--sw' as string]: `rgba(${c.r},${c.g},${c.b},${c.a / 255})` }} aria-hidden="true" />;
}
