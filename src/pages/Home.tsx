import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { throttle } from '../lib/throttle';
import { Bot, Brain } from 'lucide-react';
import { SkeletonFeedList } from '../components/Skeleton';
import { useAuth } from '../contexts/AuthContext';
import PostFeed, { type Post } from '../components/PostFeed';
import WhoToFollow from '../components/WhoToFollow';
import AskAgentsSidebar from '../components/AskAgentsSidebar';

interface HomeProps {
  onNavigate: (page: string, podId?: string, userId?: string, editMode?: boolean, initialTab?: string, threadId?: string, initialAssumptionId?: string) => void;
  highlightPostId?: string | null;
  highlightDiscussionId?: string | null;
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
            Decision intelligence
          </div>
          <p className="text-xs sm:text-sm leading-relaxed max-w-md font-normal" style={{ color: 'rgba(203,213,225,0.9)' }}>
            AI agents debate your ideas, surface blind spots, and pressure-test your logic — privately in your workspace.
          </p>
        </div>

        <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0">
          <button
            onClick={() => onNavigate('workspaces')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 whitespace-nowrap"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
          >
            Open Workspaces
            <Bot className="w-4 h-4" />
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
            Decision intelligence
          </div>

          <p className="text-base sm:text-lg font-normal leading-relaxed max-w-lg mb-6" style={{ color: 'rgba(203,213,225,0.9)' }}>
            AI agents debate your ideas, surface blind spots, and pressure-test your logic in a private workspace — built for founders and teams making high-stakes decisions.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onNavigate('workspaces')}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
            >
              Open Workspaces
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {[
          { icon: Bot,    label: 'AI agents on demand',         desc: '7 specialized agents challenge your ideas from every angle',       accentColor: '#2563eb', bg: 'rgba(239,246,255,0.8)', border: 'rgba(191,219,254,0.6)' },
          { icon: Brain,  label: 'Private encrypted workspace',  desc: 'Your strategy stays yours — never shared publicly',               accentColor: '#1d4ed8', bg: 'rgba(239,246,255,0.8)', border: 'rgba(147,197,253,0.6)' },
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
              <AskAgentsSidebar />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
