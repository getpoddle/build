import { useState, useEffect } from 'react';
import { Brain, Lock, TrendingDown, AlertTriangle, Zap, Eye, GitBranch, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

const UNLOCK_THRESHOLD = 3;

const RISK_CATEGORY_LABELS: Record<string, string> = {
  market: 'Market',
  execution: 'Execution',
  financial: 'Financial',
  team: 'Team',
  technology: 'Technology',
  regulatory: 'Regulatory',
  competitive: 'Competitive',
};

const RISK_CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  market: { bg: 'rgba(37,99,235,0.10)', text: '#2563eb' },
  execution: { bg: 'rgba(220,38,38,0.10)', text: '#dc2626' },
  financial: { bg: 'rgba(245,158,11,0.10)', text: '#d97706' },
  team: { bg: 'rgba(16,185,129,0.10)', text: '#059669' },
  technology: { bg: 'rgba(124,58,237,0.10)', text: '#7c3aed' },
  regulatory: { bg: 'rgba(239,68,68,0.10)', text: '#ef4444' },
  competitive: { bg: 'rgba(8,145,178,0.10)', text: '#0891b2' },
};

interface PatternData {
  dominant_bias: string | null;
  recurring_risks: string[];
  decision_category_history: string[];
}

interface LatestBiasFlag {
  bias_name: string;
  counter_question: string;
}

interface PatternIntelligenceCardProps {
  workspaceId: string;
}

