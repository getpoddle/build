import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertTriangle, Lightbulb, TrendingUp, Search,
  Bot, Clock, Activity, Zap, ChevronDown,
  Sparkles, Globe, CheckCircle2, Target, Eye,
  Rocket, Building2, Users, ChevronRight, Share2,
  MessageSquare, Send, RotateCcw, Trash2, X,
  Pencil, Check, Flame, ThumbsUp,
} from 'lucide-react';
import { getAvatarUrl } from '../lib/avatarUtils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import ShareableInsightCard from '../components/ShareableInsightCard';
import { updateCategorySEO, updatePageSEO } from '../lib/seo';
import type { ReasoningEntityType } from '../lib/seo';

type EntityType = 'problem' | 'idea' | 'prediction';
type TabFilter = 'all' | 'problems' | 'ideas' | 'predictions';

interface ActionStep {
  step: string;
  detail: string;
  who: string;
  timeframe: string;
}

interface EntityItem {
  id: string;
  type: EntityType;
  content: string;
  status: string;
  domain: string;
  created_at: string;
  slug?: string;
  signal_strength?: string;
  relevance_score?: number;
  feasibility_score?: number;
  impact_score?: number;
  confidence?: number;
  horizon_years?: number;
  outcome?: string;
  evidence?: unknown[];
  implications?: unknown[];
  agent_role?: string;
  contrarian?: boolean;
  execution_steps?: unknown;
  solution_steps?: unknown;
  challengeCount?: number;
  recentChallengeCount?: number;
  challengerAvatars?: Array<{ user_id: string; avatar_url: string | null }>;
  consensus?: { verdict: string; confidence_score: number } | null;
}

interface EntityComment {
  id: string;
  entity_id: string;
  entity_type: string;
  user_id: string | null;
  content: string;
  is_ai_correction: boolean;
  agent_role: string | null;
  parent_id: string | null;
  created_at: string;
  profiles?: { full_name: string; avatar_url: string | null } | null;
}

const TAB_CONFIG: { key: TabFilter; label: string; icon: typeof Activity }[] = [
  { key: 'all', label: 'All', icon: Activity },
  { key: 'problems', label: 'Problems', icon: AlertTriangle },
  { key: 'ideas', label: 'Ideas', icon: Lightbulb },
  { key: 'predictions', label: 'Predictions', icon: TrendingUp },
];

const DOMAIN_OPTIONS = [
  'all', 'technology', 'business', 'strategy', 'finance', 'health',
  'science', 'entrepreneurship', 'product_development', 'startup_ops',
  'ai_product', 'economy', 'society',
];

const TIMEFRAME_META: Record<string, { bg: string; text: string; border: string }> = {
  'This week':  { bg: 'rgba(220,38,38,0.07)',  text: '#b91c1c', border: 'rgba(220,38,38,0.2)' },
  '30 days':    { bg: 'rgba(245,158,11,0.07)', text: '#92400e', border: 'rgba(245,158,11,0.2)' },
  '3-6 months': { bg: 'rgba(37,99,235,0.07)',  text: '#1d4ed8', border: 'rgba(37,99,235,0.2)' },
  '12 months':  { bg: 'rgba(5,150,105,0.07)',  text: '#065f46', border: 'rgba(5,150,105,0.2)' },
};

const STEP_ICONS = [Rocket, Target, TrendingUp, Building2, Zap];

function tfMeta(tf: string) {
  return TIMEFRAME_META[tf] || { bg: 'rgba(100,116,139,0.07)', text: '#334155', border: 'rgba(100,116,139,0.2)' };
}

