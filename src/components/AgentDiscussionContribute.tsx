import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Swords, X, Send, Loader, RefreshCw, User, ChevronDown, ChevronUp } from 'lucide-react';

interface AgentDiscussionContributeProps {
  postId: string;
  topicTitle: string;
  discussionId: string;
  postContent: string;
  onCommentAdded?: () => void;
  onAIReplyStored?: () => void;
}

interface AIReply {
  agentName: string;
  displayName: string;
  content: string;
  agentRole: string;
}

interface ConversationEntry {
  id?: string;
  type: 'user' | 'ai';
  text: string;
  aiReply?: AIReply;
}

const AGENT_COLORS: Record<string, string> = {
  'The Skeptic': 'bg-rose-100 text-rose-700',
  "Devil's Advocate": 'bg-orange-100 text-orange-700',
  'Risk Analyst': 'bg-amber-100 text-amber-700',
  'Data Detective': 'bg-blue-100 text-blue-700',
  'The Pragmatist': 'bg-slate-100 text-slate-700',
  'Systems Thinker': 'bg-teal-100 text-teal-700',
  'The Optimist': 'bg-emerald-100 text-emerald-700',
  'Market Analyst': 'bg-cyan-100 text-cyan-700',
  'Tech Futurist': 'bg-sky-100 text-sky-700',
  'The Historian': 'bg-stone-100 text-stone-700',
};

const CHALLENGE_PREFIX = 'Challenge: ';

