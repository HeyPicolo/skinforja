// Empacota os testes com esbuild (vem junto com o Vite) e executa no Node.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(mkdtempSync(join(tmpdir(), 'skinforja-')), 'core.test.mjs');
await build({ entryPoints: ['scripts/core.test.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' });
execFileSync(process.execPath, [out], { stdio: 'inherit' });
