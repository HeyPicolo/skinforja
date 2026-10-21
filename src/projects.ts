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

let changeHook: () => void = () => {};
/** Avisado sempre que algo guardado muda neste aparelho (usado pela sincronização). */
export function setChangeHook(fn: () => void) { changeHook = fn; }

function writeProjects(list: Project[]) {
  const ok = lsSet('projects', list);
  changeHook();
  return ok;
}

export function listDeleted(): Record<string, number> { return lsGet<Record<string, number>>('deleted', {}); }

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
  lsSet('deleted', { ...listDeleted(), [id]: Date.now() });
  writeProjects(listProjects().filter((p) => p.id !== id));
  if (useApp.getState().projectId === id) useApp.setState({ projectId: null });
}

export function renameProject(id: string, name: string) {
  const list = listProjects();
  const p = list.find((x) => x.id === id);
  if (p) { p.name = name; p.updatedAt = Date.now(); writeProjects(list); }
}

export async function openProject(p: Project) {
  const r = await importSkinDataURL(p.png);
  doc.load(r.pixels, p.model);
  doc.setOriginal();
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
/** Momento da última mudança real (pintura, nome) — é o que decide qual aparelho tem o trabalho mais novo. */
let lastChange = 0;

/** Grava agora se houver um salvamento automático pendente. */
export function flushAutosave() {
  if (!timer) return;
  window.clearTimeout(timer);
  timer = 0;
  autosaveNow();
}

export function autosaveNow() {
  const s = useApp.getState();
  timer = 0;
  const data: Autosave = { name: s.skinName, model: doc.model, png: pixelsToDataURL(doc.px), projectId: s.projectId, savedAt: lastChange || Date.now() };
  if (lsSet('autosave', data)) {
    lastSaved = data.savedAt;
    useApp.setState({ savedAt: lastSaved });
    changeHook();
  }
}

export function startAutosave() {
  const schedule = () => {
    lastChange = Date.now();
    window.clearTimeout(timer);
    timer = window.setTimeout(autosaveNow, 700);
  };
  doc.subscribe(schedule);
  useApp.subscribe((s, p) => { if (s.skinName !== p.skinName || s.projectId !== p.projectId) schedule(); });
  window.addEventListener('pagehide', flushAutosave);
}

export async function restoreAutosave(): Promise<boolean> {
  const a = lsGet<Autosave | null>('autosave', null);
  if (!a?.png) return false;
  try {
    const r = await importSkinDataURL(a.png);
    doc.load(r.pixels, a.model);
    doc.setOriginal();
    lastChange = a.savedAt || 0;
    useApp.setState({ skinName: a.name || 'Minha skin', projectId: a.projectId ?? null });
    return true;
  } catch {
    return false;
  }
}
