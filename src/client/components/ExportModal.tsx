import React, { useState } from 'react';
import type { WorkspaceState } from '../../shared/eventstorming';
import { WORKSHOP_FORMATS, STICKY_DEFINITIONS } from '../../shared/eventstorming';
import { X, Download, Copy, Check, FileText, Code } from 'lucide-react';

interface ExportModalProps {
  state: WorkspaceState;
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  state,
  workspaceId,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'markdown' | 'json'>('markdown');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate structured Markdown
  const formatDef = WORKSHOP_FORMATS[state.format] || WORKSHOP_FORMATS['big-picture'];
  const sortedEvents = state.stickies
    .filter((s) => s.type === 'domain-event')
    .sort((a, b) => a.x - b.x);

  const hotspots = state.stickies
    .filter((s) => s.type === 'hotspot')
    .sort((a, b) => b.votes - a.votes);

  const actors = state.stickies.filter((s) => s.type === 'actor');
  const systems = state.stickies.filter((s) => s.type === 'system');
  const commands = state.stickies.filter((s) => s.type === 'command');
  const policies = state.stickies.filter((s) => s.type === 'policy');
  const readmodels = state.stickies.filter((s) => s.type === 'readmodel');
  const constraints = state.stickies.filter((s) => s.type === 'constraint');
  const opportunities = state.stickies.filter((s) => s.type === 'opportunity');
  const values = state.stickies.filter((s) => s.type === 'value');
  const markdownContent = [
    `# EventStorming Summary: ${workspaceId}`,
    `**Format**: ${formatDef.title}`,
    `**Exported**: ${new Date().toISOString()}`,
    ``,
    `## 1. Chronological Timeline of Domain Events`,
    sortedEvents.length === 0
      ? `*No domain events recorded.*`
      : sortedEvents
          .map((e, idx) => `${idx + 1}. **${e.text || 'Untitled'}** (x: ${e.x}${e.votes > 0 ? `, ${e.votes} votes` : ''})`)
          .join('\n'),
    ``,
    `## 2. Hotspots & Identified Risks (${hotspots.length})`,
    hotspots.length === 0
      ? `*No hotspots identified.*`
      : hotspots
          .map((h) => `- 🔥 **${h.text || 'Untitled'}** (${h.votes} votes)`)
          .join('\n'),
    ``,
    `## 3. Actors & Personas (${actors.length})`,
    actors.length === 0
      ? `*None specified.*`
      : actors.map((a) => `- 👤 ${a.text || 'Untitled'}`).join('\n'),
    ``,
    `## 4. External Systems (${systems.length})`,
    systems.length === 0
      ? `*None specified.*`
      : systems.map((s) => `- 🏢 ${s.text || 'Untitled'}`).join('\n'),
    ``,
    `## 5. Commands (${commands.length}) & Policies (${policies.length})`,
    commands.map((c) => `- ⚡ Command: ${c.text || 'Untitled'}`).join('\n') || '*No commands.*',
    policies.map((p) => `- 📜 Policy: ${p.text || 'Untitled'}`).join('\n') || '*No policies.*',
    ``,
    `## 6. Read Models & Preconditions (${readmodels.length})`,
    readmodels.map((r) => `- 📖 Read Model: ${r.text || 'Untitled'}`).join('\n') || '*No read models.*',
    ``,
    `## 7. Aggregates & Invariant Boundaries (${constraints.length})`,
    constraints.map((c) => `- 🛡️ Aggregate/Constraint: ${c.text || 'Untitled'}`).join('\n') || '*No aggregates/constraints.*',
    ``,
    `## 8. Opportunities (${opportunities.length}) & Values (${values.length})`,
    opportunities.map((o) => `- 💡 Opportunity: ${o.text || 'Untitled'}`).join('\n') || '*No opportunities.*',
    values.map((v) => `- 💎 Value: ${v.text || 'Untitled'}`).join('\n') || '*No value items.*',
    ``,
    `## 9. Milestones (Pivotal Events)`,
    state.pivotalLines.length === 0
      ? `*No pivotal milestone lines set.*`
      : state.pivotalLines
          .sort((a, b) => a.x - b.x)
          .map((l) => `- 🏁 **${l.name}** (x: ${l.x})`)
          .join('\n'),
    ``,
    `## 10. Swimlanes`,
    state.swimlanes.length === 0
      ? `*No swimlanes configured.*`
      : state.swimlanes
          .sort((a, b) => a.y - b.y)
          .map((lane) => `- 🏊 ${lane.name} (y: ${lane.y})`)
          .join('\n'),
  ].join('\n');

  const jsonContent = JSON.stringify(state, null, 2);

  const handleCopy = () => {
    const textToCopy = activeTab === 'markdown' ? markdownContent : jsonContent;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = `${workspaceId}-eventstorming.${activeTab === 'markdown' ? 'md' : 'json'}`;
    const text = activeTab === 'markdown' ? markdownContent : jsonContent;
    const blob = new Blob([text], {
      type: activeTab === 'markdown' ? 'text/markdown' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">Export Workshop Artifacts</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              {workspaceId}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 px-4 pt-2 gap-2 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('markdown')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'markdown'
                ? 'border-indigo-500 text-indigo-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Markdown Summary</span>
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'json'
                ? 'border-indigo-500 text-indigo-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Full Workspace JSON</span>
          </button>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 p-4 overflow-y-auto">
          <pre className="font-mono text-xs text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800/80 overflow-x-auto whitespace-pre leading-relaxed">
            {activeTab === 'markdown' ? markdownContent : jsonContent}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="text-xs text-slate-400">
            {activeTab === 'markdown'
              ? `${sortedEvents.length} events, ${hotspots.length} hotspots recorded`
              : `${state.stickies.length} stickies total`}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .{activeTab === 'markdown' ? 'md' : 'json'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
