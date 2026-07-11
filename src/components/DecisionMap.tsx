import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, MessageSquare, Users, AlertTriangle, Pencil, Check, X, GripVertical } from 'lucide-react';
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

function statusMeta(key: string) {
  return STATUSES.find(s => s.key === key) ?? STATUSES[0];
}
function categoryMeta(key: string) {
  return CATEGORIES.find(c => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
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

// ─── Inline edit popover ──────────────────────────────────────────────────────

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

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  ws: MapWorkspace;
  healthScore: number | null;
  memberCount: number;
  isDragging: boolean;
  onNavigate: (page: string, id?: string) => void;
  onMetaUpdated: (id: string, category: string, status: string) => void;
  onDragStart: (e: React.PointerEvent, ws: MapWorkspace) => void;
}

function DecisionCard({ ws, healthScore, memberCount, isDragging, onNavigate, onMetaUpdated, onDragStart }: CardProps) {
  const [editing, setEditing] = useState(false);
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
      {/* Health bar across top */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ background: healthScore !== null ? healthColor(healthScore) : 'transparent' }}
      />

      {/* Drag handle + click-to-navigate zone */}
      <div
        className="p-4"
        onPointerDown={e => {
          // Don't start drag if clicking a button or the edit popover
          if ((e.target as HTMLElement).closest('button')) return;
          onDragStart(e, ws);
        }}
        onClick={() => { if (!editing) onNavigate('workspace-hub', ws.id); }}
      >
        {/* Top row: grip + icon + name + edit */}
        <div className="flex items-start gap-2 mb-3">
          {/* Grip handle */}
          <GripVertical
            className="w-3.5 h-3.5 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-40 transition-opacity"
            style={{ color: '#64748b' }}
          />

          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: isSlack ? 'rgba(74,21,75,0.09)' : isExpired ? 'rgba(100,116,139,0.1)' : 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
          >
            {isSlack
              ? <MessageSquare className="w-3.5 h-3.5" style={{ color: '#4a154b' }} />
              : <Lock className={`w-3.5 h-3.5 ${isExpired ? 'text-slate-400' : 'text-white'}`} />
            }
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold leading-tight ${isExpired ? 'text-slate-400' : 'text-slate-800'} truncate`}>
              {ws.name}
            </p>
            {ws.description && (
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{ws.description}</p>
            )}
          </div>

          {/* Edit button — owners/admins, non-Slack */}
          {isOwnerOrAdmin && !isSlack && (
            <div className="relative flex-shrink-0">
              <button
                onClick={e => { e.stopPropagation(); setEditing(v => !v); }}
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
          )}
        </div>

        {/* Category badge */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: cat.bg, color: cat.color }}
          >
            {cat.label}
          </span>
          {isExpired && (
            <span className="text-[10px] font-semibold text-red-500 flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" />
              Expired
            </span>
          )}
        </div>

        {/* Bottom row: health + members */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" title={healthLabel(healthScore)}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: healthColor(healthScore) }} />
            <span className="text-[10px] text-slate-400">{healthScore !== null ? `${healthScore}` : '—'}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <Users className="w-3 h-3" />
            <span className="text-[10px]">{memberCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Drag ghost ───────────────────────────────────────────────────────────────

interface GhostStyle {
  x: number;
  y: number;
  width: number;
  label: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DecisionMap({ workspaces, onNavigate }: DecisionMapProps) {
  const { user } = useAuth();
  const [healthScores, setHealthScores] = useState<Record<string, number>>({});
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [localWorkspaces, setLocalWorkspaces] = useState(workspaces);

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [ghost, setGhost] = useState<GhostStyle | null>(null);
  const dragRef = useRef<{
    wsId: string;
    fromStatus: string;
    overStatus: string | null;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const columnRefs = useRef<Map<string, HTMLElement>>(new Map());
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

  function handleMetaUpdated(id: string, category: string, status: string) {
    setLocalWorkspaces(prev =>
      prev.map(w => w.id === id ? { ...w, decision_category: category, decision_status: status } : w)
    );
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
    }
  }

  // ── Drag helpers ───────────────────────────────────────────────────────────

  function getStatusFromPoint(x: number, y: number): string | null {
    for (const [status, el] of columnRefs.current) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return status;
      }
    }
    return null;
  }

  const startDrag = useCallback((e: React.PointerEvent, ws: MapWorkspace) => {
    if (ws.source === 'slack') return; // Slack sessions can't be moved
    e.preventDefault();

    const cardEl = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-card-id]');
    const width = cardEl ? cardEl.getBoundingClientRect().width : 220;

    dragRef.current = {
      wsId: ws.id,
      fromStatus: ws.decision_status,
      overStatus: ws.decision_status,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };

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

    function onUp(e: PointerEvent) {
      if (!dragRef.current) return;
      const { wsId, fromStatus, overStatus, moved } = dragRef.current;
      dragRef.current = null;

      setDraggingId(null);
      setDragOverStatus(null);
      setGhost(null);

      if (moved && overStatus && overStatus !== fromStatus) {
        saveStatusChange(wsId, overStatus);
      }
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

  const appWorkspaces = localWorkspaces.filter(w => w.source !== 'slack');

  if (appWorkspaces.length === 0) {
    return (
      <div
        className="rounded-2xl p-12 text-center"
        style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}
      >
        <p className="text-slate-400 text-sm">No workspaces to map yet.</p>
      </div>
    );
  }

  // Portfolio stats
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

      {/* Ghost element — follows pointer */}
      {ghost && draggingId && (
        <div
          style={{
            position: 'fixed',
            left: ghost.x,
            top: ghost.y,
            transform: 'translate(-50%, -50%) rotate(2deg)',
            width: ghost.width,
            pointerEvents: 'none',
            zIndex: 9999,
            background: '#fff',
            borderRadius: '1rem',
            boxShadow: '0 24px 48px rgba(15,23,42,0.22)',
            border: '1.5px solid rgba(37,99,235,0.3)',
            padding: '0.75rem 1rem',
            transition: 'box-shadow 0.1s',
          }}
        >
          <p className="text-xs font-bold text-slate-800 truncate">{ghost.label}</p>
          {dragOverStatus && (
            <p className="text-[10px] mt-0.5 font-semibold" style={{ color: statusMeta(dragOverStatus).color }}>
              → {statusMeta(dragOverStatus).label}
            </p>
          )}
        </div>
      )}

      {/* Portfolio summary bar */}
      <div
        className="rounded-2xl px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
        style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}
      >
        <div className="col-span-2 sm:col-span-1 flex items-center gap-3 sm:border-r sm:border-slate-100 sm:pr-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm"
            style={{
              background: avgHealth !== null ? `${healthColor(avgHealth)}18` : 'rgba(15,23,42,0.05)',
              color: avgHealth !== null ? healthColor(avgHealth) : '#94a3b8',
            }}
          >
            {avgHealth ?? '—'}
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Portfolio Health</p>
            <p className="text-xs font-semibold text-slate-700">
              {avgHealth === null ? 'No analysis' : avgHealth >= 75 ? 'Sharp' : avgHealth >= 55 ? 'Developing' : avgHealth >= 35 ? 'Fragmented' : 'Critical'}
            </p>
          </div>
        </div>

        {STATUSES.map(s => (
          <div key={s.key} className="flex flex-col gap-1">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: s.color }}>{s.label}</p>
            <p className="text-lg font-black text-slate-800">{statusCounts[s.key]}</p>
          </div>
        ))}
      </div>

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

      {/* Kanban columns — horizontal scroll on mobile */}
      <div ref={boardRef} className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="flex gap-4 px-4 sm:px-0 pb-2" style={{ minWidth: 'max-content', width: '100%' }}>
          {STATUSES.map(s => {
            const col = appWorkspaces.filter(w => w.decision_status === s.key);
            const isDropTarget = draggingId !== null && dragOverStatus === s.key;
            const isSourceCol = draggingId !== null && col.some(w => w.id === draggingId) && dragOverStatus !== s.key;

            return (
              <div
                key={s.key}
                ref={el => {
                  if (el) columnRefs.current.set(s.key, el);
                  else columnRefs.current.delete(s.key);
                }}
                className="flex-1 rounded-2xl p-3 space-y-3 transition-all duration-150"
                style={{
                  background: isDropTarget ? s.activeBg : s.bg,
                  border: isDropTarget
                    ? `2px solid ${s.color}60`
                    : `1px solid ${s.border}`,
                  minWidth: '220px',
                  maxWidth: '320px',
                  transform: isDropTarget ? 'scale(1.01)' : 'scale(1)',
                  boxShadow: isDropTarget ? `0 0 0 4px ${s.color}14` : 'none',
                }}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    <span className="text-xs font-bold" style={{ color: s.color }}>{s.label}</span>
                  </div>
                  <span
                    className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: `${s.color}20`, color: s.color }}
                  >
                    {col.length}
                  </span>
                </div>

                {/* Drop zone hint when dragging over an empty column */}
                {isDropTarget && col.filter(w => w.id !== draggingId).length === 0 && col.length === 0 && (
                  <div
                    className="rounded-xl py-5 text-center transition-all"
                    style={{ border: `2px dashed ${s.color}50`, background: `${s.color}08` }}
                  >
                    <p className="text-[10px] font-semibold" style={{ color: s.color }}>Drop here</p>
                  </div>
                )}

                {/* Cards */}
                {col.length === 0 && !isDropTarget ? (
                  <div
                    className="rounded-xl py-6 text-center"
                    style={{ border: `1.5px dashed ${s.border}`, background: 'rgba(255,255,255,0.5)' }}
                  >
                    <p className="text-[10px] text-slate-400">No decisions here</p>
                  </div>
                ) : (
                  col.map(ws => (
                    <div key={ws.id} data-card-id={ws.id}>
                      <DecisionCard
                        ws={ws}
                        healthScore={healthScores[ws.id] ?? null}
                        memberCount={memberCounts[ws.id] ?? 0}
                        isDragging={draggingId === ws.id}
                        onNavigate={onNavigate}
                        onMetaUpdated={handleMetaUpdated}
                        onDragStart={startDrag}
                      />
                    </div>
                  ))
                )}

                {/* Drop target hint when column already has cards */}
                {isDropTarget && col.length > 0 && (
                  <div
                    className="rounded-xl py-3 text-center transition-all"
                    style={{ border: `2px dashed ${s.color}50`, background: `${s.color}08` }}
                  >
                    <p className="text-[10px] font-semibold" style={{ color: s.color }}>Drop here</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Category legend */}
      <div
        className="rounded-2xl px-5 py-4"
        style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.07)' }}
      >
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Decision Categories</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => {
            const count = appWorkspaces.filter(w => w.decision_category === c.key).length;
            return (
              <div
                key={c.key}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{ background: c.bg }}
              >
                <span className="text-xs font-semibold" style={{ color: c.color }}>{c.label}</span>
                <span className="text-[10px] font-bold text-slate-400">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-slate-400 text-center">
        Drag a card to move it between stages. Tap the pencil icon to edit category or status manually.
      </p>
    </div>
  );
}
