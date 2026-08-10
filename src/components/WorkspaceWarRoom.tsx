import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Brain, RefreshCw, Zap, AlertTriangle, CheckCircle2,
  HelpCircle, Eye, TrendingUp, Activity, MessageSquare,
  Loader2, Lock, Sparkles, Target, GitBranch, ArrowRight, Download,
  Users, Bot, Plus, X, Clipboard, Sword, Flame, DollarSign,
  Settings, BarChart3, Lightbulb, AlertCircle, TrendingDown, Minus,
  ThumbsUp, ThumbsDown, RotateCcw, XCircle, Clock, User, Calendar,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { exportWarRoomToPDF, exportBoardBriefToPDF } from '../lib/pdfExport';

// ─── Agent name formatting ────────────────────────────────────────────────────

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  risk_analyst: 'Risk Analyst',
  devils_advocate: "Devil's Advocate",
  innovation_scout: 'Innovation Lead',
  market_analyst: 'Market Analyst',
  financial_strategist: 'Financial Strategist',
  execution_lead: 'Execution Lead',
  people_advisor: 'People Advisor',
  consensus: 'Consensus',
};

function formatAgentName(role: string): string {
  return AGENT_DISPLAY_NAMES[role] ?? role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface SynthesisData {
  consensus_points: Array<{ text: string; confidence: number; source_count: number }>;
  conflict_zones: Array<{ topic: string; agent_a: string; position_a: string; agent_b: string; position_b: string; tension_level: number; participant_type?: 'human' | 'agent' | 'mixed' }>;
  open_questions: Array<{ question: string; urgency: string }>;
  risk_signals: Array<{ signal: string; severity: string; category: string }>;
  blind_spots: Array<{ area: string; description: string }>;
  action_items: Array<{ text: string; source_area: string; priority: string }>;
  financial_metrics: Array<{ metric: string; value: string; confidence: string; note: string }>;
  operational_metrics: Array<{ metric: string; status: string; note: string }>;
  non_financial_metrics: Array<{ metric: string; signal: string; note: string }>;
  opportunity_signals: Array<{ title: string; description: string; confidence: string; source: string }>;
  cognitive_bias_flags: Array<{ bias_name: string; explanation: string; counter_question: string }>;
  decision_health_score: number;
  financial_score: number | null;
  operational_score: number | null;
  alignment_score: number | null;
  decision_velocity: string | null;
  confidence_trajectory: string | null;
  health_rationale?: string;
  recommendation?: string | null;
  key_decisions?: Array<{ decision: string; status: string; rationale: string; owner?: string }>;
  generated_at: string;
  message_count: number;
}

interface HistoryRow {
  id: string;
  decision_health_score: number;
  financial_score?: number | null;
  operational_score?: number | null;
  alignment_score?: number | null;
  consensus_count: number;
  open_question_count: number;
  message_count: number;
  generated_at: string;
}

interface ActionItem {
  id: string;
  text: string;
  source: 'ai' | 'manual';
  priority: string;
  source_area: string | null;
  assignee_user_id: string | null;
  due_date: string | null;
  status: 'todo' | 'in_progress' | 'done';
  outcome: 'pending' | 'succeeded' | 'failed' | 'reversed' | 'abandoned' | null;
  outcome_notes: string | null;
  outcome_recorded_at: string | null;
  created_at: string;
}

interface ConflictCommit {
  conflict_topic: string;
  committed_position: string;
  committed_side: 'a' | 'b';
}

interface MemberProfile {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
}

interface WorkspaceWarRoomProps {
  workspaceId: string;
  workspaceName: string;
  workspaceTopic?: string;
  onDiscuss?: (prompt: string) => void;
  discussedKeys?: Set<string>;
  onDiscussed?: (key: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const URGENCY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  critical: { bg: 'rgba(220,38,38,0.08)',  text: '#b91c1c', dot: '#dc2626' },
  high:     { bg: 'rgba(245,158,11,0.08)', text: '#b45309', dot: '#f59e0b' },
  medium:   { bg: 'rgba(37,99,235,0.07)',  text: '#1d4ed8', dot: '#3b82f6' },
  low:      { bg: 'rgba(15,23,42,0.05)',   text: '#475569', dot: '#94a3b8' },
};

const RISK_CATEGORIES = ['market', 'execution', 'financial', 'team', 'technology'];

type OutcomeValue = 'succeeded' | 'failed' | 'reversed' | 'abandoned' | 'pending';

const OUTCOME_CONFIG: Record<OutcomeValue, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  succeeded: { label: 'Succeeded',  color: '#15803d', bg: 'rgba(22,163,74,0.1)',   Icon: ThumbsUp },
  failed:    { label: 'Failed',     color: '#b91c1c', bg: 'rgba(220,38,38,0.1)',   Icon: ThumbsDown },
  reversed:  { label: 'Reversed',   color: '#b45309', bg: 'rgba(245,158,11,0.1)',  Icon: RotateCcw },
  abandoned: { label: 'Abandoned',  color: '#64748b', bg: 'rgba(15,23,42,0.07)',   Icon: XCircle },
  pending:   { label: 'Pending',    color: '#3b82f6', bg: 'rgba(37,99,235,0.08)',  Icon: Clock },
};

const OUTCOME_OPTIONS: Array<{ value: OutcomeValue; label: string; color: string; bg: string; Icon: React.ElementType }> = [
  { value: 'succeeded', label: 'Succeeded',  color: '#15803d', bg: 'rgba(22,163,74,0.1)',   Icon: ThumbsUp },
  { value: 'failed',    label: 'Failed',     color: '#b91c1c', bg: 'rgba(220,38,38,0.1)',   Icon: ThumbsDown },
  { value: 'reversed',  label: 'Reversed',   color: '#b45309', bg: 'rgba(245,158,11,0.1)',  Icon: RotateCcw },
  { value: 'abandoned', label: 'Abandoned',  color: '#64748b', bg: 'rgba(15,23,42,0.07)',   Icon: XCircle },
];

const OP_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  clear:      { bg: 'rgba(22,163,74,0.1)',  text: '#15803d' },
  'on-track': { bg: 'rgba(22,163,74,0.1)',  text: '#15803d' },
  unclear:    { bg: 'rgba(245,158,11,0.1)', text: '#b45309' },
  'at-risk':  { bg: 'rgba(220,38,38,0.1)',  text: '#b91c1c' },
};

const SIGNAL_COLORS: Record<string, { bg: string; text: string }> = {
  positive: { bg: 'rgba(22,163,74,0.1)',   text: '#15803d' },
  high:     { bg: 'rgba(22,163,74,0.1)',   text: '#15803d' },
  neutral:  { bg: 'rgba(100,116,139,0.1)', text: '#475569' },
  medium:   { bg: 'rgba(245,158,11,0.1)',  text: '#b45309' },
  negative: { bg: 'rgba(220,38,38,0.1)',   text: '#b91c1c' },
  low:      { bg: 'rgba(220,38,38,0.1)',   text: '#b91c1c' },
};

const CONF_COLORS: Record<string, { bg: string; text: string }> = {
  high:   { bg: 'rgba(22,163,74,0.1)',  text: '#15803d' },
  medium: { bg: 'rgba(245,158,11,0.1)', text: '#b45309' },
  low:    { bg: 'rgba(220,38,38,0.1)',  text: '#b91c1c' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeVelocity(v: unknown): string | null {
  const s = String(v ?? '').toLowerCase();
  if (s === 'fast' || s === 'accelerating') return 'fast';
  if (s === 'moderate' || s === 'steady') return 'moderate';
  if (s === 'stalling' || s === 'blocked') return 'stalling';
  return null;
}

function normalizeTrajectory(v: unknown): string | null {
  const s = String(v ?? '').toLowerCase();
  if (s === 'rising') return 'rising';
  if (s === 'flat' || s === 'stable' || s === 'steady') return 'flat';
  if (s === 'falling' || s === 'declining' || s === 'volatile') return 'falling';
  return null;
}

function sanitizeSynthesis(s: Record<string, unknown>, fallbackCount?: number): SynthesisData {
  const toScore = (v: unknown) =>
    v != null && Number.isFinite(Number(v)) ? Math.max(0, Math.min(100, Number(v))) : null;

  // Normalize each array item to handle both old and new field name conventions
  const normConsensus = (Array.isArray(s.consensus_points) ? s.consensus_points : []).map((p: unknown) => {
    const r = p as Record<string, unknown>;
    return {
      text:         String(r.text ?? r.point ?? ''),
      confidence:   Math.max(0, Math.min(100, Number(r.confidence ?? (r.strength === 'strong' ? 90 : r.strength === 'moderate' ? 70 : 50)) || 70)),
      source_count: Number(r.source_count ?? (Array.isArray(r.supporting_agents) ? r.supporting_agents.length : 2)) || 2,
    };
  });

  const normConflicts = (Array.isArray(s.conflict_zones) ? s.conflict_zones : []).map((z: unknown) => {
    const r = z as Record<string, unknown>;
    const agents = Array.isArray(r.agents) ? r.agents as string[] : [];
    const sevMap: Record<string, number> = { critical: 90, high: 70, moderate: 45, medium: 45, low: 20 };
    return {
      topic:         String(r.topic ?? ''),
      agent_a:       String(r.agent_a ?? agents[0] ?? ''),
      position_a:    String(r.position_a ?? ''),
      agent_b:       String(r.agent_b ?? agents[1] ?? ''),
      position_b:    String(r.position_b ?? ''),
      tension_level: Number(r.tension_level ?? sevMap[String(r.severity ?? '').toLowerCase()] ?? 60),
      participant_type: (r.participant_type as 'human' | 'agent' | 'mixed' | undefined),
    };
  });

  const normQuestions = (Array.isArray(s.open_questions) ? s.open_questions : []).map((q: unknown) => {
    const r = q as Record<string, unknown>;
    return {
      question: String(r.question ?? ''),
      urgency:  String(r.urgency ?? r.blocker_level ?? 'medium'),
    };
  });

  const normRisks = (Array.isArray(s.risk_signals) ? s.risk_signals : []).map((r: unknown) => {
    const row = r as Record<string, unknown>;
    // Map new impact/likelihood to old severity: take whichever is more severe
    const impactMap: Record<string, string> = { critical: 'critical', high: 'high', medium: 'medium', low: 'low' };
    const severity = String(row.severity ?? impactMap[String(row.impact ?? '').toLowerCase()] ?? 'medium');
    return {
      signal:   String(row.signal ?? row.risk ?? ''),
      severity: severity,
      category: String(row.category ?? 'execution'),
    };
  });

  const normBlindSpots = (Array.isArray(s.blind_spots) ? s.blind_spots : []).map((b: unknown) => {
    const r = b as Record<string, unknown>;
    return {
      area:        String(r.area ?? r.blind_spot ?? ''),
      description: String(r.description ?? r.why_it_matters ?? ''),
    };
  });

  const normActionItems = (Array.isArray(s.action_items) ? s.action_items : []).map((a: unknown) => {
    const r = a as Record<string, unknown>;
    return {
      text:        String(r.text ?? r.task ?? ''),
      source_area: String(r.source_area ?? r.owner ?? ''),
      priority:    String(r.priority ?? 'medium'),
    };
  });

  const normFinancial = (Array.isArray(s.financial_metrics) ? s.financial_metrics : []).map((m: unknown) => {
    const r = m as Record<string, unknown>;
    return {
      metric:     String(r.metric ?? ''),
      value:      String(r.value ?? ''),
      confidence: String(r.confidence ?? 'medium'),
      note:       String(r.note ?? r.trend ?? ''),
    };
  });

  const normOperational = (Array.isArray(s.operational_metrics) ? s.operational_metrics : []).map((m: unknown) => {
    const r = m as Record<string, unknown>;
    return {
      metric: String(r.metric ?? ''),
      status: String(r.status ?? 'unclear'),
      note:   String(r.note ?? r.detail ?? ''),
    };
  });

  const normNonFinancial = (Array.isArray(s.non_financial_metrics) ? s.non_financial_metrics : []).map((m: unknown) => {
    const r = m as Record<string, unknown>;
    return {
      metric: String(r.metric ?? ''),
      signal: String(r.signal ?? r.trend ?? 'neutral'),
      note:   String(r.note ?? r.value ?? ''),
    };
  });

  const normOpportunities = (Array.isArray(s.opportunity_signals) ? s.opportunity_signals : []).map((o: unknown) => {
    const r = o as Record<string, unknown>;
    return {
      title:       String(r.title ?? r.opportunity ?? ''),
      description: String(r.description ?? ''),
      confidence:  String(r.confidence ?? r.potential ?? 'medium'),
      source:      String(r.source ?? r.time_sensitivity ?? ''),
    };
  });

  const normBiases = (Array.isArray(s.cognitive_bias_flags) ? s.cognitive_bias_flags : []).map((b: unknown) => {
    const r = b as Record<string, unknown>;
    return {
      bias_name:       String(r.bias_name ?? r.bias ?? ''),
      explanation:     String(r.explanation ?? r.manifestation ?? ''),
      counter_question:String(r.counter_question ?? r.debiasing_action ?? ''),
    };
  });

  return {
    consensus_points:      normConsensus,
    conflict_zones:        normConflicts,
    open_questions:        normQuestions,
    risk_signals:          normRisks,
    blind_spots:           normBlindSpots,
    action_items:          normActionItems,
    financial_metrics:     normFinancial,
    operational_metrics:   normOperational,
    non_financial_metrics: normNonFinancial,
    opportunity_signals:   normOpportunities,
    cognitive_bias_flags:  normBiases,
    decision_health_score: Number.isFinite(Number(s.decision_health_score)) ? Math.max(0, Math.min(100, Number(s.decision_health_score))) : 0,
    financial_score:      toScore(s.financial_score),
    operational_score:    toScore(s.operational_score),
    alignment_score:      toScore(s.alignment_score),
    decision_velocity:    normalizeVelocity(s.decision_velocity),
    confidence_trajectory:normalizeTrajectory(s.confidence_trajectory),
    health_rationale: typeof s.health_rationale === 'string' && s.health_rationale ? s.health_rationale : undefined,
    recommendation: typeof s.recommendation === 'string' && s.recommendation ? s.recommendation : null,
    key_decisions: Array.isArray(s.key_decisions) ? s.key_decisions as SynthesisData['key_decisions'] : undefined,
    generated_at: typeof s.generated_at === 'string' && s.generated_at ? s.generated_at : new Date().toISOString(),
    message_count: Number.isFinite(Number(s.message_count)) ? Number(s.message_count) : (fallbackCount ?? 0),
  };
}

function memberDisplayName(m: MemberProfile): string {
  if (m.first_name) return m.first_name;
  if (m.full_name) return m.full_name.split(' ')[0];
  return m.username || 'Member';
}

// ─── Score Ring ──────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const safe = Math.max(0, Math.min(100, score || 0));
  const r = size * 0.375;
  const circ = 2 * Math.PI * r;
  const dash = (safe / 100) * circ;
  const color = safe >= 70 ? 'var(--positive)' : safe >= 45 ? 'var(--caution)' : 'var(--negative)';
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--app-border)" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="butt"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black mono" style={{ color, fontSize: size * 0.24 }}>{safe}</span>
        <span className="mono-xs" style={{ color: 'var(--app-text-muted)', fontSize: size * 0.10 }}>/ 100</span>
      </div>
    </div>
  );
}

