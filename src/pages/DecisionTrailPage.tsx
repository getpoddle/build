import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Clock, X, Sparkles, List, PlayCircle, PauseCircle,
  ChevronLeft, ChevronRight, UserCog, FileText, MessageSquare,
  Brain, GitBranch, Edit3, CheckCircle2, TrendingUp,
} from 'lucide-react';
import { useUserWorkspaces } from '../hooks/useWorkspaceAccess';
import { supabase } from '../lib/supabase';

interface DecisionTrailPageProps {
  onNavigate: (page: string, workspaceId?: string) => void;
}

interface DecisionEvent {
  id: string;
  workspace_id: string;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

interface DecisionClaim {
  id: string;
  workspace_id: string;
  claim_code: string;
  agent_role: string;
  agent_name: string;
  statement: string;
  claim_type: string;
  evidence_refs: unknown;
  assumptions: unknown;
  confidence: number;
  created_at: string;
}

interface DomainOwnerRow {
  id: string;
  domain: string;
  owner_user_id: string | null;
  backup_owner_user_id: string | null;
}

const EVENT_META: Record<string, { icon: React.ElementType | null; color: string; label: string }> = {
  decision_created:  { icon: FileText,      color: '#475569', label: 'Decision Created' },
  evidence_added:    { icon: MessageSquare, color: '#0891b2', label: 'Evidence Added' },
  agent_analysis:    { icon: null,          color: '#2563eb', label: 'Agent Analysis' },
  challenge_raised:  { icon: GitBranch,     color: '#d97706', label: 'Challenge Raised' },
  human_override:    { icon: Edit3,         color: '#7c3aed', label: 'Human Override' },
  final_decision:    { icon: CheckCircle2,  color: '#16a34a', label: 'Final Decision' },
  outcome_logged:    { icon: TrendingUp,    color: '#0d9488', label: 'Outcome Logged' },
};

const CLAIM_TYPE_COLORS: Record<string, string> = {
  fact: '#16a34a',
  assumption: '#d97706',
  inference: '#2563eb',
  opinion: '#7c3aed',
};

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ── Maps the flat event log into a small number of meaningful narrative
// stages. Only stages with at least one real event are included, so a
// simple decision naturally shows fewer beats than a contested one.
type StageKey = 'created' | 'framed' | 'analyzed' | 'challenged' | 'revised' | 'committed' | 'outcome';

const STAGE_LABELS: Record<StageKey, string> = {
  created: 'Created',
  framed: 'Framed',
  analyzed: 'Analyzed',
  challenged: 'Challenged',
  revised: 'Revised',
  committed: 'Committed',
  outcome: 'Outcome',
};

const STAGE_ORDER: StageKey[] = ['created', 'framed', 'analyzed', 'challenged', 'revised', 'committed', 'outcome'];

function stageForEvent(ev: DecisionEvent): StageKey | null {
  switch (ev.event_type) {
    case 'decision_created': return 'created';
    case 'evidence_added': return 'framed';
    case 'agent_analysis': return 'analyzed';
    case 'final_decision': return 'committed';
    case 'outcome_logged': return 'outcome';
    case 'challenge_raised': return 'challenged';
    case 'human_override': {
      const field = typeof ev.payload?.field === 'string' ? ev.payload.field : '';
      if (field === 'conflict_commit' || field === 'conflict_uncommit') return 'challenged';
      return 'revised';
    }
    default: return null;
  }
}

function groupIntoStages(events: DecisionEvent[]): { key: StageKey; events: DecisionEvent[] }[] {
  const buckets = new Map<StageKey, DecisionEvent[]>();
  for (const ev of events) {
    const stage = stageForEvent(ev);
    if (!stage) continue;
    if (!buckets.has(stage)) buckets.set(stage, []);
    buckets.get(stage)!.push(ev);
  }
  return STAGE_ORDER
    .filter(key => buckets.has(key))
    .map(key => ({ key, events: buckets.get(key)! }));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p
        className="text-[10px] font-bold uppercase mb-1"
        style={{ color: 'var(--app-text-muted)', letterSpacing: '0.08em' }}
      >
        {label}
      </p>
      <div className="text-sm" style={{ color: 'var(--app-text-primary)', lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  );
}

function ClaimBadges({ claims }: { claims: DecisionClaim[] }) {
  if (claims.length === 0) return null;
  return (
    <Field label="Referenced Claims">
      <div className="flex flex-wrap gap-1.5">
        {claims.slice(0, 8).map(c => {
          const color = CLAIM_TYPE_COLORS[c.claim_type] || '#64748b';
          return (
            <span
              key={c.id}
              title={c.statement}
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                border: `1px solid ${color}40`,
                background: `${color}0d`,
                color,
              }}
            >
              {c.claim_code}
            </span>
          );
        })}
      </div>
    </Field>
  );
}

