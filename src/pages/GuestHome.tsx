import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, CheckCircle, Lock, Brain,
  Swords, Zap, X,
  Download, AlertTriangle, Target, BarChart3, TrendingUp,
  ChevronRight, Users, MessageSquare, FileText, Shield,
  ArrowDown, ChevronDown, Send,
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
      { threshold: 0.08 }
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
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
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
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      {!bannerDismissed && (
        <div
          className="fixed top-14 left-0 right-0 z-40 flex items-center justify-center gap-3 px-4 py-2"
          style={{ background: 'rgba(0,0,0,0.97)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
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
      <AsSeenOnSection />
      <HowItWorksSection onNavigate={onNavigate} />
      <LiveDemoSection onNavigate={onNavigate} />
      <SocialProofSection />
      <FinalCTA onNavigate={onNavigate} />

      <footer style={{ background: '#000000', borderTop: '1px solid rgba(255,255,255,0.06)' }} className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <PoddleMark size={28} />
              <span className="font-black text-lg tracking-tight">
                <span style={{ color: '#60a5fa', fontWeight: 700 }}>Poddle</span><span style={{ color: '#d4a535', fontWeight: 400, marginLeft: '0.15em' }}>AI</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs" style={{ color: 'rgba(148,163,184,0.8)' }}>
              <button onClick={() => onNavigate('team')} className="hover:text-white transition-colors">Team</button>
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

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #000000 0%, #0a0a0a 55%, #111111 100%)',
        minHeight: '88vh',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Background mesh */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full" style={{ background: 'radial-gradient(circle at center, rgba(184,134,11,0.12) 0%, transparent 65%)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle at center, rgba(184,134,11,0.06) 0%, transparent 65%)', transform: 'translate(-30%, 30%)' }} />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '52px 52px' }} />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full relative z-10 text-center">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold mb-8"
          style={{ background: 'rgba(184,134,11,0.15)', color: '#d4a535', border: '1px solid rgba(184,134,11,0.22)' }}
        >
          <Zap className="w-3.5 h-3.5" />
          The Decision Review Copilot
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-bold leading-[1.06] mb-5 text-white mx-auto max-w-3xl tracking-tight">
          Stress-test your business decisions before{' '}
          <span style={{ background: 'linear-gradient(135deg,#b8860b,#d4a535)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            they become expensive mistakes
          </span>
        </h1>

        <p className="text-base sm:text-lg leading-relaxed mb-10 max-w-2xl mx-auto" style={{ color: 'rgba(203,213,225,0.78)' }}>
          Seven specialized AI agents challenge your assumptions, surface blind spots, and pressure-test your decisions. Poddle's War Room turns the debate into a clear, defensible recommendation.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          <button
            onClick={() => onNavigate('auth')}
            className="px-8 py-3.5 rounded-2xl text-white font-bold text-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#b8860b,#d4a535)', boxShadow: '0 4px 14px rgba(184,134,11,0.4)' }}
          >
            Get started
          </button>
          <button
            onClick={() => onNavigate('pricing')}
            className="flex items-center gap-2 text-sm font-semibold transition-colors hover:text-white"
            style={{ color: 'rgba(148,163,184,0.75)' }}
          >
            View pricing
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-6 flex-wrap mb-14">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.75)' }}>Free. No card required.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.75)' }}>Private & encrypted workspaces</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.75)' }}>Built for teams</span>
          </div>
        </div>

        {/* Agent avatars */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-1">
            {[
              { abbr: 'RA', label: 'Risk Analyst' },
              { abbr: 'DA', label: "Devil's Advocate" },
              { abbr: 'FS', label: 'Financial Strategist' },
              { abbr: 'MA', label: 'Market Analyst' },
              { abbr: 'EL', label: 'Execution Lead' },
              { abbr: 'IS', label: 'Innovation Lead' },
              { abbr: 'PA', label: 'People Advisor' },
            ].map((a, i) => (
              <img
                key={a.abbr}
                src={AGENT_AVATARS[a.abbr]}
                alt={a.label}
                title={a.label}
                className="w-9 h-9 rounded-xl object-cover transition-transform hover:-translate-y-1 cursor-default"
                style={{ zIndex: 7 - i, marginLeft: i > 0 ? -8 : 0, boxShadow: '0 0 0 2px rgba(255,255,255,0.85)' }}
              />
            ))}
          </div>
          <p className="text-xs font-medium" style={{ color: 'rgba(100,116,139,0.7)' }}>7 specialized agents · each with a different mandate</p>
        </div>

        {/* Scroll hint */}
        <div className="flex justify-center mt-14">
          <a href="#how-it-works" className="flex flex-col items-center gap-2 group" style={{ color: 'rgba(100,116,139,0.55)' }}>
            <span className="text-xs font-medium group-hover:text-slate-400 transition-colors">See how it works</span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── As Seen On ────────────────────────────────────────────────────────────────

function AsSeenOnSection() {
  const logos = (
    <>
      {/* PR Newswire */}
      <a href="https://www.prnewswire.com/news-releases/poddle-ai-launches-worlds-first-self-service-adversarial-ai-platform-302837161.html" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 transition-opacity hover:opacity-100 flex-shrink-0" style={{ opacity: 0.85 }}>
        <svg viewBox="0 0 120 40" className="h-14 sm:h-16 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="20" r="13" fill="#c8102e" />
          <text x="16" y="25" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800" fontFamily="Arial, sans-serif">PR</text>
          <text x="34" y="18" fill="#1e293b" fontSize="11" fontWeight="700" fontFamily="Arial, sans-serif">PR Newswire</text>
          <text x="34" y="30" fill="#64748b" fontSize="7" fontWeight="600" fontFamily="Arial, sans-serif" letterSpacing="1.5">PRESS RELEASE DISTRIBUTION</text>
        </svg>
      </a>
      {/* Yahoo! Finance */}
      <a href="https://finance.yahoo.com/technology/ai/articles/poddle-ai-launches-worlds-first-123700881.html" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 transition-opacity hover:opacity-100 flex-shrink-0" style={{ opacity: 0.85 }}>
        <svg viewBox="0 0 140 40" className="h-14 sm:h-16 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
          <text x="0" y="20" fill="#6001d2" fontSize="16" fontWeight="800" fontFamily="Arial, sans-serif" fontStyle="italic">Yahoo!</text>
          <text x="62" y="20" fill="#1e293b" fontSize="14" fontWeight="700" fontFamily="Arial, sans-serif">Finance</text>
          <rect x="0" y="26" width="120" height="2" fill="#6001d2" rx="1" />
        </svg>
      </a>
      {/* Benzinga */}
      <a href="https://www.benzinga.com/pressreleases/26/07/n60758133/poddle-ai-launches-world-s-first-self-service-adversarial-ai-platform" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 transition-opacity hover:opacity-100 flex-shrink-0" style={{ opacity: 0.85 }}>
        <svg viewBox="0 0 150 40" className="h-14 sm:h-16 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
          <text x="0" y="28" fill="#1e293b" fontSize="22" fontWeight="800" fontFamily="Arial, sans-serif">Benzinga</text>
        </svg>
      </a>
      {/* AI Journal */}
      <a href="https://aijourn.com/poddle-ai-launches-worlds-first-self-service-adversarial-ai-platform/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 transition-opacity hover:opacity-100 flex-shrink-0" style={{ opacity: 0.85 }}>
        <svg viewBox="0 0 150 40" className="h-14 sm:h-16 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
          <text x="0" y="18" fill="#2563eb" fontSize="16" fontWeight="800" fontFamily="Arial, sans-serif">AI</text>
          <text x="30" y="18" fill="#1e293b" fontSize="16" fontWeight="700" fontFamily="Arial, sans-serif">Journal</text>
          <rect x="0" y="24" width="92" height="2" fill="#2563eb" rx="1" />
        </svg>
      </a>
      {/* California Business Journal */}
      <a href="https://calbizjournal.com/latest-tech-news/?rkey=20260729PH13856&filter=26804" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 transition-opacity hover:opacity-100 flex-shrink-0" style={{ opacity: 0.85 }}>
        <svg viewBox="0 0 200 40" className="h-14 sm:h-16 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
          <text x="0" y="18" fill="#0f766e" fontSize="13" fontWeight="800" fontFamily="Arial, sans-serif">California</text>
          <text x="0" y="32" fill="#1e293b" fontSize="13" fontWeight="700" fontFamily="Arial, sans-serif">Business Journal</text>
        </svg>
      </a>
    </>
  );

  return (
    <section style={{ background: '#f8fafc', borderTop: '1px solid rgba(0,0,0,0.06)' }} className="py-14">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-bold uppercase tracking-widest mb-8" style={{ color: 'rgba(100,116,139,0.7)' }}>
          As seen on
        </p>
        <div className="relative overflow-hidden" style={{ maskImage: 'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)' }}>
          <div className="flex items-center gap-16 sm:gap-24 w-max" style={{ animation: 'marqueeScroll 28s linear infinite' }}>
            {logos}
            {logos}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

const AGENT_AVATARS: Record<string, string> = {
  RA: 'https://images.pexels.com/photos/8312669/pexels-photo-8312669.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=200&h=200',
  DA: 'https://images.pexels.com/photos/5308640/pexels-photo-5308640.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=200&h=200',
  FS: 'https://images.pexels.com/photos/25651531/pexels-photo-25651531.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=200&h=200',
  MA: 'https://images.pexels.com/photos/26150470/pexels-photo-26150470.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=200&h=200',
  EL: 'https://images.pexels.com/photos/35490803/pexels-photo-35490803.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=200&h=200',
  IS: 'https://images.pexels.com/photos/7752788/pexels-photo-7752788.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=200&h=200',
  PA: 'https://images.pexels.com/photos/33148747/pexels-photo-33148747.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=200&h=200',
};

const TEAM_AVATARS: Record<string, string> = {
  SK: 'https://images.pexels.com/photos/7860654/pexels-photo-7860654.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=200&h=200',
  JT: 'https://images.pexels.com/photos/28442318/pexels-photo-28442318.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=200&h=200',
  ML: 'https://images.pexels.com/photos/38453638/pexels-photo-38453638.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=200&h=200',
};

const HOW_STEPS = [
  {
    number: '01',
    icon: Users,
    color: '#0891b2',
    bg: 'rgba(8,145,178,0.07)',
    border: 'rgba(8,145,178,0.15)',
    label: 'Team Chat',
    title: 'Your team debates the decision together',
    body: "Invite your team into a private, encrypted workspace where everyone can post their perspective, share context, and challenge each other's thinking. Upload supporting documents (PDF, DOCX, Excel) to ground the discussion in real data. The team chat is where the human debate happens before any AI ever speaks.",
    callout: "Team Chat is the human layer: your team's own debate, in your own words, inside a secure workspace.",
    visual: [
      { abbr: 'SK', avatar: TEAM_AVATARS.SK, color: '#0c4a6e', name: 'Sarah (CFO)', text: 'Our burn rate gives us 8 months. We cannot afford a slow rollout, we need revenue fast.' },
      { abbr: 'JT', avatar: TEAM_AVATARS.JT, color: '#14532d', name: 'James (COO)', text: 'But rushing into 6 markets simultaneously is how we lost the APAC launch. Sequencing matters.' },
      { abbr: 'ML', avatar: TEAM_AVATARS.ML, color: '#7c2d12', name: 'Maya (Head of Risk)', text: 'Agreed. Let us get the AI agents in here to stress-test both options before we decide.' },
    ],
  },
  {
    number: '02',
    icon: MessageSquare,
    color: '#b8860b',
    bg: 'rgba(184,134,11,0.08)',
    border: 'rgba(184,134,11,0.18)',
    label: 'Multiplayer AI',
    title: 'Bring AI agents into the debate in real time',
    body: "Seven specialized agents (Risk Analyst, Devil's Advocate, Financial Strategist, Market Analyst, Execution Lead, Innovation Lead, and People Advisor) join the conversation alongside your team. Each agent responds from a completely different angle, challenging both your team's assumptions and each other. Your team can reply, push back, and steer the debate. This is multiplayer AI: humans and agents debating together in one shared thread.",
    callout: 'Multiplayer AI is where humans and agents debate together: not agents talking at you, but a real-time, multi-perspective conversation.',
    visual: [
      { abbr: 'RA', avatar: AGENT_AVATARS.RA, bg: 'rgba(124,45,18,0.07)', color: '#7c2d12', text: 'Distribution shift risk in EU markets could cause 40-60% prediction errors in year one.' },
      { abbr: 'FS', avatar: AGENT_AVATARS.FS, bg: 'rgba(12,74,110,0.07)', color: '#0c4a6e', text: 'EU AI Act requires per-decision explainability. Adds 6-9 months to your launch timeline.' },
      { abbr: 'DA', avatar: AGENT_AVATARS.DA, bg: 'rgba(20,83,45,0.07)', color: '#14532d', text: 'Klarna scaled across 6+ EU markets in under 3 years. Compliance is process, not blocker.' },
    ],
  },
  {
    number: '03',
    icon: Swords,
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.07)',
    border: 'rgba(220,38,38,0.15)',
    label: 'War Room',
    title: 'The intelligence layer that synthesizes everything',
    body: 'Once the debate is underway, the War Room reads every message from your team and from the agents, and synthesizes it all. It identifies consensus points, conflict zones, blind spots, and cognitive biases across the entire Multiplayer AI. It produces a single strategic recommendation with a Decision Health Score, risk signals, and prioritized action items, all grounded in the actual conversation from your workspace.',
    callout: 'The War Room is not a separate conversation. It is the intelligence layer built on top of your Multiplayer AI.',
    visual: [
      { label: 'Decision Health Score', value: '68', sub: 'Developing', color: '#f59e0b' },
      { label: 'Risk Signals', value: '3', sub: '2 critical', color: '#dc2626' },
      { label: 'Action Items', value: '4', sub: 'Prioritized', color: '#b8860b' },
    ],
  },
]

function HowItWorksSection({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <section id="how-it-works" style={{ background: '#fff', borderTop: '1px solid rgba(0,0,0,0.06)' }} className="py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <RevealSection className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold mb-4" style={{ background: 'rgba(0,0,0,0.05)', color: '#475569', border: '1px solid rgba(0,0,0,0.09)' }}>
            How Poddle works
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
            Team Chat starts the debate.<br className="hidden sm:block" /> Multiplayer AI widens it. The War Room resolves it.
          </h2>
          <p className="text-base text-slate-500 max-w-xl mx-auto leading-relaxed">
            Three connected features, not separate tools. Here is exactly how they work together.
          </p>
        </RevealSection>

        {/* Steps */}
        <div className="space-y-6">
          {HOW_STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <RevealSection key={step.number} delay={idx * 100}>
                <div
                  className="rounded-3xl overflow-hidden"
                  style={{ border: `1px solid ${step.border}`, background: '#fff', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}
                >
                  <div className="p-8 sm:p-10">
                    <div className="flex flex-col lg:flex-row gap-10">
                      {/* Left */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: step.bg }}>
                            <Icon className="w-4.5 h-4.5" style={{ color: step.color }} />
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: step.color }}>{step.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold" style={{ color: 'rgba(100,116,139,0.5)' }}>STEP {step.number}</span>
                            </div>
                          </div>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 leading-tight tracking-tight">{step.title}</h3>
                        <p className="text-sm sm:text-base text-slate-500 leading-relaxed mb-5">{step.body}</p>
                        <div
                          className="flex items-start gap-2.5 rounded-xl px-4 py-3"
                          style={{ background: step.bg, border: `1px solid ${step.border}` }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: step.color }} />
                          <p className="text-xs font-semibold leading-relaxed" style={{ color: step.color }}>{step.callout}</p>
                        </div>
                      </div>

                      {/* Right, visual */}
                      <div className="lg:w-80 flex-shrink-0">
                        {idx === 0 && step.visual && (
                          <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: '#FFFFFF', border: '1px solid #D8DDE8', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid #D8DDE8', background: '#F7F9FC' }}>
                              <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#b8860b' }} />
                              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#5D6B82' }}>Team Chat</span>
                              <span className="text-[10px]" style={{ color: '#9BA6B8' }}>— European Expansion</span>
                              <div className="ml-auto flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#1e7a52' }} />
                                <span className="text-[10px]" style={{ color: '#5D6B82' }}>Live</span>
                              </div>
                            </div>
                            <div className="flex-1 p-4 space-y-3" style={{ background: '#FFFFFF' }}>
                              {(step.visual as { abbr: string; avatar: string; color: string; name: string; text: string }[]).map((v) => (
                                <div key={v.abbr} className="flex gap-2.5">
                                  <img src={v.avatar} alt={v.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" />
                                  <div className="flex flex-col max-w-[80%]">
                                    <div className="flex items-baseline gap-2 mb-0.5">
                                      <span className="text-[10px] font-semibold" style={{ color: v.color }}>{v.name}</span>
                                      <span className="text-[9px]" style={{ color: '#9BA6B8' }}>10:24 AM</span>
                                    </div>
                                    <div className="px-3 py-2 rounded-2xl text-[11px] leading-relaxed break-words" style={{ background: '#F7F9FC', color: '#111827', border: '1px solid #D8DDE8', borderBottomLeftRadius: '4px' }}>
                                      {v.text}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid #D8DDE8', background: '#F7F9FC' }}>
                              <div className="flex items-end gap-2">
                                <div className="flex-1 rounded-xl px-3 py-2 text-[10px]" style={{ background: '#FFFFFF', border: '1px solid #D8DDE8', color: '#9BA6B8', minHeight: '36px', display: 'flex', alignItems: 'center' }}>
                                  Message your team... (use @ to mention)
                                </div>
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#b8860b', color: '#F0F3F7' }}>
                                  <MessageSquare className="w-4 h-4" />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {idx === 1 && step.visual && (
                          <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: '#FFFFFF', border: '1px solid #D8DDE8', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid #D8DDE8', background: '#F7F9FC' }}>
                              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#b8860b' }} />
                              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#5D6B82' }}>Multiplayer AI</span>
                              <span className="text-[10px]" style={{ color: '#9BA6B8' }}>— Agents + Team</span>
                              <div className="ml-auto flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#1e7a52' }} />
                                <span className="text-[10px]" style={{ color: '#5D6B82' }}>Live</span>
                              </div>
                            </div>
                            <div className="flex-1 p-4 space-y-3" style={{ background: '#FFFFFF' }}>
                              {/* Team member message */}
                              <div className="flex gap-2.5">
                                <img src={TEAM_AVATARS.ML} alt="Maya (Head of Risk)" className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" />
                                <div className="flex flex-col max-w-[80%]">
                                  <div className="flex items-baseline gap-2 mb-0.5">
                                    <span className="text-[10px] font-semibold" style={{ color: '#0f766e' }}>Maya (Head of Risk)</span>
                                    <span className="text-[9px]" style={{ color: '#9BA6B8' }}>10:25 AM</span>
                                  </div>
                                  <div className="px-3 py-2 rounded-2xl text-[11px] leading-relaxed" style={{ background: 'rgba(8,145,178,0.12)', color: '#111827', border: '1px solid rgba(8,145,178,0.18)', borderBottomLeftRadius: '4px' }}>
                                    Let's get the agents in here to stress-test both options.
                                  </div>
                                </div>
                              </div>
                              {/* Agent responses */}
                              {(step.visual as { abbr: string; avatar: string; bg: string; color: string; text: string }[]).map((v) => (
                                <div key={v.abbr} className="flex gap-2.5">
                                  <img src={v.avatar} alt={v.abbr} className="w-7 h-7 rounded-xl object-cover flex-shrink-0 mt-0.5" style={{ border: `1px solid ${v.color}22` }} />
                                  <div className="flex flex-col max-w-[80%]">
                                    <div className="flex items-baseline gap-2 mb-0.5">
                                      <span className="text-[10px] font-semibold" style={{ color: v.color }}>{v.abbr === 'RA' ? 'Risk Analyst' : v.abbr === 'FS' ? 'Financial Strategist' : "Devil's Advocate"}</span>
                                      <span className="text-[9px]" style={{ color: '#9BA6B8' }}>10:26 AM</span>
                                    </div>
                                    <div className="px-3 py-2 rounded-2xl text-[11px] leading-relaxed" style={{ background: v.bg, color: '#111827', border: `1px solid ${v.color}22`, borderBottomLeftRadius: '4px' }}>
                                      {v.text}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid #D8DDE8', background: '#F7F9FC' }}>
                              <div className="flex items-end gap-2">
                                <div className="flex-1 rounded-xl px-3 py-2 text-[10px]" style={{ background: '#FFFFFF', border: '1px solid #D8DDE8', color: '#9BA6B8', minHeight: '36px', display: 'flex', alignItems: 'center' }}>
                                  Ask a follow-up or challenge an agent...
                                </div>
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#b8860b', color: '#F0F3F7' }}>
                                  <Send className="w-4 h-4" />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {idx === 2 && step.visual && (
                          <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: '#FFFFFF', border: '1px solid #D8DDE8', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid #D8DDE8', background: '#F7F9FC' }}>
                              <Swords className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#b8860b' }} />
                              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#5D6B82' }}>War Room</span>
                              <span className="text-[10px]" style={{ color: '#9BA6B8' }}>— Synthesis</span>
                            </div>
                            <div className="flex-1 p-5" style={{ background: '#F0F3F7' }}>
                              <div className="flex justify-around mb-5">
                                {(step.visual as { label: string; value: string; sub: string; color: string }[]).map((v) => (
                                  <div key={v.label} className="flex flex-col items-center gap-1">
                                    <div className="text-2xl font-black" style={{ color: v.color }}>{v.value}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: v.color }}>{v.sub}</div>
                                    <div className="text-[9px]" style={{ color: '#5D6B82' }}>{v.label}</div>
                                  </div>
                                ))}
                              </div>
                              <div className="rounded-xl p-3.5" style={{ background: '#FFFFFF', border: '1px solid #D8DDE8', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                <p className="text-[10px] font-black uppercase tracking-wide mb-1.5" style={{ color: '#b8860b' }}>Strategic Recommendation</p>
                                <p className="text-[11px] leading-relaxed" style={{ color: '#111827' }}>
                                  <strong style={{ color: '#111827' }}>Stage the rollout. Start Germany.</strong> BaFin approval is the hardest and most valuable first stamp. Target Q3 Germany, Q1 next year France and Netherlands.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connector arrow between steps */}
                {idx < HOW_STEPS.length - 1 && (
                  <div className="flex flex-col items-center py-3">
                    <div className="w-px h-6" style={{ background: 'rgba(0,0,0,0.1)' }} />
                    <ArrowDown className="w-4 h-4" style={{ color: 'rgba(0,0,0,0.2)' }} />
                  </div>
                )}
              </RevealSection>
            );
          })}
        </div>

        {/* Summary banner */}
        <RevealSection delay={300} className="mt-12">
          <div
            className="rounded-3xl p-8 sm:p-10 text-center"
            style={{ background: 'linear-gradient(135deg,rgba(184,134,11,0.07),rgba(212,165,53,0.05))', border: '1px solid rgba(184,134,11,0.14)' }}
          >
            <p className="text-base sm:text-lg font-bold text-slate-800 mb-2">
              The sequence matters.
            </p>
            <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
              Start a Team Chat → bring in the AI agents → open the War Room → get your recommendation. Every feature builds on the last.
            </p>
            <button
              onClick={() => onNavigate('auth')}
              className="inline-flex items-center mt-6 px-6 py-3 rounded-2xl text-white font-bold text-sm transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg,#111111,#b8860b)', boxShadow: '0 4px 14px rgba(184,134,11,0.4)' }}
            >
              Try the full workflow
            </button>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}

// ─── Live Demo ────────────────────────────────────────────────────────────────

const DEMO_MESSAGES = [
  {
    agent: 'RA', avatar: AGENT_AVATARS.RA, bg: 'rgba(124,45,18,0.07)', color: '#7c2d12', label: 'Risk Analyst',
    msg: "AI credit scoring models trained on US or UK data carry severe distribution shift risk in Southern and Eastern European markets. Default rate predictions could be off by 40-60% in the first 12 months. You need local training data before you lend at scale.",
  },
  {
    agent: 'FS', avatar: AGENT_AVATARS.FS, bg: 'rgba(12,74,110,0.07)', color: '#0c4a6e', label: 'Financial Strategist',
    msg: "The EU AI Act classifies AI-driven credit decisions as high-risk. Article 10 requires explainability per decision, not just model-level. Building a compliant audit trail adds 6-9 months to your launch timeline and ongoing cost per decision. Factor that into your unit economics.",
  },
  {
    agent: 'DA', avatar: AGENT_AVATARS.DA, bg: 'rgba(20,83,45,0.07)', color: '#14532d', label: "Devil's Advocate",
    msg: 'Every incumbent cites compliance complexity as a moat. But Klarna and Monzo scaled across 6+ European jurisdictions in under 3 years. The regtech tooling is genuinely better now. The question is not whether compliance is hard. It is whether your team treats it as a blocker or a process.',
  },
  {
    agent: 'EL', avatar: AGENT_AVATARS.EL, bg: 'rgba(30,27,75,0.07)', color: '#1e1b4b', label: 'Execution Lead',
    msg: "Passport your product through Germany first: strictest regulator, highest trust signal. A BaFin approval with clean model documentation unlocks France, Netherlands, and the Nordics far faster than parallel filings. Sequence this. Do not parallelize.",
  },
];

const DEMO_RISKS = [
  { label: 'Model Distribution Shift', sev: 'critical', desc: 'AI credit models trained on UK/US data may mispredict EU default rates by 40-60% in year one.' },
  { label: 'EU AI Act Compliance Gap', sev: 'high', desc: 'Article 10 requires per-decision explainability. Building audit trails adds 6-9 months to launch.' },
  { label: 'Parallel Regulatory Filing', sev: 'high', desc: 'Simultaneous multi-market filings increase rejection risk and slow time-to-revenue.' },
];

const DEMO_ACTIONS = [
  { who: 'Legal', task: 'Commission a BaFin pre-submission explainability review for the credit model. Target Q2 submission window.', priority: 'critical' },
  { who: 'Engineering', task: 'Build a per-decision audit trail compliant with EU AI Act Article 10 before Germany launch.', priority: 'critical' },
  { who: 'CEO', task: 'Sequence market entry: Germany (Q3), France and Netherlands (Q1 next year). Halt parallel filings.', priority: 'high' },
  { who: 'Risk', task: 'Collect EU-local training data from German open banking sources to reduce model distribution shift by launch.', priority: 'high' },
];

const SEV_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'rgba(220,38,38,0.1)', text: '#b91c1c' },
  high:     { bg: 'rgba(245,158,11,0.1)', text: '#b45309' },
  medium:   { bg: 'rgba(184,134,11,0.1)',  text: '#b8860b' },
};

const PRI_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'rgba(220,38,38,0.08)', text: '#b91c1c' },
  high:     { bg: 'rgba(245,158,11,0.08)', text: '#b45309' },
  medium:   { bg: 'rgba(184,134,11,0.07)',  text: '#b8860b' },
};

function ScoreArc({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 22; const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="5" />
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
    <section ref={ref} style={{ background: '#f8fafc', borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)' }} className="py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold mb-4" style={{ background: 'rgba(184,134,11,0.07)', color: '#b8860b', border: '1px solid rgba(184,134,11,0.12)' }}>
            Live example
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
            Watch the full workflow.
          </h2>
          <p className="text-base text-slate-500 max-w-xl mx-auto leading-relaxed">
            A fintech team asks: <strong className="text-slate-700">"Should we launch our AI lending product across Europe now?"</strong> Agents debate it, the War Room synthesizes it, the report is ready.
          </p>
        </div>

        {/* Phase labels */}
        <div className="flex items-center justify-center gap-4 mb-6 flex-wrap">
          {[
            { step: '1', label: 'Team Chat', color: '#0891b2', bg: 'rgba(8,145,178,0.07)' },
            { step: '→', label: '', color: '#94a3b8', bg: 'transparent' },
            { step: '2', label: 'Multiplayer AI', color: '#b8860b', bg: 'rgba(184,134,11,0.08)' },
            { step: '→', label: '', color: '#94a3b8', bg: 'transparent' },
            { step: '3', label: 'War Room Synthesis', color: '#dc2626', bg: 'rgba(220,38,38,0.07)' },
          ].map((item, i) => item.label ? (
            <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: item.bg, color: item.color }}>
              {item.step} · {item.label}
            </span>
          ) : (
            <span key={i} className="text-sm font-bold" style={{ color: '#cbd5e1' }}>→</span>
          ))}
        </div>

        {/* Browser-style demo */}
        <div
          className="rounded-3xl overflow-hidden mx-auto"
          style={{ maxWidth: 800, background: '#FFFFFF', boxShadow: '0 8px 32px rgba(0,0,0,0.10)', border: '1px solid #D8DDE8' }}
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid #D8DDE8', background: '#F7F9FC' }}>
            <div className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#10b981' }} />
            <div className="flex items-center gap-2 ml-4 flex-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#1e7a52' }} />
              <span className="text-xs font-medium" style={{ color: '#5D6B82' }}>Private Workspace · European Expansion</span>
            </div>
            <Lock className="w-3 h-3" style={{ color: '#9BA6B8' }} />
          </div>

          {/* Tab header */}
          <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid #D8DDE8', background: '#F7F9FC' }}>
            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#b8860b' }} />
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#5D6B82' }}>Multiplayer AI</span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#1e7a52' }} />
              <span className="text-[10px]" style={{ color: '#5D6B82' }}>Live</span>
            </div>
          </div>

          {/* User prompt */}
          <div className="px-5 pt-5 pb-4" style={{ background: '#FFFFFF' }}>
            <div
              className="flex items-start gap-3 rounded-2xl p-4 mb-1"
              style={{ background: '#F7F9FC', border: '1px solid #D8DDE8' }}
            >
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                style={{ background: '#b8860b', color: '#F0F3F7' }}
              >
                YO
              </div>
              <div>
                <p className="text-[11px] font-bold mb-1" style={{ color: '#b8860b' }}>You</p>
                <p className="text-sm leading-relaxed font-medium" style={{ color: '#111827' }}>We're ready to launch our AI-powered lending product. Should we go multi-market across Europe now, or stage the rollout?</p>
              </div>
            </div>

            {/* Agent tags */}
            <div className="flex items-center gap-2 mt-3 mb-4 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9BA6B8' }}>Responding:</span>
              {DEMO_MESSAGES.map((m, i) => (
                <span
                  key={m.agent}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full transition-all duration-300"
                  style={i < revealed
                    ? { background: m.bg, color: m.color, opacity: 1 }
                    : { background: '#F7F9FC', color: '#9BA6B8' }}
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
                  <img
                    src={m.avatar}
                    alt={m.label}
                    className="w-7 h-7 rounded-xl object-cover flex-shrink-0 mt-0.5"
                    style={{ border: `1px solid ${m.color}22` }}
                  />
                  <div
                    className="flex-1 rounded-2xl p-3.5"
                    style={{ background: m.bg, border: `1px solid ${m.color}22`, borderBottomLeftRadius: '4px' }}
                  >
                    <p className="text-[11px] font-bold mb-1.5" style={{ color: m.color }}>{m.label}</p>
                    <p className="text-[12px] leading-relaxed" style={{ color: '#111827' }}>{m.msg}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* War Room Synthesis */}
            {revealed >= DEMO_MESSAGES.length && (
              <div
                className="mt-4 rounded-2xl p-4 transition-all duration-700"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #D8DDE8',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  opacity: 1,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'rgba(184,134,11,0.12)' }}>
                    <Brain className="w-3 h-3" style={{ color: '#b8860b' }} />
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: '#b8860b' }}>War Room Synthesis</span>
                  <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(184,134,11,0.12)', color: '#b8860b' }}>Built from your Multiplayer AI</span>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: '#111827' }}>
                  <strong style={{ color: '#111827' }}>Verdict: Stage the rollout, starting Germany.</strong> The EU AI Act compliance burden is real but sequenceable. BaFin approval is the hardest and most valuable first stamp. It de-risks the rest of the continent. Launch Germany in Q3, use the model audit trail as a template, then fast-follow France and Netherlands by Q1 next year.
                </p>
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="px-5 py-3.5" style={{ borderTop: '1px solid #D8DDE8', background: '#F7F9FC' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex-1 h-9 rounded-xl px-3.5 flex items-center gap-2"
                style={{ background: '#FFFFFF', border: '1px solid #D8DDE8' }}
              >
                <span className="text-xs" style={{ color: '#9BA6B8' }}>Ask a follow-up or challenge an agent...</span>
              </div>
              {revealed >= DEMO_MESSAGES.length && (
                <button
                  onClick={() => setShowPDF(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: '#F7F9FC', color: '#5D6B82', border: '1px solid #D8DDE8' }}
                >
                  <Download className="w-3 h-3" />
                  Export PDF
                </button>
              )}
              <button
                onClick={() => onNavigate('auth')}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                style={{ background: '#b8860b', color: '#F0F3F7', boxShadow: '0 2px 8px rgba(184,134,11,0.3)' }}
              >
                Try it
              </button>
            </div>
          </div>
        </div>

        {/* PDF Export Preview */}
        <div
          className="mx-auto mt-6 overflow-hidden transition-all duration-700"
          style={{
            maxWidth: 800,
            maxHeight: showPDF ? '2000px' : 0,
            opacity: showPDF ? 1 : 0,
          }}
        >
          <div className="flex flex-col items-center mb-4">
            <div className="w-0.5 h-6" style={{ background: 'rgba(0,0,0,0.12)' }} />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold" style={{ background: 'rgba(0,0,0,0.06)', color: '#64748b', border: '1px solid rgba(0,0,0,0.08)' }}>
              <Download className="w-3 h-3" />
              Exported War Room report · Step 3 of 3
            </div>
            <div className="w-0.5 h-4" style={{ background: 'rgba(0,0,0,0.12)' }} />
            <div className="w-2 h-2 rotate-45" style={{ background: 'rgba(0,0,0,0.12)', marginTop: -4 }} />
          </div>

          <div className="rounded-3xl overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
            <div className="px-8 pt-8 pb-6" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'linear-gradient(135deg,#000000,#111111)' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
                      <Brain className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.7)' }}>Poddle · War Room Report</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">European AI Lending Expansion</h3>
                  <p className="text-xs" style={{ color: 'rgba(148,163,184,0.65)' }}>
                    Private Workspace · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · 12 messages analyzed
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-3xl font-black text-white">68</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#f59e0b' }}>Developing</div>
                  <div className="text-[10px]" style={{ color: 'rgba(148,163,184,0.5)' }}>Decision Health</div>
                </div>
              </div>
              <div className="flex gap-4 mt-5">
                <ScoreArc score={74} label="Strategic Alignment" color="#16a34a" />
                <ScoreArc score={61} label="Operational Readiness" color="#f59e0b" />
              </div>
            </div>

            <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'rgba(184,134,11,0.03)' }}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4" style={{ color: '#111111' }} />
                <span className="text-xs font-black uppercase tracking-wider" style={{ color: '#111111' }}>Strategic Recommendation</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-700">
                <strong className="text-slate-900">Stage the rollout. Start with Germany.</strong> BaFin approval is the hardest and most valuable first stamp. It de-risks France, Netherlands, and the Nordics. Target Germany in Q3 with a compliant audit trail in place. Parallel multi-market filing will cost more time than it saves.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', borderColor: 'rgba(0,0,0,0.06)' }}>
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
              <div className="px-8 py-6">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">Action Items</span>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(184,134,11,0.08)', color: '#b8860b' }}>4 items</span>
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

            <div className="px-8 py-4 flex items-center justify-between" style={{ background: '#fafafa' }}>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5" style={{ color: '#94a3b8' }} />
                <span className="text-[10px] font-semibold" style={{ color: '#94a3b8' }}>3 conflict zones. 6 open questions. 5 blind spots flagged.</span>
              </div>
              <button
                onClick={() => onNavigate('auth')}
                className="flex items-center gap-1.5 text-[10px] font-bold transition-colors hover:text-blue-700"
                style={{ color: '#b8860b' }}
              >
                Get your own report
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Social Proof ─────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote: "We used the War Room before a board presentation. The Devil's Advocate agent surfaced a risk our CFO had not considered. We caught it in time.",
    role: "Head of Strategy · Series B SaaS",
    initial: "S",
    color: '#b8860b',
  },
  {
    quote: "I did not realize the PDF came from the War Room until I read the walkthrough. Once I understood the flow, the reports became 10x more useful.",
    role: "Founder · FinTech",
    initial: "F",
    color: '#059669',
  },
  {
    quote: "The Multiplayer AI is where the debate happens. The War Room is where decisions get made. That distinction took me a day to learn, but now I would not skip it.",
    role: "VP Operations · Scale-up",
    initial: "V",
    color: '#dc2626',
  },
];

function SocialProofSection() {
  return (
    <section style={{ background: '#fff', borderTop: '1px solid rgba(0,0,0,0.06)' }} className="py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealSection className="text-center mb-12">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">What teams say</p>
        </RevealSection>

        <div className="grid sm:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <RevealSection key={i} delay={i * 100}>
              <div
                className="h-full p-6 rounded-2xl flex flex-col gap-4"
                style={{ background: '#fafafa', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              >
                <p className="text-sm text-slate-600 leading-relaxed flex-1">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                    style={{ background: t.color }}
                  >
                    {t.initial}
                  </div>
                  <p className="text-xs font-semibold text-slate-500">{t.role}</p>
                </div>
              </div>
            </RevealSection>
          ))}
        </div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-3 gap-5 mt-10">
          {[
            { icon: Brain, color: '#b8860b', bg: 'rgba(184,134,11,0.08)', title: '7 specialized agents', desc: "Risk Analyst, Devil's Advocate, Market Analyst, Execution Lead, Financial Strategist, Innovation Lead, People Advisor, each with a different mandate." },
            { icon: Shield, color: '#0891b2', bg: '#ecfeff', title: 'Private by default', desc: 'Your workspace is encrypted and invisible to the public. Invite your team. Nothing leaves your org. SOC 2-aligned infrastructure.' },
            { icon: FileText, color: '#059669', bg: '#ecfdf5', title: 'Board-ready exports', desc: 'The War Room PDF includes your recommendation, risk signals, action items by owner, and decision health scores, ready to share.' },
          ].map(({ icon: Icon, color, bg, title, desc }, i) => (
            <RevealSection key={title} delay={i * 80}>
              <div
                className="h-full p-6 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
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

// ─── Team ────────────────────────────────────────────────────────────────────

export function TeamSection() {
  const members = [
    {
      name: 'Oludotun Akinbobola',
      role: 'Founder, Poddle AI',
      photo: '/images/team/headshot2.png',
      bio: `Oludotun is the founder of Poddle AI, building an adversarial AI "War Room" that pressure-tests business decisions before they become expensive mistakes. With seven years in Agile delivery and program management across aviation software, insurance, and automotive, he's spent his career watching good decisions get made badly, and bad ones get made confidently. Poddle AI is his answer: a multi-agent system that debates a decision from every angle before you commit to it.\n\nOludotun holds executive education credentials from London Business School, MIT Sloan, and Cambridge Judge Business School, and previously co-founded Teamplana, a SaaS project management platform.`,
    },
  ];

  return (
    <section className="py-24" style={{ background: '#ffffff' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealSection>
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: '#b8860b' }}>
              The team
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" style={{ color: '#0f172a' }}>
              Built by people who live the problem.
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: '#64748b' }}>
              The minds behind Poddle AI, shaping decision intelligence for teams.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-8">
            {members.map((m) => (
              <div
                key={m.name}
                className="group flex flex-col sm:flex-row sm:items-start w-full sm:max-w-3xl p-8 sm:p-10 rounded-3xl transition-all duration-300 hover:-translate-y-1"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
              >
                <div className="flex flex-col items-center sm:items-start sm:w-56 shrink-0 sm:pr-8 mb-6 sm:mb-0">
                  <div className="relative w-32 h-32 mb-5 rounded-full overflow-hidden" style={{ boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
                    <img
                      src={m.photo}
                      alt={m.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-lg font-bold mb-1 text-center sm:text-left" style={{ color: '#0f172a' }}>
                    {m.name}
                  </h3>
                  <p className="text-sm font-medium text-center sm:text-left" style={{ color: '#b8860b' }}>
                    {m.role}
                  </p>
                </div>
                <div className="flex-1 sm:border-l sm:pl-8 sm:border-slate-200">
                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#475569' }}>
                    {m.bio}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </RevealSection>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <section style={{ background: 'linear-gradient(135deg,#000000 0%,#0a0a0a 55%,#111111 100%)' }} className="py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <RevealSection>
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.09)' }} />
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
            Your next big decision<br />deserves a proper challenge.
          </h2>
          <p className="text-base leading-relaxed mb-10 max-w-lg mx-auto" style={{ color: 'rgba(203,213,225,0.75)' }}>
            Start a Team Chat. Bring in the AI agents. Run the War Room. Export the report. Free to start, no card required.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
            <button
              onClick={() => onNavigate('auth')}
              className="px-8 py-4 rounded-2xl font-bold text-sm transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: '#fff', color: '#b8860b', boxShadow: '0 4px 14px rgba(184,134,11,0.3)' }}
            >
              Create free account
            </button>
            <button
              onClick={() => onNavigate('pricing')}
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-sm transition-all hover:-translate-y-0.5"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(203,213,225,0.9)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              View pricing
              <ArrowRight className="w-4 h-4" />
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


        </RevealSection>
      </div>
    </section>
  );
}
