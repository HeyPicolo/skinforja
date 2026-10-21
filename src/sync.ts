// Sincronização das skins com a conta (nome + PIN) entre aparelhos.
import { doc } from './skin/document';
import { importSkinDataURL } from './skin/io';
import { flushAutosave, listDeleted, listProjects, setChangeHook } from './projects';
import { lsGet, lsRemove, lsSet } from './storage';
import { useApp } from './store';
import { mergeData, type SyncCurrent, type SyncData } from './sync-merge';

interface Account { name: string; pin: string }

const API = '/api/sync';
let pushTimer = 0;
let busy = false;
let again = false;
let suppressHook = false;

export function currentAccount(): Account | null {
  return lsGet<Account | null>('account', null);
}

function localData(): SyncData {
  return {
    projects: listProjects(),
    deleted: listDeleted(),
    current: lsGet<SyncCurrent | null>('autosave', null),
  };
}

async function call(action: 'login' | 'push', acc: Account, data: SyncData) {
  let res: Response;
  try {
    res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, name: acc.name, pin: acc.pin, data }),
    });
  } catch {
    throw new Error('Sem conexão com o servidor. As skins continuam guardadas neste aparelho e sobem quando a internet voltar.');
  }
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new Error('A sincronização só funciona no site skinforja.vercel.app.');
  }
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body.message ?? 'Não foi possível sincronizar.') as Error & { code?: string };
    err.code = body.error;
    throw err;
  }
  return body as { ok: true; name: string; created: boolean; data: SyncData };
}

/** Aplica o resultado mesclado neste aparelho. */
async function apply(server: SyncData) {
  const local = localData();
  const merged = mergeData(local, server);
  suppressHook = true;
  try {
    lsSet('projects', merged.projects);
    lsSet('deleted', merged.deleted);
    const lc = local.current;
    const sc = merged.current;
    // outro aparelho tem um trabalho em andamento mais novo: abre ele aqui
    if (sc && (!lc || sc.savedAt > lc.savedAt) && sc.png !== lc?.png) {
      const r = await importSkinDataURL(sc.png);
      doc.load(r.pixels, sc.model);
      doc.setOriginal();
      useApp.setState({ skinName: sc.name || 'Minha skin', projectId: sc.projectId ?? null });
      lsSet('autosave', sc);
    }
  } finally {
    suppressHook = false;
  }
  useApp.setState({ syncRev: Date.now() });
}

async function run(action: 'login' | 'push', acc: Account) {
  if (busy) { again = true; return; }
  busy = true;
  useApp.setState({ syncState: 'syncing' });
  try {
    flushAutosave();
    const r = await call(action, acc, localData());
    await apply(r.data);
    useApp.setState({ syncState: 'ok', syncError: null, syncAt: Date.now(), syncName: r.name });
    return r;
  } catch (e) {
    const code = (e as { code?: string }).code;
    useApp.setState({ syncState: 'error', syncError: (e as Error).message });
    if (code === 'wrong_pin' && action === 'push') {
      // o PIN mudou ou a conta foi recriada: pede para entrar de novo
      lsRemove('account');
      useApp.setState({ syncName: null });
    }
    throw e;
  } finally {
    busy = false;
    if (again) { again = false; schedulePush(500); }
  }
}

/** Entra (ou cria) a conta e mescla as skins deste aparelho com as da conta. */
export async function login(name: string, pin: string) {
  const acc = { name: name.trim().toUpperCase(), pin };
  const r = await run('login', acc);
  lsSet('account', { name: r!.name, pin });
  return r!;
}

export function logout() {
  lsRemove('account');
  useApp.setState({ syncName: null, syncState: 'idle', syncError: null });
}

export function syncNow() {
  const acc = currentAccount();
  if (!acc) return Promise.resolve();
  return run('push', acc).catch(() => {});
}

function schedulePush(ms = 2500) {
  if (!currentAccount()) return;
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => { void syncNow(); }, ms);
}

export function startSync() {
  setChangeHook(() => { if (!suppressHook) schedulePush(); });
  const acc = currentAccount();
  if (acc) {
    useApp.setState({ syncName: acc.name });
    void syncNow();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  window.setInterval(() => { if (document.visibilityState === 'visible') void syncNow(); }, 45_000);
}
