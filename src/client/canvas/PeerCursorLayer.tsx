import React from 'react';
import type { PeerCursor } from '../../shared/eventstorming';

interface PeerCursorLayerProps {
  peers: PeerCursor[];
}

export const PeerCursorLayer: React.FC<PeerCursorLayerProps> = ({ peers }) => {
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {peers.map((peer) => {
        return (
          <div
            key={peer.clientId}
            style={{
              position: 'absolute',
              left: `${peer.x}px`,
              top: `${peer.y}px`,
              transition: 'left 60ms linear, top 60ms linear',
            }}
            className="flex items-center gap-1.5 pointer-events-none select-none"
          >
            {/* Pointer Arrow SVG */}
            <svg
              className="w-5 h-5 -rotate-45 drop-shadow"
              viewBox="0 0 24 24"
              fill={peer.color}
              stroke="#ffffff"
              strokeWidth="1.5"
            >
              <polygon points="3 3 21 11 12 13 8 21" />
            </svg>

            {/* Name pill */}
            <span
              style={{ backgroundColor: peer.color }}
              className="px-2 py-0.5 rounded-full text-[11px] font-bold text-white shadow-md whitespace-nowrap"
            >
              {peer.name || 'Anonymous'}
            </span>
          </div>
        );
      })}
    </div>
  );
};
