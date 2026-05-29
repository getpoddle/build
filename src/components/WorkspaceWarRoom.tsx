import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Brain, RefreshCw, Zap, AlertTriangle, CheckCircle2,
  HelpCircle, Eye, TrendingUp, Activity, MessageSquare,
  Loader2, Lock, Sparkles, Target, GitBranch, ArrowRight, Download,
  Users, Bot, Plus, X, Clipboard, Sword, Flame,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { exportWarRoomToPDF, exportBoardBriefToPDF } from '../lib/pdfExport';

interface SynthesisData {
  consensus_points: Array<{ text: string; confidence: number; source_count: number }>;
  conflict_zones: Array<{ topic: string; agent_a: string; position_a: string; agent_b: string; position_b: string; tension_level: number; participant_type?: 'human' | 'agent' | 'mixed' }>;
  open_questions: Array<{ question: string; urgency: string }>;
  risk_signals: Array<{ signal: string; severity: string; category: string }>;
  blind_spots: Array<{ area: string; description: string }>;
  action_items: Array<{ text: string; source_area: string; priority: string }>;
  decision_health_score: number;
  health_rationale?: string;
  generated_at: string;
  message_count: number;
}

interface HistoryRow {
  id: string;
  decision_health_score: number;
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

const URGENCY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  critical: { bg: 'rgba(220,38,38,0.08)',  text: '#b91c1c', dot: '#dc2626' },
  high:     { bg: 'rgba(245,158,11,0.08)', text: '#b45309', dot: '#f59e0b' },
  medium:   { bg: 'rgba(37,99,235,0.07)',  text: '#1d4ed8', dot: '#3b82f6' },
  low:      { bg: 'rgba(15,23,42,0.05)',   text: '#475569', dot: '#94a3b8' },
};

const RISK_CATEGORIES = ['market', 'execution', 'financial', 'team', 'technology'];

const STATUS_COLS: Array<{ key: ActionItem['status']; label: string; color: string; bg: string }> = [
  { key: 'todo',        label: 'To Do',       color: '#475569', bg: 'rgba(15,23,42,0.04)' },
  { key: 'in_progress', label: 'In Progress', color: '#b45309', bg: 'rgba(245,158,11,0.06)' },
  { key: 'done',        label: 'Done',        color: '#16a34a', bg: 'rgba(22,163,74,0.06)' },
];

const NEXT_STATUS: Record<ActionItem['status'], ActionItem['status']> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

function sanitizeSynthesis(s: Record<string, unknown>, fallbackCount?: number): SynthesisData {
  return {
    consensus_points: Array.isArray(s.consensus_points) ? s.consensus_points as SynthesisData['consensus_points'] : [],
    conflict_zones: Array.isArray(s.conflict_zones) ? s.conflict_zones as SynthesisData['conflict_zones'] : [],
    open_questions: Array.isArray(s.open_questions) ? s.open_questions as SynthesisData['open_questions'] : [],
    risk_signals: Array.isArray(s.risk_signals) ? s.risk_signals as SynthesisData['risk_signals'] : [],
    blind_spots: Array.isArray(s.blind_spots) ? s.blind_spots as SynthesisData['blind_spots'] : [],
    action_items: Array.isArray(s.action_items) ? s.action_items as SynthesisData['action_items'] : [],
    decision_health_score: Number.isFinite(Number(s.decision_health_score)) ? Math.max(0, Math.min(100, Number(s.decision_health_score))) : 0,
    health_rationale: typeof s.health_rationale === 'string' && s.health_rationale ? s.health_rationale : undefined,
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
function ScoreRing({ score }: { score: number }) {
  const safe = Math.max(0, Math.min(100, score || 0));
  const r = 36, circ = 2 * Math.PI * r, dash = (safe / 100) * circ;
  const color = safe >= 70 ? '#16a34a' : safe >= 45 ? '#f59e0b' : '#dc2626';
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black" style={{ color }}>{safe}</span>
        <span className="text-xs text-slate-400 font-semibold">/ 100</span>
      </div>
    </div>
  );
}

// ─── Health Sparkline ────────────────────────────────────────────────────────
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
        <polyline points={pts.join(' ')} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinejoin="round" />
        <polyline points={pts.join(' ')} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" />
        {scores.map((s, i) => {
          const x = (i / (scores.length - 1)) * W;
          const y = H - ((s - minV) / range) * H;
          const c = s >= 70 ? '#16a34a' : s >= 45 ? '#f59e0b' : '#dc2626';
          return <circle key={i} cx={x} cy={y} r="3" fill={c} />;
        })}
      </svg>
      <div>
        <span className="text-xs font-black" style={{ color: delta >= 0 ? '#16a34a' : '#dc2626' }}>
          {delta >= 0 ? '+' : ''}{delta} pts
        </span>
        <p className="text-xs text-slate-400">{history.length} runs</p>
      </div>
    </div>
  );
}

