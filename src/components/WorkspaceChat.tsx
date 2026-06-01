import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, Loader2, Sparkles, RefreshCw, ChevronDown, Download, Mic, Square } from 'lucide-react';
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

interface WorkspaceChatProps {
  workspaceId: string;
  workspaceName: string;
  workspaceTopic?: string;
  initialPrompt?: string;
  onPromptConsumed?: () => void;
  onAgentsReplied?: () => void;
}

const AGENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  strategic_analyst: { bg: 'rgba(37,99,235,0.07)', text: '#1d4ed8', border: 'rgba(37,99,235,0.15)' },
  devils_advocate:   { bg: 'rgba(220,38,38,0.07)',  text: '#b91c1c', border: 'rgba(220,38,38,0.15)' },
  innovation_scout:  { bg: 'rgba(16,185,129,0.07)', text: '#065f46', border: 'rgba(16,185,129,0.15)' },
};

const AGENT_ICONS: Record<string, string> = {
  strategic_analyst: '📊',
  devils_advocate:   '⚔️',
  innovation_scout:  '🔭',
};

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

const STARTER_PROMPTS = [
  'What are the biggest risks we should address first?',
  'What would a competitor do to undercut our strategy?',
  'What assumptions are we making that could be wrong?',
  'What are the top 3 opportunities we might be overlooking?',
];

