import { describe, it, expect } from 'vitest';
import {
  WORKSHOP_FORMATS,
  STICKY_DEFINITIONS,
  SAMPLE_TEMPLATES,
  WorkshopFormat,
  StickyType,
  StickyNote,
  PivotalLine,
  Swimlane,
  WorkspaceState,
} from '../src/shared/eventstorming';

class WorkshopSimulation {
  public state: WorkspaceState;
  public historyPast: WorkspaceState[] = [];
  public historyFuture: WorkspaceState[] = [];

  constructor(id: string, initialFormat: WorkshopFormat = 'big-picture') {
    this.state = {
      id,
      name: `Workshop ${id}`,
      format: initialFormat,
      currentPhaseIndex: 0,
      timerSecondsRemaining: WORKSHOP_FORMATS[initialFormat].phases[0].suggestedDurationMinutes * 60,
      timerIsRunning: false,
      timerLastTickAt: 0,
      stickies: [],
      pivotalLines: [],
      swimlanes: [],
    };
  }

  get currentFormatMeta() {
    return WORKSHOP_FORMATS[this.state.format];
  }

  get currentPhase() {
    return this.currentFormatMeta.phases[this.state.currentPhaseIndex];
  }

  private cloneState(): WorkspaceState {
    return {
      ...this.state,
      stickies: this.state.stickies.map((s) => ({ ...s })),
      pivotalLines: this.state.pivotalLines.map((l) => ({ ...l })),
      swimlanes: this.state.swimlanes.map((lane) => ({ ...lane })),
    };
  }

  public recordSnapshot() {
    this.historyPast.push(this.cloneState());
    if (this.historyPast.length > 30) this.historyPast.shift();
    this.historyFuture = [];
  }

  public undo(): boolean {
    if (this.historyPast.length === 0) return false;
    const prev = this.historyPast.pop()!;
    this.historyFuture.push(this.cloneState());
    this.state = prev;
    return true;
  }

  public redo(): boolean {
    if (this.historyFuture.length === 0) return false;
    const next = this.historyFuture.pop()!;
    this.historyPast.push(this.cloneState());
    this.state = next;
    return true;
  }

  public setFormat(format: WorkshopFormat) {
    this.recordSnapshot();
    this.state.format = format;
    this.state.currentPhaseIndex = 0;
    const meta = WORKSHOP_FORMATS[format];
    this.state.timerSecondsRemaining = meta.phases[0].suggestedDurationMinutes * 60;
    this.state.timerIsRunning = false;
  }

  public goToPhase(phaseIndex: number) {
    const total = this.currentFormatMeta.phases.length;
    if (phaseIndex < 0 || phaseIndex >= total) {
      throw new Error(`Invalid phase index ${phaseIndex} for format ${this.state.format} (max ${total - 1})`);
    }
    this.recordSnapshot();
    this.state.currentPhaseIndex = phaseIndex;
    this.state.timerSecondsRemaining = this.currentPhase.suggestedDurationMinutes * 60;
  }

  public nextPhase(): boolean {
    if (this.state.currentPhaseIndex < this.currentFormatMeta.phases.length - 1) {
      this.goToPhase(this.state.currentPhaseIndex + 1);
      return true;
    }
    return false;
  }

  public prevPhase(): boolean {
    if (this.state.currentPhaseIndex > 0) {
      this.goToPhase(this.state.currentPhaseIndex - 1);
      return true;
    }
    return false;
  }

  public addSticky(type: StickyType, text: string, x: number, y: number, author = 'Facilitator'): StickyNote {
    this.recordSnapshot();
    const sticky: StickyNote = {
      id: `sticky-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      text,
      x: Math.round(x),
      y: Math.round(y),
      votes: 0,
      authorName: author,
      updatedAt: Date.now(),
    };
    this.state.stickies.push(sticky);
    return sticky;
  }

  public batchMoveStickies(updates: Array<{ id: string; x: number; y: number }>) {
    this.recordSnapshot();
    for (const update of updates) {
      const s = this.state.stickies.find((item) => item.id === update.id);
      if (s) {
        s.x = update.x;
        s.y = update.y;
      }
    }
  }

  public voteSticky(id: string, delta: number) {
    const s = this.state.stickies.find((item) => item.id === id);
    if (s) {
      s.votes = Math.max(0, s.votes + delta);
    }
  }

  public addPivotalLine(name: string, x: number, color = '#FF9F1C'): PivotalLine {
    this.recordSnapshot();
    const line: PivotalLine = {
      id: `piv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name,
      x: Math.round(x),
      color,
    };
    this.state.pivotalLines.push(line);
    return line;
  }

