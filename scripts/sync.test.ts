// Testes da conta e da mesclagem (servidor com Blob simulado).
import { POST } from '../api/sync';
import { mergeData, EMPTY_DATA, type SyncData } from '../src/sync-merge';

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FALHOU'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failed++;
};
const PNG = 'data:image/png;base64,AAAA';
const proj = (id: string, t: number, name = id) => ({ id, name, model: 'classic' as const, png: PNG, updatedAt: t });
const call = async (body: unknown) => {
  const r = await POST(new Request('http://x/api/sync', { method: 'POST', body: JSON.stringify(body) }));
  return { status: r.status, body: await r.json() };
};

// mesclagem
const a: SyncData = { projects: [proj('p1', 10, 'velho'), proj('p2', 5)], deleted: {}, current: { name: 'A', model: 'classic', png: PNG, projectId: null, savedAt: 100 } };
const b: SyncData = { projects: [proj('p1', 20, 'novo'), proj('p3', 7)], deleted: { p2: 6 }, current: { name: 'B', model: 'slim', png: PNG, projectId: null, savedAt: 200 } };
const m = mergeData(a, b);
check('versão mais nova da skin vence', m.projects.find((p) => p.id === 'p1')?.name === 'novo');
check('skin excluída em outro aparelho some', !m.projects.some((p) => p.id === 'p2'));
check('skins dos dois aparelhos ficam juntas', m.projects.some((p) => p.id === 'p3'));
check('trabalho em andamento mais novo vence', m.current?.name === 'B');
check('mesclar é simétrico', JSON.stringify(mergeData(b, a).projects) === JSON.stringify(m.projects));
check('skin salva depois da exclusão volta', mergeData(m, { ...EMPTY_DATA, projects: [proj('p2', 9)] }).projects.some((p) => p.id === 'p2'));

// servidor
let r = await call({ action: 'login', name: 'jose', pin: '12', data: {} });
check('PIN curto recusado', r.status === 400 && r.body.error === 'bad_pin');
r = await call({ action: 'login', name: 'José', pin: '4321', data: { projects: [proj('pc1', 1)] } });
check('primeiro login cria a conta JOSÉ', r.status === 200 && r.body.created === true && r.body.name === 'JOSÉ');
check('skins do PC sobem na criação', r.body.data.projects.length === 1);
r = await call({ action: 'login', name: 'jose', pin: '4321', data: { projects: [proj('ipad1', 2)] } });
check('mesmo nome sem acento entra na mesma conta', r.status === 200 && r.body.created === false);
check('iPad recebe as skins do PC e envia as dele', r.body.data.projects.length === 2);
r = await call({ action: 'push', name: 'JOSE', pin: '9999', data: {} });
check('PIN errado recusado', r.status === 401 && r.body.error === 'wrong_pin');
for (let i = 0; i < 4; i++) await call({ action: 'push', name: 'JOSE', pin: '0000', data: {} });
r = await call({ action: 'push', name: 'JOSE', pin: '4321', data: {} });
check('5 erros bloqueiam por um minuto', r.status === 429);
r = await call({ action: 'push', name: 'MARIA', pin: '1234', data: {} });
check('enviar para conta inexistente pede login', r.status === 404);
r = await call({ action: 'login', name: 'MARIA', pin: '1234', data: { projects: [{ id: 'x', png: 'javascript:alert(1)' }] } });
check('dados malformados são descartados', r.status === 200 && r.body.data.projects.length === 0);

console.log(failed ? `\n${failed} teste(s) falharam` : '\nTodos os testes de sincronização passaram');
if (failed) process.exit(1);
