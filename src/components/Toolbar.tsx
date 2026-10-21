import { TOOLS, SIZE_TOOLS } from '../skin/tools';
import { useApp } from '../store';
import { Icon } from './Icon';

export function Toolbar() {
  const tool = useApp((s) => s.tool);
  const setTool = useApp((s) => s.setTool);
  const size = useApp((s) => s.size);
  const noise = useApp((s) => s.noise);
  const mirror = useApp((s) => s.mirror);
  const paint3d = useApp((s) => s.paint3d);
  const set = useApp((s) => s.set);
  const current = TOOLS.find((t) => t.id === tool)!;

  return (
    <aside className="toolbar" aria-label="Ferramentas">
      <div className="tool-grid" role="radiogroup" aria-label="Ferramenta">
        {TOOLS.map((t) => (
          <button
            key={t.id} type="button" role="radio" aria-checked={tool === t.id}
            className={'tool' + (tool === t.id ? ' active' : '')}
            onClick={() => setTool(t.id)}
            aria-label={`${t.label} (${t.key})`}
            data-tip={`${t.label} · ${t.key}`}
          >
            <Icon name={t.id} size={20} />
          </button>
        ))}
      </div>

      <div className="tool-options">
        <p className="tool-name">{current.label}<kbd>{current.key}</kbd></p>
        <p className="tool-hint">{current.hint}</p>
        {SIZE_TOOLS.includes(tool) && (
          <label className="slider-row stacked">
            <span className="lbl">Tamanho <b>{size}×{size}</b></span>
            <input id="tam-pincel" type="range" min={1} max={8} value={size} onChange={(e) => set({ size: +e.target.value })} />
          </label>
        )}
        {tool === 'noise' && (
          <label className="slider-row stacked">
            <span className="lbl">Variação <b>{Math.round(noise * 100)}%</b></span>
            <input id="ruido" type="range" min={2} max={40} value={Math.round(noise * 100)} onChange={(e) => set({ noise: +e.target.value / 100 })} />
          </label>
        )}
      </div>

      <div className="toggles">
        <button
          type="button" className={'toggle' + (mirror ? ' on' : '')} aria-pressed={mirror}
          onClick={() => set({ mirror: !mirror })} data-tip="Espelhar · M" aria-label="Espelhar (M)"
        >
          <Icon name="mirror" size={20} />
          <span>Espelho</span>
        </button>
        <button
          type="button" className={'toggle' + (paint3d ? ' on' : '')} aria-pressed={paint3d}
          onClick={() => set({ paint3d: !paint3d })} data-tip="Pintar no 3D · T" aria-label="Pintar no modelo 3D (T)"
        >
          <Icon name="cube" size={20} />
          <span>Pintar 3D</span>
        </button>
      </div>
    </aside>
  );
}
