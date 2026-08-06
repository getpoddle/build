import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, Loader2, Sparkles, RefreshCw, ChevronDown, Download, Mic, Square, Paperclip, FileText, X, Shield, AlertCircle, Lightbulb, TrendingUp, DollarSign, Rocket, History } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { acquireChannel, releaseChannel } from '../lib/realtimeRegistry';
import { useAuth } from '../contexts/AuthContext';
import { exportChatToPDF } from '../lib/pdfExport';
import { getDisplayName } from '../lib/displayName';
import { getAvatarUrl, getInitials } from '../lib/avatarUtils';
import { blobToMp3File } from '../lib/audioUtils';
import ConsensusCharts, { type ChartData, type AgentFigures } from './ConsensusCharts';
import { logRealtimeEvent } from '../lib/tabDiagnostics';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent_name?: string;
  agent_role?: string;
  user_id?: string | null;
  created_at: string;
  chart_data?: ChartData | null;
  figures?: AgentFigures | null;
}

interface MemberProfile {
  user_id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  username?: string | null;
}

interface DocumentContext {
  filename: string;
  extractedText: string;
  charCount: number;
  wordCount: number;
  size: number;
}

interface WorkspaceChatProps {
  workspaceId: string;
  workspaceName: string;
  workspaceTopic?: string;
  initialPrompt?: string;
  onPromptConsumed?: () => void;
  onAgentsReplied?: () => void;
  isPro?: boolean;
  onUpgrade?: () => void;
  onUsageUpdate?: (usage: {
    used: number;
    limit: number | null;
    included: number;
    in_overage: boolean;
    overage_count: number;
    overage_unit_price: number;
    period_end: string | null;
  }) => void;
}

const MAX_DOC_FILES = 3;
const MAX_DOC_SIZE = 10 * 1024 * 1024;
const ACCEPTED_DOC_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ACCEPTED_DOC_EXT = ['.pdf', '.docx'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const AGENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  strategic_analyst:  { bg: 'rgba(37,99,235,0.07)',   text: '#1d4ed8', border: 'rgba(37,99,235,0.15)' },
  devils_advocate:    { bg: 'rgba(220,38,38,0.07)',    text: '#b91c1c', border: 'rgba(220,38,38,0.15)' },
  innovation_scout:   { bg: 'rgba(16,185,129,0.07)',   text: '#065f46', border: 'rgba(16,185,129,0.15)' },
  risk_analyst:       { bg: 'rgba(234,88,12,0.07)',    text: '#c2410c', border: 'rgba(234,88,12,0.15)' },
  market_analyst:     { bg: 'rgba(37,99,235,0.07)',    text: '#1d4ed8', border: 'rgba(37,99,235,0.15)' },
  financial_strategist:{ bg: 'rgba(5,150,105,0.07)',  text: '#065f46', border: 'rgba(5,150,105,0.15)' },
  execution_lead:     { bg: 'rgba(100,116,139,0.07)',  text: '#334155', border: 'rgba(100,116,139,0.15)' },
  people_advisor:     { bg: 'rgba(168,85,247,0.07)',   text: '#7e22ce', border: 'rgba(168,85,247,0.15)' },
  consensus:          { bg: 'rgba(15,23,42,0.04)',     text: '#0f172a', border: 'rgba(15,23,42,0.12)' },
  strategic_analyst_challenge:    { bg: 'rgba(37,99,235,0.05)',   text: '#1d4ed8', border: 'rgba(37,99,235,0.12)' },
  devils_advocate_challenge:      { bg: 'rgba(220,38,38,0.05)',   text: '#b91c1c', border: 'rgba(220,38,38,0.12)' },
  innovation_scout_challenge:     { bg: 'rgba(16,185,129,0.05)',  text: '#065f46', border: 'rgba(16,185,129,0.12)' },
  risk_analyst_challenge:        { bg: 'rgba(234,88,12,0.05)',   text: '#c2410c', border: 'rgba(234,88,12,0.12)' },
  market_analyst_challenge:       { bg: 'rgba(37,99,235,0.05)',   text: '#1d4ed8', border: 'rgba(37,99,235,0.12)' },
  financial_strategist_challenge: { bg: 'rgba(5,150,105,0.05)',  text: '#065f46', border: 'rgba(5,150,105,0.12)' },
  execution_lead_challenge:      { bg: 'rgba(100,116,139,0.05)', text: '#334155', border: 'rgba(100,116,139,0.12)' },
  people_advisor_challenge:      { bg: 'rgba(168,85,247,0.05)',  text: '#7e22ce', border: 'rgba(168,85,247,0.12)' },
};

const AGENT_ABBR: Record<string, string> = {
  strategic_analyst:    'SA',
  devils_advocate:      'DA',
  innovation_scout:     'IS',
  risk_analyst:         'RA',
  market_analyst:       'MA',
  financial_strategist: 'FS',
  execution_lead:       'EL',
  people_advisor:       'PA',
  consensus:            'C',
  strategic_analyst_challenge:    'SA',
  devils_advocate_challenge:      'DA',
  innovation_scout_challenge:     'IS',
  risk_analyst_challenge:         'RA',
  market_analyst_challenge:       'MA',
  financial_strategist_challenge:  'FS',
  execution_lead_challenge:       'EL',
  people_advisor_challenge:       'PA',
};


