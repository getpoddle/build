import { useEffect, useState, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { supabase } from '../lib/supabase';
import {
  Activity, Cpu, Database, Shield, Bot, Gauge, FileCheck, AlertTriangle,
  CheckCircle2, Clock, ArrowUpRight, Layers, Sparkles, Lock, RefreshCw, Bug
} from 'lucide-react';

interface Stack {
  client: string;
  server: string;
  database: string;
  auth: string;
  storage: string;
  realtime: string;
  ai: string;
}

interface Counts {
  pages: number;
  components: number;
  edge_functions: number;
  database_tables: number;
  migrations: number;
  ai_specific_tables: number;
}

interface Architecture {
  stack: Stack;
  counts: Counts;
  scale_optimizations: string[];
}

interface ErrorHandling {
  error_boundary: string;
  user_feedback: string;
  server_side: string;
  database_safeguards: string[];
  graceful_degradation: string[];
}

interface Governance {
  autonomous_behaviours: string[];
  human_oversight: string[];
  ai_on_ai_bounding: string[];
  audit_trail: string[];
  fixed_failure_modes: string[];
}

interface ReportSections {
  architecture: Architecture;
  error_handling: ErrorHandling;
  agentic_governance: Governance;
}

interface Report {
  id: string;
  generated_at: string;
  generator: string;
  overall_grade: string;
  summary: string;
  sections: ReportSections;
}

const GRADE_STYLES: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  A: { bg: '#ecfdf5', text: '#047857', ring: 'rgba(16,185,129,0.25)', label: 'Production ready' },
  B: { bg: '#eff6ff', text: '#1d4ed8', ring: 'rgba(59,130,246,0.25)', label: 'Strong, minor gaps' },
  C: { bg: '#fffbeb', text: '#b45309', ring: 'rgba(245,158,11,0.25)', label: 'Needs attention' },
  D: { bg: '#fff7ed', text: '#c2410c', ring: 'rgba(249,115,22,0.25)', label: 'Remediation required' },
  F: { bg: '#fef2f2', text: '#b91c1c', ring: 'rgba(239,68,68,0.25)', label: 'Critical issues' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function SectionHeader({ icon: Icon, eyebrow, title, blurb }: {
  icon: typeof Activity; eyebrow: string; title: string; blurb: string;
}) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', boxShadow: '0 6px 18px rgba(15,23,42,0.2)' }}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs font-black tracking-[0.2em] uppercase text-slate-400">{eyebrow}</p>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight mt-1">{title}</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl" style={{ lineHeight: 1.6 }}>{blurb}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Activity }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100" style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
      <p className="text-xs text-slate-500 mt-1.5 font-medium">{label}</p>
    </div>
  );
}

