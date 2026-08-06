import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Users, Loader2, AtSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { acquireChannel, releaseChannel } from '../lib/realtimeRegistry';
import { useAuth } from '../contexts/AuthContext';
import { getDisplayName } from '../lib/displayName';
import { getAvatarUrl, getInitials } from '../lib/avatarUtils';
import { logRealtimeEvent } from '../lib/tabDiagnostics';

interface ChatMessage {
  id: string;
  workspace_id: string;
  user_id: string;
  content: string;
  created_at: string;
  mentioned_user_ids?: string[] | null;
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

/** Extract @mentioned user IDs from message content by matching member display names. */
function extractMentionedIds(content: string, members: Record<string, MemberProfile>): string[] {
  const ids: string[] = [];
  for (const [uid, profile] of Object.entries(members)) {
    const name = getDisplayName(profile);
    if (!name) continue;
    const mentionPattern = new RegExp(`@${escapeRegExp(name)}\\b`, 'i');
    if (mentionPattern.test(content)) {
      ids.push(uid);
    }
  }
  return ids;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Render message content with @mentions highlighted. */
function renderContent(content: string, members: Record<string, MemberProfile>, ownUserId: string | undefined): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = content;
  let keyIdx = 0;

  // Build a regex that matches any @mention of known members
  const memberNames = Object.values(members)
    .map(m => getDisplayName(m))
    .filter(Boolean) as string[];
  if (memberNames.length === 0) {
    return [content];
  }
  const pattern = new RegExp(
    `@(${memberNames.map(escapeRegExp).join('|')})\\b`,
    'gi'
  );

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(remaining)) !== null) {
    // Push text before the match
    if (match.index > lastIndex) {
      parts.push(remaining.slice(lastIndex, match.index));
    }
    const matchedName = match[1];
    // Find the member by display name (case-insensitive)
    const member = Object.values(members).find(m => {
      const name = getDisplayName(m);
      return name && name.toLowerCase() === matchedName.toLowerCase();
    });
    const isSelf = member?.user_id === ownUserId;
    parts.push(
      <span
        key={`mention-${keyIdx++}`}
        className="font-semibold"
        style={{
          color: isSelf ? 'var(--signal)' : '#2563eb',
          background: 'rgba(37,99,235,0.10)',
          padding: '0 4px',
          borderRadius: '4px',
        }}
      >
        @{matchedName}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < remaining.length) {
    parts.push(remaining.slice(lastIndex));
  }
  return parts;
}

