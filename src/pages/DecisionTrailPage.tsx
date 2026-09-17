import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft, Clock, X, List, PlayCircle, PauseCircle,
  ChevronLeft, ChevronRight, UserCog, FileText, MessageSquare, MessageCircle,
  GitBranch, Edit3, CheckCircle2, TrendingUp, Send, Download,
} from 'lucide-react';
import { exportDecisionTrailToPDF } from '../lib/pdfExport';
import { useUserWorkspaces } from '../hooks/useWorkspaceAccess';
import { useAuth } from '../contexts/AuthContext';
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
  last_verified_at: string;
  validity_period_days: number;
}

interface DecisionChallenge {
  id: string;
  workspace_id: string;
  target_claim_id: string;
  challenger_agent_role: string;
  challenger_agent_name: string;
  challenge_text: string;
  rebuttal_text: string | null;
  status: string;
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
  team_note:         { icon: MessageCircle, color: '#64748b', label: 'Team Note' },
};

const CLAIM_TYPE_COLORS: Record<string, string> = {
  fact: '#16a34a',
  assumption: '#d97706',
  inference: '#2563eb',
  opinion: '#7c3aed',
};

type Freshness = 'current' | 'aging' | 'stale';

function freshnessFor(claim: DecisionClaim): { status: Freshness; label: string; color: string; daysSinceVerified: number } {
  const verifiedAt = new Date(claim.last_verified_at).getTime();
  const daysSinceVerified = Math.floor((Date.now() - verifiedAt) / (1000 * 60 * 60 * 24));
  const pctElapsed = daysSinceVerified / claim.validity_period_days;

  if (pctElapsed > 1) return { status: 'stale', label: 'Stale', color: '#dc2626', daysSinceVerified };
  if (pctElapsed >= 0.5) return { status: 'aging', label: 'Aging', color: '#d97706', daysSinceVerified };
  return { status: 'current', label: 'Current', color: '#16a34a', daysSinceVerified };
}

const ACTOR_AVATAR_EVENTS = new Set(['final_decision', 'team_note', 'human_override']);

function initialsFor(name: string | null | undefined): string {
  if (!name) return 'A';
  const trimmed = name.trim();
  if (!trimmed) return 'A';
  return trimmed.charAt(0).toUpperCase();
}

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dayLabelFor(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isSameDay) return 'Today';
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function groupEventsByDay(events: DecisionEvent[]): { label: string; events: DecisionEvent[] }[] {
  const groups: { label: string; events: DecisionEvent[] }[] = [];
  for (const ev of events) {
    const label = dayLabelFor(ev.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.events.push(ev);
    } else {
      groups.push({ label, events: [ev] });
    }
  }
  return groups;
}

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
    case 'team_note': return null;
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

function ClaimPill({ code, color, onJumpToClaim }: { code: string; color: string; onJumpToClaim: (claimCode: string) => void }) {
  return (
    <button
      onClick={() => onJumpToClaim(code)}
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '11px',
        fontWeight: 500,
        padding: '3px 9px',
        borderRadius: '6px',
        border: 'none',
        background: `${color}1a`,
        color,
        cursor: 'pointer',
      }}
    >
      {code}
    </button>
  );
}

function ClaimBadges({ claims, onJumpToClaim }: { claims: DecisionClaim[]; onJumpToClaim: (claimCode: string) => void }) {
  if (claims.length === 0) return null;
  return (
    <Field label="Evidence IDs">
      <div className="flex flex-wrap gap-1.5">
        {claims.slice(0, 8).map(c => (
          <span key={c.id} title={c.statement}>
            <ClaimPill code={c.claim_code} color={CLAIM_TYPE_COLORS[c.claim_type] || '#64748b'} onJumpToClaim={onJumpToClaim} />
          </span>
        ))}
      </div>
    </Field>
  );
}

