import { useState, useEffect } from 'react';
import { Brain, Lock, TrendingUp, Eye, Zap, GitBranch, BarChart2, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Lightbulb, Activity, Users, CheckSquare, ThumbsUp, ThumbsDown, RotateCcw, XCircle, Globe, ToggleLeft, ToggleRight, Award, Cpu } from 'lucide-react';
import { supabase } from '../lib/supabase';

const UNLOCK_THRESHOLD = 1;
const AGENT_ALIGNMENT_THRESHOLD = 5;

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  risk_analyst:        'Risk Analyst',
  execution_lead:      'Execution Lead',
  market_analyst:      'Market Analyst',
  people_advisor:      'People Advisor',
  devils_advocate:     "Devil's Advocate",
  innovation_scout:    'Innovation Scout',
  strategic_analyst:   'Strategic Analyst',
  financial_strategist:'Financial Strategist',
};

function canonicalAgentName(raw: string): string {
  const lower = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return AGENT_DISPLAY_NAMES[lower] ?? raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/devil s advocate/i, "Devil's Advocate");
}

function mergeAgentAlignmentMap(
  raw: Record<string, AgentAlignmentEntry>
): Record<string, AgentAlignmentEntry> {
  const merged: Record<string, { tension_sum: number; conflict_sum: number; score_sum: number; n: number }> = {};
  for (const [key, stats] of Object.entries(raw)) {
    const name = canonicalAgentName(key);
    if (!merged[name]) merged[name] = { tension_sum: 0, conflict_sum: 0, score_sum: 0, n: 0 };
    merged[name].tension_sum  += stats.avg_tension;
    merged[name].conflict_sum += stats.conflict_count;
    merged[name].score_sum    += stats.alignment_score;
    merged[name].n            += 1;
  }
  const result: Record<string, AgentAlignmentEntry> = {};
  for (const [name, agg] of Object.entries(merged)) {
    result[name] = {
      avg_tension:     Math.round(agg.tension_sum  / agg.n),
      conflict_count:  agg.conflict_sum,
      alignment_score: Math.round(agg.score_sum    / agg.n),
    };
  }
  return result;
}

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

interface AgentAlignmentEntry {
  conflict_count: number;
  avg_tension: number;
  alignment_score: number;
}

interface PatternIntelligence {
  workspace_count: number;
  workspace_snapshots: WorkspaceSnapshot[];
  bias_fingerprint: Record<string, number>;
  dominant_bias: string | null;
  risk_tolerance_map: RiskToleranceEntry[];
  decision_style_summary: string | null;
  agent_alignment_map: Record<string, AgentAlignmentEntry>;
  avg_alignment_score: number | null;
  benchmark_opt_in: boolean;
}

interface BenchmarkStats {
  count: number;
  avg_score: number;
  p25_score: number;
  p75_score: number;
  p90_score: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  market:      'Market',
  execution:   'Execution',
  financial:   'Financial',
  team:        'Team',
  technology:  'Technology',
};

interface CrossWorkspacePatternCardProps {
  userId: string;
}

interface OutcomeStats {
  total: number;
  succeeded: number;
  failed: number;
  reversed: number;
  abandoned: number;
  successRate: number;
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
  const lineColor = trend > 0 ? '#16a34a' : trend < 0 ? '#dc2626' : '#64748b';
  const areaColor = trend > 0 ? 'rgba(22,163,74,0.08)' : trend < 0 ? 'rgba(220,38,38,0.06)' : 'rgba(100,116,139,0.06)';

  const fmt = (d: string) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  const startLabel = fmt(points[0].date);
  const endLabel = fmt(points[points.length - 1].date);
  const sameDate = startLabel === endLabel;

