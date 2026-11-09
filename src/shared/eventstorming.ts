// Alberto Brandolini EventStorming Domain Model & Types

export type StickyType =
  | 'domain-event'
  | 'hotspot'
  | 'actor'
  | 'system'
  | 'opportunity'
  | 'command'
  | 'policy'
  | 'readmodel'
  | 'constraint'
  | 'value';

export interface StickyGeometry {
  width: number;
  height: number;
  rotation?: number; // degrees, e.g. -6 for hotspots
  shape: 'square' | 'rect-wide' | 'compact-square' | 'large-square' | 'chip';
}

export interface StickyMeta {
  type: StickyType;
  label: string;
  description: string;
  color: string;
  textColor: string;
  borderClass?: string;
  geometry: StickyGeometry;
  syntaxHint: string;
}

export const STICKY_DEFINITIONS: Record<StickyType, StickyMeta> = {
  'domain-event': {
    type: 'domain-event',
    label: 'Domain Event',
    description: 'Something relevant that happened in the domain in the past tense.',
    color: '#FF9F1C',
    textColor: '#1a1a1a',
    geometry: { width: 140, height: 140, shape: 'square' },
    syntaxHint: 'Past tense verb (e.g. Order Placed, Invoice Sent)',
  },
  'hotspot': {
    type: 'hotspot',
    label: 'Hotspot',
    description: 'Friction, unresolved question, conflict, or risk.',
    color: '#FF2E88',
    textColor: '#ffffff',
    geometry: { width: 140, height: 140, rotation: -6, shape: 'square' },
    syntaxHint: 'Risk, dilemma, or dispute (? or !)',
  },
  'actor': {
    type: 'actor',
    label: 'Actor / User',
    description: 'A person, role, persona, or external user initiating actions.',
    color: '#FFD43B',
    textColor: '#1a1a1a',
    geometry: { width: 110, height: 110, shape: 'compact-square' },
    syntaxHint: 'Role or Persona (e.g. Buyer, Dispatcher)',
  },
  'system': {
    type: 'system',
    label: 'External System',
    description: 'A tool, external software service, legacy system, or 3rd-party API.',
    color: '#F7B7D2',
    textColor: '#2d0a1e',
    geometry: { width: 180, height: 100, shape: 'rect-wide' },
    syntaxHint: 'System name (e.g. Stripe, SAP, Legacy DB)',
  },
  'opportunity': {
    type: 'opportunity',
    label: 'Opportunity',
    description: 'Positive improvement idea, growth vector, or creative breakthrough.',
    color: '#2FA84F',
    textColor: '#ffffff',
    geometry: { width: 140, height: 140, shape: 'square' },
    syntaxHint: 'Actionable opportunity / new capability',
  },
  'command': {
    type: 'command',
    label: 'Command',
    description: 'A decision, user intent, or triggered operation.',
    color: '#6FB7FF',
    textColor: '#0c2744',
    geometry: { width: 140, height: 140, shape: 'square' },
    syntaxHint: 'Imperative present tense (e.g. Submit Order, Cancel Flight)',
  },
  'policy': {
    type: 'policy',
    label: 'Policy / Business Rule',
    description: 'Reactive logic connecting events to downstream actions.',
    color: '#C9A7EB',
    textColor: '#29143d',
    geometry: { width: 180, height: 100, shape: 'rect-wide' },
    syntaxHint: 'Whenever [Event] Then [Command]',
  },
  'readmodel': {
    type: 'readmodel',
    label: 'Read Model / View',
    description: 'Information or projections needed to make a decision.',
    color: '#C6F2B0',
    textColor: '#153308',
    geometry: { width: 140, height: 140, shape: 'square' },
    syntaxHint: 'Screen or query view (e.g. Stock Availability)',
  },
  'constraint': {
    type: 'constraint',
    label: 'Aggregate / Constraint',
    description: 'Consistency boundary, invariant rule, or transactional cluster.',
    color: '#FFF7B8',
    textColor: '#332e08',
    geometry: { width: 170, height: 170, shape: 'large-square' },
    syntaxHint: 'Business invariant or Domain Aggregate',
  },
  'value': {
    type: 'value',
    label: 'Value Metric',
    description: 'Created (+) or destroyed (-) business value / metric impact.',
    color: '#2FA84F',
    textColor: '#ffffff',
    geometry: { width: 100, height: 60, shape: 'chip' },
    syntaxHint: '+ Profit / - Churn / $ Cost',
  },
};

