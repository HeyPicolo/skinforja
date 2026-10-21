// Mesclagem dos dados de uma conta (usada no navegador e no servidor).
// Cada skin guardada tem data de atualização; a mais nova vence. Exclusões viram "lápides" com data.

export interface SyncProject { id: string; name: string; model: 'classic' | 'slim'; png: string; updatedAt: number }
export interface SyncCurrent { name: string; model: 'classic' | 'slim'; png: string; projectId: string | null; savedAt: number }
export interface SyncData { projects: SyncProject[]; deleted: Record<string, number>; current: SyncCurrent | null }

export const EMPTY_DATA: SyncData = { projects: [], deleted: {}, current: null };

const MAX_PROJECTS = 300;
const MAX_PNG = 40_000; // data URL de uma skin 64×64 fica bem abaixo disso

function validProject(p: unknown): p is SyncProject {
  const x = p as SyncProject;
  return !!x && typeof x.id === 'string' && x.id.length < 64 && typeof x.name === 'string' &&
    (x.model === 'classic' || x.model === 'slim') && typeof x.png === 'string' &&
    x.png.startsWith('data:image/png;base64,') && x.png.length < MAX_PNG && typeof x.updatedAt === 'number';
}

function validCurrent(c: unknown): c is SyncCurrent {
  const x = c as SyncCurrent;
  return !!x && typeof x.png === 'string' && x.png.startsWith('data:image/png;base64,') && x.png.length < MAX_PNG &&
    (x.model === 'classic' || x.model === 'slim') && typeof x.savedAt === 'number';
}

/** Limpa dados vindos de fora (descarta o que estiver malformado). */
export function sanitize(d: unknown): SyncData {
  const x = (d ?? {}) as Partial<SyncData>;
  const deleted: Record<string, number> = {};
  if (x.deleted && typeof x.deleted === 'object') {
    for (const [k, v] of Object.entries(x.deleted)) if (typeof v === 'number' && k.length < 64) deleted[k] = v;
  }
  return {
    projects: Array.isArray(x.projects) ? x.projects.filter(validProject).map((p) => ({ ...p, name: p.name.slice(0, 40) })) : [],
    deleted,
    current: validCurrent(x.current) ? { ...x.current, name: String(x.current.name ?? '').slice(0, 40) } : null,
  };
}

export function mergeData(a: SyncData, b: SyncData): SyncData {
  const deleted: Record<string, number> = { ...a.deleted };
  for (const [k, v] of Object.entries(b.deleted)) deleted[k] = Math.max(deleted[k] ?? 0, v);
  const byId = new Map<string, SyncProject>();
  for (const p of [...a.projects, ...b.projects]) {
    const cur = byId.get(p.id);
    if (!cur || p.updatedAt > cur.updatedAt) byId.set(p.id, p);
  }
  const projects = [...byId.values()]
    .filter((p) => !(deleted[p.id] >= p.updatedAt))
    .sort((x, y) => y.updatedAt - x.updatedAt)
    .slice(0, MAX_PROJECTS);
  let current = a.current;
  if (b.current && (!current || b.current.savedAt > current.savedAt)) current = b.current;
  return { projects, deleted, current };
}
