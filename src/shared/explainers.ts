import type { StickyType } from './eventstorming';

export interface StickyExplainer {
  what: string;
  example: string;
  ask: string;
}

export const STICKY_EXPLAINERS: Record<StickyType, StickyExplainer> = {
  'domain-event': {
    what: 'Something that already happened in the business, written as a past-tense fact. Events are the backbone of the whole board.',
    example: 'Order Placed',
    ask: 'What happened that someone in the business cares about?',
  },
  hotspot: {
    what: 'A problem, open question, or disagreement. Put it on the board instead of arguing. The group comes back to it later.',
    example: 'Nobody knows who approves refunds?',
    ask: 'What confuses or worries you here?',
  },
  actor: {
    what: 'A person or role who does something in the process.',
    example: 'Customer',
    ask: 'Who starts this or takes part in it?',
  },
  system: {
    what: 'Software or an outside company the process depends on.',
    example: 'Stripe',
    ask: 'Which tool or partner is involved?',
  },
  opportunity: {
    what: 'An idea to make something better.',
    example: 'Offer one-click reorder',
    ask: 'What could we do better here?',
  },
  command: {
    what: 'An action someone decides to take. A command is what causes an event. Write it as an instruction.',
    example: 'Place Order',
    ask: 'What did the person ask for or decide to do?',
  },
  policy: {
    what: 'An automatic rule: whenever this happens, do that.',
    example: 'Whenever Payment Received, then Ship Order',
    ask: 'What always follows this event?',
  },
  readmodel: {
    what: 'The information a person needs to see on screen before they can decide.',
    example: 'Stock Availability',
    ask: 'What must they see before they decide?',
  },
  constraint: {
    what: 'A rule that must always stay true, or a group of data that must change together.',
    example: 'An order cannot be shipped twice',
    ask: 'What must never be broken?',
  },
  value: {
    what: 'Money or customers gained (+) or lost (-).',
    example: '+ Profit',
    ask: 'What does this earn or cost us?',
  },
};

export interface ToolExplainer {
  label: string;
  what: string;
  how: string;
}

export const TOOL_EXPLAINERS: Record<'select' | 'pan' | 'pivotal' | 'swimlane', ToolExplainer> = {
  select: {
    label: 'Select / Move',
    what: 'Pick up stickies and move them around.',
    how: 'Drag a sticky to move it. Drag on empty board to select several. Shift+click adds to the selection.',
  },
  pan: {
    label: 'Pan / Scroll',
    what: 'Slide the board around to see other areas.',
    how: 'Drag the board. Shortcut: hold Space while dragging.',
  },
  pivotal: {
    label: 'Milestone Line',
    what: 'A vertical line that marks a major turning point in the story, such as "Order Confirmed". It splits the timeline into stages.',
    how: 'Click this, then click an empty spot on the board.',
  },
  swimlane: {
    label: 'Swimlane',
    what: 'A horizontal lane that groups stickies by team, system, or topic.',
    how: 'Click this, then click an empty spot on the board.',
  },
};

export const GLOSSARY_READING_ORDER: StickyType[] = [
  'domain-event',
  'actor',
  'command',
  'policy',
  'readmodel',
  'system',
  'constraint',
  'hotspot',
  'opportunity',
];
