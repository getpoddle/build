import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  CheckCircle,
  Lock,
  Brain,
  Shield,
  History,
  FileText,
  AlertTriangle,
  Target,
  ChevronRight,
  Users,
  ShieldCheck,
  TrendingUp,
  Building2,
  Scale,
  Briefcase,
  Handshake,
  Network,
  Eye,
  CheckCircle2,
  Clock,
  ChevronDown,
} from 'lucide-react';
import PoddleMark from '../components/PoddleMark';
import type { LucideIcon } from 'lucide-react';

interface GuestHomeProps {
  onNavigate: (page: string) => void;
}

// ─── Brand tokens ────────────────────────────────────────────────────────────
const GOLD = '#b8860b';
const GOLD_LIGHT = '#d4a535';
const BLUE = '#2563eb';
const INK = '#0f172a';
const SLATE = '#475569';
const SLATE_MID = '#64748b';
const SLATE_LIGHT = '#94a3b8';
const BORDER = '#e2e8f0';
const BORDER_SOFT = '#f1f5f9';
const BG_ALT = '#f8fafc';
const WHITE = '#ffffff';

// ─── Scroll reveal ───────────────────────────────────────────────────────────
function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function RevealSection({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: 'opacity 0.65s ease, transform 0.65s ease',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const CAPABILITIES: {
  icon: LucideIcon;
  title: string;
  body: string;
  points: string[];
}[] = [
  {
    icon: Brain,
    title: 'Decision Intelligence',
    body: 'Analyze trade-offs, risks, and competing perspectives using specialized AI agents that examine decisions from multiple angles.',
    points: ['Multi-agent analysis', 'Risk identification', 'Trade-off evaluation'],
  },
  {
    icon: Eye,
    title: 'Evidence Intelligence',
    body: 'Classify evidence, document provenance, and distinguish verified information from assumptions. Surface uncertainty before it becomes costly.',
    points: ['Evidence classification', 'Provenance tracking', 'Assumption detection'],
  },
  {
    icon: Shield,
    title: 'Decision Governance',
    body: 'Assign ownership, document approvals, and preserve accountability so every decision is defensible and auditable.',
    points: ['Ownership assignment', 'Approval workflows', 'Accountability records'],
  },
  {
    icon: History,
    title: 'Decision History',
    body: 'Maintain evidence revisions, decision trails, and historical snapshots that let you reconstruct how any decision was made.',
    points: ['Evidence versioning', 'Decision trails', 'Point-in-time snapshots'],
  },
];

const PROCESS_STEPS: {
  num: string;
  icon: LucideIcon;
  title: string;
  body: string;
}[] = [
  {
    num: '01',
    icon: FileText,
    title: 'Capture the Decision',
    body: 'Define the decision, its context, and the questions it needs to answer. Invite the right people into a shared workspace.',
  },
  {
    num: '02',
    icon: Eye,
    title: 'Examine the Evidence',
    body: 'Gather supporting evidence, classify it by verification status, and tag assumptions. Every source is documented with provenance.',
  },
  {
    num: '03',
    icon: Brain,
    title: 'Evaluate Perspectives',
    body: 'Deploy specialized AI agents to analyze risks, challenge assumptions, and surface conflicting evidence from different viewpoints.',
  },
  {
    num: '04',
    icon: ShieldCheck,
    title: 'Document the Decision',
    body: 'Record the outcome, ownership, and reasoning. Generate a decision trail and snapshot that preserves the full context for future review.',
  },
];

const USE_CASES: {
  icon: LucideIcon;
  title: string;
  body: string;
}[] = [
  {
    icon: TrendingUp,
    title: 'Strategic Investments',
    body: 'Evaluate capital allocation decisions with structured evidence assessment and risk analysis before committing resources.',
  },
  {
    icon: Building2,
    title: 'Market Entry',
    body: 'Assess new market opportunities by assembling evidence, testing assumptions, and documenting the reasoning behind go or no-go.',
  },
  {
    icon: Briefcase,
    title: 'Mergers & Acquisitions',
    body: 'Structure due diligence with classified evidence, identified risks, and a clear record of what was known and what was assumed.',
  },
  {
    icon: Network,
    title: 'Technology Investments',
    body: 'Evaluate technology adoption decisions with trade-off analysis, competing perspectives, and a documented evaluation trail.',
  },
  {
    icon: Scale,
    title: 'Organizational Restructuring',
    body: 'Approve structural changes with documented evidence, stakeholder input, and a defensible record of how the decision was reached.',
  },
  {
    icon: Handshake,
    title: 'Strategic Partnerships',
    body: 'Assess partnership proposals with evidence-based analysis, risk identification, and a clear ownership trail for accountability.',
  },
];

const SECURITY_FEATURES: {
  icon: LucideIcon;
  title: string;
  body: string;
}[] = [
  {
    icon: Lock,
    title: 'Workspace Access Controls',
    body: 'Decisions live in private workspaces with role-based access. Only invited members can view, contribute to, or manage a decision.',
  },
  {
    icon: FileText,
    title: 'Evidence Traceability',
    body: 'Every piece of evidence carries a unique identifier and provenance record, so you can trace any claim back to its source.',
  },
  {
    icon: History,
    title: 'Historical Records',
    body: 'Decision trails and evidence revisions are preserved over time, creating an immutable record of how decisions evolved.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacy-Conscious Processing',
    body: 'Workspace data is processed with attention to privacy. Your decision content is not used for public model training.',
  },
];

// Demo data for product showcase — illustrative only
const DEMO_EVIDENCE: { id: string; title: string; type: string; status: 'Verified' | 'Assumption' | 'Unverified' }[] = [
  { id: 'EV-001', title: 'Q3 market revenue analysis', type: 'Financial Report', status: 'Verified' },
  { id: 'EV-002', title: 'Customer retention assumption', type: 'Internal Estimate', status: 'Assumption' },
  { id: 'EV-003', title: 'Competitor pricing survey', type: 'Market Research', status: 'Verified' },
  { id: 'EV-004', title: 'Regulatory approval timeline', type: 'External Source', status: 'Unverified' },
];

const DEMO_RISKS: { level: 'High' | 'Medium' | 'Low'; title: string }[] = [
  { level: 'High', title: 'Regulatory delay may push launch beyond Q1' },
  { level: 'Medium', title: 'Competitor may respond with aggressive pricing' },
  { level: 'Low', title: 'Integration costs could exceed initial estimate' },
];

const DEMO_TRAIL: { time: string; event: string; actor: string }[] = [
  { time: 'Oct 2, 14:20', event: 'Decision created', actor: 'O. Akinbobola' },
  { time: 'Oct 3, 09:15', event: 'Evidence EV-001 verified', actor: 'Risk Analyst' },
  { time: 'Oct 3, 11:30', event: 'Assumption identified in EV-002', actor: 'Financial Strategist' },
  { time: 'Oct 4, 16:45', event: 'Decision snapshot recorded', actor: 'System' },
  { time: 'Oct 5, 10:00', event: 'Ownership assigned to O. Akinbobola', actor: 'O. Akinbobola' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Verified: { bg: 'rgba(22,163,74,0.08)', text: '#15803d', border: 'rgba(22,163,74,0.2)' },
  Assumption: { bg: 'rgba(217,119,6,0.08)', text: '#a16207', border: 'rgba(217,119,6,0.2)' },
  Unverified: { bg: 'rgba(220,38,38,0.08)', text: '#b91c1c', border: 'rgba(220,38,38,0.2)' },
};

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  High: { bg: 'rgba(220,38,38,0.08)', text: '#b91c1c' },
  Medium: { bg: 'rgba(217,119,6,0.08)', text: '#a16207' },
  Low: { bg: 'rgba(22,163,74,0.08)', text: '#15803d' },
};

// ─── Header nav ──────────────────────────────────────────────────────────────

function HeaderNav({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className="hidden md:flex items-center gap-1"
      style={{ transition: 'all 0.2s ease' }}
    >
      <a href="#capabilities" className="px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-slate-100" style={{ color: SLATE }}>
        Platform
      </a>
      <a href="#use-cases" className="px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-slate-100" style={{ color: SLATE }}>
        Solutions
      </a>
      <a href="#how-it-works" className="px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-slate-100" style={{ color: SLATE }}>
        How It Works
      </a>
      <button
        onClick={() => onNavigate('pricing')}
        className="px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-slate-100"
        style={{ color: SLATE }}
      >
        Pricing
      </button>
    </div>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function HeroSection({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <section style={{ background: WHITE, position: 'relative', overflow: 'hidden' }} className="pt-16 pb-20 sm:pt-24 sm:pb-28">
      {/* Subtle background gradient */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(37,99,235,0.06), transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column */}
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
              style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: BLUE }} />
              <span className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: BLUE }}>
                Decision Intelligence & Governance
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight leading-[1.1] mb-6" style={{ color: INK }}>
              Better decisions.
              <br />
              <span style={{ color: BLUE }}>Built on evidence.</span>
            </h1>

            <p className="text-base sm:text-lg leading-relaxed mb-8 max-w-xl" style={{ color: SLATE }}>
              Poddle AI helps organizations evaluate consequential decisions, challenge assumptions,
              verify supporting evidence, and preserve a clear record of how decisions are made.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <button
                onClick={() => onNavigate('auth')}
                className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg text-white font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: BLUE, boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}
              >
                Try Poddle AI
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#how-it-works"
                className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg font-semibold text-sm transition-all duration-200 hover:bg-slate-50"
                style={{ color: INK, border: `1px solid ${BORDER}` }}
              >
                See How It Works
                <ChevronDown className="w-4 h-4" />
              </a>
            </div>

            <div className="flex items-center gap-5 flex-wrap text-xs" style={{ color: SLATE_MID }}>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" style={{ color: '#16a34a' }} />
                No credit card required
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" style={{ color: '#16a34a' }} />
                Free to start
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" style={{ color: '#16a34a' }} />
                Invite your team
              </div>
            </div>
          </div>

          {/* Right column — product preview */}
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}

