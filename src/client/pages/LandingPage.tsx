import React, { useState, useEffect } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import type { WorkshopFormat } from '../../shared/eventstorming';
import { WORKSHOP_FORMATS, SAMPLE_TEMPLATES } from '../../shared/eventstorming';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Users, Compass, Timer, Vote } from 'lucide-react';

interface LandingPageProps {
  onNavigateToWorkspace: (workspaceId: string, templateKey?: string) => void;
}
const isDev = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToWorkspace }) => {
  const [selectedFormat, setSelectedFormat] = useState<WorkshopFormat>('big-picture');
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Turnstile site key dynamically fetched from server config or fallback
  const [siteKey, setSiteKey] = useState<string>(
    () =>
      (import.meta as unknown as { env: { VITE_TURNSTILE_SITE_KEY?: string } }).env
        .VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAF5ucgmkfKdOVogj'
  );

  useEffect(() => {
    fetch('/api/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((cfg: { turnstileSiteKey?: string } | null) => {
        if (cfg?.turnstileSiteKey) {
          setSiteKey(cfg.turnstileSiteKey);
        }
      })
      .catch(() => {});
  }, []);

  const handleCreateWorkspace = async (templateKey?: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    if (!turnstileToken && !isDev) {
      setErrorMessage('Please complete the security check below before creating a workspace.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turnstileToken,
          format: selectedFormat,
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json()) as { error?: string };
        throw new Error(errorData.error || `Server responded with ${res.status}`);
      }

      const data = (await res.json()) as { id: string; url: string };
      onNavigateToWorkspace(data.id, templateKey);
    } catch (err) {
      console.error('Failed to create workspace:', err);
      if (isDev) {
        // Offline development fallback
        const fallbackId = `storm-${Math.floor(100 + Math.random() * 900)}`;
        onNavigateToWorkspace(fallbackId, templateKey);
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Failed to create workspace. Please verify the security check.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Navigation Header */}
      <nav className="h-16 border-b border-slate-900 px-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className="text-lg font-black tracking-tight text-white">EventStormer</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-1">
            Brandolini DDD
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
          <span className="hidden sm:inline flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-4 h-4" /> Zero-Sign-in Realtime
          </span>
        </div>
      </nav>

      {/* Main Hero Container */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 flex flex-col items-center text-center justify-center">
        {/* Hero Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-amber-400 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Real-Time Collaborative Modeling on Cloudflare Workers & Durable Objects</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-tight">
          Accelerate Domain Discovery with{' '}
          <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 bg-clip-text text-transparent">
            EventStorming
          </span>
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
          The collaborative canvas engineered for Alberto Brandolini’s DDD methodology.
          Infinite zoomable workspace, strict Brandolini color grammar, synchronized facilitator timer,
          and zero-friction URL sharing.
        </p>

        {/* Format Selector Cards */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-left max-w-4xl">
          {Object.entries(WORKSHOP_FORMATS).map(([fmtKey, def]) => {
            const isSelected = selectedFormat === fmtKey;
            return (
              <div
                key={fmtKey}
                onClick={() => setSelectedFormat(fmtKey as WorkshopFormat)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/30 ring-2 ring-indigo-500/30 shadow-xl'
                    : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-white text-base">{def.title}</h3>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400" />
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{def.description}</p>
                <div className="mt-4 pt-3 border-t border-slate-800/60 text-[11px] font-semibold text-slate-500">
                  {def.phases.length} Facilitated Stages
                </div>
              </div>
            );
          })}
        </div>

        {/* Bot Guard & Create Workspace CTA */}
        <div className="mt-8 flex flex-col items-center gap-4">
          {/* Cloudflare Turnstile Bot Guard */}
          <div className="my-2">
            <Turnstile
              siteKey={siteKey}
              onSuccess={(token) => {
                setTurnstileToken(token);
                setErrorMessage(null);
              }}
              onExpire={() => setTurnstileToken('')}
              onError={() => {
                if (isDev) {
                  setTurnstileToken('1x00000000000000000000AA');
                }
              }}
            />
          </div>

          {errorMessage && (
            <p className="text-xs text-red-400 bg-red-950/50 px-3 py-1.5 rounded-lg border border-red-800/60">
              {errorMessage}
            </p>
          )}

          <button
            onClick={() => handleCreateWorkspace()}
            disabled={isLoading}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 hover:from-amber-400 hover:to-pink-400 text-slate-950 font-black text-base shadow-xl shadow-orange-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
          >
            {isLoading ? (
              <span>Provisioning Workspace...</span>
            ) : (
              <>
                <span>Launch New Workshop</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
          <span className="text-xs text-slate-500">No account required • Instant URL collaboration</span>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 w-full text-left max-w-4xl border-t border-slate-900 pt-10">
          <div className="space-y-1">
            <div className="text-amber-400 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <Zap className="w-4 h-4" /> Brandolini Syntax
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Strict geometries & color codes: orange events, tilted pink hotspots, yellow actors.
            </p>
          </div>

          <div className="space-y-1">
            <div className="text-indigo-400 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <Users className="w-4 h-4" /> Live Multiplayer
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Cloudflare Durable Objects & WebSockets broadcast sticky edits and smooth peer cursors.
            </p>
          </div>

          <div className="space-y-1">
            <div className="text-emerald-400 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <Compass className="w-4 h-4" /> Facilitator Steps
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Interactive stepper with step-by-step guidance, recommended stickies, and tips.
            </p>
          </div>

          <div className="space-y-1">
            <div className="text-pink-400 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <Timer className="w-4 h-4" /> Timer & Dot-Voting
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Timebox chaotic generation with shared countdowns and prioritize bottlenecks together.
            </p>
          </div>
        </div>

        {/* Quick Launch Pre-configured Templates */}
        <div className="mt-14 w-full max-w-4xl text-left">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Or Quick-Launch With a Pre-Populated Domain Template:
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(SAMPLE_TEMPLATES).map(([key, tpl]) => (
              <button
                key={key}
                onClick={() => handleCreateWorkspace(key)}
                className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-700 text-left transition-all group"
              >
                <div className="font-bold text-white text-xs group-hover:text-amber-400 transition-colors flex items-center justify-between">
                  <span>{tpl.title}</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  {tpl.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-14 border-t border-slate-900 px-6 flex items-center justify-between text-xs text-slate-500 max-w-7xl mx-auto w-full">
        <div>EventStormer — Based on Alberto Brandolini’s Domain-Driven Design Workshop Methodology.</div>
        <div>Built with React, Vite & Cloudflare Durable Objects.</div>
      </footer>
    </div>
  );
};
