import React, { useState, useEffect } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import type { WorkshopFormat } from '../../shared/eventstorming';
import { WORKSHOP_FORMATS, SAMPLE_TEMPLATES } from '../../shared/eventstorming';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Users, Compass, Timer, Vote, Film, Play, Volume2, Video, Eye } from 'lucide-react';
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

    const template = templateKey ? SAMPLE_TEMPLATES[templateKey] : undefined;
    const targetFormat = template ? template.format : selectedFormat;

    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turnstileToken,
          format: targetFormat,
          templateKey,
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
          <span className="hidden sm:inline-flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Zero-Sign-in Realtime</span>
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
            EventStorming & Real-Time Video
          </span>
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
          The collaborative canvas engineered for Alberto Brandolini’s DDD methodology.
          Infinite zoomable workspace, serverless P2P WebRTC video calls with Around.co webcam effects,
          live cursor bubbles, participant follow mode, and breakout room isolation.
        </p>
        {/* Promotional Ad Video Showcase */}
        <div className="mt-8 w-full max-w-4xl relative group">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-500/30 via-orange-500/30 to-pink-500/30 blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
          <div className="relative rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden">
            {/* Window Chrome Header */}
            <div className="h-9 bg-slate-950/80 border-b border-slate-800/80 px-4 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="text-[11px] font-mono text-slate-400 ml-2">eventstormer.app — Collaborative DDD Engine</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                <span>15s Interactive Tour (P2P Video + Canvas)</span>
              </div>
            </div>

            {/* Video Player */}
            <div className="relative aspect-video w-full bg-slate-950">
              <video
                src="/videos/ad-promo.mp4"
                autoPlay
                loop
                muted
                playsInline
                controls
                className="w-full h-full object-cover"
              />
            </div>
            <div className="px-4 py-2.5 bg-slate-950/60 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
              <span>⚡ 0 Sign-in • Serverless WebRTC Video Mesh • Around.co Cam Filters • 1-Click Follow Mode</span>
              <span className="text-slate-500">Unmute anytime for audio</span>
            </div>
          </div>
        </div>

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

        {/* Variant Walkthrough Video Preview */}
        <div className="mt-6 w-full max-w-4xl text-left bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-indigo-400" />
              <h3 className="font-bold text-white text-sm">
                {WORKSHOP_FORMATS[selectedFormat].title} — Facilitated Walkthrough (12s)
              </h3>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <span>Showing format:</span>
              <span className="font-semibold text-indigo-300 uppercase tracking-wider">{selectedFormat}</span>
            </div>
          </div>

          <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
            <video
              key={selectedFormat}
              src={`/videos/${selectedFormat}.mp4`}
              autoPlay
              loop
              muted
              playsInline
              controls
              className="w-full h-full object-cover"
            />
          </div>

          {/* Stages Breakdown for Selected Variant */}
          <div className="mt-3.5 pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-slate-400 font-semibold">Methodology Stages:</span>
            {WORKSHOP_FORMATS[selectedFormat].phases.map((ph, idx) => (
              <span
                key={ph.id}
                className="px-2 py-0.5 rounded-md bg-slate-800/70 text-slate-300 border border-slate-700/50"
              >
                {idx + 1}. {ph.title}
              </span>
            ))}
          </div>
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
        <div className="mt-16 grid grid-cols-2 md:grid-cols-3 gap-6 w-full text-left max-w-4xl border-t border-slate-900 pt-10">
          <div className="space-y-1">
            <div className="text-amber-400 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <Zap className="w-4 h-4" /> Brandolini Syntax
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Strict geometries & color codes: orange events, tilted pink hotspots, yellow actors, command-readmodel loops.
            </p>
          </div>

          <div className="space-y-1">
            <div className="text-emerald-400 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <Video className="w-4 h-4" /> Serverless P2P Video
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Lightweight WebRTC audio/video mesh directly in your canvas. Zero external media servers, 100% private.
            </p>
          </div>

          <div className="space-y-1">
            <div className="text-pink-400 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" /> Around.co Cam Effects
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Aesthetic filters (Cyberpunk, Noir, Sunset, Phosphor), glowing aura rings, and floating reaction badges.
            </p>
          </div>

          <div className="space-y-1">
            <div className="text-indigo-400 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <Eye className="w-4 h-4" /> Cursor Cams & Follow
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Each collaborator's webcam floats above their cursor on the canvas. 1-click follow tracks facilitators smoothly.
            </p>
          </div>

          <div className="space-y-1">
            <div className="text-cyan-400 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <Users className="w-4 h-4" /> Breakout Sub-Groups
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Private sub-group breakout rooms that automatically isolate audio/video and merge back to swimlanes.
            </p>
          </div>

          <div className="space-y-1">
            <div className="text-rose-400 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <Timer className="w-4 h-4" /> Timer & Dot-Voting
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Timebox chaotic generation with synchronized countdowns and prioritize bottlenecks together with 👍 voting.
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