// ─── Sub-Score Pill ───────────────────────────────────────────────────────────
function SubScorePill({ label, score, icon: Icon }: { label: string; score: number | null; icon: React.ElementType }) {
  if (score === null) return null;
  const safe = Math.max(0, Math.min(100, score));
  const color = safe >= 70 ? 'var(--positive)' : safe >= 45 ? 'var(--caution)' : 'var(--negative)';
  const bg    = safe >= 70 ? 'var(--positive-bg)' : safe >= 45 ? 'var(--signal-bg)' : 'var(--negative-bg)';
  return (
    <div className="stat-card flex flex-col items-center gap-1 min-w-[72px]" style={{ background: bg, borderColor: color, borderOpacity: 0.3, padding: '0.5rem 0.75rem' }}>
      <Icon className="w-3.5 h-3.5" style={{ color }} />
      <span className="stat-card-value" style={{ color, fontSize: '1.125rem' }}>{safe}</span>
      <span className="stat-card-label text-center leading-tight" style={{ color, opacity: 0.75 }}>{label}</span>
    </div>
  );
}

// ─── Velocity & Trajectory Badges ────────────────────────────────────────────
function VelocityBadge({ velocity }: { velocity: string | null }) {
  if (!velocity) return null;
  const map: Record<string, { label: string; color: string; bg: string }> = {
    fast:     { label: 'Fast Velocity', color: 'var(--positive)', bg: 'var(--positive-bg)' },
    moderate: { label: 'Moderate',      color: 'var(--caution)',  bg: 'var(--signal-bg)'   },
    stalling: { label: 'Stalling',      color: 'var(--negative)', bg: 'var(--negative-bg)' },
  };
  const s = map[velocity] || map.moderate;
  return (
    <span className="badge flex-shrink-0" style={{ background: s.bg, color: s.color, borderColor: s.color }}>
      <Activity className="w-2.5 h-2.5" />{s.label}
    </span>
  );
}

function TrajectoryBadge({ trajectory }: { trajectory: string | null }) {
  if (!trajectory) return null;
  const map: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
    rising:  { label: 'Confidence Rising',  color: 'var(--positive)', bg: 'var(--positive-bg)', Icon: TrendingUp },
    flat:    { label: 'Confidence Flat',    color: 'var(--caution)',  bg: 'var(--signal-bg)',   Icon: Minus },
    falling: { label: 'Confidence Falling', color: 'var(--negative)', bg: 'var(--negative-bg)', Icon: TrendingDown },
  };
  const s = map[trajectory] || map.flat;
  return (
    <span className="badge flex-shrink-0" style={{ background: s.bg, color: s.color, borderColor: s.color }}>
      <s.Icon className="w-2.5 h-2.5" />{s.label}
    </span>
  );
}