export interface StickyNote {
  id: string;
  type: StickyType;
  text: string;
  x: number;
  y: number;
  votes: number; // dot-voting count
  authorName?: string;
  authorColor?: string;
  customColor?: string;
  updatedAt: number;
  breakoutRoomId?: string;
}

export interface PivotalLine {
  id: string;
  name: string;
  x: number;
  color?: string;
}

export interface Swimlane {
  id: string;
  name: string;
  y: number;
  height: number;
  color?: string;
}

export interface BreakoutRoom {
  id: string;
  name: string;
  color?: string;
  participantCount?: number;
}

export interface BreakoutSessionState {
  active: boolean;
  rooms: BreakoutRoom[];
  startedAt?: number;
  durationMinutes?: number;
}

export type WorkshopFormat = 'big-picture' | 'process-modelling' | 'software-design';

export interface PhaseGuide {
  id: string;
  number: number;
  title: string;
  goal: string;
  instructions: string;
  suggestedStickies: StickyType[];
  suggestedDurationMinutes: number;
}

export interface WorkshopFormatMeta {
  id: WorkshopFormat;
  title: string;
  subtitle: string;
  description: string;
  phases: PhaseGuide[];
}

export const WORKSHOP_FORMATS: Record<WorkshopFormat, WorkshopFormatMeta> = {
  'big-picture': {
    id: 'big-picture',
    title: 'Big Picture EventStorming',
    subtitle: 'Explore complex business processes end-to-end across departmental boundaries',
    description: 'Uncovers the whole business flow, highlights misalignments, bottlenecks, and conflicting terminology.',
    phases: [
      {
        id: 'bp-1',
        number: 1,
        title: 'Check-In & Setting Scope',
        goal: 'Clarify the domain boundary and time horizon.',
        instructions: 'Agree on where the journey starts and ends. Define the business ambition.',
        suggestedStickies: ['domain-event'],
        suggestedDurationMinutes: 10,
      },
      {
        id: 'bp-2',
        number: 2,
        title: 'Chaotic Event Generation',
        goal: 'Generate as many domain events as possible in complete chaos.',
        instructions: 'Every participant silently writes orange stickies in past tense verbs (e.g. "Order Placed"). No discussions yet!',
        suggestedStickies: ['domain-event'],
        suggestedDurationMinutes: 15,
      },
      {
        id: 'bp-3',
        number: 3,
        title: 'Enforcing Timeline & Pivotal Events',
        goal: 'Sequence events from left to right along time.',
        instructions: 'Merge duplicates, resolve parallel tracks, and place vertical Pivotal Lines for major milestones.',
        suggestedStickies: ['domain-event'],
        suggestedDurationMinutes: 25,
      },
      {
        id: 'bp-4',
        number: 4,
        title: 'Reverse Narrative & Friction Capture',
        goal: 'Read the story backwards from right to left to uncover missing steps.',
        instructions: 'Add neon-pink Hotspots wherever questions, risks, or disputes emerge.',
        suggestedStickies: ['domain-event', 'hotspot'],
        suggestedDurationMinutes: 20,
      },
      {
        id: 'bp-5',
        number: 5,
        title: 'People & Systems',
        goal: 'Attach human actors and external software systems to the events.',
        instructions: 'Place yellow Actor stickies and wide pink External System stickies next to corresponding events.',
        suggestedStickies: ['actor', 'system'],
        suggestedDurationMinutes: 20,
      },
      {
        id: 'bp-6',
        number: 6,
        title: 'Opportunities & Value',
        goal: 'Capture quick wins, breakthrough ideas, and value metrics.',
        instructions: 'Place green Opportunity stickies and Value chips where high upside exists.',
        suggestedStickies: ['opportunity', 'value'],
        suggestedDurationMinutes: 15,
      },
      {
        id: 'bp-7',
        number: 7,
        title: 'Dot Voting on Hotspots',
        goal: 'Prioritize key bottlenecks and systemic issues.',
        instructions: 'Every participant gets 3 votes to place on the most critical Hotspots.',
        suggestedStickies: ['hotspot'],
        suggestedDurationMinutes: 10,
      },
      {
        id: 'bp-8',
        number: 8,
        title: 'Synthesis & Action Items',
        goal: 'Agree on subsequent deep dives and architectural initiatives.',
        instructions: 'Assign owners to the top voted hotspots. Export board snapshot.',
        suggestedStickies: ['opportunity'],
        suggestedDurationMinutes: 15,
      },
    ],
  },
  'process-modelling': {
    id: 'process-modelling',
    title: 'Process Modelling EventStorming',
    subtitle: 'Design specific workflows, validation policies, and exceptional business cases',
    description: 'Clarifies exact business rules, command triggers, policies, and service integrations for a specific sub-domain.',
    phases: [
      {
        id: 'pm-1',
        number: 1,
        title: 'Scope Boundary & Happy Path',
        goal: 'Establish the core trigger and successful outcome.',
        instructions: 'Lay out the main happy path using Commands, Policies, and Events.',
        suggestedStickies: ['command', 'domain-event'],
        suggestedDurationMinutes: 15,
      },
      {
        id: 'pm-2',
        number: 2,
        title: 'Commands & Users',
        goal: 'Determine exactly who issues each decision.',
        instructions: 'Place blue Commands triggered by yellow Actors.',
        suggestedStickies: ['actor', 'command'],
        suggestedDurationMinutes: 15,
      },
      {
        id: 'pm-3',
        number: 3,
        title: 'Policies & Automation Rules',
        goal: 'Codify "Whenever [Event] Then [Command]" reactive logic.',
        instructions: 'Add lilac Policy stickies between causal events and reactive commands.',
        suggestedStickies: ['policy'],
        suggestedDurationMinutes: 20,
      },
      {
        id: 'pm-4',
        number: 4,
        title: 'Information & Read Models',
        goal: 'Identify what data the user or system needs to decide.',
        instructions: 'Add light green Read Model stickies providing inputs to commands.',
        suggestedStickies: ['readmodel'],
        suggestedDurationMinutes: 15,
      },
      {
        id: 'pm-5',
        number: 5,
        title: 'Exceptional Flows & Failures',
        goal: 'Walk through timeouts, rejections, chargebacks, and cancellations.',
        instructions: 'Add alternative branch paths and neon-pink Hotspots.',
        suggestedStickies: ['domain-event', 'hotspot'],
        suggestedDurationMinutes: 25,
      },
      {
        id: 'pm-6',
        number: 6,
        title: 'Validation & Wrap-up',
        goal: 'Verify the complete narrative and document clear specifications.',
        instructions: 'Read through with subject matter experts to guarantee completeness.',
        suggestedStickies: ['opportunity'],
        suggestedDurationMinutes: 15,
      },
    ],
  },
  'software-design': {
    id: 'software-design',
    title: 'Software Design EventStorming',
    subtitle: 'Derive DDD aggregates, bounded contexts, and synchronous vs asynchronous contracts',
    description: 'Transforms collaborative business requirements into concrete microservices, transactional aggregates, and event contracts.',
    phases: [
      {
        id: 'sd-1',
        number: 1,
        title: 'Command Triggers & Preconditions',
        goal: 'Map inputs to transactional boundaries.',
        instructions: 'Align incoming Commands with their required Read Models.',
        suggestedStickies: ['command', 'readmodel'],
        suggestedDurationMinutes: 20,
      },
      {
        id: 'sd-2',
        number: 2,
        title: 'Aggregates & Invariant Boundaries',
        goal: 'Group operations into transactional consistency boundaries.',
        instructions: 'Enclose commands and generated events in large pale-yellow Aggregate / Constraint stickies.',
        suggestedStickies: ['constraint', 'domain-event'],
        suggestedDurationMinutes: 30,
      },
      {
        id: 'sd-3',
        number: 3,
        title: 'Policies, Pub/Sub & Async Flows',
        goal: 'Define asynchronous pub/sub event integration across bounded contexts.',
        instructions: 'Connect aggregate events to downstream reactive policies and external webhooks.',
        suggestedStickies: ['policy', 'system'],
        suggestedDurationMinutes: 25,
      },
      {
        id: 'sd-4',
        number: 4,
        title: 'Bounded Context Partitions & APIs',
        goal: 'Carve out microservices or modular monolith boundaries.',
        instructions: 'Highlight architectural risks with Hotspots and note API contract opportunities.',
        suggestedStickies: ['hotspot', 'opportunity'],
        suggestedDurationMinutes: 20,
      },
    ],
  },
};

