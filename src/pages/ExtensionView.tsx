import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Sparkles, LogIn, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lens-warroom`;

const EXTENSION_ORIGIN_PREFIX = 'chrome-extension://';
const PODDLE_ORIGIN = window.location.origin;

const POLL_INTERVAL_MS = 4000;
const INITIAL_POLL_DELAY_MS = 3000;
const MAX_POLL_MS = 150_000;
const MAX_QUESTION_CHARS = 400;

const SYNTH_SELECT =
  'decision_health_score, financial_score, operational_score, alignment_score, ' +
  'decision_velocity, confidence_trajectory, health_rationale, executive_summary, recommendation, ' +
  'consensus_points, conflict_zones, open_questions, risk_signals, blind_spots, ' +
  'action_items, financial_metrics, operational_metrics, non_financial_metrics, ' +
  'opportunity_signals, key_decisions, cognitive_bias_flags';

interface IncomingContent {
  text: string;
  title: string;
  url: string;
}

interface Synthesis {
  decision_health_score: number | null;
  financial_score: number | null;
  operational_score: number | null;
  alignment_score: number | null;
  decision_velocity: string | null;
  confidence_trajectory: string | null;
  health_rationale: string | null;
  executive_summary: string | null;
  recommendation: string | null;
  consensus_points: Array<{ text: string; confidence?: number }> | null;
  conflict_zones: Array<{ topic: string; agent_a?: string; position_a?: string; agent_b?: string; position_b?: string; tension_level?: number }> | null;
  open_questions: Array<{ question: string; urgency?: string }> | null;
  risk_signals: Array<{ signal: string; severity: string; category?: string }> | null;
  blind_spots: Array<{ area: string; description: string }> | null;
  action_items: Array<{ text: string; priority: string; source_area?: string }> | null;
  financial_metrics: Array<{ metric: string; value: string; confidence?: string; note?: string }> | null;
  operational_metrics: Array<{ metric: string; status: string; note?: string }> | null;
  non_financial_metrics: Array<{ metric: string; signal: string; note?: string }> | null;
  opportunity_signals: Array<{ title: string; description: string; confidence?: string }> | null;
  key_decisions: Array<{ decision: string; status: string; rationale?: string; owner?: string }> | null;
  cognitive_bias_flags: Array<{ bias_name: string; explanation: string; counter_question?: string }> | null;
}

type Status = 'idle' | 'running' | 'completed' | 'failed';

// ── Helpers ───────────────────────────────────────────────────────

function extractDomain(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function severityEmoji(s: string): string {
  return s === 'critical' ? '🔴' : s === 'high' ? '🟠' : s === 'medium' ? '🟡' : '⚪';
}

function priorityEmoji(p: string): string {
  return p === 'critical' ? '🔴' : p === 'high' ? '🟠' : '🟡';
}

function statusEmoji(s: string): string {
  return s === 'on-track' ? '🟢' : s === 'at-risk' ? '🟠' : '⚪';
}

function signalEmoji(s: string): string {
  return s === 'positive' ? '🟢' : s === 'negative' ? '🔴' : '🔵';
}

function velocityEmoji(v: string | null): string {
  return v === 'fast' ? '🚀' : v === 'stalling' ? '🐢' : '⚡';
}

function trajEmoji(t: string | null): string {
  return t === 'rising' ? '📈' : t === 'falling' ? '📉' : '➡️';
}

function scoreColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 55) return '#f59e0b';
  if (score >= 35) return '#f97316';
  return '#ef4444';
}

function scoreLabel(score: number): string {
  if (score >= 75) return 'Sharp';
  if (score >= 55) return 'Developing';
  if (score >= 35) return 'Fragmented';
  return 'Critical';
}

// ── Component ────────────────────────────────────────────────────

export default function ExtensionView() {
  const { user, loading: authLoading } = useAuth();

  const [sourceUrl, setSourceUrl] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [contentReceived, setContentReceived] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [synthesis, setSynthesis] = useState<Synthesis | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');

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
      setSynthesis(null);
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

  // Auto-scroll results as content arrives
  useEffect(() => {
    if (resultsRef.current) {
      resultsRef.current.scrollTop = resultsRef.current.scrollHeight;
    }
  }, [synthesis, status]);

  // ── Polling ──────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const poll = useCallback(async (wsId: string, deadline: number) => {
    if (Date.now() > deadline) {
      setStatus('failed');
      return;
    }

    try {
      const { data: synthRow, error } = await supabase
        .from('workspace_synthesis')
        .select(SYNTH_SELECT)
        .eq('workspace_id', wsId)
        .maybeSingle();

      if (error) throw error;

      if (synthRow) {
        setSynthesis(synthRow as Synthesis);
        setStatus('completed');
        return;
      }

      pollTimerRef.current = setTimeout(() => poll(wsId, deadline), POLL_INTERVAL_MS);
    } catch {
      pollTimerRef.current = setTimeout(() => poll(wsId, deadline), POLL_INTERVAL_MS * 2);
    }
  }, []);

  const schedulePoll = useCallback((wsId: string) => {
    stopPolling();
    const deadline = Date.now() + MAX_POLL_MS;
    pollTimerRef.current = setTimeout(() => poll(wsId, deadline), INITIAL_POLL_DELAY_MS);
  }, [poll, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Send ─────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputValue.trim() || !user || submitting) return;

    const question = inputValue.trim().slice(0, MAX_QUESTION_CHARS);

    setSubmitting(true);
    setSendError('');
    setStatus('running');
    setSynthesis(null);
    setCurrentQuestion(question);

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const res = await fetch(FUNCTIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ question }),
      });

      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok || !data?.ok) {
        throw new Error((data?.error as string) ?? `Request failed (${res.status})`);
      }

      const wsId = data.workspace_id as string;
      setWorkspaceId(wsId);
      setInputValue('');
      schedulePoll(wsId);
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
    setSynthesis(null);
    setCurrentQuestion('');
    setWorkspaceId('');
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

        {/* Running state */}
        {isRunning && (
          <div style={s.thinkingCard}>
            <Loader2 size={16} style={{ animation: 'spin 0.75s linear infinite', color: '#3b82f6', flexShrink: 0 }} />
            <div>
              <p style={s.thinkingTitle}>War Room in progress…</p>
              <p style={s.thinkingSub}>Seven AI advisors are debating your decision. The Board Brief will appear here when ready.</p>
            </div>
          </div>
        )}

        {/* Board Brief */}
        {synthesis && <BoardBrief synth={synthesis} workspaceId={workspaceId} />}

        {/* Failed state */}
        {status === 'failed' && !synthesis && (
          <div style={s.errorBanner}>
            <AlertCircle size={13} /> Analysis timed out. The War Room may still be processing — check it directly.
            {workspaceId && (
              <a href={`https://poddleme.com/?workspace=${workspaceId}`} target="_blank" rel="noopener noreferrer" style={s.errorLink}>
                Open War Room
              </a>
            )}
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

