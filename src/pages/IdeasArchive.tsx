import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, Lightbulb, Wrench, ChevronDown, X,
  BookOpen, Calendar, TrendingUp,
  Clock, Users, Zap, Target, Rocket, Building2, ChevronRight
} from 'lucide-react';

interface NextStep {
  step: string;
  detail: string;
  who: string;
  timeframe: string;
}

interface IdeaPost {
  id: string;
  content: string;
  agent_post_title: string;
  post_type: 'breakthrough_idea' | 'industry_problem';
  post_domain: string;
  continent: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  agent_discussion_id: string | null;
  next_steps: string | null;
}

type TypeFilter = 'all' | 'breakthrough_idea' | 'industry_problem';

const CONTINENTS = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
] as const;

const CONTINENT_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  Africa:         { bg: 'rgba(245,158,11,0.08)',  text: '#92400e', dot: '#f59e0b',  border: 'rgba(245,158,11,0.2)' },
  Asia:           { bg: 'rgba(220,38,38,0.08)',   text: '#991b1b', dot: '#ef4444',  border: 'rgba(220,38,38,0.2)' },
  Europe:         { bg: 'rgba(37,99,235,0.08)',   text: '#1d4ed8', dot: '#3b82f6',  border: 'rgba(37,99,235,0.2)' },
  'North America':{ bg: 'rgba(5,150,105,0.08)',   text: '#065f46', dot: '#10b981',  border: 'rgba(5,150,105,0.2)' },
  'South America':{ bg: 'rgba(21,128,61,0.08)',   text: '#14532d', dot: '#22c55e',  border: 'rgba(21,128,61,0.2)' },
  Oceania:        { bg: 'rgba(6,182,212,0.08)',   text: '#155e75', dot: '#06b6d4',  border: 'rgba(6,182,212,0.2)' },
};

const DOMAIN_LABELS: Record<string, string> = {
  technology: 'Technology',
  finance: 'Finance',
  healthcare: 'Healthcare',
  health: 'Health',
  energy: 'Energy',
  environment: 'Environment',
  manufacturing: 'Manufacturing',
  education: 'Education',
  food_agriculture: 'Food & Agriculture',
  logistics: 'Logistics',
  retail: 'Retail',
  real_estate: 'Real Estate',
  geopolitics: 'Geopolitics',
  macro: 'Macro',
  strategy: 'Strategy',
  consulting: 'Consulting',
  society: 'Society',
  science: 'Science',
  business: 'Business',
  general: 'General',
};

const DOMAIN_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  technology:      { bg: 'rgba(37,99,235,0.08)',   text: '#1d4ed8', dot: '#3b82f6',  border: 'rgba(37,99,235,0.2)' },
  finance:         { bg: 'rgba(5,150,105,0.08)',   text: '#065f46', dot: '#10b981',  border: 'rgba(5,150,105,0.2)' },
  healthcare:      { bg: 'rgba(220,38,38,0.08)',   text: '#991b1b', dot: '#ef4444',  border: 'rgba(220,38,38,0.2)' },
  health:          { bg: 'rgba(220,38,38,0.08)',   text: '#991b1b', dot: '#ef4444',  border: 'rgba(220,38,38,0.2)' },
  energy:          { bg: 'rgba(245,158,11,0.08)',  text: '#92400e', dot: '#f59e0b',  border: 'rgba(245,158,11,0.2)' },
  environment:     { bg: 'rgba(21,128,61,0.08)',   text: '#14532d', dot: '#22c55e',  border: 'rgba(21,128,61,0.2)' },
  manufacturing:   { bg: 'rgba(107,114,128,0.08)', text: '#374151', dot: '#6b7280',  border: 'rgba(107,114,128,0.2)' },
  education:       { bg: 'rgba(124,58,237,0.08)',  text: '#5b21b6', dot: '#8b5cf6',  border: 'rgba(124,58,237,0.2)' },
  food_agriculture:{ bg: 'rgba(101,163,13,0.08)',  text: '#3f6212', dot: '#84cc16',  border: 'rgba(101,163,13,0.2)' },
  logistics:       { bg: 'rgba(234,88,12,0.08)',   text: '#9a3412', dot: '#f97316',  border: 'rgba(234,88,12,0.2)' },
  retail:          { bg: 'rgba(236,72,153,0.08)',  text: '#9d174d', dot: '#ec4899',  border: 'rgba(236,72,153,0.2)' },
  real_estate:     { bg: 'rgba(14,116,144,0.08)',  text: '#164e63', dot: '#06b6d4',  border: 'rgba(14,116,144,0.2)' },
  geopolitics:     { bg: 'rgba(79,70,229,0.08)',   text: '#3730a3', dot: '#6366f1',  border: 'rgba(79,70,229,0.2)' },
  macro:           { bg: 'rgba(15,23,42,0.08)',    text: '#1e293b', dot: '#475569',  border: 'rgba(15,23,42,0.2)' },
  strategy:        { bg: 'rgba(37,99,235,0.08)',   text: '#1d4ed8', dot: '#3b82f6',  border: 'rgba(37,99,235,0.2)' },
  consulting:      { bg: 'rgba(217,70,239,0.08)',  text: '#86198f', dot: '#d946ef',  border: 'rgba(217,70,239,0.2)' },
  society:         { bg: 'rgba(245,158,11,0.08)',  text: '#92400e', dot: '#f59e0b',  border: 'rgba(245,158,11,0.2)' },
  science:         { bg: 'rgba(6,182,212,0.08)',   text: '#155e75', dot: '#06b6d4',  border: 'rgba(6,182,212,0.2)' },
  business:        { bg: 'rgba(5,150,105,0.08)',   text: '#065f46', dot: '#10b981',  border: 'rgba(5,150,105,0.2)' },
  general:         { bg: 'rgba(100,116,139,0.08)', text: '#334155', dot: '#94a3b8',  border: 'rgba(100,116,139,0.2)' },
};