export interface WorkspaceState {
  id: string;
  name: string;
  format: WorkshopFormat;
  currentPhaseIndex: number;
  timerSecondsRemaining: number;
  timerIsRunning: boolean;
  timerLastTickAt: number;
  stickies: StickyNote[];
  pivotalLines: PivotalLine[];
  swimlanes: Swimlane[];
  breakoutSession?: BreakoutSessionState;
}

export interface PeerCursor {
  clientId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  lastActive: number;
  breakoutRoomId?: string;
}

// WebSocket message protocols
export type ClientMessage =
  | { type: 'join'; clientId: string; name: string; color: string }
  | { type: 'cursor'; clientId: string; x: number; y: number }
  | { type: 'sticky:upsert'; sticky: StickyNote }
  | { type: 'sticky:batch-move'; updates: Array<{ id: string; x: number; y: number }> }
  | { type: 'sticky:delete'; id: string }
  | { type: 'sticky:vote'; id: string; delta: number }
  | { type: 'pivotal:upsert'; line: PivotalLine }
  | { type: 'pivotal:delete'; id: string }
  | { type: 'swimlane:upsert'; lane: Swimlane }
  | { type: 'swimlane:delete'; id: string }
  | { type: 'workspace:set-format'; format: WorkshopFormat }
  | { type: 'workspace:set-phase'; phaseIndex: number }
  | { type: 'workspace:timer'; isRunning: boolean; secondsRemaining?: number }
  | { type: 'workspace:load-template'; templateKey: string }
  | { type: 'breakout:start'; rooms: BreakoutRoom[]; durationMinutes: number }
  | { type: 'breakout:join'; roomId: string | null }
  | { type: 'breakout:end'; mergeToSwimlanes: boolean }
  | { type: 'webrtc:join'; roomId: string | null }
  | { type: 'webrtc:leave'; roomId: string | null }
  | { type: 'webrtc:signal'; targetClientId: string; roomId: string | null; signal: { type: 'offer' | 'answer' | 'candidate' | 'screenshare' | 'video-effect' | 'media-state'; data: any } };

