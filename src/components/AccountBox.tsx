import { useState } from 'react';
import { useApp } from '../store';
import { login, logout, syncNow } from '../sync';

const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function AccountBox() {
  const syncName = useApp((s) => s.syncName);
  const syncState = useApp((s) => s.syncState);
  const syncError = useApp((s) => s.syncError);
  const syncAt = useApp((s) => s.syncAt);
  const [name, setName] = useState('JOSE');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (syncName) {
    return (
      <section className="account-box" aria-labelledby="conta-titulo">
        <div className="account-head">
          <h3 id="conta-titulo">Conta <b>{syncName}</b></h3>
          <span className={'sync-pill ' + syncState}>
            {syncState === 'syncing' ? 'Sincronizando…' : syncState === 'error' ? 'Não sincronizou' : syncAt ? `Sincronizado às ${time.format(syncAt)}` : 'Conectado'}
          </span>
        </div>
        {msg && <p className="notice">{msg}</p>}
        {syncState === 'error' && syncError && <p className="notice warn">{syncError}</p>}
        <p className="small muted">As skins guardadas e o desenho em andamento ficam iguais em todo aparelho que entrar como {syncName}.</p>
        <div className="row-actions">
          <button type="button" className="btn small" onClick={() => { setMsg(null); void syncNow(); }} disabled={syncState === 'syncing'}>Sincronizar agora</button>
          <button type="button" className="btn ghost small" onClick={() => { logout(); setMsg(null); }}>Sair deste aparelho</button>
        </div>
      </section>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await login(name, pin);
      setMsg(r.created ? `Conta ${r.name} criada. No iPad, entre com o mesmo nome e PIN.` : null);
      setPin('');
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="account-box" aria-labelledby="conta-titulo">
      <h3 id="conta-titulo">Sincronizar entre aparelhos</h3>
      <p className="small muted">
        Entre com um nome e um PIN para ver as mesmas skins no computador e no iPad. Se o nome ainda não existir, a conta é criada
        com este PIN, e as skins deste aparelho sobem para ela.
      </p>
      <form className="account-form" onSubmit={submit}>
        <label className="field block">
          <span>Nome</span>
          <input id="conta-nome" value={name} maxLength={20} autoCapitalize="characters" autoComplete="username"
            onChange={(e) => setName(e.target.value.toUpperCase())} />
        </label>
        <label className="field block">
          <span>PIN (4 a 8 números)</span>
          <input id="conta-pin" value={pin} type="password" inputMode="numeric" pattern="\d{4,8}" maxLength={8} autoComplete="current-password"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        </label>
        <button type="submit" className="btn primary" disabled={busy || name.trim().length < 2 || pin.length < 4}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      {msg && <p className="notice warn" role="status">{msg}</p>}
    </section>
  );
}
