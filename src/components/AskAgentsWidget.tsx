import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Lock, Bot, Loader2, Quote } from 'lucide-react';

interface AskAgentsWidgetProps {
  onJoin: (trigger: string) => void;
}

interface Turn {
  agent_name: string;
  display_name: string;
  content: string;
  turn_number: number;
}

interface DiscussionSummary {
  topic_title: string | null;
  tl_dr: string | null;
  key_quotes: { agent_name: string; display_name: string; quote: string }[] | null;
  discussion_status: string | null;
}

interface PanelAgent {
  agent_name: string;
  display_name: string;
}

const AGENT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'The Skeptic':     { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  'Risk Analyst':    { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  'The Optimist':    { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'Data Detective':  { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  'The Pragmatist':  { bg: '#f8fafc', text: '#334155', border: '#e2e8f0' },
};

const EXAMPLE_QUESTIONS = [
  'Should a pre-seed B2B SaaS raise on a SAFE or a priced round right now?',
  'Is it worth building our own AI evals instead of using LangSmith?',
  'Does a solo founder really need a technical cofounder in 2026?',
];

const SESSION_STORAGE_KEY = 'poddle_ask_session_id';

function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const fresh = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(SESSION_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export default function AskAgentsWidget({ onJoin }: AskAgentsWidgetProps) {
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [panel, setPanel] = useState<PanelAgent[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [summary, setSummary] = useState<DiscussionSummary | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [activeDiscussionId, setActiveDiscussionId] = useState<string | null>(null);

  const pollTimer = useRef<number | null>(null);
  const sessionIdRef = useRef<string>('');

  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();
    return () => {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
  }, []);

  async function submitQuestion(text?: string) {
    const q = (text ?? question).trim();
    if (q.length < 8) {
      setError('Give the agents a little more to work with — at least a sentence.');
      return;
    }
    if (q.length > 400) {
      setError('Keep it under 400 characters.');
      return;
    }

    setError(null);
    setRateLimited(false);
    setTurns([]);
    setSummary(null);
    setPanel([]);
    setSubmitting(true);
    setStatus('running');

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-agents`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          mode: 'ask',
          question: q,
          session_id: sessionIdRef.current,
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 429) {
          setRateLimited(true);
          setStatus('idle');
        }
        setError(payload.error || 'Something went wrong. Try again.');
        setStatus('idle');
        return;
      }

      setActiveDiscussionId(payload.discussion_id);
      setPanel(payload.panel ?? []);
      scheduleNextPoll(1200);
    } catch (e) {
      setError((e as Error).message);
      setStatus('failed');
    } finally {
      setSubmitting(false);
    }
  }

  function scheduleNextPoll(delay: number) {
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
    pollTimer.current = window.setTimeout(() => void pollOnce(), delay);
  }

  async function pollOnce() {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-agents`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ mode: 'poll', session_id: sessionIdRef.current }),
      });
      const payload = await res.json().catch(() => ({}));

      if (payload.turns && Array.isArray(payload.turns)) {
        setTurns(payload.turns as Turn[]);
      }
      if (payload.discussion) {
        setSummary(payload.discussion as DiscussionSummary);
      }

      if (payload.status === 'completed') {
        setStatus('completed');
        return;
      }
      if (payload.status === 'failed') {
        setStatus('failed');
        return;
      }
      scheduleNextPoll(1500);
    } catch {
      scheduleNextPoll(2500);
    }
  }

  const showResults = turns.length > 0 || status === 'running';
  const expectedTurns = panel.length || 5;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: 'linear-gradient(90deg, #2563eb, #0891b2, #15803d)' }}
      />
      <div className="px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#eff6ff' }}>
            <Sparkles className="w-4 h-4" style={{ color: '#1d4ed8' }} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ask the agents — free, no sign-up
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
          Put a question to a panel of AI advisors.
        </h2>
        <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-2xl">
          Five agents with sharply different priors — skeptic, risk, optimist, data, pragmatist —
          deliberate on your question and return a verdict in seconds.
        </p>

        <div className="mt-5">
          <label className="sr-only" htmlFor="ask-agents-q">Your question</label>
          <div className="relative">
            <textarea
              id="ask-agents-q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Should we launch paid before nailing retention?"
              rows={2}
              maxLength={400}
              className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 pr-28 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={submitting || status === 'running'}
            />
            <button
              onClick={() => submitQuestion()}
              disabled={submitting || status === 'running' || question.trim().length < 8}
              className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting || status === 'running' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Working
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Ask
                </>
              )}
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>{question.length}/400</span>
            <span>Up to 4 questions per hour.</span>
          </div>
        </div>

        {!showResults && status === 'idle' && (
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setQuestion(ex);
                  void submitQuestion(ex);
                }}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                disabled={submitting}
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div
            className="mt-4 rounded-lg border px-3 py-2 text-sm"
            style={{
              background: rateLimited ? '#fef3c7' : '#fef2f2',
              borderColor: rateLimited ? '#fde68a' : '#fecaca',
              color: rateLimited ? '#854d0e' : '#b91c1c',
            }}
          >
            {error}
            {rateLimited && (
              <>
                {' '}
                <button
                  onClick={() => onJoin('ai')}
                  className="underline font-semibold"
                >
                  Sign up free
                </button>{' '}
                to keep going.
              </>
            )}
          </div>
        )}

        {showResults && (
          <div className="mt-6 space-y-4">
            {status === 'running' && turns.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 flex items-center gap-3 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                The panel is deliberating…
              </div>
            )}

            {turns.length > 0 && (
              <div className="space-y-3">
                {turns.map((turn, idx) => {
                  const style = AGENT_STYLES[turn.agent_name] || AGENT_STYLES['The Pragmatist'];
                  const isLast = idx === turns.length - 1;
                  return (
                    <div key={`${turn.turn_number}-${idx}`} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ring-1 ring-white"
                          style={{ background: style.bg, color: style.text, borderColor: style.border }}
                        >
                          {turn.display_name.charAt(0).toUpperCase()}
                        </div>
                        {!isLast && <div className="w-0.5 flex-1 mt-1 bg-slate-100 min-h-[12px]" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-slate-800">{turn.display_name}</span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">{turn.content}</p>
                      </div>
                    </div>
                  );
                })}
                {status === 'running' && turns.length < expectedTurns && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 pl-12">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {panel[turns.length]?.display_name
                      ? `${panel[turns.length].display_name} is replying…`
                      : 'Next agent is replying…'}
                  </div>
                )}
              </div>
            )}

            {status === 'completed' && summary?.tl_dr && (
              <div
                className="rounded-xl border px-4 py-4"
                style={{ borderColor: '#bfdbfe', background: '#eff6ff' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-4 h-4" style={{ color: '#1d4ed8' }} />
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#1d4ed8' }}>
                    Panel verdict
                  </span>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed">{summary.tl_dr}</p>

                {summary.key_quotes && summary.key_quotes.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Sharpest quotes
                    </div>
                    {summary.key_quotes.slice(0, 3).map((q, i) => {
                      const style = AGENT_STYLES[q.agent_name] || AGENT_STYLES['The Pragmatist'];
                      return (
                        <div
                          key={i}
                          className="rounded-lg bg-white px-3 py-2 border"
                          style={{ borderColor: style.border }}
                        >
                          <div className="flex items-start gap-2">
                            <Quote className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: style.text }} />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold" style={{ color: style.text }}>
                                {q.display_name}
                              </div>
                              <p className="text-sm text-slate-700 leading-relaxed mt-0.5">{q.quote}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {status === 'completed' && (
              <div
                className="rounded-xl border px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                style={{ borderColor: '#e2e8f0', background: 'linear-gradient(135deg, #f8fafc 0%, #f0f9ff 100%)' }}
              >
                <div className="flex items-start gap-3">
                  <Lock className="w-4 h-4 mt-0.5 text-slate-500 flex-shrink-0" />
                  <div className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Want to push back on the agents?</span>{' '}
                    Sign up free to save this thread, reply to any agent, and start your own pod.
                  </div>
                </div>
                <button
                  onClick={() => onJoin('ai')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors flex-shrink-0"
                >
                  Sign up free
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {!showResults && (
          <div className="mt-6 flex items-center gap-3 text-xs text-slate-400">
            <div className="flex -space-x-1.5">
              {Object.keys(AGENT_STYLES).map((name) => {
                const s = AGENT_STYLES[name];
                return (
                  <div
                    key={name}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ring-2 ring-white"
                    style={{ background: s.bg, color: s.text }}
                  >
                    {name.split(' ').slice(-1)[0].charAt(0)}
                  </div>
                );
              })}
            </div>
            <span>The Skeptic, Risk Analyst, The Optimist, Data Detective, The Pragmatist — on standby.</span>
          </div>
        )}
      </div>
    </section>
  );
}