// ── EventCard: a single, self-contained enterprise-style card for one
// event — icon-coded header with a colored left accent, structured
// labeled fields in the body instead of run-together sentences.
function EventCard({ ev, actorNames, claims }: { ev: DecisionEvent; actorNames: Record<string, string>; claims: DecisionClaim[] }) {
  const meta = EVENT_META[ev.event_type] || { icon: FileText, color: '#64748b', label: ev.event_type };
  const Icon = meta.icon;
  const actorName = ev.actor_type === 'user' && ev.actor_id ? (actorNames[ev.actor_id] || 'A team member') : null;

  return (
    <div style={{ border: '1px solid var(--app-border)', borderLeft: `3px solid ${meta.color}`, background: 'var(--app-surface-raised, #fff)' }}>
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 flex-wrap"
        style={{ borderBottom: '1px solid var(--app-border)', background: `${meta.color}0a` }}
      >
        {Icon && (
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 26, height: 26, background: 'var(--app-surface-raised, #fff)', border: `1px solid ${meta.color}40` }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
          </div>
        )}
        <span className="text-xs font-bold uppercase" style={{ color: meta.color, letterSpacing: '0.06em' }}>
          {meta.label}
        </span>
        <div className="ml-auto text-right">
          <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{new Date(ev.created_at).toLocaleString()}</p>
          {actorName && (
            <p className="text-xs font-medium" style={{ color: 'var(--app-text-secondary)' }}>{actorName}</p>
          )}
        </div>
      </div>

      <div className="px-4 py-3.5">
        {typeof ev.payload?.question === 'string' && (
          <Field label="Original Question">{String(ev.payload.question)}</Field>
        )}
        {typeof ev.payload?.kind === 'string' && ev.payload.kind === 'framing_message' && typeof ev.payload?.content === 'string' && (
          <Field label="Framing Message">{String(ev.payload.content)}</Field>
        )}
        {typeof ev.payload?.recommendation === 'string' && (
          <Field label="Recommendation">
            <span style={{ color: 'var(--app-text-secondary)' }}>{String(ev.payload.recommendation).slice(0, 280)}</span>
          </Field>
        )}
        {typeof ev.payload?.status === 'string' && !ev.payload?.field && (
          <Field label="Status">
            <span
              className="text-xs font-bold uppercase px-2 py-0.5"
              style={{ color: meta.color, background: `${meta.color}14` }}
            >
              {String(ev.payload.status)}
            </span>
          </Field>
        )}

        {ev.event_type === 'human_override' && typeof ev.payload?.field === 'string' && (
          <>
            <Field label="Changed">
              <span className="font-medium">{String(ev.payload.field).replace(/_/g, ' ')}</span>
            </Field>
            {ev.payload.field === 'name' && (
              <Field label="Before → After">
                <span style={{ color: 'var(--app-text-muted)', textDecoration: 'line-through' }}>
                  {String((ev.payload.before as Record<string, unknown>)?.name ?? '')}
                </span>
                {' → '}
                <span style={{ fontWeight: 500 }}>{String((ev.payload.after as Record<string, unknown>)?.name ?? '')}</span>
              </Field>
            )}
            {ev.payload.field === 'description' && (
              <Field label="Before → After">
                <span style={{ color: 'var(--app-text-muted)', textDecoration: 'line-through' }}>
                  {String((ev.payload.before as Record<string, unknown>)?.description ?? '(empty)')}
                </span>
                {' → '}
                <span style={{ fontWeight: 500 }}>{String((ev.payload.after as Record<string, unknown>)?.description ?? '(empty)')}</span>
              </Field>
            )}
            {ev.payload.field === 'name_and_description' && <Field label="Detail">Updated name and description</Field>}
            {ev.payload.field === 'member_role' && (
              <Field label="Before → After">{String(ev.payload.before)} → {String(ev.payload.after)}</Field>
            )}
            {ev.payload.field === 'member_removed' && <Field label="Detail">Removed a {String(ev.payload.role || 'member')}</Field>}
            {ev.payload.field === 'organization' && (
              <Field label="Detail">{ev.payload.action === 'linked' ? 'Linked to an organization' : 'Unlinked from organization'}</Field>
            )}
            {ev.payload.field === 'action_item_assignee' && <Field label="Detail">Assigned "{String(ev.payload.action_item ?? '')}"</Field>}
            {ev.payload.field === 'manual_action_item_added' && <Field label="Detail">Added: {String(ev.payload.action_item ?? '')}</Field>}
            {ev.payload.field === 'conflict_commit' && <Field label="Detail">Committed to a position on "{String(ev.payload.conflict_topic ?? '')}"</Field>}
            {ev.payload.field === 'conflict_uncommit' && <Field label="Detail">Reversed commitment on "{String(ev.payload.conflict_topic ?? '')}"</Field>}
          </>
        )}

        {ev.event_type === 'outcome_logged' && (
          <Field label="Outcome">
            "{String(ev.payload.action_item ?? '')}" — <span className="font-medium">{String(ev.payload.outcome ?? '')}</span>
          </Field>
        )}

        {ev.event_type === 'agent_analysis' && <ClaimBadges claims={claims} />}
      </div>
    </div>
  );
}

