import React from 'react';
import type { StickyType } from '../../shared/eventstorming';
import { STICKY_DEFINITIONS } from '../../shared/eventstorming';
import type { ActiveTool } from '../types';
import { MousePointer, Hand, Columns, Divide } from 'lucide-react';

interface StickyPaletteProps {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
}

export const StickyPalette: React.FC<StickyPaletteProps> = ({
  activeTool,
  onSelectTool,
}) => {
  const stickyTypes: StickyType[] = [
    'domain-event',
    'hotspot',
    'actor',
    'system',
    'opportunity',
    'command',
    'policy',
    'readmodel',
    'constraint',
  ];

  return (
    <div
      id="tour-sticky-palette"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-2 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-md z-40 select-none max-w-[96vw] overflow-x-auto"
    >
      {/* Navigation Tools: Select and Pan */}
      <div className="flex items-center gap-1 pr-2 border-r border-slate-700">
        <button
          onClick={() => onSelectTool('select')}
          className={`p-2 rounded-xl transition-all ${
            activeTool === 'select'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Select Tool (V) - Click & drag to select and move"
        >
          <MousePointer className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTool('pan')}
          className={`p-2 rounded-xl transition-all ${
            activeTool === 'pan'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Pan Tool (H or Space) - Click & drag background to navigate"
        >
          <Hand className="w-4 h-4" />
        </button>
      </div>

      {/* Brandolini Stickies */}
      <div className="flex items-center gap-1.5 px-1">
        {stickyTypes.map((type, index) => {
          const def = STICKY_DEFINITIONS[type];
          const isSelected = activeTool === type;
          const shortcut = index + 1;

          return (
            <button
              key={type}
              onClick={() => onSelectTool(type)}
              style={{
                backgroundColor: def.color,
                color: def.textColor,
                transform: def.geometry.rotation ? `rotate(${def.geometry.rotation}deg)` : undefined,
              }}
              className={`relative px-2.5 py-1.5 rounded text-xs font-bold shadow-sm transition-all flex items-center justify-center min-w-[70px] h-9 hover:scale-105 active:scale-95 ${
                isSelected
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105 shadow-md'
                  : 'opacity-90 hover:opacity-100'
              }`}
              title={`${def.label} [${shortcut}]: ${def.description} (Syntax: ${def.syntaxHint})`}
            >
              <span className="truncate text-[11px] leading-tight">
                {def.label}
              </span>

              {/* Keyboard Shortcut badge */}
              <span className="absolute -top-1.5 -right-1 bg-slate-950/80 text-white text-[9px] px-1 rounded font-mono border border-slate-700">
                {shortcut}
              </span>
            </button>
          );
        })}
      </div>

      {/* Modeling Boundaries: Pivotal Line and Swimlane */}
      <div className="flex items-center gap-1 pl-2 border-l border-slate-700">
        <button
          onClick={() => onSelectTool('pivotal')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTool === 'pivotal'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/30'
              : 'text-amber-400 hover:bg-slate-800'
          }`}
          title="Pivotal Event Line: Major milestone boundary (e.g. Order Placed)"
        >
          <Divide className="w-3.5 h-3.5 rotate-90" />
          <span className="hidden md:inline">Milestone</span>
        </button>

        <button
          onClick={() => onSelectTool('swimlane')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTool === 'swimlane'
              ? 'bg-sky-500 text-slate-950 font-bold shadow-lg shadow-sky-500/30'
              : 'text-sky-400 hover:bg-slate-800'
          }`}
          title="Swimlane: Horizontal actor/system boundary lane"
        >
          <Columns className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Swimlane</span>
        </button>
      </div>
    </div>
  );
};
