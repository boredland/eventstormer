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
  Settings,
  Monitor,
  Eye,
  Sparkles,
} from 'lucide-react';
import type { RemotePeerState } from '../hooks/useWebRTC';
import type { UserProfile } from '../types';
import type { BreakoutRoom } from '../../shared/eventstorming';
import type { VideoEffect } from '../utils/videoEffects';
import {
  VIDEO_FILTERS,
  VIDEO_AURAS,
  FUN_REACTIONS,
  getFilterCss,
  getAuraClasses,
} from '../utils/videoEffects';
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
  audioDevices?: MediaDeviceInfo[];
  videoDevices?: MediaDeviceInfo[];
  selectedAudioDeviceId?: string | null;
  selectedVideoDeviceId?: string | null;
  onSwitchAudioDevice?: (deviceId: string) => void;
  onSwitchVideoDevice?: (deviceId: string) => void;
  followingClientId?: string | null;
  onFollowPeer?: (clientId: string | null) => void;
  localVideoEffect?: VideoEffect;
  onSetVideoEffect?: (update: Partial<VideoEffect>) => void;
}
interface VideoBubbleProps {
  stream: MediaStream | null;
  name: string;
  color: string;
  isLocal?: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing?: boolean;
  isPinned?: boolean;
  videoEffect?: VideoEffect;
  onClick?: () => void;
}

