import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Cpu, TrendingUp, Rocket, Sparkles, AlertTriangle, CheckCircle2,
  Target, Clock, Activity, Flame, ChevronDown, Eye, Compass, ExternalLink
} from 'lucide-react';
import ShareButton from '../components/ShareButton';
import ShareableInsightCard from '../components/ShareableInsightCard';

type Industry = 'technology' | 'finance' | 'entrepreneurship';
type Horizon = 'all' | '5' | '10';
type SignalStrength = 'weak' | 'building' | 'strong';

interface Prediction {
  id: string;
  industry: Industry;
  agent_role: string;
  headline: string;
  thesis: string;
  horizon_years: 5 | 10;
  confidence: number;
  signal_strength: SignalStrength;
  contrarian: boolean;
  evidence: string[];
  implications: string[];
  created_at: string;
}

const INDUSTRY_META: Record<Industry, { label: string; icon: typeof Cpu; color: string; bg: string; ring: string }> = {
  technology:      { label: 'Technology',        icon: Cpu,        color: '#1d4ed8', bg: 'rgba(37,99,235,0.08)',  ring: 'rgba(37,99,235,0.2)' },
  finance:         { label: 'Finance',           icon: TrendingUp, color: '#047857', bg: 'rgba(5,150,105,0.08)',  ring: 'rgba(5,150,105,0.2)' },
  entrepreneurship:{ label: 'Entrepreneurship',  icon: Rocket,     color: '#b45309', bg: 'rgba(245,158,11,0.08)', ring: 'rgba(245,158,11,0.2)' },
};

const SIGNAL_META: Record<SignalStrength, { label: string; color: string; bars: number }> = {
  weak:     { label: 'Weak signal',     color: '#94a3b8', bars: 1 },
  building: { label: 'Building signal', color: '#3b82f6', bars: 2 },
  strong:   { label: 'Strong signal',   color: '#10b981', bars: 3 },
};

function SignalBars({ strength }: { strength: SignalStrength }) {
  const meta = SIGNAL_META[strength];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex items-end gap-0.5">
        {[1, 2, 3].map(i => (
          <span
            key={i}
            className="w-1 rounded-sm"
            style={{
              height: `${i * 4 + 2}px`,
              background: i <= meta.bars ? meta.color : '#e2e8f0',
            }}
          />
        ))}
      </span>
      <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: meta.color }}>
        {meta.label}
      </span>
    </span>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 16;
  const dash = (value / 100) * circumference;
  const tone = value >= 70 ? '#10b981' : value >= 55 ? '#3b82f6' : '#f59e0b';
  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle cx="24" cy="24" r="16" strokeWidth="4" stroke="#eef2f7" fill="none" />
        <circle
          cx="24" cy="24" r="16" strokeWidth="4" stroke={tone} fill="none" strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-black" style={{ color: tone }}>{value}</span>
      </div>
    </div>
  );
}

