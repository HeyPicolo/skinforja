// Acesso seguro ao localStorage (pode falhar em janelas privadas ou com dados bloqueados).
const PREFIX = 'skinforja:';

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function lsRemove(key: string) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignora */ }
}
