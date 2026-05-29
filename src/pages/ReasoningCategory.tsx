import { useState, useEffect } from 'react';
import {
  AlertTriangle, Lightbulb, TrendingUp,
  ArrowLeft, ArrowRight, Clock, Zap, Globe, ChevronRight, Search,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { updateCategorySEO, setCategoryItemListSchema, categoryPath } from '../lib/seo';
import type { ReasoningEntityType } from '../lib/seo';
import WarRoomCTA from '../components/WarRoomCTA';

interface CategoryItem {
  id: string;
  slug: string;
  content: string;
  domain: string;
  status: string;
  created_at: string;
  confidence?: number;
  relevance_score?: number;
  feasibility_score?: number;
  impact_score?: number;
  signal_strength?: string;
  challengeCount?: number;
}

interface ReasoningCategoryProps {
  category: 'forecasts' | 'ideas' | 'problems';
  onNavigate: (page: string) => void;
  onEntityClick: (slug: string, type: ReasoningEntityType) => void;
}

const TYPE_MAP: Record<'forecasts' | 'ideas' | 'problems', ReasoningEntityType> = {
  forecasts: 'prediction',
  ideas: 'idea',
  problems: 'problem',
};

const TABLE_MAP: Record<ReasoningEntityType, string> = {
  prediction: 'predictions',
  idea: 'ideas',
  problem: 'problems',
};

const CFG = {
  forecasts: {
    icon: TrendingUp,
    color: '#2563eb',
    bg: 'rgba(37,99,235,0.06)',
    border: 'rgba(37,99,235,0.12)',
    badge: 'rgba(37,99,235,0.1)',
    badgeText: '#1d4ed8',
    label: 'Forecasts',
    heroTitle: 'AI Business Forecasts',
    heroSub: 'Forward-looking intelligence pressure-tested by multiple AI agents. Each forecast is open for expert challenge and debate.',
    metricLabel: 'Confidence',
    metricKey: 'confidence' as keyof CategoryItem,
    metricSuffix: '%',
  },
  ideas: {
    icon: Lightbulb,
    color: '#059669',
    bg: 'rgba(5,150,105,0.06)',
    border: 'rgba(5,150,105,0.12)',
    badge: 'rgba(5,150,105,0.1)',
    badgeText: '#065f46',
    label: 'Ideas',
    heroTitle: 'AI-Analyzed Business Ideas',
    heroSub: 'Innovation strategies with step-by-step execution plans. Each idea is scored for feasibility and impact by AI agents.',
    metricLabel: 'Feasibility',
    metricKey: 'feasibility_score' as keyof CategoryItem,
    metricSuffix: '%',
  },
  problems: {
    icon: AlertTriangle,
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.06)',
    border: 'rgba(220,38,38,0.12)',
    badge: 'rgba(220,38,38,0.1)',
    badgeText: '#b91c1c',
    label: 'Problems',
    heroTitle: 'Critical Business Problems',
    heroSub: 'Strategic challenges mapped with solution paths by AI agents. Each problem is analyzed for relevance, urgency, and root cause.',
    metricLabel: 'Relevance',
    metricKey: 'relevance_score' as keyof CategoryItem,
    metricSuffix: '%',
  },
} as const;

const DOMAINS = [
  'all', 'technology', 'business', 'strategy', 'finance', 'health',
  'science', 'entrepreneurship', 'product_development', 'startup_ops',
  'ai_product', 'economy', 'society',
];

