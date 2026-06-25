import { useState, useEffect } from 'react';
import { Brain, Lock, TrendingUp, Eye, Zap, GitBranch, BarChart2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

const UNLOCK_THRESHOLD = 2;

const RISK_LEVEL_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: 'rgba(220,38,38,0.10)',  text: '#dc2626', label: 'High risk'   },
  medium: { bg: 'rgba(245,158,11,0.10)', text: '#d97706', label: 'Medium risk' },
  low:    { bg: 'rgba(22,163,74,0.10)',  text: '#16a34a', label: 'Low risk'    },
};

const HEALTH_BAR_COLOR = (score: number) =>
  score >= 70 ? '#16a34a' : score >= 50 ? '#f59e0b' : '#dc2626';

interface WorkspaceSnapshot {
  workspace_id: string;
  workspace_name: string;
  decision_health_score: number;
  dominant_risk_category: string;
  bias_flags: string[];
  risk_level: 'high' | 'medium' | 'low';
}

interface RiskToleranceEntry {
  workspace_name: string;
  health_score: number;
  risk_level: 'high' | 'medium' | 'low';
}

interface PatternIntelligence {
  workspace_count: number;
  workspace_snapshots: WorkspaceSnapshot[];
  bias_fingerprint: Record<string, number>;
  dominant_bias: string | null;
  risk_tolerance_map: RiskToleranceEntry[];
  decision_style_summary: string | null;
}

interface CrossWorkspacePatternCardProps {
  userId: string;
}