  const trendLabel = trend === 0
    ? 'Stable'
    : `${trend > 0 ? '+' : ''}${trend} pts ${trend > 0 ? '↑' : '↓'}`;

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
        {sameDate ? (
          <span className="text-[10px] text-slate-400">{startLabel}</span>
        ) : (
          <span className="text-[10px] text-slate-400">{startLabel}</span>
        )}
        <span className="text-[10px] font-bold" style={{ color: lineColor }}>
          {trendLabel}
        </span>
        {sameDate ? (
          <span className="text-[10px] text-slate-400">{points.length} records</span>
        ) : (
          <span className="text-[10px] text-slate-400">{endLabel}</span>
        )}
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

  if (count >= UNLOCK_THRESHOLD && count < 5) {
    recs.push({
      icon: Lightbulb,
      color: '#0891b2',
      bg: 'rgba(8,145,178,0.06)',
      text: `You have ${count} synthesized workspace${count === 1 ? '' : 's'}. Run more War Room sessions to strengthen your Agent Alignment and Decision Style patterns.`,
    });
  }

  return recs.slice(0, 3);
}

export default function CrossWorkspacePatternCard({ userId }: CrossWorkspacePatternCardProps) {
  const [data, setData] = useState<PatternIntelligence | null>(null);
  const [healthHistory, setHealthHistory] = useState<HealthPoint[]>([]);
  const [outcomeStats, setOutcomeStats] = useState<OutcomeStats | null>(null);
  const [benchmarkStats, setBenchmarkStats] = useState<BenchmarkStats | null>(null);
  const [benchmarkPercentile, setBenchmarkPercentile] = useState<number | null>(null);
  const [benchmarkCategory, setBenchmarkCategory] = useState<string | null>(null);
  const [togglingBenchmark, setTogglingBenchmark] = useState(false);
  const [trainingContributions, setTrainingContributions] = useState<number | null>(null);
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

      const optedIn = row.benchmark_opt_in === true;

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
        agent_alignment_map:
          row.agent_alignment_map && typeof row.agent_alignment_map === 'object'
            ? mergeAgentAlignmentMap(row.agent_alignment_map as Record<string, AgentAlignmentEntry>)
            : {},
        avg_alignment_score: typeof row.avg_alignment_score === 'number' ? row.avg_alignment_score : null,
        benchmark_opt_in: optedIn,
      });

      if (snapshots.length > 0) {
        const workspaceIds = snapshots.map(s => s.workspace_id);

        const [historyRes, outcomesRes] = await Promise.all([
          supabase
            .from('workspace_synthesis_history')
            .select('workspace_id, decision_health_score, generated_at')
            .in('workspace_id', workspaceIds)
            .order('generated_at', { ascending: true })
            .limit(40),
          supabase
            .from('workspace_action_items')
            .select('outcome')
            .in('workspace_id', workspaceIds)
            .eq('status', 'done')
            .not('outcome', 'is', null),
        ]);

        if (historyRes.data && historyRes.data.length >= 2) {
          const wsName: Record<string, string> = {};
          for (const s of snapshots) wsName[s.workspace_id] = s.workspace_name;
          setHealthHistory(
            historyRes.data.map(h => ({
              workspace_name: wsName[h.workspace_id] ?? 'Workspace',
              score: h.decision_health_score,
              date: h.generated_at,
            }))
          );
        }

        if (outcomesRes.data && outcomesRes.data.length > 0) {
          const counts = { succeeded: 0, failed: 0, reversed: 0, abandoned: 0 };
          for (const item of outcomesRes.data) {
            const o = item.outcome as keyof typeof counts;
            if (o in counts) counts[o]++;
          }
          const total = counts.succeeded + counts.failed + counts.reversed + counts.abandoned;
          setOutcomeStats({
            ...counts,
            total,
            successRate: total > 0 ? Math.round((counts.succeeded / total) * 100) : 0,
          });
        }

        // Benchmark stats — compute dominant category then fetch aggregate stats
        if (snapshots.length > 0) {
          const freqMap: Record<string, number> = {};
          for (const snap of snapshots) {
            const cat = snap.dominant_risk_category ?? 'execution';
            freqMap[cat] = (freqMap[cat] ?? 0) + 1;
          }
          let domCat = 'execution';
          let maxF = 0;
          for (const [cat, f] of Object.entries(freqMap)) {
            if (f > maxF) { maxF = f; domCat = cat; }
          }
          setBenchmarkCategory(domCat);

          // Fetch aggregate stats (always available — anonymous data)
          const { data: bStats } = await supabase.rpc('get_decision_benchmark_stats', { p_category: domCat });
          if (bStats && (bStats as BenchmarkStats).count >= 5) {
            setBenchmarkStats(bStats as BenchmarkStats);

            // Fetch percentile for the user's own avg health score
            const avgH = snapshots.length > 0
              ? Math.round(snapshots.reduce((s, snap) => s + snap.decision_health_score, 0) / snapshots.length)
              : 0;
            const { data: pctile } = await supabase.rpc('get_benchmark_percentile', { p_category: domCat, p_score: avgH });
            if (typeof pctile === 'number') setBenchmarkPercentile(pctile);
          }
        }
      }
    }

    // Training contribution count (Direction 4 badge)
    const { data: contribCount } = await supabase.rpc('get_my_training_contribution_count', { p_user_id: userId });
    if (typeof contribCount === 'number') setTrainingContributions(contribCount);

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

  const toggleBenchmarkOptIn = async () => {
    if (!data) return;
    const newVal = !data.benchmark_opt_in;
    setTogglingBenchmark(true);
    const { error } = await supabase
      .from('user_pattern_intelligence')
      .update({ benchmark_opt_in: newVal })
      .eq('user_id', userId);
    if (!error) {
      setData(prev => prev ? { ...prev, benchmark_opt_in: newVal } : prev);
      if (!newVal) {
        setBenchmarkStats(null);
        setBenchmarkPercentile(null);
      }
    }
    setTogglingBenchmark(false);
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
              <span className="text-sm font-bold text-slate-900">Pattern Intelligence</span>
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
                  { icon: GitBranch,  color: '#0891b2', bg: 'rgba(8,145,178,0.08)',   title: 'Agent Alignment',     description: 'Which AI agents you most frequently agree or conflict with.' },
                  { icon: CheckSquare, color: '#16a34a', bg: 'rgba(22,163,74,0.08)', title: 'Action Track Record', description: 'What percentage of your completed actions actually succeeded.' },
                  { icon: Globe,      color: '#0891b2', bg: 'rgba(8,145,178,0.08)',  title: 'Benchmark Mode',      description: 'See how your decision health compares to other teams in the same category.' },
                  { icon: Cpu,        color: '#2563eb', bg: 'rgba(37,99,235,0.08)',  title: 'Model Contribution',  description: 'Your outcomes contribute to training a proprietary decision intelligence model.' },
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
              {data.workspace_snapshots.length >= 1 && (
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
              {data.workspace_snapshots.length >= 1 && (() => {
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

              {/* Agent Alignment — available once the card is unlocked */}
              {count >= UNLOCK_THRESHOLD && (() => {
                const entries = Object.entries(data.agent_alignment_map ?? {})
                  .sort((a, b) => a[1].alignment_score - b[1].alignment_score);
                if (entries.length === 0) return (
                  <div
                    className="rounded-xl p-3.5"
                    style={{ background: 'rgba(8,145,178,0.04)', border: '1px solid rgba(8,145,178,0.12)' }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(8,145,178,0.10)' }}>
                        <Users className="w-3.5 h-3.5" style={{ color: '#0891b2' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 mb-0.5">Agent Alignment</p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          No conflict data yet. Re-run the War Room synthesis to start tracking which agents conflict or align with your decisions.
                        </p>
                      </div>
                    </div>
                  </div>
                );
                const alignColor = (score: number) =>
                  score >= 70 ? '#16a34a' : score >= 45 ? '#d97706' : '#dc2626';
                const alignLabel = (score: number) =>
                  score >= 70 ? 'Aligned' : score >= 45 ? 'Mixed' : 'Conflicts';
                const alignBg = (score: number) =>
                  score >= 70 ? 'rgba(22,163,74,0.10)' : score >= 45 ? 'rgba(245,158,11,0.10)' : 'rgba(220,38,38,0.10)';
                const mostClashing = entries[0];
                const mostAligned = entries[entries.length - 1];
                return (
                  <div
                    className="rounded-xl p-3.5"
                    style={{ background: 'rgba(8,145,178,0.04)', border: '1px solid rgba(8,145,178,0.12)' }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(8,145,178,0.10)' }}>
                        <Users className="w-3.5 h-3.5" style={{ color: '#0891b2' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-800">Agent Alignment</p>
                          {data.avg_alignment_score !== null && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: alignBg(data.avg_alignment_score), color: alignColor(data.avg_alignment_score) }}
                            >
                              Avg {data.avg_alignment_score}
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {entries.map(([agent, stats]) => (
                            <div key={agent} className="flex items-center gap-2">
                              <span className="text-[11px] font-medium text-slate-700 truncate flex-1">{agent}</span>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <div className="h-1.5 rounded-full overflow-hidden w-20" style={{ background: 'rgba(15,23,42,0.08)' }}>
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${stats.alignment_score}%`, background: alignColor(stats.alignment_score) }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold w-6 text-right" style={{ color: alignColor(stats.alignment_score) }}>
                                  {stats.alignment_score}
                                </span>
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full w-14 text-center"
                                  style={{ background: alignBg(stats.alignment_score), color: alignColor(stats.alignment_score) }}
                                >
                                  {alignLabel(stats.alignment_score)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                          {mostClashing && mostAligned && mostClashing[0] !== mostAligned[0]
                            ? <><span className="font-semibold" style={{ color: '#dc2626' }}>{mostClashing[0]}</span> has the most conflicts in your sessions; <span className="font-semibold" style={{ color: '#16a34a' }}>{mostAligned[0]}</span> is your most aligned agent.</>
                            : 'Based on conflict zones across your synthesized workspaces.'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Action Outcome Track Record */}
              {outcomeStats && outcomeStats.total >= 3 && (
                <div
                  className="rounded-xl p-3.5"
                  style={{ background: 'rgba(22,163,74,0.03)', border: '1px solid rgba(22,163,74,0.12)' }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(22,163,74,0.10)' }}>
                      <CheckSquare className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-slate-800">Action Track Record</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: outcomeStats.successRate >= 60 ? 'rgba(22,163,74,0.1)' : outcomeStats.successRate >= 40 ? 'rgba(245,158,11,0.1)' : 'rgba(220,38,38,0.1)', color: outcomeStats.successRate >= 60 ? '#15803d' : outcomeStats.successRate >= 40 ? '#b45309' : '#b91c1c' }}>
                          {outcomeStats.successRate}% success rate
                        </span>
                      </div>
                      {/* Stacked bar */}
                      <div className="flex h-2 rounded-full overflow-hidden mb-2.5 gap-px">
                        {outcomeStats.succeeded > 0 && (
                          <div className="rounded-l-full" style={{ flex: outcomeStats.succeeded, background: '#16a34a' }} />
                        )}
                        {outcomeStats.failed > 0 && (
                          <div style={{ flex: outcomeStats.failed, background: '#dc2626' }} />
                        )}
                        {outcomeStats.reversed > 0 && (
                          <div style={{ flex: outcomeStats.reversed, background: '#f59e0b' }} />
                        )}
                        {outcomeStats.abandoned > 0 && (
                          <div className="rounded-r-full" style={{ flex: outcomeStats.abandoned, background: '#94a3b8' }} />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {outcomeStats.succeeded > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#15803d' }}>
                            <ThumbsUp className="w-2.5 h-2.5" />{outcomeStats.succeeded} succeeded
                          </span>
                        )}
                        {outcomeStats.failed > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#b91c1c' }}>
                            <ThumbsDown className="w-2.5 h-2.5" />{outcomeStats.failed} failed
                          </span>
                        )}
                        {outcomeStats.reversed > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#b45309' }}>
                            <RotateCcw className="w-2.5 h-2.5" />{outcomeStats.reversed} reversed
                          </span>
                        )}
                        {outcomeStats.abandoned > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#64748b' }}>
                            <XCircle className="w-2.5 h-2.5" />{outcomeStats.abandoned} abandoned
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                        Across {outcomeStats.total} completed action item{outcomeStats.total === 1 ? '' : 's'} in your workspaces.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Benchmark Mode — opt-in toggle */}
              <div
                className="rounded-xl p-3.5"
                style={{ background: 'rgba(8,145,178,0.03)', border: '1px solid rgba(8,145,178,0.12)' }}
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(8,145,178,0.10)' }}>
                    <Globe className="w-3.5 h-3.5" style={{ color: '#0891b2' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-slate-800">Benchmark Mode</p>
                      <button
                        onClick={toggleBenchmarkOptIn}
                        disabled={togglingBenchmark}
                        className="flex items-center gap-1.5 transition-opacity"
                        style={{ opacity: togglingBenchmark ? 0.5 : 1 }}
                      >
                        {data?.benchmark_opt_in
                          ? <ToggleRight className="w-5 h-5" style={{ color: '#0891b2' }} />
                          : <ToggleLeft className="w-5 h-5 text-slate-300" />}
                        <span className="text-[11px] font-semibold" style={{ color: data?.benchmark_opt_in ? '#0891b2' : '#94a3b8' }}>
                          {data?.benchmark_opt_in ? 'On' : 'Off'}
                        </span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {data?.benchmark_opt_in
                        ? 'Your anonymized decision health score contributes to the benchmark pool. No workspace names, contents, or identifiers are shared — only your aggregate health score and dominant decision category.'
                        : 'Opt in to contribute your anonymized decision health score. In return, see how your team compares to others making similar decisions.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Benchmark Comparison — shown when opted in and enough data exists */}
              {data?.benchmark_opt_in && benchmarkStats && benchmarkCategory && (() => {
                const userAvg = data.workspace_snapshots.length > 0
                  ? Math.round(data.workspace_snapshots.reduce((s, snap) => s + snap.decision_health_score, 0) / data.workspace_snapshots.length)
                  : 0;
                const diff = userAvg - benchmarkStats.avg_score;
                const isAbove = diff >= 0;
                const catLabel = CATEGORY_LABELS[benchmarkCategory] ?? benchmarkCategory;

                const percentileLabel = (p: number) => {
                  if (p >= 90) return { text: 'Top 10%', color: '#15803d', bg: 'rgba(22,163,74,0.10)' };
                  if (p >= 75) return { text: 'Top 25%', color: '#16a34a', bg: 'rgba(22,163,74,0.08)' };
                  if (p >= 50) return { text: 'Above avg', color: '#d97706', bg: 'rgba(245,158,11,0.10)' };
                  if (p >= 25) return { text: 'Below avg', color: '#b45309', bg: 'rgba(245,158,11,0.08)' };
                  return { text: 'Bottom 25%', color: '#b91c1c', bg: 'rgba(220,38,38,0.08)' };
                };

                const pLabel = benchmarkPercentile !== null ? percentileLabel(benchmarkPercentile) : null;

                return (
                  <div
                    className="rounded-xl p-3.5"
                    style={{ background: isAbove ? 'rgba(22,163,74,0.03)' : 'rgba(245,158,11,0.03)', border: `1px solid ${isAbove ? 'rgba(22,163,74,0.14)' : 'rgba(245,158,11,0.14)'}` }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: isAbove ? 'rgba(22,163,74,0.10)' : 'rgba(245,158,11,0.10)' }}>
                        <Award className="w-3.5 h-3.5" style={{ color: isAbove ? '#16a34a' : '#d97706' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-800">{catLabel} Benchmark</p>
                          {pLabel && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: pLabel.bg, color: pLabel.color }}>
                              {pLabel.text}
                            </span>
                          )}
                        </div>

                        {/* Score comparison bar */}
                        <div className="mb-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-slate-400">Your avg</span>
                            <span className="text-[10px] text-slate-400">Benchmark avg</span>
                          </div>
                          <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.07)' }}>
                            {/* benchmark avg marker */}
                            <div
                              className="absolute top-0 h-full"
                              style={{
                                left: 0,
                                width: `${benchmarkStats.avg_score}%`,
                                background: 'rgba(100,116,139,0.35)',
                                borderRadius: '0.25rem',
                              }}
                            />
                            {/* user score bar */}
                            <div
                              className="absolute top-0 h-full rounded-full"
                              style={{
                                left: 0,
                                width: `${userAvg}%`,
                                background: isAbove ? '#16a34a' : '#f59e0b',
                                transition: 'width 0.6s ease',
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[11px] font-bold" style={{ color: isAbove ? '#16a34a' : '#d97706' }}>{userAvg}</span>
                            <span className="text-[10px] text-slate-400">{benchmarkStats.avg_score} avg</span>
                          </div>
                        </div>

                        {/* P25 / P75 range */}
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.05)' }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                marginLeft: `${benchmarkStats.p25_score}%`,
                                width: `${benchmarkStats.p75_score - benchmarkStats.p25_score}%`,
                                background: 'rgba(8,145,178,0.25)',
                              }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-400 flex-shrink-0">Middle 50%: {benchmarkStats.p25_score}–{benchmarkStats.p75_score}</span>
                        </div>

                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {isAbove
                            ? <>Your decision health is <span className="font-semibold" style={{ color: '#16a34a' }}>+{diff} pts above</span> the {catLabel.toLowerCase()} benchmark average ({benchmarkStats.count} contributors).</>
                            : <>Your decision health is <span className="font-semibold" style={{ color: '#d97706' }}>{Math.abs(diff)} pts below</span> the {catLabel.toLowerCase()} benchmark average ({benchmarkStats.count} contributors).</>
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Benchmark opted-in but not enough data yet */}
              {data?.benchmark_opt_in && !benchmarkStats && benchmarkCategory && (
                <div
                  className="rounded-xl p-3.5"
                  style={{ background: 'rgba(8,145,178,0.03)', border: '1px solid rgba(8,145,178,0.10)' }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(8,145,178,0.08)' }}>
                      <Award className="w-3.5 h-3.5" style={{ color: '#0891b2' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 mb-0.5">Building {CATEGORY_LABELS[benchmarkCategory] ?? benchmarkCategory} Benchmark</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Not enough contributors yet to show a meaningful benchmark. Your score has been added to the pool — comparisons will appear once more teams opt in.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Contributing to Model — shown when user has ≥1 high-quality training pair */}
              {trainingContributions !== null && trainingContributions > 0 && (
                <div
                  className="rounded-xl p-3.5"
                  style={{ background: 'linear-gradient(135deg,rgba(37,99,235,0.04),rgba(6,182,212,0.03))', border: '1px solid rgba(37,99,235,0.12)' }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(37,99,235,0.10)' }}>
                      <Cpu className="w-3.5 h-3.5" style={{ color: '#2563eb' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-bold text-slate-800">Contributing to Model Training</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(37,99,235,0.10)', color: '#2563eb' }}>
                          {trainingContributions} workspace{trainingContributions !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Your decision data — synthesis depth and recorded outcomes — is part of the training dataset that will power Poddle's future domain-specific model. The more outcomes you record, the higher your contribution quality.
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
