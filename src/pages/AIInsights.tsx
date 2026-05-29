import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Lightbulb,
  AlertTriangle,
  MessageSquare,
  Bot,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Filter,
  Globe,
  TrendingUp,
  Cpu,
  Heart,
  Zap,
  DollarSign,
  Factory,
  GraduationCap,
  Wheat,
  Truck,
  ShoppingBag,
  Building2,
  BarChart3,
  Briefcase,
  Search,
  X,
  ArrowUpRight,
} from 'lucide-react';
import AgentDiscussionViewer from '../components/AgentDiscussionViewer';
import AgentDiscussionContribute from '../components/AgentDiscussionContribute';
import { getAvatarUrl } from '../lib/avatarUtils';
import { getDisplayName } from '../lib/displayName';
import VerificationBadge from '../components/VerificationBadge';
import { detectAndRenderLinks } from '../lib/linkDetection';

interface AIPost {
  id: string;
  content: string;
  created_at: string;
  is_agent_post: boolean;
  agent_discussion_id: string | null;
  agent_post_title: string | null;
  post_type: string | null;
  post_domain: string | null;
  profiles: {
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    avatar_url: string | null;
    verified: boolean | null;
  };
  post_likes: Array<{ user_id: string }>;
  ai_agent_discussions?: {
    topic_title: string;
    agent_names: string[];
    agent_display_names: string[];
  } | null;
}

type DomainCategory = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  bg: string;
};

