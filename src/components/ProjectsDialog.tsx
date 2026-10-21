import { useEffect, useState } from 'react';
import { deleteProject, duplicateProject, listProjects, openProject, renameProject, saveCurrentAsProject, type Project } from '../projects';
import { importSkinDataURL } from '../skin/io';
import { renderThumb } from '../skin/thumbs';
import { useApp } from '../store';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { AccountBox } from './AccountBox';

function ProjectThumb({ p }: { p: Project }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    importSkinDataURL(p.png).then((r) => { if (alive) setUrl(renderThumb('prj:' + p.id + p.updatedAt, r.pixels, p.model)); }).catch(() => {});
    return () => { alive = false; };
  }, [p]);
  return url ? <img src={url} alt="" className="thumb-img" /> : <span className="thumb-wait" aria-hidden="true" />;
}

const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function ProjectsDialog() {
  const set = useApp((s) => s.set);
  const projectId = useApp((s) => s.projectId);
  const showToast = useApp((s) => s.showToast);
  const [list, setList] = useState<Project[]>(listProjects);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const refresh = () => setList(listProjects());
  const syncRev = useApp((s) => s.syncRev);
  useEffect(() => { setList(listProjects()); }, [syncRev]);

  const saveNow = () => {
    const p = saveCurrentAsProject();
    if (p) { showToast(`"${p.name}" salva em Minhas skins.`); refresh(); }
    else showToast('Não foi possível salvar: o armazenamento do navegador está bloqueado ou cheio.');
  };

  return (
    <Dialog title="Minhas skins" onClose={() => set({ modal: null })} wide>
      <AccountBox />
      <div className="dialog-actions-row">
        <p className="dialog-lead">Ficam guardadas neste navegador e, se você entrar numa conta, em todos os aparelhos dela.</p>
        <button type="button" className="btn primary" onClick={saveNow} data-autofocus>
          <Icon name="save" /> {projectId ? 'Salvar alterações' : 'Salvar skin atual'}
        </button>
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <p><b>Nenhuma skin salva ainda.</b></p>
          <p className="muted">Use "Salvar skin atual" para guardar o que está no editor. O trabalho em andamento também é salvo automaticamente.</p>
        </div>
      ) : (
        <div className="card-grid">
          {list.map((p) => (
            <div key={p.id} className={'tpl-card project' + (p.id === projectId ? ' current' : '')}>
              <button type="button" className="thumb" onClick={async () => { await openProject(p); set({ modal: null }); showToast(`"${p.name}" aberta.`); }} aria-label={`Abrir ${p.name}`}>
                <ProjectThumb p={p} />
              </button>
              <div className="tpl-meta">
                {editing === p.id ? (
                  <input
                    id={'ren-' + p.id} className="rename" defaultValue={p.name} autoFocus maxLength={40}
                    onBlur={(e) => { renameProject(p.id, e.target.value.trim() || p.name); if (p.id === projectId) set({ skinName: e.target.value.trim() || p.name }); setEditing(null); refresh(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(null); }}
                  />
                ) : (
                  <span className="tpl-name">{p.name}{p.id === projectId && <span className="tag">aberta</span>}</span>
                )}
                <span className="tpl-desc">{fmt.format(p.updatedAt)} · {p.model === 'slim' ? 'Slim' : 'Clássico'}</span>
                {confirm === p.id ? (
                  <span className="row-actions">
                    <span className="small">Excluir de vez?</span>
                    <button type="button" className="btn danger small" onClick={() => { deleteProject(p.id); setConfirm(null); refresh(); }}>Excluir</button>
                    <button type="button" className="btn ghost small" onClick={() => setConfirm(null)}>Cancelar</button>
                  </span>
                ) : (
                  <span className="row-actions">
                    <button type="button" className="btn small" onClick={async () => { await openProject(p); set({ modal: null }); }}>Abrir</button>
                    <button type="button" className="btn ghost small" onClick={() => setEditing(p.id)}>Renomear</button>
                    <button type="button" className="btn ghost small" onClick={() => { duplicateProject(p); refresh(); }}>Duplicar</button>
                    <button type="button" className="icon-btn" aria-label={`Excluir ${p.name}`} data-tip="Excluir" onClick={() => setConfirm(p.id)}><Icon name="trash" /></button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
