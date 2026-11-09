import React, { useState, useEffect } from 'react';
import type { WorkshopFormat, PeerCursor } from '../../shared/eventstorming';
import { WORKSHOP_FORMATS } from '../../shared/eventstorming';
import type { UserProfile } from '../types';
import {
  Play,
  Pause,
  RotateCcw,
  Vote,
  Download,
  BookOpen,
  Share2,
  Check,
  HelpCircle,
  Users,
  Compass,
} from 'lucide-react';

interface HeaderProps {
  workspaceId: string;
  format: WorkshopFormat;
  peers: PeerCursor[];
  user: UserProfile;
  timerIsRunning: boolean;
  timerSecondsRemaining: number;
  isVotingMode: boolean;
  onFormatChange: (format: WorkshopFormat) => void;
  onTimerStart: () => void;
  onTimerPause: () => void;
  onTimerReset: (seconds: number) => void;
  onToggleVotingMode: () => void;
  onOpenTemplates: () => void;
  onOpenExport: () => void;
  onStartTour: () => void;
  onOpenHelp: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  isBreakoutActive?: boolean;
  onOpenBreakouts?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  workspaceId,
  format,
  peers,
  user,
  timerIsRunning,
  timerSecondsRemaining,
  isVotingMode,
  onFormatChange,
  onTimerStart,
  onTimerPause,
  onTimerReset,
  onToggleVotingMode,
  onOpenTemplates,
  onOpenExport,
  onStartTour,
  onOpenHelp,
  onToggleSidebar,
  isSidebarOpen,
  isBreakoutActive,
  onOpenBreakouts,
}) => {
  const [copied, setCopied] = useState(false);
  const [localSeconds, setLocalSeconds] = useState(timerSecondsRemaining);

  useEffect(() => {
    setLocalSeconds(timerSecondsRemaining);
  }, [timerSecondsRemaining]);

  // Local ticker when running
  useEffect(() => {
    if (!timerIsRunning) return;
    const interval = setInterval(() => {
      setLocalSeconds((prev) => {
        if (prev <= 1) {
          // Play subtle audio alert if supported
          try {
            const AudioCtx = window.AudioContext;
            if (!AudioCtx) return 0;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.8);
          } catch {
            // Audio context may be restricted by autoplay
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerIsRunning]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-40 select-none shadow-md">
      {/* Left: Brand, Sidebar Toggle, Workspace Slug, Format */}
      <div className="flex items-center gap-3">
        <button
          id="tour-phase-guide"
          onClick={onToggleSidebar}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            isSidebarOpen
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          title="Toggle Facilitator Phase Guide"
        >
          <Compass className="w-4 h-4" />
          <span className="hidden sm:inline">Phases</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="font-extrabold tracking-tight text-white flex items-center gap-1 text-sm md:text-base">
            <span className="text-amber-500 font-black">⚡</span> EventStormer
          </span>

          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono hidden md:inline">
            {workspaceId}
          </span>
        </div>

        {/* Format Selector Dropdown */}
        <select
          id="tour-format-selector"
          value={format}
          onChange={(e) => onFormatChange(e.target.value as WorkshopFormat)}
          className="bg-slate-800 text-amber-400 border border-slate-700 rounded-lg text-xs font-semibold px-2.5 py-1.5 outline-none hover:bg-slate-750 cursor-pointer hidden lg:inline-block"
        >
          {Object.entries(WORKSHOP_FORMATS).map(([fmtKey, def]) => (
            <option key={fmtKey} value={fmtKey}>
              {def.title}
            </option>
          ))}
        </select>
      </div>

      {/* Center: Synchronized Facilitator Timer */}
      <div
        id="tour-timer"
        className="flex items-center gap-2 px-3 py-1 bg-slate-950/80 border border-slate-800 rounded-xl"
      >
        <span
          className={`font-mono text-base font-bold tracking-wider ${
            localSeconds <= 60 && localSeconds > 0
              ? 'text-red-400 animate-pulse'
              : 'text-amber-400'
          }`}
        >
          {formatTimer(localSeconds)}
        </span>

        <div className="flex items-center gap-1">
          {timerIsRunning ? (
            <button
              onClick={onTimerPause}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
              title="Pause Timer"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onTimerStart}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
              title="Start Timer"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onTimerReset(300)}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
            title="Reset to 5:00"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right: Actions, Voting, Templates, Export, Share, Attendees */}
      <div className="flex items-center gap-2">
        {/* Breakouts Button */}
        <button
          id="tour-breakouts"
          onClick={onOpenBreakouts}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            isBreakoutActive
              ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          title="Breakouts: split the group into small teams, each with a private board. Their work merges back onto the main board when you end it."
        >
          <Users className="w-4 h-4 text-indigo-400" />
          <span className="hidden md:inline">Breakouts</span>
          {isBreakoutActive && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          )}
        </button>

        {/* Dot-Voting Toggle */}
        <button
          id="tour-voting"
          onClick={onToggleVotingMode}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            isVotingMode
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          title="Voting: when on, each click on a sticky adds one dot. Use it to pick what matters most."
        >
          <Vote className="w-4 h-4" />
          <span className="hidden md:inline">Voting</span>
        </button>

        {/* Templates Modal */}
        <button
          id="tour-templates"
          onClick={onOpenTemplates}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          title="Templates: load a finished example board to see what a workshop looks like"
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden lg:inline">Templates</span>
        </button>

        {/* Export Modal */}
        <button
          id="tour-export"
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          title="Export: download the board as Markdown or JSON"
        >
          <Download className="w-4 h-4" />
          <span className="hidden lg:inline">Export</span>
        </button>

        {/* Share Link */}
        <button
          id="tour-share"
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          title="Share: copy the link. Anyone with it can join this board, no account needed."
        >
          {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4" />}
          <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
        </button>

        {/* Help */}
        <button
          id="tour-help"
          onClick={onOpenHelp}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
          title="Help: what the colors mean, how to use the board, shortcuts"
        >
          <HelpCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Help</span>
        </button>

        {/* Connected Participants Avatars */}
        <div
          id="tour-peers"
          className="flex items-center -space-x-1.5 ml-1 border-l border-slate-800 pl-3"
          title={`${peers.length + 1} participant(s) online`}
        >
          {/* Current User Avatar */}
          <div
            style={{ backgroundColor: user.color }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-slate-900 shadow-sm"
            title={`${user.name} (You)`}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>

          {/* Remote Peers */}
          {peers.slice(0, 4).map((p) => (
            <div
              key={p.clientId}
              style={{ backgroundColor: p.color }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-slate-900 shadow-sm"
              title={p.name}
            >
              {p.name.charAt(0).toUpperCase()}
            </div>
          ))}

          {peers.length > 4 && (
            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-semibold text-slate-300 ring-2 ring-slate-900">
              +{peers.length - 4}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
