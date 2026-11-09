import React, { useRef, useEffect, useCallback } from 'react';
import type { PeerCursor } from '../../shared/eventstorming';
import type { RemotePeerState } from '../hooks/useWebRTC';
import { getFilterCss, getAuraClasses } from '../utils/videoEffects';
import { MicOff, ScreenShare, Eye } from 'lucide-react';
interface PeerCursorLayerProps {
  peers: PeerCursor[];
  remotePeers?: Map<string, RemotePeerState>;
  followingClientId?: string | null;
  onFollowPeer?: (clientId: string | null) => void;
}

const PeerVideoElement: React.FC<{ stream: MediaStream; filterCss?: string }> = ({ stream, filterCss }) => {
  // srcObject is DOM state, not a prop — bind in both directions via callback ref.
  // Whichever arrives second (element mount or stream arrival) does the binding.
  const elRef = useRef<HTMLVideoElement | null>(null);
  const wantRef = useRef<MediaStream | null>(null);

  const paint = useCallback((node: HTMLVideoElement | null) => {
    if (!node || node.srcObject === wantRef.current) return;
    node.srcObject = wantRef.current;
    node.muted = true;
    if (wantRef.current) void node.play().catch(() => undefined);
  }, []);

  // Callback ref: pulls stream when a new element mounts
  const videoRef = useCallback((node: HTMLVideoElement | null) => {
    elRef.current = node;
    paint(node);
  }, [paint]);

  // Push stream when it arrives (or changes)
  useEffect(() => {
    wantRef.current = stream;
    paint(elRef.current);
  }, [stream, paint]);

  // Re-attempt playback when tracks are added to the stream
  useEffect(() => {
    const node = elRef.current;
    if (!stream) return;
    const onLoaded = () => {
      const el = elRef.current;
      if (el) {
        el.muted = true;
        if (el.paused) el.play().catch(() => undefined);
      }
    };
    stream.addEventListener('addtrack', onLoaded);
    for (const track of stream.getTracks()) {
      track.addEventListener('unmute', onLoaded);
    }
    if (node) node.addEventListener('loadeddata', onLoaded);
    return () => {
      stream.removeEventListener('addtrack', onLoaded);
      for (const track of stream.getTracks()) {
        track.removeEventListener('unmute', onLoaded);
      }
      if (node) node.removeEventListener('loadeddata', onLoaded);
    };
  }, [stream]);
  // Clear stale stream on unmount
  useEffect(() => {
    return () => { wantRef.current = null; };
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{ filter: filterCss || 'none' }}
      className="w-full h-full object-cover transition-all"
    />
  );
};

export const PeerCursorLayer: React.FC<PeerCursorLayerProps> = ({
  peers,
  remotePeers,
  followingClientId,
  onFollowPeer,
}) => {
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {peers.map((peer) => {
        const remoteState = remotePeers?.get(peer.clientId);
        const isFollowingThisPeer = followingClientId === peer.clientId;
        const initials = (peer.name || 'Anonymous')
          .split(' ')
          .filter(Boolean)
          .map((part) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'ST';

        const hasVideo =
          remoteState?.stream &&
          !remoteState.isVideoOff &&
          remoteState.stream.getVideoTracks().length > 0 &&
          remoteState.stream.getVideoTracks().some((t) => t.enabled && t.readyState !== 'ended');

        return (
          <div
            key={peer.clientId}
            style={{
              position: 'absolute',
              left: `${peer.x}px`,
              top: `${peer.y}px`,
              transition: 'left var(--duration-micro) var(--ease-linear), top var(--duration-micro) var(--ease-linear)',
            }}
            className="flex flex-col items-center -translate-x-1.5 -translate-y-1.5 select-none"
          >
            {/* Webcam / Round Avatar Bubble centered above name tag */}
            <div
              onClick={() => onFollowPeer?.(isFollowingThisPeer ? null : peer.clientId)}
              className={`relative mb-1 rounded-full transition-all duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] pointer-events-auto cursor-pointer shadow-xl ${
                getAuraClasses(remoteState?.videoEffect?.aura, remoteState?.isSpeaking)
              } ${
                isFollowingThisPeer
                  ? 'ring-4 ring-indigo-500 ring-offset-2 ring-offset-slate-900 shadow-[0_0_16px_rgba(99,102,241,0.9)]'
                  : 'hover:scale-105'
              } w-11 h-11 sm:w-12 sm:h-12`}
              style={{ backgroundColor: hasVideo ? '#090d16' : peer.color }}
              title={
                isFollowingThisPeer
                  ? `Following ${peer.name} (Click to stop)`
                  : `Click to follow ${peer.name}`
              }
            >
              <div className="absolute inset-0 rounded-full overflow-hidden">
                {hasVideo && remoteState ? (
                  <PeerVideoElement
                    stream={remoteState.stream}
                    filterCss={getFilterCss(remoteState.videoEffect?.filter)}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center font-bold text-white text-xs sm:text-sm"
                    style={{ backgroundColor: peer.color }}
                  >
                    {initials}
                  </div>
                )}
              </div>

              {/* Screenshare badge */}
              {remoteState?.isScreenSharing && (
                <div className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-indigo-600 border border-slate-900 flex items-center justify-center text-white shadow-xs animate-pulse">
                  <ScreenShare className="w-2 h-2" />
                </div>
              )}

              {/* Muted badge */}
              {remoteState?.isMuted && (
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-rose-600 border border-slate-900 flex items-center justify-center text-white shadow-xs">
                  <MicOff className="w-2 h-2" />
                </div>
              )}

              {/* Around.co Fun Reaction Overlay Badge */}
              {remoteState?.videoEffect?.reaction && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-sm filter drop-shadow animate-float pointer-events-none select-none z-10">
                  {remoteState.videoEffect.reaction}
                </span>
              )}
            </div>
            {/* Cursor arrow and name tag */}
            <div className="flex items-center gap-1 pointer-events-auto">
              <svg
                className="w-4 h-4 -rotate-45 drop-shadow flex-shrink-0"
                viewBox="0 0 24 24"
                fill={peer.color}
                stroke="#ffffff"
                strokeWidth="1.5"
              >
                <polygon points="3 3 21 11 12 13 8 21" />
              </svg>

              <button
                type="button"
                onClick={() => onFollowPeer?.(isFollowingThisPeer ? null : peer.clientId)}
                style={{ backgroundColor: peer.color }}
                className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-md whitespace-nowrap flex items-center gap-1 hover:brightness-110 transition-all cursor-pointer"
                title={
                  isFollowingThisPeer
                    ? `Following ${peer.name} (Click to stop)`
                    : `Click to follow ${peer.name}`
                }
              >
                <span>{peer.name || 'Anonymous'}</span>
                {isFollowingThisPeer && (
                  <span className="flex items-center gap-0.5 text-[9px] bg-black/40 px-1 py-0.2 rounded text-indigo-200">
                    <Eye className="w-2.5 h-2.5" />
                    Following
                  </span>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