function BulletList({ items, icon: Icon, tone = 'neutral' }: {
  items: string[]; icon: typeof CheckCircle2; tone?: 'positive' | 'neutral' | 'warn';
}) {
  const tones = {
    positive: { dot: '#10b981', bg: 'rgba(16,185,129,0.08)' },
    neutral:  { dot: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
    warn:     { dot: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  };
  const t = tones[tone];
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: t.bg }}>
            <Icon className="w-3.5 h-3.5" style={{ color: t.dot }} />
          </div>
          <p className="text-sm text-slate-700" style={{ lineHeight: 1.65 }}>{item}</p>
        </li>
      ))}
    </ul>
  );
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-3xl border border-slate-100 ${className}`} style={{ boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
      {children}
    </div>
  );
}

export default function SystemHealth() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('system_health_reports')
        .select('id, generated_at, generator, overall_grade, summary, sections')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (error) setError('Unable to load the latest system health report.');
      else if (!data) setError('No system health reports have been generated yet.');
      else setReport(data as Report);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Loading system health report…</span>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#f8fafc' }}>
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-slate-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">Report unavailable</h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const { architecture, error_handling, agentic_governance } = report.sections;
  const grade = GRADE_STYLES[report.overall_grade] || GRADE_STYLES.A;

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase" style={{ background: 'rgba(15,23,42,0.06)', color: '#0f172a' }}>
              <Sparkles className="w-3 h-3" />
              Agentic Governance
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Clock className="w-3 h-3" />
              Generated {formatDate(report.generated_at)}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">System Health Report</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-3 max-w-3xl" style={{ lineHeight: 1.7 }}>
            An autonomous self-audit produced by our AI, covering architecture, error handling, and how
            we govern the AI agents that run on this platform. Generated by{' '}
            <span className="font-semibold text-slate-700">{report.generator}</span>.
          </p>
        </div>

        <Panel className="mb-10 overflow-hidden">
          <div className="p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-shrink-0 w-24 h-24 rounded-3xl flex flex-col items-center justify-center" style={{ background: grade.bg, boxShadow: `0 0 0 6px ${grade.ring}` }}>
              <p className="text-5xl font-black leading-none" style={{ color: grade.text }}>{report.overall_grade}</p>
              <p className="text-[10px] font-black tracking-widest uppercase mt-1" style={{ color: grade.text, opacity: 0.7 }}>Grade</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black tracking-[0.2em] uppercase text-slate-400 mb-2">Overall assessment — {grade.label}</p>
              <p className="text-base sm:text-lg text-slate-800 font-semibold" style={{ lineHeight: 1.6 }}>{report.summary}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t border-slate-100">
            <StatCard label="Pages" value={architecture.counts.pages} icon={Layers} />
            <StatCard label="Components" value={architecture.counts.components} icon={Cpu} />
            <StatCard label="Edge functions" value={architecture.counts.edge_functions} icon={Activity} />
            <StatCard label="DB tables" value={architecture.counts.database_tables} icon={Database} />
            <StatCard label="Migrations" value={architecture.counts.migrations} icon={FileCheck} />
            <StatCard label="AI tables" value={architecture.counts.ai_specific_tables} icon={Bot} />
          </div>
        </Panel>

        <section className="mb-12">
          <SectionHeader icon={Layers} eyebrow="Section 01" title="Architecture" blurb="How the platform is composed, from client to database, and the recent optimisations that raised our concurrency ceiling." />

          <div className="grid md:grid-cols-2 gap-5">
            <Panel>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Cpu className="w-4 h-4 text-slate-400" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Stack</p>
                </div>
                <dl className="space-y-2.5">
                  {Object.entries(architecture.stack).map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-4 pb-2 border-b border-slate-50 last:border-0 last:pb-0">
                      <dt className="text-xs font-semibold text-slate-500 capitalize flex-shrink-0 pt-0.5">{k.replace('_', ' ')}</dt>
                      <dd className="text-xs text-slate-800 font-medium text-right">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Panel>

            <Panel>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Gauge className="w-4 h-4 text-slate-400" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Scale optimisations</p>
                </div>
                <BulletList items={architecture.scale_optimizations} icon={ArrowUpRight} tone="positive" />
              </div>
            </Panel>
          </div>
        </section>

        <section className="mb-12">
          <SectionHeader icon={Shield} eyebrow="Section 02" title="Error handling & resilience" blurb="What breaks, who catches it, and what the user sees when something goes wrong." />

          <div className="grid md:grid-cols-2 gap-5">
            <Panel>
              <div className="p-6 space-y-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Error boundary</p>
                  <p className="text-sm text-slate-700" style={{ lineHeight: 1.65 }}>{error_handling.error_boundary}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">User feedback</p>
                  <p className="text-sm text-slate-700" style={{ lineHeight: 1.65 }}>{error_handling.user_feedback}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Server side</p>
                  <p className="text-sm text-slate-700" style={{ lineHeight: 1.65 }}>{error_handling.server_side}</p>
                </div>
              </div>
            </Panel>

            <div className="space-y-5">
              <Panel>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Database safeguards</p>
                  </div>
                  <BulletList items={error_handling.database_safeguards} icon={CheckCircle2} tone="positive" />
                </div>
              </Panel>
              <Panel>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-slate-400" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Graceful degradation</p>
                  </div>
                  <BulletList items={error_handling.graceful_degradation} icon={CheckCircle2} tone="neutral" />
                </div>
              </Panel>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <SectionHeader icon={Bot} eyebrow="Section 03" title="Agentic governance" blurb="How AI is deployed autonomously, how humans oversee it, and how we bound agents with agents — the 2026 discipline of AI managing AI." />

          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <Panel>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4" style={{ color: '#3b82f6' }} />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">What AI does autonomously</p>
                </div>
                <BulletList items={agentic_governance.autonomous_behaviours} icon={Bot} tone="neutral" />
              </div>
            </Panel>

            <Panel>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-4 h-4" style={{ color: '#10b981' }} />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Human oversight</p>
                </div>
                <BulletList items={agentic_governance.human_oversight} icon={CheckCircle2} tone="positive" />
              </div>
            </Panel>
          </div>

          <Panel className="mb-5">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Gauge className="w-4 h-4" style={{ color: '#0f172a' }} />
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">AI-on-AI bounding</p>
              </div>
              <BulletList items={agentic_governance.ai_on_ai_bounding} icon={Lock} tone="neutral" />
            </div>
          </Panel>

          <div className="grid md:grid-cols-2 gap-5">
            <Panel>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileCheck className="w-4 h-4 text-slate-400" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Audit trail</p>
                </div>
                <BulletList items={agentic_governance.audit_trail} icon={FileCheck} tone="positive" />
              </div>
            </Panel>

            <Panel>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4" style={{ color: '#f59e0b' }} />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Failure modes we have already fixed</p>
                </div>
                <BulletList items={agentic_governance.fixed_failure_modes} icon={CheckCircle2} tone="warn" />
              </div>
            </Panel>
          </div>
        </section>

        <div className="text-center py-8 border-t border-slate-100">
          <p className="text-xs text-slate-400">This report was generated by an AI auditing its own system. No human edited the findings.</p>
          <p className="text-xs text-slate-400 mt-1">
            Report ID <span className="font-mono text-slate-500">{report.id.slice(0, 8)}</span>
            <span className="mx-2">•</span>
            Generator <span className="font-semibold text-slate-500">{report.generator}</span>
          </p>

          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Sentry diagnostics</p>
            <button
              onClick={() => {
                const err = new Error('This is your first error!');
                Sentry.captureException(err);
                throw err;
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold border border-red-200 transition-colors"
            >
              <Bug className="w-3.5 h-3.5" />
              Trigger test error
            </button>
            <button
              onClick={() => Sentry.captureMessage('Sentry manual test from SystemHealth')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200 transition-colors"
            >
              <Bug className="w-3.5 h-3.5" />
              Send test message
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