function HeroPreview() {
  return (
    <div className="relative" style={{ perspective: '1200px' }}>
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: WHITE,
          border: `1px solid ${BORDER}`,
          boxShadow: '0 20px 50px rgba(15,23,42,0.12), 0 8px 20px rgba(15,23,42,0.06)',
          transform: 'rotateY(-2deg) rotateX(1deg)',
          transition: 'transform 0.4s ease',
        }}
      >
        {/* Preview header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${BORDER_SOFT}`, background: BG_ALT }}>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#e2e8f0' }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#e2e8f0' }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#e2e8f0' }} />
          </div>
          <span className="text-xs font-medium" style={{ color: SLATE_LIGHT }}>
            Poddle AI — Decision Workspace (Illustrative)
          </span>
        </div>

        {/* Preview body */}
        <div className="p-5">
          {/* Decision title */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: 'rgba(37,99,235,0.08)', color: BLUE }}>
                In Review
              </span>
              <span className="text-xs" style={{ color: SLATE_LIGHT }}>Decision Owner: O. Akinbobola</span>
            </div>
            <h3 className="text-base font-bold" style={{ color: INK }}>
              Market Entry: European Expansion Strategy
            </h3>
          </div>

          {/* Evidence chips */}
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: SLATE_LIGHT }}>
              Evidence
            </p>
            <div className="space-y-2">
              {DEMO_EVIDENCE.slice(0, 3).map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: BG_ALT, border: `1px solid ${BORDER_SOFT}` }}>
                  <span className="text-xs font-mono" style={{ color: SLATE_LIGHT }}>{ev.id}</span>
                  <span className="text-xs font-medium flex-1 truncate" style={{ color: INK }}>{ev.title}</span>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded"
                    style={STATUS_COLORS[ev.status]}
                  >
                    {ev.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk summary */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: SLATE_LIGHT }}>
              Key Risks
            </p>
            <div className="flex gap-2 flex-wrap">
              {DEMO_RISKS.slice(0, 2).map((r, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: RISK_COLORS[r.level].bg }}>
                  <AlertTriangle className="w-3 h-3" style={{ color: RISK_COLORS[r.level].text }} />
                  <span className="text-xs font-medium" style={{ color: RISK_COLORS[r.level].text }}>{r.level}</span>
                  <span className="text-xs" style={{ color: SLATE }}>— {r.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating accent */}
      <div
        className="absolute -bottom-4 -right-4 w-32 h-32 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(184,134,11,0.08), transparent 70%)', pointerEvents: 'none' }}
      />
    </div>
  );
}