export type ServerMessage =
  | { type: 'init'; state: WorkspaceState; peers: PeerCursor[]; yourClientId: string }
  | { type: 'peer:update'; peer: PeerCursor }
  | { type: 'peer:leave'; clientId: string }
  | { type: 'sticky:upsert'; sticky: StickyNote }
  | { type: 'sticky:batch-move'; updates: Array<{ id: string; x: number; y: number }> }
  | { type: 'sticky:delete'; id: string }
  | { type: 'sticky:vote'; id: string; votes: number }
  | { type: 'pivotal:upsert'; line: PivotalLine }
  | { type: 'pivotal:delete'; id: string }
  | { type: 'swimlane:upsert'; lane: Swimlane }
  | { type: 'swimlane:delete'; id: string }
  | { type: 'workspace:updated'; format?: WorkshopFormat; phaseIndex?: number; timer?: { isRunning: boolean; secondsRemaining: number } }
  | { type: 'workspace:reloaded'; state: WorkspaceState }
  | { type: 'breakout:state'; session: BreakoutSessionState | null }
  | { type: 'webrtc:peer-joined'; clientId: string; roomId: string | null }
  | { type: 'webrtc:peer-left'; clientId: string; roomId: string | null }
  | { type: 'webrtc:signal'; fromClientId: string; roomId: string | null; signal: { type: 'offer' | 'answer' | 'candidate' | 'screenshare' | 'video-effect' | 'media-state'; data: any } }
  | { type: 'error'; message: string };