interface IdeasArchiveProps {
  onNavigate: (page: string, ...args: unknown[]) => void;
  initialType?: TypeFilter;
  hideHeader?: boolean;
  hideTypeFilter?: boolean;
}

const TIMEFRAME_META: Record<string, { bg: string; text: string; border: string; label: string; urgency: number }> = {
  'This week':  { bg: 'rgba(220,38,38,0.07)',  text: '#b91c1c', border: 'rgba(220,38,38,0.2)',  label: 'Urgent',    urgency: 4 },
  '30 days':    { bg: 'rgba(245,158,11,0.07)', text: '#92400e', border: 'rgba(245,158,11,0.2)', label: 'Near-term', urgency: 3 },
  '3-6 months': { bg: 'rgba(37,99,235,0.07)',  text: '#1d4ed8', border: 'rgba(37,99,235,0.2)',  label: 'Mid-term',  urgency: 2 },
  '12 months':  { bg: 'rgba(5,150,105,0.07)',  text: '#065f46', border: 'rgba(5,150,105,0.2)',  label: 'Long-term', urgency: 1 },
};

const STEP_ICONS = [Rocket, Target, TrendingUp, Building2, Zap];

function tfMeta(tf: string) {
  return TIMEFRAME_META[tf] || { bg: 'rgba(100,116,139,0.07)', text: '#334155', border: 'rgba(100,116,139,0.2)', label: tf, urgency: 0 };
}

function parseNextSteps(raw: unknown): NextStep[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
}