// ─── Problem / Value ─────────────────────────────────────────────────────────

function ProblemSection() {
  return (
    <section style={{ background: BG_ALT, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }} className="py-20 sm:py-28">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <RevealSection>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6" style={{ color: INK }}>
            Decisions are only as strong as the evidence behind them.
          </h2>
          <p className="text-base sm:text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: SLATE }}>
            Important organizational decisions often depend on fragmented information, untested assumptions,
            competing perspectives, and reasoning that becomes difficult to reconstruct after the fact.
          </p>
          <p className="text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mt-4" style={{ color: SLATE }}>
            Poddle AI brings structure to that process — so teams can evaluate decisions with clarity,
            challenge them with evidence, and preserve a record that stands up to scrutiny.
          </p>
        </RevealSection>
      </div>
    </section>
  );
}

// ─── Capabilities ────────────────────────────────────────────────────────────

function CapabilitiesSection() {
  return (
    <section id="capabilities" style={{ background: WHITE }} className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealSection>
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: BLUE }}>
              Platform
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" style={{ color: INK }}>
              One platform. Four layers of intelligence.
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: SLATE }}>
              Poddle AI connects evidence, analysis, governance, and history into a single decision workflow.
            </p>
          </div>
        </RevealSection>

        <div className="grid sm:grid-cols-2 gap-5">
          {CAPABILITIES.map((cap, i) => (
            <RevealSection key={cap.title} delay={i * 80}>
              <div
                className="h-full p-7 rounded-xl transition-all duration-300 hover:-translate-y-1"
                style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}
              >
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center mb-5"
                  style={{ background: 'rgba(37,99,235,0.06)' }}
                >
                  <cap.icon className="w-5 h-5" style={{ color: BLUE }} />
                </div>
                <h3 className="text-lg font-bold mb-3" style={{ color: INK }}>{cap.title}</h3>
                <p className="text-sm leading-relaxed mb-4" style={{ color: SLATE }}>{cap.body}</p>
                <div className="flex flex-wrap gap-2">
                  {cap.points.map((pt) => (
                    <span
                      key={pt}
                      className="text-xs font-medium px-2.5 py-1 rounded-md"
                      style={{ background: BG_ALT, color: SLATE_MID, border: `1px solid ${BORDER_SOFT}` }}
                    >
                      {pt}
                    </span>
                  ))}
                </div>
              </div>
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ────────────────────────────────────────────────────────────

function HowItWorksSection({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <section id="how-it-works" style={{ background: BG_ALT, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }} className="py-20 sm:py-28">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealSection>
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: BLUE }}>
              How Poddle Works
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" style={{ color: INK }}>
              A structured path from question to record.
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: SLATE }}>
              Every decision follows the same disciplined workflow — so nothing is lost and everything is traceable.
            </p>
          </div>
        </RevealSection>

        <div className="relative">
          {/* Vertical connector line */}
          <div
            className="hidden sm:block absolute left-[2.25rem] top-0 bottom-0 w-px"
            style={{ background: BORDER }}
          />

          {PROCESS_STEPS.map((step, i) => (
            <RevealSection key={step.num} delay={i * 100}>
              <div className="flex gap-6 mb-8 last:mb-0 relative">
                {/* Step circle */}
                <div
                  className="flex-shrink-0 w-[4.5rem] h-[4.5rem] rounded-xl flex items-center justify-center relative z-10"
                  style={{ background: WHITE, border: `2px solid ${BORDER}` }}
                >
                  <step.icon className="w-6 h-6" style={{ color: BLUE }} />
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold tracking-wider" style={{ color: SLATE_LIGHT }}>{step.num}</span>
                    <span className="text-xs font-medium" style={{ color: BLUE }}>—</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: INK }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed max-w-lg" style={{ color: SLATE }}>{step.body}</p>
                </div>
              </div>
            </RevealSection>
          ))}
        </div>

        <RevealSection delay={200}>
          <div className="text-center mt-12">
            <button
              onClick={() => onNavigate('auth')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: BLUE, boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}
            >
              Try the full workflow
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}

