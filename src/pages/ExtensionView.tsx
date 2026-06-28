import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Sparkles, LogIn, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-agents`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function invokeAskAgents(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(FUNCTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON_KEY}`,
      Apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((payload.error as string) || `Request failed (${res.status})`);
  }
  return payload;
}

const EXTENSION_ORIGIN_PREFIX = 'chrome-extension://';
const PODDLE_ORIGIN = window.location.origin;

const POLL_INTERVAL_MS = 1500;
const INITIAL_POLL_DELAY_MS = 1200;
const MAX_QUESTION_CHARS = 400;

interface IncomingContent {
  text: string;
  title: string;
  url: string;
}

interface Turn {
  agent_name: string;
  display_name: string;
  content: string;
  turn_number: number;
}

interface PanelAgent {
  agent_name: string;
  display_name: string;
}

type Status = 'idle' | 'running' | 'completed' | 'failed';

const AGENT_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'The Skeptic':    { bg: '#1a0a0a', text: '#fca5a5', border: '#7f1d1d', dot: '#ef4444' },
  'Risk Analyst':   { bg: '#1a0f06', text: '#fdba74', border: '#7c2d12', dot: '#f97316' },
  'The Optimist':   { bg: '#061a0e', text: '#86efac', border: '#14532d', dot: '#22c55e' },
  'Data Detective': { bg: '#06101a', text: '#93c5fd', border: '#1e3a5f', dot: '#3b82f6' },
  'The Pragmatist': { bg: '#0f1117', text: '#cbd5e1', border: '#334155', dot: '#94a3b8' },
};

