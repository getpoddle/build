import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronDown, ChevronUp, MessageSquare, Loader, Sparkles, Quote } from 'lucide-react';

interface DiscussionTurn {
  id: string;
  agent_name: string;
  display_name: string;
  content: string;
  turn_number: number;
  created_at: string;
}

interface KeyQuote {
  agent_name: string;
  display_name: string;
  quote: string;
}

interface AgentDiscussionViewerProps {
  discussionId: string;
  topicTitle: string;
  agentNames: string[];
  agentDisplayNames?: string[];
}

const AGENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'The Skeptic':      { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200' },
  'Risk Analyst':     { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200' },
  'The Optimist':     { bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200' },
  'Data Detective':   { bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200' },
  "Devil's Advocate": { bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200' },
  'The Historian':    { bg: 'bg-stone-50',   text: 'text-stone-700',  border: 'border-stone-200' },
  'Market Analyst':   { bg: 'bg-cyan-50',    text: 'text-cyan-700',   border: 'border-cyan-200' },
  'Tech Futurist':    { bg: 'bg-sky-50',     text: 'text-sky-700',    border: 'border-sky-200' },
  'Systems Thinker':  { bg: 'bg-teal-50',    text: 'text-teal-700',   border: 'border-teal-200' },
  'The Pragmatist':   { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-300' },
};

export default function AgentDiscussionViewer({ discussionId, topicTitle, agentNames, agentDisplayNames }: AgentDiscussionViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [turns, setTurns] = useState<DiscussionTurn[]>([]);
  const [tlDr, setTlDr] = useState<string | null>(null);
  const [keyQuotes, setKeyQuotes] = useState<KeyQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const displayNames = agentDisplayNames?.length ? agentDisplayNames : agentNames;

  const loadTurns = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const [{ data: turnsData, error: turnsErr }, { data: discussion }] = await Promise.all([
        supabase
          .from('ai_agent_discussion_turns')
          .select('*')
          .eq('discussion_id', discussionId)
          .order('turn_number', { ascending: true }),
        supabase
          .from('ai_agent_discussions')
          .select('tl_dr, key_quotes')
          .eq('id', discussionId)
          .maybeSingle(),
      ]);

      if (!turnsErr && turnsData) {
        setTurns((turnsData as DiscussionTurn[]).filter(t => t.turn_number > 1));
        setLoaded(true);
      }
      if (discussion) {
        setTlDr((discussion as { tl_dr: string | null }).tl_dr ?? null);
        const quotes = (discussion as { key_quotes: KeyQuote[] | null }).key_quotes;
        setKeyQuotes(Array.isArray(quotes) ? quotes.slice(0, 3) : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !loaded) {
      loadTurns();
    }
  }, [isOpen]);

  return (
    <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {displayNames.slice(0, 3).map((name, i) => {
              const roleName = agentNames[i] || '';
              const colors = AGENT_COLORS[roleName] || AGENT_COLORS['The Pragmatist'];
              return (
                <div
                  key={i}
                  className={`w-6 h-6 rounded-full ${colors.bg} ${colors.border} border flex items-center justify-center text-[9px] font-bold ${colors.text} ring-1 ring-white`}
                >
                  {name.charAt(0).toUpperCase()}
                </div>
              );
            })}
          </div>
          <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {displayNames.slice(0, 2).join(' & ')}{displayNames.length > 2 ? ` & ${displayNames.length - 2} others` : ''} are discussing this
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <span className="text-xs">Read</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="bg-white">
          <div className="px-3 pt-3 pb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              {topicTitle}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : (
            <div className="px-3 pb-3 space-y-3">
              {tlDr && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3 h-3 text-blue-700" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-blue-700">
                      Panel TL;DR
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{tlDr}</p>
                  {keyQuotes.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {keyQuotes.map((q, i) => {
                        const colors = AGENT_COLORS[q.agent_name] || AGENT_COLORS['The Pragmatist'];
                        return (
                          <div key={i} className="flex items-start gap-1.5">
                            <Quote className={`w-3 h-3 mt-0.5 flex-shrink-0 ${colors.text}`} />
                            <p className="text-[11px] text-slate-600 leading-snug">
                              <span className={`font-semibold ${colors.text}`}>{q.display_name}:</span>{' '}
                              {q.quote}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {turns.map((turn, idx) => {
                const colors = AGENT_COLORS[turn.agent_name] || AGENT_COLORS['The Pragmatist'];
                const isLast = idx === turns.length - 1;

                return (
                  <div key={turn.id} className="flex gap-2.5">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full ${colors.bg} ${colors.border} border-2 flex items-center justify-center text-xs font-bold ${colors.text} flex-shrink-0`}
                      >
                        {turn.display_name.charAt(0).toUpperCase()}
                      </div>
                      {!isLast && <div className="w-0.5 flex-1 mt-1 bg-slate-100 min-h-[12px]" />}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-baseline gap-1.5 mb-1">
                        <span className="text-xs font-semibold text-slate-800">{turn.display_name}</span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{turn.content}</p>
                    </div>
                  </div>
                );
              })}

              {turns.length === 0 && !loading && (
                <div className="text-center py-4 text-slate-400 text-sm">
                  No discussion available
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
