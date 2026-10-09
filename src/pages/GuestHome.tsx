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
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  Building2,
  Scale,
  Briefcase,
  Handshake,
  Network,
  Eye,
  ChevronDown,
  MessageSquare,
  GitBranch,
  Camera,
  Target,
  UserCog,
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
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

// Product-accurate colors from the actual app
const C = {
  green: '#16a34a',
  greenBg: 'rgba(22,163,74,0.10)',
  amber: '#d97706',
  amberBg: 'rgba(217,119,6,0.10)',
  red: '#dc2626',
  redBg: 'rgba(220,38,38,0.10)',
  blue: '#2563eb',
  blueBg: 'rgba(37,99,235,0.10)',
  purple: '#7c3aed',
  purpleBg: 'rgba(124,58,237,0.10)',
  cyan: '#0891b2',
  cyanBg: 'rgba(8,145,178,0.10)',
  slate: '#64748b',
  slateBg: 'rgba(100,116,139,0.10)',
};

// ─── Scroll reveal ───────────────────────────────────────────────────────────
function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function RevealSection({ children, className, delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number;
}) {
  const { ref, visible } = useScrollReveal();
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: 'opacity 0.65s ease, transform 0.65s ease',
      transitionDelay: `${delay}ms`,
    }}>
      {children}
    </div>
  );
}

// ─── Demo data (illustrative, not real customer data) ────────────────────────

type TabKey = 'overview' | 'evidence' | 'trail';

interface DemoEvidence {
  code: string;
  statement: string;
  classification: 'verified_fact' | 'reported_fact' | 'assumption' | 'ai_inference' | 'unverified_claim';
  verification: 'verified' | 'pending' | 'not_verified' | 'failed';
  source: string;
  confidence: number;
  agent: string;
  freshness: 'current' | 'aging' | 'stale';
  verifiedDays: number;
}

const CLASSIFICATION_LABELS: Record<string, { label: string; color: string }> = {
  verified_fact: { label: 'Verified Fact', color: C.green },
  reported_fact: { label: 'Reported Fact', color: C.cyan },
  assumption: { label: 'Assumption', color: C.amber },
  ai_inference: { label: 'AI Inference', color: C.blue },
  unverified_claim: { label: 'Unverified Claim', color: C.red },
};

const VERIFICATION_LABELS: Record<string, { label: string; color: string }> = {
  verified: { label: 'Human Verified', color: C.green },
  pending: { label: 'Verification Pending', color: C.amber },
  not_verified: { label: 'Not Verified', color: C.slate },
  failed: { label: 'Verification Failed', color: C.red },
};

const FRESHNESS_MAP: Record<string, { label: string; color: string }> = {
  current: { label: 'Current', color: C.green },
  aging: { label: 'Aging', color: C.amber },
  stale: { label: 'Stale', color: C.red },
};

const DEMO_EVIDENCE: DemoEvidence[] = [
  { code: 'EVD-001', statement: 'Q3 revenue grew 18% YoY in target market segment', classification: 'verified_fact', verification: 'verified', source: 'Q3 Financial Report · Internal', confidence: 92, agent: 'Financial Strategist', freshness: 'current', verifiedDays: 4 },
  { code: 'EVD-002', statement: 'Competitor X holds 34% market share with aggressive pricing', classification: 'reported_fact', verification: 'verified', source: 'Market Research · External', confidence: 78, agent: 'Market Analyst', freshness: 'current', verifiedDays: 2 },
  { code: 'EVD-003', statement: 'Customer retention will remain above 85% post-expansion', classification: 'assumption', verification: 'pending', source: 'Internal Estimate · Assumption', confidence: 45, agent: 'Risk Analyst', freshness: 'aging', verifiedDays: 38 },
  { code: 'EVD-004', statement: 'Regulatory approval expected within 90 days of filing', classification: 'unverified_claim', verification: 'not_verified', source: 'External Source · Unverified', confidence: 30, agent: 'Execution Lead', freshness: 'stale', verifiedDays: 92 },
  { code: 'EVD-005', statement: 'DACH region shows 23% higher willingness-to-pay vs. baseline', classification: 'ai_inference', verification: 'pending', source: 'AI Analysis · Inference', confidence: 67, agent: 'Market Analyst', freshness: 'current', verifiedDays: 6 },
];

