// Substitui o @vercel/blob nos testes: guarda tudo em memória.
const mem = new Map<string, string>();
export async function put(path: string, body: string) { mem.set(path, body); return { pathname: path }; }
export async function get(path: string) {
  const v = mem.get(path);
  if (v === undefined) return null;
  return { statusCode: 200, stream: new Response(v).body, blob: { pathname: path } };
}
export const __mem = mem;