// ─── Health Sparkline ─────────────────────────────────────────────────────────
function HealthSparkline({ history }: { history: HistoryRow[] }) {
  if (history.length < 2) return null;
  const scores = history.map(h => h.decision_health_score);
  const minV = Math.min(...scores, 0), maxV = Math.max(...scores, 100), range = maxV - minV || 1;
  const W = 160, H = 44;
  const pts = scores.map((s, i) => `${(i / (scores.length - 1)) * W},${H - ((s - minV) / range) * H}`);
  const delta = scores[scores.length - 1] - scores[0];
  return (
    <div className="flex items-center gap-3 mt-1">
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        <polyline points={pts.join(' ')} fill="none" stroke="var(--app-border)" strokeWidth="1.5" strokeLinejoin="round" />
        <polyline points={pts.join(' ')} fill="none" stroke="var(--signal)" strokeWidth="2" strokeLinejoin="round" />
        {scores.map((s, i) => {
          const x = (i / (scores.length - 1)) * W;
          const y = H - ((s - minV) / range) * H;
          const c = s >= 70 ? 'var(--positive)' : s >= 45 ? 'var(--caution)' : 'var(--negative)';
          return <circle key={i} cx={x} cy={y} r="3" fill={c} />;
        })}
      </svg>
      <div>
        <span className="text-xs font-black" style={{ color: delta >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
          {delta >= 0 ? '+' : ''}{delta} pts
        </span>
        <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{history.length} runs</p>
      </div>
    </div>
  );
}

// ─── Consensus Bar Chart ──────────────────────────────────────────────────────
// ── Agent Position Matrix — Signature Element ───────────────────────────────
const AGENT_ROSTER = [
  { role: 'risk_analyst',         abbr: 'RA', label: 'Risk Analyst',         varKey: 'agent-risk' },
  { role: 'financial_strategist', abbr: 'FS', label: 'Financial Strategist', varKey: 'agent-fin'  },
  { role: 'market_analyst',       abbr: 'MA', label: 'Market Analyst',       varKey: 'agent-strat' },
  { role: 'devils_advocate',      abbr: 'DA', label: "Devil's Advocate",     varKey: 'agent-exec' },
  { role: 'execution_lead',       abbr: 'EL', label: 'Execution Lead',       varKey: 'agent-exec' },
  { role: 'innovation_scout',     abbr: 'IS', label: 'Innovation Lead',     varKey: 'agent-strat' },
  { role: 'people_advisor',       abbr: 'PA', label: 'People Advisor',       varKey: 'agent-risk'  },
];

function AgentPositionMatrix({
  conflictZones,
}: {
  conflictZones: SynthesisData['conflict_zones'];
}) {
  // Build per-agent conflict map — match loosely against agent_a / agent_b strings
  const conflictMap = new Map<string, { count: number; topics: string[] }>();
  for (const z of conflictZones) {
    for (const ag of AGENT_ROSTER) {
      const needle = ag.role.replace(/_/g, '').toLowerCase();
      const inA = (z.agent_a || '').toLowerCase().replace(/[\s_-]/g, '').includes(needle);
      const inB = (z.agent_b || '').toLowerCase().replace(/[\s_-]/g, '').includes(needle);
      if (inA || inB) {
        const prev = conflictMap.get(ag.role) || { count: 0, topics: [] };
        conflictMap.set(ag.role, { count: prev.count + 1, topics: [...prev.topics, z.topic] });
      }
    }
  }

  return (
    <div style={{ borderBottom: '1px solid var(--app-border)' }}>
      <div
        className="px-5 py-2.5 flex items-center gap-2.5"
        style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface)' }}
      >
        <Brain className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--signal)' }} />
        <span className="section-label">Agent Position Matrix</span>
        <span className="hidden sm:inline text-xs" style={{ color: 'var(--app-text-muted)' }}>
          — stance derived from debate analysis
        </span>
      </div>
      <div style={{ background: 'var(--app-surface-raised)' }}>
        {AGENT_ROSTER.map((ag, idx) => {
          const data = conflictMap.get(ag.role);
          const isConflict = !!data && data.count > 0;
          const stanceLabel = isConflict ? 'DISSENTING' : 'SUPPORTING';
          const stanceColor = isConflict ? 'var(--negative)' : 'var(--positive)';
          const stanceBg    = isConflict ? 'var(--negative-bg)' : 'var(--positive-bg)';
          const filled = isConflict ? Math.min(5, 2 + data.count) : 3;

          return (
            <div
              key={ag.role}
              className="flex items-center gap-3 px-5 py-2"
              style={{ borderBottom: idx < AGENT_ROSTER.length - 1 ? '1px solid var(--app-border)' : 'none' }}
            >
              {/* Abbreviation badge */}
              <span
                className="badge flex-shrink-0"
                style={{
                  background: `var(--${ag.varKey}-bg)`,
                  color: `var(--${ag.varKey})`,
                  borderColor: `var(--${ag.varKey})`,
                  fontFamily: 'IBM Plex Mono, monospace',
                  minWidth: '2.125rem',
                  justifyContent: 'center',
                }}
              >
                {ag.abbr}
              </span>

              {/* Agent name */}
              <span className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--app-text-primary)' }}>
                {ag.label}
              </span>

              {/* Conviction segments */}
              <div className="flex items-center gap-px flex-shrink-0" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 9,
                      height: 16,
                      background: i < filled ? stanceColor : 'var(--app-border)',
                      opacity: i < filled ? 1 : 0.35,
                    }}
                  />
                ))}
              </div>

              {/* Stance pill */}
              <span
                className="badge flex-shrink-0"
                style={{ background: stanceBg, color: stanceColor, borderColor: stanceColor, minWidth: '76px', justifyContent: 'center' }}
              >
                {stanceLabel}
              </span>

              {/* Conflict count */}
              {isConflict && (
                <span className="mono-xs flex-shrink-0 text-right" style={{ color: 'var(--negative)', minWidth: '3rem' }}>
                  {data.count} flag{data.count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConsensusBarChart({ points }: { points: SynthesisData['consensus_points'] }) {
  return (
    <div className="space-y-3 px-5 py-4" style={{ background: 'var(--app-surface-raised)' }}>
      {points.map((pt, i) => {
        const conf = Math.max(0, Math.min(100, Number(pt.confidence) || 0));
        const color = conf >= 80 ? '#16a34a' : conf >= 60 ? '#84cc16' : '#f59e0b';
        return (
          <div key={i} className="flex items-start gap-3">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'var(--positive-bg)', border: '1px solid', borderColor: 'var(--positive)', borderOpacity: 0.3 }}>
              <span className="text-xs font-black" style={{ color: 'var(--positive)' }}>{i + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--app-text-primary)' }}>{pt.text}</p>
              <div className="flex items-center gap-2">
                <div className="h-2 bg-opacity-10 overflow-hidden" style={{ width: '160px', background: 'var(--app-border)' }}>
                  <div className="h-2 transition-all duration-1000"
                    style={{ width: `${conf}%`, background: color }} />
                </div>
                <span className="text-xs font-bold tabular-nums" style={{ color }}>{conf}%</span>
                <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{pt.source_count} agreed</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Risk Matrix ──────────────────────────────────────────────────────────────
function RiskMatrix({ risks }: { risks: SynthesisData['risk_signals'] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const SEV = ['low', 'medium', 'high', 'critical'];
  const CATS = RISK_CATEGORIES;
  return (
    <div className="px-5 py-4 bg-white">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Severity × Category Matrix</p>
      <div className="flex gap-4">
        <div className="flex flex-col justify-between pb-6" style={{ height: '140px' }}>
          {[...SEV].reverse().map(s => (
            <span key={s} className="text-xs font-bold capitalize leading-none" style={{ color: URGENCY_COLORS[s]?.text }}>{s}</span>
          ))}
        </div>
        <div className="flex-1 relative" style={{ height: '140px' }}>
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${CATS.length},1fr)`, gridTemplateRows: `repeat(${SEV.length},1fr)` }}>
            {SEV.map((s, si) => CATS.map((c, ci) => {
              const sevIdx = SEV.length - 1 - si;
              const intensity = (sevIdx / (SEV.length - 1)) * (ci / (CATS.length - 1) + 0.3);
              return (
                <div key={`${s}${c}`} className="border" style={{
                  borderColor: 'rgba(15,23,42,0.07)',
                  background: `rgba(220,38,38,${intensity * 0.06})`,
                }} />
              );
            }))}
          </div>
          {risks.map((r, i) => {
            const sevIdx = SEV.indexOf(r.severity?.toLowerCase());
            const catIdx = CATS.indexOf(r.category?.toLowerCase());
            if (sevIdx < 0 || catIdx < 0) return null;
            const x = ((catIdx + 0.5) / CATS.length) * 100;
            const y = ((SEV.length - 1 - sevIdx + 0.5) / SEV.length) * 100;
            const color = URGENCY_COLORS[r.severity?.toLowerCase()]?.dot || '#94a3b8';
            return (
              <div key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', zIndex: 10 }}
                onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                <div className="w-6 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-125"
                  style={{ background: color }}>
                  <span className="text-white font-black" style={{ fontSize: '9px' }}>{i + 1}</span>
                </div>
                {hovered === i && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs rounded-xl px-3 py-2 w-52 shadow-2xl z-20 pointer-events-none"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                    <p className="font-bold mb-1 capitalize">{r.severity} · {r.category}</p>
                    <p className="leading-relaxed opacity-90">{r.signal}</p>
                  </div>
                )}
              </div>
            );
          })}
          <div className="absolute top-full mt-1 inset-x-0 flex">
            {CATS.map(c => (
              <div key={c} className="flex-1 text-center">
                <span className="text-xs text-slate-400 capitalize">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-8 space-y-1.5">
        {risks.map((r, i) => {
          const sc = URGENCY_COLORS[r.severity?.toLowerCase()] || URGENCY_COLORS.low;
          return (
            <div key={i} className="flex items-start gap-2 text-xs">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: sc.dot }}>
                <span className="text-white font-black" style={{ fontSize: '9px' }}>{i + 1}</span>
              </div>
              <span className="font-bold mr-1" style={{ color: sc.text, textTransform: 'capitalize' }}>{r.severity}</span>
              <span className="text-slate-600 leading-relaxed">{r.signal}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Financial Metrics Panel ──────────────────────────────────────────────────
function FinancialMetricsPanel({ metrics, score, onDiscuss, discussedKeys = new Set(), onDiscussed }: { metrics: SynthesisData['financial_metrics']; score: number | null; onDiscuss?: (prompt: string) => void; discussedKeys?: Set<string>; onDiscussed?: (key: string) => void }) {
  return (
    <div className="bg-white">
      {metrics.map((m, i) => {
        const cc = CONF_COLORS[m.confidence?.toLowerCase()] || CONF_COLORS.medium;
        const key = `financial:${m.metric}`;
        const sent = discussedKeys.has(key);
        return (
          <div key={i} className="px-5 py-3.5 flex items-start gap-3" style={{ borderTop: i > 0 ? '1px solid rgba(22,163,74,0.07)' : undefined, background: sent ? 'rgba(22,163,74,0.02)' : undefined }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(22,163,74,0.08)' }}>
              <DollarSign className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-sm font-bold text-slate-800">{m.metric}</span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full capitalize" style={{ background: cc.bg, color: cc.text }}>{m.confidence} confidence</span>
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-0.5">{m.value}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{m.note}</p>
            </div>
            {onDiscuss && (sent ? (
              <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                <CheckCircle2 className="w-3 h-3" />Sent
              </span>
            ) : (
              <button onClick={() => { onDiscuss(`Analyse our financial signal on "${m.metric}":\n\nObserved: ${m.value}\nConfidence: ${m.confidence}\nContext: ${m.note}\n\nWhat are the implications for our decision-making? What assumptions should we validate, and what actions would improve our financial clarity here?`); onDiscussed?.(key); }}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                style={{ background: 'rgba(22,163,74,0.1)', color: '#15803d' }}>
                <MessageSquare className="w-3 h-3" />Discuss
              </button>
            ))}
          </div>
        );
      })}
      {score !== null && (
        <div className="px-5 py-3 flex items-center gap-3" style={{ background: 'rgba(22,163,74,0.03)', borderTop: '1px solid rgba(22,163,74,0.08)' }}>
          <span className="text-xs text-slate-500 font-medium">Financial Clarity Score</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.07)' }}>
            <div className="h-2 rounded-full transition-all duration-1000"
              style={{ width: `${score}%`, background: score >= 70 ? '#16a34a' : score >= 45 ? '#f59e0b' : '#dc2626' }} />
          </div>
          <span className="text-xs font-black tabular-nums" style={{ color: score >= 70 ? '#16a34a' : score >= 45 ? '#b45309' : '#dc2626' }}>{score}/100</span>
        </div>
      )}
    </div>
  );
}

// ─── Operational Metrics Panel ────────────────────────────────────────────────
function OperationalMetricsPanel({ metrics, score, onDiscuss, discussedKeys = new Set(), onDiscussed }: { metrics: SynthesisData['operational_metrics']; score: number | null; onDiscuss?: (prompt: string) => void; discussedKeys?: Set<string>; onDiscussed?: (key: string) => void }) {
  return (
    <div className="bg-white">
      {metrics.map((m, i) => {
        const sc = OP_STATUS_COLORS[m.status?.toLowerCase()] || { bg: 'rgba(100,116,139,0.1)', text: '#475569' };
        const key = `operational:${m.metric}`;
        const sent = discussedKeys.has(key);
        return (
          <div key={i} className="px-5 py-3.5 flex items-start gap-3" style={{ borderTop: i > 0 ? '1px solid rgba(245,158,11,0.07)' : undefined, background: sent ? 'rgba(245,158,11,0.02)' : undefined }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(245,158,11,0.08)' }}>
              <Settings className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-sm font-bold text-slate-800">{m.metric}</span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full capitalize" style={{ background: sc.bg, color: sc.text }}>{m.status?.replace('-', ' ')}</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{m.note}</p>
            </div>
            {onDiscuss && (sent ? (
              <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                <CheckCircle2 className="w-3 h-3" />Sent
              </span>
            ) : (
              <button onClick={() => { onDiscuss(`Deep-dive our operational readiness on "${m.metric}":\n\nStatus: ${m.status}\nContext: ${m.note}\n\nWhat concrete steps should we take to move this from "${m.status}" to "clear"? What dependencies or blockers should we address first?`); onDiscussed?.(key); }}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
                <MessageSquare className="w-3 h-3" />Discuss
              </button>
            ))}
          </div>
        );
      })}
      {score !== null && (
        <div className="px-5 py-3 flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.03)', borderTop: '1px solid rgba(245,158,11,0.08)' }}>
          <span className="text-xs text-slate-500 font-medium">Operational Readiness</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.07)' }}>
            <div className="h-2 rounded-full transition-all duration-1000"
              style={{ width: `${score}%`, background: score >= 70 ? '#16a34a' : score >= 45 ? '#f59e0b' : '#dc2626' }} />
          </div>
          <span className="text-xs font-black tabular-nums" style={{ color: score >= 70 ? '#16a34a' : score >= 45 ? '#b45309' : '#dc2626' }}>{score}/100</span>
        </div>
      )}
    </div>
  );
}

// ─── Non-Financial Metrics Panel ──────────────────────────────────────────────
function NonFinancialMetricsPanel({ metrics, score, onDiscuss, discussedKeys = new Set(), onDiscussed }: { metrics: SynthesisData['non_financial_metrics']; score: number | null; onDiscuss?: (prompt: string) => void; discussedKeys?: Set<string>; onDiscussed?: (key: string) => void }) {
  return (
    <div className="bg-white">
      {metrics.map((m, i) => {
        const sc = SIGNAL_COLORS[m.signal?.toLowerCase()] || { bg: 'rgba(100,116,139,0.1)', text: '#475569' };
        const key = `strategic:${m.metric}`;
        const sent = discussedKeys.has(key);
        return (
          <div key={i} className="px-5 py-3.5 flex items-start gap-3" style={{ borderTop: i > 0 ? '1px solid rgba(37,99,235,0.07)' : undefined, background: sent ? 'rgba(37,99,235,0.02)' : undefined }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(37,99,235,0.07)' }}>
              <BarChart3 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-sm font-bold text-slate-800">{m.metric}</span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full capitalize" style={{ background: sc.bg, color: sc.text }}>{m.signal}</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{m.note}</p>
            </div>
            {onDiscuss && (sent ? (
              <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                <CheckCircle2 className="w-3 h-3" />Sent
              </span>
            ) : (
              <button onClick={() => { onDiscuss(`Explore our strategic signal on "${m.metric}":\n\nSignal: ${m.signal}\nEvidence: ${m.note}\n\nHow should this ${m.signal} signal influence our strategy? What actions would strengthen this if positive, or reverse it if negative?`); onDiscussed?.(key); }}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                style={{ background: 'rgba(37,99,235,0.1)', color: '#1d4ed8' }}>
                <MessageSquare className="w-3 h-3" />Discuss
              </button>
            ))}
          </div>
        );
      })}
      {score !== null && (
        <div className="px-5 py-3 flex items-center gap-3" style={{ background: 'rgba(37,99,235,0.03)', borderTop: '1px solid rgba(37,99,235,0.08)' }}>
          <span className="text-xs text-slate-500 font-medium">Strategic Alignment</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.07)' }}>
            <div className="h-2 rounded-full transition-all duration-1000"
              style={{ width: `${score}%`, background: score >= 70 ? '#16a34a' : score >= 45 ? '#f59e0b' : '#dc2626' }} />
          </div>
          <span className="text-xs font-black tabular-nums" style={{ color: score >= 70 ? '#16a34a' : score >= 45 ? '#b45309' : '#dc2626' }}>{score}/100</span>
        </div>
      )}
    </div>
  );
}

// ─── Opportunity Signals Panel ────────────────────────────────────────────────
function OpportunitySignalsPanel({ signals, onDiscuss, discussedKeys = new Set(), onDiscussed }: { signals: SynthesisData['opportunity_signals']; onDiscuss?: (prompt: string) => void; discussedKeys?: Set<string>; onDiscussed?: (key: string) => void }) {
  return (
    <div className="bg-white">
      {signals.map((s, i) => {
        const cc = CONF_COLORS[s.confidence?.toLowerCase()] || CONF_COLORS.medium;
        const key = `opportunity:${s.title}`;
        const sent = discussedKeys.has(key);
        return (
          <div key={i} className="px-5 py-4 flex items-start gap-3"
            style={{ borderTop: i > 0 ? '1px solid rgba(22,163,74,0.07)' : undefined, background: sent ? 'rgba(22,163,74,0.02)' : i % 2 === 1 ? 'rgba(22,163,74,0.015)' : undefined }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(22,163,74,0.12)' }}>
              <Lightbulb className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-bold text-slate-800">{s.title}</span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full capitalize" style={{ background: cc.bg, color: cc.text }}>{s.confidence}</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-1">{s.description}</p>
              <p className="text-xs text-slate-400 italic">Source: {s.source}</p>
            </div>
            {onDiscuss && (sent ? (
              <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                <CheckCircle2 className="w-3 h-3" />Sent
              </span>
            ) : (
              <button onClick={() => { onDiscuss(`Develop the opportunity: "${s.title}"\n\nDescription: ${s.description}\nConfidence: ${s.confidence}\nSource: ${s.source}\n\nWhat is the fastest path to capturing this opportunity? What are the top 3 risks that could prevent it, and what would a concrete 30-day action plan look like?`); onDiscussed?.(key); }}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                style={{ background: 'rgba(22,163,74,0.12)', color: '#15803d' }}>
                <MessageSquare className="w-3 h-3" />Discuss
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Cognitive Bias Flags Panel ───────────────────────────────────────────────
function CognitiveBiasFlagsPanel({ flags, onDiscuss, discussedKeys = new Set(), onDiscussed }: { flags: SynthesisData['cognitive_bias_flags']; onDiscuss?: (prompt: string) => void; discussedKeys?: Set<string>; onDiscussed?: (key: string) => void }) {
  return (
    <div className="bg-white">
      {/* Bias fingerprint chart */}
      {flags.length > 0 && (
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(245,158,11,0.1)', background: 'rgba(254,243,199,0.3)' }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-3">Bias Fingerprint</p>
          <div className="space-y-2">
            {flags.map((f, i) => {
              const widths = [82, 68, 55, 75, 60, 88, 48, 72];
              const w = widths[i % widths.length];
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-amber-800 w-32 flex-shrink-0 truncate">{f.bias_name}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(245,158,11,0.12)' }}>
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${w}%`, background: 'linear-gradient(90deg,#fbbf24,#f59e0b,#d97706)' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {flags.map((f, i) => {
        const key = `bias:${f.bias_name}`;
        const sent = discussedKeys.has(key);
        return (
          <div key={i} className="px-5 py-4" style={{ borderTop: i > 0 ? '1px solid rgba(245,158,11,0.08)' : undefined, background: sent ? 'rgba(245,158,11,0.03)' : 'rgba(245,158,11,0.02)' }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.12)' }}>
                <AlertCircle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-800 mb-1">{f.bias_name}</p>
                <p className="text-sm text-slate-600 leading-relaxed mb-3" style={{ lineHeight: '1.65' }}>{f.explanation}</p>
                <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-700 mb-0.5">Counter-question</p>
                    <p className="text-xs text-amber-800 leading-relaxed italic">"{f.counter_question}"</p>
                  </div>
                  {onDiscuss && (sent ? (
                    <span className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                      <CheckCircle2 className="w-3 h-3" />Sent
                    </span>
                  ) : (
                    <button
                      onClick={() => { onDiscuss(`Challenge our thinking on this cognitive bias — ${f.bias_name}:\n\n${f.explanation}\n\nCounter-question: "${f.counter_question}"\n\nHelp us stress-test our reasoning and identify what we might be missing.`); onDiscussed?.(key); }}
                      className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all hover:scale-105"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#b45309' }}>
                      <MessageSquare className="w-3 h-3" />Ask
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WorkspaceWarRoom({ workspaceId, workspaceName, workspaceTopic, onDiscuss, discussedKeys = new Set(), onDiscussed }: WorkspaceWarRoomProps) {
  const { user } = useAuth();
  const [synthesis, setSynthesis] = useState<SynthesisData | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [commits, setCommits] = useState<ConflictCommit[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [synthQueued, setSynthQueued] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>('recommendation');
  const [newActionText, setNewActionText] = useState('');
  const [addingAction, setAddingAction] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [commitPending, setCommitPending] = useState<{ topic: string; side: 'a' | 'b'; position: string } | null>(null);
  const [showBoardSummary, setShowBoardSummary] = useState(false);
  const [boardCopied, setBoardCopied] = useState(false);
  const [outcomePromptId, setOutcomePromptId] = useState<string | null>(null);
  const [outcomeNoteText, setOutcomeNoteText] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        supabase.from('workspace_synthesis')
          .select('consensus_points,conflict_zones,open_questions,risk_signals,blind_spots,action_items,financial_metrics,operational_metrics,non_financial_metrics,opportunity_signals,cognitive_bias_flags,decision_health_score,financial_score,operational_score,alignment_score,decision_velocity,confidence_trajectory,health_rationale,recommendation,key_decisions,generated_at,message_count_at_generation')
          .eq('workspace_id', workspaceId).maybeSingle(),
        supabase.from('workspace_messages')
          .select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
        supabase.from('workspace_synthesis_history')
          .select('id,decision_health_score,financial_score,operational_score,alignment_score,consensus_count,open_question_count,message_count,generated_at')
          .eq('workspace_id', workspaceId).order('generated_at', { ascending: true }),
        supabase.from('workspace_action_items')
          .select('id,text,source,priority,source_area,assignee_user_id,due_date,status,outcome,outcome_notes,outcome_recorded_at,created_at')
          .eq('workspace_id', workspaceId).order('created_at', { ascending: true }),
        supabase.from('workspace_members')
          .select('user_id, profiles(id, full_name, first_name, username, avatar_url)')
          .eq('workspace_id', workspaceId),
        supabase.from('workspace_conflict_commits')
          .select('conflict_topic,committed_position,committed_side')
          .eq('workspace_id', workspaceId),
      ]);

      const synthRes = results[0].status === 'fulfilled' ? results[0].value : null;
      const countRes = results[1].status === 'fulfilled' ? results[1].value : null;
      const histRes  = results[2].status === 'fulfilled' ? results[2].value : null;
      const actRes  = results[3].status === 'fulfilled' ? results[3].value : null;
      const membRes = results[4].status === 'fulfilled' ? results[4].value : null;
      const commitRes = results[5].status === 'fulfilled' ? results[5].value : null;

      if (synthRes?.data) {
        setSynthesis(sanitizeSynthesis({ ...synthRes.data, message_count: synthRes.data.message_count_at_generation }));
      }
      setMessageCount(countRes?.count ?? 0);
      setHistory((histRes?.data as HistoryRow[]) || []);
      setActionItems((actRes?.data as ActionItem[]) || []);
      setCommits((commitRes?.data as ConflictCommit[]) || []);
      if (membRes?.data) {
        const profiles = membRes.data.map(m => m.profiles as MemberProfile | null).filter(Boolean) as MemberProfile[];
        setMembers(profiles);
      }
    } catch { /* keep state */ }
    finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime: update message count as new messages arrive
  useEffect(() => {
    const channel = supabase
      .channel(`war-room-msgs-${workspaceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workspace_messages', filter: `workspace_id=eq.${workspaceId}` }, () => {
        setMessageCount(prev => prev + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  // Realtime: reload synthesis the moment it is written/updated, so the page
  // reflects a completed synthesis without requiring a navigation away and back.
  useEffect(() => {
    const channel = supabase
      .channel(`war-room-synth-${workspaceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'workspace_synthesis',
        filter: `workspace_id=eq.${workspaceId}`,
      }, () => {
        setSynthQueued(false);
        loadAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, loadAll]);

  // Poll the synthesis queue so we can show "synthesis pending" state even
  // after the user navigates back to the page. When the queue clears (server
  // finished) we reload the synthesis data.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const checkQueue = async () => {
      const { data } = await supabase
        .from('workspace_synthesis_queue')
        .select('status')
        .eq('workspace_id', workspaceId)
        .in('status', ['pending', 'running'])
        .maybeSingle();

      const isQueued = !!data;
      setSynthQueued(isQueued);

      // When the queue entry disappears the synthesis just completed — reload
      if (!isQueued && interval) {
        clearInterval(interval);
        interval = null;
        loadAll();
      }
    };

    // Also subscribe to realtime on the queue table
    const queueChannel = supabase
      .channel(`synth-queue-${workspaceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'workspace_synthesis_queue',
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => {
        const status = (payload.new as { status?: string })?.status;
        if (status === 'pending' || status === 'running') {
          setSynthQueued(true);
          // Start polling as fallback in case realtime misses the completion event
          if (!interval) {
            interval = setInterval(checkQueue, 8000);
          }
        } else {
          setSynthQueued(false);
          if (interval) { clearInterval(interval); interval = null; }
          loadAll();
        }
      })
      .subscribe();

    // Initial check on mount so navigating back shows correct state
    checkQueue();

    return () => {
      if (interval) clearInterval(interval);
      supabase.removeChannel(queueChannel);
    };
  }, [workspaceId, loadAll]);

  async function generate() {
    setGenerating(true);
    setError('');
    try {
      // refreshSession ensures we get a fresh, valid token (getSession can return expired tokens)
      const { data: { session } } = await supabase.auth.refreshSession();
      if (!session?.access_token) { setError('Session expired. Please sign in again.'); return; }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 330000);
      let res: Response | null = null;
      try {
        res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workspace-synthesize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ workspace_id: workspaceId }),
          signal: controller.signal,
        });
      } catch (e: unknown) {
        setError(e instanceof Error && e.name === 'AbortError' ? 'Synthesis is taking longer than usual. Try again in a moment.' : 'Network error.');
        return;
      } finally { clearTimeout(timeout); }
      let json: { error?: string; synthesis?: Record<string, unknown> };
      try { json = await res!.json(); } catch { setError('Unexpected server response.'); return; }
      if (json.error) { setError(json.error); return; }
      if (!json.error) {
        // Always re-fetch from DB after synthesis so we show exactly what was stored,
        // regardless of what the edge function response payload contained.
        setActiveSection(null);
        const [synthRes, countRes, histRes, actRes] = await Promise.all([
          supabase.from('workspace_synthesis')
            .select('consensus_points,conflict_zones,open_questions,risk_signals,blind_spots,action_items,financial_metrics,operational_metrics,non_financial_metrics,opportunity_signals,cognitive_bias_flags,decision_health_score,financial_score,operational_score,alignment_score,decision_velocity,confidence_trajectory,health_rationale,recommendation,key_decisions,generated_at,message_count_at_generation')
            .eq('workspace_id', workspaceId).maybeSingle(),
          supabase.from('workspace_messages')
            .select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
          supabase.from('workspace_synthesis_history')
            .select('id,decision_health_score,financial_score,operational_score,alignment_score,consensus_count,open_question_count,message_count,generated_at')
            .eq('workspace_id', workspaceId).order('generated_at', { ascending: true }),
          supabase.from('workspace_action_items')
            .select('id,text,source,priority,source_area,assignee_user_id,due_date,status,created_at')
            .eq('workspace_id', workspaceId).order('created_at', { ascending: true }),
        ]);
        if (synthRes.data) {
          setSynthesis(sanitizeSynthesis({ ...synthRes.data, message_count: synthRes.data.message_count_at_generation }));
        }
        setMessageCount(countRes.count ?? 0);
        setHistory((histRes.data as HistoryRow[]) || []);
        setActionItems((actRes.data as ActionItem[]) || []);
      }
    } finally { setGenerating(false); }
  }

  async function recordOutcome(itemId: string, outcome: ActionItem['outcome']) {
    const notes = outcomeNoteText.trim() || null;
    setActionItems(prev => prev.map(a => a.id === itemId ? { ...a, outcome, outcome_notes: notes, outcome_recorded_at: new Date().toISOString() } : a));
    setOutcomePromptId(null);
    setOutcomeNoteText('');
    await supabase.from('workspace_action_items').update({
      outcome,
      outcome_notes: notes,
      outcome_recorded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', itemId);
  }

  function dismissOutcomePrompt() {
    setOutcomePromptId(null);
    setOutcomeNoteText('');
  }

  async function updateAssignee(item: ActionItem, userId: string | null) {
    setActionItems(prev => prev.map(a => a.id === item.id ? { ...a, assignee_user_id: userId } : a));
    await supabase.from('workspace_action_items').update({ assignee_user_id: userId, updated_at: new Date().toISOString() }).eq('id', item.id);
  }

  async function addManualAction() {
    if (!newActionText.trim() || savingAction || !user) return;
    setSavingAction(true);
    const { data } = await supabase.from('workspace_action_items').insert({
      workspace_id: workspaceId,
      text: newActionText.trim(),
      source: 'manual',
      priority: 'medium',
      source_area: 'manual',
      status: 'todo',
      created_by: user.id,
    }).select('id,text,source,priority,source_area,assignee_user_id,due_date,status,outcome,outcome_notes,outcome_recorded_at,created_at').maybeSingle();
    if (data) setActionItems(prev => [...prev, data as ActionItem]);
    setNewActionText(''); setAddingAction(false); setSavingAction(false);
  }

  async function commitConflict(topic: string, side: 'a' | 'b', position: string) {
    if (!user) return;
    setCommitPending(null);
    setCommits(prev => [...prev.filter(c => c.conflict_topic !== topic), { conflict_topic: topic, committed_position: position, committed_side: side }]);
    await supabase.from('workspace_conflict_commits').upsert({
      workspace_id: workspaceId, conflict_topic: topic, committed_position: position,
      committed_side: side, committed_by: user.id,
    }, { onConflict: 'workspace_id,conflict_topic' });
  }

  async function uncommitConflict(topic: string) {
    setCommits(prev => prev.filter(c => c.conflict_topic !== topic));
    await supabase.from('workspace_conflict_commits').delete().eq('workspace_id', workspaceId).eq('conflict_topic', topic);
  }

  function buildBoardSummary(): string {
    if (!synthesis) return '';
    const score = synthesis.decision_health_score;
    const label = score >= 75 ? 'Sharp' : score >= 55 ? 'Developing' : score >= 35 ? 'Fragmented' : 'Critical';
    const pending = actionItems.filter(a => a.status !== 'done').sort((a, b) => {
      const o = ['critical', 'high', 'medium', 'low'];
      return o.indexOf(a.priority) - o.indexOf(b.priority);
    });
    const subScoreLines = [
      synthesis.financial_score !== null   ? `  Financial Clarity: ${synthesis.financial_score}/100`   : null,
      synthesis.operational_score !== null ? `  Operational Readiness: ${synthesis.operational_score}/100` : null,
      synthesis.alignment_score !== null   ? `  Strategic Alignment: ${synthesis.alignment_score}/100`  : null,
    ].filter(Boolean) as string[];
    const lines: string[] = [
      `WAR ROOM BRIEF — ${workspaceName}`,
      `Decision Health: ${score}/100 (${label})`,
      synthesis.health_rationale ? `"${synthesis.health_rationale}"` : '',
    ];
    if (synthesis.key_decisions && synthesis.key_decisions.length > 0) {
      lines.push('', 'KEY DECISIONS:', ...synthesis.key_decisions.map((kd, i) => `  ${i + 1}. [${(kd.status || 'pending').toUpperCase()}] ${kd.decision}`));
    }
    if (subScoreLines.length) { lines.push('', 'SUB-SCORES:', ...subScoreLines); }
    lines.push('', 'TOP CONSENSUS:', ...synthesis.consensus_points.slice(0, 3).map((p, i) => `  ${i + 1}. ${p.text}`));
    lines.push('', 'KEY RISKS:', ...synthesis.risk_signals.slice(0, 3).map((r, i) => `  ${i + 1}. [${r.severity.toUpperCase()}] ${r.signal}`));
    if (synthesis.opportunity_signals.length) {
      lines.push('', 'OPPORTUNITIES:', ...synthesis.opportunity_signals.slice(0, 2).map((o, i) => `  ${i + 1}. ${o.title}: ${o.description}`));
    }
    lines.push('', 'PRIORITY ACTIONS:', ...pending.slice(0, 3).map((a, i) => `  ${i + 1}. ${a.text}`));
    return lines.join('\n');
  }

  const prevRun = history.length >= 2 ? history[history.length - 2] : null;
  const latestRun = history.length >= 1 ? history[history.length - 1] : null;
  const scoreDelta = prevRun && latestRun ? latestRun.decision_health_score - prevRun.decision_health_score : null;
  const questionsDelta = prevRun && synthesis ? prevRun.open_question_count - synthesis.open_questions.length : null;
  const stale = synthesis && (messageCount - synthesis.message_count) > 5;
  const doneItems = actionItems.filter(a => a.status === 'done');

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>;
  }

  if (!synthesis) {
    return (
      <div className="space-y-5 p-4 lg:p-5">
        <div className="text-center py-10 lg:py-12">
          <div className="w-12 h-12 flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <Brain className="w-6 h-6" style={{ color: 'var(--signal)' }} />
          </div>
          <p className="section-label mb-2">War Room</p>
          <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--app-text-primary)' }}>Ready for synthesis</h3>
          <p className="text-xs max-w-sm mx-auto leading-relaxed mb-5" style={{ color: 'var(--app-text-secondary)' }}>
            After your team has debated, run a synthesis to surface consensus, conflicts, blind spots, risk signals, and actionable next steps.
          </p>
          {messageCount >= 3 ? (
            <button onClick={generate} disabled={generating}
              className="btn-primary disabled:opacity-60">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {generating ? 'Synthesizing…' : 'Run Intelligence Synthesis'}
            </button>
          ) : (
            <p className="text-xs italic" style={{ color: 'var(--app-text-muted)' }}>Start a few conversations first — then run a synthesis.</p>
          )}
          {error && <p className="text-sm text-red-600 mt-3 font-medium">{error}</p>}
        </div>
      </div>
    );
  }

  const score = synthesis.decision_health_score;
  const scoreLabel = score >= 75 ? 'Sharp' : score >= 55 ? 'Developing' : score >= 35 ? 'Fragmented' : 'Critical';
  const scoreColor = score >= 75 ? 'var(--positive)' : score >= 55 ? 'var(--caution)' : score >= 35 ? 'var(--negative)' : 'var(--negative)';

  const hasFinancial    = synthesis.financial_metrics.length > 0;
  const hasOperational  = synthesis.operational_metrics.length > 0;
  const hasNonFinancial = synthesis.non_financial_metrics.length > 0;
  const hasOpportunities = synthesis.opportunity_signals.length > 0;
  const hasBiases       = synthesis.cognitive_bias_flags.length > 0;

  const hasRecommendation = !!synthesis.recommendation;

  const sections = [
    hasRecommendation && { key: 'recommendation', label: 'Recommendation', icon: Target,       count: 1,                                    color: 'var(--app-text-primary)', bg: 'var(--app-border-subtle)' },
    { key: 'consensus',     label: 'Consensus',     icon: CheckCircle2,  count: synthesis.consensus_points.length,      color: 'var(--positive)', bg: 'var(--positive-bg)' },
    { key: 'conflicts',     label: 'Conflicts',      icon: GitBranch,     count: synthesis.conflict_zones.length,        color: 'var(--caution)',  bg: 'var(--signal-bg)'   },
    { key: 'questions',     label: 'Questions',      icon: HelpCircle,    count: synthesis.open_questions.length,        color: 'var(--agent-fin)', bg: 'var(--agent-fin-bg)' },
    { key: 'risks',         label: 'Risks',          icon: AlertTriangle, count: synthesis.risk_signals.length,          color: 'var(--negative)', bg: 'var(--negative-bg)' },
    { key: 'blindspots',    label: 'Blind Spots',    icon: Eye,           count: synthesis.blind_spots.length,           color: 'var(--agent-strat)', bg: 'var(--agent-strat-bg)' },
    hasFinancial    && { key: 'financial',    label: 'Financial',    icon: DollarSign,    count: synthesis.financial_metrics.length,    color: 'var(--positive)', bg: 'var(--positive-bg)' },
    hasOperational  && { key: 'operational',  label: 'Operational',  icon: Settings,      count: synthesis.operational_metrics.length,  color: 'var(--caution)',    bg: 'var(--signal-bg)' },
    hasNonFinancial && { key: 'strategic',    label: 'Strategic',    icon: BarChart3,     count: synthesis.non_financial_metrics.length, color: 'var(--agent-fin)',  bg: 'var(--agent-fin-bg)' },
    hasOpportunities && { key: 'opportunities', label: 'Opportunities', icon: Lightbulb, count: synthesis.opportunity_signals.length,  color: 'var(--positive)',    bg: 'var(--positive-bg)' },
    hasBiases       && { key: 'biases',       label: 'Bias Flags',   icon: AlertCircle,  count: synthesis.cognitive_bias_flags.length, color: 'var(--caution)',    bg: 'var(--signal-bg)' },
    { key: 'actions',       label: 'Actions',        icon: Target,        count: actionItems.length,                      color: 'var(--agent-strat)', bg: 'var(--agent-strat-bg)' },
  ].filter(Boolean) as Array<{ key: string; label: string; icon: React.ElementType; count: number; color: string; bg: string }>;

  return (
    <div className="space-y-5 p-4 lg:p-5" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>

      {/* ── Header ── */}
      <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="section-label">War Room</span>
            {stale && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
                {messageCount - synthesis.message_count} new messages — re-synthesize for fresh intel
              </span>
            )}
          </div>
          <h2 className="text-base font-bold tracking-tight" style={{ color: 'var(--app-text-primary)' }}>Decision Intelligence</h2>
          <p className="text-xs text-slate-500 mt-1">
            Based on full War Room session · {new Date(synthesis.generated_at).toLocaleString()}
            {history.length > 0 && ` · Run #${history.length}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowBoardSummary(true)}
            className="btn-ghost"
            style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>
            <Clipboard className="w-3.5 h-3.5" />Board Brief
          </button>
          <button onClick={() => exportWarRoomToPDF({
            workspaceName, topic: workspaceTopic, generatedAt: synthesis.generated_at, messageCount: synthesis.message_count,
            decisionHealthScore: synthesis.decision_health_score, healthRationale: synthesis.health_rationale,
            keyDecisions: synthesis.key_decisions,
            financialScore: synthesis.financial_score, operationalScore: synthesis.operational_score, alignmentScore: synthesis.alignment_score,
            decisionVelocity: synthesis.decision_velocity, confidenceTrajectory: synthesis.confidence_trajectory,
            consensusPoints: synthesis.consensus_points, conflictZones: synthesis.conflict_zones,
            openQuestions: synthesis.open_questions, riskSignals: synthesis.risk_signals, blindSpots: synthesis.blind_spots,
            financialMetrics: synthesis.financial_metrics, operationalMetrics: synthesis.operational_metrics,
            nonFinancialMetrics: synthesis.non_financial_metrics, opportunitySignals: synthesis.opportunity_signals,
            cognitiveBiasFlags: synthesis.cognitive_bias_flags,
            recommendation: synthesis.recommendation,
            actionItems: actionItems.map(a => ({ text: a.text, priority: a.priority, status: a.status, source: a.source, source_area: a.source_area })),
          })}
            className="btn-ghost"
            style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>
            <Download className="w-3.5 h-3.5" />Export PDF
          </button>
          <button onClick={generate} disabled={generating || synthQueued}
            className="btn-primary disabled:opacity-50"
            style={{ padding: '0.375rem 0.875rem', fontSize: '0.75rem' }}>
            {(generating || synthQueued) ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {generating ? 'Synthesizing…' : synthQueued ? 'Running in background…' : 'Re-synthesize'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl text-sm text-red-700 font-medium" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {/* ── Background synthesis in-progress banner ── */}
      {synthQueued && !generating && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: 'var(--signal-bg)', border: '1px solid', borderColor: 'rgba(184,134,11,0.3)' }}>
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: '#2563eb' }} />
          <span style={{ color: '#1e40af' }}>
            Synthesis is running in the background — you can leave this page and we'll update the intelligence report automatically when it's done.
          </span>
        </div>
      )}

      {/* ── Decision Health Panel ── */}
      <div className="p-4 lg:p-5" style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <ScoreRing score={score} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="badge badge-amber" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{scoreLabel}</span>
              <span className="badge" style={{ background: `${scoreColor}18`, color: scoreColor, borderColor: scoreColor }}>Decision Health</span>
              {scoreDelta !== null && (
                <span className="badge"
                  style={{ background: scoreDelta >= 0 ? 'var(--positive-bg)' : 'var(--negative-bg)', color: scoreDelta >= 0 ? 'var(--positive)' : 'var(--negative)', borderColor: scoreDelta >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                  {scoreDelta >= 0 ? '+' : ''}{scoreDelta} vs last run
                </span>
              )}
              <VelocityBadge velocity={synthesis.decision_velocity} />
              <TrajectoryBadge trajectory={synthesis.confidence_trajectory} />
            </div>
            <p className="text-xs mb-3 leading-relaxed" style={{ lineHeight: '1.7', color: 'var(--app-text-secondary)' }}>
              {synthesis.health_rationale || 'AI-assessed clarity, risk coverage, and strategic alignment.'}
            </p>

            {/* Sub-score pills */}
            {(synthesis.financial_score !== null || synthesis.operational_score !== null || synthesis.alignment_score !== null) && (
              <div className="flex flex-wrap gap-2 mb-3">
                <SubScorePill label="Financial Clarity"     score={synthesis.financial_score}   icon={DollarSign} />
                <SubScorePill label="Operational Readiness" score={synthesis.operational_score} icon={Settings} />
                <SubScorePill label="Strategic Alignment"   score={synthesis.alignment_score}   icon={BarChart3} />
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              {questionsDelta !== null && questionsDelta > 0 && (
                <div className="stat-card">
                  <p className="stat-card-value text-sm" style={{ color: 'var(--positive)' }}>{questionsDelta} closed</p>
                  <p className="stat-card-label">questions resolved</p>
                </div>
              )}
              {history.length > 0 && (
                <div className="stat-card">
                  <p className="stat-card-value text-sm">#{history.length}</p>
                  <p className="stat-card-label">synthesis run</p>
                </div>
              )}
              <div className="stat-card">
                <p className="stat-card-value text-sm">{synthesis.conflict_zones.length}</p>
                <p className="stat-card-label">active tensions</p>
              </div>
              <div className="stat-card">
                <p className="stat-card-value text-sm">{doneItems.length}/{actionItems.length}</p>
                <p className="stat-card-label">actions done</p>
              </div>
            </div>
            <HealthSparkline history={history} />
          </div>
        </div>
      </div>

      {/* ── Section nav pills ── */}
      <div className="flex flex-wrap gap-1 px-5 py-3" style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
        <button
          onClick={() => setActiveSection(null)}
          className={`nav-pill ${activeSection === null ? 'nav-pill-active' : 'nav-pill-inactive'}`}>
          All
        </button>
        {sections.map(s => (
          <button key={s.key}
            onClick={() => setActiveSection(activeSection === s.key ? null : s.key)}
            className={`nav-pill flex items-center gap-1.5 ${activeSection === s.key ? '' : 'nav-pill-inactive'}`}
            style={activeSection === s.key ? { background: s.bg, color: s.color, border: `1px solid ${s.color}`, borderOpacity: 0.4 } : {}}>
            <s.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{s.label}</span>
            <span className="mono-xs w-5 h-5 flex items-center justify-center flex-shrink-0"
              style={{ background: activeSection === s.key ? `${s.color}20` : 'var(--app-border)', color: activeSection === s.key ? s.color : 'var(--app-text-muted)' }}>
              {s.count}
            </span>
          </button>
        ))}
      </div>

      </div>{/* end header/health/nav group */}

      {/* ── SIGNATURE ELEMENT: Agent Position Matrix ── */}
      {synthesis.conflict_zones.length > 0 && (
        <AgentPositionMatrix conflictZones={synthesis.conflict_zones} />
      )}

      {/* ── RECOMMENDATION ── */}
      {(activeSection === null || activeSection === 'recommendation') && synthesis.recommendation && (
        <div style={{ border: '1px solid var(--app-border)' }}>
          <div className="px-5 py-2.5 flex items-center gap-2" style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}>
            <Target className="w-3.5 h-3.5" style={{ color: 'var(--signal)' }} />
            <span className="section-label">Strategic Recommendation</span>
            <span className="text-xs ml-auto hidden sm:inline" style={{ color: 'var(--app-text-muted)' }}>From War Room synthesis</span>
          </div>
          <div className="p-5" style={{ background: 'var(--app-surface-raised)' }}>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--app-text-secondary)', lineHeight: '1.75' }}>
              {synthesis.recommendation}
            </p>
          </div>
        </div>
      )}

      {/* ── CONSENSUS ── */}
      {(activeSection === null || activeSection === 'consensus') && synthesis.consensus_points.length > 0 && (
        <div style={{ border: '1px solid var(--positive)', borderOpacity: 0.25 }}>
          <div className="px-5 py-2.5 flex items-center gap-2" style={{ background: 'var(--positive-bg)', borderBottom: '1px solid var(--positive)', borderBottomOpacity: 0.25 }}>
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--positive)' }} />
            <span className="section-label" style={{ color: 'var(--positive)' }}>Consensus points</span>
            <span className="text-xs ml-auto hidden lg:inline" style={{ color: 'var(--positive)' }}>Bar width = confidence</span>
          </div>
          <ConsensusBarChart points={synthesis.consensus_points} />
        </div>
      )}

      {/* ── CONFLICT ZONES ── */}
      {(activeSection === null || activeSection === 'conflicts') && synthesis.conflict_zones.length > 0 && (
        <div style={{ border: '1px solid var(--caution)', borderOpacity: 0.25 }}>
          <div className="px-5 py-2.5 flex flex-wrap items-center gap-2" style={{ background: 'var(--signal-bg)', borderBottom: '1px solid var(--signal)', borderBottomOpacity: 0.3 }}>
            <GitBranch className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--signal)' }} />
            <span className="section-label" style={{ color: 'var(--signal)' }}>Conflict zones</span>
            <span className="text-xs hidden lg:inline ml-auto" style={{ color: 'var(--signal)' }}>Breakthroughs hide in disagreement</span>
          </div>
          <div className="px-5 pt-4 pb-3 bg-white space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tension Levels</span>
              <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#3b82f6' }} />Low</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#f59e0b' }} />High</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#dc2626' }} />Critical</span>
              </div>
            </div>
            {synthesis.conflict_zones.map((z, i) => {
              const lvl = Math.max(0, Math.min(100, Number(z.tension_level) || 0));
              const gradientStop = lvl >= 70
                ? 'linear-gradient(90deg,#f59e0b,#dc2626)'
                : lvl >= 45
                  ? 'linear-gradient(90deg,#3b82f6,#f59e0b)'
                  : 'linear-gradient(90deg,#60a5fa,#3b82f6)';
              const labelColor = lvl >= 70 ? '#dc2626' : lvl >= 45 ? '#b45309' : '#2563eb';
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-600 w-28 flex-shrink-0 truncate leading-tight">{z.topic}</span>
                  <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.07)' }}>
                    <div
                      className="h-2.5 rounded-full transition-all duration-700"
                      style={{ width: `${lvl}%`, background: gradientStop }}
                    />
                  </div>
                  <span className="text-xs font-black w-8 text-right tabular-nums" style={{ color: labelColor }}>{lvl}</span>
                </div>
              );
            })}
          </div>
          <div className="p-5 bg-white space-y-3 pt-2">
            {synthesis.conflict_zones.map((z, i) => {
              const key = `conflict:${z.topic}`;
              const sent = discussedKeys.has(key);
              const commit = commits.find(c => c.conflict_topic === z.topic);
              const isPending = commitPending?.topic === z.topic;
              return (
                <div key={i} className="rounded-xl p-4 transition-all"
                  style={{ background: commit || sent ? 'rgba(22,163,74,0.04)' : 'rgba(245,158,11,0.04)', border: `1px solid ${commit || sent ? 'rgba(22,163,74,0.2)' : 'rgba(245,158,11,0.12)'}` }}>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-xs font-black text-amber-700 uppercase tracking-wide">{z.topic}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
                      Tension {z.tension_level}/100
                    </span>
                    {z.participant_type === 'human' && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(16,185,129,0.1)', color: '#065f46', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <Users className="w-3 h-3" />Human disagreement
                      </span>
                    )}
                    {z.participant_type === 'mixed' && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(37,99,235,0.08)', color: '#1d4ed8', border: '1px solid rgba(37,99,235,0.15)' }}>
                        <Users className="w-3 h-3" />Human vs AI
                      </span>
                    )}
                    {(!z.participant_type || z.participant_type === 'agent') && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(100,116,139,0.08)', color: '#475569', border: '1px solid rgba(100,116,139,0.15)' }}>
                        <Bot className="w-3 h-3" />AI agents
                      </span>
                    )}
                    {commit && (
                      <span className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                        <CheckCircle2 className="w-3 h-3" />Committed: {commit.committed_side === 'a' ? formatAgentName(z.agent_a) : formatAgentName(z.agent_b)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="rounded-lg p-3" style={
                      z.participant_type === 'human' || z.participant_type === 'mixed'
                        ? { background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }
                        : { background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.12)' }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        {(z.participant_type === 'human' || z.participant_type === 'mixed') ? <Users className="w-3 h-3 text-emerald-600 flex-shrink-0" /> : <Bot className="w-3 h-3 text-blue-600 flex-shrink-0" />}
                        <p className={`text-xs font-bold truncate ${z.participant_type === 'human' || z.participant_type === 'mixed' ? 'text-emerald-700' : 'text-blue-700'}`}>{formatAgentName(z.agent_a)}</p>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">{z.position_a}</p>
                    </div>
                    <div className="rounded-lg p-3" style={
                      z.participant_type === 'human'
                        ? { background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }
                        : { background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.12)' }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        {z.participant_type === 'human' ? <Users className="w-3 h-3 text-amber-600 flex-shrink-0" /> : <Bot className="w-3 h-3 text-red-600 flex-shrink-0" />}
                        <p className={`text-xs font-bold truncate ${z.participant_type === 'human' ? 'text-amber-700' : 'text-red-700'}`}>{formatAgentName(z.agent_b)}</p>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">{z.position_b}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {onDiscuss && (
                      <button onClick={() => onDiscuss(`Stress test the conflict on "${z.topic}":\n\nAssume ${formatAgentName(z.agent_a)}'s position: "${z.position_a}" — what are the 3 most important downstream consequences?\n\nNow assume ${formatAgentName(z.agent_b)}'s position: "${z.position_b}" — what changes most?\n\nWhich carries more risk, and what single decision reduces that risk most?`)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:scale-105"
                        style={{ background: 'rgba(30,58,95,0.08)', color: '#1e3a5f' }}>
                        <Sword className="w-3 h-3" />Stress Test
                      </button>
                    )}
                    {onDiscuss && (sent ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                        <CheckCircle2 className="w-3 h-3" />Sent
                      </span>
                    ) : (
                      <button onClick={() => { onDiscuss(`Strategic conflict on "${z.topic}":\n\n${formatAgentName(z.agent_a)}: ${z.position_a}\n${formatAgentName(z.agent_b)}: ${z.position_b}\n\nHelp us resolve this disagreement.`); onDiscussed?.(key); }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:scale-105"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#b45309' }}>
                        <MessageSquare className="w-3 h-3" />Resolve
                      </button>
                    ))}
                    {!commit && !isPending && (
                      <button onClick={() => setCommitPending({ topic: z.topic, side: 'a', position: z.position_a })}
                        className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:scale-105"
                        style={{ background: 'rgba(15,23,42,0.06)', color: '#64748b' }}>
                        <CheckCircle2 className="w-3 h-3" />Commit Decision
                      </button>
                    )}
                    {commit && (
                      <button onClick={() => uncommitConflict(z.topic)}
                        className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold"
                        style={{ background: 'rgba(220,38,38,0.06)', color: '#b91c1c' }}>
                        <X className="w-3 h-3" />Uncommit
                      </button>
                    )}
                  </div>
                  {isPending && (
                    <div className="mt-3 rounded-lg p-3 flex flex-col gap-2" style={{ background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.15)' }}>
                      <p className="text-xs font-bold text-slate-700">Which position does your team commit to?</p>
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => commitConflict(z.topic, 'a', z.position_a)}
                          className="flex-1 text-xs font-bold px-3 py-2 rounded-lg text-left transition-all hover:scale-105"
                          style={{ background: 'rgba(37,99,235,0.1)', color: '#1d4ed8' }}>
                          <span className="font-black block mb-0.5">{formatAgentName(z.agent_a)}</span>
                          {z.position_a.slice(0, 80)}{z.position_a.length > 80 ? '…' : ''}
                        </button>
                        <button onClick={() => commitConflict(z.topic, 'b', z.position_b)}
                          className="flex-1 text-xs font-bold px-3 py-2 rounded-lg text-left transition-all hover:scale-105"
                          style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c' }}>
                          <span className="font-black block mb-0.5">{formatAgentName(z.agent_b)}</span>
                          {z.position_b.slice(0, 80)}{z.position_b.length > 80 ? '…' : ''}
                        </button>
                        <button onClick={() => setCommitPending(null)} className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── OPEN QUESTIONS ── */}
      {(activeSection === null || activeSection === 'questions') && synthesis.open_questions.length > 0 && (
        <div style={{ border: '1px solid var(--agent-fin)', borderOpacity: 0.2 }}>          <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'rgba(37,99,235,0.06)' }}>
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold text-blue-800">Unresolved questions</span>
            {onDiscuss && <span className="text-xs text-blue-400 ml-auto">Click to discuss with AI agents</span>}
          </div>
          <div className="divide-y divide-blue-50 bg-white">
            {synthesis.open_questions.map((q, i) => {
              const uc = URGENCY_COLORS[q.urgency] || URGENCY_COLORS.low;
              const key = `question:${q.question}`;
              const sent = discussedKeys.has(key);
              return (
                <div key={i} className="px-5 py-3.5 flex items-start gap-3 transition-all"
                  style={sent ? { background: 'rgba(22,163,74,0.03)' } : undefined}>
                  <span className="mt-0.5 text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 capitalize" style={{ background: uc.bg, color: uc.text }}>{q.urgency}</span>
                  <p className="text-sm leading-relaxed flex-1" style={{ color: sent ? '#64748b' : '#1e293b' }}>{q.question}</p>
                  {onDiscuss && (sent ? (
                    <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                      <CheckCircle2 className="w-3 h-3" />Sent
                    </span>
                  ) : (
                    <button onClick={() => { onDiscuss(`Resolve this open question: "${q.question}"\n\nProvide concrete analysis and a recommended decision path.`); onDiscussed?.(key); }}
                      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                      style={{ background: 'rgba(37,99,235,0.1)', color: '#1d4ed8' }}>
                      <MessageSquare className="w-3 h-3" />Discuss
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── RISK SIGNALS ── */}
      {(activeSection === null || activeSection === 'risks') && synthesis.risk_signals.length > 0 && (
        <div style={{ border: '1px solid var(--negative)', borderOpacity: 0.2 }}>
          <div className="px-5 py-3 flex items-center gap-2 flex-wrap" style={{ background: 'rgba(220,38,38,0.06)' }}>
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span className="text-sm font-bold text-red-800">Risk signals detected</span>
            {onDiscuss && (
              <button onClick={() => onDiscuss(`Run a pre-mortem on our initiative.\n\nAssume it is 12 months from now and the project has failed. Given these risk signals:\n${synthesis.risk_signals.map((r, i) => `${i + 1}. [${r.severity.toUpperCase()}] ${r.signal}`).join('\n')}\n\nWhat most likely caused the failure? What should we have done differently? Be specific and prioritize the single most avoidable mistake.`)}
                className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                style={{ background: 'rgba(220,38,38,0.1)', color: '#b91c1c' }}>
                <Flame className="w-3 h-3" />Run Pre-Mortem
              </button>
            )}
          </div>
          <RiskMatrix risks={synthesis.risk_signals} />
        </div>
      )}

      {/* ── BLIND SPOTS ── */}
      {(activeSection === null || activeSection === 'blindspots') && synthesis.blind_spots.length > 0 && (
        <div style={{ border: '1px solid var(--agent-fin)', borderOpacity: 0.2 }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'rgba(8,145,178,0.06)' }}>
            <Eye className="w-4 h-4" style={{ color: '#0891b2' }} />
            <span className="text-sm font-bold" style={{ color: '#0e7490' }}>Blind spots</span>
            <span className="text-xs ml-auto" style={{ color: '#0891b2' }}>Topics you haven't considered yet</span>
          </div>
          <div className="divide-y divide-cyan-50 bg-white">
            {synthesis.blind_spots.map((bs, i) => {
              const key = `blindspot:${bs.area}`;
              const sent = discussedKeys.has(key);
              return (
                <div key={i} className="px-5 py-4 flex items-start gap-3 transition-all"
                  style={sent ? { background: 'rgba(22,163,74,0.03)' } : undefined}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: sent ? 'rgba(22,163,74,0.1)' : 'rgba(8,145,178,0.1)' }}>
                    {sent ? <CheckCircle2 className="w-4 h-4" style={{ color: '#16a34a' }} /> : <Target className="w-4 h-4" style={{ color: '#0891b2' }} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold mb-0.5" style={{ color: sent ? '#64748b' : '#0f172a' }}>{bs.area}</p>
                    <p className="text-sm leading-relaxed" style={{ color: sent ? '#94a3b8' : '#475569' }}>{bs.description}</p>
                  </div>
                  {onDiscuss && (sent ? (
                    <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                      <CheckCircle2 className="w-3 h-3" />Sent
                    </span>
                  ) : (
                    <button onClick={() => { onDiscuss(`Blind spot identified: "${bs.area}"\n\n${bs.description}\n\nAnalyze this and what we should do about it.`); onDiscussed?.(key); }}
                      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                      style={{ background: 'rgba(8,145,178,0.1)', color: '#0891b2' }}>
                      <ArrowRight className="w-3 h-3" />Explore
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FINANCIAL METRICS ── */}
      {(activeSection === null || activeSection === 'financial') && hasFinancial && (
        <div style={{ border: '1px solid var(--positive)', borderOpacity: 0.25 }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'rgba(22,163,74,0.07)' }}>
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="text-sm font-bold text-green-800">Financial signals</span>
            {synthesis.financial_score !== null && (
              <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: synthesis.financial_score >= 70 ? 'rgba(22,163,74,0.15)' : synthesis.financial_score >= 45 ? 'rgba(245,158,11,0.15)' : 'rgba(220,38,38,0.12)',
                  color: synthesis.financial_score >= 70 ? '#15803d' : synthesis.financial_score >= 45 ? '#b45309' : '#b91c1c',
                }}>
                Clarity {synthesis.financial_score}/100
              </span>
            )}
          </div>
          <FinancialMetricsPanel metrics={synthesis.financial_metrics} score={synthesis.financial_score} onDiscuss={onDiscuss} discussedKeys={discussedKeys} onDiscussed={onDiscussed} />
        </div>
      )}

      {/* ── OPERATIONAL METRICS ── */}
      {(activeSection === null || activeSection === 'operational') && hasOperational && (
        <div style={{ border: '1px solid var(--caution)', borderOpacity: 0.25 }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.07)' }}>
            <Settings className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-bold text-amber-800">Operational readiness</span>
            {synthesis.operational_score !== null && (
              <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: synthesis.operational_score >= 70 ? 'rgba(22,163,74,0.15)' : synthesis.operational_score >= 45 ? 'rgba(245,158,11,0.15)' : 'rgba(220,38,38,0.12)',
                  color: synthesis.operational_score >= 70 ? '#15803d' : synthesis.operational_score >= 45 ? '#b45309' : '#b91c1c',
                }}>
                Readiness {synthesis.operational_score}/100
              </span>
            )}
          </div>
          <OperationalMetricsPanel metrics={synthesis.operational_metrics} score={synthesis.operational_score} onDiscuss={onDiscuss} discussedKeys={discussedKeys} onDiscussed={onDiscussed} />
        </div>
      )}

      {/* ── NON-FINANCIAL / STRATEGIC METRICS ── */}
      {(activeSection === null || activeSection === 'strategic') && hasNonFinancial && (
        <div style={{ border: '1px solid var(--agent-fin)', borderOpacity: 0.2 }}>          <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'rgba(37,99,235,0.06)' }}>
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold text-blue-800">Strategic &amp; non-financial signals</span>
            {synthesis.alignment_score !== null && (
              <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: synthesis.alignment_score >= 70 ? 'rgba(22,163,74,0.15)' : synthesis.alignment_score >= 45 ? 'rgba(245,158,11,0.15)' : 'rgba(220,38,38,0.12)',
                  color: synthesis.alignment_score >= 70 ? '#15803d' : synthesis.alignment_score >= 45 ? '#b45309' : '#b91c1c',
                }}>
                Alignment {synthesis.alignment_score}/100
              </span>
            )}
          </div>
          <NonFinancialMetricsPanel metrics={synthesis.non_financial_metrics} score={synthesis.alignment_score} onDiscuss={onDiscuss} discussedKeys={discussedKeys} onDiscussed={onDiscussed} />
        </div>
      )}

      {/* ── OPPORTUNITY SIGNALS ── */}
      {(activeSection === null || activeSection === 'opportunities') && hasOpportunities && (
        <div style={{ border: '1px solid var(--positive)', borderOpacity: 0.25 }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'rgba(22,163,74,0.06)' }}>
            <Lightbulb className="w-4 h-4 text-green-600" />
            <span className="text-sm font-bold text-green-800">Opportunity signals</span>
            <span className="text-xs text-green-600 ml-auto">Upsides worth capturing</span>
          </div>
          <OpportunitySignalsPanel signals={synthesis.opportunity_signals} onDiscuss={onDiscuss} discussedKeys={discussedKeys} onDiscussed={onDiscussed} />
        </div>
      )}

      {/* ── COGNITIVE BIAS FLAGS ── */}
      {(activeSection === null || activeSection === 'biases') && hasBiases && (
        <div style={{ border: '1px solid var(--caution)', borderOpacity: 0.25 }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.08)' }}>
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-bold text-amber-800">Cognitive bias flags</span>
            <span className="text-xs text-amber-600 ml-auto">Reasoning traps to watch</span>
          </div>
          <CognitiveBiasFlagsPanel flags={synthesis.cognitive_bias_flags} onDiscuss={onDiscuss} discussedKeys={discussedKeys} onDiscussed={onDiscussed} />
        </div>
      )}

      {/* ── ACTION ITEMS (Kanban) ── */}
      {(activeSection === null || activeSection === 'actions') && (
        <div style={{ border: '1px solid var(--agent-fin)', borderOpacity: 0.25 }}>
          <div className="px-5 py-3 flex items-center gap-2 flex-wrap" style={{ background: 'rgba(37,99,235,0.06)' }}>
            <Target className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold text-blue-800">Action Items</span>
            <span className="text-xs ml-1 text-blue-600">{doneItems.length}/{actionItems.length} done</span>
            <button onClick={() => { setAddingAction(true); setTimeout(() => addInputRef.current?.focus(), 50); }}
              className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:scale-105"
              style={{ background: 'rgba(37,99,235,0.12)', color: '#2563eb' }}>
              <Plus className="w-3 h-3" />Add Action
            </button>
          </div>
          <div className="bg-white p-4">
            {addingAction && (
              <div className="mb-4 flex gap-2">
                <input ref={addInputRef} type="text" value={newActionText} onChange={e => setNewActionText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addManualAction(); if (e.key === 'Escape') setAddingAction(false); }}
                  placeholder="Type an action item and press Enter…"
                  className="input-modern text-sm flex-1"
                  style={{ borderColor: 'var(--app-input-border)' }} />
                <button onClick={addManualAction} disabled={savingAction || !newActionText.trim()}
                  className="btn-primary text-xs disabled:opacity-50"
                  style={{ padding: '0.5rem 0.875rem' }}>
                  {savingAction ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
                </button>
                <button onClick={() => setAddingAction(false)} className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {actionItems.length === 0 && !addingAction ? (
              <p className="text-sm text-slate-400 text-center py-6 italic">No action items yet. Run a synthesis to generate AI suggestions, or add your own.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {actionItems.map(item => {
                  const pc = URGENCY_COLORS[item.priority?.toLowerCase()] || URGENCY_COLORS.low;
                  const isOutcomePromptOpen = outcomePromptId === item.id;
                  const outcomeConfig = OUTCOME_CONFIG[item.outcome ?? 'pending'];
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl p-4 shadow-sm transition-all hover:shadow-md"
                      style={{
                        border: `1px solid ${isOutcomePromptOpen ? 'rgba(37,99,235,0.25)' : 'rgba(15,23,42,0.08)'}`,
                        borderLeft: `3px solid ${pc.dot}`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <p className="text-sm font-medium leading-relaxed flex-1"
                          style={{ textDecoration: item.status === 'done' ? 'line-through' : 'none', color: item.status === 'done' ? '#94a3b8' : '#1e293b' }}>
                          {item.text}
                        </p>
                        {item.source === 'ai' && <span title="AI suggested"><Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" /></span>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full capitalize" style={{ background: pc.bg, color: pc.text }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: pc.dot }} />
                          {item.priority}
                        </span>
                        {item.source_area && item.source_area !== 'manual' && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(15,23,42,0.05)', color: '#64748b' }}>
                            {item.source_area.replace('_', ' ')}
                          </span>
                        )}
                        {item.due_date && (
                          <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(37,99,235,0.06)', color: '#2563eb' }}>
                            <Calendar className="w-3 h-3" />
                            {new Date(item.due_date).toLocaleDateString()}
                          </span>
                        )}
                        {item.status === 'done' && item.outcome && item.outcome !== 'pending' && (
                          <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full capitalize"
                            style={{ background: outcomeConfig.bg, color: outcomeConfig.color }}>
                            <outcomeConfig.Icon className="w-3 h-3" />{outcomeConfig.label}
                          </span>
                        )}
                      </div>
                      {/* Outcome prompt */}
                      {isOutcomePromptOpen && (
                        <div className="mb-3 rounded-xl p-3" style={{ background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)' }}>
                          <p className="text-xs font-bold text-slate-700 mb-2">Did this action succeed?</p>
                          <div className="grid grid-cols-2 gap-1.5 mb-2">
                            {OUTCOME_OPTIONS.map(opt => (
                              <button key={opt.value} onClick={() => recordOutcome(item.id, opt.value)}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                                style={{ background: opt.bg, color: opt.color }}>
                                <opt.Icon className="w-3 h-3 flex-shrink-0" />{opt.label}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={outcomeNoteText}
                            onChange={e => setOutcomeNoteText(e.target.value)}
                            placeholder="Optional note (what happened?)"
                            className="w-full text-xs px-2.5 py-1.5 rounded-lg border text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-300 mb-1.5"
                            style={{ borderColor: 'rgba(37,99,235,0.2)' }}
                          />
                          <button onClick={dismissOutcomePrompt} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                            Skip for now
                          </button>
                        </div>
                      )}
                      {item.status === 'done' && item.outcome_notes && !isOutcomePromptOpen && (
                        <p className="mb-3 text-xs text-slate-400 italic leading-relaxed">{item.outcome_notes}</p>
                      )}
                      {item.status === 'done' && !item.outcome && !isOutcomePromptOpen && (
                        <button onClick={() => { setOutcomePromptId(item.id); setOutcomeNoteText(''); }}
                          className="mb-3 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors">
                          <Clock className="w-3 h-3" />Record outcome
                        </button>
                      )}
                      <div className="flex items-center gap-2 pt-2.5" style={{ borderTop: '1px solid rgba(15,23,42,0.05)' }}>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full min-w-0" style={{ background: 'rgba(15,23,42,0.04)' }}>
                          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <select value={item.assignee_user_id || ''} onChange={e => updateAssignee(item, e.target.value || null)}
                            className="text-xs font-medium text-slate-500 bg-transparent border-0 outline-none cursor-pointer truncate"
                            style={{ fontSize: '12px' }}>
                            <option value="">Unassigned</option>
                            {members.map(m => <option key={m.id} value={m.id}>{memberDisplayName(m)}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {synthesis.consensus_points.length === 0 && synthesis.conflict_zones.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm">
          No intelligence extracted yet. Keep the conversation going and re-synthesize.
        </div>
      )}

      {/* ── Discuss All banner ── */}
      {onDiscuss && (synthesis.open_questions.length > 0 || synthesis.blind_spots.length > 0 || synthesis.conflict_zones.length > 0) && (
        <div className="rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between"
          style={{ background: 'rgba(37,99,235,0.04)', border: '1px dashed rgba(37,99,235,0.2)' }}>
          <div>
            <p className="text-sm font-bold text-slate-900">Ready to resolve what's outstanding?</p>
            <p className="text-xs text-slate-500 mt-0.5">Send all unresolved items to Multiplayer AI, then re-synthesize for updated intel.</p>
          </div>
          <button
            onClick={() => {
              const parts: string[] = [];
              if (synthesis.open_questions.length > 0) parts.push(`OPEN QUESTIONS:\n${synthesis.open_questions.map((q, i) => `${i + 1}. [${q.urgency.toUpperCase()}] ${q.question}`).join('\n')}`);
              if (synthesis.conflict_zones.length > 0) parts.push(`CONFLICTS:\n${synthesis.conflict_zones.map((z, i) => `${i + 1}. ${z.topic} (tension: ${z.tension_level}/100)`).join('\n')}`);
              if (synthesis.blind_spots.length > 0) parts.push(`BLIND SPOTS:\n${synthesis.blind_spots.map((b, i) => `${i + 1}. ${b.area}: ${b.description}`).join('\n')}`);
              onDiscuss?.(`War Room flagged these unresolved items:\n\n${parts.join('\n\n')}\n\nWork through each and provide clear recommendations.`);
              synthesis.open_questions.forEach(q => onDiscussed?.(`question:${q.question}`));
              synthesis.conflict_zones.forEach(z => onDiscussed?.(`conflict:${z.topic}`));
              synthesis.blind_spots.forEach(b => onDiscussed?.(`blindspot:${b.area}`));
            }}
            className="flex-shrink-0 btn-primary">
            <MessageSquare className="w-4 h-4" />Discuss All
          </button>
        </div>
      )}

      {/* ── Board Brief Modal ── */}
      {showBoardSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowBoardSummary(false); }}>
          <div className="w-full max-w-lg overflow-hidden" style={{ background: 'var(--app-surface-raised)', border: '1px solid var(--app-border)', boxShadow: 'var(--shadow-xl)' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
              <div>
                <p className="section-label mb-0.5">War Room</p>
                <h3 className="text-base font-semibold" style={{ color: 'var(--app-text-primary)' }}>Board-Ready Brief</h3>
              </div>
              <button onClick={() => setShowBoardSummary(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono rounded-xl p-4 max-h-80 overflow-y-auto"
                style={{ background: 'var(--app-border-subtle)', border: '1px solid var(--app-border)', color: 'var(--app-text-primary)' }}>
                {buildBoardSummary()}
              </pre>
              <div className="mt-4 flex gap-2">
                <button onClick={() => {
                  navigator.clipboard.writeText(buildBoardSummary()).then(() => {
                    setBoardCopied(true);
                    setTimeout(() => setBoardCopied(false), 2000);
                  });
                }}
              className="btn-primary flex-1 disabled:opacity-50"
                  style={{ justifyContent: 'center' }}>
                  {boardCopied ? <CheckCircle2 className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
                  {boardCopied ? 'Copied!' : 'Copy text'}
                </button>
                <button
                  onClick={() => exportBoardBriefToPDF({
                    workspaceName,
                    topic: workspaceTopic,
                    generatedAt: synthesis!.generated_at,
                    decisionHealthScore: synthesis!.decision_health_score,
                    healthRationale: synthesis!.health_rationale,
                    keyDecisions: synthesis!.key_decisions,
                    financialScore: synthesis!.financial_score,
                    operationalScore: synthesis!.operational_score,
                    alignmentScore: synthesis!.alignment_score,
                    consensusPoints: synthesis!.consensus_points,
                    riskSignals: synthesis!.risk_signals,
                    opportunitySignals: synthesis!.opportunity_signals,
                    actionItems: actionItems.map(a => ({ text: a.text, priority: a.priority, status: a.status, source_area: a.source_area })),
                    synthesisRunNumber: history.length || undefined,
                  })}
                  className="btn-ghost">
                  <Download className="w-4 h-4" />PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Locked overlay ───────────────────────────────────────────────────────────
export function WarRoomLockedState({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="relative overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
      <div className="select-none pointer-events-none" style={{ filter: 'blur(6px)', opacity: 0.4 }}>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-slate-200" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-slate-200 rounded w-48" />
              <div className="h-3 bg-slate-100 rounded w-72" />
              <div className="h-3 bg-slate-100 rounded w-56" />
            </div>
          </div>
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-2xl" />)}
        </div>
      </div>
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(240,243,247,0.94)', backdropFilter: 'blur(4px)' }}>
        <div className="text-center px-8 max-w-sm">
          <div className="w-12 h-12 flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <Lock className="w-5 h-5" style={{ color: 'var(--app-text-muted)' }} />
          </div>
          <p className="section-label mb-2">Pro feature</p>
          <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--app-text-primary)' }}>War Room is a Pro feature</h3>
          <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--app-text-secondary)' }}>
            Surface consensus, blind spots, financial signals, strategic conflicts, risk signals, and AI-generated action items from your team's conversations.
          </p>
          <div className="space-y-2 mb-5 text-left">
            {[
              { icon: Activity,     text: 'Decision Health Score + Financial, Operational & Alignment sub-scores' },
              { icon: DollarSign,   text: 'Financial Signals — budget assumptions, projections, ROI, burn rate' },
              { icon: Settings,     text: 'Operational Readiness — timelines, dependencies, bottlenecks' },
              { icon: Lightbulb,    text: 'Opportunity Signals — upsides your team should capture' },
              { icon: AlertCircle,  text: 'Cognitive Bias Flags — reasoning traps with counter-questions' },
              { icon: TrendingUp,   text: 'Risk Matrix — visual 2D plot by category and severity' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5 w-4 h-4 flex items-center justify-center" style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)', borderOpacity: 0.4 }}>
                  <Icon className="w-2.5 h-2.5" style={{ color: 'var(--signal)' }} />
                </div>
                <span className="text-xs leading-relaxed" style={{ color: 'var(--app-text-secondary)' }}>{text}</span>
              </div>
            ))}
          </div>
          <button onClick={onUpgrade} className="w-full btn-primary" style={{ justifyContent: 'center' }}>
            <Activity className="w-3.5 h-3.5" />Unlock War Room
          </button>
        </div>
      </div>
    </div>
  );
}
