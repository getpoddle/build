import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Lightbulb, TrendingUp, ArrowLeft, Clock, Link2,
  MessageSquare, Bot, ChevronDown, ChevronUp, Send,
  CheckCircle, XCircle, MinusCircle, GitBranch, Zap,
  Pencil, Trash2, X, Check, ThumbsUp, Flame, Reply,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarUrl } from '../lib/avatarUtils';
import { getDisplayName } from '../lib/displayName';

type EntityType = 'problem' | 'idea' | 'prediction';

interface ExecutionStep {
  step: string;
  detail: string;
  who?: string;
  timeframe?: string;
}

interface EntityData {
  id: string;
  content: string;
  status: string;
  domain: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  pod_id: string | null;
  relevance_score?: number;
  signal_strength?: string;
  evidence_count?: number;
  solution_steps?: ExecutionStep[];
  feasibility_score?: number;
  impact_score?: number;
  execution_steps?: ExecutionStep[];
  confidence?: number;
  horizon_date?: string;
  horizon_years?: number;
  outcome?: string;
  resolved_at?: string;
  outcome_evidence?: string;
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
  created_at: string;
}

interface Challenge {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  upvote_count: number;
  creator_reply: string | null;
  creator_replied_at: string | null;
  profiles?: { full_name: string; first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null } | null;
}

interface Consensus {
  verdict: string;
  confidence_score: number;
  summary: string;
  key_points: string[];
  positions: { role: string; position: string; confidence: number }[];
  agent_count: number;
}

interface LinkedEntity {
  id: string;
  type: EntityType;
  content: string;
  status: string;
  linkType: string;
  direction: 'incoming' | 'outgoing';
}

interface StateTransition {
  id: string;
  from_status: string;
  to_status: string;
  reason: string;
  triggered_by_agent: boolean;
  created_at: string;
}

interface EntityDetailProps {
  entityId: string;
  entityType: EntityType;
  onNavigate: (page: string, podId?: string, userId?: string, editMode?: boolean, initialTab?: string, threadId?: string, initialAssumptionId?: string, postId?: string) => void;
  onEntityClick?: (id: string, type: EntityType) => void;
}

const ACCENT_STYLES: Record<string, { numBg: string; numText: string; line: string; timeframe: string; dot: string; headerBg: string; headerBorder: string }> = {
  emerald: { numBg: 'bg-emerald-100', numText: 'text-emerald-700', line: 'bg-emerald-100', timeframe: 'text-emerald-600', dot: 'bg-emerald-400', headerBg: 'bg-emerald-50', headerBorder: 'border-emerald-200' },
  red: { numBg: 'bg-red-100', numText: 'text-red-700', line: 'bg-red-100', timeframe: 'text-red-600', dot: 'bg-red-400', headerBg: 'bg-red-50', headerBorder: 'border-red-200' },
  amber: { numBg: 'bg-amber-100', numText: 'text-amber-700', line: 'bg-amber-100', timeframe: 'text-amber-600', dot: 'bg-amber-400', headerBg: 'bg-amber-50', headerBorder: 'border-amber-200' },
  blue: { numBg: 'bg-blue-100', numText: 'text-blue-700', line: 'bg-blue-100', timeframe: 'text-blue-600', dot: 'bg-blue-400', headerBg: 'bg-blue-50', headerBorder: 'border-blue-200' },
};

const PROMPT_STARTERS = [
  { label: 'I disagree because…', prefix: 'I disagree because ' },
  { label: 'This assumes…', prefix: 'This assumes ' },
  { label: 'What about…', prefix: 'What about ' },
];

