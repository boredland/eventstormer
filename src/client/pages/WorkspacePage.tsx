import React, { useState, useEffect, useCallback } from 'react';
import type {
  WorkspaceState,
  WorkshopFormat,
  StickyNote,
  PivotalLine,
  Swimlane,
  StickyType,
  BreakoutRoom,
} from '../../shared/eventstorming';
import { BreakoutModal } from '../components/BreakoutModal';
import { BreakoutBar } from '../components/BreakoutBar';
import { SAMPLE_TEMPLATES } from '../../shared/eventstorming';
import type { UserProfile, ActiveTool } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { Canvas } from '../canvas/Canvas';
import { Header } from '../components/Header';
import { StickyPalette } from '../components/StickyPalette';
import { FacilitatorSidebar } from '../components/FacilitatorSidebar';
import { ExportModal } from '../components/ExportModal';
import { TemplateModal } from '../components/TemplateModal';
import { JoinModal } from '../components/JoinModal';
import { startJoyrideTour } from '../components/TourGuide';

interface WorkspacePageProps {
  workspaceId: string;
  initialTemplateKey?: string;
}

const DEFAULT_STATE: WorkspaceState = {
  id: '',
  name: 'New EventStorming Session',
  format: 'big-picture',
  currentPhaseIndex: 0,
  timerIsRunning: false,
  timerSecondsRemaining: 300,
  timerLastTickAt: 0,
  stickies: [],
  pivotalLines: [],
  swimlanes: [],
};