interface DemoAgent {
  role: string;
  icon: LucideIcon;
  position: string;
  confidence: number;
  risks: string[];
}

const DEMO_AGENTS: DemoAgent[] = [
  { role: 'Risk Analyst', icon: AlertTriangle, position: 'Cautious — regulatory timeline is the critical-path risk.', confidence: 72, risks: ['Regulatory delay > 90 days', 'Currency exposure on DACH revenue'] },
  { role: 'Financial Strategist', icon: TrendingUp, position: 'Supportive — phased entry minimizes capital-at-risk.', confidence: 81, risks: ['CAC may exceed projected €340 in early quarters'] },
  { role: 'Devil\'s Advocate', icon: GitBranch, position: 'Skeptical — retention assumption (EVD-003) lacks supporting evidence.', confidence: 38, risks: ['Retention assumption is unvalidated', 'Competitor response not modeled'] },
  { role: 'Market Analyst', icon: Target, position: 'Optimistic — DACH willingness-to-pay signals strong demand.', confidence: 74, risks: ['WTP data from limited sample (n=120)'] },
];

interface DemoTrailEvent {
  type: 'decision_created' | 'evidence_added' | 'agent_analysis' | 'challenge_raised' | 'evidence_verified' | 'snapshot_created' | 'evidence_revised';
  label: string;
  actor: string;
  time: string;
  claim?: string;
}

const TRAIL_META: Record<string, { icon: LucideIcon; color: string }> = {
  decision_created: { icon: FileText, color: C.slate },
  evidence_added: { icon: MessageSquare, color: C.cyan },
  agent_analysis: { icon: Brain, color: C.blue },
  challenge_raised: { icon: GitBranch, color: C.amber },
  evidence_verified: { icon: ShieldCheck, color: C.green },
  snapshot_created: { icon: Camera, color: C.cyan },
  evidence_revised: { icon: History, color: C.purple },
};

const DEMO_TRAIL: DemoTrailEvent[] = [
  { type: 'decision_created', label: 'Decision Created', actor: 'O. Akinbobola', time: 'Oct 1, 09:14' },
  { type: 'evidence_added', label: 'Evidence Added', actor: 'O. Akinbobola', time: 'Oct 1, 10:32', claim: 'EVD-001' },
  { type: 'evidence_verified', label: 'Evidence Verified', actor: 'O. Akinbobola', time: 'Oct 2, 08:45', claim: 'EVD-001' },
  { type: 'agent_analysis', label: 'Agent Analysis', actor: 'Risk Analyst', time: 'Oct 2, 14:20', claim: 'EVD-004' },
  { type: 'challenge_raised', label: 'Challenge Raised', actor: "Devil's Advocate", time: 'Oct 3, 11:15', claim: 'EVD-003' },
  { type: 'evidence_revised', label: 'Evidence Revised', actor: 'Market Analyst', time: 'Oct 3, 16:08', claim: 'EVD-005' },
  { type: 'agent_analysis', label: 'Agent Analysis', actor: 'Financial Strategist', time: 'Oct 4, 09:30', claim: 'EVD-001' },
  { type: 'snapshot_created', label: 'Snapshot Created', actor: 'System', time: 'Oct 4, 16:45' },
  { type: 'evidence_verified', label: 'Evidence Verified', actor: 'O. Akinbobola', time: 'Oct 5, 10:00', claim: 'EVD-002' },
];

