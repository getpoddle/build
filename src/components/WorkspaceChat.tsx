import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, Loader2, Sparkles, RefreshCw, ChevronDown, Download, Mic, Square, Paperclip, FileText, X, Shield, AlertCircle, ArrowRight, Target, Database, AlertTriangle as StakesIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { acquireChannel, releaseChannel, pauseChannel, resumeChannel } from '../lib/realtimeRegistry';
import { useAuth } from '../contexts/AuthContext';
import { exportChatToPDF } from '../lib/pdfExport';
import { getDisplayName } from '../lib/displayName';
import { getAvatarUrl, getInitials } from '../lib/avatarUtils';
import { blobToMp3File } from '../lib/audioUtils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent_name?: string;
  agent_role?: string;
  user_id?: string | null;
  created_at: string;
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

const INTAKE_STEPS = [
  {
    icon: Target,
    label: 'The decision',
    question: 'What specific decision are you trying to make?',
    hint: 'Be precise — "Should we acquire Company X for $4M?" beats "Should we grow?"',
    placeholder: 'e.g. Should we launch in the EU market before Series B, or wait until we\'ve hit $2M ARR domestically?',
    skippable: false,
  },
  {
    icon: Database,
    label: 'Your data',
    question: 'What information or data do you already have?',
    hint: 'Financial projections, market research, customer feedback, competitor analysis...',
    placeholder: 'e.g. 18 months of revenue data showing 12% MoM growth, 3 customer interviews, a competitive analysis from last quarter...',
    skippable: true,
    skipLabel: 'Working from assumptions',
  },
  {
    icon: StakesIcon,
    label: 'The stakes',
    question: 'What is the cost of getting this wrong?',
    hint: 'Financial loss, runway consumed, strategic position, competitive risk...',
    placeholder: 'e.g. A wrong call here burns $800K and 8 months of runway — we can\'t recover before the next raise.',
    skippable: false,
  },
];

function getIntakeStorageKey(workspaceId: string) {
  return `poddle_intake_done_${workspaceId}`;
}