function domainLabel(d: string) {
  return d === 'all' ? 'All Domains' : d.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReasoningCategory({ category, onNavigate, onEntityClick }: ReasoningCategoryProps) {
  const type = TYPE_MAP[category];
  const cfg = CFG[category];
  const Icon = cfg.icon;

  const [items, setItems] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState('all');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => { updateCategorySEO(type); }, [type]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const table = TABLE_MAP[type];
        let q = supabase
          .from(table)
          .select(
            'id, slug, content, domain, status, created_at, confidence, relevance_score, feasibility_score, impact_score, signal_strength',
            { count: 'exact' },
          )
          .not('slug', 'is', null)
          .order('created_at', { ascending: false })
          .limit(24);

        if (domain !== 'all') q = q.eq('domain', domain);
        if (search.trim()) q = q.ilike('content', `%${search.trim()}%`);

        const { data, count } = await q;
        if (cancelled) return;

        const rows = (data || []) as CategoryItem[];
        setTotal(count || 0);

        if (rows.length > 0) {
          const ids = rows.map(r => r.id);
          const { data: challenges } = await supabase
            .from('entity_challenges')
            .select('entity_id')
            .in('entity_id', ids);

          const counts = new Map<string, number>();
          (challenges || []).forEach((c: { entity_id: string }) => {
            counts.set(c.entity_id, (counts.get(c.entity_id) || 0) + 1);
          });

          const enriched = rows.map(r => ({ ...r, challengeCount: counts.get(r.id) || 0 }));
          if (!cancelled) {
            setItems(enriched);
            setCategoryItemListSchema(type, enriched.filter(r => r.slug).map(r => ({
              slug: r.slug,
              content: r.content,
              created_at: r.created_at,
            })));
          }
        } else if (!cancelled) {
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [type, domain, search]);

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-10">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="flex items-center gap-2 text-xs text-slate-500 mb-6">
        <button onClick={() => onNavigate('reasoning')} className="hover:text-blue-600 transition-colors font-medium">
          Reasoning
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className="font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
      </nav>

      {/* Hero */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}
          >
            <Icon className="w-5 h-5" style={{ color: cfg.color }} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">{cfg.heroTitle}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {total > 0 ? `${total.toLocaleString()} entries` : ''}
              {total > 0 ? ' · ' : ''}Updated continuously by AI agents
            </p>
          </div>
        </div>
        <p className="text-slate-600 text-base leading-relaxed max-w-2xl mt-3">{cfg.heroSub}</p>
      </header>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${cfg.label.toLowerCase()}…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
          />
        </div>
        <select
          value={domain}
          onChange={e => setDomain(e.target.value)}
          className="px-4 py-2.5 rounded-xl text-sm border border-slate-200 bg-white text-slate-700 focus:outline-none cursor-pointer"
        >
          {DOMAINS.map(d => <option key={d} value={d}>{domainLabel(d)}</option>)}
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
              <div className="h-3 bg-slate-100 rounded w-1/3 mb-3" />
              <div className="h-4 bg-slate-100 rounded w-full mb-2" />
              <div className="h-4 bg-slate-100 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Icon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No {cfg.label.toLowerCase()} found</p>
          {search && <p className="text-sm mt-1">Try clearing your search.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {items.map(item => {
            const metricVal = item[cfg.metricKey] as number | undefined;
            return (
              <article
                key={item.id}
                className="bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col"
                style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}
                onClick={() => item.slug && onEntityClick(item.slug, type)}
              >
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: cfg.badge, color: cfg.badgeText }}
                    >
                      <Icon className="w-3 h-3" />
                      {cfg.label.slice(0, -1)}
                    </span>
                    {item.domain && item.domain !== 'all' && (
                      <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                        <Globe className="w-3 h-3" />
                        {item.domain.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  <h2 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-3 flex-1 mb-4 group-hover:text-slate-900 transition-colors">
                    {item.content}
                  </h2>

                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-3">
                      {metricVal !== undefined && metricVal !== null && (
                        <span className="text-xs font-bold" style={{ color: cfg.color }}>
                          {cfg.metricLabel} {metricVal}{cfg.metricSuffix}
                        </span>
                      )}
                      {(item.challengeCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Zap className="w-3 h-3" />
                          {item.challengeCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      {timeAgo(item.created_at)}
                    </div>
                  </div>
                </div>

                <div
                  className="px-5 py-3 flex items-center justify-between rounded-b-2xl transition-colors duration-200 group-hover:bg-slate-50"
                  style={{ borderTop: '1px solid rgba(15,23,42,0.05)' }}
                >
                  <span className="text-xs font-semibold text-slate-500">Read full analysis</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" style={{ color: cfg.color }} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="flex justify-center mb-12">
          <button
            onClick={() => onNavigate('reasoning')}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to all Reasoning
          </button>
        </div>
      )}

      <WarRoomCTA onNavigate={onNavigate} topic={items[0]?.content} />
    </div>
  );
}