export default function TeamChat({ workspaceId, workspaceName }: TeamChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, MemberProfile>>({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const memberProfilesRef = useRef<Record<string, MemberProfile>>({});
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const typingExpiryTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // @mention picker state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    memberProfilesRef.current = memberProfiles;
  }, [memberProfiles]);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const mountedRef = useRef(true);
  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('workspace_chat_messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (!mountedRef.current) return;
    let didChange = false;
    setMessages(prev => {
      const existing = new Set(prev.map(m => m.id));
      const newMsgs = (data || []).filter(m => !existing.has(m.id));
      if (newMsgs.length === 0) return prev;
      didChange = true;
      return [...prev, ...newMsgs];
    });
    setLoading(false);
    if (didChange) {
      setTimeout(() => { if (mountedRef.current) scrollToBottom(false); }, 100);
    }
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
    const broadcastName = `workspace-team-broadcast-${workspaceId}`;

    const teamMsgCh = acquireChannel(channelName, ch =>
      ch.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workspace_chat_messages', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          console.log('[TeamChat] REALTIME postgres_changes INSERT received:', { id: newMsg.id, user_id: newMsg.user_id, content: newMsg.content?.slice(0, 30) });
          logRealtimeEvent('TeamChat', 'postgres_insert', workspaceId, { id: newMsg.id, user_id: newMsg.user_id });
          if (newMsg.user_id === user?.id) { console.log('[TeamChat] skipping own message'); return; }
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
            console.log('[TeamChat] adding new realtime message to state:', { id: newMsg.id });
            return [...prev, newMsg];
          });
          setTimeout(() => scrollToBottom(), 50);
        },
      ),
    );
    console.log('[TeamChat] acquireChannel result for messages:', { name: channelName, channel: teamMsgCh ? 'OK' : 'NULL' });
    logRealtimeEvent('TeamChat', 'channel_acquired', workspaceId, { channel: 'messages', ok: !!teamMsgCh });

    const broadcastCh = acquireChannel(broadcastName, ch =>
      ch
      .on('broadcast', { event: 'new_message' }, (payload: { payload: { id: string; user_id: string } }) => {
        logRealtimeEvent('TeamChat', 'broadcast_new_message', workspaceId, { user_id: payload.payload.user_id });
        if (payload.payload.user_id === user?.id) return;
        loadMessages();
      })
      .on('broadcast', { event: 'typing' }, (payload: { payload: { user_id: string; name: string; isTyping: boolean } }) => {
        console.log('[TeamChat] BROADCAST typing received:', payload.payload);
        logRealtimeEvent('TeamChat', 'broadcast_typing', workspaceId, { user_id: payload.payload.user_id, isTyping: payload.payload.isTyping });
        const data = payload.payload;
        if (data.user_id === user?.id) { console.log('[TeamChat] skipping own typing broadcast'); return; }
        setTypingUsers(prev => {
          const next = new Map(prev);
          if (data.isTyping) {
            next.set(data.user_id, data.name);
          } else {
            next.delete(data.user_id);
          }
          console.log('[TeamChat] typingUsers state updated:', { size: next.size, users: Array.from(next.entries()) });
          return next;
        });
        // Auto-clear after 4s in case the "stopped typing" broadcast is missed
        if (data.isTyping) {
          const existing = typingExpiryTimers.current.get(data.user_id);
          if (existing) clearTimeout(existing);
          const timer = setTimeout(() => {
            setTypingUsers(prev => {
              const next = new Map(prev);
              next.delete(data.user_id);
              return next;
            });
            typingExpiryTimers.current.delete(data.user_id);
          }, 4000);
          typingExpiryTimers.current.set(data.user_id, timer);
        }
      }),
    );
    broadcastChannelRef.current = broadcastCh as ReturnType<typeof supabase.channel> | null;
    console.log('[TeamChat] acquireChannel result for broadcast:', { name: broadcastName, channel: broadcastCh ? 'OK' : 'NULL', ref: broadcastChannelRef.current ? 'SET' : 'NULL' });
    logRealtimeEvent('TeamChat', 'channel_acquired', workspaceId, { channel: 'broadcast', ok: !!broadcastCh });

    // Keep channels alive when the tab is hidden — pausing/unsubscribing can
    // leave the channel in a dead state on mobile browsers that aggressively
    // suspend WebSocket connections. Instead, just backfill from the database
    // on refocus to pick up any messages missed while the tab was inactive.
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        loadMessages();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Polling safety net: if both postgres_changes and broadcast fail (e.g. the
    // WebSocket is silently dead), poll the database every 8s so messages still
    // appear within a few seconds. This is cheap (indexed query, limit 200) and
    // only runs while the component is mounted.
    const pollInterval = setInterval(() => {
      logRealtimeEvent('TeamChat', 'poll_fallback', workspaceId);
      loadMessages();
    }, 8000);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pollInterval);
      logRealtimeEvent('TeamChat', 'channel_released', workspaceId, { channel: 'messages' });
      releaseChannel(channelName);
      logRealtimeEvent('TeamChat', 'channel_released', workspaceId, { channel: 'broadcast' });
      releaseChannel(broadcastName);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingExpiryTimers.current.forEach(t => clearTimeout(t));
      typingExpiryTimers.current.clear();
    };
  }, [workspaceId, loadMessages, loadMemberProfiles, scrollToBottom]);

  // ── Mention detection ──
  const otherMembers = Object.values(memberProfiles).filter(m => m.user_id !== user?.id);

  function detectMention(text: string, cursorPos: number): { query: string; start: number } | null {
    // Find the last @ before the cursor that isn't preceded by a non-space character
    const before = text.slice(0, cursorPos);
    const atIdx = before.lastIndexOf('@');
    if (atIdx === -1) return null;
    // The @ must be at the start of input or preceded by whitespace
    if (atIdx > 0 && !/\s/.test(before[atIdx - 1])) return null;
    // No spaces allowed in the query (mention ends at first space)
    const afterAt = before.slice(atIdx + 1);
    if (afterAt.includes(' ') || afterAt.includes('\n')) return null;
    return { query: afterAt, start: atIdx };
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    if (val.trim()) {
      broadcastTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => broadcastTyping(false), 2500);
    } else {
      broadcastTyping(false);
    }

    // Detect @mention
    const cursorPos = e.target.selectionStart;
    const mention = detectMention(val, cursorPos);
    if (mention && otherMembers.length > 0) {
      setMentionQuery(mention.query);
      setMentionStart(mention.start);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Mention picker navigation
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => (i - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function broadcastTyping(isTyping: boolean) {
    console.log('[TeamChat] broadcastTyping called:', { isTyping, hasChannel: !!broadcastChannelRef.current, hasUser: !!user });
    if (!broadcastChannelRef.current || !user) return;
    const profile = memberProfilesRef.current[user.id];
    const name = profile ? getDisplayName(profile) : 'Team member';
    broadcastChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: user.id, name, isTyping },
    });
    console.log('[TeamChat] broadcastTyping sent:', { event: 'typing', user_id: user.id, name, isTyping });
  }

  const filteredMembers = mentionQuery !== null
    ? otherMembers.filter(m => {
        const name = getDisplayName(m) || '';
        return name.toLowerCase().startsWith(mentionQuery.toLowerCase());
      })
    : [];

  function insertMention(member: MemberProfile) {
    const name = getDisplayName(member) || '';
    const before = input.slice(0, mentionStart);
    const after = input.slice(mentionStart + 1 + mentionQuery.length);
    const newVal = `${before}@${name} ${after}`;
    setInput(newVal);
    setMentionQuery(null);

    // Restore cursor position after state update
    requestAnimationFrame(() => {
      const pos = mentionStart + name.length + 2; // @name + space
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || !user || sending) return;

    // Extract mentioned user IDs from the text
    const mentionedIds = extractMentionedIds(trimmed, memberProfiles);

    setSending(true);
    setInput('');
    setMentionQuery(null);
    setSendError(null);
    broadcastTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const optimisticMsg: ChatMessage = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      user_id: user.id,
      content: trimmed,
      created_at: new Date().toISOString(),
      mentioned_user_ids: mentionedIds.length > 0 ? mentionedIds : null,
    } as ChatMessage;
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom(), 50);

    try {
      const { error } = await supabase
        .from('workspace_chat_messages')
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          content: trimmed,
          mentioned_user_ids: mentionedIds.length > 0 ? mentionedIds : null,
        });

      if (error) throw error;

      // Dual-delivery: tell all peers to fetch the new message. This works
      // even when their postgres_changes subscription is silently dead.
      broadcastChannelRef.current?.send({
        type: 'broadcast',
        event: 'new_message',
        payload: { id: optimisticMsg.id, user_id: user.id },
      });
    } catch (err: any) {
      console.error('Failed to send team chat message:', err);
      setSendError(err?.message || 'Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setInput(trimmed);
    } finally {
      setSending(false);
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
            const initials = profile ? getInitials(getDisplayName(profile)) : '?';

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
                      {renderContent(msg.content, memberProfiles, user?.id)}
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
        className="flex-shrink-0 p-3 relative"
        style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface)' }}
      >
        {/* Mention dropdown */}
        {mentionQuery !== null && filteredMembers.length > 0 && (
          <div
            ref={mentionDropdownRef}
            className="absolute bottom-full left-3 right-3 mb-1 rounded-xl overflow-hidden shadow-lg"
            style={{
              background: 'var(--app-surface-raised)',
              border: '1px solid var(--app-border)',
              maxHeight: '200px',
              overflowY: 'auto',
            }}
          >
            {filteredMembers.map((m, i) => {
              const name = getDisplayName(m) || '';
              const avatarUrl = getAvatarUrl(m.avatar_url);
              const initials = getInitials(getDisplayName(m));
              const color = memberColor(m.user_id);
              return (
                <button
                  key={m.user_id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(m);
                  }}
                  onMouseEnter={() => setMentionIndex(i)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
                  style={{
                    background: i === mentionIndex ? 'rgba(37,99,235,0.08)' : 'transparent',
                  }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                      style={{ background: color.bg, color: color.text }}
                    >
                      {initials}
                    </div>
                  )}
                  <span className="text-sm font-medium" style={{ color: 'var(--app-text-primary)' }}>
                    {name}
                  </span>
                  {m.role === 'owner' && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(37,99,235,0.10)', color: 'var(--signal)' }}>
                      Owner
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {sendError && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-lg text-xs" style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
            <span>{sendError}</span>
            <button onClick={() => setSendError(null)} className="ml-auto font-semibold">Dismiss</button>
          </div>
        )}
        {typingUsers.size > 0 && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-slate-500">
              {Array.from(typingUsers.values()).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing…
            </span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              // Delay to allow click on dropdown to register
              setTimeout(() => setMentionQuery(null), 150);
            }}
            placeholder="Message… (use @ to mention)"
            rows={1}
            className="flex-1 resize-none rounded-xl px-3 py-2 text-sm xs:text-[13px] outline-none transition-colors"
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