export default function WorkspaceChat({ workspaceId, workspaceName, workspaceTopic, initialPrompt, onPromptConsumed, onAgentsReplied, isPro, onUpgrade, onUsageUpdate }: WorkspaceChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, MemberProfile>>({});

  // ── Intake state ─────────────────────────────────────────────────────────────
  const [intakeStep, setIntakeStep] = useState(0);
  const [intakeAnswers, setIntakeAnswers] = useState(['', '', '']);
  const [intakeDone, setIntakeDone] = useState(() =>
    typeof window !== 'undefined'
      ? localStorage.getItem(getIntakeStorageKey(workspaceId)) === 'true'
      : true
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
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
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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

    const msgName = `workspace-messages-${workspaceId}`;
    const presenceName = `workspace-presence-${workspaceId}`;

    // Acquire via singleton registry — reuses an existing channel if another
    // component or tab has already opened it, preventing duplicate WebSocket slots.
    acquireChannel(msgName, ch =>
      ch.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workspace_messages', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.role === 'user' && newMsg.user_id === user?.id) return;
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
            return [...prev, newMsg];
          });
          setTimeout(() => scrollToBottom(), 50);
        },
      ),
    );

    const presenceCh = acquireChannel(presenceName, ch =>
      ch.on('presence', { event: 'sync' }, () => {
        const channel = ch as ReturnType<typeof supabase.channel>;
        const state = channel.presenceState<{ user_id: string; name: string; isTyping: boolean }>();
        const next = new Map<string, string>();
        for (const [, presences] of Object.entries(state)) {
          for (const p of presences) {
            if (p.user_id !== user?.id && p.isTyping) next.set(p.user_id, p.name);
          }
        }
        setTypingUsers(next);
      }),
    );
    presenceChannelRef.current = presenceCh as ReturnType<typeof supabase.channel> | null;

    // Pause channels when the tab is hidden; resume when visible again.
    // This cuts server broadcast load to zero while the user isn't looking.
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        pauseChannel(msgName);
        pauseChannel(presenceName);
      } else {
        resumeChannel(msgName);
        resumeChannel(presenceName);
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseChannel(msgName);
      releaseChannel(presenceName);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
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
    if (!fetching) scrollToBottom(false);
  }, [fetching, scrollToBottom]);

  // When an initialPrompt arrives after chat is loaded, pre-fill and auto-send
  useEffect(() => {
    if (!initialPrompt || fetching) return;
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
  }, [initialPrompt, fetching]);

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
    setFetching(true);
    const { data } = await supabase
      .from('workspace_messages')
      .select('id, role, content, agent_name, agent_role, user_id, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .limit(120);
    setMessages(data || []);
    setFetching(false);
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
      const timeout = setTimeout(() => controller.abort(), 90_000);

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
        } else {
          setSendError(json.error || "The agents couldn't respond. Please try again in a moment.");
        }
        return;
      }

      if (json.war_room_usage) {
        onUsageUpdate?.(json.war_room_usage);
      }

      if (json.responses) {
        const agentMsgs: Message[] = json.responses.map((r: { agent_name: string; agent_role: string; content: string }) => ({
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: r.content,
          agent_name: r.agent_name,
          agent_role: r.agent_role,
          created_at: new Date().toISOString(),
        }));
        setMessages(prev => [...prev, ...agentMsgs]);
        setTimeout(() => scrollToBottom(), 50);
        onAgentsReplied?.();
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

  function submitIntake() {
    const [decision, data, stakes] = intakeAnswers;
    const lines: string[] = ['DECISION BRIEF', ''];
    lines.push(`Decision to make: ${decision.trim()}`);
    if (data.trim()) {
      lines.push('');
      lines.push(`Available data and context: ${data.trim()}`);
    }
    lines.push('');
    lines.push(`Cost of getting this wrong: ${stakes.trim()}`);
    const brief = lines.join('\n');

    localStorage.setItem(getIntakeStorageKey(workspaceId), 'true');
    setIntakeDone(true);

    // If the workspace description is empty or very short, enrich it with the decision
    if ((!workspaceTopic || workspaceTopic.trim().length < 30) && decision.trim()) {
      supabase.from('workspaces')
        .update({ description: decision.trim().slice(0, 500) })
        .eq('id', workspaceId)
        .then(() => {/* best-effort */});
    }

    sendMessage(brief);
  }

  function intakeAdvance() {
    const step = INTAKE_STEPS[intakeStep];
    const answer = intakeAnswers[intakeStep].trim();
    if (!step.skippable && !answer) return;
    if (intakeStep < INTAKE_STEPS.length - 1) {
      setIntakeStep(s => s + 1);
    } else {
      submitIntake();
    }
  }

  function intakeSkip() {
    setIntakeAnswers(prev => { const next = [...prev]; next[intakeStep] = ''; return next; });
    if (intakeStep < INTAKE_STEPS.length - 1) {
      setIntakeStep(s => s + 1);
    } else {
      submitIntake();
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  function broadcastTyping(isTyping: boolean) {
    if (!presenceChannelRef.current || !user) return;
    const profile = memberProfilesRef.current[user.id];
    const name = profile ? getDisplayName(profile) : 'Team member';
    presenceChannelRef.current.track({ user_id: user.id, name, isTyping });
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
        return;
      }
      setIsRecording(false);
      await uploadAndTranscribe(blob);
    };

    // Use a 250ms timeslice on iOS to ensure ondataavailable fires reliably
    recorder.start(250);
    setIsRecording(true);

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

  if (fetching) {
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
        {messages.length === 0 && !loading ? (
          intakeDone || initialPrompt ? (
            /* Intake already done or prompt injected externally — show legacy starters */
            <div className="text-center py-12">
              <div
                className="w-14 h-14 flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
              >
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">Continue the conversation</h3>
              <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed mb-6">
                Seven specialist AI advisors will analyse your question across three rigorous debate rounds.
              </p>
            </div>
          ) : (
            /* ── Intake form ─────────────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center py-8 px-2">
              {/* Header */}
              <div
                className="w-12 h-12 flex items-center justify-center mb-4"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
              >
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--app-text-primary)' }}>Submit decision briefing</h3>
              <p className="text-xs mb-6 max-w-xs text-center leading-relaxed" style={{ color: 'var(--app-text-secondary)' }}>
                Three structured inputs. Seven specialist advisors will analyse the decision across independent debate rounds.
              </p>

              {/* Progress dots */}
              <div className="flex items-center gap-2 mb-6">
                {INTAKE_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all"
                    style={{
                      width: i === intakeStep ? '20px' : '6px',
                      height: '4px',
                      background: i <= intakeStep ? 'var(--signal)' : 'var(--app-border)',
                      borderRadius: '1px',
                    }}
                  />
                ))}
              </div>

              {/* Question card */}
              <div
                className="w-full max-w-sm p-5"
                style={{ background: 'var(--app-surface-raised)', border: '1px solid var(--app-border)', boxShadow: 'var(--shadow-sm)' }}
              >
                {(() => {
                  const step = INTAKE_STEPS[intakeStep];
                  const StepIcon = step.icon;
                  return (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                        >
                          <StepIcon className="w-3.5 h-3.5" style={{ color: 'var(--signal)' }} />
                        </div>
                        <span className="section-label">{step.label}</span>
                        <span className="ml-auto text-xs text-slate-400 font-medium">{intakeStep + 1} / {INTAKE_STEPS.length}</span>
                      </div>

                      <p className="text-sm font-medium mb-1 leading-snug" style={{ color: 'var(--app-text-primary)' }}>{step.question}</p>
                      <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>{step.hint}</p>

                      <textarea
                        autoFocus
                        rows={3}
                        value={intakeAnswers[intakeStep]}
                        onChange={e => setIntakeAnswers(prev => { const next = [...prev]; next[intakeStep] = e.target.value; return next; })}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            intakeAdvance();
                          }
                        }}
                        placeholder={step.placeholder}
                        className="w-full text-sm text-slate-700 placeholder-slate-300 resize-none rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 transition-all"
                        style={{
                          background: 'rgba(15,23,42,0.03)',
                          border: '1px solid rgba(15,23,42,0.1)',
                          focusRingColor: '#2563eb',
                        }}
                      />

                      <div className="flex items-center gap-2 mt-3">
                        {step.skippable && (
                          <button
                            onClick={intakeSkip}
                            className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-2 py-1"
                          >
                            {step.skipLabel}
                          </button>
                        )}
                        <button
                          onClick={intakeAdvance}
                          disabled={!step.skippable && !intakeAnswers[intakeStep].trim()}
                          className="btn-primary ml-auto disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ padding: '0.4rem 0.875rem', fontSize: '0.8125rem' }}
                        >
                          {intakeStep < INTAKE_STEPS.length - 1 ? (
                            <>Continue <ArrowRight className="w-3.5 h-3.5" /></>
                          ) : (
                            <>Brief the agents <Sparkles className="w-3.5 h-3.5" /></>
                          )}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>

              <p className="text-xs text-slate-400 mt-4 text-center">
                Press <kbd className="bg-slate-100 rounded px-1 py-0.5 text-slate-500 font-mono text-[10px]">Cmd+Enter</kbd> to advance
              </p>
            </div>
          )
        ) : (
          messages.map((msg) => {
            if (msg.role === 'user') {
              const isMe = msg.user_id === user?.id;
              const senderName = msg.user_id ? getSenderName(msg.user_id) : 'Member';
              const colors = msg.user_id ? memberColor(msg.user_id) : memberColor('default');

              return (
                <div key={msg.id} className={`flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && msg.user_id && (
                    <div className="flex-shrink-0 mb-0.5">
                      {renderUserAvatar(msg.user_id)}
                    </div>
                  )}
                  <div className={`flex flex-col max-w-[78%] ${isMe ? 'items-end' : 'items-start'}`}>
                    <span
                      className="text-xs font-semibold mb-1 px-1"
                      style={{ color: isMe ? '#1d4ed8' : colors.text }}
                    >
                      {senderName}
                    </span>
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
              );
            }

            const role = msg.agent_role || '';
            const colors = AGENT_COLORS[role] ?? { bg: 'rgba(15,23,42,0.05)', text: '#475569', border: 'rgba(15,23,42,0.1)' };
            const abbr = AGENT_ABBR[role] ?? role.slice(0, 2).toUpperCase();
            const isConsensus = role === 'consensus';
            const phase = isConsensus ? 'consensus' : detectPhase(msg.content);

            if (isConsensus) {
              return (
                <div key={msg.id} className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(15,23,42,0.12)', background: 'rgba(15,23,42,0.02)' }}>
                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(15,23,42,0.05)', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                    <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: '#0f172a' }}>
                      <span className="text-white font-black" style={{ fontSize: '8px', letterSpacing: '0.02em' }}>C</span>
                    </div>
                    <span className="text-xs font-black tracking-wide uppercase" style={{ color: '#0f172a' }}>Consensus</span>
                    <span className="text-xs ml-auto" style={{ color: '#64748b' }}>Agents reached alignment</span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 flex-none"
                  style={{ background: colors.text, border: `1px solid ${colors.border}` }}
                >
                  <span className="text-white font-black" style={{ fontSize: '10px', letterSpacing: '0.02em' }}>{abbr}</span>
                </div>
                <div className="max-w-[85%]">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-bold" style={{ color: colors.text }}>{msg.agent_name}</p>
                    {phase === 'challenge' && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(234,88,12,0.1)', color: '#c2410c' }}>challenges</span>
                    )}
                  </div>
                  <div
                    className="rounded-2xl rounded-tl-md px-4 py-3"
                    style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
                  >
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            );
          })
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
                {(['R1: Independent analysis', 'R2: Cross-challenge', 'R3: Consensus']).map((phase, i) => (
                  <span
                    key={phase}
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: i === 0 ? 'rgba(37,99,235,0.08)' : i === 1 ? 'rgba(220,38,38,0.07)' : 'rgba(5,150,105,0.08)',
                      color: i === 0 ? '#1d4ed8' : i === 1 ? '#b91c1c' : '#065f46',
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

      {/* Typing indicator */}
      {typingUsers.size > 0 && (
        <div className="flex items-center gap-2 mt-2 mb-1 px-1">
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
              <span className="text-xs font-semibold text-slate-700 truncate flex-1">{doc.filename}</span>
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
            className="flex-1 resize-none bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none disabled:opacity-60"
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
