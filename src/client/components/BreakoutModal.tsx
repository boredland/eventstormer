import React, { useState } from 'react';
import type { BreakoutRoom, BreakoutSessionState, PeerCursor } from '../../shared/eventstorming';
import { X, Users, Clock, Play, StopCircle, ArrowRight, Layers, Sparkles } from 'lucide-react';

interface BreakoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  breakoutSession?: BreakoutSessionState;
  peers: PeerCursor[];
  onStartBreakout: (rooms: BreakoutRoom[], durationMinutes: number) => void;
  onEndBreakout: (mergeToSwimlanes: boolean) => void;
  onJoinRoom: (roomId: string | null) => void;
  currentRoomId: string | null;
}

const DEFAULT_PRESETS: Record<number, string[]> = {
  2: ['Customer Journey & Ordering', 'Fulfillment & Logistics'],
  3: ['Ordering & Checkout', 'Payment & Fraud Risk', 'Warehouse & Fulfillment'],
  4: ['Ordering Experience', 'Payment Gateway', 'Inventory & Warehouse', 'Shipping & Delivery'],
};

const ROOM_COLORS = ['#38bdf8', '#f59e0b', '#10b981', '#ec4899', '#a855f7'];

export const BreakoutModal: React.FC<BreakoutModalProps> = ({
  isOpen,
  onClose,
  breakoutSession,
  peers,
  onStartBreakout,
  onEndBreakout,
  onJoinRoom,
  currentRoomId,
}) => {
  const [roomCount, setRoomCount] = useState<number>(3);
  const [roomNames, setRoomNames] = useState<string[]>(DEFAULT_PRESETS[3]);
  const [duration, setDuration] = useState<number>(15);
  const [mergeToSwimlanes, setMergeToSwimlanes] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleRoomCountChange = (count: number) => {
    setRoomCount(count);
    const presets = DEFAULT_PRESETS[count] || Array.from({ length: count }, (_, i) => `Sub-Group ${i + 1}`);
    setRoomNames(presets);
  };

  const handleNameChange = (index: number, name: string) => {
    const updated = [...roomNames];
    updated[index] = name;
    setRoomNames(updated);
  };

  const handleStart = () => {
    const rooms: BreakoutRoom[] = roomNames.slice(0, roomCount).map((name, idx) => ({
      id: `room-${idx + 1}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: name.trim() || `Sub-Group ${idx + 1}`,
      color: ROOM_COLORS[idx % ROOM_COLORS.length],
    }));
    onStartBreakout(rooms, duration);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Breakouts: work in small teams</h2>
          </div>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {breakoutSession?.active ? (
            /* Active Breakout Management */
            <div className="space-y-4">
              <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Session Active</span>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {breakoutSession.rooms.length} teams are working in parallel
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono bg-indigo-900/50 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-500/40">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{breakoutSession.durationMinutes || 15} min timebox</span>
                </div>
              </div>

              {/* Rooms list */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Teams</span>
                <p className="text-xs text-slate-400">
                  Each team has its own board. You only see stickies and cursors from the team you
                  joined. Click Join to switch. Add your stickies in your team's board.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {breakoutSession.rooms.map((room) => {
                    const count = peers.filter((p) => p.breakoutRoomId === room.id).length;
                    const isHere = currentRoomId === room.id;

                    return (
                      <div
                        key={room.id}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                          isHere
                            ? 'bg-slate-800 border-indigo-500'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: room.color || '#38bdf8' }} />
                          <span className="text-sm font-semibold text-white">{room.name}</span>
                          <span className="text-xs text-slate-400">({count} online)</span>
                        </div>
                        {isHere ? (
                          <span className="text-xs px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/40">
                            Current Room
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              onJoinRoom(room.id);
                              onClose();
                            }}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1"
                          >
                            <span>Join</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Merge & End Controls */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mergeToSwimlanes}
                    onChange={(e) => setMergeToSwimlanes(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-950"
                  />
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>When ending, turn each team's stickies into its own horizontal lane on the main board. Untick to just put them on the main board as they are.</span>
                </label>

                <button
                  onClick={() => {
                    onEndBreakout(mergeToSwimlanes);
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-600/20"
                >
                  <StopCircle className="w-4 h-4" />
                  <span>End Breakouts & Return Everyone to Main Board</span>
                </button>
              </div>
            </div>
          ) : (
            /* Configure New Breakout Session */
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 text-xs text-slate-300 leading-relaxed space-y-1.5">
                <p>
                  <b className="text-white">What this does:</b> splits everyone into small teams.
                  Each team gets a private copy of the board to work on one part of the process,
                  so people do not talk over each other.
                </p>
                <ol className="list-decimal pl-4 text-slate-400">
                  <li>Pick how many teams and what each one works on.</li>
                  <li>Everyone joins a team from the bar at the top of the board.</li>
                  <li>After the time is up, end the breakout. Team work comes back to the main board as one lane per team.</li>
                </ol>
              </div>

              {/* Number of rooms */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">How many teams?</label>
                <div className="flex items-center gap-2">
                  {[2, 3, 4].map((count) => (
                    <button
                      key={count}
                      onClick={() => handleRoomCountChange(count)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                        roomCount === count
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {count} teams
                    </button>
                  ))}
                </div>
              </div>

              {/* Room names */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">What does each team work on? (you can rename)</label>
                {roomNames.slice(0, roomCount).map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ROOM_COLORS[idx % ROOM_COLORS.length] }} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(idx, e.target.value)}
                      placeholder={`Sub-Group ${idx + 1}`}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                ))}
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">How long (minutes)?</label>
                <div className="flex items-center gap-2">
                  {[10, 15, 20, 30].map((m) => (
                    <button
                      key={m}
                      onClick={() => setDuration(m)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        duration === m
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStart}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-600/30"
              >
                <Play className="w-4 h-4" />
                <span>Start {roomCount} teams</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
