import fs from 'node:fs';
import path from 'node:path';
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

// Helper to simulate facilitator workshop session state
class WorkshopFacilitationSession {
  public state: WorkspaceState;
  public logs: string[] = [];

  constructor(workspaceId: string, initialFormat: WorkshopFormat = 'big-picture') {
    this.state = {
      id: workspaceId,
      name: `${WORKSHOP_FORMATS[initialFormat].title} Session`,
      format: initialFormat,
      currentPhaseIndex: 0,
      timerIsRunning: false,
      timerSecondsRemaining: WORKSHOP_FORMATS[initialFormat].phases[0].suggestedDurationMinutes * 60,
      timerLastTickAt: 0,
      stickies: [],
      pivotalLines: [],
      swimlanes: [],
    };
    this.logs.push(`Started session for format: ${initialFormat}`);
  }

  get currentFormatDef() {
    return WORKSHOP_FORMATS[this.state.format];
  }

  get currentPhase() {
    return this.currentFormatDef.phases[this.state.currentPhaseIndex];
  }

  setFormat(format: WorkshopFormat) {
    this.state.format = format;
    this.state.name = `${WORKSHOP_FORMATS[format].title} Session`;
    this.state.currentPhaseIndex = 0;
    this.state.timerSecondsRemaining = WORKSHOP_FORMATS[format].phases[0].suggestedDurationMinutes * 60;
    this.logs.push(`Switched format to: ${format}`);
  }

  nextPhase() {
    const totalPhases = this.currentFormatDef.phases.length;
    if (this.state.currentPhaseIndex < totalPhases - 1) {
      this.state.currentPhaseIndex++;
      this.state.timerSecondsRemaining = this.currentPhase.suggestedDurationMinutes * 60;
      this.logs.push(`Advanced to phase ${this.state.currentPhaseIndex + 1}: ${this.currentPhase.title}`);
    }
  }

  prevPhase() {
    if (this.state.currentPhaseIndex > 0) {
      this.state.currentPhaseIndex--;
      this.state.timerSecondsRemaining = this.currentPhase.suggestedDurationMinutes * 60;
      this.logs.push(`Returned to phase ${this.state.currentPhaseIndex + 1}: ${this.currentPhase.title}`);
    }
  }

  startTimer() {
    this.state.timerIsRunning = true;
    this.state.timerLastTickAt = Date.now();
  }

  pauseTimer() {
    this.state.timerIsRunning = false;
  }

  resetTimer(minutes?: number) {
    const duration = minutes ? minutes * 60 : this.currentPhase.suggestedDurationMinutes * 60;
    this.state.timerIsRunning = false;
    this.state.timerSecondsRemaining = duration;
    this.state.timerLastTickAt = Date.now();
  }

  spawnSticky(type: StickyType, text: string, x: number, y: number, author = 'Facilitator'): StickyNote {
    const def = STICKY_DEFINITIONS[type];
    if (!def) {
      throw new Error(`Unknown sticky type: ${type}`);
    }
    const sticky: StickyNote = {
      id: `sticky-${crypto.randomUUID()}`,
      type,
      text,
      x,
      y,
      votes: 0,
      authorName: author,
      authorColor: '#f97316',
      updatedAt: Date.now(),
    };
    this.state.stickies.push(sticky);
    return sticky;
  }

  voteSticky(id: string, delta: number) {
    const sticky = this.state.stickies.find((s) => s.id === id);
    if (sticky) {
      sticky.votes = Math.max(0, (sticky.votes || 0) + delta);
      sticky.updatedAt = Date.now();
    }
  }

  addPivotalLine(name: string, x: number, color = '#FF9F1C'): PivotalLine {
    const line: PivotalLine = {
      id: `piv-${crypto.randomUUID()}`,
      name,
      x,
      color,
    };
    this.state.pivotalLines.push(line);
    return line;
  }

  addSwimlane(name: string, y: number, height: number, color = '#38bdf8'): Swimlane {
    const lane: Swimlane = {
      id: `lane-${crypto.randomUUID()}`,
      name,
      y,
      height,
      color,
    };
    this.state.swimlanes.push(lane);
    return lane;
  }