// ─── Product Showcase ────────────────────────────────────────────────────────

function ProductShowcaseSection() {
  return (
    <section style={{ background: WHITE }} className="py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealSection>
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: BLUE }}>
              Product Showcase
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" style={{ color: INK }}>
              A complete view of every decision.
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: SLATE }}>
              From evidence classification to ownership, risk identification to historical trails —
              all in one workspace.
            </p>
          </div>
        </RevealSection>

        <RevealSection delay={100}>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: '0 12px 40px rgba(15,23,42,0.08)' }}
          >
            {/* Dashboard header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${BORDER}`, background: BG_ALT }}>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded" style={{ background: 'rgba(37,99,235,0.08)', color: BLUE }}>
                  In Review
                </span>
                <span className="text-sm font-bold" style={{ color: INK }}>Market Entry: European Expansion</span>
              </div>
              <span className="text-xs" style={{ color: SLATE_LIGHT }}>Illustrative demo data</span>
            </div>

            <div className="grid lg:grid-cols-3 gap-0">
              {/* Left — Evidence & Risks */}
              <div className="lg:col-span-2 p-6" style={{ borderRight: `1px solid ${BORDER_SOFT}` }}>
                {/* Evidence */}
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: SLATE_LIGHT }}>
                    Evidence Classification
                  </p>
                  <div className="space-y-2">
                    {DEMO_EVIDENCE.map((ev) => (
                      <div key={ev.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: BG_ALT, border: `1px solid ${BORDER_SOFT}` }}>
                        <span className="text-xs font-mono shrink-0" style={{ color: SLATE_LIGHT }}>{ev.id}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: INK }}>{ev.title}</p>
                          <p className="text-xs" style={{ color: SLATE_LIGHT }}>{ev.type}</p>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded shrink-0" style={STATUS_COLORS[ev.status]}>
                          {ev.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risks */}
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: SLATE_LIGHT }}>
                    Risks & Unresolved Uncertainties
                  </p>
                  <div className="space-y-2">
                    {DEMO_RISKS.map((r, i) => (
                      <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg" style={{ background: RISK_COLORS[r.level].bg }}>
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: RISK_COLORS[r.level].text }} />
                        <div className="flex-1">
                          <span className="text-xs font-bold mr-2" style={{ color: RISK_COLORS[r.level].text }}>{r.level}</span>
                          <span className="text-sm" style={{ color: SLATE }}>{r.title}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Decision snapshot */}
                <div className="p-4 rounded-lg" style={{ background: 'rgba(37,99,235,0.03)', border: `1px solid rgba(37,99,235,0.1)` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4" style={{ color: BLUE }} />
                    <span className="text-sm font-bold" style={{ color: INK }}>Decision Snapshot</span>
                    <span className="text-xs ml-auto" style={{ color: SLATE_LIGHT }}>v2 — Oct 5, 2026</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: SLATE }}>
                    Proceed with phased entry into DACH market. Evidence EV-001 and EV-003 verified;
                    EV-002 remains an assumption requiring post-launch validation. High risk: regulatory timeline.
                  </p>
                </div>
              </div>

              {/* Right — Ownership & Trail */}
              <div className="p-6">
                {/* Ownership */}
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: SLATE_LIGHT }}>
                    Decision Ownership
                  </p>
                  <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: BG_ALT, border: `1px solid ${BORDER_SOFT}` }}>
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: BLUE }}
                    >
                      OA
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: INK }}>Oludotun Akinbobola</p>
                      <p className="text-xs" style={{ color: SLATE_LIGHT }}>Decision Owner</p>
                    </div>
                    <ShieldCheck className="w-4 h-4 ml-auto shrink-0" style={{ color: '#16a34a' }} />
                  </div>
                </div>

                {/* Decision Trail */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: SLATE_LIGHT }}>
                    Decision Trail
                  </p>
                  <div className="relative">
                    {DEMO_TRAIL.map((t, i) => (
                      <div key={i} className="flex gap-3 mb-3 last:mb-0 relative">
                        {i < DEMO_TRAIL.length - 1 && (
                          <div className="absolute left-[7px] top-5 bottom-0 w-px" style={{ background: BORDER }} />
                        )}
                        <div
                          className="w-[15px] h-[15px] rounded-full shrink-0 mt-0.5 border-2"
                          style={{
                            background: i === 0 ? BLUE : WHITE,
                            borderColor: i === 0 ? BLUE : BORDER,
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium" style={{ color: INK }}>{t.event}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Clock className="w-3 h-3" style={{ color: SLATE_LIGHT }} />
                            <span className="text-xs" style={{ color: SLATE_LIGHT }}>{t.time}</span>
                            <span className="text-xs" style={{ color: SLATE_LIGHT }}>· {t.actor}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}

// ─── Use Cases ───────────────────────────────────────────────────────────────

function UseCasesSection() {
  return (
    <section id="use-cases" style={{ background: BG_ALT, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }} className="py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealSection>
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: BLUE }}>
              Enterprise Use Cases
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" style={{ color: INK }}>
              For decisions where the stakes are real.
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: SLATE }}>
              Poddle AI brings structure and accountability to the decisions that shape your organization's future.
            </p>
          </div>
        </RevealSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {USE_CASES.map((uc, i) => (
            <RevealSection key={uc.title} delay={i * 60}>
              <div
                className="h-full p-6 rounded-xl transition-all duration-300 hover:-translate-y-1"
                style={{ background: WHITE, border: `1px solid ${BORDER}` }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: 'rgba(37,99,235,0.05)' }}
                >
                  <uc.icon className="w-5 h-5" style={{ color: BLUE }} />
                </div>
                <h3 className="text-base font-bold mb-2" style={{ color: INK }}>{uc.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: SLATE }}>{uc.body}</p>
              </div>
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Security & Trust ────────────────────────────────────────────────────────

function SecuritySection({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <section style={{ background: WHITE }} className="py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealSection>
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: BLUE }}>
              Security & Trust
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" style={{ color: INK }}>
              Built for decisions that matter.
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: SLATE }}>
              Access controls, evidence traceability, and historical records — designed for organizations
              that need defensible decision-making.
            </p>
          </div>
        </RevealSection>

        <div className="grid sm:grid-cols-2 gap-5 mb-12">
          {SECURITY_FEATURES.map((feat, i) => (
            <RevealSection key={feat.title} delay={i * 80}>
              <div className="flex gap-4 p-6 rounded-xl" style={{ background: BG_ALT, border: `1px solid ${BORDER_SOFT}` }}>
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(37,99,235,0.06)' }}
                >
                  <feat.icon className="w-5 h-5" style={{ color: BLUE }} />
                </div>
                <div>
                  <h3 className="text-base font-bold mb-2" style={{ color: INK }}>{feat.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: SLATE }}>{feat.body}</p>
                </div>
              </div>
            </RevealSection>
          ))}
        </div>

        <RevealSection delay={200}>
          <div className="flex items-center justify-center gap-5 flex-wrap">
            <button onClick={() => onNavigate('privacy')} className="text-sm font-medium hover:underline" style={{ color: BLUE }}>
              Privacy Policy
            </button>
            <span style={{ color: BORDER }}>·</span>
            <button onClick={() => onNavigate('terms')} className="text-sm font-medium hover:underline" style={{ color: BLUE }}>
              Terms of Service
            </button>
            <span style={{ color: BORDER }}>·</span>
            <button onClick={() => onNavigate('subprocessors')} className="text-sm font-medium hover:underline" style={{ color: BLUE }}>
              Sub-processors
            </button>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}

