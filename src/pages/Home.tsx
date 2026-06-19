import { Bot, Brain, Lock, Sparkles, ArrowRight, Shield } from 'lucide-react';
import AskAgentsSidebar from '../components/AskAgentsSidebar';

interface HomeProps {
  onNavigate: (page: string, podId?: string, userId?: string, editMode?: boolean, initialTab?: string, threadId?: string, initialAssumptionId?: string) => void;
  highlightPostId?: string | null;
  highlightDiscussionId?: string | null;
}

export default function Home({ onNavigate }: HomeProps) {
  const quickActions = [
    {
      icon: Lock,
      title: 'My Workspaces',
      desc: 'Access your private workspace and AI agent sessions',
      cta: 'Open Workspaces',
      action: () => onNavigate('workspaces'),
      accent: '#2563eb',
      bg: 'rgba(239,246,255,0.8)',
      border: 'rgba(191,219,254,0.7)',
    },
    {
      icon: Brain,
      title: 'AI Synthesis',
      desc: 'Review your latest workspace insights and decisions',
      cta: 'View Insights',
      action: () => onNavigate('workspaces'),
      accent: '#7c3aed',
      bg: 'rgba(245,243,255,0.8)',
      border: 'rgba(221,214,254,0.7)',
    },
    {
      icon: Bot,
      title: 'Ask Agents',
      desc: 'Get an immediate AI perspective on any decision',
      cta: 'Ask Now',
      action: () => onNavigate('workspaces'),
      accent: '#0891b2',
      bg: 'rgba(236,254,255,0.8)',
      border: 'rgba(165,243,252,0.7)',
    },
  ];

  return (
    <div className="min-h-screen pb-20 sm:pb-8" style={{ background: '#f8fafc' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6">

            {/* Hero banner */}
            <div
              className="relative overflow-hidden rounded-2xl p-7 sm:p-9"
              style={{
                background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%)',
                boxShadow: '0 12px 40px rgba(15,23,42,0.2)',
              }}
            >
              <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(6,182,212,0.18) 0%,transparent 70%)' }} />
              <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(37,99,235,0.12) 0%,transparent 70%)' }} />
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

              <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex-1">
                  <div
                    className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-semibold mb-3"
                    style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.15)', color: '#93c5fd' }}
                  >
                    <Brain className="w-3 h-3" />
                    Decision Intelligence
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-white mb-2 leading-tight">
                    AI agents that challenge your best thinking.
                  </h1>
                  <p className="text-sm leading-relaxed max-w-md" style={{ color: 'rgba(203,213,225,0.85)' }}>
                    Debate ideas, stress-test assumptions, and surface blind spots — in a private workspace only your team can see.
                  </p>
                </div>

                <button
                  onClick={() => onNavigate('workspaces')}
                  className="flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 hover:-translate-y-0.5 whitespace-nowrap"
                  style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'}
                >
                  Open Workspaces
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick action cards */}
            <div className="grid sm:grid-cols-3 gap-4">
              {quickActions.map(({ icon: Icon, title, desc, cta, action, accent, bg, border }) => (
                <button
                  key={title}
                  onClick={action}
                  className="text-left p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md group"
                  style={{
                    background: 'rgba(255,255,255,0.9)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(226,232,240,0.8)',
                    boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110"
                    style={{ background: bg, border: `1px solid ${border}` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: accent }} />
                  </div>
                  <p className="text-sm font-bold text-slate-800 mb-1">{title}</p>
                  <p className="text-xs text-slate-500 leading-snug mb-3">{desc}</p>
                  <span className="text-xs font-semibold flex items-center gap-1" style={{ color: accent }}>
                    {cta}
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </button>
              ))}
            </div>

            {/* Trust strip */}
            <div
              className="rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                {[
                  { icon: Lock,   text: 'End-to-end encrypted', sub: 'Your data is private' },
                  { icon: Shield, text: 'Team-ready',           sub: 'Up to 10 members' },
                  { icon: Sparkles, text: '7 AI agents',        sub: 'Always available' },
                ].map(({ icon: Icon, text, sub }) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,99,235,0.07)' }}>
                      <Icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{text}</p>
                      <p className="text-[11px] text-slate-500">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 hidden lg:block">
            <div className="sticky top-20 space-y-4">
              <AskAgentsSidebar />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
