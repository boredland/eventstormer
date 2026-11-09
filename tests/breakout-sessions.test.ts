import { describe, it, expect } from 'vitest';
import type {
  BreakoutRoom,
  BreakoutSessionState,
  StickyNote,
  Swimlane,
  PeerCursor,
  WorkspaceState,
} from '../src/shared/eventstorming';

interface BreakoutSimulationState extends WorkspaceState {
  peers: PeerCursor[];
}

class BreakoutManager {
  public state: BreakoutSimulationState;

  constructor(workspaceId: string) {
    this.state = {
      id: workspaceId,
      name: 'Breakout Modeling Workshop',
      format: 'big-picture',
      currentPhaseIndex: 1, // Chaotic exploration
      timerSecondsRemaining: 900,
      timerIsRunning: false,
      timerLastTickAt: 0,
      stickies: [],
      pivotalLines: [],
      swimlanes: [],
      peers: [],
    };
  }

  startBreakout(rooms: BreakoutRoom[], durationMinutes: number) {
    const session: BreakoutSessionState = {
      active: true,
      rooms,
      startedAt: Date.now(),
      durationMinutes,
    };
    this.state.breakoutSession = session;
  }

  joinRoom(clientId: string, roomId: string | null) {
    const peer = this.state.peers.find((p) => p.clientId === clientId);
    if (peer) {
      peer.breakoutRoomId = roomId || undefined;
    }
  }

  addSticky(
    type: 'domain-event' | 'command' | 'hotspot' | 'policy',
    text: string,
    x: number,
    y: number,
    breakoutRoomId?: string,
    author = 'Participant'
  ): StickyNote {
    const s: StickyNote = {
      id: `s-${Math.random().toString(36).substring(2, 7)}`,
      type,
      text,
      x,
      y,
      votes: 0,
      authorName: author,
      breakoutRoomId,
      updatedAt: Date.now(),
    };
    this.state.stickies.push(s);
    return s;
  }

  getVisibleStickiesForRoom(roomId: string | null): StickyNote[] {
    if (roomId) {
      return this.state.stickies.filter((s) => s.breakoutRoomId === roomId);
    }
    return this.state.stickies;
  }

  getVisiblePeersForRoom(roomId: string | null): PeerCursor[] {
    if (roomId) {
      return this.state.peers.filter((p) => p.breakoutRoomId === roomId);
    }
    return this.state.peers;
  }

