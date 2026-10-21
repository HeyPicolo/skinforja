// Entrega de arquivos: usa o recurso de downloads quando o app roda como Artifact,
// e um link de download comum quando roda em outro lugar (npm run dev, hospedagem própria).

interface DownloadsNS { save(r: { filename: string; data: Blob | ArrayBuffer | Uint8Array | string }): Promise<{ status: string }> }
type ClaudeGlobal = { use?: (name: string) => Promise<unknown> };

let nsPromise: Promise<DownloadsNS | null> | null = null;

function downloadsNS(): Promise<DownloadsNS | null> {
  if (!nsPromise) {
    const c = (window as unknown as { claude?: ClaudeGlobal }).claude;
    nsPromise = c?.use ? (c.use('downloads') as Promise<DownloadsNS | null>).catch(() => null) : Promise.resolve(null);
  }
  return nsPromise;
}

export function prefetchDownloads() { void downloadsNS(); }

export type SaveOutcome = 'saved' | 'declined' | 'wrong-extension' | 'failed';

function anchorDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function saveFile(filename: string, blob: Blob): Promise<SaveOutcome> {
  const ns = await downloadsNS();
  if (!ns) {
    try { anchorDownload(filename, blob); return 'saved'; } catch { return 'failed'; }
  }
  try {
    await ns.save({ filename, data: blob });
    return 'saved';
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'declined') return 'declined';
    if (code === 'rejected_extension' || code === 'extension_not_enabled') return 'wrong-extension';
    return 'failed';
  }
}
