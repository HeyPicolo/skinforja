import { useState } from 'react';
import { TOOLS } from '../skin/tools';
import { useApp } from '../store';
import { lsSet } from '../storage';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

const STEPS = [
  {
    icon: 'cube',
    title: 'Pinte direto no boneco',
    text: 'Escolha uma cor e clique no personagem 3D para pintar. Arraste no fundo para girar e use a roda do mouse (ou dois dedos) para aproximar.',
  },
  {
    icon: 'flat',
    title: 'Ou no mapa da textura',
    text: 'Ao lado fica a skin aberta em 64×64 pixels, com cada parte do corpo contornada. Passe o mouse para ver qual face está sob o cursor.',
  },
  {
    icon: 'layers',
    title: 'Duas camadas',
    text: 'A Base é a pele e a roupa. A Externa fica por cima e serve para chapéu, capuz, jaqueta e cabelo com volume. Oculte partes do corpo para alcançar áreas escondidas.',
  },
  {
    icon: 'download',
    title: 'Leve para o jogo',
    text: 'Exporte em PNG (Java e Bedrock) ou como pacote .mcpack (Bedrock). Errou? Ctrl+Z desfaz quantas vezes precisar.',
  },
];

export function Onboarding() {
  const set = useApp((s) => s.set);
  const [i, setI] = useState(0);
  const close = (next: null | 'gallery' = null) => { lsSet('onboarded', true); set({ modal: next }); };
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <Dialog
      title="Bem-vindo ao SkinForja" onClose={() => close()}
      footer={
        <>
          <span className="dots" aria-label={`Passo ${i + 1} de ${STEPS.length}`}>
            {STEPS.map((_, k) => <span key={k} className={k === i ? 'on' : ''} />)}
          </span>
          <span className="grow" />
          {i > 0 && <button type="button" className="btn ghost" onClick={() => setI(i - 1)}>Voltar</button>}
          {!last && <button type="button" className="btn primary" onClick={() => setI(i + 1)} data-autofocus>Próximo</button>}
          {last && <button type="button" className="btn" onClick={() => close()}>Começar a pintar</button>}
          {last && <button type="button" className="btn primary" onClick={() => close('gallery')} data-autofocus>Ver modelos</button>}
        </>
      }
    >
      <div className="onb-step" key={i}>
        <span className="onb-icon"><Icon name={s.icon} size={44} /></span>
        <div>
          <p className="onb-count">Passo {i + 1} de {STEPS.length}</p>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
        </div>
      </div>
    </Dialog>
  );
}

const SHORTCUTS: [string[], string][] = [
  [['Ctrl + Z'], 'Desfazer'],
  [['Ctrl + Y', 'Ctrl + Shift + Z'], 'Refazer'],
  [['M'], 'Ligar/desligar espelho'],
  [['T'], 'Ligar/desligar pintura no 3D'],
  [['X'], 'Alternar camada Base/Externa'],
  [['[', ']'], 'Diminuir/aumentar o pincel'],
  [['Alt + clique'], 'Pegar cor (conta-gotas rápido)'],
  [['Shift + arrastar'], 'Retângulo preenchido'],
  [['Espaço + arrastar'], 'Mover o mapa 2D'],
  [['Roda do mouse'], 'Zoom'],
  [['Ctrl + S'], 'Salvar em Minhas skins'],
  [['Ctrl + E'], 'Exportar'],
];

export function HelpDialog() {
  const set = useApp((s) => s.set);
  return (
    <Dialog title="Atalhos e ajuda" onClose={() => set({ modal: null })} wide>
      <div className="help-grid">
        <section>
          <h3>Ferramentas</h3>
          <table className="keys">
            <tbody>
              {TOOLS.map((t) => (
                <tr key={t.id}><td><kbd>{t.key}</kbd></td><td><b>{t.label}</b> <span className="muted">{t.hint}</span></td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h3>Atalhos</h3>
          <table className="keys">
            <tbody>
              {SHORTCUTS.map(([k, v]) => (
                <tr key={v}><td className="kbd-cell">{k.map((p, j) => <kbd key={j}>{p}</kbd>)}</td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn" onClick={() => set({ modal: 'onboarding' })}>Rever o tutorial</button>
        </section>
      </div>
    </Dialog>
  );
}
