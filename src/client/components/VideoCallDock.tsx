import React, { useRef, useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  PhoneOff,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Radio,
  Users,
  X,
} from 'lucide-react';
import type { RemotePeerState } from '../hooks/useWebRTC';
import type { UserProfile } from '../types';
import type { BreakoutRoom } from '../../shared/eventstorming';
interface VideoCallDockProps {
  isCallActive: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isLocalSpeaking: boolean;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remotePeers: Map<string, RemotePeerState>;
  user: UserProfile;
  currentRoomId: string | null;
  breakoutRooms?: BreakoutRoom[];
  mediaNotice?: string | null;
  onDismissNotice?: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onLeaveCall: () => void;
}
interface VideoBubbleProps {
  stream: MediaStream | null;
  name: string;
  color: string;
  isLocal?: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
}

const VideoBubble: React.FC<VideoBubbleProps> = ({
  stream,
  name,
  color,
  isLocal = false,
  isSpeaking,
  isMuted,
  isVideoOff,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'ST';

  const hasVideoTrack =
    !isVideoOff &&
    !!stream &&
    stream.getVideoTracks().length > 0 &&
    stream.getVideoTracks().some((t) => t.enabled);

  return (
    <div
      className="group relative flex flex-col items-center"
      title={`${name}${isLocal ? ' (You)' : ''}${isSpeaking ? ' - Speaking' : ''}${isMuted ? ' (Muted)' : ''}`}
    >
      <div
        className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden transition-all duration-200 select-none ${
          isSpeaking
            ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-slate-900 shadow-[0_0_16px_rgba(52,211,153,0.7)] scale-105'
            : 'ring-2 ring-slate-700/80 hover:ring-indigo-400 shadow-xl'
        }`}
        style={{
          backgroundColor: hasVideoTrack ? '#0f172a' : color,
        }}
      >
        {/* Always-mounted video element for continuous audio/video playback */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            hasVideoTrack ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'
          } ${isLocal ? 'scale-x-[-1]' : ''}`}
        />

        {/* Fallback avatar initials when video is off */}
        {!hasVideoTrack && (
          <div
            className="w-full h-full flex items-center justify-center font-bold text-white text-base sm:text-lg shadow-inner"
            style={{ backgroundColor: color }}
          >
            {initials}
          </div>
        )}

        {/* Local user tag */}
        {isLocal && (
          <div className="absolute top-1 left-1 px-1 py-0.2 bg-black/60 rounded text-[9px] font-semibold text-slate-200 backdrop-blur-xs">
            You
          </div>
        )}

        {/* Muted badge */}
        {isMuted && (
          <div className="absolute bottom-0.5 right-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-rose-600 border border-slate-900 flex items-center justify-center text-white shadow-md">
            <MicOff className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </div>
        )}
      </div>

      {/* Floating name badge on hover */}
      <div className="absolute -bottom-6 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/90 text-white text-[11px] px-2 py-0.5 rounded-md whitespace-nowrap border border-slate-800 shadow-lg z-30">
        {name} {isLocal && '(You)'}
      </div>
    </div>
  );
};