  public addSwimlane(name: string, y: number, height = 250, color = '#38bdf8'): Swimlane {
    this.recordSnapshot();
    const lane: Swimlane = {
      id: `lane-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name,
      y: Math.round(y),
      height,
      color,
    };
    this.state.swimlanes.push(lane);
    return lane;
  }

  public loadTemplate(templateKey: string) {
    const tpl = SAMPLE_TEMPLATES[templateKey];
    if (!tpl) throw new Error(`Unknown template ${templateKey}`);
    this.recordSnapshot();
    this.state.format = tpl.format;
    this.state.name = tpl.title;
    this.state.currentPhaseIndex = 0;
    this.state.stickies = tpl.stickies.map((s) => ({ ...s, updatedAt: Date.now() }));
    this.state.pivotalLines = tpl.pivotalLines.map((l) => ({ ...l }));
    this.state.swimlanes = tpl.swimlanes.map((lane) => ({ ...lane }));
  }

  public exportMarkdown(): string {
    const formatMeta = this.currentFormatMeta;
    const events = this.state.stickies
      .filter((s) => s.type === 'domain-event')
      .sort((a, b) => a.x - b.x);
    const hotspots = this.state.stickies
      .filter((s) => s.type === 'hotspot')
      .sort((a, b) => b.votes - a.votes);
    const commands = this.state.stickies.filter((s) => s.type === 'command');
    const policies = this.state.stickies.filter((s) => s.type === 'policy');
    const readmodels = this.state.stickies.filter((s) => s.type === 'readmodel');
    const constraints = this.state.stickies.filter((s) => s.type === 'constraint');
    const actors = this.state.stickies.filter((s) => s.type === 'actor');
    const systems = this.state.stickies.filter((s) => s.type === 'system');

    return [
      `# EventStorming Summary: ${this.state.id}`,
      `**Format**: ${formatMeta.title}`,
      `**Current Phase**: ${this.currentPhase.title}`,
      `## 1. Domain Events (${events.length})`,
      events.map((e) => `- ${e.text} (x: ${e.x}, votes: ${e.votes})`).join('\n') || '*None*',
      `## 2. Hotspots & Top Bottlenecks (${hotspots.length})`,
      hotspots.map((h) => `- 🔥 ${h.text} [${h.votes} votes]`).join('\n') || '*None*',
      `## 3. Commands (${commands.length})`,
      commands.map((c) => `- ⚡ ${c.text}`).join('\n') || '*None*',
      `## 4. Policies (${policies.length})`,
      policies.map((p) => `- 📜 ${p.text}`).join('\n') || '*None*',
      `## 5. Read Models (${readmodels.length})`,
      readmodels.map((r) => `- 📖 ${r.text}`).join('\n') || '*None*',
      `## 6. Aggregates & Invariant Boundaries (${constraints.length})`,
      constraints.map((a) => `- 🛡️ ${a.text}`).join('\n') || '*None*',
      `## 7. Actors (${actors.length}) & Systems (${systems.length})`,
      actors.map((a) => `- 👤 ${a.text}`).join('\n') || '*None*',
      systems.map((s) => `- 🏢 ${s.text}`).join('\n') || '*None*',
      `## 8. Pivotal Milestone Lines (${this.state.pivotalLines.length})`,
      this.state.pivotalLines.map((p) => `- 🏁 ${p.name} @ x=${p.x}`).join('\n') || '*None*',
      `## 9. Swimlanes (${this.state.swimlanes.length})`,
      this.state.swimlanes.map((l) => `- 🏊 ${l.name} @ y=${l.y}`).join('\n') || '*None*',
    ].join('\n\n');
  }
}