export default function AgentDiscussionContribute({
  postId,
  topicTitle,
  discussionId,
  postContent,
  onCommentAdded,
  onAIReplyStored,
}: AgentDiscussionContributeProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [threadExpanded, setThreadExpanded] = useState(true);

  useEffect(() => {
    if (!user) {
      setConversation([]);
      return;
    }
    loadPersistedConversation();
  }, [user?.id, postId]);

  const loadPersistedConversation = async () => {
    if (!user) return;
    try {
      const { data: comments, error } = await supabase
        .from('post_comments')
        .select('id, content, created_at, author_id')
        .eq('post_id', postId)
        .eq('author_id', user.id)
        .like('content', `${CHALLENGE_PREFIX}%`)
        .order('created_at', { ascending: true });

      if (error || !comments || comments.length === 0) {
        setConversation([]);
        return;
      }

      const ids = comments.map(c => c.id);
      const { data: replies } = await supabase
        .from('post_comment_ai_replies')
        .select('comment_id, agent_name, display_name, agent_role, content')
        .in('comment_id', ids);

      const replyMap = new Map((replies || []).map(r => [r.comment_id, r]));

      const entries: ConversationEntry[] = [];
      for (const c of comments) {
        const userText = c.content.startsWith(CHALLENGE_PREFIX)
          ? c.content.slice(CHALLENGE_PREFIX.length)
          : c.content;
        entries.push({ id: c.id, type: 'user', text: userText });
        const reply = replyMap.get(c.id);
        if (reply) {
          entries.push({
            id: c.id + '-ai',
            type: 'ai',
            text: reply.content,
            aiReply: {
              agentName: reply.agent_name,
              displayName: reply.display_name,
              content: reply.content,
              agentRole: reply.agent_role,
            },
          });
        }
      }
      setConversation(entries);
    } catch (err) {
      console.error('Error loading persisted challenges:', err);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setText('');
  };

  const handleDismiss = () => {
    setOpen(false);
    setText('');
  };

  const handleSubmit = async () => {
    if (!user || !text.trim()) return;
    setSubmitting(true);

    const submittedText = text.trim();

    try {
      const content = `${CHALLENGE_PREFIX}${submittedText}`;

      const { data: comment, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          content,
        })
        .select('id')
        .single();

      if (error) throw error;

      setText('');
      setOpen(false);
      setThreadExpanded(true);
      setConversation(prev => [...prev, { id: comment.id, type: 'user', text: submittedText }]);
      onCommentAdded?.();

      setAiThinking(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setAiThinking(false); return; }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agents`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'post-challenge-reply',
            commentId: comment.id,
            postId,
            discussionId,
            challengeContent: content,
            postContent,
            topicTitle,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.reply) {
          setConversation(prev => [...prev, {
            id: comment.id + '-ai',
            type: 'ai',
            text: data.reply.content,
            aiReply: data.reply,
          }]);
          onAIReplyStored?.();
        }
      }
    } catch (err) {
      console.error('Error submitting challenge:', err);
    } finally {
      setSubmitting(false);
      setAiThinking(false);
    }
  };

  const hasConversation = conversation.length > 0;
  const challengeCount = conversation.filter(e => e.type === 'user').length;

  return (
    <div className="mt-3 pt-3 border-t border-blue-100">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Your contribution
        </p>
        {hasConversation && (
          <button
            onClick={() => setThreadExpanded(prev => !prev)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition"
          >
            <span>{challengeCount} {challengeCount === 1 ? 'challenge' : 'challenges'}</span>
            {threadExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {hasConversation && threadExpanded && (
        <div className="mb-3 space-y-3">
          {conversation.map((entry, i) => (
            entry.type === 'user' ? (
              <div key={entry.id ?? i} className="flex items-start gap-2.5 justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-slate-800 text-white px-3.5 py-2.5">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.text}</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                </div>
              </div>
            ) : entry.aiReply ? (
              <div key={entry.id ?? i} className="flex items-start gap-2.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white font-bold text-xs select-none"
                  style={{ background: 'linear-gradient(135deg, #334155, #64748b)' }}
                >
                  {entry.aiReply.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="max-w-[85%]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-700">{entry.aiReply.displayName}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${AGENT_COLORS[entry.aiReply.agentName] || 'bg-blue-100 text-blue-700'}`}>
                      {entry.aiReply.agentRole}
                    </span>
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-white border border-slate-200 px-3.5 py-2.5">
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{entry.aiReply.content}</p>
                  </div>
                </div>
              </div>
            ) : null
          ))}
        </div>
      )}

      {aiThinking && (
        <div className="flex items-start gap-2.5 mb-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs select-none"
            style={{ background: 'linear-gradient(135deg, #334155, #64748b)' }}
          >
            ?
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-white border border-slate-200">
            <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />
            <span className="text-xs text-slate-500 font-medium">Reviewing your challenge...</span>
          </div>
        </div>
      )}

      {!open && !aiThinking && !user && (
        <p className="text-xs text-slate-400 mt-1.5">Sign in to challenge this discussion.</p>
      )}

      {!open && !aiThinking && user && (
        <button
          onClick={handleOpen}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-white transition-all touch-manipulation hover:scale-105 hover:-translate-y-px active:scale-95"
          style={{
            background: 'linear-gradient(135deg,#1e3a5f,#2563eb)',
            boxShadow: '0 2px 8px rgba(37,99,235,0.35)',
          }}
        >
          <Swords className="w-3.5 h-3.5" />
          {hasConversation ? 'Challenge again' : 'Challenge this'}
        </button>
      )}

      {open && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(37,99,235,0.2)', background: '#fff', boxShadow: '0 4px 16px rgba(37,99,235,0.08)' }}
        >
          <div
            className="flex items-center gap-2 px-3.5 py-2.5"
            style={{ background: 'linear-gradient(135deg,rgba(30,58,95,0.06),rgba(37,99,235,0.08))', borderBottom: '1px solid rgba(37,99,235,0.12)' }}
          >
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
            >
              <Swords className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-bold text-slate-800">Challenge this</span>
            <span className="text-xs text-slate-400 ml-1 truncate hidden sm:block">
              — {topicTitle}
            </span>
            <button
              onClick={handleDismiss}
              className="ml-auto p-1 rounded-lg hover:bg-slate-200/60 transition text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-3.5">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's wrong with this analysis? Share a counter-argument or point out a flaw..."
              rows={3}
              autoFocus
              className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between mt-2.5 pt-2.5" style={{ borderTop: '1px solid rgba(15,23,42,0.07)' }}>
              <span className="text-xs text-slate-400">
                {text.length > 0 ? `${text.length} chars` : 'Be specific — the AI will respond'}
              </span>
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || submitting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white transition-all hover:scale-105 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 touch-manipulation"
                style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: text.trim() ? '0 2px 8px rgba(37,99,235,0.3)' : 'none' }}
              >
                {submitting ? (
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {submitting ? 'Posting...' : 'Post challenge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
