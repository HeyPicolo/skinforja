// Sons curtos sintetizados (sem arquivos) e voz que fala o nome dos botões em português.
import { useApp } from '../store';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!useApp.getState().sound) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** O iPad só libera áudio depois de um toque: chamado no primeiro toque da tela. */
export function unlockAudio() {
  const a = audio();
  if (!a) return;
  const b = a.createBuffer(1, 1, 22050);
  const s = a.createBufferSource();
  s.buffer = b; s.connect(a.destination); s.start(0);
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; to?: number; vol?: number; delay?: number } = {}) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
  const v = opts.vol ?? 0.12;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

let lastTick = 0;

export const sfx = {
  tap: () => tone(880, 0.07, { type: 'triangle', vol: 0.08 }),
  select: () => { tone(660, 0.06, { type: 'triangle', vol: 0.08 }); tone(990, 0.08, { type: 'triangle', vol: 0.07, delay: 0.05 }); },
  paint: () => {
    const now = performance.now();
    if (now - lastTick < 70) return;
    lastTick = now;
    tone(500 + Math.random() * 500, 0.04, { type: 'sine', vol: 0.05 });
  },
  fill: () => tone(300, 0.35, { type: 'sine', to: 1200, vol: 0.1 }),
  stamp: () => { tone(180, 0.08, { type: 'square', vol: 0.06 }); tone(1200, 0.12, { type: 'triangle', vol: 0.07, delay: 0.04 }); },
  pick: () => { tone(1200, 0.05, { vol: 0.08 }); tone(1600, 0.07, { vol: 0.07, delay: 0.05 }); },
  undo: () => tone(700, 0.18, { type: 'triangle', to: 300, vol: 0.09 }),
  redo: () => tone(300, 0.18, { type: 'triangle', to: 700, vol: 0.09 }),
  miss: () => tone(160, 0.12, { type: 'sine', vol: 0.06 }),
  magic: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.09, delay: i * 0.07 })),
  save: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.1, delay: i * 0.08 })),
};

// ---------- voz ----------
let voice: SpeechSynthesisVoice | null = null;
function pickVoice() {
  try {
    const vs = window.speechSynthesis?.getVoices() ?? [];
    voice = vs.find((v) => v.lang === 'pt-BR') ?? vs.find((v) => v.lang.startsWith('pt')) ?? null;
  } catch { voice = null; }
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

export function say(text: string) {
  if (!useApp.getState().voice) return;
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    if (voice) u.voice = voice;
    u.rate = 1.0;
    u.pitch = 1.15;
    s.speak(u);
  } catch { /* sem voz neste aparelho */ }
}