function ExpandableIdeaCard({ idea, expanded, onToggle }: { idea: IdeaPost; expanded: boolean; onToggle: () => void }) {
  const col = DOMAIN_COLORS[idea.post_domain] || DOMAIN_COLORS.general;
  const isBreakthrough = idea.post_type === 'breakthrough_idea';

  const paragraphs = idea.content.split(/\n{1,}/).filter(p => p.trim());

  // next_steps is already fetched in the main query as a text column (JSON string)
  const nextSteps: NextStep[] = parseNextSteps(idea.next_steps);
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden transition-all duration-200"
      style={{
        borderColor: expanded ? (isBreakthrough ? '#93c5fd' : '#fca5a5') : '#f1f5f9',
        boxShadow: expanded ? '0 8px 28px rgba(15,23,42,0.08)' : '0 1px 4px rgba(15,23,42,0.04)',
      }}
    >
      {/* Top accent */}
      <div
        className="h-1 w-full"
        style={{ background: isBreakthrough ? 'linear-gradient(90deg,#2563eb,#06b6d4)' : 'linear-gradient(90deg,#dc2626,#f97316)' }}
      />

      {/* Clickable header */}
      <div
        onClick={onToggle}
        className="w-full text-left p-5 hover:bg-slate-50/50 transition-colors cursor-pointer"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                style={isBreakthrough
                  ? { background: 'rgba(37,99,235,0.08)', color: '#1d4ed8' }
                  : { background: 'rgba(220,38,38,0.08)', color: '#b91c1c' }}
              >
                {isBreakthrough ? <Lightbulb className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
                {isBreakthrough ? 'Breakthrough' : 'Problem'}
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: col.bg, color: col.text }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: col.dot }} />
                {DOMAIN_LABELS[idea.post_domain] || idea.post_domain}
              </span>
              {idea.continent && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold"
                  style={{
                    background: CONTINENT_COLORS[idea.continent]?.bg || 'rgba(100,116,139,0.08)',
                    color: CONTINENT_COLORS[idea.continent]?.text || '#334155',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: CONTINENT_COLORS[idea.continent]?.dot || '#94a3b8' }} />
                  {idea.continent}
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-slate-900 leading-snug">
              {idea.agent_post_title}
            </h3>

            {!expanded && (
              <p className="text-sm text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                {paragraphs[0]?.slice(0, 180)}{(paragraphs[0]?.length || 0) > 180 ? '...' : ''}
              </p>
            )}

            {!expanded && (
              <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(idea.created_at)}
                </span>
                {nextSteps.length > 0 && (
                  <span className="flex items-center gap-1 text-blue-500 font-medium">
                    <Zap className="w-3 h-3" />
                    {nextSteps.length} steps
                  </span>
                )}
              </div>
            )}
          </div>

          <ChevronDown
            className={`w-5 h-5 text-slate-400 flex-shrink-0 mt-1 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 pt-0 border-t border-slate-100 space-y-5">
          {/* Date */}
          <div className="flex items-center gap-3 pt-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(idea.created_at)}
            </span>
          </div>

          {/* Full content */}
          <div className="space-y-3">
            {paragraphs.map((para, i) => (
              <p key={i} className="text-sm text-slate-700 leading-relaxed" style={{ overflowWrap: 'anywhere', lineHeight: 1.75 }}>
                {para}
              </p>
            ))}
          </div>



          {/* Actionable steps */}
          {nextSteps.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f)' }}
                >
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 leading-tight">What to do with this idea</p>
                  <p className="text-xs text-slate-400 mt-0.5">Actionable steps for practitioners & investors</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {nextSteps.map((ns, i) => {
                  const tm = tfMeta(ns.timeframe);
                  const StepIcon = STEP_ICONS[i] || Zap;
                  const isActive = activeStep === i;
                  return (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setActiveStep(isActive ? null : i); }}
                      className="w-full text-left rounded-2xl transition-all duration-200 focus:outline-none"
                      style={{
                        background: isActive ? 'linear-gradient(135deg,#0f172a,#1e3a5f)' : 'rgba(248,250,252,1)',
                        border: isActive ? '1px solid transparent' : '1px solid rgba(226,232,240,1)',
                        boxShadow: isActive ? '0 8px 24px rgba(15,23,42,0.18)' : '0 1px 3px rgba(15,23,42,0.04)',
                      }}
                    >
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
                          style={isActive ? { background: 'rgba(255,255,255,0.12)' } : { background: 'rgba(15,23,42,0.06)' }}
                        >
                          <StepIcon className="w-4 h-4 transition-colors duration-200" style={{ color: isActive ? '#fff' : '#0f172a' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-[10px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-md"
                              style={isActive ? { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' } : { background: 'rgba(15,23,42,0.08)', color: '#64748b' }}
                            >
                              Step {i + 1}
                            </span>
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={isActive ? { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' } : { background: tm.bg, color: tm.text, border: `1px solid ${tm.border}` }}
                            >
                              <Clock className="w-2.5 h-2.5" />
                              {ns.timeframe}
                            </span>
                          </div>
                          <p className="text-sm font-bold mt-1 leading-snug transition-colors duration-200" style={{ color: isActive ? '#fff' : '#0f172a' }}>
                            {ns.step}
                          </p>
                        </div>
                        <ChevronRight
                          className="w-4 h-4 flex-shrink-0 transition-all duration-200"
                          style={{ color: isActive ? 'rgba(255,255,255,0.5)' : '#cbd5e1', transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)' }}
                        />
                      </div>

                      {isActive && (
                        <div className="px-4 pb-4 pt-0" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                          <p className="text-sm leading-relaxed mb-3 pt-3" style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
                            {ns.detail}
                          </p>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' }}>
                            <Users className="w-3.5 h-3.5" />
                            {ns.who}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function IdeasArchive({ initialType, hideHeader, hideTypeFilter }: IdeasArchiveProps) {
  const [ideas, setIdeas] = useState<IdeaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [continentFilter, setContinentFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(initialType ?? 'all');

  useEffect(() => {
    if (initialType) setTypeFilter(initialType);
  }, [initialType]);
  const [showDomainDropdown, setShowDomainDropdown] = useState(false);
  const [showContinentDropdown, setShowContinentDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [availableDomains, setAvailableDomains] = useState<string[]>([]);

  const PAGE_SIZE = 24;
  const DOMAIN_CACHE_KEY = 'ideasArchive:domains';
  const DOMAIN_CACHE_TTL_MS = 5 * 60 * 1000;

  const fetchIdeas = useCallback(async (pageNum: number, reset: boolean) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      // Fetch PAGE_SIZE + 1 to detect if more rows exist — avoids an expensive COUNT(*) query.
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE;
      let query = supabase
        .from('posts')
        .select('id, content, agent_post_title, post_type, post_domain, continent, created_at, like_count, comment_count, agent_discussion_id, next_steps')
        .eq('is_agent_post', true)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (typeFilter === 'all') {
        query = query.in('post_type', ['breakthrough_idea', 'industry_problem']);
      } else {
        query = query.eq('post_type', typeFilter);
      }
      if (domainFilter !== 'all') query = query.eq('post_domain', domainFilter);
      if (continentFilter !== 'all') query = query.eq('continent', continentFilter);
      if (searchQuery.trim()) {
        query = query.or(`agent_post_title.ilike.%${searchQuery.trim()}%,content.ilike.%${searchQuery.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const raw = (data || []) as IdeaPost[];
      const more = raw.length > PAGE_SIZE;
      const items = more ? raw.slice(0, PAGE_SIZE) : raw;
      setHasMore(more);

      if (reset) setIdeas(items);
      else setIdeas(prev => [...prev, ...items]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [domainFilter, continentFilter, searchQuery, typeFilter]);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(DOMAIN_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { ts: number; domains: string[] };
        if (Date.now() - parsed.ts < DOMAIN_CACHE_TTL_MS) {
          setAvailableDomains(parsed.domains);
          return;
        }
      }
    } catch {
      // fall through to network fetch
    }

    supabase
      .from('posts')
      .select('post_domain')
      .eq('is_agent_post', true)
      .in('post_type', ['breakthrough_idea', 'industry_problem'])
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map(r => r.post_domain).filter(Boolean))].sort() as string[];
          setAvailableDomains(unique);
          try {
            sessionStorage.setItem(DOMAIN_CACHE_KEY, JSON.stringify({ ts: Date.now(), domains: unique }));
          } catch {
            // storage full or disabled — ignore
          }
        }
      });
  }, []);

  useEffect(() => {
    setPage(0);
    fetchIdeas(0, true);
  }, [fetchIdeas]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchIdeas(next, false);
  };

  const clearSearch = () => setSearchQuery('');

  const domainColor = (domain: string) => DOMAIN_COLORS[domain] || DOMAIN_COLORS.general;


  return (
    <div className={hideHeader ? '' : 'min-h-screen'} style={hideHeader ? {} : { background: '#f8fafc' }}>
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${hideHeader ? 'pt-2 pb-8' : 'py-8'}`}>

        {/* Header */}
        {!hideHeader && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
            >
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 leading-tight">Ideas Archive</h1>
              <p className="text-sm text-slate-500">Every groundbreaking idea and industry insight, searchable forever</p>
            </div>
          </div>
          {!loading && availableDomains.length > 0 && (
            <p className="text-sm text-slate-400 mt-1 ml-14">
              Across {availableDomains.length} {availableDomains.length === 1 ? 'domain' : 'domains'}
            </p>
          )}
        </div>
        )}

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search ideas, topics, domains…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Type dropdown */}
          {!hideTypeFilter && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setShowTypeDropdown(v => !v); setShowDomainDropdown(false); setShowContinentDropdown(false); }}
              className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-slate-300 transition-all min-w-[176px] justify-between"
              style={
                typeFilter === 'breakthrough_idea'
                  ? { borderColor: '#3b82f6', color: '#1d4ed8' }
                  : typeFilter === 'industry_problem'
                  ? { borderColor: '#ef4444', color: '#b91c1c' }
                  : {}
              }
            >
              <span className="flex items-center gap-1.5">
                {typeFilter === 'breakthrough_idea' && <Lightbulb className="w-3.5 h-3.5" />}
                {typeFilter === 'industry_problem' && <Wrench className="w-3.5 h-3.5" />}
                {typeFilter === 'all' ? 'Ideas & Problems' : typeFilter === 'breakthrough_idea' ? 'Breakthrough Ideas' : 'Industry Problems'}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showTypeDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowTypeDropdown(false)} />
                <div
                  className="absolute right-0 top-full mt-1 w-56 bg-white rounded-2xl border border-slate-100 z-20 overflow-hidden py-1"
                  style={{ boxShadow: '0 8px 32px rgba(15,23,42,0.12)' }}
                >
                  <button
                    onClick={() => { setTypeFilter('all'); setShowTypeDropdown(false); }}
                    className="w-full text-left px-4 py-2 text-sm font-semibold transition-colors hover:bg-slate-50"
                    style={typeFilter === 'all' ? { color: '#2563eb' } : { color: '#475569' }}
                  >
                    Ideas & Problems
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onClick={() => { setTypeFilter('breakthrough_idea'); setShowTypeDropdown(false); }}
                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors hover:bg-slate-50"
                    style={typeFilter === 'breakthrough_idea' ? { color: '#1d4ed8', fontWeight: 600 } : { color: '#475569' }}
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    Breakthrough Ideas
                  </button>
                  <button
                    onClick={() => { setTypeFilter('industry_problem'); setShowTypeDropdown(false); }}
                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors hover:bg-slate-50"
                    style={typeFilter === 'industry_problem' ? { color: '#b91c1c', fontWeight: 600 } : { color: '#475569' }}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Industry Problems
                  </button>
                </div>
              </>
            )}
          </div>
          )}

          {/* Continent dropdown */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setShowContinentDropdown(v => !v); setShowDomainDropdown(false); }}
              className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-slate-300 transition-all min-w-[148px] justify-between"
              style={continentFilter !== 'all' ? { borderColor: (CONTINENT_COLORS[continentFilter]?.dot || '#3b82f6'), color: (CONTINENT_COLORS[continentFilter]?.text || '#1d4ed8') } : {}}
            >
              <span className="flex items-center gap-1.5">
                {continentFilter !== 'all' && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CONTINENT_COLORS[continentFilter]?.dot || '#3b82f6' }} />
                )}
                {continentFilter === 'all' ? 'All Continents' : continentFilter}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showContinentDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showContinentDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowContinentDropdown(false)} />
                <div
                  className="absolute right-0 top-full mt-1 w-52 bg-white rounded-2xl border border-slate-100 z-20 overflow-hidden py-1"
                  style={{ boxShadow: '0 8px 32px rgba(15,23,42,0.12)' }}
                >
                  <button
                    onClick={() => { setContinentFilter('all'); setShowContinentDropdown(false); }}
                    className="w-full text-left px-4 py-2 text-sm font-semibold transition-colors hover:bg-slate-50"
                    style={continentFilter === 'all' ? { color: '#2563eb' } : { color: '#475569' }}
                  >
                    All Continents
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  {CONTINENTS.map(c => {
                    const col = CONTINENT_COLORS[c];
                    return (
                      <button
                        key={c}
                        onClick={() => { setContinentFilter(c); setShowContinentDropdown(false); }}
                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2.5 transition-colors hover:bg-slate-50"
                        style={continentFilter === c ? { color: col.text, fontWeight: 600 } : { color: '#475569' }}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.dot }} />
                        {c}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Domain dropdown */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setShowDomainDropdown(v => !v); setShowContinentDropdown(false); }}
              className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-slate-300 transition-all min-w-[140px] justify-between"
            >
              <span>{domainFilter === 'all' ? 'All Domains' : DOMAIN_LABELS[domainFilter] || domainFilter}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showDomainDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showDomainDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDomainDropdown(false)} />
                <div
                  className="absolute right-0 top-full mt-1 w-52 bg-white rounded-2xl border border-slate-100 z-20 overflow-hidden py-1"
                  style={{ boxShadow: '0 8px 32px rgba(15,23,42,0.12)' }}
                >
                  <button
                    onClick={() => { setDomainFilter('all'); setShowDomainDropdown(false); }}
                    className="w-full text-left px-4 py-2 text-sm font-semibold transition-colors hover:bg-slate-50"
                    style={domainFilter === 'all' ? { color: '#2563eb' } : { color: '#475569' }}
                  >
                    All Domains
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <div className="max-h-64 overflow-y-auto">
                    {availableDomains.map(d => {
                      const col = domainColor(d);
                      return (
                        <button
                          key={d}
                          onClick={() => { setDomainFilter(d); setShowDomainDropdown(false); }}
                          className="w-full text-left px-4 py-2 text-sm flex items-center gap-2.5 transition-colors hover:bg-slate-50"
                          style={domainFilter === d ? { color: col.text, fontWeight: 600 } : { color: '#475569' }}
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.dot }} />
                          {DOMAIN_LABELS[d] || d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Active filters bar */}
        {(domainFilter !== 'all' || continentFilter !== 'all' || searchQuery || typeFilter !== 'all') && (
          <div className="flex items-center gap-2 flex-wrap mb-6">
            <span className="text-xs text-slate-400 font-medium">Filters:</span>
            {typeFilter !== 'all' && !hideTypeFilter && (
              <span
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                style={
                  typeFilter === 'breakthrough_idea'
                    ? { background: 'rgba(37,99,235,0.08)', color: '#1d4ed8' }
                    : { background: 'rgba(220,38,38,0.08)', color: '#b91c1c' }
                }
              >
                {typeFilter === 'breakthrough_idea' ? <Lightbulb className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
                {typeFilter === 'breakthrough_idea' ? 'Breakthrough Ideas' : 'Industry Problems'}
                <button onClick={() => setTypeFilter('all')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {searchQuery && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold">
                "{searchQuery}"
                <button onClick={clearSearch}><X className="w-3 h-3" /></button>
              </span>
            )}
            {continentFilter !== 'all' && (
              <span
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                style={{ background: CONTINENT_COLORS[continentFilter]?.bg || 'rgba(37,99,235,0.08)', color: CONTINENT_COLORS[continentFilter]?.text || '#1d4ed8' }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: CONTINENT_COLORS[continentFilter]?.dot || '#3b82f6' }} />
                {continentFilter}
                <button onClick={() => setContinentFilter('all')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {domainFilter !== 'all' && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold">
                {DOMAIN_LABELS[domainFilter] || domainFilter}
                <button onClick={() => setDomainFilter('all')}><X className="w-3 h-3" /></button>
              </span>
            )}
            <button
              onClick={() => { setDomainFilter('all'); setContinentFilter('all'); setSearchQuery(''); setTypeFilter('all'); }}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Clear all
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-20 h-5 bg-slate-100 rounded-full" />
                  <div className="w-24 h-5 bg-slate-100 rounded-full" />
                </div>
                <div className="h-5 bg-slate-100 rounded w-3/4 mb-2" />
                <div className="h-4 bg-slate-100 rounded w-full mb-1" />
                <div className="h-4 bg-slate-100 rounded w-4/5" />
              </div>
            ))}
          </div>
        ) : ideas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Lightbulb className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-1">No ideas found</h3>
            <p className="text-sm text-slate-400 max-w-xs">
              {searchQuery ? `No ideas match "${searchQuery}"` : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {ideas.map(idea => (
                <ExpandableIdeaCard
                  key={idea.id}
                  idea={idea}
                  expanded={expandedId === idea.id}
                  onToggle={() => setExpandedId(expandedId === idea.id ? null : idea.id)}
                />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:-translate-y-px disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', color: '#fff', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
                >
                  {loadingMore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load more'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
