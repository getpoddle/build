import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
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

const EVENT_LABELS: Record<string, string> = {
  decision_created: 'Decision created',
  evidence_added: 'Evidence added',
  agent_analysis: 'Agent analysis',
  challenge_raised: 'Challenge raised',
  human_override: 'Human override',
  final_decision: 'Final decision',
  outcome_logged: 'Outcome logged',
};

function TimelineView({ workspaceId, workspaceName, onBack }: { workspaceId: string; workspaceName: string; onBack: () => void }) {
  const [events, setEvents] = useState<DecisionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from('decision_events')
      .select('id, workspace_id, event_type, actor_type, actor_id, payload, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setEvents(data as DecisionEvent[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [workspaceId]);

  useEffect(() => {
    const userActorIds = [...new Set(events.filter(e => e.actor_type === 'user' && e.actor_id).map(e => e.actor_id as string))];
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
      });
  }, [events]);

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
      <h2 className="display-heading text-xl mb-6">{workspaceName}</h2>

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

      {!loading && events.length > 0 && (
        <div className="space-y-0">
          {events.map((ev, i) => (
            <div key={ev.id} className="flex gap-3">
              <div className="flex flex-col items-center" style={{ width: 20 }}>
                <div className="rounded-full" style={{ width: 10, height: 10, background: 'var(--signal)', marginTop: 4 }} />
                {i < events.length - 1 && (
                  <div style={{ width: 1, flex: 1, background: 'var(--app-border)', marginTop: 2 }} />
                )}
              </div>
              <div style={{ paddingBottom: 20, flex: 1 }}>
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
                    {String(ev.payload.recommendation).slice(0, 200)}
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
                    {ev.payload.field === 'name_and_description' && (
                      <p>Updated name and description</p>
                    )}
                    {ev.payload.field === 'member_role' && (
                      <p>Role: {String(ev.payload.before)} → {String(ev.payload.after)}</p>
                    )}
                    {ev.payload.field === 'member_removed' && (
                      <p>Removed a {String(ev.payload.role || 'member')}</p>
                    )}
                    {ev.payload.field === 'organization' && (
                      <p>{ev.payload.action === 'linked' ? 'Linked to an organization' : 'Unlinked from organization'}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
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
