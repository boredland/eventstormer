import React from 'react';
import type { WorkshopFormat, StickyType } from '../../shared/eventstorming';
import { WORKSHOP_FORMATS, STICKY_DEFINITIONS } from '../../shared/eventstorming';
import { ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, PlusCircle, X } from 'lucide-react';

interface FacilitatorSidebarProps {
  format: WorkshopFormat;
  currentPhaseIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onPhaseChange: (phaseIndex: number) => void;
  onQuickSpawn: (type: StickyType) => void;
}

export const FacilitatorSidebar: React.FC<FacilitatorSidebarProps> = ({
  format,
  currentPhaseIndex,
  isOpen,
  onClose,
  onPhaseChange,
  onQuickSpawn,
}) => {
  if (!isOpen) return null;

  const formatDef = WORKSHOP_FORMATS[format] || WORKSHOP_FORMATS['big-picture'];
  const phases = formatDef.phases;
  const activePhase = phases[currentPhaseIndex] || phases[0];

  return (
    <aside className="fixed left-0 top-14 bottom-0 w-80 md:w-96 bg-slate-900/95 border-r border-slate-800 shadow-2xl backdrop-blur-md z-30 flex flex-col select-none overflow-hidden">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
            Facilitator Guide
          </div>
          <h2 className="text-sm font-bold text-white">{formatDef.title}</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Format Description */}
      <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800/80 text-xs text-slate-400">
        {formatDef.description}
      </div>

      {/* Phase List Stepper */}
      <div className="p-4 border-b border-slate-800 overflow-y-auto max-h-56">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Workshop Phases
        </div>
        <div className="space-y-1.5">
          {phases.map((p, idx) => {
            const isCurrent = idx === currentPhaseIndex;
            const isPast = idx < currentPhaseIndex;

            return (
              <button
                key={p.id}
                onClick={() => onPhaseChange(idx)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 transition-all text-xs ${
                  isCurrent
                    ? 'bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 font-bold'
                    : isPast
                    ? 'bg-slate-800/40 text-slate-400 hover:bg-slate-800'
                    : 'text-slate-500 hover:bg-slate-800/60'
                }`}
              >
                {isPast ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                      isCurrent
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                )}
                <span className="truncate">{p.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Phase Details & Facilitation Tips */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Phase {currentPhaseIndex + 1} Directive</span>
          </div>
          <h3 className="text-sm font-bold text-white mb-2">{activePhase.title}</h3>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
            {activePhase.instructions}
          </p>
        </div>

        {/* Recommended Stickies */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Recommended Stickies for this Step
          </div>
          <div className="flex flex-wrap gap-2">
            {activePhase.suggestedStickies.map((type) => {
              const def = STICKY_DEFINITIONS[type];
              if (!def) return null;

              return (
                <button
                  key={type}
                  onClick={() => onQuickSpawn(type)}
                  style={{
                    backgroundColor: def.color,
                    color: def.textColor,
                  }}
                  className="px-2.5 py-1.5 rounded text-xs font-bold shadow hover:scale-105 active:scale-95 transition-transform flex items-center gap-1.5"
                  title={`Spawn ${def.label} in center of canvas`}
                >
                  <PlusCircle className="w-3 h-3" />
                  <span>{def.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Phase Navigation Footer */}
      <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
        <button
          onClick={() => onPhaseChange(Math.max(0, currentPhaseIndex - 1))}
          disabled={currentPhaseIndex === 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Previous</span>
        </button>

        <span className="text-xs font-mono text-slate-400">
          {currentPhaseIndex + 1} / {phases.length}
        </span>

        <button
          onClick={() => onPhaseChange(Math.min(phases.length - 1, currentPhaseIndex + 1))}
          disabled={currentPhaseIndex === phases.length - 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
