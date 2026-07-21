import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Users, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { acquireChannel, releaseChannel } from '../lib/realtimeRegistry';
import { useAuth } from '../contexts/AuthContext';
import { getDisplayName } from '../lib/displayName';
import { getAvatarUrl, getInitials } from '../lib/avatarUtils';

interface ChatMessage {
  id: string;
  workspace_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface MemberProfile {
  user_id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  username?: string | null;
  role?: string | null;
}

interface TeamChatProps {
  workspaceId: string;
  workspaceName: string;
}

const MEMBER_COLORS = [
  { bg: 'rgba(37,99,235,0.12)', text: '#1d4ed8' },
  { bg: 'rgba(5,150,105,0.12)', text: '#065f46' },
  { bg: 'rgba(217,119,6,0.12)', text: '#b45309' },
  { bg: 'rgba(220,38,38,0.10)', text: '#b91c1c' },
  { bg: 'rgba(124,58,237,0.10)', text: '#6d28d9' },
  { bg: 'rgba(15,118,110,0.12)', text: '#0f766e' },
];

function memberColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length];
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDateDivider(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (msgDay.getTime() === today.getTime()) return 'Today';
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function dateKey(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function TeamChat({ workspaceId, workspaceName }: TeamChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, MemberProfile>>({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const memberProfilesRef = useRef<Record<string, MemberProfile>>({});

  useEffect(() => {
    memberProfilesRef.current = memberProfiles;
  }, [memberProfiles]);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('workspace_chat_messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .limit(200);

    setMessages(data || []);
    setLoading(false);
    setTimeout(() => scrollToBottom(false), 100);
  }, [workspaceId, scrollToBottom]);

  const loadMemberProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('workspace_members')
      .select(`
        user_id,
        role,
        profiles:user_id (id, full_name, first_name, last_name, avatar_url, username)
      `)
      .eq('workspace_id', workspaceId);

    const map: Record<string, MemberProfile> = {};
    for (const row of data || []) {
      const p = row.profiles as any;
      if (p) {
        map[row.user_id] = {
          user_id: row.user_id,
          full_name: p.full_name,
          first_name: p.first_name,
          last_name: p.last_name,
          avatar_url: p.avatar_url,
          username: p.username,
          role: row.role,
        };
      }
    }
    setMemberProfiles(map);
  }, [workspaceId]);

  useEffect(() => {
    loadMessages();
    loadMemberProfiles();

    const channelName = `workspace-team-chat-${workspaceId}`;
    acquireChannel(channelName, ch =>
      ch.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workspace_chat_messages', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (newMsg.user_id && !memberProfilesRef.current[newMsg.user_id]) {
            supabase
              .from('profiles')
              .select('id, full_name, first_name, last_name, avatar_url, username')
              .eq('id', newMsg.user_id)
              .maybeSingle()
              .then(({ data }) => {
                if (data) {
                  setMemberProfiles(prev => ({
                    ...prev,
                    [data.id]: { user_id: data.id, full_name: data.full_name, first_name: data.first_name, last_name: data.last_name, avatar_url: data.avatar_url, username: data.username },
                  }));
                }
              });
          }
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => scrollToBottom(), 50);
        },
      ),
    );

    return () => {
      releaseChannel(channelName);
    };
  }, [workspaceId, loadMessages, loadMemberProfiles, scrollToBottom]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || !user || sending) return;

    setSending(true);
    setInput('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const { error } = await supabase
        .from('workspace_chat_messages')
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          content: trimmed,
        });

      if (error) throw error;

      // Optimistic: the realtime subscription will add the message,
      // but scroll immediately for responsiveness
      setTimeout(() => scrollToBottom(), 100);
    } catch (err) {
      console.error('Failed to send team chat message:', err);
      setInput(trimmed); // restore input on failure
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }

  function getMemberName(userId: string): string {
    const profile = memberProfiles[userId];
    if (!profile) return 'Team member';
    return getDisplayName(profile) || 'Team member';
  }

  function isOwnMessage(msg: ChatMessage): boolean {
    return msg.user_id === user?.id;
  }

  let lastDateKey = '';

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--app-surface-raised)' }}>
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center gap-2.5 px-5 py-2.5"
        style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface)' }}
      >
        <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--signal)' }} />
        <span className="section-label">Team Chat</span>
        <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>— {workspaceName}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--positive)' }} />
          <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>Live</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--app-text-muted)' }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div
              className="w-12 h-12 flex items-center justify-center mb-4"
              style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
            >
              <Users className="w-5 h-5" style={{ color: 'var(--app-text-muted)' }} />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--app-text-primary)' }}>
              No messages yet
            </p>
            <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
              Start the conversation with your team
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const dKey = dateKey(msg.created_at);
            const showDivider = dKey !== lastDateKey;
            lastDateKey = dKey;
            const own = isOwnMessage(msg);
            const profile = memberProfiles[msg.user_id];
            const color = memberColor(msg.user_id);
            const avatarUrl = profile ? getAvatarUrl(profile.avatar_url) : null;
            const initials = profile ? getInitials(profile) : '?';

            return (
              <div key={msg.id}>
                {showDivider && (
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px" style={{ background: 'var(--app-border)' }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-muted)' }}>
                      {formatDateDivider(msg.created_at)}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'var(--app-border)' }} />
                  </div>
                )}
                <div className={`flex gap-2.5 ${own ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className="flex-shrink-0 mt-0.5">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={getMemberName(msg.user_id)}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background: color.bg, color: color.text }}
                      >
                        {initials}
                      </div>
                    )}
                  </div>

                  {/* Message bubble */}
                  <div className={`flex flex-col max-w-[75%] ${own ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-semibold" style={{ color: own ? 'var(--signal)' : 'var(--app-text-primary)' }}>
                        {own ? 'You' : getMemberName(msg.user_id)}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                    <div
                      className="px-3 py-2 rounded-2xl text-sm leading-relaxed break-words"
                      style={
                        own
                          ? { background: 'var(--signal)', color: 'var(--ink-950)', borderBottomRightRadius: '4px' }
                          : { background: 'var(--app-surface)', color: 'var(--app-text-primary)', border: '1px solid var(--app-border)', borderBottomLeftRadius: '4px' }
                      }
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="flex-shrink-0 p-3"
        style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface)' }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Message your team..."
            rows={1}
            className="flex-1 resize-none rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors"
            style={{
              background: 'var(--app-surface-raised)',
              border: '1px solid var(--app-border)',
              color: 'var(--app-text-primary)',
              minHeight: '40px',
              maxHeight: '120px',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            aria-label="Send message"
            className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-all disabled:opacity-40"
            style={{ background: 'var(--signal)', color: 'var(--ink-950)' }}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