describe('Comprehensive EventStorming Multi-Variant Specification Suite', () => {
  describe('Variant 1: Big Picture EventStorming', () => {
    it('executes full 8-phase facilitation flow with Brandolini grammar and dot-voting', () => {
      const sim = new WorkshopSimulation('bp-session-alpha', 'big-picture');

      expect(sim.state.format).toBe('big-picture');
      expect(sim.currentFormatMeta.phases).toHaveLength(8);

      // Phase 1: Check-In & Scope Setting
      expect(sim.currentPhase.number).toBe(1);
      expect(sim.currentPhase.suggestedDurationMinutes).toBe(10);
      expect(sim.currentPhase.suggestedStickies).toContain('domain-event');

      // Phase 2: Chaotic Event Generation
      sim.nextPhase();
      expect(sim.currentPhase.number).toBe(2);
      expect(sim.currentPhase.title).toContain('Chaotic Event Generation');
      const e1 = sim.addSticky('domain-event', 'Order Created', 200, 150);
      const e2 = sim.addSticky('domain-event', 'Payment Captured', 650, 180);
      const e3 = sim.addSticky('domain-event', 'Package Dispatched', 1100, 160);

      expect(STICKY_DEFINITIONS[e1.type].color.toUpperCase()).toBe('#FF9F1C');
      expect(STICKY_DEFINITIONS[e1.type].geometry.shape).toBe('square');

      // Phase 3: Enforce Timeline & Pivotal Events
      sim.nextPhase();
      expect(sim.currentPhase.number).toBe(3);
      const piv1 = sim.addPivotalLine('Order Completed', 450);
      const piv2 = sim.addPivotalLine('Shipped', 900);
      expect(piv1.x).toBeLessThan(piv2.x);
      expect(sim.state.pivotalLines).toHaveLength(2);

      // Phase 4: Reverse Narrative & Friction Capture
      sim.nextPhase();
      expect(sim.currentPhase.number).toBe(4);
      const h1 = sim.addSticky('hotspot', 'Inventory buffer race condition under peak load', 460, 320);
      const h2 = sim.addSticky('hotspot', 'Customs documentation delays cross-border orders', 920, 320);
      expect(STICKY_DEFINITIONS[h1.type].color.toUpperCase()).toBe('#FF2E88');
      expect(STICKY_DEFINITIONS[h1.type].geometry.rotation).toBe(-6);

      // Phase 5: People & Systems
      sim.nextPhase();
      expect(sim.currentPhase.number).toBe(5);
      const actorCustomer = sim.addSticky('actor', 'Online Buyer', 100, 150);
      const sysPayment = sim.addSticky('system', 'Adyen Payments Gateway', 650, 320);
      expect(STICKY_DEFINITIONS[actorCustomer.type].color.toUpperCase()).toBe('#FFD43B');
      expect(STICKY_DEFINITIONS[sysPayment.type].color.toUpperCase()).toBe('#F7B7D2');

      // Phase 6: Opportunities & Value
      sim.nextPhase();
      expect(sim.currentPhase.number).toBe(6);
      const opp1 = sim.addSticky('opportunity', 'Instant checkout via Passkeys', 200, 420);
      const val1 = sim.addSticky('value', '+14% Conversion Rate', 200, 550);
      expect(STICKY_DEFINITIONS[opp1.type].color.toUpperCase()).toBe('#2FA84F');
      expect(STICKY_DEFINITIONS[val1.type].color.toUpperCase()).toBe('#2FA84F');

      // Phase 7: Dot Voting on Hotspots
      sim.nextPhase();
      expect(sim.currentPhase.number).toBe(7);
      expect(sim.currentPhase.title).toContain('Dot Voting');
      sim.voteSticky(h1.id, 1);
      sim.voteSticky(h1.id, 1);
      sim.voteSticky(h1.id, 1);
      sim.voteSticky(h2.id, 1);
      expect(sim.state.stickies.find((s) => s.id === h1.id)?.votes).toBe(3);
      expect(sim.state.stickies.find((s) => s.id === h2.id)?.votes).toBe(1);

      // Phase 8: Synthesis & Action Items
      sim.nextPhase();
      expect(sim.currentPhase.number).toBe(8);
      expect(sim.currentPhase.title).toContain('Synthesis');

      const md = sim.exportMarkdown();
      expect(md).toContain('Big Picture EventStorming');
      expect(md).toContain('Order Created');
      expect(md).toContain('Inventory buffer race condition');
      expect(md).toContain('3 votes');
      expect(md).toContain('Adyen Payments Gateway');
      expect(md).toContain('Order Completed @ x=450');
    });
  });

  describe('Variant 2: Process Modelling EventStorming', () => {
    it('executes full 6-phase facilitation flow with Commands, Policies, and Swimlanes', () => {
      const sim = new WorkshopSimulation('pm-session-beta', 'process-modelling');

      expect(sim.state.format).toBe('process-modelling');
      expect(sim.currentFormatMeta.phases).toHaveLength(6);

      // Phase 1: Scope Boundary & Happy Path
      expect(sim.currentPhase.number).toBe(1);
      const cmd1 = sim.addSticky('command', 'Submit Damage Appraisal', 180, 140);
      const evt1 = sim.addSticky('domain-event', 'Damage Appraisal Received', 420, 140);
      expect(STICKY_DEFINITIONS[cmd1.type].color.toUpperCase()).toBe('#6FB7FF');
      expect(STICKY_DEFINITIONS[evt1.type].color.toUpperCase()).toBe('#FF9F1C');

      // Phase 2: Commands & Users
      sim.nextPhase();
      expect(sim.currentPhase.number).toBe(2);
      const actorAdjuster = sim.addSticky('actor', 'Certified Claims Adjuster', 180, 40);
      expect(STICKY_DEFINITIONS[actorAdjuster.type].color.toUpperCase()).toBe('#FFD43B');

      // Phase 3: Policies & Automation Rules
      sim.nextPhase();
      expect(sim.currentPhase.number).toBe(3);
      const pol1 = sim.addSticky(
        'policy',
        'Whenever Appraisal Received And Amount < $1,000 Then Auto-Approve Claim',
        640,
        140
      );
      expect(STICKY_DEFINITIONS[pol1.type].color.toUpperCase()).toBe('#C9A7EB');

      // Phase 4: Information & Read Models
      sim.nextPhase();
      expect(sim.currentPhase.number).toBe(4);
      const rm1 = sim.addSticky('readmodel', 'Policyholder Deductible & Coverage Limit', 180, 260);
      expect(STICKY_DEFINITIONS[rm1.type].color.toUpperCase()).toBe('#C6F2B0');

      // Phase 5: Exceptional Flows & Failures
      sim.nextPhase();
      expect(sim.currentPhase.number).toBe(5);
      const evtRejected = sim.addSticky('domain-event', 'Claim Rejected (Lapsed Policy)', 850, 240);
      const hotAppeal = sim.addSticky('hotspot', 'Manual appeal backlog averages 18 business days', 850, 360);
      sim.voteSticky(hotAppeal.id, 5);

      // Phase 6: Validation & Swimlanes
      sim.nextPhase();
      expect(sim.currentPhase.number).toBe(6);
      const lane1 = sim.addSwimlane('Policyholder App', 0, 220, '#38bdf8');
      const lane2 = sim.addSwimlane('Adjudication Core Service', 240, 240, '#f59e0b');
      expect(sim.state.swimlanes).toHaveLength(2);
      expect(lane1.y).toBeLessThan(lane2.y);

      const md = sim.exportMarkdown();
      expect(md).toContain('Process Modelling EventStorming');
      expect(md).toContain('Submit Damage Appraisal');
      expect(md).toContain('Auto-Approve Claim');
      expect(md).toContain('Manual appeal backlog averages 18 business days');
      expect(md).toContain('[5 votes]');
      expect(md).toContain('Policyholder App @ y=0');
    });
  });

  describe('Variant 3: Software Design EventStorming', () => {
    it('executes full 4-phase facilitation flow with Aggregates, Invariants, and Async Pub/Sub', () => {
      const sim = new WorkshopSimulation('sd-session-gamma', 'software-design');

      expect(sim.state.format).toBe('software-design');
      expect(sim.currentFormatMeta.phases).toHaveLength(4);

      // Phase 1: Command Triggers & Preconditions
      expect(sim.currentPhase.number).toBe(1);
      const cmdLock = sim.addSticky('command', 'LockCandidateDrivers(geoCellId, radius)', 150, 150);
      const rmGeo = sim.addSticky('readmodel', 'H3 Geospatial Driver Ring (Resolution 8)', 150, 270);
      expect(cmdLock.type).toBe('command');
      expect(rmGeo.type).toBe('readmodel');

      // Phase 2: Aggregates & Invariant Boundaries
      sim.nextPhase();
      expect(sim.currentPhase.number).toBe(2);
      const aggDispatch = sim.addSticky(
        'constraint',
        'DispatchBatchAggregate\n- Invariant: Candidate driver must not be on active trip\n- Invariant: Lock TTL exactly 15 seconds',
        380,
        150
      );
      const evtMatched = sim.addSticky('domain-event', 'DriverAssignedToTrip', 650, 150);
      expect(STICKY_DEFINITIONS[aggDispatch.type].color.toUpperCase()).toBe('#FFF7B8');

      // Phase 3: Policies, Pub/Sub & Async Flows
      sim.nextPhase();
      expect(sim.currentPhase.number).toBe(3);
      const polStream = sim.addSticky(
        'policy',
        'Whenever DriverAssignedToTrip Then Stream Driver Telemetry via SSE Channel',
        880,
        150
      );
      const sysPush = sim.addSticky('system', 'Google Cloud PubSub & FCM Gateway', 1150, 150);
      expect(polStream.type).toBe('policy');
      expect(sysPush.type).toBe('system');

      // Phase 4: Bounded Context Partitions & APIs
      sim.nextPhase();
      expect(sim.currentPhase.number).toBe(4);
      const hotReconnect = sim.addSticky('hotspot', 'Cellular handover triggers reconnection cascading storms', 880, 320);
      const oppGrpc = sim.addSticky('opportunity', 'Adopt bidirectional gRPC streaming for telemetry ingress', 1150, 320);
      sim.voteSticky(hotReconnect.id, 7);

      const md = sim.exportMarkdown();
      expect(md).toContain('Software Design EventStorming');
      expect(md).toContain('DispatchBatchAggregate');
      expect(md).toContain('DriverAssignedToTrip');
      expect(md).toContain('Google Cloud PubSub');
      expect(md).toContain('Cellular handover triggers reconnection');
      expect(md).toContain('[7 votes]');
    });
  });

  describe('Cross-Variant Transitions & Canvas Resilience', () => {
    it('seamlessly transitions format from Big Picture to Process Modelling to Software Design', () => {
      const sim = new WorkshopSimulation('switch-test', 'big-picture');
      expect(sim.state.format).toBe('big-picture');
      expect(sim.currentFormatMeta.phases).toHaveLength(8);

      // Add big picture items
      const e = sim.addSticky('domain-event', 'Customer Registered', 100, 100);

      // Switch to Process Modelling
      sim.setFormat('process-modelling');
      expect(sim.state.format).toBe('process-modelling');
      expect(sim.state.currentPhaseIndex).toBe(0);
      expect(sim.currentFormatMeta.phases).toHaveLength(6);
      expect(sim.state.stickies).toContain(e);

      // Switch to Software Design
      sim.setFormat('software-design');
      expect(sim.state.format).toBe('software-design');
      expect(sim.state.currentPhaseIndex).toBe(0);
      expect(sim.currentFormatMeta.phases).toHaveLength(4);
    });

    it('verifies all three pre-packaged sample workshop templates instantiate accurately', () => {
      const sim = new WorkshopSimulation('tpl-test');

      // Template 1
      sim.loadTemplate('ecommerce-fulfillment');
      expect(sim.state.format).toBe('big-picture');
      expect(sim.state.stickies.length).toBeGreaterThan(15);
      expect(sim.state.pivotalLines.length).toBe(3);
      expect(sim.state.swimlanes.length).toBe(3);

      // Template 2
      sim.loadTemplate('insurance-claims');
      expect(sim.state.format).toBe('process-modelling');
      expect(sim.state.stickies.some((s) => s.type === 'command')).toBe(true);
      expect(sim.state.stickies.some((s) => s.type === 'policy')).toBe(true);

      // Template 3
      sim.loadTemplate('ride-hailing-dispatch');
      expect(sim.state.format).toBe('software-design');
      expect(sim.state.stickies.some((s) => s.type === 'constraint')).toBe(true);
      expect(sim.state.stickies.some((s) => s.type === 'system')).toBe(true);
    });

    it('proves undo and redo isolate in-memory batch movement mutations from snapshots', () => {
      const sim = new WorkshopSimulation('undo-robustness', 'big-picture');
      const sticky1 = sim.addSticky('domain-event', 'Event 1', 100, 100);
      const sticky2 = sim.addSticky('domain-event', 'Event 2', 300, 100);

      expect(sticky1.x).toBe(100);
      expect(sticky2.x).toBe(300);

      // Perform batch move
      sim.batchMoveStickies([
        { id: sticky1.id, x: 150, y: 120 },
        { id: sticky2.id, x: 350, y: 120 },
      ]);

      expect(sim.state.stickies.find((s) => s.id === sticky1.id)?.x).toBe(150);
      expect(sim.state.stickies.find((s) => s.id === sticky2.id)?.x).toBe(350);

      // Undo must restore the exact initial positions
      const undone = sim.undo();
      expect(undone).toBe(true);
      expect(sim.state.stickies.find((s) => s.id === sticky1.id)?.x).toBe(100);
      expect(sim.state.stickies.find((s) => s.id === sticky2.id)?.x).toBe(300);

      // Redo must re-apply the batch move positions
      const redone = sim.redo();
      expect(redone).toBe(true);
      expect(sim.state.stickies.find((s) => s.id === sticky1.id)?.x).toBe(150);
      expect(sim.state.stickies.find((s) => s.id === sticky2.id)?.x).toBe(350);
    });
  });
});
