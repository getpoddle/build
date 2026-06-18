import { useState, useEffect, useRef } from 'react';
import {
  Sparkles, ArrowRight, CheckCircle, Lock, Brain,
  Crown, Swords, X, CreditCard, Zap,
} from 'lucide-react';
import JoinPromptModal from '../components/JoinPromptModal';

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

export default function GuestHome({ onNavigate }: GuestHomeProps) {
  const [joinModal, setJoinModal] = useState<{ open: boolean; trigger: string }>({ open: false, trigger: 'default' });
  const openJoin = (trigger: string) => setJoinModal({ open: true, trigger });

  return (
    <div className="min-h-screen" style={{ background: '#fafafa' }}>
      {joinModal.open && (
        <JoinPromptModal
          onClose={() => setJoinModal({ open: false, trigger: 'default' })}
          onNavigate={onNavigate}
          trigger={joinModal.trigger as 'comment' | 'react' | 'thread' | 'save' | 'pod' | 'ai' | 'default'}
        />
      )}

      <HeroSection onNavigate={onNavigate} />
      <LiveDemoSection onNavigate={onNavigate} />
      <PricingSection onNavigate={onNavigate} />
      <FinalCTA onNavigate={onNavigate} />

      <footer style={{ background: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.06)' }} className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)' }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-black text-lg">Poddle</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs" style={{ color: 'rgba(148,163,184,0.8)' }}>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#privacy" className="hover:text-white transition-colors">Privacy</a>
              <a href="#terms" className="hover:text-white transition-colors">Terms</a>
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

function LiveDemoSection({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [revealed, setRevealed] = useState(0);
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
          Seven AI agents that<br />
          challenge your best{' '}
          <span style={{ background: 'linear-gradient(135deg,#60a5fa,#22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            thinking.
          </span>
        </h1>

        <p className="text-base leading-relaxed mb-10 max-w-xl mx-auto" style={{ color: 'rgba(203,213,225,0.82)' }}>
          Poddle is a decision intelligence layer for your team. Structured AI reasoning catches the biases, blind spots, and missing second-order effects before they become expensive mistakes.
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
            onClick={() => onNavigate('pricing')}
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            View pricing
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.8)' }}>Free. No card required.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.8)' }}>Private workspaces from $19/mo</span>
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

function PricingSection({ onNavigate }: { onNavigate: (p: string) => void }) {
  const tiers = [
    {
      name: 'Free',
      price: '$0',
      per: '/ month',
      desc: 'For individuals exploring AI-assisted thinking',
      cta: 'Get started free',
      ctaAction: () => onNavigate('auth'),
      highlight: false,
      badge: null,
      features: ['AI agent ask & public discussions', 'Post insights, get AI challenges', 'Ask agents questions'],
      missing: ['No private workspaces', 'No War Room', 'No team collaboration'],
    },
    {
      name: 'Pro Individual',
      price: '$19',
      per: '/ month',
      desc: 'For founders and decision-makers',
      cta: 'Subscribe',
      ctaAction: () => onNavigate('pricing'),
      highlight: true,
      badge: 'Most popular',
      features: ['Everything in Free', 'Private encrypted workspace', 'War Room access', 'AI agents debate your ideas', 'Up to 5 workspace members', 'AI synthesis & recommendations', 'Export decisions & reports'],
      missing: [],
    },
    {
      name: 'Poddle Team',
      price: '$79',
      per: '/ month',
      desc: 'For startups, agencies & product teams',
      cta: 'Subscribe',
      ctaAction: () => onNavigate('pricing'),
      highlight: false,
      badge: 'Teams',
      features: ['Everything in Pro Individual', 'Up to 10 workspace members', 'Collaborative War Room sessions', 'Team-wide AI synthesis', 'Priority support'],
      missing: [],
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      per: '',
      desc: 'For large teams & organizations',
      cta: 'Contact sales',
      ctaAction: () => onNavigate('contact-us'),
      highlight: false,
      badge: null,
      features: ['Everything in Poddle Team', 'Unlimited workspace members', 'Custom AI agent personas', 'Dedicated account manager', 'SLA guarantee'],
      missing: [],
    },
  ];

  return (
    <section id="pricing-preview" style={{ background: '#fafafa', borderBottom: '1px solid rgba(15,23,42,0.05)' }} className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealSection className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: 'rgba(37,99,235,0.07)', color: '#1d4ed8', border: '1px solid rgba(37,99,235,0.12)' }}>
            <CreditCard className="w-3.5 h-3.5" />
            Simple, transparent pricing
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3">Start free. Scale when you're ready.</h2>
          <p className="text-base text-slate-500 max-w-md mx-auto leading-relaxed">
            The free tier is genuinely useful. Upgrade for private workspaces, War Room, and team collaboration.
          </p>
        </RevealSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((tier, i) => (
            <RevealSection key={tier.name} delay={i * 60}>
              <div
                className="h-full rounded-2xl p-6 flex flex-col relative overflow-hidden"
                style={
                  tier.highlight
                    ? { background: 'linear-gradient(160deg,#1e3a5f,#0f2040)', boxShadow: '0 12px 40px rgba(37,99,235,0.3)' }
                    : { background: '#fff', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }
                }
              >
                {tier.badge && (
                  <div
                    className="absolute top-4 right-4 text-[10px] font-black px-2.5 py-1 rounded-full"
                    style={tier.highlight ? { background: 'rgba(255,255,255,0.15)', color: '#fff' } : { background: 'rgba(37,99,235,0.1)', color: '#1d4ed8' }}
                  >
                    {tier.badge}
                  </div>
                )}

                <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${tier.highlight ? 'text-blue-300' : 'text-slate-400'}`}>
                  {tier.name}
                </p>
                <div className="flex items-end gap-1 mb-1.5">
                  <span className={`text-3xl font-black ${tier.highlight ? 'text-white' : 'text-slate-900'}`}>{tier.price}</span>
                  {tier.per && <span className={`text-xs mb-1.5 ${tier.highlight ? 'text-blue-300' : 'text-slate-400'}`}>{tier.per}</span>}
                </div>
                <p className={`text-xs mb-5 ${tier.highlight ? 'text-slate-400' : 'text-slate-500'}`}>{tier.desc}</p>

                <ul className="space-y-2 flex-1 mb-4">
                  {tier.features.map(f => (
                    <li key={f} className={`flex items-start gap-2 text-xs ${tier.highlight ? 'text-slate-200' : 'text-slate-700'}`}>
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: tier.highlight ? '#34d399' : '#16a34a' }} />
                      {f}
                    </li>
                  ))}
                  {tier.missing.map(m => (
                    <li key={m} className="flex items-start gap-2 text-xs text-slate-400">
                      <X className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-300" />
                      {m}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={tier.ctaAction}
                  className="w-full py-2.5 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 mt-auto"
                  style={
                    tier.highlight
                      ? { background: 'rgba(255,255,255,1)', color: '#1e2d4a', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }
                      : tier.name === 'Free'
                      ? { border: '1px solid rgba(15,23,42,0.12)', color: '#334155', background: '#fff' }
                      : { background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', color: '#fff', boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }
                  }
                >
                  {tier.cta}
                </button>
              </div>
            </RevealSection>
          ))}
        </div>

        <RevealSection className="text-center mt-6" delay={300}>
          <p className="text-xs text-slate-400">
            No credit card required for free plan. Cancel paid plans anytime.{' '}
            <button onClick={() => onNavigate('pricing')} className="text-blue-500 hover:text-blue-600 underline underline-offset-2 transition-colors ml-1">
              View full feature comparison
            </button>
          </p>
        </RevealSection>
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
            Start free. Upgrade for private workspaces, War Room access, and full team collaboration — from $19/mo.
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
            <button
              onClick={() => onNavigate('pricing')}
              className="flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl font-semibold text-sm transition-all duration-200 hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.18)', color: '#fff' }}
            >
              <Crown className="w-4 h-4" />
              View Pro plans
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
              Cancel paid plans anytime
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
              <img alt="Poddle on Product Hunt" width={250} height={54} style={{ width: '250px', height: '54px' }} src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1169789&theme=light&t=1781341577123" />
            </a>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}