function TimelineNode({
  ev, actorNames, claims, onJumpToClaim, isLast,
}: {
  ev: DecisionEvent;
  actorNames: Record<string, string>;
  claims: DecisionClaim[];
  onJumpToClaim: (claimCode: string) => void;
  isLast: boolean;
}) {
  const meta = EVENT_META[ev.event_type] || { icon: FileText, color: '#64748b', label: ev.event_type };
  const Icon = meta.icon;
  const actorName = ev.actor_type === 'user' && ev.actor_id ? (actorNames[ev.actor_id] || 'A team member') : null;
  const showAvatar = ACTOR_AVATAR_EVENTS.has(ev.event_type) && !!actorName;
  const timeLabel = new Date(ev.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="relative" style={{ paddingBottom: isLast ? 0 : '1.5rem' }}>
      {!isLast && (
        <div
          className="absolute"
          style={{ left: '13px', top: '34px', bottom: '-10px', width: '1px', background: 'var(--app-border)' }}
        />
      )}
      <div
        className="absolute flex items-center justify-center rounded-full flex-shrink-0"
        style={{ left: 0, top: 0, width: '27px', height: '27px', background: `${meta.color}18` }}
      >
        {Icon ? <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />}
      </div>

      <div style={{ marginLeft: '36px', background: 'var(--app-surface-raised, #fff)', borderRadius: '12px' }} className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
          <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '11px', color: 'var(--app-text-muted)' }}>{timeLabel}</span>
        </div>

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
              style={{ color: meta.color, background: `${meta.color}14`, borderRadius: '6px' }}
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
        {ev.event_type === 'challenge_raised' && typeof ev.payload?.statement === 'string' && (
          <>
            <Field label="Challenge">
              <span style={{ fontStyle: 'italic' }}>{String(ev.payload.statement)}</span>
            </Field>
            {typeof ev.payload?.challenger_role === 'string' && (
              <Field label="Raised By">
                <span className="capitalize">{String(ev.payload.challenger_role).replace(/_/g, ' ')}</span>
              </Field>
            )}
            {typeof ev.payload?.target_claim_code === 'string' && ev.payload.target_claim_code && (
              <Field label="Targets">
                <ClaimPill code={String(ev.payload.target_claim_code)} color="#b45309" onJumpToClaim={onJumpToClaim} />
              </Field>
            )}
          </>
        )}
        {ev.event_type === 'outcome_logged' && (
          <Field label="Outcome">
            "{String(ev.payload.action_item ?? '')}" — <span className="font-medium">{String(ev.payload.outcome ?? '')}</span>
          </Field>
        )}

        {ev.event_type === 'team_note' && typeof ev.payload?.text === 'string' && (
          <div className="flex items-center gap-2">
            {showAvatar && (
              <div
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: '20px', height: '20px', background: `${meta.color}18`, fontSize: '10px', fontWeight: 500, color: meta.color }}
              >
                {initialsFor(actorName)}
              </div>
            )}
            <p className="text-sm" style={{ color: 'var(--app-text-primary)', margin: 0 }}>{String(ev.payload.text)}</p>
          </div>
        )}

        {ev.event_type === 'final_decision' && showAvatar && actorName && (
          <div className="flex items-center gap-2 mt-1">
            <div
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{ width: '20px', height: '20px', background: `${meta.color}18`, fontSize: '10px', fontWeight: 500, color: meta.color }}
            >
              {initialsFor(actorName)}
            </div>
            <p className="text-sm" style={{ color: 'var(--app-text-secondary)', margin: 0 }}>{actorName}</p>
          </div>
        )}

        {ev.event_type === 'agent_analysis' && <ClaimBadges claims={claims} onJumpToClaim={onJumpToClaim} />}
      </div>
    </div>
  );
}

