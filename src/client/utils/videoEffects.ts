export type VideoFilterId =
  | 'none'
  | 'noir'
  | 'cyberpunk'
  | 'sunset'
  | 'matrix'
  | 'pastel'
  | 'cosmic';

export type VideoAuraId =
  | 'none'
  | 'neon'
  | 'sunset'
  | 'rainbow'
  | 'fire'
  | 'galaxy';

export interface VideoEffect {
  filter: VideoFilterId;
  aura: VideoAuraId;
  reaction?: string | null;
}

export interface VideoFilterDef {
  id: VideoFilterId;
  label: string;
  emoji: string;
  description: string;
  cssFilter: string;
}

export interface VideoAuraDef {
  id: VideoAuraId;
  label: string;
  emoji: string;
  description: string;
  ringClass: string;
  pulseClass?: string;
}

export const DEFAULT_VIDEO_EFFECT: VideoEffect = {
  filter: 'none',
  aura: 'none',
  reaction: null,
};

export const VIDEO_FILTERS: VideoFilterDef[] = [
  {
    id: 'none',
    label: 'Clean',
    emoji: '✨',
    description: 'Natural unfiltered webcam feed',
    cssFilter: 'none',
  },
  {
    id: 'noir',
    label: 'Film Noir',
    emoji: '🎬',
    description: 'Classic high-contrast studio black & white',
    cssFilter: 'grayscale(100%) contrast(135%) brightness(95%)',
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    emoji: '⚡',
    description: 'Neon synthwave violet & cyan duotone tint',
    cssFilter: 'hue-rotate(275deg) saturate(180%) contrast(125%)',
  },
  {
    id: 'sunset',
    label: 'Sunset Glow',
    emoji: '🌅',
    description: 'Warm golden hour radiance & soft amber tones',
    cssFilter: 'sepia(35%) saturate(160%) brightness(105%) hue-rotate(-15deg)',
  },
  {
    id: 'matrix',
    label: 'Phosphor',
    emoji: '📟',
    description: 'Retro CRT hacker terminal monochrome green',
    cssFilter: 'grayscale(100%) sepia(100%) hue-rotate(90deg) saturate(320%) contrast(130%)',
  },
  {
    id: 'pastel',
    label: 'Pastel Dream',
    emoji: '🌸',
    description: 'Dreamy soft bloom & vivid anime pastel radiance',
    cssFilter: 'saturate(135%) brightness(112%) contrast(92%)',
  },
  {
    id: 'cosmic',
    label: 'Cosmic Nebula',
    emoji: '🔮',
    description: 'Deep celestial aura with vivid violet depth',
    cssFilter: 'hue-rotate(220deg) saturate(190%) contrast(120%)',
  },
];

export const VIDEO_AURAS: VideoAuraDef[] = [
  {
    id: 'none',
    label: 'Subtle Slate',
    emoji: '⚪',
    description: 'Standard modern border',
    ringClass: 'ring-slate-700/80',
    pulseClass: 'ring-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.7)]',
  },
  {
    id: 'neon',
    label: 'Electric Cyan',
    emoji: '🩵',
    description: 'Glowing cyberpunk neon cyan ring',
    ringClass: 'ring-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.65)]',
    pulseClass: 'ring-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.9)]',
  },
  {
    id: 'sunset',
    label: 'Sunset Flare',
    emoji: '🧡',
    description: 'Warm glowing amber ring',
    ringClass: 'ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.65)]',
    pulseClass: 'ring-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.9)]',
  },
  {
    id: 'rainbow',
    label: 'Prism Halo',
    emoji: '🌈',
    description: 'Iridescent holographic magenta-pink halo',
    ringClass: 'ring-pink-500 shadow-[0_0_18px_rgba(236,72,153,0.65)]',
    pulseClass: 'ring-pink-300 shadow-[0_0_24px_rgba(236,72,153,0.9)]',
  },
  {
    id: 'fire',
    label: 'Solar Flare',
    emoji: '🔥',
    description: 'Fiery crimson-rose radiance',
    ringClass: 'ring-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.65)]',
    pulseClass: 'ring-rose-300 shadow-[0_0_24px_rgba(244,63,94,0.9)]',
  },
  {
    id: 'galaxy',
    label: 'Cosmic Violet',
    emoji: '🌌',
    description: 'Deep celestial violet space aura',
    ringClass: 'ring-violet-500 shadow-[0_0_18px_rgba(139,92,246,0.65)]',
    pulseClass: 'ring-violet-300 shadow-[0_0_24px_rgba(139,92,246,0.9)]',
  },
];

export const FUN_REACTIONS = ['👑', '⚡', '🚀', '💡', '☕', '🎉', '🎧', '🔥', '🐱', '✨'];

export function getFilterCss(filterId?: VideoFilterId | string): string {
  const match = VIDEO_FILTERS.find((f) => f.id === filterId);
  return match?.cssFilter || 'none';
}

export function getAuraClasses(auraId?: VideoAuraId | string, isSpeaking = false): string {
  const match = VIDEO_AURAS.find((a) => a.id === auraId) || VIDEO_AURAS[0];
  if (isSpeaking) {
    return `ring-4 ${match.pulseClass || 'ring-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]'} animate-pulse`;
  }
  return `ring-2 ${match.ringClass}`;
}
