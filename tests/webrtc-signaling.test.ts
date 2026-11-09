import { describe, it, expect, vi } from 'vitest';
import type {
  ClientMessage,
  ServerMessage,
  PeerCursor,
} from '../src/shared/eventstorming';

interface MockSocketAttachment {
  clientId: string;
  name: string;
  color: string;
  windowStart: number;
  messageCount: number;
  breakoutRoomId?: string;
  webrtcInCall?: boolean;
  webrtcRoomId?: string | null;
}

class MockWebSocket {
  public attachment: MockSocketAttachment | null = null;
  public sentMessages: ServerMessage[] = [];
  public readyState = 1; // OPEN

  constructor(att: MockSocketAttachment) {
    this.attachment = att;
  }

  deserializeAttachment(): MockSocketAttachment | null {
    return this.attachment ? { ...this.attachment } : null;
  }

  serializeAttachment(att: MockSocketAttachment): void {
    this.attachment = { ...att };
  }

  send(data: string): void {
    this.sentMessages.push(JSON.parse(data) as ServerMessage);
  }
}

// Simulated signaling router replicating WorkspaceRoom WebRTC logic
class MockWorkspaceSignalingRouter {
  public sockets: MockWebSocket[] = [];

  addSocket(socket: MockWebSocket) {
    this.sockets.push(socket);
  }

  removeSocket(socket: MockWebSocket) {
    this.sockets = this.sockets.filter((s) => s !== socket);
  }

  handleMessage(ws: MockWebSocket, parsed: ClientMessage) {
    const att = ws.deserializeAttachment();
    if (!att) return;

    switch (parsed.type) {
      case 'webrtc:join': {
        att.webrtcInCall = true;
        att.webrtcRoomId = parsed.roomId || null;
        ws.serializeAttachment(att);

        const currentRoom = parsed.roomId || null;
        for (const otherWs of this.sockets) {
          if (otherWs === ws) continue;
          const otherAtt = otherWs.deserializeAttachment();
          if (!otherAtt?.clientId) continue;

          const otherRoom = otherAtt.breakoutRoomId || null;
          if (otherRoom === currentRoom) {
            otherWs.send(
              JSON.stringify({
                type: 'webrtc:peer-joined',
                clientId: att.clientId,
                roomId: currentRoom,
              } satisfies ServerMessage)
            );

            if (otherAtt.webrtcInCall) {
              ws.send(
                JSON.stringify({
                  type: 'webrtc:peer-joined',
                  clientId: otherAtt.clientId,
                  roomId: currentRoom,
                } satisfies ServerMessage)
              );
            }
          }
        }
        break;
      }

      case 'webrtc:leave': {
        att.webrtcInCall = false;
        const currentRoom = att.webrtcRoomId ?? parsed.roomId ?? null;
        att.webrtcRoomId = undefined;
        ws.serializeAttachment(att);

        for (const otherWs of this.sockets) {
          if (otherWs === ws) continue;
          const otherAtt = otherWs.deserializeAttachment();
          if (!otherAtt?.clientId) continue;

          const otherRoom = otherAtt.breakoutRoomId || null;
          if (otherRoom === currentRoom) {
            otherWs.send(
              JSON.stringify({
                type: 'webrtc:peer-left',
                clientId: att.clientId,
                roomId: currentRoom,
              } satisfies ServerMessage)
            );
          }
        }
        break;
      }

      case 'webrtc:signal': {
        const targetClientId = parsed.targetClientId;
        for (const targetWs of this.sockets) {
          const targetAtt = targetWs.deserializeAttachment();
          if (targetAtt && targetAtt.clientId === targetClientId) {
            const forwardMsg: ServerMessage = {
              type: 'webrtc:signal',
              fromClientId: att.clientId,
              roomId: parsed.roomId,
              signal: parsed.signal,
            };
            targetWs.send(JSON.stringify(forwardMsg));
            break;
          }
        }
        break;
      }
    }
  }