export const VideoCallDock: React.FC<VideoCallDockProps> = ({
  isCallActive,
  isMuted,
  isVideoOff,
  isScreenSharing,
  isLocalSpeaking,
  localStream,
  screenStream,
  remotePeers,
  user,
  currentRoomId,
  breakoutRooms = [],
  mediaNotice,
  onDismissNotice,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onLeaveCall,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isScreenViewerExpanded, setIsScreenViewerExpanded] = useState(true);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  // Determine current room label
  const roomName = currentRoomId
    ? breakoutRooms.find((r) => r.id === currentRoomId)?.name || 'Breakout Sub-Group'
    : 'Main Room';

  // Find if any remote peer is sharing a screen (or if local screen is active)
  const activeScreenStream = screenStream;

  useEffect(() => {
    if (screenVideoRef.current && activeScreenStream) {
      screenVideoRef.current.srcObject = activeScreenStream;
    }
  }, [activeScreenStream]);

  if (!isCallActive) return null;

  const remotePeerList = Array.from(remotePeers.values());
  const totalCallers = 1 + remotePeerList.length;

  return (
    <div className="fixed top-16 right-4 z-40 flex flex-col items-end gap-2 pointer-events-none">
      {/* Screen Share Viewer (Floating Picture-in-Picture) */}
      {activeScreenStream && (
        <div
          className={`pointer-events-auto transition-all duration-300 w-80 sm:w-96 md:w-[480px] bg-slate-950/95 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md ${
            isScreenViewerExpanded ? 'block' : 'hidden'
          }`}
        >
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 font-medium">
              <ScreenShare className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>{isScreenSharing ? 'Your Screen Share' : 'Shared Screen'}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsScreenViewerExpanded(false)}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
              title="Minimize Screen"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="relative aspect-video bg-black flex items-center justify-center">
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Main Video Call Floating Panel */}
      <div className="pointer-events-auto bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-2xl p-2.5 backdrop-blur-md flex flex-col items-center gap-2 max-w-sm sm:max-w-md transition-all">
        {/* Header / Room info bar */}
        <div className="w-full flex items-center justify-between gap-3 px-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span
              className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${
                currentRoomId
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                  : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/60'
              }`}
            >
              {roomName}
            </span>
            <span className="text-slate-400 flex items-center gap-1 text-[11px]">
              <Users className="w-3 h-3 text-slate-500" />
              {totalCallers}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {activeScreenStream && !isScreenViewerExpanded && (
              <button
                type="button"
                onClick={() => setIsScreenViewerExpanded(true)}
                className="p-1 text-slate-400 hover:text-indigo-400 rounded hover:bg-slate-800"
                title="Expand Screen Share"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
              title={isMinimized ? 'Expand Dock' : 'Minimize Dock'}
            >
              {isMinimized ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Media notice for listen-only or permission denial */}
        {mediaNotice && !isMinimized && (
          <div className="w-full bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[11px] px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2">
            <span className="flex-1">{mediaNotice}</span>
            {onDismissNotice && (
              <button
                type="button"
                onClick={onDismissNotice}
                className="p-0.5 text-amber-400 hover:text-amber-100 rounded"
                title="Dismiss note"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Circular Video Bubbles Grid */}
        {!isMinimized && (
          <div className="flex items-center flex-wrap gap-2.5 py-1 justify-center max-w-[280px] sm:max-w-[340px]">
            {/* Local Participant Bubble */}
            <VideoBubble
              stream={localStream}
              name={user.name}
              color={user.color}
              isLocal
              isSpeaking={isLocalSpeaking}
              isMuted={isMuted}
              isVideoOff={isVideoOff}
            />

            {/* Remote Participants Bubbles */}
            {remotePeerList.map((remote) => (
              <VideoBubble
                key={remote.clientId}
                stream={remote.stream}
                name={remote.peer?.name || `Stormer ${remote.clientId.slice(0, 4)}`}
                color={remote.peer?.color || '#3b82f6'}
                isSpeaking={remote.isSpeaking}
                isMuted={remote.isMuted}
                isVideoOff={remote.isVideoOff}
              />
            ))}
          </div>
        )}

        {/* In-Call Controls Bar */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/80 w-full justify-center">
          {/* Mute Toggle */}
          <button
            type="button"
            onClick={onToggleMute}
            className={`p-2 rounded-xl transition-colors ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Video Toggle */}
          <button
            type="button"
            onClick={onToggleVideo}
            className={`p-2 rounded-xl transition-colors ${
              isVideoOff
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <VideoIcon className="w-4 h-4" />}
          </button>

          {/* Screen Share Toggle */}
          <button
            type="button"
            onClick={onToggleScreenShare}
            className={`p-2 rounded-xl transition-colors ${
              isScreenSharing
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title={isScreenSharing ? 'Stop sharing screen' : 'Share your screen'}
          >
            {isScreenSharing ? (
              <ScreenShareOff className="w-4 h-4" />
            ) : (
              <ScreenShare className="w-4 h-4" />
            )}
          </button>

          {/* Leave Call */}
          <button
            type="button"
            onClick={onLeaveCall}
            className="p-2 rounded-xl bg-rose-600 text-white hover:bg-rose-500 transition-colors shadow-lg shadow-rose-900/30"
            title="Leave call"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
