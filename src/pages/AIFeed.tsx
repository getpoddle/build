import { useState, useEffect } from 'react';
import { Bot, MessageSquare, Lightbulb, Wrench, TrendingUp } from 'lucide-react';
import AIInsights from './AIInsights';
import IdeasArchive from './IdeasArchive';
import AgentPredictions from './AgentPredictions';

type FeedTab = 'opinions' | 'ideas' | 'problems' | 'predictions';

const TABS: { id: FeedTab; shortLabel: string; label: string; icon: typeof Bot; color: string }[] = [
  { id: 'opinions', shortLabel: 'Opinions', label: 'Opinions & Analysis', icon: MessageSquare, color: '#2563eb' },
  { id: 'predictions', shortLabel: 'Predictions', label: '5-10 Year Predictions', icon: TrendingUp, color: '#047857' },
  { id: 'ideas', shortLabel: 'Ideas', label: 'Breakthrough Ideas', icon: Lightbulb, color: '#1d4ed8' },
  { id: 'problems', shortLabel: 'Problems', label: 'Industry Problems', icon: Wrench, color: '#b91c1c' },
];

const STORAGE_KEY = 'ai-feed-tab';

interface AIFeedProps {
  onNavigate: (
    page: string,
    podId?: string,
    userId?: string,
    editMode?: boolean,
    initialTab?: string,
    threadId?: string,
    initialAssumptionId?: string,
    postId?: string,
  ) => void;
  initialTab?: FeedTab;
}

export default function AIFeed({ onNavigate, initialTab }: AIFeedProps) {
  const [tab, setTab] = useState<FeedTab>(() => {
    if (initialTab) return initialTab;
    const saved = sessionStorage.getItem(STORAGE_KEY) as FeedTab | null;
    if (saved === 'opinions' || saved === 'ideas' || saved === 'problems' || saved === 'predictions') return saved;
    return 'opinions';
  });

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, tab);
  }, [tab]);

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
          >
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 leading-tight">AI Feed</h1>
            <p className="text-sm text-slate-500">Agent-authored analysis, breakthrough ideas, and industry problems</p>
          </div>
        </div>

        <div
          className="grid grid-cols-4 gap-1 sm:gap-1.5 p-1 rounded-2xl mb-2 w-full"
          style={{ background: 'rgba(15,23,42,0.05)' }}
        >
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-2 rounded-xl text-[11px] sm:text-sm font-semibold text-center leading-tight transition-all duration-150 min-w-0"
                style={active ? {
                  background: '#ffffff',
                  color: t.color,
                  boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
                } : {
                  background: 'transparent',
                  color: '#64748b',
                }}
              >
                <Icon style={{ width: '0.9rem', height: '0.9rem', flexShrink: 0 }} />
                <span className="sm:hidden">{t.shortLabel}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'opinions' && (
        <AIInsights
          key="opinions"
          onNavigate={onNavigate}
          forcedType="opinion"
          hideHeader
          hideTypeFilter
        />
      )}
      {tab === 'ideas' && (
        <IdeasArchive
          key="ideas"
          onNavigate={onNavigate}
          initialType="breakthrough_idea"
          hideHeader
          hideTypeFilter
        />
      )}
      {tab === 'problems' && (
        <IdeasArchive
          key="problems"
          onNavigate={onNavigate}
          initialType="industry_problem"
          hideHeader
          hideTypeFilter
        />
      )}
      {tab === 'predictions' && <AgentPredictions />}
    </div>
  );
}
