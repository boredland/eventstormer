import React from 'react';
import { SAMPLE_TEMPLATES, WORKSHOP_FORMATS } from '../../shared/eventstorming';
import { X, BookOpen, AlertTriangle, ArrowRight } from 'lucide-react';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (templateId: string) => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-white">Load Sample Workshop Template</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            Loading a template will replace the current stickies, pivotal lines, and swimlanes on this board.
          </span>
        </div>

        {/* Templates List */}
        <div className="p-4 space-y-3 overflow-y-auto">
          {Object.entries(SAMPLE_TEMPLATES).map(([key, tpl]) => {
            const formatDef = WORKSHOP_FORMATS[tpl.format] || WORKSHOP_FORMATS['big-picture'];

            return (
              <div
                key={key}
                className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-slate-700 transition-all flex flex-col justify-between gap-3 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors">
                      {tpl.title}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 uppercase tracking-wider">
                      {formatDef.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{tpl.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 font-medium">
                    <span>{tpl.stickies.length} stickies</span>
                    <span>•</span>
                    <span>{tpl.pivotalLines.length} pivotal lines</span>
                    <span>•</span>
                    <span>{tpl.swimlanes.length} swimlanes</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onSelectTemplate(key);
                    onClose();
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Load Template</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