export const WorkspacePage: React.FC<WorkspacePageProps> = ({
  workspaceId,
  initialTemplateKey,
}) => {
  // User profile from localStorage or modal
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('eventstormer_user');
    if (saved) {
      try {
        return JSON.parse(saved) as UserProfile;
      } catch {
        // Fallback
      }
    }
    return {
      clientId: crypto.randomUUID(),
      name: `Stormer #${Math.floor(100 + Math.random() * 900)}`,
      color: '#f97316',
    };
  });

  const [hasPromptedJoin, setHasPromptedJoin] = useState<boolean>(() => {
    return !!localStorage.getItem('eventstormer_user');
  });

  const [state, setState] = useState<WorkspaceState>(() => {
    if (initialTemplateKey && SAMPLE_TEMPLATES[initialTemplateKey]) {
      const template = SAMPLE_TEMPLATES[initialTemplateKey];
      return {
        ...DEFAULT_STATE,
        id: workspaceId,
        format: template.format,
        name: template.title,
        stickies: template.stickies.map((s) => ({
          ...s,
          updatedAt: Date.now(),
        })),
        pivotalLines: [...template.pivotalLines],
        swimlanes: [...template.swimlanes],
      };
    }
    return {
      ...DEFAULT_STATE,
      id: workspaceId,
    };
  });

  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [isVotingMode, setIsVotingMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [currentBreakoutRoomId, setCurrentBreakoutRoomId] = useState<string | null>(null);
  const [isBreakoutModalOpen, setIsBreakoutModalOpen] = useState(false);

  // Undo / Redo engine
  const { pushSnapshot, setPresent, undo, redo } = useUndoRedo({
    stickies: state.stickies,
    pivotalLines: state.pivotalLines,
    swimlanes: state.swimlanes,
  });

  // WebSocket real-time sync hook
  const { isConnected, peers, sendMessage, sendCursor } = useWebSocket({
    workspaceId,
    user,
    onStateUpdate: setState,
  });

  // Load initial template if specified and state is empty
  useEffect(() => {
    if (initialTemplateKey && SAMPLE_TEMPLATES[initialTemplateKey]) {
      const timer = setTimeout(() => {
        handleLoadTemplate(initialTemplateKey);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initialTemplateKey]);

  // Keep undo snapshot present aligned
  useEffect(() => {
    setPresent({
      stickies: state.stickies,
      pivotalLines: state.pivotalLines,
      swimlanes: state.swimlanes,
    });
  }, [state.stickies, state.pivotalLines, state.swimlanes, setPresent]);

  // Automatically return attendees to main room when breakout session ends
  useEffect(() => {
    if (!state.breakoutSession?.active && currentBreakoutRoomId !== null) {
      setCurrentBreakoutRoomId(null);
    }
  }, [state.breakoutSession?.active, currentBreakoutRoomId]);

  // Mutations
  const handleUpsertSticky = useCallback(
    (sticky: StickyNote) => {
      const stickyToSave = currentBreakoutRoomId
        ? { ...sticky, breakoutRoomId: currentBreakoutRoomId }
        : sticky;
      pushSnapshot({
        stickies: state.stickies,
        pivotalLines: state.pivotalLines,
        swimlanes: state.swimlanes,
      });

      setState((prev) => {
        const idx = prev.stickies.findIndex((s) => s.id === stickyToSave.id);
        let stickies: StickyNote[];
        if (idx >= 0) {
          stickies = [...prev.stickies];
          stickies[idx] = stickyToSave;
        } else {
          stickies = [...prev.stickies, stickyToSave];
        }
        return { ...prev, stickies };
      });

      sendMessage({ type: 'sticky:upsert', sticky: stickyToSave });
    },
    [state.stickies, state.pivotalLines, state.swimlanes, currentBreakoutRoomId, pushSnapshot, sendMessage]
  );

  const handleBatchMoveStickies = useCallback(
    (updates: Array<{ id: string; x: number; y: number }>) => {
      pushSnapshot({
        stickies: state.stickies,
        pivotalLines: state.pivotalLines,
        swimlanes: state.swimlanes,
      });

      setState((prev) => {
        const updateMap = new Map(updates.map((u) => [u.id, u]));
        const stickies = prev.stickies.map((s) => {
          const u = updateMap.get(s.id);
          return u ? { ...s, x: u.x, y: u.y } : s;
        });
        return { ...prev, stickies };
      });

      sendMessage({ type: 'sticky:batch-move', updates });
    },
    [state.stickies, state.pivotalLines, state.swimlanes, pushSnapshot, sendMessage]
  );
  const handleDeleteSticky = useCallback(
    (id: string) => {
      pushSnapshot({
        stickies: state.stickies,
        pivotalLines: state.pivotalLines,
        swimlanes: state.swimlanes,
      });

      setState((prev) => ({
        ...prev,
        stickies: prev.stickies.filter((s) => s.id !== id),
      }));

      sendMessage({ type: 'sticky:delete', id });
    },
    [state.stickies, state.pivotalLines, state.swimlanes, pushSnapshot, sendMessage]
  );

  const handleVoteSticky = useCallback(
    (id: string, delta: number) => {
      setState((prev) => ({
        ...prev,
        stickies: prev.stickies.map((s) =>
          s.id === id ? { ...s, votes: Math.max(0, s.votes + delta) } : s
        ),
      }));

      sendMessage({ type: 'sticky:vote', id, delta });
    },
    [sendMessage]
  );

  const handleUpsertPivotalLine = useCallback(
    (line: PivotalLine) => {
      pushSnapshot({
        stickies: state.stickies,
        pivotalLines: state.pivotalLines,
        swimlanes: state.swimlanes,
      });

      setState((prev) => {
        const idx = prev.pivotalLines.findIndex((l) => l.id === line.id);
        let pivotalLines: PivotalLine[];
        if (idx >= 0) {
          pivotalLines = [...prev.pivotalLines];
          pivotalLines[idx] = line;
        } else {
          pivotalLines = [...prev.pivotalLines, line];
        }
        return { ...prev, pivotalLines };
      });

      sendMessage({ type: 'pivotal:upsert', line });
    },
    [state.stickies, state.pivotalLines, state.swimlanes, pushSnapshot, sendMessage]
  );

  const handleDeletePivotalLine = useCallback(
    (id: string) => {
      pushSnapshot({
        stickies: state.stickies,
        pivotalLines: state.pivotalLines,
        swimlanes: state.swimlanes,
      });

      setState((prev) => ({
        ...prev,
        pivotalLines: prev.pivotalLines.filter((l) => l.id !== id),
      }));

      sendMessage({ type: 'pivotal:delete', id });
    },
    [state.stickies, state.pivotalLines, state.swimlanes, pushSnapshot, sendMessage]
  );

  const handleUpsertSwimlane = useCallback(
    (lane: Swimlane) => {
      pushSnapshot({
        stickies: state.stickies,
        pivotalLines: state.pivotalLines,
        swimlanes: state.swimlanes,
      });

      setState((prev) => {
        const idx = prev.swimlanes.findIndex((l) => l.id === lane.id);
        let swimlanes: Swimlane[];
        if (idx >= 0) {
          swimlanes = [...prev.swimlanes];
          swimlanes[idx] = lane;
        } else {
          swimlanes = [...prev.swimlanes, lane];
        }
        return { ...prev, swimlanes };
      });

      sendMessage({ type: 'swimlane:upsert', lane });
    },
    [state.stickies, state.pivotalLines, state.swimlanes, pushSnapshot, sendMessage]
  );

  const handleDeleteSwimlane = useCallback(
    (id: string) => {
      pushSnapshot({
        stickies: state.stickies,
        pivotalLines: state.pivotalLines,
        swimlanes: state.swimlanes,
      });

      setState((prev) => ({
        ...prev,
        swimlanes: prev.swimlanes.filter((l) => l.id !== id),
      }));

      sendMessage({ type: 'swimlane:delete', id });
    },
    [state.stickies, state.pivotalLines, state.swimlanes, pushSnapshot, sendMessage]
  );

  // Format & Phase
  const handleFormatChange = useCallback(
    (format: WorkshopFormat) => {
      setState((prev) => ({ ...prev, format, currentPhaseIndex: 0 }));
      sendMessage({ type: 'workspace:set-format', format });
    },
    [sendMessage]
  );

  const handlePhaseChange = useCallback(
    (phaseIndex: number) => {
      setState((prev) => ({ ...prev, currentPhaseIndex: phaseIndex }));
      sendMessage({ type: 'workspace:set-phase', phaseIndex });
    },
    [sendMessage]
  );

  // Timer controls
  const handleTimerStart = useCallback(() => {
    setState((prev) => ({ ...prev, timerIsRunning: true, timerLastTickAt: Date.now() }));
    sendMessage({ type: 'workspace:timer', isRunning: true });
  }, [sendMessage]);

  const handleTimerPause = useCallback(() => {
    setState((prev) => ({ ...prev, timerIsRunning: false }));
    sendMessage({ type: 'workspace:timer', isRunning: false });
  }, [sendMessage]);

  const handleTimerReset = useCallback(
    (seconds: number) => {
      setState((prev) => ({
        ...prev,
        timerIsRunning: false,
        timerSecondsRemaining: seconds,
        timerLastTickAt: Date.now(),
      }));
      sendMessage({ type: 'workspace:timer', isRunning: false, secondsRemaining: seconds });
    },
    [sendMessage]
  );

  // Template loader
  const handleLoadTemplate = useCallback(
    (templateKey: string) => {
      const template = SAMPLE_TEMPLATES[templateKey];
      if (template) {
        pushSnapshot({
          stickies: state.stickies,
          pivotalLines: state.pivotalLines,
          swimlanes: state.swimlanes,
        });
        setState((prev) => ({
          ...prev,
          format: template.format,
          currentPhaseIndex: 0,
          name: template.title,
          stickies: template.stickies.map((s) => ({
            ...s,
            updatedAt: Date.now(),
          })),
          pivotalLines: template.pivotalLines,
          swimlanes: template.swimlanes,
        }));
      }
      sendMessage({ type: 'workspace:load-template', templateKey });
    },
    [state.stickies, state.pivotalLines, state.swimlanes, pushSnapshot, sendMessage]
  );

  // Breakout controls
  const handleStartBreakout = useCallback(
    (rooms: BreakoutRoom[], durationMinutes: number) => {
      sendMessage({ type: 'breakout:start', rooms, durationMinutes });
    },
    [sendMessage]
  );

  const handleEndBreakout = useCallback(
    (mergeToSwimlanes: boolean) => {
      setCurrentBreakoutRoomId(null);
      sendMessage({ type: 'breakout:end', mergeToSwimlanes });
    },
    [sendMessage]
  );

  const handleJoinBreakoutRoom = useCallback(
    (roomId: string | null) => {
      setCurrentBreakoutRoomId(roomId);
      sendMessage({ type: 'breakout:join', roomId });
    },
    [sendMessage]
  );

  // Quick Spawn Sticky from Facilitator Guide
  const handleQuickSpawn = (type: StickyType) => {
    const newSticky: StickyNote = {
      id: crypto.randomUUID(),
      type,
      text: '',
      x: 300 + Math.floor(Math.random() * 200),
      y: 200 + Math.floor(Math.random() * 150),
      votes: 0,
      authorName: user.name,
      authorColor: user.color,
      updatedAt: Date.now(),
    };
    handleUpsertSticky(newSticky);
  };

  // Undo / Redo application
  const handleUndo = () => {
    undo((snapshot) => {
      setState((prev) => ({
        ...prev,
        stickies: snapshot.stickies,
        pivotalLines: snapshot.pivotalLines,
        swimlanes: snapshot.swimlanes,
      }));
    });
  };

  const handleRedo = () => {
    redo((snapshot) => {
      setState((prev) => ({
        ...prev,
        stickies: snapshot.stickies,
        pivotalLines: snapshot.pivotalLines,
        swimlanes: snapshot.swimlanes,
      }));
    });
  };

  return (
    <div className="fixed inset-0 flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Zero Sign-in Join Modal if not configured */}
      <JoinModal
        isOpen={!hasPromptedJoin}
        onJoin={(profile) => {
          setUser(profile);
          setHasPromptedJoin(true);
        }}
      />

      {/* Top Header */}
      <Header
        workspaceId={workspaceId}
        format={state.format}
        peers={peers}
        user={user}
        timerIsRunning={state.timerIsRunning}
        timerSecondsRemaining={state.timerSecondsRemaining}
        isVotingMode={isVotingMode}
        onFormatChange={handleFormatChange}
        onTimerStart={handleTimerStart}
        onTimerPause={handleTimerPause}
        onTimerReset={handleTimerReset}
        onToggleVotingMode={() => setIsVotingMode(!isVotingMode)}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onStartTour={startJoyrideTour}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
        isBreakoutActive={!!state.breakoutSession?.active}
        onOpenBreakouts={() => setIsBreakoutModalOpen(true)}
      />

      {/* Breakout Active Bar */}
      {state.breakoutSession?.active && (
        <BreakoutBar
          session={state.breakoutSession}
          currentRoomId={currentBreakoutRoomId}
          peers={peers}
          onSelectRoom={handleJoinBreakoutRoom}
          onOpenModal={() => setIsBreakoutModalOpen(true)}
        />
      )}

      {/* Main Canvas Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <Canvas
          stickies={
            currentBreakoutRoomId
              ? state.stickies.filter((s) => s.breakoutRoomId === currentBreakoutRoomId)
              : state.stickies
          }
          pivotalLines={state.pivotalLines}
          swimlanes={state.swimlanes}
          peers={
            currentBreakoutRoomId
              ? peers.filter((p) => p.breakoutRoomId === currentBreakoutRoomId)
              : peers
          }
          user={user}
          activeTool={activeTool}
          onSelectTool={(tool) => setActiveTool(tool)}
          isVotingMode={isVotingMode}
          onUpdateStickies={(stickies) => setState((prev) => ({ ...prev, stickies }))}
          onUpdatePivotalLines={(pivotalLines) =>
            setState((prev) => ({ ...prev, pivotalLines }))
          }
          onUpdateSwimlanes={(swimlanes) => setState((prev) => ({ ...prev, swimlanes }))}
          onBatchMoveStickies={handleBatchMoveStickies}
          onUpsertSticky={handleUpsertSticky}
          onDeleteSticky={handleDeleteSticky}
          onVoteSticky={handleVoteSticky}
          onUpsertPivotalLine={handleUpsertPivotalLine}
          onDeletePivotalLine={handleDeletePivotalLine}
          onUpsertSwimlane={handleUpsertSwimlane}
          onDeleteSwimlane={handleDeleteSwimlane}
          onCursorMove={sendCursor}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />

        {/* Facilitator Phase Guide Sidebar */}
        <FacilitatorSidebar
          format={state.format}
          currentPhaseIndex={state.currentPhaseIndex}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onPhaseChange={handlePhaseChange}
          onQuickSpawn={handleQuickSpawn}
        />

        {/* Brandolini Sticky Palette Dock */}
        <StickyPalette
          activeTool={activeTool}
          onSelectTool={(tool) => setActiveTool(tool)}
        />
      </div>

      {/* Export Modal */}
      <ExportModal
        state={state}
        workspaceId={workspaceId}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />

      {/* Templates Modal */}
      <TemplateModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectTemplate={handleLoadTemplate}
      />

      {/* Breakout Session Modal */}
      <BreakoutModal
        isOpen={isBreakoutModalOpen}
        onClose={() => setIsBreakoutModalOpen(false)}
        breakoutSession={state.breakoutSession}
        peers={peers}
        onStartBreakout={handleStartBreakout}
        onEndBreakout={handleEndBreakout}
        onJoinRoom={handleJoinBreakoutRoom}
        currentRoomId={currentBreakoutRoomId}
      />
    </div>
  );
};
