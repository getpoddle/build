import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Lightbulb, TrendingUp, ArrowLeft, Clock,
  Bot, ChevronDown, ChevronRight, Globe, Zap,
  CheckCircle2, XCircle, MinusCircle, Target, BarChart2,
  Link2, ArrowRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  updateEntitySEO, addEntityStructuredData, addBreadcrumbStructuredData,
  categoryPath, categoryLabel,
} from '../lib/seo';
import type { ReasoningEntityType, ReasoningEntitySEO } from '../lib/seo';
import WarRoomCTA, { StickyWarRoomCTA } from '../components/WarRoomCTA';

interface ExecutionStep {
  step: string;
  detail?: string;
  who?: string;
  timeframe?: string;
}

interface EntityData {
  id: string;
  slug: string;
  content: string;
  status: string;
  domain: string;
  created_at: string;
  relevance_score?: number;
  signal_strength?: string;
  solution_steps?: unknown;
  feasibility_score?: number;
  impact_score?: number;
  execution_steps?: unknown;
  confidence?: number;
  horizon_years?: number;
  outcome?: string;
  evidence?: string[];
  implications?: string[];
  agent_role?: string;
  contrarian?: boolean;
}

interface AgentResponse {
  id: string;
  agent_role: string;
  response_type: string;
  content: string;
  confidence_score: number;
}

interface Consensus {
  verdict: string;
  confidence_score: number;
  summary: string;
  key_points: string[];
}

interface LinkedEntity {
  id: string;
  slug?: string;
  type: ReasoningEntityType;
  content: string;
  status: string;
  linkType: string;
}

interface Props {
  slug: string;
  type: ReasoningEntityType;
  onNavigate: (page: string) => void;
  onEntityClick: (slug: string, type: ReasoningEntityType) => void;
}

const TABLE_MAP: Record<ReasoningEntityType, string> = {
  prediction: 'predictions',
  idea: 'ideas',
  problem: 'problems',
};

const TYPE_STYLE = {
  prediction: {
    color: '#2563eb', bg: 'rgba(37,99,235,0.07)', border: 'rgba(37,99,235,0.15)',
    icon: TrendingUp, accentBg: 'bg-blue-50', accentText: 'text-blue-700',
  },
  idea: {
    color: '#059669', bg: 'rgba(5,150,105,0.07)', border: 'rgba(5,150,105,0.15)',
    icon: Lightbulb, accentBg: 'bg-emerald-50', accentText: 'text-emerald-700',
  },
  problem: {
    color: '#dc2626', bg: 'rgba(220,38,38,0.07)', border: 'rgba(220,38,38,0.15)',
    icon: AlertTriangle, accentBg: 'bg-red-50', accentText: 'text-red-700',
  },
} as const;

const LINKED_COLOR: Record<ReasoningEntityType, string> = {
  prediction: '#2563eb', idea: '#059669', problem: '#dc2626',
};
const LINKED_ICON: Record<ReasoningEntityType, typeof TrendingUp> = {
  prediction: TrendingUp, idea: Lightbulb, problem: AlertTriangle,
};

const AGENT_LABELS: Record<string, string> = {
  'Strategic Analyst': 'Strategic Analyst Evaluation',
  "Devil's Advocate": "Devil's Advocate Counterarguments",
  'Risk Analyst': 'Risk & Vulnerability Assessment',
  'Market Observer': 'Market Signal Analysis',
  'Execution Expert': 'Execution & Feasibility Review',
  'Systems Thinker': 'Systems & Second-Order Effects',
};

function parseSteps(raw: unknown): ExecutionStep[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return (raw as ExecutionStep[]).filter(s => s?.step);
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return (p as ExecutionStep[]).filter(s => s?.step);
    } catch { /* ignore */ }
  }
  return [];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function VerdictIcon({ verdict }: { verdict: string }) {
  if (verdict === 'consensus') return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
  if (verdict === 'contested') return <Zap className="w-4 h-4 text-amber-500" />;
  if (verdict === 'refuted') return <XCircle className="w-4 h-4 text-red-600" />;
  return <MinusCircle className="w-4 h-4 text-slate-400" />;
}

