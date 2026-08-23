import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Lock, MessageSquare, Users, AlertTriangle, Pencil, Check, X, GripVertical, Link2, Trash2, ChevronDown, ChevronRight, UserCog } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSubscriptionTier } from '../hooks/useWorkspaceAccess';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MapWorkspace {
  id: string;
  name: string;
  description: string;
  plan: string;
  subscription_status: string;
  trial_workspace_expires_at: string | null;
  seats: number;
  role: string;
  owner_id: string;
  source: string;
  created_at: string;
  decision_category: string;
  decision_status: string;
}

interface DecisionLink {
  id: string;
  workspace_id: string;
  linked_workspace_id: string;
  relationship_type: 'influences' | 'depends_on' | 'conflicts_with' | 'related_to';
  note: string | null;
}

interface DecisionMapProps {
  workspaces: MapWorkspace[];
  onNavigate: (page: string, workspaceId?: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = [
  { key: 'exploring',   label: 'Exploring',   color: '#475569', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.22)', activeBg: 'rgba(100,116,139,0.18)' },
  { key: 'in_debate',   label: 'In Debate',   color: '#1d4ed8', bg: 'rgba(37,99,235,0.09)',   border: 'rgba(37,99,235,0.22)',  activeBg: 'rgba(37,99,235,0.16)'  },
  { key: 'committed',   label: 'Committed',   color: '#6d28d9', bg: 'rgba(124,58,237,0.09)',  border: 'rgba(124,58,237,0.22)', activeBg: 'rgba(124,58,237,0.16)' },
  { key: 'implemented', label: 'Implemented', color: '#047857', bg: 'rgba(5,150,105,0.09)',   border: 'rgba(5,150,105,0.22)',  activeBg: 'rgba(5,150,105,0.16)'  },
  { key: 'reviewed',    label: 'Reviewed',    color: '#92400e', bg: 'rgba(180,83,9,0.09)',    border: 'rgba(180,83,9,0.22)',   activeBg: 'rgba(180,83,9,0.16)'   },
] as const;

const CATEGORIES = [
  { key: 'strategic',   label: 'Strategic',   color: '#1e3a5f', bg: 'rgba(30,58,95,0.07)'   },
  { key: 'operational', label: 'Operational', color: '#2563eb', bg: 'rgba(37,99,235,0.07)'  },
  { key: 'people',      label: 'People',      color: '#059669', bg: 'rgba(5,150,105,0.07)'  },
  { key: 'financial',   label: 'Financial',   color: '#b45309', bg: 'rgba(180,83,9,0.07)'   },
  { key: 'product',     label: 'Product',     color: '#7c3aed', bg: 'rgba(124,58,237,0.07)' },
  { key: 'other',       label: 'Other',       color: '#64748b', bg: 'rgba(100,116,139,0.07)'},
] as const;

const RELATIONSHIP_TYPES = [
  { key: 'influences',     label: 'Influences',     color: '#2563eb', description: 'This decision shapes the other' },
  { key: 'depends_on',     label: 'Depends On',     color: '#7c3aed', description: 'This decision requires the other' },
  { key: 'conflicts_with', label: 'Conflicts With', color: '#dc2626', description: 'These decisions are in tension' },
  { key: 'related_to',    label: 'Related To',     color: '#059669', description: 'These decisions are connected' },
] as const;

function statusMeta(key: string) {
  return STATUSES.find(s => s.key === key) ?? STATUSES[0];
}
function categoryMeta(key: string) {
  return CATEGORIES.find(c => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
}
function relMeta(key: string) {
  return RELATIONSHIP_TYPES.find(r => r.key === key) ?? RELATIONSHIP_TYPES[3];
}

function healthColor(score: number | null): string {
  if (score === null) return '#cbd5e1';
  if (score >= 75) return '#16a34a';
  if (score >= 55) return '#d97706';
  if (score >= 35) return '#ea580c';
  return '#dc2626';
}

function healthLabel(score: number | null): string {
  if (score === null) return 'No analysis yet';
  if (score >= 75) return `Sharp · ${score}`;
  if (score >= 55) return `Developing · ${score}`;
  if (score >= 35) return `Fragmented · ${score}`;
  return `Critical · ${score}`;
}

// ─── Edit metadata popover ────────────────────────────────────────────────────

function usePopoverPos(anchorEl: HTMLElement | null, popoverWidth: number) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!anchorEl) return;
    const update = () => {
      const rect = anchorEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = rect.right - popoverWidth;
      if (left < 8) left = 8;
      if (left + popoverWidth > vw - 8) left = vw - popoverWidth - 8;
      // Flip above if too close to bottom
      const spaceBelow = vh - rect.bottom;
      const top = spaceBelow < 240 ? Math.max(8, rect.top - 8) : rect.bottom + 4;
      setPos({ top, left });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchorEl, popoverWidth]);

  return pos;
}

