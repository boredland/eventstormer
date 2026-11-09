import React, { useState, useRef, useEffect } from 'react';
import type { StickyNote, StickyType } from '../../shared/eventstorming';
import { STICKY_DEFINITIONS } from '../../shared/eventstorming';
import { ThumbsUp, Trash2, Copy, Sparkles } from 'lucide-react';

interface StickyItemProps {
  sticky: StickyNote;
  isSelected: boolean;
  isVotingMode: boolean;
  onSelect: (e: React.MouseEvent, id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onVote: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onChangeType: (id: string, type: StickyType) => void;
}

export const StickyItem: React.FC<StickyItemProps> = ({
  sticky,
  isSelected,
  isVotingMode,
  onSelect,
  onUpdateText,
  onVote,
  onDelete,
  onDuplicate,
  onChangeType,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(sticky.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const meta = STICKY_DEFINITIONS[sticky.type] || STICKY_DEFINITIONS['domain-event'];
  const { width, height, rotation } = meta.geometry;

  useEffect(() => {
    setEditText(sticky.text);
  }, [sticky.text]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleFinishEditing = () => {
    setIsEditing(false);
    if (editText.trim() !== sticky.text) {
      onUpdateText(sticky.id, editText.trim() || 'Untitled');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(sticky.text);
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleFinishEditing();
    }
  };

  // Determine value color override
  let bgColor = sticky.customColor || meta.color;
  if (sticky.type === 'value') {
    if (sticky.text.trim().startsWith('-')) {
      bgColor = '#FF6B6B';
    }
  }

  const transformStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${sticky.x}px`,
    top: `${sticky.y}px`,
    width: `${width}px`,
    minHeight: `${height}px`,
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
    backgroundColor: bgColor,
    color: meta.textColor,
  };

  return (
    <div
      data-sticky-id={sticky.id}
      style={transformStyle}
      onClick={(e) => {
        onSelect(e, sticky.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={`group rounded-sm p-2 flex flex-col justify-between transition-shadow select-none cursor-grab active:cursor-grabbing ${
        isSelected
          ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900 shadow-xl z-20'
          : 'shadow-md hover:shadow-lg z-10'
      }`}
    >
      {/* Top Header: Type Indicator & Dot-Voting Badge */}
      <div className="flex items-center justify-between gap-1 mb-1 pointer-events-auto">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 truncate">
          {meta.label}
        </span>

        {/* Dot-Voting Badge */}
        <div className="flex items-center gap-0.5 ml-auto">
          {sticky.votes > 0 && (
            <span
              className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[11px] font-black bg-black/80 text-white shadow"
              title={`${sticky.votes} votes`}
            >
              ★ {sticky.votes}
            </span>
          )}

          {isVotingMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onVote(sticky.id, 1);
              }}
              className="ml-1 p-0.5 rounded bg-black/20 hover:bg-black/40 text-current transition-colors"
              title="Vote for this sticky"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Body: Text or Inline Editor */}
      <div className="flex-1 flex flex-col justify-center min-h-[40px] my-1">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleFinishEditing}
            onKeyDown={handleKeyDown}
            className="w-full h-full min-h-[60px] bg-white/40 rounded p-1 text-xs md:text-sm font-semibold sticky-font text-inherit resize-none focus:outline-none focus:ring-1 focus:ring-black/40"
            placeholder={meta.syntaxHint}
          />
        ) : (
          <p className="text-xs md:text-sm font-semibold sticky-font break-words leading-tight">
            {sticky.text || (
              <span className="opacity-50 italic">{meta.syntaxHint}</span>
            )}
          </p>
        )}
      </div>

      {/* Bottom Footer: Author info & Action buttons on hover */}
      <div className="flex items-center justify-between text-[10px] opacity-75 mt-1 pt-1 border-t border-black/10">
        <span className="truncate max-w-[80px]">
          {sticky.authorName ? sticky.authorName : ''}
        </span>

        {/* Quick Actions (visible on hover or when selected) */}
        <div
          className={`items-center gap-1 ${
            isSelected ? 'flex' : 'hidden group-hover:flex'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onDuplicate(sticky.id)}
            className="p-1 hover:bg-black/15 rounded text-current"
            title="Duplicate (Ctrl+D)"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(sticky.id)}
            className="p-1 hover:bg-red-600 hover:text-white rounded text-current"
            title="Delete (Del)"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
