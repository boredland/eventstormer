import React, { useRef } from 'react';
import type { StickyNote } from '../../shared/eventstorming';
import { STICKY_DEFINITIONS } from '../../shared/eventstorming';
import type { Viewport } from '../types';

interface MinimapProps {
  stickies: StickyNote[];
  viewport: Viewport;
  canvasWidth: number;
  canvasHeight: number;
  onJumpTo: (targetX: number, targetY: number) => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  stickies,
  viewport,
  canvasWidth,
  canvasHeight,
  onJumpTo,
}) => {
  const mapWidth = 180;
  const mapHeight = 110;
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute world bounding box with sensible defaults
  let minX = 0;
  let maxX = 3000;
  let minY = 0;
  let maxY = 1800;

  for (const s of stickies) {
    if (s.x < minX) minX = s.x - 200;
    if (s.x > maxX) maxX = s.x + 300;
    if (s.y < minY) minY = s.y - 200;
    if (s.y > maxY) maxY = s.y + 300;
  }

  const worldWidth = Math.max(2000, maxX - minX);
  const worldHeight = Math.max(1200, maxY - minY);

  const scaleX = mapWidth / worldWidth;
  const scaleY = mapHeight / worldHeight;
  const scale = Math.min(scaleX, scaleY);

  // Viewport rectangle in minimap coordinates
  // Canvas viewport transform: screenX = (worldX + viewport.x) * viewport.zoom
  // => worldX = screenX / viewport.zoom - viewport.x
  const viewWorldX = -viewport.x;
  const viewWorldY = -viewport.y;
  const viewWorldW = canvasWidth / viewport.zoom;
  const viewWorldH = canvasHeight / viewport.zoom;

  const vpLeft = (viewWorldX - minX) * scale;
  const vpTop = (viewWorldY - minY) * scale;
  const vpW = Math.max(8, viewWorldW * scale);
  const vpH = Math.max(6, viewWorldH * scale);

  const handleMinimapClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickMapX = e.clientX - rect.left;
    const clickMapY = e.clientY - rect.top;

    const targetWorldX = minX + clickMapX / scale;
    const targetWorldY = minY + clickMapY / scale;

    // Center target world coords in screen
    const newViewportX = -(targetWorldX - canvasWidth / (2 * viewport.zoom));
    const newViewportY = -(targetWorldY - canvasHeight / (2 * viewport.zoom));

    onJumpTo(newViewportX, newViewportY);
  };

  return (
    <div
      ref={containerRef}
      onClick={handleMinimapClick}
      style={{ width: `${mapWidth}px`, height: `${mapHeight}px` }}
      className="bg-slate-900/90 border border-slate-700/80 rounded-lg shadow-xl overflow-hidden relative cursor-pointer select-none backdrop-blur-sm"
      title="Click to jump canvas"
    >
      {/* Sticky Dots */}
      {stickies.map((s) => {
        const dotX = (s.x - minX) * scale;
        const dotY = (s.y - minY) * scale;
        const color =
          s.customColor ||
          STICKY_DEFINITIONS[s.type]?.color ||
          '#FF9F1C';

        return (
          <div
            key={s.id}
            style={{
              position: 'absolute',
              left: `${dotX}px`,
              top: `${dotY}px`,
              width: '4px',
              height: '4px',
              backgroundColor: color,
              borderRadius: '1px',
            }}
          />
        );
      })}

      {/* Current Viewport Frame */}
      <div
        style={{
          position: 'absolute',
          left: `${Math.max(0, vpLeft)}px`,
          top: `${Math.max(0, vpTop)}px`,
          width: `${Math.min(mapWidth, vpW)}px`,
          height: `${Math.min(mapHeight, vpH)}px`,
        }}
        className="border-2 border-indigo-400 bg-indigo-500/15 rounded-sm pointer-events-none"
      />
    </div>
  );
};
