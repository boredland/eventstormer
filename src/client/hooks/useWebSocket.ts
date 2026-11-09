import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  ClientMessage,
  ServerMessage,
  WorkspaceState,
  PeerCursor,
  StickyNote,
  PivotalLine,
  Swimlane,
} from '../../shared/eventstorming';
import type { UserProfile } from '../types';

interface UseWebSocketOptions {
  workspaceId: string;
  user: UserProfile;
  turnstileToken?: string;
  onStateUpdate?: (updater: (prev: WorkspaceState) => WorkspaceState) => void;
  onServerMessage?: (msg: ServerMessage) => void;
}

export function useWebSocket({
  workspaceId,
  user,
  turnstileToken,
  onStateUpdate,
  onServerMessage,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState<Map<string, PeerCursor>>(new Map());
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const lastCursorSendRef = useRef<number>(0);
  const onServerMessageRef = useRef(onServerMessage);
  onServerMessageRef.current = onServerMessage;
  const sendMessage = useCallback((msg: ClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendCursor = useCallback((x: number, y: number) => {
    const now = Date.now();
    // Throttle cursor messages to 30fps (approx 33ms)
    if (now - lastCursorSendRef.current < 33) return;
    lastCursorSendRef.current = now;
    sendMessage({ type: 'cursor', clientId: user.clientId, x, y });
  }, [sendMessage, user.clientId]);

  useEffect(() => {
    let unmounted = false;

    function connect() {
      if (unmounted) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const tokenParam = turnstileToken ? `?turnstileToken=${encodeURIComponent(turnstileToken)}` : '';
      const wsUrl = `${protocol}//${host}/api/workspace/${workspaceId}/ws${tokenParam}`;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        setIsConnected(true);
        // Send join packet
        ws.send(
          JSON.stringify({
            type: 'join',
            clientId: user.clientId,
            name: user.name,
            color: user.color,
          } satisfies ClientMessage)
        );
      };

      ws.onmessage = (event) => {
        if (unmounted) return;
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          onServerMessageRef.current?.(msg);
          switch (msg.type) {
            case 'init': {
              if (onStateUpdate) {
                onStateUpdate(() => msg.state);
              }
              const peerMap = new Map<string, PeerCursor>();
              for (const p of msg.peers) {
                if (p.clientId !== user.clientId) {
                  peerMap.set(p.clientId, p);
                }
              }
              setPeers(peerMap);
              break;
            }

            case 'peer:update': {
              if (msg.peer.clientId === user.clientId) return;
              setPeers((prev) => {
                const next = new Map(prev);
                next.set(msg.peer.clientId, msg.peer);
                return next;
              });
              break;
            }

            case 'peer:leave': {
              setPeers((prev) => {
                const next = new Map(prev);
                next.delete(msg.clientId);
                return next;
              });
              break;
            }

            case 'sticky:upsert': {
              if (onStateUpdate) {
                onStateUpdate((prev) => {
                  const idx = prev.stickies.findIndex((s) => s.id === msg.sticky.id);
                  let stickies: StickyNote[];
                  if (idx >= 0) {
                    stickies = [...prev.stickies];
                    stickies[idx] = msg.sticky;
                  } else {
                    stickies = [...prev.stickies, msg.sticky];
                  }
                  return { ...prev, stickies };
                });
              }
              break;
            }

            case 'sticky:batch-move': {
              if (onStateUpdate) {
                onStateUpdate((prev) => {
                  const updateMap = new Map(msg.updates.map((u) => [u.id, u]));
                  const stickies = prev.stickies.map((s) => {
                    const u = updateMap.get(s.id);
                    return u ? { ...s, x: u.x, y: u.y } : s;
                  });
                  return { ...prev, stickies };
                });
              }
              break;
            }

            case 'sticky:delete': {
              if (onStateUpdate) {
                onStateUpdate((prev) => ({
                  ...prev,
                  stickies: prev.stickies.filter((s) => s.id !== msg.id),
                }));
              }
              break;
            }

            case 'sticky:vote': {
              if (onStateUpdate) {
                onStateUpdate((prev) => ({
                  ...prev,
                  stickies: prev.stickies.map((s) =>
                    s.id === msg.id ? { ...s, votes: msg.votes } : s
                  ),
                }));
              }
              break;
            }

            case 'pivotal:upsert': {
              if (onStateUpdate) {
                onStateUpdate((prev) => {
                  const idx = prev.pivotalLines.findIndex((l) => l.id === msg.line.id);
                  let pivotalLines: PivotalLine[];
                  if (idx >= 0) {
                    pivotalLines = [...prev.pivotalLines];
                    pivotalLines[idx] = msg.line;
                  } else {
                    pivotalLines = [...prev.pivotalLines, msg.line];
                  }
                  return { ...prev, pivotalLines };
                });
              }
              break;
            }

            case 'pivotal:delete': {
              if (onStateUpdate) {
                onStateUpdate((prev) => ({
                  ...prev,
                  pivotalLines: prev.pivotalLines.filter((l) => l.id !== msg.id),
                }));
              }
              break;
            }

            case 'swimlane:upsert': {
              if (onStateUpdate) {
                onStateUpdate((prev) => {
                  const idx = prev.swimlanes.findIndex((l) => l.id === msg.lane.id);
                  let swimlanes: Swimlane[];
                  if (idx >= 0) {
                    swimlanes = [...prev.swimlanes];
                    swimlanes[idx] = msg.lane;
                  } else {
                    swimlanes = [...prev.swimlanes, msg.lane];
                  }
                  return { ...prev, swimlanes };
                });
              }
              break;
            }

            case 'swimlane:delete': {
              if (onStateUpdate) {
                onStateUpdate((prev) => ({
                  ...prev,
                  swimlanes: prev.swimlanes.filter((l) => l.id !== msg.id),
                }));
              }
              break;
            }

            case 'workspace:updated': {
              if (onStateUpdate) {
                onStateUpdate((prev) => ({
                  ...prev,
                  ...(msg.format ? { format: msg.format } : {}),
                  ...(msg.phaseIndex !== undefined ? { currentPhaseIndex: msg.phaseIndex } : {}),
                  ...(msg.timer
                    ? {
                        timerIsRunning: msg.timer.isRunning,
                        timerSecondsRemaining: msg.timer.secondsRemaining,
                        timerLastTickAt: Date.now(),
                      }
                    : {}),
                }));
              }
              break;
            }

            case 'workspace:reloaded': {
              if (onStateUpdate) {
                onStateUpdate(() => msg.state);
              }
              break;
            }

            case 'breakout:state': {
              if (onStateUpdate) {
                onStateUpdate((prev) => ({
                  ...prev,
                  breakoutSession: msg.session || undefined,
                }));
              }
              break;
            }
          }
        } catch (err) {
          console.error('Error handling websocket message:', err);
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setIsConnected(false);
        // Exponential reconnect attempt
        reconnectTimeoutRef.current = window.setTimeout(connect, 2000);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket connection warning:', err);
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [workspaceId, user.clientId, user.name, user.color, turnstileToken, onStateUpdate]);

  return {
    isConnected,
    peers: Array.from(peers.values()),
    sendMessage,
    sendCursor,
  };
}
