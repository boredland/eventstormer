import React from 'react';
import { X, PlayCircle } from 'lucide-react';
import { STICKY_DEFINITIONS } from '../../shared/eventstorming';
import {
  STICKY_EXPLAINERS,
  GLOSSARY_READING_ORDER,
  TOOL_EXPLAINERS,
} from '../../shared/explainers';

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour: () => void;
}

const SHORTCUTS: Array<[string, string]> = [
  ['Double-click board', 'New orange Domain Event'],
  ['1 to 9', 'New sticky in the middle of your screen (same order as the palette badges)'],
  ['Double-click sticky', 'Edit its text (Enter saves, Esc cancels)'],
  ['Space + drag', 'Move around the board'],
  ['Scroll / pinch', 'Zoom in and out'],
  ['Shift + click', 'Select several stickies'],
  ['Ctrl/Cmd + D', 'Duplicate selected'],
  ['Delete', 'Remove selected'],
  ['Ctrl/Cmd + Z', 'Undo (Shift+Z or Y to redo)'],
];

export const HelpPanel: React.FC<HelpPanelProps> = ({ isOpen, onClose, onStartTour }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">How this works</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onStartTour();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              Show me around
            </button>
            <button
              onClick={onClose}
              title="Close"
              aria-label="Close"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6 text-sm text-slate-300">
          <section>
            <h3 className="font-bold text-white mb-1.5">What is EventStorming?</h3>
            <p className="leading-relaxed">
              A group workshop where people from different areas of a business put the whole
              process on one big wall. Each colored sticky note is one kind of thing. Together they
              show how the business works, where people disagree, and where problems hide. Nobody
              needs a technical background.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-white mb-1.5">What you do here</h3>
            <ol className="list-decimal pl-5 space-y-1 leading-relaxed">
              <li>
                Double-click the board and write something that <b>happened</b> in your business,
                in past tense. Example: <i>Order Placed</i>.
              </li>
              <li>Keep adding events. Everyone writes at the same time. Do not wait for others.</li>
              <li>
                Drag events into time order, left to right. Fix duplicates and gaps together.
              </li>
              <li>
                Add other colors around the events: who triggers them, what rules apply, what
                worries you.
              </li>
              <li>
                Vote on the pink problem stickies to choose what to discuss first.
              </li>
            </ol>
            <p className="mt-2 text-slate-400">
              Everything you do appears live for everyone in the room. No account is needed.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-white mb-2">The sticky colors</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GLOSSARY_READING_ORDER.map((type) => {
                const def = STICKY_DEFINITIONS[type];
                const ex = STICKY_EXPLAINERS[type];
                return (
                  <div
                    key={type}
                    className="flex gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800"
                  >
                    <div
                      className="w-10 h-10 shrink-0 rounded-sm shadow"
                      style={{
                        backgroundColor: def.color,
                        transform: def.geometry.rotation
                          ? `rotate(${def.geometry.rotation}deg)`
                          : undefined,
                      }}
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-white text-xs">{def.label}</div>
                      <p className="text-xs text-slate-300 leading-snug mt-0.5">{ex.what}</p>
                      <p className="text-[11px] text-slate-500 mt-1">Example: {ex.example}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="font-bold text-white mb-2">Lines and lanes</h3>
            <ul className="space-y-2">
              <li>
                <b className="text-amber-400">{TOOL_EXPLAINERS.pivotal.label}.</b>{' '}
                {TOOL_EXPLAINERS.pivotal.what}
              </li>
              <li>
                <b className="text-sky-400">{TOOL_EXPLAINERS.swimlane.label}.</b>{' '}
                {TOOL_EXPLAINERS.swimlane.what}
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-white mb-2">Top bar</h3>
            <ul className="space-y-1.5 leading-relaxed">
              <li><b>Phases</b>: step-by-step guide for the facilitator, with advice for each stage.</li>
              <li><b>Timer</b>: shared countdown. Everyone sees the same time and hears a tone at zero.</li>
              <li><b>Call</b>: optional peer-to-peer audio and video calls. Automatically isolates between the Main Room and Breakout Tables. Zero server recordings.</li>
              <li><b>Breakouts</b>: split into small groups that each get their own private board. When time is up, their work is merged onto the main board as one lane per group.</li>
              <li><b>Voting</b>: when on, every sticky shows a 👍 button. Click it to add a vote (★ with a count). Use it to find what matters most.</li>
              <li><b>Templates</b>: load a finished example to see what a board looks like.</li>
              <li><b>Export</b>: download the board as Markdown or JSON.</li>
              <li><b>Invite</b>: copies the link. Anyone with the link can join.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-white mb-2">P2P Video & Voice Calls</h3>
            <p className="leading-relaxed mb-2 text-slate-300">
              Click <b>Call</b> to turn on your webcam and microphone. Calls are 100% peer-to-peer (P2P mesh WebRTC) with zero external media servers and zero recording.
            </p>
            <ul className="space-y-1.5 leading-relaxed text-slate-300">
              <li><b>Circular Video Bubbles</b>: Compact video frames show live camera feeds and pulsing emerald rings when someone speaks.</li>
              <li><b>Automatic Room Routing</b>: Entering a Breakout Room automatically switches your call to your breakout sub-group. Returning to the Main Room reconnects you with the entire workshop.</li>
              <li><b>Controls & Screen Share</b>: Mute your mic, turn off your camera, or share your screen in a floating picture-in-picture window without blocking your view of the board.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-white mb-2">Shortcuts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              {SHORTCUTS.map(([keys, action]) => (
                <div key={keys} className="flex justify-between gap-3 text-xs">
                  <span className="font-mono text-slate-200">{keys}</span>
                  <span className="text-slate-400 text-right">{action}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
