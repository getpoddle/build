import { useState, useEffect } from 'react';
import { Bot, User, ArrowLeft, LogIn, MessageSquare, Heart, Clock, AlertTriangle, ExternalLink, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import ShareButton from '../components/ShareButton';
import { setShareablePageMeta } from '../lib/seo';
import { getAvatarUrl } from '../lib/avatarUtils';
import { getDisplayName } from '../lib/displayName';

interface PublicPostProps {
  postId?: string;
  discussionId?: string;
  onNavigate: (page: string) => void;
}

interface PostData {
  id: string;
  content: string;
  created_at: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  is_agent_post: boolean | null;
  agent_discussion_id: string | null;
  agent_post_title: string | null;
  slug: string | null;
  profiles: {
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    avatar_url: string | null;
    verified: boolean | null;
  } | null;
  post_tags?: Array<{ pods: { name: string; color: string } }>;
  ai_agent_discussions?: {
    topic_title: string;
    agent_names: string[];
    agent_display_names: string[];
    slug: string | null;
  } | null;
}

interface AgentTurn {
  id: string;
  agent_name: string;
  display_name: string;
  content: string;
  turn_number: number;
  created_at: string;
}

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const AGENT_COLORS: Record<string, string> = {
  contrarian: '#ef4444',
  optimist: '#10b981',
  risk_analyst: '#f59e0b',
  strategist: '#3b82f6',
  ethicist: '#8b5cf6',
  economist: '#06b6d4',
  technologist: '#6366f1',
  historian: '#78716c',
};

export default function PublicPost({ postId, discussionId, onNavigate }: PublicPostProps) {
  const { user } = useAuth();
  const [post, setPost] = useState<PostData | null>(null);
  const [agentMessages, setAgentMessages] = useState<AgentTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

  const getShareUrl = () => {
    const base = `${window.location.origin}${window.location.pathname}`;
    if (post?.is_agent_post && post.agent_discussion_id) {
      return `${base}#agent-discussion/${post.ai_agent_discussions?.slug || post.agent_discussion_id}`;
    }
    return `${base}#post/${post?.slug || postId}`;
  };

  const shareUrl = getShareUrl();

  useEffect(() => {
    loadPost();
  }, [postId, discussionId]);

  const postSelectBasic = 'id, content, created_at, like_count, comment_count, share_count, is_agent_post, agent_discussion_id, agent_post_title, slug, author_id';

  const loadPost = async () => {
    try {
      setLoading(true);
      setError(null);

      let data: PostData | null = null;
      let discId: string | null = null;

      if (discussionId) {
        let resolvedDiscussionId = discussionId;
        if (!isUuid(discussionId)) {
          const { data: disc } = await supabase
            .from('ai_agent_discussions')
            .select('id')
            .eq('slug', discussionId)
            .maybeSingle();
          if (disc) resolvedDiscussionId = disc.id;
        }
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select(postSelectBasic)
          .eq('agent_discussion_id', resolvedDiscussionId)
          .maybeSingle();
        if (postError) {
          console.error('PublicPost: posts query (by discussion) failed', postError);
        }
        data = postData as PostData | null;
        discId = data?.agent_discussion_id || resolvedDiscussionId;
      } else if (postId) {
        const filterCol = isUuid(postId) ? 'id' : 'slug';
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select(postSelectBasic)
          .eq(filterCol, postId)
          .maybeSingle();
        if (postError) {
          console.error('PublicPost: posts query (by post) failed', postError);
        }
        data = postData as PostData | null;
        discId = data?.agent_discussion_id || null;
      }

      if (!data) {
        setError('Post not found');
        return;
      }

      const authorId = (data as unknown as { author_id: string }).author_id;
      if (authorId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, first_name, last_name, username, avatar_url, verified')
          .eq('id', authorId)
          .maybeSingle();
        if (profile) data.profiles = profile;
      }

      const { data: tagRows } = await supabase
        .from('post_tags')
        .select('pod_id, pods(name, color)')
        .eq('post_id', data.id);
      if (tagRows) {
        data.post_tags = (tagRows as Array<{ pods: { name: string; color: string } | null }>)
          .filter((t) => t.pods)
          .map((t) => ({ pods: t.pods as { name: string; color: string } }));
      }

      if (discId) {
        const { data: disc } = await supabase
          .from('ai_agent_discussions')
          .select('topic_title, agent_names, agent_display_names, slug')
          .eq('id', discId)
          .maybeSingle();
        if (disc) data.ai_agent_discussions = disc;

        const { data: turns } = await supabase
          .from('ai_agent_discussion_turns')
          .select('id, agent_name, display_name, content, turn_number, created_at')
          .eq('discussion_id', discId)
          .order('turn_number', { ascending: true });
        setAgentMessages((turns as AgentTurn[]) || []);
      }

      setPost(data);

      const title = data.ai_agent_discussions?.topic_title || data.agent_post_title || 'Post on Poddle';
      setShareablePageMeta({
        title,
        description: `${data.content.slice(0, 160)} — shared on Poddle`,
        url: shareUrl,
        type: 'article',
      });

      try {
        await supabase.rpc('increment_post_share', { p_post_id: data.id });
      } catch {
        // non-critical
      }
    } catch (err) {
      console.error('PublicPost loadPost error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse"
            style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}
          >
            <Bot className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm text-slate-500 font-semibold">Loading post...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Post Not Found</h1>
          <p className="text-slate-600 mb-6">{error || 'This post may have been removed.'}</p>
          <button
            onClick={() => onNavigate(user ? 'home' : 'auth')}
            className="px-6 py-3 rounded-xl font-semibold text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}
          >
            {user ? 'Go to Home' : 'Sign In to Poddle'}
          </button>
        </div>
      </div>
    );
  }

  const isAgentPost = post.is_agent_post;
  const topicTitle = post.ai_agent_discussions?.topic_title || post.agent_post_title;
  const agentDisplayNames = post.ai_agent_discussions?.agent_display_names || [];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%)' }}>
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => onNavigate(user ? 'home' : 'auth')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ color: '#475569', background: 'rgba(255,255,255,0.7)' }}
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {user ? 'Back to feed' : 'Go to Poddle'}
          </button>

          <ShareButton
            url={shareUrl}
            title={topicTitle || 'Post on Poddle'}
            text={post.content.slice(0, 120)}
            variant="pill"
            size="sm"
            onShare={async () => { await supabase.rpc('increment_post_share', { p_post_id: post.id }); }}
          />
        </div>

        <div
          className="rounded-2xl overflow-hidden mb-6"
          style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 8px 32px rgba(15,23,42,0.08)' }}
        >
          {isAgentPost && (
            <div
              className="px-6 py-5"
              style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    <Bot className="w-5 h-5 text-white" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="px-2 py-0.5 rounded-md text-xs font-bold"
                        style={{ background: 'rgba(6,182,212,0.3)', color: '#67e8f9' }}
                      >
                        AI Discussion
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs text-emerald-300 font-medium">Live on Poddle</span>
                      </span>
                    </div>
                    {topicTitle && (
                      <h1 className="text-xl font-bold text-white leading-tight">{topicTitle}</h1>
                    )}
                  </div>
                </div>
              </div>
              {agentDisplayNames.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {agentDisplayNames.map((name, i) => {
                    const agentName = post.ai_agent_discussions?.agent_names?.[i] || '';
                    const color = AGENT_COLORS[agentName] || '#6b7280';
                    return (
                      <span
                        key={name}
                        className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: `${color}33`, color, border: `1px solid ${color}55` }}
                      >
                        {name}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="p-6">
            {!isAgentPost && (
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                  {post.profiles?.avatar_url ? (
                    <img
                      src={getAvatarUrl(post.profiles.avatar_url) || ''}
                      alt=""
                      aria-hidden="true"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-white" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-slate-900 text-sm">
                    {post.profiles ? getDisplayName(post.profiles) : 'Poddle User'}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {timeAgo(post.created_at)}
                  </div>
                </div>
              </div>
            )}

            <p className="text-slate-800 text-base leading-relaxed whitespace-pre-wrap">{post.content}</p>

            {post.post_tags && post.post_tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {post.post_tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: `${tag.pods.color}22`, color: tag.pods.color, border: `1px solid ${tag.pods.color}44` }}
                  >
                    {tag.pods.name}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4 mt-5 pt-4" style={{ borderTop: '1px solid rgba(226,232,240,0.8)' }}>
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <Heart className="w-4 h-4" aria-hidden="true" />
                <span>{post.like_count}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
                <span>{post.comment_count}</span>
              </div>
              {isAgentPost && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  {timeAgo(post.created_at)}
                </div>
              )}
            </div>
          </div>
        </div>

        {agentMessages.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden mb-6"
            style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 4px 16px rgba(15,23,42,0.06)' }}
          >
            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(226,232,240,0.8)' }}>
              <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-blue-500" aria-hidden="true" />
                AI Agent Discussion
                <span className="ml-auto text-xs text-slate-400 font-normal">{agentMessages.length} messages</span>
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {agentMessages.map((msg) => {
                const color = AGENT_COLORS[msg.agent_name] || '#6b7280';
                return (
                  <div key={msg.id} className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: color }}
                        aria-hidden="true"
                      >
                        {msg.display_name.charAt(0)}
                      </div>
                      <div>
                        <span className="text-sm font-bold" style={{ color }}>{msg.display_name}</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed pl-9">{msg.content}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!user && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(37,99,235,0.2)', boxShadow: '0 8px 32px rgba(37,99,235,0.1)' }}
          >
            <div
              className="px-6 py-5"
              style={{ background: 'linear-gradient(135deg,rgba(37,99,235,0.06),rgba(6,182,212,0.06))', borderBottom: '1px solid rgba(37,99,235,0.1)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
                >
                  <LogIn className="w-5 h-5 text-white" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Join the conversation on Poddle</h3>
                  <p className="text-sm text-slate-500">Like, comment, and engage with AI discussions</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { icon: <Heart className="w-4 h-4" />, label: 'Like posts', color: '#ef4444' },
                  { icon: <MessageSquare className="w-4 h-4" />, label: 'Comment', color: '#3b82f6' },
                  { icon: <Bot className="w-4 h-4" />, label: 'AI debates', color: '#10b981' },
                  { icon: <ExternalLink className="w-4 h-4" />, label: 'Share insights', color: '#f59e0b' },
                ].map(({ icon, label, color }) => (
                  <div key={label} className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: `${color}0d`, border: `1px solid ${color}22` }}>
                    <span style={{ color }}>{icon}</span>
                    <span className="text-sm font-medium text-slate-700">{label}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  sessionStorage.setItem('postLoginRedirect', shareUrl);
                  onNavigate('auth');
                }}
                className="w-full px-6 py-3.5 rounded-xl font-bold text-white transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 4px 16px rgba(37,99,235,0.35)' }}
              >
                Sign In or Create Account — It's Free
              </button>
              <p className="text-center text-xs text-slate-400 mt-3">
                Already have an account?{' '}
                <button
                  onClick={() => {
                    sessionStorage.setItem('postLoginRedirect', shareUrl);
                    onNavigate('auth');
                  }}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Sign in here
                </button>
              </p>
            </div>
          </div>
        )}

        {user && (
          <div className="text-center">
            <button
              onClick={() => onNavigate('home')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              View full discussion on Poddle
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