  endBreakout(mergeToSwimlanes: boolean) {
    if (!this.state.breakoutSession?.active) return;

    if (mergeToSwimlanes) {
      // Find all distinct breakout room IDs among stickies
      const distinctRoomIds = Array.from(
        new Set(
          this.state.stickies
            .map((s) => s.breakoutRoomId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
        )
      );

      let currentY = 100;
      if (this.state.swimlanes.length > 0) {
        const maxY = Math.max(...this.state.swimlanes.map((l) => l.y + l.height));
        currentY = maxY + 60;
      }

      for (const roomId of distinctRoomIds) {
        const roomMeta = this.state.breakoutSession.rooms.find((r) => r.id === roomId);
        const laneName = roomMeta ? `Sub-Group: ${roomMeta.name}` : `Sub-Group: ${roomId}`;
        const laneHeight = 280;

        const lane: Swimlane = {
          id: `lane-${roomId}-${Date.now()}`,
          name: laneName,
          y: currentY,
          height: laneHeight,
          color: roomMeta?.color || '#818cf8',
        };
        this.state.swimlanes.push(lane);

        // Reposition stickies into their dedicated swimlane and clear breakoutRoomId
        const roomStickies = this.state.stickies.filter((s) => s.breakoutRoomId === roomId);
        for (const s of roomStickies) {
          s.y = currentY + 50;
          s.breakoutRoomId = undefined;
          s.updatedAt = Date.now();
        }

        currentY += laneHeight + 40;
      }
    } else {
      for (const s of this.state.stickies) {
        s.breakoutRoomId = undefined;
      }
    }

    // Reset all peers back to main room
    for (const p of this.state.peers) {
      p.breakoutRoomId = undefined;
    }

    this.state.breakoutSession = undefined;
  }
}

describe('Breakout Sessions & Sub-Group Facilitation Specification', () => {
  it('manages breakout session lifecycle: launching rooms and isolating work', () => {
    const mgr = new BreakoutManager('ws-breakout-1');

    // Register peers
    mgr.state.peers = [
      { clientId: 'alice', name: 'Alice (Facilitator)', color: '#0ea5e9', x: 0, y: 0, lastActive: Date.now() },
      { clientId: 'bob', name: 'Bob (Order SME)', color: '#f97316', x: 0, y: 0, lastActive: Date.now() },
      { clientId: 'carol', name: 'Carol (Payment SME)', color: '#10b981', x: 0, y: 0, lastActive: Date.now() },
      { clientId: 'dave', name: 'Dave (Warehouse SME)', color: '#a855f7', x: 0, y: 0, lastActive: Date.now() },
    ];

    const rooms: BreakoutRoom[] = [
      { id: 'room-ordering', name: 'Ordering & Checkout', color: '#38bdf8' },
      { id: 'room-fulfillment', name: 'Warehouse & Fulfillment', color: '#f59e0b' },
    ];

    // Launch breakout
    mgr.startBreakout(rooms, 15);
    expect(mgr.state.breakoutSession?.active).toBe(true);
    expect(mgr.state.breakoutSession?.rooms).toHaveLength(2);
    expect(mgr.state.breakoutSession?.durationMinutes).toBe(15);

    // Alice stays in main room, Bob joins Ordering, Dave joins Fulfillment
    mgr.joinRoom('bob', 'room-ordering');
    mgr.joinRoom('dave', 'room-fulfillment');

    expect(mgr.getVisiblePeersForRoom('room-ordering')).toHaveLength(1);
    expect(mgr.getVisiblePeersForRoom('room-ordering')[0].clientId).toBe('bob');
    expect(mgr.getVisiblePeersForRoom('room-fulfillment')).toHaveLength(1);
    expect(mgr.getVisiblePeersForRoom('room-fulfillment')[0].clientId).toBe('dave');

    // Bob creates stickies in Ordering sub-group
    const sOrder1 = mgr.addSticky('domain-event', 'Item Added to Cart', 200, 200, 'room-ordering', 'Bob');
    const sOrder2 = mgr.addSticky('domain-event', 'Order Checkout Initiated', 400, 200, 'room-ordering', 'Bob');

    // Dave creates stickies in Fulfillment sub-group
    const sFulfill1 = mgr.addSticky('domain-event', 'Picking Slip Printed', 250, 200, 'room-fulfillment', 'Dave');
    const sFulfill2 = mgr.addSticky('hotspot', 'Forklift bottleneck delays packing', 450, 200, 'room-fulfillment', 'Dave');

    // Verify isolation
    const orderingStickies = mgr.getVisibleStickiesForRoom('room-ordering');
    expect(orderingStickies).toHaveLength(2);
    expect(orderingStickies.map((s) => s.text)).toContain('Item Added to Cart');
    expect(orderingStickies.map((s) => s.text)).not.toContain('Picking Slip Printed');

    const fulfillmentStickies = mgr.getVisibleStickiesForRoom('room-fulfillment');
    expect(fulfillmentStickies).toHaveLength(2);
    expect(fulfillmentStickies.map((s) => s.text)).toContain('Picking Slip Printed');
    expect(fulfillmentStickies.map((s) => s.text)).not.toContain('Item Added to Cart');
  });

  it('merges sub-group stickies into dedicated horizontal swimlanes upon session completion', () => {
    const mgr = new BreakoutManager('ws-breakout-merge');

    mgr.startBreakout(
      [
        { id: 'room-ordering', name: 'Ordering & Checkout', color: '#38bdf8' },
        { id: 'room-fulfillment', name: 'Warehouse & Fulfillment', color: '#10b981' },
      ],
      10
    );

    // Add stickies in each sub-group
    mgr.addSticky('domain-event', 'Order Placed', 300, 100, 'room-ordering', 'Order Sub-Group');
    mgr.addSticky('command', 'Submit Order', 100, 100, 'room-ordering', 'Order Sub-Group');

    mgr.addSticky('domain-event', 'Goods Dispatched', 600, 100, 'room-fulfillment', 'Fulfillment Sub-Group');
    mgr.addSticky('hotspot', 'Courier API latency', 800, 100, 'room-fulfillment', 'Fulfillment Sub-Group');

    expect(mgr.state.swimlanes).toHaveLength(0);

    // End breakout and merge to swimlanes
    mgr.endBreakout(true);

    // Verify breakout session is terminated
    expect(mgr.state.breakoutSession).toBeUndefined();

    // Verify 2 swimlanes created (one for each sub-group topic)
    expect(mgr.state.swimlanes).toHaveLength(2);
    expect(mgr.state.swimlanes[0].name).toContain('Ordering & Checkout');
    expect(mgr.state.swimlanes[1].name).toContain('Warehouse & Fulfillment');

    // Verify stickies are now on the main board (breakoutRoomId cleared)
    expect(mgr.state.stickies.every((s) => s.breakoutRoomId === undefined)).toBe(true);

    // Verify ordering stickies were positioned in the first swimlane
    const orderStickies = mgr.state.stickies.filter((s) => s.authorName === 'Order Sub-Group');
    expect(orderStickies.every((s) => s.y === mgr.state.swimlanes[0].y + 50)).toBe(true);

    // Verify fulfillment stickies were positioned in the second swimlane
    const fulfillmentStickies = mgr.state.stickies.filter((s) => s.authorName === 'Fulfillment Sub-Group');
    expect(fulfillmentStickies.every((s) => s.y === mgr.state.swimlanes[1].y + 50)).toBe(true);
  });

  it('allows ending breakout without creating swimlanes when mergeToSwimlanes is false', () => {
    const mgr = new BreakoutManager('ws-breakout-no-swimlane');

    mgr.startBreakout([{ id: 'room-1', name: 'Sub-Group 1' }], 10);
    mgr.addSticky('domain-event', 'Simple Event', 200, 200, 'room-1');

    mgr.endBreakout(false);

    expect(mgr.state.breakoutSession).toBeUndefined();
    expect(mgr.state.swimlanes).toHaveLength(0);
    expect(mgr.state.stickies[0].breakoutRoomId).toBeUndefined();
  });
});
