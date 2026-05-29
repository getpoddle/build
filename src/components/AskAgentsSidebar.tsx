import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, Bot, ChevronRight } from 'lucide-react';

interface Turn {
  agent_name: string;
  display_name: string;
  content: string;
  turn_number: number;
}

interface DiscussionSummary {
  tl_dr: string | null;
}

interface PanelAgent {
  agent_name: string;
  display_name: string;
}

const AGENT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'The Skeptic':    { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  'Risk Analyst':   { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  'The Optimist':   { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'Data Detective': { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  'The Pragmatist': { bg: '#f8fafc', text: '#334155', border: '#e2e8f0' },
};

const SESSION_KEY = 'poddle_ask_session_id';

function getSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const fresh = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export default function AskAgentsSidebar() {
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [summary, setSummary] = useState<DiscussionSummary | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [panel, setPanel] = useState<PanelAgent[]>([]);
  const pollTimer = useRef<number | null>(null);
  const sessionIdRef = useRef<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionIdRef.current = getSessionId();
    return () => { if (pollTimer.current) window.clearTimeout(pollTimer.current); };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  async function submit() {
    const q = question.trim();
    if (q.length < 8) { setError('Add a bit more context.'); return; }
    if (q.length > 400) { setError('Keep it under 400 characters.'); return; }

    setError(null);
    setTurns([]);
    setSummary(null);
    setPanel([]);
    setSubmitting(true);
    setStatus('running');

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ mode: 'ask', question: q, session_id: sessionIdRef.current }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Something went wrong.');
        setStatus('idle');
        return;
      }

      setPanel(payload.panel ?? []);
      schedulePoll(1200);
    } catch (e) {
      setError((e as Error).message);
      setStatus('failed');
    } finally {
      setSubmitting(false);
    }
  }

  function schedulePoll(delay: number) {
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
    pollTimer.current = window.setTimeout(() => void pollOnce(), delay);
  }

  async function pollOnce() {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ mode: 'poll', session_id: sessionIdRef.current }),
      });
      const payload = await res.json().catch(() => ({}));

      if (payload.turns) setTurns(payload.turns as Turn[]);
      if (payload.discussion) setSummary(payload.discussion as DiscussionSummary);

      if (payload.status === 'completed') { setStatus('completed'); return; }
      if (payload.status === 'failed') { setStatus('failed'); return; }
      schedulePoll(1500);
    } catch {
      schedulePoll(2500);
    }
  }

  const isRunning = status === 'running';
  const isDone = status === 'completed';
  const hasResults = turns.length > 0 || isRunning;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div
        className="h-0.5 w-full"
        style={{ background: 'linear-gradient(90deg, #2563eb, #0891b2, #15803d)' }}
      />

      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: '#eff6ff' }}
        >
          <Sparkles className="w-3.5 h-3.5" style={{ color: '#2563eb' }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 leading-tight">Ask the Agents</p>
          <p className="text-[11px] text-slate-400 leading-tight">Free &middot; no sign-up needed</p>
        </div>
      </div>

      <div className="p-4">
        {!hasResults && (
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Five AI advisors — Skeptic, Optimist, Risk Analyst, Data Detective, Pragmatist — debate your question.
          </p>
        )}

        <div className="relative">
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Ask anything strategic…"
            rows={2}
            maxLength={400}
            disabled={submitting || isRunning}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-16 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <button
            onClick={submit}
            disabled={submitting || isRunning || question.trim().length < 8}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting || isRunning ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <><Send className="w-3 h-3" />Ask</>
            )}
          </button>
        </div>

        {error && (
          <p className="mt-2 text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {hasResults && (
          <div
            ref={scrollRef}
            className="mt-3 space-y-2.5 max-h-64 overflow-y-auto pr-0.5"
          >
            {isRunning && turns.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Panel is deliberating…
              </div>
            )}

            {turns.map((turn, idx) => {
              const style = AGENT_STYLES[turn.agent_name] || AGENT_STYLES['The Pragmatist'];
              const isLast = idx === turns.length - 1;
              return (
                <div key={`${turn.turn_number}-${idx}`} className="flex gap-2">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ring-1 ring-white"
                      style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
                    >
                      {turn.display_name.charAt(0)}
                    </div>
                    {!isLast && <div className="w-px flex-1 mt-1 bg-slate-100 min-h-[8px]" />}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-[11px] font-semibold text-slate-700 mb-0.5">{turn.display_name}</p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{turn.content}</p>
                  </div>
                </div>
              );
            })}

            {isRunning && turns.length > 0 && turns.length < (panel.length || 5) && (
              <div className="flex items-center gap-2 text-[11px] text-slate-400 pl-9">
                <Loader2 className="w-3 h-3 animate-spin" />
                {panel[turns.length]?.display_name
                  ? `${panel[turns.length].display_name} is replying…`
                  : 'Next agent replying…'}
              </div>
            )}

            {isDone && summary?.tl_dr && (
              <div
                className="rounded-xl border px-3 py-3 mt-1"
                style={{ borderColor: '#bfdbfe', background: '#eff6ff' }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Bot className="w-3.5 h-3.5" style={{ color: '#1d4ed8' }} />
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#1d4ed8' }}>
                    Panel verdict
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">{summary.tl_dr}</p>
              </div>
            )}

            {isDone && (
              <button
                onClick={() => { setQuestion(''); setTurns([]); setSummary(null); setStatus('idle'); setPanel([]); }}
                className="w-full mt-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Ask another question
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
