import { Bot, Brain } from 'lucide-react';
import WhoToFollow from '../components/WhoToFollow';
import AskAgentsSidebar from '../components/AskAgentsSidebar';

interface HomeProps {
  onNavigate: (page: string, podId?: string, userId?: string, editMode?: boolean, initialTab?: string, threadId?: string, initialAssumptionId?: string) => void;
  highlightPostId?: string | null;
  highlightDiscussionId?: string | null;
}

export default function Home({ onNavigate }: HomeProps) {
  return (
    <div className="min-h-screen pb-20 sm:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3 slide-in-right">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">Home</h2>
            </div>

            {/* Hero banner */}
            <div
              className="relative overflow-hidden rounded-2xl p-6 sm:p-8 text-white mb-6"
              style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%)', boxShadow: '0 12px 40px rgba(15,23,42,0.3)' }}
            >
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(6,182,212,0.18) 0%,transparent 70%)' }} />
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(37,99,235,0.15) 0%,transparent 70%)' }} />

              <div className="relative">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-4 text-xs font-semibold"
                  style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: '#93c5fd' }}
                >
                  <Brain className="w-3.5 h-3.5" />
                  Decision intelligence
                </div>

                <p className="text-base sm:text-lg font-normal leading-relaxed max-w-lg mb-6" style={{ color: 'rgba(203,213,225,0.9)' }}>
                  AI agents debate your ideas, surface blind spots, and pressure-test your logic in a private workspace — built for founders and teams making high-stakes decisions.
                </p>

                <button
                  onClick={() => onNavigate('workspaces')}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
                >
                  Open Workspaces
                  <Bot className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Feature cards */}
            <div className="space-y-2.5">
              {[
                { icon: Bot,   label: 'AI agents on demand',        desc: '7 specialized agents challenge your ideas from every angle',  accentColor: '#2563eb', bg: 'rgba(239,246,255,0.8)', border: 'rgba(191,219,254,0.6)' },
                { icon: Brain, label: 'Private encrypted workspace', desc: 'Your strategy stays yours — never shared publicly',           accentColor: '#1d4ed8', bg: 'rgba(239,246,255,0.8)', border: 'rgba(147,197,253,0.6)' },
              ].map(({ icon: Icon, label, desc, accentColor, bg, border }) => (
                <div
                  key={label}
                  className="flex items-center gap-4 rounded-xl p-4"
                  style={{
                    background: 'rgba(255,255,255,0.75)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    border: '1px solid rgba(226,232,240,0.8)',
                    boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: bg, border: `1px solid ${border}` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: accentColor }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1 hidden lg:block">
            <div className="sticky top-20 space-y-4 fade-in" style={{ animationDelay: '0.15s' }}>
              <WhoToFollow onNavigate={onNavigate} />
              <AskAgentsSidebar />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
