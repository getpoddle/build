import { useState, useEffect, useRef } from 'react';
import {
  Sparkles, ArrowRight, CheckCircle, Lock, Brain,
  Swords, Zap, X,
  Download, AlertTriangle, Target, BarChart3, TrendingUp,
  ChevronRight,
} from 'lucide-react';
import JoinPromptModal from '../components/JoinPromptModal';
import PoddleMark from '../components/PoddleMark';

interface GuestHomeProps {
  onNavigate: (page: string) => void;
}

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function RevealSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

const LENS_URL = 'https://chromewebstore.google.com/detail/poddle-lens/pdcllidghoikeoamjebjgdlgjaccfmmn';

export default function GuestHome({ onNavigate }: GuestHomeProps) {
  const [joinModal, setJoinModal] = useState<{ open: boolean; trigger: string }>({ open: false, trigger: 'default' });
  const openJoin = (trigger: string) => setJoinModal({ open: true, trigger });
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try { return localStorage.getItem('lens-banner-dismissed') === '1'; } catch { return false; }
  });

  const dismissBanner = () => {
    setBannerDismissed(true);
    try { localStorage.setItem('lens-banner-dismissed', '1'); } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen" style={{ background: '#fafafa' }}>
      {!bannerDismissed && (
        <div
          className="fixed top-14 left-0 right-0 z-40 flex items-center justify-center gap-3 px-4 py-2"
          style={{ background: 'rgba(15,23,42,0.96)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <a
            href={LENS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold transition-opacity hover:opacity-80 flex items-center gap-1.5"
            style={{ color: 'rgba(203,213,225,0.9)' }}
          >
            <span style={{ color: '#60a5fa', fontWeight: 700 }}>New:</span>
            {' '}Poddle Lens is now live on the Chrome Web Store
            <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: '#60a5fa' }} />
          </a>
          <button
            onClick={dismissBanner}
            aria-label="Dismiss"
            className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-md transition-opacity hover:opacity-70"
            style={{ color: 'rgba(100,116,139,0.7)' }}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {joinModal.open && (
        <JoinPromptModal
          onClose={() => setJoinModal({ open: false, trigger: 'default' })}
          onNavigate={onNavigate}
          trigger={joinModal.trigger as 'comment' | 'react' | 'thread' | 'save' | 'pod' | 'ai' | 'default'}
        />
      )}

      <HeroSection onNavigate={onNavigate} />
      <LiveDemoSection onNavigate={onNavigate} />
      <FinalCTA onNavigate={onNavigate} />

      <footer style={{ background: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.06)' }} className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <PoddleMark size={28} />
              <span className="text-white font-black text-lg tracking-tight">Poddle AI</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs" style={{ color: 'rgba(148,163,184,0.8)' }}>
              <button onClick={() => onNavigate('blog')} className="hover:text-white transition-colors">Blog</button>
              <button onClick={() => onNavigate('slack')} className="hover:text-white transition-colors">Slack</button>
              <a href={LENS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Poddle Lens</a>
              <a href="#privacy" className="hover:text-white transition-colors">Privacy</a>
              <a href="#terms" className="hover:text-white transition-colors">Terms</a>
              <a href="#subprocessors" className="hover:text-white transition-colors">Sub-processors</a>
              <a href="#contact-us" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
          <div className="mt-8 pt-8 text-center text-xs" style={{ color: 'rgba(100,116,139,0.7)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            &copy; 2026 Poddle, Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

const DEMO_MESSAGES = [
  {
    agent: 'RA', bg: '#7c2d12', color: '#fdba74', label: 'Risk Analyst',
    msg: "AI credit scoring models trained on US or UK data carry severe distribution shift risk in Southern and Eastern European markets. Default rate predictions could be off by 40–60% in the first 12 months. You need local training data before you lend at scale.",
  },
  {
    agent: 'FS', bg: '#0c4a6e', color: '#7dd3fc', label: 'Financial Strategist',
    msg: "The EU AI Act classifies AI-driven credit decisions as high-risk. Article 10 requires explainability per decision — not just model-level. Building a compliant audit trail adds 6–9 months to your launch timeline and ongoing cost per decision. Factor that into your unit economics.",
  },
  {
    agent: 'DA', bg: '#14532d', color: '#86efac', label: "Devil's Advocate",
    msg: 'Every incumbent cites compliance complexity as a moat. But Klarna and Monzo scaled across 6+ European jurisdictions in under 3 years. The regtech tooling is genuinely better now. The question is not whether compliance is hard — it is whether your team treats it as a blocker or a process.',
  },
  {
    agent: 'EL', bg: '#1e1b4b', color: '#a5b4fc', label: 'Execution Lead',
    msg: "Passport your product through Germany first — strictest regulator, highest trust signal. A BaFin approval with clean model documentation unlocks France, Netherlands, and the Nordics far faster than parallel filings. Sequence this, don't parallelize.",
  },
];

const DEMO_RISKS = [
  { label: 'Model Distribution Shift', sev: 'critical', desc: 'AI credit models trained on UK/US data may mispredict EU default rates by 40–60% in year one.' },
  { label: 'EU AI Act Compliance Gap', sev: 'high', desc: 'Article 10 requires per-decision explainability. Building audit trails adds 6–9 months to launch.' },
  { label: 'Parallel Regulatory Filing', sev: 'high', desc: 'Simultaneous multi-market filings increase rejection risk and slow time-to-revenue.' },
];

const DEMO_ACTIONS = [
  { who: 'Legal', task: 'Commission a BaFin pre-submission explainability review for the credit model — target Q2 submission window.', priority: 'critical' },
  { who: 'Engineering', task: 'Build a per-decision audit trail compliant with EU AI Act Article 10 before Germany launch.', priority: 'critical' },
  { who: 'CEO', task: 'Sequence market entry: Germany (Q3), France and Netherlands (Q1 next year). Halt parallel filings.', priority: 'high' },
  { who: 'Risk', task: 'Collect EU-local training data from German open banking sources to reduce model distribution shift by launch.', priority: 'high' },
];

const SEV_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'rgba(220,38,38,0.1)', text: '#b91c1c' },
  high:     { bg: 'rgba(245,158,11,0.1)', text: '#b45309' },
  medium:   { bg: 'rgba(37,99,235,0.1)',  text: '#1d4ed8' },
};

const PRI_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'rgba(220,38,38,0.08)', text: '#b91c1c' },
  high:     { bg: 'rgba(245,158,11,0.08)', text: '#b45309' },
  medium:   { bg: 'rgba(37,99,235,0.07)',  text: '#1d4ed8' },
};

function ScoreArc({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 22; const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="5" />
          <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black" style={{ color }}>{score}</span>
        </div>
      </div>
      <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: '#64748b', maxWidth: 56 }}>{label}</span>
    </div>
  );
}

function LiveDemoSection({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [revealed, setRevealed] = useState(0);
  const [showPDF, setShowPDF] = useState(false);
  const { ref, visible } = useScrollReveal();

  useEffect(() => {
    if (!visible) return;
    let i = 0;
    const tick = () => {
      i += 1;
      setRevealed(i);
      if (i < DEMO_MESSAGES.length) setTimeout(tick, 900);
    };
    setTimeout(tick, 300);
  }, [visible]);

  useEffect(() => {
    if (revealed >= DEMO_MESSAGES.length) {
      const t = setTimeout(() => setShowPDF(true), 1800);
      return () => clearTimeout(t);
    }
  }, [revealed]);

  return (
    <section ref={ref} style={{ background: '#fff', borderTop: '1px solid rgba(15,23,42,0.05)', borderBottom: '1px solid rgba(15,23,42,0.05)' }} className="py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: 'rgba(37,99,235,0.07)', color: '#1d4ed8', border: '1px solid rgba(37,99,235,0.12)' }}>
            Live example
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3">
            Watch the agents work.
          </h2>
          <p className="text-base text-slate-500 max-w-lg mx-auto leading-relaxed">
            A fintech team asks: <strong className="text-slate-700">"Should we launch our AI lending product across Europe now?"</strong> Four specialized agents respond — simultaneously, from entirely different angles.
          </p>
        </div>

        {/* Browser-style demo */}
        <div
          className="rounded-3xl overflow-hidden mx-auto"
          style={{ maxWidth: 780, background: 'linear-gradient(170deg,#0f172a,#1a2744)', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
            <div className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#10b981' }} />
            <div className="flex items-center gap-2 ml-4 flex-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.7)' }}>Private Workspace · European Expansion</span>
            </div>
            <Lock className="w-3 h-3" style={{ color: 'rgba(100,116,139,0.5)' }} />
          </div>

          {/* User prompt */}
          <div className="px-5 pt-5 pb-4">
            <div
              className="flex items-start gap-3 rounded-2xl p-4 mb-1"
              style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.2)' }}
            >
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', color: '#fff' }}
              >
                YO
              </div>
              <div>
                <p className="text-[11px] font-bold mb-1" style={{ color: '#93c5fd' }}>You</p>
                <p className="text-sm leading-relaxed text-white font-medium">We're ready to launch our AI-powered lending product. Should we go multi-market across Europe now, or stage the rollout?</p>
              </div>
            </div>

            {/* Agent tags */}
            <div className="flex items-center gap-2 mt-3 mb-4 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(100,116,139,0.6)' }}>Responding:</span>
              {DEMO_MESSAGES.map((m, i) => (
                <span
                  key={m.agent}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full transition-all duration-300"
                  style={i < revealed
                    ? { background: m.bg, color: m.color, opacity: 1 }
                    : { background: 'rgba(255,255,255,0.05)', color: 'rgba(100,116,139,0.4)' }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            {/* Agent responses */}
            <div className="space-y-3 pb-1">
              {DEMO_MESSAGES.map((m, i) => (
                <div
                  key={m.agent}
                  className="flex gap-3 transition-all duration-500"
                  style={{
                    opacity: i < revealed ? 1 : 0,
                    transform: i < revealed ? 'translateY(0)' : 'translateY(10px)',
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                    style={{ background: m.bg, color: m.color }}
                  >
                    {m.agent}
                  </div>
                  <div
                    className="flex-1 rounded-xl p-3.5"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <p className="text-[11px] font-bold mb-1.5" style={{ color: m.color }}>{m.label}</p>
                    <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(203,213,225,0.82)' }}>{m.msg}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Synthesis */}
            {revealed >= DEMO_MESSAGES.length && (
              <div
                className="mt-4 rounded-2xl p-4 transition-all duration-700"
                style={{
                  background: 'linear-gradient(135deg,rgba(37,99,235,0.18),rgba(6,182,212,0.12))',
                  border: '1px solid rgba(37,99,235,0.3)',
                  opacity: revealed >= DEMO_MESSAGES.length ? 1 : 0,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.3)' }}>
                    <Brain className="w-3 h-3" style={{ color: '#93c5fd' }} />
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: '#93c5fd' }}>War Room Synthesis</span>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(203,213,225,0.9)' }}>
                  <strong style={{ color: '#e2e8f0' }}>Verdict: Stage the rollout, starting Germany.</strong> The EU AI Act compliance burden is real but sequenceable. BaFin approval is the hardest and most valuable first stamp — it de-risks the rest of the continent. Launch Germany in Q3, use the model audit trail as a template, then fast-follow France and Netherlands by Q1 next year. Parallel multi-market filing will slow you down more than it speeds you up.
                </p>
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="px-5 py-3.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex-1 h-9 rounded-xl px-3.5 flex items-center gap-2"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="text-xs" style={{ color: 'rgba(100,116,139,0.5)' }}>Ask a follow-up or challenge an agent…</span>
              </div>
              {revealed >= DEMO_MESSAGES.length && (
                <button
                  onClick={() => setShowPDF(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <Download className="w-3 h-3" />
                  Export PDF
                </button>
              )}
              <button
                onClick={() => onNavigate('auth')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 4px 12px rgba(37,99,235,0.35)' }}
              >
                <Sparkles className="w-3 h-3" />
                Try it
              </button>
            </div>
          </div>
        </div>

        {/* ── PDF Export Preview ── */}
        <div
          className="mx-auto mt-6 overflow-hidden transition-all duration-700"
          style={{
            maxWidth: 780,
            maxHeight: showPDF ? '2000px' : 0,
            opacity: showPDF ? 1 : 0,
          }}
        >
          {/* Arrow connector */}
          <div className="flex flex-col items-center mb-4">
            <div className="w-0.5 h-6" style={{ background: 'rgba(15,23,42,0.12)' }} />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold" style={{ background: 'rgba(15,23,42,0.06)', color: '#64748b' }}>
              <Download className="w-3 h-3" />
              Exported report preview
            </div>
            <div className="w-0.5 h-4" style={{ background: 'rgba(15,23,42,0.12)' }} />
            <div className="w-2 h-2 rotate-45" style={{ background: 'rgba(15,23,42,0.12)', marginTop: -4 }} />
          </div>

          <div className="rounded-3xl overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.1)', boxShadow: '0 8px 32px rgba(15,23,42,0.1)' }}>
            {/* PDF Header */}
            <div className="px-8 pt-8 pb-6" style={{ borderBottom: '1px solid rgba(15,23,42,0.07)', background: 'linear-gradient(135deg,#0f172a,#1e3a5f)' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
                      <Brain className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.7)' }}>Poddle · War Room Report</span>
                  </div>
                  <h3 className="text-lg font-black text-white mb-1">European AI Lending Expansion</h3>
                  <p className="text-xs" style={{ color: 'rgba(148,163,184,0.65)' }}>
                    Private Workspace · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · 12 messages analysed
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-3xl font-black text-white">68</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#f59e0b' }}>Developing</div>
                  <div className="text-[10px]" style={{ color: 'rgba(148,163,184,0.5)' }}>Decision Health</div>
                </div>
              </div>

              {/* Score pills */}
              <div className="flex gap-4 mt-5">
                <ScoreArc score={74} label="Strategic Alignment" color="#16a34a" />
                <ScoreArc score={61} label="Operational Readiness" color="#f59e0b" />
              </div>
            </div>

            {/* Recommendation */}
            <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(30,58,95,0.03)' }}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4" style={{ color: '#1e3a5f' }} />
                <span className="text-xs font-black uppercase tracking-wider" style={{ color: '#1e3a5f' }}>Strategic Recommendation</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-700">
                <strong className="text-slate-900">Stage the rollout. Start with Germany.</strong> BaFin approval is the hardest and most valuable first stamp — it de-risks France, Netherlands, and the Nordics. Target Germany in Q3 with a compliant audit trail in place. Parallel multi-market filing will cost more time than it saves. The EU AI Act compliance burden is real but sequenceable — treat it as process, not blocker.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x" style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', borderColor: 'rgba(15,23,42,0.06)' }}>
              {/* Risk Signals */}
              <div className="px-8 py-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">Risk Signals</span>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c' }}>3 identified</span>
                </div>
                <div className="space-y-3">
                  {DEMO_RISKS.map((r) => (
                    <div key={r.label} className="flex gap-2.5">
                      <span className="mt-0.5 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0" style={SEV_COLORS[r.sev]}>{r.sev}</span>
                      <div>
                        <p className="text-[11px] font-bold text-slate-800 leading-tight">{r.label}</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{r.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Steps */}
              <div className="px-8 py-6">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">Action Items</span>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(37,99,235,0.08)', color: '#1d4ed8' }}>4 items</span>
                </div>
                <div className="space-y-3">
                  {DEMO_ACTIONS.map((a) => (
                    <div key={a.task.slice(0, 20)} className="flex gap-2.5">
                      <div className="flex-shrink-0 mt-0.5">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide" style={PRI_COLORS[a.priority]}>{a.priority}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wide" style={{ color: '#94a3b8' }}>{a.who}</span>
                        <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">{a.task}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 flex items-center justify-between" style={{ background: '#fafafa' }}>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5" style={{ color: '#94a3b8' }} />
                <span className="text-[10px] font-semibold" style={{ color: '#94a3b8' }}>3 conflict zones · 6 open questions · 5 blind spots flagged</span>
              </div>
              <button
                onClick={() => onNavigate('auth')}
                className="flex items-center gap-1.5 text-[10px] font-bold transition-colors hover:text-blue-700"
                style={{ color: '#2563eb' }}
              >
                Get your own report
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Three proof points beneath the demo */}
        <div className="grid sm:grid-cols-3 gap-5 mt-12">
          {[
            { icon: Brain, color: '#2563eb', bg: '#eff6ff', title: '7 specialized agents', desc: "Risk Analyst, Devil's Advocate, Market Analyst, Execution Lead, Financial Strategist, Innovation Scout, People Advisor. Each tuned for a different lens." },
            { icon: Lock, color: '#0891b2', bg: '#ecfeff', title: 'Private by default', desc: 'Your workspace is encrypted and invisible to the public. Invite your team. Nothing leaves your org.' },
            { icon: Swords, color: '#dc2626', bg: '#fef2f2', title: 'War Room synthesis', desc: "When agents disagree, AI synthesizes dissenting views into a clear recommendation with explicit reasoning and next steps." },
          ].map(({ icon: Icon, color, bg, title, desc }, i) => (
            <RevealSection key={title} delay={i * 80}>
              <div
                className="h-full p-6 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.07)', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: bg }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeroSection({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(170deg, #0f172a 0%, #1e2d4a 55%, #1e3a5f 100%)',
        minHeight: '82vh',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Background mesh */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle at center, rgba(37,99,235,0.18) 0%, transparent 65%)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle at center, rgba(6,182,212,0.12) 0%, transparent 65%)', transform: 'translate(-30%, 30%)' }} />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full relative z-10 text-center">
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-7"
          style={{ background: 'rgba(37,99,235,0.15)', color: '#93c5fd', border: '1px solid rgba(37,99,235,0.25)' }}
        >
          <Zap className="w-3.5 h-3.5" />
          Decision Intelligence Platform
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-[3.6rem] font-black leading-[1.07] mb-6 text-white mx-auto max-w-3xl">
          Judgment infrastructure for{' '}
          <span style={{ background: 'linear-gradient(135deg,#60a5fa,#22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            high-stakes decisions.
          </span>
        </h1>

        <p className="text-base leading-relaxed mb-10 max-w-xl mx-auto" style={{ color: 'rgba(203,213,225,0.82)' }}>
          Turn every critical decision into a structured, multi-perspective challenge before you commit.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <button
            onClick={() => onNavigate('auth')}
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-white font-bold text-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 8px 28px rgba(37,99,235,0.4)' }}
          >
            <Sparkles className="w-4 h-4" />
            Start for free
          </button>
          <button
            onClick={() => onNavigate('blog')}
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-white"
            style={{ color: 'rgba(148,163,184,0.75)' }}
          >
            Read the blog
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.8)' }}>Free. No card required.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.8)' }}>Private & encrypted workspaces</span>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="flex justify-center mt-16">
          <a href="#demo" className="flex flex-col items-center gap-2 group" style={{ color: 'rgba(100,116,139,0.6)' }}>
            <span className="text-xs font-medium group-hover:text-slate-400 transition-colors">See it in action</span>
            <div className="w-5 h-5 flex items-center justify-center animate-bounce">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 9l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}

function FinalCTA({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <section style={{ background: 'linear-gradient(170deg,#0f172a 0%,#1e3a5f 100%)' }} className="py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <RevealSection>
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Make better decisions.<br />Starting today.
          </h2>
          <p className="text-base leading-relaxed mb-10 max-w-lg mx-auto" style={{ color: 'rgba(203,213,225,0.8)' }}>
            Private workspaces, War Room access, and full team collaboration — built for high-stakes decisions.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
            <button
              onClick={() => onNavigate('auth')}
              className="flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl font-bold text-sm transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: '#fff', color: '#1e2d4a', boxShadow: '0 12px 32px rgba(0,0,0,0.25)' }}
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              Create free account
            </button>
          </div>

          <div className="flex items-center justify-center gap-6 flex-wrap text-xs" style={{ color: 'rgba(100,116,139,0.8)' }}>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
              Free forever plan
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
              No credit card required
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
              Invite your team
            </div>
          </div>

          <div className="flex items-center justify-center gap-5 mt-12 flex-wrap">
            <a
              href="https://betalist.com/startups/poddle?utm_campaign=badge-poddle&utm_medium=badge&utm_source=badge-featured"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block transition-transform hover:-translate-y-0.5"
            >
              <img alt="Poddle on BetaList" width={156} height={54} style={{ width: '156px', height: '54px' }} src="https://betalist.com/badges/featured?id=152531&theme=color" />
            </a>
            <a
              href="https://www.producthunt.com/products/poddle-2?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-poddle-2"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block transition-transform hover:-translate-y-0.5"
            >
              <img alt="Poddle - Seven agents. Zero yes-men | Product Hunt" width={250} height={54} style={{ width: '250px', height: '54px' }} src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1169789&theme=light&t=1783592423529" />
            </a>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}
