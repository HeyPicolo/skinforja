import { useSyncExternalStore } from 'react';
import { doc } from '../skin/document';
import { PART_LABEL, type ArmModel, type Layer, type PartId } from '../skin/layout';
import { useApp } from '../store';
import { Icon } from './Icon';

export function useDocRev() {
  return useSyncExternalStore((fn) => doc.subscribe(fn), () => doc.rev);
}

export function setModel(m: ArmModel) {
  if (doc.model === m) return;
  doc.begin(m === 'slim' ? 'Braços slim' : 'Braços clássicos');
  doc.commit(m);
}

const BODY_GRID: { part: PartId; area: string; short: string }[] = [
  { part: 'head', area: 'head', short: 'Cabeça' },
  { part: 'rightArm', area: 'ra', short: 'B. dir.' },
  { part: 'body', area: 'body', short: 'Tronco' },
  { part: 'leftArm', area: 'la', short: 'B. esq.' },
  { part: 'rightLeg', area: 'rl', short: 'P. dir.' },
  { part: 'leftLeg', area: 'll', short: 'P. esq.' },
];

export function LayersPanel() {
  useDocRev();
  const activeLayer = useApp((s) => s.activeLayer);
  const showLayer = useApp((s) => s.showLayer);
  const showPart = useApp((s) => s.showPart);
  const set = useApp((s) => s.set);
  const allShown = Object.values(showPart).every(Boolean);

  const toggleLayer = (l: Layer) => set({ showLayer: { ...showLayer, [l]: !showLayer[l] } });
  const togglePart = (p: PartId) => set({ showPart: { ...showPart, [p]: !showPart[p] } });
  const solo = (p: PartId) =>
    set({ showPart: { head: false, body: false, rightArm: false, leftArm: false, rightLeg: false, leftLeg: false, [p]: true } });

  return (
    <section className="panel-block" aria-labelledby="camadas-titulo">
      <div className="block-head">
        <h2 id="camadas-titulo">Camadas</h2>
      </div>
      <div className="layer-list">
        {(['overlay', 'base'] as Layer[]).map((l) => (
          <div key={l} className={'layer-row' + (activeLayer === l ? ' active' : '')}>
            <button
              type="button" className="layer-pick" aria-pressed={activeLayer === l}
              onClick={() => set({ activeLayer: l, showLayer: { ...showLayer, [l]: true } })}
            >
              <span className={'layer-chip ' + l} aria-hidden="true" />
              <span className="layer-text">
                <b>{l === 'base' ? 'Base' : 'Externa'}</b>
                <small>{l === 'base' ? 'Pele e roupa por baixo' : 'Chapéu, jaqueta, mangas, calça'}</small>
              </span>
            </button>
            <button
              type="button" className="icon-btn" aria-pressed={showLayer[l]}
              aria-label={(showLayer[l] ? 'Ocultar' : 'Mostrar') + ' camada ' + (l === 'base' ? 'base' : 'externa')}
              data-tip={showLayer[l] ? 'Ocultar' : 'Mostrar'}
              onClick={() => toggleLayer(l)}
            >
              <Icon name={showLayer[l] ? 'eye' : 'eyeOff'} />
            </button>
          </div>
        ))}
      </div>
      <p className="muted small">A camada destacada é a que você pinta ao clicar no boneco 3D.</p>

      <div className="sub-head">
        <h3>Partes do corpo</h3>
        {!allShown && (
          <button type="button" className="link-btn" onClick={() => set({ showPart: { head: true, body: true, rightArm: true, leftArm: true, rightLeg: true, leftLeg: true } })}>
            Mostrar todas
          </button>
        )}
      </div>
      <div className="body-map" role="group" aria-label="Mostrar ou ocultar partes do corpo">
        {BODY_GRID.map((b) => (
          <button
            key={b.part} type="button" style={{ gridArea: b.area }}
            className={'body-part' + (showPart[b.part] ? ' on' : '')} aria-pressed={showPart[b.part]}
            aria-label={`${PART_LABEL[b.part]}: ${showPart[b.part] ? 'visível' : 'oculta'}`}
            onClick={() => togglePart(b.part)}
            onDoubleClick={() => solo(b.part)}
            data-tip={`${PART_LABEL[b.part]} · clique duplo isola`}
          >
            {b.short}
          </button>
        ))}
      </div>
    </section>
  );
}

export function ModelPanel() {
  useDocRev();
  const model = doc.model;
  return (
    <section className="panel-block" aria-labelledby="modelo-titulo">
      <div className="block-head"><h2 id="modelo-titulo">Modelo do braço</h2></div>
      <div className="segmented" role="radiogroup" aria-label="Modelo do braço">
        {(['classic', 'slim'] as ArmModel[]).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={model === m} className={model === m ? 'on' : ''} onClick={() => setModel(m)}>
            <b>{m === 'classic' ? 'Clássico' : 'Slim'}</b>
            <small>{m === 'classic' ? '4 px (Steve)' : '3 px (Alex)'}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