  loadTemplate(templateKey: string) {
    const template = SAMPLE_TEMPLATES[templateKey];
    if (!template) {
      throw new Error(`Template not found: ${templateKey}`);
    }
    this.state.format = template.format;
    this.state.name = template.title;
    this.state.currentPhaseIndex = 0;
    this.state.stickies = template.stickies.map((s) => ({
      ...s,
      updatedAt: Date.now(),
    }));
    this.state.pivotalLines = [...template.pivotalLines];
    this.state.swimlanes = [...template.swimlanes];
  }

  exportMarkdown(): string {
    const formatDef = WORKSHOP_FORMATS[this.state.format];
    const events = this.state.stickies
      .filter((s) => s.type === 'domain-event')
      .sort((a, b) => a.x - b.x);
    const hotspots = this.state.stickies
      .filter((s) => s.type === 'hotspot')
      .sort((a, b) => b.votes - a.votes);
    const actors = this.state.stickies.filter((s) => s.type === 'actor');
    const systems = this.state.stickies.filter((s) => s.type === 'system');
    const commands = this.state.stickies.filter((s) => s.type === 'command');
    const policies = this.state.stickies.filter((s) => s.type === 'policy');
    const readmodels = this.state.stickies.filter((s) => s.type === 'readmodel');
    const constraints = this.state.stickies.filter((s) => s.type === 'constraint');
    const opportunities = this.state.stickies.filter((s) => s.type === 'opportunity');
    const values = this.state.stickies.filter((s) => s.type === 'value');

    return [
      `# EventStorming Summary: ${this.state.id}`,
      `**Format**: ${formatDef.title}`,
      `**Name**: ${this.state.name}`,
      ``,
      `## 1. Chronological Timeline of Domain Events (${events.length})`,
      events.length === 0
        ? '*No domain events recorded.*'
        : events.map((e, idx) => `${idx + 1}. **${e.text}** (x: ${e.x}${e.votes > 0 ? `, ${e.votes} votes` : ''})`).join('\n'),
      ``,
      `## 2. Hotspots & Identified Risks (${hotspots.length})`,
      hotspots.length === 0
        ? '*No hotspots identified.*'
        : hotspots.map((h) => `- 🔥 **${h.text}** (${h.votes} votes)`).join('\n'),
      ``,
      `## 3. Actors & Systems`,
      actors.map((a) => `- 👤 Actor: ${a.text}`).join('\n') || '*No actors.*',
      systems.map((s) => `- 🏢 System: ${s.text}`).join('\n') || '*No external systems.*',
      ``,
      `## 4. Commands & Policies`,
      commands.map((c) => `- ⚡ Command: ${c.text}`).join('\n') || '*No commands.*',
      policies.map((p) => `- 📜 Policy: ${p.text}`).join('\n') || '*No policies.*',
      ``,
      `## 5. Read Models & Preconditions (${readmodels.length})`,
      readmodels.map((r) => `- 📖 Read Model: ${r.text}`).join('\n') || '*No read models.*',
      ``,
      `## 6. Aggregates & Invariant Constraints (${constraints.length})`,
      constraints.map((c) => `- 🛡️ Aggregate/Constraint: ${c.text}`).join('\n') || '*No constraints.*',
      ``,
      `## 7. Opportunities & Value Metrics`,
      opportunities.map((o) => `- 💡 Opportunity: ${o.text}`).join('\n') || '*No opportunities.*',
      values.map((v) => `- 💎 Value: ${v.text}`).join('\n') || '*No value items.*',
      ``,
      `## 8. Milestones & Swimlanes`,
      this.state.pivotalLines.map((l) => `- 🏁 Milestone: ${l.name} (x: ${l.x})`).join('\n') || '*No pivotal milestones.*',
      this.state.swimlanes.map((s) => `- 🏊 Lane: ${s.name} (y: ${s.y})`).join('\n') || '*No swimlanes.*',
    ].join('\n');
  }
}