// ── Board Brief Component ────────────────────────────────────────

function BoardBrief({ synth, workspaceId }: { synth: Synthesis; workspaceId: string }) {
  const score = synth.decision_health_score;
  const rec = synth.recommendation;
  const execSummary = synth.executive_summary;
  const healthRationale = synth.health_rationale;
  const consensus = synth.consensus_points ?? [];
  const risks = synth.risk_signals ?? [];
  const openQs = synth.open_questions ?? [];
  const actions = synth.action_items ?? [];
  const blindSpots = synth.blind_spots ?? [];
  const conflicts = synth.conflict_zones ?? [];
  const finMetrics = synth.financial_metrics ?? [];
  const opMetrics = synth.operational_metrics ?? [];
  const nonFinMetrics = synth.non_financial_metrics ?? [];
  const opportunities = synth.opportunity_signals ?? [];
  const keyDecisions = synth.key_decisions ?? [];
  const biasFlags = synth.cognitive_bias_flags ?? [];

  return (
    <>
      {/* Score header */}
      {score != null && (
        <div style={s.scoreCard}>
          <div style={s.scoreHeader}>
            <span style={s.scoreTitle}>⚡ Board Brief</span>
            <div style={s.scoreBadge(score)}>
              <span style={s.scoreNumber(score)}>{score}</span>
              <span style={s.scoreMax}>/100</span>
            </div>
          </div>
          <span style={s.scoreLabel(score)}>{scoreLabel(score)} Team</span>

          {/* Score breakdown */}
          <div style={s.scoreBreakdown}>
            {synth.financial_score != null && (
              <div style={s.scorePill}>
                <span style={s.scorePillLabel}>Financial</span>
                <span style={s.scorePillValue}>{synth.financial_score}</span>
              </div>
            )}
            {synth.operational_score != null && (
              <div style={s.scorePill}>
                <span style={s.scorePillLabel}>Operational</span>
                <span style={s.scorePillValue}>{synth.operational_score}</span>
              </div>
            )}
            {synth.alignment_score != null && (
              <div style={s.scorePill}>
                <span style={s.scorePillLabel}>Alignment</span>
                <span style={s.scorePillValue}>{synth.alignment_score}</span>
              </div>
            )}
            {synth.decision_velocity && (
              <div style={s.scorePill}>
                <span style={s.scorePillLabel}>Velocity</span>
                <span style={s.scorePillValue}>{velocityEmoji(synth.decision_velocity)} {synth.decision_velocity}</span>
              </div>
            )}
            {synth.confidence_trajectory && (
              <div style={s.scorePill}>
                <span style={s.scorePillLabel}>Confidence</span>
                <span style={s.scorePillValue}>{trajEmoji(synth.confidence_trajectory)} {synth.confidence_trajectory}</span>
              </div>
            )}
          </div>

          {healthRationale && (
            <p style={s.rationale}>{healthRationale}</p>
          )}
        </div>
      )}

      {/* Executive Summary */}
      {execSummary && (
        <Section title="Executive Summary">
          <p style={s.sectionText}>{execSummary}</p>
        </Section>
      )}

      {/* Recommendation */}
      {rec && (
        <Section title="Recommendation" accent="#3b82f6">
          <p style={s.sectionText}>{rec}</p>
        </Section>
      )}

      {/* Action Items */}
      {actions.length > 0 && (
        <Section title="Action Items">
          {actions.slice(0, 5).map((a, i) => (
            <div key={i} style={s.listItem}>
              <span style={s.listBullet}>{priorityEmoji(a.priority)}</span>
              <span style={s.listText}>
                <span style={s.listTag}>[{a.source_area ?? a.priority}]</span> {a.text}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Consensus Points */}
      {consensus.length > 0 && (
        <Section title="Consensus Points" accent="#22c55e">
          {consensus.slice(0, 4).map((c, i) => (
            <div key={i} style={s.listItem}>
              <span style={s.listBullet}>•</span>
              <span style={s.listText}>
                {c.text}
                {c.confidence != null && <span style={s.listMeta}> ({c.confidence}% confidence)</span>}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Risk Signals */}
      {risks.length > 0 && (
        <Section title="Risk Signals" accent="#f97316">
          {risks.slice(0, 5).map((r, i) => (
            <div key={i} style={s.listItem}>
              <span style={s.listBullet}>{severityEmoji(r.severity)}</span>
              <span style={s.listText}>
                <span style={s.listTag}>[{r.category ?? r.severity}]</span> {r.signal}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Blind Spots */}
      {blindSpots.length > 0 && (
        <Section title="Blind Spots" accent="#a855f7">
          <p style={s.sectionSubtext}>What your team may not be seeing:</p>
          {blindSpots.map((b, i) => (
            <div key={i} style={s.listItem}>
              <span style={s.listBullet}>•</span>
              <span style={s.listText}>
                <span style={s.listBold}>{b.area}</span> — {b.description}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Financial Metrics */}
      {finMetrics.length > 0 && (
        <Section title="Financial Metrics" accent="#22c55e">
          {finMetrics.slice(0, 5).map((f, i) => (
            <div key={i} style={s.listItem}>
              <span style={s.listBullet}>•</span>
              <span style={s.listText}>
                <span style={s.listBold}>{f.metric}:</span> {f.value}
                {f.note && <span style={s.listMeta}> — {f.note}</span>}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Operational Metrics */}
      {opMetrics.length > 0 && (
        <Section title="Operational Metrics" accent="#3b82f6">
          {opMetrics.slice(0, 5).map((o, i) => (
            <div key={i} style={s.listItem}>
              <span style={s.listBullet}>{statusEmoji(o.status)}</span>
              <span style={s.listText}>
                <span style={s.listBold}>{o.metric}:</span> {o.status}
                {o.note && <span style={s.listMeta}> — {o.note}</span>}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Strategic Metrics */}
      {nonFinMetrics.length > 0 && (
        <Section title="Strategic Metrics" accent="#06b6d4">
          {nonFinMetrics.slice(0, 4).map((n, i) => (
            <div key={i} style={s.listItem}>
              <span style={s.listBullet}>{signalEmoji(n.signal)}</span>
              <span style={s.listText}>
                <span style={s.listBold}>{n.metric}</span>
                {n.note && <span style={s.listMeta}> — {n.note}</span>}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Open Questions */}
      {openQs.length > 0 && (
        <Section title="Open Questions" accent="#f59e0b">
          {openQs.slice(0, 4).map((q, i) => (
            <div key={i} style={s.listItem}>
              <span style={s.listBullet}>•</span>
              <span style={s.listText}>
                {q.question}
                {q.urgency === 'critical' && <span style={s.listMeta}> 🔴</span>}
                {q.urgency === 'high' && <span style={s.listMeta}> 🟠</span>}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Opportunities */}
      {opportunities.length > 0 && (
        <Section title="Opportunities" accent="#22c55e">
          {opportunities.slice(0, 3).map((o, i) => (
            <div key={i} style={s.listItem}>
              <span style={s.listBullet}>•</span>
              <span style={s.listText}>
                <span style={s.listBold}>{o.title}</span> — {o.description}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Key Decisions */}
      {keyDecisions.length > 0 && (
        <Section title="Key Decisions" accent="#3b82f6">
          {keyDecisions.slice(0, 4).map((d, i) => {
            const st = d.status === 'resolved' ? '✅' : d.status === 'in-progress' ? '🔄' : '⏳';
            return (
              <div key={i} style={s.listItem}>
                <span style={s.listBullet}>{st}</span>
                <span style={s.listText}>
                  <span style={s.listBold}>{d.decision}</span>
                  {d.owner && <span style={s.listMeta}> ({d.owner})</span>}
                </span>
              </div>
            );
          })}
        </Section>
      )}

      {/* Conflict Zones */}
      {conflicts.length > 0 && (
        <Section title="Conflict Zones" accent="#ef4444">
          {conflicts.slice(0, 3).map((c, i) => (
            <div key={i} style={s.listItem}>
              <span style={s.listBullet}>•</span>
              <span style={s.listText}>
                <span style={s.listBold}>{c.topic}</span>
                {c.position_a && c.position_b && (
                  <span style={s.listMeta}>: "{c.position_a}" vs "{c.position_b}"</span>
                )}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Cognitive Bias Flags */}
      {biasFlags.length > 0 && (
        <Section title="Cognitive Bias Flags" accent="#a855f7">
          {biasFlags.slice(0, 2).map((b, i) => (
            <div key={i} style={s.listItem}>
              <span style={s.listBullet}>•</span>
              <span style={s.listText}>
                <span style={s.listBold}>{b.bias_name}</span> — {b.explanation}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Link to full War Room */}
      {workspaceId && (
        <a
          href={`https://poddleme.com/?workspace=${workspaceId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={s.warRoomLink}
        >
          View Full War Room →
        </a>
      )}
    </>
  );
}

// ── Section Component ─────────────────────────────────────────────

function Section({ title, accent, children }: { title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div style={s.sectionCard}>
      <div style={{ ...s.sectionHeader, borderLeftColor: accent ?? '#334155' }}>
        <span style={s.sectionTitle}>{title}</span>
      </div>
      <div style={s.sectionBody}>
        {children}
      </div>
    </div>
  );
}

// ── Poddle Logo ───────────────────────────────────────────────────

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

const s: Record<string, any> = {
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
  thinkingCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '16px 14px',
    background: '#0b1225',
    border: '1px solid rgba(59,130,246,0.15)',
    borderRadius: '12px',
    flexShrink: 0,
  },
  thinkingTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#f1f5f9',
    margin: '0 0 4px 0',
  },
  thinkingSub: {
    fontSize: '11.5px',
    color: '#64748b',
    lineHeight: 1.5,
    margin: 0,
  },
  // ── Score Card ──
  scoreCard: {
    background: '#0b1225',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '14px',
    flexShrink: 0,
  },
  scoreHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  scoreTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#f1f5f9',
    letterSpacing: '-0.02em',
  },
  scoreBadge: (score: number) => ({
    display: 'flex',
    alignItems: 'baseline',
    gap: 2,
    padding: '4px 10px',
    borderRadius: '8px',
    background: `${scoreColor(score)}15`,
    border: `1px solid ${scoreColor(score)}40`,
  }),
  scoreNumber: (score: number) => ({
    fontSize: '18px',
    fontWeight: 700,
    color: scoreColor(score),
  }),
  scoreMax: {
    fontSize: '11px',
    color: '#475569',
  },
  scoreLabel: (score: number) => ({
    display: 'inline-block',
    fontSize: '10px',
    fontWeight: 600,
    color: scoreColor(score),
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 10,
  }),
  scoreBreakdown: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  scorePill: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  scorePillLabel: {
    fontSize: '9.5px',
    color: '#64748b',
    fontWeight: 500,
  },
  scorePillValue: {
    fontSize: '10px',
    color: '#cbd5e1',
    fontWeight: 600,
  },
  rationale: {
    fontSize: '11px',
    color: '#94a3b8',
    fontStyle: 'italic',
    lineHeight: 1.5,
    margin: '10px 0 0 0',
  },
  // ── Section ──
  sectionCard: {
    background: '#0b1225',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px',
    overflow: 'hidden',
    flexShrink: 0,
  },
  sectionHeader: {
    padding: '8px 12px',
    borderLeft: '3px solid #334155',
    background: 'rgba(255,255,255,0.03)',
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#f1f5f9',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  sectionBody: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sectionText: {
    fontSize: '12px',
    color: '#cbd5e1',
    lineHeight: 1.65,
    margin: 0,
  },
  sectionSubtext: {
    fontSize: '10.5px',
    color: '#475569',
    fontStyle: 'italic',
    margin: '0 0 4px 0',
  },
  // ── List Items ──
  listItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 7,
    fontSize: '12px',
    lineHeight: 1.55,
  },
  listBullet: {
    flexShrink: 0,
    fontSize: '11px',
    lineHeight: '1.7',
  },
  listText: {
    color: '#cbd5e1',
    flex: 1,
  },
  listTag: {
    fontWeight: 600,
    color: '#94a3b8',
  },
  listBold: {
    fontWeight: 600,
    color: '#e2e8f0',
  },
  listMeta: {
    color: '#475569',
    fontSize: '11px',
  },
  // ── War Room Link ──
  warRoomLink: {
    display: 'block',
    textAlign: 'center',
    padding: '10px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#3b82f6',
    background: 'rgba(59,130,246,0.08)',
    border: '1px solid rgba(59,130,246,0.2)',
    borderRadius: '10px',
    textDecoration: 'none',
    flexShrink: 0,
    transition: 'background 0.18s ease',
  },
  // ── Error ──
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
    flexWrap: 'wrap',
  },
  errorLink: {
    color: '#3b82f6',
    fontSize: '11px',
    textDecoration: 'underline',
    marginLeft: 'auto',
  },
  // ── Input ──
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
  // ── Auth ──
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
