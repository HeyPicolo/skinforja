import { useEffect, useRef, useState } from 'react';
import { hexToRgba, hsvToRgb, rgbToHsv, rgbaToHex, type RGBA } from '../skin/document';
import { useApp, rgbaKey } from '../store';

export const PALETTES: { name: string; colors: string[] }[] = [
  { name: 'Pele', colors: ['#f6d7c3', '#eebd9a', '#e0a47c', '#c98c62', '#a8714c', '#8a5a3b', '#6b4430', '#4a2f22'] },
  { name: 'Cabelo', colors: ['#f4e3a1', '#d9b45a', '#b5652b', '#8a4a24', '#5a3a22', '#3b2a20', '#1f1a17', '#c9c9c9'] },
  { name: 'Natureza', colors: ['#5d9b3a', '#3f7d4e', '#2d5a2f', '#86b84a', '#8b5a2b', '#6b4428', '#9aa0a6', '#5e6b73'] },
  { name: 'Vibrante', colors: ['#e63946', '#f08a24', '#f6d860', '#4ade80', '#22b8cf', '#3b6fe0', '#8b5cf6', '#ec4899'] },
  { name: 'Cinzas', colors: ['#ffffff', '#e5e7eb', '#bfc4cc', '#9aa0a8', '#6b7280', '#4b5563', '#2b2f36', '#111214'] },
];

function SV({ h, s, v, onChange }: { h: number; s: number; v: number; onChange: (s: number, v: number, done: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = (e: React.PointerEvent, done = false) => {
    const r = ref.current!.getBoundingClientRect();
    const ns = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const nv = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    onChange(ns, nv, done);
  };
  return (
    <div
      ref={ref} className="sv" role="slider" aria-label="Saturação e brilho" tabIndex={0}
      aria-valuetext={`saturação ${Math.round(s * 100)}%, brilho ${Math.round(v * 100)}%`}
      style={{ ['--hue' as string]: `hsl(${h} 100% 50%)` }}
      onPointerDown={(e) => { ref.current!.setPointerCapture(e.pointerId); handle(e); }}
      onPointerMove={(e) => { if (e.buttons) handle(e); }}
      onPointerUp={(e) => handle(e, true)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.1 : 0.02;
        if (e.key === 'ArrowLeft') onChange(Math.max(0, s - step), v, true);
        else if (e.key === 'ArrowRight') onChange(Math.min(1, s + step), v, true);
        else if (e.key === 'ArrowUp') onChange(s, Math.min(1, v + step), true);
        else if (e.key === 'ArrowDown') onChange(s, Math.max(0, v - step), true);
        else return;
        e.preventDefault();
      }}
    >
      <span className="sv-dot" style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }} />
    </div>
  );
}

export function ColorPicker() {
  const color = useApp((s) => s.color);
  const setColor = useApp((s) => s.setColor);
  const recent = useApp((s) => s.recent);
  const [hsv, setHsv] = useState(() => rgbToHsv(color.r, color.g, color.b));
  const [hexText, setHexText] = useState(rgbaToHex(color));
  const [pal, setPal] = useState(0);
  const own = useRef(false);

  // cor mudou por fora (conta-gotas, paleta): sincroniza mantendo o matiz quando for cinza
  useEffect(() => {
    if (own.current) { own.current = false; } else {
      const n = rgbToHsv(color.r, color.g, color.b);
      setHsv((p) => ({ h: n.s === 0 || n.v === 0 ? p.h : n.h, s: n.v === 0 ? p.s : n.s, v: n.v }));
    }
    setHexText(rgbaToHex(color));
  }, [color]);

  const fromHsv = (h: number, s: number, v: number, done: boolean) => {
    setHsv({ h, s, v });
    own.current = true;
    const c = hsvToRgb(h, s, v);
    setColor({ ...c, a: color.a }, done);
  };
  const setRgb = (patch: Partial<RGBA>) => setColor({ ...color, ...patch });

  const swatch = (hex: string, key: string) => {
    const c = hexToRgba(hex)!;
    const active = rgbaKey(c) === rgbaKey(color);
    return (
      <button
        key={key} type="button" className={'swatch' + (active ? ' active' : '')} title={hex}
        aria-label={`Usar a cor ${hex}`} style={{ ['--sw' as string]: hex }}
        onClick={() => setColor(c, true)}
      />
    );
  };

  return (
    <section className="panel-block" aria-labelledby="cores-titulo">
      <div className="block-head">
        <h2 id="cores-titulo">Cor</h2>
        <span className="current-swatch" style={{ ['--sw' as string]: `rgba(${color.r},${color.g},${color.b},${color.a / 255})` }} aria-hidden="true" />
      </div>
      <SV h={hsv.h} s={hsv.s} v={hsv.v} onChange={(s, v, done) => fromHsv(hsv.h, s, v, done)} />
      <label className="slider-row">
        <span className="lbl">Matiz</span>
        <input
          id="cor-matiz" type="range" min={0} max={359} value={Math.round(hsv.h)} className="hue"
          onChange={(e) => fromHsv(+e.target.value, hsv.s, hsv.v, false)}
          onPointerUp={() => useApp.getState().pushRecent(rgbaKey(useApp.getState().color))}
        />
      </label>
      <label className="slider-row">
        <span className="lbl">Opacidade</span>
        <input
          id="cor-alfa" type="range" min={0} max={255} value={color.a} className="alpha"
          style={{ ['--solid' as string]: rgbaToHex({ ...color, a: 255 }) }}
          onChange={(e) => setRgb({ a: +e.target.value })}
        />
        <span className="num">{Math.round((color.a / 255) * 100)}%</span>
      </label>
      <div className="color-fields">
        <label className="field hex">
          <span>HEX</span>
          <input
            id="cor-hex" value={hexText} spellCheck={false} maxLength={9}
            onChange={(e) => {
              setHexText(e.target.value);
              const c = hexToRgba(e.target.value);
              if (c && /^#?([0-9a-f]{6}|[0-9a-f]{8})$/i.test(e.target.value.trim())) setColor(c);
            }}
            onBlur={() => { setHexText(rgbaToHex(color)); useApp.getState().pushRecent(rgbaKey(color)); }}
          />
        </label>
        {(['r', 'g', 'b'] as const).map((k) => (
          <label className="field" key={k}>
            <span>{k.toUpperCase()}</span>
            <input
              id={`cor-${k}`} type="number" min={0} max={255} value={color[k]}
              onChange={(e) => setRgb({ [k]: Math.max(0, Math.min(255, +e.target.value || 0)) })}
            />
          </label>
        ))}
      </div>

      <div className="sub-head">
        <h3>Recentes</h3>
      </div>
      <div className="swatches">
        {recent.length ? recent.map((h, i) => swatch(h, 'r' + i)) : <p className="muted small">As cores que você usar aparecem aqui.</p>}
      </div>

      <div className="sub-head">
        <h3>Paletas</h3>
        <select id="paleta" value={pal} onChange={(e) => setPal(+e.target.value)} aria-label="Escolher paleta">
          {PALETTES.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
        </select>
      </div>
      <div className="swatches">{PALETTES[pal].colors.map((h, i) => swatch(h, 'p' + i))}</div>
    </section>
  );
}