function CollapsibleSteps({ title, icon, steps, accentColor }: {
  title: string;
  icon: React.ReactNode;
  steps: ExecutionStep[];
  accentColor: string;
}) {
  const [open, setOpen] = useState(false);
  const style = ACCENT_STYLES[accentColor] ?? ACCENT_STYLES.blue;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-5 py-4 transition-colors duration-200 ${open ? style.headerBg : 'hover:bg-slate-50'}`}
      >
        <div className="flex items-center gap-2.5">
          {icon}
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.numBg} ${style.numText}`}>
            {steps.length}
          </span>
        </div>
        <div className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? `${steps.length * 120 + 40}px` : '0px', opacity: open ? 1 : 0 }}
      >
        <div className="px-5 pb-5 pt-2 space-y-0">
          {steps.map((step, i) => (
            <div key={i} className="relative pl-9 py-3 group">
              <div className={`absolute left-0 top-3 w-7 h-7 rounded-full ${style.numBg} ${style.numText} flex items-center justify-center text-xs font-black shadow-sm`}>
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`absolute left-[13px] top-10 bottom-0 w-0.5 ${style.line}`} />
              )}
              <div className="pl-1">
                <p className="text-sm font-semibold text-slate-800 leading-snug">{step.step}</p>
                {step.detail && (
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{step.detail}</p>
                )}
                {(step.who || step.timeframe) && (
                  <div className="flex items-center gap-3 mt-2">
                    {step.who && (
                      <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md font-medium">
                        {step.who}
                      </span>
                    )}
                    {step.timeframe && (
                      <span className={`text-xs ${style.timeframe} font-semibold flex items-center gap-1`}>
                        <Clock className="w-3 h-3" />
                        {step.timeframe}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CollapsibleList({ title, icon, items, accentColor }: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  accentColor: string;
}) {
  const [open, setOpen] = useState(false);
  const style = ACCENT_STYLES[accentColor] ?? ACCENT_STYLES.blue;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-5 py-4 transition-colors duration-200 ${open ? style.headerBg : 'hover:bg-slate-50'}`}
      >
        <div className="flex items-center gap-2.5">
          {icon}
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.numBg} ${style.numText}`}>
            {items.length}
          </span>
        </div>
        <div className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? `${items.length * 60 + 40}px` : '0px', opacity: open ? 1 : 0 }}
      >
        <div className="px-5 pb-5 pt-2">
          <ul className="space-y-2.5">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className={`w-2 h-2 mt-1.5 rounded-full ${style.dot} flex-shrink-0`} />
                <p className="text-sm text-slate-700 leading-relaxed">{item}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const TYPE_CONFIG: Record<EntityType, { icon: typeof AlertTriangle; label: string; color: string; bgColor: string; borderColor: string }> = {
  problem: { icon: AlertTriangle, label: 'Problem', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  idea: { icon: Lightbulb, label: 'Idea', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  prediction: { icon: TrendingUp, label: 'Prediction', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  challenged: { label: 'Challenged', color: 'text-amber-700', bg: 'bg-amber-50' },
  evolved: { label: 'Evolved', color: 'text-blue-700', bg: 'bg-blue-50' },
  validated: { label: 'Validated', color: 'text-green-700', bg: 'bg-green-50' },
  invalidated: { label: 'Invalidated', color: 'text-red-700', bg: 'bg-red-50' },
  deprecated: { label: 'Deprecated', color: 'text-slate-500', bg: 'bg-slate-100' },
};

const OUTCOME_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  pending: { label: 'Pending', icon: Clock, color: 'text-slate-500' },
  correct: { label: 'Correct', icon: CheckCircle, color: 'text-green-600' },
  partial: { label: 'Partially Correct', icon: MinusCircle, color: 'text-amber-600' },
  wrong: { label: 'Wrong', icon: XCircle, color: 'text-red-600' },
};

function isHotDebate(challenges: Challenge[]): boolean {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentCount = challenges.filter(c => new Date(c.created_at).getTime() > oneDayAgo).length;
  return recentCount >= 3;
}

export default function EntityDetail({ entityId, entityType, onNavigate, onEntityClick }: EntityDetailProps) {
  const { user } = useAuth();
  const [entity, setEntity] = useState<EntityData | null>(null);
  const [agentResponses, setAgentResponses] = useState<AgentResponse[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [consensus, setConsensus] = useState<Consensus | null>(null);
  const [linkedEntities, setLinkedEntities] = useState<LinkedEntity[]>([]);
  const [stateHistory, setStateHistory] = useState<StateTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAgents, setShowAgents] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [newChallenge, setNewChallenge] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
  const [editChallengeContent, setEditChallengeContent] = useState('');
  const [deletingChallengeId, setDeletingChallengeId] = useState<string | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<{ full_name: string; first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null } | null>(null);
  const [votedChallenges, setVotedChallenges] = useState<Set<string>>(new Set());
  const [votingId, setVotingId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [savingReply, setSavingReply] = useState(false);
  const [sortByVotes, setSortByVotes] = useState(false);

  const loadEntity = useCallback(async () => {
    setLoading(true);
    try {
      const table = entityType === 'problem' ? 'problems' : entityType === 'idea' ? 'ideas' : 'predictions';
      const { data, error } = await supabase.from(table).select('*').eq('id', entityId).maybeSingle();
      if (error || !data) return;
      setEntity(data as EntityData);

      if (data.created_by) {
        const { data: profile } = await supabase.from('profiles').select('full_name, first_name, last_name, username, avatar_url').eq('id', data.created_by).maybeSingle();
        setCreatorProfile(profile);
      }

      const [responsesRes, challengesRes, consensusRes, linksOutRes, linksInRes, historyRes] = await Promise.all([
        supabase.from('entity_agent_responses').select('*').eq('entity_type', entityType).eq('entity_id', entityId).order('created_at', { ascending: false }).limit(10),
        supabase.from('entity_challenges').select('*, profiles(full_name, first_name, last_name, username, avatar_url)').eq('entity_type', entityType).eq('entity_id', entityId).order('created_at', { ascending: false }),
        supabase.from('entity_consensus').select('*').eq('entity_type', entityType).eq('entity_id', entityId).order('created_at', { ascending: false }).limit(1),
        supabase.from('entity_links').select('*').eq('source_type', entityType).eq('source_id', entityId),
        supabase.from('entity_links').select('*').eq('target_type', entityType).eq('target_id', entityId),
        supabase.from('entity_state_transitions').select('*').eq('entity_type', entityType).eq('entity_id', entityId).order('created_at', { ascending: false }),
      ]);

      setAgentResponses(responsesRes.data || []);
      setChallenges(challengesRes.data || []);
      setConsensus(consensusRes.data?.[0] || null);
      setStateHistory(historyRes.data || []);

      // Load user's votes on these challenges
      if (user && challengesRes.data && challengesRes.data.length > 0) {
        const ids = challengesRes.data.map((c: Challenge) => c.id);
        const { data: votes } = await supabase
          .from('entity_challenge_votes')
          .select('challenge_id')
          .eq('user_id', user.id)
          .in('challenge_id', ids);
        setVotedChallenges(new Set((votes || []).map((v: { challenge_id: string }) => v.challenge_id)));
      }

      const linked: LinkedEntity[] = [];
      const outLinks = linksOutRes.data || [];
      const inLinks = linksInRes.data || [];

      const linkedIds = new Set<string>();
      outLinks.forEach(link => linkedIds.add(link.target_id));
      inLinks.forEach(link => linkedIds.add(link.source_id));

      if (linkedIds.size > 0) {
        const ids = Array.from(linkedIds);
        const [probs, ideas, preds] = await Promise.all([
          supabase.from('problems').select('id, content, status').in('id', ids),
          supabase.from('ideas').select('id, content, status').in('id', ids),
          supabase.from('predictions').select('id, content, status').in('id', ids),
        ]);

        const entityMap = new Map<string, { content: string; status: string; type: EntityType }>();
        (probs.data || []).forEach(p => entityMap.set(p.id, { content: p.content, status: p.status, type: 'problem' }));
        (ideas.data || []).forEach(i => entityMap.set(i.id, { content: i.content, status: i.status, type: 'idea' }));
        (preds.data || []).forEach(p => entityMap.set(p.id, { content: p.content, status: p.status, type: 'prediction' }));

        outLinks.forEach(link => {
          const target = entityMap.get(link.target_id);
          if (target) {
            linked.push({ id: link.target_id, type: target.type, content: target.content, status: target.status, linkType: link.link_type, direction: 'outgoing' });
          }
        });

        inLinks.forEach(link => {
          const source = entityMap.get(link.source_id);
          if (source) {
            linked.push({ id: link.source_id, type: source.type, content: source.content, status: source.status, linkType: link.link_type, direction: 'incoming' });
          }
        });
      }

      setLinkedEntities(linked);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, user]);

  useEffect(() => { loadEntity(); }, [loadEntity]);

  const submitChallenge = async () => {
    if (!user || newChallenge.trim().length < 20) return;
    setSubmitting(true);
    try {
      await supabase.from('entity_challenges').insert({
        entity_type: entityType,
        entity_id: entityId,
        user_id: user.id,
        content: newChallenge.trim(),
      });

      // Notify the entity creator
      if (entity?.created_by && entity.created_by !== user.id) {
        const entityLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);
        await supabase.from('notifications').insert({
          user_id: entity.created_by,
          actor_id: user.id,
          type: 'entity_challenged',
          title: `Your ${entityLabel} was challenged`,
          content: newChallenge.trim().slice(0, 120),
          related_id: entityId,
          related_type: entityType,
        });
      }

      setNewChallenge('');
      loadEntity();
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (challengeId: string) => {
    if (!user || votingId) return;
    setVotingId(challengeId);
    try {
      const { data } = await supabase.rpc('toggle_challenge_vote', {
        p_challenge_id: challengeId,
        p_user_id: user.id,
      });
      if (data) {
        const result = data as { voted: boolean; upvote_count: number };
        setChallenges(prev => prev.map(c =>
          c.id === challengeId ? { ...c, upvote_count: result.upvote_count } : c
        ));
        setVotedChallenges(prev => {
          const next = new Set(prev);
          if (result.voted) next.add(challengeId);
          else next.delete(challengeId);
          return next;
        });

        // Notify challenger when their challenge is upvoted
        if (result.voted) {
          const challenge = challenges.find(c => c.id === challengeId);
          if (challenge && challenge.user_id !== user.id) {
            await supabase.from('notifications').insert({
              user_id: challenge.user_id,
              actor_id: user.id,
              type: 'challenge_upvoted',
              title: 'Your challenge was upvoted',
              content: challenge.content.slice(0, 120),
              related_id: entityId,
              related_type: entityType,
            });
          }
        }
      }
    } finally {
      setVotingId(null);
    }
  };

  const submitCreatorReply = async (challengeId: string) => {
    if (!user || !replyText.trim() || savingReply) return;
    setSavingReply(true);
    try {
      await supabase
        .from('entity_challenges')
        .update({ creator_reply: replyText.trim(), creator_replied_at: new Date().toISOString() })
        .eq('id', challengeId);

      // Notify the challenger that the creator replied
      const challenge = challenges.find(c => c.id === challengeId);
      if (challenge && challenge.user_id !== user.id) {
        const entityLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);
        await supabase.from('notifications').insert({
          user_id: challenge.user_id,
          actor_id: user.id,
          type: 'challenge_replied',
          title: `Creator replied to your challenge`,
          content: `Re: ${entityLabel} — ${replyText.trim().slice(0, 100)}`,
          related_id: entityId,
          related_type: entityType,
        });
      }

      setReplyingToId(null);
      setReplyText('');
      loadEntity();
    } finally {
      setSavingReply(false);
    }
  };

  const startEditChallenge = (challenge: Challenge) => {
    setEditingChallengeId(challenge.id);
    setEditChallengeContent(challenge.content);
  };

  const saveEditChallenge = async () => {
    if (!editingChallengeId || !editChallengeContent.trim()) return;
    await supabase
      .from('entity_challenges')
      .update({ content: editChallengeContent.trim() })
      .eq('id', editingChallengeId);
    setEditingChallengeId(null);
    setEditChallengeContent('');
    loadEntity();
  };

  const deleteChallenge = async (id: string) => {
    await supabase.from('entity_challenges').delete().eq('id', id);
    setDeletingChallengeId(null);
    loadEntity();
  };

  const sortedChallenges = sortByVotes
    ? [...challenges].sort((a, b) => b.upvote_count - a.upvote_count)
    : challenges;

  const challengerAvatars = challenges.slice(0, 3).map(c => ({
    id: c.user_id,
    avatarUrl: c.profiles?.avatar_url ?? null,
  }));

  const hot = isHotDebate(challenges);

  if (loading || !entity) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="h-32 bg-slate-100 rounded-xl" />
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const config = TYPE_CONFIG[entityType];
  const statusCfg = STATUS_CONFIG[entity.status] || STATUS_CONFIG.active;
  const Icon = config.icon;
  const isCreator = user?.id === entity.created_by;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('home')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className={`px-3 py-1.5 rounded-lg ${config.bgColor} ${config.borderColor} border flex items-center gap-2`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
          <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
        </div>
        <div className={`px-2.5 py-1 rounded-md ${statusCfg.bg}`}>
          <span className={`text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
        </div>
        {hot && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs font-semibold text-orange-700">Hot debate</span>
          </div>
        )}
      </div>

      {/* Main content card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        {(() => {
          const parts = entity.content.split('\n\n');
          const title = parts[0]?.trim();
          const body = parts.length > 1 ? parts.slice(1).join('\n\n') : null;
          return (
            <>
              <h2 className="text-xl text-slate-900 font-bold leading-snug">{title}</h2>
              {body && (
                <p className="mt-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">{body}</p>
              )}
            </>
          );
        })()}

        {/* AI attribution & metadata */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-3 text-sm text-slate-500 flex-wrap">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-900 rounded-full">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-medium text-white">AI Generated</span>
          </div>
          {creatorProfile && (
            <div className="flex items-center gap-2">
              <img src={getAvatarUrl(creatorProfile.avatar_url, entity.created_by)} alt="" className="w-5 h-5 rounded-full" />
              <span className="text-xs">{getDisplayName(creatorProfile)}</span>
            </div>
          )}
          <span className="text-slate-300">|</span>
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs">{new Date(entity.created_at).toLocaleDateString()}</span>
          {entity.domain && (
            <>
              <span className="text-slate-300">|</span>
              <span className="text-xs capitalize">{entity.domain.replace(/_/g, ' ')}</span>
            </>
          )}
        </div>

        {/* Type-specific metrics */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {entityType === 'problem' && (
            <>
              <MetricCard label="Relevance" value={`${entity.relevance_score || 50}%`} />
              <MetricCard label="Signal" value={entity.signal_strength || 'building'} />
              <MetricCard label="Evidence" value={String(entity.evidence_count || 0)} />
              <ChallengeMetricCard count={challenges.length} avatars={challengerAvatars} hot={hot} />
            </>
          )}
          {entityType === 'idea' && (
            <>
              <MetricCard label="Feasibility" value={`${entity.feasibility_score || 50}%`} />
              <MetricCard label="Impact" value={`${entity.impact_score || 50}%`} />
              <MetricCard label="Steps" value={String((entity.execution_steps || []).length)} />
              <ChallengeMetricCard count={challenges.length} avatars={challengerAvatars} hot={hot} />
            </>
          )}
          {entityType === 'prediction' && (
            <>
              <MetricCard label="Confidence" value={`${entity.confidence || 50}%`} />
              <MetricCard label="Horizon" value={entity.horizon_years ? `${entity.horizon_years}yr` : 'N/A'} />
              <MetricCard label="Outcome" value={OUTCOME_CONFIG[entity.outcome || 'pending']?.label || 'Pending'} />
              <ChallengeMetricCard count={challenges.length} avatars={challengerAvatars} hot={hot} />
            </>
          )}
        </div>
      </div>

      {/* Execution Steps for Ideas */}
      {entityType === 'idea' && entity.execution_steps && entity.execution_steps.length > 0 && (
        <CollapsibleSteps
          title="Execution Steps"
          icon={<Lightbulb className="w-4 h-4 text-emerald-600" />}
          steps={entity.execution_steps}
          accentColor="emerald"
        />
      )}

      {/* Solution Steps for Problems */}
      {entityType === 'problem' && entity.solution_steps && entity.solution_steps.length > 0 && (
        <CollapsibleSteps
          title="Steps to Solve"
          icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
          steps={entity.solution_steps}
          accentColor="red"
        />
      )}

      {/* Prediction Details */}
      {entityType === 'prediction' && (
        <div className="space-y-4">
          {(entity.agent_role || entity.signal_strength || entity.contrarian) && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-800">Prediction Metadata</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {entity.agent_role && (
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">
                    {entity.agent_role}
                  </span>
                )}
                {entity.signal_strength && (
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${
                    entity.signal_strength === 'strong' ? 'bg-green-50 text-green-700 border-green-100' :
                    entity.signal_strength === 'building' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                    'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    Signal: {entity.signal_strength}
                  </span>
                )}
                {entity.contrarian && (
                  <span className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full border border-orange-100">
                    Contrarian View
                  </span>
                )}
              </div>
            </div>
          )}

          {entity.evidence && entity.evidence.length > 0 && (
            <CollapsibleList
              title="Evidence"
              icon={<Zap className="w-4 h-4 text-amber-500" />}
              items={entity.evidence}
              accentColor="amber"
            />
          )}

          {entity.implications && entity.implications.length > 0 && (
            <CollapsibleList
              title="Implications"
              icon={<TrendingUp className="w-4 h-4 text-blue-500" />}
              items={entity.implications}
              accentColor="blue"
            />
          )}
        </div>
      )}

      {/* Consensus badge */}
      {consensus && (
        <div className={`rounded-xl border p-4 ${
          consensus.verdict === 'likely_valid' ? 'bg-green-50 border-green-200' :
          consensus.verdict === 'likely_invalid' ? 'bg-red-50 border-red-200' :
          consensus.verdict === 'mixed' ? 'bg-amber-50 border-amber-200' :
          'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-semibold text-slate-800">AI Consensus</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              consensus.verdict === 'likely_valid' ? 'bg-green-100 text-green-700' :
              consensus.verdict === 'likely_invalid' ? 'bg-red-100 text-red-700' :
              consensus.verdict === 'mixed' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {consensus.verdict.replace(/_/g, ' ')} ({consensus.confidence_score}%)
            </span>
          </div>
          <p className="text-sm text-slate-700">{consensus.summary}</p>
          {consensus.key_points.length > 0 && (
            <ul className="mt-2 space-y-1">
              {consensus.key_points.slice(0, 3).map((point, i) => (
                <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                  <Zap className="w-3 h-3 mt-0.5 text-amber-500 flex-shrink-0" />
                  {typeof point === 'string' ? point : JSON.stringify(point)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Linked entities */}
      {linkedEntities.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-800">Connected Reasoning ({linkedEntities.length})</h3>
          </div>
          <div className="space-y-2">
            {linkedEntities.map(linked => {
              const lConfig = TYPE_CONFIG[linked.type];
              const LIcon = lConfig.icon;
              return (
                <button
                  key={`${linked.id}-${linked.linkType}-${linked.direction}`}
                  onClick={() => onEntityClick?.(linked.id, linked.type)}
                  className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${lConfig.bgColor}`}>
                      <LIcon className={`w-3.5 h-3.5 ${lConfig.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 truncate group-hover:text-slate-900">{linked.content}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">
                          {linked.direction === 'outgoing' ? 'This' : linked.type} {linked.linkType} {linked.direction === 'outgoing' ? linked.type : 'this'}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_CONFIG[linked.status]?.bg || 'bg-slate-100'} ${STATUS_CONFIG[linked.status]?.color || 'text-slate-500'}`}>
                          {linked.status}
                        </span>
                      </div>
                    </div>
                    <Link2 className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Agent responses */}
      {agentResponses.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowAgents(!showAgents)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-semibold text-slate-800">Agent Analysis ({agentResponses.length})</span>
            </div>
            {showAgents ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showAgents && (
            <div className="border-t border-slate-100 divide-y divide-slate-50">
              {agentResponses.map(response => (
                <div key={response.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{response.agent_role}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      response.response_type === 'challenge' ? 'bg-red-50 text-red-600' :
                      response.response_type === 'support' ? 'bg-green-50 text-green-600' :
                      response.response_type === 'risk' ? 'bg-amber-50 text-amber-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>{response.response_type}</span>
                    <span className="text-xs text-slate-400 ml-auto">{response.confidence_score}% confidence</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{response.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Challenges */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        {/* Header with social proof & sort */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-800">
                Challenges
                {challenges.length > 0 && (
                  <span className="ml-1.5 text-xs font-bold text-slate-500">({challenges.length})</span>
                )}
              </h3>
            </div>

            {/* Avatar stack social proof */}
            {challengerAvatars.length > 0 && (
              <div className="flex items-center -space-x-1.5">
                {challengerAvatars.map(a => (
                  <img
                    key={a.id}
                    src={getAvatarUrl(a.avatarUrl, a.id)}
                    alt=""
                    className="w-5 h-5 rounded-full ring-1.5 ring-white"
                  />
                ))}
                {challenges.length > 3 && (
                  <span className="text-xs text-slate-500 pl-2 font-medium">+{challenges.length - 3} more</span>
                )}
              </div>
            )}

            {hot && (
              <span className="flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                <Flame className="w-3 h-3" />
                Hot
              </span>
            )}
          </div>

          {challenges.length > 1 && (
            <button
              onClick={() => setSortByVotes(v => !v)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                sortByVotes
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {sortByVotes ? 'Top' : 'New'}
            </button>
          )}
        </div>

        {sortedChallenges.length > 0 && (
          <div className="space-y-3 mb-5">
            {sortedChallenges.map(challenge => {
              const isOwner = user?.id === challenge.user_id;
              const isEditing = editingChallengeId === challenge.id;
              const isConfirmingDelete = deletingChallengeId === challenge.id;
              const hasVoted = votedChallenges.has(challenge.id);
              const isReplying = replyingToId === challenge.id;

              return (
                <div
                  key={challenge.id}
                  className={`rounded-xl border transition-all ${
                    challenge.upvote_count >= 3 ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      {challenge.profiles && (
                        <>
                          <img src={getAvatarUrl(challenge.profiles.avatar_url, challenge.user_id)} alt="" className="w-5 h-5 rounded-full" />
                          <span className="text-xs font-medium text-slate-700">{getDisplayName(challenge.profiles)}</span>
                        </>
                      )}
                      <span className="text-xs text-slate-400 ml-auto">{new Date(challenge.created_at).toLocaleDateString()}</span>
                      {isOwner && !isEditing && !isConfirmingDelete && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEditChallenge(challenge)}
                            className="p-1 hover:bg-slate-200 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                          <button
                            onClick={() => setDeletingChallengeId(challenge.id)}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-600" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={editChallengeContent}
                          onChange={e => setEditChallengeContent(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveEditChallenge()}
                          className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                          autoFocus
                        />
                        <button onClick={saveEditChallenge} className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingChallengeId(null)} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : isConfirmingDelete ? (
                      <div className="flex items-center gap-2 mt-1 p-2 bg-red-50 rounded-lg border border-red-100">
                        <span className="text-xs text-red-700 flex-1">Delete this challenge?</span>
                        <button onClick={() => deleteChallenge(challenge.id)} className="px-2.5 py-1 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 transition-colors">
                          Delete
                        </button>
                        <button onClick={() => setDeletingChallengeId(null)} className="px-2.5 py-1 bg-white text-slate-600 text-xs font-medium rounded-md border border-slate-200 hover:bg-slate-50 transition-colors">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-700">{challenge.content}</p>
                    )}

                    {/* Action row: upvote + creator reply */}
                    {!isEditing && !isConfirmingDelete && (
                      <div className="flex items-center gap-2 mt-2.5">
                        <button
                          onClick={() => handleVote(challenge.id)}
                          disabled={!user || votingId === challenge.id}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            hasVoted
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                          } disabled:opacity-50`}
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${hasVoted ? 'fill-current' : ''}`} />
                          {challenge.upvote_count > 0 ? challenge.upvote_count : 'Upvote'}
                        </button>

                        {isCreator && !challenge.creator_reply && (
                          <button
                            onClick={() => { setReplyingToId(challenge.id); setReplyText(''); }}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 transition-all"
                          >
                            <Reply className="w-3.5 h-3.5" />
                            Reply
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Creator reply */}
                  {challenge.creator_reply && (
                    <div className="mx-3 mb-3 p-3 bg-white rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2 mb-1.5">
                        {creatorProfile && (
                          <img src={getAvatarUrl(creatorProfile.avatar_url, entity.created_by)} alt="" className="w-4 h-4 rounded-full" />
                        )}
                        <span className="text-xs font-semibold text-slate-700">
                          {creatorProfile ? getDisplayName(creatorProfile) : 'Creator'}
                        </span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">replied</span>
                        {challenge.creator_replied_at && (
                          <span className="text-xs text-slate-400 ml-auto">{new Date(challenge.creator_replied_at).toLocaleDateString()}</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-700">{challenge.creator_reply}</p>
                    </div>
                  )}

                  {/* Reply input */}
                  {isReplying && (
                    <div className="mx-3 mb-3 space-y-2">
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Reply to this challenge..."
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => submitCreatorReply(challenge.id)}
                          disabled={savingReply || !replyText.trim()}
                          className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                        >
                          {savingReply ? 'Posting…' : 'Post reply'}
                        </button>
                        <button
                          onClick={() => setReplyingToId(null)}
                          className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {user ? (
          <div className="space-y-3">
            {/* Prompt starters */}
            <div className="flex flex-wrap gap-2">
              {PROMPT_STARTERS.map(({ label, prefix }) => (
                <button
                  key={label}
                  onClick={() => setNewChallenge(prefix)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-all"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={newChallenge}
                  onChange={e => setNewChallenge(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && newChallenge.trim().length >= 20 && submitChallenge()}
                  placeholder="Challenge this reasoning…"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
                {newChallenge.length > 0 && newChallenge.length < 20 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    {20 - newChallenge.length} more
                  </span>
                )}
              </div>
              <button
                onClick={submitChallenge}
                disabled={submitting || newChallenge.trim().length < 20}
                className="px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {challenges.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-1">
                Be the first to challenge this reasoning
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-2">Sign in to challenge this insight</p>
        )}
      </div>

      {/* State history */}
      {stateHistory.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-semibold text-slate-800">Evolution History ({stateHistory.length})</span>
            </div>
            {showHistory ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showHistory && (
            <div className="border-t border-slate-100 p-4">
              <div className="space-y-3">
                {stateHistory.map(transition => (
                  <div key={transition.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-600">{transition.from_status}</span>
                        <span className="text-xs text-slate-400">-&gt;</span>
                        <span className="text-xs font-medium text-slate-800">{transition.to_status}</span>
                        {transition.triggered_by_agent && <Bot className="w-3 h-3 text-slate-400" />}
                      </div>
                      {transition.reason && <p className="text-xs text-slate-500 mt-0.5">{transition.reason}</p>}
                      <span className="text-xs text-slate-400">{new Date(transition.created_at).toLocaleDateString()}</span>
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-slate-50 rounded-lg text-center">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-800 capitalize">{value}</p>
    </div>
  );
}

function ChallengeMetricCard({ count, avatars, hot }: {
  count: number;
  avatars: { id: string; avatarUrl: string | null }[];
  hot: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg text-center relative ${hot ? 'bg-orange-50' : 'bg-slate-50'}`}>
      <p className={`text-xs mb-0.5 ${hot ? 'text-orange-600' : 'text-slate-500'}`}>Challenges</p>
      <p className={`text-sm font-semibold ${hot ? 'text-orange-700' : 'text-slate-800'}`}>{count}</p>
      {avatars.length > 0 && (
        <div className="flex justify-center items-center -space-x-1 mt-1">
          {avatars.slice(0, 3).map(a => (
            <img key={a.id} src={getAvatarUrl(a.avatarUrl, a.id)} alt="" className="w-4 h-4 rounded-full ring-1 ring-white" />
          ))}
        </div>
      )}
    </div>
  );
}
