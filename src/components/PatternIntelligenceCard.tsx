import { useState, useEffect } from 'react';
import { Brain, Lock, TrendingDown, AlertTriangle, Zap, Eye, GitBranch, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

const UNLOCK_THRESHOLD = 15;

const PATTERNS = [
  {
    icon: AlertTriangle,
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.08)',
    title: 'Execution Risk Underestimation',
    description: 'Detect when your team consistently underweights how hard it is to ship — before it becomes a pattern of missed commitments.',
  },
  {
    icon: TrendingDown,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    title: 'Financial Upside Over-indexing',
    description: 'Spot when revenue potential dominates discussions while operational and people risks get systematically low scores.',
  },
  {
    icon: Zap,
    color: '#2563eb',
    bg: 'rgba(37,99,235,0.08)',
    title: 'Consensus Speed',
    description: 'Understand whether your team converges fast or circles — and whether speed correlates with better or worse outcomes.',
  },
  {
    icon: Eye,
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.08)',
    title: 'Recurring Blind Spots',
    description: 'Surface the categories of risk your team never raises unprompted — the things you reliably don\'t see.',
  },
  {
    icon: GitBranch,
    color: '#0891b2',
    bg: 'rgba(8,145,178,0.08)',
    title: 'Agent Disagreement Patterns',
    description: 'Learn which AI agents consistently push back on your team\'s committed positions — a proxy for your collective biases.',
  },
];

interface PatternIntelligenceCardProps {
  workspaceId: string;
}

export default function PatternIntelligenceCard({ workspaceId }: PatternIntelligenceCardProps) {
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    supabase
      .from('workspace_synthesis_history')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .then(({ count }) => setSessionCount(count ?? 0));
  }, [workspaceId]);

  const count = sessionCount ?? 0;
  const remaining = Math.max(0, UNLOCK_THRESHOLD - count);
  const progress = Math.min(1, count / UNLOCK_THRESHOLD);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid rgba(15,23,42,0.08)', background: '#fff' }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,rgba(15,23,42,0.08),rgba(15,23,42,0.05))' }}
          >
            <Brain className="w-4.5 h-4.5 text-slate-500" style={{ width: '1.125rem', height: '1.125rem' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">Pattern Intelligence</span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                style={{ background: 'rgba(15,23,42,0.06)', color: '#64748b' }}
              >
                Coming Soon
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {sessionCount === null
                ? 'Loading…'
                : remaining === 0
                ? 'Unlocking soon — analysis in progress'
                : `${remaining} more session${remaining === 1 ? '' : 's'} to unlock`}
            </p>
          </div>
        </div>
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>

      {!collapsed && (
        <div className="px-5 pb-5">
          {/* Progress bar */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500">Sessions completed</span>
              <span className="text-xs font-bold text-slate-700">{count} / {UNLOCK_THRESHOLD}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.07)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress * 100}%`,
                  background: progress >= 1
                    ? 'linear-gradient(90deg,#16a34a,#22c55e)'
                    : 'linear-gradient(90deg,#2563eb,#06b6d4)',
                }}
              />
            </div>
            {remaining > 0 && (
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Every War Room synthesis adds a session. Patterns become reliable at {UNLOCK_THRESHOLD}.
              </p>
            )}
          </div>

          {/* Locked pattern previews */}
          <div className="space-y-2">
            {PATTERNS.map(({ icon: Icon, color, bg, title, description }) => (
              <div
                key={title}
                className="flex items-start gap-3 rounded-xl p-3"
                style={{ background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.05)', opacity: 0.7 }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: bg }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-700">{title}</span>
                    <Lock className="w-3 h-3 text-slate-300 flex-shrink-0" />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
