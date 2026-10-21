// Conta simples (nome + PIN) com as skins guardadas num Blob privado da Vercel.
// POST /api/sync  { action: 'login' | 'push', name, pin, data? }
import { get, put } from '@vercel/blob';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { EMPTY_DATA, mergeData, sanitize, type SyncData } from '../src/sync-merge.js';

interface UserRecord {
  v: 1;
  name: string;
  salt: string;
  hash: string;
  failed: number;
  lockUntil: number;
  data: SyncData;
  updatedAt: number;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function userKey(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function hashPin(pin: string, salt: string) {
  return scryptSync(pin, salt, 32).toString('hex');
}

async function readUser(key: string): Promise<UserRecord | null> {
  const r = await get(`users/${key}.json`, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  const text = await new Response(r.stream).text();
  return JSON.parse(text) as UserRecord;
}

async function writeUser(key: string, u: UserRecord) {
  await put(`users/${key}.json`, JSON.stringify(u), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60,
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: { action?: string; name?: string; pin?: string; data?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'bad_request', message: 'Pedido inválido.' }, 400); }

  const name = String(body.name ?? '').trim().toUpperCase().slice(0, 20);
  const pin = String(body.pin ?? '');
  const key = userKey(name);
  if (key.length < 2) return json({ error: 'bad_name', message: 'Use um nome com pelo menos 2 letras.' }, 400);
  if (!/^\d{4,8}$/.test(pin)) return json({ error: 'bad_pin', message: 'O PIN precisa ter de 4 a 8 números.' }, 400);

  const now = Date.now();
  let user = await readUser(key);
  let created = false;

  if (!user) {
    if (body.action !== 'login') return json({ error: 'not_found', message: 'Usuário não encontrado. Entre de novo.' }, 404);
    const salt = randomBytes(16).toString('hex');
    user = { v: 1, name, salt, hash: hashPin(pin, salt), failed: 0, lockUntil: 0, data: EMPTY_DATA, updatedAt: now };
    created = true;
  } else {
    if (user.lockUntil > now) {
      const s = Math.ceil((user.lockUntil - now) / 1000);
      return json({ error: 'locked', message: `Muitas tentativas. Tente de novo em ${s} segundos.` }, 429);
    }
    const ok = timingSafeEqual(Buffer.from(hashPin(pin, user.salt), 'hex'), Buffer.from(user.hash, 'hex'));
    if (!ok) {
      user.failed += 1;
      if (user.failed >= 5) { user.lockUntil = now + 60_000; user.failed = 0; }
      await writeUser(key, user);
      return json({ error: 'wrong_pin', message: 'PIN errado para este usuário.' }, 401);
    }
  }

  const incoming = sanitize(body.data);
  const merged = mergeData(user.data ?? EMPTY_DATA, incoming);
  const changed = created || user.failed > 0 || JSON.stringify(merged) !== JSON.stringify(user.data);
  user.failed = 0;
  user.data = merged;
  if (changed) { user.updatedAt = now; await writeUser(key, user); }
  return json({ ok: true, name: user.name, created, data: merged, updatedAt: user.updatedAt });
}

export async function GET(): Promise<Response> {
  return json({ ok: true, service: 'skinforja-sync' });
}