const VideoBubble: React.FC<VideoBubbleProps> = ({
  stream,
  name,
  color,
  isLocal = false,
  isSpeaking,
  isMuted,
  isVideoOff,
  isScreenSharing = false,
  isPinned = false,
  videoEffect,
  onClick,
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
      onClick={onClick}
      className={`group relative flex flex-col items-center cursor-pointer transition-transform ${
        isPinned ? 'scale-105' : ''
      }`}
      title={`${name}${isLocal ? ' (You)' : ''}${isSpeaking ? ' - Speaking' : ''}${isMuted ? ' (Muted)' : ''}${
        isScreenSharing ? ' - Sharing Screen' : ''
      } (Click to expand feed)`}
    >
      <div
        className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden transition-all duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] select-none ${
          getAuraClasses(videoEffect?.aura, isSpeaking)
        } ${
          isPinned
            ? 'ring-4 ring-indigo-500 ring-offset-2 ring-offset-slate-900 shadow-[0_0_16px_rgba(99,102,241,0.8)]'
            : 'hover:scale-105'
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
          style={{ filter: getFilterCss(videoEffect?.filter) }}
          className={`w-full h-full object-cover transition-opacity duration-[var(--duration-quick)] ${
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
        {/* Screen share badge */}
        {isScreenSharing && (
          <div className="absolute top-1 right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-indigo-600 border border-slate-900 flex items-center justify-center text-white shadow-md animate-pulse">
            <ScreenShare className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </div>
        )}

        {/* Reaction badge */}
        {videoEffect?.reaction && (
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-sm filter drop-shadow animate-float pointer-events-none select-none z-20">
            {videoEffect.reaction}
          </span>
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
  audioDevices = [],
  videoDevices = [],
  selectedAudioDeviceId,
  selectedVideoDeviceId,
  onSwitchAudioDevice,
  onSwitchVideoDevice,
  followingClientId,
  onFollowPeer,
  localVideoEffect,
  onSetVideoEffect,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isScreenViewerExpanded, setIsScreenViewerExpanded] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEffectsOpen, setIsEffectsOpen] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement | null>(null);

  // Determine current room label
  const roomName = currentRoomId
    ? breakoutRooms.find((r) => r.id === currentRoomId)?.name || 'Breakout Sub-Group'
    : 'Main Room';

  // Collect all active screen sharing & video feeds
  interface DisplayFeed {
    id: string;
    title: string;
    stream: MediaStream;
    isScreen: boolean;
    isLocal: boolean;
  }

  const availableFeeds: DisplayFeed[] = [];

  // Remote peers sharing screen
  for (const [peerId, peerState] of remotePeers.entries()) {
    if (peerState.isScreenSharing && peerState.stream) {
      availableFeeds.push({
        id: `remote-screen-${peerId}`,
        title: `${peerState.peer?.name || 'Participant'}'s Screen`,
        stream: peerState.stream,
        isScreen: true,
        isLocal: false,
      });
    }
  }

  // Local user sharing screen
  if (isScreenSharing && screenStream) {
    availableFeeds.push({
      id: 'local-screen',
      title: 'Your Screen Share',
      stream: screenStream,
      isScreen: true,
      isLocal: true,
    });
  }

  // Selected pinned peer (if any, that is not already in feeds)
  if (selectedFeedId && !availableFeeds.some((f) => f.id === selectedFeedId)) {
    if (selectedFeedId === 'local' && localStream) {
      availableFeeds.push({
        id: 'local',
        title: 'You (Camera)',
        stream: localStream,
        isScreen: false,
        isLocal: true,
      });
    } else {
      const remote = remotePeers.get(selectedFeedId);
      if (remote?.stream) {
        availableFeeds.push({
          id: selectedFeedId,
          title: `${remote.peer?.name || 'Participant'} (Camera)`,
          stream: remote.stream,
          isScreen: false,
          isLocal: false,
        });
      }
    }
  }

  // Auto-select latest active feed if current feed is gone or unselected
  const activeFeed =
    availableFeeds.find((f) => f.id === selectedFeedId) || availableFeeds[0] || null;

  // Auto-expand viewer when a screen share becomes available
  const hasAnyScreenShare = availableFeeds.some((f) => f.isScreen);
  useEffect(() => {
    if (hasAnyScreenShare) {
      setIsScreenViewerExpanded(true);
    }
  }, [hasAnyScreenShare]);

  // Keep video streams connected to video elements
  useEffect(() => {
    if (screenVideoRef.current && activeFeed && screenVideoRef.current.srcObject !== activeFeed.stream) {
      screenVideoRef.current.srcObject = activeFeed.stream;
      screenVideoRef.current.play().catch(() => {});
    }
  }, [activeFeed]);

  useEffect(() => {
    if (fullscreenVideoRef.current && activeFeed && isFullscreen && fullscreenVideoRef.current.srcObject !== activeFeed.stream) {
      fullscreenVideoRef.current.srcObject = activeFeed.stream;
      fullscreenVideoRef.current.play().catch(() => {});
    }
  }, [activeFeed, isFullscreen]);

  if (!isCallActive) return null;

  const remotePeerList = Array.from(remotePeers.values());
  const totalCallers = 1 + remotePeerList.length;

  return (
    <>
      {/* Fullscreen Shared Screen Modal */}
      {isFullscreen && activeFeed && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col p-4 backdrop-blur-md animate-fade-in pointer-events-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-sm">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <ScreenShare className="w-5 h-5 text-indigo-400" />
              <span>{activeFeed.title}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-800/60 text-indigo-300">
                Live
              </span>
            </div>

            {/* Feeds Switcher in Fullscreen */}
            <div className="flex items-center gap-2">
              {availableFeeds.length > 1 && (
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                  {availableFeeds.map((feed) => (
                    <button
                      key={feed.id}
                      type="button"
                      onClick={() => setSelectedFeedId(feed.id)}
                      className={`text-xs px-2.5 py-1 rounded transition-colors ${
                        activeFeed.id === feed.id
                          ? 'bg-indigo-600 text-white font-medium'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {feed.title}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5"
              >
                <Minimize2 className="w-4 h-4" />
                Exit Fullscreen
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-2 min-h-0">
            <video
              ref={fullscreenVideoRef}
              autoPlay
              playsInline
              muted
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      <div className="fixed top-16 right-4 z-40 flex flex-col items-end gap-2 pointer-events-none">
        {/* Screen Share / Pinned Video Viewer (Floating Picture-in-Picture) */}
        {activeFeed && !isFullscreen && (
          <div
            className={`pointer-events-auto transition-all duration-300 w-80 sm:w-96 md:w-[500px] bg-slate-950/95 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md ${
              isScreenViewerExpanded ? 'block' : 'hidden'
            }`}
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 font-medium truncate max-w-[240px]">
                {activeFeed.isScreen ? (
                  <ScreenShare className="w-3.5 h-3.5 text-indigo-400 animate-pulse flex-shrink-0" />
                ) : (
                  <Monitor className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                )}
                <span className="truncate">{activeFeed.title}</span>
              </div>

              <div className="flex items-center gap-1">
                {/* Feed tabs if multiple feeds exist */}
                {availableFeeds.length > 1 && (
                  <div className="flex items-center gap-1 mr-2">
                    {availableFeeds.map((feed) => (
                      <button
                        key={feed.id}
                        type="button"
                        onClick={() => setSelectedFeedId(feed.id)}
                        className={`text-[10px] px-1.5 py-0.5 rounded truncate max-w-[90px] ${
                          activeFeed.id === feed.id
                            ? 'bg-indigo-600 text-white font-medium'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title={feed.title}
                      >
                        {feed.title.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsFullscreen(true)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                  title="View Fullscreen"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsScreenViewerExpanded(false)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                  title="Minimize Screen"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="relative aspect-video bg-black flex items-center justify-center">
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                muted
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
              {activeFeed && !isScreenViewerExpanded && (
                <button
                  type="button"
                  onClick={() => setIsScreenViewerExpanded(true)}
                  className="px-2 py-0.5 text-xs bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 hover:bg-indigo-900 rounded-lg flex items-center gap-1"
                  title="Expand Screen Share"
                >
                  <ScreenShare className="w-3 h-3 text-indigo-400 animate-pulse" />
                  <span>Screen</span>
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

          {/* Device Settings Popover Panel */}
          {isSettingsOpen && !isMinimized && (
            <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-xl flex flex-col gap-2.5 text-xs animate-fade-in">
              <div className="flex items-center justify-between text-slate-300 font-semibold border-b border-slate-800/80 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-indigo-400" />
                  Audio & Video Devices
                </span>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-0.5 text-slate-400 hover:text-white rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Microphone Selection */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                  <Mic className="w-3 h-3 text-slate-400" />
                  Microphone
                </label>
                <select
                  value={selectedAudioDeviceId || ''}
                  onChange={(e) => onSwitchAudioDevice?.(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {audioDevices.length === 0 ? (
                    <option value="" disabled>Default / System Microphone</option>
                  ) : (
                    audioDevices.map((d, idx) => (
                      <option key={d.deviceId || idx} value={d.deviceId}>
                        {d.label || `Microphone ${idx + 1}`}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Camera Selection */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                  <VideoIcon className="w-3 h-3 text-slate-400" />
                  Camera
                </label>
                <select
                  value={selectedVideoDeviceId || ''}
                  onChange={(e) => onSwitchVideoDevice?.(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {videoDevices.length === 0 ? (
                    <option value="" disabled>Default / System Camera</option>
                  ) : (
                    videoDevices.map((d, idx) => (
                      <option key={d.deviceId || idx} value={d.deviceId}>
                        {d.label || `Camera ${idx + 1}`}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          )}

          {/* Around.co Video Effects Panel */}
          {isEffectsOpen && !isMinimized && (
            <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-xl flex flex-col gap-2.5 text-xs animate-in fade-in zoom-in-95 duration-[var(--duration-fast)]">
              <div className="flex items-center justify-between text-slate-200 font-semibold border-b border-slate-800/80 pb-1.5">
                <span className="flex items-center gap-1.5 text-pink-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  Around Webcam Effects
                </span>
                <button
                  type="button"
                  onClick={() => setIsEffectsOpen(false)}
                  className="p-0.5 text-slate-400 hover:text-white rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-400">Webcam Filter</span>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
                  {VIDEO_FILTERS.map((f) => {
                    const isSelected = (localVideoEffect?.filter || 'none') === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          onSetVideoEffect?.({
                            filter: f.id,
                          })
                        }
                        className={`px-2 py-1 rounded-lg text-[11px] flex items-center justify-center gap-1 transition-all duration-[var(--duration-quick)] ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-bold ring-1 ring-indigo-400 shadow-sm'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                        title={f.description}
                      >
                        <span>{f.emoji}</span>
                        <span className="truncate">{f.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auras */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-400">Aura Glow Ring</span>
                <div className="grid grid-cols-3 gap-1">
                  {VIDEO_AURAS.map((a) => {
                    const isSelected = (localVideoEffect?.aura || 'none') === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() =>
                          onSetVideoEffect?.({
                            aura: a.id,
                          })
                        }
                        className={`px-2 py-1 rounded-lg text-[11px] flex items-center justify-center gap-1 transition-all duration-[var(--duration-quick)] ${
                          isSelected
                            ? 'bg-pink-600 text-white font-bold ring-1 ring-pink-400 shadow-sm'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                        title={a.description}
                      >
                        <span>{a.emoji}</span>
                        <span className="truncate">{a.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reaction Badges */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-400">Floating Reaction Badge</span>
                <div className="flex items-center flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      onSetVideoEffect?.({
                        reaction: null,
                      })
                    }
                    className={`px-2 py-0.5 rounded text-[10px] ${
                      !localVideoEffect?.reaction
                        ? 'bg-slate-700 text-white font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    Off
                  </button>
                  {FUN_REACTIONS.map((emoji) => {
                    const isSelected = localVideoEffect?.reaction === emoji;
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() =>
                          onSetVideoEffect?.({
                            reaction: emoji,
                          })
                        }
                        className={`w-6 h-6 rounded flex items-center justify-center text-sm transition-transform duration-[var(--duration-quick)] ${
                          isSelected
                            ? 'bg-indigo-600/80 scale-125 ring-1 ring-indigo-400'
                            : 'hover:scale-110 hover:bg-slate-800'
                        }`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

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
                isScreenSharing={isScreenSharing}
                isPinned={selectedFeedId === 'local'}
                videoEffect={localVideoEffect}
                onClick={() => {
                  setSelectedFeedId(selectedFeedId === 'local' ? null : 'local');
                  setIsScreenViewerExpanded(true);
                }}
              />

              {/* Remote Participants Bubbles */}
              {remotePeerList.map((remote) => {
                const isFollowing = followingClientId === remote.clientId;
                return (
                  <div key={remote.clientId} className="relative group/bubble">
                    <VideoBubble
                      stream={remote.stream}
                      name={remote.peer?.name || `Stormer ${remote.clientId.slice(0, 4)}`}
                      color={remote.peer?.color || '#3b82f6'}
                      isSpeaking={remote.isSpeaking}
                      isMuted={remote.isMuted}
                      isVideoOff={remote.isVideoOff}
                      isScreenSharing={remote.isScreenSharing}
                      videoEffect={remote.videoEffect}
                      isPinned={
                        selectedFeedId === remote.clientId ||
                        selectedFeedId === `remote-screen-${remote.clientId}`
                      }
                      onClick={() => {
                        const targetId = remote.isScreenSharing
                          ? `remote-screen-${remote.clientId}`
                          : remote.clientId;
                        setSelectedFeedId(selectedFeedId === targetId ? null : targetId);
                        setIsScreenViewerExpanded(true);
                      }}
                    />
                    {onFollowPeer && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFollowPeer(isFollowing ? null : remote.clientId);
                        }}
                        className={`absolute -top-1 -left-1 p-1 rounded-full shadow border border-slate-900 transition-all ${
                          isFollowing
                            ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                            : 'bg-slate-800 text-slate-300 opacity-0 group-hover/bubble:opacity-100 hover:text-white hover:bg-slate-700'
                        }`}
                        title={
                          isFollowing
                            ? `Following ${remote.peer?.name || 'Attendee'} (click to stop)`
                            : `Follow ${remote.peer?.name || 'Attendee'}`
                        }
                      >
                        <Eye className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
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

            {/* Around.co Video Effects Button */}
            <button
              type="button"
              onClick={() => {
                setIsEffectsOpen(!isEffectsOpen);
                setIsSettingsOpen(false);
              }}
              className={`p-2 rounded-xl transition-colors duration-[var(--duration-quick)] ${
                isEffectsOpen
                  ? 'bg-gradient-to-r from-pink-600 to-indigo-600 text-white shadow-md shadow-pink-900/40 ring-1 ring-pink-400'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Around.co Webcam Filters & Auras"
            >
              <Sparkles className="w-4 h-4 text-pink-300" />
            </button>

            {/* Device Settings Button */}
            <button
              type="button"
              onClick={() => {
                setIsSettingsOpen(!isSettingsOpen);
                setIsEffectsOpen(false);
              }}
              className={`p-2 rounded-xl transition-colors duration-[var(--duration-quick)] ${
                isSettingsOpen
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Select Microphone and Camera Devices"
            >
              <Settings className="w-4 h-4" />
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
    </>
  );
};
