import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, MessageSquare, Users, AlertTriangle, Pencil, Check, X, GripVertical, Link2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
  { key: 'exploring',   label: 'Exploring',   color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.18)', activeBg: 'rgba(100,116,139,0.16)' },
  { key: 'in_debate',   label: 'In Debate',   color: '#2563eb', bg: 'rgba(37,99,235,0.06)',   border: 'rgba(37,99,235,0.15)',  activeBg: 'rgba(37,99,235,0.14)'  },
  { key: 'committed',   label: 'Committed',   color: '#7c3aed', bg: 'rgba(124,58,237,0.06)',  border: 'rgba(124,58,237,0.15)', activeBg: 'rgba(124,58,237,0.14)' },
  { key: 'implemented', label: 'Implemented', color: '#059669', bg: 'rgba(5,150,105,0.06)',   border: 'rgba(5,150,105,0.15)',  activeBg: 'rgba(5,150,105,0.14)'  },
  { key: 'reviewed',    label: 'Reviewed',    color: '#b45309', bg: 'rgba(180,83,9,0.06)',    border: 'rgba(180,83,9,0.15)',   activeBg: 'rgba(180,83,9,0.14)'   },
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

interface EditPopoverProps {
  workspaceId: string;
  category: string;
  status: string;
  onSaved: (category: string, status: string) => void;
  onClose: () => void;
}

