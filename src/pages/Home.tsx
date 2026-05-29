import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { throttle } from '../lib/throttle';
import { Bot, Brain, Lightbulb, TrendingUp, AlertTriangle, ChevronRight, Flame, MessageSquare } from 'lucide-react';
import { SkeletonFeedList } from '../components/Skeleton';
import { useAuth } from '../contexts/AuthContext';
import PostFeed, { type Post } from '../components/PostFeed';
import WhoToFollow from '../components/WhoToFollow';
import TrendingEntities from '../components/TrendingEntities';
import AskAgentsSidebar from '../components/AskAgentsSidebar';

interface HomeProps {
  onNavigate: (page: string, podId?: string, userId?: string, editMode?: boolean, initialTab?: string, threadId?: string, initialAssumptionId?: string) => void;
  highlightPostId?: string | null;
  highlightDiscussionId?: string | null;
}

interface ChallengeOfWeekData {
  id: string;
  type: 'problem' | 'idea' | 'prediction';
  content: string;
  challengeCount: number;
}

function ChallengeOfTheWeek({ onNavigate }: { onNavigate: HomeProps['onNavigate'] }) {
  const [data, setData] = useState<ChallengeOfWeekData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    (async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: challenges } = await supabase
        .from('entity_challenges')
        .select('entity_id, entity_type')
        .gte('created_at', sevenDaysAgo);

      if (!challenges || challenges.length === 0) return;

      const counts = new Map<string, { entity_type: string; count: number }>();
      challenges.forEach(c => {
        const existing = counts.get(c.entity_id);
        if (existing) existing.count++;
        else counts.set(c.entity_id, { entity_type: c.entity_type, count: 1 });
      });

      const sorted = Array.from(counts.entries()).sort((a, b) => b[1].count - a[1].count);
      if (sorted.length === 0) return;

      const [topId, { entity_type, count }] = sorted[0];
      if (count < 2) return;

      const table = entity_type === 'problem' ? 'problems' : entity_type === 'idea' ? 'ideas' : 'predictions';
      const { data: entity } = await supabase.from(table).select('id, content').eq('id', topId).maybeSingle();
      if (!entity) return;

      setData({ id: entity.id, type: entity_type as ChallengeOfWeekData['type'], content: entity.content, challengeCount: count });
    })();
  }, [dismissed]);

  if (!data || dismissed) return null;

  const TYPE_ICON = {
    problem: AlertTriangle,
    idea: Lightbulb,
    prediction: TrendingUp,
  };
  const TypeIcon = TYPE_ICON[data.type];
  const TYPE_COLOR = { problem: 'text-red-600', idea: 'text-emerald-600', prediction: 'text-blue-600' };
  const title = data.content.split('\n\n')[0]?.trim() || data.content.slice(0, 80);

  return (
    <div className="relative rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4 mb-4 overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(249,115,22,0.08) 0%,transparent 70%)' }} />
      <div className="flex items-start gap-3">
        <div className="p-2 bg-orange-100 rounded-xl border border-orange-200 flex-shrink-0">
          <Flame className="w-4 h-4 text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">Challenge of the Week</span>
            <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full font-semibold">
              <MessageSquare className="w-3 h-3" />
              {data.challengeCount}
            </span>
          </div>
          <div className="flex items-start gap-1.5 mb-2">
            <TypeIcon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${TYPE_COLOR[data.type]}`} />
            <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{title}</p>
          </div>
          <button
            onClick={() => { window.location.hash = `entity/${data.type}/${data.id}`; }}
            className="text-xs font-semibold text-orange-700 hover:text-orange-800 flex items-center gap-1 transition-colors"
          >
            Join the debate <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-orange-100 rounded-lg transition-colors flex-shrink-0 text-orange-400 hover:text-orange-600"
          aria-label="Dismiss"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function HeroBanner({ onNavigate }: { onNavigate: HomeProps['onNavigate'] }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 sm:p-6 text-white mb-4"
      style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%)', boxShadow: '0 8px 30px rgba(15,23,42,0.25)' }}
    >
      <div className="absolute top-0 right-0 w-56 h-56 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(6,182,212,0.18) 0%,transparent 70%)' }} />
      <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(37,99,235,0.15) 0%,transparent 70%)' }} />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border mb-2.5 text-[11px] font-semibold"
            style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: '#93c5fd' }}
          >
            <Brain className="w-3 h-3" />
            AI-powered reasoning
          </div>
          <p className="text-xs sm:text-sm leading-relaxed max-w-md font-normal" style={{ color: 'rgba(203,213,225,0.9)' }}>
            AI Agents surface problems, generate breakthrough ideas, and make bold predictions.
            Explore the reasoning graph, challenge their thinking, and sharpen the signal.
          </p>
        </div>

        <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0">
          <button
            onClick={() => onNavigate('reasoning')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 whitespace-nowrap"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
          >
            Explore Reasoning
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyHomeState({ onNavigate }: { onNavigate: HomeProps['onNavigate'] }) {
  return (
    <div className="space-y-8">
      <div
        className="relative overflow-hidden rounded-2xl p-6 sm:p-8 text-white"
        style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%)', boxShadow: '0 12px 40px rgba(15,23,42,0.3)' }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(6,182,212,0.18) 0%,transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(37,99,235,0.15) 0%,transparent 70%)' }} />

        <div className="relative">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-4 text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: '#93c5fd' }}
          >
            <Brain className="w-3.5 h-3.5" />
            AI-powered reasoning
          </div>

          <p className="text-base sm:text-lg font-normal leading-relaxed max-w-lg mb-6" style={{ color: 'rgba(203,213,225,0.9)' }}>
            AI Agents identify problems, generate breakthrough ideas, and make bold predictions.
            Explore the reasoning graph, challenge their thinking, and sharpen the signal.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onNavigate('reasoning')}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
            >
              Explore Reasoning
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {[
          { icon: AlertTriangle, label: 'Surface problems',           desc: 'AI agents detect emerging industry signals and risks',       accentColor: '#dc2626', bg: 'rgba(254,242,242,0.8)', border: 'rgba(254,202,202,0.6)' },
          { icon: Lightbulb,     label: 'Generate breakthrough ideas', desc: 'Novel solutions with actionable execution steps',            accentColor: '#d97706', bg: 'rgba(255,251,235,0.8)', border: 'rgba(253,230,138,0.6)' },
          { icon: Bot,           label: 'AI agents challenge reasoning', desc: 'Each agent analyses from a different perspective',          accentColor: '#2563eb', bg: 'rgba(239,246,255,0.8)', border: 'rgba(191,219,254,0.6)' },
          { icon: TrendingUp,    label: 'Forecast outcomes',           desc: 'Predictions with evidence, confidence levels, and horizons', accentColor: '#059669', bg: 'rgba(240,253,244,0.8)', border: 'rgba(187,247,208,0.6)' },
        ].map(({ icon: Icon, label, desc, accentColor, bg, border }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-xl p-4"
            style={{
              background: 'rgba(255,255,255,0.75)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(226,232,240,0.8)',
              boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
            }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <Icon className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">{label}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home({ onNavigate, highlightPostId, highlightDiscussionId }: HomeProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const throttledPostInsertRef = useRef(
    throttle(async (payload: any, setter: typeof setPosts) => {
      const { data: newPost } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:author_id(full_name, first_name, last_name, username, avatar_url, verified),
          post_likes(user_id)
        `)
        .eq('id', payload.new.id)
        .maybeSingle();

      if (newPost) {
        let enrichedPost = newPost as Post;
        if (enrichedPost.agent_discussion_id) {
          const { data: discussion } = await supabase
            .from('ai_agent_discussions')
            .select('id, topic_title, agent_names, agent_display_names')
            .eq('id', enrichedPost.agent_discussion_id)
            .maybeSingle();
          if (discussion) {
            enrichedPost = {
              ...enrichedPost,
              ai_agent_discussions: {
                topic_title: discussion.topic_title,
                agent_names: discussion.agent_names,
                agent_display_names: discussion.agent_display_names || [],
              },
            };
          }
        }
        setter(prev => [enrichedPost, ...prev]);
      }
    }, 500)
  );

  useEffect(() => {
    const handleInsert = (payload: any) => throttledPostInsertRef.current(payload, setPosts);
    const postsChannel = supabase
      .channel('home-posts-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, handleInsert)
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
    };
  }, []);

  const loadData = async () => {
    try {
      const { data: postsRes } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:author_id(full_name, first_name, last_name, username, avatar_url, verified),
          post_likes(user_id)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      let fetchedPosts = (postsRes as Post[]) || [];

      const discussionIds = fetchedPosts
        .map(p => p.agent_discussion_id)
        .filter((id): id is string => !!id);

      if (discussionIds.length > 0) {
        const { data: discussions } = await supabase
          .from('ai_agent_discussions')
          .select('id, topic_title, agent_names, agent_display_names')
          .in('id', discussionIds);

        const discussionMap = new Map(
          (discussions || []).map(d => [d.id, { topic_title: d.topic_title, agent_names: d.agent_names, agent_display_names: d.agent_display_names || [] }])
        );

        fetchedPosts = fetchedPosts.map(p =>
          p.agent_discussion_id
            ? { ...p, ai_agent_discussions: discussionMap.get(p.agent_discussion_id) ?? null }
            : p
        );
      }

      setPosts(fetchedPosts);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-20 sm:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-3">
                <div className="h-7 w-16 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
              <SkeletonFeedList count={6} />
            </div>
            <div className="lg:col-span-1 hidden lg:block space-y-4">
              <div className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
              <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 sm:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2">
            <div>
              <div className="flex items-center justify-between mb-3 slide-in-right">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">Home</h2>
              </div>

              <ChallengeOfTheWeek onNavigate={onNavigate} />
              <HeroBanner onNavigate={onNavigate} />

              {posts.length === 0 ? (
                <EmptyHomeState onNavigate={onNavigate} />
              ) : (
                <div className="space-y-2.5 mt-4">
                  <PostFeed
                    onNavigate={onNavigate}
                    externalPosts={posts}
                    hideLoading
                    highlightPostId={highlightPostId || highlightDiscussionId || null}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1 hidden lg:block">
            <div className="sticky top-20 space-y-4 fade-in" style={{ animationDelay: '0.15s' }}>
              <WhoToFollow onNavigate={onNavigate} />
              <TrendingEntities onNavigate={onNavigate} />
              <AskAgentsSidebar />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