const CAPABILITIES: { icon: LucideIcon; title: string; body: string; points: string[] }[] = [
  { icon: Brain, title: 'Decision Intelligence', body: 'Analyze trade-offs, risks, and competing perspectives using specialized AI agents that examine decisions from multiple angles.', points: ['Multi-agent analysis', 'Risk identification', 'Trade-off evaluation'] },
  { icon: Eye, title: 'Evidence Intelligence', body: 'Classify evidence, document provenance, and distinguish verified information from assumptions. Surface uncertainty before it becomes costly.', points: ['Evidence classification', 'Provenance tracking', 'Assumption detection'] },
  { icon: Shield, title: 'Decision Governance', body: 'Assign ownership, document approvals, and preserve accountability so every decision is defensible and auditable.', points: ['Ownership assignment', 'Approval workflows', 'Accountability records'] },
  { icon: History, title: 'Decision History', body: 'Maintain evidence revisions, decision trails, and historical snapshots that let you reconstruct how any decision was made.', points: ['Evidence versioning', 'Decision trails', 'Point-in-time snapshots'] },
];

const PROCESS_STEPS: { num: string; icon: LucideIcon; title: string; body: string }[] = [
  { num: '01', icon: FileText, title: 'Define the Decision', body: 'Capture the question, objectives, context, and ownership. Invite the right people into a shared workspace.' },
  { num: '02', icon: Eye, title: 'Evaluate the Evidence', body: 'Distinguish verified information from assumptions, examine sources, and identify uncertainty with evidence classification.' },
  { num: '03', icon: Brain, title: 'Analyze the Options', body: 'Use specialized AI perspectives to evaluate risks, trade-offs, and competing considerations across the decision.' },
  { num: '04', icon: ShieldCheck, title: 'Preserve the Reasoning', body: 'Record evidence changes, decisions, approvals, and historical snapshots that preserve the full context for future review.' },
];

const USE_CASES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: TrendingUp, title: 'Strategic Investments', body: 'Evaluate capital allocation decisions with structured evidence assessment and risk analysis before committing resources.' },
  { icon: Building2, title: 'Market Entry', body: 'Assess new market opportunities by assembling evidence, testing assumptions, and documenting the reasoning behind go or no-go.' },
  { icon: Briefcase, title: 'Mergers & Acquisitions', body: 'Structure due diligence with classified evidence, identified risks, and a clear record of what was known and what was assumed.' },
  { icon: Network, title: 'Technology Investments', body: 'Evaluate technology adoption decisions with trade-off analysis, competing perspectives, and a documented evaluation trail.' },
  { icon: Scale, title: 'Organizational Restructuring', body: 'Approve structural changes with documented evidence, stakeholder input, and a defensible record of how the decision was reached.' },
  { icon: Handshake, title: 'Strategic Partnerships', body: 'Assess partnership proposals with evidence-based analysis, risk identification, and a clear ownership trail for accountability.' },
];

const SECURITY_FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Lock, title: 'Workspace Access Controls', body: 'Decisions live in private workspaces with role-based access. Only invited members can view, contribute to, or manage a decision.' },
  { icon: FileText, title: 'Evidence Traceability', body: 'Every piece of evidence carries a unique identifier and provenance record, so you can trace any claim back to its source.' },
  { icon: History, title: 'Historical Records', body: 'Decision trails and evidence revisions are preserved over time, creating an immutable record of how decisions evolved.' },
  { icon: ShieldCheck, title: 'Privacy-Conscious Processing', body: 'Workspace data is processed with attention to privacy. Your decision content is not used for public model training.' },
];

// ─── Pill component ──────────────────────────────────────────────────────────
function Pill({ label, color, mono }: { label: string; color: string; mono?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: '10px',
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: '4px',
        color,
        background: `${color}1a`,
        fontFamily: mono ? MONO : undefined,
        letterSpacing: mono ? 0 : '0.04em',
        whiteSpace: 'nowrap' as const,
      }}
    >
      {label}
    </span>
  );
}

// ─── Product Preview (the centerpiece) ───────────────────────────────────────