// ─── Final CTA ───────────────────────────────────────────────────────────────

function FinalCTA({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <section
      style={{ background: `linear-gradient(180deg, ${WHITE} 0%, ${BG_ALT} 100%)`, borderTop: `1px solid ${BORDER}` }}
      className="py-24"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <RevealSection>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-5" style={{ color: INK }}>
            Bring clarity and accountability to your next important decision.
          </h2>
          <p className="text-base leading-relaxed mb-10 max-w-lg mx-auto" style={{ color: SLATE }}>
            Start with a free workspace. Invite your team. See how evidence-based decision governance works in practice.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <button
              onClick={() => onNavigate('auth')}
              className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg text-white font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: BLUE, boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}
            >
              Try Poddle AI
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('pricing')}
              className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg font-semibold text-sm transition-all duration-200 hover:bg-slate-50"
              style={{ color: INK, border: `1px solid ${BORDER}` }}
            >
              Explore the Platform
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-5 flex-wrap text-xs" style={{ color: SLATE_MID }}>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />
              No credit card required
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />
              Free to start
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />
              Invite your team
            </div>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <footer style={{ background: INK }} className="py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <PoddleMark size={28} />
              <span className="text-lg font-black tracking-tight text-white">
                Poddle<span style={{ color: GOLD_LIGHT, fontWeight: 400 }}>AI</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: '#94a3b8' }}>
              AI-powered decision governance for organizations that need evidence-based, defensible decisions.
            </p>
          </div>

          {/* Platform */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#64748b' }}>Platform</p>
            <div className="flex flex-col gap-2.5">
              <a href="#capabilities" className="text-sm transition-colors hover:text-white" style={{ color: '#94a3b8' }}>Capabilities</a>
              <a href="#how-it-works" className="text-sm transition-colors hover:text-white" style={{ color: '#94a3b8' }}>How It Works</a>
              <button onClick={() => onNavigate('pricing')} className="text-sm transition-colors hover:text-white text-left" style={{ color: '#94a3b8' }}>Pricing</button>
            </div>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#64748b' }}>Company</p>
            <div className="flex flex-col gap-2.5">
              <button onClick={() => onNavigate('team')} className="text-sm transition-colors hover:text-white text-left" style={{ color: '#94a3b8' }}>Team</button>
              <button onClick={() => onNavigate('about')} className="text-sm transition-colors hover:text-white text-left" style={{ color: '#94a3b8' }}>About</button>
              <button onClick={() => onNavigate('advisory')} className="text-sm transition-colors hover:text-white text-left" style={{ color: '#94a3b8' }}>Advisory</button>
              <button onClick={() => onNavigate('blog')} className="text-sm transition-colors hover:text-white text-left" style={{ color: '#94a3b8' }}>Blog</button>
            </div>
          </div>

          {/* Legal */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#64748b' }}>Legal</p>
            <div className="flex flex-col gap-2.5">
              <button onClick={() => onNavigate('privacy')} className="text-sm transition-colors hover:text-white text-left" style={{ color: '#94a3b8' }}>Privacy Policy</button>
              <button onClick={() => onNavigate('terms')} className="text-sm transition-colors hover:text-white text-left" style={{ color: '#94a3b8' }}>Terms of Service</button>
              <button onClick={() => onNavigate('subprocessors')} className="text-sm transition-colors hover:text-white text-left" style={{ color: '#94a3b8' }}>Sub-processors</button>
              <button onClick={() => onNavigate('slack')} className="text-sm transition-colors hover:text-white text-left" style={{ color: '#94a3b8' }}>Slack Integration</button>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <span className="text-xs" style={{ color: '#64748b' }}>&copy; 2026 Poddle, Inc.</span>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#64748b' }}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy-conscious data processing</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function GuestHome({ onNavigate }: GuestHomeProps) {
  return (
    <div className="min-h-screen" style={{ background: WHITE }}>
      {/* Top navigation bar (visible above the existing Navigation top bar on md+) */}
      <div
        className="hidden md:flex items-center justify-between px-6 py-3 sticky top-0 z-30"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <PoddleMark size={24} />
            <span className="text-base font-black tracking-tight" style={{ color: INK }}>
              Poddle<span style={{ color: GOLD, fontWeight: 400 }}>AI</span>
            </span>
          </div>
          <HeaderNav onNavigate={onNavigate} />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('auth')}
            className="text-sm font-medium transition-colors hover:opacity-70"
            style={{ color: INK }}
          >
            Sign In
          </button>
          <button
            onClick={() => onNavigate('auth')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
            style={{ background: BLUE, boxShadow: '0 2px 8px rgba(37,99,235,0.2)' }}
          >
            Try Poddle AI
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <HeroSection onNavigate={onNavigate} />
      <ProblemSection />
      <CapabilitiesSection />
      <HowItWorksSection onNavigate={onNavigate} />
      <ProductShowcaseSection />
      <UseCasesSection />
      <SecuritySection onNavigate={onNavigate} />
      <FinalCTA onNavigate={onNavigate} />
      <Footer onNavigate={onNavigate} />
    </div>
  );
}

// ─── Team Section (used by Team page) ────────────────────────────────────────

export function TeamSection() {
  const members = [
    {
      name: 'Oludotun Akinbobola',
      role: 'Founder, Poddle AI',
      photo: '/images/team/headshot2.png',
      bio: `Oludotun Akinbobola is a technology entrepreneur, product leader, and digital transformation professional focused on building intelligent systems that improve how organizations make decisions, manage uncertainty, and navigate complex challenges.\n\nHe is the Founder of Poddle AI, an AI-powered decision governance platform designed to help organizations evaluate consequential decisions, distinguish verified facts from assumptions, identify risks and conflicting evidence, and maintain transparent, traceable records of their decision-making processes. By combining multi-agent intelligence, evidence verification, and decision accountability, Poddle AI aims to make organizational decisions more rigorous, defensible, and auditable.\n\nWith eight years of experience spanning technology, Agile delivery, product development, and digital transformation, Oludotun has worked across aviation software, insurance, and digital technology. He also develops technology-driven solutions addressing broader organizational and societal challenges.\n\nOludotun holds a master's degree from TU Bergakademie Freiberg and has completed executive education programmes at London Business School, MIT Sloan School of Management, and Cambridge Judge Business School. He previously co-founded Teamplana, a SaaS project management platform.\n\nHis work reflects a broader commitment to applying emerging technologies to strengthen institutional decision-making, organizational effectiveness, and digital transformation.`,
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
