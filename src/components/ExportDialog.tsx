import { useMemo, useState } from 'react';
import { doc } from '../skin/document';
import { buildMcpack, pixelsToBlob, safeFileName } from '../skin/io';
import { layout, SKIN_SIZE, type ArmModel } from '../skin/layout';
import { renderThumb } from '../skin/thumbs';
import { saveFile } from '../download';
import { useApp } from '../store';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

function transparentBasePixels(): number {
  const L = layout(doc.model);
  let n = 0;
  for (let i = 0; i < SKIN_SIZE * SKIN_SIZE; i++) {
    const o = L.owner[i];
    if (o >= 0 && L.infos[o].layer === 'base' && doc.px[i] >>> 24 === 0) n++;
  }
  return n;
}

export function ExportDialog() {
  const set = useApp((s) => s.set);
  const skinName = useApp((s) => s.skinName);
  const showToast = useApp((s) => s.showToast);
  const [packName, setPackName] = useState('Minhas Skins');
  const [model, setModelChoice] = useState<ArmModel>(doc.model);
  const [busy, setBusy] = useState<'' | 'png' | 'pack'>('');
  const [note, setNote] = useState<string | null>(null);
  const holes = useMemo(transparentBasePixels, []);
  const front = useMemo(() => renderThumb('exp:' + doc.rev + doc.model, doc.px, doc.model, 0.5), []);
  const back = useMemo(() => renderThumb('expb:' + doc.rev + doc.model, doc.px, doc.model, Math.PI + 0.5), []);
  const base = safeFileName(skinName);

  const done = (outcome: string, what: string) => {
    if (outcome === 'saved') showToast(`${what} pronto.`);
    else if (outcome === 'declined') setNote('Download cancelado.');
    else setNote('Não foi possível salvar o arquivo aqui. Tente de novo ou use outro navegador.');
  };

  const exportPng = async () => {
    setBusy('png'); setNote(null);
    const blob = await pixelsToBlob(doc.px);
    done(await saveFile(`${base}.png`, blob), 'PNG');
    setBusy('');
  };

  const exportPack = async () => {
    setBusy('pack'); setNote(null);
    const png = new Uint8Array(await (await pixelsToBlob(doc.px)).arrayBuffer());
    const zip = buildMcpack({ packName: packName.trim() || 'Minhas Skins', skinName: skinName.trim() || 'Minha skin', model, png });
    const blob = new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
    let r = await saveFile(`${base}.mcpack`, blob);
    if (r === 'wrong-extension') {
      r = await saveFile(`${base}.zip`, blob);
      if (r === 'saved') {
        setNote('Este ambiente só permite salvar como .zip. Renomeie o arquivo de ".zip" para ".mcpack" e abra-o para importar no Minecraft.');
        setBusy('');
        return;
      }
    }
    done(r, 'Pacote .mcpack');
    setBusy('');
  };

  return (
    <Dialog title="Exportar skin" onClose={() => set({ modal: null })} wide>
      <div className="export-grid">
        <div className="export-preview">
          {front && <img src={front} alt="Prévia da skin de frente" />}
          {back && <img src={back} alt="Prévia da skin de costas" />}
        </div>
        <div className="export-form">
          <label className="field block">
            <span>Nome da skin</span>
            <input id="exp-nome" value={skinName} maxLength={40} onChange={(e) => set({ skinName: e.target.value })} data-autofocus />
          </label>
          {holes > 0 && (
            <p className="notice warn">
              <b>{holes} pixel{holes > 1 ? 's' : ''} da camada base {holes > 1 ? 'estão' : 'está'} transparente{holes > 1 ? 's' : ''}.</b> No jogo, a base não aceita transparência: esses pixels aparecem pretos.
            </p>
          )}

          <section className="export-option">
            <div>
              <h3>Imagem PNG <span className="tag">Java e Bedrock</span></h3>
              <p className="small">Arquivo padrão 64×64.</p>
              <ul className="steps small">
                <li><b>Java:</b> no Launcher, abra Skins › Nova skin e escolha o arquivo.</li>
                <li><b>Bedrock:</b> Vestiário › Skins clássicas › Importar.</li>
              </ul>
            </div>
            <button type="button" className="btn primary" onClick={exportPng} disabled={!!busy}>
              <Icon name="download" /> {busy === 'png' ? 'Gerando…' : 'Baixar PNG'}
            </button>
          </section>

          <section className="export-option">
            <div>
              <h3>Pacote .mcpack <span className="tag">Bedrock</span></h3>
              <p className="small">Abra o arquivo e o Minecraft importa o pacote de skins.</p>
              <div className="pack-fields">
                <label className="field block">
                  <span>Nome do pacote</span>
                  <input id="exp-pacote" value={packName} maxLength={40} onChange={(e) => setPackName(e.target.value)} />
                </label>
                <div className="segmented small" role="radiogroup" aria-label="Modelo do braço no pacote">
                  {(['classic', 'slim'] as ArmModel[]).map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={model === m} className={model === m ? 'on' : ''} onClick={() => setModelChoice(m)}>
                      <b>{m === 'classic' ? 'Clássico' : 'Slim'}</b>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button type="button" className="btn primary" onClick={exportPack} disabled={!!busy}>
              <Icon name="download" /> {busy === 'pack' ? 'Gerando…' : 'Baixar .mcpack'}
            </button>
          </section>
          {note && <p className="notice" role="status">{note}</p>}
        </div>
      </div>
    </Dialog>
  );
}
