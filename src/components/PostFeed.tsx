import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { throttle } from '../lib/throttle';
import { useAuth } from '../contexts/AuthContext';
import {
  Heart,
  MessageSquare,
  User,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  FileText,
  Send,
  Loader,
  Pencil,
  Trash2,
  Check,
  X,
  Bot,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getFileUrl, getFileIcon, formatFileSize } from '../lib/fileUpload';
import { getAvatarUrl } from '../lib/avatarUtils';
import { Database } from '../lib/database.types';
import VerificationBadge from './VerificationBadge';
import { detectAndRenderLinks } from '../lib/linkDetection';
import { getDisplayName } from '../lib/displayName';
import PostAIInsight from './PostAIInsight';
import AgentDiscussionViewer from './AgentDiscussionViewer';
import AgentDiscussionContribute from './AgentDiscussionContribute';
import ShareButton from './ShareButton';
import ShareableInsightCard from './ShareableInsightCard';

type Post = Database['public']['Tables']['posts']['Row'] & {
  is_agent_post?: boolean;
  agent_discussion_id?: string | null;
  agent_post_title?: string | null;
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
    slug?: string;
  } | null;
};

type AIReply = {
  id: string;
  comment_id: string;
  agent_name: string;
  display_name: string;
  agent_role: string;
  content: string;
  created_at: string;
};

type Comment = Database['public']['Tables']['post_comments']['Row'] & {
  profiles: {
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    avatar_url: string | null;
    verified: boolean | null;
  };
  aiReply?: AIReply | null;
};

export type { Post };

interface PostFeedProps {
  onNavigate: (page: string, podId?: string, userId?: string) => void;
  userId?: string;
  externalPosts?: Post[];
  hideLoading?: boolean;
  highlightPostId?: string | null;
}