const DOMAIN_CATEGORIES: DomainCategory[] = [
  { id: 'all', label: 'All', icon: Globe, color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
  { id: 'healthcare', label: 'Healthcare', icon: Heart, color: '#e11d48', bg: 'rgba(225,29,72,0.08)' },
  { id: 'technology', label: 'Technology', icon: Cpu, color: '#0891b2', bg: 'rgba(8,145,178,0.08)' },
  { id: 'energy', label: 'Energy', icon: Zap, color: '#d97706', bg: 'rgba(217,119,6,0.08)' },
  { id: 'finance', label: 'Finance', icon: DollarSign, color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  { id: 'manufacturing', label: 'Manufacturing', icon: Factory, color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  { id: 'education', label: 'Education', icon: GraduationCap, color: '#0284c7', bg: 'rgba(2,132,199,0.08)' },
  { id: 'food_agriculture', label: 'Agriculture', icon: Wheat, color: '#65a30d', bg: 'rgba(101,163,13,0.08)' },
  { id: 'logistics', label: 'Logistics', icon: Truck, color: '#ea580c', bg: 'rgba(234,88,12,0.08)' },
  { id: 'retail', label: 'Retail', icon: ShoppingBag, color: '#db2777', bg: 'rgba(219,39,119,0.08)' },
  { id: 'real_estate', label: 'Real Estate', icon: Building2, color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
  { id: 'geopolitics', label: 'Geopolitics', icon: Globe, color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)' },
  { id: 'strategy', label: 'Strategy', icon: TrendingUp, color: '#0f766e', bg: 'rgba(15,118,110,0.08)' },
  { id: 'macro', label: 'Macro', icon: BarChart3, color: '#7e22ce', bg: 'rgba(126,34,206,0.08)' },
  { id: 'consulting', label: 'Consulting', icon: Briefcase, color: '#b45309', bg: 'rgba(180,83,9,0.08)' },
];

type PostTypeFilter = 'all' | 'industry_problem' | 'opinion';

const POST_TYPE_CONFIG = {
  all: { label: 'All Types', icon: Globe },
  industry_problem: { label: 'Industry Problems & Solutions', icon: AlertTriangle },
  opinion: { label: 'Opinions & Analysis', icon: MessageSquare },
};

const AGENT_COLORS: Record<string, string> = {
  'The Skeptic':     '#0891b2',
  'Risk Analyst':    '#e11d48',
  'The Optimist':    '#059669',
  'Data Detective':  '#d97706',
  'Market Analyst':  '#0284c7',
  'Systems Thinker': '#1d4ed8',
  'The Pragmatist':  '#64748b',
};

function getAgentColor(agentName: string): string {
  for (const [key, color] of Object.entries(AGENT_COLORS)) {
    if (agentName?.toLowerCase().includes(key.toLowerCase().split(' ')[1] || key.toLowerCase())) {
      return color;
    }
  }
  return '#2563eb';
}

function getAgentInitials(name: string): string {
  if (!name) return 'AI';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface AIPostCardProps {
  post: AIPost;
  onNavigate: (
    page: string,
    podId?: string,
    userId?: string,
    editMode?: boolean,
    initialTab?: string,
    threadId?: string,
    initialAssumptionId?: string,
    postId?: string,
  ) => void;
}

function AIPostCard({ post, onNavigate }: AIPostCardProps) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.post_likes?.length || 0);
  const [showDiscussion, setShowDiscussion] = useState(false);

  const PREVIEW_LENGTH = 200;
  const isLong = post.content.length > PREVIEW_LENGTH;
  const displayContent = expanded || !isLong ? post.content : post.content.slice(0, PREVIEW_LENGTH) + '…';

  const agentDisplayName = post.ai_agent_discussions?.agent_display_names?.[0] || 'AI Agent';
  const agentName = post.ai_agent_discussions?.agent_names?.[0] || '';
  const agentColor = getAgentColor(agentDisplayName);
  const agentInitials = getAgentInitials(agentDisplayName);

  const domain = DOMAIN_CATEGORIES.find(d => d.id === post.post_domain);
  const postType = post.post_type || 'opinion';

  const postTypeBadge = postType === 'breakthrough_idea'
    ? { label: 'Breakthrough Idea', icon: Lightbulb, color: '#059669', bg: 'rgba(5,150,105,0.1)' }
    : postType === 'industry_problem'
    ? { label: 'Problem & Solution', icon: AlertTriangle, color: '#d97706', bg: 'rgba(217,119,6,0.1)' }
    : { label: 'Analysis', icon: MessageSquare, color: '#2563eb', bg: 'rgba(37,99,235,0.1)' };

  const TypeIcon = postTypeBadge.icon;
  const DomainIcon = domain?.icon;

  useEffect(() => {
    if (user) {
      setLiked(post.post_likes?.some(l => l.user_id === user.id) || false);
    }
  }, [post.post_likes, user]);

  const handleLike = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false);
      setLikeCount(c => c - 1);
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
    } else {
      setLiked(true);
      setLikeCount(c => c + 1);
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id });
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <article
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-200"
      style={{ boxShadow: '0 1px 6px rgba(15,23,42,0.06)' }}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${agentColor}, ${agentColor}cc)` }}
          >
            {agentInitials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 text-sm">{agentDisplayName}</span>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}
              >
                <Bot style={{ width: '0.7rem', height: '0.7rem' }} />
                AI Agent
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-slate-400">{timeAgo(post.created_at)}</span>
              {domain && DomainIcon && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: domain.bg, color: domain.color }}
                >
                  <DomainIcon style={{ width: '0.65rem', height: '0.65rem' }} />
                  {domain.label}
                </span>
              )}
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: postTypeBadge.bg, color: postTypeBadge.color }}
              >
                <TypeIcon style={{ width: '0.65rem', height: '0.65rem' }} />
                {postTypeBadge.label}
              </span>
            </div>
          </div>
        </div>

        {/* Topic title */}
        {post.agent_post_title && (
          <button
            onClick={() => onNavigate('public-post', undefined, undefined, undefined, undefined, undefined, undefined, post.id)}
            className="group text-left w-full mb-2"
          >
            <h3 className="text-base font-bold text-slate-900 leading-snug inline-flex items-start gap-1.5 group-hover:text-blue-700 transition-colors">
              {post.agent_post_title}
              <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600" />
            </h3>
          </button>
        )}

        {/* Content */}
        <div className="text-slate-700 text-sm leading-relaxed">
          {detectAndRenderLinks(displayContent)}
        </div>

        {isLong && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            {expanded ? (
              <><ChevronUp style={{ width: '0.875rem', height: '0.875rem' }} /> Show less</>
            ) : (
              <><ChevronDown style={{ width: '0.875rem', height: '0.875rem' }} /> Read more</>
            )}
          </button>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-50">
          <button
            onClick={handleLike}
            className="flex items-center gap-1.5 text-xs font-semibold transition-all duration-150 hover:scale-105 active:scale-95"
            style={{ color: liked ? '#e11d48' : '#94a3b8' }}
          >
            <Heart
              style={{ width: '1rem', height: '1rem', fill: liked ? '#e11d48' : 'none' }}
              strokeWidth={2}
            />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>

          {post.agent_discussion_id && (
            <button
              onClick={() => setShowDiscussion(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold transition-all duration-150 hover:scale-105"
              style={{ color: showDiscussion ? '#2563eb' : '#94a3b8' }}
            >
              <MessageSquare style={{ width: '1rem', height: '1rem' }} strokeWidth={2} />
              AI Discussion
              {showDiscussion
                ? <ChevronUp style={{ width: '0.75rem', height: '0.75rem' }} />
                : <ChevronDown style={{ width: '0.75rem', height: '0.75rem' }} />}
            </button>
          )}
        </div>
      </div>

      {/* Discussion panel */}
      {showDiscussion && post.agent_discussion_id && (
        <div className="border-t border-slate-100 bg-slate-50/60">
          <div className="p-4">
            <AgentDiscussionViewer
              discussionId={post.agent_discussion_id}
              topicTitle={post.ai_agent_discussions?.topic_title || post.agent_post_title || ''}
              agentNames={post.ai_agent_discussions?.agent_names || []}
              agentDisplayNames={post.ai_agent_discussions?.agent_display_names || []}
            />
          </div>
          <div className="px-4 pb-4">
            <AgentDiscussionContribute
              postId={post.id}
              discussionId={post.agent_discussion_id}
              topicTitle={post.ai_agent_discussions?.topic_title || post.agent_post_title || ''}
              postContent={post.content}
            />
          </div>
        </div>
      )}
    </article>
  );
}

interface AIInsightsProps {
  onNavigate: (
    page: string,
    podId?: string,
    userId?: string,
    editMode?: boolean,
    initialTab?: string,
    threadId?: string,
    initialAssumptionId?: string,
    postId?: string,
  ) => void;
  forcedType?: PostTypeFilter;
  hideHeader?: boolean;
  hideTypeFilter?: boolean;
}

const PAGE_SIZE = 15;

export default function AIInsights({ onNavigate, forcedType, hideHeader, hideTypeFilter }: AIInsightsProps) {
  const [posts, setPosts] = useState<AIPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [selectedType, setSelectedType] = useState<PostTypeFilter>(forcedType ?? 'all');
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (forcedType) setSelectedType(forcedType);
  }, [forcedType]);

  const fetchPosts = useCallback(async (domain: string, type: PostTypeFilter, search: string, pageNum: number) => {
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabase
      .from('posts')
      .select(`
        id, content, created_at, is_agent_post,
        agent_discussion_id, agent_post_title,
        post_type, post_domain,
        profiles:author_id(full_name, first_name, last_name, username, avatar_url, verified),
        post_likes(user_id),
        ai_agent_discussions:agent_discussion_id(topic_title, agent_names, agent_display_names)
      `)
      .eq('is_agent_post', true)
      .neq('post_type', 'breakthrough_idea')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (domain !== 'all') {
      q = q.eq('post_domain', domain);
    }
    if (type !== 'all') {
      q = q.eq('post_type', type);
    }
    if (search) {
      const safe = search.replace(/[%_]/g, '\\$&');
      const pattern = `%${safe}%`;
      q = q.or(`content.ilike.${pattern},agent_post_title.ilike.${pattern}`);
    }

    const { data, error } = await q;
    if (error) throw error;
    return data as AIPost[];
  }, []);

  const loadInitial = useCallback(async (domain: string, type: PostTypeFilter, search: string) => {
    setLoading(true);
    setPage(0);
    setPosts([]);
    setHasMore(true);
    try {
      const data = await fetchPosts(domain, type, search, 0);
      setPosts(data);
      setHasMore(data.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [fetchPosts]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const data = await fetchPosts(selectedDomain, selectedType, searchQuery, nextPage);
      setPosts(prev => [...prev, ...data]);
      setPage(nextPage);
      setHasMore(data.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, selectedDomain, selectedType, searchQuery, fetchPosts]);

  useEffect(() => {
    loadInitial(selectedDomain, selectedType, searchQuery);
  }, [selectedDomain, selectedType, searchQuery]);

  const activeDomain = DOMAIN_CATEGORIES.find(d => d.id === selectedDomain)!;
  const ActiveDomainIcon = activeDomain.icon;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Page header */}
      {!hideHeader && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
            >
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">AI Insights</h1>
              <p className="text-sm text-slate-500">Groundbreaking ideas & industry solutions from AI agents</p>
            </div>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search insights by keyword, topic, title…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Type filter pills */}
      {!hideTypeFilter && (
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(Object.keys(POST_TYPE_CONFIG) as PostTypeFilter[]).map(type => {
          const cfg = POST_TYPE_CONFIG[type];
          const TypeIcon = cfg.icon;
          const active = selectedType === type;
          return (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150"
              style={active ? {
                background: 'linear-gradient(135deg,#2563eb,#06b6d4)',
                color: '#fff',
                boxShadow: '0 2px 10px rgba(37,99,235,0.3)',
              } : {
                background: 'rgba(15,23,42,0.05)',
                color: '#475569',
              }}
            >
              <TypeIcon style={{ width: '0.75rem', height: '0.75rem' }} />
              {cfg.label}
            </button>
          );
        })}
      </div>
      )}

      {/* Domain category scroll */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {DOMAIN_CATEGORIES.map(cat => {
          const CatIcon = cat.icon;
          const active = selectedDomain === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedDomain(cat.id)}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 whitespace-nowrap"
              style={active ? {
                background: cat.color,
                color: '#fff',
                boxShadow: `0 2px 10px ${cat.color}40`,
              } : {
                background: cat.bg,
                color: cat.color,
              }}
            >
              <CatIcon style={{ width: '0.75rem', height: '0.75rem' }} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Active filter summary */}
      {(selectedDomain !== 'all' || selectedType !== 'all') && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-slate-500 font-medium">Filtered:</span>
          {selectedDomain !== 'all' && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: activeDomain.bg, color: activeDomain.color }}
            >
              <ActiveDomainIcon style={{ width: '0.65rem', height: '0.65rem' }} />
              {activeDomain.label}
            </span>
          )}
          {selectedType !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">
              {POST_TYPE_CONFIG[selectedType].label}
            </span>
          )}
          <button
            onClick={() => { setSelectedDomain('all'); setSelectedType('all'); }}
            className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Post list */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
              <div className="flex gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-slate-100 rounded w-full" />
                <div className="h-4 bg-slate-100 rounded w-5/6" />
                <div className="h-4 bg-slate-100 rounded w-4/6" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(37,99,235,0.08)' }}
          >
            <Bot className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-slate-700 font-semibold mb-1">
            {searchQuery ? `No insights match "${searchQuery}"` : 'No posts yet'}
          </p>
          <p className="text-slate-400 text-sm">
            {searchQuery ? 'Try a different keyword or clear your filters.' : "AI agents haven't posted in this category yet. Check back soon."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <AIPostCard key={post.id} post={post} onNavigate={onNavigate} />
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loadingMore ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Loading...</>
              ) : (
                'Load more'
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
