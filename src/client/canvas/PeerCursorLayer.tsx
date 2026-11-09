import React, { useRef, useEffect } from 'react';
import type { PeerCursor } from '../../shared/eventstorming';
import type { RemotePeerState } from '../hooks/useWebRTC';
import { MicOff, ScreenShare, Eye } from 'lucide-react';

interface PeerCursorLayerProps {
  peers: PeerCursor[];
  remotePeers?: Map<string, RemotePeerState>;
  followingClientId?: string | null;
  onFollowPeer?: (clientId: string | null) => void;
}

const PeerVideoElement: React.FC<{ stream: MediaStream }> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover"
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
          remoteState.stream.getVideoTracks().some((t) => t.enabled);

        return (
          <div
            key={peer.clientId}
            style={{
              position: 'absolute',
              left: `${peer.x}px`,
              top: `${peer.y}px`,
              transition: 'left 60ms linear, top 60ms linear',
            }}
            className="flex flex-col items-start -translate-x-1.5 -translate-y-1.5 select-none"
          >
            {/* Webcam / Round Avatar Bubble above cursor */}
            <div
              onClick={() => onFollowPeer?.(isFollowingThisPeer ? null : peer.clientId)}
              className={`relative -ml-2 mb-1 rounded-full overflow-hidden transition-all duration-200 pointer-events-auto cursor-pointer shadow-xl ${
                remoteState?.isSpeaking
                  ? 'ring-3 ring-emerald-400 ring-offset-2 ring-offset-slate-900 shadow-[0_0_14px_rgba(52,211,153,0.8)] scale-110'
                  : isFollowingThisPeer
                  ? 'ring-3 ring-indigo-500 ring-offset-2 ring-offset-slate-900 shadow-[0_0_14px_rgba(99,102,241,0.8)]'
                  : 'ring-2 ring-slate-800 hover:ring-indigo-400'
              } w-11 h-11 sm:w-12 sm:h-12`}
              style={{ backgroundColor: hasVideo ? '#090d16' : peer.color }}
              title={
                isFollowingThisPeer
                  ? `Following ${peer.name} (Click to stop)`
                  : `Click to follow ${peer.name}`
              }
            >
              {hasVideo && remoteState ? (
                <PeerVideoElement stream={remoteState.stream} />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center font-bold text-white text-xs sm:text-sm"
                  style={{ backgroundColor: peer.color }}
                >
                  {initials}
                </div>
              )}

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
