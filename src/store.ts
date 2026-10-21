import { create } from 'zustand';
import type { RGBA } from './skin/document';
import type { StampId, ToolId } from './skin/tools';
import type { Layer, PartId, Rect } from './skin/layout';
import type { Pose } from './skin/model3d';
import { lsGet, lsSet } from './storage';

export type ViewMode = 'both' | '3d' | '2d';
export type Theme = 'system' | 'light' | 'dark';
export type Modal = null | 'gallery' | 'export' | 'projects' | 'help' | 'onboarding' | 'parents' | 'colors';
export type Mode = 'kid' | 'pro';

export interface HoverInfo { x: number; y: number; clip: Rect | null; src: '2d' | '3d' }

interface Prefs {
  tool: ToolId; size: number; mirror: boolean; noise: number; theme: Theme;
  recent: string[]; grid: boolean; paint3d: boolean; pose: Pose;
  mode: Mode; sound: boolean; voice: boolean; stamp: StampId;
}

const savedPrefs = lsGet<Partial<Prefs>>('prefs', {});

export interface AppState {
  mode: Mode;
  sound: boolean;
  voice: boolean;
  stamp: StampId;
  painted: boolean;
  celebrate: number;
  tool: ToolId;
  prevTool: ToolId;
  color: RGBA;
  size: number;
  mirror: boolean;
  noise: number;
  activeLayer: Layer;
  showLayer: Record<Layer, boolean>;
  showPart: Record<PartId, boolean>;
  pose: Pose;
  view: ViewMode;
  theme: Theme;
  grid: boolean;
  paint3d: boolean;
  recent: string[];
  hover: HoverInfo | null;
  modal: Modal;
  skinName: string;
  projectId: string | null;
  toast: { id: number; text: string; action?: { label: string; run: () => void } } | null;
  panelOpen: boolean;
  savedAt: number | null;
  syncName: string | null;
  syncState: 'idle' | 'syncing' | 'ok' | 'error';
  syncError: string | null;
  syncAt: number | null;
  syncRev: number;

  set: (p: Partial<AppState>) => void;
  setTool: (t: ToolId) => void;
  setColor: (c: RGBA, remember?: boolean) => void;
  pushRecent: (hex: string) => void;
  showToast: (text: string, action?: { label: string; run: () => void }) => void;
}

let toastId = 0;

export const useApp = create<AppState>((set, get) => ({
  mode: savedPrefs.mode ?? 'kid',
  sound: savedPrefs.sound ?? true,
  voice: savedPrefs.voice ?? true,
  stamp: savedPrefs.stamp ?? 'heart',
  painted: false,
  celebrate: 0,
  tool: savedPrefs.tool ?? (savedPrefs.mode === 'pro' ? 'pencil' : 'brush'),
  prevTool: 'pencil',
  color: { r: 217, g: 117, b: 43, a: 255 },
  size: savedPrefs.size ?? 2,
  mirror: savedPrefs.mirror ?? false,
  noise: savedPrefs.noise ?? 0.12,
  activeLayer: 'base',
  showLayer: { base: true, overlay: true },
  showPart: { head: true, body: true, rightArm: true, leftArm: true, rightLeg: true, leftLeg: true },
  pose: savedPrefs.pose ?? 'idle',
  view: 'both',
  theme: savedPrefs.theme ?? 'system',
  grid: savedPrefs.grid ?? true,
  paint3d: savedPrefs.paint3d ?? true,
  recent: savedPrefs.recent ?? [],
  hover: null,
  modal: null,
  skinName: 'Minha skin',
  projectId: null,
  toast: null,
  panelOpen: false,
  savedAt: null,
  syncName: null,
  syncState: 'idle',
  syncError: null,
  syncAt: null,
  syncRev: 0,

  set: (p) => set(p),
  setTool: (t) => {
    const cur = get().tool;
    set({ tool: t, prevTool: cur === 'picker' ? get().prevTool : cur });
  },
  setColor: (c, remember = false) => {
    set({ color: c });
    if (remember) get().pushRecent(rgbaKey(c));
  },
  pushRecent: (hex) => {
    const r = [hex, ...get().recent.filter((h) => h !== hex)].slice(0, 16);
    set({ recent: r });
  },
  showToast: (text, action) => set({ toast: { id: ++toastId, text, action } }),
}));

export function rgbaKey(c: RGBA) {
  const h = (v: number) => v.toString(16).padStart(2, '0');
  return '#' + h(c.r) + h(c.g) + h(c.b) + (c.a === 255 ? '' : h(c.a));
}

// salva preferências
useApp.subscribe((s, p) => {
  if (s.tool !== p.tool || s.size !== p.size || s.mirror !== p.mirror || s.noise !== p.noise || s.theme !== p.theme ||
      s.recent !== p.recent || s.grid !== p.grid || s.paint3d !== p.paint3d || s.pose !== p.pose ||
      s.mode !== p.mode || s.sound !== p.sound || s.voice !== p.voice || s.stamp !== p.stamp) {
    const prefs: Prefs = { tool: s.tool === 'picker' ? s.prevTool : s.tool, size: s.size, mirror: s.mirror, noise: s.noise,
      theme: s.theme, recent: s.recent, grid: s.grid, paint3d: s.paint3d, pose: s.pose,
      mode: s.mode, sound: s.sound, voice: s.voice, stamp: s.stamp };
    lsSet('prefs', prefs);
  }
});
