import React, { useState } from 'react';
import type { PivotalLine } from '../../shared/eventstorming';
import { Trash2, Edit2 } from 'lucide-react';

interface PivotalLineItemProps {
  line: PivotalLine;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent, id: string) => void;
  onUpdateName: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export const PivotalLineItem: React.FC<PivotalLineItemProps> = ({
  line,
  isSelected,
  onSelect,
  onUpdateName,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(line.name);

  const handleFinishEditing = () => {
    setIsEditing(false);
    if (name.trim() && name.trim() !== line.name) {
      onUpdateName(line.id, name.trim());
    }
  };

  return (
    <div
      data-pivotal-id={line.id}
      style={{
        position: 'absolute',
        left: `${line.x}px`,
        top: 0,
        height: '4000px',
        width: '4px',
      }}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input')) return;
        onSelect(e, line.id);
      }}
      onClick={(e) => e.stopPropagation()}
      className="group z-0 cursor-ew-resize select-none pointer-events-auto"
    >
      {/* Vertical line indicator */}
      <div
        className={`w-full h-full border-r-2 border-dashed transition-colors ${
          isSelected
            ? 'border-amber-400 bg-amber-400/10'
            : 'border-amber-500/60 group-hover:border-amber-400'
        }`}
      />

      {/* Top Banner Tag */}
      <div
        className="absolute top-2 -left-20 w-40 flex flex-col items-center pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded shadow-lg text-xs font-bold transition-all ${
            isSelected
              ? 'bg-amber-500 text-slate-950 ring-2 ring-white'
              : 'bg-slate-800 text-amber-400 border border-amber-500/50 hover:bg-slate-700'
          }`}
        >
          {isEditing ? (
            <input
              type="text"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onBlur={handleFinishEditing}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFinishEditing();
                if (e.key === 'Escape') {
                  setName(line.name);
                  setIsEditing(false);
                }
              }}
              className="w-28 bg-slate-900 text-amber-300 px-1 py-0.5 rounded text-xs outline-none"
            />
          ) : (
            <span
              onDoubleClick={() => setIsEditing(true)}
              className="cursor-pointer truncate max-w-[120px]"
              title="Double click to rename"
            >
              {line.name}
            </span>
          )}

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-0.5 hover:bg-black/20 rounded opacity-60 hover:opacity-100"
            title="Rename line"
          >
            <Edit2 className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={() => onDelete(line.id)}
            className="p-0.5 hover:bg-red-500 hover:text-white rounded opacity-60 hover:opacity-100"
            title="Delete pivotal line"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
