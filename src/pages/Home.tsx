import { Bot, Brain, Lock, Sparkles, ArrowRight, Shield, TrendingUp, Users, Zap, ChevronRight } from 'lucide-react';
import AskAgentsSidebar from '../components/AskAgentsSidebar';

interface HomeProps {
  onNavigate: (page: string, podId?: string, userId?: string, editMode?: boolean, initialTab?: string, threadId?: string, initialAssumptionId?: string) => void;
  highlightPostId?: string | null;
  highlightDiscussionId?: string | null;
}

const STATS = [
  { label: 'AI Agents', value: '7', sub: 'Always available', icon: Bot },
  { label: 'Encryption', value: 'E2E', sub: 'End-to-end secure', icon: Shield },
  { label: 'Workspace seats', value: '10', sub: 'Team plan', icon: Users },
  { label: 'Synthesis speed', value: '<60s', sub: 'AI War Room', icon: Zap },
];

const QUICK_ACTIONS = [
  {
    icon: Lock,
    title: 'Private Workspaces',
    desc: 'Encrypted spaces where your team debates proprietary ideas with AI agents.',
    cta: 'Open Workspaces',
    action: 'workspaces',
  },
  {
    icon: Brain,
    title: 'AI War Room',
    desc: 'Synthesize discussions into structured intelligence — risks, consensus, and action items.',
    cta: 'View War Room',
    action: 'workspaces',
  },
  {
    icon: TrendingUp,
    title: 'Decision Intelligence',
    desc: 'Get multiple AI perspectives that challenge assumptions and surface blind spots.',
    cta: 'Start Analyzing',
    action: 'workspaces',
  },
];

export default function Home({ onNavigate }: HomeProps) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg)' }}>
      <div
        className="px-4 sm:px-6 lg:px-8 py-6 lg:py-10 max-w-[1400px] mx-auto"
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
      >

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6 lg:mb-8">
          <div>
            <p className="section-label mb-1.5">Overview</p>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight" style={{ color: 'var(--app-text-primary)', letterSpacing: '-0.02em' }}>
              Dashboard
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--app-text-muted)' }}>
              AI-powered decision intelligence platform.
            </p>
          </div>
          <button
            onClick={() => onNavigate('workspaces')}
            className="btn-primary hidden sm:flex flex-shrink-0"
          >
            Open Workspaces
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
          {STATS.map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <Icon className="w-4 h-4" style={{ color: 'var(--signal)' }} />
                <span className="section-label" style={{ letterSpacing: '0.06em' }}>{sub}</span>
              </div>
              <p className="stat-card-value">{value}</p>
              <p className="stat-card-label">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_340px] gap-5 lg:gap-8">
          {/* Main content */}
          <div className="min-w-0 space-y-4 lg:space-y-5">

            {/* Hero panel */}
            <div
              className="relative overflow-hidden"
              style={{
                background: 'var(--app-surface-raised)',
                border: '1px solid var(--app-border)',
                borderLeft: '3px solid var(--signal)',
                borderRadius: '4px',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {/* Signal line accent top */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(90deg, var(--signal), transparent 60%)' }}
              />

              <div className="p-6 lg:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="badge badge-amber">
                        <Sparkles className="w-3 h-3" />
                        Decision Intelligence
                      </span>
                    </div>
                    <h2
                      className="text-xl lg:text-2xl xl:text-3xl font-bold mb-3 leading-snug"
                      style={{ color: 'var(--app-text-primary)', letterSpacing: '-0.025em' }}
                    >
                      AI agents that challenge your best thinking.
                    </h2>
                    <p className="text-sm lg:text-base leading-relaxed max-w-lg" style={{ color: 'var(--app-text-secondary)' }}>
                      Debate ideas, stress-test assumptions, and surface blind spots — in a private encrypted workspace only your team can see.
                    </p>
                  </div>

                  <div className="flex flex-row sm:flex-col gap-2 sm:flex-shrink-0">
                    <button
                      onClick={() => onNavigate('workspaces')}
                      className="btn-primary flex-1 sm:flex-none justify-center"
                    >
                      Open Workspaces
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onNavigate('pricing')}
                      className="btn-secondary flex-1 sm:flex-none justify-center"
                    >
                      View Pricing
                    </button>
                  </div>
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
                    className="card-interactive text-left p-4 lg:p-5 flex-shrink-0 w-56 sm:w-auto group"
                    style={{ borderRadius: '4px' }}
                  >
                    <div
                      className="w-8 h-8 lg:w-9 lg:h-9 flex items-center justify-center mb-3 flex-shrink-0"
                      style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)', borderRadius: '3px' }}
                    >
                      <Icon className="w-4 h-4" style={{ color: 'var(--signal)' }} />
                    </div>
                    <p className="text-sm lg:text-base font-bold mb-1.5" style={{ color: 'var(--app-text-primary)' }}>{title}</p>
                    <p className="text-xs lg:text-sm leading-relaxed mb-3" style={{ color: 'var(--app-text-muted)' }}>{desc}</p>
                    <span
                      className="text-xs font-bold flex items-center gap-1 mono-xs uppercase tracking-wide"
                      style={{ color: 'var(--signal)' }}
                    >
                      {cta}
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Security strip */}
            <div className="panel p-4 lg:p-5">
              <p className="section-label mb-4">Built for enterprise</p>
              <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-5">
                {[
                  { icon: Lock, text: 'End-to-end encrypted', sub: 'All workspace data encrypted at rest and in transit' },
                  { icon: Shield, text: 'Invite-only access', sub: 'Completely private — no public discovery' },
                  { icon: Sparkles, text: '7 specialized AI agents', sub: 'Skeptic, Risk Analyst, Optimist, and more' },
                ].map(({ icon: Icon, text, sub }) => (
                  <div key={text} className="flex items-start gap-3">
                    <div
                      className="w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)', borderRadius: '3px' }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: 'var(--signal)' }} />
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: 'var(--app-text-primary)' }}>{text}</p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>{sub}</p>
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