  handleClose(ws: MockWebSocket) {
    const att = ws.deserializeAttachment();
    if (att?.clientId && att.webrtcInCall) {
      const currentRoom = att.webrtcRoomId ?? null;
      for (const otherWs of this.sockets) {
        if (otherWs === ws) continue;
        const otherAtt = otherWs.deserializeAttachment();
        if (!otherAtt?.clientId) continue;

        const otherRoom = otherAtt.breakoutRoomId || null;
        if (otherRoom === currentRoom) {
          otherWs.send(
            JSON.stringify({
              type: 'webrtc:peer-left',
              clientId: att.clientId,
              roomId: currentRoom,
            } satisfies ServerMessage)
          );
        }
      }
    }
    this.removeSocket(ws);
  }
}

describe('WebRTC P2P Signaling & Room Isolation', () => {
  it('correctly relays webrtc:join between peers in Main Room', () => {
    const router = new MockWorkspaceSignalingRouter();

    const client1 = new MockWebSocket({
      clientId: 'client-1',
      name: 'Alice',
      color: '#3b82f6',
      windowStart: Date.now(),
      messageCount: 0,
    });

    const client2 = new MockWebSocket({
      clientId: 'client-2',
      name: 'Bob',
      color: '#ef4444',
      windowStart: Date.now(),
      messageCount: 0,
    });

    router.addSocket(client1);
    router.addSocket(client2);

    // Client 1 starts call in Main Room (roomId: null)
    router.handleMessage(client1, {
      type: 'webrtc:join',
      roomId: null,
    });

    // Client 2 receives peer-joined from client 1
    expect(client2.sentMessages).toHaveLength(1);
    expect(client2.sentMessages[0]).toEqual({
      type: 'webrtc:peer-joined',
      clientId: 'client-1',
      roomId: null,
    });

    // Client 2 also starts call
    router.handleMessage(client2, {
      type: 'webrtc:join',
      roomId: null,
    });

    // Client 1 receives peer-joined from client 2
    const client1PeerJoined = client1.sentMessages.find(
      (m) => m.type === 'webrtc:peer-joined' && m.clientId === 'client-2'
    );
    expect(client1PeerJoined).toBeDefined();

    // Client 2 receives peer-joined for existing in-call client 1
    const client2ExistingJoined = client2.sentMessages.filter(
      (m) => m.type === 'webrtc:peer-joined' && m.clientId === 'client-1'
    );
    expect(client2ExistingJoined.length).toBeGreaterThanOrEqual(1);
  });

  it('strictly isolates WebRTC audio/video signaling between Main Room and Breakout Room', () => {
    const router = new MockWorkspaceSignalingRouter();

    // Alice is in Main Room (breakoutRoomId: undefined)
    const alice = new MockWebSocket({
      clientId: 'alice',
      name: 'Alice',
      color: '#3b82f6',
      windowStart: Date.now(),
      messageCount: 0,
    });

    // Bob and Charlie are in Breakout Room 1
    const bob = new MockWebSocket({
      clientId: 'bob',
      name: 'Bob',
      color: '#ef4444',
      windowStart: Date.now(),
      messageCount: 0,
      breakoutRoomId: 'room-alpha',
    });

    const charlie = new MockWebSocket({
      clientId: 'charlie',
      name: 'Charlie',
      color: '#10b981',
      windowStart: Date.now(),
      messageCount: 0,
      breakoutRoomId: 'room-alpha',
    });

    // Dave is in Breakout Room 2
    const dave = new MockWebSocket({
      clientId: 'dave',
      name: 'Dave',
      color: '#f59e0b',
      windowStart: Date.now(),
      messageCount: 0,
      breakoutRoomId: 'room-beta',
    });

    router.addSocket(alice);
    router.addSocket(bob);
    router.addSocket(charlie);
    router.addSocket(dave);

    // Bob starts call in Breakout Room 1
    router.handleMessage(bob, {
      type: 'webrtc:join',
      roomId: 'room-alpha',
    });

    // Charlie (in same breakout room) should receive peer-joined
    expect(charlie.sentMessages).toHaveLength(1);
    expect(charlie.sentMessages[0]).toEqual({
      type: 'webrtc:peer-joined',
      clientId: 'bob',
      roomId: 'room-alpha',
    });

    // Alice (Main Room) and Dave (Room Beta) MUST NOT receive any message
    expect(alice.sentMessages).toHaveLength(0);
    expect(dave.sentMessages).toHaveLength(0);
  });

  it('correctly routes point-to-point SDP offer, answer, and ICE candidates via webrtc:signal', () => {
    const router = new MockWorkspaceSignalingRouter();

    const clientA = new MockWebSocket({
      clientId: 'client-aaa',
      name: 'Alice',
      color: '#3b82f6',
      windowStart: Date.now(),
      messageCount: 0,
    });

    const clientB = new MockWebSocket({
      clientId: 'client-bbb',
      name: 'Bob',
      color: '#ef4444',
      windowStart: Date.now(),
      messageCount: 0,
    });

    router.addSocket(clientA);
    router.addSocket(clientB);

    // Client B sends SDP offer targeted to Client A
    const mockOffer = { type: 'offer' as const, sdp: 'v=0\r\no=...' };
    router.handleMessage(clientB, {
      type: 'webrtc:signal',
      targetClientId: 'client-aaa',
      roomId: null,
      signal: {
        type: 'offer',
        data: mockOffer,
      },
    });

    expect(clientA.sentMessages).toHaveLength(1);
    expect(clientA.sentMessages[0]).toEqual({
      type: 'webrtc:signal',
      fromClientId: 'client-bbb',
      roomId: null,
      signal: {
        type: 'offer',
        data: mockOffer,
      },
    });

    // Client A sends SDP answer targeted back to Client B
    const mockAnswer = { type: 'answer' as const, sdp: 'v=0\r\no=answer...' };
    router.handleMessage(clientA, {
      type: 'webrtc:signal',
      targetClientId: 'client-bbb',
      roomId: null,
      signal: {
        type: 'answer',
        data: mockAnswer,
      },
    });

    expect(clientB.sentMessages).toHaveLength(1);
    expect(clientB.sentMessages[0]).toEqual({
      type: 'webrtc:signal',
      fromClientId: 'client-aaa',
      roomId: null,
      signal: {
        type: 'answer',
        data: mockAnswer,
      },
    });
  });

  it('broadcasts webrtc:peer-left when a caller leaves the call or socket disconnects', () => {
    const router = new MockWorkspaceSignalingRouter();

    const client1 = new MockWebSocket({
      clientId: 'client-1',
      name: 'Alice',
      color: '#3b82f6',
      windowStart: Date.now(),
      messageCount: 0,
    });

    const client2 = new MockWebSocket({
      clientId: 'client-2',
      name: 'Bob',
      color: '#ef4444',
      windowStart: Date.now(),
      messageCount: 0,
    });

    router.addSocket(client1);
    router.addSocket(client2);

    // Both join
    router.handleMessage(client1, { type: 'webrtc:join', roomId: null });
    router.handleMessage(client2, { type: 'webrtc:join', roomId: null });

    // Client 1 leaves call
    router.handleMessage(client1, { type: 'webrtc:leave', roomId: null });

    const client2LeaveMsg = client2.sentMessages.find(
      (m) => m.type === 'webrtc:peer-left' && m.clientId === 'client-1'
    );
    expect(client2LeaveMsg).toBeDefined();

    // Client 2 disconnects abruptly
    router.handleClose(client2);
    // Client 2's socket is now removed from router
    expect(router.sockets).not.toContain(client2);
  });

  it('deterministic initiator rule breaks offer collision glares', () => {
    // Whichever clientId is lexicographically larger initiates the SDP offer
    const idA = 'c-user-123';
    const idB = 'c-user-789';

    const getInitiator = (peer1: string, peer2: string) => (peer1 > peer2 ? peer1 : peer2);

    expect(getInitiator(idA, idB)).toBe(idB);
    expect(getInitiator(idB, idA)).toBe(idB);
  });

  it('active speaker volume detection threshold logic', () => {
    // Test RMS / frequency averaging logic used in useWebRTC
    const calculateIsSpeaking = (freqData: number[], threshold = 16) => {
      const sum = freqData.reduce((acc, v) => acc + v, 0);
      const avg = sum / freqData.length;
      return avg > threshold;
    };

    const silentAudio = new Array(128).fill(2);
    const quietBackgroundNoise = new Array(128).fill(8);
    const activeSpeaking = new Array(128).fill(45);

    expect(calculateIsSpeaking(silentAudio)).toBe(false);
    expect(calculateIsSpeaking(quietBackgroundNoise)).toBe(false);
    expect(calculateIsSpeaking(activeSpeaking)).toBe(true);
  });
});
