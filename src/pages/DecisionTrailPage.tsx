import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Clock, X, Sparkles, List, PlayCircle, PauseCircle, ChevronLeft, ChevronRight, UserCog } from 'lucide-react';
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

const EVENT_LABELS: Record<string, string> = {
  decision_created: 'Decision created',
  evidence_added: 'Evidence added',
  agent_analysis: 'Agent analysis',
  challenge_raised: 'Challenge raised',
  human_override: 'Human override',
  final_decision: 'Final decision',
  outcome_logged: 'Outcome logged',
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

function EventDetail({ ev, actorNames, claims }: { ev: DecisionEvent; actorNames: Record<string, string>; claims: DecisionClaim[] }) {
  return (
    <div className="mb-3">
      <p className="text-sm font-medium">{EVENT_LABELS[ev.event_type] || ev.event_type}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-secondary)' }}>
        {new Date(ev.created_at).toLocaleString()}
        {ev.actor_type === 'user' && ev.actor_id && (
          <> · {actorNames[ev.actor_id] || 'A team member'}</>
        )}
      </p>

      {typeof ev.payload?.question === 'string' && (
        <p className="text-sm mt-1">{String(ev.payload.question)}</p>
      )}
      {typeof ev.payload?.recommendation === 'string' && (
        <p className="text-sm mt-1" style={{ color: 'var(--app-text-secondary)' }}>
          {String(ev.payload.recommendation).slice(0, 240)}
        </p>
      )}
      {typeof ev.payload?.status === 'string' && !ev.payload?.field && (
        <p className="text-sm mt-1">Status: {String(ev.payload.status)}</p>
      )}
      {typeof ev.payload?.kind === 'string' && ev.payload.kind === 'framing_message' && typeof ev.payload?.content === 'string' && (
        <p className="text-sm mt-1">{String(ev.payload.content)}</p>
      )}

      {ev.event_type === 'human_override' && typeof ev.payload?.field === 'string' && (
        <div className="text-sm mt-1 space-y-0.5">
          <p style={{ color: 'var(--app-text-secondary)' }}>
            Changed: <span className="font-medium" style={{ color: 'var(--app-text-primary)' }}>{String(ev.payload.field).replace(/_/g, ' ')}</span>
          </p>
          {ev.payload.field === 'name' && (
            <p>
              <span style={{ color: 'var(--app-text-muted)', textDecoration: 'line-through' }}>
                {String((ev.payload.before as Record<string, unknown>)?.name ?? '')}
              </span>
              {' → '}
              {String((ev.payload.after as Record<string, unknown>)?.name ?? '')}
            </p>
          )}
          {ev.payload.field === 'description' && (
            <p>
              <span style={{ color: 'var(--app-text-muted)', textDecoration: 'line-through' }}>
                {String((ev.payload.before as Record<string, unknown>)?.description ?? '(empty)')}
              </span>
              {' → '}
              {String((ev.payload.after as Record<string, unknown>)?.description ?? '(empty)')}
            </p>
          )}
          {ev.payload.field === 'name_and_description' && <p>Updated name and description</p>}
          {ev.payload.field === 'member_role' && <p>Role: {String(ev.payload.before)} → {String(ev.payload.after)}</p>}
          {ev.payload.field === 'member_removed' && <p>Removed a {String(ev.payload.role || 'member')}</p>}
          {ev.payload.field === 'organization' && (
            <p>{ev.payload.action === 'linked' ? 'Linked to an organization' : 'Unlinked from organization'}</p>
          )}
          {ev.payload.field === 'action_item_assignee' && <p>Assigned "{String(ev.payload.action_item ?? '')}"</p>}
          {ev.payload.field === 'manual_action_item_added' && <p>Added: {String(ev.payload.action_item ?? '')}</p>}
          {ev.payload.field === 'conflict_commit' && <p>Committed to a position on "{String(ev.payload.conflict_topic ?? '')}"</p>}
          {ev.payload.field === 'conflict_uncommit' && <p>Reversed commitment on "{String(ev.payload.conflict_topic ?? '')}"</p>}
        </div>
      )}

      {ev.event_type === 'outcome_logged' && (
        <p className="text-sm mt-1">
          "{String(ev.payload.action_item ?? '')}" — {String(ev.payload.outcome ?? '')}
        </p>
      )}

      {ev.event_type === 'agent_analysis' && claims.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {claims.slice(0, 6).map(c => {
            const color = CLAIM_TYPE_COLORS[c.claim_type] || '#64748b';
            return (
              <span
                key={c.id}
                className="text-xs font-bold px-2 py-0.5"
                style={{ color, background: `${color}1a` }}
                title={c.statement}
              >
                {c.claim_code}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DecisionStory({
  workspaceId, events, claims, actorNames, domainOwners, ownerNames,
}: {
  workspaceId: string;
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

  return (
    <div>
      {/* Stage tracker */}
      <div className="mb-5">
        <div className="flex items-center" style={{ position: 'relative' }}>
          <div
            style={{
              position: 'absolute', left: 0, right: 0, top: '10px', height: '2px',
              background: 'var(--app-border)', zIndex: 0,
            }}
          />
          {stages.map((s, i) => {
            const active = i === stageIndex;
            const done = i < stageIndex;
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
                    width: 22, height: 22,
                    background: active || done ? 'var(--signal)' : 'var(--app-surface)',
                    border: `2px solid ${active || done ? 'var(--signal)' : 'var(--app-border)'}`,
                    color: active || done ? '#fff' : 'var(--app-text-muted)',
                    fontSize: '11px', fontWeight: 700,
                  }}
                >
                  {i + 1}
                </div>
                <span
                  className="text-xs font-medium"
                  style={{ color: active ? 'var(--app-text-primary)' : 'var(--app-text-secondary)' }}
                >
                  {STAGE_LABELS[s.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stage card */}
      <div className="panel p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs font-bold uppercase tracking-wide px-2 py-0.5"
            style={{ color: 'var(--signal)', background: 'var(--signal-bg)' }}
          >
            Stage {stageIndex + 1} of {stages.length} · {STAGE_LABELS[current.key]}
          </span>
        </div>

        {current.key === 'created' && ownedDomains.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <UserCog className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--app-text-secondary)' }} />
            {ownedDomains.map(d => (
              <span key={d.id} className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>
                {d.domain}: {d.owner_user_id ? (ownerNames[d.owner_user_id] || 'Assigned') : 'Unassigned'}
              </span>
            ))}
          </div>
        )}

        {current.events.map(ev => (
          <EventDetail key={ev.id} ev={ev} actorNames={actorNames} claims={ev.event_type === 'agent_analysis' ? claims : []} />
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
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--signal)' }} />
        <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--app-text-secondary)' }}>
          Claims ({claims.length})
        </h3>
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
              className="panel w-full text-left p-3"
            >
              <div className="flex items-start gap-2">
                <span
                  className="text-xs font-bold px-2 py-0.5 flex-shrink-0"
                  style={{ color: typeColor, background: `${typeColor}1a` }}
                >
                  {claim.claim_code}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{claim.statement}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--app-text-secondary)' }}>
                    {claim.agent_name} · {claim.claim_type} · {Math.round(claim.confidence * 100)}% confidence
                  </p>
                  {isOpen && (
                    <div className="mt-2 space-y-1.5 text-xs" style={{ color: 'var(--app-text-secondary)' }}>
                      {evidenceRefs.length > 0 && <p>Evidence: {evidenceRefs.join(', ')}</p>}
                      {assumptions.length > 0 && (
                        <div>
                          <p className="font-medium" style={{ color: 'var(--app-text-primary)' }}>Assumptions:</p>
                          {assumptions.map((a, i) => <p key={i}>{a.key}: {a.value}</p>)}
                        </div>
                      )}
                      {evidenceRefs.length === 0 && assumptions.length === 0 && (
                        <p>No evidence or assumptions recorded for this claim.</p>
                      )}
                    </div>
                  )}
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
  const [domainOwners, setDomainOwners] = useState<DomainOwnerRow[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [replayActive, setReplayActive] = useState(false);
  const [replayTimestamp, setReplayTimestamp] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'story'>('list');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
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
        .eq('workspace_id', workspaceId)
        .order('domain'),
    ]).then(([evRes, claimsRes, ownersRes]) => {
      if (cancelled) return;
      if (!evRes.error && evRes.data) setEvents(evRes.data as DecisionEvent[]);
      if (!claimsRes.error && claimsRes.data) setClaims(claimsRes.data as DecisionClaim[]);
      if (!ownersRes.error && ownersRes.data) setDomainOwners(ownersRes.data as DomainOwnerRow[]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [workspaceId]);

  useEffect(() => {
    const ids = new Set<string>();
    for (const e of events) if (e.actor_type === 'user' && e.actor_id) ids.add(e.actor_id);
    for (const d of domainOwners) {
      if (d.owner_user_id) ids.add(d.owner_user_id);
      if (d.backup_owner_user_id) ids.add(d.backup_owner_user_id);
    }
    const userActorIds = [...ids];
    if (userActorIds.length === 0) return;
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userActorIds)
      .then(({ data, error }) => {
        if (error || !data) return;
        const map: Record<string, string> = {};
        for (const row of data as { id: string; full_name: string | null }[]) {
          if (row.full_name) map[row.id] = row.full_name;
        }
        setActorNames(map);
        setOwnerNames(map);
      });
  }, [events, domainOwners]);

  const displayedEvents = useMemo(() => {
    if (!replayActive || !replayTimestamp) return events;
    const cutoff = new Date(replayTimestamp).getTime();
    return events.filter(ev => new Date(ev.created_at).getTime() <= cutoff);
  }, [events, replayActive, replayTimestamp]);

  function startReplay() {
    const now = events.length > 0 ? new Date(events[events.length - 1].created_at) : new Date();
    setReplayTimestamp(toLocalDatetimeInputValue(now));
    setReplayActive(true);
    setViewMode('list');
  }

  function endReplay() {
    setReplayActive(false);
    setReplayTimestamp('');
  }

  const earliestEvent = events[0];
  const latestEvent = events[events.length - 1];

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium mb-4"
        style={{ color: 'var(--app-text-secondary)' }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Decision Trail
      </button>

      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <h2 className="display-heading text-xl">{workspaceName}</h2>
        {!loading && events.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex" style={{ border: '1px solid var(--app-border)' }}>
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
          workspaceId={workspaceId}
          events={events}
          claims={claims}
          actorNames={actorNames}
          domainOwners={domainOwners}
          ownerNames={ownerNames}
        />
      )}

      {!loading && events.length > 0 && viewMode === 'list' && (
        <>
          {!replayActive && <ClaimsPanel claims={claims} />}

          {replayActive && displayedEvents.length === 0 && (
            <div className="panel p-8 text-center">
              <p className="text-sm" style={{ color: 'var(--app-text-secondary)' }}>
                Nothing was recorded yet at this point in time.
              </p>
            </div>
          )}

          {displayedEvents.length > 0 && (
            <div className="space-y-0">
              {displayedEvents.map((ev, i) => (
                <div key={ev.id} className="flex gap-3">
                  <div className="flex flex-col items-center" style={{ width: 20 }}>
                    <div className="rounded-full" style={{ width: 10, height: 10, background: 'var(--signal)', marginTop: 4 }} />
                    {i < displayedEvents.length - 1 && (
                      <div style={{ width: 1, flex: 1, background: 'var(--app-border)', marginTop: 2 }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: 20, flex: 1 }}>
                    <EventDetail ev={ev} actorNames={actorNames} claims={ev.event_type === 'agent_analysis' ? claims : []} />
                  </div>
                </div>
              ))}
            </div>
          )}
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
