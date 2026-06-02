import { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, LogIn, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const EXTENSION_ORIGIN_PREFIX = 'chrome-extension://';
const PODDLE_ORIGIN = window.location.origin;

interface IncomingContent {
  text: string;
  title: string;
  url: string;
}

export default function ExtensionView() {
  const { user, loading: authLoading } = useAuth();
  const [sourceUrl, setSourceUrl] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [contentReceived, setContentReceived] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const readyPostedRef = useRef(false);

  // Parse source_url from query string
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const src = params.get('source_url');
    if (src) setSourceUrl(src);
  }, []);

  // Once auth state resolves, post PODDLE_READY to the extension
  useEffect(() => {
    if (authLoading) return;
    if (readyPostedRef.current) return;
    readyPostedRef.current = true;

    if (!user) {
      setAuthError(true);
      window.parent.postMessage({ type: 'PODDLE_AUTH_REQUIRED' }, '*');
    } else {
      window.parent.postMessage({ type: 'PODDLE_READY' }, '*');
    }
  }, [authLoading, user]);

  // Listen for incoming page content from the extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Accept messages from the Chrome extension side panel
      if (
        !event.origin.startsWith(EXTENSION_ORIGIN_PREFIX) &&
        event.origin !== PODDLE_ORIGIN
      ) return;

      const { type, text, title, url } = event.data || {};
      if (type !== 'PODDLE_PAGE_CONTENT') return;
      if (!text) return;

      const pageTitle = title || extractDomain(url || '');
      // Build a focused, concise question from the page rather than dumping all text
      const truncatedText = text.slice(0, 220).replace(/\s+/g, ' ').trim();
      const prefilled = `What are the key strategic insights from "${pageTitle}"? ${truncatedText}`.slice(0, 400);
      setInputValue(prefilled);
      setContentReceived(true);
      setSent(false);
      setSendError('');

      // Auto-resize textarea
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 320)}px`;
          textareaRef.current.focus();
        }
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSend = async () => {
    if (!inputValue.trim() || !user || sending) return;

    setSending(true);
    setSendError('');

    const sessionId = `ext-${user.id}-${Date.now()}`;
    // Truncate to fit the ask-agents 400-char limit: keep first 400 chars of the question
    const question = inputValue.trim().slice(0, 400);

    try {
      const { error } = await supabase.functions.invoke('ask-agents', {
        body: { question, session_id: sessionId },
      });
      if (error) throw error;
      setSent(true);
      setInputValue('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send. Please try again.';
      setSendError(msg);
    } finally {
      setSending(false);
    }
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
    e.target.style.height = `${Math.min(e.target.scrollHeight, 320)}px`;
  };

  if (authLoading) {
    return (
      <div style={styles.fullCenter}>
        <Loader2 size={28} style={{ animation: 'spin 0.75s linear infinite', color: '#2563eb' }} />
        <p style={styles.mutedText}>Loading Poddle Lens…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (authError || !user) {
    return (
      <div style={styles.fullCenter}>
        <div style={styles.authCard}>
          <div style={styles.logoRow}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#2563eb"/>
              <path d="M9 8h7.5a6.5 6.5 0 0 1 0 13H9V8Z" fill="white"/>
              <circle cx="21" cy="23" r="3" fill="#60a5fa"/>
            </svg>
            <span style={styles.logoText}>Poddle Lens</span>
          </div>
          <p style={styles.authHeading}>Sign in to continue</p>
          <p style={styles.authSub}>
            You need a Poddle account to use Lens. Sign in at poddleme.com then re-open the panel.
          </p>
          <a
            href="https://poddleme.com"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.signInBtn}
          >
            <LogIn size={15} />
            Go to Poddle
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logoRow}>
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#2563eb"/>
            <path d="M9 8h7.5a6.5 6.5 0 0 1 0 13H9V8Z" fill="white"/>
            <circle cx="21" cy="23" r="3" fill="#60a5fa"/>
          </svg>
          <span style={styles.headerTitle}>Strategy Intelligence</span>
        </div>
        {sourceUrl && (
          <span style={styles.sourceChip} title={sourceUrl}>
            {extractDomain(sourceUrl)}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={styles.body}>
        {/* Empty state */}
        {!contentReceived && !sent && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <Sparkles size={22} color="#2563eb" />
            </div>
            <p style={styles.emptyHeading}>Ready to analyze</p>
            <p style={styles.emptyText}>
              Click <strong style={{ color: '#f1f5f9' }}>"Analyze This Page"</strong> in the Poddle Lens toolbar
              to extract content and pre-fill your prompt for review.
            </p>
          </div>
        )}

        {/* Success state */}
        {sent && (
          <div style={styles.successBanner}>
            <Sparkles size={15} />
            Prompt sent to your AI agents — check your workspace for responses.
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={styles.inputSection}>
        {sendError && (
          <div style={styles.errorRow}>
            <AlertCircle size={13} />
            <span>{sendError}</span>
          </div>
        )}
        <div style={styles.inputWrapper}>
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Extract page content or type a question…"
            style={styles.textarea}
            rows={4}
            disabled={sending}
          />
          <div style={styles.inputFooter}>
            <span style={styles.hint}>
              {inputValue.trim()
                ? `${inputValue.trim().split(/\s+/).length} words · Cmd+Enter to send`
                : 'Waiting for page content…'}
            </span>
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || sending}
              style={{
                ...styles.sendBtn,
                opacity: !inputValue.trim() || sending ? 0.45 : 1,
                cursor: !inputValue.trim() || sending ? 'not-allowed' : 'pointer',
              }}
              title="Send to AI agents (Cmd+Enter)"
            >
              {sending ? <Loader2 size={15} style={{ animation: 'spin 0.75s linear infinite' }} /> : <Send size={15} />}
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
        textarea::placeholder { color: #475569; }
        textarea:focus { outline: none; }
      `}</style>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────