export default function WorkspaceChat({ workspaceId, workspaceName, workspaceTopic, initialPrompt, onPromptConsumed, onAgentsReplied }: WorkspaceChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, MemberProfile>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
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
  const recordingErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Keep a ref in sync so realtime callbacks can read current profiles without re-subscribing
  useEffect(() => {
    memberProfilesRef.current = memberProfiles;
  }, [memberProfiles]);

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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const historyForApi = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(`${supabaseUrl}/functions/v1/workspace-ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ workspace_id: workspaceId, message: content, history: historyForApi }),
      });

      const json = await res.json();
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
    } catch {
      // silently fail — user message still visible
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

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function render() {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser!.getByteFrequencyData(dataArray);

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

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        showRecordingError('Microphone access denied. Please allow microphone access and try again.');
      } else if (name === 'NotFoundError') {
        showRecordingError('No microphone found. Please connect a microphone and try again.');
      } else {
        showRecordingError('Could not access microphone. Please try again.');
      }
      return;
    }

    // Determine supported mime type
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
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
      showRecordingError('Recording is not supported in this browser. Please try Chrome or Firefox.');
      return;
    }

    // Wire up waveform analyser — optional, failure does not block recording
    try {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Store audioCtx on recorder so onstop can close it
      (recorder as MediaRecorder & { _audioCtx?: AudioContext })._audioCtx = audioCtx;
    } catch {
      // Waveform won't show but recording still works
      analyserRef.current = null;
    }

    audioChunksRef.current = [];
    mediaRecorderRef.current = recorder;
    const effectiveMime = mimeType || 'audio/webm';

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

      const blob = new Blob(audioChunksRef.current, { type: effectiveMime });
      if (blob.size < 500) {
        setIsRecording(false);
        return;
      }
      setIsRecording(false);
      await uploadAndTranscribe(blob);
    };

    recorder.start(100);
    setIsRecording(true);
    setTimeout(() => drawWaveform(), 50);
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }

  async function uploadAndTranscribe(blob: Blob) {
    setIsTranscribing(true);
    try {
      const file = await blobToMp3File(blob);
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const formData = new FormData();
      formData.append('audio', file);

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
      {/* Agent legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(AGENT_COLORS).map(([role, colors]) => (
          <span
            key={role}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
          >
            <span>{AGENT_ICONS[role]}</span>
            {role === 'strategic_analyst' ? 'Strategic Analyst' : role === 'devils_advocate' ? "Devil's Advocate" : 'Innovation Scout'}
          </span>
        ))}
        <div className="ml-auto flex items-center gap-2">
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
      </div>

      {/* Message feed */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-auto space-y-4 pr-1"
        style={{ minHeight: '320px', height: 'clamp(320px, calc(100vh - 380px), 600px)' }}
      >
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div
              className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
            >
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">Start a collaboration</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed mb-6">
              Ask the AI agents anything about your workspace topic. Three specialist agents will each give their perspective.
            </p>
            <div className="grid grid-cols-1 gap-2 max-w-sm mx-auto">
              {STARTER_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="text-left px-4 py-2.5 rounded-xl text-sm text-slate-700 font-medium hover:bg-white transition-all border"
                  style={{ borderColor: 'rgba(15,23,42,0.1)', background: 'rgba(255,255,255,0.7)' }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
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
                      className="rounded-2xl px-4 py-3"
                      style={
                        isMe
                          ? { background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', color: '#fff', borderRadius: '18px 18px 4px 18px' }
                          : { background: colors.bg, color: '#1e293b', border: `1px solid ${colors.bg}`, borderRadius: '18px 18px 18px 4px' }
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

            const colors = AGENT_COLORS[msg.agent_role || ''] ?? { bg: 'rgba(15,23,42,0.05)', text: '#475569', border: 'rgba(15,23,42,0.1)' };
            const icon = AGENT_ICONS[msg.agent_role || ''] ?? '🤖';

            return (
              <div key={msg.id} className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
                  style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
                >
                  {icon}
                </div>
                <div className="max-w-[85%]">
                  <p className="text-xs font-bold mb-1" style={{ color: colors.text }}>{msg.agent_name}</p>
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
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
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
          className="absolute bottom-24 right-6 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
          style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', color: '#fff' }}
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

      {/* Input area */}
      <div
        className="mt-2 rounded-2xl p-3 flex items-end gap-3"
        style={{ background: '#fff', border: `1.5px solid ${isRecording ? 'rgba(220,38,38,0.35)' : 'rgba(37,99,235,0.2)'}`, boxShadow: isRecording ? '0 4px 16px rgba(220,38,38,0.1)' : '0 4px 16px rgba(37,99,235,0.08)', transition: 'border-color 0.2s, box-shadow 0.2s' }}
      >
        {isTranscribing ? (
          /* Transcribing overlay */
          <div className="flex-1 flex items-center gap-2.5 py-1">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
            <span className="text-sm text-slate-500 font-medium">Transcribing your thoughts…</span>
          </div>
        ) : isRecording ? (
          /* Waveform canvas */
          <div className="flex-1 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <canvas
              ref={canvasRef}
              width={220}
              height={36}
              className="flex-1"
              style={{ maxHeight: '36px' }}
            />
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

        {/* Mic button */}
        {!isTranscribing && (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={loading}
            title={isRecording ? 'Stop recording' : 'Record voice message'}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 hover:scale-105"
            style={isRecording
              ? { background: 'rgba(220,38,38,0.1)', border: '1.5px solid rgba(220,38,38,0.4)', boxShadow: '0 0 0 3px rgba(220,38,38,0.12)' }
              : { background: 'rgba(15,23,42,0.06)', border: '1.5px solid rgba(15,23,42,0.1)' }
            }
          >
            {isRecording
              ? <Square className="w-3.5 h-3.5 text-red-600" />
              : <Mic className="w-4 h-4 text-slate-500" />
            }
          </button>
        )}

        {/* Send button */}
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim() || isRecording || isTranscribing}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 hover:scale-105"
          style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          ) : (
            <Send className="w-4 h-4 text-white" />
          )}
        </button>
      </div>
      {recordingError ? (
        <p className="text-center text-xs text-red-500 mt-2">{recordingError}</p>
      ) : (
        <p className="text-center text-xs text-slate-400 mt-2">
          {isRecording ? 'Recording… tap the stop button when done' : 'Press Enter to send · Shift+Enter for new line'}
        </p>
      )}
    </div>
  );
}