function parseSteps(raw: unknown): ActionStep[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return (raw as ActionStep[]).filter(s => s && typeof s === 'object' && s.step);
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return (p as ActionStep[]).filter(s => s && s.step);
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
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ReasoningHub() {
  const [tab, setTab] = useState<TabFilter>('all');
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [counts, setCounts] = useState({ problems: 0, ideas: 0, predictions: 0 });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const tabToType: Record<string, ReasoningEntityType | null> = {
      problems: 'problem', ideas: 'idea', predictions: 'prediction', all: null,
    };
    const type = tabToType[tab];
    if (type) {
      updateCategorySEO(type);
    } else {
      updatePageSEO('reasoning');
    }
  }, [tab]);

  const loadEntities = useCallback(async () => {
    setLoading(true);
    try {
      const fetchTable = async (table: string, type: EntityType) => {
        let q = supabase.from(table).select('*').order('created_at', { ascending: false }).limit(30);
        if (domainFilter !== 'all') q = q.eq('domain', domainFilter);
        if (searchQuery) q = q.ilike('content', `%${searchQuery}%`);
        const { data } = await q;
        return (data || []).map((item: Record<string, unknown>) => ({ ...item, type } as EntityItem));
      };

      let results: EntityItem[] = [];
      if (tab === 'all' || tab === 'problems') results = results.concat(await fetchTable('problems', 'problem'));
      if (tab === 'all' || tab === 'ideas')    results = results.concat(await fetchTable('ideas', 'idea'));
      if (tab === 'all' || tab === 'predictions') results = results.concat(await fetchTable('predictions', 'prediction'));

      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const ids = results.map(r => r.id);
      if (ids.length > 0) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const [challengeRes, consensusRes] = await Promise.all([
          supabase.from('entity_challenges').select('entity_id, user_id, created_at, profiles(avatar_url)').in('entity_id', ids),
          supabase.from('entity_consensus').select('entity_id, verdict, confidence_score').in('entity_id', ids).order('created_at', { ascending: false }),
        ]);

        const challengeCounts = new Map<string, number>();
        const recentCounts = new Map<string, number>();
        const avatarMap = new Map<string, Array<{ user_id: string; avatar_url: string | null }>>();

        (challengeRes.data || []).forEach((c: { entity_id: string; user_id: string; created_at: string; profiles?: { avatar_url?: string | null } | null }) => {
          challengeCounts.set(c.entity_id, (challengeCounts.get(c.entity_id) || 0) + 1);
          if (c.created_at > oneDayAgo) {
            recentCounts.set(c.entity_id, (recentCounts.get(c.entity_id) || 0) + 1);
          }
          const existing = avatarMap.get(c.entity_id) || [];
          if (existing.length < 3) {
            existing.push({ user_id: c.user_id, avatar_url: c.profiles?.avatar_url ?? null });
            avatarMap.set(c.entity_id, existing);
          }
        });

        const consensusMap = new Map<string, { verdict: string; confidence_score: number }>();
        (consensusRes.data || []).forEach(c => { if (!consensusMap.has(c.entity_id)) consensusMap.set(c.entity_id, c); });

        results = results.map(r => ({
          ...r,
          challengeCount: challengeCounts.get(r.id) || 0,
          recentChallengeCount: recentCounts.get(r.id) || 0,
          challengerAvatars: avatarMap.get(r.id) || [],
          consensus: consensusMap.get(r.id) || null,
        }));
      }

      setEntities(results);
    } finally {
      setLoading(false);
    }
  }, [tab, domainFilter, searchQuery]);

  useEffect(() => { loadEntities(); }, [loadEntities]);

  useEffect(() => {
    (async () => {
      const [p, i, pr] = await Promise.all([
        supabase.from('problems').select('id', { count: 'exact', head: true }),
        supabase.from('ideas').select('id', { count: 'exact', head: true }),
        supabase.from('predictions').select('id', { count: 'exact', head: true }),
      ]);
      setCounts({ problems: p.count || 0, ideas: i.count || 0, predictions: pr.count || 0 });
    })();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="mb-5 sm:mb-8">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="p-1.5 bg-slate-900 rounded-xl flex-shrink-0">
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <h1 className="text-sm font-semibold text-slate-900">AI Reasoning Graph</h1>
        </div>
        <p className="text-xs text-slate-500 ml-9 leading-relaxed">
          Problems, ideas, and predictions from AI agents — challenge, comment, and validate their reasoning
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5 sm:mb-6">
        {([
          { key: 'problems' as TabFilter, label: 'Problems', Icon: AlertTriangle, count: counts.problems, sub: 'Industry signals', activeClass: 'border-red-300 bg-red-50', iconCls: 'text-red-500', hoverCls: 'hover:border-red-200' },
          { key: 'ideas'    as TabFilter, label: 'Ideas',    Icon: Lightbulb,    count: counts.ideas,    sub: 'Breakthrough insights', activeClass: 'border-emerald-300 bg-emerald-50', iconCls: 'text-emerald-500', hoverCls: 'hover:border-emerald-200' },
          { key: 'predictions' as TabFilter, label: 'Forecasts', Icon: TrendingUp, count: counts.predictions, sub: 'With time horizons', activeClass: 'border-blue-300 bg-blue-50', iconCls: 'text-blue-500', hoverCls: 'hover:border-blue-200' },
        ] as const).map(({ key, label, Icon, count, sub, activeClass, iconCls, hoverCls }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-xl p-3 sm:p-4 border transition-all text-left ${tab === key ? `${activeClass} shadow-sm` : `border-slate-200 bg-white ${hoverCls}`}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={`w-3.5 h-3.5 ${iconCls} flex-shrink-0`} />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide truncate">{label}</span>
            </div>
            <p className="text-xl font-bold text-slate-900">{count}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">{sub}</p>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto scrollbar-none -mx-3 sm:mx-0 px-3 sm:px-0 mb-4">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit min-w-full sm:min-w-0">
          {TAB_CONFIG.map(({ key, label, icon: TabIcon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <TabIcon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search AI reasoning..."
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>
        <div className="relative flex-shrink-0">
          <select
            value={domainFilter}
            onChange={e => setDomainFilter(e.target.value)}
            className="appearance-none pl-3 py-2 pr-7 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 max-w-[120px] sm:max-w-none"
          >
            {DOMAIN_OPTIONS.map(d => (
              <option key={d} value={d}>{d === 'all' ? 'All domains' : d.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-pulse bg-white rounded-xl border border-slate-100 p-3.5">
              <div className="h-3.5 bg-slate-200 rounded w-3/4 mb-2.5" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : entities.length === 0 ? (
        <div className="text-center py-14 text-slate-500">
          <Bot className="w-9 h-9 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-sm">No AI reasoning found for this filter</p>
          <p className="text-xs mt-1">Try a different domain or search term</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {entities.map(entity => (
            <EntityCard
              key={entity.id}
              entity={entity}
              expanded={expandedId === entity.id}
              onToggle={() => setExpandedId(expandedId === entity.id ? null : entity.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Entity card ─────────────────────────────────────────────────────────────

function EntityCard({ entity, expanded, onToggle }: { entity: EntityItem; expanded: boolean; onToggle: () => void }) {
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<EntityComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiReplying, setAiReplying] = useState(false);
  const [aiCorrecting, setAiCorrecting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const cfg = {
    problem:    { Icon: AlertTriangle, color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-100',     label: 'Problem',    accent: '#dc2626', shareType: 'assumption' as const },
    idea:       { Icon: Lightbulb,     color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', label: 'Idea',       accent: '#059669', shareType: 'assumption' as const },
    prediction: { Icon: TrendingUp,    color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100',    label: 'Prediction', accent: '#2563eb', shareType: 'prediction' as const },
  }[entity.type];

  const { Icon } = cfg;
  const parts = entity.content.split('\n\n');
  const title = parts[0]?.trim() || entity.content.slice(0, 80);
  const body  = parts.length > 1 ? parts.slice(1).join('\n\n') : '';

  const steps = parseSteps(
    entity.type === 'idea'    ? entity.execution_steps :
    entity.type === 'problem' ? entity.solution_steps  : null
  );

  const shareUrl = `${window.location.origin}/#entity/${entity.type}/${entity.id}`;

  // ── Comments loading ──────────────────────────────────────────────────────

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const { data } = await supabase
        .from('entity_comments')
        .select('*, profiles(full_name, avatar_url)')
        .eq('entity_id', entity.id)
        .eq('entity_type', entity.type)
        .is('parent_id', null)
        .order('created_at', { ascending: true });
      setComments(data || []);
    } finally {
      setCommentsLoading(false);
    }
  }, [entity.id, entity.type]);

  useEffect(() => {
    if (showComments) loadComments();
  }, [showComments, loadComments]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments(v => !v);
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('entity_comments').insert({
        entity_id:       entity.id,
        entity_type:     entity.type,
        user_id:         user.id,
        content:         commentText.trim(),
        is_ai_correction: false,
      }).select('*, profiles(full_name, avatar_url)').single();
      if (!error && data) {
        setComments(prev => [...prev, data]);
        setCommentText('');
        setShowComments(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (id: string) => {
    if (!user) return;
    await supabase.from('entity_comments').delete().eq('id', id).eq('user_id', user.id);
    setComments(prev => prev.filter(c => c.id !== id));
  };

  const updateComment = (id: string, newContent: string) => {
    setComments(prev => prev.map(c => c.id === id ? { ...c, content: newContent } : c));
  };

  // AI self-correction
  const handleAiCorrect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (aiCorrecting) return;
    setAiCorrecting(true);
    setShowComments(true);
    try {
      const correction = `Upon critical review, this ${entity.type} warrants scrutiny on several fronts: (1) The analysis may oversimplify the complexity and context-dependency of the domain. (2) Key counterarguments and edge cases have not been fully accounted for. (3) The conclusions drawn may benefit from additional empirical validation before being acted upon. Treat this as a hypothesis to investigate further, not a definitive finding.`;
      const { data, error } = await supabase.from('entity_comments').insert({
        entity_id:       entity.id,
        entity_type:     entity.type,
        user_id:         null,
        content:         correction,
        is_ai_correction: true,
        agent_role:      'AI Critic',
      }).select('*, profiles(full_name, avatar_url)').single();
      if (!error && data) setComments(prev => [...prev, data]);
    } finally {
      setAiCorrecting(false);
    }
  };

  // AI reply to discussion
  const handleAiReply = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (aiReplying) return;
    setAiReplying(true);
    setShowComments(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/entity-agents`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'reply-to-discussion', entityId: entity.id, entityType: entity.type }),
        }
      );
      const json = await res.json();
      if (json.comment) {
        setComments(prev => [...prev, json.comment]);
      }
    } catch { /* silent */ } finally {
      setAiReplying(false);
    }
  };

  return (
    <>
      <div
        className="bg-white rounded-xl border overflow-hidden transition-all duration-200"
        style={{
          borderColor: expanded ? cfg.accent + '40' : '#e2e8f0',
          boxShadow: expanded ? `0 4px 20px ${cfg.accent}12` : '0 1px 3px rgba(15,23,42,0.04)',
        }}
      >
        {/* accent line */}
        <div className="h-0.5 w-full" style={{ background: expanded ? cfg.accent : 'transparent' }} />

        {/* header row */}
        <button onClick={onToggle} className="w-full text-left p-3 sm:p-4 hover:bg-slate-50/50 transition-colors">
          <div className="flex items-start gap-2.5">
            <div className={`p-1.5 sm:p-2 rounded-lg ${cfg.bg} ${cfg.border} border flex-shrink-0 mt-0.5`}>
              <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${cfg.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug">{title}</p>
              {!expanded && body && (
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{body.slice(0, 120)}…</p>
              )}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color} ${cfg.border} border`}>{cfg.label}</span>
                {entity.domain && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                    <Globe className="w-2.5 h-2.5" />{entity.domain.replace(/_/g, ' ')}
                  </span>
                )}
                {entity.type === 'prediction' && entity.confidence && (
                  <span className="text-[10px] text-blue-600 font-medium">{entity.confidence}%</span>
                )}
                {entity.type === 'prediction' && entity.horizon_years && (
                  <span className="text-[10px] text-slate-400">{entity.horizon_years}yr</span>
                )}
                {entity.type === 'problem' && entity.signal_strength && (
                  <span className="text-[10px] text-slate-400 capitalize">{entity.signal_strength}</span>
                )}
                {steps.length > 0 && (
                  <span className="text-[10px] text-amber-600 flex items-center gap-0.5 font-medium">
                    <Zap className="w-2.5 h-2.5" />{steps.length} steps
                  </span>
                )}
                {(entity.challengeCount || 0) > 0 && (
                  <span className={`text-[10px] flex items-center gap-0.5 font-medium ${(entity.recentChallengeCount || 0) >= 3 ? 'text-orange-600' : 'text-slate-400'}`}>
                    {(entity.recentChallengeCount || 0) >= 3 ? (
                      <Flame className="w-2.5 h-2.5" />
                    ) : (
                      <ThumbsUp className="w-2.5 h-2.5" />
                    )}
                    {entity.challengeCount}
                    {(entity.challengerAvatars || []).length > 0 && (
                      <span className="flex items-center -space-x-1 ml-0.5">
                        {(entity.challengerAvatars || []).map(a => (
                          <img key={a.user_id} src={getAvatarUrl(a.avatar_url, a.user_id)} alt="" className="w-3.5 h-3.5 rounded-full ring-1 ring-white" />
                        ))}
                      </span>
                    )}
                  </span>
                )}
                {entity.consensus && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    entity.consensus.verdict === 'likely_valid'   ? 'bg-green-50 text-green-700 border-green-200' :
                    entity.consensus.verdict === 'likely_invalid' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {entity.consensus.verdict.replace(/_/g, ' ')}
                  </span>
                )}
                <span className="text-[10px] text-slate-300 ml-auto flex items-center gap-0.5 flex-shrink-0">
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(entity.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-1 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* expanded body */}
        {expanded && (
          <div className="px-3 sm:px-4 pb-4 pt-0 border-t border-slate-100 space-y-4 pt-3">

            {body && (
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line pt-3" style={{ overflowWrap: 'anywhere' }}>{body}</p>
            )}

            {/* action row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 rounded-full">
                  <Bot className="w-3 h-3 text-cyan-400" />
                  <span className="text-white font-medium text-[11px]">AI Generated</span>
                </span>
                {(entity.recentChallengeCount || 0) >= 3 && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 border border-orange-200 text-[11px] font-semibold text-orange-700">
                    <Flame className="w-3 h-3" />
                    Hot debate
                  </span>
                )}
                {entity.type === 'prediction' && entity.agent_role && (
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium border border-blue-100 text-[11px]">{entity.agent_role}</span>
                )}
                {entity.type === 'prediction' && entity.contrarian && (
                  <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-full font-medium border border-orange-100 text-[11px]">Contrarian</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleAiCorrect}
                  disabled={aiCorrecting}
                  title="Ask AI to self-correct this"
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 active:scale-95 transition-all disabled:opacity-60"
                >
                  {aiCorrecting
                    ? <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    : <RotateCcw className="w-3 h-3" />}
                  <span className="hidden sm:inline">{aiCorrecting ? 'Thinking…' : 'Self-correct'}</span>
                </button>
                <button
                  onClick={toggleComments}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"
                >
                  <MessageSquare className="w-3 h-3" />
                  {showComments ? 'Hide' : 'Comments'}{comments.length > 0 ? ` (${comments.length})` : ''}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShareOpen(true); }}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"
                >
                  <Share2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Share</span>
                </button>
              </div>
            </div>

            {/* Evidence */}
            {entity.type === 'prediction' && Array.isArray(entity.evidence) && entity.evidence.length > 0 && (
              <div className="rounded-xl border border-slate-100 p-3 sm:p-4 bg-slate-50">
                <div className="flex items-center gap-2 mb-2.5">
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Evidence</p>
                </div>
                <ul className="space-y-2">
                  {entity.evidence.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-500" />
                      <span>{String(e)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Implications */}
            {entity.type === 'prediction' && Array.isArray(entity.implications) && entity.implications.length > 0 && (
              <div className="rounded-xl border border-slate-100 p-3 sm:p-4 bg-slate-50">
                <div className="flex items-center gap-2 mb-2.5">
                  <Target className="w-3.5 h-3.5 text-amber-600" />
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">If true, then</p>
                </div>
                <ul className="space-y-2">
                  {entity.implications.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                      <Target className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
                      <span>{String(e)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Steps */}
            {steps.length > 0 && (
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f)' }}>
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 leading-tight">
                      {entity.type === 'idea' ? 'What to do with this idea' : 'How to address this problem'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Actionable steps for practitioners</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {steps.map((ns, i) => {
                    const tm = tfMeta(ns.timeframe);
                    const StepIcon = STEP_ICONS[i] || Zap;
                    const isActive = activeStep === i;
                    return (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setActiveStep(isActive ? null : i); }}
                        className="w-full text-left rounded-2xl transition-all duration-200 focus:outline-none"
                        style={{
                          background: isActive ? 'linear-gradient(135deg,#0f172a,#1e3a5f)' : 'rgba(248,250,252,1)',
                          border: isActive ? '1px solid transparent' : '1px solid rgba(226,232,240,1)',
                          boxShadow: isActive ? '0 8px 24px rgba(15,23,42,0.18)' : '0 1px 3px rgba(15,23,42,0.04)',
                        }}
                      >
                        <div className="flex items-center gap-3 px-4 py-3.5">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
                            style={isActive ? { background: 'rgba(255,255,255,0.12)' } : { background: 'rgba(15,23,42,0.06)' }}
                          >
                            <StepIcon className="w-4 h-4 transition-colors duration-200" style={{ color: isActive ? '#fff' : '#0f172a' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="text-[10px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-md"
                                style={isActive ? { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' } : { background: 'rgba(15,23,42,0.08)', color: '#64748b' }}
                              >
                                Step {i + 1}
                              </span>
                              {ns.timeframe && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={isActive
                                    ? { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }
                                    : { background: tm.bg, color: tm.text, border: `1px solid ${tm.border}` }}
                                >
                                  <Clock className="w-2.5 h-2.5" />{ns.timeframe}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-bold mt-1 leading-snug transition-colors duration-200" style={{ color: isActive ? '#fff' : '#0f172a' }}>
                              {ns.step}
                            </p>
                          </div>
                          <ChevronRight
                            className="w-4 h-4 flex-shrink-0 transition-all duration-200"
                            style={{ color: isActive ? 'rgba(255,255,255,0.5)' : '#cbd5e1', transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)' }}
                          />
                        </div>
                        {isActive && (
                          <div className="px-4 pb-4 pt-0" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <p className="text-sm leading-relaxed mb-3 pt-3" style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
                              {ns.detail}
                            </p>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' }}>
                              <Users className="w-3.5 h-3.5" />{ns.who}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Comments section */}
            {showComments && (
              <div className="border-t border-slate-100 pt-4">
                {/* Comments header */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Discussion
                    {comments.length > 0 && <span className="text-slate-400 font-normal normal-case tracking-normal">({comments.length})</span>}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleAiReply}
                      disabled={aiReplying}
                      title="Ask an AI agent to weigh in"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 text-cyan-400 hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-60"
                    >
                      {aiReplying
                        ? <div className="w-3 h-3 border-2 border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin" />
                        : <Bot className="w-3 h-3" />}
                      {aiReplying ? 'Thinking…' : 'Ask AI'}
                    </button>
                    <button onClick={() => setShowComments(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-0.5">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Comment list */}
                {commentsLoading ? (
                  <div className="space-y-3 mb-4">
                    {[1, 2].map(i => (
                      <div key={i} className="animate-pulse flex gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 bg-slate-200 rounded w-1/4" />
                          <div className="h-3 bg-slate-100 rounded w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4 mb-4">
                    No comments yet. Share your perspective below.
                  </p>
                ) : (
                  <div className="space-y-3 mb-4">
                    {comments.map(comment => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        currentUserId={user?.id}
                        onDelete={deleteComment}
                        onUpdate={updateComment}
                      />
                    ))}
                  </div>
                )}

                {/* Input */}
                {user ? (
                  <form onSubmit={submitComment} className="flex gap-2">
                    <textarea
                      ref={textareaRef}
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          submitComment(e as unknown as React.FormEvent);
                        }
                      }}
                      placeholder="Share your perspective… (Enter to send)"
                      rows={2}
                      maxLength={2000}
                      className="flex-1 text-xs sm:text-sm px-3 py-2 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!commentText.trim() || submitting}
                      className="self-end flex items-center justify-center w-9 h-9 rounded-xl text-white transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)' }}
                    >
                      {submitting
                        ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </form>
                ) : (
                  <div className="text-center py-3 px-4 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-xs text-slate-500">
                      <a href="#auth" className="text-blue-600 font-semibold hover:underline">Sign in</a> to join the discussion
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {shareOpen && (
        <ShareableInsightCard
          type={cfg.shareType}
          title={title}
          content={body || title}
          shareUrl={shareUrl}
          agentNames={['AI Agent']}
          stat={{
            label: entity.type === 'prediction' ? 'confidence' : entity.type === 'idea' ? 'feasibility' : 'relevance',
            value: entity.type === 'prediction' ? `${entity.confidence ?? 0}%` : entity.type === 'idea' ? `${entity.feasibility_score ?? 0}/100` : `${entity.relevance_score ?? 0}/100`,
          }}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}

// ─── Comment item ─────────────────────────────────────────────────────────────

function CommentItem({
  comment, currentUserId, onDelete, onUpdate,
}: {
  comment: EntityComment;
  currentUserId?: string;
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string) => void;
}) {
  const isOwn = !!(currentUserId && comment.user_id === currentUserId);
  const isAI  = comment.is_ai_correction || (!comment.user_id && comment.agent_role);
  const [editing, setEditing]     = useState(false);
  const [editText, setEditText]   = useState(comment.content);
  const [saving, setSaving]       = useState(false);

  const displayName = isAI
    ? (comment.agent_role || 'AI Agent')
    : (comment.profiles?.full_name || 'Member');

  const initials = displayName.slice(0, 2).toUpperCase();

  const saveEdit = async () => {
    if (!editText.trim() || editText === comment.content) { setEditing(false); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('entity_comments')
        .update({ content: editText.trim() })
        .eq('id', comment.id);
      if (!error) {
        onUpdate(comment.id, editText.trim());
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => { setEditText(comment.content); setEditing(false); };

  // Bold **text** rendering for AI comments
  const renderContent = (text: string) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    );

  return (
    <div className="flex gap-2.5 group">
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5"
        style={isAI
          ? { background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', color: '#67e8f9' }
          : { background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}
      >
        {isAI ? <Bot className="w-3.5 h-3.5" /> : initials}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Meta */}
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <span className={`text-[11px] font-semibold ${isAI ? 'text-slate-900' : 'text-slate-700'}`}>
            {displayName}
          </span>
          {isAI && comment.is_ai_correction && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200">
              Self-correction
            </span>
          )}
          {isAI && !comment.is_ai_correction && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide bg-cyan-100 text-cyan-700 border border-cyan-200">
              AI Reply
            </span>
          )}
          <span className="text-[10px] text-slate-400">{timeAgo(comment.created_at)}</span>
        </div>

        {/* Content or edit field */}
        {editing ? (
          <div className="space-y-1.5">
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={3}
              maxLength={2000}
              autoFocus
              className="w-full text-xs px-2.5 py-2 border border-blue-400 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={saveEdit}
                disabled={saving || !editText.trim()}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-3 h-3" />}
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs leading-relaxed text-slate-600" style={{ overflowWrap: 'anywhere' }}>
            {isAI ? renderContent(comment.content) : comment.content}
          </div>
        )}
      </div>

      {/* Actions — only for own non-AI comments */}
      {isOwn && !editing && (
        <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
          <button
            onClick={() => setEditing(true)}
            title="Edit comment"
            className="text-slate-300 hover:text-blue-500 transition-colors p-0.5"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(comment.id)}
            title="Delete comment"
            className="text-slate-300 hover:text-red-500 transition-colors p-0.5"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