function CollapsibleSection({
  title, icon, badge, children, defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{badge}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  );
}

export default function ReasoningEntityPage({ slug, type, onNavigate, onEntityClick }: Props) {
  const style = TYPE_STYLE[type];
  const Icon = style.icon;
  const catPath = categoryPath(type);
  const catLabel = categoryLabel(type);

  const [entity, setEntity] = useState<EntityData | null>(null);
  const [agentResponses, setAgentResponses] = useState<AgentResponse[]>([]);
  const [consensus, setConsensus] = useState<Consensus | null>(null);
  const [linked, setLinked] = useState<LinkedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const { data, error } = await supabase
        .from(TABLE_MAP[type])
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (error || !data) { setNotFound(true); return; }

      const ent = data as EntityData;
      setEntity(ent);

      const [responsesRes, consensusRes, linksOutRes, linksInRes] = await Promise.all([
        supabase.from('entity_agent_responses')
          .select('id, agent_role, response_type, content, confidence_score')
          .eq('entity_type', type).eq('entity_id', ent.id)
          .order('created_at', { ascending: false }).limit(8),
        supabase.from('entity_consensus')
          .select('verdict, confidence_score, summary, key_points')
          .eq('entity_type', type).eq('entity_id', ent.id)
          .order('created_at', { ascending: false }).limit(1),
        supabase.from('entity_links')
          .select('target_id, target_type, link_type')
          .eq('source_type', type).eq('source_id', ent.id).limit(6),
        supabase.from('entity_links')
          .select('source_id, source_type, link_type')
          .eq('target_type', type).eq('target_id', ent.id).limit(6),
      ]);

      setAgentResponses(responsesRes.data || []);
      setConsensus(consensusRes.data?.[0] || null);

      const outLinks = linksOutRes.data || [];
      const inLinks = linksInRes.data || [];
      const linkedIds = new Set([...outLinks.map(l => l.target_id), ...inLinks.map(l => l.source_id)]);

      if (linkedIds.size > 0) {
        const ids = Array.from(linkedIds);
        const [probs, ideas, preds] = await Promise.all([
          supabase.from('problems').select('id, slug, content, status').in('id', ids),
          supabase.from('ideas').select('id, slug, content, status').in('id', ids),
          supabase.from('predictions').select('id, slug, content, status').in('id', ids),
        ]);
        const eMap = new Map<string, { slug?: string; content: string; status: string; type: ReasoningEntityType }>();
        (probs.data || []).forEach(p => eMap.set(p.id, { ...p, type: 'problem' }));
        (ideas.data || []).forEach(p => eMap.set(p.id, { ...p, type: 'idea' }));
        (preds.data || []).forEach(p => eMap.set(p.id, { ...p, type: 'prediction' }));

        const list: LinkedEntity[] = [];
        const seen = new Set<string>();
        outLinks.forEach(l => {
          const e = eMap.get(l.target_id);
          if (e && !seen.has(l.target_id)) { seen.add(l.target_id); list.push({ id: l.target_id, ...e, linkType: l.link_type }); }
        });
        inLinks.forEach(l => {
          const e = eMap.get(l.source_id);
          if (e && !seen.has(l.source_id)) { seen.add(l.source_id); list.push({ id: l.source_id, ...e, linkType: l.link_type }); }
        });
        setLinked(list);
      }

      // Inject SEO
      const steps = parseSteps(type === 'problem' ? ent.solution_steps : ent.execution_steps);
      const seoEnt: ReasoningEntitySEO = {
        type, slug: ent.slug, content: ent.content, domain: ent.domain, created_at: ent.created_at,
        confidence: ent.confidence, relevance_score: ent.relevance_score,
        feasibility_score: ent.feasibility_score, impact_score: ent.impact_score,
        horizon_years: ent.horizon_years, evidence: ent.evidence, implications: ent.implications,
        solution_steps: type === 'problem' ? steps : undefined,
        execution_steps: type === 'idea' ? steps : undefined,
      };
      updateEntitySEO(seoEnt);
      addEntityStructuredData(seoEnt);
      addBreadcrumbStructuredData([
        { name: 'Home', url: 'https://poddleme.com' },
        { name: 'Reasoning', url: 'https://poddleme.com/reasoning' },
        { name: catLabel, url: `https://poddleme.com/reasoning/${catPath}` },
        { name: ent.content.slice(0, 60), url: `https://poddleme.com/reasoning/${catPath}/${ent.slug}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [slug, type, catPath, catLabel]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-white rounded-2xl border border-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (notFound || !entity) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Icon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
        <h1 className="text-xl font-bold text-slate-700 mb-2">Not found</h1>
        <p className="text-slate-500 text-sm mb-6">This entry may have been removed or the URL is incorrect.</p>
        <button
          onClick={() => onNavigate(`reasoning-${catPath}`)}
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          Browse all {catLabel}
        </button>
      </div>
    );
  }

  const steps = parseSteps(type === 'problem' ? entity.solution_steps : entity.execution_steps);
  const typeLabel = type === 'prediction' ? 'Forecast' : type === 'idea' ? 'Idea' : 'Problem';

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-10">
      {/* Breadcrumb nav */}
      <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 mb-4 flex-wrap">
        <button onClick={() => onNavigate('reasoning')} className="hover:text-blue-600 transition-colors font-medium">
          Reasoning
        </button>
        <ChevronRight className="w-3 h-3 flex-shrink-0" />
        <button
          onClick={() => onNavigate(`reasoning-${catPath}`)}
          className="hover:text-blue-600 transition-colors font-medium"
          style={{ color: style.color }}
        >
          {catLabel}
        </button>
        <ChevronRight className="w-3 h-3 flex-shrink-0" />
        <span className="text-slate-400 truncate max-w-[200px]">
          {entity.content.slice(0, 50)}{entity.content.length > 50 ? '…' : ''}
        </span>
      </nav>

      <button
        onClick={() => onNavigate(`reasoning-${catPath}`)}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {catLabel}
      </button>

      {/* Main article card */}
      <article
        className="bg-white rounded-3xl border border-slate-200 overflow-hidden mb-5"
        style={{ boxShadow: '0 2px 12px rgba(15,23,42,0.07)' }}
      >
        {/* Type header */}
        <div className="px-6 pt-6 pb-4" style={{ background: style.bg, borderBottom: `1px solid ${style.border}` }}>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: style.border, color: style.color }}
            >
              <Icon className="w-3.5 h-3.5" />
              AI {typeLabel}
            </span>
            {entity.domain && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                <Globe className="w-3 h-3" />
                {entity.domain.replace(/_/g, ' ')}
              </span>
            )}
            <span className="ml-auto flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              {timeAgo(entity.created_at)}
            </span>
          </div>
          {/* H1 — the entity statement */}
          <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
            {entity.content}
          </h1>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
          {type === 'prediction' && <>
            <Metric label="Confidence" value={`${entity.confidence ?? '—'}%`} color={style.color} />
            <Metric label="Horizon" value={entity.horizon_years ? `${entity.horizon_years}y` : '—'} />
            <Metric label="Outcome" value={entity.outcome || 'Pending'} capitalize />
            <Metric label="Analyses" value={String(agentResponses.length)} />
          </>}
          {type === 'idea' && <>
            <Metric label="Feasibility" value={`${entity.feasibility_score ?? '—'}%`} color={style.color} />
            <Metric label="Impact" value={`${entity.impact_score ?? '—'}%`} />
            <Metric label="Steps" value={String(steps.length)} />
            <Metric label="Analyses" value={String(agentResponses.length)} />
          </>}
          {type === 'problem' && <>
            <Metric label="Relevance" value={`${entity.relevance_score ?? '—'}%`} color={style.color} />
            <Metric label="Signal" value={entity.signal_strength?.replace(/_/g, ' ') || '—'} capitalize />
            <Metric label="Solutions" value={String(steps.length)} />
            <Metric label="Analyses" value={String(agentResponses.length)} />
          </>}
        </div>

        {/* AI Consensus */}
        {consensus && (
          <div className="px-6 py-4 border-b border-slate-100" style={{ background: 'rgba(248,250,252,0.8)' }}>
            <div className="flex items-start gap-3">
              <VerdictIcon verdict={consensus.verdict} />
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  AI Consensus · {consensus.confidence_score}% confidence
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">{consensus.summary}</p>
                {consensus.key_points?.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {consensus.key_points.slice(0, 3).map((pt, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Evidence / Implications for predictions */}
        {type === 'prediction' && ((entity.evidence?.length ?? 0) > 0 || (entity.implications?.length ?? 0) > 0) && (
          <div className="px-6 py-5 border-b border-slate-100 space-y-5">
            {(entity.evidence?.length ?? 0) > 0 && (
              <section>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5" /> Supporting Evidence
                </h2>
                <ul className="space-y-1.5">
                  {entity.evidence!.map((ev, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                      {ev}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {(entity.implications?.length ?? 0) > 0 && (
              <section>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" /> Strategic Implications
                </h2>
                <ul className="space-y-1.5">
                  {entity.implications!.map((im, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                      <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
                      {im}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </article>

      {/* Agent Analysis — each agent gets its own H2 */}
      {agentResponses.length > 0 && (
        <section className="mb-5 space-y-3">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2 mb-3">
            <Bot className="w-4 h-4 text-slate-500" />
            Multi-Agent Analysis
          </h2>
          {agentResponses.map(resp => (
            <CollapsibleSection
              key={resp.id}
              title={AGENT_LABELS[resp.agent_role] || `${resp.agent_role} Analysis`}
              icon={<Bot className="w-4 h-4 text-slate-400" />}
              badge={resp.confidence_score || undefined}
            >
              <p className="text-sm text-slate-700 leading-relaxed">{resp.content}</p>
              {resp.confidence_score > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${resp.confidence_score}%`, background: style.color }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-500">{resp.confidence_score}%</span>
                </div>
              )}
            </CollapsibleSection>
          ))}
        </section>
      )}

      {/* Solution / Execution Steps */}
      {steps.length > 0 && (
        <section className="mb-5">
          <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-slate-500" />
            {type === 'problem' ? 'Solution Pathway' : 'Execution Plan'}
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <ol className="p-5 space-y-0">
              {steps.map((step, i) => (
                <li key={i} className="relative pl-10 py-3">
                  <div className={`absolute left-0 top-3 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${style.accentBg} ${style.accentText} shadow-sm`}>
                    {i + 1}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="absolute left-[13px] top-10 bottom-0 w-0.5 bg-slate-100" />
                  )}
                  <div className="pl-1">
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{step.step}</p>
                    {step.detail && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.detail}</p>}
                    {(step.who || step.timeframe) && (
                      <div className="flex gap-3 mt-1">
                        {step.who && <span className="text-xs text-slate-400 font-medium">Owner: {step.who}</span>}
                        {step.timeframe && <span className="text-xs text-slate-400 font-medium">{step.timeframe}</span>}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Connected Reasoning — internal cross-linking */}
      {linked.length > 0 && (
        <section className="mb-5">
          <h2 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-slate-500" />
            Connected Reasoning
          </h2>
          <div className="space-y-2">
            {linked.map(le => {
              const LinkedIcon = LINKED_ICON[le.type];
              const color = LINKED_COLOR[le.type];
              return (
                <button
                  key={le.id}
                  onClick={() => le.slug && onEntityClick(le.slug, le.type)}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 px-4 py-3 hover:border-slate-300 hover:shadow-sm transition-all group flex items-start gap-3"
                >
                  <LinkedIcon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold capitalize mb-0.5" style={{ color }}>
                      {le.type} · {le.linkType?.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm text-slate-700 line-clamp-2 group-hover:text-slate-900 transition-colors">
                      {le.content}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 mt-0.5 transition-colors" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* War Room conversion CTA */}
      <WarRoomCTA onNavigate={onNavigate} topic={entity.content} />
      <StickyWarRoomCTA onNavigate={onNavigate} topic={entity.content} />
    </div>
  );
}

function Metric({ label, value, color, capitalize }: { label: string; value: string; color?: string; capitalize?: boolean }) {
  return (
    <div className="px-4 py-3 text-center">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p
        className={`text-base font-black ${capitalize ? 'capitalize' : ''}`}
        style={color ? { color } : { color: '#0f172a' }}
      >
        {value}
      </p>
    </div>
  );
}