function ProductPreview() {
  const [tab, setTab] = useState<TabKey>('overview');

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: WHITE,
        border: `1px solid ${BORDER}`,
        boxShadow: '0 20px 56px rgba(15,23,42,0.12), 0 4px 16px rgba(15,23,42,0.04)',
      }}
    >
      {/* App frame top bar */}
      <div className="flex items-center gap-3 px-3 sm:px-4 py-2" style={{ borderBottom: `1px solid ${BORDER}`, background: BG_ALT }}>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#e2e8f0' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#e2e8f0' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#e2e8f0' }} />
        </div>
        <div className="flex items-center gap-2 ml-1 sm:ml-2">
          <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-black" style={{ background: INK, color: WHITE }}>M</div>
          <span className="text-xs font-semibold truncate" style={{ color: INK }}>Market Entry: DACH Expansion</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: C.blueBg, color: C.blue }}>IN DEBATE</span>
        </div>
        <span className="ml-auto text-[10px] hidden lg:block" style={{ color: SLATE_LIGHT }}>Illustrative demo data</span>
      </div>

      {/* Body — sidebar + main */}
      <div className="flex" style={{ minHeight: '440px' }}>
        {/* Sidebar */}
        <div className="hidden md:flex flex-col gap-0.5 p-2.5 shrink-0" style={{ width: '184px', borderRight: `1px solid ${BORDER_SOFT}`, background: BG_ALT }}>
          <p className="text-[10px] font-bold uppercase mb-1.5 px-2" style={{ color: SLATE_LIGHT, letterSpacing: '0.08em' }}>Workspace</p>
          {[
            { label: 'Team Chat', icon: MessageSquare },
            { label: 'War Room', icon: Brain, active: true },
            { label: 'Decision Map', icon: Target },
            { label: 'Decision Trail', icon: History },
            { label: 'Ownership', icon: UserCog },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors" style={{ color: item.active ? INK : SLATE, background: item.active ? WHITE : 'transparent', fontWeight: item.active ? 600 : 400, border: item.active ? `1px solid ${BORDER_SOFT}` : '1px solid transparent' }}>
              <item.icon className="w-3.5 h-3.5 shrink-0" style={{ color: item.active ? BLUE : SLATE_LIGHT }} />
              {item.label}
            </div>
          ))}

          <div className="mt-3 pt-2.5" style={{ borderTop: `1px solid ${BORDER_SOFT}` }}>
            <p className="text-[10px] font-bold uppercase mb-1.5 px-2" style={{ color: SLATE_LIGHT, letterSpacing: '0.08em' }}>Agents</p>
            {DEMO_AGENTS.slice(0, 4).map((a) => (
              <div key={a.role} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs" style={{ color: SLATE }}>
                <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: C.blueBg }}>
                  <a.icon className="w-3 h-3" style={{ color: C.blue }} />
                </div>
                <span className="truncate">{a.role}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1 min-w-0">
          {/* Tab bar */}
          <div className="flex items-center gap-0.5 px-3 sm:px-4 py-1.5" style={{ borderBottom: `1px solid ${BORDER_SOFT}` }}>
            {([
              { key: 'overview' as TabKey, label: 'Decision Overview' },
              { key: 'evidence' as TabKey, label: 'Evidence Intelligence' },
              { key: 'trail' as TabKey, label: 'Decision Trail' },
            ]).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200"
                style={{
                  background: tab === t.key ? C.blueBg : 'transparent',
                  color: tab === t.key ? C.blue : SLATE_MID,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: tab === t.key ? 'inset 0 -2px 0 0 ' + C.blue : 'none',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-3 sm:p-4" style={{ minHeight: '360px' }}>
            {tab === 'overview' && <OverviewTab />}
            {tab === 'evidence' && <EvidenceTab />}
            {tab === 'trail' && <TrailTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Overview tab ────────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div style={{ animation: 'tabFade 0.3s ease' }}>
      <div className="grid lg:grid-cols-2 gap-3">
        {/* Decision context */}
        <div className="p-3.5 rounded-lg" style={{ background: BG_ALT, border: `1px solid ${BORDER_SOFT}` }}>
          <p className="text-[10px] font-bold uppercase mb-1.5" style={{ color: SLATE_LIGHT, letterSpacing: '0.08em' }}>Decision</p>
          <h3 className="text-sm font-bold leading-snug mb-2.5" style={{ color: INK }}>Should we enter the DACH market in Q1 2026?</h3>
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <Pill label="Strategic" color={C.slate} />
            <Pill label="In Debate" color={C.blue} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: SLATE_MID }}>Decision Owner</span>
              <span className="font-medium" style={{ color: INK }}>O. Akinbobola</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: SLATE_MID }}>Health Score</span>
              <span className="font-bold" style={{ color: C.amber }}>Developing · 62</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: SLATE_MID }}>Evidence Items</span>
              <span className="font-medium" style={{ color: INK }}>5 ({DEMO_EVIDENCE.filter(e => e.verification === 'verified').length} verified)</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: SLATE_MID }}>Open Challenges</span>
              <span className="font-medium" style={{ color: C.amber }}>1 active</span>
            </div>
          </div>
        </div>

        {/* Health score visual */}
        <div className="p-3.5 rounded-lg" style={{ background: BG_ALT, border: `1px solid ${BORDER_SOFT}` }}>
          <p className="text-[10px] font-bold uppercase mb-2.5" style={{ color: SLATE_LIGHT, letterSpacing: '0.08em' }}>Decision Health</p>
          <div className="flex items-center gap-4">
            <ScoreRing score={62} label="Developing" color={C.amber} />
            <div className="flex-1 space-y-2">
              <ScoreBar label="Financial" score={71} color={C.green} />
              <ScoreBar label="Operational" score={58} color={C.amber} />
              <ScoreBar label="Alignment" score={55} color={C.amber} />
            </div>
          </div>
        </div>
      </div>

      {/* Agent analysis preview */}
      <div className="mt-3">
        <p className="text-[10px] font-bold uppercase mb-2.5" style={{ color: SLATE_LIGHT, letterSpacing: '0.08em' }}>Specialized AI Agents</p>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {DEMO_AGENTS.map((agent) => (
            <div key={agent.role} className="p-3 rounded-lg" style={{ background: WHITE, border: `1px solid ${BORDER_SOFT}` }}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: C.blueBg }}>
                  <agent.icon className="w-3.5 h-3.5" style={{ color: C.blue }} />
                </div>
                <span className="text-xs font-bold" style={{ color: INK }}>{agent.role}</span>
                <span className="ml-auto text-[10px] font-bold" style={{ color: agent.confidence >= 70 ? C.green : agent.confidence >= 50 ? C.amber : C.red }}>
                  {agent.confidence}% conf.
                </span>
              </div>
              <p className="text-xs leading-relaxed mb-1.5" style={{ color: SLATE }}>{agent.position}</p>
              {agent.risks.length > 0 && (
                <div className="flex flex-col gap-1">
                  {agent.risks.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px]" style={{ color: SLATE_MID }}>
                      <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: C.amber }} />
                      {r}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const circumference = 2 * Math.PI * 26;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative shrink-0" style={{ width: '64px', height: '64px' }}>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="none" stroke={BORDER} strokeWidth="4" />
        <circle
          cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold leading-none" style={{ color: INK }}>{score}</span>
        <span className="text-[8px] font-bold uppercase mt-0.5" style={{ color: SLATE_LIGHT }}>{label}</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium" style={{ color: SLATE_MID }}>{label}</span>
        <span className="text-[11px] font-bold" style={{ color: INK }}>{score}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

// ─── Evidence tab ────────────────────────────────────────────────────────────

function EvidenceTab() {
  return (
    <div style={{ animation: 'tabFade 0.3s ease' }}>
      {/* Stale warning */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2.5 text-xs" style={{ background: C.redBg, color: C.red }}>
        <span>🔴</span>
        This decision relies on 1 piece of stale evidence — worth re-verifying before committing.
      </div>

      {/* Evidence list */}
      <div className="space-y-2">
        {DEMO_EVIDENCE.map((ev) => {
          const cls = CLASSIFICATION_LABELS[ev.classification];
          const ver = VERIFICATION_LABELS[ev.verification];
          const fresh = FRESHNESS_MAP[ev.freshness];
          const emoji = ev.freshness === 'current' ? '🟢' : ev.freshness === 'aging' ? '🟡' : '🔴';

          return (
            <div
              key={ev.code}
              className="flex items-start gap-2.5 p-2.5 rounded-lg"
              style={{
                background: WHITE,
                border: `1px solid ${BORDER_SOFT}`,
                borderLeft: `3px solid ${cls.color}`,
              }}
            >
              {/* Claim code */}
              <div className="shrink-0 pt-0.5">
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
                  style={{ fontFamily: MONO, background: `${cls.color}1a`, color: cls.color }}
                >
                  {ev.code}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-relaxed mb-1.5" style={{ color: INK }}>{ev.statement}</p>
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <Pill label={cls.label} color={cls.color} />
                  <Pill label={ver.label} color={ver.color} />
                  <span className="text-[10px]" style={{ color: SLATE_LIGHT }}>
                    {ev.agent} · {ev.confidence}%
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]" style={{ color: SLATE_LIGHT }}>
                  <span>{ev.source}</span>
                  <span style={{ color: fresh.color }}>{emoji} {fresh.label} · {ev.verifiedDays}d ago</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Trail tab ───────────────────────────────────────────────────────────────

function TrailTab() {
  return (
    <div style={{ animation: 'tabFade 0.3s ease' }}>
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[10px] font-bold uppercase" style={{ color: SLATE_LIGHT, letterSpacing: '0.08em' }}>Audit Trail ({DEMO_TRAIL.length})</p>
        <span className="text-[10px]" style={{ color: SLATE_LIGHT }}>Point-in-time · Snapshot · Export</span>
      </div>

      <div className="relative">
        {DEMO_TRAIL.map((evt, i) => {
          const meta = TRAIL_META[evt.type];
          const isLast = i === DEMO_TRAIL.length - 1;

          return (
            <div key={i} className="flex gap-2.5 mb-2 last:mb-0 relative">
              {!isLast && (
                <div className="absolute left-[12px] top-7 bottom-0 w-px" style={{ background: BORDER }} />
              )}
              <div
                className="w-[25px] h-[25px] rounded-full flex items-center justify-center shrink-0 relative z-10"
                style={{ background: `${meta.color}18` }}
              >
                <meta.icon className="w-3 h-3" style={{ color: meta.color }} />
              </div>
              <div
                className="flex-1 p-2 rounded-lg"
                style={{ background: BG_ALT, border: `1px solid ${BORDER_SOFT}` }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: meta.color }}>{evt.label}</span>
                  <span className="text-[10px] ml-auto" style={{ fontFamily: MONO, color: SLATE_LIGHT }}>{evt.time}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] mt-0.5" style={{ color: SLATE_MID }}>
                  <span>by {evt.actor}</span>
                  {evt.claim && (
                    <span
                      className="inline-block px-1.5 py-0.5 rounded font-bold"
                      style={{ fontFamily: MONO, background: `${meta.color}1a`, color: meta.color }}
                    >
                      {evt.claim}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function HeroSection({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <section style={{ background: WHITE, position: 'relative', overflow: 'hidden' }} className="pt-8 pb-12 sm:pt-12 sm:pb-16">
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(37,99,235,0.05), transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Headline + CTAs */}
        <div className="text-center max-w-3xl mx-auto mb-6">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
            style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: BLUE }} />
            <span className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: BLUE }}>
              Decision Intelligence & Governance
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] mb-3" style={{ color: INK }}>
            Better decisions.
            <br />
            <span style={{ color: BLUE }}>Built on evidence.</span>
          </h1>

          <p className="text-sm sm:text-base leading-relaxed mb-5 max-w-2xl mx-auto" style={{ color: SLATE }}>
            Poddle AI brings evidence, intelligence, and accountability together — helping organizations
            evaluate consequential decisions and maintain a clear record of how and why they were made.
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5 justify-center mb-4">
            <button
              onClick={() => onNavigate('auth')}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-white font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: BLUE, boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}
            >
              Try Poddle AI
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#workflow"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 hover:bg-slate-50"
              style={{ color: INK, border: `1px solid ${BORDER}` }}
            >
              Explore the Platform
              <ChevronDown className="w-4 h-4" />
            </a>
          </div>

          <div className="flex items-center justify-center gap-4 sm:gap-5 flex-wrap text-xs" style={{ color: SLATE_MID }}>
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
        </div>

        {/* Product preview — the centerpiece */}
        <ProductPreview />
      </div>
    </section>
  );
}

// ─── Workflow section ────────────────────────────────────────────────────────

function WorkflowSection({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <section id="workflow" style={{ background: BG_ALT, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }} className="py-20 sm:py-28">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealSection>
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: BLUE }}>
              How It Works
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" style={{ color: INK }}>
              From evidence to accountable decisions.
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: SLATE }}>
              Every decision follows a structured workflow that connects evidence, analysis, governance, and history.
            </p>
          </div>
        </RevealSection>

        <div className="relative">
          <div className="hidden sm:block absolute left-[2.25rem] top-0 bottom-0 w-px" style={{ background: BORDER }} />
          {PROCESS_STEPS.map((step, i) => (
            <RevealSection key={step.num} delay={i * 100}>
              <div className="flex gap-6 mb-8 last:mb-0 relative">
                <div className="flex-shrink-0 w-[4.5rem] h-[4.5rem] rounded-xl flex items-center justify-center relative z-10" style={{ background: WHITE, border: `2px solid ${BORDER}` }}>
                  <step.icon className="w-6 h-6" style={{ color: BLUE }} />
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold tracking-wider" style={{ color: SLATE_LIGHT }}>{step.num}</span>
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
              One platform. Four connected pillars.
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: SLATE }}>
              Poddle AI connects evidence, intelligence, governance, and history into a single decision governance system.
            </p>
          </div>
        </RevealSection>

        <div className="grid sm:grid-cols-2 gap-5">
          {CAPABILITIES.map((cap, i) => (
            <RevealSection key={cap.title} delay={i * 80}>
              <div className="h-full p-7 rounded-xl transition-all duration-300 hover:-translate-y-1" style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
                <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-5" style={{ background: C.blueBg }}>
                  <cap.icon className="w-5 h-5" style={{ color: BLUE }} />
                </div>
                <h3 className="text-lg font-bold mb-3" style={{ color: INK }}>{cap.title}</h3>
                <p className="text-sm leading-relaxed mb-4" style={{ color: SLATE }}>{cap.body}</p>
                <div className="flex flex-wrap gap-2">
                  {cap.points.map((pt) => (
                    <span key={pt} className="text-xs font-medium px-2.5 py-1 rounded-md" style={{ background: BG_ALT, color: SLATE_MID, border: `1px solid ${BORDER_SOFT}` }}>
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

// ─── Use cases ───────────────────────────────────────────────────────────────

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

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {USE_CASES.map((uc, i) => (
            <RevealSection key={uc.title} delay={i * 60}>
              <div className="h-full p-6 rounded-xl transition-all duration-300 hover:-translate-y-1" style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: C.blueBg }}>
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

// ─── Security ────────────────────────────────────────────────────────────────

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

        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {SECURITY_FEATURES.map((feat, i) => (
            <RevealSection key={feat.title} delay={i * 80}>
              <div className="flex gap-4 p-5 rounded-xl" style={{ background: BG_ALT, border: `1px solid ${BORDER_SOFT}` }}>
                <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: C.blueBg }}>
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
            <button onClick={() => onNavigate('privacy')} className="text-sm font-medium hover:underline" style={{ color: BLUE }}>Privacy Policy</button>
            <span style={{ color: BORDER }}>·</span>
            <button onClick={() => onNavigate('terms')} className="text-sm font-medium hover:underline" style={{ color: BLUE }}>Terms of Service</button>
            <span style={{ color: BORDER }}>·</span>
            <button onClick={() => onNavigate('subprocessors')} className="text-sm font-medium hover:underline" style={{ color: BLUE }}>Sub-processors</button>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}

// ─── Final CTA ───────────────────────────────────────────────────────────────

function FinalCTA({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <section style={{ background: `linear-gradient(180deg, ${WHITE} 0%, ${BG_ALT} 100%)`, borderTop: `1px solid ${BORDER}` }} className="py-24">
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
            <div className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />No credit card required</div>
            <div className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />Free to start</div>
            <div className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />Invite your team</div>
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
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <PoddleMark size={28} />
              <span className="text-lg font-black tracking-tight text-white">Poddle<span style={{ color: GOLD_LIGHT, fontWeight: 400 }}>AI</span></span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: '#94a3b8' }}>
              AI-powered decision governance for organizations that need evidence-based, defensible decisions.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#64748b' }}>Platform</p>
            <div className="flex flex-col gap-2.5">
              <a href="#capabilities" className="text-sm transition-colors hover:text-white" style={{ color: '#94a3b8' }}>Capabilities</a>
              <a href="#workflow" className="text-sm transition-colors hover:text-white" style={{ color: '#94a3b8' }}>How It Works</a>
              <button onClick={() => onNavigate('pricing')} className="text-sm transition-colors hover:text-white text-left" style={{ color: '#94a3b8' }}>Pricing</button>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#64748b' }}>Company</p>
            <div className="flex flex-col gap-2.5">
              <button onClick={() => onNavigate('team')} className="text-sm transition-colors hover:text-white text-left" style={{ color: '#94a3b8' }}>Team</button>
              <button onClick={() => onNavigate('about')} className="text-sm transition-colors hover:text-white text-left" style={{ color: '#94a3b8' }}>About</button>
              <button onClick={() => onNavigate('advisory')} className="text-sm transition-colors hover:text-white text-left" style={{ color: '#94a3b8' }}>Advisory</button>
              <button onClick={() => onNavigate('blog')} className="text-sm transition-colors hover:text-white text-left" style={{ color: '#94a3b8' }}>Blog</button>
            </div>
          </div>
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

// ─── Main component ──────────────────────────────────────────────────────────

export default function GuestHome({ onNavigate }: GuestHomeProps) {
  return (
    <div className="min-h-screen" style={{ background: WHITE }}>
      {/* Sticky header */}
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
            <span className="text-base font-black tracking-tight" style={{ color: INK }}>Poddle<span style={{ color: GOLD, fontWeight: 400 }}>AI</span></span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            <a href="#capabilities" className="px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-slate-100" style={{ color: SLATE }}>Platform</a>
            <a href="#use-cases" className="px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-slate-100" style={{ color: SLATE }}>Solutions</a>
            <a href="#workflow" className="px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-slate-100" style={{ color: SLATE }}>How It Works</a>
            <button onClick={() => onNavigate('pricing')} className="px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-slate-100" style={{ color: SLATE }}>Pricing</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('auth')} className="text-sm font-medium transition-colors hover:opacity-70" style={{ color: INK }}>Sign In</button>
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
      <WorkflowSection onNavigate={onNavigate} />
      <CapabilitiesSection />
      <UseCasesSection />
      <SecuritySection onNavigate={onNavigate} />
      <FinalCTA onNavigate={onNavigate} />
      <Footer onNavigate={onNavigate} />

      {/* Tab fade animation */}
      <style>{`
        @keyframes tabFade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
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
                    <img src={m.photo} alt={m.name} className="w-full h-full object-cover" />
                  </div>
                  <h3 className="text-lg font-bold mb-1 text-center sm:text-left" style={{ color: '#0f172a' }}>{m.name}</h3>
                  <p className="text-sm font-medium text-center sm:text-left" style={{ color: '#b8860b' }}>{m.role}</p>
                </div>
                <div className="flex-1 sm:border-l sm:pl-8 sm:border-slate-200">
                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#475569' }}>{m.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </RevealSection>
      </div>
    </section>
  );
}