function extractDomain(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// ── Styles ───────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#080d1a',
    color: '#f1f5f9',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: '13px',
    WebkitFontSmoothing: 'antialiased',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#0f1629',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
    gap: 8,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#f1f5f9',
    letterSpacing: '-0.02em',
  },
  headerTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#94a3b8',
  },
  sourceChip: {
    fontSize: '10.5px',
    color: '#475569',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '4px',
    padding: '2px 7px',
    maxWidth: '140px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '20px 14px',
    display: 'flex',
    flexDirection: 'column',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: 12,
    padding: '20px 0',
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: '12px',
    background: 'rgba(37,99,235,0.1)',
    border: '1px solid rgba(37,99,235,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHeading: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f1f5f9',
    margin: 0,
  },
  emptyText: {
    fontSize: '12px',
    color: '#64748b',
    lineHeight: 1.6,
    maxWidth: '260px',
    margin: 0,
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 14px',
    background: 'rgba(16,185,129,0.1)',
    border: '1px solid rgba(16,185,129,0.2)',
    borderRadius: '8px',
    color: '#10b981',
    fontSize: '12px',
    fontWeight: 500,
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
    fontSize: '11.5px',
    padding: '6px 0',
  },
  inputWrapper: {
    background: '#0f1629',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    overflow: 'hidden',
    transition: 'border-color 0.18s ease',
  },
  textarea: {
    width: '100%',
    minHeight: '100px',
    maxHeight: '320px',
    background: 'transparent',
    border: 'none',
    color: '#f1f5f9',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '12.5px',
    lineHeight: 1.6,
    padding: '12px 14px',
    resize: 'none',
    display: 'block',
  },
  inputFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(0,0,0,0.2)',
  },
  hint: {
    fontSize: '10.5px',
    color: '#334155',
  },
  sendBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '7px',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'background 0.18s ease',
  },
  fullCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#080d1a',
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
    background: '#0f1629',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '28px 24px',
    width: '100%',
    maxWidth: '320px',
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
    transition: 'background 0.18s ease',
  },
};