export default function PostFeed({ onNavigate, userId: filterUserId, externalPosts, hideLoading, highlightPostId }: PostFeedProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(!externalPosts);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [commenting, setCommenting] = useState<Record<string, boolean>>({});
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [deletingComment, setDeletingComment] = useState<string | null>(null);
  const [expandedAgentPosts, setExpandedAgentPosts] = useState<Set<string>>(new Set());
  const [shareCardPost, setShareCardPost] = useState<Post | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (highlightPostId && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [highlightPostId, posts]);

  const AGENT_POST_PREVIEW_LENGTH = 180;

  const toggleAgentPostExpand = (postId: string) => {
    setExpandedAgentPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  useEffect(() => {
    if (externalPosts !== undefined) {
      setPosts(externalPosts);
      setLoading(false);
      return;
    }
  }, [externalPosts]);

  useEffect(() => {
    if (externalPosts !== undefined) return;

    loadPosts();

    const handlePostInsert = throttle(async (payload: any) => {
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
        if (filterUserId) {
          if (newPost.author_id === filterUserId) {
            setPosts((prev) => [newPost as Post, ...prev]);
          }
        } else {
          setPosts((prev) => [newPost as Post, ...prev]);
        }
      }
    }, 500);

    const handlePostUpdate = throttle(async (payload: any) => {
      const { data: updatedPost } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:author_id(full_name, first_name, last_name, username, avatar_url, verified),
          post_likes(user_id)
        `)
        .eq('id', payload.new.id)
        .maybeSingle();

      if (updatedPost) {
        setPosts((prev) =>
          prev.map((post) => post.id === updatedPost.id ? (updatedPost as Post) : post)
        );
      }
    }, 500);

    const handleLikeChange = throttle(async (payload: any) => {
      const postId = payload.new?.post_id || payload.old?.post_id;
      if (!postId) return;
      const { data: updatedPost } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:author_id(full_name, first_name, last_name, username, avatar_url, verified),
          post_likes(user_id)
        `)
        .eq('id', postId)
        .maybeSingle();

      if (updatedPost) {
        setPosts((prev) =>
          prev.map((post) => post.id === postId ? (updatedPost as Post) : post)
        );
      }
    }, 300);

    const handleCommentInsert = throttle(async (payload: any) => {
      const { data: newComment } = await supabase
        .from('post_comments')
        .select('*, profiles:author_id(full_name, first_name, last_name, username, avatar_url, verified)')
        .eq('id', payload.new.id)
        .maybeSingle();

      if (newComment) {
        const postId = payload.new.post_id;
        setComments((prev) => {
          if (!prev[postId]) return prev;
          const existing = prev[postId] || [];
          if (existing.some(c => c.id === (newComment as Comment).id)) return prev;
          return { ...prev, [postId]: [...existing, newComment as Comment] };
        });

        const { data: updatedPost } = await supabase
          .from('posts')
          .select(`
            *,
            profiles:author_id(full_name, first_name, last_name, username, avatar_url, verified),
            post_likes(user_id)
          `)
          .eq('id', postId)
          .maybeSingle();

        if (updatedPost) {
          setPosts((prev) =>
            prev.map((post) => post.id === postId ? (updatedPost as Post) : post)
          );
        }
      }
    }, 500);

    const postsChannel = supabase
      .channel('posts-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, handlePostInsert)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, handlePostUpdate)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload) => { setPosts((prev) => prev.filter((post) => post.id !== payload.old.id)); }
      )
      .subscribe();

    const likesChannel = supabase
      .channel('post-likes-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, handleLikeChange)
      .subscribe();

    const commentsChannel = supabase
      .channel('post-comments-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' }, handleCommentInsert)
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [user, filterUserId]);

  const loadPosts = async () => {
    try {
      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles:author_id(full_name, first_name, last_name, username, avatar_url, verified),
          post_likes(user_id)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filterUserId) {
        query = query.eq('author_id', filterUserId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('PostFeed error loading posts:', error);
        throw error;
      }

      const posts = (data as Post[]) || [];

      const discussionIds = posts
        .map(p => p.agent_discussion_id)
        .filter((id): id is string => !!id);

      if (discussionIds.length > 0) {
        const { data: discussions } = await supabase
          .from('ai_agent_discussions')
          .select('id, topic_title, agent_names, agent_display_names, slug')
          .in('id', discussionIds);

        const discussionMap = new Map(
          (discussions || []).map(d => [d.id, { topic_title: d.topic_title, agent_names: d.agent_names, agent_display_names: d.agent_display_names || [], slug: d.slug }])
        );

        const postsWithDiscussions = posts.map(p =>
          p.agent_discussion_id
            ? { ...p, ai_agent_discussions: discussionMap.get(p.agent_discussion_id) ?? null }
            : p
        );

        setPosts(postsWithDiscussions);
      } else {
        setPosts(posts);
      }
    } catch (error: any) {
      console.error('Exception loading posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select('*, profiles:author_id(full_name, first_name, last_name, username, avatar_url, verified)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const rawComments = (data as Comment[]) || [];

      const post = posts.find(p => p.id === postId);
      if (post?.is_agent_post && rawComments.length > 0) {
        const commentIds = rawComments.map(c => c.id);
        const { data: aiReplies } = await supabase
          .from('post_comment_ai_replies')
          .select('*')
          .in('comment_id', commentIds);

        const replyMap = new Map((aiReplies || []).map((r: AIReply) => [r.comment_id, r]));
        const withReplies = rawComments.map(c => ({ ...c, aiReply: replyMap.get(c.id) ?? null }));
        setComments(prev => ({ ...prev, [postId]: withReplies }));
      } else {
        setComments(prev => ({ ...prev, [postId]: rawComments }));
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!user) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const hasLiked = post.post_likes.some(like => like.user_id === user.id);

    try {
      if (hasLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id });
      }

      await loadPosts();
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const addComment = async (postId: string) => {
    if (!user || !newComment[postId]?.trim()) return;

    setCommenting(prev => ({ ...prev, [postId]: true }));

    try {
      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          content: newComment[postId].trim(),
        });

      if (error) throw error;

      setNewComment(prev => ({ ...prev, [postId]: '' }));
      await loadComments(postId);
      await loadPosts();
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setCommenting(prev => ({ ...prev, [postId]: false }));
    }
  };

  const startEditComment = (comment: Comment) => {
    setEditingComment(comment.id);
    setEditCommentText(comment.content);
  };

  const saveEditComment = async (postId: string, commentId: string) => {
    if (!editCommentText.trim()) return;
    setSavingComment(true);
    try {
      const { error } = await supabase
        .from('post_comments')
        .update({ content: editCommentText.trim() })
        .eq('id', commentId)
        .eq('author_id', user!.id);
      if (error) throw error;
      setEditingComment(null);
      await loadComments(postId);
    } catch (error) {
      console.error('Error editing comment:', error);
    } finally {
      setSavingComment(false);
    }
  };

  const deleteComment = async (postId: string, commentId: string) => {
    setDeletingComment(commentId);
    try {
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId)
        .eq('author_id', user!.id);
      if (error) throw error;
      await loadComments(postId);
      await loadPosts();
    } catch (error) {
      console.error('Error deleting comment:', error);
    } finally {
      setDeletingComment(null);
    }
  };

  const toggleComments = (postId: string) => {
    if (expandedPost === postId) {
      setExpandedPost(null);
    } else {
      setExpandedPost(postId);
      if (!comments[postId]) {
        loadComments(postId);
      }
    }
  };

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
  };


  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader className="w-8 h-8 text-blue-600 mx-auto mb-3 animate-spin" />
        <p className="text-slate-500">Loading posts...</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {shareCardPost && (
        <ShareableInsightCard
          type={shareCardPost.is_agent_post ? 'agent-discussion' : 'post'}
          title={shareCardPost.is_agent_post && shareCardPost.ai_agent_discussions
            ? shareCardPost.ai_agent_discussions.topic_title
            : (shareCardPost.profiles ? getDisplayName(shareCardPost.profiles) : 'Post') + ' on Poddle'}
          content={shareCardPost.content}
          authorName={shareCardPost.profiles ? getDisplayName(shareCardPost.profiles) : undefined}
          agentNames={shareCardPost.is_agent_post
            ? (shareCardPost.ai_agent_discussions?.agent_display_names || shareCardPost.ai_agent_discussions?.agent_names)
            : undefined}
          shareUrl={shareCardPost.is_agent_post && shareCardPost.agent_discussion_id
            ? `${window.location.origin}${window.location.pathname}#agent-discussion/${shareCardPost.ai_agent_discussions?.slug || shareCardPost.agent_discussion_id}`
            : `${window.location.origin}${window.location.pathname}#post/${(shareCardPost as any).slug || shareCardPost.id}`}
          onClose={() => setShareCardPost(null)}
        />
      )}
      {posts.map(post => {
        const hasLiked = post.post_likes.some(like => like.user_id === user?.id);
        const isExpanded = expandedPost === post.id;

        const isHighlighted = highlightPostId === post.id ||
          (post.is_agent_post && post.agent_discussion_id && highlightPostId === post.agent_discussion_id);

        return (
          <div
            key={post.id}
            ref={isHighlighted ? highlightRef : null}
            className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all ${isHighlighted ? 'ring-2 ring-blue-400 ring-offset-2 shadow-blue-100' : 'border-slate-200'}`}
          >
            {post.is_agent_post && post.agent_post_title && (
              <div className="px-3 sm:px-4 pt-3 pb-0 flex items-center gap-1.5">
                <span className="text-xs text-slate-400 truncate">{post.agent_post_title}</span>
              </div>
            )}
            <div className="p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3 mb-3">
                {post.is_agent_post ? (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-500 text-white font-bold text-sm sm:text-base select-none">
                    {(post.ai_agent_discussions?.agent_display_names?.[0] || post.ai_agent_discussions?.agent_names?.[0] || 'A').charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <button
                    onClick={() => onNavigate('profile', undefined, post.author_id)}
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0 hover:ring-2 hover:ring-blue-500 transition-all overflow-hidden"
                  >
                    {post.profiles?.avatar_url ? (
                      <img
                        src={getAvatarUrl(post.profiles.avatar_url) || ''}
                        alt={post.profiles.full_name || 'User'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-white" />
                    )}
                  </button>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5">
                    {post.is_agent_post ? (
                      <>
                        {(() => {
                          const names = (post.ai_agent_discussions?.agent_display_names?.length
                            ? post.ai_agent_discussions.agent_display_names
                            : post.ai_agent_discussions?.agent_names || []
                          );
                          const shown = names.slice(0, 2);
                          const rest = names.length - shown.length;
                          const label = shown.join(' & ') + (rest > 0 ? ` & ${rest} others` : '');
                          return (
                            <>
                              <span className="font-semibold text-sm text-slate-900">{label}</span>
                              <span className="text-slate-500 text-xs">are discussing</span>
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => onNavigate('profile', undefined, post.author_id)}
                          className="font-semibold text-sm text-slate-900 hover:text-blue-600 transition-colors"
                        >
                          {getDisplayName(post.profiles)}
                        </button>
                        {post.profiles?.username && (
                          <span className="text-slate-500 text-xs">@{post.profiles.username}</span>
                        )}
                        <VerificationBadge verified={post.profiles?.verified || false} size="sm" />
                      </>
                    )}
                    <span className="text-slate-400 text-xs">·</span>
                    <span className="text-slate-500 text-xs flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {formatTimeAgo(post.created_at)}
                    </span>
                  </div>

                </div>
              </div>

              {post.is_agent_post ? (
                <div>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {expandedAgentPosts.has(post.id) || post.content.length <= AGENT_POST_PREVIEW_LENGTH
                      ? detectAndRenderLinks(post.content)
                      : detectAndRenderLinks(post.content.slice(0, AGENT_POST_PREVIEW_LENGTH).trimEnd() + '…')}
                  </p>
                  {post.content.length > AGENT_POST_PREVIEW_LENGTH && (
                    <button
                      onClick={() => toggleAgentPostExpand(post.id)}
                      className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      {expandedAgentPosts.has(post.id) ? (
                        <><ChevronUp className="w-3.5 h-3.5" />Show less</>
                      ) : (
                        <><ChevronDown className="w-3.5 h-3.5" />Read more</>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {detectAndRenderLinks(post.content)}
                </p>
              )}

              {post.is_agent_post && post.agent_discussion_id && post.ai_agent_discussions && (
                <>
                  <AgentDiscussionViewer
                    discussionId={post.agent_discussion_id}
                    topicTitle={post.ai_agent_discussions.topic_title}
                    agentNames={post.ai_agent_discussions.agent_names || []}
                    agentDisplayNames={post.ai_agent_discussions.agent_display_names || []}
                  />
                  {isExpanded && comments[post.id] && comments[post.id].length > 0 && (
                    <div className="mt-3 space-y-3">
                      {comments[post.id].map(comment => (
                        <div key={comment.id}>
                          <div className="flex gap-2 sm:gap-3">
                            <button
                              onClick={() => onNavigate('profile', undefined, comment.author_id)}
                              className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 hover:ring-2 hover:ring-teal-500 transition-all overflow-hidden"
                            >
                              {comment.profiles?.avatar_url ? (
                                <img src={getAvatarUrl(comment.profiles.avatar_url) || ''} alt={comment.profiles.full_name || 'User'} className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-4 h-4 text-white" />
                              )}
                            </button>
                            <div className="flex-1 bg-slate-50 rounded-lg p-2.5">
                              <div className="flex items-center gap-1 flex-wrap mb-0.5">
                                <span className="font-medium text-slate-900 text-xs">{getDisplayName(comment.profiles)}</span>
                                {comment.profiles?.username && <span className="text-slate-500 text-xs">@{comment.profiles.username}</span>}
                                <VerificationBadge verified={comment.profiles?.verified || false} size="sm" />
                                {user?.id === comment.author_id && (
                                  <button
                                    onClick={() => deleteComment(post.id, comment.id)}
                                    disabled={deletingComment === comment.id}
                                    className="ml-auto p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                    title="Delete challenge"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              <p className="text-slate-700 text-xs whitespace-pre-wrap">{detectAndRenderLinks(comment.content)}</p>
                            </div>
                          </div>
                          {comment.aiReply && (
                            <div className="ml-10 mt-1.5 rounded-xl border border-slate-200 bg-white overflow-hidden">
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                                <div className="w-5 h-5 bg-gradient-to-br from-slate-700 to-slate-500 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs select-none">
                                  {comment.aiReply.display_name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs font-semibold text-slate-800">{comment.aiReply.display_name}</span>
                                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                  {comment.aiReply.agent_name}
                                </span>
                              </div>
                              <div className="px-3 py-2.5">
                                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{comment.aiReply.content}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <AgentDiscussionContribute
                    key={post.id}
                    postId={post.id}
                    topicTitle={post.ai_agent_discussions.topic_title}
                    discussionId={post.agent_discussion_id}
                    postContent={post.content}
                    onCommentAdded={() => {
                      loadComments(post.id);
                      loadPosts();
                      if (expandedPost !== post.id) setExpandedPost(post.id);
                    }}
                    onAIReplyStored={() => loadComments(post.id)}
                  />
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100">
                    <button
                      onClick={() => setShareCardPost(post)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-semibold transition-colors touch-manipulation"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Share discussion
                    </button>
                    <ShareButton
                      url={`${window.location.origin}${window.location.pathname}#agent-discussion/${post.ai_agent_discussions?.slug || post.agent_discussion_id}`}
                      title={post.ai_agent_discussions.topic_title}
                      text={`AI agents debate: ${post.ai_agent_discussions.topic_title} — via Poddle`}
                      variant="icon"
                      size="sm"
                    />
                  </div>
                </>
              )}

              {!post.is_agent_post && (
                <PostAIInsight
                  postId={post.id}
                  postContent={post.content}
                  podNames={[]}
                />
              )}

              {!post.is_agent_post && (
              <div className="flex items-center gap-2 pt-2 mt-3 border-t border-slate-100">
                <button
                  onClick={() => toggleLike(post.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-lg font-semibold transition-colors min-h-[44px] touch-manipulation ${
                    hasLiked
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${hasLiked ? 'fill-current' : ''}`} />
                  <span className="text-sm">{post.like_count}</span>
                </button>

                <button
                  onClick={() => toggleComments(post.id)}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors min-h-[44px] touch-manipulation"
                >
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-sm font-semibold">{post.comment_count}</span>
                </button>

                <div className="ml-auto">
                  <ShareButton
                    url={`${window.location.origin}${window.location.pathname}#post/${(post as any).slug || post.id}`}
                    title={post.profiles ? `${getDisplayName(post.profiles)} on Poddle` : 'Post on Poddle'}
                    text={post.content.slice(0, 120)}
                    variant="icon"
                    size="sm"
                    onShare={async () => {
                      await supabase.rpc('increment_post_share', { p_post_id: post.id });
                    }}
                  />
                </div>
              </div>
              )}

              {isExpanded && !post.is_agent_post && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="space-y-3 mb-4">
                    {comments[post.id]?.map(comment => (
                      <div key={comment.id} className="flex gap-2 sm:gap-3">
                        <button
                          onClick={() => onNavigate('profile', undefined, comment.author_id)}
                          className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 hover:ring-2 hover:ring-teal-500 transition-all overflow-hidden"
                        >
                          {comment.profiles?.avatar_url ? (
                            <img
                              src={getAvatarUrl(comment.profiles.avatar_url) || ''}
                              alt={comment.profiles.full_name || 'User'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-4 h-4 text-white" />
                          )}
                        </button>
                        <div className="flex-1 bg-slate-50 rounded-lg p-2.5 sm:p-3">
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                              <button
                                onClick={() => onNavigate('profile', undefined, comment.author_id)}
                                className="font-medium text-slate-900 text-xs sm:text-sm hover:text-blue-600 transition-colors"
                              >
                                {getDisplayName(comment.profiles)}
                              </button>
                              {comment.profiles?.username && (
                                <span className="text-slate-500 text-xs">@{comment.profiles.username}</span>
                              )}
                              <VerificationBadge verified={comment.profiles?.verified || false} size="sm" />
                            </div>
                            {user?.id === comment.author_id && editingComment !== comment.id && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => startEditComment(comment)}
                                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors"
                                  title="Edit comment"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => deleteComment(post.id, comment.id)}
                                  disabled={deletingComment === comment.id}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                  title="Delete comment"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                          {editingComment === comment.id ? (
                            <div className="mt-1.5 space-y-1.5">
                              <textarea
                                value={editCommentText}
                                onChange={(e) => setEditCommentText(e.target.value)}
                                className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none bg-white"
                                rows={2}
                                autoFocus
                              />
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => saveEditComment(post.id, comment.id)}
                                  disabled={savingComment || !editCommentText.trim()}
                                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                  <Check className="w-3 h-3" />
                                  {savingComment ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditingComment(null)}
                                  disabled={savingComment}
                                  className="flex items-center gap-1 px-2 py-1 border border-slate-300 text-slate-600 rounded-md text-xs font-semibold hover:bg-slate-100 transition disabled:opacity-50"
                                >
                                  <X className="w-3 h-3" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-slate-700 text-xs sm:text-sm mt-0.5 whitespace-pre-wrap">
                              {detectAndRenderLinks(comment.content)}
                            </p>
                          )}
                        </div>
                        {comment.aiReply && (
                          <div className="ml-10 sm:ml-12 mt-1.5 rounded-xl border border-slate-200 bg-white overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                              <div className="w-5 h-5 bg-gradient-to-br from-slate-700 to-slate-500 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs select-none">
                                {comment.aiReply.display_name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs font-semibold text-slate-800">{comment.aiReply.display_name}</span>
                              <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {comment.aiReply.agent_name}
                              </span>
                            </div>
                            <div className="px-3 py-2.5">
                              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{comment.aiReply.content}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {!post.is_agent_post && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newComment[post.id] || ''}
                      onChange={(e) =>
                        setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          addComment(post.id);
                        }
                      }}
                      placeholder="Add a comment..."
                      className="flex-1 px-3 sm:px-4 py-2 border border-slate-200 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-slate-50"
                      disabled={commenting[post.id]}
                    />
                    <button
                      onClick={() => addComment(post.id)}
                      disabled={!newComment[post.id]?.trim() || commenting[post.id]}
                      className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation"
                    >
                      {commenting[post.id] ? (
                        <Loader className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </button>
                  </div>
                  )}

                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