// Pre-Packaged Sample Workshops
export interface SampleTemplate {
  key: string;
  title: string;
  format: WorkshopFormat;
  description: string;
  stickies: Omit<StickyNote, 'updatedAt'>[];
  pivotalLines: PivotalLine[];
  swimlanes: Swimlane[];
}

export const SAMPLE_TEMPLATES: Record<string, SampleTemplate> = {
  'ecommerce-fulfillment': {
    key: 'ecommerce-fulfillment',
    title: 'E-Commerce Order Fulfillment (Big Picture)',
    format: 'big-picture',
    description: 'End-to-end customer purchasing, automated fraud checks, inventory reservation, and warehouse carrier shipping.',
    pivotalLines: [
      { id: 'piv-1', name: 'Checkout Complete', x: 750, color: '#FF9F1C' },
      { id: 'piv-2', name: 'Inventory Reserved', x: 1550, color: '#FF9F1C' },
      { id: 'piv-3', name: 'Carrier Hand-off', x: 2350, color: '#FF9F1C' },
    ],
    swimlanes: [
      { id: 'lane-1', name: 'Customer Experience', y: 100, height: 260, color: '#38bdf8' },
      { id: 'lane-2', name: 'Payment & Fraud Engine', y: 380, height: 260, color: '#a78bfa' },
      { id: 'lane-3', name: 'Warehouse & Fulfillment', y: 660, height: 260, color: '#34d399' },
    ],
    stickies: [
      // Customer Lane
      { id: 's-1', type: 'actor', text: 'Online Shopper', x: 120, y: 140, votes: 0 },
      { id: 's-2', type: 'command', text: 'Add Item to Cart', x: 250, y: 130, votes: 0 },
      { id: 's-3', type: 'domain-event', text: 'Item Added to Cart', x: 410, y: 130, votes: 0 },
      { id: 's-4', type: 'readmodel', text: 'Live Cart Total & Taxes', x: 570, y: 130, votes: 0 },
      { id: 's-5', type: 'command', text: 'Submit Order', x: 730, y: 130, votes: 0 },
      { id: 's-6', type: 'domain-event', text: 'Order Placed', x: 890, y: 130, votes: 2 },
      { id: 's-7', type: 'hotspot', text: 'Flash-sale stock race condition causes overselling!', x: 910, y: 280, votes: 5 },

      // Payment Lane
      { id: 's-8', type: 'policy', text: 'Whenever Order Placed Then Authorize Payment', x: 890, y: 410, votes: 0 },
      { id: 's-9', type: 'system', text: 'Stripe Gateway', x: 1090, y: 420, votes: 0 },
      { id: 's-10', type: 'domain-event', text: 'Payment Authorized', x: 1300, y: 410, votes: 0 },
      { id: 's-11', type: 'policy', text: 'Whenever Payment Authorized Then Trigger Fraud Score', x: 1470, y: 410, votes: 0 },
      { id: 's-12', type: 'domain-event', text: 'Fraud Risk Cleared', x: 1680, y: 410, votes: 1 },
      { id: 's-13', type: 'hotspot', text: 'High chargeback rate from international proxy orders', x: 1680, y: 550, votes: 3 },
      { id: 's-14', type: 'value', text: '+ 99.4% Auth Rate', x: 1340, y: 550, votes: 0 },

      // Warehouse Lane
      { id: 's-15', type: 'system', text: 'Manhattan WMS', x: 1700, y: 700, votes: 0 },
      { id: 's-16', type: 'domain-event', text: 'Pick List Generated', x: 1910, y: 690, votes: 0 },
      { id: 's-17', type: 'actor', text: 'Order Picker', x: 1910, y: 840, votes: 0 },
      { id: 's-18', type: 'domain-event', text: 'Items Picked & Boxed', x: 2080, y: 690, votes: 0 },
      { id: 's-19', type: 'domain-event', text: 'Shipping Label Printed', x: 2250, y: 690, votes: 0 },
      { id: 's-20', type: 'opportunity', text: 'Switch to AI automated parcel dimensioning for 12% lower shipping costs', x: 2250, y: 840, votes: 4 },
      { id: 's-21', type: 'domain-event', text: 'Parcel Scanned by DHL', x: 2450, y: 690, votes: 1 },
    ],
  },

  'insurance-claims': {
    key: 'insurance-claims',
    title: 'Insurance Claims Handling (Process Modelling)',
    format: 'process-modelling',
    description: 'First Notice of Loss (FNOL), damage appraisal, policy liability coverage rules, and automated settlement payouts.',
    pivotalLines: [
      { id: 'piv-1', name: 'Claim Registered', x: 650, color: '#FF9F1C' },
      { id: 'piv-2', name: 'Damage Appraised', x: 1400, color: '#FF9F1C' },
      { id: 'piv-3', name: 'Payout Authorized', x: 2150, color: '#FF9F1C' },
    ],
    swimlanes: [
      { id: 'lane-1', name: 'Policyholder / Mobile App', y: 100, height: 260, color: '#38bdf8' },
      { id: 'lane-2', name: 'Adjuster & Appraisal Team', y: 380, height: 260, color: '#f59e0b' },
      { id: 'lane-3', name: 'Finance & Core Ledger', y: 660, height: 260, color: '#10b981' },
    ],
    stickies: [
      { id: 's-101', type: 'actor', text: 'Insured Driver', x: 100, y: 130, votes: 0 },
      { id: 's-102', type: 'command', text: 'Submit First Notice of Loss', x: 230, y: 130, votes: 0 },
      { id: 's-103', type: 'system', text: 'Mobile Claims App', x: 230, y: 280, votes: 0 },
      { id: 's-104', type: 'domain-event', text: 'FNOL Lodged', x: 390, y: 130, votes: 0 },
      { id: 's-105', type: 'policy', text: 'Whenever FNOL Lodged Then Validate Active Coverage', x: 550, y: 130, votes: 0 },
      { id: 's-106', type: 'domain-event', text: 'Coverage Confirmed', x: 740, y: 130, votes: 0 },
      { id: 's-107', type: 'hotspot', text: 'Policyholder deductible ambiguity causes 40% of inbound support calls', x: 740, y: 280, votes: 6 },

      { id: 's-108', type: 'actor', text: 'Field Claims Adjuster', x: 920, y: 400, votes: 0 },
      { id: 's-109', type: 'command', text: 'Upload Damage Photos', x: 1060, y: 400, votes: 0 },
      { id: 's-110', type: 'readmodel', text: 'Computer Vision Repair Estimate', x: 1220, y: 400, votes: 0 },
      { id: 's-111', type: 'domain-event', text: 'Repair Cost Calculated', x: 1380, y: 400, votes: 1 },
      { id: 's-112', type: 'policy', text: 'Whenever Cost <= $3000 Then Fast-Track Instant Payout', x: 1560, y: 400, votes: 0 },
      { id: 's-113', type: 'opportunity', text: 'Auto-approve claims under $1,500 using telematics proof', x: 1560, y: 550, votes: 4 },

      { id: 's-114', type: 'domain-event', text: 'Direct Deposit Queued', x: 1800, y: 680, votes: 0 },
      { id: 's-115', type: 'system', text: 'SEPA / FedNow Core Ledger', x: 1800, y: 820, votes: 0 },
      { id: 's-116', type: 'domain-event', text: 'Funds Deposited into Account', x: 2010, y: 680, votes: 2 },
      { id: 's-117', type: 'domain-event', text: 'Claim Closed with Satisfaction Survey', x: 2200, y: 680, votes: 0 },
    ],
  },

  'ride-hailing-dispatch': {
    key: 'ride-hailing-dispatch',
    title: 'Ride Hailing Dispatch (Software Design)',
    format: 'software-design',
    description: 'DDD tactical patterns, Driver-Rider spatial matching aggregates, location heartbeat telemetry, and pricing policies.',
    pivotalLines: [
      { id: 'piv-1', name: 'Ride Requested', x: 600, color: '#FF9F1C' },
      { id: 'piv-2', name: 'Driver Dispatched', x: 1300, color: '#FF9F1C' },
      { id: 'piv-3', name: 'Trip Completed', x: 2000, color: '#FF9F1C' },
    ],
    swimlanes: [
      { id: 'lane-1', name: 'Passenger Context', y: 100, height: 260, color: '#38bdf8' },
      { id: 'lane-2', name: 'Spatial Matching & Dispatch Context', y: 380, height: 260, color: '#fbbf24' },
      { id: 'lane-3', name: 'Driver Context', y: 660, height: 260, color: '#4ade80' },
    ],
    stickies: [
      { id: 's-201', type: 'command', text: 'Request Ride (Pickup, Dropoff)', x: 120, y: 130, votes: 0 },
      { id: 's-202', type: 'readmodel', text: 'Surge Pricing & ETA Matrix', x: 280, y: 130, votes: 0 },
      { id: 's-203', type: 'constraint', text: 'RideAggregate\n- Invariant: Rider must have verified card\n- Invariant: Pickup within active geo-fence', x: 440, y: 110, votes: 1 },
      { id: 's-204', type: 'domain-event', text: 'RideRequested', x: 630, y: 130, votes: 0 },

      { id: 's-205', type: 'policy', text: 'Whenever RideRequested Then Query H3 Hexagon Spatial Ring (k=2)', x: 630, y: 400, votes: 0 },
      { id: 's-206', type: 'system', text: 'Redis Geospatial / H3 Index', x: 840, y: 410, votes: 0 },
      { id: 's-207', type: 'constraint', text: 'DispatchBatchAggregate\n- Atomic lock on candidate drivers for 15s\n- Re-rank by proximity + driver rating', x: 1050, y: 390, votes: 3 },
      { id: 's-208', type: 'domain-event', text: 'OfferSentToDriver', x: 1260, y: 400, votes: 0 },
      { id: 's-209', type: 'hotspot', text: 'Driver 15-second response timeout cascades into slow rematching loops', x: 1260, y: 550, votes: 7 },

      { id: 's-210', type: 'actor', text: 'Driver', x: 1470, y: 680, votes: 0 },
      { id: 's-211', type: 'command', text: 'Accept Trip Offer', x: 1600, y: 680, votes: 0 },
      { id: 's-212', type: 'domain-event', text: 'TripAssignedToDriver', x: 1770, y: 680, votes: 0 },
      { id: 's-213', type: 'policy', text: 'Whenever TripAssigned Then Stream Driver GPS Path to Passenger', x: 1950, y: 680, votes: 0 },
      { id: 's-214', type: 'opportunity', text: 'Predictive prepositioning dispatch for 18% lower rider wait times', x: 1950, y: 830, votes: 5 },
    ],
  },
};