function DecisionStory({
  events, claims, actorNames, domainOwners, ownerNames,
}: {
  events: DecisionEvent[];
  claims: DecisionClaim[];
  actorNames: Record<string, string>;
  domainOwners: DomainOwnerRow[];
  ownerNames: Record<string, string>;
}) {
  const stages = useMemo(() => groupIntoStages(events), [events]);
  const [stageIndex, setStageIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (stageIndex >= stages.length - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setStageIndex(i => Math.min(i + 1, stages.length - 1)), 2800);
    return () => clearTimeout(t);
  }, [playing, stageIndex, stages.length]);

  if (stages.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-sm" style={{ color: 'var(--app-text-secondary)' }}>
          No recorded stages for this decision yet.
        </p>
      </div>
    );
  }

  const current = stages[Math.min(stageIndex, stages.length - 1)];
  const ownedDomains = domainOwners.filter(d => d.owner_user_id || d.backup_owner_user_id);
  const progressPct = stages.length > 1 ? (stageIndex / (stages.length - 1)) * 100 : 0;

  return (
    <div>
      {/* Stage tracker */}
      <div className="mb-6">
        <div className="flex items-center" style={{ position: 'relative' }}>
          <div
            style={{
              position: 'absolute', left: 0, right: 0, top: '11px', height: '2px',
              background: 'var(--app-border)', zIndex: 0,
            }}
          />
          <div
            style={{
              position: 'absolute', left: 0, top: '11px', height: '2px',
              background: 'var(--signal)', zIndex: 0, width: `${progressPct}%`,
              transition: 'width 0.35s ease',
            }}
          />
          {stages.map((s, i) => {
            const active = i === stageIndex;
            const done = i < stageIndex;
            const meta = EVENT_META[s.events[0].event_type];
            return (
              <button
                key={s.key}
                onClick={() => { setPlaying(false); setStageIndex(i); }}
                className="flex-1 flex flex-col items-center gap-1.5"
                style={{ position: 'relative', zIndex: 1 }}
              >
                <div
                  className="rounded-full flex items-center justify-center"
                  style={{
                    width: 24, height: 24,
                    background: active || done ? 'var(--signal)' : 'var(--app-surface-raised, #fff)',
                    border: `2px solid ${active || done ? 'var(--signal)' : 'var(--app-border)'}`,
                    color: active || done ? '#fff' : 'var(--app-text-muted)',
                    fontSize: '11px', fontWeight: 700,
                  }}
                >
                  {done ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
                </div>
                <span
                  className="text-xs font-semibold"
                  style={{ color: active ? (meta?.color || 'var(--app-text-primary)') : 'var(--app-text-secondary)' }}
                >
                  {STAGE_LABELS[s.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stage context strip */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold" style={{ color: 'var(--app-text-muted)' }}>
          Stage {stageIndex + 1} of {stages.length}
        </span>
        {current.key === 'created' && ownedDomains.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <UserCog className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--app-text-secondary)' }} />
            {ownedDomains.map(d => (
              <span key={d.id} className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>
                {d.domain}: {d.owner_user_id ? (ownerNames[d.owner_user_id] || 'Assigned') : 'Unassigned'}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stage cards */}
      <div className="space-y-3 mb-5">
        {current.events.map(ev => (
          <EventCard key={ev.id} ev={ev} actorNames={actorNames} claims={ev.event_type === 'agent_analysis' ? claims : []} />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => { setPlaying(false); setStageIndex(i => Math.max(0, i - 1)); }}
          disabled={stageIndex === 0}
          className="btn-secondary disabled:opacity-40"
          style={{ padding: '0.5rem 0.875rem', fontSize: '0.8125rem' }}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        <button
          onClick={() => setPlaying(p => !p)}
          disabled={stageIndex >= stages.length - 1 && !playing}
          className="btn-primary disabled:opacity-40"
          style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
        >
          {playing ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={() => { setPlaying(false); setStageIndex(i => Math.min(stages.length - 1, i + 1)); }}
          disabled={stageIndex === stages.length - 1}
          className="btn-secondary disabled:opacity-40"
          style={{ padding: '0.5rem 0.875rem', fontSize: '0.8125rem' }}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ClaimsPanel({ claims }: { claims: DecisionClaim[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (claims.length === 0) return null;

  return (
    <div className="mt-6 p-4" style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--signal)' }} />
        <h3 className="text-sm font-bold uppercase" style={{ color: 'var(--signal)', letterSpacing: '0.06em' }}>
          Claims ({claims.length})
        </h3>
        <span className="text-xs ml-auto" style={{ color: 'var(--app-text-secondary)' }}>Evidence-linked, citable by code</span>
      </div>
      <div className="space-y-2">
        {claims.map(claim => {
          const isOpen = expanded === claim.id;
          const typeColor = CLAIM_TYPE_COLORS[claim.claim_type] || '#64748b';
          const evidenceRefs = Array.isArray(claim.evidence_refs) ? claim.evidence_refs as string[] : [];
          const assumptions = Array.isArray(claim.assumptions) ? claim.assumptions as { key: string; value: string }[] : [];
          return (
            <button
              key={claim.id}
              onClick={() => setExpanded(isOpen ? null : claim.id)}
              className="w-full text-left"
              style={{ border: '1px solid var(--app-border)', borderLeft: `3px solid ${typeColor}`, background: 'var(--app-surface-raised, #fff)' }}
            >
              <div className="p-3.5">
                <div className="flex items-start gap-2.5">
                  <span
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: '11px', fontWeight: 700,
                      padding: '2px 8px', flexShrink: 0,
                      border: `1px solid ${typeColor}40`, background: `${typeColor}0d`, color: typeColor,
                    }}
                  >
                    {claim.claim_code}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{claim.statement}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--app-text-secondary)' }}>
                      {claim.agent_name} · <span className="capitalize">{claim.claim_type}</span> · {Math.round(claim.confidence * 100)}% confidence
                    </p>
                    {isOpen && (
                      <div className="mt-2.5 pt-2.5 space-y-2 text-xs" style={{ borderTop: '1px solid var(--app-border)' }}>
                        {evidenceRefs.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase mb-0.5" style={{ color: 'var(--app-text-muted)', letterSpacing: '0.08em' }}>Evidence</p>
                            <p style={{ color: 'var(--app-text-secondary)' }}>{evidenceRefs.join(', ')}</p>
                          </div>
                        )}
                        {assumptions.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase mb-0.5" style={{ color: 'var(--app-text-muted)', letterSpacing: '0.08em' }}>Assumptions</p>
                            {assumptions.map((a, i) => (
                              <p key={i} style={{ color: 'var(--app-text-secondary)' }}>{a.key}: {a.value}</p>
                            ))}
                          </div>
                        )}
                        {evidenceRefs.length === 0 && assumptions.length === 0 && (
                          <p style={{ color: 'var(--app-text-secondary)' }}>No evidence or assumptions recorded for this claim.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimelineView({ workspaceId, workspaceName, onBack }: { workspaceId: string; workspaceName: string; onBack: () => void }) {
  const [events, setEvents] = useState<DecisionEvent[]>([]);
  const [claims, setClaims] = useState<DecisionClaim[]>([]);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [domainOwners, setDomainOwners] = useState<DomainOwnerRow[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'story'>('list');
  const [replayActive, setReplayActive] = useState(false);
  const [replayTimestamp, setReplayTimestamp] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [eventsRes, claimsRes, ownersRes] = await Promise.all([
        supabase
          .from('decision_events')
          .select('id, workspace_id, event_type, actor_type, actor_id, payload, created_at')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true }),
        supabase
          .from('decision_claims')
          .select('id, workspace_id, claim_code, agent_role, agent_name, statement, claim_type, evidence_refs, assumptions, confidence, created_at')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true }),
        supabase
          .from('domain_owners')
          .select('id, domain, owner_user_id, backup_owner_user_id')
          .eq('workspace_id', workspaceId),
      ]);

      if (cancelled) return;

      const eventRows = (!eventsRes.error && eventsRes.data ? eventsRes.data : []) as DecisionEvent[];
      setEvents(eventRows);
      if (!claimsRes.error && claimsRes.data) setClaims(claimsRes.data as DecisionClaim[]);
      const ownerRows = (!ownersRes.error && ownersRes.data ? ownersRes.data : []) as DomainOwnerRow[];
      setDomainOwners(ownerRows);

      const actorIds = Array.from(new Set(eventRows.filter(e => e.actor_type === 'user' && e.actor_id).map(e => e.actor_id as string)));
      const ownerIds = Array.from(new Set(ownerRows.flatMap(d => [d.owner_user_id, d.backup_owner_user_id]).filter((v): v is string => !!v)));
      const allIds = Array.from(new Set([...actorIds, ...ownerIds]));

      if (allIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', allIds);
        if (!cancelled && profiles) {
          const map: Record<string, string> = {};
          for (const p of profiles as { id: string; full_name: string | null }[]) {
            map[p.id] = p.full_name || 'A team member';
          }
          setActorNames(map);
          setOwnerNames(map);
        }
      }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [workspaceId]);

  const earliestEvent = events[0];
  const latestEvent = events[events.length - 1];

  useEffect(() => {
    if (latestEvent && !replayTimestamp) {
      setReplayTimestamp(toLocalDatetimeInputValue(new Date(latestEvent.created_at)));
    }
  }, [latestEvent, replayTimestamp]);

  const displayedEvents = useMemo(() => {
    if (!replayActive || !replayTimestamp) return events;
    const cutoff = new Date(replayTimestamp).getTime();
    return events.filter(e => new Date(e.created_at).getTime() <= cutoff);
  }, [events, replayActive, replayTimestamp]);

  const startReplay = () => {
    if (latestEvent) setReplayTimestamp(toLocalDatetimeInputValue(new Date(latestEvent.created_at)));
    setReplayActive(true);
  };
  const endReplay = () => setReplayActive(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="btn-ghost flex-shrink-0" style={{ padding: '0.5rem' }} aria-label="Back to decisions">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <p className="section-label mb-0.5">Decision Trail</p>
            <h1 className="display-heading text-xl lg:text-2xl truncate">{workspaceName}</h1>
          </div>
        </div>

        {!loading && events.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center" style={{ border: '1px solid var(--app-border)' }}>
              <button
                onClick={() => { setViewMode('list'); }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5"
                style={{
                  background: viewMode === 'list' ? 'var(--signal)' : 'transparent',
                  color: viewMode === 'list' ? '#fff' : 'var(--app-text-secondary)',
                }}
              >
                <List className="w-3.5 h-3.5" />
                Timeline
              </button>
              <button
                onClick={() => { setViewMode('story'); setReplayActive(false); }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5"
                style={{
                  background: viewMode === 'story' ? 'var(--signal)' : 'transparent',
                  color: viewMode === 'story' ? '#fff' : 'var(--app-text-secondary)',
                }}
              >
                <PlayCircle className="w-3.5 h-3.5" />
                Story
              </button>
            </div>
            {viewMode === 'list' && !replayActive && (
              <button
                onClick={startReplay}
                className="btn-secondary flex-shrink-0"
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
              >
                <Clock className="w-3.5 h-3.5" />
                Point-in-time
              </button>
            )}
          </div>
        )}
      </div>

      {viewMode === 'list' && replayActive && (
        <div
          className="flex items-center gap-3 p-3 mb-4 flex-wrap"
          style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)' }}
        >
          <Clock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--signal)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: 'var(--app-text-primary)' }}>
              Viewing what was known as of:
            </p>
            <input
              type="datetime-local"
              value={replayTimestamp}
              min={earliestEvent ? toLocalDatetimeInputValue(new Date(earliestEvent.created_at)) : undefined}
              max={latestEvent ? toLocalDatetimeInputValue(new Date(latestEvent.created_at)) : undefined}
              onChange={e => setReplayTimestamp(e.target.value)}
              className="input-modern mt-1"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', maxWidth: '240px' }}
            />
          </div>
          <button
            onClick={endReplay}
            className="btn-ghost flex-shrink-0"
            style={{ padding: '0.375rem' }}
            aria-label="Exit point-in-time view"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-16" />)}
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="panel p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--app-text-secondary)' }}>
            No recorded events for this decision yet.
          </p>
        </div>
      )}

      {!loading && events.length > 0 && viewMode === 'story' && (
        <DecisionStory
          events={events}
          claims={claims}
          actorNames={actorNames}
          domainOwners={domainOwners}
          ownerNames={ownerNames}
        />
      )}

      {!loading && events.length > 0 && viewMode === 'list' && (
        <>
          {replayActive && displayedEvents.length === 0 && (
            <div className="panel p-8 text-center">
              <p className="text-sm" style={{ color: 'var(--app-text-secondary)' }}>
                Nothing was recorded yet at this point in time.
              </p>
            </div>
          )}

          {displayedEvents.length > 0 && (
            <>
              <h3 className="text-sm font-bold uppercase mb-3" style={{ color: 'var(--app-text-secondary)', letterSpacing: '0.06em' }}>
                Audit Trail ({displayedEvents.length})
              </h3>
              <div className="space-y-3">
                {displayedEvents.map(ev => (
                  <EventCard key={ev.id} ev={ev} actorNames={actorNames} claims={ev.event_type === 'agent_analysis' ? claims : []} />
                ))}
              </div>
            </>
          )}

          {!replayActive && <ClaimsPanel claims={claims} />}
        </>
      )}
    </div>
  );
}

export default function DecisionTrailPage({ onNavigate }: DecisionTrailPageProps) {
  const { workspaces, loading } = useUserWorkspaces();
  const appWorkspaces = workspaces.filter(w => w.source !== 'slack');
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [lastActivity, setLastActivity] = useState<Record<string, string>>({});

  useEffect(() => {
    if (appWorkspaces.length === 0) return;
    const ids = appWorkspaces.map(w => w.id);
    supabase
      .from('decision_events')
      .select('workspace_id, created_at')
      .in('workspace_id', ids)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error || !data) return;
        const latest: Record<string, string> = {};
        for (const row of data as { workspace_id: string; created_at: string }[]) {
          if (!latest[row.workspace_id]) latest[row.workspace_id] = row.created_at;
        }
        setLastActivity(latest);
      });
  }, [workspaces.length]);

  const sorted = [...appWorkspaces].sort((a, b) => {
    const aTime = lastActivity[a.id] || '';
    const bTime = lastActivity[b.id] || '';
    return bTime.localeCompare(aTime);
  });

  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg)' }}>
      <div
        className="px-4 sm:px-6 lg:px-8 py-6 lg:py-10 mx-auto"
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {selected ? (
          <TimelineView
            workspaceId={selected.id}
            workspaceName={selected.name}
            onBack={() => setSelected(null)}
          />
        ) : (
          <>
            <div className="mb-6 lg:mb-10">
              <p className="section-label mb-2">Decisions</p>
              <h1 className="display-heading text-2xl lg:text-3xl xl:text-4xl mb-1">
                Decision Trail
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--app-text-secondary)' }}>
                Every decision, traceable from question to outcome.
              </p>
            </div>

            {loading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="skeleton h-16" />)}
              </div>
            )}

            {!loading && sorted.length === 0 && (
              <div className="panel p-8 lg:p-16 text-center">
                <p className="text-sm" style={{ color: 'var(--app-text-secondary)' }}>
                  No decisions yet.
                </p>
              </div>
            )}

            {!loading && sorted.length > 0 && (
              <div className="space-y-2">
                {sorted.map(ws => (
                  <button
                    key={ws.id}
                    onClick={() => setSelected({ id: ws.id, name: ws.name })}
                    className="panel w-full text-left p-4 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{ws.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-secondary)' }}>
                        {lastActivity[ws.id]
                          ? `Last activity ${new Date(lastActivity[ws.id]).toLocaleDateString()}`
                          : 'No recorded activity yet'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