export default function CrossWorkspacePatternCard({ userId }: CrossWorkspacePatternCardProps) {
  const [data, setData] = useState<PatternIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const { data: row } = await supabase
      .from('user_pattern_intelligence')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (row) {
      setData({
        workspace_count: row.workspace_count ?? 0,
        workspace_snapshots: Array.isArray(row.workspace_snapshots) ? row.workspace_snapshots : [],
        bias_fingerprint: (row.bias_fingerprint && typeof row.bias_fingerprint === 'object') ? row.bias_fingerprint : {},
        dominant_bias: row.dominant_bias ?? null,
        risk_tolerance_map: Array.isArray(row.risk_tolerance_map) ? row.risk_tolerance_map : [],
        decision_style_summary: row.decision_style_summary ?? null,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const count = data?.workspace_count ?? 0;
  const unlocked = count >= UNLOCK_THRESHOLD;
  const remaining = Math.max(0, UNLOCK_THRESHOLD - count);
  const progress = Math.min(1, count / UNLOCK_THRESHOLD);

  // Top biases sorted by frequency
  const topBiases = data
    ? Object.entries(data.bias_fingerprint)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
    : [];

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
                ? 'linear-gradient(135deg,rgba(37,99,235,0.14),rgba(6,182,212,0.10))'
                : 'linear-gradient(135deg,rgba(15,23,42,0.08),rgba(15,23,42,0.05))',
            }}
          >
            <Brain
              style={{ width: '1.125rem', height: '1.125rem', color: unlocked ? '#2563eb' : '#64748b' }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">Decision Intelligence</span>
              {unlocked && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                  style={{ background: 'rgba(37,99,235,0.10)', color: '#2563eb' }}
                >
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {loading
                ? 'Loading\u2026'
                : unlocked
                ? `Patterns from ${count} workspace${count === 1 ? '' : 's'}`
                : `${remaining} more synthesized workspace${remaining === 1 ? '' : 's'} to unlock`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unlocked && (
            <button
              onClick={e => { e.stopPropagation(); handleRefresh(); }}
              className="p-1 rounded-lg transition-colors hover:bg-slate-100"
              title="Refresh"
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
              {/* Progress */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-500">Workspaces synthesized</span>
                  <span className="text-xs font-bold text-slate-700">{count} / {UNLOCK_THRESHOLD}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.07)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${progress * 100}%`, background: 'linear-gradient(90deg,#2563eb,#06b6d4)' }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Run the War Room in {UNLOCK_THRESHOLD} workspaces and Poddle learns how you make decisions across contexts.
                </p>
              </div>

              {/* Locked previews */}
              <div className="space-y-2">
                {[
                  { icon: TrendingUp,  color: '#16a34a', bg: 'rgba(22,163,74,0.08)',   title: 'Recurring Themes',       description: 'Topics and domains that appear across your decisions.' },
                  { icon: Eye,         color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', title: 'Bias Fingerprint',        description: 'Which cognitive biases the AI flags most in your thinking.' },
                  { icon: Zap,         color: '#2563eb', bg: 'rgba(37,99,235,0.08)',   title: 'Decision Style',         description: 'How you balance risk, speed, and financial conservatism.' },
                  { icon: BarChart2,   color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', title: 'Risk Tolerance Map',     description: 'How your risk appetite shifts across decision domains.' },
                  { icon: GitBranch,   color: '#0891b2', bg: 'rgba(8,145,178,0.08)',  title: 'Agent Alignment',        description: 'Which AI agents you most frequently agree or clash with.' },
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
          ) : data && (
            <div className="space-y-3">

              {/* Decision Style */}
              {data.decision_style_summary && (
                <div
                  className="rounded-xl p-3.5"
                  style={{ background: 'linear-gradient(135deg,rgba(37,99,235,0.05),rgba(6,182,212,0.04))', border: '1px solid rgba(37,99,235,0.12)' }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(37,99,235,0.10)' }}>
                      <Zap className="w-3.5 h-3.5" style={{ color: '#2563eb' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 mb-0.5">Your Decision Style</p>
                      <p className="text-sm font-semibold" style={{ color: '#2563eb' }}>{data.decision_style_summary}</p>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Derived from health scores and risk patterns across {count} workspace{count === 1 ? '' : 's'}.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Bias Fingerprint */}
              {topBiases.length > 0 && (
                <div
                  className="rounded-xl p-3.5"
                  style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.12)' }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(124,58,237,0.10)' }}>
                      <Eye className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 mb-2">Bias Fingerprint</p>
                      <div className="space-y-1.5">
                        {topBiases.map(([bias, cnt]) => (
                          <div key={bias} className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-700 font-medium truncate">{bias}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <div className="h-1 rounded-full overflow-hidden w-16" style={{ background: 'rgba(124,58,237,0.12)' }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(100, (cnt / (topBiases[0][1] || 1)) * 100)}%`,
                                    background: '#7c3aed',
                                  }}
                                />
                              </div>
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: 'rgba(124,58,237,0.10)', color: '#7c3aed', minWidth: '2rem', textAlign: 'center' }}
                              >
                                {cnt}x
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {data.dominant_bias && (
                        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                          <span className="font-semibold" style={{ color: '#7c3aed' }}>{data.dominant_bias}</span> is your most recurring pattern.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Tolerance Map */}
              {data.risk_tolerance_map.length > 0 && (
                <div
                  className="rounded-xl p-3.5"
                  style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(245,158,11,0.10)' }}>
                      <BarChart2 className="w-3.5 h-3.5" style={{ color: '#d97706' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 mb-2">Risk Tolerance by Workspace</p>
                      <div className="space-y-2">
                        {data.risk_tolerance_map.map((entry, i) => {
                          const style = RISK_LEVEL_STYLE[entry.risk_level] ?? RISK_LEVEL_STYLE.medium;
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <span className="text-[11px] font-medium text-slate-700 truncate block">{entry.workspace_name}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <div className="h-1 rounded-full overflow-hidden flex-1" style={{ background: 'rgba(15,23,42,0.07)' }}>
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${entry.health_score}%`, background: HEALTH_BAR_COLOR(entry.health_score) }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-slate-400 flex-shrink-0">{entry.health_score}</span>
                                </div>
                              </div>
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: style.bg, color: style.text }}
                              >
                                {style.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recurring Themes — derived from workspace names/topics */}
              {data.workspace_snapshots.length >= 2 && (
                <div
                  className="rounded-xl p-3.5"
                  style={{ background: 'rgba(22,163,74,0.04)', border: '1px solid rgba(22,163,74,0.12)' }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(22,163,74,0.10)' }}>
                      <TrendingUp className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 mb-2">Workspaces Analyzed</p>
                      <div className="flex flex-wrap gap-1.5">
                        {data.workspace_snapshots.map(snap => (
                          <span
                            key={snap.workspace_id}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(22,163,74,0.08)', color: '#16a34a' }}
                          >
                            {snap.workspace_name}
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                        Cross-workspace patterns computed from {count} decision context{count === 1 ? '' : 's'}.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Decision Focus — derived from dominant risk category per workspace */}
              {data.workspace_snapshots.length >= 2 && (() => {
                const freq: Record<string, number> = {};
                for (const snap of data.workspace_snapshots) {
                  if (snap.dominant_risk_category) {
                    freq[snap.dominant_risk_category] = (freq[snap.dominant_risk_category] ?? 0) + 1;
                  }
                }
                const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
                const maxCount = sorted[0]?.[1] ?? 1;
                if (sorted.length === 0) return null;
                return (
                  <div
                    className="rounded-xl p-3.5"
                    style={{ background: 'rgba(8,145,178,0.04)', border: '1px solid rgba(8,145,178,0.10)' }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(8,145,178,0.10)' }}>
                        <GitBranch className="w-3.5 h-3.5" style={{ color: '#0891b2' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 mb-2">Decision Focus Areas</p>
                        <div className="space-y-1.5">
                          {sorted.map(([cat, cnt]) => (
                            <div key={cat} className="flex items-center gap-2">
                              <span className="text-[11px] font-medium text-slate-700 capitalize w-24 flex-shrink-0">{cat}</span>
                              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(8,145,178,0.10)' }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${(cnt / maxCount) * 100}%`, background: '#0891b2' }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-400 flex-shrink-0 w-8 text-right">
                                {cnt}/{data.workspace_snapshots.length}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                          Dominant risk category per workspace across {count} decision context{count === 1 ? '' : 's'}.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Agent Alignment — threshold gate */}
              {count < 5 && (
                <div
                  className="flex items-start gap-3 rounded-xl p-3"
                  style={{ background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.05)' }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(8,145,178,0.08)' }}>
                    <GitBranch className="w-3.5 h-3.5" style={{ color: '#0891b2' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-600">Agent Alignment</span>
                      <Lock className="w-3 h-3 text-slate-300 flex-shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                      Unlocks after 5 synthesized workspaces — {5 - count} more to go.
                    </p>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}
