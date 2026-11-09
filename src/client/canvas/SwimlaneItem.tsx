import React, { useState } from 'react';
import type { Swimlane } from '../../shared/eventstorming';
import { Trash2, Edit2 } from 'lucide-react';

interface SwimlaneItemProps {
  lane: Swimlane;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent, id: string) => void;
  onUpdateName: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export const SwimlaneItem: React.FC<SwimlaneItemProps> = ({
  lane,
  isSelected,
  onSelect,
  onUpdateName,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(lane.name);

  const handleFinishEditing = () => {
    setIsEditing(false);
    if (name.trim() && name.trim() !== lane.name) {
      onUpdateName(lane.id, name.trim());
    }
  };

  const laneColor = lane.color || '#38bdf8';

  return (
    <div
      data-swimlane-id={lane.id}
      style={{
        position: 'absolute',
        left: 0,
        top: `${lane.y}px`,
        width: '6000px',
        height: `${lane.height}px`,
      }}
      className="group z-[-1] pointer-events-none select-none"
    >
      {/* Horizontal lane background zone with subtle tint */}
      <div
        className={`w-full h-full border-b border-t border-dashed transition-colors ${
          isSelected
            ? 'border-sky-400 bg-sky-500/10'
            : 'border-slate-700/60 bg-slate-800/20 group-hover:bg-slate-800/30'
        }`}
      />

      {/* Lane Title Header Tab on Left */}
      <div
        className="absolute left-4 top-3 flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-md border pointer-events-auto cursor-grab active:cursor-grabbing"
        style={{
          backgroundColor: '#1e293b',
          borderColor: laneColor,
        }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          const target = e.target as HTMLElement;
          if (target.closest('button') || target.closest('input')) return;
          onSelect(e, lane.id);
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: laneColor }}
        />

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
                setName(lane.name);
                setIsEditing(false);
              }
            }}
            className="w-36 bg-slate-900 text-slate-100 px-1.5 py-0.5 rounded text-xs font-semibold outline-none"
          />
        ) : (
          <span
            onDoubleClick={() => setIsEditing(true)}
            className="text-xs font-semibold text-slate-200 cursor-pointer max-w-[200px] truncate"
            title="Double click to rename swimlane"
          >
            {lane.name}
          </span>
        )}

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
          title="Rename swimlane"
        >
          <Edit2 className="w-3 h-3" />
        </button>

        <button
          onClick={() => onDelete(lane.id)}
          className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400"
          title="Delete swimlane"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