export default function PatternIntelligenceCard({ workspaceId }: PatternIntelligenceCardProps) {
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [patternData, setPatternData] = useState<PatternData | null>(null);
  const [latestBiasFlag, setLatestBiasFlag] = useState<LatestBiasFlag | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const [countRes, memoryRes, synthRes] = await Promise.all([
      supabase
        .from('workspace_synthesis_history')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId),
      supabase
        .from('workspace_memory')
        .select('dominant_bias, recurring_risks, decision_category_history')
        .eq('workspace_id', workspaceId)
        .maybeSingle(),
      supabase
        .from('workspace_synthesis')
        .select('cognitive_bias_flags')
        .eq('workspace_id', workspaceId)
        .maybeSingle(),
    ]);

    setSessionCount(countRes.count ?? 0);

    if (memoryRes.data) {
      setPatternData({
        dominant_bias: memoryRes.data.dominant_bias ?? null,
        recurring_risks: Array.isArray(memoryRes.data.recurring_risks) ? memoryRes.data.recurring_risks : [],
        decision_category_history: Array.isArray(memoryRes.data.decision_category_history) ? memoryRes.data.decision_category_history : [],
      });

      // Find the bias flag matching dominant_bias for the counter_question
      if (synthRes.data?.cognitive_bias_flags) {
        const flags = synthRes.data.cognitive_bias_flags as Array<{ bias_name?: string; counter_question?: string }>;
        const dominant = memoryRes.data.dominant_bias;
        const match = dominant
          ? (flags.find(f => f.bias_name === dominant) ?? flags[0])
          : flags[0];
        if (match?.bias_name && match?.counter_question) {
          setLatestBiasFlag({ bias_name: match.bias_name, counter_question: match.counter_question });
        }
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const count = sessionCount ?? 0;
  const remaining = Math.max(0, UNLOCK_THRESHOLD - count);
  const progress = Math.min(1, count / UNLOCK_THRESHOLD);
  const unlocked = count >= UNLOCK_THRESHOLD;

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
            style={{
              background: unlocked
                ? 'linear-gradient(135deg,rgba(22,163,74,0.12),rgba(34,197,94,0.08))'
                : 'linear-gradient(135deg,rgba(15,23,42,0.08),rgba(15,23,42,0.05))',
            }}
          >
            <Brain
              className="w-4.5 h-4.5"
              style={{ width: '1.125rem', height: '1.125rem', color: unlocked ? '#16a34a' : '#64748b' }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">Pattern Intelligence</span>
              {unlocked && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                  style={{ background: 'rgba(22,163,74,0.10)', color: '#16a34a' }}
                >
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {sessionCount === null
                ? 'Loading\u2026'
                : unlocked
                ? `${count} synthesis session${count === 1 ? '' : 's'} analyzed`
                : `${remaining} more session${remaining === 1 ? '' : 's'} to unlock`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unlocked && (
            <button
              onClick={e => { e.stopPropagation(); handleRefresh(); }}
              className="p-1 rounded-lg transition-colors hover:bg-slate-100"
              title="Refresh patterns"
            >
              <RefreshCw
                className="w-3.5 h-3.5 text-slate-400"
                style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
              />
            </button>
          )}
          {collapsed
            ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            : <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        </div>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5">
          {!unlocked ? (
            <>
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
                      background: 'linear-gradient(90deg,#2563eb,#06b6d4)',
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Every War Room synthesis adds a session. Patterns become detectable at {UNLOCK_THRESHOLD}.
                </p>
              </div>

              {/* Locked previews */}
              <div className="space-y-2">
                {[
                  { icon: AlertTriangle, color: '#dc2626', bg: 'rgba(220,38,38,0.08)', title: 'Execution Risk Underestimation', description: 'Detect when your team consistently underweights how hard it is to ship.' },
                  { icon: TrendingDown, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', title: 'Financial Upside Over-indexing', description: 'Spot when revenue potential dominates while operational risks get low scores.' },
                  { icon: Zap, color: '#2563eb', bg: 'rgba(37,99,235,0.08)', title: 'Consensus Speed', description: 'Understand whether your team converges fast or circles.' },
                  { icon: Eye, color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', title: 'Recurring Blind Spots', description: 'Surface the risk categories your team never raises unprompted.' },
                  { icon: GitBranch, color: '#0891b2', bg: 'rgba(8,145,178,0.08)', title: 'Agent Disagreement Patterns', description: "Learn which AI agents consistently push back on your team's positions." },
                ].map(({ icon: Icon, color, bg, title, description }) => (
                  <div
                    key={title}
                    className="flex items-start gap-3 rounded-xl p-3"
                    style={{ background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.05)', opacity: 0.7 }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: bg }}>
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
            </>
          ) : (
            <div className="space-y-3">

              {/* Dominant bias + counter-question as action item */}
              {latestBiasFlag && (
                <div
                  className="rounded-xl p-3.5"
                  style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.12)' }}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(124,58,237,0.10)' }}
                    >
                      <Eye className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-bold text-slate-800">Recurring Blind Spot</span>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(124,58,237,0.10)', color: '#7c3aed' }}
                        >
                          {count}x sessions
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-700 mb-2">{latestBiasFlag.bias_name}</p>
                      <div
                        className="rounded-lg p-2.5"
                        style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.10)' }}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#7c3aed' }}>Action for your next session</p>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{latestBiasFlag.counter_question}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recurring risks */}
              {patternData && patternData.recurring_risks.length > 0 && (
                <div
                  className="rounded-xl p-3.5"
                  style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.10)' }}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(220,38,38,0.10)' }}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 mb-2">Recurring Risk Categories</p>
                      <div className="flex flex-wrap gap-1.5">
                        {patternData.recurring_risks.map(cat => {
                          const colors = RISK_CATEGORY_COLORS[cat] ?? { bg: 'rgba(15,23,42,0.06)', text: '#475569' };
                          return (
                            <span
                              key={cat}
                              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: colors.bg, color: colors.text }}
                            >
                              {RISK_CATEGORY_LABELS[cat] ?? cat}
                            </span>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                        These risk categories have surfaced across 3+ synthesis sessions.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Decision type history */}
              {patternData && patternData.decision_category_history.length > 0 && (
                <div
                  className="rounded-xl p-3.5"
                  style={{ background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.10)' }}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(37,99,235,0.10)' }}
                    >
                      <Zap className="w-3.5 h-3.5" style={{ color: '#2563eb' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 mb-2">Decision Type History</p>
                      <div className="flex flex-wrap gap-1 items-center">
                        {patternData.decision_category_history.slice(-7).map((cat, i, arr) => (
                          <span
                            key={i}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{
                              background: 'rgba(37,99,235,0.08)',
                              color: '#2563eb',
                              opacity: 0.4 + (i / Math.max(arr.length - 1, 1)) * 0.6,
                            }}
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                        Most recent sessions shown right. Fading left = older.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Still-accumulating tiles */}
              <div className="space-y-2 pt-1">
                {[
                  { icon: TrendingDown, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', title: 'Financial Upside Over-indexing', description: 'Accumulating data across sessions\u2026' },
                  { icon: GitBranch, color: '#0891b2', bg: 'rgba(8,145,178,0.08)', title: 'Agent Disagreement Patterns', description: 'Accumulating data across sessions\u2026' },
                ].map(({ icon: Icon, color, bg, title, description }) => (
                  <div
                    key={title}
                    className="flex items-start gap-3 rounded-xl p-3"
                    style={{ background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.05)' }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: bg }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-slate-600">{title}</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
