import { useState, useCallback, useRef } from 'react';
import type { StickyNote, PivotalLine, Swimlane } from '../../shared/eventstorming';

interface HistorySnapshot {
  stickies: StickyNote[];
  pivotalLines: PivotalLine[];
  swimlanes: Swimlane[];
}

export function useUndoRedo(initialState: HistorySnapshot) {
  const [past, setPast] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);
  const presentRef = useRef<HistorySnapshot>(initialState);

  const setPresent = useCallback((newPresent: HistorySnapshot) => {
    presentRef.current = newPresent;
  }, []);

  const pushSnapshot = useCallback((snapshot: HistorySnapshot) => {
    setPast((prev) => {
      const next = [...prev, presentRef.current];
      if (next.length > 30) next.shift();
      return next;
    });
    presentRef.current = snapshot;
    setFuture([]);
  }, []);

  const undo = useCallback((applyFn: (snapshot: HistorySnapshot) => void) => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      const newPast = prevPast.slice(0, prevPast.length - 1);

      setFuture((prevFuture) => [presentRef.current, ...prevFuture]);
      presentRef.current = previous;
      applyFn(previous);

      return newPast;
    });
  }, []);

  const redo = useCallback((applyFn: (snapshot: HistorySnapshot) => void) => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[0];
      const newFuture = prevFuture.slice(1);

      setPast((prevPast) => [...prevPast, presentRef.current]);
      presentRef.current = next;
      applyFn(next);

      return newFuture;
    });
  }, []);

  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    pushSnapshot,
    setPresent,
    undo,
    redo,
  };
}
