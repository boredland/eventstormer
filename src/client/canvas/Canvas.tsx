import React, { useRef, useState, useEffect, useCallback } from 'react';
import type {
  StickyNote,
  PivotalLine,
  Swimlane,
  StickyType,
  PeerCursor,
} from '../../shared/eventstorming';
import { STICKY_DEFINITIONS } from '../../shared/eventstorming';
import type { Viewport, DragState, MarqueeSelect, ActiveTool, UserProfile } from '../types';
import { StickyItem } from './StickyItem';
import { PivotalLineItem } from './PivotalLineItem';
import { SwimlaneItem } from './SwimlaneItem';
import { PeerCursorLayer } from './PeerCursorLayer';
import { Minimap } from './Minimap';
import { ZoomIn, ZoomOut, Maximize2, Move } from 'lucide-react';

interface CanvasProps {
  stickies: StickyNote[];
  pivotalLines: PivotalLine[];
  swimlanes: Swimlane[];
  peers: PeerCursor[];
  user: UserProfile;
  activeTool: ActiveTool;
  isVotingMode: boolean;
  onUpdateStickies: (stickies: StickyNote[]) => void;
  onUpdatePivotalLines: (lines: PivotalLine[]) => void;
  onUpdateSwimlanes: (lanes: Swimlane[]) => void;
  onBatchMoveStickies: (updates: Array<{ id: string; x: number; y: number }>) => void;
  onUpsertSticky: (sticky: StickyNote) => void;
  onDeleteSticky: (id: string) => void;
  onVoteSticky: (id: string, delta: number) => void;
  onUpsertPivotalLine: (line: PivotalLine) => void;
  onDeletePivotalLine: (id: string) => void;
  onUpsertSwimlane: (lane: Swimlane) => void;
  onDeleteSwimlane: (id: string) => void;
  onCursorMove: (x: number, y: number) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  stickies,
  pivotalLines,
  swimlanes,
  peers,
  user,
  activeTool,
  isVotingMode,
  onBatchMoveStickies,
  onUpsertSticky,
  onDeleteSticky,
  onVoteSticky,
  onUpsertPivotalLine,
  onDeletePivotalLine,
  onUpsertSwimlane,
  onDeleteSwimlane,
  onCursorMove,
  onUndo,
  onRedo,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [viewport, setViewport] = useState<Viewport>({ x: 100, y: 100, zoom: 0.85 });
  const [selectedStickyIds, setSelectedStickyIds] = useState<Set<string>>(new Set());
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeSelect | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  // Update container dimensions
  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Screen to World coords
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const localX = screenX - rect.left;
      const localY = screenY - rect.top;
      return {
        x: localX / viewport.zoom - viewport.x,
        y: localY / viewport.zoom - viewport.y,
      };
    },
    [viewport]
  );

  // Zoom at specific screen point
  const zoomAtPoint = useCallback(
    (screenX: number, screenY: number, newZoom: number) => {
      const clampedZoom = Math.min(3.0, Math.max(0.15, newZoom));
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const localX = screenX - rect.left;
      const localY = screenY - rect.top;

      // Current world point before zoom
      const worldX = localX / viewport.zoom - viewport.x;
      const worldY = localY / viewport.zoom - viewport.y;

      // Adjust viewport.x/y so world point remains at same screen position
      const newVx = localX / clampedZoom - worldX;
      const newVy = localY / clampedZoom - worldY;

      setViewport({ x: newVx, y: newVy, zoom: clampedZoom });
    },
    [viewport]
  );

  // Wheel zoom and pan
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Pinch zoom or Ctrl+Wheel
        const zoomDelta = -e.deltaY * 0.005;
        zoomAtPoint(e.clientX, e.clientY, viewport.zoom * (1 + zoomDelta));
      } else {
        // Trackpad 2-finger pan or regular wheel
        setViewport((prev) => ({
          ...prev,
          x: prev.x - e.deltaX / prev.zoom,
          y: prev.y - e.deltaY / prev.zoom,
        }));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [viewport, zoomAtPoint]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }

      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          onRedo();
        } else {
          e.preventDefault();
          onUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        onRedo();
      }

      // Duplicate (Ctrl/Cmd + D)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
      }

      // Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedStickyIds.size > 0) {
          e.preventDefault();
          for (const id of selectedStickyIds) {
            onDeleteSticky(id);
          }
          setSelectedStickyIds(new Set());
        } else if (selectedLineId) {
          e.preventDefault();
          onDeletePivotalLine(selectedLineId);
          setSelectedLineId(null);
        } else if (selectedLaneId) {
          e.preventDefault();
          onDeleteSwimlane(selectedLaneId);
          setSelectedLaneId(null);
        }
      }

      // Esc: deselect
      if (e.key === 'Escape') {
        setSelectedStickyIds(new Set());
        setSelectedLineId(null);
        setSelectedLaneId(null);
      }

      // 1..9 Quick spawn Brandolini sticky under mouse
      const numberKey = parseInt(e.key, 10);
      if (numberKey >= 1 && numberKey <= 9) {
        const types: StickyType[] = [
          'domain-event',
          'hotspot',
          'actor',
          'system',
          'opportunity',
          'command',
          'policy',
          'readmodel',
          'constraint',
        ];
        const chosenType = types[numberKey - 1];
        if (chosenType && containerRef.current) {
          const world = screenToWorld(dimensions.width / 2, dimensions.height / 2);
          createStickyAt(chosenType, world.x, world.y);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    dimensions,
    selectedStickyIds,
    selectedLineId,
    selectedLaneId,
    onDeleteSticky,
    onDeletePivotalLine,
    onDeleteSwimlane,
    onUndo,
    onRedo,
    screenToWorld,
  ]);

  const createStickyAt = (type: StickyType, x: number, y: number, text = '') => {
    const newSticky: StickyNote = {
      id: crypto.randomUUID(),
      type,
      text,
      x: Math.round(x),
      y: Math.round(y),
      votes: 0,
      authorName: user.name,
      authorColor: user.color,
      updatedAt: Date.now(),
    };
    onUpsertSticky(newSticky);
    setSelectedStickyIds(new Set([newSticky.id]));
  };

  const duplicateSelected = () => {
    if (selectedStickyIds.size === 0) return;
    const newSelected = new Set<string>();
    for (const id of selectedStickyIds) {
      const orig = stickies.find((s) => s.id === id);
      if (orig) {
        const dup: StickyNote = {
          ...orig,
          id: crypto.randomUUID(),
          x: orig.x + 30,
          y: orig.y + 30,
          votes: 0,
          authorName: user.name,
          authorColor: user.color,
          updatedAt: Date.now(),
        };
        onUpsertSticky(dup);
        newSelected.add(dup.id);
      }
    }
    setSelectedStickyIds(newSelected);
  };

  // Mouse Down handler on Canvas container
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || isSpacePressed || activeTool === 'pan') {
      // Middle click or Space/Pan drag
      e.preventDefault();
      setDragState({
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      });
      return;
    }

    if (e.button !== 0) return;

    // Check if clicked directly on background
    const target = e.target as HTMLElement;
    const stickyEl = target.closest('[data-sticky-id]');
    const pivotalEl = target.closest('[data-pivotal-id]');
    const swimlaneEl = target.closest('[data-swimlane-id]');

    if (!stickyEl && !pivotalEl && !swimlaneEl) {
      // Clicked on empty canvas background
      if (
        activeTool !== 'select' &&
        activeTool !== 'pivotal' &&
        activeTool !== 'swimlane'
      ) {
        // Spawn sticky of active tool
        const world = screenToWorld(e.clientX, e.clientY);
        createStickyAt(activeTool, world.x, world.y);
        return;
      }

      if (activeTool === 'pivotal') {
        const world = screenToWorld(e.clientX, e.clientY);
        const newLine: PivotalLine = {
          id: crypto.randomUUID(),
          name: 'Milestone',
          x: Math.round(world.x),
          color: '#FF9F1C',
        };
        onUpsertPivotalLine(newLine);
        setSelectedLineId(newLine.id);
        return;
      }

      if (activeTool === 'swimlane') {
        const world = screenToWorld(e.clientX, e.clientY);
        const newLane: Swimlane = {
          id: crypto.randomUUID(),
          name: 'New Swimlane',
          y: Math.round(world.y),
          height: 250,
          color: '#38bdf8',
        };
        onUpsertSwimlane(newLane);
        setSelectedLaneId(newLane.id);
        return;
      }

      // Start Marquee Selection
      if (!e.shiftKey) {
        setSelectedStickyIds(new Set());
        setSelectedLineId(null);
        setSelectedLaneId(null);
      }

      setMarquee({
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      });
    }
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    // Broadcast cursor position to peers in world coordinates
    const world = screenToWorld(e.clientX, e.clientY);
    onCursorMove(Math.round(world.x), Math.round(world.y));

    // Handle Pan drag
    if (dragState && dragState.type === 'pan') {
      const dx = (e.clientX - dragState.currentX) / viewport.zoom;
      const dy = (e.clientY - dragState.currentY) / viewport.zoom;
      setViewport((prev) => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy,
      }));
      setDragState({
        ...dragState,
        currentX: e.clientX,
        currentY: e.clientY,
      });
      return;
    }

    // Handle Sticky dragging
    if (dragState && dragState.type === 'stickies' && dragState.initialPositions) {
      const dx = (e.clientX - dragState.startX) / viewport.zoom;
      const dy = (e.clientY - dragState.startY) / viewport.zoom;

      for (const [id, pos] of dragState.initialPositions.entries()) {
        const sticky = stickies.find((s) => s.id === id);
        if (sticky) {
          sticky.x = Math.round(pos.x + dx);
          sticky.y = Math.round(pos.y + dy);
        }
      }
      setDragState({
        ...dragState,
        currentX: e.clientX,
        currentY: e.clientY,
      });
      return;
    }

    // Handle Pivotal Line dragging
    if (dragState && dragState.type === 'pivotal' && dragState.activeId) {
      const dx = (e.clientX - dragState.startX) / viewport.zoom;
      const line = pivotalLines.find((l) => l.id === dragState.activeId);
      if (line && dragState.initialPositions) {
        const initPos = dragState.initialPositions.get(line.id);
        if (initPos) {
          line.x = Math.round(initPos.x + dx);
        }
      }
      setDragState({
        ...dragState,
        currentX: e.clientX,
        currentY: e.clientY,
      });
      return;
    }

    // Handle Swimlane dragging
    if (dragState && dragState.type === 'swimlane' && dragState.activeId) {
      const dy = (e.clientY - dragState.startY) / viewport.zoom;
      const lane = swimlanes.find((l) => l.id === dragState.activeId);
      if (lane && dragState.initialPositions) {
        const initPos = dragState.initialPositions.get(lane.id);
        if (initPos) {
          lane.y = Math.round(initPos.y + dy);
        }
      }
      setDragState({
        ...dragState,
        currentX: e.clientX,
        currentY: e.clientY,
      });
      return;
    }

    // Handle Marquee Selection drag
    if (marquee) {
      setMarquee({
        ...marquee,
        currentX: e.clientX,
        currentY: e.clientY,
      });

      // Calculate enclosed stickies
      const left = Math.min(marquee.startX, e.clientX);
      const right = Math.max(marquee.startX, e.clientX);
      const top = Math.min(marquee.startY, e.clientY);
      const bottom = Math.max(marquee.startY, e.clientY);

      const w1 = screenToWorld(left, top);
      const w2 = screenToWorld(right, bottom);

      const enclosed = new Set<string>();
      for (const s of stickies) {
        const meta = STICKY_DEFINITIONS[s.type] || STICKY_DEFINITIONS['domain-event'];
        const sw = meta.geometry.width;
        const sh = meta.geometry.height;

        if (
          s.x + sw >= w1.x &&
          s.x <= w2.x &&
          s.y + sh >= w1.y &&
          s.y <= w2.y
        ) {
          enclosed.add(s.id);
        }
      }
      setSelectedStickyIds(enclosed);
    }
  };

  // Mouse Up
  const handleMouseUp = () => {
    // If we finished dragging stickies, broadcast batch move to server
    if (dragState && dragState.type === 'stickies' && dragState.initialPositions) {
      const updates: Array<{ id: string; x: number; y: number }> = [];
      for (const id of dragState.initialPositions.keys()) {
        const sticky = stickies.find((s) => s.id === id);
        if (sticky) {
          updates.push({ id: sticky.id, x: sticky.x, y: sticky.y });
        }
      }
      if (updates.length > 0) {
        onBatchMoveStickies(updates);
      }
    }

    // If finished dragging pivotal line
    if (dragState && dragState.type === 'pivotal' && dragState.activeId) {
      const line = pivotalLines.find((l) => l.id === dragState.activeId);
      if (line) {
        onUpsertPivotalLine(line);
      }
    }

    // If finished dragging swimlane
    if (dragState && dragState.type === 'swimlane' && dragState.activeId) {
      const lane = swimlanes.find((l) => l.id === dragState.activeId);
      if (lane) {
        onUpsertSwimlane(lane);
      }
    }

    setDragState(null);
    setMarquee(null);
  };

  // Double click on canvas background creates a Domain Event
  const handleDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-sticky-id]') ||
      target.closest('[data-pivotal-id]') ||
      target.closest('[data-swimlane-id]')
    ) {
      return;
    }
    const world = screenToWorld(e.clientX, e.clientY);
    createStickyAt('domain-event', world.x, world.y);
  };

  // Selection handlers
  const handleStickySelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    let newSelected: Set<string>;
    if (e.shiftKey) {
      newSelected = new Set(selectedStickyIds);
      if (newSelected.has(id)) newSelected.delete(id);
      else newSelected.add(id);
    } else {
      if (selectedStickyIds.has(id)) {
        newSelected = selectedStickyIds;
      } else {
        newSelected = new Set([id]);
      }
    }
    setSelectedStickyIds(newSelected);
    setSelectedLineId(null);
    setSelectedLaneId(null);

    // Prepare dragging for all selected stickies
    const initPosMap = new Map<string, { x: number; y: number }>();
    for (const sid of newSelected) {
      const s = stickies.find((item) => item.id === sid);
      if (s) {
        initPosMap.set(s.id, { x: s.x, y: s.y });
      }
    }

    setDragState({
      type: 'stickies',
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      initialPositions: initPosMap,
    });
  };

  const handlePivotalSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedLineId(id);
    setSelectedStickyIds(new Set());
    setSelectedLaneId(null);

    const line = pivotalLines.find((l) => l.id === id);
    if (line) {
      const initMap = new Map<string, { x: number; y: number }>();
      initMap.set(line.id, { x: line.x, y: 0 });
      setDragState({
        type: 'pivotal',
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        activeId: line.id,
        initialPositions: initMap,
      });
    }
  };

  const handleSwimlaneSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedLaneId(id);
    setSelectedStickyIds(new Set());
    setSelectedLineId(null);

    const lane = swimlanes.find((l) => l.id === id);
    if (lane) {
      const initMap = new Map<string, { x: number; y: number }>();
      initMap.set(lane.id, { x: 0, y: lane.y });
      setDragState({
        type: 'swimlane',
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        activeId: lane.id,
        initialPositions: initMap,
      });
    }
  };

  // Zoom controls actions
  const handleZoomIn = () => {
    zoomAtPoint(dimensions.width / 2, dimensions.height / 2, viewport.zoom * 1.25);
  };

  const handleZoomOut = () => {
    zoomAtPoint(dimensions.width / 2, dimensions.height / 2, viewport.zoom * 0.8);
  };

  const handleResetZoom = () => {
    setViewport({ x: 100, y: 100, zoom: 0.85 });
  };

  const handleFitAll = () => {
    if (stickies.length === 0) {
      handleResetZoom();
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const s of stickies) {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x + 160;
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y + 160;
    }

    const margin = 100;
    const contentW = maxX - minX + margin * 2;
    const contentH = maxY - minY + margin * 2;

    const scaleX = dimensions.width / contentW;
    const scaleY = dimensions.height / contentH;
    const targetZoom = Math.min(1.2, Math.max(0.2, Math.min(scaleX, scaleY)));

    const targetVx = (dimensions.width / targetZoom - (maxX + minX)) / 2;
    const targetVy = (dimensions.height / targetZoom - (maxY + minY)) / 2;

    setViewport({ x: targetVx, y: targetVy, zoom: targetZoom });
  };

  const cursorClass = isSpacePressed || activeTool === 'pan'
    ? 'cursor-grab active:cursor-grabbing'
    : activeTool === 'select'
    ? 'cursor-default'
    : 'cursor-crosshair';

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      className={`relative w-full h-full overflow-hidden bg-slate-950 canvas-grid select-none ${cursorClass}`}
    >
      {/* Zoomed & Panned Canvas Layer */}
      <div
        id="canvas-world"
        style={{
          transformOrigin: '0 0',
          transform: `scale(${viewport.zoom}) translate(${viewport.x}px, ${viewport.y}px)`,
        }}
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        {/* Horizontal Swimlanes */}
        {swimlanes.map((lane) => (
          <SwimlaneItem
            key={lane.id}
            lane={lane}
            isSelected={selectedLaneId === lane.id}
            onSelect={handleSwimlaneSelect}
            onUpdateName={(id, name) => {
              const updated = { ...lane, name };
              onUpsertSwimlane(updated);
            }}
            onDelete={onDeleteSwimlane}
          />
        ))}

        {/* Vertical Pivotal Milestone Lines */}
        {pivotalLines.map((line) => (
          <PivotalLineItem
            key={line.id}
            line={line}
            isSelected={selectedLineId === line.id}
            onSelect={handlePivotalSelect}
            onUpdateName={(id, name) => {
              const updated = { ...line, name };
              onUpsertPivotalLine(updated);
            }}
            onDelete={onDeletePivotalLine}
          />
        ))}

        {/* Sticky Notes */}
        {stickies.map((sticky) => (
          <StickyItem
            key={sticky.id}
            sticky={sticky}
            isSelected={selectedStickyIds.has(sticky.id)}
            isVotingMode={isVotingMode}
            onSelect={handleStickySelect}
            onUpdateText={(id, text) => {
              const updated: StickyNote = {
                ...sticky,
                text,
                updatedAt: Date.now(),
              };
              onUpsertSticky(updated);
            }}
            onVote={onVoteSticky}
            onDelete={onDeleteSticky}
            onDuplicate={duplicateSelected}
            onChangeType={(id, type) => {
              const updated: StickyNote = {
                ...sticky,
                type,
                updatedAt: Date.now(),
              };
              onUpsertSticky(updated);
            }}
          />
        ))}

        {/* Peer Cursors */}
        <PeerCursorLayer peers={peers} />
      </div>

      {/* Marquee Selection Rectangle Box */}
      {marquee && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(marquee.startX, marquee.currentX)}px`,
            top: `${Math.min(marquee.startY, marquee.currentY)}px`,
            width: `${Math.abs(marquee.currentX - marquee.startX)}px`,
            height: `${Math.abs(marquee.currentY - marquee.startY)}px`,
          }}
          className="border border-indigo-400 bg-indigo-500/20 rounded pointer-events-none z-30"
        />
      )}

      {/* Floating Canvas Zoom & View Controls (Bottom Left) */}
      <div
        id="tour-canvas-controls"
        className="absolute bottom-5 left-5 flex items-center gap-1.5 p-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl shadow-xl backdrop-blur-md z-40 select-none text-slate-300"
      >
        <button
          onClick={handleZoomOut}
          className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
          title="Zoom Out (-)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          onClick={handleResetZoom}
          className="px-2 py-1 text-xs font-semibold hover:bg-slate-800 rounded-lg transition-colors"
          title="Reset Zoom"
        >
          {Math.round(viewport.zoom * 100)}%
        </button>

        <button
          onClick={handleZoomIn}
          className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
          title="Zoom In (+)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-slate-700 my-auto" />

        <button
          onClick={handleFitAll}
          className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
          title="Fit All Content on Screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Minimap (Bottom Right) */}
      <div id="tour-minimap" className="absolute bottom-5 right-5 z-40">
        <Minimap
          stickies={stickies}
          viewport={viewport}
          canvasWidth={dimensions.width}
          canvasHeight={dimensions.height}
          onJumpTo={(targetVx, targetVy) => {
            setViewport((prev) => ({
              ...prev,
              x: targetVx,
              y: targetVy,
            }));
          }}
        />
      </div>
    </div>
  );
};