interface EditPopoverProps {
  anchorEl: HTMLElement | null;
  workspaceId: string;
  category: string;
  status: string;
  onSaved: (category: string, status: string) => void;
  onClose: () => void;
}
function EditPopover({ anchorEl, workspaceId, category, status, onSaved, onClose }: EditPopoverProps) {
  const { user } = useAuth();
  const [cat, setCat] = useState(category);
  const [sta, setSta] = useState(status);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pos = usePopoverPos(anchorEl, 256);

  async function save() {
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from('workspaces')
      .update({ decision_category: cat, decision_status: sta })
      .eq('id', workspaceId);

    if (!error) {
      onSaved(cat, sta);
      return;
    }

    // If this org requires a fresh approval before committing, offer to request one.
    if (['committed', 'implemented', 'reviewed'].includes(sta) && error.message?.includes('requires a fresh approved')) {
      setSaving(false);
      const { data: ws } = await supabase
        .from('workspaces')
        .select('organization_id')
        .eq('id', workspaceId)
        .maybeSingle();

      if (ws?.organization_id && user) {
        const wantsToRequest = window.confirm(
          'This organization requires approval before a decision can be committed. Request approval now?'
        );
        if (wantsToRequest) {
          const { error: reqError } = await supabase
            .from('decision_approvals')
            .insert({
              workspace_id: workspaceId,
              organization_id: ws.organization_id,
              requested_by: user.id,
            });
          if (!reqError) {
            setErr('Approval requested. Waiting on an org owner/admin.');
          } else {
            setErr('Could not submit the approval request.');
          }
        } else {
          setErr('Approval required to commit.');
        }
      } else {
        setErr('Approval required to commit.');
      }
      return;
    }

    setErr('Failed to save');
    setSaving(false);
  }
  if (!pos) return null;

  return createPortal(
    <div
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: Math.min(256, window.innerWidth - 16), zIndex: 9999, background: '#fff', border: '1px solid rgba(15,23,42,0.1)', borderRadius: '1rem', boxShadow: '0 20px 48px rgba(15,23,42,0.18)', padding: '1rem', maxHeight: '80vh', overflowY: 'auto' }}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <p className="text-xs font-bold text-[var(--app-text-secondary)] mb-3">Edit decision metadata</p>

      <div className="mb-3">
        <p className="text-[10px] font-semibold text-[var(--app-text-muted)] uppercase tracking-widest mb-1.5">Category</p>
        <div className="grid grid-cols-2 gap-1.5">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className="text-xs px-2 py-1.5 rounded-lg font-semibold transition-all text-left"
              style={{
                background: cat === c.key ? c.bg : 'rgba(15,23,42,0.03)',
                color: cat === c.key ? c.color : '#64748b',
                border: cat === c.key ? `1.5px solid ${c.color}40` : '1.5px solid transparent',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-[10px] font-semibold text-[var(--app-text-muted)] uppercase tracking-widest mb-1.5">Status</p>
        <div className="space-y-1">
          {STATUSES.map(s => (
            <button
              key={s.key}
              onClick={() => setSta(s.key)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all text-left flex items-center gap-2"
              style={{
                background: sta === s.key ? s.bg : 'rgba(15,23,42,0.03)',
                color: sta === s.key ? s.color : '#64748b',
                border: sta === s.key ? `1.5px solid ${s.color}40` : '1.5px solid transparent',
              }}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-none text-xs font-bold text-white transition-all disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
        >
          {saving ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3 h-3" />}
          Save
        </button>
        <button
          onClick={onClose}
          className="px-3 py-2 rounded-none text-xs font-semibold text-[var(--app-text-muted)] hover:bg-[var(--app-surface-raised)] transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>,
    document.body
  );
}

// ─── Link popover ─────────────────────────────────────────────────────────────

interface LinkPopoverProps {
  anchorEl: HTMLElement | null;
  workspaceId: string;
  workspaceName: string;
  allWorkspaces: MapWorkspace[];
  existingLinks: DecisionLink[];
  onLinked: (link: DecisionLink) => void;
  onUnlinked: (linkId: string) => void;
  onClose: () => void;
}

function LinkPopover({ anchorEl, workspaceId, workspaceName, allWorkspaces, existingLinks, onLinked, onUnlinked, onClose }: LinkPopoverProps) {
  const { user } = useAuth();
  const [targetId, setTargetId] = useState('');
  const [relType, setRelType] = useState<'influences' | 'depends_on' | 'conflicts_with' | 'related_to'>('related_to');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pos = usePopoverPos(anchorEl, 288);

  const myLinks = existingLinks.filter(
    l => l.workspace_id === workspaceId || l.linked_workspace_id === workspaceId
  );

  const linkedIds = new Set(myLinks.map(l =>
    l.workspace_id === workspaceId ? l.linked_workspace_id : l.workspace_id
  ));

  const available = allWorkspaces.filter(w => w.id !== workspaceId && !linkedIds.has(w.id) && w.source !== 'slack');

  async function createLink() {
    if (!targetId || !user) return;
    setSaving(true);
    setErr(null);
    const { data, error } = await supabase
      .from('workspace_decision_links')
      .insert({
        workspace_id: workspaceId,
        linked_workspace_id: targetId,
        relationship_type: relType,
        note: note.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) {
      setErr('Could not create connection');
      setSaving(false);
    } else {
      onLinked(data as DecisionLink);
      setTargetId('');
      setNote('');
      setSaving(false);
    }
  }

  async function removeLink(linkId: string) {
    await supabase.from('workspace_decision_links').delete().eq('id', linkId);
    onUnlinked(linkId);
  }

  if (!pos) return null;

  return createPortal(
    <div
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: Math.min(288, window.innerWidth - 16), zIndex: 9999, background: '#fff', border: '1px solid rgba(15,23,42,0.1)', borderRadius: '1rem', boxShadow: '0 20px 48px rgba(15,23,42,0.18)', padding: '1rem', maxHeight: '80vh', overflowY: 'auto' }}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-[var(--app-text-secondary)] flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-blue-500" />
          Decision Connections
        </p>
        <button onClick={onClose} className="text-slate-300 hover:text-[var(--app-text-secondary)] transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Existing links */}
      {myLinks.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-[var(--app-text-muted)] uppercase tracking-widest">Connected</p>
          {myLinks.map(link => {
            const otherId = link.workspace_id === workspaceId ? link.linked_workspace_id : link.workspace_id;
            const other = allWorkspaces.find(w => w.id === otherId);
            const rel = relMeta(link.relationship_type);
            const isSource = link.workspace_id === workspaceId;
            return (
              <div key={link.id} className="flex items-start gap-2 px-2.5 py-2 rounded-none" style={{ background: 'rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.06)' }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: rel.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-[var(--app-text-secondary)] truncate">{other?.name ?? 'Unknown workspace'}</p>
                  <p className="text-[10px]" style={{ color: rel.color }}>{isSource ? workspaceName : other?.name} {rel.label.toLowerCase()} {isSource ? other?.name : workspaceName}</p>
                  {link.note && <p className="text-[10px] text-[var(--app-text-muted)] italic truncate mt-0.5">{link.note}</p>}
                </div>
                {isSource && (
                  <button onClick={() => removeLink(link.id)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add new link */}
      {available.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-[var(--app-text-muted)] uppercase tracking-widest">Add Connection</p>

          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            className="w-full text-xs px-2.5 py-2 rounded-none border text-[var(--app-text-secondary)] focus:outline-none focus:border-blue-300"
            style={{ borderColor: 'rgba(15,23,42,0.12)', background: 'rgba(15,23,42,0.02)' }}
          >
            <option value="">Select a workspace…</option>
            {available.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>

          <div className="grid grid-cols-2 gap-1">
            {RELATIONSHIP_TYPES.map(r => (
              <button
                key={r.key}
                onClick={() => setRelType(r.key as typeof relType)}
                className="text-[10px] px-2 py-1.5 rounded-lg font-semibold transition-all text-left"
                style={{
                  background: relType === r.key ? `${r.color}14` : 'rgba(15,23,42,0.03)',
                  color: relType === r.key ? r.color : '#64748b',
                  border: relType === r.key ? `1.5px solid ${r.color}40` : '1.5px solid transparent',
                }}
                title={r.description}
              >
                {r.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Add a note (optional)…"
            className="w-full text-xs px-2.5 py-1.5 rounded-none border text-[var(--app-text-secondary)] placeholder-slate-400 focus:outline-none focus:border-blue-300"
            style={{ borderColor: 'rgba(15,23,42,0.12)' }}
          />

          {err && <p className="text-xs text-red-600">{err}</p>}

          <button
            onClick={createLink}
            disabled={!targetId || saving}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-none text-xs font-bold text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
          >
            {saving ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Link2 className="w-3 h-3" />}
            Connect
          </button>
        </div>
      ) : (
        myLinks.length === 0 && (
          <p className="text-[10px] text-[var(--app-text-muted)] text-center py-2">No other workspaces available to connect.</p>
        )
      )}
    </div>,
    document.body
  );
}

// ─── SVG connection lines ─────────────────────────────────────────────────────

interface ConnectionLine {
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  relKey: string;
  label: string;
}

function ConnectionLines({ lines }: { lines: ConnectionLine[] }) {
  if (lines.length === 0) return null;
  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, overflow: 'visible' }}
      width="100%"
      height="100%"
    >
      <defs>
        {RELATIONSHIP_TYPES.map(r => (
          <marker
            key={r.key}
            id={`arrow-${r.key}`}
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L6,3 z" fill={r.color} opacity="0.7" />
          </marker>
        ))}
      </defs>
      {lines.map((l, i) => {
        const mx = (l.x1 + l.x2) / 2;
        const my = (l.y1 + l.y2) / 2;
        return (
          <g key={i}>
            <line
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={l.color}
              strokeWidth="1.5"
              strokeOpacity="0.45"
              strokeDasharray={l.relKey === 'conflicts_with' ? '5,3' : l.relKey === 'depends_on' ? '3,2' : undefined}
              markerEnd={`url(#arrow-${l.relKey})`}
            />
            <text
              x={mx} y={my - 5}
              textAnchor="middle"
              fontSize="9"
              fill={l.color}
              opacity="0.85"
              fontWeight="600"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {l.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Ghost ────────────────────────────────────────────────────────────────────

interface GhostStyle { x: number; y: number; width: number; label: string; }

// ─── Main component ───────────────────────────────────────────────────────────

interface DomainOwnerRow {
  id: string;
  workspace_id: string;
  domain: string;
  category_key: string;
  owner_user_id: string | null;
  backup_owner_user_id: string | null;
}

interface MemberProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

export default function DecisionMap({ workspaces, onNavigate }: DecisionMapProps) {
  const { user } = useAuth();
  const { tier } = useSubscriptionTier();
  const [healthScores, setHealthScores] = useState<Record<string, number>>({});
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [localWorkspaces, setLocalWorkspaces] = useState(workspaces);
  const [links, setLinks] = useState<DecisionLink[]>([]);
  const [connectionLines, setConnectionLines] = useState<ConnectionLine[]>([]);
  const [domainOwners, setDomainOwners] = useState<DomainOwnerRow[]>([]);
  const [overrideOwners, setOverrideOwners] = useState<Record<string, string | null>>({});
  const [memberProfiles, setMemberProfiles] = useState<Record<string, MemberProfile>>({});
  const [workspaceMembers, setWorkspaceMembers] = useState<Record<string, MemberProfile[]>>({});
  const canOwn = tier === 'pro' || tier === 'team' || tier === 'business' || tier === 'enterprise';

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [ghost, setGhost] = useState<GhostStyle | null>(null);
  const dragRef = useRef<{
    wsId: string; fromStatus: string; overStatus: string | null;
    startX: number; startY: number; moved: boolean;
  } | null>(null);
  const columnRefs = useRef<Map<string, HTMLElement>>(new Map());
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalWorkspaces(workspaces); }, [workspaces]);

  // Health scores
  useEffect(() => {
    if (!user || workspaces.length === 0) return;
    const ids = workspaces.map(w => w.id);
    supabase
      .from('workspace_synthesis')
      .select('workspace_id, decision_health_score')
      .in('workspace_id', ids)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, number> = {};
        for (const row of data) map[row.workspace_id] = row.decision_health_score;
        setHealthScores(map);
      });
  }, [user, workspaces]);

  // Member counts
  useEffect(() => {
    if (!user || workspaces.length === 0) return;
    const ids = workspaces.map(w => w.id);
    supabase
      .from('workspace_members')
      .select('workspace_id')
      .in('workspace_id', ids)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, number> = {};
        for (const row of data) map[row.workspace_id] = (map[row.workspace_id] ?? 0) + 1;
        setMemberCounts(map);
      });
  }, [user, workspaces]);

  // Decision links
  useEffect(() => {
    if (!user || workspaces.length === 0) return;
    const ids = workspaces.map(w => w.id);
    supabase
      .from('workspace_decision_links')
      .select('id, workspace_id, linked_workspace_id, relationship_type, note')
      .or(`workspace_id.in.(${ids.join(',')}),linked_workspace_id.in.(${ids.join(',')})`)
      .then(({ data }) => {
        if (data) setLinks(data as DecisionLink[]);
      });
  }, [user, workspaces]);

  // Domain owners + per-workspace override + member profiles (Business+ only)
  useEffect(() => {
    if (!user || workspaces.length === 0 || !canOwn) return;
    const ids = workspaces.map(w => w.id);

    async function loadOwners() {
      const [doRes, wsRes, wmRes] = await Promise.all([
        supabase
          .from('domain_owners')
          .select('id, workspace_id, domain, category_key, owner_user_id, backup_owner_user_id')
          .in('workspace_id', ids),
        supabase
          .from('workspaces')
          .select('id, decision_owner_override_user_id')
          .in('id', ids),
        supabase
          .from('workspace_members')
          .select('workspace_id, user_id, profiles(full_name, avatar_url, username)')
          .in('workspace_id', ids),
      ]);

      if (doRes.data) setDomainOwners(doRes.data as DomainOwnerRow[]);

      if (wsRes.data) {
        const map: Record<string, string | null> = {};
        for (const row of wsRes.data) map[row.id] = row.decision_owner_override_user_id ?? null;
        setOverrideOwners(map);
      }

      if (wmRes.data) {
        const profileMap: Record<string, MemberProfile> = {};
        const byWs: Record<string, MemberProfile[]> = {};
        for (const row of wmRes.data) {
          const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          const mp: MemberProfile = {
            user_id: row.user_id,
            full_name: p?.full_name ?? null,
            avatar_url: p?.avatar_url ?? null,
            username: p?.username ?? null,
          };
          profileMap[row.user_id] = mp;
          if (!byWs[row.workspace_id]) byWs[row.workspace_id] = [];
          byWs[row.workspace_id].push(mp);
        }
        setMemberProfiles(profileMap);
        setWorkspaceMembers(byWs);
      }
    }
    loadOwners();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, workspaces, canOwn]);

  // Recompute SVG lines
  const recomputeLines = useCallback(() => {
    if (links.length === 0) { setConnectionLines([]); return; }
    const board = boardRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    const newLines: ConnectionLine[] = [];
    for (const link of links) {
      const el1 = cardRefs.current.get(link.workspace_id);
      const el2 = cardRefs.current.get(link.linked_workspace_id);
      if (!el1 || !el2) continue;
      const r1 = el1.getBoundingClientRect();
      const r2 = el2.getBoundingClientRect();
      const x1 = r1.left + r1.width / 2 - boardRect.left;
      const y1 = r1.top + r1.height / 2 - boardRect.top;
      const x2 = r2.left + r2.width / 2 - boardRect.left;
      const y2 = r2.top + r2.height / 2 - boardRect.top;
      const rel = relMeta(link.relationship_type);
      newLines.push({ x1, y1, x2, y2, color: rel.color, relKey: link.relationship_type, label: rel.label });
    }
    setConnectionLines(newLines);
  }, [links]);

  useEffect(() => {
    recomputeLines();
    const t = setTimeout(recomputeLines, 150);
    return () => clearTimeout(t);
  }, [recomputeLines, localWorkspaces]);

  useEffect(() => {
    window.addEventListener('resize', recomputeLines);
    return () => window.removeEventListener('resize', recomputeLines);
  }, [recomputeLines]);

  function handleMetaUpdated(id: string, category: string, status: string) {
    setLocalWorkspaces(prev =>
      prev.map(w => w.id === id ? { ...w, decision_category: category, decision_status: status } : w)
    );
  }

  function handleLinked(link: DecisionLink) {
    setLinks(prev => [...prev.filter(l => l.id !== link.id), link]);
    setTimeout(recomputeLines, 100);
  }

  function handleUnlinked(linkId: string) {
    setLinks(prev => prev.filter(l => l.id !== linkId));
  }

    async function saveStatusChange(wsId: string, newStatus: string) {
    const { error } = await supabase
      .from('workspaces')
      .update({ decision_status: newStatus })
      .eq('id', wsId);
    if (!error) {
      setLocalWorkspaces(prev =>
        prev.map(w => w.id === wsId ? { ...w, decision_status: newStatus } : w)
      );
      setTimeout(recomputeLines, 200);
      return;
    }

    // If this org requires a fresh approval before a decision is locked in
    // (committed, implemented, or reviewed), offer to request one instead
    // of silently failing.
    if (['committed', 'implemented', 'reviewed'].includes(newStatus) && error.message?.includes('requires a fresh approved')) {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('organization_id')
        .eq('id', wsId)
        .maybeSingle();

      if (ws?.organization_id && user) {
        const wantsToRequest = window.confirm(
          'This organization requires approval before a decision can be committed. Request approval now?'
        );
        if (wantsToRequest) {
          const { error: reqError } = await supabase
            .from('decision_approvals')
            .insert({
              workspace_id: wsId,
              organization_id: ws.organization_id,
              requested_by: user.id,
            });
          if (!reqError) {
            window.alert('Approval requested. An organization owner or admin will need to approve it before this decision can be committed.');
          } else {
            window.alert('Could not submit the approval request. Please try again.');
          }
        }
      }
      return;
    }

    if (error.message) {
      window.alert(error.message);
    }
  }

  function getStatusFromPoint(x: number, y: number): string | null {
    for (const [status, el] of columnRefs.current) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return status;
    }
    return null;
  }

  const startDrag = useCallback((e: React.PointerEvent, ws: MapWorkspace) => {
    if (ws.source === 'slack') return;
    e.preventDefault();
    const cardEl = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-card-id]');
    const width = cardEl ? cardEl.getBoundingClientRect().width : 220;
    dragRef.current = { wsId: ws.id, fromStatus: ws.decision_status, overStatus: ws.decision_status, startX: e.clientX, startY: e.clientY, moved: false };
    setDraggingId(ws.id);
    setDragOverStatus(ws.decision_status);
    setGhost({ x: e.clientX, y: e.clientY, width, label: ws.name });
  }, []);

  useEffect(() => {
    if (!draggingId) return;
    function onMove(e: PointerEvent) {
      if (!dragRef.current) return;
      dragRef.current.moved = true;
      setGhost(g => g ? { ...g, x: e.clientX, y: e.clientY } : g);
      const over = getStatusFromPoint(e.clientX, e.clientY);
      dragRef.current.overStatus = over;
      setDragOverStatus(over);
    }
    function onUp() {
      if (!dragRef.current) return;
      const { wsId, fromStatus, overStatus, moved } = dragRef.current;
      dragRef.current = null;
      setDraggingId(null);
      setDragOverStatus(null);
      setGhost(null);
      if (moved && overStatus && overStatus !== fromStatus) saveStatusChange(wsId, overStatus);
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId]);

  function getLinkCount(wsId: string): number {
    return links.filter(l => l.workspace_id === wsId || l.linked_workspace_id === wsId).length;
  }

  function getOwnerFor(ws: MapWorkspace): { userId: string | null; name: string; avatarUrl: string | null } | null {
    if (!canOwn) return null;
    const override = overrideOwners[ws.id];
    let ownerId: string | null = null;
    if (override) {
      ownerId = override;
    } else {
      const match = domainOwners.find(d => d.workspace_id === ws.id && d.category_key === ws.decision_category);
      ownerId = match?.owner_user_id ?? match?.backup_owner_user_id ?? null;
    }
    if (!ownerId) return null;
    const p = memberProfiles[ownerId];
    if (!p) return null;
    return {
      userId: ownerId,
      name: p.full_name || p.username || 'Member',
      avatarUrl: p.avatar_url,
    };
  }

  async function handleReassign(wsId: string, userId: string | null) {
    const { error } = await supabase
      .from('workspaces')
      .update({ decision_owner_override_user_id: userId })
      .eq('id', wsId);
    if (!error) {
      setOverrideOwners(prev => ({ ...prev, [wsId]: userId }));
    }
  }

  const appWorkspaces = localWorkspaces.filter(w => w.source !== 'slack');

  if (appWorkspaces.length === 0) {
    return (
      <div className="rounded-none p-12 text-center" style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
        <p className="text-[var(--app-text-muted)] text-sm">No workspaces to map yet.</p>
      </div>
    );
  }

  const avgHealth = (() => {
    const scored = appWorkspaces.filter(w => healthScores[w.id] !== undefined);
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((s, w) => s + healthScores[w.id], 0) / scored.length);
  })();

  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s.key] = appWorkspaces.filter(w => w.decision_status === s.key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6" style={{ cursor: draggingId ? 'grabbing' : undefined }}>

      {/* Ghost */}
      {ghost && draggingId && (
        <div style={{ position: 'fixed', left: ghost.x, top: ghost.y, transform: 'translate(-50%, -50%) rotate(2deg)', width: ghost.width, pointerEvents: 'none', zIndex: 9999, background: '#fff', borderRadius: '1rem', boxShadow: '0 24px 48px rgba(15,23,42,0.22)', border: '1.5px solid rgba(37,99,235,0.3)', padding: '0.75rem 1rem' }}>
          <p className="text-xs font-bold text-slate-800 truncate">{ghost.label}</p>
          {dragOverStatus && <p className="text-[10px] mt-0.5 font-semibold" style={{ color: statusMeta(dragOverStatus).color }}>→ {statusMeta(dragOverStatus).label}</p>}
        </div>
      )}

      {/* Portfolio summary bar */}
      <div className="rounded-none px-4 sm:px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4" style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
        <div className="col-span-2 sm:col-span-1 flex items-center gap-3 sm:border-r sm:border-slate-100 sm:pr-4">
          <div className="w-10 h-10 rounded-none flex items-center justify-center font-black text-sm" style={{ background: avgHealth !== null ? `${healthColor(avgHealth)}18` : 'rgba(15,23,42,0.05)', color: avgHealth !== null ? healthColor(avgHealth) : '#94a3b8' }}>
            {avgHealth ?? '—'}
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--app-text-muted)] uppercase tracking-widest">Portfolio Health</p>
            <p className="text-xs font-semibold text-[var(--app-text-secondary)]">{avgHealth === null ? 'No analysis' : avgHealth >= 75 ? 'Sharp' : avgHealth >= 55 ? 'Developing' : avgHealth >= 35 ? 'Fragmented' : 'Critical'}</p>
          </div>
        </div>
        {STATUSES.map(s => (
          <div key={s.key} className="flex flex-col gap-1">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: s.color }}>{s.label}</p>
            <p className="text-lg font-black text-slate-800">{statusCounts[s.key]}</p>
          </div>
        ))}
      </div>

      {/* Active connection legend */}
      {links.length > 0 && (
        <div className="rounded-none px-5 py-3 flex items-center gap-4 flex-wrap" style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.07)' }}>
          <span className="text-[10px] font-bold text-[var(--app-text-muted)] uppercase tracking-widest">Connections:</span>
          {RELATIONSHIP_TYPES.map(r => {
            const count = links.filter(l => l.relationship_type === r.key).length;
            if (count === 0) return null;
            return (
              <div key={r.key} className="flex items-center gap-1.5">
                <span className="w-4 h-0 inline-block border-t" style={{ borderColor: r.color, borderTopWidth: '1.5px', opacity: 0.7, borderStyle: r.key === 'conflicts_with' ? 'dashed' : r.key === 'depends_on' ? 'dotted' : 'solid' }} />
                <span className="text-[10px] font-semibold" style={{ color: r.color }}>{r.label}</span>
                <span className="text-[10px] text-[var(--app-text-muted)]">({count})</span>
              </div>
            );
          })}
          <span className="text-[10px] text-[var(--app-text-muted)] ml-auto">{links.length} total</span>
        </div>
      )}

      {/* Health legend */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] font-bold text-[var(--app-text-muted)] uppercase tracking-widest mr-1">Health:</span>
        {[
          { label: 'Sharp ≥75', color: '#16a34a' },
          { label: 'Developing ≥55', color: '#d97706' },
          { label: 'Fragmented ≥35', color: '#ea580c' },
          { label: 'Critical', color: '#dc2626' },
          { label: 'No analysis', color: '#cbd5e1' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5 mr-3">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }} />
            <span className="text-[10px] text-[var(--app-text-muted)]">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Kanban board — horizontal on md+, vertical accordion on mobile */}
      <div ref={boardRef} className="relative">
        <ConnectionLines lines={connectionLines} />

        {/* Desktop: horizontal kanban */}
        <div className="hidden md:flex gap-4 pb-2 overflow-x-auto">
          {STATUSES.map(s => {
            const col = appWorkspaces.filter(w => w.decision_status === s.key);
            const isDropTarget = draggingId !== null && dragOverStatus === s.key;

            return (
              <div
                key={s.key}
                ref={el => { if (el) columnRefs.current.set(s.key, el); else columnRefs.current.delete(s.key); }}
                className="flex-1 rounded-none p-3 space-y-4 transition-all duration-150"
                style={{
                  background: isDropTarget ? s.activeBg : s.bg,
                  border: isDropTarget ? `2px solid ${s.color}60` : `1px solid ${s.border}`,
                  minWidth: '240px',
                  transform: isDropTarget ? 'scale(1.01)' : 'scale(1)',
                  boxShadow: isDropTarget ? `0 0 0 4px ${s.color}14` : 'none',
                }}
              >
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    <span className="text-xs font-bold" style={{ color: s.color }}>{s.label}</span>
                  </div>
                  <span className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center" style={{ background: `${s.color}20`, color: s.color }}>
                    {col.length}
                  </span>
                </div>

                {isDropTarget && col.filter(w => w.id !== draggingId).length === 0 && col.length === 0 && (
                  <div className="rounded-none py-5 text-center" style={{ border: `2px dashed ${s.color}50`, background: `${s.color}08` }}>
                    <p className="text-[10px] font-semibold" style={{ color: s.color }}>Drop here</p>
                  </div>
                )}

                {col.length === 0 && !isDropTarget ? (
                  <div className="rounded-none py-6 text-center" style={{ border: `1.5px dashed ${s.border}`, background: 'rgba(255,255,255,0.5)' }}>
                    <p className="text-[10px] text-[var(--app-text-muted)]">No decisions here</p>
                  </div>
                ) : (
                  col.map(ws => (
                    <div
                      key={ws.id}
                      data-card-id={ws.id}
                      ref={el => { if (el) cardRefs.current.set(ws.id, el); else cardRefs.current.delete(ws.id); }}
                    >
                      <DecisionCard
                        ws={ws}
                        healthScore={healthScores[ws.id] ?? null}
                        memberCount={memberCounts[ws.id] ?? 0}
                        linkCount={getLinkCount(ws.id)}
                        isDragging={draggingId === ws.id}
                        allWorkspaces={appWorkspaces}
                        existingLinks={links}
                        onNavigate={onNavigate}
                        onMetaUpdated={handleMetaUpdated}
                        onDragStart={startDrag}
                        onLinked={handleLinked}
                        onUnlinked={handleUnlinked}
                        ownerInfo={getOwnerFor(ws)}
                        canReassign={canOwn && (ws.role === 'owner' || ws.role === 'admin')}
                        reassignMembers={workspaceMembers[ws.id] ?? []}
                        onReassign={handleReassign}
                      />
                    </div>
                  ))
                )}

                {isDropTarget && col.length > 0 && (
                  <div className="rounded-none py-3 text-center" style={{ border: `2px dashed ${s.color}50`, background: `${s.color}08` }}>
                    <p className="text-[10px] font-semibold" style={{ color: s.color }}>Drop here</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile: vertical accordion per status */}
        <div className="flex flex-col gap-3 md:hidden">
          {STATUSES.map(s => {
            const col = appWorkspaces.filter(w => w.decision_status === s.key);
            return (
              <MobileStatusSection
                key={s.key}
                status={s}
                workspaces={col}
                healthScores={healthScores}
                memberCounts={memberCounts}
                links={links}
                allWorkspaces={appWorkspaces}
                onNavigate={onNavigate}
                onMetaUpdated={handleMetaUpdated}
                onLinked={handleLinked}
                onUnlinked={handleUnlinked}
                cardRefs={cardRefs}
                getOwnerFor={getOwnerFor}
                canOwn={canOwn}
                workspaceMembers={workspaceMembers}
                onReassign={handleReassign}
              />
            );
          })}
        </div>
      </div>

      {/* Category legend */}
      <div className="rounded-none px-5 py-4" style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.07)' }}>
        <p className="text-[10px] font-bold text-[var(--app-text-muted)] uppercase tracking-widest mb-3">Decision Categories</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => {
            const count = appWorkspaces.filter(w => w.decision_category === c.key).length;
            return (
              <div key={c.key} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: c.bg }}>
                <span className="text-xs font-semibold" style={{ color: c.color }}>{c.label}</span>
                <span className="text-[10px] font-bold text-[var(--app-text-muted)]">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="hidden md:block text-[10px] text-[var(--app-text-muted)] text-center">
        Drag cards between stages · Hover a card to use the <Link2 className="w-2.5 h-2.5 inline" /> icon to connect decisions · Use <Pencil className="w-2.5 h-2.5 inline" /> to edit category or status
      </p>
      <p className="md:hidden text-[10px] text-[var(--app-text-muted)] text-center">
        Tap <Link2 className="w-2.5 h-2.5 inline" /> to connect decisions · Tap <Pencil className="w-2.5 h-2.5 inline" /> to edit category or status
      </p>
    </div>
  );
}

// ─── Mobile status accordion section ─────────────────────────────────────────

interface MobileStatusSectionProps {
  status: typeof STATUSES[number];
  workspaces: MapWorkspace[];
  healthScores: Record<string, number>;
  memberCounts: Record<string, number>;
  links: DecisionLink[];
  allWorkspaces: MapWorkspace[];
  onNavigate: (page: string, id?: string) => void;
  onMetaUpdated: (id: string, category: string, status: string) => void;
  onLinked: (link: DecisionLink) => void;
  onUnlinked: (linkId: string) => void;
  cardRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  getOwnerFor: (ws: MapWorkspace) => { userId: string | null; name: string; avatarUrl: string | null } | null;
  canOwn: boolean;
  workspaceMembers: Record<string, MemberProfile[]>;
  onReassign: (wsId: string, userId: string | null) => void;
}

function MobileStatusSection({ status: s, workspaces: col, healthScores, memberCounts, links, allWorkspaces, onNavigate, onMetaUpdated, onLinked, onUnlinked, cardRefs, getOwnerFor, canOwn, workspaceMembers, onReassign }: MobileStatusSectionProps) {
  const [open, setOpen] = useState(col.length > 0);

  useEffect(() => {
    if (col.length > 0) setOpen(true);
  }, [col.length]);

  function getLinkCount(wsId: string) {
    return links.filter(l => l.workspace_id === wsId || l.linked_workspace_id === wsId).length;
  }

  return (
    <div
      className="rounded-none overflow-hidden transition-all"
      style={{ border: `1px solid ${open ? s.border : 'rgba(15,23,42,0.06)'}`, background: s.bg }}
    >
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
          <span className="text-sm font-bold" style={{ color: s.color }}>{s.label}</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${s.color}20`, color: s.color }}>{col.length}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-[var(--app-text-muted)]" /> : <ChevronRight className="w-4 h-4 text-[var(--app-text-muted)]" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-4">
          {col.length === 0 ? (
            <div className="rounded-none py-5 text-center" style={{ border: `1.5px dashed ${s.border}`, background: 'rgba(255,255,255,0.5)' }}>
              <p className="text-[10px] text-[var(--app-text-muted)]">No decisions here</p>
            </div>
          ) : (
            col.map(ws => (
              <div
                key={ws.id}
                data-card-id={ws.id}
                ref={el => { if (el) cardRefs.current.set(ws.id, el); else cardRefs.current.delete(ws.id); }}
              >
                <DecisionCard
                  ws={ws}
                  healthScore={healthScores[ws.id] ?? null}
                  memberCount={memberCounts[ws.id] ?? 0}
                  linkCount={getLinkCount(ws.id)}
                  isDragging={false}
                  allWorkspaces={allWorkspaces}
                  existingLinks={links}
                  onNavigate={onNavigate}
                  onMetaUpdated={onMetaUpdated}
                  onDragStart={() => {}}
                  onLinked={onLinked}
                  onUnlinked={onUnlinked}
                  isMobile
                  ownerInfo={getOwnerFor(ws)}
                  canReassign={canOwn && (ws.role === 'owner' || ws.role === 'admin')}
                  reassignMembers={workspaceMembers[ws.id] ?? []}
                  onReassign={onReassign}
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Card (defined after main to avoid forward-ref issues) ────────────────────

interface CardProps {
  ws: MapWorkspace;
  healthScore: number | null;
  memberCount: number;
  linkCount: number;
  isDragging: boolean;
  allWorkspaces: MapWorkspace[];
  existingLinks: DecisionLink[];
  onNavigate: (page: string, id?: string) => void;
  onMetaUpdated: (id: string, category: string, status: string) => void;
  onDragStart: (e: React.PointerEvent, ws: MapWorkspace) => void;
  onLinked: (link: DecisionLink) => void;
  onUnlinked: (linkId: string) => void;
  isMobile?: boolean;
  ownerInfo: { userId: string | null; name: string; avatarUrl: string | null } | null;
  canReassign: boolean;
  reassignMembers: MemberProfile[];
  onReassign: (wsId: string, userId: string | null) => void;
}

function ReassignPopover({ anchorEl, members, currentUserId, onReassign, wsId, onClose }: {
  anchorEl: HTMLElement | null;
  members: MemberProfile[];
  currentUserId: string | null;
  onReassign: (wsId: string, userId: string | null) => void;
  wsId: string;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const pos = usePopoverPos(anchorEl, 224);
  if (!pos) return null;

  async function pick(userId: string | null) {
    setSaving(true);
    await onReassign(wsId, userId);
    setSaving(false);
    onClose();
  }

  return createPortal(
    <div
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: Math.min(224, window.innerWidth - 16), zIndex: 9999, background: '#fff', border: '1px solid rgba(15,23,42,0.1)', borderRadius: '1rem', boxShadow: '0 20px 48px rgba(15,23,42,0.18)', padding: '0.75rem', maxHeight: '70vh', overflowY: 'auto' }}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <p className="text-xs font-bold text-[var(--app-text-secondary)] mb-2 flex items-center gap-1.5"><UserCog className="w-3 h-3" /> Reassign owner</p>
      <p className="text-[10px] text-[var(--app-text-muted)] mb-2">Overrides the domain default for this card only.</p>
      <div className="space-y-1">
        <button
          onClick={() => pick(null)}
          disabled={saving}
          className="w-full text-xs px-2 py-1.5 rounded-lg font-semibold text-left flex items-center gap-2 transition-colors hover:bg-[var(--app-surface-raised)]"
          style={{ color: '#64748b', background: currentUserId === null ? 'rgba(100,116,139,0.08)' : 'transparent' }}
        >
          <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-[var(--app-text-muted)]">—</span>
          Use domain default
        </button>
        {members.map(m => (
          <button
            key={m.user_id}
            onClick={() => pick(m.user_id)}
            disabled={saving}
            className="w-full text-xs px-2 py-1.5 rounded-lg font-semibold text-left flex items-center gap-2 transition-colors hover:bg-[var(--app-surface-raised)]"
            style={{ color: '#334155', background: currentUserId === m.user_id ? 'rgba(37,99,235,0.08)' : 'transparent' }}
          >
            {m.avatar_url
              ? <img src={m.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
              : <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-[var(--app-text-secondary)] flex-shrink-0">{(m.full_name || m.username || 'M')[0].toUpperCase()}</span>}
            <span className="truncate">{m.full_name || m.username || 'Member'}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}

function DecisionCard({ ws, healthScore, memberCount, linkCount, isDragging, allWorkspaces, existingLinks, onNavigate, onMetaUpdated, onDragStart, onLinked, onUnlinked, isMobile = false, ownerInfo, canReassign, reassignMembers, onReassign }: CardProps) {
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const linkBtnRef = useRef<HTMLButtonElement>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const reassignBtnRef = useRef<HTMLButtonElement>(null);
  const cat = categoryMeta(ws.decision_category);
  const isOwnerOrAdmin = ws.role === 'owner' || ws.role === 'admin';
  const isSlack = ws.source === 'slack';
  const isExpired = ws.subscription_status === 'inactive';

  return (
    <div
      className={`relative group rounded-none transition-all duration-150 border  ${
        isDragging
          ? '!border-transparent !shadow-none'
          : isMobile
            ? 'border-[var(--app-border)] active:scale-[0.98] active:bg-[var(--app-bg)] active:border-slate-300'
            : 'border-[var(--app-border)] hover: hover:-translate-y-0.5 hover:border-slate-300'
      }`}
      style={{
        background: '#fff',
        opacity: isDragging ? 0.35 : isExpired ? 0.65 : 1,
        cursor: isMobile ? 'default' : isDragging ? 'grabbing' : 'grab',
        touchAction: isMobile ? 'auto' : 'none',
        userSelect: 'none',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: healthScore !== null ? healthColor(healthScore) : 'transparent' }} />

      <div
        className="p-4 min-h-[52px]"
        onPointerDown={e => {
          if ((e.target as HTMLElement).closest('button')) return;
          onDragStart(e, ws);
        }}
        onClick={() => { if (!editing && !linking && !reassigning) onNavigate('workspace-hub', ws.id); }}
      >
        <div className="flex items-start gap-2 mb-3">
          <GripVertical className="w-3.5 h-3.5 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: '#64748b' }} />

          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: isSlack ? 'rgba(74,21,75,0.09)' : isExpired ? 'rgba(100,116,139,0.1)' : 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}>
            {isSlack ? <MessageSquare className="w-3.5 h-3.5" style={{ color: '#4a154b' }} /> : <Lock className={`w-3.5 h-3.5 ${isExpired ? 'text-[var(--app-text-muted)]' : 'text-white'}`} />}
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold leading-snug ${isExpired ? 'text-[var(--app-text-muted)]' : 'text-slate-800'}`}>{ws.name}</p>
            {ws.description && <p className="text-xs text-[var(--app-text-secondary)] leading-snug mt-0.5 line-clamp-2">{ws.description}</p>}
          </div>

          {isOwnerOrAdmin && !isSlack && (
            <div className="flex-shrink-0 flex items-center gap-0.5">
              <button
                ref={linkBtnRef}
                onClick={e => { e.stopPropagation(); setLinking(v => !v); setEditing(false); }}
                className={`flex items-center justify-center rounded-lg transition-colors ${
                  isMobile
                    ? 'w-9 h-9 opacity-70 active:bg-[var(--app-surface-raised)]'
                    : 'w-7 h-7 opacity-0 group-hover:opacity-100 hover:bg-[var(--app-surface-raised)]'
                }`
                }
                style={{ color: linking ? '#1d4ed8' : '#64748b' }}
                title="Connect to another decision"
              >
                <Link2 className="w-3.5 h-3.5" />
              </button>
              {linking && (
                <LinkPopover
                  anchorEl={linkBtnRef.current}
                  workspaceId={ws.id}
                  workspaceName={ws.name}
                  allWorkspaces={allWorkspaces}
                  existingLinks={existingLinks}
                  onLinked={link => { onLinked(link); }}
                  onUnlinked={onUnlinked}
                  onClose={() => setLinking(false)}
                />
              )}
              <button
                ref={editBtnRef}
                onClick={e => { e.stopPropagation(); setEditing(v => !v); setLinking(false); }}
                className={`flex items-center justify-center rounded-lg transition-colors ${
                  isMobile
                    ? 'w-9 h-9 opacity-70 active:bg-[var(--app-surface-raised)] text-[var(--app-text-muted)]'
                    : 'w-7 h-7 opacity-0 group-hover:opacity-100 text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-raised)]'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {editing && (
                <EditPopover
                  anchorEl={editBtnRef.current}
                  workspaceId={ws.id}
                  category={ws.decision_category}
                  status={ws.decision_status}
                  onSaved={(cat, sta) => { setEditing(false); onMetaUpdated(ws.id, cat, sta); }}
                  onClose={() => setEditing(false)}
                />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ background: cat.bg, color: cat.color, borderColor: `${cat.color}35` }}>{cat.label}</span>
          {isExpired && <span className="text-[10px] font-semibold text-red-500 flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" />Expired</span>}
          {ownerInfo && (
            <div className="flex items-center gap-1 ml-auto" title={`Owner: ${ownerInfo.name}`}>
              {ownerInfo.avatarUrl
                ? <img src={ownerInfo.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                : <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[7px] font-bold text-[var(--app-text-secondary)]">{ownerInfo.name[0].toUpperCase()}</span>}
              <span className="text-[10px] font-semibold text-[var(--app-text-secondary)]">{ownerInfo.name}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" title={healthLabel(healthScore)}>
            <span
              className="inline-flex items-center justify-center min-w-[26px] h-5 px-1.5 rounded-md text-[10px] font-bold"
              style={{
                background: healthScore !== null ? `${healthColor(healthScore)}18` : 'rgba(15,23,42,0.06)',
                color: healthScore !== null ? healthColor(healthScore) : '#64748b',
              }}
            >
              {healthScore !== null ? healthScore : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[var(--app-text-secondary)]">
            <Users className="w-3 h-3" />
            <span className="text-[10px] font-semibold">{memberCount}</span>
          </div>
          {linkCount > 0 && (
            <div
              className="flex items-center gap-1 ml-auto px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}
              title={`${linkCount} connected decision${linkCount > 1 ? 's' : ''}`}
            >
              <Link2 className="w-2.5 h-2.5" />
              <span className="text-[10px] font-bold">{linkCount}</span>
            </div>
          )}
          {canReassign && !isSlack && (
            <button
              ref={reassignBtnRef}
              onClick={e => { e.stopPropagation(); setReassigning(v => !v); setEditing(false); setLinking(false); }}
              className={`flex items-center justify-center rounded-lg transition-colors ${
                isMobile
                  ? 'w-9 h-9 opacity-70 active:bg-[var(--app-surface-raised)]'
                  : 'w-7 h-7 opacity-0 group-hover:opacity-100 hover:bg-[var(--app-surface-raised)]'
              }`}
              style={{ color: reassigning ? '#1d4ed8' : '#64748b' }}
              title="Reassign owner"
            >
              <UserCog className="w-3.5 h-3.5" />
            </button>
          )}
          {reassigning && (
            <ReassignPopover
              anchorEl={reassignBtnRef.current}
              members={reassignMembers}
              currentUserId={ownerInfo?.userId ?? null}
              onReassign={onReassign}
              wsId={ws.id}
              onClose={() => setReassigning(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
