import React, { useState } from 'react';
import type { UserProfile } from '../types';
import { User, Sparkles } from 'lucide-react';

interface JoinModalProps {
  isOpen: boolean;
  onJoin: (profile: UserProfile) => void;
}

const AVATAR_COLORS = [
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#eab308', // Amber
  '#3b82f6', // Blue
  '#f43f5e', // Rose
];

export const JoinModal: React.FC<JoinModalProps> = ({ isOpen, onJoin }) => {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(
    AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || `Stormer #${Math.floor(100 + Math.random() * 900)}`;
    const profile: UserProfile = {
      clientId: crypto.randomUUID(),
      name: finalName,
      color: selectedColor,
    };
    localStorage.setItem('eventstormer_user', JSON.stringify(profile));
    onJoin(profile);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">⚡</span>
          <h2 className="text-lg font-bold text-white">Join EventStorming Session</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Zero sign-in required. Choose your display name and cursor color for real-time collaboration.
        </p>

        <div className="mb-5 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 leading-relaxed">
          <div className="font-semibold text-white mb-1">What happens here</div>
          <p>
            Your team maps out how a business process works on a shared board, using colored
            sticky notes. Each color is one kind of thing: <b className="text-amber-400">orange</b>{' '}
            is something that happened, <b className="text-sky-400">blue</b> is an action,{' '}
            <b className="text-pink-400">pink</b> is a problem. Hover any color at the bottom to
            see what it means. Click <b>Help</b> at the top any time.
          </p>
          <p className="mt-1.5 text-slate-400">
            Your name and color show on your cursor and stickies so others see who is working where.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Display Name
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="e.g. Domain Expert, Sarah..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <User className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Cursor & Avatar Color
            </label>
            <div className="flex items-center justify-between gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  style={{ backgroundColor: color }}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    selectedColor === color
                      ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900 shadow-md'
                      : 'hover:scale-110 opacity-80'
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Enter Workshop</span>
          </button>
        </form>
      </div>
    </div>
  );
};
