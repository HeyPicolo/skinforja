// Empacota os testes com esbuild (vem junto com o Vite) e executa no Node.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'skinforja-'));
for (const name of ['core', 'sync']) {
  const out = join(dir, `${name}.test.mjs`);
  await build({
    entryPoints: [`scripts/${name}.test.ts`], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
    alias: { '@vercel/blob': './scripts/blob-mock.ts' },
  });
  execFileSync(process.execPath, [out], { stdio: 'inherit' });
}
