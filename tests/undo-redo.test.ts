import { describe, it, expect } from 'vitest';
import type { StickyNote } from '../src/shared/eventstorming';

interface CanvasSnapshot {
  stickies: StickyNote[];
}

function createUndoRedoStack(initial: CanvasSnapshot) {
  let past: CanvasSnapshot[] = [];
  let present: CanvasSnapshot = initial;
  let future: CanvasSnapshot[] = [];

  return {
    get present() {
      return present;
    },
    push(snapshot: CanvasSnapshot) {
      past = [...past.slice(-30), present];
      present = snapshot;
      future = [];
    },
    undo(): CanvasSnapshot | null {
      if (past.length === 0) return null;
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      future = [present, ...future];
      past = newPast;
      present = previous;
      return present;
    },
    redo(): CanvasSnapshot | null {
      if (future.length === 0) return null;
      const next = future[0];
      const newFuture = future.slice(1);
      past = [...past, present];
      future = newFuture;
      present = next;
      return present;
    },
  };
}

describe('Undo / Redo History Stack Mechanics', () => {
  it('supports standard undo and redo flows', () => {
    const s1: StickyNote = {
      id: '1',
      type: 'domain-event',
      text: 'Order Placed',
      x: 100,
      y: 100,
      votes: 0,
      updatedAt: 1000,
    };
    const s2: StickyNote = {
      id: '2',
      type: 'domain-event',
      text: 'Payment Authorized',
      x: 300,
      y: 100,
      votes: 0,
      updatedAt: 2000,
    };

    const stack = createUndoRedoStack({ stickies: [s1] });
    expect(stack.present.stickies).toHaveLength(1);

    // Push new state with s1 + s2
    stack.push({ stickies: [s1, s2] });
    expect(stack.present.stickies).toHaveLength(2);

    // Undo returns to initial
    const undone = stack.undo();
    expect(undone?.stickies).toHaveLength(1);
    expect(undone?.stickies[0].id).toBe('1');

    // Further undo returns null (at bottom of stack)
    expect(stack.undo()).toBeNull();

    // Redo restores state
    const redone = stack.redo();
    expect(redone?.stickies).toHaveLength(2);

    // Further redo returns null (at top of stack)
    expect(stack.redo()).toBeNull();
  });

  it('clears future stack when new action is pushed after undo', () => {
    const stack = createUndoRedoStack({ stickies: [] });
    stack.push({
      stickies: [
        {
          id: '1',
          type: 'hotspot',
          text: 'Risk 1',
          x: 0,
          y: 0,
          votes: 0,
          updatedAt: 1,
        },
      ],
    });
    stack.push({
      stickies: [
        {
          id: '2',
          type: 'hotspot',
          text: 'Risk 2',
          x: 0,
          y: 0,
          votes: 0,
          updatedAt: 2,
        },
      ],
    });

    stack.undo(); // back to Risk 1
    // New action should discard Risk 2 in future
    stack.push({
      stickies: [
        {
          id: '3',
          type: 'hotspot',
          text: 'Risk 3',
          x: 0,
          y: 0,
          votes: 0,
          updatedAt: 3,
        },
      ],
    });

    expect(stack.redo()).toBeNull();
  });
});
