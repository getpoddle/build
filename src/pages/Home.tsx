import { Bot, Brain, Lock, Sparkles, ArrowRight, Shield, TrendingUp, Users, Zap, ChevronRight, MessageSquare, UsersRound } from 'lucide-react';

interface HomeProps {
  onNavigate: (page: string, podId?: string, userId?: string, editMode?: boolean, initialTab?: string, threadId?: string, initialAssumptionId?: string) => void;
  highlightPostId?: string | null;
  highlightDiscussionId?: string | null;
}

const STATS = [
  { label: 'AI Agents', value: '7', sub: 'Always available', icon: Bot },
  { label: 'Encryption', value: 'E2E', sub: 'End-to-end secure', icon: Shield },
  { label: 'Workspace seats', value: '1–10', sub: 'Team plan', icon: Users },
  { label: 'Synthesis speed', value: '<60s', sub: 'AI War Room', icon: Zap },
];

const QUICK_ACTIONS = [
  { icon: Lock, title: 'Private Workspaces', desc: 'Encrypted spaces where your team debates proprietary ideas with AI agents.', cta: 'Open Workspaces', action: 'workspaces' },
  { icon: Brain, title: 'AI War Room', desc: 'Synthesize discussions into structured intelligence — risks, consensus, and action items.', cta: 'View War Room', action: 'workspaces' },
  { icon: TrendingUp, title: 'Decision Intelligence', desc: 'Get multiple AI perspectives that challenge assumptions and surface blind spots.', cta: 'Start Analyzing', action: 'workspaces' },
];

export default function Home({ onNavigate }: HomeProps) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg)' }}>
      <div
        className="px-4 sm:px-6 lg:px-8 py-6 lg:py-10 mx-auto"
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
      >

        {/* Page header */}
        <div className="mb-6 lg:mb-10">
          <p className="section-label mb-2">Dashboard</p>
          <h1 className="display-heading text-2xl lg:text-3xl xl:text-4xl mb-1">Adversarial Multi-Agent Decision Intelligence</h1>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-10">
          {STATS.map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="stat-card">
              <div className="flex items-center justify-between mb-3 lg:mb-4">
                <div className="w-8 h-8 lg:w-9 lg:h-9 flex items-center justify-center" style={{ background: 'var(--signal-bg)' }}>
                  <Icon className="w-4 h-4" style={{ color: 'var(--signal)' }} />
                </div>
              </div>
              <p className="stat-card-value">{value}</p>
              <p className="stat-card-label">{label}</p>
              <p className="text-[11px] lg:text-xs mt-0.5 hidden sm:block" style={{ color: 'var(--app-text-muted)' }}>{sub}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4 lg:space-y-6">
          {/* Main content */}
          <div className="min-w-0 space-y-4 lg:space-y-6">

            {/* Hero banner */}
            <div
              className="relative overflow-hidden p-6 lg:p-10"
              style={{
                background: '#0e1117',
                border: '1px solid var(--app-border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(184,134,11,0.08) 0%,transparent 70%)' }} />
              <div className="absolute -bottom-8 -left-8 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(184,134,11,0.05) 0%,transparent 70%)' }} />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
                <div className="flex-1">
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 mb-4"
                    style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)' }}
                  >
                    <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--signal)' }} />
                    <span className="mono-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--signal)' }}>Decision Intelligence</span>
                  </div>
                  <h2 className="display-heading text-xl lg:text-2xl xl:text-3xl mb-3" style={{ color: '#e8ecf2' }}>
                    AI agents that challenge your best thinking.
                  </h2>
                  <p className="text-sm lg:text-base leading-relaxed max-w-lg" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    Debate ideas, stress-test assumptions, and surface blind spots — in a private encrypted workspace only your team can see.
                  </p>
                </div>

                <div className="flex flex-row sm:flex-col gap-3 sm:flex-shrink-0">
                  <button
                    onClick={() => onNavigate('workspaces')}
                    className="btn-primary flex-1 sm:flex-none"
                  >
                    Open Workspaces
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onNavigate('pricing')}
                    className="btn-secondary flex-1 sm:flex-none"
                    style={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.4)', background: 'transparent' }}
                  >
                    View Pricing
                  </button>
                </div>
              </div>
            </div>

            {/* Quick action cards */}
            <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0">
              <div className="flex gap-3 sm:grid sm:grid-cols-3 w-max sm:w-auto">
                {QUICK_ACTIONS.map(({ icon: Icon, title, desc, cta, action }) => (
                  <button
                    key={title}
                    onClick={() => onNavigate(action)}
                    className="card-interactive text-left p-4 lg:p-5 w-56 sm:w-auto"
                  >
                    <div className="w-9 h-9 lg:w-10 lg:h-10 flex items-center justify-center mb-3 lg:mb-4" style={{ background: 'var(--signal-bg)' }}>
                      <Icon className="w-4 h-4 lg:w-5 lg:h-5" style={{ color: 'var(--signal)' }} />
                    </div>
                    <p className="text-sm lg:text-base font-semibold mb-1" style={{ color: 'var(--app-text-primary)' }}>{title}</p>
                    <p className="text-xs lg:text-sm leading-relaxed mb-3" style={{ color: 'var(--app-text-secondary)' }}>{desc}</p>
                    <span className="text-xs font-semibold flex items-center gap-1 text-signal">
                      {cta}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Team Collaboration */}
            <div className="panel p-4 lg:p-6">
              <p className="section-label mb-4">Team Collaboration</p>
              <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--signal-bg)' }}>
                    <MessageSquare className="w-4 h-4" style={{ color: 'var(--signal)' }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--app-text-primary)' }}>Team Chat</p>
                    <p className="text-[11px] lg:text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                      Real-time messaging built into every workspace. Share updates, coordinate decisions, and keep conversations alongside your intelligence.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--signal-bg)' }}>
                    <UsersRound className="w-4 h-4" style={{ color: 'var(--signal)' }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--app-text-primary)' }}>Multiplayer AI</p>
                    <p className="text-[11px] lg:text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                      Team members and AI agents discuss together in real time. Pose questions, get multiple agent perspectives, and build collective insight without leaving the thread.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Security strip */}
            <div className="panel p-4 lg:p-6">
              <p className="section-label mb-4">Built for decision-makers</p>
              <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-5">
                {[
                  { icon: Lock, text: 'End-to-end encrypted', sub: 'All workspace data encrypted at rest and in transit' },
                  { icon: Shield, text: 'Invite-only access', sub: 'Completely private — no public discovery' },
                  { icon: Sparkles, text: '7 specialized AI agents', sub: 'Risk Analyst, Financial Strategist, Execution Lead, and more' },
                ].map(({ icon: Icon, text, sub }) => (
                  <div key={text} className="flex items-start gap-3">
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--signal-bg)' }}>
                      <Icon className="w-4 h-4" style={{ color: 'var(--signal)' }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--app-text-primary)' }}>{text}</p>
                      <p className="text-[11px] lg:text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