// ─── Consensus Bar Chart ─────────────────────────────────────────────────────
function ConsensusBarChart({ points }: { points: SynthesisData['consensus_points'] }) {
  return (
    <div className="space-y-3 px-5 py-4 bg-white">
      {points.map((pt, i) => {
        const conf = Math.max(0, Math.min(100, Number(pt.confidence) || 0));
        const color = conf >= 80 ? '#16a34a' : conf >= 60 ? '#84cc16' : '#f59e0b';
        return (
          <div key={i} className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(22,163,74,0.1)' }}>
              <span className="text-xs font-black text-green-700">{i + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-800 leading-relaxed mb-2">{pt.text}</p>
              <div className="flex items-center gap-2">
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden" style={{ width: '160px' }}>
                  <div className="h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${conf}%`, background: `linear-gradient(90deg,${color}88,${color})` }} />
                </div>
                <span className="text-xs font-bold tabular-nums" style={{ color }}>{conf}%</span>
                <span className="text-xs text-slate-400">{pt.source_count} agreed</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Risk Matrix ─────────────────────────────────────────────────────────────
function RiskMatrix({ risks }: { risks: SynthesisData['risk_signals'] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const SEV = ['low', 'medium', 'high', 'critical'];
  const CATS = RISK_CATEGORIES;
  return (
    <div className="px-5 py-4 bg-white">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Severity × Category Matrix</p>
      <div className="flex gap-4">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between pb-6" style={{ height: '140px' }}>
          {[...SEV].reverse().map(s => (
            <span key={s} className="text-xs font-bold capitalize leading-none" style={{ color: URGENCY_COLORS[s]?.text }}>{s}</span>
          ))}
        </div>
        {/* Grid */}
        <div className="flex-1 relative" style={{ height: '140px' }}>
          {/* Grid background cells */}
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
          {/* Risk dots */}
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
          {/* X-axis labels */}
          <div className="absolute top-full mt-1 inset-x-0 flex">
            {CATS.map(c => (
              <div key={c} className="flex-1 text-center">
                <span className="text-xs text-slate-400 capitalize">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Legend */}
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WorkspaceWarRoom({ workspaceId, workspaceName, workspaceTopic, onDiscuss, discussedKeys = new Set(), onDiscussed }: WorkspaceWarRoomProps) {
  const { user } = useAuth();
  const [synthesis, setSynthesis] = useState<SynthesisData | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [commits, setCommits] = useState<ConflictCommit[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [newActionText, setNewActionText] = useState('');
  const [addingAction, setAddingAction] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [commitPending, setCommitPending] = useState<{ topic: string; side: 'a' | 'b'; position: string } | null>(null);
  const [showBoardSummary, setShowBoardSummary] = useState(false);
  const [boardCopied, setBoardCopied] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [synthRes, countRes, histRes, actRes, membRes, commitRes] = await Promise.all([
        supabase.from('workspace_synthesis')
          .select('consensus_points,conflict_zones,open_questions,risk_signals,blind_spots,action_items,decision_health_score,health_rationale,generated_at,message_count_at_generation')
          .eq('workspace_id', workspaceId).maybeSingle(),
        supabase.from('workspace_messages')
          .select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
        supabase.from('workspace_synthesis_history')
          .select('id,decision_health_score,consensus_count,open_question_count,message_count,generated_at')
          .eq('workspace_id', workspaceId).order('generated_at', { ascending: true }),
        supabase.from('workspace_action_items')
          .select('id,text,source,priority,source_area,assignee_user_id,due_date,status,created_at')
          .eq('workspace_id', workspaceId).order('created_at', { ascending: true }),
        supabase.from('workspace_members')
          .select('user_id, profiles(id, full_name, first_name, username, avatar_url)')
          .eq('workspace_id', workspaceId),
        supabase.from('workspace_conflict_commits')
          .select('conflict_topic,committed_position,committed_side')
          .eq('workspace_id', workspaceId),
      ]);

      if (synthRes.data) {
        setSynthesis(sanitizeSynthesis({ ...synthRes.data, message_count: synthRes.data.message_count_at_generation }));
      }
      setMessageCount(countRes.count ?? 0);
      setHistory((histRes.data as HistoryRow[]) || []);
      setActionItems((actRes.data as ActionItem[]) || []);
      setCommits((commitRes.data as ConflictCommit[]) || []);
      if (membRes.data) {
        const profiles = membRes.data.map(m => m.profiles as MemberProfile | null).filter(Boolean) as MemberProfile[];
        setMembers(profiles);
      }
    } catch { /* keep state */ }
    finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function generate() {
    setGenerating(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setError('Session expired. Please refresh.'); return; }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000);
      let res: Response | null = null;
      try {
        res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workspace-synthesize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ workspace_id: workspaceId }),
          signal: controller.signal,
        });
      } catch (e: unknown) {
        setError(e instanceof Error && e.name === 'AbortError' ? 'Synthesis timed out. Try again.' : 'Network error.');
        return;
      } finally { clearTimeout(timeout); }
      let json: { error?: string; synthesis?: Record<string, unknown> };
      try { json = await res!.json(); } catch { setError('Unexpected server response.'); return; }
      if (json.error) { setError(json.error); return; }
      if (json.synthesis) {
        setSynthesis(sanitizeSynthesis(json.synthesis));
        const { count } = await supabase.from('workspace_messages')
          .select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId);
        setMessageCount(count ?? 0);
        const [histRes, actRes] = await Promise.all([
          supabase.from('workspace_synthesis_history')
            .select('id,decision_health_score,consensus_count,open_question_count,message_count,generated_at')
            .eq('workspace_id', workspaceId).order('generated_at', { ascending: true }),
          supabase.from('workspace_action_items')
            .select('id,text,source,priority,source_area,assignee_user_id,due_date,status,created_at')
            .eq('workspace_id', workspaceId).order('created_at', { ascending: true }),
        ]);
        setHistory((histRes.data as HistoryRow[]) || []);
        setActionItems((actRes.data as ActionItem[]) || []);
      }
    } finally { setGenerating(false); }
  }

  async function cycleStatus(item: ActionItem) {
    const next = NEXT_STATUS[item.status];
    setActionItems(prev => prev.map(a => a.id === item.id ? { ...a, status: next } : a));
    await supabase.from('workspace_action_items').update({ status: next, updated_at: new Date().toISOString() }).eq('id', item.id);
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
    }).select('id,text,source,priority,source_area,assignee_user_id,due_date,status,created_at').maybeSingle();
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
    const label = score >= 70 ? 'Sharp' : score >= 45 ? 'Developing' : 'Fragmented';
    const pending = actionItems.filter(a => a.status !== 'done').sort((a, b) => {
      const o = ['critical','high','medium','low'];
      return o.indexOf(a.priority) - o.indexOf(b.priority);
    });
    return [
      `WAR ROOM BRIEF — ${workspaceName}`,
      `Decision Health: ${score}/100 (${label})`,
      synthesis.health_rationale ? `"${synthesis.health_rationale}"` : '',
      '',
      'TOP CONSENSUS:',
      ...synthesis.consensus_points.slice(0, 3).map((p, i) => `  ${i + 1}. ${p.text}`),
      '',
      'KEY RISKS:',
      ...synthesis.risk_signals.slice(0, 3).map((r, i) => `  ${i + 1}. [${r.severity.toUpperCase()}] ${r.signal}`),
      '',
      'PRIORITY ACTIONS:',
      ...pending.slice(0, 3).map((a, i) => `  ${i + 1}. ${a.text}`),
    ].filter(l => l !== undefined).join('\n');
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
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}>
          <Brain className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-lg font-black text-slate-900 mb-2">War Room is ready</h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed mb-6">
          After your team has had some conversations, run a synthesis to surface consensus, conflicts, blind spots, risk signals, and AI-suggested action items.
        </p>
        {messageCount >= 3 ? (
          <button onClick={generate} disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold text-sm transition-all hover:-translate-y-0.5 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 8px 24px rgba(37,99,235,0.3)' }}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {generating ? 'Synthesizing…' : 'Run Intelligence Synthesis'}
          </button>
        ) : (
          <p className="text-xs text-slate-400 italic">Start a few conversations first — then run a synthesis.</p>
        )}
        {error && <p className="text-sm text-red-600 mt-3 font-medium">{error}</p>}
      </div>
    );
  }

  const score = synthesis.decision_health_score;
  const scoreLabel = score >= 70 ? 'Sharp' : score >= 45 ? 'Developing' : 'Fragmented';
  const scoreColor = score >= 70 ? '#16a34a' : score >= 45 ? '#f59e0b' : '#dc2626';

  const sections = [
    { key: 'consensus',  label: 'Consensus',     icon: CheckCircle2,  count: synthesis.consensus_points.length, color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
    { key: 'conflicts',  label: 'Conflicts',      icon: GitBranch,     count: synthesis.conflict_zones.length,   color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
    { key: 'questions',  label: 'Questions',      icon: HelpCircle,    count: synthesis.open_questions.length,   color: '#3b82f6', bg: 'rgba(37,99,235,0.08)' },
    { key: 'risks',      label: 'Risks',          icon: AlertTriangle, count: synthesis.risk_signals.length,     color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
    { key: 'blindspots', label: 'Blind Spots',    icon: Eye,           count: synthesis.blind_spots.length,      color: '#0891b2', bg: 'rgba(8,145,178,0.08)' },
    { key: 'actions',    label: 'Actions',        icon: Target,        count: actionItems.length,                color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  ];

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">War Room</span>
            {stale && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
                {messageCount - synthesis.message_count} new messages — re-synthesize for fresh intel
              </span>
            )}
          </div>
          <h2 className="text-xl font-black text-slate-900">Strategic Intelligence</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Based on {synthesis.message_count} messages · {new Date(synthesis.generated_at).toLocaleString()}
            {history.length > 0 && ` · Run #${history.length}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowBoardSummary(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
            style={{ background: 'rgba(15,23,42,0.05)', color: '#475569' }}>
            <Clipboard className="w-4 h-4" />Board Brief
          </button>
          <button onClick={() => exportWarRoomToPDF({
            workspaceName, topic: workspaceTopic, generatedAt: synthesis.generated_at, messageCount: synthesis.message_count,
            decisionHealthScore: synthesis.decision_health_score, healthRationale: synthesis.health_rationale,
            consensusPoints: synthesis.consensus_points, conflictZones: synthesis.conflict_zones,
            openQuestions: synthesis.open_questions, riskSignals: synthesis.risk_signals, blindSpots: synthesis.blind_spots,
            actionItems: actionItems.map(a => ({ text: a.text, priority: a.priority, status: a.status, source: a.source })),
          })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
            style={{ background: 'rgba(15,23,42,0.05)', color: '#475569' }}>
            <Download className="w-4 h-4" />Export PDF
          </button>
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
            style={{ background: stale ? 'linear-gradient(135deg,#1e3a5f,#2563eb)' : 'rgba(15,23,42,0.05)', color: stale ? '#fff' : '#475569' }}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {generating ? 'Synthesizing…' : 'Re-synthesize'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl text-sm text-red-700 font-medium" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {/* ── Decision Health Panel ── */}
      <div className="rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6"
        style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <ScoreRing score={score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-lg font-black text-white">{scoreLabel} Team</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${scoreColor}22`, color: scoreColor }}>Decision Health</span>
            {scoreDelta !== null && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: scoreDelta >= 0 ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)', color: scoreDelta >= 0 ? '#16a34a' : '#dc2626' }}>
                {scoreDelta >= 0 ? '+' : ''}{scoreDelta} vs last run
              </span>
            )}
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mb-3">
            {synthesis.health_rationale || 'AI-assessed clarity, risk coverage, and strategic alignment.'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            {questionsDelta !== null && questionsDelta > 0 && (
              <div className="rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(22,163,74,0.15)' }}>
                <p className="text-sm font-black text-green-400">{questionsDelta} closed</p>
                <p className="text-xs text-green-300/70">questions resolved</p>
              </div>
            )}
            {history.length > 0 && (
              <div className="rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <p className="text-sm font-black text-white">#{history.length}</p>
                <p className="text-xs text-slate-400">synthesis run</p>
              </div>
            )}
            <div className="rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <p className="text-sm font-black text-white">{synthesis.conflict_zones.length} zones</p>
              <p className="text-xs text-slate-400">active tensions</p>
            </div>
            <div className="rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <p className="text-sm font-black text-white">{doneItems.length}/{actionItems.length}</p>
              <p className="text-xs text-slate-400">actions done</p>
            </div>
          </div>
          <HealthSparkline history={history} />
        </div>
      </div>

      {/* ── Section nav pills ── */}
      <div className="flex flex-wrap gap-2">
        {sections.map(s => (
          <button key={s.key}
            onClick={() => setActiveSection(activeSection === s.key ? null : s.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={activeSection === s.key
              ? { background: s.bg, color: s.color, border: `1px solid ${s.color}33` }
              : { background: 'rgba(15,23,42,0.05)', color: '#64748b', border: '1px solid transparent' }}>
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
            <span className="ml-0.5 text-xs font-black w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: activeSection === s.key ? `${s.color}22` : 'rgba(15,23,42,0.08)', color: activeSection === s.key ? s.color : '#64748b' }}>
              {s.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── CONSENSUS ── */}
      {(activeSection === null || activeSection === 'consensus') && synthesis.consensus_points.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(22,163,74,0.15)' }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'rgba(22,163,74,0.06)' }}>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-bold text-green-800">What your team agrees on</span>
            <span className="text-xs text-green-600 ml-auto hidden sm:inline">Bar width = confidence</span>
          </div>
          <ConsensusBarChart points={synthesis.consensus_points} />
        </div>
      )}

      {/* ── CONFLICT ZONES ── */}
      {(activeSection === null || activeSection === 'conflicts') && synthesis.conflict_zones.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
          <div className="px-5 py-3 flex flex-wrap items-center gap-2" style={{ background: 'rgba(245,158,11,0.07)' }}>
            <GitBranch className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-sm font-bold text-amber-800">Strategic conflict zones</span>
            <span className="text-xs text-amber-600 hidden sm:inline ml-auto">Breakthroughs hide in disagreement</span>
          </div>
          {/* Tension overview bars */}
          <div className="px-5 pt-4 pb-2 bg-white space-y-2">
            {synthesis.conflict_zones.map((z, i) => {
              const lvl = Math.max(0, Math.min(100, Number(z.tension_level) || 0));
              const c = lvl >= 70 ? '#dc2626' : lvl >= 45 ? '#f59e0b' : '#3b82f6';
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-24 flex-shrink-0 truncate">{z.topic}</span>
                  <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(15,23,42,0.07)' }}>
                    <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${lvl}%`, background: c }} />
                  </div>
                  <span className="text-xs font-bold w-6 text-right" style={{ color: c }}>{lvl}</span>
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
                  style={{ background: commit ? 'rgba(22,163,74,0.04)' : sent ? 'rgba(22,163,74,0.04)' : 'rgba(245,158,11,0.04)', border: `1px solid ${commit ? 'rgba(22,163,74,0.2)' : sent ? 'rgba(22,163,74,0.2)' : 'rgba(245,158,11,0.12)'}` }}>
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
                        <CheckCircle2 className="w-3 h-3" />Committed: {commit.committed_side === 'a' ? z.agent_a : z.agent_b}
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
                        <p className={`text-xs font-bold truncate ${z.participant_type === 'human' || z.participant_type === 'mixed' ? 'text-emerald-700' : 'text-blue-700'}`}>{z.agent_a}</p>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">{z.position_a}</p>
                    </div>
                    <div className="rounded-lg p-3" style={
                      z.participant_type === 'human'
                        ? { background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }
                        : { background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.12)' }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        {z.participant_type === 'human' ? <Users className="w-3 h-3 text-amber-600 flex-shrink-0" /> : <Bot className="w-3 h-3 text-red-600 flex-shrink-0" />}
                        <p className={`text-xs font-bold truncate ${z.participant_type === 'human' ? 'text-amber-700' : 'text-red-700'}`}>{z.agent_b}</p>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">{z.position_b}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {onDiscuss && (
                      <button onClick={() => onDiscuss(`Stress test the conflict on "${z.topic}":\n\nAssume ${z.agent_a}'s position: "${z.position_a}" — what are the 3 most important downstream consequences?\n\nNow assume ${z.agent_b}'s position: "${z.position_b}" — what changes most?\n\nWhich carries more risk, and what single decision reduces that risk most?`)}
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
                      <button onClick={() => { onDiscuss(`Strategic conflict on "${z.topic}":\n\n${z.agent_a}: ${z.position_a}\n${z.agent_b}: ${z.position_b}\n\nHelp us resolve this disagreement.`); onDiscussed?.(key); }}
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
                          <span className="font-black block mb-0.5">{z.agent_a}</span>
                          {z.position_a.slice(0, 80)}{z.position_a.length > 80 ? '…' : ''}
                        </button>
                        <button onClick={() => commitConflict(z.topic, 'b', z.position_b)}
                          className="flex-1 text-xs font-bold px-3 py-2 rounded-lg text-left transition-all hover:scale-105"
                          style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c' }}>
                          <span className="font-black block mb-0.5">{z.agent_b}</span>
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
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(37,99,235,0.15)' }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'rgba(37,99,235,0.06)' }}>
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
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(220,38,38,0.15)' }}>
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
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(8,145,178,0.2)' }}>
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

      {/* ── ACTION ITEMS (Kanban) ── */}
      {(activeSection === null || activeSection === 'actions') && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(124,58,237,0.2)' }}>
          <div className="px-5 py-3 flex items-center gap-2 flex-wrap" style={{ background: 'rgba(124,58,237,0.06)' }}>
            <Target className="w-4 h-4" style={{ color: '#7c3aed' }} />
            <span className="text-sm font-bold" style={{ color: '#5b21b6' }}>Action Items</span>
            <span className="text-xs ml-1" style={{ color: '#7c3aed' }}>{doneItems.length}/{actionItems.length} done</span>
            <button onClick={() => { setAddingAction(true); setTimeout(() => addInputRef.current?.focus(), 50); }}
              className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:scale-105"
              style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>
              <Plus className="w-3 h-3" />Add Action
            </button>
          </div>
          <div className="bg-white p-4">
            {addingAction && (
              <div className="mb-4 flex gap-2">
                <input ref={addInputRef} type="text" value={newActionText} onChange={e => setNewActionText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addManualAction(); if (e.key === 'Escape') setAddingAction(false); }}
                  placeholder="Type an action item and press Enter…"
                  className="flex-1 text-sm px-3 py-2 rounded-xl border text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-400"
                  style={{ borderColor: 'rgba(124,58,237,0.3)' }} />
                <button onClick={addManualAction} disabled={savingAction || !newActionText.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#5b21b6,#7c3aed)' }}>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {STATUS_COLS.map(col => {
                  const items = actionItems.filter(a => a.status === col.key);
                  return (
                    <div key={col.key} className="rounded-xl p-3 min-h-[100px]" style={{ background: col.bg }}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-black uppercase tracking-wide" style={{ color: col.color }}>{col.label}</span>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(15,23,42,0.08)', color: '#64748b' }}>{items.length}</span>
                      </div>
                      <div className="space-y-2">
                        {items.map(item => {
                          const pc = URGENCY_COLORS[item.priority?.toLowerCase()] || URGENCY_COLORS.low;
                          const assignee = members.find(m => m.id === item.assignee_user_id);
                          return (
                            <div key={item.id} className="bg-white rounded-xl p-3 shadow-sm" style={{ border: '1px solid rgba(15,23,42,0.07)' }}>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className="text-xs text-slate-800 leading-relaxed flex-1"
                                  style={{ textDecoration: item.status === 'done' ? 'line-through' : 'none', color: item.status === 'done' ? '#94a3b8' : undefined }}>
                                  {item.text}
                                </p>
                                {item.source === 'ai' && <span title="AI suggested"><Sparkles className="w-3 h-3 text-violet-400 flex-shrink-0 mt-0.5" /></span>}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full capitalize" style={{ background: pc.bg, color: pc.text }}>{item.priority}</span>
                                {item.source_area && item.source_area !== 'manual' && (
                                  <span className="text-xs text-slate-400 capitalize">{item.source_area.replace('_', ' ')}</span>
                                )}
                                <button onClick={() => cycleStatus(item)}
                                  className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold transition-all hover:opacity-80"
                                  style={{ background: 'rgba(15,23,42,0.06)', color: '#475569' }}>
                                  {col.key === 'todo' ? '▶ Start' : col.key === 'in_progress' ? '✓ Done' : '↩ Reopen'}
                                </button>
                              </div>
                              <div className="mt-2">
                                <select value={item.assignee_user_id || ''} onChange={e => updateAssignee(item, e.target.value || null)}
                                  className="text-xs text-slate-500 bg-transparent border-0 outline-none cursor-pointer w-full"
                                  style={{ fontSize: '11px' }}>
                                  <option value="">Unassigned</option>
                                  {members.map(m => <option key={m.id} value={m.id}>{memberDisplayName(m)}</option>)}
                                </select>
                                {assignee && <span className="text-xs font-bold text-slate-500">{memberDisplayName(assignee)}</span>}
                              </div>
                            </div>
                          );
                        })}
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
            <p className="text-xs text-slate-500 mt-0.5">Send all unresolved items to AI Collaboration, then re-synthesize for updated intel.</p>
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
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
            <MessageSquare className="w-4 h-4" />Discuss All
          </button>
        </div>
      )}

      {/* ── Board Brief Modal ── */}
      {showBoardSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowBoardSummary(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f)' }}>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">War Room</p>
                <h3 className="text-base font-black text-white">Board-Ready Brief</h3>
              </div>
              <button onClick={() => setShowBoardSummary(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <pre className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-mono rounded-xl p-4 max-h-80 overflow-y-auto"
                style={{ background: 'rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.08)' }}>
                {buildBoardSummary()}
              </pre>
              <div className="mt-4 flex gap-2">
                <button onClick={() => {
                  navigator.clipboard.writeText(buildBoardSummary()).then(() => {
                    setBoardCopied(true);
                    setTimeout(() => setBoardCopied(false), 2000);
                  });
                }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                  style={{ background: boardCopied ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}>
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
                    consensusPoints: synthesis!.consensus_points,
                    riskSignals: synthesis!.risk_signals,
                    actionItems: actionItems.map(a => ({ text: a.text, priority: a.priority, status: a.status })),
                    synthesisRunNumber: history.length || undefined,
                  })}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: 'rgba(15,23,42,0.07)', color: '#475569' }}>
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
    <div className="relative rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
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
          {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-2xl" />)}
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(248,250,252,0.92)' }}>
        <div className="text-center px-8 max-w-sm">
          <div className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}>
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-2">War Room is a Pro feature</h3>
          <p className="text-sm text-slate-500 leading-relaxed mb-5">
            Surface consensus, blind spots, strategic conflicts, risk signals, and AI-generated action items from your team's conversations.
          </p>
          <div className="space-y-2 mb-5 text-left">
            {[
              { icon: Activity,   text: 'Decision Health Score — with trend sparkline across all runs' },
              { icon: GitBranch,  text: 'Conflict Zones — stress test, commit decisions, track resolutions' },
              { icon: Target,     text: 'Action Items — AI Kanban with assignees and priority tracking' },
              { icon: TrendingUp, text: 'Risk Matrix — visual 2D plot by category and severity' },
              { icon: Eye,        text: 'Blind Spots — what your team hasn\'t considered yet' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(37,99,235,0.1)' }}>
                  <Icon className="w-3 h-3 text-blue-600" />
                </div>
                <span className="text-xs text-slate-600 leading-relaxed">{text}</span>
              </div>
            ))}
          </div>
          <button onClick={onUpgrade}
            className="w-full py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 8px 24px rgba(37,99,235,0.3)' }}>
            <Sparkles className="w-4 h-4" />Unlock War Room
          </button>
        </div>
      </div>
    </div>
  );
}