describe('End-to-End Facilitation for All Three EventStorming Variants', () => {
  it('facilitates Variant 1: Big Picture EventStorming through all 8 phases', () => {
    const session = new WorkshopFacilitationSession('bp-workshop-1', 'big-picture');

    expect(session.state.format).toBe('big-picture');
    expect(session.currentFormatDef.phases).toHaveLength(8);

    // Phase 1: Check-in & Setting Scope
    expect(session.currentPhase.number).toBe(1);
    expect(session.currentPhase.title).toContain('Check-In');
    expect(session.state.timerSecondsRemaining).toBe(10 * 60);

    // Phase 2: Chaotic Event Generation
    session.nextPhase();
    expect(session.currentPhase.number).toBe(2);
    expect(session.currentPhase.title).toContain('Chaotic Event Generation');
    session.startTimer();
    expect(session.state.timerIsRunning).toBe(true);

    const ev1 = session.spawnSticky('domain-event', 'Order Placed', 300, 200);
    const ev2 = session.spawnSticky('domain-event', 'Payment Received', 600, 250);
    const ev3 = session.spawnSticky('domain-event', 'Package Shipped', 900, 220);

    expect(ev1.type).toBe('domain-event');
    expect(STICKY_DEFINITIONS[ev1.type].color.toUpperCase()).toBe('#FF9F1C');
    expect(session.state.stickies).toHaveLength(3);

    // Phase 3: Enforcing Timeline & Pivotal Events
    session.nextPhase();
    expect(session.currentPhase.number).toBe(3);
    expect(session.currentPhase.title).toContain('Enforcing Timeline & Pivotal Events');

    const piv1 = session.addPivotalLine('Payment Cleared', 500);
    const piv2 = session.addPivotalLine('Order Fulfilled', 850);
    expect(session.state.pivotalLines).toHaveLength(2);
    expect(piv1.x).toBeLessThan(piv2.x);

    // Phase 4: Reverse Narrative & Friction Capture
    session.nextPhase();
    expect(session.currentPhase.number).toBe(4);
    expect(session.currentPhase.title).toContain('Reverse Narrative');

    const hot1 = session.spawnSticky('hotspot', 'Inventory oversold during flash sale', 450, 350);
    expect(hot1.type).toBe('hotspot');
    expect(STICKY_DEFINITIONS[hot1.type].color.toUpperCase()).toBe('#FF2E88');
    expect(STICKY_DEFINITIONS[hot1.type].geometry.rotation).toBe(-6);

    // Phase 5: People & Systems
    session.nextPhase();
    expect(session.currentPhase.number).toBe(5);
    expect(session.currentPhase.title).toContain('People & Systems');

    const actor1 = session.spawnSticky('actor', 'Online Buyer', 200, 180);
    const sys1 = session.spawnSticky('system', 'Payment Gateway (Stripe)', 620, 380);
    expect(STICKY_DEFINITIONS[actor1.type].color.toUpperCase()).toBe('#FFD43B');
    expect(STICKY_DEFINITIONS[sys1.type].color.toUpperCase()).toBe('#F7B7D2');

    // Phase 6: Opportunities & Value
    session.nextPhase();
    expect(session.currentPhase.number).toBe(6);
    expect(session.currentPhase.title).toContain('Opportunities & Value');
    const opp1 = session.spawnSticky('opportunity', 'One-click checkout increases conversion by 15%', 350, 420);
    const val1 = session.spawnSticky('value', '+15% Checkout Conversion', 350, 520);
    expect(STICKY_DEFINITIONS[opp1.type].color.toUpperCase()).toBe('#2FA84F');
    expect(STICKY_DEFINITIONS[val1.type].color.toUpperCase()).toBe('#2FA84F');
    // Phase 7: Dot Voting on Hotspots
    session.nextPhase();
    expect(session.currentPhase.number).toBe(7);
    expect(session.currentPhase.title).toContain('Dot Voting');

    session.voteSticky(hot1.id, 1);
    session.voteSticky(hot1.id, 1);
    session.voteSticky(hot1.id, 1);
    expect(session.state.stickies.find((s) => s.id === hot1.id)?.votes).toBe(3);

    // Phase 8: Synthesis & Action Items
    session.nextPhase();
    expect(session.currentPhase.number).toBe(8);
    expect(session.currentPhase.title).toContain('Synthesis');

    const markdown = session.exportMarkdown();
    expect(markdown).toContain('Big Picture EventStorming');
    expect(markdown).toContain('Order Placed');
    expect(markdown).toContain('Payment Received');
    expect(markdown).toContain('Inventory oversold during flash sale');
    expect(markdown).toContain('3 votes');
    expect(markdown).toContain('Online Buyer');
    expect(markdown).toContain('Payment Gateway (Stripe)');
    expect(markdown).toContain('One-click checkout');
    expect(markdown).toContain('Payment Cleared');
  });

  it('facilitates Variant 2: Process Modelling EventStorming through all 6 phases', () => {
    const session = new WorkshopFacilitationSession('pm-workshop-1', 'process-modelling');

    expect(session.state.format).toBe('process-modelling');
    expect(session.currentFormatDef.phases).toHaveLength(6);

    // Phase 1: Scope Boundary & Happy Path
    expect(session.currentPhase.number).toBe(1);
    expect(session.currentPhase.title).toContain('Scope Boundary & Happy Path');

    const cmd1 = session.spawnSticky('command', 'Submit Insurance Claim', 150, 150);
    const evt1 = session.spawnSticky('domain-event', 'Claim Submitted', 350, 150);
    expect(STICKY_DEFINITIONS[cmd1.type].color.toUpperCase()).toBe('#6FB7FF');

    // Phase 2: Commands & Users
    session.nextPhase();
    expect(session.currentPhase.number).toBe(2);
    expect(session.currentPhase.title).toContain('Commands & Users');

    const actor = session.spawnSticky('actor', 'Policy Holder', 150, 50);
    expect(actor.type).toBe('actor');

    // Phase 3: Policies & Automation Rules
    session.nextPhase();
    expect(session.currentPhase.number).toBe(3);
    expect(session.currentPhase.title).toContain('Policies & Automation Rules');

    const pol1 = session.spawnSticky('policy', 'Whenever Claim Submitted Then Verify Active Policy', 550, 150);
    expect(pol1.type).toBe('policy');
    expect(STICKY_DEFINITIONS[pol1.type].color.toUpperCase()).toBe('#C9A7EB');
    // Phase 4: Information & Read Models
    session.nextPhase();
    expect(session.currentPhase.number).toBe(4);
    expect(session.currentPhase.title).toContain('Information & Read Models');

    const rm1 = session.spawnSticky('readmodel', 'Policy Coverage & Deductible Details', 150, 270);
    expect(rm1.type).toBe('readmodel');
    expect(STICKY_DEFINITIONS[rm1.type].color.toUpperCase()).toBe('#C6F2B0');
    session.nextPhase();
    expect(session.currentPhase.number).toBe(5);
    expect(session.currentPhase.title).toContain('Exceptional Flows');

    const evtRejected = session.spawnSticky('domain-event', 'Claim Rejected (Expired Policy)', 750, 250);
    const hotRejected = session.spawnSticky('hotspot', 'Manual appeal process takes 14 days', 750, 370);
    session.voteSticky(hotRejected.id, 2);

    // Phase 6: Validation & Wrap-up
    session.nextPhase();
    expect(session.currentPhase.number).toBe(6);
    expect(session.currentPhase.title).toContain('Validation & Wrap-up');

    // Add swimlanes for clarity
    session.addSwimlane('Customer Tier', 0, 200, '#38bdf8');
    session.addSwimlane('Claims Adjudication Engine', 220, 250, '#f59e0b');

    const summary = session.exportMarkdown();
    expect(summary).toContain('Process Modelling EventStorming');
    expect(summary).toContain('Submit Insurance Claim');
    expect(summary).toContain('Whenever Claim Submitted Then Verify Active Policy');
    expect(summary).toContain('Policy Coverage & Deductible Details');
    expect(summary).toContain('Claim Rejected (Expired Policy)');
    expect(summary).toContain('Manual appeal process takes 14 days');
    expect(summary).toContain('Customer Tier');
  });

  it('facilitates Variant 3: Software Design EventStorming through all 4 phases', () => {
    const session = new WorkshopFacilitationSession('sd-workshop-1', 'software-design');

    expect(session.state.format).toBe('software-design');
    expect(session.currentFormatDef.phases).toHaveLength(4);

    // Phase 1: Command Triggers & Preconditions
    expect(session.currentPhase.number).toBe(1);
    expect(session.currentPhase.title).toContain('Command Triggers & Preconditions');

    const cmd = session.spawnSticky('command', 'Dispatch Driver', 150, 150);
    const rm = session.spawnSticky('readmodel', 'Nearby Available Drivers (H3 Index)', 150, 270);
    expect(cmd.type).toBe('command');
    expect(rm.type).toBe('readmodel');

    // Phase 2: Aggregates & Invariant Boundaries
    session.nextPhase();
    expect(session.currentPhase.number).toBe(2);
    expect(session.currentPhase.title).toContain('Aggregates & Invariant Boundaries');

    const agg = session.spawnSticky(
      'constraint',
      'RideDispatchAggregate\n- Invariant: Driver must be active\n- Invariant: Max dispatch radius 5km',
      350,
      150
    );
    const evtDispatched = session.spawnSticky('domain-event', 'Driver Dispatched', 600, 150);
    expect(agg.type).toBe('constraint');
    expect(STICKY_DEFINITIONS[agg.type].color.toUpperCase()).toBe('#FFF7B8');

    // Phase 3: Policies, Pub/Sub & Async Flows
    session.nextPhase();
    expect(session.currentPhase.number).toBe(3);
    expect(session.currentPhase.title).toContain('Policies, Pub/Sub & Async Flows');

    const polAsync = session.spawnSticky(
      'policy',
      'Whenever Driver Dispatched Then Notify Passenger via Push Notification',
      800,
      150
    );
    const extSys = session.spawnSticky('system', 'FCM / APNS Push Gateway', 1050, 150);
    expect(polAsync.type).toBe('policy');
    expect(extSys.type).toBe('system');

    // Phase 4: Bounded Context Partitions & APIs
    session.nextPhase();
    expect(session.currentPhase.number).toBe(4);
    expect(session.currentPhase.title).toContain('Bounded Context Partitions & APIs');

    const hotApi = session.spawnSticky('hotspot', 'WebSocket reconnect storm on mobile cell handover', 800, 300);
    const oppArch = session.spawnSticky('opportunity', 'Adopt MQTT for low-bandwidth driver heartbeat telemetry', 1050, 300);
    session.voteSticky(hotApi.id, 4);

    const summary = session.exportMarkdown();
    expect(summary).toContain('Software Design EventStorming');
    expect(summary).toContain('RideDispatchAggregate');
    expect(summary).toContain('Nearby Available Drivers (H3 Index)');
    expect(summary).toContain('Driver Dispatched');
    expect(summary).toContain('FCM / APNS Push Gateway');
    expect(summary).toContain('WebSocket reconnect storm');
    expect(summary).toContain('Adopt MQTT');
  });

  it('validates template loading for all three variants and preserves invariant integrity', () => {
    const session = new WorkshopFacilitationSession('templates-check');

    // 1. Big picture template
    session.loadTemplate('ecommerce-fulfillment');
    expect(session.state.format).toBe('big-picture');
    expect(session.state.stickies.length).toBeGreaterThan(15);
    expect(session.state.pivotalLines.length).toBe(3);
    expect(session.state.swimlanes.length).toBe(3);

    // 2. Process modelling template
    session.loadTemplate('insurance-claims');
    expect(session.state.format).toBe('process-modelling');
    expect(session.state.stickies.some((s) => s.type === 'command')).toBe(true);
    expect(session.state.stickies.some((s) => s.type === 'policy')).toBe(true);
    expect(session.state.stickies.some((s) => s.type === 'readmodel')).toBe(true);

    // 3. Software design template
    session.loadTemplate('ride-hailing-dispatch');
    expect(session.state.format).toBe('software-design');
    expect(session.state.stickies.some((s) => s.type === 'constraint')).toBe(true);
    expect(session.state.stickies.some((s) => s.type === 'system')).toBe(true);
  });

  it('verifies that all three variants have video walkthrough files and an ad promo video', () => {
    const requiredVideos = [
      'public/videos/big-picture.mp4',
      'public/videos/process-modelling.mp4',
      'public/videos/software-design.mp4',
      'public/videos/ad-promo.mp4',
    ];

    for (const vid of requiredVideos) {
      const fullPath = path.resolve(vid);
      expect(fs.existsSync(fullPath)).toBe(true);
      const stat = fs.statSync(fullPath);
      expect(stat.size).toBeGreaterThan(100000); // Valid non-empty video file (>100KB)
    }
  });
});