function DayGroup({ label, events, actorNames, claims, onJumpToClaim }: {
  label: string;
  events: DecisionEvent[];
  actorNames: Record<string, string>;
  claims: DecisionClaim[];
  onJumpToClaim: (claimCode: string) => void;
}) {
  return (
    <div className="mb-7">
      <div
        className="text-xs font-medium uppercase mb-3.5"
        style={{ color: 'var(--app-text-muted)', letterSpacing: '0.06em' }}
      >
        {label}
      </div>
      <div className="relative">
        {events.map((ev, i) => (
          <TimelineNode
            key={ev.id}
            ev={ev}
            actorNames={actorNames}
            claims={claims}
            onJumpToClaim={onJumpToClaim}
            isLast={i === events.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function NoteComposer({ onSubmit }: { onSubmit: (text: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    await onSubmit(trimmed);
    setText('');
    setPosting(false);
  };

  return (
    <div className="flex items-center gap-2 mb-6">
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
        placeholder="Add a note to this trail…"
        className="input-modern flex-1"
        style={{ fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}
      />
      <button
        onClick={handleSubmit}
        disabled={!text.trim() || posting}
        className="btn-secondary flex-shrink-0 disabled:opacity-40"
        style={{ padding: '0.5rem 0.75rem' }}
        aria-label="Post note"
      >
        <Send className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function DecisionStory({
  events, claims, actorNames, domainOwners, ownerNames, onJumpToClaim,
}: {
  events: DecisionEvent[];
  claims: DecisionClaim[];
  actorNames: Record<string, string>;
  domainOwners: DomainOwnerRow[];
  ownerNames: Record<string, string>;
  onJumpToClaim: (claimCode: string) => void;
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

      <div className="mb-5">
        {current.events.map((ev, i) => (
          <TimelineNode
            key={ev.id}
            ev={ev}
            actorNames={actorNames}
            claims={claims}
            onJumpToClaim={onJumpToClaim}
            isLast={i === current.events.length - 1}
          />
        ))}
      </div>

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

function ClaimsPanel({   claims, challenges, expandedId, setExpandedId, highlightId, claimRefs, onReverify, reverifyingId, }: {   claims: DecisionClaim[];   challenges: DecisionChallenge[];   expandedId: string | null;   setExpandedId: (id: string | null) => void;   highlightId: string | null;   claimRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;   onReverify: (claimId: string) => void;   reverifyingId: string | null; }) {   if (claims.length === 0) return null;    const challengesByClaim = new Map<string, DecisionChallenge[]>();   for (const ch of challenges) {     if (!challengesByClaim.has(ch.target_claim_id)) challengesByClaim.set(ch.target_claim_id, []);     challengesByClaim.get(ch.target_claim_id)!.push(ch);   }    const staleCount = claims.filter(c => freshnessFor(c).status === 'stale').length;    return (     <div className="mb-6 p-4" style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)' }}>       <div className="flex items-center gap-2 mb-3">         <h3 className="text-sm font-bold uppercase" style={{ color: 'var(--signal)', letterSpacing: '0.06em' }}>           Evidence IDs ({claims.length})         </h3>         <span className="text-xs ml-auto" style={{ color: 'var(--app-text-secondary)' }}>Evidence-linked, citable by code</span>       </div>       {staleCount > 0 && (         <div className="flex items-center gap-2 mb-3 p-2.5" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>           <span style={{ fontSize: '14px' }}>🔴</span>           <p className="text-xs font-medium" style={{ color: '#dc2626' }}>             This decision relies on {staleCount} piece{staleCount !== 1 ? 's' : ''} of stale evidence — worth re-verifying before committing.           </p>         </div>       )}
      <div className="space-y-2">
        {claims.map(claim => {
          const isOpen = expandedId === claim.id;
          const isHighlighted = highlightId === claim.id;
          const typeColor = CLAIM_TYPE_COLORS[claim.claim_type] || '#64748b';
          const evidenceRefs = Array.isArray(claim.evidence_refs) ? claim.evidence_refs as string[] : [];
          const assumptions = Array.isArray(claim.assumptions) ? claim.assumptions as { key: string; value: string }[] : [];
          const claimChallenges = challengesByClaim.get(claim.id) || [];
          return (
            <button
              key={claim.id}
              ref={el => { claimRefs.current[claim.id] = el; }}
              onClick={() => setExpandedId(isOpen ? null : claim.id)}
              className="w-full text-left"
              style={{
                border: isHighlighted ? `1px solid ${typeColor}` : '1px solid var(--app-border)',
                borderLeft: `3px solid ${typeColor}`,
                background: isHighlighted ? `${typeColor}0d` : 'var(--app-surface-raised, #fff)',
                boxShadow: isHighlighted ? `0 0 0 2px ${typeColor}40` : 'none',
                transition: 'background 0.3s ease, box-shadow 0.3s ease',
              }}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm">{claim.statement}</p>
                      {claimChallenges.length > 0 && (
                        <span
                          className="text-[10px] font-bold uppercase px-1.5 py-0.5 flex-shrink-0"
                          style={{ color: '#b45309', background: 'rgba(217,119,6,0.12)' }}
                        >
                          {claimChallenges.length} Challenge{claimChallenges.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>
                        {claim.agent_name} · <span className="capitalize">{claim.claim_type}</span> · {Math.round(claim.confidence * 100)}% confidence
                      </p>
                      {(() => {
                        const f = freshnessFor(claim);
                        const dot = f.status === 'current' ? '🟢' : f.status === 'aging' ? '🟡' : '🔴';
                        return (
                          <span className="text-[10px] font-bold" style={{ color: f.color }}>
                            {dot} {f.label} · verified {f.daysSinceVerified}d ago
                          </span>
                        );
                      })()}
                    </div>
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
                                                {evidenceRefs.length === 0 && assumptions.length === 0 && claimChallenges.length === 0 && (                           <p style={{ color: 'var(--app-text-secondary)' }}>No evidence or assumptions recorded for this claim.</p>                         )}                         <div className="pt-1">                           <button                             onClick={(e) => { e.stopPropagation(); onReverify(claim.id); }}                             disabled={reverifyingId === claim.id}                             className="text-xs font-semibold px-2.5 py-1.5 disabled:opacity-50"                             style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-primary)' }}                           >                             {reverifyingId === claim.id ? 'Re-verifying…' : 'Mark as re-verified today'}                           </button>                         </div>
                        {claimChallenges.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase mb-1" style={{ color: '#b45309', letterSpacing: '0.08em' }}>Challenges</p>
                            <div className="space-y-2">
                              {claimChallenges.map(ch => (
                                <div key={ch.id} className="p-2" style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)' }}>
                                  <p style={{ color: 'var(--app-text-primary)' }}>{ch.challenge_text}</p>
                                  <p className="mt-1" style={{ color: 'var(--app-text-muted)' }}>
                                    — {ch.challenger_agent_name} · <span className="capitalize">{ch.status}</span>
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
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
  const { user } = useAuth();
  const [events, setEvents] = useState<DecisionEvent[]>([]);
  const [claims, setClaims] = useState<DecisionClaim[]>([]);
  const [challenges, setChallenges] = useState<DecisionChallenge[]>([]);
  const [domainOwners, setDomainOwners] = useState<DomainOwnerRow[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [replayActive, setReplayActive] = useState(false);
  const [replayTimestamp, setReplayTimestamp] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'story'>('list');
  const [expandedClaimId, setExpandedClaimId] = useState<string | null>(null);
  const [highlightClaimId, setHighlightClaimId] = useState<string | null>(null);
  const claimRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [workspaceMeta, setWorkspaceMeta] = useState<{ decision_category: string | null; decision_status: string | null }>({ decision_category: null, decision_status: null });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase
        .from('workspaces')
        .select('decision_category, decision_status')
        .eq('id', workspaceId)
        .maybeSingle(),
      supabase
        .from('decision_events')
        .select('id, workspace_id, event_type, actor_type, actor_id, payload, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true }),
      supabase
        .from('decision_claims')
        .select('id, workspace_id, claim_code, agent_role, agent_name, statement, claim_type, evidence_refs, assumptions, confidence, created_at, last_verified_at, validity_period_days')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true }),
      supabase
        .from('decision_challenges')
        .select('id, workspace_id, target_claim_id, challenger_agent_role, challenger_agent_name, challenge_text, rebuttal_text, status, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true }),
      supabase
        .from('domain_owners')
        .select('id, domain, owner_user_id, backup_owner_user_id')
        .eq('workspace_id', workspaceId)
        .order('domain'),
    ]).then(([evRes, claimsRes, challengesRes, ownersRes]) => {
      if (cancelled) return;
      if (!evRes.error && evRes.data) setEvents(evRes.data as DecisionEvent[]);
      if (!claimsRes.error && claimsRes.data) setClaims(claimsRes.data as DecisionClaim[]);
      if (!challengesRes.error && challengesRes.data) setChallenges(challengesRes.data as DecisionChallenge[]);
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

  const dayGroups = useMemo(() => groupEventsByDay(displayedEvents), [displayedEvents]);

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

  function handleJumpToClaim(claimCode: string) {
    const claim = claims.find(c => c.claim_code === claimCode);
    if (!claim) return;
    setExpandedClaimId(claim.id);
    setHighlightClaimId(claim.id);
    requestAnimationFrame(() => {
      claimRefs.current[claim.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    window.setTimeout(() => setHighlightClaimId(null), 2200);
  }

  const [reverifyingId, setReverifyingId] = useState<string | null>(null);

    async function handleReverify(claimId: string) {
    setReverifyingId(claimId);
    try {
      const { error } = await supabase.rpc('reverify_decision_claim', { p_claim_id: claimId });
      if (!error) {
        setClaims(prev => prev.map(c => c.id === claimId ? { ...c, last_verified_at: new Date().toISOString() } : c));
      }
    } finally {
      setReverifyingId(null);
    }
  }

  function handleExportPDF() {
    const evidence = claims.map(c => {
      const f = freshnessFor(c);
      return {
        claim_code: c.claim_code,
        agent_name: c.agent_name,
        statement: c.statement,
        claim_type: c.claim_type,
        confidence: c.confidence,
        freshness: f.status,
        daysSinceVerified: f.daysSinceVerified,
      };
    });

    const events = displayedEvents.map(ev => {
      const meta = EVENT_META[ev.event_type];
      const p = ev.payload as Record<string, unknown>;
      const detail =
        (typeof p?.question === 'string' && p.question) ||
        (typeof p?.recommendation === 'string' && p.recommendation) ||
        (typeof p?.text === 'string' && p.text) ||
        (typeof p?.statement === 'string' && p.statement) ||
        (typeof p?.status === 'string' && `Status: ${p.status}`) ||
        '';
      return {
        event_type: ev.event_type,
        label: meta?.label || ev.event_type,
        created_at: ev.created_at,
        detail: String(detail).slice(0, 300),
      };
    });

    exportDecisionTrailToPDF({
      workspaceName,
      workspaceId,
      generatedAt: new Date().toISOString(),
      evidence,
      events,
    });
  }

  async function handlePostNote(text: string) {
    if (!user) return;
    const { data, error } = await supabase
      .from('decision_events')
      .insert({
        workspace_id: workspaceId,
        event_type: 'team_note',
        actor_type: 'user',
        actor_id: user.id,
        payload: { text },
      })
      .select('id, workspace_id, event_type, actor_type, actor_id, payload, created_at')
      .single();

    if (!error && data) {
      setEvents(prev => [...prev, data as DecisionEvent]);
      const displayName = user.user_metadata?.full_name || user.email || 'You';
      setActorNames(prev => ({ ...prev, [user.id]: prev[user.id] || displayName }));
    } else if (error) {
      console.error('Failed to post note:', error.message);
    }
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
            <button
              onClick={handleExportPDF}
              className="btn-secondary flex-shrink-0"
              style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
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
          onJumpToClaim={handleJumpToClaim}
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

          {!replayActive && <NoteComposer onSubmit={handlePostNote} />}

          {dayGroups.length > 0 && (
            <>
              <h3 className="text-sm font-bold uppercase mb-3" style={{ color: 'var(--app-text-secondary)', letterSpacing: '0.06em' }}>
                Audit Trail ({displayedEvents.length})
              </h3>
              {dayGroups.map(group => (
                <DayGroup
                  key={group.label}
                  label={group.label}
                  events={group.events}
                  actorNames={actorNames}
                  claims={claims}
                  onJumpToClaim={handleJumpToClaim}
                />
              ))}
            </>
          )}

        {!replayActive && (
            <ClaimsPanel
              claims={claims}
              challenges={challenges}
              expandedId={expandedClaimId}
              setExpandedId={setExpandedClaimId}
              highlightId={highlightClaimId}
              claimRefs={claimRefs}
              onReverify={handleReverify}
              reverifyingId={reverifyingId}
            />
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


