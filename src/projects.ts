// Salvamento automático e lista "Minhas skins" (no navegador).
import { doc } from './skin/document';
import { importSkinDataURL, pixelsToDataURL } from './skin/io';
import type { ArmModel } from './skin/layout';
import { lsGet, lsSet } from './storage';
import { useApp } from './store';

export interface Project { id: string; name: string; model: ArmModel; png: string; updatedAt: number }
interface Autosave { name: string; model: ArmModel; png: string; projectId: string | null; savedAt: number }

export function listProjects(): Project[] {
  return lsGet<Project[]>('projects', []).sort((a, b) => b.updatedAt - a.updatedAt);
}

function writeProjects(list: Project[]) {
  return lsSet('projects', list);
}

export function saveCurrentAsProject(): Project | null {
  const s = useApp.getState();
  const list = listProjects();
  const png = pixelsToDataURL(doc.px);
  const now = Date.now();
  let p = s.projectId ? list.find((x) => x.id === s.projectId) : undefined;
  if (p) {
    Object.assign(p, { name: s.skinName, model: doc.model, png, updatedAt: now });
  } else {
    p = { id: 'p' + now.toString(36) + Math.random().toString(36).slice(2, 6), name: s.skinName, model: doc.model, png, updatedAt: now };
    list.push(p);
  }
  if (!writeProjects(list)) return null;
  useApp.setState({ projectId: p.id });
  return p;
}

export function deleteProject(id: string) {
  writeProjects(listProjects().filter((p) => p.id !== id));
  if (useApp.getState().projectId === id) useApp.setState({ projectId: null });
}

export function renameProject(id: string, name: string) {
  const list = listProjects();
  const p = list.find((x) => x.id === id);
  if (p) { p.name = name; writeProjects(list); }
}

export async function openProject(p: Project) {
  const r = await importSkinDataURL(p.png);
  doc.load(r.pixels, p.model);
  useApp.setState({ skinName: p.name, projectId: p.id });
}

export function duplicateProject(p: Project) {
  const list = listProjects();
  const copy = { ...p, id: 'p' + Date.now().toString(36), name: p.name + ' (cópia)', updatedAt: Date.now() };
  list.push(copy);
  writeProjects(list);
}

// ---------- salvamento automático ----------

let timer = 0;
let lastSaved = 0;

export function autosaveNow() {
  const s = useApp.getState();
  const data: Autosave = { name: s.skinName, model: doc.model, png: pixelsToDataURL(doc.px), projectId: s.projectId, savedAt: Date.now() };
  if (lsSet('autosave', data)) {
    lastSaved = data.savedAt;
    useApp.setState({ savedAt: lastSaved });
  }
}

export function startAutosave() {
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(autosaveNow, 700);
  };
  doc.subscribe(schedule);
  useApp.subscribe((s, p) => { if (s.skinName !== p.skinName || s.projectId !== p.projectId) schedule(); });
  window.addEventListener('pagehide', autosaveNow);
}

export async function restoreAutosave(): Promise<boolean> {
  const a = lsGet<Autosave | null>('autosave', null);
  if (!a?.png) return false;
  try {
    const r = await importSkinDataURL(a.png);
    doc.load(r.pixels, a.model);
    useApp.setState({ skinName: a.name || 'Minha skin', projectId: a.projectId ?? null });
    return true;
  } catch {
    return false;
  }
}
