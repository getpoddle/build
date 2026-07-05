import { Bot, Brain, Lock, Sparkles, ArrowRight, Shield, TrendingUp, Users, Zap, ChevronRight } from 'lucide-react';
import AskAgentsSidebar from '../components/AskAgentsSidebar';

interface HomeProps {
  onNavigate: (page: string, podId?: string, userId?: string, editMode?: boolean, initialTab?: string, threadId?: string, initialAssumptionId?: string) => void;
  highlightPostId?: string | null;
  highlightDiscussionId?: string | null;
}

const STATS = [
  { label: 'AI Agents', value: '7', sub: 'Always available', icon: Bot, color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
  { label: 'Encryption', value: 'E2E', sub: 'End-to-end secure', icon: Shield, color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
  { label: 'Workspace seats', value: '10', sub: 'Team plan', icon: Users, color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  { label: 'Synthesis speed', value: '<60s', sub: 'AI War Room', icon: Zap, color: '#d97706', bg: 'rgba(217,119,6,0.08)' },
];

const QUICK_ACTIONS = [
  {
    icon: Lock,
    title: 'Private Workspaces',
    desc: 'Encrypted spaces where your team debates proprietary ideas with AI agents.',
    cta: 'Open Workspaces',
    action: 'workspaces',
    accent: '#2563eb',
  },
  {
    icon: Brain,
    title: 'AI War Room',
    desc: 'Synthesize discussions into structured intelligence — risks, consensus, and action items.',
    cta: 'View War Room',
    action: 'workspaces',
    accent: '#7c3aed',
  },
  {
    icon: TrendingUp,
    title: 'Decision Intelligence',
    desc: 'Get multiple AI perspectives that challenge assumptions and surface blind spots.',
    cta: 'Start Analyzing',
    action: 'workspaces',
    accent: '#0891b2',
  },
];

export default function Home({ onNavigate }: HomeProps) {
  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div
        className="px-4 sm:px-6 lg:px-6 py-6 lg:py-10"
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
      >

        {/* Page header */}
        <div className="mb-6 lg:mb-10">
          <h1 className="text-xl lg:text-3xl font-black text-slate-900 mb-0.5">Dashboard</h1>
          <p className="text-slate-500 text-sm">Your AI-powered decision intelligence platform.</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-10">
          {STATS.map(({ label, value, sub, icon: Icon, color, bg }) => (
            <div
              key={label}
              className="bg-white rounded-2xl p-4 lg:p-5"
              style={{ border: '1px solid rgba(15,23,42,0.07)', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}
            >
              <div className="flex items-center justify-between mb-3 lg:mb-4">
                <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                  <Icon style={{ width: '1rem', height: '1rem', color }} />
                </div>
              </div>
              <p className="text-xl lg:text-3xl font-black text-slate-900 mb-0.5">{value}</p>
              <p className="text-xs font-semibold text-slate-600 leading-tight">{label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 hidden sm:block">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_340px] gap-5 lg:gap-8">
          {/* Main content */}
          <div className="min-w-0 space-y-4 lg:space-y-6">

            {/* Hero banner */}
            <div
              className="relative overflow-hidden rounded-2xl p-6 lg:p-10"
              style={{
                background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%)',
                boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
              }}
            >
              <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(6,182,212,0.15) 0%,transparent 70%)' }} />
              <div className="absolute -bottom-8 -left-8 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(37,99,235,0.1) 0%,transparent 70%)' }} />
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
                <div className="flex-1">
                  <div
                    className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-semibold mb-3"
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)', color: '#93c5fd' }}
                  >
                    <Sparkles className="w-3 h-3" />
                    Decision Intelligence Platform
                  </div>
                  <h2 className="text-lg lg:text-2xl font-black text-white mb-2.5 leading-snug">
                    AI agents that challenge your best thinking.
                  </h2>
                  <p className="text-sm leading-relaxed max-w-md" style={{ color: 'rgba(203,213,225,0.8)' }}>
                    Debate ideas, stress-test assumptions, and surface blind spots — in a private encrypted workspace only your team can see.
                  </p>
                </div>

                <div className="flex flex-row sm:flex-col gap-3 sm:flex-shrink-0">
                  <button
                    onClick={() => onNavigate('workspaces')}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 whitespace-nowrap"
                    style={{ background: '#2563eb', color: '#fff', boxShadow: '0 4px 14px rgba(37,99,235,0.4)' }}
                  >
                    Open Workspaces
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onNavigate('pricing')}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 whitespace-nowrap"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    View Pricing
                  </button>
                </div>
              </div>
            </div>

            {/* Quick action cards — horizontal scroll on mobile, grid on sm+ */}
            <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0">
              <div className="flex gap-3 sm:grid sm:grid-cols-3 w-max sm:w-auto">
                {QUICK_ACTIONS.map(({ icon: Icon, title, desc, cta, action, accent }) => (
                  <button
                    key={title}
                    onClick={() => onNavigate(action)}
                    className="text-left p-4 lg:p-5 rounded-2xl transition-all duration-200 active:scale-95 sm:hover:-translate-y-0.5 sm:hover:shadow-md group flex-shrink-0 w-56 sm:w-auto"
                    style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.07)', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}
                  >
                    <div
                      className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center mb-3 lg:mb-4 transition-transform duration-200 sm:group-hover:scale-110"
                      style={{ background: `${accent}14` }}
                    >
                      <Icon className="w-4 h-4 lg:w-5 lg:h-5" style={{ color: accent }} />
                    </div>
                    <p className="text-sm font-bold text-slate-800 mb-1">{title}</p>
                    <p className="text-xs text-slate-500 leading-relaxed mb-3">{desc}</p>
                    <span className="text-xs font-bold flex items-center gap-1" style={{ color: accent }}>
                      {cta}
                      <ChevronRight className="w-3.5 h-3.5 sm:group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Security strip */}
            <div
              className="rounded-2xl p-4 lg:p-6"
              style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.07)', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}
            >
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Built for enterprise</p>
              <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-5">
                {[
                  { icon: Lock, text: 'End-to-end encrypted', sub: 'All workspace data encrypted at rest and in transit' },
                  { icon: Shield, text: 'Invite-only access', sub: 'Completely private — no public discovery' },
                  { icon: Sparkles, text: '7 specialized AI agents', sub: 'Skeptic, Risk Analyst, Optimist, and more' },
                ].map(({ icon: Icon, text, sub }) => (
                  <div key={text} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(37,99,235,0.07)' }}>
                      <Icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{text}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right sidebar — desktop only */}
          <div className="hidden xl:block">
            <div className="sticky top-[4.5rem]">
              <AskAgentsSidebar />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