function getAgentStyle(name: string) {
  return AGENT_STYLES[name] ?? AGENT_STYLES['The Pragmatist'];
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function ExtensionView() {
  const { user, loading: authLoading } = useAuth();

  const [sourceUrl, setSourceUrl] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [contentReceived, setContentReceived] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [panel, setPanel] = useState<PanelAgent[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [tlDr, setTlDr] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState('');

  const sessionIdRef = useRef<string>('');
  const discussionIdRef = useRef<string>('');
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const readyPostedRef = useRef(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Parse source_url from query string
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const src = params.get('source_url');
    if (src) setSourceUrl(src);
  }, []);

  // Post ready/auth-required to extension after auth resolves
  useEffect(() => {
    if (authLoading) return;
    if (readyPostedRef.current) return;
    readyPostedRef.current = true;
    if (!user) {
      window.parent.postMessage({ type: 'PODDLE_AUTH_REQUIRED' }, '*');
    } else {
      window.parent.postMessage({ type: 'PODDLE_READY' }, '*');
    }
  }, [authLoading, user]);

  // Listen for page content from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        !event.origin.startsWith(EXTENSION_ORIGIN_PREFIX) &&
        event.origin !== PODDLE_ORIGIN
      ) return;
      const { type, text, title, url } = event.data || {};
      if (type !== 'PODDLE_PAGE_CONTENT' || !text) return;

      const pageTitle = title || extractDomain(url || '');
      const truncated = text.slice(0, 220).replace(/\s+/g, ' ').trim();
      const prefilled = `What are the key strategic insights from "${pageTitle}"? ${truncated}`.slice(0, MAX_QUESTION_CHARS);

      setInputValue(prefilled);
      setContentReceived(true);
      setStatus('idle');
      setTurns([]);
      setTlDr('');
      setSendError('');

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
          textareaRef.current.focus();
        }
      });
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Auto-scroll results as turns arrive
  useEffect(() => {
    if (resultsRef.current && turns.length > 0) {
      resultsRef.current.scrollTop = resultsRef.current.scrollHeight;
    }
  }, [turns]);

  // ── Polling ──────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    try {
      const data = await invokeAskAgents({ mode: 'poll', session_id: sessionId });

      if (data?.status === 'not_found') {
        stopPolling();
        setStatus('failed');
        return;
      }

      const newTurns: Turn[] = (data?.turns as Turn[] ?? []).filter((t: Turn) => t.turn_number > 0);
      setTurns(newTurns);

      if ((data?.discussion as { tl_dr?: string })?.tl_dr) {
        setTlDr((data.discussion as { tl_dr: string }).tl_dr);
      }

      if (data?.status === 'completed' || (data?.discussion as { discussion_status?: string })?.discussion_status === 'completed') {
        setStatus('completed');
        stopPolling();
        return;
      }
      if (data?.status === 'failed') {
        setStatus('failed');
        stopPolling();
        return;
      }

      pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    } catch {
      pollTimerRef.current = setTimeout(poll, 2500);
    }
  }, [stopPolling]);

  const schedulePoll = useCallback(() => {
    stopPolling();
    pollTimerRef.current = setTimeout(poll, INITIAL_POLL_DELAY_MS);
  }, [poll, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Send ─────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputValue.trim() || !user || submitting) return;

    const question = inputValue.trim().slice(0, MAX_QUESTION_CHARS);
    const sessionId = `ext-${user.id}-${Date.now()}`;
    sessionIdRef.current = sessionId;

    setSubmitting(true);
    setSendError('');
    setStatus('running');
    setTurns([]);
    setTlDr('');
    setCurrentQuestion(question);

    try {
      const data = await invokeAskAgents({ question, session_id: sessionId });
      if (!data?.ok) throw new Error((data?.error as string) ?? 'Unknown error');

      discussionIdRef.current = data.discussion_id as string;
      setPanel((data.panel as PanelAgent[]) ?? []);
      setInputValue('');
      schedulePoll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send. Please try again.';
      setSendError(msg);
      setStatus('idle');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    stopPolling();
    setStatus('idle');
    setTurns([]);
    setTlDr('');
    setPanel([]);
    setCurrentQuestion('');
    setSendError('');
    setContentReceived(false);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  // ── Loading / Auth states ─────────────────────────────────────
  if (authLoading) {
    return (
      <div style={s.fullCenter}>
        <Loader2 size={26} style={{ animation: 'spin 0.75s linear infinite', color: '#3b82f6' }} />
        <p style={s.mutedText}>Loading…</p>
        <style>{spinKeyframe}</style>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={s.fullCenter}>
        <div style={s.authCard}>
          <PoddleLogo size={28} />
          <p style={s.authHeading}>Sign in to continue</p>
          <p style={s.authSub}>
            You need a Poddle AI account to use Lens. Sign in at poddleme.com, then re-open the panel.
          </p>
          <a href="https://poddleme.com" target="_blank" rel="noopener noreferrer" style={s.signInBtn}>
            <LogIn size={14} /> Go to Poddle AI
          </a>
        </div>
        <style>{spinKeyframe}</style>
      </div>
    );
  }

  const isRunning = status === 'running';
  const isDone = status === 'completed' || status === 'failed';
  const showResults = isRunning || isDone;

  return (
    <div style={s.container}>
      <style>{spinKeyframe + scrollbarCss}</style>

      {/* Header */}
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PoddleLogo size={18} />
          <span style={s.headerTitle}>Poddle Lens</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {sourceUrl && (
            <span style={s.sourceChip} title={sourceUrl}>{extractDomain(sourceUrl)}</span>
          )}
          {isDone && (
            <button onClick={handleReset} style={s.resetBtn} title="Ask another question">
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Results area */}
      <div ref={resultsRef} style={s.body}>
        {/* Idle empty state */}
        {status === 'idle' && !contentReceived && (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}><Sparkles size={20} color="#3b82f6" /></div>
            <p style={s.emptyHeading}>Ready to analyze</p>
            <p style={s.emptyText}>
              Click <strong style={{ color: '#e2e8f0' }}>"Analyze This Page"</strong> in the toolbar to extract content, then send below.
            </p>
          </div>
        )}

        {/* Question echo */}
        {showResults && currentQuestion && (
          <div style={s.questionBubble}>
            <span style={s.questionLabel}>You asked</span>
            <p style={s.questionText}>{currentQuestion}</p>
          </div>
        )}

        {/* Agent turns */}
        {turns.map((turn) => {
          const st = getAgentStyle(turn.display_name);
          return (
            <div key={turn.turn_number} style={{ ...s.turnCard, background: st.bg, borderColor: st.border }}>
              <div style={s.turnHeader}>
                <div style={{ ...s.avatar, background: st.border, color: st.text }}>
                  {getInitials(turn.display_name)}
                </div>
                <span style={{ ...s.agentName, color: st.text }}>{turn.display_name}</span>
              </div>
              <p style={s.turnContent}>{turn.content}</p>
            </div>
          );
        })}

        {/* In-progress indicator */}
        {isRunning && (
          <div style={s.thinkingRow}>
            <Loader2 size={13} style={{ animation: 'spin 0.75s linear infinite', color: '#3b82f6', flexShrink: 0 }} />
            <span style={s.thinkingText}>
              {turns.length === 0
                ? 'The panel is deliberating…'
                : panel[turns.length]
                  ? `${panel[turns.length].display_name} is replying…`
                  : 'Finalising…'}
            </span>
          </div>
        )}

        {/* TL;DR summary */}
        {status === 'completed' && tlDr && (
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>
              <Sparkles size={11} color="#f59e0b" /> Panel verdict
            </div>
            <p style={s.summaryText}>{tlDr}</p>
          </div>
        )}

        {/* Failed state */}
        {status === 'failed' && turns.length === 0 && (
          <div style={s.errorBanner}>
            <AlertCircle size={13} /> Analysis failed. Please try again.
          </div>
        )}
      </div>

      {/* Input area — hidden while running */}
      {!showResults && (
        <div style={s.inputSection}>
          {sendError && (
            <div style={s.errorRow}>
              <AlertCircle size={12} />
              <span>{sendError}</span>
            </div>
          )}
          <div style={s.inputWrapper}>
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Extract page content or type a question…"
              style={s.textarea}
              rows={3}
              disabled={submitting}
            />
            <div style={s.inputFooter}>
              <span style={s.hint}>
                {inputValue.trim()
                  ? `${inputValue.trim().length}/${MAX_QUESTION_CHARS} chars · Cmd+Enter`
                  : 'Waiting for page content…'}
              </span>
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || submitting}
                style={{
                  ...s.sendBtn,
                  opacity: !inputValue.trim() || submitting ? 0.4 : 1,
                  cursor: !inputValue.trim() || submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting
                  ? <Loader2 size={13} style={{ animation: 'spin 0.75s linear infinite' }} />
                  : <Send size={13} />}
                {submitting ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* After completion: ask another */}
      {isDone && (
        <div style={s.doneFooter}>
          <button onClick={handleReset} style={s.askAnotherBtn}>
            <RotateCcw size={12} /> Ask another question
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function extractDomain(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function PoddleLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#2563eb"/>
      <path d="M9 8h7.5a6.5 6.5 0 0 1 0 13H9V8Z" fill="white"/>
      <circle cx="21" cy="23" r="3" fill="#60a5fa"/>
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const spinKeyframe = `@keyframes spin { to { transform: rotate(360deg); } }`;
const scrollbarCss = `
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
  textarea::placeholder { color: #334155; }
  textarea:focus { outline: none; }
`;

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#060c18',
    color: '#e2e8f0',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: '13px',
    WebkitFontSmoothing: 'antialiased',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#0b1225',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#f1f5f9',
    letterSpacing: '-0.02em',
  },
  sourceChip: {
    fontSize: '10px',
    color: '#475569',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '4px',
    padding: '2px 6px',
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  resetBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#64748b',
    cursor: 'pointer',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: 10,
    padding: '24px 8px',
  },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: '12px',
    background: 'rgba(59,130,246,0.1)',
    border: '1px solid rgba(59,130,246,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHeading: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#f1f5f9',
    margin: 0,
  },
  emptyText: {
    fontSize: '11.5px',
    color: '#475569',
    lineHeight: 1.6,
    maxWidth: '240px',
    margin: 0,
  },
  questionBubble: {
    background: 'rgba(59,130,246,0.08)',
    border: '1px solid rgba(59,130,246,0.18)',
    borderRadius: '10px',
    padding: '10px 12px',
    flexShrink: 0,
  },
  questionLabel: {
    fontSize: '9.5px',
    fontWeight: 600,
    color: '#3b82f6',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    display: 'block',
    marginBottom: 4,
  },
  questionText: {
    fontSize: '12px',
    color: '#cbd5e1',
    lineHeight: 1.5,
    margin: 0,
  },
  turnCard: {
    borderRadius: '10px',
    border: '1px solid',
    padding: '10px 12px',
    flexShrink: 0,
  },
  turnHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    fontWeight: 700,
    flexShrink: 0,
  },
  agentName: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  turnContent: {
    fontSize: '12px',
    color: '#cbd5e1',
    lineHeight: 1.65,
    margin: 0,
  },
  thinkingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 0',
  },
  thinkingText: {
    fontSize: '11.5px',
    color: '#475569',
    fontStyle: 'italic',
  },
  summaryCard: {
    background: 'rgba(245,158,11,0.07)',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: '10px',
    padding: '10px 12px',
    flexShrink: 0,
  },
  summaryLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: '9.5px',
    fontWeight: 700,
    color: '#f59e0b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 6,
  },
  summaryText: {
    fontSize: '12px',
    color: '#e2e8f0',
    lineHeight: 1.65,
    margin: 0,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '10px 12px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '12px',
  },
  inputSection: {
    flexShrink: 0,
    padding: '0 14px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  errorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#ef4444',
    fontSize: '11px',
    padding: '4px 0',
  },
  inputWrapper: {
    background: '#0b1225',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  textarea: {
    width: '100%',
    minHeight: '80px',
    maxHeight: '200px',
    background: 'transparent',
    border: 'none',
    color: '#f1f5f9',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '12px',
    lineHeight: 1.6,
    padding: '10px 12px',
    resize: 'none',
    display: 'block',
  },
  inputFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '7px 10px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(0,0,0,0.15)',
  },
  hint: {
    fontSize: '10px',
    color: '#334155',
  },
  sendBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 12px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '11.5px',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  doneFooter: {
    flexShrink: 0,
    padding: '10px 14px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    justifyContent: 'center',
  },
  askAnotherBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  fullCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#060c18',
    gap: 14,
    fontFamily: "'Inter', system-ui, sans-serif",
    padding: '24px',
  },
  mutedText: {
    fontSize: '12px',
    color: '#475569',
    margin: 0,
  },
  authCard: {
    background: '#0b1225',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '28px 24px',
    width: '100%',
    maxWidth: '300px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'center',
    textAlign: 'center',
  },
  authHeading: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#f1f5f9',
    margin: 0,
  },
  authSub: {
    fontSize: '12px',
    color: '#64748b',
    lineHeight: 1.6,
    margin: 0,
  },
  signInBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
    padding: '9px 20px',
    background: '#2563eb',
    color: '#fff',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '12.5px',
    fontWeight: 600,
  },
};
