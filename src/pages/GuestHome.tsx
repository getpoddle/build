import { useState, useEffect, useRef } from 'react';
import {
  Sparkles, ArrowRight, Shield, CheckCircle, Lock, Bot, Users,
  Crown, Swords, Brain, BarChart2, X, CreditCard, Target, Zap,
  MessageSquare, LineChart, ChevronDown,
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
      <LogoStrip />
      <FeaturesSection />
      <HowItWorksSection onNavigate={onNavigate} />
      <AgentRosterSection onJoin={openJoin} />
      <WarRoomSection onNavigate={onNavigate} />
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

function HeroSection({ onNavigate }: { onNavigate: (p: string) => void }) {
  const agentPreviews = [
    { name: 'The Skeptic',    initial: 'SK', bg: '#fef2f2', text: '#b91c1c' },
    { name: 'Risk Analyst',   initial: 'RA', bg: '#fff7ed', text: '#c2410c' },
    { name: 'Market Analyst', initial: 'MA', bg: '#f0fdfa', text: '#0f766e' },
    { name: 'The Optimist',   initial: 'OP', bg: '#f0fdf4', text: '#15803d' },
    { name: 'Data Detective', initial: 'DD', bg: '#eff6ff', text: '#1d4ed8' },
  ];

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(170deg, #0f172a 0%, #1e2d4a 55%, #1e3a5f 100%)',
        minHeight: '92vh',
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full relative z-10">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-6"
              style={{ background: 'rgba(37,99,235,0.15)', color: '#93c5fd', border: '1px solid rgba(37,99,235,0.25)' }}
            >
              <Brain className="w-3.5 h-3.5" />
              Decision Intelligence Platform
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-black leading-[1.08] mb-5 text-white">
              The AI panel that<br />
              challenges your best{' '}
              <span style={{ background: 'linear-gradient(135deg,#60a5fa,#22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                thinking.
              </span>
            </h1>

            <p className="text-base leading-relaxed mb-8 max-w-lg" style={{ color: 'rgba(203,213,225,0.85)' }}>
              Seven specialized AI agents debate your strategy, stress-test assumptions, and surface blind spots — in a private workspace your team actually controls.
            </p>

            <div className="flex items-center gap-3 mb-8 flex-wrap">
              <div className="flex -space-x-2">
                {agentPreviews.map(a => (
                  <div
                    key={a.name}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black border-2"
                    style={{ background: a.bg, color: a.text, borderColor: '#1e2d4a' }}
                    title={a.name}
                  >
                    {a.initial}
                  </div>
                ))}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold border-2" style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8', borderColor: '#1e2d4a' }}>+2</div>
              </div>
              <span className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.9)' }}>7 specialized reasoning agents</span>
            </div>

            <div className="flex flex-wrap gap-3 mb-8">
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

            <div className="flex items-center gap-5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
                <span className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.8)' }}>Free. No card required.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
                <span className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.8)' }}>Private workspaces from $19/mo</span>
              </div>
            </div>
          </div>

          {/* Product demo card */}
          <div className="hidden lg:block">
            <div
              className="rounded-3xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}
            >
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
                <div className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#10b981' }} />
                <div className="flex items-center gap-2 ml-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.7)' }}>Private Workspace · Series A Prep</span>
                </div>
                <Lock className="w-3 h-3 ml-auto" style={{ color: 'rgba(100,116,139,0.6)' }} />
              </div>

              <div className="p-5 space-y-3">
                {[
                  { agent: 'SK', bg: '#7f1d1d', color: '#fca5a5', label: 'The Skeptic', msg: 'Your 40% market penetration assumption in 18 months has no distribution moat behind it. What is the actual acquisition engine?' },
                  { agent: 'OP', bg: '#14532d', color: '#86efac', label: 'The Optimist', msg: 'The network effect compounds faster than modeled. Each enterprise cohort brings avg 3.2 referrals — that is $50M ARR by month 24.' },
                  { agent: 'RA', bg: '#7c2d12', color: '#fdba74', label: 'Risk Analyst', msg: 'Key-person concentration is the #1 failure mode. CTO holds 60% of technical IP with no succession plan.' },
                  { agent: 'DD', bg: '#1e3a5f', color: '#93c5fd', label: 'Data Detective', msg: 'Comparable Series A raises in this category averaged $8.2M at 6.1x ARR multiple. Your $12M ask requires defensible differentiation.' },
                ].map(({ agent, bg, color, label, msg }) => (
                  <div key={agent} className="flex gap-3">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5" style={{ background: bg, color }}>
                      {agent}
                    </div>
                    <div className="flex-1 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <p className="text-[11px] font-bold mb-1" style={{ color }}>{label}</p>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(203,213,225,0.75)' }}>{msg}</p>
                    </div>
                  </div>
                ))}

                <div className="rounded-xl p-3.5 mt-1" style={{ background: 'linear-gradient(135deg,rgba(37,99,235,0.2),rgba(6,182,212,0.15))', border: '1px solid rgba(37,99,235,0.3)' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-4 h-4 rounded-md flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.3)' }}>
                      <Brain className="w-2.5 h-2.5" style={{ color: '#93c5fd' }} />
                    </div>
                    <span className="text-[11px] font-bold" style={{ color: '#93c5fd' }}>AI Synthesis</span>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(203,213,225,0.85)' }}>
                    <strong style={{ color: '#e2e8f0' }}>Consensus:</strong> Strong product, thin distribution story. Lock CTO equity, validate GTM via 3-customer pilot, then raise with real retention data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-16">
          <a href="#features" className="flex flex-col items-center gap-2 group" style={{ color: 'rgba(100,116,139,0.6)' }}>
            <span className="text-xs font-medium group-hover:text-slate-400 transition-colors">Explore features</span>
            <ChevronDown className="w-5 h-5 group-hover:text-slate-400 transition-colors animate-bounce" />
          </a>
        </div>
      </div>
    </section>
  );
}

function LogoStrip() {
  const items = [
    { label: 'Founders' }, { label: 'Product Teams' }, { label: 'Strategy Leaders' },
    { label: 'Startup Operators' }, { label: 'Board Advisors' }, { label: 'VCs' },
  ];
  return (
    <div style={{ background: '#fff', borderBottom: '1px solid rgba(15,23,42,0.06)' }} className="py-5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Trusted by decision-makers at</p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {items.map(item => (
            <span key={item.label} className="text-sm font-bold text-slate-400">{item.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeaturesSection() {
  const features = [
    { icon: Lock,         color: '#2563eb', bg: '#eff6ff', title: 'Private & encrypted',       desc: 'Your workspace is invisible to the public. Every decision, assumption, and synthesis stays inside your org.' },
    { icon: Bot,          color: '#0891b2', bg: '#ecfeff', title: '7 specialized AI agents',   desc: 'The Skeptic, Risk Analyst, Optimist, Data Detective, and three more — each with a distinct analytical lens.' },
    { icon: Brain,        color: '#7c3aed', bg: '#f5f3ff', title: 'AI synthesis',               desc: 'After the debate, AI synthesizes dissenting views into a clear recommendation with next steps.' },
    { icon: Swords,       color: '#dc2626', bg: '#fef2f2', title: 'War Room',                   desc: 'Run a structured red-team session before critical decisions: pivots, hires, fundraises, market entries.' },
    { icon: Users,        color: '#16a34a', bg: '#f0fdf4', title: 'Team collaboration',         desc: 'Invite up to 10 team members. Everyone contributes context; AI agents respond to the full picture.' },
    { icon: BarChart2,    color: '#ea580c', bg: '#fff7ed', title: 'Scenario modeling',          desc: 'Agents generate best/base/worst-case trees with probability weights and decision paths.' },
  ];

  return (
    <section id="features" style={{ background: '#fafafa', borderBottom: '1px solid rgba(15,23,42,0.05)' }} className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealSection className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: 'rgba(37,99,235,0.07)', color: '#1d4ed8', border: '1px solid rgba(37,99,235,0.12)' }}>
            Platform capabilities
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3">
            Everything your team needs<br />to decide with confidence
          </h2>
          <p className="text-base text-slate-500 max-w-xl mx-auto leading-relaxed">
            Poddle replaces gut-feel decision-making with structured AI debate — in a workspace only your team can see.
          </p>
        </RevealSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, color, bg, title, desc }, i) => (
            <RevealSection key={title} delay={i * 60}>
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

function HowItWorksSection({ onNavigate }: { onNavigate: (p: string) => void }) {
  const steps = [
    { number: '01', icon: Lock,     title: 'Create a private workspace',   desc: 'Invite your team. Everything inside is encrypted and never visible to the public. Your strategy stays yours.' },
    { number: '02', icon: Bot,      title: 'Ask AI agents to weigh in',    desc: 'Seven specialized agents debate your question simultaneously — from The Skeptic to The Optimist — each from a distinct lens.' },
    { number: '03', icon: Swords,   title: 'Surface blind spots',          desc: 'Agents challenge assumptions, flag key-person risks, question market sizing, and point out what you\'ve missed.' },
    { number: '04', icon: CheckCircle, title: 'Decide with clarity',       desc: 'AI synthesizes the debate into a clear recommendation with dissenting views. You decide with the full picture.' },
  ];

  return (
    <section style={{ background: '#fff', borderBottom: '1px solid rgba(15,23,42,0.05)' }} className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealSection className="mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: 'rgba(15,23,42,0.05)', color: '#334155', border: '1px solid rgba(15,23,42,0.08)' }}>
            How it works
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3">From question to decision in four steps</h2>
          <p className="text-base text-slate-500 max-w-md leading-relaxed">No setup complexity. Open a workspace, ask a question, and your AI panel responds within seconds.</p>
        </RevealSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl overflow-hidden" style={{ background: 'rgba(15,23,42,0.06)' }}>
          {steps.map(({ number, icon: Icon, title, desc }, i) => (
            <RevealSection key={number} delay={i * 80} className="h-full">
              <div className="h-full p-7 bg-white">
                <div
                  className="text-xs font-black mb-5 inline-flex items-center justify-center w-8 h-8 rounded-xl"
                  style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)', color: '#fff' }}
                >
                  {number}
                </div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(37,99,235,0.07)' }}>
                  <Icon className="w-4.5 h-4.5 text-blue-600" style={{ width: '1.125rem', height: '1.125rem' }} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            </RevealSection>
          ))}
        </div>

        <RevealSection className="mt-10 text-center" delay={200}>
          <button
            onClick={() => onNavigate('auth')}
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-white font-bold text-sm transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 6px 20px rgba(37,99,235,0.3)' }}
          >
            <Sparkles className="w-4 h-4" />
            Try it free — no card needed
          </button>
        </RevealSection>
      </div>
    </section>
  );
}

function AgentRosterSection({ onJoin }: { onJoin: (t: string) => void }) {
  const agents = [
    { name: 'The Skeptic',     role: 'Finds the fatal flaw',       initial: 'SK', bg: '#fef2f2', text: '#b91c1c' },
    { name: 'Risk Analyst',    role: 'Quantifies downside risk',    initial: 'RA', bg: '#fff7ed', text: '#c2410c' },
    { name: 'The Optimist',    role: 'Spots hidden upside',         initial: 'OP', bg: '#f0fdf4', text: '#15803d' },
    { name: 'Data Detective',  role: 'Grounds claims in evidence',  initial: 'DD', bg: '#eff6ff', text: '#1d4ed8' },
    { name: 'Market Analyst',  role: 'Maps competitive dynamics',   initial: 'MA', bg: '#f0fdfa', text: '#0f766e' },
    { name: 'Systems Thinker', role: 'Traces feedback loops',       initial: 'ST', bg: '#faf5ff', text: '#7c3aed' },
    { name: 'The Pragmatist',  role: 'What actually ships',         initial: 'PR', bg: '#f8fafc', text: '#475569' },
  ];

  return (
    <section style={{ background: 'linear-gradient(170deg,#0f172a,#1e2d4a)', borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealSection className="mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: 'rgba(37,99,235,0.18)', color: '#93c5fd', border: '1px solid rgba(37,99,235,0.25)' }}>
            The Reasoning Panel
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">7 agents. Every angle.</h2>
          <p className="text-base max-w-xl leading-relaxed" style={{ color: 'rgba(148,163,184,0.85)' }}>
            No echo chambers. Each agent is built to challenge your thinking from a fundamentally different analytical lens — simultaneously, in every session.
          </p>
        </RevealSection>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {agents.map((agent, i) => (
            <RevealSection key={agent.name} delay={i * 50}>
              <button
                onClick={() => onJoin('ai')}
                className="w-full flex flex-col items-center gap-2.5 p-4 rounded-2xl text-center transition-all duration-200 hover:-translate-y-1 group"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black transition-transform duration-200 group-hover:scale-110" style={{ background: agent.bg, color: agent.text }}>
                  {agent.initial}
                </div>
                <div>
                  <p className="text-xs font-bold text-white leading-tight">{agent.name}</p>
                  <p className="text-[11px] mt-0.5 leading-tight" style={{ color: 'rgba(148,163,184,0.7)' }}>{agent.role}</p>
                </div>
              </button>
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  );
}

function WarRoomSection({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <section style={{ background: '#fff', borderBottom: '1px solid rgba(15,23,42,0.05)' }} className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealSection className="mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: 'rgba(220,38,38,0.07)', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.12)' }}>
            <Swords className="w-3.5 h-3.5" />
            War Room
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3">Red-team every high-stakes decision</h2>
          <p className="text-base text-slate-500 max-w-xl leading-relaxed">
            Before a pivot, a major hire, a fundraise, or a market entry — run it through the War Room. No blind spots. No groupthink.
          </p>
        </RevealSection>

        <div className="grid lg:grid-cols-3 gap-5 mb-8">
          {[
            { icon: Swords,    color: '#dc2626', bg: '#fef2f2', title: 'Red team your decisions',    desc: 'AI agents actively try to find the fatal flaw in your plan. The Skeptic, Risk Analyst, and Market Analyst challenge every assumption simultaneously.' },
            { icon: BarChart2, color: '#0369a1', bg: '#f0f9ff', title: 'Scenario intelligence',      desc: 'Model best-case, base-case, and worst-case outcomes. Agents generate scenario trees with probability weights and decision paths.' },
            { icon: Brain,     color: '#15803d', bg: '#f0fdf4', title: 'Consensus synthesis',        desc: 'When agents disagree, AI synthesizes the debate into a clear recommendation with dissenting views noted. You see the full reasoning.' },
          ].map(({ icon: Icon, color, bg, title, desc }, i) => (
            <RevealSection key={title} delay={i * 80}>
              <div
                className="h-full p-7 rounded-2xl transition-all duration-200 hover:shadow-md"
                style={{ background: '#fafafa', border: '1px solid rgba(15,23,42,0.07)' }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: bg }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            </RevealSection>
          ))}
        </div>

        <RevealSection delay={200}>
          <div
            className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5"
            style={{ background: 'linear-gradient(135deg,#fef2f2,#fff7ed)', border: '1px solid rgba(220,38,38,0.1)' }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
              <Swords className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-slate-900">Included in every paid plan</p>
              <p className="text-xs text-slate-500 mt-0.5">War Room access is built into Pro Individual, Poddle Team, and Enterprise. No add-ons needed.</p>
            </div>
            <button
              onClick={() => onNavigate('pricing')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all hover:-translate-y-0.5 flex-shrink-0 text-white"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 4px 14px rgba(220,38,38,0.25)' }}
            >
              Unlock War Room <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </RevealSection>
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