function EditPopover({ workspaceId, category, status, onSaved, onClose }: EditPopoverProps) {
  const [cat, setCat] = useState(category);
  const [sta, setSta] = useState(status);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from('workspaces')
      .update({ decision_category: cat, decision_status: sta })
      .eq('id', workspaceId);
    if (error) {
      setErr('Failed to save');
      setSaving(false);
    } else {
      onSaved(cat, sta);
    }
  }

  return (
    <div
      className="absolute top-9 right-0 z-30 rounded-2xl shadow-xl p-4 w-64"
      style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.1)' }}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <p className="text-xs font-bold text-slate-700 mb-3">Edit decision metadata</p>

      <div className="mb-3">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Category</p>
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
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Status</p>
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
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
        >
          {saving ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3 h-3" />}
          Save
        </button>
        <button
          onClick={onClose}
          className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Link popover ─────────────────────────────────────────────────────────────

interface LinkPopoverProps {
  workspaceId: string;
  workspaceName: string;
  allWorkspaces: MapWorkspace[];
  existingLinks: DecisionLink[];
  onLinked: (link: DecisionLink) => void;
  onUnlinked: (linkId: string) => void;
  onClose: () => void;
}

function LinkPopover({ workspaceId, workspaceName, allWorkspaces, existingLinks, onLinked, onUnlinked, onClose }: LinkPopoverProps) {
  const { user } = useAuth();
  const [targetId, setTargetId] = useState('');
  const [relType, setRelType] = useState<'influences' | 'depends_on' | 'conflicts_with' | 'related_to'>('related_to');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  return (
    <div
      className="absolute top-9 right-0 z-30 rounded-2xl shadow-xl p-4 w-72"
      style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.1)' }}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-blue-500" />
          Decision Connections
        </p>
        <button onClick={onClose} className="text-slate-300 hover:text-slate-600 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Existing links */}
      {myLinks.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Connected</p>
          {myLinks.map(link => {
            const otherId = link.workspace_id === workspaceId ? link.linked_workspace_id : link.workspace_id;
            const other = allWorkspaces.find(w => w.id === otherId);
            const rel = relMeta(link.relationship_type);
            const isSource = link.workspace_id === workspaceId;
            return (
              <div key={link.id} className="flex items-start gap-2 px-2.5 py-2 rounded-xl" style={{ background: 'rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.06)' }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: rel.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-700 truncate">{other?.name ?? 'Unknown workspace'}</p>
                  <p className="text-[10px]" style={{ color: rel.color }}>{isSource ? workspaceName : other?.name} {rel.label.toLowerCase()} {isSource ? other?.name : workspaceName}</p>
                  {link.note && <p className="text-[10px] text-slate-400 italic truncate mt-0.5">{link.note}</p>}
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
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Add Connection</p>

          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            className="w-full text-xs px-2.5 py-2 rounded-xl border text-slate-700 focus:outline-none focus:border-blue-300"
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
            className="w-full text-xs px-2.5 py-1.5 rounded-xl border text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-300"
            style={{ borderColor: 'rgba(15,23,42,0.12)' }}
          />

          {err && <p className="text-xs text-red-600">{err}</p>}

          <button
            onClick={createLink}
            disabled={!targetId || saving}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
          >
            {saving ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Link2 className="w-3 h-3" />}
            Connect
          </button>
        </div>
      ) : (
        myLinks.length === 0 && (
          <p className="text-[10px] text-slate-400 text-center py-2">No other workspaces available to connect.</p>
        )
      )}
    </div>
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

export default function DecisionMap({ workspaces, onNavigate }: DecisionMapProps) {
  const { user } = useAuth();
  const [healthScores, setHealthScores] = useState<Record<string, number>>({});
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [localWorkspaces, setLocalWorkspaces] = useState(workspaces);
  const [links, setLinks] = useState<DecisionLink[]>([]);
  const [connectionLines, setConnectionLines] = useState<ConnectionLine[]>([]);

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

  const appWorkspaces = localWorkspaces.filter(w => w.source !== 'slack');

  if (appWorkspaces.length === 0) {
    return (
      <div className="rounded-2xl p-12 text-center" style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
        <p className="text-slate-400 text-sm">No workspaces to map yet.</p>
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
      <div className="rounded-2xl px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4" style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
        <div className="col-span-2 sm:col-span-1 flex items-center gap-3 sm:border-r sm:border-slate-100 sm:pr-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm" style={{ background: avgHealth !== null ? `${healthColor(avgHealth)}18` : 'rgba(15,23,42,0.05)', color: avgHealth !== null ? healthColor(avgHealth) : '#94a3b8' }}>
            {avgHealth ?? '—'}
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Portfolio Health</p>
            <p className="text-xs font-semibold text-slate-700">{avgHealth === null ? 'No analysis' : avgHealth >= 75 ? 'Sharp' : avgHealth >= 55 ? 'Developing' : avgHealth >= 35 ? 'Fragmented' : 'Critical'}</p>
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
        <div className="rounded-2xl px-5 py-3 flex items-center gap-4 flex-wrap" style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.07)' }}>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Connections:</span>
          {RELATIONSHIP_TYPES.map(r => {
            const count = links.filter(l => l.relationship_type === r.key).length;
            if (count === 0) return null;
            return (
              <div key={r.key} className="flex items-center gap-1.5">
                <span className="w-4 h-0 inline-block border-t" style={{ borderColor: r.color, borderTopWidth: '1.5px', opacity: 0.7, borderStyle: r.key === 'conflicts_with' ? 'dashed' : r.key === 'depends_on' ? 'dotted' : 'solid' }} />
                <span className="text-[10px] font-semibold" style={{ color: r.color }}>{r.label}</span>
                <span className="text-[10px] text-slate-400">({count})</span>
              </div>
            );
          })}
          <span className="text-[10px] text-slate-400 ml-auto">{links.length} total</span>
        </div>
      )}

      {/* Health legend */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Health:</span>
        {[
          { label: 'Sharp ≥75', color: '#16a34a' },
          { label: 'Developing ≥55', color: '#d97706' },
          { label: 'Fragmented ≥35', color: '#ea580c' },
          { label: 'Critical', color: '#dc2626' },
          { label: 'No analysis', color: '#cbd5e1' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5 mr-3">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }} />
            <span className="text-[10px] text-slate-500">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Kanban board with SVG overlay */}
      <div ref={boardRef} className="relative overflow-x-auto -mx-4 sm:mx-0">
        <ConnectionLines lines={connectionLines} />

        <div className="flex gap-4 px-4 sm:px-0 pb-2" style={{ minWidth: 'max-content', width: '100%' }}>
          {STATUSES.map(s => {
            const col = appWorkspaces.filter(w => w.decision_status === s.key);
            const isDropTarget = draggingId !== null && dragOverStatus === s.key;

            return (
              <div
                key={s.key}
                ref={el => { if (el) columnRefs.current.set(s.key, el); else columnRefs.current.delete(s.key); }}
                className="flex-1 rounded-2xl p-3 space-y-3 transition-all duration-150"
                style={{
                  background: isDropTarget ? s.activeBg : s.bg,
                  border: isDropTarget ? `2px solid ${s.color}60` : `1px solid ${s.border}`,
                  minWidth: '220px',
                  maxWidth: '320px',
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
                  <div className="rounded-xl py-5 text-center" style={{ border: `2px dashed ${s.color}50`, background: `${s.color}08` }}>
                    <p className="text-[10px] font-semibold" style={{ color: s.color }}>Drop here</p>
                  </div>
                )}

                {col.length === 0 && !isDropTarget ? (
                  <div className="rounded-xl py-6 text-center" style={{ border: `1.5px dashed ${s.border}`, background: 'rgba(255,255,255,0.5)' }}>
                    <p className="text-[10px] text-slate-400">No decisions here</p>
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
                      />
                    </div>
                  ))
                )}

                {isDropTarget && col.length > 0 && (
                  <div className="rounded-xl py-3 text-center" style={{ border: `2px dashed ${s.color}50`, background: `${s.color}08` }}>
                    <p className="text-[10px] font-semibold" style={{ color: s.color }}>Drop here</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Category legend */}
      <div className="rounded-2xl px-5 py-4" style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.07)' }}>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Decision Categories</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => {
            const count = appWorkspaces.filter(w => w.decision_category === c.key).length;
            return (
              <div key={c.key} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: c.bg }}>
                <span className="text-xs font-semibold" style={{ color: c.color }}>{c.label}</span>
                <span className="text-[10px] font-bold text-slate-400">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-slate-400 text-center">
        Drag cards between stages · Hover a card to use the <Link2 className="w-2.5 h-2.5 inline" /> icon to connect decisions · Use <Pencil className="w-2.5 h-2.5 inline" /> to edit category or status
      </p>
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
}

function DecisionCard({ ws, healthScore, memberCount, linkCount, isDragging, allWorkspaces, existingLinks, onNavigate, onMetaUpdated, onDragStart, onLinked, onUnlinked }: CardProps) {
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  const cat = categoryMeta(ws.decision_category);
  const isOwnerOrAdmin = ws.role === 'owner' || ws.role === 'admin';
  const isSlack = ws.source === 'slack';
  const isExpired = ws.subscription_status === 'inactive';

  return (
    <div
      className="relative group rounded-2xl transition-all duration-150"
      style={{
        background: '#fff',
        border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: isDragging ? 'none' : '0 1px 4px rgba(15,23,42,0.05)',
        opacity: isDragging ? 0.35 : isExpired ? 0.65 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: healthScore !== null ? healthColor(healthScore) : 'transparent' }} />

      <div
        className="p-4"
        onPointerDown={e => {
          if ((e.target as HTMLElement).closest('button')) return;
          onDragStart(e, ws);
        }}
        onClick={() => { if (!editing && !linking) onNavigate('workspace-hub', ws.id); }}
      >
        <div className="flex items-start gap-2 mb-3">
          <GripVertical className="w-3.5 h-3.5 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: '#64748b' }} />

          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: isSlack ? 'rgba(74,21,75,0.09)' : isExpired ? 'rgba(100,116,139,0.1)' : 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}>
            {isSlack ? <MessageSquare className="w-3.5 h-3.5" style={{ color: '#4a154b' }} /> : <Lock className={`w-3.5 h-3.5 ${isExpired ? 'text-slate-400' : 'text-white'}`} />}
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold leading-tight ${isExpired ? 'text-slate-400' : 'text-slate-800'} truncate`}>{ws.name}</p>
            {ws.description && <p className="text-[10px] text-slate-400 truncate mt-0.5">{ws.description}</p>}
          </div>

          {isOwnerOrAdmin && !isSlack && (
            <div className="relative flex-shrink-0 flex items-center gap-0.5">
              <div className="relative">
                <button
                  onClick={e => { e.stopPropagation(); setLinking(v => !v); setEditing(false); }}
                  className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  style={{ color: linking ? '#2563eb' : '#94a3b8' }}
                  title="Connect to another decision"
                >
                  <Link2 className="w-3 h-3" />
                </button>
                {linking && (
                  <LinkPopover
                    workspaceId={ws.id}
                    workspaceName={ws.name}
                    allWorkspaces={allWorkspaces}
                    existingLinks={existingLinks}
                    onLinked={link => { onLinked(link); }}
                    onUnlinked={onUnlinked}
                    onClose={() => setLinking(false)}
                  />
                )}
              </div>
              <div className="relative">
                <button
                  onClick={e => { e.stopPropagation(); setEditing(v => !v); setLinking(false); }}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                {editing && (
                  <EditPopover
                    workspaceId={ws.id}
                    category={ws.decision_category}
                    status={ws.decision_status}
                    onSaved={(cat, sta) => { setEditing(false); onMetaUpdated(ws.id, cat, sta); }}
                    onClose={() => setEditing(false)}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
          {isExpired && <span className="text-[10px] font-semibold text-red-500 flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" />Expired</span>}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" title={healthLabel(healthScore)}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: healthColor(healthScore) }} />
            <span className="text-[10px] text-slate-400">{healthScore !== null ? `${healthScore}` : '—'}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <Users className="w-3 h-3" />
            <span className="text-[10px]">{memberCount}</span>
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
        </div>
      </div>
    </div>
  );
}
