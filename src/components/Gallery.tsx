import { useEffect, useMemo, useState } from 'react';
import { TEMPLATES, STARTERS, CATEGORY_LABEL, type Category, type Template } from '../skin/templates';
import { renderThumb } from '../skin/thumbs';
import { doc } from '../skin/document';
import { useApp } from '../store';
import { Dialog } from './Dialog';

export const pixelCache = new Map<string, Uint32Array>();
export function pixelsOf(t: Template) {
  let p = pixelCache.get(t.id);
  if (!p) { p = t.draw(); pixelCache.set(t.id, p); }
  return p;
}

export function applyTemplate(t: Template) {
  doc.replaceAll(pixelsOf(t), t.model, `Modelo: ${t.name}`);
  doc.setOriginal();
  const app = useApp.getState();
  app.set({ skinName: t.id === 'branco' || t.id === 'neutra' ? 'Minha skin' : `${t.name} (meu)`, projectId: null, modal: null });
  app.showToast(`Modelo "${t.name}" aplicado.`, { label: 'Desfazer', run: () => doc.undo() });
}

export function Thumb({ t }: { t: Template }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const id = window.setTimeout(() => { const u = renderThumb('tpl:' + t.id, pixelsOf(t), t.model); if (alive) setUrl(u); }, 16);
    return () => { alive = false; window.clearTimeout(id); };
  }, [t]);
  return url ? <img src={url} alt="" className="thumb-img" /> : <span className="thumb-wait" aria-hidden="true" />;
}

type Tab = 'todos' | Category;

export function Gallery() {
  const set = useApp((s) => s.set);
  const [tab, setTab] = useState<Tab>('todos');
  const items = useMemo(
    () => (tab === 'todos' ? TEMPLATES : tab === 'basico' ? STARTERS : TEMPLATES.filter((t) => t.category === tab)),
    [tab],
  );
  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: 'todos', label: 'Todos', n: TEMPLATES.length },
    ...(['animais', 'mobs', 'personagens'] as Category[]).map((c) => ({ id: c as Tab, label: CATEGORY_LABEL[c], n: TEMPLATES.filter((t) => t.category === c).length })),
    { id: 'basico', label: CATEGORY_LABEL.basico, n: STARTERS.length },
  ];

  return (
    <Dialog title="Modelos" onClose={() => set({ modal: null })} wide>
      <p className="dialog-lead">Escolha uma base e transforme no seu estilo. Dá para desfazer com Ctrl+Z.</p>
      <div className="tabs" role="tablist" aria-label="Categorias">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label} <span className="count">{t.n}</span>
          </button>
        ))}
      </div>
      <div className="card-grid" role="tabpanel">
        {items.map((t) => (
          <button key={t.id} type="button" className="tpl-card" onClick={() => applyTemplate(t)}>
            <span className="thumb"><Thumb t={t} /></span>
            <span className="tpl-meta">
              <span className="tpl-name">{t.name}</span>
              <span className="tpl-desc">{t.description}</span>
              <span className="tpl-tags">
                <span className="tag">{CATEGORY_LABEL[t.category]}</span>
                {t.model === 'slim' && <span className="tag alt">Slim</span>}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
