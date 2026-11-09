import React from 'react';
import type { BreakoutSessionState, PeerCursor } from '../../shared/eventstorming';
import { Users, Layers, ArrowLeftRight, Clock, Settings, ArrowLeft } from 'lucide-react';

interface BreakoutBarProps {
  session: BreakoutSessionState;
  currentRoomId: string | null;
  peers: PeerCursor[];
  onSelectRoom: (roomId: string | null) => void;
  onOpenModal: () => void;
}

export const BreakoutBar: React.FC<BreakoutBarProps> = ({
  session,
  currentRoomId,
  peers,
  onSelectRoom,
  onOpenModal,
}) => {
  if (!session.active) return null;

  const currentRoom = session.rooms.find((r) => r.id === currentRoomId);
  const peersInThisRoom = peers.filter((p) => (currentRoomId ? p.breakoutRoomId === currentRoomId : !p.breakoutRoomId));

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 bg-slate-900/95 border border-indigo-500/40 rounded-2xl shadow-2xl backdrop-blur-md select-none text-xs">
      {/* Current Room Indicator */}
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full animate-pulse"
          style={{ backgroundColor: currentRoom ? currentRoom.color || '#38bdf8' : '#6366f1' }}
        />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold text-slate-400">You are in</span>
          <span className="font-bold text-white text-xs">
            {currentRoom ? currentRoom.name : 'Main board (everyone)'}
          </span>
        </div>
      </div>

      <div className="w-[1px] h-6 bg-slate-800" />

      {/* Room Switcher Dropdown */}
      <div className="flex items-center gap-1.5">
        <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" />
        <select
          value={currentRoomId || ''}
          onChange={(e) => onSelectRoom(e.target.value || null)}
          className="bg-slate-950 text-indigo-300 font-semibold border border-slate-800 rounded-lg px-2.5 py-1 text-xs outline-none cursor-pointer hover:bg-slate-900"
        >
          <option value="">Main board (everyone)</option>
          {session.rooms.map((room) => {
            const count = peers.filter((p) => p.breakoutRoomId === room.id).length;
            return (
              <option key={room.id} value={room.id}>
                {room.name} ({count} online)
              </option>
            );
          })}
        </select>
      </div>

      <div className="w-[1px] h-6 bg-slate-800" />

      {/* Members in current room */}
      <div className="flex items-center gap-1.5 text-slate-300">
        <Users className="w-3.5 h-3.5 text-emerald-400" />
        <span className="font-semibold">{peersInThisRoom.length + 1} here</span>
      </div>

      {currentRoomId && (
        <button
          onClick={() => onSelectRoom(null)}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          title="Leave your team and go back to the main board"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Main Board</span>
        </button>
      )}

      {/* Facilitator Manage / Merge Button */}
      <button
        onClick={onOpenModal}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 font-semibold transition-colors ml-1"
        title="Facilitator: switch teams or end the breakout and merge the work back"
      >
        <Settings className="w-3 h-3" />
        <span>Manage</span>
      </button>
    </div>
  );
};