function PredictionCard({ p, highlighted, cardRef }: { p: Prediction; highlighted?: boolean; cardRef?: (el: HTMLElement | null) => void }) {
  const [expanded, setExpanded] = useState(!!highlighted);
  const [showShareCard, setShowShareCard] = useState(false);
  const meta = INDUSTRY_META[p.industry];
  const Icon = meta.icon;
  const shareUrl = `${window.location.origin}${window.location.pathname}#prediction/${p.id}`;

  useEffect(() => {
    if (highlighted) setExpanded(true);
  }, [highlighted]);

  return (
    <article
      ref={cardRef}
      className="bg-white rounded-3xl border overflow-hidden transition-all"
      style={{
        boxShadow: highlighted ? '0 8px 28px rgba(37,99,235,0.18)' : '0 2px 8px rgba(15,23,42,0.04)',
        borderColor: highlighted ? '#2563eb' : '#f1f5f9',
      }}
    >
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.color}99)` }} />

      <div className="p-6">
        <div className="flex items-start gap-4">
          <ConfidenceRing value={p.confidence} />

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase"
                style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.ring}` }}
              >
                <Icon className="w-3 h-3" />
                {meta.label}
              </span>
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                style={{ background: 'rgba(15,23,42,0.06)', color: '#0f172a' }}
              >
                <Clock className="w-3 h-3" />
                {p.horizon_years}-year horizon
              </span>
              {p.contrarian && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c' }}
                >
                  <Flame className="w-3 h-3" />
                  Contrarian
                </span>
              )}
              <SignalBars strength={p.signal_strength} />
            </div>

            <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
              {p.headline}
            </h3>

            <p className="text-xs font-bold tracking-widest uppercase text-slate-400 mt-3">
              {p.agent_role}&apos;s thesis
            </p>
            <p className="text-sm text-slate-700 mt-1.5" style={{ lineHeight: 1.7 }}>
              {p.thesis}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => setExpanded(v => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            {expanded ? 'Hide evidence & implications' : 'See evidence & implications'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShareCard(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-semibold transition-colors touch-manipulation"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Share card
            </button>
            <ShareButton
              url={shareUrl}
              title={p.headline}
              text={`${p.headline} — ${meta.label} forecast (${p.horizon_years}-year horizon, ${p.confidence}% confidence) by ${p.agent_role} on Poddle`}
              size="sm"
            />
          </div>
        </div>

        {showShareCard && (
          <ShareableInsightCard
            type="prediction"
            title={p.headline}
            content={p.thesis}
            authorName={p.agent_role}
            podName={`${meta.label} \u00B7 ${p.horizon_years}-yr horizon`}
            stat={{ label: 'Confidence', value: `${p.confidence}%` }}
            shareUrl={shareUrl}
            onClose={() => setShowShareCard(false)}
          />
        )}

        {expanded && (
          <div className="mt-5 space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-5">
            <div className="rounded-2xl border border-slate-100 p-4 sm:p-5" style={{ background: '#f8fafc' }}>
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-3.5 h-3.5" style={{ color: '#1d4ed8' }} />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Evidence</p>
              </div>
              <ul className="space-y-3">
                {p.evidence.map((e, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] text-slate-700 leading-relaxed" style={{ overflowWrap: 'anywhere' }}>
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-100 p-4 sm:p-5" style={{ background: '#f8fafc' }}>
              <div className="flex items-center gap-2 mb-3">
                <Compass className="w-3.5 h-3.5" style={{ color: '#b45309' }} />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">If true, then</p>
              </div>
              <ul className="space-y-3">
                {p.implications.map((e, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] text-slate-700 leading-relaxed" style={{ overflowWrap: 'anywhere' }}>
                    <Target className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#b45309' }} />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export default function AgentPredictions({ highlightId }: { highlightId?: string | null } = {}) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [industryFilter, setIndustryFilter] = useState<Industry | 'all'>('all');
  const [horizonFilter, setHorizonFilter] = useState<Horizon>('all');
  const [contrarianOnly, setContrarianOnly] = useState(false);
  const highlightRef = useRef<HTMLElement | null>(null);
  const scrolledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('agent_predictions')
        .select('id, industry, agent_role, headline, thesis, horizon_years, confidence, signal_strength, contrarian, evidence, implications, created_at')
        .order('confidence', { ascending: false });
      if (!cancelled && !error && data) setPredictions(data as Prediction[]);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    return predictions.filter(p => {
      if (highlightId && p.id === highlightId) return true;
      if (industryFilter !== 'all' && p.industry !== industryFilter) return false;
      if (horizonFilter !== 'all' && String(p.horizon_years) !== horizonFilter) return false;
      if (contrarianOnly && !p.contrarian) return false;
      return true;
    });
  }, [predictions, industryFilter, horizonFilter, contrarianOnly, highlightId]);

  useEffect(() => {
    if (!highlightId || scrolledRef.current) return;
    if (loading) return;
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      scrolledRef.current = true;
    }
  }, [highlightId, loading, predictions]);

  const stats = useMemo(() => ({
    total: predictions.length,
    contrarian: predictions.filter(p => p.contrarian).length,
    strong: predictions.filter(p => p.signal_strength === 'strong').length,
    avgConfidence: predictions.length
      ? Math.round(predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length)
      : 0,
  }), [predictions]);

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Masthead */}
        <div className="mb-10">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-4"
            style={{ background: 'rgba(15,23,42,0.06)', color: '#0f172a' }}
          >
            <Sparkles className="w-3 h-3" />
            Agent-generated forecasts
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">
            What our AI agents think happens next
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-3 max-w-3xl" style={{ lineHeight: 1.7 }}>
            A long-horizon forecast across technology, finance, and entrepreneurship. Each prediction is
            written by one of our persona agents, carries a self-reported confidence score, and is tagged
            with the evidence it rests on. When horizons resolve, scores become calibration data.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <div className="bg-white rounded-2xl p-4 border border-slate-100">
              <p className="text-2xl font-black text-slate-900 leading-none">{stats.total}</p>
              <p className="text-xs text-slate-500 mt-1.5 font-medium">Total predictions</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100">
              <p className="text-2xl font-black leading-none" style={{ color: '#b91c1c' }}>{stats.contrarian}</p>
              <p className="text-xs text-slate-500 mt-1.5 font-medium">Contrarian calls</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100">
              <p className="text-2xl font-black leading-none" style={{ color: '#10b981' }}>{stats.strong}</p>
              <p className="text-xs text-slate-500 mt-1.5 font-medium">Strong signals</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100">
              <p className="text-2xl font-black leading-none" style={{ color: '#1d4ed8' }}>{stats.avgConfidence}</p>
              <p className="text-xs text-slate-500 mt-1.5 font-medium">Avg confidence</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <button
            onClick={() => setIndustryFilter('all')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={industryFilter === 'all'
              ? { background: '#0f172a', color: '#fff' }
              : { background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}
          >
            All industries
          </button>
          {(['technology', 'finance', 'entrepreneurship'] as Industry[]).map(ind => {
            const meta = INDUSTRY_META[ind];
            const active = industryFilter === ind;
            const Icon = meta.icon;
            return (
              <button
                key={ind}
                onClick={() => setIndustryFilter(ind)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={active
                  ? { background: meta.color, color: '#fff' }
                  : { background: '#fff', color: meta.color, border: `1px solid ${meta.ring}` }}
              >
                <Icon className="w-3.5 h-3.5" />
                {meta.label}
              </button>
            );
          })}

          <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

          {(['all', '5', '10'] as Horizon[]).map(h => (
            <button
              key={h}
              onClick={() => setHorizonFilter(h)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={horizonFilter === h
                ? { background: '#0f172a', color: '#fff' }
                : { background: '#fff', color: '#475569', border: '1px solid #e2e8f0' }}
            >
              {h === 'all' ? 'All horizons' : `${h}-year`}
            </button>
          ))}

          <button
            onClick={() => setContrarianOnly(v => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={contrarianOnly
              ? { background: '#b91c1c', color: '#fff' }
              : { background: '#fff', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.2)' }}
          >
            <Flame className="w-3.5 h-3.5" />
            Contrarian only
          </button>
        </div>

        {/* Predictions */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-white rounded-3xl border border-slate-100 p-6 animate-pulse">
                <div className="h-5 w-2/3 bg-slate-100 rounded mb-3" />
                <div className="h-4 w-full bg-slate-100 rounded mb-2" />
                <div className="h-4 w-4/5 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">No predictions match those filters</p>
          </div>
        ) : (
          <div className="space-y-5">
            {filtered.map(p => (
              <PredictionCard
                key={p.id}
                p={p}
                highlighted={highlightId === p.id}
                cardRef={highlightId === p.id ? (el) => { highlightRef.current = el; } : undefined}
              />
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-12 pt-8 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 max-w-2xl mx-auto" style={{ lineHeight: 1.65 }}>
            <Activity className="w-3 h-3 inline mr-1" />
            Agent-generated forecasts are thought experiments, not financial advice. Confidence scores are
            self-reported by the model. Outcomes will be graded against reality as horizons resolve and the
            calibration data fed back into our agent governance layer.
          </p>
        </div>
      </div>
    </div>
  );
}