// Detect which debate phase a message belongs to based on content patterns
function detectPhase(content: string): 'challenge' | 'consensus' | null {
  const lower = content.slice(0, 200).toLowerCase();
  if (lower.includes('@') || lower.match(/^(challenging|i challenge|@\w)/)) return 'challenge';
  if (
    lower.includes('where agents agree') || lower.includes('where agents converge') ||
    lower.includes('areas of agreement') || lower.includes('live tension') ||
    lower.includes('unresolved tension') || lower.includes('decision signal') ||
    lower.includes('strategic signal') || lower.includes('agents converge') ||
    lower.includes('deadlock-breaker') || lower.includes('concrete next actions')
  ) return 'consensus';
  return null;
}

// Deterministic per-user color for avatar backgrounds
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

function formatDateDivider(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (msgDay.getTime() === today.getTime()) return 'Today';
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: msgDay.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

function formatMessageTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function dateKey(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const SUGGESTIONS = [
  {
    icon: Rocket,
    label: 'Launch a new product',
    prompt: 'Should we launch our new product now, or wait 3 months to improve it first?',
  },
  {
    icon: TrendingUp,
    label: 'Enter a new market',
    prompt: 'What are the biggest risks and opportunities of expanding into a new market next quarter?',
  },
  {
    icon: DollarSign,
    label: 'Pricing strategy',
    prompt: 'How should we price our offering to maximise growth without losing existing customers?',
  },
  {
    icon: Lightbulb,
    label: 'Prioritise the roadmap',
    prompt: 'Which initiative should we prioritise on our roadmap for the next 6 months, and why?',
  },
];

export default function WorkspaceChat({ workspaceId, workspaceName, workspaceTopic, initialPrompt, onPromptConsumed, onAgentsReplied, isPro, onUpgrade, onUsageUpdate }: WorkspaceChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, MemberProfile>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [priorContextCount, setPriorContextCount] = useState(0);
  const [showPriorContext, setShowPriorContext] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [recordingUsers, setRecordingUsers] = useState<Map<string, string>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [micBlocked, setMicBlocked] = useState(false);
  // Document upload state
  const [chatDocuments, setChatDocuments] = useState<DocumentContext[]>([]);
  const [docUploading, setDocUploading] = useState<string[]>([]);
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});
  const docInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingPromptRef = useRef<string | undefined>(initialPrompt);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memberProfilesRef = useRef<Record<string, MemberProfile>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Fallback timer-based waveform bars for when AnalyserNode is unavailable (iOS)
  const [fallbackBars, setFallbackBars] = useState<number[]>([]);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mountedRef = useRef(true);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Keep a ref in sync so realtime callbacks can read current profiles without re-subscribing
  useEffect(() => {
    memberProfilesRef.current = memberProfiles;
  }, [memberProfiles]);

  // Proactively check if microphone is already permanently blocked
  useEffect(() => {
    if (!navigator.permissions) return;
    navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
      setMicBlocked(result.state === 'denied');
      result.onchange = () => setMicBlocked(result.state === 'denied');
    }).catch(() => {/* browser may not support querying microphone permission */});
  }, []);

  useEffect(() => {
    loadMessages();
    loadMemberProfiles();

    if (user?.id) {
      supabase
        .from('user_memory_summaries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .then(({ count }) => setPriorContextCount(count ?? 0));
    }

    const msgName = `workspace-messages-${workspaceId}`;
    const broadcastName = `workspace-broadcast-${workspaceId}`;

    // Acquire via singleton registry — reuses an existing channel if another
    // component or tab has already opened it, preventing duplicate WebSocket slots.
    const msgCh = acquireChannel(msgName, ch =>
      ch.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workspace_messages', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          console.log('[WorkspaceChat] REALTIME postgres_changes INSERT received:', { id: (payload.new as Message).id, role: (payload.new as Message).role, user_id: (payload.new as Message).user_id });
          logRealtimeEvent('WorkspaceChat', 'postgres_insert', workspaceId, { id: (payload.new as Message).id, role: (payload.new as Message).role });
          const newMsg = payload.new as Message;
          if (newMsg.role === 'user' && newMsg.user_id === user?.id) { console.log('[WorkspaceChat] skipping own message'); return; }
          // Restore figures/chart_data from metadata so realtime messages show charts
          const meta = (newMsg as { metadata?: { figures?: AgentFigures | null; chart_data?: ChartData | null } }).metadata;
          if (meta) {
            if (meta.figures) (newMsg as Message).figures = meta.figures;
            if (meta.chart_data) (newMsg as Message).chart_data = meta.chart_data;
          }
          if (newMsg.role === 'user' && newMsg.user_id && !memberProfilesRef.current[newMsg.user_id]) {
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
            console.log('[WorkspaceChat] adding new realtime message to state:', { id: newMsg.id, role: newMsg.role });
            return [...prev, newMsg];
          });
          setTimeout(() => scrollToBottom(), 50);
        },
      ),
    );
    console.log('[WorkspaceChat] acquireChannel result for messages:', { name: msgName, channel: msgCh ? 'OK' : 'NULL' });
    logRealtimeEvent('WorkspaceChat', 'channel_acquired', workspaceId, { channel: 'messages', ok: !!msgCh });

    const broadcastCh = acquireChannel(broadcastName, ch =>
      ch
        .on('broadcast', { event: 'new_message' }, (payload: { payload: { user_id: string } }) => {
          logRealtimeEvent('WorkspaceChat', 'broadcast_new_message', workspaceId, { user_id: payload.payload.user_id });
          if (payload.payload.user_id === user?.id) return;
          loadMessages();
        })
        .on('broadcast', { event: 'typing' }, (payload: { payload: { user_id: string; name: string; isTyping: boolean } }) => {
          console.log('[WorkspaceChat] BROADCAST typing received:', payload.payload);
          logRealtimeEvent('WorkspaceChat', 'broadcast_typing', workspaceId, { user_id: payload.payload.user_id, isTyping: payload.payload.isTyping });
          const data = payload.payload;
          if (data.user_id === user?.id) { console.log('[WorkspaceChat] skipping own typing broadcast'); return; }
          setTypingUsers(prev => {
            const next = new Map(prev);
            if (data.isTyping) {
              next.set(data.user_id, data.name);
            } else {
              next.delete(data.user_id);
            }
            console.log('[WorkspaceChat] typingUsers state updated:', { size: next.size, users: Array.from(next.entries()) });
            return next;
          });
          // Auto-clear after 4s in case the "stopped typing" broadcast is missed
          if (data.isTyping) {
            if (typingExpiryRef.current) clearTimeout(typingExpiryRef.current);
            typingExpiryRef.current = setTimeout(() => {
              setTypingUsers(prev => {
                const next = new Map(prev);
                next.delete(data.user_id);
                return next;
              });
            }, 4000);
          }
        })
        .on('broadcast', { event: 'recording' }, (payload: { payload: { user_id: string; name: string; isRecording: boolean } }) => {
          console.log('[WorkspaceChat] BROADCAST recording received:', payload.payload);
          logRealtimeEvent('WorkspaceChat', 'broadcast_recording', workspaceId, { user_id: payload.payload.user_id, isRecording: payload.payload.isRecording });
          const data = payload.payload;
          if (data.user_id === user?.id) { console.log('[WorkspaceChat] skipping own recording broadcast'); return; }
          setRecordingUsers(prev => {
            const next = new Map(prev);
            if (data.isRecording) {
              next.set(data.user_id, data.name);
            } else {
              next.delete(data.user_id);
            }
            console.log('[WorkspaceChat] recordingUsers state updated:', { size: next.size, users: Array.from(next.entries()) });
            return next;
          });
          if (data.isRecording) {
            if (recordingExpiryRef.current) clearTimeout(recordingExpiryRef.current);
            recordingExpiryRef.current = setTimeout(() => {
              setRecordingUsers(prev => {
                const next = new Map(prev);
                next.delete(data.user_id);
                return next;
              });
            }, 10000);
          }
        }),
    );
    broadcastChannelRef.current = broadcastCh as ReturnType<typeof supabase.channel> | null;
    console.log('[WorkspaceChat] acquireChannel result for broadcast:', { name: broadcastName, channel: broadcastCh ? 'OK' : 'NULL', ref: broadcastChannelRef.current ? 'SET' : 'NULL' });
    logRealtimeEvent('WorkspaceChat', 'channel_acquired', workspaceId, { channel: 'broadcast', ok: !!broadcastCh });

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
    // appear within a few seconds. This is cheap (indexed query, limit 120) and
    // only runs while the component is mounted.
    const pollInterval = setInterval(() => {
      logRealtimeEvent('WorkspaceChat', 'poll_fallback', workspaceId);
      loadMessages();
    }, 8000);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pollInterval);
      logRealtimeEvent('WorkspaceChat', 'channel_released', workspaceId, { channel: 'messages' });
      releaseChannel(msgName);
      logRealtimeEvent('WorkspaceChat', 'channel_released', workspaceId, { channel: 'broadcast' });
      releaseChannel(broadcastName);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingExpiryRef.current) clearTimeout(typingExpiryRef.current);
      if (recordingExpiryRef.current) clearTimeout(recordingExpiryRef.current);
      // Clean up any active recording on unmount
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (recordingErrorTimerRef.current) clearTimeout(recordingErrorTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  useEffect(() => {
    if (!initialLoad) scrollToBottom(false);
  }, [initialLoad, scrollToBottom]);

  // When an initialPrompt arrives after chat is loaded, pre-fill and auto-send
  useEffect(() => {
    if (!initialPrompt || initialLoad) return;
    pendingPromptRef.current = initialPrompt;
    setInput(initialPrompt);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
    const t = setTimeout(() => {
      sendMessage(initialPrompt);
      onPromptConsumed?.();
      pendingPromptRef.current = undefined;
    }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, initialLoad]);

  async function loadMemberProfiles() {
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId);

    if (!members || members.length === 0) return;

    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name, avatar_url, username')
      .in('id', userIds);

    if (!profiles) return;

    const map: Record<string, MemberProfile> = {};
    for (const p of profiles) {
      map[p.id] = {
        user_id: p.id,
        full_name: p.full_name,
        first_name: p.first_name,
        last_name: p.last_name,
        avatar_url: p.avatar_url,
        username: p.username,
      };
    }
    setMemberProfiles(map);
  }

  async function loadMessages() {
    const { data } = await supabase
      .from('workspace_messages')
      .select('id, role, content, agent_name, agent_role, user_id, created_at, metadata')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .limit(120);
    if (!mountedRef.current) return;
    const mapped = (data || []).map((m: { metadata?: { figures?: AgentFigures | null; chart_data?: ChartData | null } }) => {
      const meta = m.metadata;
      if (meta) {
        return { ...m, figures: meta.figures ?? null, chart_data: meta.chart_data ?? null } as Message;
      }
      return m as Message;
    });
    let didChange = false;
    setMessages(prev => {
      const existing = new Set(prev.map(m => m.id));
      const newMsgs = mapped.filter(m => !existing.has(m.id));
      if (newMsgs.length === 0) return prev;
      didChange = true;
      return [...prev, ...newMsgs];
    });
    if (didChange) {
      setInitialLoad(false);
    }
  }

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 200);
  };

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading || !user) return;

    setInput('');
    setLoading(true);
    broadcastTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    const optimisticUser: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      user_id: user.id,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticUser]);
    setTimeout(() => scrollToBottom(), 50);

    setSendError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const historyForApi = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180_000);

      let res: Response;
      try {
        res = await fetch(`${supabaseUrl}/functions/v1/workspace-ai-chat`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            workspace_id: workspaceId,
            message: content,
            history: historyForApi,
            documents: chatDocuments.map(d => ({ filename: d.filename, extractedText: d.extractedText })),
          }),
        });
      } finally {
        clearTimeout(timeout);
      }

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 429 || json.quota_exceeded) {
          if (json.plan === 'free' || json.included === 0) {
            setSendError("You've reached the free War Room session limit for this billing period. Upgrade to Pro for unlimited sessions.");
          } else {
            setSendError("You've reached the War Room session limit for this billing period.");
          }
        } else if (res.status === 401) {
          setSendError("Your session has expired. Please refresh the page and try again.");
        } else if (res.status === 504) {
          setSendError(json.error || "The AI agents took too long to respond. Please try again.");
        } else {
          console.error("workspace-ai-chat server error:", res.status, json.detail || json.error);
          setSendError(json.error || "The agents couldn't respond. Please try again in a moment.");
        }
        return;
      }

      if (json.war_room_usage) {
        onUsageUpdate?.(json.war_room_usage);
      }

      if (json.responses) {
        const chartData: ChartData | null = json.chart_data ?? null;
        const agentMsgs: Message[] = json.responses.map((r: { id?: string | null; agent_name: string; agent_role: string; content: string; figures?: AgentFigures | null }) => ({
          id: r.id ?? crypto.randomUUID(),
          role: 'assistant' as const,
          content: r.content,
          agent_name: r.agent_name,
          agent_role: r.agent_role,
          created_at: new Date().toISOString(),
          chart_data: r.agent_role === 'consensus' ? chartData : null,
          figures: r.figures ?? null,
        }));
        setMessages(prev => {
          const existing = new Set(prev.map(m => m.id));
          const deduped = agentMsgs.filter(m => !existing.has(m.id));
          return [...prev, ...deduped];
        });
        setTimeout(() => scrollToBottom(), 50);
        onAgentsReplied?.();

        // Dual-delivery: tell all peers to fetch the new agent messages. This
        // works even when their postgres_changes subscription is silently dead.
        broadcastChannelRef.current?.send({
          type: 'broadcast',
          event: 'new_message',
          payload: { user_id: user.id },
        });

        // Surface partial-round feedback so users know when later rounds didn't complete
        const completed: string[] = Array.isArray(json.rounds_completed) ? json.rounds_completed : [];
        if (completed.length > 0 && !completed.includes('round2')) {
          setSendError('The cross-challenge round could not be generated this time. Your initial analyses are shown below.');
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setSendError("The agents are taking longer than expected. Please try again — your question was saved.");
      } else {
        setSendError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  function broadcastTyping(isTyping: boolean) {
    console.log('[WorkspaceChat] broadcastTyping called:', { isTyping, hasChannel: !!broadcastChannelRef.current, hasUser: !!user });
    if (!broadcastChannelRef.current || !user) return;
    const profile = memberProfilesRef.current[user.id];
    const name = profile ? getDisplayName(profile) : 'Team member';
    broadcastChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: user.id, name, isTyping },
    });
    console.log('[WorkspaceChat] broadcastTyping sent:', { event: 'typing', user_id: user.id, name, isTyping });
  }

  function broadcastRecording(isRecording: boolean) {
    console.log('[WorkspaceChat] broadcastRecording called:', { isRecording, hasChannel: !!broadcastChannelRef.current, hasUser: !!user });
    if (!broadcastChannelRef.current || !user) return;
    const profile = memberProfilesRef.current[user.id];
    const name = profile ? getDisplayName(profile) : 'Team member';
    broadcastChannelRef.current.send({
      type: 'broadcast',
      event: 'recording',
      payload: { user_id: user.id, name, isRecording },
    });
    console.log('[WorkspaceChat] broadcastRecording sent:', { event: 'recording', user_id: user.id, name, isRecording });
  }

  const adjustTextarea = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';

    if (e.target.value.trim()) {
      broadcastTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => broadcastTyping(false), 2500);
    } else {
      broadcastTyping(false);
    }
  };

  function showRecordingError(msg: string) {
    setRecordingError(msg);
    if (recordingErrorTimerRef.current) clearTimeout(recordingErrorTimerRef.current);
    recordingErrorTimerRef.current = setTimeout(() => setRecordingError(null), 4000);
  }

  function drawWaveform() {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Sync canvas pixel size to its CSS layout size so bars fill the full width
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0) canvas.width = rect.width;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function render() {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser!.getByteFrequencyData(dataArray);

      // Re-sync width each frame in case layout changed
      const r = canvas!.getBoundingClientRect();
      if (r.width > 0 && canvas!.width !== r.width) canvas!.width = r.width;

      const { width, height } = canvas!;
      ctx!.clearRect(0, 0, width, height);

      const barCount = 28;
      const barWidth = 3;
      const gap = (width - barCount * barWidth) / (barCount + 1);
      const step = Math.floor(bufferLength / barCount);

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] / 255;
        const barHeight = Math.max(4, value * height * 0.85);
        const x = gap + i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        const alpha = 0.5 + value * 0.5;
        ctx!.fillStyle = `rgba(37,99,235,${alpha})`;
        ctx!.fillRect(x, y, barWidth, barHeight);
      }
    }
    render();
  }

  async function startRecording() {
    if (isRecording || isTranscribing || loading) return;
    setRecordingError(null);

    // Guard: getUserMedia requires HTTPS or localhost and a supported browser
    if (!navigator.mediaDevices?.getUserMedia) {
      showRecordingError('Voice recording is not supported in this browser or requires a secure (HTTPS) connection.');
      return;
    }

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setMicBlocked(true);
        setRecordingError('blocked');
      } else if (name === 'NotFoundError') {
        showRecordingError('No microphone found. Please connect a microphone and try again.');
      } else if (name === 'NotSupportedError') {
        showRecordingError('Voice recording is not supported on this device. Please use a text message instead.');
      } else {
        showRecordingError('Could not access microphone. Please try again.');
      }
      return;
    }

    // iOS Safari only supports audio/mp4; try it first, then fall back to webm/ogg
    const mimeType = MediaRecorder.isTypeSupported('audio/mp4')
      ? 'audio/mp4'
      : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';

    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach(t => t.stop());
      showRecordingError('Recording is not supported in this browser. Please try Safari 14.3+ or Chrome.');
      return;
    }

    // Wire up waveform analyser — optional, failure does not block recording
    analyserRef.current = null;
    try {
      const audioCtx = new AudioContext();
      // iOS requires AudioContext to be resumed after a user gesture
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      (recorder as MediaRecorder & { _audioCtx?: AudioContext })._audioCtx = audioCtx;
    } catch {
      // Waveform won't animate via canvas, will use fallback bars instead
      analyserRef.current = null;
    }

    audioChunksRef.current = [];
    mediaRecorderRef.current = recorder;
    const effectiveMime = mimeType || recorder.mimeType || 'audio/mp4';

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream!.getTracks().forEach(t => t.stop());
      const ac = (recorder as MediaRecorder & { _audioCtx?: AudioContext })._audioCtx;
      if (ac) ac.close();

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      setFallbackBars([]);

      const blob = new Blob(audioChunksRef.current, { type: effectiveMime });
      if (blob.size < 500) {
        setIsRecording(false);
        broadcastRecording(false);
        return;
      }
      setIsRecording(false);
      broadcastRecording(false);
      await uploadAndTranscribe(blob);
    };

    // Use a 250ms timeslice on iOS to ensure ondataavailable fires reliably
    recorder.start(250);
    setIsRecording(true);
    broadcastRecording(true);

    // Start the appropriate waveform visualisation
    if (analyserRef.current) {
      setTimeout(() => drawWaveform(), 50);
    } else {
      // Fallback: animate synthetic bars so the user knows recording is active
      startFallbackWaveform();
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }

  function startFallbackWaveform() {
    const BAR_COUNT = 20;
    fallbackTimerRef.current = setInterval(() => {
      setFallbackBars(Array.from({ length: BAR_COUNT }, () => 0.2 + Math.random() * 0.8));
    }, 80);
  }

  async function uploadAndTranscribe(blob: Blob) {
    setIsTranscribing(true);
    try {
      const file = await blobToMp3File(blob);
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const formData = new FormData();
      formData.append('audio', file);
      // Send the browser's locale so Whisper can use it as a language hint
      formData.append('language', navigator.language.split('-')[0]);

      const res = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        showRecordingError('Transcription failed. Please try again.');
        return;
      }

      const text = (json.text || '').trim();
      if (text) {
        setInput(text);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
            textareaRef.current.focus();
          }
        }, 50);
      }
    } catch {
      showRecordingError('Something went wrong. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  }

  async function processDocFile(file: File) {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const validType = ACCEPTED_DOC_MIME.includes(file.type) || ACCEPTED_DOC_EXT.includes(ext);
    if (!validType) {
      setDocErrors(prev => ({ ...prev, [file.name]: 'Only PDF and DOCX files are supported.' }));
      return;
    }
    if (file.size > MAX_DOC_SIZE) {
      setDocErrors(prev => ({ ...prev, [file.name]: 'File exceeds 10 MB limit.' }));
      return;
    }
    if (chatDocuments.length >= MAX_DOC_FILES) {
      setDocErrors(prev => ({ ...prev, [file.name]: `Maximum ${MAX_DOC_FILES} files per session.` }));
      return;
    }
    if (chatDocuments.some(d => d.filename === file.name)) {
      setDocErrors(prev => ({ ...prev, [file.name]: 'A file with this name is already added.' }));
      return;
    }

    setDocErrors(prev => { const n = { ...prev }; delete n[file.name]; return n; });
    setDocUploading(prev => [...prev, file.name]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${supabaseUrl}/functions/v1/extract-document`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setDocErrors(prev => ({ ...prev, [file.name]: json.error || 'Extraction failed. Try saving as PDF from Word.' }));
        return;
      }
      setChatDocuments(prev => [...prev, { ...json, size: file.size }]);
    } catch {
      setDocErrors(prev => ({ ...prev, [file.name]: 'Upload failed — check your connection and try again.' }));
    } finally {
      setDocUploading(prev => prev.filter(n => n !== file.name));
    }
  }

  function removeDoc(filename: string) {
    setChatDocuments(prev => prev.filter(d => d.filename !== filename));
    setDocErrors(prev => { const n = { ...prev }; delete n[filename]; return n; });
  }

  function renderUserAvatar(userId: string) {
    const profile = memberProfiles[userId];
    const isMe = userId === user?.id;
    const avatarUrl = profile ? getAvatarUrl(profile.avatar_url ?? null) : null;
    const name = profile ? getDisplayName(profile) : isMe ? 'You' : 'Member';
    const initials = getInitials(name);
    const colors = memberColor(userId);

    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={name}
          className="w-8 h-8 rounded-xl object-cover flex-shrink-0"
        />
      );
    }
    return (
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
        style={{ background: colors.bg, color: colors.text }}
      >
        {initials}
      </div>
    );
  }

  function getSenderName(userId: string) {
    const isMe = userId === user?.id;
    const profile = memberProfiles[userId];
    if (isMe) return 'You';
    return profile ? getDisplayName(profile) : 'Team member';
  }

  if (initialLoad) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2 mb-3">
        {messages.length > 0 && (
          <button
            onClick={() => exportChatToPDF(messages, workspaceName, workspaceTopic)}
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
            style={{ background: 'rgba(15,23,42,0.05)' }}
            title="Export discussion as PDF"
          >
            <Download className="w-3 h-3" /> Export PDF
          </button>
        )}
        <button
          onClick={() => { loadMessages(); loadMemberProfiles(); }}
          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
          style={{ background: 'rgba(15,23,42,0.05)' }}
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Message feed */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-0.5 lg:pr-1"
      >
        {priorContextCount > 0 && messages.length <= 4 && (
          <div
            className="rounded-xl border text-xs overflow-hidden transition-all"
            style={{
              background: 'var(--app-surface-raised)',
              borderColor: 'var(--app-border)',
            }}
          >
            <button
              onClick={() => setShowPriorContext(s => !s)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-black/[0.02]"
              style={{ color: 'var(--app-text-primary)' }}
            >
              <History className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--signal)' }} />
              <span className="font-semibold flex-1">
                Continuing from your last workspace
              </span>
              <span className="text-[11px] font-normal" style={{ color: 'var(--app-text-muted)' }}>
                {priorContextCount} prior {priorContextCount === 1 ? 'summary' : 'summaries'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showPriorContext ? 'rotate-180' : ''}`}
                style={{ color: 'var(--app-text-secondary)' }}
              />
            </button>
            {showPriorContext && (
              <div
                className="px-3 pb-3 pt-1 leading-relaxed"
                style={{ color: 'var(--app-text-secondary)' }}
              >
                AI advisors in this workspace have been given a compact summary of
                decisions, risks, and patterns from your previous workspaces. They may
                reference this context — even things you haven't said here — so you can
                pick up where you left off.
              </div>
            )}
          </div>
        )}
        {messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-8 px-2">
            <div
              className="w-12 h-12 flex items-center justify-center mb-4"
              style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
            >
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--app-text-primary)' }}>Start your War Room session</h3>
            <p className="text-xs mb-6 max-w-xs text-center leading-relaxed" style={{ color: 'var(--app-text-secondary)' }}>
              Write your own prompt or pick a suggestion. Seven specialist AI advisors will debate your decision.
            </p>

            <div className="w-full max-w-sm space-y-2 mb-5">
              {SUGGESTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.label}
                    onClick={() => { setInput(s.prompt); textareaRef.current?.focus(); }}
                    className="w-full flex items-start gap-3 p-3 text-left transition-all hover:scale-[1.02]"
                    style={{ background: 'var(--app-surface-raised)', border: '1px solid var(--app-border)', boxShadow: 'var(--shadow-sm)' }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: 'var(--signal)' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--app-text-primary)' }}>{s.label}</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>{s.prompt}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="w-full max-w-sm">
              <textarea
                autoFocus
                rows={3}
                value={input}
                onChange={adjustTextarea}
                onKeyDown={handleKeyDown}
                placeholder="Describe the decision you need help with…"
                className="w-full text-sm resize-none rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 transition-all"
                style={{
                  background: 'rgba(15,23,42,0.03)',
                  border: '1px solid rgba(15,23,42,0.1)',
                  color: 'var(--app-text-primary)',
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim()}
                className="btn-primary w-full mt-3 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ padding: '0.625rem 1rem', fontSize: '0.8125rem' }}
              >
                Brief the agents <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          (() => {
            let lastDateKey = '';
            return messages.map((msg) => {
              const dKey = dateKey(msg.created_at);
              const showDivider = dKey !== lastDateKey;
              lastDateKey = dKey;
              const dateDivider = showDivider ? (
                <div key={`date-${dKey}`} className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px" style={{ background: 'var(--app-border)' }} />
                  <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ color: 'var(--app-text-secondary)', background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    {formatDateDivider(msg.created_at)}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'var(--app-border)' }} />
                </div>
              ) : null;

            if (msg.role === 'user') {
              const isMe = msg.user_id === user?.id;
              const senderName = msg.user_id ? getSenderName(msg.user_id) : 'Member';
              const colors = msg.user_id ? memberColor(msg.user_id) : memberColor('default');

              return (
                <div key={msg.id}>
                  {dateDivider}
                  <div className={`flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && msg.user_id && (
                    <div className="flex-shrink-0 mb-0.5">
                      {renderUserAvatar(msg.user_id)}
                    </div>
                  )}
                  <div className={`flex flex-col max-w-[78%] ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span
                        className="text-xs font-semibold px-1"
                        style={{ color: isMe ? '#1d4ed8' : colors.text }}
                      >
                        {senderName}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatMessageTime(msg.created_at)}</span>
                    </div>
                    <div
                      className="px-4 py-3"
                      style={
                        isMe
                          ? { background: 'var(--ink-900)', color: 'var(--ink-50)', borderRadius: '4px 4px 1px 4px' }
                          : { background: colors.bg, color: 'var(--app-text-primary)', border: `1px solid ${colors.border}`, borderRadius: '4px 4px 4px 1px' }
                      }
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                  {isMe && msg.user_id && (
                    <div className="flex-shrink-0 mb-0.5">
                      {renderUserAvatar(msg.user_id)}
                    </div>
                  )}
                  </div>
                </div>
              );
            }

            const role = msg.agent_role || '';
            const isChallengeRole = role.endsWith('_challenge');
            const baseRole = isChallengeRole ? role.replace(/_challenge$/, '') : role;
            const colors = AGENT_COLORS[role] ?? AGENT_COLORS[baseRole] ?? { bg: 'rgba(15,23,42,0.05)', text: '#475569', border: 'rgba(15,23,42,0.1)' };
            const abbr = AGENT_ABBR[role] ?? AGENT_ABBR[baseRole] ?? baseRole.slice(0, 2).toUpperCase();
            const isConsensus = role === 'consensus';
            const phase = isConsensus ? 'consensus' : isChallengeRole ? 'challenge' : detectPhase(msg.content);

            if (isConsensus) {
              return (
                <div key={msg.id}>
                  {dateDivider}
                  <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(15,23,42,0.12)', background: 'rgba(15,23,42,0.02)' }}>
                    <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(15,23,42,0.05)', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: '#0f172a' }}>
                        <span className="text-white font-black" style={{ fontSize: '8px', letterSpacing: '0.02em' }}>C</span>
                      </div>
                      <span className="text-xs font-black tracking-wide uppercase agent-name-text" style={{ '--agent-color': '#0f172a' } as React.CSSProperties}>Consensus</span>
                      <span className="text-xs ml-auto" style={{ color: '#64748b' }}>{formatMessageTime(msg.created_at)}</span>
                    </div>
                    <div className="px-4 py-3 overflow-hidden">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--app-text-primary)' }}>{msg.content}</p>
                      {msg.chart_data && <ConsensusCharts data={msg.chart_data} />}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id}>
                {dateDivider}
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 flex-none"
                    style={{ background: colors.text, border: `1px solid ${colors.border}` }}
                  >
                    <span className="text-white font-black" style={{ fontSize: '10px', letterSpacing: '0.02em' }}>{abbr}</span>
                  </div>
                  <div className="max-w-[85%]">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-bold agent-name-text" style={{ '--agent-color': colors.text } as React.CSSProperties}>{msg.agent_name}</p>
                      <span className="text-[10px] text-slate-400">{formatMessageTime(msg.created_at)}</span>
                      {phase === 'challenge' && (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(234,88,12,0.1)', color: '#c2410c' }}>challenges</span>
                      )}
                    </div>
                    <div
                      className="rounded-2xl rounded-tl-md px-4 py-3 overflow-hidden"
                      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--app-text-primary)' }}>{msg.content}</p>
                      {msg.figures && <ConsensusCharts data={null} figures={msg.figures} />}
                    </div>
                  </div>
                </div>
              </div>
            );
            });
          })()
        )}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(15,23,42,0.05)' }}>
              <Bot className="w-4 h-4 text-slate-400" />
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(15,23,42,0.05)' }}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs font-semibold text-slate-500">War Room in session</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['R1: Independent analysis', 'R2: Cross-challenge']).map((phase, i) => (
                  <span
                    key={phase}
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: i === 0 ? 'rgba(37,99,235,0.08)' : 'rgba(220,38,38,0.07)',
                      color: i === 0 ? '#1d4ed8' : '#b91c1c',
                    }}
                  >
                    {phase}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-20 right-4 lg:bottom-24 lg:right-6 w-8 h-8 flex items-center justify-center shadow-lg transition-all hover:opacity-80 z-10"
          style={{ background: 'var(--app-surface-raised)', border: '1px solid var(--app-border)', color: 'var(--app-text-secondary)' }}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}

      {/* Typing & recording indicators */}
      {(typingUsers.size > 0 || recordingUsers.size > 0) && (
        <div className="flex flex-col gap-1 mt-2 mb-1 px-1">
          {recordingUsers.size > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-slate-500">
                {Array.from(recordingUsers.values()).join(', ')} {recordingUsers.size === 1 ? 'is' : 'are'} recording a voice note…
              </span>
            </div>
          )}
          {typingUsers.size > 0 && (
            <div className="flex items-center gap-2">
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
        </div>
      )}

      {/* Document pills above input */}
      {(chatDocuments.length > 0 || docUploading.length > 0 || Object.keys(docErrors).length > 0) && (
        <div className="mt-2 space-y-1.5">
          {chatDocuments.map(doc => (
            <div
              key={doc.filename}
              className="flex items-center gap-2.5 px-3 py-2"
              style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
            >
              <FileText className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              <span className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--app-text-primary)' }}>{doc.filename}</span>
              <span className="text-xs text-slate-400 flex-shrink-0">{formatBytes(doc.size)} · {doc.wordCount.toLocaleString()} words</span>
              <button
                onClick={() => removeDoc(doc.filename)}
                className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {docUploading.map(name => (
            <div
              key={name}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.08)' }}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 flex-shrink-0" />
              <span className="text-xs text-slate-500 truncate">Extracting {name}…</span>
            </div>
          ))}
          {Object.entries(docErrors).map(([name, msg]) => (
            <div
              key={name}
              className="flex items-start gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}
            >
              <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-red-700 truncate">{name}</p>
                <p className="text-xs text-red-600">{msg}</p>
              </div>
              <button onClick={() => setDocErrors(prev => { const n = { ...prev }; delete n[name]; return n; })} className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {chatDocuments.length > 0 && (
            <div className="flex items-center gap-1.5 px-1">
              <Shield className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <p className="text-xs text-slate-400">Documents are used for this session only and are not stored.</p>
            </div>
          )}
        </div>
      )}

      {/* Error banner */}
      {sendError && (
        <div className="mt-2 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm" style={{ background: 'rgba(254,226,226,0.9)', border: '1px solid #fca5a5', color: '#7f1d1d' }}>
          <span className="flex-1">{sendError}</span>
          <button onClick={() => setSendError(null)} className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors">✕</button>
        </div>
      )}

      {/* Input area */}
      <div
        className="mt-2 p-2.5 sm:p-3 flex items-end gap-2 sm:gap-3"
        style={{ background: 'var(--app-surface-raised)', border: `1.5px solid ${isRecording ? 'var(--negative)' : 'var(--app-border)'}`, boxShadow: 'var(--shadow-sm)', transition: 'border-color 0.2s' }}
      >
        {isTranscribing ? (
          /* Transcribing overlay */
          <div className="flex-1 flex items-center gap-2.5 py-1">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
            <span className="text-sm text-slate-500 font-medium">Transcribing your thoughts…</span>
          </div>
        ) : isRecording ? (
          /* Waveform visualiser — canvas when AnalyserNode is available, animated bars on iOS */
          <div className="flex-1 flex items-center gap-2.5 min-w-0 py-0.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            {analyserRef.current ? (
              <canvas
                ref={canvasRef}
                height={36}
                className="flex-1 w-full"
                style={{ maxHeight: '36px', minWidth: 0 }}
              />
            ) : (
              /* Fallback animated bars for iOS / browsers without AnalyserNode */
              <div className="flex-1 flex items-end justify-center gap-[3px] h-9 min-w-0">
                {fallbackBars.map((h, i) => (
                  <div
                    key={i}
                    className="rounded-full flex-1 transition-all duration-75"
                    style={{
                      height: `${Math.round(h * 100)}%`,
                      minWidth: '3px',
                      maxWidth: '6px',
                      background: `rgba(232,184,75,${0.35 + h * 0.65})`,
                    }}
                  />
                ))}
              </div>
            )}
            <span className="text-xs font-semibold text-slate-500 flex-shrink-0">REC</span>
          </div>
        ) : (
          /* Normal textarea */
          <textarea
            ref={textareaRef}
            value={input}
            onChange={adjustTextarea}
            onKeyDown={handleKeyDown}
            placeholder={`Ask the AI agents about ${workspaceName}…`}
            rows={1}
            disabled={loading}
            className="flex-1 resize-none bg-transparent text-sm focus:outline-none disabled:opacity-60" style={{ color: 'var(--app-text-primary)' }}
            style={{ lineHeight: '1.5', maxHeight: '120px' }}
          />
        )}

        {/* Paperclip / document upload button */}
        {!isTranscribing && !isRecording && isPro && chatDocuments.length < MAX_DOC_FILES && docUploading.length === 0 && (
          <>
            <button
              onClick={() => docInputRef.current?.click()}
              disabled={loading}
              title="Attach PDF or DOCX document"
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 hover:scale-105"
              style={{ background: 'rgba(15,23,42,0.06)', border: '1.5px solid rgba(15,23,42,0.1)' }}
            >
              <Paperclip className="w-4 h-4 text-slate-500" />
            </button>
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.docx"
              multiple
              className="hidden"
              onChange={e => {
                if (e.target.files) {
                  Array.from(e.target.files).forEach(f => processDocFile(f));
                  e.target.value = '';
                }
              }}
            />
          </>
        )}

        {/* Mic button */}
        {!isTranscribing && (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={loading}
            title={
              micBlocked
                ? 'Microphone blocked — click to see how to fix'
                : isRecording
                  ? 'Stop recording'
                  : 'Record voice message'
            }
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 hover:scale-105"
            style={isRecording
              ? { background: 'rgba(220,38,38,0.1)', border: '1.5px solid rgba(220,38,38,0.4)', boxShadow: '0 0 0 3px rgba(220,38,38,0.12)' }
              : micBlocked
                ? { background: 'rgba(220,38,38,0.07)', border: '1.5px solid rgba(220,38,38,0.25)' }
                : { background: 'rgba(15,23,42,0.06)', border: '1.5px solid rgba(15,23,42,0.1)' }
            }
          >
            {isRecording
              ? <Square className="w-3.5 h-3.5 text-red-600" />
              : <Mic className={`w-4 h-4 ${micBlocked ? 'text-red-400' : 'text-slate-500'}`} />
            }
          </button>
        )}

        {/* Send button */}
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim() || isRecording || isTranscribing}
          className="w-9 h-9 flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 hover:opacity-80"
          style={{ background: 'var(--signal)', color: 'var(--ink-950)' }}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          ) : (
            <Send className="w-4 h-4 text-white" />
          )}
        </button>
      </div>

      {/* Mic blocked banner — persistent, actionable */}
      {(micBlocked || recordingError === 'blocked') && (
        <div
          className="mt-2 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5"
          style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.18)' }}
        >
          <Mic className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-red-700 leading-snug">Microphone access is blocked</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">
              Your browser has blocked mic access for this site. To fix it:
            </p>
            <ol className="text-xs text-slate-600 mt-1 space-y-0.5 list-decimal list-inside leading-snug">
              <li>Click the <strong>lock / info icon</strong> in your browser's address bar</li>
              <li>Find <strong>Microphone</strong> and change it to <strong>Allow</strong></li>
              <li>Reload the page and try again</li>
            </ol>
          </div>
          <button
            onClick={() => { setMicBlocked(false); setRecordingError(null); }}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition p-0.5"
          >
            <span className="sr-only">Dismiss</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {!micBlocked && recordingError && recordingError !== 'blocked' ? (
        <p className="text-center text-xs text-red-500 mt-2">{recordingError}</p>
      ) : !micBlocked && (
        <p className="text-center text-xs text-slate-400 mt-2">
          {isRecording ? 'Recording… tap the stop button when done' : 'Press Enter to send · Shift+Enter for new line'}
        </p>
      )}
    </div>
  );
}
