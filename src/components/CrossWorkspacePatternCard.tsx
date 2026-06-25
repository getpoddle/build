import { useState, useEffect } from 'react';
import { Brain, Lock, TrendingUp, Eye, Zap, GitBranch, BarChart2, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Lightbulb, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';

const UNLOCK_THRESHOLD = 2;
const AGENT_ALIGNMENT_THRESHOLD = 5;

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

interface HealthPoint {
  workspace_name: string;
  score: number;
  date: string;
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

function HealthSparkline({ points }: { points: HealthPoint[] }) {
  if (points.length < 2) return null;

  const W = 240;
  const H = 56;
  const PAD = 4;

  const scores = points.map(p => p.score);
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const range = maxS - minS || 1;

  const xs = points.map((_, i) => PAD + (i / (points.length - 1)) * (W - PAD * 2));
  const ys = points.map(p => H - PAD - ((p.score - minS) / range) * (H - PAD * 2));

  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const area =
    `M${xs[0]},${ys[0]} ` +
    xs.slice(1).map((x, i) => `L${x},${ys[i + 1]}`).join(' ') +
    ` L${xs[xs.length - 1]},${H} L${xs[0]},${H} Z`;

  const last = scores[scores.length - 1];
  const first = scores[0];
  const trend = last - first;
  const lineColor = trend >= 0 ? '#16a34a' : '#dc2626';
  const areaColor = trend >= 0 ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.06)';

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 56 }}>
        <path d={area} fill={areaColor} />
        <polyline
          points={polyline}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r="2.5" fill={lineColor} opacity={0.7} />
        ))}
      </svg>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-slate-400">
          {new Date(points[0].date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
        </span>
        <span className="text-[10px] font-bold" style={{ color: lineColor }}>
          {trend > 0 ? '+' : ''}{trend} pts {trend >= 0 ? '↑' : '↓'}
        </span>
        <span className="text-[10px] text-slate-400">
          {new Date(points[points.length - 1].date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </div>
  );
}

type IconComponent = typeof AlertTriangle;

interface Recommendation {
  icon: IconComponent;
  color: string;
  bg: string;
  text: string;
}

function deriveRecommendations(data: PatternIntelligence, count: number): Recommendation[] {
  const recs: Recommendation[] = [];

  if (data.dominant_bias) {
    recs.push({
      icon: Eye,
      color: '#7c3aed',
      bg: 'rgba(124,58,237,0.06)',
      text: `Your most flagged bias is "${data.dominant_bias}". Before your next War Room synthesis, explicitly ask the team to argue the opposite position.`,
    });
  }

  const avgHealth =
    data.risk_tolerance_map.length > 0
      ? data.risk_tolerance_map.reduce((s, e) => s + e.health_score, 0) / data.risk_tolerance_map.length
      : null;

  if (avgHealth !== null && avgHealth < 55) {
    recs.push({
      icon: Activity,
      color: '#d97706',
      bg: 'rgba(245,158,11,0.06)',
      text: `Your average decision health is ${Math.round(avgHealth)} — below the healthy threshold of 55. Focus your next session on resolving open questions and reducing blind spots.`,
    });
  }

  const criticalWs = data.risk_tolerance_map.find(e => e.risk_level === 'high' && e.health_score < 50);
  if (criticalWs) {
    recs.push({
      icon: AlertTriangle,
      color: '#dc2626',
      bg: 'rgba(220,38,38,0.06)',
      text: `"${criticalWs.workspace_name}" shows high risk with a health score of ${criticalWs.health_score}. Address its open questions before making strategic commitments.`,
    });
  }

  if (count >= UNLOCK_THRESHOLD && count < AGENT_ALIGNMENT_THRESHOLD) {
    recs.push({
      icon: Lightbulb,
      color: '#0891b2',
      bg: 'rgba(8,145,178,0.06)',
      text: `You have ${count} synthesized workspace${count === 1 ? '' : 's'}. Run ${AGENT_ALIGNMENT_THRESHOLD - count} more War Room session${AGENT_ALIGNMENT_THRESHOLD - count === 1 ? '' : 's'} to unlock Agent Alignment tracking.`,
    });
  }

  return recs.slice(0, 3);
}

export default function CrossWorkspacePatternCard({ userId }: CrossWorkspacePatternCardProps) {
  const [data, setData] = useState<PatternIntelligence | null>(null);
  const [healthHistory, setHealthHistory] = useState<HealthPoint[]>([]);
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
      const snapshots: WorkspaceSnapshot[] = Array.isArray(row.workspace_snapshots)
        ? row.workspace_snapshots
        : [];

      setData({
        workspace_count: row.workspace_count ?? 0,
        workspace_snapshots: snapshots,
        bias_fingerprint:
          row.bias_fingerprint && typeof row.bias_fingerprint === 'object'
            ? row.bias_fingerprint
            : {},
        dominant_bias: row.dominant_bias ?? null,
        risk_tolerance_map: Array.isArray(row.risk_tolerance_map) ? row.risk_tolerance_map : [],
        decision_style_summary: row.decision_style_summary ?? null,
      });

      if (snapshots.length > 0) {
        const workspaceIds = snapshots.map(s => s.workspace_id);
        const { data: history } = await supabase
          .from('workspace_synthesis_history')
          .select('workspace_id, decision_health_score, generated_at')
          .in('workspace_id', workspaceIds)
          .order('generated_at', { ascending: true })
          .limit(30);

        if (history && history.length >= 2) {
          const wsName: Record<string, string> = {};
          for (const s of snapshots) wsName[s.workspace_id] = s.workspace_name;
          setHealthHistory(
            history.map(h => ({
              workspace_name: wsName[h.workspace_id] ?? 'Workspace',
              score: h.decision_health_score,
              date: h.generated_at,
            }))
          );
        }
      }
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

  const topBiases = data
    ? Object.entries(data.bias_fingerprint)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
    : [];

  const recommendations = data && unlocked ? deriveRecommendations(data, count) : [];

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
              {/* Progress bar */}
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

              {/* Locked feature previews */}
              <div className="space-y-2">
                {[
                  { icon: Activity,   color: '#2563eb', bg: 'rgba(37,99,235,0.08)',   title: 'Health Score Trend',  description: 'How your decision health evolves over time across workspaces.' },
                  { icon: TrendingUp, color: '#16a34a', bg: 'rgba(22,163,74,0.08)',   title: 'Recurring Themes',    description: 'Topics and domains that appear across your decisions.' },
                  { icon: Eye,        color: '#7c3aed', bg: 'rgba(124,58,237,0.08)',  title: 'Bias Fingerprint',    description: 'Which cognitive biases the AI flags most in your thinking.' },
                  { icon: Zap,        color: '#2563eb', bg: 'rgba(37,99,235,0.08)',   title: 'Decision Style',      description: 'How you balance risk, speed, and financial conservatism.' },
                  { icon: BarChart2,  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', title: 'Risk Tolerance Map',  description: 'How your risk appetite shifts across decision domains.' },
                  { icon: GitBranch,  color: '#0891b2', bg: 'rgba(8,145,178,0.08)',   title: 'Agent Alignment',     description: 'Which AI agents you most frequently agree or clash with.' },
                  { icon: Lightbulb,  color: '#d97706', bg: 'rgba(245,158,11,0.08)', title: 'Recommendations',     description: 'Personalised next actions based on your decision patterns.' },
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

              {/* Health Score Trend — sparkline from synthesis history */}
              {healthHistory.length >= 2 && (
                <div
                  className="rounded-xl p-3.5"
                  style={{ background: 'linear-gradient(135deg,rgba(37,99,235,0.04),rgba(6,182,212,0.03))', border: '1px solid rgba(37,99,235,0.10)' }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(37,99,235,0.10)' }}>
                      <Activity className="w-3.5 h-3.5" style={{ color: '#2563eb' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-slate-800">Health Score Trend</p>
                        <span className="text-[10px] text-slate-400">{healthHistory.length} syntheses</span>
                      </div>
                      <HealthSparkline points={healthHistory} />
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                        Decision health across all workspaces over time.
                      </p>
                    </div>
                  </div>
                </div>
              )}

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

              {/* Workspaces Analyzed */}
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

              {/* Decision Focus Areas */}
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

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div
                  className="rounded-xl p-3.5"
                  style={{ background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.07)' }}
                >
                  <p className="text-xs font-bold text-slate-800 mb-2.5">Recommendations</p>
                  <div className="space-y-2.5">
                    {recommendations.map((rec, i) => {
                      const Icon = rec.icon;
                      return (
                        <div key={i} className="flex items-start gap-2.5">
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: rec.bg }}
                          >
                            <Icon className="w-3 h-3" style={{ color: rec.color }} />
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed flex-1">{rec.text}</p>
                        </div>
                      );
                    })}
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
