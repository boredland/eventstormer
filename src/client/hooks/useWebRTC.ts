import { useState, useRef, useEffect, useCallback } from 'react';
import type {
  ClientMessage,
  ServerMessage,
  PeerCursor,
} from '../../shared/eventstorming';
import type { UserProfile } from '../types';
import type { VideoEffect } from '../utils/videoEffects';
import { DEFAULT_VIDEO_EFFECT } from '../utils/videoEffects';

export interface RemotePeerState {
  clientId: string;
  stream: MediaStream;
  peer?: PeerCursor;
  isSpeaking: boolean;
  isVideoOff: boolean;
  isMuted: boolean;
  isScreenSharing?: boolean;
  videoEffect?: VideoEffect;
}

export interface UseWebRTCOptions {
  currentRoomId: string | null;
  user: UserProfile;
  peers: PeerCursor[];
  sendMessage: (msg: ClientMessage) => void;
}

export interface UseWebRTCReturn {
  isCallActive: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isLocalSpeaking: boolean;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remotePeers: Map<string, RemotePeerState>;
  mediaNotice: string | null;
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  selectedAudioDeviceId: string | null;
  selectedVideoDeviceId: string | null;
  switchAudioDevice: (deviceId: string) => Promise<void>;
  switchVideoDevice: (deviceId: string) => Promise<void>;
  localVideoEffect: VideoEffect;
  setVideoEffect: (update: Partial<VideoEffect>) => void;
  startCall: () => Promise<void>;
  leaveCall: () => void;
  toggleMute: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  dismissNotice: () => void;
  handleServerMessage: (msg: ServerMessage) => void;
  participantCount: number;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  // Free TURN server (Open Relay): port 80 (UDP) + port 443 (TCP fallback)
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export function useWebRTC({
  currentRoomId,
  user,
  peers,
  sendMessage,
}: UseWebRTCOptions): UseWebRTCReturn {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<Map<string, RemotePeerState>>(new Map());
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string | null>(null);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string | null>(null);
  const [localVideoEffect, setLocalVideoEffect] = useState<VideoEffect>(() => {
    try {
      const saved = localStorage.getItem('eventstormer_video_effect');
      if (saved) return JSON.parse(saved) as VideoEffect;
    } catch {}
      return DEFAULT_VIDEO_EFFECT;
  });
  const localVideoEffectRef = useRef<VideoEffect>(localVideoEffect);
  localVideoEffectRef.current = localVideoEffect;
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalCamTrackRef = useRef<MediaStreamTrack | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const localAudioAnalyserRef = useRef<{ analyser: AnalyserNode; intervalId: number } | null>(null);
  const remoteAnalysersRef = useRef<Map<string, { analyser: AnalyserNode; intervalId: number }>>(new Map());

  const currentRoomIdRef = useRef<string | null>(currentRoomId);
  currentRoomIdRef.current = currentRoomId;

  const peersRef = useRef<PeerCursor[]>(peers);
  peersRef.current = peers;

  const isCallActiveRef = useRef<boolean>(isCallActive);
  isCallActiveRef.current = isCallActive;

  // Initialize AudioContext safely
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
      }
    }
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);
  // Enumerate audio and video input devices
  const refreshDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audios = devices.filter((d) => d.kind === 'audioinput');
      const videos = devices.filter((d) => d.kind === 'videoinput');
      setAudioDevices(audios);
      setVideoDevices(videos);
      setSelectedAudioDeviceId((prev) => prev || (audios[0]?.deviceId ?? null));
      setSelectedVideoDeviceId((prev) => prev || (videos[0]?.deviceId ?? null));
    } catch (err) {
      console.warn('Failed to enumerate media devices:', err);
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    if (navigator?.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
      };
    }
  }, [refreshDevices]);

  // Setup active speaker analysis for a stream
  const setupSpeakingDetector = useCallback((
    targetId: string,
    stream: MediaStream,
    isLocal: boolean
  ) => {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let speakingFrames = 0;

      const intervalId = window.setInterval(() => {
        if (!audioTrack.enabled || audioTrack.readyState !== 'live') {
          if (isLocal) setIsLocalSpeaking(false);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const active = avg > 16;

        if (active) {
          speakingFrames = Math.min(speakingFrames + 1, 5);
        } else {
          speakingFrames = Math.max(speakingFrames - 1, 0);
        }

        const speakingNow = speakingFrames >= 2;

        if (isLocal) {
          setIsLocalSpeaking((prev) => (prev !== speakingNow ? speakingNow : prev));
        } else {
          setRemotePeers((prev) => {
            const current = prev.get(targetId);
            if (!current || current.isSpeaking === speakingNow) return prev;
            const updated = new Map(prev);
            updated.set(targetId, { ...current, isSpeaking: speakingNow });
            return updated;
          });
        }
      }, 100);

      if (isLocal) {
        localAudioAnalyserRef.current = { analyser, intervalId };
      } else {
        remoteAnalysersRef.current.set(targetId, { analyser, intervalId });
      }
    } catch (err) {
      console.warn('Failed to attach speaker detector:', err);
    }
  }, [getAudioContext]);

  // Clean single remote peer resources
  const cleanupRemotePeer = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    pendingCandidatesRef.current.delete(peerId);

    const analyserObj = remoteAnalysersRef.current.get(peerId);
    if (analyserObj) {
      window.clearInterval(analyserObj.intervalId);
      remoteAnalysersRef.current.delete(peerId);
    }

    setRemotePeers((prev) => {
      if (!prev.has(peerId)) return prev;
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  // Create an RTCPeerConnection for a target peer
  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    // Return existing if already open
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing && existing.connectionState !== 'closed') {
      return existing;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionsRef.current.set(peerId, pc);

    // Renegotiation handler — MUST be set before addTrack/addTransceiver so initial track
    // addition fires it. Uses makingOffer flag to prevent glare.
    let makingOffer = false;
    pc.onnegotiationneeded = async () => {
      try {
        if (makingOffer || pc.signalingState !== 'stable') return;
        const isInitial = !pc.currentRemoteDescription;
        if (isInitial && user.clientId <= peerId) return;
        makingOffer = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendMessage({
          type: 'webrtc:signal',
          targetClientId: peerId,
          roomId: currentRoomIdRef.current,
          signal: { type: 'offer', data: offer },
        });
      } catch (err) {
        console.warn('Negotiation failed for peer', peerId, err);
      } finally {
        makingOffer = false;
      }
    };

    // Attach local stream tracks
    const activeStream = screenStreamRef.current || localStreamRef.current;
    if (activeStream && activeStream.getTracks().length > 0) {
      for (const track of activeStream.getTracks()) {
        pc.addTrack(track, activeStream);
      }
    }

    // Ensure transceivers exist for receive-only peers (no local mic/cam)
    const hasAudio = pc.getSenders().some((s) => s.track?.kind === 'audio');
    const hasVideo = pc.getSenders().some((s) => s.track?.kind === 'video');
    if (!hasAudio) {
      try {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      } catch {}
    }
    if (!hasVideo) {
      try {
        pc.addTransceiver('video', { direction: 'recvonly' });
      } catch {}
    }

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: 'webrtc:signal',
          targetClientId: peerId,
          roomId: currentRoomIdRef.current,
          signal: {
            type: 'candidate',
            data: event.candidate.toJSON(),
          },
        });
      }
    };

    // Track received from peer
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      const peerCursor = peersRef.current.find((p) => p.clientId === peerId);

      setRemotePeers((prev) => {
        const next = new Map(prev);
        const existingPeer = next.get(peerId);
        // Always prefer event.streams[0] (browser-managed) so replaceTrack propagates to video elements
        const stream = event.streams[0] || existingPeer?.stream || remoteStream;

        // Ensure track is in stream
        if (!stream.getTracks().some((t) => t.id === event.track.id)) {
          stream.addTrack(event.track);
        }

        const isVideoOff = stream.getVideoTracks().length === 0 || !stream.getVideoTracks().some((t) => t.enabled);
        const isMuted = stream.getAudioTracks().length === 0 || !stream.getAudioTracks().some((t) => t.enabled);

        next.set(peerId, {
          clientId: peerId,
          stream,
          peer: peerCursor,
          isSpeaking: existingPeer?.isSpeaking || false,
          isVideoOff,
          isMuted,
          isScreenSharing: existingPeer?.isScreenSharing || false,
          videoEffect: existingPeer?.videoEffect,
        });
        return next;
      });

      // Hook speaker detector for incoming audio
      if (event.track.kind === 'audio') {
        setupSpeakingDetector(peerId, remoteStream, false);
      }
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed'
      ) {
        cleanupRemotePeer(peerId);
      }
    };

    return pc;
  }, [cleanupRemotePeer, peersRef, sendMessage, setupSpeakingDetector]);

  // Handle incoming signaling messages from websocket
  const handleServerMessage = useCallback(async (msg: ServerMessage) => {
    // Allow peer-joined/left state notifications through even before call is fully active
    // to avoid race conditions where signaling arrives during getUserMedia initialization
    const isStateNotification = msg.type === 'webrtc:peer-joined' || msg.type === 'webrtc:peer-left';
    if (!isCallActiveRef.current && !isStateNotification) return;

    if (msg.type === 'webrtc:peer-joined') {
      const { clientId: peerId, roomId } = msg;
      if (peerId === user.clientId) return;
      // Confirm peer is in the same room
      if ((roomId || null) !== (currentRoomIdRef.current || null)) return;

      const pc = createPeerConnection(peerId);

      // Immediately register the peer in remotePeers so they appear in participant count and call dock
      const peerCursor = peersRef.current.find((p) => p.clientId === peerId);
      setRemotePeers((prev) => {
        if (prev.has(peerId)) return prev;
        const next = new Map(prev);
        next.set(peerId, {
          clientId: peerId,
          stream: new MediaStream(),
          peer: peerCursor,
          isSpeaking: false,
          isVideoOff: true,
          isMuted: true,
          isScreenSharing: false,
        });
        return next;
      });
      // Notify new peer if local user is currently sharing screen
      if (screenStreamRef.current) {
        sendMessage({
          type: 'webrtc:signal',
          targetClientId: peerId,
          roomId: currentRoomIdRef.current,
          signal: {
            type: 'screenshare',
            data: { isSharing: true },
          },
        });
      }

      // Send current video effect to new peer
      sendMessage({
        type: 'webrtc:signal',
        targetClientId: peerId,
        roomId: currentRoomIdRef.current,
        signal: {
          type: 'video-effect',
          data: localVideoEffectRef.current,
        },
      });
      // Fallback: create initial offer if onnegotiationneeded didn't fire (e.g., no local tracks yet)
      if (user.clientId > peerId && isCallActiveRef.current && pc.signalingState === 'stable') {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendMessage({
            type: 'webrtc:signal',
            targetClientId: peerId,
            roomId: currentRoomIdRef.current,
            signal: { type: 'offer', data: offer },
          });
        } catch (err) {
          console.warn('Fallback offer failed for peer', peerId, err);
        }
      }
    } else if (msg.type === 'webrtc:peer-left') {
      cleanupRemotePeer(msg.clientId);
    } else if (msg.type === 'webrtc:signal') {
      const { fromClientId, signal, roomId } = msg;
      if (fromClientId === user.clientId) return;
      if ((roomId || null) !== (currentRoomIdRef.current || null)) return;

      let pc = peerConnectionsRef.current.get(fromClientId);
      if (!pc || pc.connectionState === 'closed') {
        pc = createPeerConnection(fromClientId);
      }

      // Ensure fromClientId is registered in remotePeers
      const signalPeerCursor = peersRef.current.find((p) => p.clientId === fromClientId);
      setRemotePeers((prev) => {
        if (prev.has(fromClientId)) return prev;
        const next = new Map(prev);
        next.set(fromClientId, {
          clientId: fromClientId,
          stream: new MediaStream(),
          peer: signalPeerCursor,
          isSpeaking: false,
          isVideoOff: true,
          isMuted: true,
          isScreenSharing: false,
        });
        return next;
      });
      // Handle remote screenshare state broadcasts
      if (signal.type === 'screenshare') {
        const isSharing = !!signal.data?.isSharing;
        setRemotePeers((prev) => {
          const current = prev.get(fromClientId);
          if (!current) return prev;
          const next = new Map(prev);
          next.set(fromClientId, {
            ...current,
            isScreenSharing: isSharing,
          });
          return next;
        });
        return;
      }

      // Handle remote video effect updates
      if (signal.type === 'video-effect') {
        const effect = signal.data as VideoEffect;
        setRemotePeers((prev) => {
          const current = prev.get(fromClientId);
          if (!current) return prev;
          const next = new Map(prev);
          next.set(fromClientId, {
            ...current,
            videoEffect: effect,
          });
          return next;
        });
        return;
      }
      try {
        if (signal.type === 'offer') {
          // Glare handling via WebRTC Perfect Negotiation
          if (pc.signalingState !== 'stable') {
            // Impolite peer (higher clientId) ignores colliding offer
            if (user.clientId > fromClientId) return;
            // Polite peer (lower clientId) rolls back its local offer
            await pc.setLocalDescription({ type: 'rollback' });
          }
          await pc.setRemoteDescription(new RTCSessionDescription(signal.data));

          // Drain queued candidates
          const queued = pendingCandidatesRef.current.get(fromClientId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          pendingCandidatesRef.current.delete(fromClientId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          sendMessage({
            type: 'webrtc:signal',
            targetClientId: fromClientId,
            roomId: currentRoomIdRef.current,
            signal: {
              type: 'answer',
              data: answer,
            },
          });
        } else if (signal.type === 'answer') {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.data));

            // Drain queued candidates
            const queued = pendingCandidatesRef.current.get(fromClientId) || [];
            for (const cand of queued) {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
            pendingCandidatesRef.current.delete(fromClientId);
          }
        } else if (signal.type === 'candidate') {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.data));
          } else {
            // Queue until remote description is set
            const queued = pendingCandidatesRef.current.get(fromClientId) || [];
            queued.push(signal.data);
            pendingCandidatesRef.current.set(fromClientId, queued);
          }
        }
      } catch (err) {
        console.warn('Error processing WebRTC signal:', err);
      }
    }
  }, [cleanupRemotePeer, createPeerConnection, sendMessage, user.clientId]);

  // Start video/audio call with robust fallback to listen-only mode
  const startCall = useCallback(async () => {
    setIsConnecting(true);
    let stream: MediaStream | null = null;
    let initialMuted = false;
    let initialVideoOff = false;
    let notice: string | null = null;

    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              ...(selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : {}),
              width: { ideal: 320, max: 480 },
              height: { ideal: 320, max: 480 },
              frameRate: { ideal: 15, max: 20 },
            },
            audio: {
              ...(selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : {}),
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          refreshDevices();
        } catch (videoError) {
          console.warn('Camera unavailable or rejected, trying audio only:', videoError);
          initialVideoOff = true;
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                ...(selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : {}),
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
              video: false,
            });
            refreshDevices();
          } catch (audioError) {
            console.warn('Microphone also unavailable or denied, entering listen-only mode:', audioError);
            initialMuted = true;
            notice = 'Microphone/camera access unavailable. Joined in listen-only mode.';
          }
        }
      } else {
        initialVideoOff = true;
        initialMuted = true;
        notice = 'Media devices unsupported. Joined in listen-only mode.';
      }
    } catch (err) {
      console.warn('Error acquiring media stream:', err);
      initialVideoOff = true;
      initialMuted = true;
      notice = 'Microphone/camera access unavailable. Joined in listen-only mode.';
    }

    const effectiveStream = stream || new MediaStream();
    localStreamRef.current = effectiveStream;
    originalCamTrackRef.current = effectiveStream.getVideoTracks()[0] || null;

    setLocalStream(effectiveStream);
    isCallActiveRef.current = true;
    setIsCallActive(true);
    setIsVideoOff(initialVideoOff);
    setIsMuted(initialMuted);
    setMediaNotice(notice);
    setIsConnecting(false);

    // Start local speaking detector if audio track is active
    if (effectiveStream.getAudioTracks().length > 0) {
      setupSpeakingDetector(user.clientId, effectiveStream, true);
    }

    // Backfill local tracks into any peer connections created before getUserMedia resolved
    // (peer-joined handler may have created PCs with recvonly transceivers)
    for (const pc of peerConnectionsRef.current.values()) {
      for (const track of effectiveStream.getTracks()) {
        // Find a recvonly transceiver of this kind to upgrade to sendrecv
        const tx = pc.getTransceivers().find((t) => t.receiver.track.kind === track.kind && !t.sender.track);
        if (tx) {
          tx.sender.replaceTrack(track).catch(() => {});
          tx.direction = 'sendrecv';
        } else if (!pc.getSenders().some((s) => s.track?.kind === track.kind)) {
          try { pc.addTrack(track, effectiveStream); } catch {}
        }
      }
    }

    // Notify room peers via websocket
    sendMessage({
      type: 'webrtc:join',
      roomId: currentRoomIdRef.current,
    });
  }, [sendMessage, setupSpeakingDetector, user.clientId]);

  // Leave call and clean up all media
  const leaveCall = useCallback(() => {
    // Notify server/peers
    sendMessage({
      type: 'webrtc:leave',
      roomId: currentRoomIdRef.current,
    });

    // Close all peer connections
    for (const pc of peerConnectionsRef.current.values()) {
      pc.close();
    }
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();

    // Stop speaking detectors
    if (localAudioAnalyserRef.current) {
      window.clearInterval(localAudioAnalyserRef.current.intervalId);
      localAudioAnalyserRef.current = null;
    }
    for (const item of remoteAnalysersRef.current.values()) {
      window.clearInterval(item.intervalId);
    }
    remoteAnalysersRef.current.clear();

    // Stop all local tracks
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      for (const track of screenStreamRef.current.getTracks()) {
        track.stop();
      }
      screenStreamRef.current = null;
    }

    originalCamTrackRef.current = null;
    setLocalStream(null);
    setScreenStream(null);
    setRemotePeers(new Map());
    setIsCallActive(false);
    setIsConnecting(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setIsLocalSpeaking(false);
    setMediaNotice(null);
  }, [sendMessage]);

  const dismissNotice = useCallback(() => {
    setMediaNotice(null);
  }, []);

  // Switch microphone device dynamically
  const switchAudioDevice = useCallback(async (deviceId: string) => {
    setSelectedAudioDeviceId(deviceId);
    if (!isCallActiveRef.current || !localStreamRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const newTrack = stream.getAudioTracks()[0];
      if (!newTrack) return;

      const oldTracks = localStreamRef.current.getAudioTracks();
      for (const t of oldTracks) {
        t.stop();
        localStreamRef.current.removeTrack(t);
      }

      if (isMuted) {
        newTrack.enabled = false;
      }
      localStreamRef.current.addTrack(newTrack);

      for (const pc of peerConnectionsRef.current.values()) {
        const audioSender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (audioSender) {
          audioSender.replaceTrack(newTrack).catch(() => {});
        } else {
          pc.addTrack(newTrack, localStreamRef.current);
        }
      }

      setupSpeakingDetector(user.clientId, localStreamRef.current, true);
    } catch (err) {
      console.warn('Failed to switch audio device:', err);
    }
  }, [isMuted, setupSpeakingDetector, user.clientId]);

  // Switch camera device dynamically
  const switchVideoDevice = useCallback(async (deviceId: string) => {
    setSelectedVideoDeviceId(deviceId);
    if (!isCallActiveRef.current || !localStreamRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 320, max: 480 },
          height: { ideal: 320, max: 480 },
          frameRate: { ideal: 15, max: 20 },
        },
      });
      const newTrack = stream.getVideoTracks()[0];
      if (!newTrack) return;

      const oldTracks = localStreamRef.current.getVideoTracks();
      for (const t of oldTracks) {
        t.stop();
        localStreamRef.current.removeTrack(t);
      }

      if (isVideoOff) {
        newTrack.enabled = false;
      }
      localStreamRef.current.addTrack(newTrack);
      originalCamTrackRef.current = newTrack;

      if (!screenStreamRef.current) {
        for (const pc of peerConnectionsRef.current.values()) {
          const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(newTrack).catch(() => {});
          } else {
            pc.addTrack(newTrack, localStreamRef.current);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to switch video device:', err);
    }
  }, [isVideoOff]);

  // Set and broadcast video effect (Around.co filters & aura)
  // Accepts partial updates to avoid stale-prop overwrites when multiple effects change rapidly
  const setVideoEffect = useCallback((update: Partial<VideoEffect>) => {
    setLocalVideoEffect((prev) => {
      const next = { ...prev, ...update };
      try {
        localStorage.setItem('eventstormer_video_effect', JSON.stringify(next));
      } catch {}
      return next;
    });

    const merged = { ...localVideoEffectRef.current, ...update };
    localVideoEffectRef.current = merged;

    for (const peerId of peerConnectionsRef.current.keys()) {
      sendMessage({
        type: 'webrtc:signal',
        targetClientId: peerId,
        roomId: currentRoomIdRef.current,
        signal: {
          type: 'video-effect',
          data: merged,
        },
      });
    }
  }, [sendMessage]);
  // Toggle Mute (re-request microphone if in listen-only mode)
  const toggleMute = useCallback(async () => {
    if (!localStreamRef.current) return;
    let audioTrack = localStreamRef.current.getAudioTracks()[0];

    if (!audioTrack) {
      try {
        if (navigator?.mediaDevices?.getUserMedia) {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          const newTrack = micStream.getAudioTracks()[0];
          if (newTrack) {
            localStreamRef.current.addTrack(newTrack);
            audioTrack = newTrack;
            for (const pc of peerConnectionsRef.current.values()) {
              const audioTx = pc.getTransceivers().find((t) => t.receiver.track.kind === 'audio');
              if (audioTx) {
                audioTx.direction = 'sendrecv';
                audioTx.sender.replaceTrack(newTrack).catch(() => {});
              } else {
                pc.addTrack(newTrack, localStreamRef.current);
              }
            }
            setupSpeakingDetector(user.clientId, localStreamRef.current, true);
            setIsMuted(false);
            setMediaNotice(null);
            return;
          }
        }
      } catch (err) {
        console.warn('Microphone still unavailable:', err);
        return;
      }
    }

    if (audioTrack) {
      const newMuted = !isMuted;
      audioTrack.enabled = !newMuted;
      setIsMuted(newMuted);
      if (newMuted) setIsLocalSpeaking(false);
    }
  }, [isMuted, setupSpeakingDetector, user.clientId]);

  // Toggle Video (re-request camera if in listen-only mode)
  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current) return;
    let videoTrack = localStreamRef.current.getVideoTracks()[0];

    if (!videoTrack) {
      try {
        if (navigator?.mediaDevices?.getUserMedia) {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 320, max: 480 },
              height: { ideal: 320, max: 480 },
              frameRate: { ideal: 15, max: 20 },
            },
          });
          const newTrack = camStream.getVideoTracks()[0];
          if (newTrack) {
            localStreamRef.current.addTrack(newTrack);
            originalCamTrackRef.current = newTrack;
            videoTrack = newTrack;
            for (const pc of peerConnectionsRef.current.values()) {
              const videoTx = pc.getTransceivers().find((t) => t.receiver.track.kind === 'video');
              if (videoTx) {
                videoTx.direction = 'sendrecv';
                videoTx.sender.replaceTrack(newTrack).catch(() => {});
              } else {
                pc.addTrack(newTrack, localStreamRef.current);
              }
            }
            setIsVideoOff(false);
            setMediaNotice(null);
            return;
          }
        }
      } catch (err) {
        console.warn('Camera still unavailable:', err);
        return;
      }
    }

    if (videoTrack) {
      const newVideoOff = !isVideoOff;
      videoTrack.enabled = !newVideoOff;
      setIsVideoOff(newVideoOff);
    }
  }, [isVideoOff]);


  // Toggle Screen Share
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Revert to camera
      if (screenStreamRef.current) {
        for (const track of screenStreamRef.current.getTracks()) {
          track.stop();
        }
        screenStreamRef.current = null;
      }
      setScreenStream(null);
      setIsScreenSharing(false);

      // Broadcast screen share stopped to room peers
      for (const targetId of peerConnectionsRef.current.keys()) {
        sendMessage({
          type: 'webrtc:signal',
          targetClientId: targetId,
          roomId: currentRoomIdRef.current,
          signal: {
            type: 'screenshare',
            data: { isSharing: false },
          },
        });
      }

      const camTrack = originalCamTrackRef.current;
      for (const pc of peerConnectionsRef.current.values()) {
        const tx = pc.getTransceivers().find((t) => t.receiver.track.kind === 'video');
        if (tx) {
          if (camTrack) {
            tx.direction = 'sendrecv';
            tx.sender.replaceTrack(camTrack).catch(() => {});
          } else {
            tx.sender.replaceTrack(null).catch(() => {});
            tx.direction = 'recvonly';
          }
        }
      }
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });

        screenStreamRef.current = displayStream;
        setScreenStream(displayStream);
        setIsScreenSharing(true);

        // Broadcast screen share started to room peers
        for (const targetId of peerConnectionsRef.current.keys()) {
          sendMessage({
            type: 'webrtc:signal',
            targetClientId: targetId,
            roomId: currentRoomIdRef.current,
            signal: {
              type: 'screenshare',
              data: { isSharing: true },
            },
          });
        }

        const screenVideoTrack = displayStream.getVideoTracks()[0];

        // Replace video track in all active peer connections
        if (screenVideoTrack) {
          for (const pc of peerConnectionsRef.current.values()) {
            const tx = pc.getTransceivers().find((t) => t.receiver.track.kind === 'video');
            if (tx) {
              tx.direction = 'sendrecv';
              tx.sender.replaceTrack(screenVideoTrack).catch(() => {});
            } else {
              try { pc.addTrack(screenVideoTrack, displayStream); } catch {}
            }
          }

          // When user clicks native browser "Stop sharing" button
          screenVideoTrack.onended = () => {
            screenStreamRef.current = null;
            setIsScreenSharing(false);

            // Broadcast screen share stopped when stopped natively
            for (const targetId of peerConnectionsRef.current.keys()) {
              sendMessage({
                type: 'webrtc:signal',
                targetClientId: targetId,
                roomId: currentRoomIdRef.current,
                signal: {
                  type: 'screenshare',
                  data: { isSharing: false },
                },
              });
            }

            const camTrack = originalCamTrackRef.current;
            for (const pc of peerConnectionsRef.current.values()) {
              const tx = pc.getTransceivers().find((t) => t.receiver.track.kind === 'video');
              if (tx) {
                if (camTrack) {
                  tx.direction = 'sendrecv';
                  tx.sender.replaceTrack(camTrack).catch(() => {});
                } else {
                  tx.sender.replaceTrack(null).catch(() => {});
                  tx.direction = 'recvonly';
                }
              }
            }
          };
        }
      } catch (err) {
        console.warn('Screen share cancelled or failed:', err);
      }
    }
  }, [isScreenSharing]);

  // Handle room transitions (e.g. entering or leaving a breakout room)
  useEffect(() => {
    if (!isCallActive) return;

    // Room changed: close peers and re-announce in new room
    for (const pc of peerConnectionsRef.current.values()) {
      pc.close();
    }
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();
    for (const item of remoteAnalysersRef.current.values()) {
      window.clearInterval(item.intervalId);
    }
    remoteAnalysersRef.current.clear();
    setRemotePeers(new Map());

    // Announce presence in new room
    sendMessage({
      type: 'webrtc:join',
      roomId: currentRoomId,
    });
  }, [currentRoomId, sendMessage]);

  // Teardown when component unmounts
  useEffect(() => {
    return () => {
      if (isCallActiveRef.current) {
        leaveCall();
      }
    };
  }, [leaveCall]);

  // Total active participants in this call (including local user)
  const participantCount = isCallActive ? 1 + remotePeers.size : 0;

  return {
    isCallActive,
    isConnecting,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isLocalSpeaking,
    localStream,
    screenStream,
    remotePeers,
    mediaNotice,
    audioDevices,
    videoDevices,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    switchAudioDevice,
    switchVideoDevice,
    localVideoEffect,
    setVideoEffect,
    startCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    dismissNotice,
    handleServerMessage,
    participantCount,
  };
}
