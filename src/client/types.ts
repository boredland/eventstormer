import type { StickyType } from '../shared/eventstorming';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface DragState {
  type: 'stickies' | 'pivotal' | 'swimlane' | 'pan';
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  activeId?: string;
  initialPositions?: Map<string, { x: number; y: number }>;
}

export interface MarqueeSelect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface UserProfile {
  clientId: string;
  name: string;
  color: string;
}

export type ActiveTool = 'select' | 'pan' | 'pivotal' | 'swimlane' | StickyType;
